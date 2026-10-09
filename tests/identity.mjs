// 運営者の表示(名前・シンボル)と、メールアドレスを公開しない対策のテスト
import { readFileSync, readdirSync, statSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";

const read = (p) => readFileSync(p, "utf8");
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
/** PNG の幅・高さ(IHDR) */
const pngSize = (p) => { const b = readFileSync(p); return b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; };

export function identityTests({ ok, section, OUT, build }) {
  const cfg = JSON.parse(read("config.json").replace(/^﻿/, ""));
  section("運営者の表示(名前・シンボル)");
  ok(cfg.operator.name === "神楽日和編集部", "運営者名は「神楽日和編集部」");
  for (const [f, w] of [["symbol.png", 330], ["symbol-96.png", 96], ["favicon-48.png", 48], ["apple-touch-icon.png", 180]]) {
    const s = existsSync(join(OUT, f)) ? pngSize(join(OUT, f)) : null;
    ok(s && s[0] === w && s[1] === w, `${f}: 正方形の PNG(${w}px)が公開される`, JSON.stringify(s));
  }
  const home = cheerio.load(read(join(OUT, "index.html")));
  ok(home('link[rel="icon"]').attr("href") === "/favicon-48.png" && home('link[rel="apple-touch-icon"]').attr("href") === "/apple-touch-icon.png", "ファビコンと、ホーム画面のアイコンが、シンボル");
  ok(home(".top .logo img").attr("src") === "/symbol-96.png" && home(".top .logo img").attr("alt") === "" && home(".top .logo").text() === cfg.siteName, "ヘッダーに、シンボルとサイト名(画像は飾りなので、読み上げない)");
  const ld = (q) => q('script[type="application/ld+json"]').map((_, s) => JSON.parse(q(s).text())).get().flat();
  const pub = ld(home).find((x) => x["@type"] === "WebSite")?.publisher;
  ok(pub?.name === "神楽日和編集部" && pub.logo?.url === `${cfg.baseUrl}/symbol.png` && pub.logo.width === 330, "構造化データ: 運営者として、名前とロゴ(シンボル)を示す");
  const about = cheerio.load(read(join(OUT, "about.html")));
  ok(about("main").text().includes("神楽日和編集部") && about('.symbol img[src="/symbol.png"]').attr("alt") === "神楽日和編集部のシンボル", "運営者情報に、名前とシンボル(代替テキストつき)");
  const pv = read(join(OUT, "privacy.html"));
  ok(pv.includes("運営者: 神楽日和編集部") && pv.includes("運営者の氏名・住所は、ご請求があれば、遅滞なくお知らせします") && !pv.includes("神楽日和編集部"), "プライバシーポリシー: 運営者名と、氏名・住所は請求に応じて知らせる旨");

  section("メールアドレスを公開しない");
  // 本番の設定: フォームの送信先(Web3Forms)があり、運営者のアドレスは、リポジトリの設定にも置かない
  ok(cfg.operator.contact === "" && /^https:\/\/api\.web3forms\.com\//.test(cfg.form.endpoint) && /^[0-9a-f-]{36}$/.test(cfg.form.accessKey), "本番の設定: 送信先は Web3Forms。運営者のアドレスは、設定ファイルにも書かない");
  // アドレスの一部(@ の前)、または、一般のメールアドレス(フリーメール)が、ファイルに入っているか
  // (フォームのスクリプトの「mailto:」という処理名や、入力欄の形式チェックの「@」は、アドレスではないので、数えない)
  const leaksOf = (address) => { const [user, domain] = address.split("@"); return (dir) => walk(dir).filter((f) => !/\.png$/.test(f)).filter((f) => { const t = read(f); return (user && t.includes(user)) || (domain && t.includes(`@${domain}`)) || /[A-Za-z0-9._%+-]+@(gmail|yahoo|icloud|outlook|hotmail|example)\./i.test(t); }); };
  ok(leaksOf("")(OUT).length === 0, "本番の設定: 公開されるどのファイルにも、メールアドレスが出ない", leaksOf("")(OUT).join(", "));
  // 送信先が未設定の場合(予備のメール作成): アドレスは、フォームのページに限って入る
  const D = "dist-test-identity", TEST_ADDR = "owner@example.com";
  const r = build("tests/fixtures/events.test.json", D, { TEST_FORM_OFF: "1", TEST_CONTACT: TEST_ADDR });
  const fallback = leaksOf(TEST_ADDR)(D).map((f) => f.replace(/\\/g, "/").replace(`${D}/`, ""));
  ok(r.status === 0 && fallback.length === 2 && fallback.every((f) => ["submit.html", "contact.html"].includes(f)), "送信先が未設定の間、アドレスの一部が入るのは、フォームのページ(予備のメール作成用)だけ", fallback.join(", "));
  for (const f of ["about.html", "privacy.html", "disclaimer.html", "organizers.html", "guide.html"]) ok(!read(join(D, f)).includes("owner"), `${f}: 送信先が未設定でも、アドレスを載せない(連絡はお問い合わせフォームへ)`);
  rmSync(D, { recursive: true, force: true });
  ok(!/@/.test(read("scripts/collect.mjs").match(/const UA = `([^`]*)`/)?.[1] ?? "@"), "自動収集で名乗る名前(User-Agent)に、メールアドレスを入れない");
}
