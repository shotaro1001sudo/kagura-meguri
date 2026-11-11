// ページ間のそろい方のテスト(総点検で決めた決まり)
//  - 日付のある開催の一覧の見出しは「開催予定」
//  - 開催ページ・定期公演ページの並び: 地図・経路 → 出典 → 宿の案内 → あわせて観たい神楽 → 広告
//  - 件数の要約(「開催予定 3件 ・ 定期公演 1件」。0件は出さない)
//  - 見出しの階層(トップの月の見出しの下の開催名は h4)
//  - 押しやすさ・折り返し(フッター・同意のチェックボックス)、使われなくなった CSS がない
//  - 面・チップ・角の丸みの基準、文の折り返し、パンくず、くり返さない注意書き、月の区切り(2026-11-12 の全体の整理)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";

const read = (p) => readFileSync(p, "utf8");

export function consistencyTests({ ok, section, OUT, build }) {
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
  // 並びの目印: 会場の欄の地図への案内(要点の表)・宿の案内・本文の列(d-rest)・あわせて観たい神楽
  const orderOf = (p) => {
    const h = read(join(OUT, p));
    const at = (re) => { const m = h.search(re); return m < 0 ? null : m; };
    return { map: at(/class="tomap"/), source: at(/class="d-rest"/), stay: at(/class="(aff )?stay|class="aff"|class="afflist/), related: at(/<h2>あわせて観たい神楽<\/h2>/) };
  };
  const ev = JSON.parse(read("tests/fixtures/events.test.json")).find((e) => e.status === "published" && e.lat != null && e.start >= "2026-10-10");
  const o = orderOf(`events/${ev.id}.html`);
  ok(o.map != null && o.map < o.source && (o.stay == null || (o.map < o.stay && o.stay < o.source)) && (o.related == null || o.source < o.related), "開催ページ: 要点(会場の欄の地図・経路) → 宿の案内(右のカード) → 出典・ガイドの案内 → あわせて観たい神楽 の順", JSON.stringify(o));
  const r = orderOf("regular/r-weekly.html");
  ok(r.map != null && r.map < r.source && (r.stay == null || (r.map < r.stay && r.stay < r.source)) && r.related != null && r.source < r.related, "定期公演ページも、要点のあとに宿の案内、「あわせて観たい神楽」が最後にある", JSON.stringify(r));

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
  section("そろい方: 面・チップ・角の丸みの基準(全ページ共通)");
  const src = read("scripts/style.css").replace(/\r\n/g, "\n");
  const list = (s) => s.split(/,\s*/).map((x) => x.trim());
  const tokens = (src.match(/:root\{(--radius:[^}]*)\}/) ?? [])[1] ?? "";
  ok(["--radius:14px", "--radius-s:10px", "--pill:999px", "--edge:", "--shadow:", "--tap:44px"].every((t) => tokens.includes(t)) && (src.match(/--radius:/g) ?? []).length === 1, "形の基準(角の丸み・面の枠と影・押せる高さ)は、style.css の先頭の1か所で決める", tokens);
  const panel = (src.match(/:where\(([^{]*)\)\{border:1px solid var\(--edge\);border-radius:var\(--radius\);background:var\(--card\);box-shadow:var\(--shadow\)\}/) ?? [])[1] ?? "";
  ok([".card", ".keyinfo", ".stay", ".aff", ".quick a", ".finder", ".form fieldset", ".gcard", ".fig", ".era", ".faq details"].every((s) => list(panel).includes(s)), "面(カード・要点の枠・宿の案内・検索の枠・フォーム・ガイドのカードなど)の枠・角・影・地色は、1つの決まりにまとめる", panel);
  const radii = [...src.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(?<![-\w])border-radius:([^;}]+)/g)].map((m) => m[1].trim());
  const odd = [...new Set(radii.filter((v) => !/^(var\(--(radius|radius-s|pill)\)|50%|0|2px|4px|8px)$/.test(v)))];
  ok(odd.length === 0, "角の丸みは基準の値(面・小さな角・丸)を使う(小さな印の 2px・4px、広告や商品の画像の 8px だけ別)", odd.join(" / "));
  const chip = (src.match(/:is\(([^{]*)\)\{display:inline-flex;align-items:center;min-height:var\(--tap\)/) ?? [])[1] ?? "";
  ok([".chip", ".taglist .tag", ".pref-month-nav .tag", ".kagura-jumps a", ".regions button"].every((s) => list(chip).includes(s)), "チップ(月・種類・県・ページ内の行き先・絞り込み)は、どのページでも同じ形・高さ 44px", chip);
  ok(/a\.tag,[^{]*\.info \.tomap,\.info \.tocal[^{]*\)::after\{content:"";position:absolute;[^}]*height:var\(--tap\)/.test(src), "小さな札・地図やカレンダーへのリンクは、見た目は小さいまま、押せる範囲を 44px に広げる");
  const phrase = (src.match(/:is\(([^{]*)\)\{word-break:auto-phrase\}/) ?? [])[1] ?? "";
  ok(["h1", "h3", "button", ".btn", ".event-facts", ".info .vn", ".monthlist a"].every((s) => list(phrase).includes(s)) && !list(phrase).some((s) => ["td", "dd", "li", "small", ".meta", "a", "figcaption"].includes(s)), "文節で折り返すのは、見出し・公演名・会場名・ボタン・短いラベルだけ(本文・一覧の長い値・箇条書きは字単位で詰め、スマホで行数を増やさない)", phrase);
  ok(/\.crumbs ol\{[^}]*flex-wrap:nowrap/.test(src) && /\.crumbs li\[aria-current\]\{[^}]*text-overflow:ellipsis/.test(src) && page("pref/島根県.html")(".crumbs li[aria-current]").length === 1, "パンくずは1行に収め、長い題は末尾を省く(今のページの項目に aria-current)");
  ok(/\.f-row>\.f\{[^}]*margin:0/.test(src) && /\.form legend\{[^}]*margin:0 0 14px/.test(src) && /\.fpanel\{display:grid;gap:18px\}/.test(src), "フォーム・検索の欄の間隔をそろえる(2列の欄だけ倍にならない。見出しと最初の欄・「いつ」と「どこ」がくっつかない)");
  ok(/@media\(max-width:560px\)\{[^@]*\.chiprow\{flex-wrap:nowrap;overflow-x:auto/.test(src) && page("pref/広島県.html")(".pref-month-nav.chiprow").length === 1, "チップの行(.chiprow)は、スマホでは1行にして横に送る");
  ok(page("kagura/石見神楽.html")(".card .tag").length === 0 && page("pref/島根県.html")(".card .tag").length > 0 && page("index.html")(".card .tag").length > 0, "種類のページのカードでは、そのページの種類の札をくり返さない(県・トップでは出す)");

  section("そろい方: くり返さない注意書き・月の区切り・今週末の地域");
  const RD = "dist-test-readability";
  const rb = build("tests/fixtures/events.readability.json", RD);
  ok(rb.status === 0, "読みやすさの確認用データでビルドできる", rb.stderr);
  if (rb.status === 0) {
    const rd = (p) => cheerio.load(read(join(RD, p)));
    const oct = rd("events/rd-oct.html"), nov = rd("events/rd-nov.html"), nov2 = rd("events/rd-nov2.html");
    ok(oct(".keyinfo .unknown-note").length === 1 && !oct(".desc-lead").text().includes("ご確認ください") && oct(".desc-lead").text().includes("観覧は無料です。") && oct('meta[name="description"]').attr("content").length > 0, "要点の表の下に確認のお願いを出すページでは、説明文の末尾の同じお願いをくり返さない(説明のほかの文は残す)", oct(".desc-lead").text());
    ok(nov(".keyinfo .unknown-note").length === 0 && nov(".desc-lead").text().endsWith("出発前に公式情報をご確認ください。"), "未確認の欄がないページでは、説明文のお願いをそのまま出す(確認のお願いが1つもないページにしない)", nov(".desc-lead").text());
    ok(nov2(".desc-lead").text() === "演目は変更される場合があるため、出かける前に公式案内をご確認ください。", "その公演の事情を書いた文(演目の変更など)は、途中で切らずに残す", nov2(".desc-lead").text());
    const pf = rd("pref/島根県.html"), kg = rd("kagura/石見神楽.html");
    const heads = (q) => q("main .mhead").map((_, x) => q(x).text()).get().join();
    ok(heads(pf) === "10月,11月" && heads(kg) === "10月,11月" && pf("main p.mhead + .card").length === 2 && pf("main .card h3").length >= 3 && pf("main .card h4").length === 0, "県・種類のページの一覧は、月が変わるところに月の区切りを入れる(カードの見出しの段は h3 のまま)", heads(pf) + " / " + heads(kg));
    ok(rd("kagura/出雲神楽.html")("main .mhead").length === 0, "1か月だけの一覧には、月の区切りを入れない");
    const wk = rd("weekend.html");
    ok(wk(".weekend-regions.chiprow a.chip").length === wk(".weekend-regions a").length && wk(".weekend-regions a").length >= 1 && wk(".weekend-regions .meta").text() === "各県の全日程を見る", "今週末: 開催のある県は、チップの行で出す(行き先が各県の全日程であることを書く)");
    const hint = rd("submit.html")("#url-h").text();
    ok(hint.includes("公開投稿も受け付けます") && hint.includes("投稿そのもののURL") && hint.includes("https:// で始まるもの") && !hint.includes("内容と投稿元を確認してから掲載します"), "掲載の依頼: URL の欄の説明は、受け付けるもの・SNS の条件・https の3点(確認してから載せることは、ページの冒頭に1回)", hint);
  }
  const design = read("DESIGN.md");
  ok(/--radius/.test(design) && /--tap/.test(design) && !/影・角丸の大きな箱・グラデーションのボタンは使わない|1画面に1つまで|重い画像を足さない/.test(design) && /改善を止めるための決まりではありません/.test(design), "DESIGN.md が、今の見た目(面・チップ・基準の値)に合っている。今の形や運営の判断と合わない古い決まりを残さない");
  const motionDoc = read("MOTION.md");
  ok(!/REVEAL_SEL|スクロールで現れる|2px浮く/.test(motionDoc) && /ページの出現/.test(motionDoc), "MOTION.md が、今の動き(ページ単位の出現)に合っている");
}
