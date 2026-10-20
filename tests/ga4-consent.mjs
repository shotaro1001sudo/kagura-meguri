// GA4 basic consent mode regression tests (offline, with mocked Cookiebot API).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import * as cheerio from "cheerio";

const code = readFileSync("scripts/client/ga4-consent.js", "utf8");

function simulate({ requireConsent = true, cb = undefined } = {}) {
  const added = [], listeners = {}, sent = [];
  let reloads = 0;
  const window = {
    Cookiebot: cb,
    addEventListener(name, cb) { listeners[name] = cb; },
    location: { reload() { reloads++; } }
  };
  const document = {
    currentScript: {
      getAttribute(name) { return name === "data-ga4-id" ? "G-TEST123456" : null; },
      hasAttribute(name) { return requireConsent && name === "data-require-statistics-consent"; }
    },
    createElement(type) { return { tagName: type }; },
    head: { appendChild(script) { added.push(script); } }
  };
  runInNewContext(code, { window, document, encodeURIComponent, Date });
  const notify = (name) => listeners[name]?.();
  return {
    window, document, added, sent, notify,
    get reloads() { return reloads; },
    calls() { return [...(window.dataLayer || [])].map((args) => Array.from(args)); }
  };
}
const response = (statistics, method = "explicit", hasResponse = true) => ({
  hasResponse, consent: { statistics, method }
});

export function ga4ConsentTests({ ok, section, build }) {
  section("GA4: Basic Consent Mode・明示的な統計同意");
  const run = build("tests/fixtures/events.test.json", "dist-test-ga4-consent", {
    TEST_GA: "G-TEST123456", TEST_CB: "test-consent-id", TEST_AFF_TRAVEL: "1"
  });
  ok(run.status === 0, "同意付きのGA4ビルドに成功", run.stderr);
  if (run.status === 0) {
    for (const path of ["index.html", "events/t-full.html", "pref/島根県.html"]) {
      const html = readFileSync(join("dist-test-ga4-consent", path), "utf8");
      const $ = cheerio.load(html);
      ok($("script[data-ga4-id][data-require-statistics-consent]").length === 1,
        path + ": 同意ゲートを埋め込む");
      ok($('script[src*="googletagmanager.com/gtag/js"]').length === 0,
        path + ": 初期HTMLはGA4外部タグを読まない");
      const bot = $("head > script#Cookiebot");
      ok(bot.length === 1 && bot.attr("data-cbid") === "test-consent-id",
        path + ": 正しいCBIDを持つCookiebotが1回だけ設置される");
      ok(bot.attr("data-blockingmode") === "auto" && bot.attr("async") === undefined,
        path + ": 自動ブロック、非asyncで初期化する");
      ok($("head script").first().attr("id") === "Cookiebot",
        path + ": Cookiebotはhead内の最初のスクリプト");
      ok(html.indexOf('id="Cookiebot"') < html.indexOf('data-ga4-id="G-TEST123456"'),
        path + ": Cookiebotの後にGA4同意制御を初期化する");
      ok(html.indexOf('http-equiv="Content-Security-Policy"') < html.indexOf('id="Cookiebot"'),
        path + ": Cookiebot実行前にCSPを適用");
      ok($('meta[http-equiv="Content-Security-Policy"]').attr("content")?.includes("sha256-"),
        path + ": スクリプトCSPハッシュあり");
    }
  }

  const missing = simulate();
  ok(missing.added.length === 0 && missing.window.kaguraGa4Allowed === false,
    "Cookiebotが読み込めない場合はGA4を開始しない");
  ok(missing.calls()[0]?.[0] === "consent" && missing.calls()[0]?.[1] === "default" &&
    missing.calls()[0]?.[2]?.analytics_storage === "denied", "最初の同意状態はdenied");
  const undecided = simulate({ cb: response(false, null, false) });
  undecided.notify("CookiebotOnConsentReady");
  ok(undecided.added.length === 0, "未回答ならGA4を開始しない");
  const rejected = simulate({ cb: response(false) });
  rejected.notify("CookiebotOnDecline");
  ok(rejected.added.length === 0 && rejected.window.kaguraGa4Allowed === false,
    "明示的な拒否ならGA4を開始しない");
  const implied = simulate({ cb: response(true, "implied") });
  implied.notify("CookiebotOnConsentReady");
  ok(implied.added.length === 0, "地域別の自動（implied）同意は許可とみなさない");
  const noResponse = simulate({ cb: response(true, "explicit", false) });
  noResponse.notify("CookiebotOnConsentReady");
  ok(noResponse.added.length === 0, "未回答のままstatisticsだけtrueでも拒否");

  const waiting = simulate();
  waiting.window.Cookiebot = response(true);
  waiting.notify("CookiebotOnConsentReady");
  waiting.notify("CookiebotOnAccept");
  ok(waiting.added.length === 1 && waiting.added[0].src ===
    "https://www.googletagmanager.com/gtag/js?id=G-TEST123456" && waiting.window.kaguraGa4Allowed === true,
    "明示的な統計同意後だけGA4を1回読み込む");
  ok(waiting.calls().some((x) => x[0] === "consent" && x[1] === "update" &&
    x[2].analytics_storage === "granted"), "同意後analytics_storageをgrantedにする");
  ok(waiting.calls().some((x) => x[0] === "config" && x[1] === "G-TEST123456"),
    "同意後に既存測定IDで計測を開始する");

  const returning = simulate({ cb: response(true) });
  ok(returning.added.length === 1, "過去の明示的同意が保存されている場合も開始する");
  waiting.window.Cookiebot = response(false);
  waiting.notify("CookiebotOnDecline");
  ok(waiting.window.kaguraGa4Allowed === false && waiting.reloads === 1 &&
    waiting.calls().some((x) => x[0] === "consent" && x[1] === "update" &&
      x[2].analytics_storage === "denied"), "同意取り消しで遮断して再読み込み");

  const withoutCookiebot = simulate({ requireConsent: false });
  ok(withoutCookiebot.added.length === 1 && withoutCookiebot.window.kaguraGa4Allowed === true,
    "Cookiebot未設定の構成は従来どおりGA4を読み込む");
}
