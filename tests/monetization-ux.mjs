// Revenue UX regression: keep editorial navigation helpful and sponsored links intact.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { runInNewContext } from "node:vm";

const read = (p) => readFileSync(p, "utf8");

export function monetizationUxTests({ ok, section, OUT, build }) {
  section("収益化UX: スマホトップ・広島県の月別導線");
  const home = cheerio.load(read(join(OUT, "index.html")));
  const css = read("scripts/style.css");
  ok(home(".home-find").length === 0 &&
    home(".home-search-link a.tag[href='/calendar.html']").length === 1,
    "新しい広告風カードを追加せず、元のリンク書式で日付・地域検索へ案内する");
  ok(home(".home-hero").next().hasClass("quick") &&
    home(".quick").next().hasClass("home-search-link"),
    "元の見た目のまま、ヒーロー→今週末・今月→詳細検索の順に並べる");
  ok(home(".quick a").length === 2 &&
    home(".quick a[href='/weekend.html']").length === 1 &&
    home(".quick a[href='/this-month.html']").length === 1,
    "既存の今週末・今月への入口を維持する");
  ok(home(".home-hero .copy h1").text().includes("神話を受け継ぐ") &&
    home(".hero-art img").attr("src") === "/hero-pc.webp" &&
    home(".hero-art source").attr("srcset") === "/hero-sp.webp",
    "元の縦書き見出しとPC・スマホの絵をそのまま残す");
  ok(css.includes("main .home-hero{min-height:calc((100vw - 32px)*1.25 + 76px)}"),
    "スマホの元のヒーローサイズとレイアウトを保持する");
  ok(!css.includes(".home-find{") &&
    !css.includes("main .home-hero{min-height:clamp(") &&
    css.includes(".pref-month-nav") &&
    css.includes(".home-search-link"),
    "追加した新デザインの背景・ボタンを除き、余白と月別の配置だけを調整する");

  const h = cheerio.load(read(join(OUT, "pref/広島県.html")));
  ok(h("title").text().startsWith("広島県の神楽 日程【") &&
    h("h1").text().trim() === "広島県の神楽" &&
    (h('meta[name="description"]').attr("content") || "").includes("公式情報をもとに"),
    "広島の元のタイトル・H1・説明文を維持する");
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
  ok(h(".pref-month .card").length > 0 &&
    h(".pref-month .card").length === h(".pref-month .card a").closest(".card").length,
    "公演カードへのリンクと月別一覧を保持する");
  ok(h(".pref-month .event-facts").length === h(".pref-month .card").length &&
    h(".event-facts").toArray().every((node) => {
      const rows = h(node).children("div").map((_, row) => h(row).text()).get();
      return rows.length === 5 && rows[0].startsWith("会場:") && rows[1].startsWith("料金:") &&
        rows[2].startsWith("予約要否:") && rows[3].startsWith("出典:") &&
        /^(確認日|取得日):/.test(rows[4]);
    }), "広島のカードを会場・料金・予約・出典・確認日の順で比較できる");
  ok(h(".event-facts a").toArray().every((node) =>
    /^https?:\/\//.test(h(node).attr("href")) && h(node).attr("rel").includes("noopener")),
    "出典には安全な外部リンクを使用する");
  ok(css.includes(".event-facts a{position:relative;z-index:1}"),
    "出典リンクがカード全体の詳細リンクに遮られない");
  ok(h(".pref-month-nav a[href='#hiroshima-stay']").length === 0 &&
    h("#hiroshima-stay .aff").length === 1,
    "広告設定がない場合は宿探しの目次だけを表示しない");

  const other = cheerio.load(read(join(OUT, "pref/宮崎県.html")));
  ok(other(".pref-month-nav,.pref-month,.event-facts").length === 0 &&
    other("h2").filter((_, n) => other(n).text() === "開催予定").length === 1,
    "広島以外の県の一覧は変更しない");
  ok(home(".event-facts").length === 0, "トップの公演カードの情報量は変更しない");

  // ビルドと同じ関数を単独で検証。公演データや外部サイトには書き込まない。
  const source = read("scripts/build.mjs");
  const declarations = ["HTTP_URL", "esc", "jpDate"].map((name) =>
    source.split("\n").find((line) => line.startsWith(`const ${name} =`))).join("\n");
  const factsCode = source.slice(source.indexOf("const cardFacts ="), source.indexOf('const card ='));
  const facts = (event) => runInNewContext(`${declarations}\n${factsCode}\ncardFacts(event)`, { event });
  const missing = cheerio.load(facts({}));
  ok(missing(".event-facts").text().includes("料金: 要確認") &&
    missing(".event-facts").text().includes("予約要否: 要確認") &&
    missing(".event-facts").text().includes("確認日: 未登録"),
    "未登録を無料・予約不要・今日確認済みに置き換えない");
  const automatic = cheerio.load(facts({ auto: true, lastSeen: "2026-10-19", source: "取得元", sourceUrl: "https://example.org/source", url: "https://example.org/event" }));
  ok(automatic(".event-facts").text().includes("取得日: 2026年10月19日（内容の確認日は未登録）") &&
    automatic("a").attr("href") === "https://example.org/source",
    "自動取得日は取得日と明記し、取得元のURLを優先する");
  const known = cheerio.load(facts({ venue: "<会場>", fee: "無料（条件あり）", reservation: "事前予約制", checked: "2026-10-10", source: "観光情報誌", sourceUrl: "javascript:alert(1)", url: "https://example.org/event" }));
  ok(known(".event-facts").text().includes("会場: <会場>") && known("会場").length === 0 &&
    known(".event-facts").text().includes("予約要否: 事前予約制") &&
    known(".event-facts").text().includes("確認日: 2026年10月10日") &&
    known("a").attr("href") === "https://example.org/event" &&
    !known(".event-facts").text().includes("公式"),
    "登録値をエスケープし、危険な出典URLや公式情報との誤表示を避ける");

  const built = build("tests/fixtures/events.test.json", "dist-test-revenue-ux", {
    TEST_AFF_TRAVEL: "1", TEST_GA: "G-TEST123456", TEST_CB: "test-consent-id"
  });
  ok(built.status === 0, "実際のアフィリエイト設定を模したビルドが成功", built.stderr);
  if (built.status === 0) {
    const a = cheerio.load(read("dist-test-revenue-ux/pref/広島県.html"));
    const links = a("#hiroshima-stay .afflist a");
    ok(a(".pref-month-nav a[href='#hiroshima-stay']").length === 1 &&
       a("#hiroshima-stay").length === 1,
       "広告を設定すると月の目次から宿探しへ移動できる");
    ok(links.length === 2 &&
       links.toArray().every((x) => a(x).attr("rel")?.includes("sponsored")),
       "じゃらん・楽天トラベルの広告リンクとPR属性を維持する");
    ok(links.map((_, x) => a(x).attr("data-goatcounter-click")).get().sort().join() ===
       "aff-jalan/広島県,aff-rakuten/広島県",
       "GoatCounterの既存クリックラベルは維持する");
    ok(a("#hiroshima-stay .pr").length === 1 &&
       a('script[data-require-statistics-consent]').length === 1,
       "広告のPR表記とGA4の同意制御を維持する");
  }

  section("広島県: 公式情報で確認した森林公園公演の料金・申込条件");
  const eventId = "hiroshima-shinrin-kagura-2026-11";
  const forest = JSON.parse(read("data/events.json")).find((e) => e.id === eventId);
  ok(forest?.start === "2026-11-15T13:00" && forest?.end === "2026-11-15T15:00" &&
    forest?.fee === "参加無料" && forest?.reservation === "不要（当日会場へ）",
    "2026-10-21に市・公園公式で確認した開催時刻・料金・申込条件を保持する");
  ok(forest?.url.startsWith("https://midori-gr.com/shinrin/2026/11/15/") &&
    forest?.sourceUrl === "https://www.city.hiroshima.lg.jp/living/kosodate/1021253/1025917/1036698.html" &&
    forest?.checked === "2026-10-21" && forest?.description.includes("雨天の場合は11月22日に延期"),
    "公園の公演別案内と市の確認元、確認日、雨天延期の条件を残す");
  const verified = build("data/events.json", "dist-test-verified-hiroshima");
  ok(verified.status === 0, "公式確認済みの本番データでビルド成功", verified.stderr);
  if (verified.status === 0) {
    const pref = cheerio.load(read("dist-test-verified-hiroshima/pref/広島県.html"));
    const facts = pref(`.card h3 a[href='/events/${eventId}.html']`).closest(".card").find(".event-facts");
    ok(facts.text().includes("料金: 参加無料") && facts.text().includes("予約要否: 不要（当日会場へ）") &&
      facts.find("a").attr("href") === forest.sourceUrl,
      "広島県一覧に料金・予約要否・市公式の出典リンクが反映される");
    const detail = cheerio.load(read(`dist-test-verified-hiroshima/events/${eventId}.html`));
    ok(detail(".actions a").first().attr("href") === forest.url &&
      detail("main").text().includes("事前申込不要") &&
      detail("main").text().includes("雨天の場合は11月22日に延期"),
      "公演詳細から公園公式へ移動でき、予約・雨天条件も確認できる");
    const eventLd = detail('script[type="application/ld+json"]').toArray()
      .flatMap((node) => JSON.parse(detail(node).text())).find((item) => item["@type"] === "Event");
    ok(eventLd?.isAccessibleForFree === true && eventLd?.offers?.price === "0",
      "確認済みの参加無料情報が構造化データにも反映される");
  }
}
