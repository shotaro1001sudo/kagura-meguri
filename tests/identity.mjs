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
  // 検索結果の見た目: サイト名(ドメイン名でなく「神楽めぐり」)・ファビコン・題と説明
  const site = ld(home).find((x) => x["@type"] === "WebSite");
  ok(site?.name === cfg.siteName && site.url === `${cfg.baseUrl}/` && site.alternateName?.includes("かぐらめぐり"), "サイト名: トップの構造化データに、名前・別名・URL(検索結果にサイト名を出す)");
  const ico = existsSync(join(OUT, "favicon.ico")) ? readFileSync(join(OUT, "favicon.ico")) : Buffer.alloc(0);
  ok(ico.length > 22 && ico.readUInt16LE(2) === 1 && ico[6] === 48 && ico.subarray(22, 26).toString("latin1") === "\x89PNG", "/favicon.ico がある(48px。検索エンジンが直接見に行く)");
  ok(home('link[rel="icon"][sizes="96x96"]').attr("href") === "/symbol-96.png", "48の倍数の大きさのアイコン(48px・96px)を示す");
  const ht = home("title").text(), hd = home('meta[name="description"]').attr("content");
  ok(/日程/.test(ht) && /今週末/.test(ht) && ht.endsWith(cfg.siteName) && hd.startsWith("今週末、どこで神楽が観られる？"), "トップの題と説明: 「神楽 日程」「神楽 今週末」で探す人に向けた言葉", `${ht} / ${hd}`);
  const about = cheerio.load(read(join(OUT, "about.html")));
  ok(about("main").text().includes("神楽日和編集部") && about('.symbol img[src="/symbol.png"]').attr("alt") === "神楽日和編集部のシンボル", "運営者情報に、名前とシンボル(代替テキストつき)");
  const pv = read(join(OUT, "privacy.html"));
  ok(pv.includes("運営者: 神楽日和編集部") && pv.includes("運営者の氏名・住所は、ご請求があれば、遅滞なくお知らせします"), "プライバシーポリシー: 運営者名と、氏名・住所は請求に応じて知らせる旨");

  section("背景の文様(青海波)");
  const css = home("style").text();
  const waves = [...css.matchAll(/--wave:url\("data:image\/svg\+xml,([^"]+)"\)/g)].map((m) => decodeURIComponent(m[1]));
  ok(waves.length === 2 && waves.every((s) => s.startsWith("<svg") && (s.match(/<circle/g) ?? []).length === 12 && !/<script|href=/i.test(s)), "青海波の文様が、昼・夜の配色の2種類あり、図形だけでできている(外部の読み込みなし)");
  ok(waves.some((s) => s.includes("#f3eee4")) && waves.some((s) => s.includes("#171513")), "文様の下地の色が、昼・夜それぞれの背景色と同じ(重なりが自然に見える)");
  ok(!/\.home-hero:after/.test(css), "トップの見出しの背景には、文様を敷かない(左右の余白だけ)");
  ok(/@media\(min-width:1100px\)\{\s*body:before,body:after\{[^}]*position:fixed[^}]*background:var\(--wave\)/.test(css) && !/^body:before/m.test(css.replace(/@media\(min-width:1100px\)\{[\s\S]*?\n\}/, "")), "B: 左右の余白への文様は、余白のある広い画面(1100px以上)だけ");
  ok(/@media print\{body:before,body:after\{display:none\}\}/.test(css), "印刷では、文様を出さない");
  ok(/img-src[^;]*data:/.test(home('meta[http-equiv="Content-Security-Policy"]').attr("content")), "CSP: 文様(data: の画像)の表示が、許可されている");

  section("見出しの背景の情景(月と社)");
  const ms = home(".home-hero svg.ms");
  ok(ms.length === 1 && ms.attr("aria-hidden") === "true" && ms.attr("focusable") === "false" && home(".enso").length === 0, "見出しの背景は「月と社」の情景(飾りなので、読み上げない)。以前の円は残っていない");
  ok(["ms-sky", "ms-kasumi", "ms-land", "ms-stars"].every((c) => ms.find(`g.${c}`).length === 1) && ms.find("circle.ms-moon").length === 1 && ms.find("path.ms-torii").length === 1 && ms.find("path.ms-k").length === 2, "月(空)・霞・地(山と鳥居)・星の層がある");
  const homeHtml = read(join(OUT, "index.html"));
  ok(["msHalo", "msMist", "msFar", "msNear", "msEdge", "msMask"].every((id) => (homeHtml.match(new RegExp(`id="${id}"`, "g")) ?? []).length === 1), "SVG の中の名前(id)が、ページの中で重ならない");
  ok(/@media\(max-width:560px\)\{[^@]*\.ms\{display:none\}/.test(css) && /@media print\{[^}]*\.ms[,{]/.test(css), "スマホ(文字の邪魔になる)と印刷では、情景を出さない");
  ok(/\.intro \.ms-sky\{animation:moonrise/.test(css) && /\.js \.ms-sky\{translate:0 calc\(var\(--py,0px\)\*\.42\)\}/.test(css) && /\.js \.ms-land\{translate:0 calc\(var\(--py,0px\)\*\.18\)\}/.test(css), "動き: 最初の訪問で月が昇り、スクロールでは層ごとに違う速さで動く(奥行き)");
  ok(/\.js \.ms-k1\{animation:kasumi/.test(css) && /\.js \.ms-stars circle\{animation:twinkle/.test(css) && !/(^|\})\.ms-k1\{animation/.test(css), "霞の漂いと星の瞬きは、JS が動く(動きを減らさない)ときだけ");

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
