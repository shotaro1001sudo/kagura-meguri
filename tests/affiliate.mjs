// GA4 affiliate-click regression checks (no external network calls).
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { renderedCheerio as cheerio } from "./rendered-vc.mjs";
import { VC } from "../scripts/lib/valuecommerce.mjs";
import { EXP_BANNER, expBannersHtml } from "../scripts/lib/stay-banners.mjs";
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
    const dir = "dist-test-ga4-affiliate", listChecks = []; // listChecks: 都道府県のページの一覧の帯を確かめる(下の、開催の多いテスト用のビルドでも使う)
    // 2026-11-15 運営者の依頼: 今週末・今月・日付と場所で探す・地図で探すページにも出す
    const railPages = ["events/t-full.html", "regular/r-nightly.html", ...readdirSync(join(dir, "pref")).slice(0, 1).map((f) => `pref/${f}`), ...readdirSync(join(dir, "kagura")).slice(0, 1).map((f) => `kagura/${f}`), "weekend.html", "this-month.html", "calendar.html", "map.html", "index.html"];
    const loaded = railPages.map((p) => [p, cheerio.load(readFileSync(join(dir, p), "utf8"))]);
    ok(loaded.every(([, $$]) => rails($$).length === 2 && rails($$).toArray().every((r) => $$(r).find(".pr-foot").length === 1 && $$(r).find(".rail-banner").length >= 1)), "開催・定期公演・県・種類のページに、左右のPR枠(枠ごとに「PR」1つ)", railPages.join(" "));
    // 2026-11-15 運営者の依頼: 自分たちのバナー(左 = 協賛のご案内、右 = 公演の掲載のご案内)を、上から3つ目に。サイトの中のリンク(広告の印・別タブにしない)
    // 同日「協賛ページ・主催者ページへの案内は、各公演ページには不要」: 開催・定期公演のページには出さない
    // 今週末・今月は、PR枠ではなく右の列の宿の枠の下に出す(同日の依頼)
    const eventPage = (p) => /^(events|regular)\/|^(weekend|this-month)\.html$/.test(p);
    ok(loaded.every(([p, $$]) => eventPage(p) ? $$(".side-rail .rail-self, .side-rail [data-self-pr]").length === 0 && (/^(events|regular)\//.test(p) ? $$("[data-self-pr]").length === 0 : true) : [["l", "sponsor", "/sponsor.html"], ["r", "organizers", "/organizers.html"]].every(([s, key, href]) => { const all = $$(`.side-rail-${s} .rail-banner`), self = $$(`.side-rail-${s} a.rail-banner.rail-self`); return self.length === 1 && all.index(self) === 2 && self.attr("href") === href && !self.attr("rel") && !self.attr("target") && !self.attr("data-banner-partner") && self.attr("data-goatcounter-click") === `pr-self/rail-${key}` && self.find("img").attr("src") === `/pr-${key}.svg` && self.find("img").attr("alt") && self.find("img").attr("width") === "600" && self.find("img").attr("loading") === "lazy"; })) && loaded.some(([p]) => eventPage(p)) && ["pr-sponsor.svg", "pr-organizers.svg", "pr-sponsor-wide.svg", "pr-organizers-wide.svg"].every((f) => existsSync(join(dir, f)) && readFileSync(join(dir, f), "utf8").startsWith("<svg")) && !readFileSync(join(dir, "pr-organizers.svg"), "utf8").includes("日程と会場") && !readFileSync(join(dir, "pr-organizers-wide.svg"), "utf8").includes("日程と会場") && fire({ label: "pr-self/rail-sponsor", sponsored: false }).length === 0, "PR枠の上から3つ目に、自分たちのバナー(左 協賛のご案内・右 公演の掲載のご案内)。公演ページ(開催・定期公演)には出さない。サイトの中のリンクで、広告のクリックには数えない", railPages.join(" "));
    ok(loaded.every(([, $$]) => $$("a.rail-banner:not(.rail-self)").toArray().every((a) => /^https:\/\/hb\.afl\.rakuten\.co\.jp\/hsc\//.test($$(a).attr("href")) && ($$(a).attr("rel") || "").includes("sponsored") && $$(a).attr("target") === "_blank" && /^rail-rakuten\//.test($$(a).attr("data-goatcounter-click")) && /^https:\/\/hbb\.afl\.rakuten\.co\.jp\/hsb\//.test($$(a).find("img").attr("src")) && $$(a).find("img").attr("alt") && $$(a).find("img").attr("loading") === "lazy")), "PR枠のバナーは、楽天の発行リンクと画像だけ(広告の印 sponsored・別タブ・代替テキスト・遅延読み込み)");
    // じゃらんnet は、バリューコマースの発行コードを広告の同意の仕組み(vcTag)で出す。発行コードのままのリンクと画像、計測の名前
    const vcRail = [["rail", "jalan"], ["railJtb", "jtb"], ["railNta", "nta"]];
    ok(loaded.every(([, $$]) => vcRail.every(([kind, partner]) => { const vc = $$(`.side-rail [data-vc-ad="${kind}"]`); const a = vc.find("a"); return vc.length === 1 && vc.is(".vc-ad.rail-banner") && vc.attr("data-banner-partner") === partner && new RegExp(`^rail-${partner}/`).test(vc.attr("data-goatcounter-click")) && a.attr("href") === `//ck.jp.ap.valuecommerce.com/servlet/referral?sid=${VC.sid}&pid=${VC[kind]}` && a.find("img").attr("src") === `//ad.jp.ap.valuecommerce.com/servlet/gifbanner?sid=${VC.sid}&pid=${VC[kind]}` && (a.attr("rel") || "").includes("sponsored") && a.find("img").attr("alt"); })), "PR枠のじゃらん・JTB・日本旅行は、発行コードのリンクと画像のまま、同意の仕組みの中に出す");
    ok(vcRail.every(([kind, partner]) => fire({ label: `rail-${partner}/x` })[0]?.[2]?.affiliate_partner === partner) && new Set(Object.values(VC)).size === Object.values(VC).length, "PR枠のバリューコマースの広告のクリックも GA4 で数え、発行コードの番号は重ならない");
    // 2026-11-15 運営者の依頼: PR枠の上端は、本文の宿の枠(会場周辺の宿・◯◯県の宿など)の上端にそろえる
    // 今週末・今月は、開催がないと宿の枠が出ない(そのときは上から96px)。日付・場所で探すページは探す条件の枠(.finder)、地図で探すページは地図(.mapbox)、
    // 種類で探すページ(kagura/index.html)は最初のカードの並び(.kagura-region .cardgrid)にそろえる
    // 2026-11-15 運営者の依頼「全公演ページで統一」: 公演ページ(開催・定期公演)は、どれも 右の列(.d-side)の上端 = 要点の枠(.keyinfo)の上端 にそろえる。
    // 宿の枠がない公演も、右の列がない終了した開催(要点の枠にそろえる)も、同じ決まりで、上から96px のままにしない
    // 2026-11-15 運営者の依頼: 各神楽のページは「歴史」の枠(くわしい情報の最初の枠 .kagura-folds)、トップは月の最初の公演のカード(#list .card)にそろえる
    const RAIL_ANCHOR = "main .keyinfo, main .stay, main .kagura-folds, main aside.aff, main .finder, main .mapbox, main .kagura-region .cardgrid, main #list .card";
    const kindIndex = cheerio.load(readFileSync(join(dir, "kagura/index.html"), "utf8"));
    const railJs = readFileSync("scripts/client/side-rail.js", "utf8");
    ok(loaded.every(([p, $$]) => (/^(weekend\.html|this-month\.html)/.test(p) || $$("main .d-side").length >= 1 || $$(RAIL_ANCHOR).length >= 1) && $$("script").toArray().some((s) => $$(s).html().includes("--rail-top"))) && /top:var\(--rail-top,96px\)/.test(readFileSync("scripts/style.css", "utf8")) && railJs.includes(`document.querySelector("main .d-side") ||`) && railJs.includes(`"${RAIL_ANCHOR}"`), "PR枠の上端を本文の枠(公演ページは右の列と要点の枠、日付・場所で探すページは探す条件の枠、地図で探すページは地図)にそろえるスクリプトを読み込み、その枠がページにある(動かないときは上から96px)", railPages.join(" "));
    { const eventPages = [...readdirSync(join(dir, "events")).map((f) => `events/${f}`), ...readdirSync(join(dir, "regular")).map((f) => `regular/${f}`)].filter((p) => p.endsWith(".html")).map((p) => [p, cheerio.load(readFileSync(join(dir, p), "utf8"))]);
      const bad = eventPages.filter(([, $$]) => !(rails($$).length === 2 && $$("main .keyinfo").length === 1 && $$("script").toArray().some((s) => $$(s).html().includes("--rail-top")))).map(([p]) => p);
      ok(eventPages.length >= 3 && bad.length === 0 && eventPages.some(([, $$]) => $$("main .d-side").length === 0) && eventPages.some(([, $$]) => $$("main .d-side").length === 1), "公演ページは、開催中・終了・定期公演のどれも、PR枠を同じ決まり(要点の枠・右の列の上端)でそろえられる", bad.join(" ")); }
    ok(rails(kindIndex).length === 2 && kindIndex(RAIL_ANCHOR).first().is(".cardgrid") && kindIndex("main .kagura-region").first().find(".cardgrid .card").length >= 1 && kindIndex("script").toArray().some((s) => kindIndex(s).html().includes("--rail-top")), "種類で探すページのPR枠は、上端を最初のカードの並びにそろえる(2026-11-15 運営者の依頼)");
    { // ページごとの並び(RAIL_ORDER): 探すページ4つは、左右に4つずつ・同じバナーは1ページに1回。同意がなくても出る楽天のバナーが、左右に2つ以上残る
      const ids = ($$, s) => $$(`.side-rail-${s} .rail-banner:not(.rail-self)`).toArray().map((x) => $$(x).attr("data-goatcounter-click").replace(/^rail-[a-z]+\//, ""));
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
      ok(css.includes("@media(min-width:1400px) and (min-height:520px){.pr-strip.w{display:none}}") && css.includes("@media(min-width:1280px) and (min-height:520px){.pr-strip:not(.w){display:none}}") && /\.pr-strip-one>\.strip-banner:not\(\[hidden\]\)\{[^}]*width:100%/.test(css) && /\.pr-strip-one>\.strip-banner\.strip-text:not\(\[hidden\]\)\{[^}]*max-width:none/.test(css) && css.includes(".pr-strip-one>.strip-banner.sq:not([hidden]){max-width:260px}") && strips.every(([, $$, s]) => oneOf(s).filter("a.strip-banner:not(.strip-text)").toArray().every((a) => $$(a).is(".sq") === ($$(a).find("img").attr("width") === $$(a).find("img").attr("height")))) && prCss.length > 0 && !prCss.includes("overflow-x:auto") && !css.includes(".pr-strip-row") && !/\.pr-strip[^{]*\{[^}]*position:(fixed|sticky)/.test(css) && fire({ label: "rail-rakuten/strip-bus" })[0]?.[2]?.affiliate_placement === "side_rail" && fire({ label: "rail-rakuten/strip-bus" })[0]?.[2]?.affiliate_content_id === "strip-bus", "PRは1個だけで、枠の幅いっぱい(横に送る列にしない)。画面に固定しない。両サイドのPR枠が出る画面では出さない。クリックは 配置 side_rail・中身 strip-… で数える");
      // 2026-11-15 運営者の依頼: 探すページ(今週末・今月・日付と場所・地図・種類・都道府県)にも出す。候補は、そのページの両サイドのPR枠と同じバナー(右 → 左の順)で、はじめの楽天のバナーを出す
      const stripOf = ($$) => $$("aside.pr-strip:not(.inlist)"), idOf = ($$) => nameOf(stripOf($$)).replace(/^rail-[a-z]+\/strip-/, "");
      ok(stripIdsFor("/weekend.html").join() === "rentacar,bus,experiences,jr-hotel,onsen-rotenburo,onsen" && stripIdsFor("/this-month.html").join() === "jr-hotel,rentacar,bus,experiences,onsen-rotenburo,onsen" && stripIdsFor("/calendar.html").join() === "jr-hotel,tour,experiences,rentacar,onsen,station" && stripIdsFor("/map.html").join() === "rentacar,bus,jr-hotel,experiences,station,onsen-rotenburo" && stripIdsFor("/kagura/").join() === "jr-hotel,rentacar,bus,experiences,onsen-rotenburo,onsen" && stripIdsFor("/pref/", { skip: ["experiences"] }).join() === "jr-hotel,rentacar,bus,onsen-rotenburo,onsen" && ["/weekend.html", "/this-month.html", "/calendar.html", "/map.html", "/kagura/", "/pref/"].every((p) => stripIdsFor(p).length <= STRIP_MAX && new Set(stripIdsFor(p)).size === stripIdsFor(p).length && !stripIdsFor(p).some((id) => ["ryokan", "onsen-gensen"].includes(id))), "探すページの帯の並び: 両サイドのPR枠と同じバナーを右 → 左の順に、6つまで(じゃらんの宿・源泉の宿は入れない)");
      const kindFile = readdirSync(join(dir, "kagura")).find((f) => f !== "index.html"), prefFile = readdirSync(join(dir, "pref"))[0];
      const kindP = cheerio.load(readFileSync(join(dir, "kagura", kindFile), "utf8")), prefP = cheerio.load(readFileSync(join(dir, "pref", prefFile), "utf8")), page = (p) => loaded.find(([q]) => q === p)[1];
      const cal = page("calendar.html"), map = page("map.html"), wkP = page("weekend.html"), tmP = page("this-month.html");
      ok([cal, map, kindIndex, kindP, prefP].every(($$) => stripOf($$).length === 1 && !stripOf($$).is(".w") && oneOf(stripOf($$)).length === 1 && stripOf($$).find(".pr").length === 1 && stripOf($$).children().last().is(".pr.pr-foot") && stripOf($$).find("[data-vc-ad]").length === 0) && idOf(cal) === firstRk(stripIdsFor("/calendar.html")) && idOf(map) === firstRk(stripIdsFor("/map.html")) && idOf(kindIndex) === firstRk(stripIdsFor("/kagura/")) && idOf(kindP) === firstRk(stripIdsFor("/kagura/")) && idOf(prefP) === firstRk(stripIdsFor("/pref/", { skip: ["experiences"] })), "日付と場所・地図・種類・都道府県のページに、PRを1個ずつ(候補のうち、はじめの楽天のバナー。幅 1280px 未満で出す)", [cal, map, kindIndex, kindP, prefP].map(($$) => stripOf($$).length + ":" + idOf($$)).join(" / "));
      ok([wkP, tmP].every(($$) => stripOf($$).length === $$(".d-side").length && (!stripOf($$).length || (stripOf($$).is(".w") && stripOf($$).is(".d-side > :last-child") && stripOf($$).prev().is(".self-pair") && stripOf($$).prev().prev().is(".trip-band") && oneOf(stripOf($$)).length === 1))) && (!stripOf(wkP).length || idOf(wkP) === firstRk(stripIdsFor("/weekend.html"))), "今週末・今月のページは、右の列の宿の枠の下にPRを1個(開催がなく宿の枠が出ないときは、出さない)");
      // 2026-11-15 運営者の依頼「PC版の今週末・今月の協賛・主催者向けのPRは、週末の宿を探すの下に2つ横並び」
      ok([[wkP, "weekend"], [tmP, "this-month"]].every(([$$, page]) => { const sp = $$(".d-side > .self-pair"), a = sp.children("a"); return $$(".d-side").length === 0 || (sp.length === 1 && sp.prev().is(".trip-band") && a.length === 2 && a.eq(0).attr("href") === "/sponsor.html" && a.eq(1).attr("href") === "/organizers.html" && a.toArray().every((x) => !$$(x).attr("rel") && !$$(x).attr("target") && /^pr-self\/(weekend|this-month)-(sponsor|organizers)$/.test($$(x).attr("data-goatcounter-click")) && $$(x).find("img").attr("width") === "600") && a.eq(0).attr("data-goatcounter-click") === `pr-self/${page}-sponsor`); }) && wkP(".d-side").length + tmP(".d-side").length >= 1 &&css.includes(".self-pair{display:none}") && css.includes("@media(min-width:960px){.d-side .self-pair{display:grid;grid-template-columns:1fr 1fr;"), "今週末・今月: 協賛のご案内と公演の掲載のご案内を、右の列の宿の枠の下に2つ横並び(右の列がある画面だけ。PR枠には出さない)");
      // 同日の依頼「各神楽のページの両サイドのPRは『◯◯とは』の高さに」→ さらに「『歴史』タブの高さに」: くわしい情報の枠(最初が「歴史」)が、そろえる相手の中でいちばん先に出てくる
      { const kp = readdirSync(join(dir, "kagura")).filter((f) => f !== "index.html").map((f) => cheerio.load(readFileSync(join(dir, "kagura", f), "utf8")));
        ok(kp.length > 0 && kp.every(($$) => rails($$).length === 2 && $$(RAIL_ANCHOR).first().is(".kagura-folds") && $$(".kagura-folds > .kfold").first().is("#k-history")), "各神楽のページのPR枠は、「歴史」の枠の上端にそろえる", kp.map(($$) => $$(RAIL_ANCHOR).first().attr("class")).join(" / ")); }
      // 同日の依頼「各◯◯県の神楽のページで、◯◯県の宿の下に、同じ枠の大きさで『◯◯県の体験』を。じゃらんやアソビューなど、宿と同じバナー画像の大きさと配置で」
      // 「スマホ版の各公演一覧へのPRは、ほかのページに合わせて」(今週末・今月と同じ、5件ごとの横長の帯)
      { const prefs = readdirSync(join(dir, "pref")).filter((f) => f.endsWith(".html")).map((f) => [f.replace(/\.html$/, ""), cheerio.load(readFileSync(join(dir, "pref", f), "utf8"))]);
        const ga = (x, partner, $$) => $$(x).attr("data-affiliate-category") === "experiences" && $$(x).attr("data-affiliate-partner") === partner && $$(x).attr("data-affiliate-placement") === "nearby_experiences" && /^[-a-z0-9]{1,48}$/.test($$(x).attr("data-affiliate-id") || "");
        const badExp = prefs.filter(([p, $$]) => { const ex = $$("main aside.aff.aff-exp"), rk = ex.find("a.stay-banner"), vc = ex.find("[data-vc-ad]");
          const stay = ex.prev().is("#hiroshima-stay") ? ex.prev().children("aside.aff") : ex.prev();
          return !(ex.length === 1 && stay.is("aside.aff:not(.aff-exp)") && stay.children("h2").text() === `${p}の宿` && ex.children("h2").text() === `${p}の体験` && ex.children(".stay-banners").length === 1 && ex.children().last().is(".pr.pr-foot") && ex.find(".pr").length === 1
            && rk.length === 1 && rk.attr("href") === EXP_BANNER.url && rk.find("img").attr("src") === EXP_BANNER.imageUrl && rk.find("img").attr("width") === "486" && rk.find("img").attr("height") === "60" && rk.find("img").attr("alt") && (rk.attr("rel") || "").includes("sponsored") && rk.attr("target") === "_blank" && rk.attr("data-goatcounter-click") === `experience-rakuten/pref-${p}` && ga(rk, "rakuten", $$)
            && ["", "activityWide"].includes(vc.toArray().map((x) => $$(x).attr("data-vc-ad")).join()) && vc.toArray().every((x) => { const a = $$(x).find("a"), k = $$(x).attr("data-vc-ad"); return $$(x).is(".stay-banner") && !$$(x).attr("data-vc-media") && a.attr("href") === `//ck.jp.ap.valuecommerce.com/servlet/referral?sid=${VC.sid}&pid=${VC[k]}` && a.find("img").attr("src") === `//ad.jp.ap.valuecommerce.com/servlet/gifbanner?sid=${VC.sid}&pid=${VC[k]}` && ga(x, "vc-jalan-activity", $$); }));
        }).map(([p]) => p);
        const css = readFileSync("scripts/style.css", "utf8");
        ok(prefs.length > 0 && badExp.length === 0 && css.includes(":is(.aff,.pref-stay)+.aff-exp{margin-top:16px}"), "都道府県のページ: 「◯◯県の宿」のすぐ下に、同じ枠で「◯◯県の体験」(楽天 486×60・じゃらん 468×60 の発行バナー。宿の枠と同じ並び。体験の広告として数える)", badExp.join(" "));
        ok(cheerio.load(expBannersHtml({ on: { rakuten: true, vc: true }, id: "宮崎県", attrs: (_, n) => `rel="sponsored noopener" target="_blank" data-goatcounter-click="${n}"`, esc: (x) => String(x).replace(/&/g, "&amp;").replace(/"/g, "&quot;") }))("a.stay-banner, [data-vc-ad]").length === 2 && VC.activityWide === "892748794", "体験の枠のバナーは2つまで(楽天とじゃらん。3つは見づらいという運営者の指摘)。じゃらんは宿と同じ 468×60 で発行したもので、広告の同意があるときだけ出る");
        // 2026-11-15 運営者の依頼: 下部の「◯◯県の神楽について」は冒頭の説明に集約し、「周辺体験」の欄は外し、「神楽の町を応援する」は一覧の途中(月の変わり目)へ
        var layoutCheck = (d) => readdirSync(join(d, "pref")).filter((f) => f.endsWith(".html")).map((f) => [f, cheerio.load(readFileSync(join(d, "pref", f), "utf8"))]).filter(([, $$]) => { const m = $$("main"), more = m.find(".more-picks");
          if (m.find("section.detail h2").toArray().some((h) => /の神楽について$/.test($$(h).text())) || m.find("#nearby-experiences").length) return true;
          if (!more.length) return false;
          const months = m.find("p.mhead, section.pref-month").length, next = more.nextAll(".card, p.mhead, section.pref-month, h2").first();
          return more.length !== 1 || !more.prevAll(".card, section.pref-month").length || (months > 1 && !next.is("p.mhead, section.pref-month")); }).map(([p]) => p);
        const badLayout = layoutCheck(dir);
        ok(prefs.length > 0 && badLayout.length === 0, "都道府県のページ: 下部の説明と周辺体験の欄はなく、「神楽の町を応援する」は出るなら一覧の途中の月の変わり目", badLayout.join(" "));
        listChecks.push((d) => readdirSync(join(d, "pref")).filter((f) => f.endsWith(".html")).map((f) => [f, cheerio.load(readFileSync(join(d, "pref", f), "utf8"))]).filter(([, $$]) => { const seq = $$("main .card, main aside.pr-strip.inlist").toArray().filter((x) => !$$(x).closest("details").length), strips = $$("main aside.pr-strip.inlist");
          if ($$(".ended-note").length) return strips.length !== 0;
          let n = 0; const at = [];
          for (const x of seq) { if ($$(x).is(".card")) n++; else at.push(n); }
          return !(strips.length === inlistCount(n, STRIP_EVERY) && at.every((c, k) => c === (k + 1) * STRIP_EVERY && c < n) && strips.toArray().every((x, k) => { const s = $$(x), o = s.find(".pr-strip-one > *"); return !s.is(".w") && o.length === 1 && s.find("p.pr-strip-h").text() === inlistTheme("/pref/", k).h && (o.is(".strip-land") || o.is(".strip-card") || o.is(".strip-sp")) && !o.is(".sq") && s.find("[data-vc-ad]").length === 0; }));
        }).map(([p]) => p));
        listChecks.push(layoutCheck);
        const badList = listChecks[0](dir);
        ok(badList.length === 0 && readFileSync("scripts/build.mjs", "utf8").includes('stripAfter([...list.map((e) => listItem(e, e.start.slice(0, 10), "event")), ...reg.map((r) => listItem(r, today, "regular"))], "/pref/", {})'), "都道府県のページ(スマホ): 開催予定と定期公演を通して5件ごとに、今週末・今月と同じ横長の帯(何本目かで中身を分ける。両サイドのPR枠が出る画面では出さない)", badList.join(" ")); }
      // 同日の依頼「トップの両サイドにもPR。月の公演カードの最初の枠に合わせる。スマホは今週末・今月の一覧と同じ」
      { const ids = ($$, s) => $$(`.side-rail-${s} .rail-banner:not(.rail-self)`).toArray().map((x) => $$(x).attr("data-goatcounter-click").replace(/^rail-[a-z]+\//, ""));
        const home = page("index.html"), rows = home("#list [data-r]"), shown = rows.filter(":not(.ov)").length, placed = home("#list .home-pr"), pool = home("#home-pr-pool"), all = home(".home-pr");
        ok(rails(home).length === 2 && home(RAIL_ANCHOR).first().is("#list .card") && ids(home, "r")[0] === "jr-hotel" && home(".side-rail-l a.rail-self").attr("href") === "/sponsor.html" && home(".side-rail-r a.rail-self").attr("href") === "/organizers.html", "トップ: 両サイドのPR枠を出し、上端は月の最初の公演のカードにそろえる(自分たちのバナーも3つ目に)");
        ok(all.length === inlistCount(rows.length, STRIP_EVERY) && placed.length === inlistCount(shown, STRIP_EVERY) && placed.toArray().every((x, k) => home(x).attr("data-k") === String(k) && rows.index(home(x).prev("[data-r]")[0]) % STRIP_EVERY === STRIP_EVERY - 1) && (all.length === placed.length || (pool.attr("hidden") !== undefined && +pool.attr("data-every") === STRIP_EVERY)) && all.toArray().every((x) => { const s = home(x).find("aside.pr-strip.inlist"), o = s.find(".pr-strip-one > *"); return s.length === 1 && !s.is(".w") && s.find("p.pr-strip-h").text() === inlistTheme("/", +home(x).attr("data-k")).h && (o.is(".strip-land") || o.is(".strip-card")) && !o.is(".sq"); }) && readFileSync("scripts/client/home.js", "utf8").includes("placeStrips()"), "トップ(スマホ): 見えている開催の5件ごとに、今週末・今月と同じ横長の帯(何本目かで中身を分ける)。絞り込むと、ブラウザが置き直す", `${rows.length}件 → ${all.length}本(最初に置くのは ${placed.length}本)`); }
      // 2026-11-15 運営者の依頼: 一覧の途中に、5件ごとにはさむ(今月・今週末・日付と場所で探す)。中身は1個だけ。4本目からは、はさむたびに候補をずらす
      { const on = { rakuten: true, jalan: true, jtb: true, nta: true }, esc = (x) => String(x).replace(/&/g, "&amp;").replace(/"/g, "&quot;"), attrs = (_, name) => 'rel="sponsored noopener" target="_blank" data-goatcounter-click="' + name + '"';
        const mk = (k, o = {}) => cheerio.load(prStripHtml({ on, attrs, esc, wide: false, ids: stripIdsFor("/calendar.html"), inlist: true, rotate: k, ...o })), idOne = ($) => ($(".pr-strip-one > *").attr("data-goatcounter-click") || "").replace("rail-rakuten/strip-", "");
        const s0 = mk(0), withLead = mk(0, { lead: ['<a class="strip-banner strip-text" id="L1">1</a>', '<a class="strip-banner" id="L2">2</a>'] });
        ok(STRIP_EVERY === 5 && [0, 1, 2, 3, 4].map((k) => idOne(mk(k))).join() === "tour,experiences,rentacar,station,tour" && s0(".pr-strip-one > *").length === 1 && s0("[data-vc-ad]").length === 0 && s0("h2").length === 0 && s0("p.pr-strip-h").text() === "旅の手配" && s0(".pr").length === 1 && s0("aside").children().last().is(".pr.pr-foot") && withLead(".pr-strip-one > *").length === 1 && withLead(".pr-strip-one > *").attr("id") === "L1" && prStripHtml({ on: { rakuten: false, jalan: true, jtb: true, nta: true }, attrs, esc, ids: stripIdsFor("/calendar.html"), inlist: true }) === "" && cheerio.load(prStripHtml({ on, attrs, esc, ids: ["jr-hotel", "onsen", "bus"] }))(".pr-strip-one > *").attr("data-goatcounter-click") === "rail-rakuten/strip-bus", "1個だけのPR: 先頭のマスがあれば、その1個目。なければ、候補のうち同意の要らない楽天のバナー(4本目からは1つずつずらす)。見出しは h2 にしない。「PR」は1つ", [0, 1, 2, 3, 4].map((k) => idOne(mk(k))).join());
        const eventCards = ($) => $(".d-top > .card:not(.reg)").length, inl = ($) => $(".d-top > aside.pr-strip.inlist");
        ok([wkP, tmP].every(($) => inl($).length === Math.max(0, Math.floor((eventCards($) - 1) / STRIP_EVERY)) && inl($).toArray().every((x) => $(x).prevAll(".card:not(.reg)").length % STRIP_EVERY === 0 && $(x).next().is(".card") && $(x).is(".w") && $(x).find("[data-vc-ad]").length === 0)), "今月・今週末: 開催のカードの5件ごとに帯(あとにカードが続くときだけ)", [wkP, tmP].map(($) => eventCards($) + "件→" + inl($).length + "本").join(" / "));
        const src = readFileSync("scripts/build.mjs", "utf8"), calHtml = readFileSync(join(dir, "calendar.html"), "utf8"), m = calHtml.match(/var strips=(\[[\s\S]*?\]),EVERY=(\d+);/);
        const variants = m ? JSON.parse(m[1]) : [], oneId = (h) => cheerio.load(h)(".pr-strip-one > *").attr("data-goatcounter-click") || "";
        ok(!!m && +m[2] === STRIP_EVERY && variants.length === INLIST_THEMES.length + 4 && !m[1].includes("<") && variants.every((v, k) => { const $ = cheerio.load(v.l); return $("aside.pr-strip.inlist:not(.w)").length === 1 && $("[data-vc-ad]").length === 0 && v.l.includes('<div class="pr-strip-one">@LEAD@</div>') && $("p.pr-strip-h").text() === inlistTheme("/calendar.html", k).h; }) && variants.map((v) => oneId(v.b).replace("rail-rakuten/list@N@-", "")).join() === ["pr-self/list@N@-organizers", "onsen-rotenburo", "pr-self/list@N@-sponsor", "experiences", "tour", "experiences", "rentacar", "station"].join() && calHtml.includes("var THEMES=" + INLIST_THEMES.length + ";") && calHtml.includes("(i+1)%EVERY===0&&i+1<xs.length") && calHtml.includes('<li class="pr-li">') && calHtml.includes("v=s?(h?s.l:s.b):''") && src.includes('withStrips(tmEvents.map((e) => ({ html: card(e), item: listItem(e, e.start.slice(0, 10), "event") })), "/this-month.html", { wide: true })') && src.includes('withStrips(items, "/weekend.html", { wide: true })'), "日付と場所で探す: 検索の結果の5件ごとにはさむ(スクリプトの中に、何本目かの形ごとに「先頭のマスを入れる形」と「バナーだけの形」を持つ)", variants.map((v) => oneId(v.b)).join(","));
        ok(css.includes("@media(min-width:960px){.dpage .pr-strip.inlist{display:none}}") && css.includes("@media(min-width:1280px) and (min-height:520px){.monthlist>.pr-li{display:none}}") && css.indexOf("@media(min-width:1280px) and (min-height:520px){.monthlist>.pr-li{display:none}}") > css.indexOf(".monthlist>.pr-li{display:block"), "はさむ帯は、一覧が1列になる画面だけ(2列の画面・両サイドのPR枠が出る画面では出さない)"); }
      // 2026-11-15 運営者の依頼: 一覧の途中は、何本目かで中身を分ける。同日「宿は特定の場所でなくてよい・バナー画像を」「協賛ページへのバナー」「公演掲載のPRを1本目に」で、
      // 1本目 公演の掲載のご案内・2本目 宿(楽天のバナー)・3本目 協賛のご案内・4本目 体験と行き方・5本目から バナー。当てはまる契約中の協賛がいちばん先。クリックの名前に、何本目か
      { const esc2 = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
        const it = (city, day, prefecture = "島根県") => ({ prefecture, city, day });
        const five = [it("浜田市", "2026-11-22"), it("北設楽郡東栄町", "2026-11-30", "愛知県"), it("浜田市", "2026-11-21"), it("北設楽郡東栄町", "2026-12-01", "愛知県"), it("", "2026-11-25", "高知県")];
        const withSp = { sponsorTile: (x) => (x.city === "浜田市" ? '<a class="strip-sp">SP</a>' : "") };
        ok([0, 1, 2, 3, 5].every((k) => inlistLead(five, k, 6, {}).length === 0 && inlistLead(five, k, 6, withSp).join() === '<a class="strip-sp">SP</a>' && inlistLead(five.filter((x) => x.city !== "浜田市"), k, 6, withSp).length === 0) && inlistCount(5, 5) === 0 && inlistCount(6, 5) === 1 && inlistCount(11, 5) === 2 && inlistCount(0, 5) === 0, "先頭のマスは、5件のどれかに当てはまる契約中の協賛だけ(どの帯でも、協賛がいちばん先。なければ、その帯のバナー)");
        ok(INLIST_THEMES.map((t) => t.h + ":" + (t.self || t.ids[0])).join() === "公演を掲載しませんか:organizers,宿を探す:onsen-rotenburo,地域の協賛:sponsor,体験・行き方:experiences" && inlistTheme("/weekend.html", 4).rotate === 0 && inlistTheme("/weekend.html", 5).rotate === 1 && !inlistTheme("/weekend.html", 4).self, "一覧の途中の帯の並び: 1本目 公演の掲載・2本目 宿・3本目 協賛のご案内・4本目 体験と行き方・5本目から 候補を1つずつずらす");
        const spData = [{ id: "t-1", kind: "monthly", sponsor: "テスト観光協会", title: "浜田の宿", url: "https://example.com/", start: "2026-01-01", end: "2026-12-31", approved: true, contractRef: "x", placements: [{ page: "area", prefecture: "島根県", cities: ["浜田市"] }] }];
        const act = activeSponsors(spData, "2026-11-20"), tile = cheerio.load(listSponsorTile(act, "event", { prefecture: "島根県", city: "浜田市", id: "e" }, { esc: esc2 }))("a.strip-sp");
        ok(tile.length === 1 && tile.attr("rel") === "sponsored noopener" && tile.attr("target") === "_blank" && tile.attr("data-goatcounter-click") === "sponsor/t-1/inlist" && tile.find("small").text() === "提供: テスト観光協会" && listSponsorTile(act, "event", { prefecture: "島根県", city: "大田市", id: "e" }, { esc: esc2 }) === "" && listSponsorTile(activeSponsors(spData, "2027-01-01"), "event", { prefecture: "島根県", city: "浜田市", id: "e" }, { esc: esc2 }) === "", "協賛のマス: 開催のページに載る協賛と同じ決まり(地域・期間)で、契約を登録すれば自動で出て、期間が終われば消える。提供者の名前を出す");
        const listStrips = [wkP, tmP].flatMap(($) => $(".d-top > aside.pr-strip.inlist").toArray().map((x, k, all) => ({ $, s: $(x), k, n: all.length })));
        const want = (k) => (k === 0 ? "pr-self/list1-organizers" : k === 2 ? "pr-self/list3-sponsor" : new RegExp("^rail-rakuten/list" + (k + 1) + "-" + (k === 1 ? "onsen-rotenburo" : k === 3 ? "experiences" : "[a-z-]+") + "$"));
        ok(listStrips.every(({ s, k }) => { const o = s.find(".pr-strip-one > *"), n = o.attr("data-goatcounter-click") || "", w = want(k); return o.length === 1 && s.find("p.pr-strip-h").text() === inlistTheme("/", k).h && (o.is(".strip-sp") || (typeof w === "string" ? n === w : w.test(n))); }), "今月・今週末: 何本目かで中身を分ける(1本目 公演の掲載・2本目 宿・3本目 協賛のご案内・4本目 体験と行き方・5本目から バナー)。どれも1個だけ。名前に何本目か(listN)", listStrips.length + "本");
        ok([wkP, tmP].every(($) => $(".d-top > aside.pr-strip.inlist a.strip-self").toArray().every((x) => { const a = $(x), key = a.attr("data-self-pr"); return ["sponsor", "organizers"].includes(key) && a.attr("href") === (key === "sponsor" ? "/sponsor.html" : "/organizers.html") && !a.attr("rel") && !a.attr("target") && a.is(".strip-land") && !a.is(".sq") && a.find("img").attr("src") === `/pr-${key}-wide.svg` && a.find("img").attr("width") === "720" && a.find("img").attr("height") === "300" && a.find("img").attr("alt"); })) && $(".strip-stay, .strip-recruit").length === 0, "自分たちのバナーは、サイトの中のリンク(広告の印 sponsored・別タブにしない)。今週末・今月の一覧では横長の絵(Claude が作った SVG)");
        // 同日「今週末・今月の一覧の中のPRは、公演カードと同じくらいの横長のバナーに」: 楽天のバナーは、左に絵・右に文字の横長のカード
        const rkIn = [wkP, tmP].flatMap(($) => $(".d-top > aside.pr-strip.inlist a[data-banner-partner=rakuten]").toArray().map((x) => $(x)));
        ok(rkIn.every((a) => a.is(".strip-banner.strip-card") && !a.is(".sq") && a.find("img").attr("alt") === "" && a.find("img").attr("width") && a.find("b").text().length > 0 && /で見る ›$/.test(a.find("small").text()) && (a.attr("rel") || "").includes("sponsored") && a.attr("target") === "_blank") && css.includes(".pr-strip-one>.strip-banner.strip-land:not([hidden]){max-width:400px}") && /\.pr-strip-one>\.strip-banner\.strip-card:not\(\[hidden\]\)\{display:flex/.test(css), "今週末・今月の一覧の楽天のPRは、横長のカード(左に絵・右に文字。広告の印・別タブ)。自分たちのバナーは横長の絵(タブレットでは 400px まで)", rkIn.length + "個");
        const calSrc = readFileSync(join(dir, "calendar.html"), "utf8"), calM = calSrc.match(/var strips=(\[[\s\S]*?\]),EVERY=(\d+);/), calV = calM ? JSON.parse(calM[1]) : [];
        ok(calSrc.includes(inlistLead.toString()) && calV.length > 0 && calV.every((v) => v.l.split("@LEAD@").length === 2 && (v.b === "" || /^(rail-rakuten|pr-self)\/list@N@-[a-z-]+$/.test(cheerio.load(v.b)(".pr-strip-one > *").attr("data-goatcounter-click")))) && calSrc.includes("h=inlistLead(its,k,tot,LO)[0]||''") && calSrc.includes("var LO={sponsorTile:function(x){return SP[x.id]||''}}"), "日付と場所で探す: 出す1個(当てはまる協賛か、なければ帯のバナー)と番号(@N@)は、ブラウザで検索の結果から決める(ビルドと同じ inlistLead をスクリプトに入れる)");
        // 同日「日付と場所で探すの一覧も横長にして」: 今週末・今月と同じ横長(自分たちは横長の絵、楽天は左に絵・右に文字のカード)
        ok(calV.length > 0 && calV.every((v) => { const o = cheerio.load(v.b)(".pr-strip-one > *"); return v.b === "" || (o.is("[data-self-pr]") ? o.is(".strip-land") && /-wide\.svg$/.test(o.find("img").attr("src")) : o.is(".strip-card")) && !o.is(".sq"); }) && calV.some((v) => cheerio.load(v.b)(".strip-card").length) && calV.some((v) => cheerio.load(v.b)(".strip-land").length), "日付と場所で探す: 一覧の中のPRも横長(楽天は横長のカード、自分たちのバナーは横長の絵)"); }
      // 一覧の途中を、開催が22件ある月で確かめる(テスト用のデータ。今日は 2026-10-09)。5件ごとに4本。
      // 1本目 → 公演の掲載。2本目(東栄町)→ 宿のバナー。3本目(浜田市・大田市)→ 協賛のご案内。4本目(江津市)→ 体験の代わりに、江津市の地域の協賛
      { const src = "dist-test-inlist-src"; mkdirSync(src, { recursive: true });
        const ev = (i, day, prefecture, city) => ({ id: "t-inl-" + i, name: "一覧の帯のテスト公演" + i, kagura: "石見神楽", prefecture, city, venue: "テスト会場" + i, start: day + "T19:00", end: day + "T21:00", fee: "無料", url: "https://example.com/inl" + i, description: "テスト用データです。", lat: 34.9, lng: 132.1, status: "published" });
        const plan = [["10-10", "島根県", "大田市"], ["10-11", "島根県", "浜田市"], ["10-12", "島根県", "浜田市"], ["10-13", "島根県", "大田市"], ["10-14", "島根県", "浜田市"], ...["10-15", "10-16", "10-17", "10-18", "10-19"].map((d) => [d, "愛知県", "北設楽郡東栄町"]), ["10-20", "島根県", "浜田市"], ["10-21", "島根県", "浜田市"], ...["10-22", "10-23", "10-24"].map((d) => [d, "島根県", "大田市"]), ...["10-25", "10-26", "10-27", "10-28", "10-29"].map((d) => [d, "島根県", "江津市"]), ["10-30", "島根県", "浜田市"], ["10-31", "島根県", "浜田市"], ["11-01", "島根県", "浜田市"]];
        writeFileSync(src + "/events.json", JSON.stringify(plan.map(([d, p, c], i) => ev(i, "2026-" + d, p, c))));
        // ふるさと納税の紹介(「神楽の町を応援する」)を、テストの日付(2026-10-09)でも出す。都道府県のページで、月の変わり目(10月→11月)に置かれるかを確かめる
        { const mo = JSON.parse(readFileSync("data/more-offers.json", "utf8")); for (const o of mo.offers) if (o.category === "furusato") o.verifiedAt = "2026-10-01"; writeFileSync(src + "/more-offers.json", JSON.stringify(mo)); }
        writeFileSync(src + "/sponsors.json", JSON.stringify([{ id: "t-gotsu", kind: "monthly", sponsor: "テスト観光協会", title: "江津の宿と温泉", url: "https://example.com/sp", start: "2026-10-01", end: "2026-10-31", approved: true, contractRef: "test", placements: [{ page: "area", prefecture: "島根県", cities: ["江津市"] }] }]));
        const b2 = build(src + "/events.json", "dist-test-inlist", { TEST_AFF_TRAVEL: "1", SPONSORS_FILE: src + "/sponsors.json", MORE_OFFERS_FILE: src + "/more-offers.json" });
        ok(b2.status === 0, "一覧の帯のテスト用ビルド", b2.stderr);
        if (b2.status === 0) {
          const $ = cheerio.load(readFileSync("dist-test-inlist/this-month.html", "utf8")), st = $(".d-top > aside.pr-strip.inlist"), one = (k) => st.eq(k).find(".pr-strip-one > *");
          ok(st.length === 4 && st.toArray().every((x) => $(x).find(".pr-strip-one > *").length === 1) && st.toArray().map((x) => $(x).find("p.pr-strip-h").text()).join() === "公演を掲載しませんか,宿を探す,地域の協賛,体験・行き方" && one(0).is("a.strip-self[href='/organizers.html']") && one(0).attr("data-goatcounter-click") === "pr-self/list1-organizers" && one(1).attr("data-goatcounter-click") === "rail-rakuten/list2-onsen-rotenburo" && one(2).is("a.strip-self[href='/sponsor.html']") && one(2).attr("data-goatcounter-click") === "pr-self/list3-sponsor", "今月: どの帯も1個だけ。1本目 公演の掲載のご案内、2本目 宿のバナー、3本目 協賛のご案内", st.toArray().map((x) => $(x).find(".pr-strip-one > *").attr("data-goatcounter-click")).join(","));
          ok(one(1).is("a.strip-card[data-banner-partner=rakuten]") && one(1).find("b").text() === RAIL_BANNERS.find((b) => b.id === "onsen-rotenburo").alt && one(1).find("img").attr("alt") === "" && one(0).is(".strip-land") && one(0).find("img").attr("src") === "/pr-organizers-wide.svg" && one(2).find("img").attr("src") === "/pr-sponsor-wide.svg", "今月: 一覧の中のPRは横長(楽天は左に絵・右に文字のカード、自分たちのバナーは横長の絵)");
          { const pf = cheerio.load(readFileSync("dist-test-inlist/pref/島根県.html", "utf8")), st2 = pf("main aside.pr-strip.inlist"), bad = listChecks[0]("dist-test-inlist");
            ok(st2.length >= 3 && bad.length === 0 && st2.toArray().slice(0, 3).map((x) => pf(x).find("p.pr-strip-h").text()).join() === "公演を掲載しませんか,宿を探す,地域の協賛", "都道府県のページ(開催の多い島根県): 5件ごとに帯。何本目かで中身を分ける(今週末・今月と同じ)", st2.length + "本 " + bad.join(" "));
            const more = pf("main .more-picks"), bad2 = listChecks[1]("dist-test-inlist");
            ok(more.length === 1 && more.find("h2").text() === "神楽の町を応援する" && more.next().is("p.mhead") && more.next().text() === "11月" && more.prevAll(".card").length === plan.filter(([d, p]) => p === "島根県" && d.startsWith("10-")).length && bad2.length === 0, "都道府県のページ(島根県): 「神楽の町を応援する」は、一覧の途中の月の変わり目(10月と11月の間)。下部の説明・周辺体験の欄はない", bad2.join(" ")); }
          ok(one(3).is("a.strip-sp[data-sponsor=t-gotsu]") && one(3).attr("data-goatcounter-click") === "sponsor/t-gotsu/inlist" && st.find(".strip-sp").length === 1, "今月: 5件に当てはまる契約中の協賛は、その帯に出る(登録だけで出る。4本目の体験の代わりに)");
          const cal = readFileSync("dist-test-inlist/calendar.html", "utf8"), sp = cal.match(/SP=(\{.*?\});/);
          ok(!!sp && Object.keys(JSON.parse(sp[1])).sort().join() === ["t-inl-15", "t-inl-16", "t-inl-17", "t-inl-18", "t-inl-19"].sort().join() && !JSON.stringify(JSON.parse(sp[1])).includes("contractRef"), "日付と場所で探す: 協賛が当てはまる開催だけ、スクリプトに協賛のマスを持つ(契約の控えは載せない)", sp?.[1].slice(0, 200));
        } }
      // 置き場所: 主な内容(検索の結果・会場の一覧・種類の一覧)と、宿・体験の枠のあと。それより上には置かない
      const after = ($$, sel) => $$(sel).length >= 1 && stripOf($$).prevAll(sel).length >= 1 && stripOf($$).nextAll(sel).length === 0;
      ok(after(cal, "#results") && after(map, ".mapbox") && (map("details.rgroup").length === 0 || after(map, "details.rgroup")) && after(kindIndex, ".kagura-region") && after(kindP, "aside.aff") && after(kindP, ".kagura-folds") && (prefP("#nearby-experiences").length ? after(prefP, "#nearby-experiences") : true) && prefP("main .aff").toArray().every((x) => stripOf(prefP).prevAll().toArray().some((y) => y === x || prefP(y).find(x).length)), "帯は、検索の結果・地図と会場の一覧・種類の一覧・宿の枠・体験の欄より下に置く");
      ok(["guide.html", "sponsor.html", "privacy.html", "quiz.html", "experiences.html", "history/index.html", "en/index.html"].every((p) => !existsSync(join(dir, p)) || cheerio.load(readFileSync(join(dir, p), "utf8"))(".pr-strip").length === 0) && cheerio.load(readFileSync(join(dir, "events/t-past.html"), "utf8"))(".pr-strip").length === 0, "帯は、両サイドのPR枠を出すページだけ(ガイド・協賛・規約・診断・周辺体験・歴史・英語と、終了した開催には出さない)");
    }
    ok(loaded.every(([p, $$]) => !/data-vc-ad=/.test($$.html()) || $$.html().includes("kaguraVcConsent")), "PR枠にじゃらんがあるページは、広告の同意を確かめるスクリプトを読み込む");
    ok(["guide.html", "sponsor.html", "privacy.html", "quiz.html", "en/index.html"].every((p) => !existsSync(join(dir, p)) || rails(cheerio.load(readFileSync(join(dir, p), "utf8"))).length === 0), "ほかのページ(ガイド・協賛・規約・診断・英語)には出さない");
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
