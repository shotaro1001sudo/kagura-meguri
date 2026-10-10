// 管理者用ページのテスト: メールの読み取り、開催データの保存、サーバーの安全対策
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { simpleParser } from "mailparser";
import { classify, readFields, readJsonBlock, toItem } from "../scripts/admin/mail.mjs";
import { validateEvent, upsertEvent, pruneInbox, suggestId, setInboxStatus } from "../scripts/admin/store.mjs";
import { startAdmin } from "../scripts/admin/server.mjs";
import { publish, pendingChanges, findGit } from "../scripts/admin/publish.mjs";
import { execFileSync } from "node:child_process";
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

    let r = await req("/api/fetch-mail", { body: {} });
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
  } finally { rmSync(T, { recursive: true, force: true }); }

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
  ok(!existsSync("dist-test/admin") && !read("scripts/build.mjs").includes("scripts/admin"), "管理者用ページは、公開サイトには含めない");
}
