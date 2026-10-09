// 週次の自動更新の結果を、メールで送る仕組みのテスト
//  1) 件名・本文(成功・変更なし・試運転・失敗・公開の失敗・件数が多い場合)
//  2) 送信の設定(暗号化の扱い)
//  3) 手元に小さなメールサーバー(SMTP)を立て、notify-mail.mjs を実際に動かす(本物のメールは送らない)
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { buildMessage, shortDate, MAX_ITEMS } from "../scripts/lib/notify-message.mjs";
import { transportOptions } from "../scripts/notify-mail.mjs";

const USER = "bot@example.com", PASS = "abcd efgh ijkl mnop", TO = "owner@example.com";

// --- 受け取ったメールの読み取り(テスト用の最小限) ---
const qp = (s) => Buffer.from(s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))), "latin1").toString("utf8");
const decodeWords = (s) => s.replace(/\?=\s+=\?/g, "?==?").replace(/=\?utf-8\?([bq])\?([^?]*)\?=/gi, (_, enc, v) => (enc.toLowerCase() === "b" ? Buffer.from(v, "base64").toString("utf8") : qp(v.replace(/_/g, " "))));
function parseMail(raw) {
  const [head, ...rest] = raw.split(/\r\n\r\n/);
  const h = head.replace(/\r\n[ \t]+/g, " ");
  const get = (n) => (h.match(new RegExp(`^${n}: (.*)$`, "mi")) ?? [])[1] ?? "";
  let body = rest.join("\r\n\r\n");
  const cte = get("Content-Transfer-Encoding").toLowerCase();
  body = cte === "base64" ? Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8") : cte === "quoted-printable" ? qp(body) : body;
  return { subject: decodeWords(get("Subject")), from: decodeWords(get("From")), to: get("To"), body: body.replace(/\r\n/g, "\n") };
}

