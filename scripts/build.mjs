// 静的サイト生成: data/events.json + data/regular.json + config.json -> dist/
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync } from "node:fs";
import { cspFor, FRAME_BUSTER } from "./lib/csp.mjs";
import { submitForm, contactForm, formScript, formReady } from "./lib/form.mjs";
import { privacyHtml, disclaimerHtml, termsHtml } from "./lib/policy.mjs";
import { ogImagePng, OG_SIZE } from "./lib/ogimage.mjs";
import { guideHtml, CHECKED as GUIDE_CHECKED } from "./lib/guide.mjs";
import { organizersHtml } from "./lib/organizers.mjs";
import { REGIONS, regionOf } from "./lib/util.mjs";
import { pngToIco } from "./lib/ico.mjs";
import { encodeSjisURI } from "./lib/sjis.mjs";
import { weekendRange, rangeLabel, mdLabel, regularOn, isDaily, addDays, holidayName } from "./lib/dates.mjs";

// テスト用の切り替え: EVENTS_FILE / REGULAR_FILE(データ)/ OUT_DIR(出力先)/ BUILD_NOW(日本時間の現在 "YYYY-MM-DDTHH:mm")
const OUT = process.env.OUT_DIR ?? "dist";
const EVENTS_FILE = process.env.EVENTS_FILE ?? "data/events.json";
const REGULAR_FILE = process.env.REGULAR_FILE ?? "data/regular.json";
const readJson = (p) => JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
const cfg = readJson("config.json");
if (process.env.TEST_ADS_OFF) cfg.adsense = { client: "", slotList: "", slotDetail: "" }; // テスト用(広告未設定の状態から確かめる)
if (process.env.TEST_ADSENSE) cfg.adsense.client = process.env.TEST_ADSENSE;
if (process.env.TEST_FORM_OFF) cfg.form = { endpoint: "", accessKey: "", providerName: "" }, cfg.operator = { ...cfg.operator, contact: process.env.TEST_CONTACT ?? "" }; // テスト: 送信先が未設定の状態
if (process.env.TEST_FORM_ENDPOINT) cfg.form ={ ...cfg.form, endpoint: process.env.TEST_FORM_ENDPOINT, providerName: process.env.TEST_FORM_PROVIDER ?? cfg.form?.providerName };
if (process.env.TEST_AUTOPUBLISH) cfg.collect = { ...cfg.collect, autoPublish: process.env.TEST_AUTOPUBLISH === "1" };
if (process.env.TEST_GA != null) cfg.analyticsId = process.env.TEST_GA; // テスト用(空文字で無効)
if (process.env.TEST_GOATCOUNTER != null) cfg.goatcounter = process.env.TEST_GOATCOUNTER; // テスト用(空文字で無効)
// アクセス解析 GoatCounter(Cookie を使わない)。コードは英小文字・数字・ハイフン(https://<コード>.goatcounter.com)
if (cfg.goatcounter && !/^[a-z0-9-]+$/.test(cfg.goatcounter)) { console.error("config.json の goatcounter は、英小文字・数字・ハイフンのコードにしてください"); process.exit(1); }
const GOATCOUNTER = cfg.goatcounter ? `<script data-goatcounter="https://${cfg.goatcounter}.goatcounter.com/count" async src="https://gc.zgo.at/count.v5.js" integrity="sha384-atnOLvQb9t+jTSipvd75X2yginT4PjVbqDdlJAmxMm+wYElFmeR6EmLP5bYeoRVQ" crossorigin="anonymous"></script>` : "";
if (process.env.TEST_AFF_OFF) cfg.affiliate = { rakutenAffiliateId: "", valueCommerceSid: "", jalanPid: "", amazonTag: "" }; // テスト用(アフィリエイト未設定の状態から確かめる)
if (process.env.TEST_AFFILIATE) cfg.affiliate = { ...cfg.affiliate, amazonTag: process.env.TEST_AFFILIATE };
if (process.env.TEST_AFF_TRAVEL) cfg.affiliate = { ...cfg.affiliate, rakutenAffiliateId: "test.rakuten", valueCommerceSid: "1234567", jalanPid: "7654321" }; // テスト用(宿のアフィリエイト)
const rawEvents = readJson(EVENTS_FILE).filter((e) => e.status === "published");
const rawRegular = (existsSync(REGULAR_FILE) ? readJson(REGULAR_FILE) : []).filter((r) => r.status === "published");

// ---------- 入力データの検査: 壊れたデータは公開せず、ビルドを止める ----------
const DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const HTTP_URL = /^https?:\/\/[^\s"'<>]+$/; // javascript: などのURLを、リンクに載せない
const errs = [];
function validateCommon(rows, ids) {
  for (const e of rows) {
    const w = `[${e.id ?? "id なし"}]`;
    if (!/^[A-Za-z0-9_-]+$/.test(e.id ?? "")) errs.push(`${w} id は英数字・ハイフン・アンダースコアのみ`);
    if (ids.has(e.id)) errs.push(`${w} id が重複しています`);
    ids.add(e.id);
    if (!e.name) errs.push(`${w} name が空です`);
    if (!e.prefecture) errs.push(`${w} prefecture が空です`);
    if (e.url && !HTTP_URL.test(e.url)) errs.push(`${w} url は http(s):// で始まる安全なURLにしてください(現在: ${e.url})`);
    if ((e.lat != null) !== (e.lng != null) || (e.lat != null && (!(e.lat >= 20 && e.lat <= 46) || !(e.lng >= 122 && e.lng <= 154)))) errs.push(`${w} lat/lng が不正、または日本の範囲外です`);
  }
}
{
  validateCommon(rawEvents, new Set());
  for (const e of rawEvents) {
    const w = `[${e.id}]`;
    if (!DT.test(e.start ?? "")) errs.push(`${w} start は YYYY-MM-DDTHH:mm 形式にしてください(現在: ${e.start})`);
    if (e.end && !DT.test(e.end)) errs.push(`${w} end の形式が不正です`);
    if (e.end && e.end < e.start) errs.push(`${w} end が start より前です`);
  }
  validateCommon(rawRegular, new Set());
  for (const r of rawRegular) {
    if (!r.schedule) errs.push(`[${r.id}] schedule(いつ開催されるか)が空です`);
    if (r.until && !/^\d{4}-\d{2}-\d{2}$/.test(r.until)) errs.push(`[${r.id}] until は YYYY-MM-DD 形式にしてください`);
    // 公演日の計算に使う(今週末・今月のページ)。schedule の文章と、食い違わないように
    const ints = (v, lo, hi) => Array.isArray(v) && v.length > 0 && v.every((n) => Number.isInteger(n) && n >= lo && n <= hi);
    if (r.weekdays != null && !ints(r.weekdays, 0, 6)) errs.push(`[${r.id}] weekdays は、曜日の番号(0=日曜〜6=土曜)の配列にしてください`);
    if (r.months != null && !ints(r.months, 1, 12)) errs.push(`[${r.id}] months は、月(1〜12)の配列にしてください`);
    if (r.closedDates != null && !(Array.isArray(r.closedDates) && r.closedDates.every((d) => /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d)))) errs.push(`[${r.id}] closedDates は "MM-DD" の配列にしてください`);
  }
  if (errs.length) { console.error("データエラー:\n" + errs.map((x) => "  " + x).join("\n")); process.exit(1); }
}

// ---------- 日付: すべて「日本時間の文字列」として扱う(ビルドを行うサーバーの時区に依存させない) ----------
const nowJst = process.env.BUILD_NOW ?? new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16);
const asMs = (s) => Date.parse(`${s}:00Z`);
const isUpcoming = (e) => {
  if (e.timeUnknown) return (e.end || e.start).slice(0, 10) >= nowJst.slice(0, 10);
  const endMs = e.end ? asMs(e.end) : asMs(e.start) + 3 * 3600e3; // 終了時刻なしは開始から3時間を開催中とみなす
  return endMs >= asMs(nowJst);
};
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const WD = ["日", "月", "火", "水", "木", "金", "土"];
const parts = (s) => { const [y, mo, d, h, mi] = s.split(/[-T:]/).map(Number); return { y, mo, d, h, mi, wd: new Date(Date.UTC(y, mo - 1, d)).getUTCDay() }; };
const fmt = (s) => { const p = parts(s); return `${p.y}年${p.mo}月${p.d}日 ${pad(p.h)}:${pad(p.mi)}`; };
// 「11月15日(日)」(年なし)。開催ページの日時は「2026年11月15日(日) 13:00〜15:00」
const mdw = (s) => { const p = parts(`${s}T00:00`); return `${p.mo}月${p.d}日(${WD[p.wd]})`; };
const dayLabel = (s, withYear = true) => { const p = parts(`${s}T00:00`); return `${withYear ? `${p.y}年` : ""}${p.mo}月${p.d}日(${WD[p.wd]})`; };
const whenOf = (e) => {
  const sd = e.start.slice(0, 10), ed = e.end?.slice(0, 10);
  const endDay = ed && ed !== sd ? dayLabel(ed, ed.slice(0, 4) !== sd.slice(0, 4)) : "";
  if (e.timeUnknown) return `${dayLabel(sd)}${endDay ? `〜${endDay}` : ""}(${TIME_UNKNOWN})`;
  if (e.sessions?.length) return `${dayLabel(sd)} ${e.sessions.join("、")}(1日${e.sessions.length}回)`;
  return `${dayLabel(sd)} ${e.start.slice(11, 16)}〜${e.end ? (endDay ? `${endDay} ${e.end.slice(11, 16)}` : e.end.slice(11, 16)) : ""}`;
};
const jpDate = (s) => { const [y, m, d] = s.split("-").map(Number); return `${y}年${m}月${d}日`; };
const events = rawEvents.sort((a, b) => a.start.localeCompare(b.start));
const upcoming = events.filter(isUpcoming);
const regular = rawRegular.filter((r) => !r.until || r.until >= nowJst.slice(0, 10));
const kaguraInfo = existsSync("data/kagura-info.json") ? readJson("data/kagura-info.json") : {};
const SEO = cfg.seo ?? {};
// 検索結果の説明文は、全角で80〜120字くらいが、読まれやすい長さ。長すぎるものは、文の切れ目で切る
const clip = (s, n = 118) => { s = String(s).replace(/\s+/g, " ").trim(); if (s.length <= n) return s; const cut = s.slice(0, n); const i = cut.lastIndexOf("。"); return (i > n * 0.5 ? cut.slice(0, i + 1) : cut.slice(0, n - 1) + "…"); };
// 説明文が短すぎる(情報の少ないイベント)ときは、サイトとしての補足を足す
const padDesc = (s) => (s.length >= 70 ? s : clip(`${s}公式情報へのリンク、地図、カレンダー登録つき。出典と確認日を載せています。`));
const ldJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c"); // </script> による構造崩れを防ぐ

// ---------- 収益化 ----------
const a = cfg.affiliate;
// 報酬の出るリンクか(ID が未設定の間は、報酬のない、ふつうのリンクとして動く)。バリューコマースは、サイトID(sid)と、提携先ごとのID(pid)の両方が要る
const rakutenOn = !!a.rakutenAffiliateId, jalanOn = !!(a.valueCommerceSid && a.jalanPid), amazonOn = !!a.amazonTag;
const hasAffiliate = rakutenOn || jalanOn || amazonOn;
const rakuten = (url) => (rakutenOn ? `https://hb.afl.rakuten.co.jp/hgc/${a.rakutenAffiliateId}/?pc=${encodeURIComponent(url)}&m=${encodeURIComponent(url)}` : url);
const vcJalan = (url) => (jalanOn ? `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${a.valueCommerceSid}&pid=${a.jalanPid}&vc_url=${encodeURIComponent(url)}` : url);
const amazon = (kw) => `https://www.amazon.co.jp/s?k=${encodeURIComponent(kw)}${amazonOn ? `&tag=${a.amazonTag}` : ""}`;
// 宿の検索(会場の市区町村で探す)。日付があれば、その日の1泊・大人2名で開く。
// じゃらんはキーワードを Shift_JIS で、楽天トラベルは charset=utf-8 の指定つきで受け取る(どちらも、実際の検索結果で確認済み)
const stayPlace = (x) => (x.city ? x.city.replace(/^.*郡/, "") : x.prefecture);
const jalanStay = (x, day) => {
  const q = [`keyword=${encodeSjisURI(stayPlace(x))}`];
  if (day) q.push(`stayYear=${+day.slice(0, 4)}`, `stayMonth=${+day.slice(5, 7)}`, `stayDay=${+day.slice(8, 10)}`, "stayCount=1", "roomCount=1", "adultNum=2");
  return vcJalan(`https://www.jalan.net/uw/uwp2011/uww2011init.do?${q.join("&")}`);
};
const rakutenStay = (x, day) => {
  const q = ["charset=utf-8", `f_query=${encodeURIComponent(stayPlace(x))}`];
  if (day) { const n = addDays(day, 1); q.push(`f_nen1=${day.slice(0, 4)}`, `f_tuki1=${+day.slice(5, 7)}`, `f_hi1=${+day.slice(8, 10)}`, `f_nen2=${n.slice(0, 4)}`, `f_tuki2=${+n.slice(5, 7)}`, `f_hi2=${+n.slice(8, 10)}`, "f_otona_su=2", "f_heya_su=1"); }
  return rakuten(`https://kw.travel.rakuten.co.jp/keyword/Search.do?${q.join("&")}`);
};
// 外部リンク(アフィリエイト)の属性。報酬の出るリンクは sponsored。クリック数は、アクセス解析(GoatCounter)で数える
const affAttrs = (on, name) => `rel="${on ? "sponsored " : ""}noopener" target="_blank" data-goatcounter-click="${esc(name)}" data-goatcounter-title="${esc(name)}"`;
const prNote = (on) => (on ? `<small class="meta"><span class="pr">PR</span> 広告(アフィリエイトリンク)を含みます。内容は、<a href="/disclaimer.html">免責事項</a>をご覧ください。</small>` : `<small class="meta">外部の予約サイトへのリンクです。内容は、<a href="/disclaimer.html">免責事項</a>をご覧ください。</small>`);

