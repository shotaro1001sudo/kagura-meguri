// 管理者用ページ(自分のPCだけで使う): npm run admin
//   開催の一覧・編集・取り下げ / 投稿フォームの申請の許可・却下 / 問い合わせの対応状況
//   判断待ち: 自動収集の保留の掲載・却下 / 週次の振り返りの【人】の項目 / 検索の改善案(頼む・見送る)
//   予定タスク: Claude アプリのスケジュール済みタスクの次回・前回・止まっていないか(読むだけ。tasks.mjs)
//   定期の更新: 数時間おきに、GitHub の最新の取り込みと Gmail の読み込みを行う(refreshHours。admin.local.json で変えられる)
//   保存するのは data/events.json だけ。コミットと公開(git push)は、これまでどおり別に行う。
// 安全のため: 127.0.0.1 だけで待ち受ける / 起動ごとの合言葉(トークン)がない操作は受け付けない /
//            Host・Origin を確かめる(ほかのサイトから、この画面を操作させない)
// スマホから: Tailscale Serve(自分の端末だけに見える https://<PC>.<tailnet>.ts.net)経由で開ける。
//            そのアドレスでは、さらにスマホ用の鍵(PC の画面の QR コードで入る Cookie)がないと、画面もデータも出さない(phone.mjs)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PREFECTURES } from "../lib/util.mjs";
import { loadEvents, saveEvents, loadConfig, loadLocal, loadInbox, saveInbox, pruneInbox, setInboxStatus, upsertEvent, suggestId, INBOX_STATUS, rejectPending, loadReview, loadProposals, setProposalStatus, PROPOSAL_STATUS, loadPlan, setPlanItem, setManual, PLAN_STATUS, MANUAL_FIELDS } from "./store.mjs";
import { fetchFormMails } from "./mail.mjs";
import { publish, pendingChanges, mentionedIds, repoWebUrl, syncMain } from "./publish.mjs";
import { loadTasks } from "./tasks.mjs";
import { phoneKey, resetPhoneKey, sameKey, cookieValue, detectPhoneHost, qrSvg } from "./phone.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = { "/": ["app.html", "text/html; charset=utf-8"], "/app.js": ["app.js", "text/javascript; charset=utf-8"], "/app.css": ["app.css", "text/css; charset=utf-8"] };
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; form-action 'none'; frame-ancestors 'none'; base-uri 'none'";
const todayJst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

/**
 * サーバーを起動する。テストでは root(作業用のコピー)・fetchMails(偽のメール取得)・geocode・publisher(コミットと push)を差し替える。
 */