export async function notifyTests({ ok, section }) {
  section("メール通知: 件名と本文");
  const ev = (name, start, extra = {}) => ({ name, start, prefecture: "広島県", city: "安芸高田市", url: "https://example.com/" + encodeURIComponent(name), ...extra });
  const summary = {
    date: "2026-10-12", autoPublish: true, published: 2, held: 1, withdrawn: 1, errors: 0, inactive: 0, needsAttention: true,
    items: { published: [ev("高宮神楽まつり", "2026-11-23T19:00"), ev("神楽B", "2026-12-01T18:00", { note: "日程の変更(旧 2026-11-29)" })], held: [ev("ミニコンサート", "2026-10-25T00:00", { reason: "名称に、神楽に関する語が見当たらない" })], withdrawn: [ev("神楽C", "2026-12-05T18:00", { reason: "取得元のページから、2回続けて消えたため" })] },
  };
  const m = (o) => buildMessage({ summary, siteUrl: "https://kagurameguri.jp/", runUrl: "https://github.com/x/y/actions/runs/1", ...o });

  ok(shortDate("2026-11-23T19:00") === "11/23(月)" && shortDate("2026-10-12") === "10/12(月)" && shortDate("") === "日付不明", "日付は「11/23(月)」の形で出る");
  let r = m({ changed: true, deployResult: "success" });
  ok(r.subject === "【神楽めぐり】週次の自動更新 10/12: ✅ サイトを更新(新規2・保留1・取り下げ1)", "件名だけで、結果と件数が分かる", r.subject);
  ok(r.text.includes("✅ 公開サイトを更新しました") && r.text.includes("■ 新規掲載 2件") && r.text.includes("・11/23(月) 高宮神楽まつり(広島県安芸高田市)") && r.text.includes("https://example.com/%E9%AB%98") && r.text.includes("※日程の変更(旧 2026-11-29)"), "本文: 新規掲載の一覧(日付・名称・場所・公式URL・日程変更の注記)");
  ok(r.text.includes("■ 取り下げ 1件") && r.text.includes("理由: 取得元のページから、2回続けて消えたため") && r.text.includes("■ 保留・要確認(掲載していません) 1件") && r.text.includes("理由: 名称に、神楽に関する語"), "取り下げ・保留は、理由つき");
  ok(r.text.includes("サイト: https://kagurameguri.jp/") && r.text.includes("実行の詳細: https://github.com/x/y/actions/runs/1") && r.text.includes("Issue") && r.text.includes("自動で送っています"), "サイトと実行の詳細へのリンク、保留の確認方法、自動送信である旨");
  ok(m({ changed: false }).subject.includes("➖ 変更なし") && m({ changed: false }).text.includes("変更はありませんでした"), "変更なし");
  r = m({ dryRun: true });
  ok(r.subject.includes("🧪 試運転") && r.text.includes("試運転なので、まだ掲載していません") && !r.text.includes("Issue"), "試運転: 反映していないことが分かる");
  ok(m({ changed: true, deployResult: "failure" }).subject.includes("⚠ 公開に失敗") && m({ changed: true, deployResult: "unknown" }).text.includes("完了は確認できていません"), "公開の失敗・完了が確認できないとき");
  ok(m({ jobStatus: "failure" }).text.includes("自動更新が失敗しました。何も公開されていません") && m({ jobStatus: "failure", changed: true }).text.includes("データの反映は済んでいる"), "失敗: 反映の前か後かで、文面を変える");
  ok(m({ jobStatus: "cancelled" }).subject.includes("⏹ 途中で停止"), "時間切れ・停止");
  r = buildMessage({ summary: null, jobStatus: "failure", date: "2026-10-12" });
  ok(r.subject === "【神楽めぐり】週次の自動更新 10/12: ❌ 失敗(結果なし)" && r.text.includes("収集の前に止まりました"), "収集の前に止まったとき(結果がない)も、送れる", r.subject);
  r = buildMessage({ summary: { ...summary, published: 0, held: 0, withdrawn: 0, inactive: 2, items: {} }, changed: false });
  ok(r.text.includes("新規掲載・取り下げ・保留は、ありませんでした") && r.text.includes("規約の確認待ちで、止まっている収集元が 2 つ"), "何もないとき・規約確認待ちの収集元があるとき");
  ok(buildMessage({ summary: { ...summary, autoPublish: false } }).text.includes("自動掲載: オフ"), "自動掲載がオフのとき");
  const many = Array.from({ length: 40 }, (_, i) => ev(`大量の神楽${i}`, "2026-12-20T19:00"));
  r = buildMessage({ summary: { ...summary, published: 40, items: { ...summary.items, published: many } }, changed: true, deployResult: "success" });
  ok(r.text.includes(`・ほか ${40 - MAX_ITEMS} 件`) && r.text.includes(`大量の神楽${MAX_ITEMS - 1}`) && !r.text.includes(`大量の神楽${MAX_ITEMS})`), `件数が多いときは、${MAX_ITEMS}件まで並べ、残りは「ほか N 件」`);

  section("メール通知: 送信の設定(暗号化)");
  let o = transportOptions({ user: USER, pass: "x" });
  ok(o.host === "smtp.gmail.com" && o.port === 465 && o.secure === true && !o.ignoreTLS, "既定は Gmail。465番で、最初から暗号化");
  o = transportOptions({ host: "smtp.mail.me.com", port: "587", user: USER, pass: "x" });
  ok(o.secure === false && o.requireTLS === true && !o.ignoreTLS, "587番などは、STARTTLS を必須にする(暗号化なしでは送らない)");
  o = transportOptions({ host: "127.0.0.1", port: 2525, user: USER, pass: "x" });
  ok(o.ignoreTLS === true && o.secure === false && !o.requireTLS, "暗号化なしは、手元(localhost)のテスト用サーバーだけ");
  let threw = false; try { transportOptions({ port: "abc", user: USER, pass: "x" }); } catch { threw = true; }
  ok(threw, "ポート番号が不正なら、送らない");

  // ---------- 3. 実際に動かす(手元のメールサーバー) ----------
  section("メール通知: 送信(手元のメールサーバーで確認)");
  const T = "tests/.tmp-notify";
  rmSync(T, { recursive: true, force: true }); mkdirSync(T, { recursive: true });
  writeFileSync(`${T}/summary.json`, JSON.stringify(summary));
  const smtp = { conns: 0, mails: [], auths: [], rcpts: [], mode: "ok", failOnce: false };
  const server = createServer((sock) => {
    smtp.conns++;
    let buf = "", inData = false, data = "", authWait = false;
    const say = (s) => sock.write(s + "\r\n");
    say("220 localhost ESMTP test");
    sock.on("data", (chunk) => {
      buf += chunk.toString("latin1");
      let i;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (inData) {
          if (line === ".") { inData = false; smtp.mails.push(parseMail(Buffer.from(data, "latin1").toString("utf8"))); data = ""; say("250 queued"); }
          else data += (line.startsWith("..") ? line.slice(1) : line) + "\r\n";
          continue;
        }
        const auth = (b64) => { smtp.auths.push(Buffer.from(b64, "base64").toString("utf8").split("\0")); say(smtp.mode === "authfail" ? "535 5.7.8 bad credentials" : "235 ok"); };
        if (authWait) { authWait = false; auth(line); continue; }
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === "EHLO") say("250-localhost\r\n250-AUTH PLAIN\r\n250-8BITMIME\r\n250 SMTPUTF8");
        else if (cmd === "HELO") say("250 localhost");
        else if (/^AUTH PLAIN \S+/i.test(line)) auth(line.split(" ")[2]);
        else if (/^AUTH PLAIN$/i.test(line)) { authWait = true; say("334 "); }
        else if (cmd === "MAIL") { if (smtp.failOnce) { smtp.failOnce = false; say("451 4.3.0 try again later"); } else say("250 ok"); }
        else if (cmd === "RCPT") { smtp.rcpts.push(line.replace(/^RCPT TO:\s*/i, "").replace(/[<>]/g, "").split(" ")[0]); say("250 ok"); }
        else if (cmd === "DATA") { inData = true; say("354 go"); }
        else if (cmd === "QUIT") { say("221 bye"); sock.end(); }
        else say("250 ok");
      }
    });
    sock.on("error", () => {});
  });
  await new Promise((res) => server.listen(0, "127.0.0.1", res));
  const port = String(server.address().port);
  const reset = () => { smtp.conns = 0; smtp.mails = []; smtp.auths = []; smtp.rcpts = []; smtp.mode = "ok"; smtp.failOnce = false; };
  const run = (env) => new Promise((resolve) => {
    const base = { ...process.env }; for (const k of Object.keys(base)) if (k.startsWith("MAIL_")) delete base[k];
    const c = spawn("node", ["scripts/notify-mail.mjs"], { env: { ...base, SUMMARY_FILE: `${T}/summary.json`, NOTIFY_NOW: "2026-10-12T05:30:00+09:00", ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let out = ""; c.stdout.on("data", (d) => (out += d)); c.stderr.on("data", (d) => (out += d)); c.on("close", (code) => resolve({ code, out }));
  });
  const live = { MAIL_USERNAME: USER, MAIL_PASSWORD: PASS, MAIL_TO: TO, MAIL_SMTP_HOST: "127.0.0.1", MAIL_SMTP_PORT: port, JOB_STATUS: "success", CHANGED: "true", DEPLOY_RESULT: "success", RUN_URL: "https://github.com/x/y/actions/runs/9" };

  let x = await run({ MAIL_SMTP_HOST: "127.0.0.1", MAIL_SMTP_PORT: port });
  ok(x.code === 0 && smtp.conns === 0 && /送信しません/.test(x.out), "メールの設定(Secrets)がないときは、何も送らず、失敗にもしない");
  reset(); x = await run(live);
  const mail = smtp.mails[0] ?? {};
  ok(x.code === 0 && smtp.mails.length === 1 && smtp.rcpts.join() === TO, "設定があれば、1通だけ、指定の宛先へ送る", x.out);
  ok(smtp.auths[0]?.[1] === USER && smtp.auths[0]?.[2] === PASS.replace(/ /g, ""), "アカウントで認証する(アプリパスワードの空白は、取り除く)");
  ok(mail.subject === "【神楽めぐり】週次の自動更新 10/12: ✅ サイトを更新(新規2・保留1・取り下げ1)" && /神楽めぐり 自動更新/.test(mail.from) && mail.from.includes(USER) && mail.to.includes(TO), "件名(日本語)・差出人・宛先が、正しく届く", JSON.stringify({ s: mail.subject, f: mail.from }));
  ok(mail.body?.includes("✅ 公開サイトを更新しました") && mail.body.includes("高宮神楽まつり") && mail.body.includes("実行の詳細: https://github.com/x/y/actions/runs/9") && mail.body.includes("サイト: https://kagurameguri.jp/"), "本文(日本語)が、正しく届く");
  ok(!x.out.includes(PASS.replace(/ /g, "")) && !x.out.includes("abcd efgh") && !x.out.includes(TO), "ログに、パスワードも、送り先のアドレスも出さない(公開リポジトリのログは、誰でも見られるため)");

  reset(); x = await run({ ...live, MAIL_TO: `${TO}, second@example.com` });
  ok(x.code === 0 && smtp.rcpts.join() === `${TO},second@example.com`, "宛先は、カンマ区切りで複数にできる");
  reset(); smtp.failOnce = true; x = await run(live);
  ok(x.code === 0 && smtp.mails.length === 1 && smtp.conns === 2, "相手のサーバーの一時的なエラー(451)は、1回だけ再送し、1通だけ届く");
  reset(); smtp.mode = "authfail"; x = await run(live);
  ok(x.code === 1 && smtp.mails.length === 0 && smtp.conns === 1 && /EAUTH/.test(x.out) && !x.out.includes("abcdefgh"), "認証の失敗は、再送せず、失敗として知らせる(パスワードは出さない)");
  reset(); x = await run({ ...live, MAIL_TO: "not-an-address" });
  ok(x.code === 1 && smtp.conns === 0 && /メールアドレスの形式/.test(x.out), "宛先の形式が違えば、送らない");
  reset(); x = await run({ ...live, JOB_STATUS: "failure", CHANGED: "", NOTIFY_NOW: "2026-10-19T05:30:00+09:00" });
  ok(x.code === 0 && smtp.mails[0]?.subject.includes("10/19: ❌ 失敗(結果なし)") && !smtp.mails[0].body.includes("高宮神楽まつり"), "収集の前に失敗したときは、前回の結果を、今回のものとして送らない");
  reset(); x = await run({ ...live, DRY_RUN: "true", CHANGED: "", DEPLOY_RESULT: "" });
  ok(smtp.mails[0]?.subject.includes("🧪 試運転"), "試運転(dry_run)でも、結果が届く(通知の確認に使える)");

  server.close(); rmSync(T, { recursive: true, force: true });
}
