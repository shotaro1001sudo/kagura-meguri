// GA4 affiliate-click regression checks (no external network calls).
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { renderedCheerio as cheerio } from "./rendered-vc.mjs";
import { VC } from "../scripts/lib/valuecommerce.mjs";
import { stripIdsFor, STRIP_MAX } from "../scripts/lib/side-rail.mjs";

export function affiliateTests({ ok, section, OUT, build }) {
  section("GA4: affiliate_click");
  const script = readFileSync("scripts/client/affiliate.js", "utf8");
  const page = readFileSync(join(OUT, "events/t-full.html"), "utf8");
  ok(!page.includes("affiliate_click"), "GA4無効時にはトラッカーを出力しない");

  const active = build("tests/fixtures/events.test.json", "dist-test-ga4-affiliate", {
    TEST_GA: "G-TEST123456", TEST_AFF_TRAVEL: "1", TEST_CB: "test-consent-id", TEST_GOATCOUNTER: "kagurameguri"
  });
  ok(active.status === 0, "GA4・広告ありでビルド成功", active.stderr);
  if (active.status === 0) {
    const html = readFileSync("dist-test-ga4-affiliate/events/t-full.html", "utf8");
    const $ = cheerio.load(html);
    ok(html.includes("affiliate_click"), "全ページ共通レイアウトにトラッカーが出る");
    ok($('script[src*="gtag/js"]').length === 0, "明示的な同意前にGA4外部タグを読み込まない");
    ok($('script[data-ga4-id="G-TEST123456"][data-require-statistics-consent]').length === 1, "同意ゲートを持つGA4初期化スクリプトを出力");
    ok($('.d-side .stay a.stay-banner[rel*="sponsored"]').length === 1 && $(".d-side .staylinks").length === 0, "開催ページの宿は、公式バナー(画像)で案内する(文字だけのボタンは出さない)");
    ok($('.d-side .stay .stay-banner[data-goatcounter-click^="banner-"]').length === $(".d-side .stay .stay-banner").length, "GoatCounter属性を維持(バナーの配置として数える)");
    const regular = cheerio.load(readFileSync("dist-test-ga4-affiliate/regular/r-nightly.html", "utf8"));
    ok(regular('.d-side .aff a.stay-banner[data-goatcounter-click="banner-rakuten/r-nightly"]').length === 1 && regular('.d-side .staylinks').length === 0, "定期公演の宿も、公式バナー(画像)で案内する");
    ok($('meta[http-equiv="Content-Security-Policy"]').attr("content")?.includes("sha256-"), "追加スクリプトがCSPのハッシュに含まれる");
    // PCの両サイドのPR枠(2026-11-15): 開催・定期公演・県・種類のページだけ。左右の枠ごとに「PR」を1つ
    const rails = ($$) => $$(".side-rail");
    const dir = "dist-test-ga4-affiliate";
    // 2026-11-15 運営者の依頼: 今週末・今月・日付と場所で探す・地図で探すページにも出す
    const railPages = ["events/t-full.html", "regular/r-nightly.html", ...readdirSync(join(dir, "pref")).slice(0, 1).map((f) => `pref/${f}`), ...readdirSync(join(dir, "kagura")).slice(0, 1).map((f) => `kagura/${f}`), "weekend.html", "this-month.html", "calendar.html", "map.html"];
    const loaded = railPages.map((p) => [p, cheerio.load(readFileSync(join(dir, p), "utf8"))]);
    ok(loaded.every(([, $$]) => rails($$).length === 2 && rails($$).toArray().every((r) => $$(r).find(".pr-foot").length === 1 && $$(r).find(".rail-banner").length >= 1)), "開催・定期公演・県・種類のページに、左右のPR枠(枠ごとに「PR」1つ)", railPages.join(" "));
    ok(loaded.every(([, $$]) => $$("a.rail-banner").toArray().every((a) => /^https:\/\/hb\.afl\.rakuten\.co\.jp\/hsc\//.test($$(a).attr("href")) && ($$(a).attr("rel") || "").includes("sponsored") && $$(a).attr("target") === "_blank" && /^rail-rakuten\//.test($$(a).attr("data-goatcounter-click")) && /^https:\/\/hbb\.afl\.rakuten\.co\.jp\/hsb\//.test($$(a).find("img").attr("src")) && $$(a).find("img").attr("alt") && $$(a).find("img").attr("loading") === "lazy")), "PR枠のバナーは、楽天の発行リンクと画像だけ(広告の印 sponsored・別タブ・代替テキスト・遅延読み込み)");
    // じゃらんnet は、バリューコマースの発行コードを広告の同意の仕組み(vcTag)で出す。発行コードのままのリンクと画像、計測の名前
    const vcRail = [["rail", "jalan"], ["railJtb", "jtb"], ["railNta", "nta"]];
    ok(loaded.every(([, $$]) => vcRail.every(([kind, partner]) => { const vc = $$(`.side-rail [data-vc-ad="${kind}"]`); const a = vc.find("a"); return vc.length === 1 && vc.is(".vc-ad.rail-banner") && vc.attr("data-banner-partner") === partner && new RegExp(`^rail-${partner}/`).test(vc.attr("data-goatcounter-click")) && a.attr("href") === `//ck.jp.ap.valuecommerce.com/servlet/referral?sid=${VC.sid}&pid=${VC[kind]}` && a.find("img").attr("src") === `//ad.jp.ap.valuecommerce.com/servlet/gifbanner?sid=${VC.sid}&pid=${VC[kind]}` && (a.attr("rel") || "").includes("sponsored") && a.find("img").attr("alt"); })), "PR枠のじゃらん・JTB・日本旅行は、発行コードのリンクと画像のまま、同意の仕組みの中に出す");
    ok(vcRail.every(([kind, partner]) => fire({ label: `rail-${partner}/x` })[0]?.[2]?.affiliate_partner === partner) && new Set(Object.values(VC)).size === Object.values(VC).length, "PR枠のバリューコマースの広告のクリックも GA4 で数え、発行コードの番号は重ならない");
    // 2026-11-15 運営者の依頼: PR枠の上端は、本文の宿の枠(会場周辺の宿・◯◯県の宿など)の上端にそろえる
    // 今週末・今月は、開催がないと宿の枠が出ない(そのときは上から96px)。日付・場所で探すページは探す条件の枠(.finder)、地図で探すページは地図(.mapbox)、
    // 種類で探すページ(kagura/index.html)は最初のカードの並び(.kagura-region .cardgrid)にそろえる
    // 2026-11-15 運営者の依頼「全公演ページで統一」: 公演ページ(開催・定期公演)は、どれも 右の列(.d-side)の上端 = 要点の枠(.keyinfo)の上端 にそろえる。
    // 宿の枠がない公演も、右の列がない終了した開催(要点の枠にそろえる)も、同じ決まりで、上から96px のままにしない
    const RAIL_ANCHOR = "main .keyinfo, main .stay, main aside.aff, main .finder, main .mapbox, main .kagura-region .cardgrid";
    const kindIndex = cheerio.load(readFileSync(join(dir, "kagura/index.html"), "utf8"));
    const railJs = readFileSync("scripts/client/side-rail.js", "utf8");
    ok(loaded.every(([p, $$]) => (/^(weekend\.html|this-month\.html)/.test(p) || $$("main .d-side").length >= 1 || $$(RAIL_ANCHOR).length >= 1) && $$("script").toArray().some((s) => $$(s).html().includes("--rail-top"))) && /top:var\(--rail-top,96px\)/.test(readFileSync("scripts/style.css", "utf8")) && railJs.includes(`document.querySelector("main .d-side") ||`) && railJs.includes(`"${RAIL_ANCHOR}"`), "PR枠の上端を本文の枠(公演ページは右の列と要点の枠、日付・場所で探すページは探す条件の枠、地図で探すページは地図)にそろえるスクリプトを読み込み、その枠がページにある(動かないときは上から96px)", railPages.join(" "));
    { const eventPages = [...readdirSync(join(dir, "events")).map((f) => `events/${f}`), ...readdirSync(join(dir, "regular")).map((f) => `regular/${f}`)].filter((p) => p.endsWith(".html")).map((p) => [p, cheerio.load(readFileSync(join(dir, p), "utf8"))]);
      const bad = eventPages.filter(([, $$]) => !(rails($$).length === 2 && $$("main .keyinfo").length === 1 && $$("script").toArray().some((s) => $$(s).html().includes("--rail-top")))).map(([p]) => p);
      ok(eventPages.length >= 3 && bad.length === 0 && eventPages.some(([, $$]) => $$("main .d-side").length === 0) && eventPages.some(([, $$]) => $$("main .d-side").length === 1), "公演ページは、開催中・終了・定期公演のどれも、PR枠を同じ決まり(要点の枠・右の列の上端)でそろえられる", bad.join(" ")); }
    ok(rails(kindIndex).length === 2 && kindIndex(RAIL_ANCHOR).first().is(".cardgrid") && kindIndex("main .kagura-region").first().find(".cardgrid .card").length >= 1 && kindIndex("script").toArray().some((s) => kindIndex(s).html().includes("--rail-top")), "種類で探すページのPR枠は、上端を最初のカードの並びにそろえる(2026-11-15 運営者の依頼)");
    { // ページごとの並び(RAIL_ORDER): 探すページ4つは、左右に4つずつ・同じバナーは1ページに1回。同意がなくても出る楽天のバナーが、左右に2つ以上残る
      const ids = ($$, s) => $$(`.side-rail-${s} .rail-banner`).toArray().map((x) => $$(x).attr("data-goatcounter-click").replace(/^rail-[a-z]+\//, ""));
      const page = (p) => loaded.find(([q]) => q === p)[1], all = (p) => [...ids(page(p), "l"), ...ids(page(p), "r")];
      const finders = ["weekend.html", "this-month.html", "calendar.html", "map.html"];
      ok(finders.every((p) => ids(page(p), "l").length === 4 && ids(page(p), "r").length === 4 && new Set(all(p)).size === 8), "今週末・今月・日付と場所・地図のページのPR枠は、左右に4つずつで、同じバナーをくり返さない", finders.map((p) => p + ": " + all(p).join(",")).join(" / "));
      ok(ids(page("weekend.html"), "r").slice(0, 2).join() === "rentacar,bus" && ids(page("weekend.html"), "l")[0] === "ryokan" && ids(page("this-month.html"), "r")[0] === "jr-hotel" && ids(page("calendar.html"), "r").slice(0, 2).join() === "jr-hotel,tour" && ids(page("calendar.html"), "l").slice(0, 2).join() === "onsen,station" && ids(page("map.html"), "r").slice(0, 2).join() === "rentacar,bus" && ids(page("map.html"), "l")[0] === "station", "並び: 今週末・地図は右の上が行き方(レンタカー・高速バス)、日付と場所は右の上が JR+ホテル・国内ツアー、地図の左の上は 駅・空港から宿を検索");
      ok(finders.every((p) => ["l", "r"].every((s) => page(p)(`.side-rail-${s} a.rail-banner[data-banner-partner="rakuten"]`).length >= 2)), "どの並びも、広告の同意がなくても出る楽天のバナーが、左右に2つ以上ある");
      // 探すページ向けに足した3つ(高速バス・国内ツアー・駅と空港から宿)は、開催・定期公演・県・種類のページには出さない
      ok(["events/t-full.html", "regular/r-nightly.html"].every((p) => !["bus", "tour", "station"].some((id) => all(p).includes(id))) && all("calendar.html").includes("tour") && all("map.html").includes("bus"), "高速バス・国内ツアー・駅と空港から宿のバナーは、探すページだけに出す");
    }
    { // 2026-11-15 運営者の依頼: スマホなど、両サイドのPR枠が出ない画面では、公演ページの宿・体験の下に、横に送れるバナーの帯「旅の手配」を1本だけ出す
      const css = readFileSync("scripts/style.css", "utf8"), RAIL_Q = "(min-width:1400px) and (min-height:520px)", STRIP_Q = `not all and ${RAIL_Q}`;
      const eventPages = [["events/t-full.html", $], ["regular/r-nightly.html", regular]];
      const strips = eventPages.map(([p, $$]) => [p, $$, $$(".d-side > aside.pr-strip")]);
      const names = ($$, strip) => strip.find(".pr-strip-row").children().toArray().map((x) => $$(x).attr("data-goatcounter-click"));
      ok(strips.every(([, $$, s]) => s.length === 1 && s.is(".w") && s.is(":last-child") && s.prevAll(".stay, .aff").length === 1 && s.children("h2").text() === "旅の手配" && s.find(".pr-strip-row[role=group][tabindex=0]").length === 1 && s.find(".pr").length === 1 && s.children().last().is(".pr.pr-foot")), "公演ページの右の列の最後(宿・体験の下)に、帯「旅の手配」を1本。「PR」は帯に1つ");
      ok(strips.every(([, $$, s]) => names($$, s).join() === "rail-nta/strip-jr-hotel,rail-rakuten/strip-bus,rail-jtb/strip-onsen,rail-rakuten/strip-onsen-rotenburo"), "帯の並びは JR+ホテル → 高速バス → 温泉宿(JTB)→ 露天風呂の宿(体験・じゃらんの宿は、上の枠と重なるので入れない)", strips.map(([p, $$, s]) => `${p}: ${names($$, s).join(",")}`).join(" / "));
      ok(strips.every(([, $$, s]) => s.find("a.strip-banner").toArray().every((a) => /^https:\/\/hb\.afl\.rakuten\.co\.jp\/hsc\//.test($$(a).attr("href")) && ($$(a).attr("rel") || "").includes("sponsored") && $$(a).attr("target") === "_blank" && /^https:\/\/hbb\.afl\.rakuten\.co\.jp\/hsb\//.test($$(a).find("img").attr("src")) && $$(a).find("img").attr("alt") && $$(a).find("img").attr("loading") === "lazy" && $$(a).find("img").attr("width") && $$(a).find("img").attr("height"))), "帯の楽天のバナーは、発行リンクと画像のまま(sponsored・別タブ・代替テキスト・遅延読み込み・大きさの指定)");
      ok(strips.every(([, $$, s]) => [["railNta", "nta"], ["railJtb", "jtb"]].every(([kind, partner]) => { const vc = s.find(`[data-vc-ad="${kind}"]`); return vc.length === 1 && vc.is(".vc-ad.strip-banner") && vc.attr("data-banner-partner") === partner && vc.attr("data-vc-media") === STRIP_Q && vc.find("a").attr("href") === `//ck.jp.ap.valuecommerce.com/servlet/referral?sid=${VC.sid}&pid=${VC[kind]}` && vc.find("img").attr("src") === `//ad.jp.ap.valuecommerce.com/servlet/gifbanner?sid=${VC.sid}&pid=${VC[kind]}`; })), "帯の日本旅行・JTBは、発行コードのまま、同意の仕組みの中に出す(帯が出る画面でだけ読み込む)");
      ok(strips.every(([, $$]) => $$(".side-rail [data-vc-ad]").length === 3 && $$(".side-rail [data-vc-ad]").toArray().every((x) => $$(x).attr("data-vc-media") === RAIL_Q)) && loaded.filter(([p]) => /^(pref|kagura)\/|^(calendar|map)\.html$/.test(p)).every(([, $$]) => $$(".side-rail [data-vc-ad]").toArray().every((x) => $$(x).attr("data-vc-media") === "(min-width:1280px) and (min-height:520px)")) && $(".stay [data-vc-ad], #nearby-experiences [data-vc-ad]").toArray().every((x) => !$(x).attr("data-vc-media")), "両サイドのPR枠のバリューコマースの広告は、PR枠が出る画面でだけ読み込む(スマホでは読み込まない)。宿・体験の枠の広告は、どの画面でも読み込む");
      ok(css.includes("@media(min-width:1400px) and (min-height:520px){.pr-strip.w{display:none}}") && css.includes("@media(min-width:1280px) and (min-height:520px){.pr-strip:not(.w){display:none}}") && /\.pr-strip-row\{display:flex;[^}]*overflow-x:auto/.test(css) && !/\.pr-strip[^{]*\{[^}]*position:(fixed|sticky)/.test(css) && fire({ label: "rail-rakuten/strip-bus" })[0]?.[2]?.affiliate_placement === "side_rail" && fire({ label: "rail-rakuten/strip-bus" })[0]?.[2]?.affiliate_content_id === "strip-bus", "帯は、横に送って見る列で、画面に固定しない。両サイドのPR枠が出る画面では出さない。クリックは 配置 side_rail・中身 strip-… で数える");
      // 2026-11-15 運営者の依頼: 帯を、探すページ(今週末・今月・日付と場所・地図・種類・都道府県)にも出す。中身は、そのページの両サイドのPR枠と同じバナー(右 → 左の順。宿の重なりは入れない)
      const stripOf = ($$) => $$("aside.pr-strip"), idsOf = ($$) => stripOf($$).find(".pr-strip-row").children().toArray().map((x) => $$(x).attr("data-goatcounter-click").replace(/^rail-[a-z]+\/strip-/, ""));
      ok(stripIdsFor("/weekend.html").join() === "rentacar,bus,experiences,jr-hotel,onsen-rotenburo,onsen" && stripIdsFor("/this-month.html").join() === "jr-hotel,rentacar,bus,experiences,onsen-rotenburo,onsen" && stripIdsFor("/calendar.html").join() === "jr-hotel,tour,experiences,rentacar,onsen,station" && stripIdsFor("/map.html").join() === "rentacar,bus,jr-hotel,experiences,station,onsen-rotenburo" && stripIdsFor("/kagura/").join() === "jr-hotel,rentacar,bus,experiences,onsen-rotenburo,onsen" && stripIdsFor("/pref/", { skip: ["experiences"] }).join() === "jr-hotel,rentacar,bus,onsen-rotenburo,onsen" && ["/weekend.html", "/this-month.html", "/calendar.html", "/map.html", "/kagura/", "/pref/"].every((p) => stripIdsFor(p).length <= STRIP_MAX && new Set(stripIdsFor(p)).size === stripIdsFor(p).length && !stripIdsFor(p).some((id) => ["ryokan", "onsen-gensen"].includes(id))), "探すページの帯の並び: 両サイドのPR枠と同じバナーを右 → 左の順に、6つまで(じゃらんの宿・源泉の宿は入れない)");
      const kindFile = readdirSync(join(dir, "kagura")).find((f) => f !== "index.html"), prefFile = readdirSync(join(dir, "pref"))[0];
      const kindP = cheerio.load(readFileSync(join(dir, "kagura", kindFile), "utf8")), prefP = cheerio.load(readFileSync(join(dir, "pref", prefFile), "utf8")), page = (p) => loaded.find(([q]) => q === p)[1];
      const cal = page("calendar.html"), map = page("map.html"), wkP = page("weekend.html"), tmP = page("this-month.html");
      ok([cal, map, kindIndex, kindP, prefP].every(($$) => stripOf($$).length === 1 && !stripOf($$).is(".w") && stripOf($$).find(".pr").length === 1 && stripOf($$).children().last().is(".pr.pr-foot") && stripOf($$).find("[data-vc-ad]").toArray().every((x) => $$(x).attr("data-vc-media") === "not all and (min-width:1280px) and (min-height:520px)")) && idsOf(cal).join() === stripIdsFor("/calendar.html").join() && idsOf(map).join() === stripIdsFor("/map.html").join() && idsOf(kindIndex).join() === stripIdsFor("/kagura/").join() && idsOf(kindP).join() === stripIdsFor("/kagura/").join() && idsOf(prefP).join() === stripIdsFor("/pref/", { skip: ["experiences"] }).join(), "日付と場所・地図・種類・都道府県のページに、帯を1本ずつ(本文が狭いページなので、幅 1280px 未満で出す)", [cal, map, kindIndex, kindP, prefP].map(($$) => stripOf($$).length + ":" + idsOf($$).join(",")).join(" / "));
      ok([wkP, tmP].every(($$) => stripOf($$).length === $$(".d-side").length && (!stripOf($$).length || (stripOf($$).is(".w") && stripOf($$).is(".d-side > :last-child") && stripOf($$).prev().is(".trip-band")))) && (!stripOf(wkP).length || idsOf(wkP).join() === stripIdsFor("/weekend.html").join()), "今週末・今月のページは、右の列の宿の枠の下に帯(開催がなく宿の枠が出ないときは、帯も出さない)");
      // 置き場所: 主な内容(検索の結果・会場の一覧・種類の一覧)と、宿・体験の枠のあと。それより上には置かない
      const after = ($$, sel) => $$(sel).length >= 1 && stripOf($$).prevAll(sel).length >= 1 && stripOf($$).nextAll(sel).length === 0;
      ok(after(cal, "#results") && after(map, ".mapbox") && (map("details.rgroup").length === 0 || after(map, "details.rgroup")) && after(kindIndex, ".kagura-region") && after(kindP, "aside.aff") && after(kindP, ".kagura-folds") && (prefP("#nearby-experiences").length ? after(prefP, "#nearby-experiences") : true) && prefP("main .aff").toArray().every((x) => stripOf(prefP).prevAll().toArray().some((y) => y === x || prefP(y).find(x).length)), "帯は、検索の結果・地図と会場の一覧・種類の一覧・宿の枠・体験の欄より下に置く");
      ok(["index.html", "guide.html", "sponsor.html", "privacy.html", "quiz.html", "experiences.html", "history/index.html", "en/index.html"].every((p) => !existsSync(join(dir, p)) || cheerio.load(readFileSync(join(dir, p), "utf8"))(".pr-strip").length === 0) && cheerio.load(readFileSync(join(dir, "events/t-past.html"), "utf8"))(".pr-strip").length === 0, "帯は、両サイドのPR枠を出すページだけ(トップ・ガイド・協賛・規約・診断・周辺体験・歴史・英語と、終了した開催には出さない)");
    }
    ok(loaded.every(([p, $$]) => !/data-vc-ad=/.test($$.html()) || $$.html().includes("kaguraVcConsent")), "PR枠にじゃらんがあるページは、広告の同意を確かめるスクリプトを読み込む");
    ok(["index.html", "guide.html", "sponsor.html", "privacy.html", "quiz.html", "en/index.html"].every((p) => !existsSync(join(dir, p)) || rails(cheerio.load(readFileSync(join(dir, p), "utf8"))).length === 0), "ほかのページ(トップ・ガイド・協賛・規約・診断・英語)には出さない");
  }
  const railCss = readFileSync("scripts/style.css", "utf8");
  ok(/^\.side-rail\{display:none\}/m.test(railCss) && /@media\(min-width:1280px\)[^{]*\{\s*\.side-rail:not\(\.w\)\{[^}]*display:flex[^}]*position:fixed/.test(railCss), "PR枠は、ふだんは出さず、幅の広い画面だけで、画面に固定して出す(スマホ・せまい画面では出ない)");
  const rail = fire({ label: "rail-rakuten/onsen-gensen" })[0]?.[2];
  ok(rail?.affiliate_placement === "side_rail" && rail?.affiliate_partner === "rakuten" && rail?.affiliate_content_id === "onsen-gensen", "PR枠のクリックは、配置 side_rail として GA4 で数える");

  function fire({ label = "stay-rakuten/t-full", sponsored = true, consent = true, cookieBot = true, gtag = true, tag = "SPAN", freshConsent = true } = {}) {
    let callback; const events = [];
    class Element {
      closest(selector) { return selector === "a[data-goatcounter-click]" ? link : null; }
    }
    const link = {
      relList: { contains: (name) => name === "sponsored" && sponsored },
      getAttribute: (name) => name === "data-goatcounter-click" ? label : null
    };
    const document = {
      addEventListener(name, fn) { if (name === "click") callback = fn; },
      getElementById(id) { return id === "Cookiebot" && cookieBot ? {} : null; }
    };
    const window = { location: { pathname: "/events/t-full.html" }, kaguraGa4Allowed: !cookieBot || consent, Cookiebot: { consent: { statistics: consent } } };
    window.kaguraCheckAnalyticsConsent = () => freshConsent;
    if (gtag) window.gtag = (...args) => events.push(args);
    runInNewContext(script, { document, window, Element });
    callback({ target: Object.assign(new Element(), { tagName: tag }) });
    return events;
  }

  ok(fire({freshConsent:false}).length===0, "別タブ撤回で古い許可フラグが残っても広告クリックを送信しない");
  const good = fire();
  ok(good.length === 1 && good[0][0] === "event" && good[0][1] === "affiliate_click", "対象クリックで1イベントだけ送信");
  ok(good[0]?.[2]?.affiliate_partner === "rakuten" && good[0]?.[2]?.affiliate_content_id === "t-full" && good[0]?.[2]?.affiliate_page_path === "/events/t-full.html", "広告主・公演ID・ページ情報を送信");
  ok(fire({ label: "aff-jalan/広島県" })[0]?.[2]?.affiliate_placement === "travel_block", "県別広告も判定");
  const bn = fire({ label: "banner-jalan/t-full" })[0]?.[2];
  ok(bn?.affiliate_placement === "stay_banner" && bn?.affiliate_partner === "jalan" && bn?.affiliate_content_id === "t-full", "宿のバナーのクリックは、配置 stay_banner として判定");
  ok(fire({ consent: false }).length === 0, "統計同意なしでは送信しない");
  ok(fire({ sponsored: false }).length === 0, "非広告リンクは送信しない");
  ok(fire({ label: "share-line" }).length === 0, "共有リンクは除外");
  ok(fire({ gtag: false }).length === 0, "GA4未読込でもエラーなく終了");
  ok(fire({ cookieBot: false }).length === 1, "Cookiebot未設定時も計測可能");
}