/** 開催ページの「会場近くの宿」: 開催日の1泊で、会場の市区町村の宿を探す(これからの開催だけ) */
function stayBlock(e) {
  const day = e.start.slice(0, 10), place = stayPlace(e);
  const on = rakutenOn || jalanOn;
  return `<aside class="stay" aria-labelledby="stay-h"><h2 id="stay-h">会場近くの宿</h2>
<p>${!e.timeUnknown && +e.start.slice(11, 13) >= 17 ? "夜の公演です。" : ""}遠方から観に行くなら、${esc(place)}の宿もあわせて探せます。<br><span class="meta">${jpDate(day)}泊・大人2名で検索します(日付や人数は、予約サイトで変えられます)。</span></p>
<p class="staylinks"><a class="btn ghost sm" href="${esc(jalanStay(e, day))}" ${affAttrs(jalanOn, `stay-jalan/${e.id}`)}>じゃらんで宿を探す</a> <a class="btn ghost sm" href="${esc(rakutenStay(e, day))}" ${affAttrs(rakutenOn, `stay-rakuten/${e.id}`)}>楽天トラベルで宿を探す</a></p>
${prNote(on)}</aside>`;
}

/** 種類・都道府県・定期公演のページの宿の案内(日付なし)。見出しは、会場が決まっていれば「会場近くの宿」、県・種類のページは「◯◯県の宿」 */
function affiliateBlock(e) {
  const links = [
    [`${stayPlace(e)}の宿を探す`, "じゃらん", jalanStay(e), jalanOn, "jalan"],
    [`${stayPlace(e)}の宿を探す`, "楽天トラベル", rakutenStay(e), rakutenOn, "rakuten"],
    ...(amazonOn ? [["神楽の本・グッズ", "Amazon", amazon(e.kagura || "神楽"), true, "amazon"]] : []),
  ];
  return `<aside class="aff"><h2>${e.venue ? "会場近くの宿" : `${esc(e.prefecture)}の宿`}</h2><div class="afflist">${links
    .map(([t, s, u, on, k]) => `<a href="${esc(u)}" ${affAttrs(on, `aff-${k}/${e.prefecture}`)}><b>${esc(t)}</b><small>${s}</small></a>`)
    .join("")}</div>${prNote(links.some((l) => l[3]))}</aside>`;
}
// 広告が未設定の間は何も出さない(「広告枠」という仮表示を公開サイトに出さない)。確認用に ADS_PLACEHOLDER=1 で枠を表示できる
const adSlot = (slot) =>
  cfg.adsense.client && slot
    ? `<div class="adwrap"><ins class="adsbygoogle" style="display:block" data-ad-client="${cfg.adsense.client}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>`
    : process.env.ADS_PLACEHOLDER ? `<div class="adph">広告枠</div>` : "";

// 地図ライブラリ(バージョン固定 + 改ざん検知 SRI)。defer なので、使う側は DOMContentLoaded で初期化する
const LEAFLET = `<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H" crossorigin="anonymous"><script defer src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH" crossorigin="anonymous"></script>`;

// ---------- 連絡先(メールアドレスは、HTMLにそのまま書かない: 収集ボット対策) ----------
const op = cfg.operator;
// 運営者のメールアドレスは、ページに載せない(分割して埋め込んでも、ページを実行する収集ボットには読まれる)。
// 連絡は、お問い合わせフォームに一本化する。フォームの送信先が未設定の間だけ、フォームが、メール作成の予備に使う(form.mjs)
// 運営者(構造化データ): シンボルを、ロゴとして示す
const ORG_LD = { "@type": "Organization", name: op.name, url: `${cfg.baseUrl}/about.html`, logo: { "@type": "ImageObject", url: `${cfg.baseUrl}/symbol.png`, width: 330, height: 330 } };
const mailLink = () => `<a href="/contact.html">お問い合わせフォーム</a>`;

// ---------- 共通レイアウト ----------
// ---------- 動き(出現・視差・ホバー・導入演出) ----------
// 本文の動きは、全ページ共通の1つだけ: ページを開いたとき、本文全体が1回、静かに現れる(部分ごと・スクロールごとには動かさない)
const SPARKS = 12; // 篝火の火の粉の数。位置・大きさ・速さは、決まった乱数で作る(毎回、同じ出力になる)
let seed = 20261009; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const sparkCss = Array.from({ length: SPARKS }, (_, i) => `.sparks i:nth-child(${i + 1}){--x:${(5 + rnd() * 90).toFixed(1)}%;--s:${(2 + rnd() * 2.2).toFixed(1)}px;--t:${(8 + rnd() * 6).toFixed(1)}s;--d:${(rnd() * 7).toFixed(1)}s;--dx:${Math.round(-40 + rnd() * 80)}px}`).join("\n");
// トップの見出しの背景の情景「月と社」: 満月と月暈、金の縁の霞、山の稜線と鳥居。
// 層(空・霞・地)ごとに、視差の速さを変える。色は CSS(--moon / --fg / --ac2 / --bg)で、昼・夜の配色に合わせる
const MOONSCAPE = `<svg class="ms" viewBox="0 0 300 240" aria-hidden="true" focusable="false">
<defs>
<radialGradient id="msHalo"><stop offset="0" class="ms-s0"/><stop offset=".42" class="ms-s1"/><stop offset="1" class="ms-s2"/></radialGradient>
<linearGradient id="msMist"><stop offset="0" class="ms-m0"/><stop offset=".3" class="ms-m1"/><stop offset=".7" class="ms-m1"/><stop offset="1" class="ms-m0"/></linearGradient>
<linearGradient id="msFar" x2="0" y2="1"><stop offset="0" class="ms-l0"/><stop offset="1" class="ms-l2"/></linearGradient>
<linearGradient id="msNear" x2="0" y2="1"><stop offset="0" class="ms-l1"/><stop offset=".8" class="ms-l2"/></linearGradient>
<radialGradient id="msEdge" cx=".6" cy=".42" r=".62"><stop offset=".55" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>
<mask id="msMask"><rect width="300" height="240" fill="url(#msEdge)"/></mask>
</defs>
<g mask="url(#msMask)">
<g class="ms-stars"><circle cx="64" cy="40" r="1"/><circle cx="104" cy="22" r=".8"/><circle cx="252" cy="28" r=".9"/><circle cx="276" cy="62" r=".7"/><circle cx="132" cy="58" r=".7"/><circle cx="40" cy="92" r=".8"/></g>
<g class="ms-sky"><circle class="ms-halo" cx="192" cy="84" r="112"/><circle class="ms-ring" cx="192" cy="84" r="62"/><circle class="ms-moon" cx="192" cy="84" r="42"/></g>
<g class="ms-kasumi"><path class="ms-k ms-k1" d="M110 106C150 99 250 99 300 106 250 112 150 112 110 106Z"/><path class="ms-k ms-k2" d="M0 150C40 144 120 144 176 150 120 155 40 155 0 150Z"/></g>
<g class="ms-land"><path fill="url(#msFar)" d="M0 192C40 180 72 172 106 178S166 156 202 162 256 182 300 170V240H0Z"/>
<path class="ms-torii" d="M88 158q38-6 76 0l-2 5q-36-4.6-72 0zM94 164h64v3H94zM98 175h56v3H98zM124 167h4v8h-4zM102 167h5l1.6 46h-8.2zM145 167h5l1.6 46h-8.2z"/>
<path fill="url(#msNear)" d="M0 214C44 202 92 204 138 210S226 198 300 210V240H0Z"/></g>
</g>
</svg>`;
const sparksHtml =`<div class="sparks" aria-hidden="true">${"<i></i>".repeat(SPARKS)}</div>`;
const lf = (s) => s.replace(/\r\n?/g, "\n");
const motionCss = lf(readFileSync("scripts/motion.css", "utf8")) + "\n" + sparkCss;
const MOTION_JS = lf(readFileSync("scripts/motion.js", "utf8"));
const clientJs = (name) => `<script>${lf(readFileSync(`scripts/client/${name}.js`, "utf8")).trim()}</script>`;
// 動きを減らす設定のとき(と、IntersectionObserver がない環境)は、何も付けない = 動きの CSS が、一切、効かない
// 動きを付けないページ(規約・運営者情報など、読むための文書)。js クラスを付けないので、出現・視差などの動きがすべて止まる
const STILL_PAGES = ["/about", "/contact", "/privacy", "/terms", "/disclaimer"]; // 拡張子なし(/about と /about.html の両方で開けるため、.html を外して比べる)
const HEAD_MOTION = `(function(d){var h=d.documentElement,w=window;try{if(!w.IntersectionObserver||(w.matchMedia&&w.matchMedia('(prefers-reduced-motion: reduce)').matches))return;if(${JSON.stringify(STILL_PAGES)}.indexOf(location.pathname.replace(/[.]html$/,""))>=0)return;h.classList.add('js');if(location.pathname==='/'||location.pathname==='/index.html'){if(!sessionStorage.getItem('intro')){h.classList.add('intro');sessionStorage.setItem('intro','1')}}}catch(e){}})(document)`;

// ---------- デザイン ----------
const css = lf(readFileSync("scripts/style.css", "utf8")) + "\n" + motionCss;
// メインメニュー: 「探し方」で並べる。[行き先, 表示, このメニューが「今いる場所」になるページ(active の値)]
const NAV = [
  ["/", "開催予定", ["/"]],
  ["/calendar.html", "日付・場所で探す", ["/calendar.html", "/weekend.html", "/this-month.html", "/month/"]],
  ["/map.html", "地図で探す", ["/map.html"]],
  ["/kagura/", "種類で探す", ["/kagura/"]],
  ["/guide.html", "神楽を初めて観る方へ", ["/guide.html"]],
  ["/organizers.html", "主催者の方へ", ["/organizers.html", "/submit.html"]],
];
const navLink = ([h, t, group], active) => {
  const cur = active === h ? ' aria-current="page"' : group.includes(active) ? ' aria-current="true"' : "";
  return `<a href="${h}"${cur ? ` class="on"${cur}` : ""}>${t}</a>`;
};
// スマホの三本線メニュー: JS が動くときだけ、ボタンを出して、メニューを畳む(JS がなければ、メニューは常に見える)
const NAV_SCRIPT = `(function(){var h=document.documentElement,w=window,q=false;function sc(){q=false;h.classList.toggle('scrolled',(w.pageYOffset||0)>8)}w.addEventListener('scroll',function(){if(!q){q=true;w.requestAnimationFrame(sc)}},{passive:true});sc();var b=document.getElementById('menubtn'),n=document.getElementById('gnav');if(!b||!n)return;document.documentElement.classList.add('navjs');b.hidden=false;function set(o){b.setAttribute('aria-expanded',String(o));n.classList.toggle('open',o)}b.addEventListener('click',function(){set(b.getAttribute('aria-expanded')!=='true')});document.addEventListener('keydown',function(e){if(e.key==='Escape'&&b.getAttribute('aria-expanded')==='true'){set(false);b.focus()}})})()`;
const FONT_URL = "https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500&family=Zen+Kaku+Gothic+New:wght@400;500&display=swap";
const FONT_SCRIPT = `(function(){var l=document.getElementById('gf');if(l)l.addEventListener('load',function(){l.media='all'})})()`;

