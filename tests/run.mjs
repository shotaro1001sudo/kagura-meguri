// 自動テスト(サイト本体): npm test から、いくつかのグループに分けて同時に動かす(tests/all.mjs)
//   node tests/run.mjs            … 全部を1つのプロセスで順に動かす(今までどおり)
//   TEST_GROUP=2 TEST_GROUPS=4    … 4つに分けたうちの2番目だけを動かす(all.mjs が使う)
//   TEST_OUT_READY=1              … テスト用のサイト(dist-test)は、もう組み立て済み(all.mjs が先に1回だけ組み立てる)
//   TEST_PREPARE=1                … テスト用のサイトを組み立てるだけ
// 1) テスト用データと固定の日時でビルド → 2) 出力を機械的に検査 → 3) 0件・不正データの挙動も検査
// 同時に動くので、テストごとの出力フォルダ(dist-test-…)や一時ファイルは、ほかのテストと名前を重ねないこと。
// 読むだけの dist-test(OUT)には書き込まないこと。
import { goatcounterPauseTests } from "./goatcounter-pause.mjs";
import { adsensePauseTests } from "./adsense-pause.mjs";
import { rakutenStayIssuedTests } from "./rakuten-stay-issued.mjs";
import { stayPlanningTests } from './stay-planning.mjs';
import { adFallbackTests } from './ad-fallback.mjs';
import { upcomingSummaryTests } from './upcoming-summary.mjs';
import { pastEventsTests } from './past-events.mjs';
import { reservationTests } from './reservation.mjs';
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync, statSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import * as cheerio from "cheerio";
import { palettes, ratio, PAIRS } from "./contrast.mjs";
import { valuecommerceIssuedTests } from "./valuecommerce-issued.mjs";
import { extraTests } from "./extra.mjs";
import { seoTests } from "./seo.mjs";
import { motionTests } from "./motion.mjs";
import { policyTests } from "./policy.mjs";
import { collectTests } from "./collect.mjs";
import { affiliateCoverageTests } from "./affiliate-coverage.mjs";
import { notifyTests } from "./notify.mjs";
import { xpostTests } from "./xpost.mjs";
import { weeklyReviewTests } from "./weekly-review.mjs";
import { analyticsHistoryTests } from "./analytics-history.mjs";
import { socialPerformanceTests } from "./social-performance.mjs";
import { moreOffersTests } from "./more-offers.mjs";
import { weekendTests } from "./weekend.mjs";
import { guideTests } from "./guide.mjs";
import { historyTests } from "./history.mjs";
import { englishTests } from "./english.mjs";
import { organizersTests } from "./organizers.mjs";
import { sponsorTests } from "./sponsor.mjs";
import { eventSeoTests } from "./event-seo.mjs";
import { kaguraNamesTests } from "./kagura-names.mjs";
import { identityTests } from "./identity.mjs";
import { adminTests } from "./admin.mjs";
import { homeTests } from "./home.mjs";
import { sourcesTests } from "./sources.mjs";
import { consistencyTests } from "./consistency.mjs";
import { editorialTests } from "./editorial.mjs";
import { uxTests } from "./ux.mjs";
import { affiliateTests } from "./affiliate.mjs";
import { ga4ConsentTests } from "./ga4-consent.mjs";
import { analyticsEventTests } from "./analytics-events.mjs";
import { analyticsSyncTests } from "./analytics-sync.mjs";
import { monetizationUxTests } from "./monetization-ux.mjs";
import { valuecommerceTests } from "./valuecommerce.mjs";
import { valuecommerceSummaryTests } from "./valuecommerce-summary.mjs";
import { valuecommerceGASTests } from "./valuecommerce-gas.mjs";
import { nightlyDeployTests } from "./nightly-deploy.mjs";
import { eventHandoffTests } from "./event-handoff.mjs";
import { quizTests } from './quiz.mjs';
import { visitorPlanningTests } from './visitor-planning.mjs';
import { billingTests } from "./billing.mjs";
import { earningsTests } from "./earnings.mjs";
import { indexNowTests } from "./indexnow.mjs";

const NOW = "2026-10-09T12:00"; // 日本時間で固定(テストが日付に左右されないように)
const build = (events, out, extra = {}) =>
  spawnSync("node", ["scripts/build.mjs"], { env: { ...process.env, EVENTS_FILE: events, REGULAR_FILE: "tests/fixtures/regular.test.json", MEDIA_STATS_FILE: "tests/fixtures/media-stats.test.json", OUT_DIR: out, BUILD_NOW: NOW, TEST_AFF_OFF: "1", TEST_PLANNING_OFF: "1", TEST_GOATCOUNTER: "", TEST_GA: "", TEST_CB: "", TEST_ADS_OFF: "1", ...(extra.TEST_AFF_TRAVEL ? {TEST_ADS_OFF:"",TEST_CB:"test-consent-id"} : {}), ...extra }, encoding: "utf8" });

