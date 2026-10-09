// 週次の自動更新の結果を、LINE へ送る仕組みのテスト
//  1) 文面(成功・変更なし・試運転・失敗・公開の失敗・長すぎる場合)
//  2) 小さなサーバーを LINE の代わりに立て、notify-line.mjs を実際に動かす(本物の LINE には送らない)
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { buildMessage, shortDate, MAX_TEXT } from "../scripts/notify-line.mjs";

const TOKEN = "test-token-not-a-real-one-0123456789";
const TO = "U" + "0123456789abcdef".repeat(2);

export async function notifyTests({ ok, section }) {
  section("LINE 通知: 文面");
  const ev = (name, start, extra = {}) => ({ name, start, prefecture: "広島県", city: "安芸高田市", url: "https://example.com/" + encodeURIComponent(name), ...extra });
  const summary = {
    date: "2026-10-12", autoPublish: true, published: 2, held: 1, withdrawn: 1, errors: 0, inactive: 0, needsAttention: true,
    items: { published: [ev("高宮神楽まつり", "2026-11-23T19:00"), ev("神楽B", "2026-12-01T18:00", { note: "日程の変更(旧 2026-11-29)" })], held: [ev("ミニコンサート", "2026-10-25T00:00", { reason: "名称に、神楽に関する語が見当たらない" })], withdrawn: [ev("神楽C", "2026-12-05T18:00", { reason: "取得元のページから、2回続けて消えたため" })] },
  };
  const m = (o) => buildMessage({ summary, siteUrl: "https://kagurameguri.jp/", runUrl: "https://github.com/x/y/actions/runs/1", ...o });

  ok(shortDate("2026-11-23T19:00") === "11/23(月)" && shortDate("2026-10-12") === "10/12(月)" && shortDate("") === "日付不明", "日付は「11/23(月)」の形で出る");
  let t = m({ changed: true, deployResult: "success" });
  ok(t.startsWith("【神楽めぐり】週次の自動更新(2026-10-12)") && t.includes("✅ 公開サイトを更新しました"), "成功: 見出しと「公開サイトを更新しました」");
  ok(t.includes("■ 新規掲載 2件") && t.includes("・11/23(月) 高宮神楽まつり(広島県安芸高田市)") && t.includes("※日程の変更(旧 2026-11-29)"), "新規掲載の一覧(日付・名称・場所・日程変更の注記)");
  ok(t.includes("■ 取り下げ 1件") && t.includes("理由: 取得元のページから、2回続けて消えたため") && t.includes("■ 保留・要確認(掲載していません) 1件") && t.includes("理由: 名称に、神楽に関する語"), "取り下げ・保留は、理由つき");
  ok(t.includes("サイト: https://kagurameguri.jp/") && t.includes("詳細: https://github.com/x/y/actions/runs/1") && t.includes("Issue"), "サイトと、実行の詳細へのリンク、保留の確認方法");
  ok(!t.includes(TOKEN) && !/@|token/i.test(t.replace(/https:\/\/\S+/g, "")), "文面に、トークン・メールアドレスなどは入らない");
  ok(m({ changed: false }).includes("➖ 変更はありませんでした"), "変更なし");
  t = m({ dryRun: true });
  ok(t.includes("🧪 試運転です") && t.includes("試運転なので、まだ掲載していません") && !t.includes("Issue"), "試運転: 反映していないことが分かる");
  ok(m({ changed: true, deployResult: "failure" }).includes("公開サイトの更新に失敗しました"), "公開の失敗");
  ok(m({ changed: true, deployResult: "unknown" }).includes("完了は確認できていません"), "公開の完了が確認できないとき");
  ok(m({ jobStatus: "failure" }).includes("❌ 自動更新が失敗しました。何も公開されていません") && m({ jobStatus: "failure", changed: true }).includes("データの反映は済んでいる"), "失敗: 反映の前か後かで、文面を変える");
  ok(m({ jobStatus: "cancelled" }).includes("⏹ 途中で止まりました"), "時間切れ・停止");
  t = buildMessage({ summary: null, jobStatus: "failure", date: "2026-10-12" });
  ok(t.includes("(2026-10-12)") && t.includes("収集の前に止まりました"), "収集の前に止まったとき(結果がない)も、送れる");
  t = buildMessage({ summary: { ...summary, published: 0, held: 0, withdrawn: 0, inactive: 2, items: {} }, changed: false });
  ok(t.includes("新規掲載・取り下げ・保留は、ありませんでした") && t.includes("規約の確認待ちで、止まっている収集元が 2 つ"), "何もないとき・規約確認待ちの収集元があるとき");
  ok(buildMessage({ summary: { ...summary, autoPublish: false } }).includes("自動掲載: オフ"), "自動掲載がオフのとき");
  const many = Array.from({ length: 30 }, (_, i) => ev(`大量の神楽${i}`, "2026-12-20T19:00"));
  t = buildMessage({ summary: { ...summary, published: 30, items: { ...summary.items, published: many } }, changed: true, deployResult: "success" });
  ok(t.includes("・ほか 22 件") && !t.includes("大量の神楽8"), "件数が多いときは、8件まで並べ、残りは「ほか N 件」");
  const huge = Array.from({ length: 8 }, (_, i) => ev("神".repeat(900) + i, "2026-12-20T19:00", { reason: "理".repeat(900) }));
  t = buildMessage({ summary: { ...summary, held: 8, items: { ...summary.items, held: huge } } });
  ok(t.length <= MAX_TEXT && t.endsWith("詳細はリンク先)"), `LINE の上限(${MAX_TEXT}字)を超えない`, String(t.length));

  // ---------- 2. 実際に動かす(LINE の代わりの、手元のサーバー) ----------
  section("LINE 通知: 送信(LINE の代わりに、手元のサーバーで確認)");
  const T = "tests/.tmp-notify";
  rmSync(T, { recursive: true, force: true }); mkdirSync(T, { recursive: true });
  writeFileSync(`${T}/summary.json`, JSON.stringify(summary));
  const srv = { hits: [], status: [200] };
  const server = createServer((q, res) => {
    let body = ""; q.on("data", (d) => (body += d));
    q.on("end", () => { srv.hits.push({ method: q.method, url: q.url, headers: q.headers, body }); const st = srv.status.length > 1 ? srv.status.shift() : srv.status[0]; res.writeHead(st, { "content-type": "application/json" }); res.end(st === 200 ? "{}" : '{"message":"error"}'); });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const api = `http://127.0.0.1:${server.address().port}/v2/bot/message/push`;
  const run = (env) => new Promise((resolve) => {
    const base = { ...process.env }; delete base.LINE_CHANNEL_ACCESS_TOKEN; delete base.LINE_TO; delete base.LINE_API_URL;
    const c = spawn("node", ["scripts/notify-line.mjs"], { env: { ...base, SUMMARY_FILE: `${T}/summary.json`, NOTIFY_NOW: "2026-10-12T05:30:00+09:00", ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let out = ""; c.stdout.on("data", (d) => (out += d)); c.stderr.on("data", (d) => (out += d)); c.on("close", (code) => resolve({ code, out }));
  });
  const live = { LINE_CHANNEL_ACCESS_TOKEN: TOKEN, LINE_TO: TO, LINE_API_URL: api, JOB_STATUS: "success", CHANGED: "true", DEPLOY_RESULT: "success", RUN_URL: "https://github.com/x/y/actions/runs/9" };

  let x = await run({ LINE_API_URL: api });
  ok(x.code === 0 && srv.hits.length === 0 && /送信しません/.test(x.out), "LINE の設定(Secrets)がないときは、何も送らず、失敗にもしない");
  x = await run(live);
  const h = srv.hits[0], body = h ? JSON.parse(h.body) : {};
  ok(x.code === 0 && srv.hits.length === 1 && h.method === "POST" && h.url === "/v2/bot/message/push", "設定があれば、1回だけ送る(push message)");
  ok(h?.headers.authorization === `Bearer ${TOKEN}` && /application\/json/.test(h.headers["content-type"]) && /^[0-9a-f-]{36}$/.test(h.headers["x-line-retry-key"] ?? ""), "トークンは、Authorization ヘッダーで送る。二重送信を防ぐ再送キーが付く");
  ok(body.to === TO && body.messages?.length === 1 && body.messages[0].type === "text" && body.messages[0].text.includes("✅ 公開サイトを更新しました") && body.messages[0].text.includes("高宮神楽まつり") && body.messages[0].text.includes("詳細: https://github.com/x/y/actions/runs/9"), "宛先と、結果の文面が届く");
  ok(!x.out.includes(TOKEN), "ログに、トークンを出さない");

  srv.hits = []; srv.status = [500, 200]; x = await run(live);
  ok(x.code === 0 && srv.hits.length === 2 && srv.hits[0].headers["x-line-retry-key"] === srv.hits[1].headers["x-line-retry-key"], "LINE 側の一時的なエラー(500)は、同じ再送キーで、1回だけ再送する");
  srv.hits = []; srv.status = [401]; x = await run(live);
  ok(x.code === 1 && srv.hits.length === 1 && /HTTP 401/.test(x.out) && !x.out.includes(TOKEN), "トークンの誤り(401)は、再送せず、失敗として知らせる(トークンは出さない)");
  srv.status = [200];

  srv.hits = []; x = await run({ ...live, LINE_TO: "shotaro@example.com" });
  ok(x.code === 1 && srv.hits.length === 0 && /LINE_TO の形式/.test(x.out), "送り先の形式が違えば、送らない");
  srv.hits = []; x = await run({ ...live, LINE_API_URL: "https://evil.example/push" });
  ok(x.code === 1 && srv.hits.length === 0 && /localhost/.test(x.out), "送り先のURLの差し替えは、手元(localhost)だけ。外部へトークンを送らない");

  srv.hits = []; x = await run({ ...live, JOB_STATUS: "failure", CHANGED: "", NOTIFY_NOW: "2026-10-19T05:30:00+09:00" });
  const t2 = JSON.parse(srv.hits[0]?.body ?? "{}").messages?.[0]?.text ?? "";
  ok(x.code === 0 && t2.includes("(2026-10-19)") && t2.includes("❌ 自動更新が失敗しました") && !t2.includes("高宮神楽まつり"), "収集の前に失敗したときは、前回の結果を、今回のものとして送らない");
  srv.hits = []; x = await run({ ...live, DRY_RUN: "true", CHANGED: "", DEPLOY_RESULT: "" });
  ok(JSON.parse(srv.hits[0]?.body ?? "{}").messages?.[0]?.text.includes("🧪 試運転です"), "試運転(dry_run)でも、結果が届く(通知の確認に使える)");

  server.close(); rmSync(T, { recursive: true, force: true });
}