const OG_URL = `${cfg.baseUrl}/og.png`;
const layout = ({ title, desc, path, body, ld, head = "", active = "", noindex = false, withForm = false, ogType = "website" }) => {
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script>${FRAME_BUSTER}</script>
<script>${HEAD_MOTION}</script>
<meta name="referrer" content="strict-origin-when-cross-origin">${noindex ? '<meta name="robots" content="noindex,follow">' : '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">'}
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${cfg.baseUrl}${path}">${SEO.googleVerification ? `<meta name="google-site-verification" content="${esc(SEO.googleVerification)}">` : ""}${SEO.bingVerification ? `<meta name="msvalidate.01" content="${esc(SEO.bingVerification)}">` : ""}
<link rel="alternate" type="application/atom+xml" title="${esc(cfg.siteName)} 新着の開催情報" href="/feed.xml">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="${ogType}"><meta property="og:url" content="${cfg.baseUrl}${path}"><meta property="og:site_name" content="${esc(cfg.siteName)}"><meta property="og:locale" content="ja_JP"><meta property="og:image" content="${OG_URL}"><meta property="og:image:width" content="${OG_SIZE.width}"><meta property="og:image:height" content="${OG_SIZE.height}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${OG_URL}">
<meta name="theme-color" content="#f3eee4" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#171513" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon-48.png" type="image/png" sizes="48x48"><link rel="icon" href="/symbol-96.png" type="image/png" sizes="96x96"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link id="gf" rel="stylesheet" href="${FONT_URL}" media="print"><script>${FONT_SCRIPT}</script><noscript><link rel="stylesheet" href="${FONT_URL}"></noscript>
<style>${css}</style>${head}${cfg.adsense.client ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${cfg.adsense.client}" crossorigin="anonymous"></script>` : ""}
${GOATCOUNTER}${cfg.analyticsId ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${cfg.analyticsId}"></script><script>window.dataLayer=[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${cfg.analyticsId}')</script>` : ""}
${ld ? `<script type="application/ld+json">${ldJson(ld)}</script>` : ""}</head><body>
<a class="skip" href="#main">本文へ移動</a>
<header class="top"><div class="wrap"><a class="logo" href="/"><img src="/symbol-96.png" alt="" width="32" height="32">${esc(cfg.siteName)}</a><button class="menubtn" id="menubtn" type="button" aria-expanded="false" aria-controls="gnav" hidden><span class="bars" aria-hidden="true"></span>メニュー</button><nav id="gnav" aria-label="メインメニュー">${NAV.map((x) => navLink(x, active)).join("")}</nav></div></header><script>${NAV_SCRIPT}</script>
<div class="wrap"><main id="main">${body}</main>
<footer><a href="/organizers.html">主催者の方へ(掲載は無料)</a> ・ <a href="/guide.html">はじめての神楽ガイド</a><br>
<a href="/about.html">運営者情報</a> ・ <a href="/contact.html">お問い合わせ</a> ・ <a href="/terms.html">利用規約</a> ・ <a href="/privacy.html">プライバシーポリシー</a> ・ <a href="/disclaimer.html">免責事項</a><br>© ${esc(cfg.siteName)}</footer></div>
${withForm ? `<script>${formScript(cfg)}</script>` : ""}<script>${MOTION_JS}</script></body></html>`;
  // インラインのスクリプト/スタイルのハッシュを集めて、このページ専用の CSP(コンテンツの許可リスト)を <meta> に入れる
  return html.replace('<head><meta charset="utf-8">', `<head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${cspFor(html, cfg)}">`);
};

// 県・神楽の種類のページの URL(リンクは、すべてこの2つで作る)
const prefHref = (p) => `/pref/${encodeURIComponent(p)}.html`;
const kaguraHref = (k) => `/kagura/${encodeURIComponent(k)}.html`;
// 件数の要約(「開催予定 3件 ・ 定期公演 1件」。0件の項目は出さない)
const countLine = (n, m) => [n ? `開催予定 ${n}件` : "", m ? `定期公演 ${m}件` : ""].filter(Boolean).join(" ・ ") || "開催予定はありません";
const kaguraTag = (k, cls = "tag gold") => (k ? `<a class="${cls}" href="${kaguraHref(k)}">${esc(k)}</a>` : "");
// 同じ公演のくり返し(名称と会場が同じ開催)。2回以上あれば「定例開催」の印を付け、開催ページに、ほかの日程を出す
const seriesKey = (e) => `${e.name}|${e.venue ?? ""}`;
const sameSeries = (e) => events.filter((x) => x.id !== e.id && seriesKey(x) === seriesKey(e));
// 時刻の表記: 「13:00〜」。1日に複数回あれば「11:00〜・13:00〜」。時間未定は、決まった言い方にそろえる
const TIME_UNKNOWN = "時間は公式情報をご確認ください";
const startTimes = (e) => (e.sessions?.length ? e.sessions.map((x) => x.slice(0, 5) + "〜").join("・") : `${e.start.slice(11, 16)}〜`);
const card = (e, h = "h3") => {
  const p = parts(e.start);
  return `<div class="card"><div class="date"><small>${p.mo}月</small><b>${p.d}</b><small>${WD[p.wd]}曜</small></div><div>
<${h}><a href="/events/${e.id}.html">${esc(e.name)}</a></${h}>
<div class="meta">${sameSeries(e).length ? '<span class="rep">定例開催</span> ・ ' : ""}${e.timeUnknown ? TIME_UNKNOWN : startTimes(e)} ・ ${esc(e.prefecture)} ${esc(e.city)}${e.fee ? ` ・ ${esc(e.fee)}` : ""}</div>
${kaguraTag(e.kagura)}</div></div>`;
};
const regCard = (r) => `<div class="card reg"><div class="date"><small>定期</small><b>${esc(r.badge || "毎")}</b></div><div>
<h3><a href="/regular/${r.id}.html">${esc(r.name)}</a></h3>
<div class="meta">${esc(r.schedule)} ・ ${esc(r.prefecture)} ${esc(r.city ?? "")}</div>
${kaguraTag(r.kagura)}</div></div>`;
const write = (p, c) => { p = p.replace(/^dist(?=\/)/, OUT); mkdirSync(p.replace(/[\\/][^\\/]*$/, "") || ".", { recursive: true }); writeFileSync(p, c); };
const hero = (h, p) => `<section class="hero"><h1>${h}</h1>${p ? `<p>${p}</p>` : ""}</section>`;
const empty = (msg) => `<p class="empty">${msg}</p>`;
// 画面に見えるパンくず(構造化データのパンくずと、あわせて使う)
const crumbNav = (items) => `<nav class="crumbs" aria-label="パンくずリスト"><ol>${items.map(([t, h]) => (h ? `<li><a href="${h}">${esc(t)}</a></li>` : `<li aria-current="page">${esc(t)}</li>`)).join("")}</ol></nav>`;
const itemListLd = (name, list) => (list.length ? { "@context": "https://schema.org", "@type": "ItemList", name, itemListElement: list.map((x, i) => ({ "@type": "ListItem", position: i + 1, url: `${cfg.baseUrl}${x.href}`, name: x.name })) } : null);
const ym = (s) => s.slice(0, 7);
const monthLabel = (k) => `${+k.slice(0, 4)}年${+k.slice(5, 7)}月`;
const monthMap = new Map();
for (const e of upcoming) { const k = ym(e.start); if (!monthMap.has(k)) monthMap.set(k, []); monthMap.get(k).push(e); }
const months = [...monthMap.keys()].sort();
const monthLinks = () => (months.length ? `<div class="taglist">${months.map((k) => `<a class="tag" href="/month/${k}.html">${monthLabel(k)}(${monthMap.get(k).length}件)</a>`).join("")}</div>` : "");
const lastmodOf = (list) => list.map((x) => x.checked).filter(Boolean).sort().pop() ?? nowJst.slice(0, 10);
// パンくずの構造化データ: items = [[名前, パス], ..., [名前]](最後だけパスなし)
const crumbsLd = (items) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map(([name, p], i) => ({ "@type": "ListItem", position: i + 1, name, ...(p ? { item: `${cfg.baseUrl}${p}` } : {}) })) });
const listNames = (arr, n = 3) =>arr.slice(0, n).map((x) => x.name.replace(/\s*[(〈].*$/, "")).join("、");
const sourceNote = (x) => {
  if (!x.source && !x.checked && !x.auto) return "";
  const day = x.checked ?? x.lastSeen; // 自動取得したものは、最後に取得元で確認できた日
  return `<p class="meta">出典: ${esc(x.source ?? "")}${day ? `(${jpDate(day)}${x.auto ? "取得" : "確認"})` : ""}。日時などは変わることがあります。お出かけの前に公式情報をご確認ください(<a href="/disclaimer.html">免責事項</a>)。</p>${x.auto ? '<p class="meta">この情報は、公開されている情報から、プログラムで取得し、自動の検査を経て、掲載しています。誤りに気づいたら、お問い合わせからお知らせください。</p>' : ""}`;
};
// Googleカレンダーで、全開催の日程(events.ics)を購読する画面を開くリンク(URLで追加 = 新しい開催も、自動で反映される)
const GCAL_SUBSCRIBE = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(`webcal://${cfg.domain}/events.ics`)}`;
const GUIDE_LINK ='<p class="meta">はじめて神楽を観る方は、<a href="/guide.html">見どころ・マナー・服装のガイド</a>もどうぞ。</p>';
const geoNote = (x) => (x.geoPrecision === "city" ? '<p class="meta">※ 地図のピンは、市区町村のおおよその位置です。正確な場所は公式情報をご確認ください。</p>' : x.geoPrecision === "area" ? '<p class="meta">※ 地図のピンは、町名ごとのおおよその位置です。正確な場所は公式情報をご確認ください。</p>' : "");
const zoomOf = (x) => (x.geoPrecision === "city" ? 11 : x.geoPrecision === "area" ? 13 : 15);
const mapBlock = (x) => (x.lat != null ? `<div class="mapbox"><div id="map" class="dmap" role="region" aria-label="会場周辺の地図" data-lat="${x.lat}" data-lng="${x.lng}" data-zoom="${zoomOf(x)}"></div><button type="button" class="maplock" id="mapbig" aria-expanded="false">地図を大きく見る</button></div>${clientJs("detailmap")}${geoNote(x)}<p class="routebtn"><a class="btn ghost sm" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${x.venue ?? ""} ${x.prefecture}${x.city ?? ""}`.trim())}" target="_blank" rel="noopener">経路を調べる</a></p>` : "");
// ---------- 今週末・今月(日付で中身が変わる。deploy.yml が毎日、作り直す) ----------
const today = nowJst.slice(0, 10);
const onDay = (e, d) => e.start.slice(0, 10) <= d && (e.end || e.start).slice(0, 10) >= d;
const timeOf = (r) => (r.schedule.match(/\d{1,2}:\d{2}/)?.[0] ?? "99:99").padStart(5, "0");
const daysBetween = (a, b) => { const out = []; for (let d = a; d <= b; d = addDays(d, 1)) out.push(d); return out; };
const maxDay = (...xs) => xs.flat().filter(Boolean).sort().pop();
// 毎週などの定期公演の、期間中の公演日。毎日の公演は、別に扱う(一覧が、同じ公演で埋まらないように)
const regularDates = (days) => regular.filter((r) => !isDaily(r)).map((r) => ({ r, dates: days.filter((d) => regularOn(r, d)) })).filter((x) => x.dates.length);
const dailyIn = (days) => regular.filter((r) => isDaily(r) && days.some((d) => regularOn(r, d))).map((r) => ({ r, closed: days.filter((d) => !regularOn(r, d)) }));
const wk = weekendRange(today);
const wkLabel = rangeLabel(wk.start, wk.end);
const wkHolidays = [...new Set(wk.days.map(holidayName).filter(Boolean))];
const wkRenkyu = wk.days.length >= 3 ? `${wk.days.length}連休` : "";
const wkEvents = upcoming.filter((e) => wk.days.some((d) => onDay(e, d)));
const wkRegs = regularDates(wk.days), wkDaily = dailyIn(wk.days);
const wkCount = wkEvents.length + wkRegs.reduce((n, x) => n + x.dates.length, 0);
const mk = today.slice(0, 7), tmLabel = monthLabel(mk);
const monthEnd = addDays(`${addDays(`${mk}-28`, 4).slice(0, 7)}-01`, -1);
const monthDays = daysBetween(today, monthEnd);
const tmEvents = upcoming.filter((e) => e.start.slice(0, 7) <= mk);
const tmRegs = regularDates(monthDays), tmDaily = dailyIn(monthDays);
const nextMk = addDays(monthEnd, 1).slice(0, 7);
const nmEvents = upcoming.filter((e) => e.start.slice(0, 7) === nextMk);

