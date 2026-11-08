// 管理者用ページのテスト: メールの読み取り、開催データの保存、サーバーの安全対策
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { simpleParser } from "mailparser";
import { classify, readFields, readJsonBlock, toItem } from "../scripts/admin/mail.mjs";
import { validateEvent, upsertEvent, pruneInbox, suggestId, setInboxStatus } from "../scripts/admin/store.mjs";
import { startAdmin } from "../scripts/admin/server.mjs";
import { loadTasks, cronStep, describeCron } from "../scripts/admin/tasks.mjs";
import { publish, pendingChanges, findGit, DATA_TESTS } from "../scripts/admin/publish.mjs";
import { execFileSync } from "node:child_process";
import { request as httpRequest } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const SITE = "神楽めぐり";
const read = (p) => readFileSync(p, "utf8");

// Web3Forms の通知メールに近い形(HTML だけの本文、返信先は投稿者)
const submitBody = [
  "■神楽・イベントの名称: 第1回 テスト神楽まつり", "■神楽の種類: 石見神楽", "■都道府県: 島根県", "■市区町村: 浜田市", "■会場名: テスト神社",
  "■開催日: 2026-11-03", "■開始時刻: 18:00", "■公式情報のURL: https://example.jp/kagura", "■ひとこと説明: 夜神楽です。", "■ご関係: 主催者・出演者",
  "■お名前または団体名: テスト保存会", "■ご連絡先のメールアドレス: sender@example.net", "", "【events.json 用】",
  JSON.stringify({ id: "", name: "第1回 テスト神楽まつり", kagura: "石見神楽", prefecture: "島根県", city: "浜田市", venue: "テスト神社", address: "", start: "2026-11-03T18:00", fee: "", url: "https://example.jp/kagura", description: "夜神楽です。", status: "pending" }, null, 1),
].join("\n");
const raw = (subject, body, from = "Web3Forms <notify@web3forms.com>") => [
  `From: ${from}`, "To: owner@example.org", "Reply-To: Test Sender <sender@example.net>", `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
  "Message-ID: <" + Buffer.from(subject).toString("hex").slice(0, 20) + "@web3forms.com>", "Date: Fri, 09 Oct 2026 10:00:00 +0900", "MIME-Version: 1.0",
  "Content-Type: text/html; charset=utf-8", "Content-Transfer-Encoding: base64", "",
  Buffer.from(`<html><body><table><tr><td>Message</td><td>${body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</td></tr></table></body></html>`).toString("base64"), "",
].join("\r\n");

export async function adminTests({ ok, section }) {
  section("管理者用ページ: メールの読み取り");
  ok(classify(`【${SITE}】開催情報の掲載依頼: A`, SITE) === "submit" && classify(`【${SITE}】お問い合わせ: その他`, SITE) === "contact", "件名から、申請と問い合わせを見分ける");
  ok(classify(`Re: 【${SITE}】お問い合わせ: その他`, SITE) === null && classify(`【${SITE}】週次の自動更新 10/12: ✅`, SITE) === null, "自分の返信や、週次の通知は、取り込まない");

  const sub = toItem(await simpleParser(raw(`【${SITE}】開催情報の掲載依頼: 第1回 テスト神楽まつり`, submitBody)), SITE);
  ok(sub?.kind === "submit" && sub.email === "sender@example.net" && sub.sender === "テスト保存会" && sub.viaForm === true, "HTML だけのメールから、種類・投稿者・返信先を読む", JSON.stringify(sub && { k: sub.kind, e: sub.email, s: sub.sender }));
  const d = sub?.draft ?? {};
  ok(d.name === "第1回 テスト神楽まつり" && d.prefecture === "島根県" && d.start === "2026-11-03T18:00" && d.url === "https://example.jp/kagura" && d.timeUnknown === false, "申請の内容から、開催データの下書きを作る", JSON.stringify(d));
  ok(!("status" in d) && !("id" in d), "下書きには、投稿者が書いた status や id を持ち込まない");
  const spoof = toItem(await simpleParser(raw(`【${SITE}】開催情報の掲載依頼: X`, submitBody, "someone <a@example.com>")), SITE);
  ok(spoof?.viaForm === false, "フォームのサービス以外から届いたものは、なりすましの注意を出す印が付く");
  ok(readJsonBlock('【events.json 用】\n{"name":"長い\n説明","start":"2026-11-03T18:00"}')?.name === "長い 説明", "メールの折り返しで、文字列の途中に入った改行を、戻して読める");
  ok(readJsonBlock("【events.json 用】\n{壊れた") === null, "壊れた JSON は、項目の行から読む(エラーにしない)");
  const f = readFields("■ご用件: 掲載内容の訂正\n■内容: 1行目\n2行目\n■対象のページのURL: https://kagurameguri.jp/events/a.html");
  ok(f["内容"] === "1行目\n2行目" && f["対象のページのURL"] === "https://kagurameguri.jp/events/a.html", "複数行の内容や、URL(コロンを含む)を、正しく読む");
  const con = toItem({ subject: `【${SITE}】お問い合わせ: 掲載内容の訂正`, text: "■ご用件: 掲載内容の訂正\n■お名前: 山田\n■メールアドレス: y@example.net\n■内容: 日付が違います", date: new Date("2026-10-09T01:00:00Z"), messageId: "<c1@x>", from: { value: [{ address: "notify@web3forms.com" }] } }, SITE);
  ok(con.kind === "contact" && con.topic === "掲載内容の訂正" && con.message === "日付が違います" && con.email === "y@example.net", "問い合わせの用件・内容・返信先を読む(返信先の見出しがなくても、本文から)");

  section("管理者用ページ: 予定タスク(読むだけ)");
  const TD = mkdtempSync(join(tmpdir(), "adm-tasks-"));
  const J = (s) => Date.parse(s + "+09:00"); // 日本時間で書く
  mkdirSync(join(TD, "note"));
  writeFileSync(join(TD, "note/SKILL.md"), "---\nname: note\ndescription: 記事を公開する\n---\n秘密の指示文 SECRET-PROMPT\n");
  const TF = join(TD, "scheduled-tasks.json");
  writeFileSync(TF, JSON.stringify({ scheduledTasks: [
    { id: "note", displayName: "Note投稿", cronExpression: "0 18 */2 * *", enabled: true, filePath: join(TD, "note/SKILL.md"), createdAt: J("2026-10-01T00:00"), lastRunAt: "2026-10-21T11:59:00Z", lastScheduledFor: "2026-10-21T09:00:00Z", cwd: "C:\\secret", approvedPermissions: [{ toolName: "Bash", ruleContent: "SECRET-RULE" }] },
    { id: "weekly", displayName: "週次", cronExpression: "0 9 * * 1", enabled: true, createdAt: J("2026-11-07T20:00"), lastRunAt: "2026-11-07T13:43:00Z" },
    { id: "once", displayName: "1回", fireAt: J("2026-10-17T09:00"), enabled: false, lastRunAt: "2026-10-17T03:35:00Z" },
    { id: "bad", displayName: "壊れた予定", cronExpression: "x y", enabled: true },
  ] }));
  writeFileSync(join(TD, "local_a.json"), JSON.stringify({ scheduledTaskId: "note", createdAt: J("2026-10-21T20:59"), postTurnSummary: { status_category: "blocked", status_detail: "ログインしていない", needs_action: "Note にログインする" }, transcript: "SECRET-LOG" }));
  writeFileSync(join(TD, "local_b.json"), JSON.stringify({ title: "ふつうの会話" }));
  const NOW = J("2026-11-08T10:00");
  ok(new Date(cronStep("0 18 */2 * *", NOW)).getTime() === J("2026-11-09T18:00") && cronStep("0 18 */2 * *", NOW - 7200e3, -1) === J("2026-11-07T18:00"), "予定: 「2日に1回 18時」の次回と前回を、日本時間で求める");
  ok(cronStep("0 9 * * 1", NOW) === J("2026-11-09T09:00") && cronStep("0 9 1 * *", NOW) === J("2026-12-01T09:00") && cronStep("30 23 31 12 *", J("2026-12-31T23:30")) === J("2027-12-31T23:30"), "予定: 毎週・毎月・年をまたぐ次回");
  ok(describeCron("0 18 */2 * *") === "2日に1回 18:00" && describeCron("0 9 * * 1") === "毎週月曜 9:00" && describeCron("0 9 1 * *") === "毎月1日 9:00" && describeCron("5 4 1-3 * *") === "cron: 5 4 1-3 * *", "予定を、ふつうの日本語で書く");
  const TT = loadTasks({ file: TF, now: NOW, runs: true });
  const tk = Object.fromEntries(TT.tasks.map((t) => [t.id, t]));
  ok(tk.note.missed && tk.note.missedAt === new Date(J("2026-11-07T18:00")).toISOString() && TT.missed === 1, "前回の予定の時刻に動いた記録がなければ「動いていない」とする", JSON.stringify(tk.note));
  ok(!tk.weekly.missed && tk.weekly.nextRun === new Date(J("2026-11-09T09:00")).toISOString(), "作る前の予定は「動いていない」に数えない");
  ok(!tk.once.missed && tk.once.nextRun === null && /^1回だけ 2026\/10\/17/.test(tk.once.schedule) && TT.tasks.at(-1).enabled === false, "1回だけのタスクと、停止中のタスク(下にまとめる)");
  ok(tk.bad.error && !tk.bad.missed, "読めない予定は、エラーとして出し、ほかのタスクは読める");
  ok(tk.note.description === "記事を公開する" && tk.note.runs.length === 1 && tk.note.runs[0].status === "blocked" && tk.note.runs[0].needsAction === "Note にログインする", "説明と、最近の実行の結果・人がやることを読む");
  ok(!/SECRET|secret/.test(JSON.stringify(TT)), "指示文・許可した操作・作業フォルダ・会話の中身は、画面に出さない");
  ok(loadTasks({ file: null }).found === false && loadTasks({ file: join(TD, "nothing.json") }).error, "記録が無い・読めないときも、止まらない");

  section("管理者用ページ: 開催データの保存");
  const base = [{ id: "a-1", name: "A", kagura: "石見神楽", prefecture: "島根県", city: "浜田市", venue: "会館", start: "2026-11-01T18:00", source: "x", checked: "2026-10-01", status: "published", lat: 34.9, lng: 132.1 }];
  const good = { id: "b-1", name: "B", kagura: "石見神楽", prefecture: "島根県", city: "益田市", venue: "神社", start: "2026-11-03T18:00", url: "https://example.jp/", source: "観光協会", checked: "2026-10-10" };
  ok(Object.keys(validateEvent(good, base)).length === 0, "正しい内容は、そのまま通る");
  const bad = validateEvent({ ...good, id: "A 1", prefecture: "東京", url: "http://x", end: "2026-11-02T10:00", checked: "" }, base);
  ok(["id", "prefecture", "url", "end", "checked"].every((k) => bad[k]), "ID の形・都道府県・https・終了の前後・確認日を確かめる", JSON.stringify(bad));
  ok(validateEvent({ ...good, id: "a-1" }, base).id && !validateEvent({ ...base[0] }, base, "a-1").id, "ID の重複は防ぐ(自分自身の編集は除く)");
  const evs = structuredClone(base);
  ok(upsertEvent(evs, { ...good, status: "withdrawn", lat: 1, injected: "x" }, null, "published").event?.status === "published" && evs.length === 2 && !("injected" in evs[1]) && !("lat" in evs[1]), "追加: 画面にない項目(状態・緯度経度など)は、持ち込ませない");
  upsertEvent(evs, { ...base[0], name: "A2" }, "a-1");
  ok(evs[0].name === "A2" && evs[0].lat === 34.9 && evs[0].status === "published", "編集: 場所が同じなら、緯度経度と状態は残る");
  upsertEvent(evs, { ...evs[0], venue: "別の会場" }, "a-1");
  ok(!("lat" in evs[0]) && !("lng" in evs[0]), "編集: 場所を変えたら、緯度経度を消す(保存後に付け直す)");
  upsertEvent(evs, { ...good, timeUnknown: true, start: "2026-11-03T18:00" }, "b-1");
  ok(evs[1].start === "2026-11-03T00:00" && evs[1].timeUnknown === true, "時刻未定は、00:00 として保存する(サイトの表示と同じ)");
  ok(suggestId({ start: "2026-11-03T18:00" }, [{ id: "ev-20261103" }]) === "ev-20261103-2", "ID の候補は、日付から作り、重ならないようにする");
  const box = { items: [{ id: "1", closedAt: "2025-10-09" }, { id: "2", closedAt: "2025-10-11" }, { id: "3" }] };
  ok(pruneInbox(box, "2026-10-10") === 1 && box.items.map((x) => x.id).join() === "2,3", "対応完了から12か月を過ぎた記録は、消す(プライバシーポリシーの保存期間)");
  const it = { status: "new" }; setInboxStatus(it, "done", "2026-10-10"); const closed = it.closedAt; setInboxStatus(it, "doing", "2026-10-11");
  ok(closed === "2026-10-10" && !("closedAt" in it), "完了にすると完了日が付き、戻すと消える");

  section("管理者用ページ: サーバーの安全対策と操作");
  const ROOT = "tests/.tmp-admin";
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(join(ROOT, "data"), { recursive: true });
  copyFileSync("config.json", join(ROOT, "config.json"));
  writeFileSync(join(ROOT, "data/events.json"), JSON.stringify(base, null, 2));
  const fakeMail = { calls: 0 };
  // コミットと push は、本物のリポジトリに触れないよう、記録するだけの偽物にする
  const published = [];
  const { server, token, url } = await startAdmin({ root: ROOT, port: 0, today: () => "2026-10-10", geocode: async () => "OK  stub",
    publisher: async (root, msg) => { published.push(msg); return { ok: true, commit: "abc1234" }; }, pending: async () => ({ uncommitted: false, unpushed: 0 }),
    commitIds: async () => ["SEO-20261001-1"], repoUrl: async () => "https://github.com/o/r", phoneHost: async () => "pc.tail-test.ts.net", tasks: (o) => loadTasks({ file: TF, now: NOW, ...o }),
    refreshHours: 0, sync: async () => ({ ok: true, text: "最新です" }), jobsOpts: { auth: async () => ({ found: true, loggedIn: false }), findExe: () => null },
    fetchMails: async ({ knownIds }) => { fakeMail.calls++; return [sub, con].filter((x) => !knownIds.has(x.messageId)).map((x) => structuredClone(x)); } });
  const port = new URL(url).port;
  const req = async (path, { body, headers = {}, method } = {}) => {
    const r = await fetch(`http://127.0.0.1:${port}${path}`, { method: method ?? (body ? "POST" : "GET"), headers: { "x-admin-token": token, ...(body ? { "content-type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, headers: r.headers, json: await r.json().catch(() => null) };
  };
  try {
    const page = await fetch(url);
    const html = await page.text();
    ok(page.status === 200 && /script-src 'self'/.test(page.headers.get("content-security-policy")) && page.headers.get("cache-control") === "no-store" && html.includes(`content="${token}"`) && !/<script>/.test(html), "画面: CSP(外部・埋め込みのスクリプトを禁止)・保存しない設定で配信", page.headers.get("content-security-policy"));
    ok(server.address().address === "127.0.0.1", "このPCの中(127.0.0.1)だけで待ち受ける");
    const nod = (path, headers) => new Promise((res) => import("node:http").then(({ request }) => { const r = request({ host: "127.0.0.1", port, path, headers }, (x) => res(x.statusCode)); r.end(); }));
    ok((await nod("/", { host: "evil.example:" + port })) === 421, "別の名前(Host)で来た接続は断る(DNS リバインディング対策)");
    ok((await req("/api/state", { headers: { "x-admin-token": "x" } })).status === 403, "合言葉(トークン)が違う操作は断る");
    ok((await req("/api/inbox/update", { body: { id: "1" }, headers: { origin: "https://evil.example" } })).status === 403, "ほかのサイトから送られた操作は断る");
    ok((await req("/api/events/status", { method: "POST", headers: { "content-type": "text/plain" } })).status === 415, "JSON 以外の送信は断る(フォームからの不正な送信を防ぐ)");

    let r = await req("/api/tasks");
    ok(r.status === 200 && r.json.missed === 1 && r.json.tasks.find((t) => t.id === "note")?.runs?.length === 1, "予定タスク: 一覧と最近の実行を返す");
    ok((await req("/api/tasks", { headers: { "x-admin-token": "x" } })).status === 403, "予定タスク: 合言葉がなければ出さない");
    r = await req("/api/state");
    ok(r.json.tasks?.missed === 1 && !r.json.tasks.tasks.some((t) => t.runs), "予定タスク: 毎回の状態には、件数と一覧だけ(実行の記録は、タブを開いたときだけ読む)");
    r = await req("/api/fetch-mail", { body: {} });
    ok(r.status === 400 && /admin\.local\.json/.test(r.json.error) && fakeMail.calls === 0, "Gmail の設定がなければ、設定方法を案内する");
    writeFileSync(join(ROOT, "admin.local.json"), JSON.stringify({ gmail: { user: "u@example.com", appPassword: "x" } }));
    r = await req("/api/fetch-mail", { body: {} });
    ok(r.status === 200 && r.json.added === 2 && r.json.state.inbox.length === 2 && r.json.state.mailReady, "Gmail から、申請と問い合わせを読み込む");
    const subItem = r.json.state.inbox.find((x) => x.kind === "submit");
    ok(subItem?.draft?.id === "ev-20261103", "申請には、ID の候補が付く");
    r = await req("/api/fetch-mail", { body: {} });
    ok(r.json.added === 0 && r.json.state.inbox.length === 2, "同じメールは、二度読み込まない");
    ok(existsSync(join(ROOT, ".admin/inbox.json")) && !read(join(ROOT, "data/events.json")).includes("sender@example.net"), "投稿者の連絡先は .admin/ だけに保存し、開催データには入れない");

    r = await req("/api/events/save", { body: { event: { ...subItem.draft, source: "", checked: "2026-10-10" }, inboxId: subItem.id } });
    ok(r.status === 400 && r.json.fields.source, "出典がないと、掲載できない");
    r = await req("/api/events/save", { body: { event: { ...subItem.draft, source: "テスト保存会の公式サイト", checked: "2026-10-10" }, inboxId: subItem.id } });
    const saved = JSON.parse(read(join(ROOT, "data/events.json"))).find((e) => e.id === "ev-20261103");
    ok(r.status === 200 && saved?.status === "published" && saved.source === "テスト保存会の公式サイト" && r.json.geocode === "OK  stub", "申請を許可すると、開催データに「掲載」で加わり、位置の取得が走る");
    const done = r.json.state.inbox.find((x) => x.id === subItem.id);
    ok(done.status === "published" && done.eventId === "ev-20261103" && done.closedAt === "2026-10-10", "許可した申請は「掲載済み」になり、開催と結び付く");
    ok(published.length === 1 && published[0] === "data(admin): 掲載(申請): 第1回 テスト神楽まつり" && r.json.publish?.ok, "許可すると、そのままコミットと push をする(入力の誤りで止まった保存では、しない)", published.join(" / "));
    r = await req("/api/events/status", { body: { id: "ev-20261103", status: "withdrawn" } });
    ok(r.status === 200 && JSON.parse(read(join(ROOT, "data/events.json"))).find((e) => e.id === "ev-20261103").status === "withdrawn", "掲載の取り下げ");
    ok(published[1] === "data(admin): 取り下げ: 第1回 テスト神楽まつり", "取り下げも、そのままコミットと push をする");
    r = await req("/api/events/save", { body: { event: { ...base[0], name: "A 改" }, originalId: "a-1" } });
    ok(r.status === 200 && published[2] === "data(admin): 編集: A 改", "編集も、そのままコミットと push をする");
    ok((await req("/api/events/status", { body: { id: "ev-20261103", status: "pending" } })).status === 400, "取り下げ・再掲載以外の状態には、変えられない");
    const conItem = r.json.state.inbox.find((x) => x.kind === "contact");
    r = await req("/api/inbox/update", { body: { id: conItem.id, status: "doing", memo: "電話で確認中" } });
    ok(r.json.state.inbox.find((x) => x.id === conItem.id).memo === "電話で確認中" && r.json.state.inbox.find((x) => x.id === conItem.id).status === "doing", "問い合わせの対応状況とメモを保存する");
    ok(published.length === 3, "問い合わせのメモ・状態や、Gmail の読み込みでは、push しない(開催データが変わらない)");

    // ---------- 判断待ち: 保留の掲載・却下、振り返りの【人】の項目、検索の改善案 ----------
    const evPath = join(ROOT, "data/events.json");
    const held = (id, extra = {}) => ({ id, name: "保留 " + id, kagura: "石見神楽", prefecture: "島根県", city: "浜田市", venue: "会館", start: "2026-11-20T18:00", url: "https://example.jp/h", source: "収集元", checked: "2026-10-05", status: "pending", holdReasons: ["一度の新規が多すぎる"], auto: true, sourceId: "s1", ...extra });
    writeFileSync(evPath, JSON.stringify([...JSON.parse(read(evPath)), held("h-1"), held("h-2")], null, 2));
    writeFileSync(join(ROOT, "data/weekly-review.json"), JSON.stringify({ updated: "2026-10-12", actions: [{ key: "held", owner: "人", text: "保留が 25 件" }, { key: "collect-errors", owner: "人", text: "収集元で 1 件のエラー" }, { key: "time-unknown", owner: "Claude", text: "時刻未定" }] }));
    mkdirSync(join(ROOT, "analytics"), { recursive: true });
    const prop = (id, status) => ({ id, date: "2026-10-01", target: "検索語", change: "タイトル", baseline: { q: [1, 2] }, status, implementedAt: null, result: null });
    writeFileSync(join(ROOT, "analytics/state.json"), JSON.stringify({ updated: "2026-10-12", snapshot: { keep: true }, proposals: [prop("SEO-20261001-1", "proposed"), prop("SEO-20261001-2", "proposed"), prop("SEO-20261001-3", "implemented")] }));
    let st = (await req("/api/state")).json;
    ok(st.review?.actions.map((a) => a.key).join() === "collect-errors", "振り返りからは、人が行う項目だけを出す(保留の判断は、開催の欄で別に出す。Claude の項目は出さない)", JSON.stringify(st.review));
    ok(st.proposals.length === 3 && !("baseline" in st.proposals[0]) && st.committedIds.join() === "SEO-20261001-1" && st.repo === "https://github.com/o/r", "改善案・コミットに書かれた ID・リポジトリの場所を、画面に渡す(基準の数字は渡さない)");

    r = await req("/api/events/save", { body: { event: { ...held("h-1"), source: "" }, originalId: "h-1", approve: true } });
    ok(r.status === 400 && r.json.fields.source && JSON.parse(read(evPath)).find((e) => e.id === "h-1").status === "pending", "保留の掲載: 出典がないと、掲載しない(保留のまま)");
    r = await req("/api/events/save", { body: { event: { ...held("h-1"), source: "浜田市観光協会", checked: "2026-10-10" }, originalId: "h-1", approve: true } });
    const ap = JSON.parse(read(evPath)).find((e) => e.id === "h-1");
    ok(r.status === 200 && ap.status === "published" && !("holdReasons" in ap) && ap.auto === true && ap.sourceId === "s1" && ap.checked === "2026-10-10", "保留の掲載: 掲載にし、保留の理由を消す(自動収集の記録は残す)", JSON.stringify(ap));
    ok(published.at(-1) === "data(admin): 掲載(保留): 保留 h-1", "保留の掲載も、そのままコミットと push をする");
    ok((await req("/api/events/save", { body: { event: { ...base[0] }, originalId: "a-1", approve: true } })).status === 400, "掲載中の開催を「保留の掲載」として保存することはできない");

    ok((await req("/api/events/reject", { body: { id: "a-1" } })).status === 400 && JSON.parse(read(evPath)).some((e) => e.id === "a-1"), "掲載中の開催は却下できない(取り下げを使う)");
    ok((await req("/api/events/reject", { body: { id: "nope" } })).status === 404, "ない開催は却下できない");
    r = await req("/api/events/reject", { body: { id: "h-2" } });
    const rej = JSON.parse(read(join(ROOT, "data/rejected.json")));
    ok(r.status === 200 && !JSON.parse(read(evPath)).some((e) => e.id === "h-2") && rej.length === 1 && rej[0].id === "h-2" && rej[0].start === "2026-11-20T18:00", "保留の却下: 開催データから外し、rejected.json に記録する(週次の自動収集が取り直さない)");
    ok(published.at(-1) === "data(admin): 却下(保留): 保留 h-2", "却下も、そのままコミットと push をする");

    const n = published.length;
    r = await req("/api/proposals/update", { body: { id: "SEO-20261001-2", status: "declined", note: "季節が過ぎた" } });
    let an = JSON.parse(read(join(ROOT, "analytics/state.json")));
    const dp = an.proposals.find((p) => p.id === "SEO-20261001-2");
    ok(r.status === 200 && dp.status === "declined" && dp.declinedAt === "2026-10-10" && dp.declineNote === "季節が過ぎた" && an.snapshot.keep === true && dp.baseline.q.length === 2, "改善案を見送ると、analytics/state.json に見送りと理由を記録する(ほかの記録は変えない)");
    r = await req("/api/proposals/update", { body: { id: "SEO-20261001-2", status: "proposed" } });
    an = JSON.parse(read(join(ROOT, "analytics/state.json")));
    ok(an.proposals.find((p) => p.id === "SEO-20261001-2").status === "proposed" && !("declinedAt" in an.proposals.find((p) => p.id === "SEO-20261001-2")), "見送りは、戻せる");
    ok((await req("/api/proposals/update", { body: { id: "SEO-20261001-3", status: "declined" } })).status === 400 && (await req("/api/proposals/update", { body: { id: "SEO-20261001-1", status: "implemented" } })).status === 400, "実施済みの案は見送りにできず、実施・評価の状態は画面から変えられない(週次の分析が決める)");
    ok(published.length === n, "改善案の見送りは、このPCだけの記録なので、push しない");

    // ---------- 目標・収益: KPI と収益化の案の採用・見送り、目標の数、手入力の実績(analytics/plan.json) ----------
    const planPath = join(ROOT, "analytics/plan.json");
    ok((await req("/api/state")).json.plan === null, "目標の計画がないときは、plan を null で渡す(画面は案内を出す)");
    writeFileSync(planPath, JSON.stringify({ goal: { title: "テストの目標", monthlyRevenueYen: 1000, targetMonth: "2027-03" },
      kpis: [{ id: "revenue", kind: "KGI", name: "月の売上", unit: "円", targets: { "2026-12": 150 }, status: "proposed" }],
      monetization: [{ id: "MON-1", title: "有料プラン", expectedYen: [1, 2], status: "proposed" }], manual: {} }));
    an = JSON.parse(read(join(ROOT, "analytics/state.json"))); an.kpi = { months: { "2026-10": { revenueVc: 120 } } }; writeFileSync(join(ROOT, "analytics/state.json"), JSON.stringify(an));
    st = (await req("/api/state")).json;
    ok(st.plan.kpis.length === 1 && st.plan.monetization.length === 1 && st.plan.actuals.months["2026-10"].revenueVc === 120 && st.planStatus.adopted === "採用" && "rakuten" in st.manualFields, "目標・KPI・収益化の案と、週次の分析が出した実績を、画面に渡す");
    r = await req("/api/plan/item", { body: { kind: "kpi", id: "revenue", status: "adopted" } });
    let pl = JSON.parse(read(planPath));
    ok(r.status === 200 && pl.kpis[0].status === "adopted" && pl.kpis[0].decidedAt === "2026-10-10", "KPI を採用すると、plan.json に採用と日付を記録する");
    r = await req("/api/plan/item", { body: { kind: "kpi", id: "revenue", targets: { "2026-12": 200, "2027-01": 400 } } });
    pl = JSON.parse(read(planPath));
    ok(r.status === 200 && pl.kpis[0].targets["2027-01"] === 400 && pl.kpis[0].status === "adopted", "KPI の目標の数を変えられる(採用のまま)");
    ok((await req("/api/plan/item", { body: { kind: "kpi", id: "revenue", targets: { "2026-12": -1 } } })).status === 400
      && (await req("/api/plan/item", { body: { kind: "kpi", id: "revenue", targets: { "12月": 1 } } })).status === 400
      && (await req("/api/plan/item", { body: { kind: "kpi", id: "revenue", targets: { "2026-12": "1" } } })).status === 400, "目標の数は、月(YYYY-MM)ごとの 0 以上の数だけ受け付ける");
    ok((await req("/api/plan/item", { body: { kind: "mon", id: "MON-1", status: "done" } })).status === 400, "採用していない収益化の案は、実施済みにできない");
    ok((await req("/api/plan/item", { body: { kind: "kpi", id: "revenue", status: "done" } })).status === 400 && (await req("/api/plan/item", { body: { kind: "x", id: "revenue", status: "adopted" } })).status === 400
      && (await req("/api/plan/item", { body: { kind: "mon", id: "MON-9", status: "adopted" } })).status === 404, "KPI に「実施済み」はなく、種類・ID が正しくない操作は受け付けない");
    r = await req("/api/plan/item", { body: { kind: "mon", id: "MON-1", status: "declined", note: "人手が足りない" } });
    pl = JSON.parse(read(planPath));
    ok(r.status === 200 && pl.monetization[0].status === "declined" && pl.monetization[0].note === "人手が足りない", "収益化の案を見送ると、理由を記録する");
    await req("/api/plan/item", { body: { kind: "mon", id: "MON-1", status: "proposed" } });
    await req("/api/plan/item", { body: { kind: "mon", id: "MON-1", status: "adopted" } });
    r = await req("/api/plan/item", { body: { kind: "mon", id: "MON-1", status: "done" } });
    pl = JSON.parse(read(planPath));
    ok(r.status === 200 && pl.monetization[0].status === "done" && !("note" in pl.monetization[0]), "見送りは戻せ、採用した案は実施済みにできる");
    r = await req("/api/plan/manual", { body: { month: "2026-10", values: { rakuten: 300, adsense: null, contracts: 1 } } });
    pl = JSON.parse(read(planPath));
    ok(r.status === 200 && pl.manual["2026-10"].rakuten === 300 && pl.manual["2026-10"].adsense === null && pl.manual["2026-10"].contracts === 1 && pl.manual["2026-10"].updatedAt === "2026-10-10", "手入力の実績を、月ごとに保存する(空欄は null=未入力。0 にしない)");
    ok((await req("/api/plan/manual", { body: { month: "2026-13", values: {} } })).status === 400 && (await req("/api/plan/manual", { body: { month: "2026-10", values: { rakuten: -5 } } })).status === 400
      && (await req("/api/plan/manual", { body: { month: "2026-10", values: { password: 1 } } })).status === 400, "手入力は、正しい月・決まった項目・0 以上の数だけ受け付ける");
    ok(JSON.parse(read(join(ROOT, "analytics/state.json"))).kpi.months["2026-10"].revenueVc === 120, "画面の操作は、週次の分析が書く実績(state.json の kpi)を変えない");
    ok(published.length === n, "目標・KPI・収益化の操作は、このPCだけの記録なので、push しない");

    // ---------- スマホから(Tailscale Serve 経由。Host が ts.net の名前になる) ----------
    // fetch は Host を変えられないので、http.request で送る
    const phone = (path, { headers = {}, body, method } = {}) => new Promise((resolve, reject) => {
      const r = httpRequest({ host: "127.0.0.1", port, path, method: method ?? (body ? "POST" : "GET"), headers: { host: "pc.tail-test.ts.net", ...(body ? { "content-type": "application/json" } : {}), ...headers } }, (res) => {
        let t = ""; res.on("data", (c) => (t += c)); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text: t }));
      });
      r.on("error", reject); if (body) r.write(JSON.stringify(body)); r.end();
    });
    let ph = await phone("/");
    ok(ph.status === 401 && !ph.text.includes(token) && ph.text.includes("QR"), "スマホ: 鍵がないと、画面を出さない(トークンも渡さない)");
    ok((await phone("/api/state", { headers: { "x-admin-token": token } })).status === 401, "スマホ: 鍵がないと、トークンがあってもデータを渡さない");
    ok((await phone("/app.css")).status === 200, "スマホ: 案内ページの見た目(app.css)だけは、鍵なしで出す");
    const qr = await req("/api/phone");
    const key = JSON.parse(read(join(ROOT, ".admin/phone.json"))).key;
    ok(qr.status === 200 && qr.json.ready === true && qr.json.host === "pc.tail-test.ts.net" && qr.json.qr.startsWith("<svg") && !("key" in qr.json), "PC: スマホ用の QR コード(SVG)を出す(鍵そのものは、データとして返さない)");
    ok((await phone("/phone?key=wrong")).status === 403, "スマホ: 違う鍵の QR コードでは、開けない");
    ph = await phone("/phone?key=" + encodeURIComponent(key));
    const ck = String(ph.headers["set-cookie"] || "");
    ok(ph.status === 303 && ph.headers.location === "/" && /adm_phone=/.test(ck) && /HttpOnly/.test(ck) && /Secure/.test(ck) && /SameSite=Lax/.test(ck), "スマホ: 正しい QR コードを開くと、鍵を Cookie(HttpOnly・Secure・SameSite=Lax。カメラの QR から開いても送られる)で入れる", ck);
    const cookie = { cookie: "adm_phone=" + key };
    ph = await phone("/", { headers: cookie });
    ok(ph.status === 200 && ph.text.includes(`content="${token}"`), "スマホ: 鍵があれば、PC と同じ画面を開ける");
    ph = await phone("/api/plan/manual", { headers: { ...cookie, "x-admin-token": token, origin: "https://pc.tail-test.ts.net" }, body: { month: "2026-10", values: { pitches: 3 } } });
    ok(ph.status === 200 && JSON.parse(read(planPath)).manual["2026-10"].pitches === 3, "スマホ: 鍵とトークンがあれば、操作もできる(https の ts.net からの送信を受け付ける)");
    ok((await phone("/api/state", { headers: { ...cookie, "x-admin-token": token, origin: "https://evil.example" } })).status === 403, "スマホ: ほかのサイトからの送信は受け付けない");
    ok((await phone("/api/phone", { headers: { ...cookie, "x-admin-token": token } })).status === 403 && (await phone("/api/phone/reset", { headers: { ...cookie, "x-admin-token": token }, body: {} })).status === 403, "スマホ: QR コードの表示と鍵の作り直しは、PC からだけ");
    ph = await phone("/api/tasks", { headers: { ...cookie, "x-admin-token": token } });
    ok(ph.status === 200 && (await phone("/api/tasks", { headers: { "x-admin-token": token } })).status === 401, "スマホ: 鍵があれば予定タスクを見られる(鍵がなければ出さない)", ph.status);
    ok((await phone("/", { headers: { host: "pc.other.ts.net" } })).status === 421, "スマホ: 自分の Tailscale の名前以外のアドレスは、受け付けない");
    ok((await req("/api/phone/reset", { body: {} })).status === 200 && (await phone("/", { headers: cookie })).status === 401, "PC で鍵を作り直すと、それまでのスマホは開けなくなる");
    ok(/^\.admin\/$/m.test(read(".gitignore")), "スマホの鍵(.admin/phone.json)は、Git に入らない");
    const js = read("scripts/admin/app.js");
    ok(read("scripts/admin/app.html").includes('data-tab="goal"') && /goal: goalView/.test(js) && /planOpen\(\)\.length/.test(js), "管理者用ページに「目標・収益」のタブがあり、決めていない件数を出す");
    ok(/total: pending\.length \+ actions\.length \+ openProps\.length \}/.test(js) && js.includes('title: "KPI・収益化の案"'), "決めていない KPI・収益化の案は、「目標・収益」のタブの件数と、概要の「今日やること」に出す(判断待ちの件数と二重に数えない)");
    ok(js.includes('["stale", "要確認(確認日から60日超え)"]') && js.includes('go: ["events", { evFilter: "stale" }]'), "確認日から60日を過ぎた開催は、概要から開催一覧の「要確認」に移れる");
    // 定期の更新と、Claude に任せる(画面だけで完結する)
    const rf = await req("/api/refresh", { body: {} });
    ok(rf.status === 200 && rf.json.refresh.git.text === "最新です" && rf.json.state.refresh.last.why === "手動" && rf.json.state.refresh.hours === 0, "いますぐ更新: GitHub の最新の取り込みの結果を、画面の状態に出す", JSON.stringify(rf.json?.refresh));
    const st2 = (await req("/api/state")).json;
    ok(Array.isArray(st2.jobs) && st2.claude.loggedIn === false && st2.jobStatus.review, "画面の状態に、Claude の作業とログインの状態を入れる");
    ok((await phone("/api/claude/login", { headers: { ...cookie, "x-admin-token": token }, body: {} })).status !== 200, "Claude へのログインは、スマホからは開かない");
    ok(!/clipboard|頼む文をコピー/.test(js) && js.includes('"Claude に任せる"') && read("scripts/admin/app.html").includes('data-tab="claude"'), "Claude への依頼は、コピーして貼り付けず、画面のボタンと入力欄から行う");
    ok(/setInterval\(reload, hours \* 3600e3/.test(js) && /typing\(\)/.test(js), "画面は数時間おきに状況を読み直す(入力の途中は、描き直さない)");
  } finally {
    server.close();
    rmSync(ROOT, { recursive: true, force: true });
  }

  section("管理者用ページ: 保存と同時の公開(コミットと push)");
  // 本物の GitHub の代わりに、PC の中に、送り先のリポジトリを作って確かめる
  const T = mkdtempSync(join(tmpdir(), "kagura-pub-"));
  const git = findGit();
  const g = (cwd, ...a) => execFileSync(git, a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }).trim();
  const clone = (name) => { g(T, "clone", "-q", "-c", "core.autocrlf=false", "remote.git", name); const d = join(T, name); g(d, "config", "user.email", "t@example.invalid"); g(d, "config", "user.name", "t"); return d; };
  try {
    g(T, "-c", "init.defaultBranch=main", "init", "-q", "--bare", "remote.git");
    const A = clone("a");
    mkdirSync(join(A, "data")); writeFileSync(join(A, "data/events.json"), '[\n  {"id":"x","status":"published"}\n]');
    g(A, "add", "."); g(A, "commit", "-q", "-m", "init"); g(A, "push", "-q", "-u", "origin", "HEAD:main");
    const B = clone("b");
    writeFileSync(join(B, "README.md"), "週次の自動収集の代わり"); g(B, "add", "README.md"); g(B, "commit", "-q", "-m", "auto"); g(B, "push", "-q");
    writeFileSync(join(A, "data/events.json"), '[\n  {"id":"x","status":"withdrawn"}\n]');
    writeFileSync(join(A, "notes.txt"), "作業中");
    ok((await pendingChanges(A, git)).uncommitted === true, "保存したが、まだ送っていない変更を見つける");
    let p = await publish(A, "data(admin): 取り下げ: X", { git, check: false });
    const remoteLog = g(T, "--git-dir=remote.git", "log", "--format=%s", "main");
    ok(p.ok && remoteLog.split("\n")[0] === "data(admin): 取り下げ: X" && remoteLog.includes("auto"), "GitHub 側が先に進んでいても、取り込んでから送る", JSON.stringify(p));
    ok(g(A, "status", "--porcelain").includes("notes.txt") && !g(T, "--git-dir=remote.git", "show", "--stat", "--format=", "main").includes("notes.txt"), "開催データ以外の、作業中のファイルは、送らない");
    const pc = await pendingChanges(A, git);
    ok(!pc.uncommitted && pc.unpushed === 0, "送ったあとは、反映していない変更が残らない", JSON.stringify(pc));
    // 同じ行を、GitHub 側と、この PC で別々に変えた場合
    g(B, "pull", "-q"); writeFileSync(join(B, "data/events.json"), '[\n  {"id":"x","status":"pending"}\n]'); g(B, "commit", "-q", "-am", "other"); g(B, "push", "-q");
    writeFileSync(join(A, "data/events.json"), '[\n  {"id":"x","status":"published"}\n]');
    p = await publish(A, "data(admin): 再掲載: X", { git, check: false });
    ok(!p.ok && p.step === "push" && /重なりました/.test(p.log) && !existsSync(join(A, ".git/rebase-merge")) && !existsSync(join(A, ".git/rebase-apply")), "内容が重なったときは、送らずに知らせ、取り込みの途中の状態を残さない", p.log?.slice(0, 120));
    ok((await pendingChanges(A, git)).unpushed === 1, "送れなかったコミットは、PC に残り、「もう一度公開する」の対象になる");
    p = await publish(A, "x", { git, check: true });
    ok(!p.ok && p.step === "build", "サイトを作れないときは、送らない");
    // サイトは作れても、開催データのテスト(GitHub の公開処理で走る npm test の一部)が落ちるなら、送らない
    mkdirSync(join(A, "scripts")); writeFileSync(join(A, "scripts/build.mjs"), "");
    mkdirSync(join(A, "tests")); writeFileSync(join(A, "tests/held-review.mjs"), "console.error('保留の判断と合わない'); process.exit(1);");
    const before = g(A, "rev-parse", "HEAD");
    p = await publish(A, "x", { git, check: true });
    ok(!p.ok && p.step === "test" && p.log.includes("tests/held-review.mjs") && p.log.includes("保留の判断と合わない") && g(A, "rev-parse", "HEAD") === before, "開催データのテストが落ちるときは、コミットも送信もせず、どのテストかを知らせる", JSON.stringify(p));
    ok(JSON.parse(read("package.json")).scripts["test:data"] === DATA_TESTS.map((t) => `node ${t}`).join(" && ") && JSON.parse(read("package.json")).scripts.test.startsWith("npm run test:data && "), "管理者用ページの確認と、npm test の開催データのテスト(test:data)は、同じもの");
  } finally { rmSync(T, { recursive: true, force: true }); }

  section("管理者用ページ: Claude に任せる(1件ごとの作業用フォルダ)");
  {
    const { createJobs, cleanEnv, DISALLOWED_TOOLS } = await import("../scripts/admin/claude.mjs");
    const { syncMain } = await import("../scripts/admin/publish.mjs");
    const W = mkdtempSync(join(tmpdir(), "kagura-jobs-"));
    const git = findGit();
    const g = (cwd, ...a) => execFileSync(git, a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }).trim();
    try {
      g(W, "-c", "init.defaultBranch=main", "init", "-q", "--bare", "remote.git");
      g(W, "clone", "-q", "remote.git", "home");
      const H = join(W, "home");
      g(H, "config", "user.email", "t@example.invalid"); g(H, "config", "user.name", "t");
      writeFileSync(join(H, "README.md"), "a\n"); writeFileSync(join(H, ".gitignore"), ".admin/\nnode_modules/\n");
      mkdirSync(join(H, "node_modules/pkg"), { recursive: true }); writeFileSync(join(H, "node_modules/pkg/keep.txt"), "本体の node_modules");
      g(H, "add", "."); g(H, "commit", "-q", "-m", "init"); g(H, "push", "-q", "-u", "origin", "HEAD:main");
      writeFileSync(join(H, "作業中.txt"), "いつものフォルダの作業中のファイル");
      // 偽の Claude: 頼まれた文で、作業用フォルダのファイルを書いてコミットする / 「質問」と言うときは、変えずに尋ねる
      const calls = [];
      const runner = async ({ args, cwd, input, onLine }) => {
        calls.push({ args, cwd, input });
        onLine(JSON.stringify({ type: "system", subtype: "init", session_id: "s-" + calls.length }));
        if (/質問/.test(input)) { onLine(JSON.stringify({ type: "result", result: "質問: A と B のどちらにしますか？", is_error: false, session_id: "s-1" })); return { code: 0 }; }
        const name = input.includes("B で") ? "b.txt" : `${calls.length}.txt`;
        onLine(JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Write", input: { file_path: name } }] } }));
        writeFileSync(join(cwd, name), input);
        g(cwd, "add", name); g(cwd, "commit", "-q", "-m", `feat: ${input.split("\n")[0]}`);
        onLine(JSON.stringify({ type: "result", result: `${name} を足しました`, is_error: false, permission_denials: [{ tool_name: "Bash", tool_input: { command: "git push" } }] }));
        return { code: 0 };
      };
      const order = [];
      const serial = async (fn) => { order.push("serial"); return fn(); };
      const J = createJobs({ root: H, git, serial, runner, findExe: () => "claude.exe", auth: async () => ({ found: true, loggedIn: true }), check: async () => ({ ok: true }), parallel: 2 });
      const a = J.start({ title: "A", prompt: "SEO-20261108-1 をやって", source: { kind: "proposal", id: "SEO-20261108-1" } });
      const b = J.start({ title: "B", prompt: "別の作業" });
      ok(J.start({ prompt: "もう一度", source: { kind: "proposal", id: "SEO-20261108-1" } }).code === 409, "同じ案を、作業中に二重に頼まない");
      await J.idle();
      const ja = J.list().find((x) => x.id === a.job.id), jb = J.list().find((x) => x.id === b.job.id);
      ok(ja.status === "review" && jb.status === "review" && ja.commits === 1 && ja.files.length === 1 && jb.files.length === 1, "2件を同時に任せても、それぞれ自分の変更だけを持つ", JSON.stringify([ja.files, jb.files]));
      ok(calls[0].cwd !== calls[1].cwd && calls.every((c) => c.cwd.startsWith(join(H, ".admin", "work")) && existsSync(join(c.cwd, "README.md"))), "作業ごとに、別の作業用フォルダ(git worktree)で動かす");
      ok(!existsSync(join(H, "1.txt")) && !existsSync(join(H, "2.txt")) && read(join(H, "作業中.txt")).includes("作業中") && g(H, "rev-parse", "--abbrev-ref", "HEAD") === "main", "いつものフォルダ(作業中のファイル・ブランチ)には触れない");
      ok(ja.denied.length === 1 && /git push/.test(ja.denied[0]) && DISALLOWED_TOOLS.includes("Bash(git push:*)") && calls[0].args.includes("--disallowedTools"), "Claude には push させない(公開は、人が画面で決める)");
      ok(!("CLAUDECODE" in cleanEnv({ CLAUDECODE: "1", CLAUDE_CODE_SIMPLE: "1", ANTHROPIC_BASE_URL: "x", PATH: "p" })) && cleanEnv({ PATH: "p" }).PATH === "p", "Claude アプリの中の設定を、子の Claude に引き継がない");
      // 公開: GitHub の最新に重ねてから送る。先に B を公開してから A
      let p = await J.publish(jb.id);
      ok(p.publish.ok && g(W, "--git-dir=remote.git", "log", "--format=%s", "main").includes("feat: 別の作業") && !existsSync(join(H, ".admin", "work", jb.id)), "公開すると GitHub に送り、作業用フォルダを片付ける", JSON.stringify(p.publish));
      ok(existsSync(join(H, "node_modules/pkg/keep.txt")), "作業用フォルダを片付けても、本体の node_modules は消えない");
      p = await J.publish(ja.id);
      const log = g(W, "--git-dir=remote.git", "log", "--format=%s", "main");
      ok(p.publish.ok && log.includes("SEO-20261108-1") && log.includes("別の作業") && order.length === 2, "ほかの作業が先に公開されていても、最新に重ねて送る(公開は順番に)", log);
      ok(p.publish.synced === true && existsSync(join(H, "1.txt")) && existsSync(join(H, "作業中.txt")), "公開のあと、いつものフォルダも最新にする(作業中のファイルは残す)");
      // 質問 → 画面から返事 → 同じ作業の続き(--resume)
      const q = J.start({ title: "Q", prompt: "質問してから進めて" });
      await J.idle();
      let jq = J.list().find((x) => x.id === q.job.id);
      ok(jq.status === "answered" && /A と B/.test(jq.question) && jq.canReply, "Claude が質問で止まったら、質問を出し、返事を待つ", JSON.stringify(jq));
      ok(["queued", "running"].includes(J.reply(jq.id, "B で進めて").job.status), "返事を送ると、続きを頼む");
      await J.idle();
      jq = J.list().find((x) => x.id === q.job.id);
      const last = calls.at(-1);
      ok(jq.status === "review" && last.args.includes("--resume") && last.args.includes("s-1") && jq.turns.length === 4, "返事は、同じ作業用フォルダ・同じ会話の続きで動く", JSON.stringify(last.args.slice(-2)));
      const r = await J.discard(jq.id);
      ok(r.job.status === "discarded" && !existsSync(join(H, ".admin", "work", jq.id)) && !g(H, "branch", "--list", `admin/${jq.id}`) && !g(W, "--git-dir=remote.git", "log", "--format=%s", "main").includes("B で"), "やめると、作業用フォルダとブランチを消し、GitHub には何も送らない");
      // 止まった作業は、再起動のあとも「止まった」として残る
      writeFileSync(join(H, ".admin/jobs.json"), JSON.stringify({ jobs: [{ id: "jx", title: "x", status: "running", createdAt: "2026-11-08T00:00:00Z", turns: [] }] }));
      ok(createJobs({ root: H, git, runner, findExe: () => null, auth: async () => ({}) }).list()[0].status === "failed", "管理者用ページが止まったときに動いていた作業は、「止まった」として出す");
      // 定期の更新: GitHub の最新を、いつものフォルダに取り込む
      g(W, "clone", "-q", "remote.git", "other"); const O = join(W, "other");
      g(O, "config", "user.email", "t@example.invalid"); g(O, "config", "user.name", "t");
      writeFileSync(join(O, "週次.txt"), "x"); g(O, "add", "."); g(O, "commit", "-q", "-m", "auto"); g(O, "push", "-q");
      const s = await syncMain(H, git);
      ok(s.ok && s.pulled === 1 && existsSync(join(H, "週次.txt")) && existsSync(join(H, "作業中.txt")), "定期の更新で、GitHub 側の新しいコミットを取り込む(作業中のファイルはそのまま)", JSON.stringify(s));
      ok((await syncMain(H, git)).text === "最新です", "新しいものがなければ「最新です」");
    } finally {
      rmSync(W, { recursive: true, force: true });
    }
  }

  section("管理者用ページ: デスクトップのショートカット");
  const { pngToIco } = await import("../scripts/admin/shortcut.mjs");
  const png = readFileSync("assets/favicon-48.png"), ico = pngToIco(png);
  ok(ico.readUInt16LE(2) === 1 && ico.readUInt16LE(4) === 1 && ico[6] === 48 && ico.readUInt32LE(14) === png.length && ico.subarray(22).equals(png), "アイコン(ICO)は、サイトのシンボルの画像を、正しい形で包む");
  const cmd = read("scripts/admin/start.cmd");
  ok(/\r\n/.test(cmd) && !/[^\r]\n/.test(cmd) && cmd.includes('cd /d "%~dp0..\\.."') && cmd.includes("node scripts\\admin\\server.mjs"), "起動用のファイルは、Windows の改行で、リポジトリの場所から起動する");
  ok(read("scripts/admin/server.mjs").includes('t.includes("管理者用ページ")') && read("scripts/admin/server.mjs").includes('root: join(HERE, "..", "..")'), "起動済みなら画面だけ開き、どこから起動しても、リポジトリのデータを使う");

  section("管理者用ページ: 公開しないもの");
  const gi = read(".gitignore");
  ok(/^\.admin\/$/m.test(gi) && /^admin\.local\.json$/m.test(gi), "受信した記録(.admin/)と、Gmail の設定(admin.local.json)は、Git に入れない");
  const js = read("scripts/admin/app.js");
  ok(!/innerHTML|insertAdjacentHTML|outerHTML|document\.write/.test(js), "画面: メールの内容を HTML として扱わない(文字として表示)");
  ok(js.includes("https://mail.google.com/mail/?${q}`, \"_blank\", \"noopener,noreferrer\")"), "返信: Gmail の作成画面を、元の画面と切り離して開く");
  ok(!/\bstyle:|\.style\b/.test(js), "画面: 埋め込みの style を使わない(CSP で止められるため、クラスで指定する)");
  ok(read("scripts/admin/publish.mjs").includes("\"data/rejected.json\"") && /^analytics\/$/m.test(gi), "送るのは開催データと却下の記録まで。検索・アクセスの分析(analytics/)は Git に入れない");
  ok(read("scripts/admin/app.html").includes("data-tab=\"decide\"") && js.includes("decide: decideView") && js.includes("/api/events/reject") && js.includes("approve: !!opts.approve"), "画面: 「判断待ち」のタブから、保留の掲載・却下と、改善案の見送りができる");
  ok(!existsSync("dist-test/admin") && !read("scripts/build.mjs").includes("scripts/admin"), "管理者用ページは、公開サイトには含めない");
}
