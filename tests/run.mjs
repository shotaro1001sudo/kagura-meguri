// 自動テスト: node tests/run.mjs   (npm test)
// 1) テスト用データと固定の日時でビルド → 2) 出力を機械的に検査 → 3) 0件・不正データの挙動も検査
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync, statSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import * as cheerio from "cheerio";
import { palettes, ratio, PAIRS } from "./contrast.mjs";
import { extraTests } from "./extra.mjs";

const NOW = "2026-10-09T12:00"; // 日本時間で固定(テストが日付に左右されないように)
const build = (events, out, extra = {}) =>
  spawnSync("node", ["scripts/build.mjs"], { env: { ...process.env, EVENTS_FILE: events, REGULAR_FILE: "tests/fixtures/regular.test.json", OUT_DIR: out, BUILD_NOW: NOW, ...extra }, encoding: "utf8" });

let pass = 0, fail = 0;
const failures = [];
const ok = (cond, name, detail = "") => {
  if (cond) pass++; else { fail++; failures.push(`${name}${detail ? " — " + detail : ""}`); }
};
const section = (s) => console.log(`\n■ ${s}`);

const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const read = (p) => readFileSync(p, "utf8");

// ---------- 1. ビルド ----------
section("ビルド");
const OUT = "dist-test";
let r = build("tests/fixtures/events.test.json", OUT);
ok(r.status === 0, "テスト用データでビルドできる", r.stderr);
const files = walk(OUT);
const htmls = files.filter((f) => f.endsWith(".html"));
const rel = (f) => "/" + relative(OUT, f).replace(/\\/g, "/");
const hasFile = (urlPath) => {
  let p = decodeURIComponent(urlPath.split("#")[0].split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  return existsSync(join(OUT, p));
};
for (const f of ["index.html", "map.html", "calendar.html", "kagura/index.html", "404.html", "about.html", "contact.html", "privacy.html", "sitemap.xml", "robots.txt", "events.json", "CNAME"])
  ok(existsSync(join(OUT, f)), `出力に ${f} がある`);

// ---------- 2. 各ページの基本品質 ----------
section("各ページの基本(title / description / canonical / h1 / lang)");
const titles = new Map();
for (const f of htmls) {
  const html = read(f), $ = cheerio.load(html), name = rel(f);
  ok($("html").attr("lang") === "ja", `${name}: lang=ja`);
  const t = $("title").text().trim();
  ok(t.length > 0 && t.length <= 120, `${name}: title がある(120字以内)`, t);
  ok(!titles.has(t), `${name}: title が他ページと重複しない`, t);
  titles.set(t, name);
  const d = $('meta[name="description"]').attr("content") ?? "";
  ok(d.length > 0 && d.length <= 160, `${name}: description がある(160字以内)`, `${d.length}字`);
  ok(($('link[rel="canonical"]').attr("href") ?? "").startsWith("https://"), `${name}: canonical が https`);
  ok($('meta[name="viewport"]').length === 1, `${name}: viewport`);
  ok($("h1").length === 1, `${name}: h1 が1つ`, `${$("h1").length}個`);
  ok(html.length < 140_000, `${name}: HTML が軽い(140KB未満)`, `${html.length}B`);
  $("script, style").remove(); // コードの中身ではなく、画面に見える文字だけを調べる
  const text = $("body").text();
  ok(!/undefined|NaN|\[object|null(?![a-z])/.test(text), `${name}: 画面に undefined/NaN/null が出ていない`);
  ok(!text.includes("広告枠"), `${name}: 仮の「広告枠」が出ていない`);
}

// ---------- 3. リンク切れ ----------
section("内部リンク・外部リンク");
let internal = 0;
for (const f of htmls) {
  const $ = cheerio.load(read(f)), name = rel(f);
  $("a[href], link[href][rel=canonical]").each((_, el) => {
    const h = $(el).attr("href");
    if (!h || h.startsWith("#") || h.startsWith("mailto:") || h.startsWith("data:")) return;
    if (/^https?:\/\//.test(h)) {
      if ($(el).attr("target") === "_blank") ok(/noopener/.test($(el).attr("rel") ?? ""), `${name}: target=_blank に noopener`, h);
      return;
    }
    internal++;
    ok(h.startsWith("/") && hasFile(h), `${name}: 内部リンク先が存在する`, h);
  });
  $("[src]").each((_, el) => { const s = $(el).attr("src"); if (s && s.startsWith("/")) ok(hasFile(s), `${name}: src が存在する`, s); });
}
console.log(`  内部リンク ${internal} 本を確認`);

// ---------- 4. 表示ロジック(日付・状態) ----------
section("表示ロジック");
const index = cheerio.load(read(join(OUT, "index.html")));
const listText = index("#list").text();
ok(!listText.includes("承認前のため出てはいけない"), "承認前(pending)のデータは一覧に出ない");
ok(!existsSync(join(OUT, "events/t-pending.html")), "承認前のデータは詳細ページも作られない");
ok(!listText.includes("終了した神楽"), "終了したイベントは一覧に出ない");
ok(listText.includes("開催中のテスト"), "開催中(終了時刻なし・3時間以内)は一覧に出る");
ok(listText.includes("時間は公式情報で確認"), "時間未定のイベントは「時間は公式情報で確認」と出る");
ok(index("#list > div").first().text().includes("開催中のテスト"), "一覧は日付順(いちばん早い開催中が先頭)");
const past = cheerio.load(read(join(OUT, "events/t-past.html")));
ok(past("body").text().includes("終了しました"), "終了したイベントの詳細ページに「終了しました」");
const tu = cheerio.load(read(join(OUT, "events/t-timeunknown.html")));
ok(!/00:00/.test(tu("table.info").text()), "時間未定の詳細に 00:00 が出ない");
ok(tu("body").text().includes("おおよその位置"), "市区町村の位置のピンには注意書きが出る");
const min = cheerio.load(read(join(OUT, "events/t-minimal.html")));
ok(!min("a[href='/kagura/.html']").length && !/\/kagura\/\.html/.test(read(join(OUT, "events/t-minimal.html"))), "神楽の種類が空でも壊れたリンクを作らない");
ok(!existsSync(join(OUT, "kagura/.html")), "神楽の種類が空のファイルを作らない");
const full = cheerio.load(read(join(OUT, "events/t-full.html")));
ok(/2026年11月20日 20:00 〜 2026年11月20日 21:00/.test(full("table.info").text()), "日時が日本時間のまま正しく表示される");

// ---------- 5. 安全性(XSS・構造化データ) ----------
section("安全性と構造化データ");
const xss = read(join(OUT, "events/t-xss.html"));
ok(!xss.includes("<script>alert(1)</script>"), "名称の <script> がそのまま出力されない");
ok(!/<img src=x/i.test(xss), "説明文の <img onerror> がそのまま出力されない");
ok(!/会場 <\/script>/.test(xss), "会場名の </script> がそのまま出力されない");
for (const f of htmls) {
  const $ = cheerio.load(read(f));
  $('script[type="application/ld+json"]').each((_, el) => {
    let j; try { j = JSON.parse($(el).text()); } catch { j = null; }
    ok(j, `${rel(f)}: JSON-LD が壊れていない`);
  });
}
const ldOf = (id) => { const j = JSON.parse(cheerio.load(read(join(OUT, `events/${id}.html`)))('script[type="application/ld+json"]').text()); return Array.isArray(j) ? j.find((x) => x["@type"] === "Event") : j; };
const bc = JSON.parse(cheerio.load(read(join(OUT, "events/t-full.html")))('script[type="application/ld+json"]').text()).find((x) => x["@type"] === "BreadcrumbList");
ok(bc && bc.itemListElement.length === 3 && bc.itemListElement[1].name === "宮崎県", "詳細ページにパンくず(BreadcrumbList)");
ok(JSON.parse(cheerio.load(read(join(OUT, "index.html")))('script[type="application/ld+json"]').text())["@type"] === "WebSite", "トップに WebSite 構造化データ");
const lf = ldOf("t-full");
ok(lf["@type"] === "Event" && lf.name && lf.startDate === "2026-11-20T20:00+09:00" && lf.endDate === "2026-11-20T21:00+09:00", "Event の日時に +09:00 が付く");
ok(lf.location.geo?.latitude === 32.70545, "Event に緯度経度が入る");
ok(ldOf("t-timeunknown").startDate === "2026-10-10", "時間未定のEventは日付のみ");
ok(!("description" in ldOf("t-minimal")), "説明が空なら description を出さない");

// ---------- 6. カレンダー追加(ICS) ----------
section("カレンダー(ICS)");
for (const f of files.filter((x) => x.endsWith(".ics"))) {
  const s = read(f), n = rel(f);
  ok(s.startsWith("BEGIN:VCALENDAR\r\n") && s.endsWith("END:VCALENDAR\r\n"), `${n}: 形式と改行(CRLF)`);
  ok(/UID:[^\r\n]+/.test(s) && /DTSTAMP:\d{8}T\d{6}Z/.test(s) && /DTSTART/.test(s) && /DTEND/.test(s) && /SUMMARY:/.test(s), `${n}: 必須項目`);
  ok(!/[^\r]\n/.test(s), `${n}: 改行がCRLFのみ`);
}
const icsX = read(join(OUT, "events/t-xss.ics"));
ok(/\\,/.test(icsX) || !/,/.test(icsX.split("SUMMARY:")[1].split("\r\n")[0]), "ICS の文字がエスケープされる");
ok(/DTSTART;VALUE=DATE:20261010/.test(read(join(OUT, "events/t-timeunknown.ics"))), "時間未定のICSは終日扱い");
ok(/DTSTART;TZID=Asia\/Tokyo:20261120T200000/.test(read(join(OUT, "events/t-full.ics"))), "ICS の日時が日本時間(TZID)");

// ---------- 7. サイトマップ ----------
section("サイトマップ・robots");
const sm = read(join(OUT, "sitemap.xml"));
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
ok(locs.length > 10, "サイトマップにURLが並ぶ", `${locs.length}件`);
for (const u of locs) ok(hasFile(new URL(u).pathname), "サイトマップのURLに実体がある", u);
ok(!locs.some((u) => u.includes("404")), "サイトマップに 404 を含めない");
ok(/<lastmod>2026-10-09<\/lastmod>/.test(sm), "サイトマップに lastmod");
ok(read(join(OUT, "robots.txt")).includes("Sitemap: https://"), "robots.txt に Sitemap");
ok(read(join(OUT, "CNAME")).trim() === JSON.parse(read("config.json")).domain, "CNAME が config の domain と一致");

// ---------- 9. アクセシビリティ ----------
section("アクセシビリティ(色・操作しやすさ・ナビ)");
for (const [theme, pal] of Object.entries(palettes()))
  for (const [a, b] of PAIRS) ok(ratio(pal[a], pal[b]) >= 4.5, `配色(${theme}): ${a} / ${b} のコントラスト比が4.5以上`, ratio(pal[a], pal[b]).toFixed(2));
const css = read("scripts/style.css");
ok(/:focus-visible/.test(css), "キーボードのフォーカス表示がある");
ok(/min-height:44px/.test(css), "ボタン・メニューは44px以上の押しやすさ");
ok(/prefers-reduced-motion/.test(css), "動きを減らす設定に対応");
for (const f of htmls) {
  const $ = cheerio.load(read(f)), name = rel(f);
  ok($("a.skip[href='#main']").length === 1 && $("main#main").length === 1, `${name}: 「本文へ移動」リンクと main`);
  ok($("nav[aria-label]").length === 1, `${name}: nav にラベル`);
  $("img").each((_, el) => ok($(el).attr("alt") !== undefined, `${name}: img に alt`));
  $("select").each((_, el) => ok($(`label[for='${$(el).attr("id")}']`).length === 1, `${name}: select にラベル`));
}
ok(cheerio.load(read(join(OUT, "map.html")))("nav a[aria-current='page']").text() === "地図", "現在のページに aria-current");
// ---------- 10. 検索・速度・外部ライブラリ ----------
section("検索(noindex)・外部ライブラリ(SRI)・速度");
const robotsMeta = (p) => cheerio.load(read(join(OUT, p)))('meta[name="robots"]').attr("content");
ok(robotsMeta("events/t-past.html") === "noindex,follow", "終了したイベントは noindex");
ok(robotsMeta("events/t-full.html") === undefined, "開催前のイベントは index される");
ok(robotsMeta("404.html") === "noindex,follow", "404 は noindex");
ok(robotsMeta("pref/島根県.html") === undefined, "開催予定のある県ページは index される");
ok(!locs.some((u) => u.includes("t-past")), "終了したイベントはサイトマップに入れない");
ok(locs.some((u) => u.includes("t-full")), "開催前のイベントはサイトマップに入れる");
for (const f of ["map.html", "events/t-full.html"]) {
  const $ = cheerio.load(read(join(OUT, f)));
  const ext = $("script[src^='https://unpkg.com'], link[href^='https://unpkg.com']");
  ok(ext.length === 2, `${f}: 外部ライブラリは地図の2ファイルだけ`);
  ext.each((_, el) => ok(/^sha384-/.test($(el).attr("integrity") ?? "") && $(el).attr("crossorigin") === "anonymous", `${f}: SRI(改ざん検知)が付く`, $(el).attr("src") ?? $(el).attr("href")));
  ok(/@1\.9\.4\//.test($("script[src^='https://unpkg.com']").attr("src")), `${f}: バージョン固定`);
  ok($("script[src^='https://unpkg.com']").attr("defer") !== undefined, `${f}: 描画を止めない(defer)`);
}
for (const f of htmls) {
  const $ = cheerio.load(read(f));
  const fontLink = $("link[href*='fonts.googleapis.com/css2']").first();
  ok(fontLink.attr("media") === "print" && fontLink.attr("id") === "gf" && fontLink.attr("onload") === undefined && /getElementById\('gf'\)/.test(read(f)), `${rel(f)}: Webフォントが表示を止めない(インラインのイベント属性を使わない)`);
}
ok(read(join(OUT, "index.html")).includes('rel="icon"'), "ファビコンがある(404 を出さない)");

// ---------- 11. 収集処理(単体テスト) ----------
section("収集処理: 日付の読み取り・robots.txt・アダプタ");
const { parseJaDate, findPrefecture, robotsAllows } = await import("../scripts/lib/util.mjs");
const base = new Date("2026-10-09T00:00:00+09:00");
const eq = (a, b, n) => ok(JSON.stringify(a) === JSON.stringify(b), n, JSON.stringify(a));
eq(parseJaDate("2026年11月20日(金) 20:00", base), { start: "2026-11-20T20:00", end: null, hasTime: true }, "日付: 年月日+時刻");
eq(parseJaDate("２０２６年１１月２０日　１９：３０～２１：００", base), { start: "2026-11-20T19:30", end: "2026-11-20T21:00", hasTime: true }, "日付: 全角数字と時間範囲");
eq(parseJaDate("令和8年11月3日", base).start, "2026-11-03T00:00", "日付: 令和");
eq(parseJaDate("令和元年5月1日", base).start, "2019-05-01T00:00", "日付: 令和元年");
eq(parseJaDate("11月20日", base).start, "2026-11-20T00:00", "日付: 年なしは今年");
eq(parseJaDate("1月5日", base).start, "2027-01-05T00:00", "日付: 年なしで過去になる月は翌年");
eq(parseJaDate("2026.11.20 18:00", base).start, "2026-11-20T18:00", "日付: ドット区切り");
eq(parseJaDate("未定", base), null, "日付: 読めなければ null");
eq(parseJaDate("2026年13月40日", base), null, "日付: 範囲外は null");
eq(findPrefecture("島根県大田市"), "島根県", "都道府県: 正式名");
eq(findPrefecture("京都市内の神社"), "京都府", "都道府県: 略称から補完");
const robots = (txt) => async () => ({ ok: true, text: async () => txt });
const UA = "KaguraMeguriBot/1.0 (+https://example.com)";
eq((await robotsAllows("https://x.test/private/a", UA, robots("User-agent: *\nDisallow: /private/"))).ok, false, "robots: Disallow を守る");
eq((await robotsAllows("https://x.test/public/a", UA, robots("User-agent: *\nDisallow: /private/"))).ok, true, "robots: 無関係のパスは許可");
eq((await robotsAllows("https://x.test/private/open/a", UA, robots("User-agent: *\nDisallow: /private/\nAllow: /private/open/"))).ok, true, "robots: 長い一致の Allow が優先");
eq((await robotsAllows("https://x.test/a", UA, robots("User-agent: kagurameguribot\nDisallow: /\nUser-agent: *\nAllow: /"))).ok, false, "robots: 自分のUA指定が * より優先");
eq((await robotsAllows("https://x.test/a", UA, robots("User-agent: *\nDisallow: /"))).ok, false, "robots: 全面禁止を守る");
eq((await robotsAllows("https://x.test/a", UA, async () => { throw new Error("net"); })).ok, true, "robots: 取得できなければ許可(取得側で別途失敗する)");
const sel = await import("../scripts/adapters/selectors.mjs");
const got = sel.parse(read("tests/fixtures/list.html"), { url: "http://x.test/list.html", selectors: { item: ".ev li", name: "a", date: ".d", place: ".p", link: "a" } });
eq(got.map((x) => x.name), ["秋の大神楽", "冬至祭神楽", "過去の神楽"], "セレクタ: 日付が読めない行を捨てる");
eq([got[0].prefecture, got[0].city, got[0].venue], ["島根県", "大田市", "〇〇神社"], "セレクタ: 県/市/会場に分ける");
eq(got[0].url, "http://x.test/d/1", "セレクタ: 相対リンクを絶対URLにする");
const filtered = sel.parse(read("tests/fixtures/list.html"), { url: "http://x.test/", filter: "冬至", selectors: { item: ".ev li", name: "a", date: ".d", place: ".p" } });
eq(filtered.map((x) => x.name), ["冬至祭神楽"], "セレクタ: filter で絞れる");
const ld = await import("../scripts/adapters/jsonld.mjs");
const lj = ld.parse(read("tests/fixtures/jsonld.html"), { url: "http://x.test/" });
eq([lj.length, lj[0].name, lj[0].start, lj[0].prefecture], [1, "テスト神楽奉納", "2026-12-05T18:30", "広島県"], "JSON-LD: Event を読む");
const period = ld.parse('<script type="application/ld+json">{"@type":"Event","name":"期間","startDate":"2025-09-14","endDate":"2027-03-14"}</script>', { url: "http://x.test/" });
eq([period.length, period.skippedPeriod], [0, 1], "JSON-LD: 複数日をまとめた期間型は除外して件数を数える");
// ---------- 8. 0件・不正データ ----------
section("0件のサイト / 不正データ");
r = build("tests/fixtures/events.empty.json", "dist-test-empty", { REGULAR_FILE: "tests/fixtures/events.empty.json" });
ok(r.status === 0, "0件でもビルドできる", r.stderr);
const e0 = cheerio.load(read("dist-test-empty/index.html"));
ok(e0("#list").text().includes("現在掲載中の開催情報はありません"), "0件の一覧に案内が出る");
ok(e0("select#f").length === 0, "0件では都道府県セレクトを出さない");
ok(read("dist-test-empty/kagura/index.html").includes("まだありません"), "0件の神楽の種類ページに案内が出る");
r = build("tests/fixtures/events.invalid.json", "dist-test-invalid");
ok(r.status !== 0 && /データエラー/.test(r.stderr), "不正データではビルドを止める(公開されない)");
r = build("tests/fixtures/events.test.json", "dist-test-ads", { ADS_PLACEHOLDER: "1" });
ok(r.status === 0 && read("dist-test-ads/index.html").includes("広告枠"), "確認用に広告枠を出す切り替えができる");

for (const d of ["dist-test-empty", "dist-test-invalid", "dist-test-ads"]) rmSync(d, { recursive: true, force: true });

await extraTests({ ok, section, read, htmls, rel, OUT, build, hasFile, files, NOW });

console.log(`\n結果: ${pass} 件成功 / ${fail} 件失敗`);
if (fail) { console.log("\n失敗した項目:\n" + failures.map((x) => "  ✗ " + x).join("\n")); process.exit(1); }
console.log("すべて成功しました");
