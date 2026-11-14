import { reservationLabel } from '../scripts/lib/reservation.mjs';
// Revenue UX regression: keep editorial navigation helpful and sponsored links intact.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderedCheerio as cheerio } from "./rendered-vc.mjs";
import { runInNewContext } from "node:vm";
import { STAY_BANNERS } from "../scripts/lib/stay-banners.mjs";

const read = (p) => readFileSync(p, "utf8");

export function monetizationUxTests({ ok, section, OUT, build }) {
  section("収益化UX: スマホトップ・広島県の月別導線");
  const home = cheerio.load(read(join(OUT, "index.html")));
  const css = read("scripts/style.css");
  ok(home(".home-find").length === 0 &&
    home(".home-search-link").length === 0 && home(".discovery-prefs").length === 0,
    "検索入口の重複(「日付・場所で詳しく探す」・上部の都道府県リンク)を置かない");
  ok(home(".home-discovery").next().hasClass("home-hero") &&
    home(".home-discovery .quick").length === 1,
    "初訪問で探し始められるよう、日付・地域の検索入口をヒーローより前に出す");
  ok(home(".quick a[href='/calendar.html']").length === 1 && home("main h2").filter((_, h) => home(h).text() === "都道府県で探す").length === 1,
    "日付・場所の検索は上部の入口に、都道府県は下部の一覧に、1か所ずつ置く");
  ok(home(".quick a").length === 3 &&
    home(".quick a[href='/weekend.html']").length === 1 &&
    home(".quick a[href='/this-month.html']").length === 1,
    "今週末・今月・日付地域検索の3つの入口を表示する");
  ok(home(".home-hero .copy h1").text().includes("神話を受け継ぐ") &&
    home(".hero-art img").attr("src") === "/hero-pc.webp" &&
    home(".hero-art source").attr("srcset") === "/hero-sp.webp",
    "元の縦書き見出しとPC・スマホの絵をそのまま残す");
  ok(css.includes("main .home-hero{min-height:calc((100vw - 32px)*1.25 + 76px)}"),
    "スマホの元のヒーローサイズとレイアウトを保持する");
  ok(!css.includes(".home-find{") &&
    !css.includes("main .home-hero{min-height:clamp(") &&
    css.includes(".pref-month-nav") &&
    !css.includes(".home-search-link") && !css.includes(".discovery-prefs"),
    "置かなくなった検索入口(.home-find・.home-search-link・.discovery-prefs)の CSS を残さず、月別の配置(.pref-month-nav)は保つ");

  const h = cheerio.load(read(join(OUT, "pref/広島県.html")));
  ok(h("title").text().startsWith("広島神楽スケジュール") &&
    h("h1").text().trim() === "広島県の神楽" &&
    (h('meta[name="description"]').attr("content") || "").includes("公式情報をご確認ください"),
    "広島のスケジュールを示すmetadataと既存H1・公式情報への案内");
  const months = h(".pref-month");
  const nav = h(".pref-month-nav a[href^='#hiroshima-2']");
  ok(h(".pref-month-nav .meta").length === 1 &&
    h(".pref-month-nav a").toArray().every((x) => h(x).hasClass("tag")),
    "広島の目次を従来のtagとmeta書式で表示する");
  ok(months.length > 0 && months.length === nav.length,
    "開催月の目次リンク数と月別セクション数が一致する");
  const hrefs = nav.map((_, a) => h(a).attr("href").slice(1)).get();
  const ids = months.map((_, s) => h(s).find("h2").first().attr("id")).get();
  ok(hrefs.join() === ids.join() && new Set(ids).size === ids.length,
    "各月のリンク先が存在し、重複しない");
  ok(months.toArray().every((node) => {
    const section = h(node);
    const id = section.find("h2").attr("id");
    const count = section.find(".card").length;
    const linkText = h(".pref-month-nav a[href='#" + id + "']").text();
    return count > 0 && linkText.includes(count + "件");
  }), "各月の表示件数と、実際の公演カード数が一致する");
  ok(months.toArray().every((node) => {
    const section = h(node);
    const key = section.find("h2").attr("id").replace("hiroshima-", "");
    const reciprocal = section.find(`a[href='/month/${key}.html']`);
    return section.find("h2").text().endsWith("の開催予定") && reciprocal.length === 1 &&
      reciprocal.text() === section.find("h2").text().replace("の開催予定", "の全国日程を見る");
  }), "広島の各開催予定から同じ月の全国日程へ移動できる");
  const november = cheerio.load(read(join(OUT, "month/2026-11.html")));
  ok(november(`.month-regions a.chip[href='/pref/${encodeURIComponent("広島県")}.html']`).length === 1 &&
    h(".pref-month a[href='/month/2026-11.html']").length === 1,
    "2026年11月は月別ページと広島県ページを相互に案内する");
  ok(h(".pref-month h2").toArray().every((node) => h(node).text().includes("開催予定")) &&
    h(".pref-month h2").toArray().every((node) => !h(node).text().includes("終了")),
    "県ページの月別区分は終了済みを混ぜず、開催予定と明記する");
  ok(h(".pref-month .card").length > 0 &&
    h(".pref-month .card").length === h(".pref-month .card a").closest(".card").length,
    "公演カードへのリンクと月別一覧を保持する");
  ok(h(".pref-month .event-facts").length === h(".pref-month .card").length &&
    h(".event-facts").toArray().every((node) => {
      const rows = h(node).children("div").map((_, row) => h(row).text()).get();
      return rows.length >= 1 && rows.length <= 3 && rows[0].startsWith("会場:") && rows.every((r) => /^(会場|料金|予約要否):/.test(r)) &&
        !rows.join("").includes("要確認") && !/出典|確認日|取得日/.test(rows.join(""));
    }), "一覧カードは会場を必ず出し、料金・予約要否は分かっているときだけ出す(出典・確認日は開催ページで)");
  ok(h(".event-facts a").toArray().every((node) =>
    /^https?:\/\//.test(h(node).attr("href")) && h(node).attr("rel").includes("noopener")),
    "出典には安全な外部リンクを使用する");
  ok(css.includes(".event-facts a{position:relative;z-index:1}"),
    "出典リンクがカード全体の詳細リンクに遮られない");
  ok(h(".pref-month-nav a[href='#hiroshima-stay']").length === 0 &&
    h("#hiroshima-stay .aff").length === 0,
    "広告設定がない場合は宿探しの目次と枠を表示しない");

  const other = cheerio.load(read(join(OUT, "pref/宮崎県.html")));
  ok(other(".pref-month-nav,.pref-month").length === 0 && other(".event-facts").length === other(".card").length &&
    other("h2").filter((_, n) => other(n).text() === "開催予定").length === 1,
    "広島以外も同じ公演比較情報を表示し、独自の月別目次は追加しない");
  ok(home(".event-facts").length === home(".card").length, "トップの開催・定期公演も会場・料金・予約を比較できる");
  for (const path of ['month/2026-11.html','weekend.html','this-month.html','kagura/石見神楽.html']) {
    const page = cheerio.load(read(join(OUT,path)));
    ok(page('.event-facts').length === page('.card').length, `${path}: 公演比較情報が各カードに1回表示される`);
  }

  section("広島県: 日程から既存の観覧準備情報へ案内");
  const guide = cheerio.load(read(join(OUT, "guide.html")));
  const preparation = h(".viewing-preparation");
  ok(preparation.length === 1 && preparation.attr("aria-label") === "観覧前の準備" &&
    preparation.find("a").length === 2,
    "広島県一覧の公演情報付近に観覧準備の案内を1か所置く");
  ok(preparation.find("a").toArray().every((node) => {
    const href = h(node).attr("href");
    return href.startsWith("/guide.html#") && guide(`[id='${href.split("#")[1]}']`).length === 1;
  }), "案内先は既存ガイドの実在する章で、リンク切れがない");
  ok(other(".viewing-preparation").length === 0 && home(".viewing-preparation").length === 0,
    "他県一覧とトップには観覧準備リンクを追加しない");
  // 公演のページには、観覧前に確認・ガイドへの案内を置かない(2026-10-30 運営者の判断。広島県の一覧の案内は残す)
  const mapped = cheerio.load(read(join(OUT, "events/t-timeunknown.html")));
  ok(mapped(".viewing-preparation").length === 0 && mapped("a[href='#venue-access'],#venue-access").length === 0 &&
    mapped(".keyinfo a.tomap[href*='google.com/maps']").length === 1,
    "広島の公演詳細では、地図・経路は要点の会場の欄から(観覧前に確認は置かない)");
  ok(mapped("main a[href^='/guide.html']").length === 0,
    "広島の公演詳細に、ガイドへの案内を置かない");
  const noMap = cheerio.load(read(join(OUT, "events/t-minimal.html")));
  ok(noMap(".viewing-preparation").length === 0 && noMap("a[href='#venue-access'],#venue-access,.keyinfo a.tomap").length === 0,
    "地図データがない公演には空の地図リンクを出さない");
  const outside = cheerio.load(read(join(OUT, "events/t-full.html")));
  ok(outside(".viewing-preparation,#venue-access").length === 0 &&
    outside("main a[href^='/guide.html']").length === 0,
    "広島以外の公演詳細も、ガイドへの案内を置かず、地図配置を維持する");

  // ビルドと同じ関数を単独で検証。公演データや外部サイトには書き込まない。
  const source = read("scripts/build.mjs");
  const declarations = ["HTTP_URL", "esc", "jpDate"].map((name) =>
    source.split("\n").find((line) => line.startsWith(`const ${name} =`))).join("\n");
  const factsCode = source.slice(source.indexOf("const cardFacts ="), source.indexOf('const card ='));
  const facts = (event) => runInNewContext(`${declarations}\n${factsCode}\ncardFacts(event)`, { event, reservationLabel });
  const missing = cheerio.load(facts({}));
  ok(missing(".event-facts").text() === "会場:未確認" && !/無料|不要|確認日/.test(missing(".event-facts").text()),
    "未登録を無料・予約不要・確認済みに置き換えず、分からない料金・予約は出さない");
  const automatic = cheerio.load(facts({ auto: true, lastSeen: "2026-10-19", source: "取得元", sourceUrl: "https://example.org/source", url: "https://example.org/event" }));
  ok(!/取得日|出典|未登録/.test(automatic(".event-facts").text()) && automatic("a").length === 0,
    "一覧カードには出典・取得日を出さない(開催ページの出典で見せる)");
  const known = cheerio.load(facts({ venue: "<会場>", fee: "無料（条件あり）", reservation: "事前予約制", checked: "2026-10-10", source: "観光情報誌", sourceUrl: "javascript:alert(1)", url: "https://example.org/event" }));
  ok(known(".event-facts").text().includes("会場:<会場>") && known("会場").length === 0 &&
    known(".event-facts").text().includes("料金:無料（条件あり）") &&
    known(".event-facts").text().includes("予約要否:事前予約制") &&
    known("a").length === 0 &&
    !known(".event-facts").text().includes("公式"),
    "登録値をエスケープし、分かっている会場・料金・予約要否を出す");

  const built = build("tests/fixtures/events.test.json", "dist-test-revenue-ux", {
    TEST_AFF_TRAVEL: "1", TEST_GA: "G-TEST123456", TEST_CB: "test-consent-id"
  });
  ok(built.status === 0, "実際のアフィリエイト設定を模したビルドが成功", built.stderr);
  if (built.status === 0) {
    const a = cheerio.load(read("dist-test-revenue-ux/pref/広島県.html"));
    const links = a("#hiroshima-stay .stay-banner");
    ok(a(".pref-month-nav a[href='#hiroshima-stay']").length === 1 &&
       a("#hiroshima-stay").length === 1,
       "広告を設定すると月の目次から宿探しへ移動できる");
    ok(links.length === 2 &&
       links.toArray().every((x) => { const link=a(x).is("a")?a(x):a(x).find("a"); return link.length===1 && link.attr("rel")?.includes("sponsored") && link.attr("rel")?.includes("noopener") && (!a(x).is("[data-vc-ad]") || link.attr("rel")?.includes("nofollow")); }),
       "じゃらん・楽天トラベルの広告リンクとPR属性を維持する");
    ok(links.map((_, x) => a(x).attr("data-goatcounter-click")).get().sort().join() ===
       "banner-jalan/広島県,banner-rakuten/広島県",
       "GoatCounterの既存クリックラベルは維持する");
    ok(a("#hiroshima-stay .pr").length === 1 &&
       a('script[data-require-statistics-consent]').length === 1,
       "広告のPR表記とGA4の同意制御を維持する");
  }

  section("宿の画像バナー(楽天トラベル・じゃらんnet)");
  const bn = STAY_BANNERS;
  if (built.status === 0) {
    const ev = cheerio.load(read("dist-test-revenue-ux/events/t-full.html"));
    const links = ev(".d-side .stay .stay-banner");
    ok(links.length === 2 && ev(".d-side .stay h2").length === 1 && ev(".d-side .stay .stay-banners").length === 1 && ev(".d-side .staylinks").length === 0, "開催ページ: サイドの宿カードは、楽天トラベル・じゃらんの公式バナー(画像)にする(2026-11-14 運営者の依頼)");
    const rk = links.filter("a").attr("href"), jl = links.filter("[data-vc-ad]").find("a").attr("href") ?? "";
    ok(rk === bn.rakuten.url && jl.includes("//ck.jp.ap.valuecommerce.com/servlet/referral?"), "楽天トラベルは発行済みバナー、じゃらんはバリューコマースの公式タグ");
    ok(/sponsored/.test(links.filter("a").attr("rel")) && /noopener/.test(links.filter("a").attr("rel")) && links.filter("a").attr("target") === "_blank" && links.filter("a").find("img").attr("alt") === "楽天トラベルの宿泊予約", "広告リンクの属性(sponsored・noopener)と、画像の説明(alt)がある");
    ok(links.map((_, x) => ev(x).attr("data-goatcounter-click")).get().join() === "banner-rakuten/t-full,banner-jalan/t-full", "GoatCounterのクリック名は banner-◯◯/開催ID");
    const csp = cheerio.load(read("dist-test-revenue-ux/weekend.html"))('meta[http-equiv="Content-Security-Policy"]').attr("content");
    const imageSources=csp.split(";").find(d=>d.trim().startsWith("img-src ")).trim().split(/\s+/).slice(1);
    ok(imageSources.includes("https:") && /img-src[^;]*hbb.afl.rakuten.co.jp/.test(csp) && /img-src[^;]*ba.afl.rakuten.co.jp/.test(csp), "CSP: バナーのあるページだけ、画像の配信元(楽天の転送先を含む)を許可する");
    ok(ev("script[src*='valuecommerce']").length===0 && !ev("noscript").toArray().some(x=>/valuecommerce/.test(ev.html(x))) && ev(".stay-banner[data-vc-ad] img[src*='gifbanner'][border='0']").length===1, "公式非JSタグ(バナーの画像)を保持し、外部JSタグは導入しない");
    const wk = cheerio.load(read("dist-test-revenue-ux/weekend.html")), tm = cheerio.load(read("dist-test-revenue-ux/this-month.html"));
    ok(wk(".d-side .trip-band .stay-banner").length === 2 && wk(".trip-band .pr").length >= 1 && wk(".d-top .card").length > 0 && wk(".d-side").prev().hasClass("d-top"), "今週末: 宿のバナー(PR表示つき)は右の列(スマホでは一覧の後)");
    ok(tm(".trip-band .stay-banner").map((_, x) => tm(x).attr("data-goatcounter-click")).get().join() === "banner-rakuten/this-month,banner-jalan/this-month", "今月: 宿のバナーのクリックは、ページ名で数える");
    const pf = cheerio.load(read("dist-test-revenue-ux/pref/広島県.html"));
    ok(pf("#hiroshima-stay .stay-banner").length === 2, "県のページの宿の帯にも、バナーを出す");
  }
  const off = cheerio.load(read(join(OUT, "events/t-full.html")));
  ok(off(".stay-banner").length === 0, "提携IDが未設定なら、バナーを出さない");
  ok(off(".d-side .side-box a.search-link").length===0 && off(".d-side .side-box").length===0,"未発行の本/返礼品は通常検索枠を省略");

  section("開催ページ: 見やすさ(開催までの日数・右の列の要点・共有の位置)");
  ok(/^開催まで あと\d+日$|^(本日|明日)開催$/.test(off(".hero .until").text()), "見出しの下に、開催までの日数を出す", off(".hero .until").text());
  const ss = off(".d-side .side-summary");
  ok(ss.length === 1 && ss.find("a[data-official-side]").attr("href") === off("[data-official-link]").attr("href") && off("[data-official-link]").length === 1, "右の列に、日時・会場と公式情報のボタン(計測は別の印)を置く");
  { const h = off("main").html(); ok(off(".d-rest .share").length === 1 && h.indexOf('class="share"') > h.indexOf("desc-lead"), "共有のボタンは、説明などの本文の後に置く"); }
  ok(off(".d-top .share").length === 0 && off(".desc-lead").length === 1, "要点の直後は、説明文(共有ボタンは置かない)");
  const ended = cheerio.load(read(join(OUT, "events/t-past.html")));
  ok(ended(".until,.side-summary").length === 0, "終了した開催には、日数と右の列を出さない");
}