export function startAdmin({ root = process.cwd(), port = 4300, fetchMails = fetchFormMails, geocode = runGeocode, today = todayJst, publisher = publish, pending = pendingChanges, commitIds = mentionedIds, repoUrl = repoWebUrl, phoneHost = detectPhoneHost, tasks = loadTasks, sync = syncMain, refreshHours = loadLocal(root).refreshHours ?? 3, now = () => Date.now() } = {}) {
  const token = randomBytes(24).toString("hex");
  // スマホから使うアドレス(Tailscale の名前)。調べ終わるまでは、スマホからは開けない
  let remoteHost = "";
  const phoneReady = Promise.resolve().then(() => phoneHost(root)).then((h) => { remoteHost = h || ""; }).catch(() => {});
  const cfg = loadConfig(root);
  const site = cfg.siteName ?? "神楽めぐり";
  // 書き込みは1つずつ順番に(位置の取得の途中で、別の保存が重ならないように)
  let queue = Promise.resolve();
  const serial = (fn) => { const p = queue.then(fn); queue = p.catch(() => {}); return p; };
  // 定期の更新の記録
  let lastRefresh = null;

  const state = async () => {
    const box = loadInbox(root);
    const local = loadLocal(root);
    return { events: loadEvents(root), inbox: box.items, lastFetch: box.lastFetch, mailReady: !!(local.gmail?.user && local.gmail?.appPassword), gmailUser: local.gmail?.user ?? "",
      today: today(), site, operator: cfg.operator?.name ?? site, baseUrl: cfg.baseUrl ?? "", prefectures: PREFECTURES, inboxStatus: INBOX_STATUS, pending: await pending(root).catch(() => null),
      review: loadReview(root), proposals: loadProposals(root), proposalStatus: PROPOSAL_STATUS, committedIds: await commitIds(root).catch(() => []), repo: await repoUrl(root).catch(() => ""),
      plan: loadPlan(root), planStatus: PLAN_STATUS, manualFields: MANUAL_FIELDS, tasks: safeTasks({}),
      refresh: { last: lastRefresh, hours: refreshHours } };
  };

  // Gmail から、新しい申請・問い合わせを読み込む(画面のボタンと、定期の更新の両方から)
  const readMail = async () => {
    const g = loadLocal(root).gmail ?? {};
    if (!g.user || !g.appPassword) return { code: 400, error: "Gmail の設定(admin.local.json)がありません。ADMIN.md の手順で設定してください。" };
    const box = loadInbox(root);
    let items;
    try { items = await fetchMails({ user: g.user, pass: g.appPassword, site, knownIds: new Set(box.items.map((x) => x.messageId)) }); }
    catch (err) { return { code: 502, error: `Gmail から読み込めませんでした(${err.authenticationFailed ? "ユーザー名またはアプリパスワードが違います" : err.code || err.message})` }; }
    const events = loadEvents(root);
    for (const it of items) if (it.draft) it.draft.id = suggestId(it.draft, events);
    box.items.push(...items);
    box.items.sort((a, b) => b.received.localeCompare(a.received));
    box.lastFetch = new Date().toISOString();
    const pruned = pruneInbox(box, today());
    saveInbox(root, box);
    return { added: items.length, pruned };
  };

  // 定期の更新: GitHub の最新を取り込む → Gmail を読み込む。ほかの保存・公開と重ならないよう、順番に
  const refresh = (why) => serial(async () => {
    const r = { at: new Date(now()).toISOString(), why };
    try { r.git = await sync(root); } catch (err) { r.git = { ok: false, text: err.message }; }
    if (loadLocal(root).gmail?.appPassword) { const m = await readMail(); r.mail = m.error ? { ok: false, text: m.error } : { ok: true, text: `新しい申請・問い合わせ ${m.added} 件`, added: m.added }; }
    lastRefresh = r;
    return r;
  });
  let timer = null, first = null;
  if (refreshHours > 0) {
    first = setTimeout(() => refresh("起動のあと").catch(() => {}), 60e3);
    timer = setInterval(() => refresh("定期").catch(() => {}), refreshHours * 3600e3);
    first.unref?.(); timer.unref?.();
  }
  // 予定タスク(読むだけ)。読めなくても、ほかの画面は使えるように
  const safeTasks = (o) => { try { return tasks(o); } catch (err) { return { found: true, error: `予定タスクを読めませんでした(${err.message})`, tasks: [] }; } };

  // 開催データを変えた操作は、そのままコミットして push する(数分後にサイトに反映)
  const release = (what, e) => publisher(root, `data(admin): ${what}: ${e.name}`).catch((err) => ({ ok: false, step: "push", log: err.message }));

  const api = {
    "GET /api/state": () => state(),

    // 予定タスクの一覧と、最近の実行の結果(タブを開いたときだけ。セッションの記録を読むため)
    "GET /api/tasks": () => safeTasks({ runs: true }),

    // 反映に失敗したときの、やり直し
    "POST /api/publish": () => serial(async () => ({ publish: await publisher(root, "data(admin): 管理者用ページの変更"), state: await state() })),

    "POST /api/fetch-mail": () => serial(async () => {
      const r = await readMail();
      if (r.error) return [r.code, { error: r.error }];
      return { ...r, state: await state() };
    }),

    // いますぐ更新(定期の更新と同じ)
    "POST /api/refresh": async () => ({ refresh: await refresh("手動"), state: await state() }),

    // 開催の保存(追加・編集)。inboxId があれば、その申請を「掲載済み」にする
    "POST /api/events/save": (body) => serial(async () => {
      const events = loadEvents(root);
      const box = loadInbox(root);
      const item = body.inboxId ? box.items.find((x) => x.id === body.inboxId) : null;
      if (body.inboxId && !item) return [404, { error: "申請が見つかりません" }];
      // approve: 保留中の開催を、内容を確かめて掲載する(scripts/review.mjs approve と同じく、保留の理由を消す)
      const approving = body.approve === true && !!body.originalId;
      if (approving && events.find((x) => x.id === body.originalId)?.status !== "pending") return [400, { error: "掲載できるのは、保留中の開催だけです" }];
      const r = upsertEvent(events, body.event ?? {}, body.originalId ?? null, approving ? "published" : body.originalId ? undefined : "published");
      if (r.errs) return [400, { error: "入力内容を確認してください", fields: r.errs }];
      if (approving) delete r.event.holdReasons;
      saveEvents(root, events);
      if (item) { item.eventId = r.event.id; setInboxStatus(item, "published", today()); saveInbox(root, box); }
      const geo = r.event.lat ? "" : await geocode(root);
      const pub = await release(item ? "掲載(申請)" : approving ? "掲載(保留)" : body.originalId ? "編集" : "追加", r.event);
      return { saved: r.event.id, geocode: geo, publish: pub, state: await state() };
    }),

    // 取り下げ(サイトから外す) / 再掲載
    "POST /api/events/status": (body) => serial(async () => {
      if (!["published", "withdrawn"].includes(body.status)) return [400, { error: "不明な状態です" }];
      const events = loadEvents(root);
      const e = events.find((x) => x.id === body.id);
      if (!e) return [404, { error: "開催が見つかりません" }];
      e.status = body.status;
      saveEvents(root, events);
      const pub = await release(body.status === "withdrawn" ? "取り下げ" : "再掲載", e);
      return { publish: pub, state: await state() };
    }),

    // 保留中の開催の却下(開催データから外し、rejected.json に記録。自動収集が取り直さない)
    "POST /api/events/reject": (body) => serial(async () => {
      const r = rejectPending(root, body.id);
      if (r.error) return [r.code, { error: r.error }];
      const pub = await release("却下(保留)", r.event);
      return { publish: pub, state: await state() };
    }),

    // 検索の改善案を見送る / 見送りを戻す(analytics/state.json。このPCだけ。push しない)
    "POST /api/proposals/update": (body) => serial(async () => {
      const r = setProposalStatus(root, body.id, body.status, today(), body.note);
      if (r.error) return [r.code, { error: r.error }];
      return { state: await state() };
    }),

    // 目標・KPI・収益化の案: 採用 / 見送り / 実施済み / 目標の変更 と、手入力の実績(analytics/plan.json。このPCだけ。push しない)
    "POST /api/plan/item": (body) => serial(async () => {
      const r = setPlanItem(root, { kind: body.kind, id: body.id, status: body.status, note: body.note, targets: body.targets }, today());
      if (r.error) return [r.code, { error: r.error }];
      return { state: await state() };
    }),
    "POST /api/plan/manual": (body) => serial(async () => {
      const r = setManual(root, body.month, body.values, today());
      if (r.error) return [r.code, { error: r.error }];
      return { state: await state() };
    }),

    // スマホで開く: QR コード(鍵入りのアドレス)と、鍵の作り直し。PC の画面からだけ(スマホからは 403)
    "GET /api/phone": async (_b, ctx) => {
      if (ctx.remote) return [403, { error: "スマホからは使えません" }];
      await phoneReady;
      if (!remoteHost) return { ready: false };
      const link = `https://${remoteHost}/phone?key=${encodeURIComponent(phoneKey(root))}`;
      return { ready: true, host: remoteHost, qr: await qrSvg(link) };
    },
    "POST /api/phone/reset": async (_b, ctx) => {
      if (ctx.remote) return [403, { error: "スマホからは使えません" }];
      resetPhoneKey(root);
      return { reset: true };
    },

    // 申請・問い合わせの状態とメモ
    "POST /api/inbox/update": (body) => serial(async () => {
      const box = loadInbox(root);
      const item = box.items.find((x) => x.id === body.id);
      if (!item) return [404, { error: "見つかりません" }];
      if (body.status) { try { setInboxStatus(item, body.status, today()); } catch (err) { return [400, { error: err.message }]; } }
      if (typeof body.memo === "string") item.memo = body.memo.slice(0, 2000);
      saveInbox(root, box);
      return { state: await state() };
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
    const remote = !!remoteHost && req.headers.host === remoteHost;
    // 別のサイトが、名前を付け替えてこのサーバーを読む攻撃(DNS リバインディング)を防ぐ
    if (!allowed.includes(req.headers.host) && !remote) return json(421, { error: "このアドレスからは使えません" });
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (remote) {
      // QR コードのアドレス(/phone?key=…)を開くと、スマホに鍵が入る(90日。https だけ・カメラの QR から開いても送られるよう Lax。操作はトークンと Origin で守る)
      if (req.method === "GET" && url.pathname === "/phone") {
        if (!sameKey(url.searchParams.get("key"), phoneKey(root))) return send(403, "text/html; charset=utf-8", phonePage("この QR コードは使えません。PC の管理者用ページで、新しい QR コードを出して読み直してください。"));
        return send(303, "text/plain; charset=utf-8", "", { location: "/", "set-cookie": `adm_phone=${phoneKey(root)}; Path=/; Max-Age=7776000; HttpOnly; Secure; SameSite=Lax` });
      }
      if (url.pathname !== "/app.css" && !sameKey(cookieValue(req.headers.cookie, "adm_phone"), phoneKey(root))) { // 見た目(app.css)だけは、案内ページのために鍵なしで出す
        return url.pathname.startsWith("/api/") ? json(401, { error: "このスマホには、まだ鍵がありません。PC の画面の QR コードから開いてください。" })
          : send(401, "text/html; charset=utf-8", phonePage("このスマホには、まだ鍵がありません。PC の管理者用ページの概要にある「スマホで開く」の QR コードを、このスマホのカメラで読んでください。"));
      }
    }
    if (req.method === "GET" && ASSETS[url.pathname]) {
      const [file, type] = ASSETS[url.pathname];
      let body = await readFile(join(HERE, file), "utf8");
      if (file === "app.html") body = body.replace("%%TOKEN%%", token);
      return send(200, type, body);
    }
    const handler = api[`${req.method} ${url.pathname}`];
    if (!handler) return json(404, { error: "not found" });
    if (req.headers["x-admin-token"] !== token) return json(403, { error: "トークンがありません。画面を開き直してください。" });
    if (req.headers.origin && ![...allowed.map((h) => `http://${h}`), ...(remote ? [`https://${remoteHost}`] : [])].includes(req.headers.origin)) return json(403, { error: "ほかのサイトからは使えません" });
    let body = {};
    if (req.method === "POST") {
      if (!/^application\/json/.test(req.headers["content-type"] ?? "")) return json(415, { error: "JSON で送ってください" });
      let raw = "";
      for await (const c of req) { raw += c; if (raw.length > 200_000) return json(413, { error: "大きすぎます" }); }
      try { body = JSON.parse(raw || "{}"); } catch { return json(400, { error: "JSON が正しくありません" }); }
    }
    try {
      const out = await handler(body, { remote });
      if (Array.isArray(out)) json(out[0], out[1]); else json(200, out);
    } catch (err) { console.error(err); json(500, { error: `処理に失敗しました: ${err.message}` }); }
  });

  return new Promise((resolve, reject) => {
    const listen = (p) => server.listen(p, "127.0.0.1");
    server.once("error", (err) => { if (err.code === "EADDRINUSE" && port !== 0) { server.once("error", reject); listen(0); } else reject(err); });
    server.once("listening", () => resolve({ server, token, url: `http://127.0.0.1:${server.address().port}/`, phoneReady, refresh }));
    server.on("close", () => { clearInterval(timer); clearTimeout(first); });
    listen(port);
  });
}

/** スマホに鍵がないときなどの、文字だけの案内ページ */
function phonePage(message) {
  const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>管理者用ページ | 神楽めぐり</title><link rel="stylesheet" href="/app.css"></head><body><main><h2>神楽めぐり 管理者用ページ</h2><p class="warn">${esc(message)}</p></main></body></html>`;
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
  const open = (url) => {
    if (process.argv.includes("--no-open")) return;
    const [cmd, args] = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
    spawn(cmd, args, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
  };
  // すでに起動していれば、2つ目は起動せず、画面だけ開く(デスクトップのショートカットを何度押してもよいように)
  const running = `http://127.0.0.1:${port}/`;
  const already = await fetch(running, { signal: AbortSignal.timeout(1500) }).then((r) => r.text()).then((t) => t.includes("管理者用ページ")).catch(() => false);
  if (already) { open(running); console.log(`起動済みの管理者用ページを開きました: ${running}`); process.exit(0); }
  const { url } = await startAdmin({ port, root: join(HERE, "..", "..") });
  console.log(`管理者用ページ: ${url}\n(この画面を閉じるか、Ctrl+C で終了します。スマホから開くときは、この画面を閉じずに、PC を起動したままにします)`);
  open(url);
}