rmSync(OUT, { recursive: true, force: true });

// クライアント用の軽量データ (地図・日付と場所の検索)
const lite = events.map(({ id, name, kagura, prefecture, city, venue, start, end, lat, lng, fee, timeUnknown }) => ({ id, name, kagura, prefecture, city, venue, start, end, lat, lng, fee, timeUnknown, up: isUpcoming({ start, end, timeUnknown }) }));
write("dist/events.json", JSON.stringify(lite));
write("dist/regular.json", JSON.stringify(regular.map(({ id, name, kagura, prefecture, city, venue, schedule, lat, lng }) => ({ id, name, kagura, prefecture, city, venue, schedule, lat, lng }))));

const PREF_ORDER = REGIONS.flatMap(([, ps]) => ps);
const byPref = (a, b) => PREF_ORDER.indexOf(a) - PREF_ORDER.indexOf(b);
const prefs = [...new Set([...upcoming, ...regular].map((e) => e.prefecture))].sort(byPref);
const kaguraPref = (k) => [...events, ...regular].find((e) => e.kagura === k)?.prefecture ?? "";
const kaguraCount = (k) => [...upcoming, ...regular].filter((e) => e.kagura === k).length;
const kaguras = [...new Set([...events, ...regular].map((e) => e.kagura).filter(Boolean))]
  .sort((a, b) => byPref(kaguraPref(a), kaguraPref(b)) || kaguraCount(b) - kaguraCount(a) || a.localeCompare(b, "ja"));

// ---------- トップ ----------
// 「開催予定」: 直近2か月(開催のある月)だけをカードで出し、その先は月ごとのボタンにする(件数が増えても長くならない)
const HOME_MONTHS = 2, HOME_CAP = 8; // 最初に出すのは8件まで。残りは「すべて見る」で
const homeMonths = months.slice(0, HOME_MONTHS), laterMonths = months.slice(HOME_MONTHS);
const monthShort = (k) => (k.slice(0, 4) === nowJst.slice(0, 4) ? `${+k.slice(5, 7)}月` : monthLabel(k));
const regionsUsed = REGIONS.map(([r]) => r).filter((r) => upcoming.some((e) => regionOf(e.prefecture) === r));
const prefsUsed = [...new Set(upcoming.map((e) => e.prefecture))].sort(byPref);
// 先の月のボタンの件数: 地方ごと・県ごと(絞り込んだときに、その数に変える)
const regionCounts = (list) => JSON.stringify(Object.fromEntries([...regionsUsed, ...prefsUsed].map((k) => [k, list.filter((e) => regionOf(e.prefecture) === k || e.prefecture === k).length])));
// 直近2か月の開催のうち、HOME_CAP 件を超える分は隠す(「すべて見る」か、地方・県で絞ったときに出す)
const homeAll = homeMonths.flatMap((k) => monthMap.get(k));
let homeIdx = 0;
const homeList = homeMonths.map((k) => {
  const list = monthMap.get(k);
  const rows = list.map((e) => { const ov = homeIdx++ >= HOME_CAP; return `<div data-r="${regionOf(e.prefecture)}" data-p="${esc(e.prefecture)}"${ov ? ' class="ov" hidden' : ""}>${card(e, "h4")}</div>`; });
  const allHidden = rows.every((r) => r.includes(' class="ov" hidden'));
  return `<div class="mgroup"${allHidden ? " hidden" : ""}><h3 class="mhead">${monthShort(k)}</h3>${rows.join("")}</div>`;
}).join("");
const showAll = homeAll.length > HOME_CAP ? `<p class="more"><a class="btn ghost sm" id="showall" href="/calendar.html">直近の開催をすべて見る(${homeAll.length}件)</a></p>` : "";
// 県のボタン: 地方を選んだとき、その地方に開催のある県が2つ以上あれば出す
const prefButtons = regionsUsed.length ? `<div class="regions prefs" role="group" aria-label="都道府県で絞り込む" hidden><button type="button" data-p="" aria-pressed="true">すべての県</button>${prefsUsed.map((p) => `<button type="button" data-p="${esc(p)}" data-in="${regionOf(p)}" aria-pressed="false" hidden>${esc(p)}</button>`).join("")}</div>` : "";
const laterLinks = laterMonths.length ? `<div class="laterwrap"><h3 class="mhead">この先の開催</h3><div class="taglist later">${laterMonths.map((k) => { const l = monthMap.get(k); return `<a class="tag" href="/month/${k}.html" data-n="${l.length}" data-c="${esc(regionCounts(l))}">${monthShort(k)} <span>${l.length}件</span></a>`; }).join("")}</div></div>` : "";
const regionButtons = regionsUsed.length > 1 ? `<div class="regions" role="group" aria-label="地方で絞り込む" hidden><button type="button" data-r="" aria-pressed="true">全国</button>${regionsUsed.map((r) => `<button type="button" data-r="${r}" aria-pressed="false">${r}</button>`).join("")}</div>` : "";
write("dist/index.html", layout({
  // 検索結果で選ばれやすく: 「神楽 日程」「神楽 今週末」で探す人に、何ができるかが一目で分かる題と説明にする
  title: `全国の神楽の日程・今週末の公演 | ${cfg.siteName}`,
  desc: clip(`今週末、どこで神楽が観られる？${[...new Set([...["石見神楽", "高千穂神楽", "広島神楽", "備中神楽"].filter((k) => kaguras.includes(k)), ...kaguras])].slice(0, 3).join("・")}など、全国の神楽の日程と会場を、日付・場所・地図で探せます。公式情報で確かめた開催だけを掲載しています。`),
  path: "/", active: "/",
  // サイト名: 検索結果に、ドメイン名ではなく「神楽めぐり」と出すための情報(トップページの WebSite)
  ld: [{ "@context": "https://schema.org", "@type": "WebSite", name: cfg.siteName, alternateName: ["かぐらめぐり", "Kagura Meguri"], url: `${cfg.baseUrl}/`, inLanguage: "ja", description: cfg.description, publisher: ORG_LD },
    itemListLd("開催予定の神楽", upcoming.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })))].filter(Boolean),
  body: `<section class="hero home-hero">
${MOONSCAPE}${sparksHtml}
<div class="copy"><h1><span class="ph">神話を受け継ぐ</span><span class="ph">舞を、</span><br><span class="ph">この目で。</span></h1><p><span class="ph">各地で催される神楽の、</span><span class="ph">日取りと舞台を。</span></p></div>
<div class="vert" aria-hidden="true">笛と太鼓、夜の社に舞う</div></section>
<nav class="quick" aria-label="日付から探す"><a href="/weekend.html"><b>今週末の神楽</b><small>${esc(wkLabel)}${wkRenkyu ? `(${wkRenkyu})` : ""} ・ ${wkCount ? `${wkCount}件の開催・公演` : wkDaily.length ? "毎晩の定期公演あり" : "このあとの開催を見る"}</small></a><a href="/this-month.html"><b>今月の神楽</b><small>${tmLabel} ・ ${tmEvents.length ? `開催 ${tmEvents.length}件` : "定期公演・来月の予定"}</small></a></nav>
<h2>開催予定</h2>
${regionButtons}${prefButtons}
${adSlot(cfg.adsense.slotList)}
<div id="list">${homeList || empty("現在掲載中の開催情報はありません。開催情報の掲載は、上のメニューの「主催者の方へ」からお寄せください。")}</div>
${showAll}
<p class="empty" id="none" hidden>この地域の${laterMonths.length ? "、直近の開催はありません。この先の開催は、下の月から探せます" : "開催予定は、いまのところありません"}。</p>
${laterLinks}
${regular.length ? `<h2>毎週・毎晩の定期公演</h2><div class="reglist">${regular.map(regCard).join("")}</div>${regular.length > 3 ? `<p class="more" hidden><button type="button" class="btn ghost sm" id="regmore">定期公演をすべて表示(${regular.length}件)</button></p>` : ""}` : ""}
${prefs.length ? `<h2>都道府県で探す</h2><div class="taglist">${prefs.map((p) => `<a class="tag" href="${prefHref(p)}">${esc(p)}</a>`).join("")}</div>` : ""}
${kaguras.length ? `<h2>種類で探す</h2><div class="taglist">${kaguras.map((k) => kaguraTag(k)).join("")}</div>` : ""}
${clientJs("home")}`,
}));

// ---------- 地図 (Leaflet + OpenStreetMap) ----------
// 会場の一覧: 会場ごとにまとめ、その下に、開催(日付つき)と定期公演を並べる。会場の並びは、北の県から
const venueList = () => {
  const groups = new Map();
  for (const x of [...upcoming, ...regular]) {
    const k = `${x.prefecture}|${x.city ?? ""}|${x.venue ?? ""}`;
    if (!groups.has(k)) groups.set(k, { pref: x.prefecture, city: x.city ?? "", venue: x.venue ?? "", items: [] });
    groups.get(k).items.push(x);
  }
  const list = [...groups.values()].sort((a, b) => byPref(a.pref, b.pref) || a.city.localeCompare(b.city, "ja"));
  if (!list.length) return "";
  const item = (x) => (x.start
    ? `<span class="md">${esc(mdw(x.start.slice(0, 10)))}</span><a href="/events/${x.id}.html">${esc(x.name)}</a>`
    : `<span class="md">定期公演</span><a href="/regular/${x.id}.html">${esc(x.name)}</a> <span class="meta">${esc(x.schedule.replace(/[(。].*$/, "").trim())}</span>`);
  return `<h2>会場の一覧</h2><p class="meta">会場名を押すと、地図がその場所に移ります。</p><ul class="venuelist">${list.map((g) => `<li><button type="button" class="vjump" data-k="${esc(`${g.pref}|${g.city}|${g.venue}`)}" disabled>${esc(g.venue || g.city)}</button><span class="meta"> ${esc(g.pref)}${esc(g.city)}</span><ul class="vitems">${g.items.map((x) => `<li>${item(x)}</li>`).join("")}</ul></li>`).join("")}</ul>`;
};
write("dist/map.html", layout({
  title: `神楽の開催地マップ | 会場を地図で探す | ${cfg.siteName}`,
  desc: clip(`これから開催される神楽と、毎晩・毎週の定期公演の会場を、地図で探せます。${[...new Set([...upcoming, ...regular].map((e) => e.prefecture))].slice(0, 5).join("・")}など、${upcoming.length + regular.length}件の会場を掲載しています。`),
  path: "/map.html", active: "/map.html",
  head: LEAFLET,
  ld: [crumbsLd([["ホーム", "/"], ["地図で探す"]]), itemListLd("神楽の開催会場", [...upcoming.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })), ...regular.map((r) => ({ href: `/regular/${r.id}.html`, name: r.name }))])].filter(Boolean),
  body: `${crumbNav([["ホーム", "/"], ["地図で探す"]])}${hero("地図で探す", "これから開催される神楽と、定期公演の会場を、地図で探せます。")}<div class="mapbox"><div id="map" role="region" aria-label="開催場所の地図"></div><button type="button" class="maplock" id="maplock" aria-pressed="false" hidden>地図を動かす</button></div>
<p class="legend meta"><span><span class="pin ev"></span>日付のある開催</span><span><span class="pin reg"></span>定期公演</span><span><span class="pin mix"></span>両方</span><span>数字は、同じ場所の件数です。</span></p>
<p class="meta" id="mapmsg" aria-live="polite"></p>
<p class="meta">地図データ © OpenStreetMap contributors</p>${adSlot(cfg.adsense.slotList)}
${venueList()}
${clientJs("map")}`,
}));

