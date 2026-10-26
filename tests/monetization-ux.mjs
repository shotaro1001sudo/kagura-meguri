import { reservationLabel } from '../scripts/lib/reservation.mjs';
// Revenue UX regression: keep editorial navigation helpful and sponsored links intact.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
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
  ok(months.toArray().every((node) => {
    const section = h(node);
    const key = section.find("h2").attr("id").replace("hiroshima-", "");
    const reciprocal = section.find(`a[href='/month/${key}.html']`);
    return section.find("h2").text().endsWith("の開催予定") && reciprocal.length === 1 &&
      reciprocal.text() === section.find("h2").text().replace("の開催予定", "の全国日程を見る");
  }), "広島の各開催予定から同じ月の全国日程へ移動できる");
  const november = cheerio.load(read(join(OUT, "month/2026-11.html")));
  ok(november(`.lead a[href='/pref/${encodeURIComponent("広島県")}.html']`).length === 1 &&
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
  const mapped = cheerio.load(read(join(OUT, "events/t-timeunknown.html")));
  ok(mapped(".actions").next().hasClass("viewing-preparation") &&
    mapped(".viewing-preparation").length === 1 &&
    mapped(".viewing-preparation a[href='#venue-access']").length === 1 &&
    mapped("#venue-access #map").length === 1 && mapped("#venue-access .routebtn a").length === 1,
    "広島の公演詳細では要点のすぐ下から既存の会場地図・経路に移動できる");
  ok(mapped("main a[href='/guide.html']").length === 0 &&
    mapped("main a[href='/guide.html#prepare']").length === 1,
    "広島の詳細にあった下部の一般ガイド案内を近接案内に置き換え、重複しない");
  const noMap = cheerio.load(read(join(OUT, "events/t-minimal.html")));
  ok(noMap(".viewing-preparation a").length === 2 && noMap("a[href='#venue-access'],#venue-access").length === 0,
    "地図データがない公演には空の地図リンクを出さない");
  const outside = cheerio.load(read(join(OUT, "events/t-full.html")));
  ok(outside(".viewing-preparation,#venue-access").length === 0 &&
    outside("main a[href='/guide.html']").length === 1,
    "広島以外の公演詳細のガイド・地図配置を維持する");

  // ビルドと同じ関数を単独で検証。公演データや外部サイトには書き込まない。
  const source = read("scripts/build.mjs");
  const declarations = ["HTTP_URL", "esc", "jpDate"].map((name) =>
    source.split("\n").find((line) => line.startsWith(`const ${name} =`))).join("\n");
  const factsCode = source.slice(source.indexOf("const cardFacts ="), source.indexOf('const card ='));
  const facts = (event) => runInNewContext(`${declarations}\n${factsCode}\ncardFacts(event)`, { event, reservationLabel });
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
    const links = a("#hiroshima-stay .stay-banner");
    ok(a(".pref-month-nav a[href='#hiroshima-stay']").length === 1 &&
       a("#hiroshima-stay").length === 1,
       "広告を設定すると月の目次から宿探しへ移動できる");
    ok(links.length === 2 &&
       links.toArray().every((x) => a(x).attr("rel")?.includes("sponsored")),
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
    const links = ev(".d-side .staylinks a");
    ok(links.length === 2 && ev(".d-side .stay h2").length === 1 && ev(".d-side .stay .stay-banners").length === 0, "開催ページ: サイドの宿カードは、バナーではなく、日付・地域つきの2つの検索リンクにする");
    const [jl, rk] = links.map((_, x) => ev(x).attr("href")).get();
    ok(jl.startsWith("https://ck.jp.ap.valuecommerce.com/servlet/referral?") && (new URL(jl).searchParams.get("vc_url") ?? "").includes("stayYear=2026&stayMonth=11&stayDay=20") && rk.startsWith("https://hb.afl.rakuten.co.jp/hgc/") && new URL(rk).searchParams.get("pc").includes("f_nen1=2026&f_tuki1=11&f_hi1=20"), "じゃらんはバリューコマース、楽天トラベルは楽天アフィリエイトを経由し、開催日の検索をそのまま開く");
    ok(links.toArray().every((x) => ev(x).attr("rel").includes("sponsored") && ev(x).attr("rel").includes("noopener") && ev(x).attr("target") === "_blank" && ev(x).text().includes("宿を探す")), "広告リンクの属性(sponsored・noopener)と、分かる文言がある");
    ok(links.map((_, x) => ev(x).attr("data-goatcounter-click")).get().join() === "stay-jalan/t-full,stay-rakuten/t-full", "GoatCounterのクリック名は stay-◯◯/開催ID");
    const csp = cheerio.load(read("dist-test-revenue-ux/weekend.html"))('meta[http-equiv="Content-Security-Policy"]').attr("content");
    ok(/img-src[^;]*i.imgvc.com/.test(csp) && /img-src[^;]*hbb.afl.rakuten.co.jp/.test(csp) && /img-src[^;]*ba.afl.rakuten.co.jp/.test(csp), "CSP: バナーのあるページだけ、画像の配信元(楽天の転送先を含む)を許可する");
    ok(!ev("script[src*='valuecommerce'],img[src*='gifbanner'],noscript").toArray().some((x) => /valuecommerce/.test(ev.html(x))), "JavaScript の埋め込みと、見えない計測画像は、使わない");
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
  { const h = off("main").html(); ok(h.indexOf('class="share"') > h.indexOf('id="map"') && h.indexOf('id="map"') > 0 && h.indexOf('class="share"') > h.indexOf("desc-lead"), "共有のボタンは、説明・地図などの本文の後に置く"); }
  ok(off(".d-top .share").length === 0 && off(".desc-lead").length === 1, "要点の直後は、説明文(共有ボタンは置かない)");
  const ended = cheerio.load(read(join(OUT, "events/t-past.html")));
  ok(ended(".until,.side-summary").length === 0, "終了した開催には、日数と右の列を出さない");

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
    // 町公式PDF27361の施設案内に「当日の施設内レシートの提示が必要」。
    // 4開催に共有する見どころ・冒頭と、短縮されるmetaでも条件を落とさない。
    for (const suffix of ['2026-11', '2026-12', '2027-01', '2027-02']) {
      const page = cheerio.load(read(`dist-test-verified-hiroshima/events/michinoeki-chiyoda-kagura-${suffix}.html`));
      const condition = '当日の施設内レシートの提示が必要';
      ok(page('.desc-lead').text().includes(condition) && page('main li').text().includes(condition),
        `千代田${suffix}: 冒頭・共有見どころに観覧条件を明記`);
      ok(page('meta[name="description"]').attr('content').includes(condition),
        `千代田${suffix}: metaの短縮後もレシート条件が残る`);
      const ld = page('script[type="application/ld+json"]').toArray()
        .flatMap(n => JSON.parse(page(n).text())).find(v => v['@type'] === 'Event');
      ok(!ld.offers && ld.isAccessibleForFree === undefined && ld.description.includes(condition),
        `千代田${suffix}: 条件付き無料を無条件無料や販売情報にしない`);
    }
    const oasa=cheerio.load(read('dist-test-verified-hiroshima/events/oasa-kagura-kyoen-2026.html'));
    const horo=cheerio.load(read('dist-test-verified-hiroshima/events/horowasan-shimotsuki-kagura-2026.html'));
    const eventLdOf=$=>$('script[type="application/ld+json"]').toArray().flatMap(n=>JSON.parse($(n).text())).find(v=>v['@type']==='Event');
    const oa=eventLdOf(oasa), ho=eventLdOf(horo);
    ok(oa.startDate==='2026-11-07T13:00+09:00' && !oa.endDate && oasa('main').text().includes('開場12:00、開会式12:30、開演13:00'), '大朝: 開演を13時とし、開場/式と区別・閉会式を終了時刻にしない');
    ok(oasa('main a[href="https://kitahiro.rgr.jp/pkobo_news/news-detail.php?id=547"]').length>0 && new URL(oasa('a[href^="https://calendar.google.com/calendar/render"]').first().attr('href')).searchParams.get('location').includes('大朝4436') && oasa('main').text().includes('予約要否要確認'), '大朝: 個別公式リンク・住所・予約不明を維持');
    ok(ho.startDate==='2026-11-07' && ho.endDate==='2026-11-08' && horo('main').text().includes('時間は公式情報をご確認ください'), '保呂羽山: schemaの日付範囲と時刻未確認を維持');
    const gc=new URL(horo('a[href^="https://calendar.google.com/calendar/render"]').first().attr('href'));
    ok(gc.searchParams.get('dates')==='20261107/20261109' && gc.searchParams.get('location').includes('木ノ根坂200'), '保呂羽山: Google予定の終日は8日を含み排他的終了9日・里宮住所');
    const ics=read('dist-test-verified-hiroshima/events.ics').split('BEGIN:VEVENT').find(v=>v.includes('UID:horowasan-shimotsuki-kagura-2026@'));
    ok(ics.includes('DTSTART;VALUE=DATE:20261107') && ics.includes('DTEND;VALUE=DATE:20261109'), '保呂羽山: ICSも排他的終了11月9日');
    ok(horo('main').text().includes('2026年の確定時刻としては掲載していません') && horo('a[href="https://rurubu.jp/andmore/spot/20000345"]').length>0, '保呂羽山: 年次時刻と2026日程の根拠を区別し補足出典を保持');
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
    ok(eventLd?.isAccessibleForFree === true && !eventLd?.offers,
      "確認済みの参加無料情報が構造化データにも反映される");
  }
}
