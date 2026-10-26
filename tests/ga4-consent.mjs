// GA4 basic consent mode regression tests (offline, with mocked Cookiebot API).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import * as cheerio from "cheerio";

const code = readFileSync("scripts/client/ga4-consent.js", "utf8");
const homeCode = readFileSync("scripts/client/home.js", "utf8");
const transitionCode = readFileSync("scripts/vt.js", "utf8");

function simulate({ requireConsent = true, cb = undefined, search = "", stored = "", storageError = false, hostname = "kagurameguri.jp" } = {}) {
  const added = [], listeners = {}, sent = [];
  let reloads = 0;
  const window = {
    Cookiebot: cb,
    addEventListener(name, cb) { listeners[name] = cb; },
    location: { search, hostname, href: "https://" + hostname + "/events/test.html" + search, reload() { reloads++; } },
    localStorage: {
      getItem() { if (storageError) throw new Error("blocked"); return stored; },
      setItem(_key, value) { if (storageError) throw new Error("blocked"); stored = value; },
      removeItem() { if (storageError) throw new Error("blocked"); stored = ""; }
    },
    dispatchEvent(event) { listeners[event.type]?.(); }
  };
  const document = {
    currentScript: {
      getAttribute(name) { return name === "data-ga4-id" ? "G-TEST123456" : name === "data-ga4-host" ? "kagurameguri.jp" : null; },
      hasAttribute(name) { return requireConsent && name === "data-require-statistics-consent"; }
    },
    createElement(type) { return { tagName: type }; },
    head: { appendChild(script) { added.push(script); } }
  };
  const run = () => runInNewContext(code, { window, document, encodeURIComponent, Date, URL, URLSearchParams, Event });
  run();
  const notify = (name, event = {}) => listeners[name]?.(event);
  return {
    window, document, added, sent, notify, run,
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
      ok($('#cookie-reject-optional[type="button"]').length===1,path+': 明示拒否ボタンが1つ');
      ok(html.indexOf('id="cookie-controls"')<html.indexOf('<main id="main">')&&$('.cookie-settings-link a[href="#cookie-controls"]').length===1,path+': 拒否操作は下部バナーから離れた通常フロー、末尾からリンク');
      ok($('#cookie-reject-status[role="status"][aria-live="polite"]').length===1,path+': 拒否操作の状態読み上げ');
      ok($('script').filter((_,n)=>$(n).text().trim()===readFileSync('scripts/client/cookie-controls.js','utf8').trim()).length===1,path+': 拒否操作コードが1回');
      const bot = $("head > script#Cookiebot");
      ok(bot.length === 1 && bot.attr("data-cbid") === "test-consent-id",
        path + ": 正しいCBIDを持つCookiebotが1回だけ設置される");
      ok(bot.attr("data-blockingmode") === "auto" && bot.attr("async") === undefined,
        path + ": 自動ブロック、非asyncで初期化する");
      const first = $("head script").first();
      const listener = readFileSync("scripts/client/valuecommerce-ready.js", "utf8").trim();
      ok((first.attr("id") === "Cookiebot" || (first.text().trim() === listener && first.nextAll("script").first().attr("id") === "Cookiebot")) && $("head script[src]").first().attr("id") === "Cookiebot",
        path + ": CMP前は通信/描画しない正確なVC監視コードのみ、Cookiebotは最初の外部script");
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
  ok(waiting.calls().filter((x) => x[0] === "config" && x[1] === "G-TEST123456").length === 1 &&
    waiting.calls().filter((x) => x[0] === "event" && x[1] === "page_view").length === 0,
    "同意通知が重なっても自動page_viewのconfigは1回だけで、手動の重複送信をしない");
  ok(!/(?:gtag|dataLayer|history\.(?:pushState|replaceState)|location\.reload)\s*\(/.test(homeCode) &&
    !/history\.(?:pushState|replaceState)|location\.reload\s*\(/.test(transitionCode),
    "トップの絞り込みとページ遷移演出はGA4送信・SPA履歴変更・再読み込みを行わない");

  const returning = simulate({ cb: response(true) });
  ok(returning.added.length === 1, "過去の明示的同意が保存されている場合も開始する");
  returning.run();
  ok(returning.added.length === 1, "スクリプト自体が二重挿入されても1回しか起動しない");
  for (const options of [{search:"?analytics=off"}, {stored:"1"}, {search:"?analytics=off",storageError:true},
    {search:"?gtm_debug=x"}, {search:"?debug_mode=true"}, {hostname:"localhost"}]) {
    const excluded = simulate({cb:response(true), ...options});
    ok(excluded.added.length === 0 && !excluded.window.kaguraGa4Allowed && excluded.window.kaguraAnalytics.status === "excluded",
      "自己/Preview/ローカル閲覧を同意済みでも除外: " + JSON.stringify(options));
  }
  ok(simulate({cb:response(true),stored:"1",search:"?analytics=on"}).added.length === 1, "本人が除外を解除できる");
  for (const lifecycle of ['pageshow', 'focus', 'popstate', 'CookiebotOnAccept']) {
    const cached = simulate({cb:response(true)});
    cached.window.localStorage.setItem('kagura.analytics.exclude', '1');
    cached.notify(lifecycle);
    ok(!cached.window.kaguraGa4Allowed && cached.window['ga-disable-G-TEST123456'] === true && cached.window.kaguraAnalytics.status === 'excluded', '起動済みページも除外を再確認: '+lifecycle);
    cached.added[0].onload();
    cached.window.localStorage.removeItem('kagura.analytics.exclude');
    cached.notify('CookiebotOnAccept');
    ok(cached.window.kaguraAnalytics.status === 'excluded' && cached.added.length === 1 && cached.calls().filter(c=>c[0]==='config').length===1, '除外後の遅延load/解除/同意通知で勝手に再開しない: '+lifecycle);
  }
  const otherTab=simulate({cb:response(true)});
  otherTab.notify('storage',{key:'unrelated',newValue:'1'});
  ok(otherTab.window.kaguraGa4Allowed, '無関係のstorage更新では除外しない');
  otherTab.notify('storage',{key:'kagura.analytics.exclude',newValue:'1'});
  ok(!otherTab.window.kaguraGa4Allowed && otherTab.window['ga-disable-G-TEST123456'] === true, '別タブの除外を即時反映');
  const beforeConsent=simulate();
  beforeConsent.window.localStorage.setItem('kagura.analytics.exclude','1');
  beforeConsent.window.Cookiebot=response(true);beforeConsent.notify('CookiebotOnAccept');
  ok(beforeConsent.added.length===0 && beforeConsent.window.kaguraAnalytics.status==='excluded','同意待ち中に除外されたらタグを起動しない');
  const privateQuery = simulate({cb:response(true), search:"?email=private%40example.com&utm_source=x&utm_medium=social&utm_campaign=autumn&utm_content=post_01#private"});
  const config = privateQuery.calls().find(x => x[0] === "config")?.[2];
  ok(config?.page_location === "https://kagurameguri.jp/events/test.html?utm_source=x&utm_medium=social&utm_campaign=autumn&utm_content=post_01",
    "許可したUTMだけ保持し、任意クエリとハッシュを送らない");
  privateQuery.added[0].onerror();
  ok(privateQuery.window.kaguraAnalytics.status === "tag_error" && !privateQuery.window.kaguraGa4Allowed,
    "タグ読込失敗をローカル診断で区別し、クリック計測も停止する");
  waiting.window.Cookiebot = response(false);
  waiting.notify("CookiebotOnDecline");
  ok(waiting.window.kaguraGa4Allowed === false && waiting.reloads === 1 &&
    waiting.calls().some((x) => x[0] === "consent" && x[1] === "update" &&
      x[2].analytics_storage === "denied"), "同意取り消しで遮断して再読み込み");

  const withoutCookiebot = simulate({ requireConsent: false });
  ok(withoutCookiebot.added.length === 1 && withoutCookiebot.window.kaguraGa4Allowed === true,
    "Cookiebot未設定の構成は従来どおりGA4を読み込む");
}