// ---------- 日付・場所で探す(/calendar.html。URL は前のカレンダーのまま) ----------
// 「いつ」(今週末・今月・来月・日付の範囲)と「どこ」(地方 → 都道府県)で、開催予定を絞り込む。条件は URL に残す(共有・戻るで同じ結果)
const finderPrefs = REGIONS.map(([r, ps]) => [r, ps.filter((p) => upcoming.some((e) => e.prefecture === p))]).filter(([, ps]) => ps.length);
write("dist/calendar.html", layout({
  title: `日付・場所で神楽を探す | 開催日程の検索 | ${cfg.siteName}`,
  desc: clip(`神楽の開催予定を、日付(今週末・今月・来月・日付の指定)と、地方・都道府県で絞り込んで探せます。${months.length ? months.slice(0, 4).map(monthLabel).join("・") + "などの開催を、" : ""}公式情報をもとに掲載しています。`),
  path: "/calendar.html", active: "/calendar.html", ld: crumbsLd([["ホーム", "/"], ["日付・場所で探す"]]),
  body: `${crumbNav([["ホーム", "/"], ["日付・場所で探す"]])}${hero("日付・場所で探す", "いつ・どこで観たいかを選ぶと、当てはまる開催が一覧で出ます。")}
<form class="finder" id="finder" role="search" aria-label="開催を探す" hidden>
<fieldset><legend>いつ</legend><div class="regions" role="group" aria-label="期間"><button type="button" data-w="all" aria-pressed="true">すべて</button><button type="button" data-w="weekend" aria-pressed="false">今週末</button><button type="button" data-w="month" aria-pressed="false">今月</button><button type="button" data-w="next" aria-pressed="false">来月</button><button type="button" data-w="range" aria-pressed="false">日付を指定</button></div>
<div class="range" id="range" hidden><label><input type="date" id="from" aria-label="いつから"> から</label><label><input type="date" id="to" aria-label="いつまで"> まで</label></div></fieldset>
<fieldset><legend>どこ</legend><div class="where"><label for="region" class="sr">地方</label><select id="region"><option value="">全国</option>${finderPrefs.map(([r]) => `<option value="${r}">${r}</option>`).join("")}</select>
<label for="pref" class="sr">都道府県</label><select id="pref"><option value="">すべての都道府県</option>${finderPrefs.map(([r, ps]) => ps.map((p) => `<option value="${p}" data-r="${r}">${p}</option>`).join("")).join("")}</select></div></fieldset>
<p class="freset" hidden><button type="button" class="linkbtn" id="reset">条件をリセット</button></p>
</form>
<p class="count" id="count" aria-live="polite"></p>
<ol class="monthlist" id="results" aria-label="当てはまる開催"></ol>
<p class="meta">毎晩・毎週の定期公演は、<a href="/weekend.html">今週末の神楽</a>・<a href="/this-month.html">今月の神楽</a>のページにまとめています。</p>
${adSlot(cfg.adsense.slotList)}
${months.length ? `<h2>月ごとの一覧</h2><p class="meta">各月の開催を、ページごとにまとめています。</p>${monthLinks()}` : ""}
<p><a class="btn ghost gcal" href="${GCAL_SUBSCRIBE}" target="_blank" rel="noopener">すべての開催を、Googleカレンダーに追加する</a></p>
<p class="meta">Googleカレンダーの「他のカレンダー」に「${esc(cfg.siteName)}」が追加され、新しい開催が、自動で反映されます(反映まで、数時間から1日ほどかかることがあります)。不要になったら、Googleカレンダーの設定から、登録を解除できます。</p>
<script>
(function(){
var f=document.getElementById('finder'),out=document.getElementById('results'),cnt=document.getElementById('count');
var rg=document.getElementById('region'),pf=document.getElementById('pref'),fr=document.getElementById('from'),to=document.getElementById('to'),rangeBox=document.getElementById('range'),rs=document.getElementById('reset');
var list=[],loaded=false,failed=false,when='all',regionOf={};
[].forEach.call(pf.options,function(o){if(o.value)regionOf[o.value]=o.dataset.r});
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var p2=function(n){return String(n).padStart(2,'0')};
var ymd=function(d){return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())};
var WD=['日','月','火','水','木','金','土'];
f.hidden=false;
// 期間: [はじめ, おわり](日付の文字列。空は「制限なし」)。今週末は、土曜と日曜(日曜に見たときは、その日だけ)
function span(){
  var t=new Date();t.setHours(0,0,0,0);var w=t.getDay();
  if(when==='weekend'){if(w===0)return[ymd(t),ymd(t)];var s=new Date(t);s.setDate(t.getDate()+(6-w));var e=new Date(s);e.setDate(s.getDate()+1);return[ymd(w===6?t:s),ymd(e)]}
  if(when==='month')return[ymd(t),ymd(new Date(t.getFullYear(),t.getMonth()+1,0))];
  if(when==='next')return[ymd(new Date(t.getFullYear(),t.getMonth()+1,1)),ymd(new Date(t.getFullYear(),t.getMonth()+2,0))];
  if(when==='range')return[fr.value||'',to.value||''];
  return['',''];
}
// 地方を選ぶと、都道府県の選択肢を、その地方だけにする
function syncPrefs(){
  [].forEach.call(pf.options,function(o){if(o.value)o.hidden=o.disabled=!!rg.value&&o.dataset.r!==rg.value});
  if(pf.value&&regionOf[pf.value]!==rg.value&&rg.value)pf.value='';
}
function draw(){
  var sp=span(),a=sp[0],b=sp[1];
  var hit=list.filter(function(x){
    if(!x.up)return false;
    var s=x.start.slice(0,10),e=(x.end||x.start).slice(0,10);
    if(a&&e<a)return false;if(b&&s>b)return false;
    if(pf.value)return x.prefecture===pf.value;
    if(rg.value)return regionOf[x.prefecture]===rg.value;
    return true;
  });
  out.innerHTML=hit.map(function(x){var d=new Date(+x.start.slice(0,4),+x.start.slice(5,7)-1,+x.start.slice(8,10));
    return '<li><span class="md">'+(d.getMonth()+1)+'月'+d.getDate()+'日<small>('+WD[d.getDay()]+')</small></span><span><a href="/events/'+esc(x.id)+'.html">'+esc(x.name)+'</a><br><span class="meta">'+(x.kagura?esc(x.kagura)+' ・ ':'')+esc(x.prefecture)+esc(x.city||'')+(x.timeUnknown?'':' ・ '+x.start.slice(11,16)+'〜')+'</span></span></li>'}).join('');
  cnt.textContent=failed?'開催情報を読み込めませんでした。時間をおいて再読み込みしてください。':!loaded?'読み込んでいます…':hit.length?'当てはまる開催 '+hit.length+'件':'当てはまる開催は、いまのところありません。期間や場所を広げてみてください。';
  var q=new URLSearchParams();if(when!=='all')q.set('when',when);if(when==='range'){if(fr.value)q.set('from',fr.value);if(to.value)q.set('to',to.value)}if(rg.value)q.set('region',rg.value);if(pf.value)q.set('pref',pf.value);
  var s=q.toString();try{history.replaceState(null,'',location.pathname+(s?'?'+s:''))}catch(e){}
  rs.parentNode.hidden=!s;
}
function setWhen(v){when=v;[].forEach.call(f.querySelectorAll('[data-w]'),function(b){b.setAttribute('aria-pressed',String(b.dataset.w===v))});rangeBox.hidden=v!=='range'}
f.addEventListener('click',function(ev){var b=ev.target.closest('[data-w]');if(!b)return;setWhen(b.dataset.w);draw();if(when==='range'&&!fr.value){fr.focus();try{fr.showPicker()}catch(e){}}});
rs.addEventListener('click',function(){setWhen('all');rg.value='';pf.value='';fr.value='';to.value='';syncPrefs();draw();f.querySelector('[data-w=all]').focus()});
rg.addEventListener('change',function(){syncPrefs();draw()});
pf.addEventListener('change',function(){if(pf.value)rg.value=regionOf[pf.value];syncPrefs();draw()});
fr.addEventListener('change',function(){if(to.value&&fr.value&&to.value<fr.value)to.value=fr.value;draw()});
to.addEventListener('change',function(){if(fr.value&&to.value&&fr.value>to.value)fr.value=to.value;draw()});
f.addEventListener('submit',function(ev){ev.preventDefault()});
// URL の条件を戻す(共有されたリンク・戻る)
var u=new URLSearchParams(location.search),okDate=function(v){return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v||'')};
if(['weekend','month','next','range'].indexOf(u.get('when'))>=0)setWhen(u.get('when'));
if(okDate(u.get('from')))fr.value=u.get('from');if(okDate(u.get('to')))to.value=u.get('to');
if(u.get('region')&&[].some.call(rg.options,function(o){return o.value&&o.value===u.get('region')}))rg.value=u.get('region');
if(regionOf[u.get('pref')]){pf.value=u.get('pref');rg.value=regionOf[pf.value]}
syncPrefs();draw();
fetch('/events.json').then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(l){list=l.sort(function(a,b){return a.start<b.start?-1:a.start>b.start?1:0});loaded=true;draw()}).catch(function(){failed=true;draw()});
})();
</script>`,
}));

// ---------- 神楽の種類 一覧 + 個別 ----------
write("dist/kagura/index.html", layout({
  title: `神楽の種類一覧 | 流派・系統ごとに探す | ${cfg.siteName}`,
  desc: clip(`${kaguras.slice(0, 5).join("、")}など、神楽の種類ごとに、開催日程と定期公演を探せます。それぞれの特徴も、あわせて紹介します。`),
  path: "/kagura/", active: "/kagura/",
  ld: crumbsLd([["ホーム", "/"], ["種類で探す"]]),
  body: `${crumbNav([["ホーム", "/"], ["種類で探す"]])}${hero("種類で探す", "流派・系統ごとに、開催情報を探せます。")}<h2 class="sr">神楽の種類の一覧</h2>${kaguras
    .map((k) => `<div class="card"><div><h3><a href="${kaguraHref(k)}">${esc(k)}</a></h3>${kaguraInfo[k]?.tagline ? `<p class="tagline">${esc(kaguraInfo[k].tagline)}</p>` : ""}<div class="meta">${countLine(upcoming.filter((e) => e.kagura === k).length, regular.filter((r) => r.kagura === k).length)}</div></div></div>`)
    .join("") || empty("掲載中の神楽の種類は、まだありません。")}${adSlot(cfg.adsense.slotList)}`,
}));
// タイトルに入れる年(「◯◯神楽 2026」のような検索に合わせる)。これからの開催の年の範囲。なければ今年
const yearsOf = (list) => { const ys = [...new Set(list.map((e) => e.start.slice(0, 4)))].sort(); const y = ys.length ? ys : [nowJst.slice(0, 4)]; return y.length > 1 ? `${y[0]}〜${y[y.length - 1]}年` : `${y[0]}年`; };
for (const k of kaguras) {
  const list = upcoming.filter((e) => e.kagura === k), reg = regular.filter((r) => r.kagura === k);
  const first = [...events, ...regular].find((e) => e.kagura === k);
  const info = kaguraInfo[k];
  const when = list.length ? `${monthLabel(ym(list[0].start))}〜${monthLabel(ym(list[list.length - 1].start))}の開催${list.length}件` : "";
  write(`dist/kagura/${k}.html`, layout({
    title: `${k}の日程【${yearsOf(list)}】公演・開催情報 | ${cfg.siteName}`,
    desc: clip(`${k}の公演日程・会場・料金をまとめています。${when ? when + "、" : ""}${reg.length ? "定期公演" + reg.length + "件。" : ""}${info ? info.intro : ""}`),
    path: kaguraHref(k), active: "/kagura/", noindex: list.length + reg.length === 0,
    ld: [crumbsLd([["ホーム", "/"], ["種類で探す", "/kagura/"], [k]]), itemListLd(`${k}の開催情報`, [...list.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })), ...reg.map((r) => ({ href: `/regular/${r.id}.html`, name: r.name }))])].filter(Boolean),
    body: `${crumbNav([["ホーム", "/"], ["種類で探す", "/kagura/"], [k]])}${hero(esc(k), countLine(list.length, reg.length))}
${adSlot(cfg.adsense.slotList)}${list.length ? `<h2>開催予定</h2>${list.map((e) => card(e)).join("")}` : ""}${reg.length ? `<h2>毎週・毎晩の定期公演</h2>${reg.map(regCard).join("")}` : ""}${list.length + reg.length ? "" : empty("現在の開催予定はありません。")}
${info ? `<section class="about"><h2>${esc(k)}とは</h2><p>${esc(info.intro)}</p><p class="meta">出典: ${esc(info.source)}</p></section>` : ""}
${affiliateBlock({ prefecture: first.prefecture, city: "", kagura: k })}`,
  }));
}

