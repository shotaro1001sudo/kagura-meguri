// ページ間のそろい方のテスト(総点検で決めた決まり)
//  - 日付のある開催の一覧の見出しは「開催予定」
//  - 開催ページ・定期公演ページの並び: 地図・経路 → 出典 → 宿の案内 → あわせて観たい神楽 → 広告
//  - 件数の要約(「開催予定 3件 ・ 定期公演 1件」。0件は出さない)
//  - 見出しの階層(トップの月の見出しの下の開催名は h4)
//  - 押しやすさ・折り返し(フッター・同意のチェックボックス)、使われなくなった CSS がない
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";

const read = (p) => readFileSync(p, "utf8");

export function consistencyTests({ ok, section, OUT }) {
  const page = (p) => cheerio.load(read(join(OUT, p)));
  const h2s = ($) => $("main h2:not(.sr)").map((_, h) => $(h).text().trim()).get();

  section("そろい方: 一覧の見出し・件数の要約");
  const home = page("index.html"), wk = page("weekend.html"), kg = page("kagura/石見神楽.html"), pf = page("pref/島根県.html");
  ok(h2s(home)[0] === "開催予定" && /^開催予定(\(\d+件\))?$/.test(h2s(wk)[0]) && h2s(kg).includes("開催予定") && h2s(pf).includes("開催予定"), "日付のある開催の一覧の見出しは「開催予定」(トップ・今週末・種類・県)", [h2s(home)[0], h2s(wk)[0]].join(" / "));
  const all = ["index.html", "weekend.html", "this-month.html", "kagura/石見神楽.html", "pref/島根県.html", "pref/広島県.html"].flatMap((p) => h2s(page(p)));
  ok(!all.some((t) => /^(これからの開催|これからの神楽|開催・公演)/.test(t)), "古い見出し(これからの開催・これからの神楽・開催・公演)が残っていない", all.join(","));
  const kIndex = page("kagura/index.html")(".card .meta").first().text();
  ok(/^(開催予定 \d+件)?( ・ )?(定期公演 \d+件)?$/.test(kIndex) && !/ 0件| 件/.test(page("kagura/index.html")("main").text()), "種類の一覧の件数: 「開催予定 1件 ・ 定期公演 1件」の形。0件は出さない", kIndex);
  const lead = kg(".hero p").text();
  ok(/^(開催予定 \d+件|定期公演 \d+件|開催予定 \d+件 ・ 定期公演 \d+件|開催予定はありません)$/.test(lead) && lead !== "開催予定の公演", "種類・県のページの見出しの下は、件数に合わせた文", lead);
  ok(/^(開催予定|定期公演)/.test(pf(".hero p").text()), "県のページの見出しの下も、件数の文", pf(".hero p").text());

  section("そろい方: 開催ページ・定期公演ページの並び");
  // 並びの目印: 地図・経路のボタン・ガイドへの案内(出典の文のすぐ下。出典のないデータもあるため)・宿の案内・あわせて観たい神楽
  const orderOf = (p) => {
    const h = read(join(OUT, p));
    const at = (re) => { const m = h.search(re); return m < 0 ? null : m; };
    return { map: at(/id="map"/), route: at(/class="routebtn"/), source: at(/見どころ・マナー・服装のガイド/), stay: at(/class="(aff )?stay|class="aff"|class="afflist/), related: at(/<h2>あわせて観たい神楽<\/h2>/) };
  };
  const ev = JSON.parse(read("tests/fixtures/events.test.json")).find((e) => e.status === "published" && e.lat != null && e.start >= "2026-10-10");
  const o = orderOf(`events/${ev.id}.html`);
  ok(o.map != null && o.map < o.route && o.route < o.source && (o.stay == null || o.source < o.stay) && (o.related == null || (o.stay ?? o.source) < o.related), "開催ページ: 地図 → 経路 → 出典・ガイドの案内 → 宿の案内 → あわせて観たい神楽 の順", JSON.stringify(o));
  const r = orderOf("regular/r-weekly.html");
  ok(r.map != null && r.map < r.route && r.route < r.source && (r.stay == null || r.source < r.stay) && r.related != null && (r.stay ?? r.source) < r.related, "定期公演ページも同じ順で、「あわせて観たい神楽」がある", JSON.stringify(r));

  section("そろい方: 見出しの階層・押しやすさ・古い CSS");
  ok(home(".mgroup .card h4").length > 0 && home(".mgroup .card h3").length === 0 && page("month/2026-11.html")(".card h3").length > 0, "トップの月の見出し(h3)の下の開催名は h4。ほかのページの一覧は h3 のまま");
  const css = home("style").first().html();
  ok(/footer a\{[^}]*white-space:nowrap/.test(css) && /footer a\{[^}]*display:inline-block/.test(css), "フッターのリンクは、語の途中で折り返さない");
  ok(/\.consent input\{[^}]*width:20px;height:20px/.test(css), "同意のチェックボックスは、押しやすい大きさ(20px)");
  ok(!/\.datenav|\.filters\{/.test(css) && !/\.card h3\b/.test(css.replace(/:is\(h3,h4\)/g, "")), "使われなくなった CSS(.datenav・.filters)が残っていない");
  ok(/@media\(max-width:560px\)\{\.home-hero:before\{inset:-40px 0 auto\}/.test(css), "スマホでは、トップの背景の光を画面の幅に収める");
  ok(page("404.html")('main a[href="/"]').text() === "開催予定を見る", "404 のボタンは、メニューの名前(開催予定)にそろえる");
  const disc = page("disclaimer.html")("main").text();
  ok(disc.includes("自動で作る一覧・検索・フィード") && disc.includes("日付・場所での検索") && !disc.includes("月別のページ、カレンダー、"), "免責事項: 自動で作るものの名前が、今の機能(日付・場所での検索)に合っている");
  const motionDoc = read("MOTION.md");
  ok(!/REVEAL_SEL|スクロールで現れる|2px浮く/.test(motionDoc) && /ページの出現/.test(motionDoc), "MOTION.md が、今の動き(ページ単位の出現)に合っている");
}
