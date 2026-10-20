// GA4 affiliate-click regression checks (no external network calls).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import * as cheerio from "cheerio";

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
    ok($('.staylinks a[rel*="sponsored"]').length === 2, "予約リンクをそのまま維持");
    ok($('.staylinks a[data-goatcounter-click]').length === 2, "GoatCounter属性を維持");
    ok($('meta[http-equiv="Content-Security-Policy"]').attr("content")?.includes("sha256-"), "追加スクリプトがCSPのハッシュに含まれる");
  }

  function fire({ label = "stay-rakuten/t-full", sponsored = true, consent = true, cookieBot = true, gtag = true, tag = "SPAN" } = {}) {
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
    if (gtag) window.gtag = (...args) => events.push(args);
    runInNewContext(script, { document, window, Element });
    callback({ target: Object.assign(new Element(), { tagName: tag }) });
    return events;
  }

  const good = fire();
  ok(good.length === 1 && good[0][0] === "event" && good[0][1] === "affiliate_click", "対象クリックで1イベントだけ送信");
  ok(good[0]?.[2]?.affiliate_partner === "rakuten" && good[0]?.[2]?.affiliate_content_id === "t-full" && good[0]?.[2]?.affiliate_page_path === "/events/t-full.html", "広告主・公演ID・ページ情報を送信");
  ok(fire({ label: "aff-jalan/広島県" })[0]?.[2]?.affiliate_placement === "travel_block", "県別広告も判定");
  ok(fire({ consent: false }).length === 0, "統計同意なしでは送信しない");
  ok(fire({ sponsored: false }).length === 0, "非広告リンクは送信しない");
  ok(fire({ label: "share-line" }).length === 0, "共有リンクは除外");
  ok(fire({ gtag: false }).length === 0, "GA4未読込でもエラーなく終了");
  ok(fire({ cookieBot: false }).length === 1, "Cookiebot未設定時も計測可能");
}