// ---------- 都道府県ページ ----------
for (const p of [...new Set([...events, ...regular].map((e) => e.prefecture))]) {
  const list = events.filter((e) => e.prefecture === p && isUpcoming(e)), reg = regular.filter((r) => r.prefecture === p);
  const kinds = [...new Set([...list, ...reg].map((x) => x.kagura).filter(Boolean))];
  write(`dist/pref/${p}.html`, layout({
    title: `${p}の神楽 日程【${yearsOf(list)}】開催・会場一覧 | ${cfg.siteName}`,
    desc: clip(`${p}で開催される神楽の日程と会場をまとめています。${list.length ? "開催予定" + list.length + "件" : ""}${reg.length ? (list.length ? "、" : "") + "定期公演" + reg.length + "件" : ""}。${kinds.length ? kinds.join("、") + "などを紹介します。" : ""}公式情報をもとに、出典と確認日つきで掲載しています。`),
    path: prefHref(p), noindex: list.length + reg.length === 0,
    ld: [crumbsLd([["ホーム", "/"], [`${p}の神楽`]]), itemListLd(`${p}の神楽`, [...list.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })), ...reg.map((r) => ({ href: `/regular/${r.id}.html`, name: r.name }))])].filter(Boolean),
    body: `${crumbNav([["ホーム", "/"], [`${p}の神楽`]])}${hero(`${esc(p)}の神楽`, countLine(list.length, reg.length))}
<p class="lead">${esc(p)}で開催される神楽の日程と会場を、公式情報をもとにまとめています。${kinds.length ? `${kinds.map((k) => `<a href="${kaguraHref(k)}">${esc(k)}</a>`).join("、")}の公演を掲載しています。` : ""}日時・会場は変更されることがあるため、お出かけの前に、各ページの公式情報をご確認ください。</p>
${adSlot(cfg.adsense.slotList)}${list.length ? `<h2>開催予定</h2>${list.map((e) => card(e)).join("")}` : ""}${reg.length ? `<h2>毎週・毎晩の定期公演</h2>${reg.map(regCard).join("")}` : ""}${list.length + reg.length ? "" : empty("現在の開催予定はありません。")}${affiliateBlock({ prefecture: p, city: "", kagura: "神楽" })}`,
  }));
}

// ---------- 詳細ページ(日付のある開催) ----------
// iCalendar(RFC 5545): UID/DTSTAMP 必須、CRLF 改行、文字のエスケープ、時間未定は終日扱い
const ie = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const ymd = (s) => s.slice(0, 10).replace(/-/g, "");
const dt = (s) => `${ymd(s)}T${s.slice(11, 13)}${s.slice(14, 16)}00`;
const nextDay = (s) => new Date(asMs(s.slice(0, 10) + "T00:00") + 864e5).toISOString().slice(0, 10).replace(/-/g, "");
const veventLines = (e) => [
  "BEGIN:VEVENT", `UID:${e.id}@${cfg.domain || "kagura"}`, `DTSTAMP:${nowJst.slice(0, 10).replace(/-/g, "")}T000000Z`,
  `SUMMARY:${ie(e.name)}`,
  ...(e.timeUnknown ? [`DTSTART;VALUE=DATE:${ymd(e.start)}`, `DTEND;VALUE=DATE:${nextDay(e.end || e.start)}`]
    : [`DTSTART;TZID=Asia/Tokyo:${dt(e.start)}`, `DTEND;TZID=Asia/Tokyo:${dt(e.end || new Date(asMs(e.start) + 2 * 3600e3).toISOString().slice(0, 16))}`]),
  `LOCATION:${ie(`${e.venue ?? ""} ${e.prefecture}${e.city ?? ""}`.trim())}`,
  `URL:${cfg.baseUrl}/events/${e.id}.html`,
  "END:VEVENT",
];
// Googleカレンダーの予定作成画面を、この開催の内容を入れた状態で開くリンク(日時・終日の扱いは、ICS と同じ)
const gcalEvent = (e) => {
  const dates = e.timeUnknown ? `${ymd(e.start)}/${nextDay(e.end || e.start)}` : `${dt(e.start)}/${dt(e.end || new Date(asMs(e.start) + 2 * 3600e3).toISOString().slice(0, 16))}`;
  const details = [`${cfg.siteName}: ${cfg.baseUrl}/events/${e.id}.html`, e.url ? `公式情報: ${e.url}` : "", "※ 日時・会場は変更されることがあります。お出かけの前に、公式情報をご確認ください。"].filter(Boolean).join("\n");
  const location = `${e.venue ?? ""} ${e.prefecture}${e.city ?? ""}${e.address ?? ""}`.trim();
  return `https://calendar.google.com/calendar/render?${new URLSearchParams({ action: "TEMPLATE", text: e.name, dates, ctz: "Asia/Tokyo", location, details })}`;
};
const vcal = (list) => ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${cfg.siteName}//JA`, "CALSCALE:GREGORIAN", `X-WR-CALNAME:${ie(cfg.siteName)}`, "X-WR-TIMEZONE:Asia/Tokyo", ...list.flatMap(veventLines), "END:VCALENDAR"].join("\r\n") + "\r\n";
// 共有: LINE で送る・リンクをコピー(押したときだけ、外部へ移動する。コピーはこのページの中だけで動く)
const shareBlock = (path, title) => { const url = `${cfg.baseUrl}${path}`; return `<p class="share"><span class="meta">共有</span><a class="btn ghost sm" href="https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}" target="_blank" rel="noopener" data-goatcounter-click="share-line">LINEで送る</a><button type="button" class="btn ghost sm" data-copy="${esc(url)}">リンクをコピー</button></p>${clientJs("share")}`; };
// 開催ページ・定期公演ページの並び(共通): 要点(日時・会場・料金) → 公式情報のボタン・共有 → 説明・ほかの日程 → 地図・経路 → 出典 → 宿の案内 → あわせて観たい神楽 → 広告
// あわせて観たい神楽: 同じ種類の開催予定を先に、同じ県の開催予定を後に(開催・定期公演のどちらのページでも使う)
const related = (e) => {
  const uniq = (arr) => arr.filter((x, i) => arr.findIndex((y) => seriesKey(y) === seriesKey(x)) === i && seriesKey(x) !== seriesKey(e));
  const same = uniq(upcoming.filter((x) => x.id !== e.id && x.kagura && x.kagura === e.kagura)).slice(0, 4);
  const near = uniq(upcoming.filter((x) => x.id !== e.id && x.prefecture === e.prefecture && !same.includes(x))).slice(0, 4);
  const seen = new Set([seriesKey(e)]);
  const list = [...same, ...near].filter((x) => !seen.has(seriesKey(x)) && seen.add(seriesKey(x))).sort((a, b) => a.start.localeCompare(b.start));
  return list.length ? `<h2>あわせて観たい神楽</h2><ol class="monthlist">${list.map((x) => `<li><span class="md">${esc(mdw(x.start.slice(0, 10)).replace(/\((.)\)$/, ""))}<small>(${WD[parts(x.start).wd]})</small></span><span><a href="/events/${x.id}.html">${esc(x.name)}</a><br><span class="meta">${x.kagura ? esc(x.kagura) + " ・ " : ""}${esc(x.prefecture)}${esc(x.city ?? "")}</span></span></li>`).join("")}</ol>` : "";
};
for (const e of events) {
  const JST = "+09:00";
  const ld = {
    "@context": "https://schema.org", "@type": "Event", name: e.name,
    startDate: e.timeUnknown ? e.start.slice(0, 10) : e.start + JST,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", eventStatus: "https://schema.org/EventScheduled",
    location: { "@type": "Place", name: e.venue || `${e.prefecture}${e.city}`, address: { "@type": "PostalAddress", addressRegion: e.prefecture, addressLocality: e.city, ...(e.address ? { streetAddress: e.address } : {}), addressCountry: "JP" } },
    url: `${cfg.baseUrl}/events/${e.id}.html`,
  };
  if (e.end) ld.endDate = e.timeUnknown ? e.end.slice(0, 10) : e.end + JST;
  ld.image = [OG_URL];
  if (e.description) ld.description = e.description;
  if (e.fee) ld.offers = { "@type": "Offer", description: e.fee, url: e.url || `${cfg.baseUrl}/events/${e.id}.html`, availability: "https://schema.org/InStock", ...(/無料/.test(e.fee) && !/円/.test(e.fee) ? { price: "0", priceCurrency: "JPY" } : /[\d,]+円/.test(e.fee) ? { price: e.fee.match(/([\d,]+)円/)[1].replace(/,/g, ""), priceCurrency: "JPY" } : {}) }; // 金額があれば、最初の金額(一般・大人の料金)を価格にする
  if (/無料/.test(e.fee ?? "") && !/円/.test(e.fee ?? "")) ld.isAccessibleForFree = true;
  if (e.lat != null) ld.location.geo = { "@type": "GeoCoordinates", latitude: e.lat, longitude: e.lng };
  const when = whenOf(e);
  const others = sameSeries(e).filter(isUpcoming);
  write(`dist/events/${e.id}.html`, layout({
    // 検索結果で切れないよう、長い名称はタイトルでは短くする(ページの見出しは、名称のまま)
    title: `${e.name.length > 36 ? e.name.slice(0, 35) + "…" : e.name}(${jpDate(e.start.slice(0, 10))}) | ${e.prefecture} | ${cfg.siteName}`,
    desc: padDesc(clip(`${fmt(e.start).replace(e.timeUnknown ? / \d\d:\d\d$/ : /$^/, "")}、${e.venue ? e.venue + "(" + e.prefecture + (e.city ?? "") + ")" : e.prefecture + (e.city ?? "")}で開催される${e.kagura || "神楽"}。${e.fee ? "料金: " + e.fee + "。" : ""}${e.description ?? ""}`)),
    path: `/events/${e.id}.html`, noindex: !isUpcoming(e), ogType: "article", ld: [ld, crumbsLd([["ホーム", "/"], [e.prefecture, prefHref(e.prefecture)], [e.name]])],
    head: e.lat != null ? LEAFLET : "",
    body: `${crumbNav([["ホーム", "/"], [e.prefecture, prefHref(e.prefecture)], [e.name]])}${hero(esc(e.name),`${kaguraTag(e.kagura)}<a class="tag" href="${prefHref(e.prefecture)}">${esc(e.prefecture)}</a>${isUpcoming(e) ? "" : '<span class="tag">終了しました</span>'}`)}
<div class="keyinfo"><table class="info"><tr><th>日時</th><td>${when}</td></tr><tr><th>会場</th><td>${e.venue ? esc(e.venue) : "公式情報をご確認ください"}</td></tr>
<tr><th>所在地</th><td>${esc(e.prefecture)} ${esc(e.city)}</td></tr><tr><th>料金</th><td>${e.fee ? esc(e.fee) : "公式情報をご確認ください"}</td></tr></table></div>
<p class="actions">${e.url ? `<a class="btn" href="${esc(e.url)}" rel="noopener" target="_blank">公式情報を見る</a> ` : ""}<a class="btn ghost sm" href="${esc(gcalEvent(e))}" target="_blank" rel="noopener">Googleカレンダーに追加</a></p>
${shareBlock(`/events/${e.id}.html`, e.name)}
<p>${esc(e.description)}</p>
${others.length ? `<p class="dates"><span class="meta">ほかの日程:</span> ${others.map((x) => `<a class="chip" href="/events/${x.id}.html">${esc(mdw(x.start.slice(0, 10)))}</a>`).join("")}</p>` : ""}
${mapBlock(e)}
${sourceNote(e)}${GUIDE_LINK}
${isUpcoming(e) ? stayBlock(e) : ""}
${related(e)}
${adSlot(cfg.adsense.slotDetail)}`,
  }));
}

