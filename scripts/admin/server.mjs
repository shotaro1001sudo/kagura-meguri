// 管理者用ページ(自分のPCだけで使う): npm run admin
//   開催の一覧・編集・取り下げ / 投稿フォームの申請の許可・却下 / 問い合わせの対応状況
//   保存するのは data/events.json だけ。コミットと公開(git push)は、これまでどおり別に行う。
// 安全のため: 127.0.0.1 だけで待ち受ける / 起動ごとの合言葉(トークン)がない操作は受け付けない /
//            Host・Origin を確かめる(ほかのサイトから、この画面を操作させない)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PREFECTURES } from "../lib/util.mjs";
import { loadEvents, saveEvents, loadConfig, loadLocal, loadInbox, saveInbox, pruneInbox, setInboxStatus, upsertEvent, suggestId, INBOX_STATUS } from "./store.mjs";
import { fetchFormMails } from "./mail.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = { "/": ["app.html", "text/html; charset=utf-8"], "/app.js": ["app.js", "text/javascript; charset=utf-8"], "/app.css": ["app.css", "text/css; charset=utf-8"] };
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; form-action 'none'; frame-ancestors 'none'; base-uri 'none'";
const todayJst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

/**
 * サーバーを起動する。テストでは root(作業用のコピー)・fetchMails(偽のメール取得)・geocode を差し替える。
 */
