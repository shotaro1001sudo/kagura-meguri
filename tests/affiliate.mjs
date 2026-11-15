// GA4 affiliate-click regression checks (no external network calls).
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { renderedCheerio as cheerio } from "./rendered-vc.mjs";
import { VC } from "../scripts/lib/valuecommerce.mjs";
import { stripIdsFor, STRIP_MAX, STRIP_EVERY, prStripHtml, INLIST_THEMES, inlistTheme, RAIL_BANNERS, STRIP_ORDER } from "../scripts/lib/side-rail.mjs";
import { inlistLead, inlistCount } from "../scripts/lib/inlist-pr.mjs";
import { activeSponsors, listSponsorTile } from "../scripts/lib/sponsor-slots.mjs";

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
    { // 2026-11-15 運営者の依頼: スマホなど、両サイドのPR枠が出ない画面では、公演ページの宿・体験の下に「旅の手配」を1つ。同日「帯ではなく、PRを1個だけ・枠と同じ横幅で」に変えた
      const css = readFileSync("scripts/style.css", "utf8"), RAIL_Q = "(min-width:1400px) and (min-height:520px)";
      const eventPages = [["events/t-full.html", $], ["regular/r-nightly.html", regular]];
      const strips = eventPages.map(([p, $$]) => [p, $$, $$(".d-side > aside.pr-strip")]);
      const oneOf = (s) => s.find(".pr-strip-one").children(), nameOf = (s) => oneOf(s).attr("data-goatcounter-click") || "";
      const firstRk = (ids) => ids.find((id) => !RAIL_BANNERS.find((x) => x.id === id).vc);
      ok(strips.every(([, $$, s]) => s.length === 1 && s.is(".w") && s.is(":last-child") && s.prevAll(".stay, .aff").length === 1 && s.children("h2").text() === "旅の手配" && oneOf(s).length === 1 && s.find(".pr-strip-row").length === 0 && s.find(".pr").length === 1 && s.children().last().is(".pr.pr-foot")), "公演ページの右の列の最後(宿・体験の下)に「旅の手配」を1つ。中のPRは1個だけ(横に送る帯にしない)。「PR」は1つ");
      ok(strips.every(([, $$, s]) => (/^planning-rental\//.test(nameOf(s)) || nameOf(s) === "rail-rakuten/strip-" + firstRk(STRIP_ORDER)) && s.find("[data-vc-ad]").length === 0) && firstRk(STRIP_ORDER) === "bus", "公演ページのPRは、レンタカー・カーシェア(あれば)→ なければ高速バス(楽天)。同意の要る広告は選ばない(同意がないと、1個だけの枠が空になるため)", strips.map(([p, , s]) => p + ": " + nameOf(s)).join(" / "));
      ok(strips.every(([, $$, s]) => oneOf(s).filter("a.strip-banner:not(.strip-text)").toArray().every((a) => !/^https:\/\/hb\.afl\.rakuten\.co\.jp\/hsc\//.test($$(a).attr("href")) || (($$(a).attr("rel") || "").includes("sponsored") && $$(a).attr("target") === "_blank" && /^https:\/\/hbb\.afl\.rakuten\.co\.jp\/hsb\//.test($$(a).find("img").attr("src")) && $$(a).find("img").attr("alt") && $$(a).find("img").attr("loading") === "lazy" && $$(a).find("img").attr("width") && $$(a).find("img").attr("height")))), "楽天のバナーは、発行リンクと画像のまま(sponsored・別タブ・代替テキスト・遅延読み込み・大きさの指定)");
      ok(strips.every(([, $$]) => $$(".side-rail [data-vc-ad]").length === 3 && $$(".side-rail [data-vc-ad]").toArray().every((x) => $$(x).attr("data-vc-media") === RAIL_Q)) && loaded.filter(([p]) => /^(pref|kagura)\/|^(calendar|map)\.html$/.test(p)).every(([, $$]) => $$(".side-rail [data-vc-ad]").toArray().every((x) => $$(x).attr("data-vc-media") === "(min-width:1280px) and (min-height:520px)")) && $(".stay [data-vc-ad], #nearby-experiences [data-vc-ad]").toArray().every((x) => !$(x).attr("data-vc-media")), "両サイドのPR枠のバリューコマースの広告は、PR枠が出る画面でだけ読み込む(スマホでは読み込まない)。宿・体験の枠の広告は、どの画面でも読み込む");
      const prCss = css.slice(css.indexOf(".pr-strip{"), css.indexOf(".pr-strip .pr-foot"));
      ok(css.includes("@media(min-width:1400px) and (min-height:520px){.pr-strip.w{display:none}}") && css.includes("@media(min-width:1280px) and (min-height:520px){.pr-strip:not(.w){display:none}}") && /\.pr-strip-one>\.strip-banner:not\(\[hidden\]\)\{[^}]*width:100%/.test(css) && /\.pr-strip-one>\.strip-banner\.strip-text:not\(\[hidden\]\)\{[^}]*max-width:none/.test(css) && prCss.length > 0 && !prCss.includes("overflow-x:auto") && !css.includes(".pr-strip-row") && !/\.pr-strip[^{]*\{[^}]*position:(fixed|sticky)/.test(css) && fire({ label: "rail-rakuten/strip-bus" })[0]?.[2]?.affiliate_placement === "side_rail" && fire({ label: "rail-rakuten/strip-bus" })[0]?.[2]?.affiliate_content_id === "strip-bus", "PRは1個だけで、枠の幅いっぱい(横に送る列にしない)。画面に固定しない。両サイドのPR枠が出る画面では出さない。クリックは 配置 side_rail・中身 strip-… で数える");
      // 2026-11-15 運営者の依頼: 探すページ(今週末・今月・日付と場所・地図・種類・都道府県)にも出す。候補は、そのページの両サイドのPR枠と同じバナー(右 → 左の順)で、はじめの楽天のバナーを出す
      const stripOf = ($$) => $$("aside.pr-strip:not(.inlist)"), idOf = ($$) => nameOf(stripOf($$)).replace(/^rail-[a-z]+\/strip-/, "");
      ok(stripIdsFor("/weekend.html").join() === "rentacar,bus,experiences,jr-hotel,onsen-rotenburo,onsen" && stripIdsFor("/this-month.html").join() === "jr-hotel,rentacar,bus,experiences,onsen-rotenburo,onsen" && stripIdsFor("/calendar.html").join() === "jr-hotel,tour,experiences,rentacar,onsen,station" && stripIdsFor("/map.html").join() === "rentacar,bus,jr-hotel,experiences,station,onsen-rotenburo" && stripIdsFor("/kagura/").join() === "jr-hotel,rentacar,bus,experiences,onsen-rotenburo,onsen" && stripIdsFor("/pref/", { skip: ["experiences"] }).join() === "jr-hotel,rentacar,bus,onsen-rotenburo,onsen" && ["/weekend.html", "/this-month.html", "/calendar.html", "/map.html", "/kagura/", "/pref/"].every((p) => stripIdsFor(p).length <= STRIP_MAX && new Set(stripIdsFor(p)).size === stripIdsFor(p).length && !stripIdsFor(p).some((id) => ["ryokan", "onsen-gensen"].includes(id))), "探すページの帯の並び: 両サイドのPR枠と同じバナーを右 → 左の順に、6つまで(じゃらんの宿・源泉の宿は入れない)");
      const kindFile = readdirSync(join(dir, "kagura")).find((f) => f !== "index.html"), prefFile = readdirSync(join(dir, "pref"))[0];
      const kindP = cheerio.load(readFileSync(join(dir, "kagura", kindFile), "utf8")), prefP = cheerio.load(readFileSync(join(dir, "pref", prefFile), "utf8")), page = (p) => loaded.find(([q]) => q === p)[1];
      const cal = page("calendar.html"), map = page("map.html"), wkP = page("weekend.html"), tmP = page("this-month.html");
      ok([cal, map, kindIndex, kindP, prefP].every(($$) => stripOf($$).length === 1 && !stripOf($$).is(".w") && oneOf(stripOf($$)).length === 1 && stripOf($$).find(".pr").length === 1 && stripOf($$).children().last().is(".pr.pr-foot") && stripOf($$).find("[data-vc-ad]").length === 0) && idOf(cal) === firstRk(stripIdsFor("/calendar.html")) && idOf(map) === firstRk(stripIdsFor("/map.html")) && idOf(kindIndex) === firstRk(stripIdsFor("/kagura/")) && idOf(kindP) === firstRk(stripIdsFor("/kagura/")) && idOf(prefP) === firstRk(stripIdsFor("/pref/", { skip: ["experiences"] })), "日付と場所・地図・種類・都道府県のページに、PRを1個ずつ(候補のうち、はじめの楽天のバナー。幅 1280px 未満で出す)", [cal, map, kindIndex, kindP, prefP].map(($$) => stripOf($$).length + ":" + idOf($$)).join(" / "));
      ok([wkP, tmP].every(($$) => stripOf($$).length === $$(".d-side").length && (!stripOf($$).length || (stripOf($$).is(".w") && stripOf($$).is(".d-side > :last-child") && stripOf($$).prev().is(".trip-band") && oneOf(stripOf($$)).length === 1))) && (!stripOf(wkP).length || idOf(wkP) === firstRk(stripIdsFor("/weekend.html"))), "今週末・今月のページは、右の列の宿の枠の下にPRを1個(開催がなく宿の枠が出ないときは、出さない)");
      // 2026-11-15 運営者の依頼: 一覧の途中に、5件ごとにはさむ(今月・今週末・日付と場所で探す)。中身は1個だけ。4本目からは、はさむたびに候補をずらす
      { const on = { rakuten: true, jalan: true, jtb: true, nta: true }, esc = (x) => String(x).replace(/&/g, "&amp;").replace(/"/g, "&quot;"), attrs = (_, name) => 'rel="sponsored noopener" target="_blank" data-goatcounter-click="' + name + '"';
        const mk = (k, o = {}) => cheerio.load(prStripHtml({ on, attrs, esc, wide: false, ids: stripIdsFor("/calendar.html"), inlist: true, rotate: k, ...o })), idOne = ($) => ($(".pr-strip-one > *").attr("data-goatcounter-click") || "").replace("rail-rakuten/strip-", "");
        const s0 = mk(0), withLead = mk(0, { lead: ['<a class="strip-banner strip-text" id="L1">1</a>', '<a class="strip-banner" id="L2">2</a>'] });
        ok(STRIP_EVERY === 5 && [0, 1, 2, 3, 4].map((k) => idOne(mk(k))).join() === "tour,experiences,rentacar,station,tour" && s0(".pr-strip-one > *").length === 1 && s0("[data-vc-ad]").length === 0 && s0("h2").length === 0 && s0("p.pr-strip-h").text() === "旅の手配" && s0(".pr").length === 1 && s0("aside").children().last().is(".pr.pr-foot") && withLead(".pr-strip-one > *").length === 1 && withLead(".pr-strip-one > *").attr("id") === "L1" && prStripHtml({ on: { rakuten: false, jalan: true, jtb: true, nta: true }, attrs, esc, ids: stripIdsFor("/calendar.html"), inlist: true }) === "" && cheerio.load(prStripHtml({ on, attrs, esc, ids: ["jr-hotel", "onsen", "bus"] }))(".pr-strip-one > *").attr("data-goatcounter-click") === "rail-rakuten/strip-bus", "1個だけのPR: 先頭のマスがあれば、その1個目。なければ、候補のうち同意の要らない楽天のバナー(4本目からは1つずつずらす)。見出しは h2 にしない。「PR」は1つ", [0, 1, 2, 3, 4].map((k) => idOne(mk(k))).join());
        const eventCards = ($) => $(".d-top > .card:not(.reg)").length, inl = ($) => $(".d-top > aside.pr-strip.inlist");
        ok([wkP, tmP].every(($) => inl($).length === Math.max(0, Math.floor((eventCards($) - 1) / STRIP_EVERY)) && inl($).toArray().every((x) => $(x).prevAll(".card:not(.reg)").length % STRIP_EVERY === 0 && $(x).next().is(".card") && $(x).is(".w") && $(x).find("[data-vc-ad]").length === 0)), "今月・今週末: 開催のカードの5件ごとに帯(あとにカードが続くときだけ)", [wkP, tmP].map(($) => eventCards($) + "件→" + inl($).length + "本").join(" / "));
        const src = readFileSync("scripts/build.mjs", "utf8"), calHtml = readFileSync(join(dir, "calendar.html"), "utf8"), m = calHtml.match(/var strips=(\[[\s\S]*?\]),EVERY=(\d+);/);
        const variants = m ? JSON.parse(m[1]) : [], oneId = (h) => cheerio.load(h)(".pr-strip-one > *").attr("data-goatcounter-click") || "";
        ok(!!m && +m[2] === STRIP_EVERY && variants.length === INLIST_THEMES.length + 4 && !m[1].includes("<") && variants.every((v, k) => { const $ = cheerio.load(v.l); return $("aside.pr-strip.inlist:not(.w)").length === 1 && $("[data-vc-ad]").length === 0 && v.l.includes('<div class="pr-strip-one">@LEAD@</div>') && $("p.pr-strip-h").text() === inlistTheme("/calendar.html", k).h; }) && variants.map((v) => oneId(v.b).replace("rail-rakuten/list@N@-", "")).join() === ["onsen-rotenburo", "", "experiences", "tour", "experiences", "rentacar", "station"].join() && variants[1].b === "" && calHtml.includes("var THEMES=" + INLIST_THEMES.length + ";") && calHtml.includes("(i+1)%EVERY===0&&i+1<xs.length") && calHtml.includes('<li class="pr-li">') && calHtml.includes("v=s?(h?s.l:s.b):''") && src.includes('withStrips(tmEvents.map((e) => ({ html: card(e), item: listItem(e, e.start.slice(0, 10), "event") })), "/this-month.html", { wide: true })') && src.includes('withStrips(items, "/weekend.html", { wide: true })'), "日付と場所で探す: 検索の結果の5件ごとにはさむ(スクリプトの中に、何本目かの形ごとに「先頭のマスを入れる形」と「バナーだけの形」を持つ)", variants.map((v) => oneId(v.b)).join(","));
        ok(css.includes("@media(min-width:960px){.dpage .pr-strip.inlist{display:none}}") && css.includes("@media(min-width:1280px) and (min-height:520px){.monthlist>.pr-li{display:none}}") && css.indexOf("@media(min-width:1280px) and (min-height:520px){.monthlist>.pr-li{display:none}}") > css.indexOf(".monthlist>.pr-li{display:block"), "はさむ帯は、一覧が1列になる画面だけ(2列の画面・両サイドのPR枠が出る画面では出さない)"); }
      // 2026-11-15 運営者の依頼(案1・案2・案4 → 同日「案3だけ」): 一覧の途中は、何本目かで中身を分ける。1本目 宿・2本目 協賛(なければ募集)・3本目 体験と行き方・4本目から バナー。協賛がいちばん先。クリックの名前に、何本目か
      { const esc2 = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
        const base = { affId: "AFF", today: "2026-11-20", stayArea: { "東栄町": "奥三河" }, esc: esc2, recruit: '<a class="strip-recruit" data-goatcounter-click="sponsor-recruit/list@N@">募集</a>' };
        const it = (city, day, prefecture = "島根県") => ({ prefecture, city, day });
        const five = [it("浜田市", "2026-11-22"), it("北設楽郡東栄町", "2026-11-30", "愛知県"), it("浜田市", "2026-11-21"), it("北設楽郡東栄町", "2026-12-01", "愛知県"), it("", "2026-11-25", "高知県")];
        const stayOf = (lead) => { const $ = cheerio.load(lead.join("")), a = $("a.strip-stay"), u = a.length ? new URL(a.attr("href")) : null, d = u ? new URL(u.searchParams.get("pc")) : null; return { $, a, u, d, days: d ? "f_nen1 f_tuki1 f_hi1 f_nen2 f_tuki2 f_hi2".split(" ").map((k) => d.searchParams.get(k)).join("/") : "" }; };
        const L0 = inlistLead(five, 0, 3, base), x0 = stayOf(L0);
        ok(L0.length === 1 && x0.a.length === 1 && x0.u.origin + x0.u.pathname === "https://hb.afl.rakuten.co.jp/hgc/AFF/" && x0.u.searchParams.get("m") === x0.u.searchParams.get("pc") && x0.d.origin + x0.d.pathname === "https://kw.travel.rakuten.co.jp/keyword/Search.do" && x0.d.searchParams.get("charset") === "utf-8" && x0.d.searchParams.get("f_query") === "浜田市" && x0.days === "2026/11/21/2026/11/22" && x0.d.searchParams.get("f_otona_su") === "2" && x0.d.searchParams.get("f_heya_su") === "1" && x0.a.attr("rel") === "sponsored noopener" && x0.a.attr("target") === "_blank" && x0.a.attr("data-goatcounter-click") === "rail-rakuten/list1-stay" && x0.a.find("b").text() === "11月21日(土)" && x0.a.find("span").text() === "浜田市周辺の宿", "帯の宿: 直前の5件でいちばん多い場所(同じ数なら先に出る方)の、いちばん早い日の1泊・大人2名を、楽天トラベルの検索で開く(楽天アフィリエイト経由)", x0.a.attr("href"));
        const x1 = stayOf(inlistLead([it("北設楽郡東栄町", "2026-11-30", "愛知県")], 0, 3, base)), x2 = stayOf(inlistLead([it("浜田市", "2026-11-10")], 0, 3, base)), x3 = stayOf(inlistLead([it("", "2026-11-25", "高知県"), it("a<b", "2026-11-26")], 0, 3, base));
        ok([1, 2, 3, 5].every((k) => stayOf(inlistLead(five, k, 6, base)).a.length === 0), "帯の宿は、1本目の帯だけ(案3: 何本目かで中身を分ける)");
        ok(x1.d.searchParams.get("f_query") === "奥三河" && x1.days === "2026/11/30/2026/12/1" && x2.days === "2026/11/20/2026/11/21" && x3.d.searchParams.get("f_query") === "高知県" && !x3.$.html().includes("a<b周辺"), "帯の宿: 郡は外し、呼びかえ(STAY_AREA)も同じ。月をまたぐ1泊。続いている開催は今日から。市町村がなければ県で探す", [x1.days, x2.days, x3.d.searchParams.get("f_query")].join(" / "));
        const has = (lead, sel) => cheerio.load(lead.join(""))(sel);
        ok(has(inlistLead(five, 1, 3, base), "a.strip-recruit").attr("data-goatcounter-click") === "sponsor-recruit/list2" && [[0, 1], [0, 3], [2, 3], [3, 5]].every(([k, t]) => has(inlistLead(five, k, t, base), "a.strip-recruit").length === 0) && inlistCount(5, 5) === 0 && inlistCount(6, 5) === 1 && inlistCount(11, 5) === 2 && inlistCount(0, 5) === 0, "協賛の募集: 一覧の2本目にだけ。名前に何本目か");
        const withSp = { ...base, sponsorTile: (x) => (x.city === "浜田市" ? '<a class="strip-sp">SP</a>' : "") }, Ls = inlistLead(five, 0, 3, withSp), noAff = inlistLead(five, 1, 3, { ...base, affId: "" });
        ok(Ls.length === 2 && Ls[0].includes("strip-sp") && has(Ls, "a.strip-sp + a.strip-stay").length === 1 && has(Ls, "a.strip-recruit").length === 0 && inlistLead(five, 1, 3, withSp)[0].includes("strip-sp") && has(inlistLead(five, 1, 3, withSp), "a.strip-recruit").length === 0 && inlistLead(five, 3, 5, withSp)[0].includes("strip-sp") && noAff.length === 1 && has(noAff, "a.strip-recruit").length === 1, "協賛: 5件のどれかに当てはまる協賛があれば、どの帯でも協賛がいちばん先(1個だけなので協賛が出る)。募集の代わりにもなる。楽天のIDがなければ宿は出さない");
        const spData = [{ id: "t-1", kind: "monthly", sponsor: "テスト観光協会", title: "浜田の宿", url: "https://example.com/", start: "2026-01-01", end: "2026-12-31", approved: true, contractRef: "x", placements: [{ page: "area", prefecture: "島根県", cities: ["浜田市"] }] }];
        const act = activeSponsors(spData, "2026-11-20"), tile = cheerio.load(listSponsorTile(act, "event", { prefecture: "島根県", city: "浜田市", id: "e" }, { esc: esc2 }))("a.strip-sp");
        ok(tile.length === 1 && tile.attr("rel") === "sponsored noopener" && tile.attr("target") === "_blank" && tile.attr("data-goatcounter-click") === "sponsor/t-1/inlist" && tile.find("small").text() === "提供: テスト観光協会" && listSponsorTile(act, "event", { prefecture: "島根県", city: "大田市", id: "e" }, { esc: esc2 }) === "" && listSponsorTile(activeSponsors(spData, "2027-01-01"), "event", { prefecture: "島根県", city: "浜田市", id: "e" }, { esc: esc2 }) === "", "協賛のマス: 開催のページに載る協賛と同じ決まり(地域・期間)で、契約を登録すれば自動で出て、期間が終われば消える。提供者の名前を出す");
        const listStrips = [wkP, tmP].flatMap(($) => $(".d-top > aside.pr-strip.inlist").toArray().map((x, k, all) => ({ $, s: $(x), k, n: all.length })));
        ok(listStrips.every(({ s, k }) => { const o = s.find(".pr-strip-one > *"), n = o.attr("data-goatcounter-click") || ""; return o.length === 1 && s.find("p.pr-strip-h").text() === inlistTheme("/", k).h && (o.is(".strip-sp") || (k === 0 ? n === "rail-rakuten/list1-stay" : k === 1 ? n === "sponsor-recruit/list2" : new RegExp("^rail-rakuten/list" + (k + 1) + "-[a-z-]+$").test(n))); }), "今月・今週末: 何本目かで中身を分ける(1本目 宿・2本目 協賛か募集・3本目 体験と行き方・4本目から バナー)。どれも1個だけ。名前に何本目か(listN)", listStrips.length + "本");
        ok([wkP, tmP].every(($) => { const all = $(".d-top > aside.pr-strip.inlist"), n = all.length, r = all.find("a.strip-recruit"), sp = all.find("a.strip-sp").length; return r.length <= 1 && (n < 2 || sp > 0 || r.length === 1) && r.toArray().every((x) => $(x).attr("href") === "/sponsor.html" && !$(x).attr("rel") && $(x).closest("aside").is(all.eq(1))); }), "今月・今週末: 協賛の募集は、2本目にだけ1回。サイトの中のリンク(広告の印 sponsored はつけない)");
        const calSrc = readFileSync(join(dir, "calendar.html"), "utf8"), calM = calSrc.match(/var strips=(\[[\s\S]*?\]),EVERY=(\d+);/), calV = calM ? JSON.parse(calM[1]) : [];
        ok(calSrc.includes(inlistLead.toString()) && calV.length > 0 && calV.every((v) => v.l.split("@LEAD@").length === 2 && (v.b === "" || /^rail-rakuten\/list@N@-[a-z-]+$/.test(cheerio.load(v.b)(".pr-strip-one > *").attr("data-goatcounter-click")))) && calSrc.includes("h=inlistLead(its,k,tot,LO)[0]||''") && /var LO=\{affId:"[^"]*",today:'',stayArea:\{.*\},recruit:"/.test(calSrc), "日付と場所で探す: 出す1個(先頭のマスの1個目か、なければバナー)と番号(@N@)は、ブラウザで検索の結果から決める(ビルドと同じ inlistLead をスクリプトに入れる)"); }
      // 一覧の途中を、開催が22件ある月で確かめる(テスト用のデータ。今日は 2026-10-09)。5件ごとに4本。
      // 1本目の5件は浜田市が3件 → 宿。2本目(東栄町)→ 協賛の募集。3本目(浜田市・大田市)→ 体験。4本目(江津市)→ 江津市の地域の協賛
      { const src = "dist-test-inlist-src"; mkdirSync(src, { recursive: true });
        const ev = (i, day, prefecture, city) => ({ id: "t-inl-" + i, name: "一覧の帯のテスト公演" + i, kagura: "石見神楽", prefecture, city, venue: "テスト会場" + i, start: day + "T19:00", end: day + "T21:00", fee: "無料", url: "https://example.com/inl" + i, description: "テスト用データです。", lat: 34.9, lng: 132.1, status: "published" });
        const plan = [["10-10", "島根県", "大田市"], ["10-11", "島根県", "浜田市"], ["10-12", "島根県", "浜田市"], ["10-13", "島根県", "大田市"], ["10-14", "島根県", "浜田市"], ...["10-15", "10-16", "10-17", "10-18", "10-19"].map((d) => [d, "愛知県", "北設楽郡東栄町"]), ["10-20", "島根県", "浜田市"], ["10-21", "島根県", "浜田市"], ...["10-22", "10-23", "10-24"].map((d) => [d, "島根県", "大田市"]), ...["10-25", "10-26", "10-27", "10-28", "10-29"].map((d) => [d, "島根県", "江津市"]), ["10-30", "島根県", "浜田市"], ["10-31", "島根県", "浜田市"]];
        writeFileSync(src + "/events.json", JSON.stringify(plan.map(([d, p, c], i) => ev(i, "2026-" + d, p, c))));
        writeFileSync(src + "/sponsors.json", JSON.stringify([{ id: "t-gotsu", kind: "monthly", sponsor: "テスト観光協会", title: "江津の宿と温泉", url: "https://example.com/sp", start: "2026-10-01", end: "2026-10-31", approved: true, contractRef: "test", placements: [{ page: "area", prefecture: "島根県", cities: ["江津市"] }] }]));
        const b2 = build(src + "/events.json", "dist-test-inlist", { TEST_AFF_TRAVEL: "1", SPONSORS_FILE: src + "/sponsors.json" });
        ok(b2.status === 0, "一覧の帯のテスト用ビルド", b2.stderr);
        if (b2.status === 0) {
          const $ = cheerio.load(readFileSync("dist-test-inlist/this-month.html", "utf8")), st = $(".d-top > aside.pr-strip.inlist"), one = (k) => st.eq(k).find(".pr-strip-one > *");
          const q = new URL(new URL(one(0).attr("href") || "https://x/?pc=https://x/").searchParams.get("pc")).searchParams;
          ok(st.length === 4 && st.toArray().every((x) => $(x).find(".pr-strip-one > *").length === 1) && st.toArray().map((x) => $(x).find("p.pr-strip-h").text()).join() === "宿を探す,地域の協賛,体験・行き方,旅の手配" && one(0).is("a.strip-stay") && one(0).find("b").text() === "10月11日(日)" && q.get("f_query") === "浜田市" && q.get("f_hi1") === "11" && one(2).attr("data-goatcounter-click") === "rail-rakuten/list3-experiences", "今月: どの帯も1個だけ。1本目は宿(直前の5件でいちばん多い場所の、いちばん早い日)、3本目は体験", st.toArray().map((x) => $(x).find(".pr-strip-one > *").attr("data-goatcounter-click")).join(","));
          ok(one(1).is("a.strip-recruit") && one(1).attr("data-goatcounter-click") === "sponsor-recruit/list2" && one(1).find("small").text() === "協賛枠 月額5,000円から" && one(3).is("a.strip-sp[data-sponsor=t-gotsu]") && one(3).attr("data-goatcounter-click") === "sponsor/t-gotsu/inlist" && st.find(".strip-recruit").length === 1, "今月: 2本目は協賛の募集(料金は設定から)。5件に当てはまる協賛は、その帯に出る(登録だけで出る。4本目にも)");
          const cal = readFileSync("dist-test-inlist/calendar.html", "utf8"), sp = cal.match(/SP=(\{.*?\});/);
          ok(!!sp && Object.keys(JSON.parse(sp[1])).sort().join() === ["t-inl-15", "t-inl-16", "t-inl-17", "t-inl-18", "t-inl-19"].sort().join() && !JSON.stringify(JSON.parse(sp[1])).includes("contractRef"), "日付と場所で探す: 協賛が当てはまる開催だけ、スクリプトに協賛のマスを持つ(契約の控えは載せない)", sp?.[1].slice(0, 200));
        } }
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
