// GA4 affiliate-click regression checks (no external network calls).
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { renderedCheerio as cheerio } from "./rendered-vc.mjs";
import { VC } from "../scripts/lib/valuecommerce.mjs";

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
    const railPages = ["events/t-full.html", "regular/r-nightly.html", ...readdirSync(join(dir, "pref")).slice(0, 1).map((f) => `pref/${f}`), ...readdirSync(join(dir, "kagura")).slice(0, 1).map((f) => `kagura/${f}`)];
    const loaded = railPages.map((p) => [p, cheerio.load(readFileSync(join(dir, p), "utf8"))]);
    ok(loaded.every(([, $$]) => rails($$).length === 2 && rails($$).toArray().every((r) => $$(r).find(".pr-foot").length === 1 && $$(r).find(".rail-banner").length >= 1)), "開催・定期公演・県・種類のページに、左右のPR枠(枠ごとに「PR」1つ)", railPages.join(" "));
    ok(loaded.every(([, $$]) => $$("a.rail-banner").toArray().every((a) => /^https:\/\/hb\.afl\.rakuten\.co\.jp\/hsc\//.test($$(a).attr("href")) && ($$(a).attr("rel") || "").includes("sponsored") && $$(a).attr("target") === "_blank" && /^rail-rakuten\//.test($$(a).attr("data-goatcounter-click")) && /^https:\/\/hbb\.afl\.rakuten\.co\.jp\/hsb\//.test($$(a).find("img").attr("src")) && $$(a).find("img").attr("alt") && $$(a).find("img").attr("loading") === "lazy")), "PR枠のバナーは、楽天の発行リンクと画像だけ(広告の印 sponsored・別タブ・代替テキスト・遅延読み込み)");
    // じゃらんnet は、バリューコマースの発行コードを広告の同意の仕組み(vcTag)で出す。発行コードのままのリンクと画像、計測の名前
    const vcRail = [["rail", "jalan"], ["railJtb", "jtb"], ["railNta", "nta"]];
    ok(loaded.every(([, $$]) => vcRail.every(([kind, partner]) => { const vc = $$(`.side-rail [data-vc-ad="${kind}"]`); const a = vc.find("a"); return vc.length === 1 && vc.is(".vc-ad.rail-banner") && vc.attr("data-banner-partner") === partner && new RegExp(`^rail-${partner}/`).test(vc.attr("data-goatcounter-click")) && a.attr("href") === `//ck.jp.ap.valuecommerce.com/servlet/referral?sid=${VC.sid}&pid=${VC[kind]}` && a.find("img").attr("src") === `//ad.jp.ap.valuecommerce.com/servlet/gifbanner?sid=${VC.sid}&pid=${VC[kind]}` && (a.attr("rel") || "").includes("sponsored") && a.find("img").attr("alt"); })), "PR枠のじゃらん・JTB・日本旅行は、発行コードのリンクと画像のまま、同意の仕組みの中に出す");
    ok(vcRail.every(([kind, partner]) => fire({ label: `rail-${partner}/x` })[0]?.[2]?.affiliate_partner === partner) && new Set(Object.values(VC)).size === Object.values(VC).length, "PR枠のバリューコマースの広告のクリックも GA4 で数え、発行コードの番号は重ならない");
    // 2026-11-15 運営者の依頼: PR枠の上端は、本文の宿の枠(会場周辺の宿・◯◯県の宿など)の上端にそろえる
    ok(loaded.every(([p, $$]) => (p.startsWith("kagura/") || $$("main .stay, main aside.aff").length >= 1) && $$("script").toArray().some((s) => $$(s).html().includes("--rail-top"))) && /top:var\(--rail-top,96px\)/.test(readFileSync("scripts/style.css", "utf8")), "PR枠の上端を宿の枠にそろえるスクリプトを読み込み、宿の枠がページにある(動かないときは上から96px)", railPages.join(" "));
    ok(loaded.every(([p, $$]) => !/data-vc-ad=/.test($$.html()) || $$.html().includes("kaguraVcConsent")), "PR枠にじゃらんがあるページは、広告の同意を確かめるスクリプトを読み込む");
    ok(["index.html", "calendar.html", "map.html", "guide.html", "sponsor.html", "privacy.html", "quiz.html", "en/index.html"].every((p) => !existsSync(join(dir, p)) || rails(cheerio.load(readFileSync(join(dir, p), "utf8"))).length === 0), "ほかのページ(トップ・カレンダー・地図・ガイド・協賛・規約・診断・英語)には出さない");
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
