// 英語の入口ページ(/en/)のテスト: 言語の指定・日本語ページとの相互の対応(hreflang)・リンク先・翻訳されたくない語の保護
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { KAGURA_EN, PREF_EN } from "../scripts/lib/english.mjs";

const read = (p) => readFileSync(p, "utf8");
const toFile = (OUT, path) => join(OUT, path.endsWith("/") ? path + "index.html" : path);

export function englishTests({ ok, section, OUT }) {
  section("英語の入口ページ(/en/)");
  const PAIRS = [["/en/", "/"], ["/en/guide.html", "/guide.html"], ["/en/kagura.html", "/kagura/"], ["/en/history.html", "/history/"]];
  const load = (path) => cheerio.load(read(toFile(OUT, path)));
  ok(PAIRS.every(([en]) => existsSync(toFile(OUT, en))), "英語のページが4つある(トップ・ガイド・神楽の種類・歴史)");
  const base = "https://kagurameguri.jp";
  for (const [en, jp] of PAIRS) {
    const E = load(en), J = load(jp);
    const alt = ($) => Object.fromEntries($('link[rel="alternate"][hreflang]').get().map((l) => [$(l).attr("hreflang"), $(l).attr("href")]));
    const ea = alt(E), ja = alt(J);
    ok(E("html").attr("lang") === "en" && J("html").attr("lang") === "ja", `${en}: 英語ページは lang=en、対応する日本語ページは lang=ja`);
    ok(ea.en === base + en && ea.ja === base + jp && ea["x-default"] === base + en, `${en}: hreflang(en・ja・x-default)が、日本語ページと対応している`, JSON.stringify(ea));
    ok(ja.en === base + en && ja.ja === base + jp && ja["x-default"] === base + en, `${jp}: 日本語ページからも、英語ページへ hreflang が張られている(相互)`, JSON.stringify(ja));
    ok(E('link[rel="canonical"]').attr("href") === base + en && E('meta[property="og:locale"]').attr("content") === "en_US", `${en}: 正規URLと og:locale(en_US)`);
    ok(/^[\x20-\x7E]+$/.test(E("title").text()) && E("h1").length === 1 && /^[\x20-\x7E]+$/.test(E("h1").text()), `${en}: タイトルと見出しは、英語(ASCII)`);
    ok(E("header .top nav, header nav").text().includes("日本語") && E("header nav a[href='/']").length === 1, `${en}: メニューから日本語版へ戻れる`);
    ok(E("main a").get().every((a) => { const h = E(a).attr("href"); if (!h || /^(https?:|#|mailto:)/.test(h)) return true; const f = toFile(OUT, decodeURIComponent(h.split("#")[0] || "/")); return existsSync(f); }), `${en}: ページ内のリンク先が、すべて実在する`);
  }
  const home = load("/index.html");
  ok(home('footer a[href="/en/"][hreflang="en"]').length === 1, "日本語ページのフッターから、英語版へ行ける");
  const idx = load("/en/");
  const rows = idx("table").first().find("tbody tr");
  ok(rows.length >= 3 && rows.get().every((r) => idx(r).find("a[lang='ja'][translate='no'][hreflang='ja']").length === 1), "英語トップの開催の表: 日本語のイベント名は、lang=ja・translate=no で、翻訳で崩さず、日本語ページへつなぐ", `${rows.length}件`);
  ok(rows.get().every((r) => /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/.test(idx(r).find("th").text().trim())) && rows.get().every((r) => Object.values(PREF_EN).some((p) => idx(r).find("td").last().text().startsWith(p))), "開催の表: 日付は英語の書式、場所は英語の都道府県名から始まる");
  const kag = load("/en/kagura.html");
  ok(kag("section.gcard").length === KAGURA_EN.length && kag("section.gcard h3 small[lang='ja'][translate='no']").length === KAGURA_EN.length, "神楽の種類のページ: すべての種類に、英語名と、翻訳しない日本語名がある", `${kag("section.gcard").length}件`);
  for (const p of ["/en/guide.html", "/en/kagura.html", "/en/history.html", "/en/"]) {
    const $ = load(p);
    ok($("sup.cite a").get().every((a) => $($(a).attr("href")).is("ol.sources > li")), `${p}: 出典の番号が、すべて出典の一覧につながる`);
  }
}