let pass = 0, fail = 0;
const failures = [];
const ok = (cond, name, detail = "") => {
  if (cond) pass++; else { fail++; failures.push(`${name}${detail ? " — " + detail : ""}`); }
};
const section = (s) => console.log(`\n■ ${s}`);
const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const read = (p) => readFileSync(p, "utf8");

// ---------- 1. ビルド(テスト用のサイト。どのグループも読むだけ) ----------
const OUT = "dist-test";
let r;
if (process.env.TEST_OUT_READY !== "1") {
  section("ビルド");
  r = build("tests/fixtures/events.test.json", OUT);
  ok(r.status === 0, "テスト用データでビルドできる", r.stderr);
  if (process.env.TEST_PREPARE === "1") {
    console.log(`\n結果: ${pass} 件成功 / ${fail} 件失敗`);
    if (r.status !== 0) { console.log(r.stderr); process.exit(1); }
    process.exit(0);
  }
}
const files = walk(OUT);
const htmls = files.filter((f) => f.endsWith(".html"));
const rel = (f) => "/" + relative(OUT, f).replace(/\\/g, "/");
const hasFile = (urlPath) => {
  let p = decodeURIComponent(urlPath.split("#")[0].split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  return existsSync(join(OUT, p));
};

// 読み込むだけで動くテスト(node:assert で確かめ、失敗すれば例外で止まる)
const sideEffectTests = async () => {
  await import("./analytics-session-sync.mjs");
  await import("./analytics-session-report.mjs");
  await import("./consent-manager-test.mjs");
  await import("./nearby-hotels.mjs");
  await import("./cookie-controls-test.mjs");
  await import("./cmp-request-policy-test.mjs");
  await import("./cookie-metadata-test.mjs");
  await import("./vc-sdk-harness-test.mjs");
  await import("./bounded-cdp-test.mjs");
};

// テスト用サイトの基本の検査(ページの基本・リンク・表示・安全性・ICS・サイトマップ・アクセシビリティ・収集処理・0件)
const coreTests = async () => {
for (const f of ["index.html", "map.html", "calendar.html", "kagura/index.html", "404.html", "about.html", "contact.html", "privacy.html", "sitemap.xml", "robots.txt", "events.json", "CNAME"])
  ok(existsSync(join(OUT, f)), `出力に ${f} がある`);
// ---------- プライバシーポリシー: 外部サービスの最新公表事項と一致 ----------
section("プライバシーポリシー: Web3Formsの保存期間・国外処理");
const privacyPage = read(join(OUT, "privacy.html"));
const privacyText = cheerio.load(privacyPage)("main").text();
ok(privacyText.includes("最大3年間") && privacyText.includes("送信日"), "Web3Formsによるフォーム送信データの最大3年保持を明示する");
ok(privacyText.includes("12か月") && privacyText.includes("運営者が受け取ったメール等の方針"), "運営者の12か月保管方針と送信サービスの保持期間を区別する");
ok(privacyText.includes("複数の国・地域") && privacyText.includes("CleanTalk") && privacyText.includes("Akismet"), "国外処理と迷惑送信対策の再委託先を明示する");
ok(privacyPage.includes('href="https://web3forms.com/privacy"') && privacyPage.includes('rel="noopener"'), "Web3Forms公式プライバシーポリシーへの安全なリンクを表示する");
ok(!privacyText.includes("事業者のサーバーには保存されません"), "Web3Formsが送信データを保存しないという旧記述が存在しない");
ok(privacyText.includes("2026年10月22日 Web3Formsの保存期間") && privacyText.includes("最終更新: 2026年11月14日") && !privacyText.includes("団体ページのお申し込みフォームでは"), "従来の改定履歴を残し、団体ページの受付を終えた後の最終更新日を記載する(申し込みフォームの記載は消す)");
// ---------- 2. 各ページの基本品質 ----------
section("各ページの基本(title / description / canonical / h1 / lang)");
const titles = new Map();
for (const f of htmls) {
  const html = read(f), $ = cheerio.load(html), name = rel(f);
  ok($("html").attr("lang") === (/^\/?en\//.test(name) ? "en" : "ja"), `${name}: lang=${/^\/?en\//.test(name) ? "en" : "ja"}`);
  const t = $("title").text().trim();
  ok(t.length > 0 && t.length <= 120, `${name}: title がある(120字以内)`, t);
  ok(!titles.has(t), `${name}: title が他ページと重複しない`, t);
  titles.set(t, name);
  const d = $('meta[name="description"]').attr("content") ?? "";
  ok(d.length > 0 && d.length <= 160, `${name}: description がある(160字以内)`, `${d.length}字`);
  ok(($('link[rel="canonical"]').attr("href") ?? "").startsWith("https://"), `${name}: canonical が https`);
  ok($('meta[name="viewport"]').length === 1, `${name}: viewport`);
  ok($("h1").length === 1, `${name}: h1 が1つ`, `${$("h1").length}個`);
  // ページの大きさ(文字数・KB)の上限は設けない(2026-11-12 運営者の判断: 容量の決まりで内容の充実を縛らない)
  $("script, style").remove(); // コードの中身ではなく、画面に見える文字だけを調べる
  const text = $("body").text();
  ok(!/undefined|NaN|\[object|null(?![a-z])/.test(text), `${name}: 画面に undefined/NaN/null が出ていない`);
  ok(!text.includes("広告枠"), `${name}: 仮の「広告枠」が出ていない`);
}

// ---------- 3. リンク切れ ----------
section("内部リンク・外部リンク");
let internal = 0;
for (const f of htmls) {
  const $ = cheerio.load(read(f)), name = rel(f);
  $("a[href], link[href][rel=canonical]").each((_, el) => {
    const h = $(el).attr("href");
    if (!h || h.startsWith("#") || h.startsWith("mailto:") || h.startsWith("data:")) return;
    if (/^https?:\/\//.test(h)) {
      if ($(el).attr("target") === "_blank") ok(/noopener/.test($(el).attr("rel") ?? ""), `${name}: target=_blank に noopener`, h);
      return;
    }
    internal++;
    ok(h.startsWith("/") && hasFile(h), `${name}: 内部リンク先が存在する`, h);
  });
  $("[src]").each((_, el) => { const s = $(el).attr("src"); if (s && s.startsWith("/")) ok(hasFile(s), `${name}: src が存在する`, s); });
}
console.log(`  内部リンク ${internal} 本を確認`);

// ---------- 4. 表示ロジック(日付・状態) ----------
section("表示ロジック");
const index = cheerio.load(read(join(OUT, "index.html")));
const listText = index("#list").text();
ok(!listText.includes("承認前のため出てはいけない"), "承認前(pending)のデータは一覧に出ない");
ok(!existsSync(join(OUT, "events/t-pending.html")), "承認前のデータは詳細ページも作られない");
ok(!listText.includes("終了した神楽"), "終了したイベントは一覧に出ない");
ok(listText.includes("開催中のテスト"), "開催中(終了時刻なし・3時間以内)は一覧に出る");
ok(listText.includes("時刻未確認") && !listText.includes("時間は公式情報をご確認ください"), "時間未定のイベントは「時刻未確認」と短く出る(一覧と開催ページで同じ言い方。確認のお願いは表の下に1回)");
ok(index("#list > div").first().text().includes("開催中のテスト"), "一覧は日付順(いちばん早い開催中が先頭)");
const past = cheerio.load(read(join(OUT, "events/t-past.html")));
ok(past("body").text().includes("終了しました"), "終了したイベントの詳細ページに「終了しました」");
const tu = cheerio.load(read(join(OUT, "events/t-timeunknown.html")));
ok(!/00:00/.test(tu("table.info").text()), "時間未定の詳細に 00:00 が出ない");
ok(tu("#map").length === 0 && !tu("body").text().includes("地図のピン"), "開催ページには地図(とピンの注記)を置かない");
const min = cheerio.load(read(join(OUT, "events/t-minimal.html")));
ok(!min("a[href='/kagura/.html']").length && !/\/kagura\/\.html/.test(read(join(OUT, "events/t-minimal.html"))), "神楽の種類が空でも壊れたリンクを作らない");
ok(!existsSync(join(OUT, "kagura/.html")), "神楽の種類が空のファイルを作らない");
const full = cheerio.load(read(join(OUT, "events/t-full.html")));
ok(full("table.info").text().includes("2026年11月20日(金) 20:00〜21:00"), "日時が日本時間のまま、曜日つきで表示される(同じ日の終わりは時刻だけ)", full("table.info").text().slice(0, 60));

// ---------- 5. 安全性(XSS・構造化データ) ----------
section("安全性と構造化データ");
const xss = read(join(OUT, "events/t-xss.html"));
ok(!xss.includes("<script>alert(1)</script>"), "名称の <script> がそのまま出力されない");
ok(!/<img src=x/i.test(xss), "説明文の <img onerror> がそのまま出力されない");
ok(!/会場 <\/script>/.test(xss), "会場名の </script> がそのまま出力されない");
for (const f of htmls) {
  const $ = cheerio.load(read(f));
  $('script[type="application/ld+json"]').each((_, el) => {
    let j; try { j = JSON.parse($(el).text()); } catch { j = null; }
    ok(j, `${rel(f)}: JSON-LD が壊れていない`);
  });
}
const ldOf = (id) => { const j = JSON.parse(cheerio.load(read(join(OUT, `events/${id}.html`)))('script[type="application/ld+json"]').text()); return Array.isArray(j) ? j.find((x) => x["@type"] === "Event") : j; };
const bc = JSON.parse(cheerio.load(read(join(OUT, "events/t-full.html")))('script[type="application/ld+json"]').text()).find((x) => x["@type"] === "BreadcrumbList");
ok(bc && bc.itemListElement.length === 3 && bc.itemListElement[1].name === "宮崎県", "詳細ページにパンくず(BreadcrumbList)");
const homeLd = JSON.parse(cheerio.load(read(join(OUT, "index.html")))('script[type="application/ld+json"]').text());
ok(homeLd.some((x) => x["@type"] === "WebSite" && x.publisher?.name) && homeLd.some((x) => x["@type"] === "ItemList"), "トップに WebSite と ItemList の構造化データ");
const lf = ldOf("t-full");
ok(lf["@type"] === "Event" && lf.name && lf.startDate === "2026-11-20T20:00+09:00" && lf.endDate === "2026-11-20T21:00+09:00", "Event の日時に +09:00 が付く");
ok(lf.location.geo?.latitude === 32.70545, "Event に緯度経度が入る");
ok(ldOf("t-timeunknown").startDate === "2026-10-10", "時間未定のEventは日付のみ");
ok(!("description" in ldOf("t-minimal")), "説明が空なら description を出さない");

// ---------- 6. カレンダー追加(ICS) ----------
section("カレンダー(ICS)");
for (const f of files.filter((x) => x.endsWith(".ics"))) {
  const s = read(f), n = rel(f);
  ok(s.startsWith("BEGIN:VCALENDAR\r\n") && s.endsWith("END:VCALENDAR\r\n"), `${n}: 形式と改行(CRLF)`);
  ok(/UID:[^\r\n]+/.test(s) && /DTSTAMP:\d{8}T\d{6}Z/.test(s) && /DTSTART/.test(s) && /DTEND/.test(s) && /SUMMARY:/.test(s), `${n}: 必須項目`);
  ok(!/[^\r]\n/.test(s), `${n}: 改行がCRLFのみ`);
}
// 全開催の購読用ファイル(events.ics)の中身: 1件ずつの VEVENT を取り出して確かめる
const icsAll = read(join(OUT, "events.ics"));
const vevent = (id) => icsAll.split("BEGIN:VEVENT").find((b) => b.includes(`UID:${id}@`)) ?? "";
ok(/\\,/.test(vevent("t-xss")) || !/,/.test(vevent("t-xss").split("SUMMARY:")[1]?.split("\r\n")[0] ?? ","), "ICS の文字がエスケープされる");
ok(/DTSTART;VALUE=DATE:20261010/.test(vevent("t-timeunknown")), "時間未定のICSは終日扱い");
ok(/DTSTART;TZID=Asia\/Tokyo:20261120T200000/.test(vevent("t-full")), "ICS の日時が日本時間(TZID)");
ok(!files.some((f) => /events[\\/][^\\/]+\.ics$/.test(f)), "開催ごとの .ics は作らない(登録は、Googleカレンダーのボタンで行う)");

// 開催ページの「Googleカレンダーに追加」: 予定作成の画面に、日時・場所・説明が入る
section("Googleカレンダーに追加(開催ページ)");
const gcal = (id) => { const $ = cheerio.load(read(join(OUT, `events/${id}.html`))); const a = $('main a[href^="https://calendar.google.com/"]'); return { a, u: a.length === 1 ? new URL(a.attr("href")) : null }; };
{
  const { a, u } = gcal("t-full"), p = u?.searchParams;
  ok(u && u.pathname === "/calendar/render" && p.get("action") === "TEMPLATE" && p.get("ctz") === "Asia/Tokyo", "Googleカレンダーの予定作成画面を、日本時間で開く");
  ok(p?.get("dates") === "20261120T200000/20261120T210000" && p.get("text") === JSON.parse(read("tests/fixtures/events.test.json").replace(/^﻿/, "")).find((e) => e.id === "t-full").name, "日時(開始/終了)と名称が入る");
  ok(p?.get("location").includes("宮崎県") && p.get("details").includes("/events/t-full.html") && p.get("details").includes("公式情報: https://") && p.get("details").includes("公式情報をご確認ください"), "場所と、このページ・公式情報へのリンク、変更の注意が入る");
  ok(a.attr("target") === "_blank" && a.attr("rel")?.includes("noopener") && a.text() === "Googleカレンダーに追加", "新しいタブで開き、noopener が付く");
  ok(cheerio.load(read(join(OUT, "events/t-full.html")))('main a[href$=".ics"]').length === 0, "開催ページに、.ics ファイルへのリンクは出さない");
}
ok(gcal("t-timeunknown").u?.searchParams.get("dates") === "20261010/20261011", "時間未定の開催は、終日の予定になる");
ok(gcal("t-minimal").u?.searchParams.get("dates") === "20261103T100000/20261103T120000", "終了未確認の仮登録は入力用2時間（別途注記を検証）");
ok(gcal('t-minimal').u.searchParams.get('text').includes('終了未確認・仮2時間') && gcal('t-minimal').u.searchParams.get('details').includes('公演の終了時刻ではありません') && vevent('t-minimal').includes('DESCRIPTION:終了時刻は未確認'), '未確認終了の仮設定をGoogle予定とICSに明記');
ok(gcal('t-timeunknown').u.searchParams.get('text').includes('時刻未確認・日付のみ') && vevent('t-timeunknown').includes('終日開催や終日の観覧を意味しません'), '時刻未確認の日付予定を終日公演と表現しない');
{ const h = read(join(OUT, "events/t-xss.html")); const raw = h.match(/href="(https:\/\/calendar\.google\.com\/[^"]*)"/)?.[1] ?? ""; ok(raw && !/[<>"']/.test(raw), "名称に記号があっても、リンクのURLが壊れない(エスケープされる)"); }

// ---------- 7. サイトマップ ----------
section("サイトマップ・robots");
const sm = read(join(OUT, "sitemap.xml"));
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
ok(locs.length > 10, "サイトマップにURLが並ぶ", `${locs.length}件`);
for (const u of locs) ok(hasFile(new URL(u).pathname), "サイトマップのURLに実体がある", u);
ok(!locs.some((u) => u.includes("404")), "サイトマップに 404 を含めない");
ok(/<lastmod>2026-10-09<\/lastmod>/.test(sm), "サイトマップに lastmod");
ok(read(join(OUT, "robots.txt")).includes("Sitemap: https://"), "robots.txt に Sitemap");
ok(read(join(OUT, "CNAME")).trim() === JSON.parse(read("config.json")).domain, "CNAME が config の domain と一致");

// ---------- 9. アクセシビリティ ----------
section("アクセシビリティ(色・操作しやすさ・ナビ)");
for (const [theme, pal] of Object.entries(palettes()))
  for (const [a, b] of PAIRS) ok(ratio(pal[a], pal[b]) >= 4.5, `配色(${theme}): ${a} / ${b} のコントラスト比が4.5以上`, ratio(pal[a], pal[b]).toFixed(2));
const css = read("scripts/style.css");
ok(/:focus-visible/.test(css), "キーボードのフォーカス表示がある");
ok(/min-height:44px/.test(css), "ボタン・メニューは44px以上の押しやすさ");
ok(/prefers-reduced-motion/.test(css + read("scripts/motion.css")), "動きを減らす設定に対応");
for (const f of htmls) {
  const $ = cheerio.load(read(f)), name = rel(f);
  ok($("a.skip[href='#main']").length === 1 && $("main#main").length === 1, `${name}: 「本文へ移動」リンクと main`);
  ok($(`nav[aria-label='${/^\/?en\//.test(name) ? "Main menu" : "メインメニュー"}']`).length === 1 && $("nav:not([aria-label])").length === 0, `${name}: nav にラベル`);
  $("img").each((_, el) => ok($(el).attr("alt") !== undefined, `${name}: img に alt`));
  $("select").each((_, el) => ok($(`label[for='${$(el).attr("id")}']`).length === 1, `${name}: select にラベル`));
}
ok(cheerio.load(read(join(OUT, "map.html")))(".top nav a[aria-current='page']").text() === "地図で探す", "現在のページに aria-current");
// ---------- 10. 検索・速度・外部ライブラリ ----------
section("検索(noindex)・外部ライブラリ(SRI)・速度");
const robotsMeta = (p) => cheerio.load(read(join(OUT, p)))('meta[name="robots"]').attr("content");
ok(/^index,follow/.test(robotsMeta("events/t-past.html")), "終了したイベントでも、説明があり次の回がなければ index される(tests/past-events.mjs)");
ok(/^index,follow/.test(robotsMeta("events/t-full.html")), "開催前のイベントは index される");
ok(robotsMeta("404.html") === "noindex,follow", "404 は noindex");
ok(/^index,follow/.test(robotsMeta("pref/島根県.html")), "開催予定のある県ページは index される");
ok(locs.some((u) => u.includes("t-past")), "検索に残す終了したイベントは、サイトマップに入れる");
ok(locs.some((u) => u.includes("t-full")), "開催前のイベントはサイトマップに入れる");
ok(cheerio.load(read(join(OUT, "events/t-full.html")))("script[src^='https://unpkg.com'], link[href^='https://unpkg.com']").length === 0, "開催ページは、地図の外部ライブラリを読み込まない");
for (const f of ["map.html"]) {
  const $ = cheerio.load(read(join(OUT, f)));
  const ext = $("script[src^='https://unpkg.com'], link[href^='https://unpkg.com']");
  ok(ext.length === 2, `${f}: 外部ライブラリは地図の2ファイルだけ`);
  ext.each((_, el) => ok(/^sha384-/.test($(el).attr("integrity") ?? "") && $(el).attr("crossorigin") === "anonymous", `${f}: SRI(改ざん検知)が付く`, $(el).attr("src") ?? $(el).attr("href")));
  ok(/@1\.9\.4\//.test($("script[src^='https://unpkg.com']").attr("src")), `${f}: バージョン固定`);
  ok($("script[src^='https://unpkg.com']").attr("defer") !== undefined, `${f}: 描画を止めない(defer)`);
}
for (const f of htmls) {
  const $ = cheerio.load(read(f));
  const fontLink = $("link[href*='fonts.googleapis.com/css2']").first();
  ok(fontLink.attr("media") === "print" && fontLink.attr("id") === "gf" && fontLink.attr("onload") === undefined && /getElementById\('gf'\)/.test(read(f)), `${rel(f)}: Webフォントが表示を止めない(インラインのイベント属性を使わない)`);
}
ok(read(join(OUT, "index.html")).includes('rel="icon"'), "ファビコンがある(404 を出さない)");

// ---------- 11. 収集処理(単体テスト) ----------
section("収集処理: 日付の読み取り・robots.txt・アダプタ");
const { parseJaDate, findPrefecture, robotsAllows } = await import("../scripts/lib/util.mjs");
const base = new Date("2026-10-09T00:00:00+09:00");
const eq = (a, b, n) => ok(JSON.stringify(a) === JSON.stringify(b), n, JSON.stringify(a));
eq(parseJaDate("2026年11月20日(金) 20:00", base), { start: "2026-11-20T20:00", end: null, hasTime: true }, "日付: 年月日+時刻");
eq(parseJaDate("２０２６年１１月２０日　１９：３０～２１：００", base), { start: "2026-11-20T19:30", end: "2026-11-20T21:00", hasTime: true }, "日付: 全角数字と時間範囲");
eq(parseJaDate("令和8年11月3日", base).start, "2026-11-03T00:00", "日付: 令和");
eq(parseJaDate("令和元年5月1日", base).start, "2019-05-01T00:00", "日付: 令和元年");
eq(parseJaDate("11月20日", base).start, "2026-11-20T00:00", "日付: 年なしは今年");
eq(parseJaDate("1月5日", base).start, "2027-01-05T00:00", "日付: 年なしで過去になる月は翌年");
eq(parseJaDate("2026.11.20 18:00", base).start, "2026-11-20T18:00", "日付: ドット区切り");
eq(parseJaDate("未定", base), null, "日付: 読めなければ null");
eq(parseJaDate("2026年13月40日", base), null, "日付: 範囲外は null");
eq(findPrefecture("島根県大田市"), "島根県", "都道府県: 正式名");
eq(findPrefecture("京都市内の神社"), "京都府", "都道府県: 略称から補完");
const robots = (txt) => async () => ({ ok: true, text: async () => txt });
const UA = "KaguraMeguriBot/1.0 (+https://example.com)";
eq((await robotsAllows("https://x.test/private/a", UA, robots("User-agent: *\nDisallow: /private/"))).ok, false, "robots: Disallow を守る");
eq((await robotsAllows("https://x.test/public/a", UA, robots("User-agent: *\nDisallow: /private/"))).ok, true, "robots: 無関係のパスは許可");
eq((await robotsAllows("https://x.test/private/open/a", UA, robots("User-agent: *\nDisallow: /private/\nAllow: /private/open/"))).ok, true, "robots: 長い一致の Allow が優先");
eq((await robotsAllows("https://x.test/a", UA, robots("User-agent: kagurameguribot\nDisallow: /\nUser-agent: *\nAllow: /"))).ok, false, "robots: 自分のUA指定が * より優先");
eq((await robotsAllows("https://x.test/a", UA, robots("User-agent: *\nDisallow: /"))).ok, false, "robots: 全面禁止を守る");
eq((await robotsAllows("https://x.test/a", UA, async () => { throw new Error("net"); })).ok, true, "robots: 取得できなければ許可(取得側で別途失敗する)");
const sel = await import("../scripts/adapters/selectors.mjs");
const got = sel.parse(read("tests/fixtures/list.html"), { url: "http://x.test/list.html", selectors: { item: ".ev li", name: "a", date: ".d", place: ".p", link: "a" } });
eq(got.map((x) => x.name), ["秋の大神楽", "冬至祭神楽", "過去の神楽"], "セレクタ: 日付が読めない行を捨てる");
eq([got[0].prefecture, got[0].city, got[0].venue], ["島根県", "大田市", "〇〇神社"], "セレクタ: 県/市/会場に分ける");
eq(got[0].url, "http://x.test/d/1", "セレクタ: 相対リンクを絶対URLにする");
const filtered = sel.parse(read("tests/fixtures/list.html"), { url: "http://x.test/", filter: "冬至", selectors: { item: ".ev li", name: "a", date: ".d", place: ".p" } });
eq(filtered.map((x) => x.name), ["冬至祭神楽"], "セレクタ: filter で絞れる");
const ld = await import("../scripts/adapters/jsonld.mjs");
const lj = ld.parse(read("tests/fixtures/jsonld.html"), { url: "http://x.test/" });
eq([lj.length, lj[0].name, lj[0].start, lj[0].prefecture], [1, "テスト神楽奉納", "2026-12-05T18:30", "広島県"], "JSON-LD: Event を読む");
const period = ld.parse('<script type="application/ld+json">{"@type":"Event","name":"期間","startDate":"2025-09-14","endDate":"2027-03-14"}</script>', { url: "http://x.test/" });
eq([period.length, period.skippedPeriod], [0, 1], "JSON-LD: 複数日をまとめた期間型は除外して件数を数える");
// ---------- 8. 0件・不正データ ----------
section("0件のサイト / 不正データ");
r = build("tests/fixtures/events.empty.json", "dist-test-empty", { REGULAR_FILE: "tests/fixtures/events.empty.json" });
ok(r.status === 0, "0件でもビルドできる", r.stderr);
const e0 = cheerio.load(read("dist-test-empty/index.html"));
ok(e0("#list").text().includes("いま掲載している開催情報はありません"), "0件の一覧に案内が出る");
ok(e0(".regions").length === 0 && e0(".later").length === 0, "0件では、地方のボタンと月のボタンを出さない");
ok(read("dist-test-empty/kagura/index.html").includes("まだありません"), "0件の神楽の種類ページに案内が出る");
r = build("tests/fixtures/events.invalid.json", "dist-test-invalid");
ok(r.status !== 0 && /データエラー/.test(r.stderr), "不正データではビルドを止める(公開されない)");
r = build("tests/fixtures/events.test.json", "dist-test-ads-placeholder", { ADS_PLACEHOLDER: "1" });
ok(r.status === 0 && read("dist-test-ads-placeholder/index.html").includes("広告枠"), "確認用に広告枠を出す切り替えができる");

for (const d of ["dist-test-empty", "dist-test-invalid", "dist-test-ads-placeholder"]) rmSync(d, { recursive: true, force: true });
};

// テストの一覧。グループ分けは、かかる時間がだいたい揃うように、時間のかかる順に並べて順番に配る(all.mjs が同時に動かす)。
// 同じ出力フォルダを使うもの(affiliate が組み立て、stayPlanning が読む)は、1つにまとめる。
const TESTS = [
  ["sideEffect", sideEffectTests],
  ["core", coreTests],
  ["valuecommerceIssued", async () => { valuecommerceIssuedTests({ok,section}); }],
  ["adFallback", async () => { adFallbackTests({ok,section}); }],
  ["extra", async () => { await extraTests({ ok, section, read, htmls, rel, OUT, build, hasFile, files, NOW }); }],
  ["seo", async () => { seoTests({ ok, section, OUT, build }); }],
  ["motion", async () => { await motionTests({ ok, section, OUT }); }],
  ["policy", async () => { await policyTests({ ok, section, OUT, build }); }],
  ["collect", async () => { await collectTests({ ok, section }); }],
  ["affiliateCoverage", async () => { affiliateCoverageTests({ ok, section }); }],
  ["notify", async () => { await notifyTests({ ok, section }); }],
  ["weekend", async () => { weekendTests({ ok, section, build }); }],
  ["xpost", async () => { xpostTests({ ok, section }); }],
  ["weeklyReview", async () => { weeklyReviewTests({ ok, section }); }],
  ["analyticsHistory", async () => { analyticsHistoryTests({ ok, section }); }],
  ["socialPerformance", async () => { socialPerformanceTests({ ok, section }); }],
  ["billing", async () => { billingTests({ ok, section }); }],
  ["earnings", async () => { await earningsTests({ ok, section }); }],
  ["moreOffers", async () => { moreOffersTests({ ok, section }); }],
  ["guide", async () => { guideTests({ ok, section, OUT, build }); }],
  ["history", async () => { historyTests({ ok, section, OUT }); }],
  ["english", async () => { englishTests({ ok, section, OUT }); }],
  ["organizers", async () => { await organizersTests({ ok, section, OUT, build }); }],
  ["sponsor", async () => { sponsorTests({ ok, section, OUT }); }],
  ["eventSeo", async () => { eventSeoTests({ ok, section, build }); }],
  ["kaguraNames", async () => { kaguraNamesTests({ ok, section, build }); }],
  ["pastEvents", async () => { await pastEventsTests({ ok, section, build }); }],
  ["identity", async () => { identityTests({ ok, section, OUT, build }); }],
  ["home", async () => { await homeTests({ ok, section, OUT, build }); }],
  ["sources", async () => { sourcesTests({ ok, section }); }],
  ["consistency", async () => { consistencyTests({ ok, section, OUT, build }); }],
  ["editorial", async () => { editorialTests({ ok, section, OUT, build }); }],
  ["ux", async () => { await uxTests({ ok, section, OUT }); }],
  ["affiliate+stayPlanning", async () => { affiliateTests({ ok, section, OUT, build }); stayPlanningTests({ ok, section }); }],
  ["rakutenStayIssued", async () => { rakutenStayIssuedTests({ok,section}); }],
  ["monetizationUx", async () => { monetizationUxTests({ ok, section, OUT, build }); }],
  ["reservation", async () => { reservationTests({ ok, section }); }],
  ["upcomingSummary", async () => { upcomingSummaryTests({ ok, section }); }],
  ["ga4Consent", async () => { ga4ConsentTests({ ok, section, build }); }],
  ["adsensePause", async () => { adsensePauseTests({ ok, section, build }); }],
  ["goatcounterPause", async () => { goatcounterPauseTests({ ok, section, build }); }],
  ["analyticsEvent", async () => { analyticsEventTests({ ok, section }); }],
  ["analyticsSync", async () => { analyticsSyncTests({ ok, section }); }],
  ["admin", async () => { await adminTests({ ok, section }); }],
  ["valuecommerce", async () => { await valuecommerceTests({ ok, section }); }],
  ["valuecommerceSummary", async () => { await valuecommerceSummaryTests({ ok, section }); }],
  ["valuecommerceGAS", async () => { valuecommerceGASTests({ ok, section }); }],
  ["nightlyDeploy", async () => { nightlyDeployTests({ ok, section }); }],
  ["eventHandoff", async () => { eventHandoffTests({ ok, section }); }],
  ["indexNow", async () => { indexNowTests({ ok, section, OUT }); }],
  ["quiz", async () => { quizTests({ok,section,OUT}); }],
  ["visitorPlanning", async () => { visitorPlanningTests({ok,section,OUT,build}); }],
];

// おおよその時間(秒)。TEST_TIMING=1 node tests/run.mjs で測れる。ここにないテストは1秒とみなす。
// 測り直さなくても結果は正しい(配り方が少し偏るだけ)。
const SECONDS = { admin: 15, policy: 11, collect: 10, seo: 10, extra: 9, core: 5, sideEffect: 4, editorial: 3, quiz: 3, visitorPlanning: 3, home: 3, valuecommerceIssued: 3, goatcounterPause: 3, notify: 2, motion: 2, analyticsSync: 2, weekend: 2, guide: 2, sponsor: 2, ux: 2, affiliateCoverage: 2 };
// 時間のかかる順に、いちばん空いているグループへ配る(どのプロセスでも同じ結果になる)
const groupOf = (() => {
  const memo = new Map();
  return (name, n) => {
    if (!memo.has(n)) {
      const load = Array(n).fill(0), at = new Map();
      for (const [t] of [...TESTS].sort((a, b) => (SECONDS[b[0]] ?? 1) - (SECONDS[a[0]] ?? 1) || TESTS.indexOf(a) - TESTS.indexOf(b))) {
        const g = load.indexOf(Math.min(...load));
        load[g] += SECONDS[t] ?? 1; at.set(t, g + 1);
      }
      memo.set(n, at);
    }
    return memo.get(n).get(name);
  };
})();
const G = Number(process.env.TEST_GROUP || 0), N = Number(process.env.TEST_GROUPS || 1);
const mine = TESTS.filter(([name]) => !G || groupOf(name, N) === G);
const times = [];
for (const [name, fn] of mine) {
  const t = Date.now();
  await fn();
  times.push([name, Date.now() - t]);
}
if (process.env.TEST_TIMING === "1") console.log("\n時間(ミリ秒): " + JSON.stringify(Object.fromEntries(times.sort((a, b) => b[1] - a[1]))));

console.log(`\n結果: ${pass} 件成功 / ${fail} 件失敗`);
if (fail) { console.log("\n失敗した項目:\n" + failures.map((x) => "  ✗ " + x).join("\n")); process.exit(1); }
console.log("すべて成功しました");
process.exit(0); // jsdom のウィンドウが残す内部のタイマーで、終了が遅れないようにする