// ---------- 詳細ページ(定期公演) ----------
for (const r of regular) {
  const row = (th, v) => (v ? `<tr><th>${th}</th><td>${esc(v)}</td></tr>` : "");
  write(`dist/regular/${r.id}.html`, layout({
    title: `${r.name} | ${r.schedule.replace(/\(.*$/, "").trim()} | ${cfg.siteName}`,
    desc: padDesc(clip(`${r.prefecture}${r.city ?? ""}${r.venue ? "の" + r.venue : ""}で観られる、${r.kagura || "神楽"}の定期公演です。公演日時: ${r.schedule.replace(/。$/, "")}。${r.fee ? "料金: " + r.fee.replace(/。$/, "") + "。" : ""}${r.description ?? ""}`)),
    path: `/regular/${r.id}.html`, ld: crumbsLd([["ホーム", "/"], [r.prefecture, prefHref(r.prefecture)], [r.name]]),
    head: r.lat != null ? LEAFLET : "",
    body: `${crumbNav([["ホーム", "/"], [r.prefecture, prefHref(r.prefecture)], [r.name]])}${hero(esc(r.name),`<span class="tag">定期公演</span>${kaguraTag(r.kagura)}<a class="tag" href="${prefHref(r.prefecture)}">${esc(r.prefecture)}</a>`)}
<div class="keyinfo"><table class="info">${row("公演日時", r.schedule)}${row("期間", r.season)}${row("休演日", r.closed)}${row("会場", r.venue)}${row("所在地", `${r.prefecture} ${r.city ?? ""}`.trim())}${row("料金", r.fee || "公式情報をご確認ください")}${row("予約", r.booking)}</table></div>
${r.url ? `<p class="actions"><a class="btn" href="${esc(r.url)}" rel="noopener" target="_blank">公式情報を見る</a></p>` : ""}
${shareBlock(`/regular/${r.id}.html`, r.name)}
<p>${esc(r.description)}</p>
${mapBlock(r)}
${sourceNote(r)}${GUIDE_LINK}
${affiliateBlock(r)}
${related(r)}
${adSlot(cfg.adsense.slotDetail)}`,
  }));
}

// ---------- 月別ページ(「11月 神楽 開催」のような、日付の検索に当てる。日付・場所の検索はJSで結果を出すため、検索エンジンには中身が見えない) ----------
months.forEach((k) => {
  const list = monthMap.get(k), label = monthLabel(k);
  const prefsIn = [...new Set(list.map((e) => e.prefecture))], kindsIn = [...new Set(list.map((e) => e.kagura).filter(Boolean))];
  write(`dist/month/${k}.html`, layout({
    title: `${label}の神楽 開催日程(${list.length}件) | ${cfg.siteName}`,
    desc: clip(`${label}に開催される神楽の日程一覧です。${prefsIn.join("・")}の${list.length}件${kindsIn.length ? "(" + kindsIn.join("、") + ")" : ""}を、日付順に掲載しています。会場・料金・公式情報へのリンクつき。`),
    path: `/month/${k}.html`, active: "/month/",
    ld: [crumbsLd([["ホーム", "/"], ["日付・場所で探す", "/calendar.html"], [label]]), itemListLd(`${label}の神楽`, list.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })))],
    body: `${crumbNav([["ホーム", "/"], ["日付・場所で探す", "/calendar.html"], [label]])}${hero(`${label}の神楽`, countLine(list.length, 0))}
<p class="lead">${label}に開催される神楽を、日付順にまとめています。${prefsIn.map((p) => `<a href="${prefHref(p)}">${esc(p)}</a>`).join("、")}の開催です。日時・会場は変更されることがあるため、お出かけの前に、各ページの公式情報をご確認ください。</p>
${adSlot(cfg.adsense.slotList)}<h2 class="sr">${label}の開催一覧</h2>${list.map((e) => card(e)).join("")}
<h2>ほかの月</h2><div class="taglist">${months.filter((m) => m !== k).map((m) => `<a class="tag" href="/month/${m}.html">${monthLabel(m)}</a>`).join("")}</div>
${regular.length ? `<h2>毎週・毎晩の定期公演</h2>${regular.map(regCard).join("")}` : ""}`,
  }));
});

// ---------- 今週末の神楽・今月の神楽(「神楽 今週末」「今月 神楽」のような検索と、ブックマークに当てる。URLは固定で、中身が日付で変わる) ----------
const occCard = (r, d) => {
  const p = parts(`${d}T00:00`);
  return `<div class="card reg"><div class="date"><small>${p.mo}月 ${WD[p.wd]}</small><b>${p.d}</b></div><div>
<h3><a href="/regular/${r.id}.html">${esc(r.name)}</a></h3>
<div class="meta">定期公演 ・ ${esc(r.schedule)} ・ ${esc(r.prefecture)} ${esc(r.city ?? "")}</div>
${kaguraTag(r.kagura)}</div></div>`;
};
const dailyBlock = (list) => (list.length ? `<h2>毎晩の定期公演</h2>${list.map(({ r, closed }) => regCard(r) + (closed.length ? `<p class="meta">※ ${closed.map(mdLabel).join("・")}は、休演です。</p>` : "")).join("")}` : "");
const REG_NOTE = `<p class="meta">※ 定期公演は、臨時の休演や、日程の変更があります。公式の日程表で、公演日をご確認ください。</p>`;
const otherWays = (self) => `<h2>ほかの探し方</h2><div class="taglist">${[["/weekend.html", "今週末の神楽"], ["/this-month.html", "今月の神楽"], ["/calendar.html", "日付・場所で探す"], ["/map.html", "地図で探す"]].filter(([h]) => h !== self).map(([h, t]) => `<a class="tag" href="${h}">${t}</a>`).join("")}${months.slice(0, 3).map((m) => `<a class="tag" href="/month/${m}.html">${monthLabel(m)}</a>`).join("")}</div>`;

{
  const items = [...wkEvents.map((e) => ({ k: e.start, html: card(e) })), ...wkRegs.flatMap(({ r, dates }) => dates.map((d) => ({ k: `${d}T${timeOf(r)}`, html: occCard(r, d) })))].sort((a, b) => a.k.localeCompare(b.k));
  const after = upcoming.filter((e) => e.start.slice(0, 10) > wk.end).slice(0, 5);
  const names = [...wkEvents, ...wkRegs.map((x) => x.r), ...wkDaily.map((x) => x.r)];
  const sub = [wkRenkyu, wkHolidays.join("・")].filter(Boolean).join("・");
  write("dist/weekend.html", layout({
    title: `今週末の神楽(${wkLabel}) | ${cfg.siteName}`,
    desc: padDesc(clip(`今週末、${wkLabel}${wkRenkyu ? `の${wkRenkyu}` : ""}に観られる神楽の開催と定期公演を、日付順にまとめています。${names.length ? `${listNames(names)}${names.length > 3 ? "など" : ""}が観られます。` : "開催情報がない週は、このあとの開催を案内します。"}毎日、自動で更新しています。`)),
    path: "/weekend.html", active: "/weekend.html",
    ld: [crumbsLd([["ホーム", "/"], ["日付・場所で探す", "/calendar.html"], ["今週末の神楽"]]), itemListLd(`今週末の神楽(${wkLabel})`, [...wkEvents.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })), ...[...wkRegs, ...wkDaily].map(({ r }) => ({ href: `/regular/${r.id}.html`, name: r.name }))])].filter(Boolean),
    body: `${crumbNav([["ホーム", "/"], ["日付・場所で探す", "/calendar.html"], ["今週末の神楽"]])}${hero("今週末の神楽", `${esc(wkLabel)}${sub ? ` ・ ${esc(sub)}` : ""}`)}
<p class="lead">${esc(wkLabel)}に観られる神楽を、日付順にまとめています(${jpDate(today)}時点)。このページは、毎日、自動で更新しています。日時・会場は変更されることがあるため、お出かけの前に、各ページの公式情報をご確認ください。</p>
${adSlot(cfg.adsense.slotList)}<h2>開催予定${items.length ? `(${items.length}件)` : ""}</h2>
${items.map((x) => x.html).join("") || empty(`${esc(wkLabel)}の開催情報は、いまのところ見つかっていません。${wkDaily.length ? "毎晩の定期公演なら、今週末も観られます。" : ""}`)}
${dailyBlock(wkDaily)}${wkRegs.length || wkDaily.length ? REG_NOTE : ""}
${after.length ? `<h2>このあとの神楽</h2>${after.map((e) => card(e)).join("")}` : ""}
${otherWays("/weekend.html")}`,
  }));
}
{
  const late = monthDays.length <= 10; // 月末が近いときは、来月の予定も見せる
  const names = [...tmEvents, ...tmRegs.map((x) => x.r)];
  write("dist/this-month.html", layout({
    title: `今月の神楽 ${tmLabel}の開催日程 | ${cfg.siteName}`,
    desc: padDesc(clip(`${tmLabel}、今日から月末までに観られる神楽を、まとめています。${[tmEvents.length ? `開催${tmEvents.length}件` : "", tmRegs.length + tmDaily.length ? `定期公演${tmRegs.length + tmDaily.length}件の公演日` : ""].filter(Boolean).join("と、").replace(/.+/, (t) => `${t}を載せています`) || "開催情報がないときは、来月の予定を案内します"}。${names.length ? `${listNames(names)}など。` : ""}毎日、自動で更新しています。`)),
    path: "/this-month.html", active: "/this-month.html",
    ld: [crumbsLd([["ホーム", "/"], ["日付・場所で探す", "/calendar.html"], ["今月の神楽"]]), itemListLd(`今月の神楽(${tmLabel})`, [...tmEvents.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })), ...[...tmRegs, ...tmDaily].map(({ r }) => ({ href: `/regular/${r.id}.html`, name: r.name }))])].filter(Boolean),
    body: `${crumbNav([["ホーム", "/"], ["日付・場所で探す", "/calendar.html"], ["今月の神楽"]])}${hero("今月の神楽", `${tmLabel} ・ ${esc(mdLabel(today))}から月末まで`)}
<p class="lead">${tmLabel}の、今日(${esc(mdLabel(today))})から月末までに観られる神楽を、まとめています。このページは、毎日、自動で更新しています。日時・会場は変更されることがあるため、お出かけの前に、各ページの公式情報をご確認ください。</p>
${adSlot(cfg.adsense.slotList)}<h2>開催予定${tmEvents.length ? `(${tmEvents.length}件)` : ""}</h2>
${tmEvents.map((e) => card(e)).join("") || empty(`${tmLabel}の、これからの開催情報は、いまのところ見つかっていません。`)}
${months.includes(mk) ? `<p class="meta"><a href="/month/${mk}.html">${tmLabel}の開催一覧を見る ›</a></p>` : ""}
${tmRegs.length ? `<h2>毎週の定期公演</h2>${tmRegs.map(({ r, dates }) => `${regCard(r)}<p class="meta">今月の公演日: ${dates.map((d) => `${+d.slice(8, 10)}日`).join("・")}</p>`).join("")}` : ""}
${dailyBlock(tmDaily)}${tmRegs.length || tmDaily.length ? REG_NOTE : ""}
${late && nmEvents.length ? `<h2>来月(${monthLabel(nextMk)})の神楽</h2>${nmEvents.slice(0, 5).map((e) => card(e)).join("")}${nmEvents.length > 5 || months.includes(nextMk) ? `<p class="meta"><a href="/month/${nextMk}.html">${monthLabel(nextMk)}の開催一覧(${nmEvents.length}件)を見る ›</a></p>` : ""}` : ""}
${otherWays("/this-month.html")}`,
  }));
}

// ---------- はじめての神楽ガイド(「神楽 初めて」「夜神楽 服装」などの検索に当てる、読み物) ----------
{
  const title = "はじめての神楽ガイド 見どころ・マナー・服装";
  write("dist/guide.html", layout({
    title: `${title} | ${cfg.siteName}`,
    desc: "はじめて神楽を観る方へ。能・歌舞伎との違い、石見・広島・備中・高千穂・御嶽神楽の見どころ、撮影やご祝儀のマナー、夜の寒さに備える服装と持ち物を、各地の公式情報をもとにまとめました。",
    path: "/guide.html", active: "/guide.html",
    ld: [crumbsLd([["ホーム", "/"], ["はじめての神楽ガイド"]]), {
      "@context": "https://schema.org", "@type": "Article", headline: title, inLanguage: "ja", datePublished: GUIDE_CHECKED, dateModified: GUIDE_CHECKED,
      author: ORG_LD, publisher: ORG_LD,
      mainEntityOfPage: `${cfg.baseUrl}/guide.html`, image: OG_URL,
    }],
    body: `${crumbNav([["ホーム", "/"], ["はじめての神楽ガイド"]])}${hero("はじめての神楽ガイド", "見どころ・マナー・服装と持ち物")}<div class="prose guide">${guideHtml({
      esc,
      kaguraLink: (k) => (kaguras.includes(k) ? `<a href="${kaguraHref(k)}">${esc(k)}</a>` : esc(k)),
    })}</div>`,
  }));
}