export function startAdmin({ root = process.cwd(), port = 4300, fetchMails = fetchFormMails, geocode = runGeocode, today = todayJst } = {}) {
  const token = randomBytes(24).toString("hex");
  const cfg = loadConfig(root);
  const site = cfg.siteName ?? "神楽めぐり";
  // 書き込みは1つずつ順番に(位置の取得の途中で、別の保存が重ならないように)
  let queue = Promise.resolve();
  const serial = (fn) => { const p = queue.then(fn); queue = p.catch(() => {}); return p; };

  const state = () => {
    const box = loadInbox(root);
    const local = loadLocal(root);
    return { events: loadEvents(root), inbox: box.items, lastFetch: box.lastFetch, mailReady: !!(local.gmail?.user && local.gmail?.appPassword),
      today: today(), site, operator: cfg.operator?.name ?? site, baseUrl: cfg.baseUrl ?? "", prefectures: PREFECTURES, inboxStatus: INBOX_STATUS };
  };

  const api = {
    "GET /api/state": () => state(),

    "POST /api/fetch-mail": () => serial(async () => {
      const g = loadLocal(root).gmail ?? {};
      if (!g.user || !g.appPassword) return [400, { error: "Gmail の設定(admin.local.json)がありません。ADMIN.md の手順で設定してください。" }];
      const box = loadInbox(root);
      let items;
      try { items = await fetchMails({ user: g.user, pass: g.appPassword, site, knownIds: new Set(box.items.map((x) => x.messageId)) }); }
      catch (err) { return [502, { error: `Gmail から読み込めませんでした(${err.authenticationFailed ? "ユーザー名またはアプリパスワードが違います" : err.code || err.message})` }]; }
      const events = loadEvents(root);
      for (const it of items) if (it.draft) it.draft.id = suggestId(it.draft, events);
      box.items.push(...items);
      box.items.sort((a, b) => b.received.localeCompare(a.received));
      box.lastFetch = new Date().toISOString();
      const pruned = pruneInbox(box, today());
      saveInbox(root, box);
      return { added: items.length, pruned, state: state() };
    }),

    // 開催の保存(追加・編集)。inboxId があれば、その申請を「掲載済み」にする
    "POST /api/events/save": (body) => serial(async () => {
      const events = loadEvents(root);
      const box = loadInbox(root);
      const item = body.inboxId ? box.items.find((x) => x.id === body.inboxId) : null;
      if (body.inboxId && !item) return [404, { error: "申請が見つかりません" }];
      const r = upsertEvent(events, body.event ?? {}, body.originalId ?? null, body.originalId ? undefined : "published");
      if (r.errs) return [400, { error: "入力内容を確認してください", fields: r.errs }];
      saveEvents(root, events);
      if (item) { item.eventId = r.event.id; setInboxStatus(item, "published", today()); saveInbox(root, box); }
      const geo = r.event.lat ? "" : await geocode(root);
      return { saved: r.event.id, geocode: geo, state: state() };
    }),

    // 取り下げ(サイトから外す) / 再掲載
    "POST /api/events/status": (body) => serial(() => {
      if (!["published", "withdrawn"].includes(body.status)) return [400, { error: "不明な状態です" }];
      const events = loadEvents(root);
      const e = events.find((x) => x.id === body.id);
      if (!e) return [404, { error: "開催が見つかりません" }];
      e.status = body.status;
      saveEvents(root, events);
      return { state: state() };
    }),

    // 申請・問い合わせの状態とメモ
    "POST /api/inbox/update": (body) => serial(() => {
      const box = loadInbox(root);
      const item = box.items.find((x) => x.id === body.id);
      if (!item) return [404, { error: "見つかりません" }];
      if (body.status) { try { setInboxStatus(item, body.status, today()); } catch (err) { return [400, { error: err.message }]; } }
      if (typeof body.memo === "string") item.memo = body.memo.slice(0, 2000);
      saveInbox(root, box);
      return { state: state() };
    }),
  };

  const server = createServer(async (req, res) => {
    const send = (code, type, body, extra = {}) => {
      res.writeHead(code, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
        "x-frame-options": "DENY", "content-security-policy": CSP, ...extra });
      res.end(body);
    };
    const json = (code, v) => send(code, "application/json; charset=utf-8", JSON.stringify(v));
    const port = server.address().port;
    const allowed = [`127.0.0.1:${port}`, `localhost:${port}`];
    // 別のサイトが、名前を付け替えてこのサーバーを読む攻撃(DNS リバインディング)を防ぐ
    if (!allowed.includes(req.headers.host)) return json(421, { error: "このアドレスからは使えません" });
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && ASSETS[url.pathname]) {
      const [file, type] = ASSETS[url.pathname];
      let body = await readFile(join(HERE, file), "utf8");
      if (file === "app.html") body = body.replace("%%TOKEN%%", token);
      return send(200, type, body);
    }
    const handler = api[`${req.method} ${url.pathname}`];
    if (!handler) return json(404, { error: "not found" });
    if (req.headers["x-admin-token"] !== token) return json(403, { error: "トークンがありません。画面を開き直してください。" });
    if (req.headers.origin && !allowed.map((h) => `http://${h}`).includes(req.headers.origin)) return json(403, { error: "ほかのサイトからは使えません" });
    let body = {};
    if (req.method === "POST") {
      if (!/^application\/json/.test(req.headers["content-type"] ?? "")) return json(415, { error: "JSON で送ってください" });
      let raw = "";
      for await (const c of req) { raw += c; if (raw.length > 200_000) return json(413, { error: "大きすぎます" }); }
      try { body = JSON.parse(raw || "{}"); } catch { return json(400, { error: "JSON が正しくありません" }); }
    }
    try {
      const out = await handler(body);
      if (Array.isArray(out)) json(out[0], out[1]); else json(200, out);
    } catch (err) { console.error(err); json(500, { error: `処理に失敗しました: ${err.message}` }); }
  });

  return new Promise((resolve, reject) => {
    const listen = (p) => server.listen(p, "127.0.0.1");
    server.once("error", (err) => { if (err.code === "EADDRINUSE" && port !== 0) { server.once("error", reject); listen(0); } else reject(err); });
    server.once("listening", () => resolve({ server, token, url: `http://127.0.0.1:${server.address().port}/` }));
    listen(port);
  });
}

/** 緯度経度のない開催に、住所から位置を付ける(scripts/geocode.mjs を、開催データだけに使う) */
export function runGeocode(root) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ["scripts/geocode.mjs"], { cwd: root, env: { ...process.env, GEOCODE_FILES: "data/events.json" } });
    let out = "";
    p.stdout.on("data", (c) => (out += c)); p.stderr.on("data", (c) => (out += c));
    p.on("close", () => resolve(out.trim()));
    p.on("error", (err) => resolve(`位置の取得を実行できませんでした: ${err.message}`));
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.argv.find((a) => a.startsWith("--port="))?.slice(7)) || 4300;
  const { url } = await startAdmin({ port });
  console.log(`管理者用ページ: ${url}\n(このPCの中だけで動いています。終わるときは Ctrl+C)`);
  if (!process.argv.includes("--no-open")) {
    const [cmd, args] = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
    spawn(cmd, args, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
  }
}