// ---------- 固定ページ ----------
const doc = (path, title, desc, inner, opts = {}) => {
  const crumbs = [["ホーム", "/"], ...(opts.crumbs ?? []), [title]];
  write(`dist${path}`, layout({ title: `${title} | ${cfg.siteName}`, desc, path, ld: crumbsLd(crumbs), body: `${crumbNav(crumbs)}${hero(title, opts.lead ?? "")}<div class="prose">${inner}</div>`, ...opts.layout }));
};

doc("/submit.html", "掲載の依頼", "神楽の開催情報の掲載依頼フォーム", `<p>神楽の開催情報をお送りください。公式情報で内容を確かめてから掲載します。確認のため、メールでご連絡することがあります。すべてのご依頼を掲載するとは限りません。掲載される場所や流れは、<a href="/organizers.html">主催者の方へ</a>をご覧ください。</p>${submitForm(cfg)}`, { lead: "掲載は無料です。", crumbs: [["主催者の方へ", "/organizers.html"]], layout: { noindex: true, withForm: true, active: "/submit.html" } });

// 主催者の方へ(掲載の依頼を増やす。「神楽 イベント 掲載 無料」のような検索にも当てる)
doc("/organizers.html", "主催者の方へ", `神楽の主催者・神社・保存会・神楽団・自治体・観光協会の皆さまへ。${cfg.siteName}は、神楽の開催情報を無料で掲載します。掲載される場所、送り方、掲載までの流れ、訂正・削除の方法をご案内します。`,
  organizersHtml({ esc, siteName: cfg.siteName, formReady: formReady(cfg) }),
  { lead: "神楽の開催情報を、無料で掲載します。", layout: { active: "/organizers.html" } });

doc("/about.html", "運営者情報", `${cfg.siteName}の運営者情報です。運営者と連絡先、サイトの目的、開催情報の集め方と出典の示し方、広告などによる収益について説明しています。`, `
<p class="symbol"><img src="/symbol.png" alt="${esc(op.name)}のシンボル" width="120" height="120"></p>
<table class="info"><tr><th>サイト名</th><td>${esc(cfg.siteName)}</td></tr><tr><th>運営者</th><td>${esc(op.name)}</td></tr>
<tr><th>連絡先</th><td>${mailLink()}</td></tr><tr><th>開設</th><td>${esc(op.established)}</td></tr></table>
<h2>このサイトについて</h2>
<p>${esc(cfg.siteName)}は、全国の神楽の開催情報を探しやすくまとめるためのサイトです。神楽は、地域の神社や保存会が長く受け継いできた大切な文化です。その公演に出会う入口になることを目指しています。</p>
<h2>掲載情報について</h2>
<p>開催情報は、主催者からの投稿および公開されている情報をもとに掲載しています。各ページに、情報の出典と確認日を載せています。日時・会場・料金は変更・中止になることがあります。お出かけの前に、必ず主催者の公式情報をご確認ください。</p>
<p>掲載内容の訂正・削除のご依頼は、お問い合わせからご連絡ください。</p>
<h2>収益について</h2>
<p>${cfg.adsense.client || hasAffiliate ? `当サイトは、${[cfg.adsense.client ? "広告" : "", hasAffiliate ? "アフィリエイトプログラム" : ""].filter(Boolean).join("および")}による収益で運営しています。` : "現在、当サイトは、広告・アフィリエイトによる収益を、得ていません。今後、導入する場合は、開始の前に、この記載と、プライバシーポリシーを更新します。"}</p>
<p>情報の集め方や、免責については、<a href="/disclaimer.html">免責事項・情報の取り扱い</a>をご覧ください。</p>`);

doc("/contact.html", "お問い合わせ", `${cfg.siteName}へのお問い合わせフォームです。掲載している開催情報の訂正や削除のご依頼、サイトの不具合のご報告などを受け付けています。`, `
<p>次のご連絡は、下のフォームで受け付けています。</p>
<ul><li>開催情報の訂正、掲載の削除のご依頼</li><li>サイトの不具合のご報告</li><li>その他のお問い合わせ</li></ul>
<p>内容によっては、お返事までお時間をいただくことや、お返事できないことがあります。</p>
<p>新しい開催情報の掲載は、<a href="/submit.html">掲載の依頼フォーム</a>をご利用ください。</p>
${contactForm(cfg)}`, { layout: { withForm: true } });

// プライバシーポリシー・免責事項: 設定(広告・アクセス解析・アフィリエイト・フォーム送信先・自動取得)に合わせて、本文が変わる
const SOURCES_FILE = process.env.SOURCES_FILE ?? "data/sources.json";
const autoSources = existsSync(SOURCES_FILE) ? readJson(SOURCES_FILE).filter((s) => s.enabled !== false && s.termsChecked).map((s) => s.name) : [];
const policyCtx = {
  cfg, op, mailLink, auto: autoSources, autoPublish: cfg.collect?.autoPublish !== false,
  hasAds: !!cfg.adsense.client, hasGA: !!cfg.analyticsId, hasGC: !!cfg.goatcounter, hasAffil: hasAffiliate,
  form: { ready: formReady(cfg), providerName: cfg.form?.providerName },
};
doc("/privacy.html", "プライバシーポリシー", `${cfg.siteName}のプライバシーポリシーです。取得する情報と利用目的、外部サービスへの情報の送信、Cookie、個人情報の開示・訂正・削除のご請求について定めています。`, privacyHtml(policyCtx));
doc("/terms.html", "利用規約", `${cfg.siteName}の利用規約です。サイトの利用条件、開催情報の投稿の扱い、禁止事項、免責、規約の変更、準拠法と管轄裁判所について定めています。`, termsHtml(policyCtx));
doc("/disclaimer.html", "免責事項・情報の取り扱い", `${cfg.siteName}の免責事項です。開催情報の集め方と自動処理、掲載の停止、外部サイトへのリンク、損害についての責任の範囲を説明しています。`, disclaimerHtml(policyCtx));
// ---------- sitemap / robots / ads.txt / security.txt / 404 ----------
// lastmod は「そのページの中身が変わった日」(出典の確認日)にする。ビルドした日を全ページに入れると、検索エンジンに信頼されなくなる
const staticDay = (() => { const m = String(op.updated ?? "").match(/(\d{4})年(\d{1,2})月(\d{1,2})日/); return m ? `${m[1]}-${pad(m[2])}-${pad(m[3])}` : nowJst.slice(0, 10); })();
const allDay = lastmodOf([...upcoming, ...regular]);
const sm = [
  ["/", allDay], ["/map.html", allDay], ["/calendar.html", allDay], ["/kagura/", allDay],
  // 日付で変わるページ: 「その週末・その月になった日」と、載せている情報の確認日の、新しいほう
  ["/weekend.html", maxDay(daysBetween(addDays(today, -6), today).find((d) => weekendRange(d).end === wk.end), [...wkEvents, ...wkRegs.map((x) => x.r), ...wkDaily.map((x) => x.r)].map((x) => x.checked))],
  ["/this-month.html", maxDay(`${mk}-01`, [...tmEvents, ...tmRegs.map((x) => x.r), ...tmDaily.map((x) => x.r)].map((x) => x.checked), events.filter((e) => e.start.slice(0, 7) === mk && !isUpcoming(e)).map((e) => addDays((e.end || e.start).slice(0, 10), 1)).filter((d) => d <= today))],
  ["/guide.html", GUIDE_CHECKED], ["/organizers.html", staticDay],
  ["/about.html", staticDay], ["/contact.html", staticDay], ["/privacy.html", staticDay], ["/terms.html", staticDay], ["/disclaimer.html", staticDay],
  // 検索に載せないページ(noindex)は、サイトマップにも入れない
  ...kaguras.filter((k) => upcoming.some((e) => e.kagura === k) || regular.some((r) => r.kagura === k)).map((k) => [kaguraHref(k), lastmodOf([...upcoming, ...regular].filter((x) => x.kagura === k))]),
  ...prefs.map((p) => [prefHref(p), lastmodOf([...upcoming, ...regular].filter((x) => x.prefecture === p))]),
  ...months.map((k) => [`/month/${k}.html`, lastmodOf(monthMap.get(k))]),
  ...upcoming.map((e) => [`/events/${e.id}.html`, e.checked ?? nowJst.slice(0, 10)]),
  ...regular.map((r) => [`/regular/${r.id}.html`, r.checked ?? nowJst.slice(0, 10)]),
];
const urls = sm.map(([u]) => u);
write("dist/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sm.map(([u, d]) => `<url><loc>${cfg.baseUrl}${u}</loc><lastmod>${d}</lastmod></url>`).join("")}</urlset>`);

// ---------- 新着フィード(Atom)・カレンダー購読(ICS)・共有画像 ----------
const xml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const feedItems = [...upcoming.map((e) => ({ id: e.id, title: e.name, href: `/events/${e.id}.html`, day: e.checked ?? nowJst.slice(0, 10), summary: `${jpDate(e.start.slice(0, 10))} ${e.prefecture}${e.city ?? ""} ${e.venue ?? ""}。${e.description ?? ""}` })),
  ...regular.map((r) => ({ id: r.id, title: r.name, href: `/regular/${r.id}.html`, day: r.checked ?? nowJst.slice(0, 10), summary: `${r.schedule} ${r.prefecture}${r.city ?? ""} ${r.venue ?? ""}。${r.description ?? ""}` }))]
  .sort((a, b) => b.day.localeCompare(a.day)).slice(0, 30);
write("dist/feed.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="ja"><title>${xml(cfg.siteName)} 新着の開催情報</title><subtitle>${xml(cfg.description)}</subtitle><link href="${cfg.baseUrl}/feed.xml" rel="self"/><link href="${cfg.baseUrl}/"/><id>${cfg.baseUrl}/</id><updated>${allDay}T00:00:00+09:00</updated><author><name>${xml(op.name)}</name></author>${feedItems.map((i) => `<entry><title>${xml(i.title)}</title><link href="${cfg.baseUrl}${i.href}"/><id>${cfg.baseUrl}${i.href}</id><updated>${i.day}T00:00:00+09:00</updated><summary>${xml(i.summary.trim())}</summary></entry>`).join("")}</feed>\n`);
write("dist/events.ics", vcal(upcoming));
mkdirSync(OUT, { recursive: true }); writeFileSync(`${OUT}/og.png`, ogImagePng());
// 運営者のシンボル(ヘッダー・ファビコン・ホーム画面・構造化データのロゴ)。元画像から作ったものを assets/ に置いている
for (const f of ["symbol.png", "symbol-96.png", "favicon-48.png", "apple-touch-icon.png"]) copyFileSync(`assets/${f}`, `${OUT}/${f}`);
// 検索エンジンや古いブラウザは、/favicon.ico を直接見に行く。シンボルの画像から作って置く
writeFileSync(`${OUT}/favicon.ico`, pngToIco(readFileSync("assets/favicon-48.png")));

write("dist/404.html", layout({
  title: `ページが見つかりません | ${cfg.siteName}`, desc: "お探しのページは見つかりませんでした", path: "/404.html", noindex: true,
  body: `${hero("ページが見つかりません", "URLが変わったか、すでに掲載が終了した可能性があります。")}
<p><a class="btn" href="/">開催予定を見る</a> <a class="btn ghost" href="/calendar.html">日付・場所で探す</a></p>`,
}));

if (cfg.domain) write("dist/CNAME", cfg.domain + "\n");
write("dist/robots.txt", `User-agent: *\nAllow: /\nSitemap: ${cfg.baseUrl}/sitemap.xml\n`);
if (cfg.adsense.client) write("dist/ads.txt", `google.com, ${cfg.adsense.client.replace("ca-", "")}, DIRECT, f08c47fec0942fa0\n`);
// セキュリティ連絡先(RFC 9116)。メールアドレスは、お問い合わせフォームのURLで代える
const expires = new Date(asMs(nowJst) + 365 * 864e5).toISOString();
const securityTxt = `Contact: ${cfg.baseUrl}/contact.html\nExpires: ${expires}\nPreferred-Languages: ja, en\nCanonical: ${cfg.baseUrl}/.well-known/security.txt\n`;
write("dist/.well-known/security.txt", securityTxt);
write("dist/security.txt", securityTxt);
// GitHub Pages は無視するが、Cloudflare Pages / Netlify へ移したときに、本物のHTTPヘッダになる設定
write("dist/_headers", `/*\n  Strict-Transport-Security: max-age=63072000; includeSubDomains\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()\n  Cross-Origin-Opener-Policy: same-origin\n`);
console.log(`built: ${events.length} events (${upcoming.length} upcoming), ${regular.length} regular, ${urls.length} pages`);
