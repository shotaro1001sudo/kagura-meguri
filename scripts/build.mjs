// 静的サイト生成: data/events.json + data/regular.json + config.json -> dist/
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync } from "node:fs";
import { cspFor, FRAME_BUSTER } from "./lib/csp.mjs";
import { submitForm, contactForm, formScript, formReady } from "./lib/form.mjs";
import { privacyHtml, disclaimerHtml } from "./lib/policy.mjs";
import { ogImagePng, OG_SIZE } from "./lib/ogimage.mjs";
import { guideHtml, CHECKED as GUIDE_CHECKED } from "./lib/guide.mjs";
import { organizersHtml } from "./lib/organizers.mjs";
import { REGIONS, regionOf } from "./lib/util.mjs";
import { weekendRange, rangeLabel, mdLabel, regularOn, isDaily, addDays, holidayName } from "./lib/dates.mjs";

// テスト用の切り替え: EVENTS_FILE / REGULAR_FILE(データ)/ OUT_DIR(出力先)/ BUILD_NOW(日本時間の現在 "YYYY-MM-DDTHH:mm")
const OUT = process.env.OUT_DIR ?? "dist";
const EVENTS_FILE = process.env.EVENTS_FILE ?? "data/events.json";
const REGULAR_FILE = process.env.REGULAR_FILE ?? "data/regular.json";
const readJson = (p) => JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
const cfg = readJson("config.json");
if (process.env.TEST_ADSENSE) cfg.adsense.client = process.env.TEST_ADSENSE;
if (process.env.TEST_FORM_OFF) cfg.form = { endpoint: "", accessKey: "", providerName: "" }, cfg.operator = { ...cfg.operator, contact: process.env.TEST_CONTACT ?? "" }; // テスト: 送信先が未設定の状態
if (process.env.TEST_FORM_ENDPOINT) cfg.form ={ ...cfg.form, endpoint: process.env.TEST_FORM_ENDPOINT, providerName: process.env.TEST_FORM_PROVIDER ?? cfg.form?.providerName };
if (process.env.TEST_AUTOPUBLISH) cfg.collect = { ...cfg.collect, autoPublish: process.env.TEST_AUTOPUBLISH === "1" };
if (process.env.TEST_GA) cfg.analyticsId = process.env.TEST_GA;
if (process.env.TEST_AFFILIATE) cfg.affiliate = { ...cfg.affiliate, amazonTag: process.env.TEST_AFFILIATE };
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
const hasAffiliate = !!(a.rakutenAffiliateId || a.valueCommerceSid || a.amazonTag); // 報酬の出るリンクがあるか(未設定の間は、ふつうのリンク)
const rakuten = (url) => (a.rakutenAffiliateId ? `https://hb.afl.rakuten.co.jp/hgc/${a.rakutenAffiliateId}/?pc=${encodeURIComponent(url)}` : url);
const vc = (url) => (a.valueCommerceSid ? `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${a.valueCommerceSid}&vc_url=${encodeURIComponent(url)}` : url);
const amazon = (kw) => `https://www.amazon.co.jp/s?k=${encodeURIComponent(kw)}${a.amazonTag ? `&tag=${a.amazonTag}` : ""}`;

function affiliateBlock(e) {
  const place = `${e.prefecture}${e.city?.replace(/^.*郡/, "") ?? ""}`;
  const links = [
    ["🏨", "周辺の宿を探す", "楽天トラベル", rakuten(`https://travel.rakuten.co.jp/searchHotel/?f_keyword=${encodeURIComponent(place)}`)],
    ["🚄", "交通・ツアーを探す", "じゃらん", vc(`https://www.jalan.net/kankou/?keyword=${encodeURIComponent(place)}`)],
    ["📚", "神楽の本・グッズ", "Amazon", amazon(e.kagura || "神楽")],
  ];
  return `<aside class="aff"><h2>${esc(e.prefecture)}への旅支度</h2><div class="afflist">${links
    .map(([i, t, s, u]) => `<a href="${esc(u)}" rel="${hasAffiliate ? "sponsored " : ""}noopener" target="_blank"><span class="ico">${i}</span><b>${t}</b><small>${s}</small></a>`)
    .join("")}</div><small class="meta">${hasAffiliate ? "※ 広告・アフィリエイトリンクを含みます。" : "※ 外部のサービスへのリンクです。"}内容は、<a href="/disclaimer.html">免責事項</a>をご覧ください。</small></aside>`;
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
// スクロールで現れる要素。ビルド時に静的に出力されるものだけ(カレンダーのように、JSが後から作る要素は含めない。
// 含めると、観察されないまま、隠れたままになるため)。CSSとJSで、同じ一覧を使う。
// スクロールで現れるもの(全ページ共通のルール): 見出しと、カード・ブロックの単位だけ。段落・ボタン・フォームには付けない
const REVEAL_SEL = "main>h2:not(.sr), main .prose>h2, main .mhead, main .lead, main .about, main .toc, main table.info, main .tblwrap, main .aff, main .card, main .gcard, main .taglist, main .venuelist li";
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
const motionCss = lf(readFileSync("scripts/motion.css", "utf8")).replaceAll("%%SEL%%", REVEAL_SEL) + "\n" + sparkCss;
const MOTION_JS = lf(readFileSync("scripts/motion.js", "utf8")).replace("%%SEL_JSON%%", JSON.stringify(REVEAL_SEL));
// 動きを減らす設定のとき(と、IntersectionObserver がない環境)は、何も付けない = 動きの CSS が、一切、効かない
const HEAD_MOTION = `(function(d){var h=d.documentElement,w=window;try{if(!w.IntersectionObserver||(w.matchMedia&&w.matchMedia('(prefers-reduced-motion: reduce)').matches))return;h.classList.add('js');if(location.pathname==='/'||location.pathname==='/index.html'){if(!sessionStorage.getItem('intro')){h.classList.add('intro');sessionStorage.setItem('intro','1')}}}catch(e){}})(document)`;

// ---------- デザイン ----------
const css = lf(readFileSync("scripts/style.css", "utf8")) + "\n" + motionCss;
const NAV = [["/", "一覧"], ["/weekend.html", "今週末"], ["/map.html", "地図"], ["/calendar.html", "カレンダー"], ["/kagura/", "神楽の種類"]];
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
<link rel="icon" href="/favicon-48.png" type="image/png" sizes="48x48"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link id="gf" rel="stylesheet" href="${FONT_URL}" media="print"><script>${FONT_SCRIPT}</script><noscript><link rel="stylesheet" href="${FONT_URL}"></noscript>
<style>${css}</style>${head}${cfg.adsense.client ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${cfg.adsense.client}" crossorigin="anonymous"></script>` : ""}
${cfg.analyticsId ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${cfg.analyticsId}"></script><script>window.dataLayer=[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${cfg.analyticsId}')</script>` : ""}
${ld ? `<script type="application/ld+json">${ldJson(ld)}</script>` : ""}</head><body>
<a class="skip" href="#main">本文へ移動</a>
<header class="top"><div class="wrap"><a class="logo" href="/"><img src="/symbol-96.png" alt="" width="32" height="32">${esc(cfg.siteName)}</a><nav aria-label="メインメニュー">${NAV.map(([h, t]) => `<a href="${h}"${h === active ? ' class="on" aria-current="page"' : ""}>${t}</a>`).join("")}</nav></div></header>
<div class="wrap"><main id="main">${body}</main>
<footer><a href="/organizers.html">開催情報を掲載する(無料)</a> ・ <a href="/guide.html">はじめての神楽ガイド</a><br>
<a href="/about.html">運営者情報</a> ・ <a href="/contact.html">お問い合わせ</a> ・ <a href="/privacy.html">プライバシーポリシー</a> ・ <a href="/disclaimer.html">免責事項</a><br>© ${esc(cfg.siteName)}</footer></div>
${withForm ? `<script>${formScript(cfg)}</script>` : ""}<script>${MOTION_JS}</script></body></html>`;
  // インラインのスクリプト/スタイルのハッシュを集めて、このページ専用の CSP(コンテンツの許可リスト)を <meta> に入れる
  return html.replace('<head><meta charset="utf-8">', `<head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${cspFor(html, cfg)}">`);
};

const kaguraTag = (k, cls = "tag gold") => (k ? `<a class="${cls}" href="/kagura/${encodeURIComponent(k)}.html">${esc(k)}</a>` : "");
const card = (e) => {
  const p = parts(e.start);
  return `<div class="card"><div class="date"><small>${p.mo}月 ${WD[p.wd]}</small><b>${p.d}</b></div><div>
<h3><a href="/events/${e.id}.html">${esc(e.name)}</a></h3>
<div class="meta">${e.timeUnknown ? "時間は公式情報で確認" : `${pad(p.h)}:${pad(p.mi)}〜`} ・ ${esc(e.prefecture)} ${esc(e.city)}${e.fee ? ` ・ ${esc(e.fee)}` : ""}</div>
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
const prefHref = (p) => `/pref/${encodeURIComponent(p)}.html`;
const listNames = (arr, n = 3) =>arr.slice(0, n).map((x) => x.name.replace(/\s*[(〈].*$/, "")).join("、");
const sourceNote = (x) => {
  if (!x.source && !x.checked && !x.auto) return "";
  const day = x.checked ?? x.lastSeen; // 自動取得したものは、最後に取得元で確認できた日
  return `<p class="meta">情報の出典: ${esc(x.source ?? "")}${day ? ` ・ ${x.auto ? "取得日" : "確認日"} ${jpDate(day)}` : ""}。内容は変更されることがあるため、お出かけの前に公式情報をご確認ください(<a href="/disclaimer.html">免責事項・情報の取り扱い</a>)。</p>${x.auto ? '<p class="meta">この情報は、公開されている情報から、プログラムで取得し、自動の検査を経て、掲載しています。誤りに気づいたら、お問い合わせからお知らせください。</p>' : ""}`;
};
// Googleカレンダーで、全開催の日程(events.ics)を購読する画面を開くリンク(URLで追加 = 新しい開催も、自動で反映される)
const GCAL_SUBSCRIBE = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(`webcal://${cfg.domain}/events.ics`)}`;
const GUIDE_LINK ='<p class="meta">はじめて神楽を観る方は、<a href="/guide.html">見どころ・マナー・服装のガイド</a>もどうぞ。</p>';
const geoNote = (x) => (x.geoPrecision === "city" ? '<p class="meta">※ 地図のピンは、市区町村のおおよその位置です。正確な場所は公式情報をご確認ください。</p>' : x.geoPrecision === "area" ? '<p class="meta">※ 地図のピンは、町名ごとのおおよその位置です。正確な場所は公式情報をご確認ください。</p>' : "");
const zoomOf = (x) => (x.geoPrecision === "city" ? 11 : x.geoPrecision === "area" ? 13 : 15);
const mapBlock = (x) => (x.lat != null ? `<div id="map" style="height:260px" role="region" aria-label="会場周辺の地図"></div><script>document.addEventListener('DOMContentLoaded',function(){var b=document.getElementById('map');if(typeof L==='undefined'){b.hidden=true;return}var m=L.map('map',{scrollWheelZoom:false}).setView([${x.lat},${x.lng}],${zoomOf(x)});L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap'}).addTo(m);L.marker([${x.lat},${x.lng}]).addTo(m)})</script>${geoNote(x)}` : "");
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

// クライアント用の軽量データ (地図・カレンダー)
const lite = events.map(({ id, name, kagura, prefecture, city, venue, start, end, lat, lng, fee, timeUnknown }) => ({ id, name, kagura, prefecture, city, venue, start, end, lat, lng, fee, timeUnknown, up: isUpcoming({ start, end, timeUnknown }) }));
write("dist/events.json", JSON.stringify(lite));
write("dist/regular.json", JSON.stringify(regular.map(({ id, name, kagura, prefecture, city, venue, schedule, lat, lng }) => ({ id, name, kagura, prefecture, city, venue, schedule, lat, lng }))));

const prefs = [...new Set([...upcoming, ...regular].map((e) => e.prefecture))];
const kaguras = [...new Set([...events, ...regular].map((e) => e.kagura).filter(Boolean))];

// ---------- トップ ----------
// 「これからの神楽」: 直近2か月(開催のある月)だけをカードで出し、その先は月ごとのボタンにする(件数が増えても長くならない)
const HOME_MONTHS = 2, MONTH_CAP = 10;
const homeMonths = months.slice(0, HOME_MONTHS), laterMonths = months.slice(HOME_MONTHS);
const monthShort = (k) => (k.slice(0, 4) === nowJst.slice(0, 4) ? `${+k.slice(5, 7)}月` : monthLabel(k));
const regionsUsed = REGIONS.map(([r]) => r).filter((r) => upcoming.some((e) => regionOf(e.prefecture) === r));
const regionCounts = (list) => JSON.stringify(Object.fromEntries(regionsUsed.map((r) => [r, list.filter((e) => regionOf(e.prefecture) === r).length])));
// 1か月に MONTH_CAP 件を超える分は、地方で絞り込んだときだけ出す(全国のときは、月のページへのリンク)
const homeList = homeMonths.map((k) => {
  const list = monthMap.get(k);
  return `<div class="mgroup"><h3 class="mhead">${monthShort(k)}</h3>${list.map((e, i) => `<div data-r="${regionOf(e.prefecture)}"${i >= MONTH_CAP ? ' class="ov" hidden' : ""}>${card(e)}</div>`).join("")}${list.length > MONTH_CAP ? `<p class="meta more"><a href="/month/${k}.html">${monthLabel(k)}の開催をすべて見る(${list.length}件) ›</a></p>` : ""}</div>`;
}).join("");
const laterLinks = laterMonths.length ? `<div class="laterwrap"><h3 class="mhead">この先の開催</h3><div class="taglist later">${laterMonths.map((k) => { const l = monthMap.get(k); return `<a class="tag" href="/month/${k}.html" data-n="${l.length}" data-c="${esc(regionCounts(l))}">${monthShort(k)} <span>${l.length}件</span></a>`; }).join("")}</div></div>` : "";
const regionButtons = regionsUsed.length > 1 ? `<div class="regions" role="group" aria-label="地方で絞り込む" hidden><button type="button" data-r="" aria-pressed="true">全国</button>${regionsUsed.map((r) => `<button type="button" data-r="${r}" aria-pressed="false">${r}</button>`).join("")}</div>` : "";
write("dist/index.html", layout({
  title: `神楽の開催情報・日程一覧 | ${cfg.siteName}`,
  desc: clip(`${[...new Set(kaguras)].slice(0, 5).join("、")}など、全国の神楽の開催日程・会場・料金を、一覧・地図・カレンダーで探せます。公式情報をもとに、出典と確認日つきで紹介します。`),
  path: "/", active: "/",
  ld: [{ "@context": "https://schema.org", "@type": "WebSite", name: cfg.siteName, url: `${cfg.baseUrl}/`, inLanguage: "ja", description: cfg.description, publisher: ORG_LD },
    itemListLd("これからの神楽", upcoming.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })))].filter(Boolean),
  body: `<section class="hero home-hero">
${MOONSCAPE}${sparksHtml}
<div class="copy"><h1><span class="ph">神話を受け継ぐ</span><span class="ph">舞を、</span><br><span class="ph">この目で。</span></h1><p><span class="ph">各地で催される神楽の、</span><span class="ph">日取りと舞台を。</span></p></div>
<div class="vert" aria-hidden="true">笛と太鼓、夜の社に舞う</div></section>
<nav class="quick" aria-label="日付から探す"><a href="/weekend.html"><b>今週末の神楽</b><small>${esc(wkLabel)}${wkRenkyu ? `(${wkRenkyu})` : ""} ・ ${wkCount ? `${wkCount}件の開催・公演` : wkDaily.length ? "毎晩の定期公演あり" : "このあとの開催を見る"}</small></a><a href="/this-month.html"><b>今月の神楽</b><small>${tmLabel} ・ ${tmEvents.length ? `開催 ${tmEvents.length}件` : "定期公演・来月の予定"}</small></a><a href="/guide.html"><b>はじめての神楽</b><small>見どころ・マナー・服装</small></a></nav>
<h2>これからの神楽</h2>
${regionButtons}
${adSlot(cfg.adsense.slotList)}
<div id="list">${homeList || empty("現在掲載中の開催情報はありません。開催情報の掲載は、下のボタン、またはフッターからお寄せください。")}</div>
<p class="empty" id="none" hidden>この地方の${laterMonths.length ? "、直近の開催はありません。この先の開催は、下の月から探せます" : "開催予定は、いまのところありません"}。</p>
${laterLinks}
<div class="filters"><a class="btn ghost" href="/submit.html">開催情報を投稿する</a></div>
<script>(function(){var g=document.querySelector('.regions');if(!g)return;g.hidden=false;
g.addEventListener('click',function(ev){var b=ev.target.closest('button');if(!b)return;var r=b.dataset.r;
g.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',String(x===b))});
var n=0;document.querySelectorAll('.mgroup').forEach(function(m){var k=0;m.querySelectorAll('[data-r]').forEach(function(d){var s=r?d.dataset.r===r:!d.classList.contains('ov');d.hidden=!s;if(s)k++});m.hidden=k===0;n+=k;var mo=m.querySelector('.more');if(mo)mo.hidden=!!r});
document.getElementById('none').hidden=n>0;
var any=false;document.querySelectorAll('.later a').forEach(function(a){var c=r?(JSON.parse(a.dataset.c)[r]||0):+a.dataset.n;a.querySelector('span').textContent=c+'件';a.hidden=c===0;if(c)any=true});
var lw=document.querySelector('.laterwrap');if(lw)lw.hidden=!any})})()</script>
${regular.length ? `<h2>いつでも観られる定期公演</h2><div class="reglist">${regular.map(regCard).join("")}</div>` : ""}
${prefs.length ? `<h2>都道府県から探す</h2><div class="taglist">${prefs.map((p) => `<a class="tag" href="/pref/${encodeURIComponent(p)}.html">${esc(p)}</a>`).join("")}</div>` : ""}
${kaguras.length ? `<h2>神楽の種類から探す</h2><div class="taglist">${kaguras.map((k) => kaguraTag(k)).join("")}</div>` : ""}`,
}));

// ---------- 地図 (Leaflet + OpenStreetMap) ----------
write("dist/map.html", layout({
  title: `神楽の開催地マップ | 会場を地図で探す | ${cfg.siteName}`,
  desc: clip(`これから開催される神楽と、毎晩・毎週の定期公演の会場を、地図で探せます。${[...new Set([...upcoming, ...regular].map((e) => e.prefecture))].slice(0, 5).join("・")}など、${upcoming.length + regular.length}件の会場を掲載しています。`),
  path: "/map.html", active: "/map.html",
  head: LEAFLET,
  ld: itemListLd("神楽の開催会場", [...upcoming.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })), ...regular.map((r) => ({ href: `/regular/${r.id}.html`, name: r.name }))]),
  body: `${hero("開催マップ", "これから開催される神楽と、定期公演の会場を、地図で探せます")}<div id="map" role="region" aria-label="開催場所の地図"></div>
<p class="meta" id="mapmsg" aria-live="polite"></p>
<p class="meta">地図データ © OpenStreetMap contributors</p>${adSlot(cfg.adsense.slotList)}
${upcoming.length + regular.length ? `<h2>会場の一覧</h2><ul class="venuelist">${[...upcoming.map((e) => `<li><a href="/events/${e.id}.html">${esc(e.name)}</a><span class="meta"> ${esc(e.prefecture)}${esc(e.city ?? "")} ${esc(e.venue ?? "")}</span></li>`), ...regular.map((r) => `<li><a href="/regular/${r.id}.html">${esc(r.name)}</a><span class="meta"> ${esc(r.prefecture)}${esc(r.city ?? "")} ${esc(r.venue ?? "")}(定期公演)</span></li>`)].join("")}</ul>` : ""}
<script>
document.addEventListener('DOMContentLoaded',function(){
var msg=document.getElementById('mapmsg'),box=document.getElementById('map');
if(typeof L==='undefined'){box.hidden=true;msg.textContent='地図を読み込めませんでした。通信状況をご確認のうえ、ページを再読み込みしてください。一覧・カレンダーからも開催情報をご覧いただけます。';return}
var map=L.map('map').setView([34.5,133.5],6);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap'}).addTo(map);
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var get=function(u){return fetch(u).then(function(r){if(!r.ok)throw 0;return r.json()})};
Promise.all([get('/events.json'),get('/regular.json')]).then(function(res){
  var pts=[];
  res[0].filter(function(x){return x.up&&x.lat&&x.lng}).forEach(function(x){
    var m=+x.start.slice(5,7),d=+x.start.slice(8,10);
    L.marker([x.lat,x.lng],{title:x.name}).addTo(map).bindPopup('<b>'+esc(x.name)+'</b><br>'+m+'月'+d+'日 '+esc(x.prefecture)+esc(x.city)+'<br><a href="/events/'+esc(x.id)+'.html">詳細を見る</a>');
    pts.push([x.lat,x.lng]);});
  res[1].filter(function(x){return x.lat&&x.lng}).forEach(function(x){
    L.marker([x.lat,x.lng],{title:x.name}).addTo(map).bindPopup('<b>'+esc(x.name)+'</b><br>定期公演 '+esc(x.schedule)+'<br>'+esc(x.prefecture)+esc(x.city)+'<br><a href="/regular/'+esc(x.id)+'.html">詳細を見る</a>');
    pts.push([x.lat,x.lng]);});
  if(pts.length>1)map.fitBounds(pts,{padding:[40,40]});else if(pts.length)map.setView(pts[0],9);
  else msg.textContent='いま地図に出せる開催情報はありません。';
}).catch(function(){msg.textContent='開催情報を読み込めませんでした。時間をおいて再読み込みしてください。'});
});
</script>`,
}));

// ---------- カレンダー ----------
write("dist/calendar.html", layout({
  title: `神楽の開催カレンダー | 月ごとの日程 | ${cfg.siteName}`,
  desc: clip(`神楽の開催日を、月ごとのカレンダーで確認できます。${months.length ? months.slice(0, 4).map(monthLabel).join("・") + "など、" : ""}日付のある開催を、公式情報をもとに掲載しています。`),
  path: "/calendar.html", active: "/calendar.html",
  body: `${hero("開催カレンダー", "日付のある開催を、月ごとに見られます。毎晩・毎週の定期公演は、一覧のページにまとめています。")}
${months.length ? `<h2>月ごとの一覧</h2><p class="meta">各月の開催を、ページごとにまとめています。</p>${monthLinks()}` : ""}
<p><a class="btn ghost gcal" href="${GCAL_SUBSCRIBE}" target="_blank" rel="noopener">すべての開催を、Googleカレンダーに追加する</a></p>
<p class="meta">Googleカレンダーの「他のカレンダー」に「${esc(cfg.siteName)}」が追加され、新しい開催が、自動で反映されます(反映まで、数時間から1日ほどかかることがあります)。不要になったら、Googleカレンダーの設定から、登録を解除できます。</p>
<div class="calhead"><button id="pv" type="button" aria-label="前の月">‹ 前月</button><h2 id="ttl" aria-live="polite"></h2><button id="nx" type="button" aria-label="次の月">次月 ›</button></div>
<div class="cal" id="cal" role="grid" aria-labelledby="ttl"></div>
<p class="empty" id="calmsg" aria-live="polite"></p>
<ol class="monthlist" id="mlist" aria-label="この月の開催一覧"></ol>${adSlot(cfg.adsense.slotList)}
<script>
(function(){
var list=[],loaded=false,failed=false,cur=new Date();cur.setDate(1);
var ttl=document.getElementById('ttl'),cal=document.getElementById('cal'),msg=document.getElementById('calmsg');
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var p2=function(n){return String(n).padStart(2,'0')};
function draw(){
  var y=cur.getFullYear(),m=cur.getMonth();ttl.textContent=y+'年'+(m+1)+'月';
  var first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate(),today=new Date(),count=0;
  var h=['日','月','火','水','木','金','土'].map(function(w){return '<div class="h" role="columnheader">'+w+'</div>'}).join('');
  for(var i=0;i<first;i++)h+='<div class="d o" role="gridcell"></div>';
  for(var d=1;d<=days;d++){
    var key=y+'-'+p2(m+1)+'-'+p2(d);
    var ev=list.filter(function(x){return x.start.slice(0,10)===key});count+=ev.length;
    var t=today.getFullYear()==y&&today.getMonth()==m&&today.getDate()==d;
    h+='<div role="gridcell" class="d'+(t?' t':'')+(ev.length?' has':'')+((first+d-1)%7==0?' sun':'')+'"><i>'+d+'</i>'+ev.map(function(x){return '<a href="/events/'+esc(x.id)+'.html" title="'+esc(x.name)+'">'+esc(x.name)+'</a>'}).join('')+'</div>';
  }
  cal.innerHTML=h;
  var pre=y+'-'+p2(m+1);
  document.getElementById('mlist').innerHTML=list.filter(function(x){return x.start.slice(0,7)===pre}).map(function(x){
    return '<li><span class="md">'+(+x.start.slice(5,7))+'月'+(+x.start.slice(8,10))+'日</span><span><a href="/events/'+esc(x.id)+'.html">'+esc(x.name)+'</a><br><span class="meta">'+esc(x.prefecture)+' '+esc(x.city)+(x.timeUnknown?'':' ・ '+x.start.slice(11,16)+'〜')+'</span></span></li>'}).join('');
  msg.textContent=failed?'開催情報を読み込めませんでした。時間をおいて再読み込みしてください。':(loaded&&count===0?'この月の開催予定は、いまのところありません。':'');
}
document.getElementById('pv').onclick=function(){cur.setMonth(cur.getMonth()-1);draw()};
document.getElementById('nx').onclick=function(){cur.setMonth(cur.getMonth()+1);draw()};
fetch('/events.json').then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(l){
  list=l;loaded=true;var up=l.filter(function(x){return x.up})[0];
  if(up){cur=new Date(+up.start.slice(0,4),+up.start.slice(5,7)-1,1)}draw()
}).catch(function(){failed=true;draw()});
draw();
})();
</script>`,
}));

// ---------- 神楽の種類 一覧 + 個別 ----------
write("dist/kagura/index.html", layout({
  title: `神楽の種類一覧 | 流派・系統ごとに探す | ${cfg.siteName}`,
  desc: clip(`${kaguras.slice(0, 5).join("、")}など、神楽の種類ごとに、開催日程と定期公演を探せます。それぞれの特徴も、あわせて紹介します。`),
  path: "/kagura/", active: "/kagura/",
  ld: crumbsLd([["ホーム", "/"], ["神楽の種類"]]),
  body: `${crumbNav([["ホーム", "/"], ["神楽の種類"]])}${hero("神楽の種類", "流派・系統ごとに開催情報を探せます")}<h2 class="sr">神楽の種類の一覧</h2>${kaguras
    .map((k) => `<div class="card"><div><h3><a href="/kagura/${encodeURIComponent(k)}.html">${esc(k)}</a></h3><div class="meta">開催予定 ${upcoming.filter((e) => e.kagura === k).length} 件 ・ 定期公演 ${regular.filter((r) => r.kagura === k).length} 件</div>${kaguraInfo[k] ? `<p class="meta">${esc(clip(kaguraInfo[k].intro, 70))}</p>` : ""}</div></div>`)
    .join("") || empty("掲載中の神楽の種類は、まだありません。")}${adSlot(cfg.adsense.slotList)}`,
}));
for (const k of kaguras) {
  const list = upcoming.filter((e) => e.kagura === k), reg = regular.filter((r) => r.kagura === k);
  const first = [...events, ...regular].find((e) => e.kagura === k);
  const info = kaguraInfo[k];
  const when = list.length ? `${monthLabel(ym(list[0].start))}〜${monthLabel(ym(list[list.length - 1].start))}の開催${list.length}件` : "";
  write(`dist/kagura/${k}.html`, layout({
    title: `${k}の日程・開催情報${list.length ? "(" + list[0].start.slice(0, 4) + "年〜)" : ""} | ${cfg.siteName}`,
    desc: clip(`${k}の公演日程・会場・料金をまとめています。${when ? when + "、" : ""}${reg.length ? "定期公演" + reg.length + "件。" : ""}${info ? info.intro : ""}`),
    path: `/kagura/${encodeURIComponent(k)}.html`, active: "/kagura/", noindex: list.length + reg.length === 0,
    ld: [crumbsLd([["ホーム", "/"], ["神楽の種類", "/kagura/"], [k]]), itemListLd(`${k}の開催情報`, [...list.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })), ...reg.map((r) => ({ href: `/regular/${r.id}.html`, name: r.name }))])].filter(Boolean),
    body: `${crumbNav([["ホーム", "/"], ["神楽の種類", "/kagura/"], [k]])}${hero(esc(k), "開催予定の公演")}
${info ? `<section class="about"><h2>${esc(k)}とは</h2><p>${esc(info.intro)}</p><p class="meta">出典: ${esc(info.source)}</p></section>` : ""}
${adSlot(cfg.adsense.slotList)}${list.length ? `<h2>これからの開催</h2>${list.map(card).join("")}` : ""}${reg.length ? `<h2>定期公演</h2>${reg.map(regCard).join("")}` : ""}${list.length + reg.length ? "" : empty("現在の開催予定はありません。")}
${affiliateBlock({ prefecture: first.prefecture, city: "", kagura: k })}`,
  }));
}

// ---------- 都道府県ページ ----------
for (const p of [...new Set([...events, ...regular].map((e) => e.prefecture))]) {
  const list = events.filter((e) => e.prefecture === p && isUpcoming(e)), reg = regular.filter((r) => r.prefecture === p);
  const kinds = [...new Set([...list, ...reg].map((x) => x.kagura).filter(Boolean))];
  write(`dist/pref/${p}.html`, layout({
    title: `${p}の神楽 開催日程・会場一覧 | ${cfg.siteName}`,
    desc: clip(`${p}で開催される神楽の日程と会場をまとめています。${list.length ? "これからの開催" + list.length + "件" : ""}${reg.length ? (list.length ? "、" : "") + "定期公演" + reg.length + "件" : ""}。${kinds.length ? kinds.join("、") + "などを紹介します。" : ""}公式情報をもとに、出典と確認日つきで掲載しています。`),
    path: `/pref/${encodeURIComponent(p)}.html`, noindex: list.length + reg.length === 0,
    ld: [crumbsLd([["ホーム", "/"], [`${p}の神楽`]]), itemListLd(`${p}の神楽`, [...list.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })), ...reg.map((r) => ({ href: `/regular/${r.id}.html`, name: r.name }))])].filter(Boolean),
    body: `${crumbNav([["ホーム", "/"], [`${p}の神楽`]])}${hero(`${esc(p)}の神楽`, "開催情報")}
<p class="lead">${esc(p)}で開催される神楽の日程と会場を、公式情報をもとにまとめています。${kinds.length ? `${kinds.map((k) => `<a href="/kagura/${encodeURIComponent(k)}.html">${esc(k)}</a>`).join("、")}の公演を掲載しています。` : ""}日時・会場は変更されることがあるため、お出かけの前に、各ページの公式情報をご確認ください。</p>
${adSlot(cfg.adsense.slotList)}${list.length ? `<h2>これからの開催</h2>${list.map(card).join("")}` : ""}${reg.length ? `<h2>定期公演</h2>${reg.map(regCard).join("")}` : ""}${list.length + reg.length ? "" : empty("現在の開催予定はありません。")}${affiliateBlock({ prefecture: p, city: "", kagura: "神楽" })}`,
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
const related = (e) => {
  const same = upcoming.filter((x) => x.id !== e.id && x.kagura && x.kagura === e.kagura).slice(0, 4);
  const near = upcoming.filter((x) => x.id !== e.id && x.prefecture === e.prefecture && !same.includes(x)).slice(0, 4);
  const block = (h, arr) => (arr.length ? `<h2>${h}</h2><ul class="venuelist">${arr.map((x) => `<li><a href="/events/${x.id}.html">${esc(x.name)}</a><span class="meta"> ${esc(jpDate(x.start.slice(0, 10)))} ${esc(x.prefecture)}${esc(x.city ?? "")}</span></li>`).join("")}</ul>` : "");
  return block(`ほかの${esc(e.kagura || "神楽")}の開催`, same) + block(`${esc(e.prefecture)}のほかの開催`, near);
};
for (const e of events) {
  const JST = "+09:00";
  const ld = {
    "@context": "https://schema.org", "@type": "Event", name: e.name,
    startDate: e.timeUnknown ? e.start.slice(0, 10) : e.start + JST,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", eventStatus: "https://schema.org/EventScheduled",
    location: { "@type": "Place", name: e.venue || `${e.prefecture}${e.city}`, address: { "@type": "PostalAddress", addressRegion: e.prefecture, addressLocality: e.city, addressCountry: "JP" } },
    url: `${cfg.baseUrl}/events/${e.id}.html`,
  };
  if (e.end) ld.endDate = e.timeUnknown ? e.end.slice(0, 10) : e.end + JST;
  ld.image = [OG_URL];
  if (e.description) ld.description = e.description;
  if (e.fee) ld.offers = { "@type": "Offer", description: e.fee, url: e.url || `${cfg.baseUrl}/events/${e.id}.html`, availability: "https://schema.org/InStock", ...(/無料/.test(e.fee) && !/円/.test(e.fee) ? { price: "0", priceCurrency: "JPY" } : {}) };
  if (/無料/.test(e.fee ?? "") && !/円/.test(e.fee ?? "")) ld.isAccessibleForFree = true;
  if (e.lat != null) ld.location.geo = { "@type": "GeoCoordinates", latitude: e.lat, longitude: e.lng };
  const q = encodeURIComponent(`${e.venue} ${e.prefecture}${e.city}`.trim());
  const when = e.timeUnknown
    ? fmt(e.start).replace(/ \d\d:\d\d$/, "") + (e.end && e.end.slice(0, 10) !== e.start.slice(0, 10) ? ` 〜 ${fmt(e.end).replace(/ \d\d:\d\d$/, "")}` : "") + "(時間は公式情報をご確認ください)"
    : fmt(e.start) + (e.end ? " 〜 " + fmt(e.end) : "");
  write(`dist/events/${e.id}.html`, layout({
    // 検索結果で切れないよう、長い名称はタイトルでは短くする(ページの見出しは、名称のまま)
    title: `${e.name.length > 36 ? e.name.slice(0, 35) + "…" : e.name}(${jpDate(e.start.slice(0, 10))}) | ${e.prefecture} | ${cfg.siteName}`,
    desc: padDesc(clip(`${fmt(e.start).replace(e.timeUnknown ? / \d\d:\d\d$/ : /$^/, "")}、${e.venue ? e.venue + "(" + e.prefecture + (e.city ?? "") + ")" : e.prefecture + (e.city ?? "")}で開催される${e.kagura || "神楽"}。${e.fee ? "料金: " + e.fee + "。" : ""}${e.description ?? ""}`)),
    path: `/events/${e.id}.html`, noindex: !isUpcoming(e), ogType: "article", ld: [ld, crumbsLd([["ホーム", "/"], [e.prefecture, prefHref(e.prefecture)], [e.name]])],
    head: e.lat != null ? LEAFLET : "",
    body: `${crumbNav([["ホーム", "/"], [e.prefecture, prefHref(e.prefecture)], [e.name]])}${hero(esc(e.name),`${kaguraTag(e.kagura)}<a class="tag" href="/pref/${encodeURIComponent(e.prefecture)}.html">${esc(e.prefecture)}</a>${isUpcoming(e) ? "" : '<span class="tag">終了しました</span>'}`)}
<table class="info"><tr><th>日時</th><td>${when}</td></tr><tr><th>会場</th><td>${e.venue ? esc(e.venue) : "公式情報をご確認ください"}</td></tr>
<tr><th>場所</th><td>${esc(e.prefecture)} ${esc(e.city)}</td></tr><tr><th>料金</th><td>${e.fee ? esc(e.fee) : "公式情報をご確認ください"}</td></tr></table>
<p>${esc(e.description)}</p>
<p>${e.url ? `<a class="btn" href="${esc(e.url)}" rel="noopener" target="_blank">公式情報を見る</a> ` : ""}<a class="btn ghost" href="${esc(gcalEvent(e))}" target="_blank" rel="noopener">Googleカレンダーに追加</a> <a class="btn ghost" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">経路を調べる</a></p>
${mapBlock(e)}
${sourceNote(e)}${GUIDE_LINK}
${related(e)}
${adSlot(cfg.adsense.slotDetail)}${affiliateBlock(e)}`,
  }));
}

// ---------- 詳細ページ(定期公演) ----------
for (const r of regular) {
  const q = encodeURIComponent(`${r.venue ?? ""} ${r.prefecture}${r.city ?? ""}`.trim());
  const row = (th, v) => (v ? `<tr><th>${th}</th><td>${esc(v)}</td></tr>` : "");
  write(`dist/regular/${r.id}.html`, layout({
    title: `${r.name} | ${r.schedule.replace(/\(.*$/, "").trim()} | ${cfg.siteName}`,
    desc: padDesc(clip(`${r.prefecture}${r.city ?? ""}の${r.venue ? r.venue + "で、" : ""}${r.schedule}に観られる${r.kagura || "神楽"}の定期公演。${r.fee ? "料金: " + r.fee + "。" : ""}${r.description ?? ""}`)),
    path: `/regular/${r.id}.html`, ld: crumbsLd([["ホーム", "/"], [r.prefecture, prefHref(r.prefecture)], [r.name]]),
    head: r.lat != null ? LEAFLET : "",
    body: `${crumbNav([["ホーム", "/"], [r.prefecture, prefHref(r.prefecture)], [r.name]])}${hero(esc(r.name),`<span class="tag">定期公演</span>${kaguraTag(r.kagura)}<a class="tag" href="/pref/${encodeURIComponent(r.prefecture)}.html">${esc(r.prefecture)}</a>`)}
<table class="info">${row("開催", r.schedule)}${row("期間", r.season)}${row("休演日", r.closed)}${row("会場", r.venue)}${row("場所", `${r.prefecture} ${r.city ?? ""}`.trim())}${row("料金", r.fee || "公式情報をご確認ください")}${row("予約", r.booking)}</table>
<p>${esc(r.description)}</p>
<p>${r.url ? `<a class="btn" href="${esc(r.url)}" rel="noopener" target="_blank">公式情報を見る</a> ` : ""}<a class="btn ghost" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">経路を調べる</a></p>
${mapBlock(r)}
${sourceNote(r)}${GUIDE_LINK}
${adSlot(cfg.adsense.slotDetail)}${affiliateBlock(r)}`,
  }));
}

// ---------- 月別ページ(「11月 神楽 開催」のような、日付の検索に当てる。カレンダーはJSで描くため、検索エンジンには中身が見えない) ----------
months.forEach((k, i) => {
  const list = monthMap.get(k), label = monthLabel(k), prev = months[i - 1], next = months[i + 1];
  const prefsIn = [...new Set(list.map((e) => e.prefecture))], kindsIn = [...new Set(list.map((e) => e.kagura).filter(Boolean))];
  write(`dist/month/${k}.html`, layout({
    title: `${label}の神楽 開催日程(${list.length}件) | ${cfg.siteName}`,
    desc: clip(`${label}に開催される神楽の日程一覧です。${prefsIn.join("・")}の${list.length}件${kindsIn.length ? "(" + kindsIn.join("、") + ")" : ""}を、日付順に掲載しています。会場・料金・公式情報へのリンクつき。`),
    path: `/month/${k}.html`, active: "/calendar.html",
    ld: [crumbsLd([["ホーム", "/"], ["カレンダー", "/calendar.html"], [label]]), itemListLd(`${label}の神楽`, list.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })))],
    body: `${crumbNav([["ホーム", "/"], ["カレンダー", "/calendar.html"], [label]])}${hero(`${label}の神楽`, `${list.length}件の開催予定`)}
<p class="lead">${label}に開催される神楽を、日付順にまとめています。${prefsIn.map((p) => `<a href="${prefHref(p)}">${esc(p)}</a>`).join("、")}の開催です。日時・会場は変更されることがあるため、お出かけの前に、各ページの公式情報をご確認ください。</p>
${adSlot(cfg.adsense.slotList)}<h2 class="sr">${label}の開催一覧</h2>${list.map(card).join("")}
<h2>ほかの月</h2><div class="taglist">${months.filter((m) => m !== k).map((m) => `<a class="tag" href="/month/${m}.html">${monthLabel(m)}</a>`).join("")}</div>
<p class="meta">${prev ? `<a href="/month/${prev}.html">‹ ${monthLabel(prev)}</a>` : ""}${prev && next ? " ・ " : ""}${next ? `<a href="/month/${next}.html">${monthLabel(next)} ›</a>` : ""}</p>
${regular.length ? `<h2>この月も観られる定期公演</h2>${regular.map(regCard).join("")}` : ""}`,
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
const otherWays = (self) => `<h2>ほかの探し方</h2><div class="taglist">${[["/weekend.html", "今週末の神楽"], ["/this-month.html", "今月の神楽"], ["/calendar.html", "カレンダー"], ["/map.html", "地図から探す"]].filter(([h]) => h !== self).map(([h, t]) => `<a class="tag" href="${h}">${t}</a>`).join("")}${months.slice(0, 3).map((m) => `<a class="tag" href="/month/${m}.html">${monthLabel(m)}</a>`).join("")}</div>`;

{
  const items = [...wkEvents.map((e) => ({ k: e.start, html: card(e) })), ...wkRegs.flatMap(({ r, dates }) => dates.map((d) => ({ k: `${d}T${timeOf(r)}`, html: occCard(r, d) })))].sort((a, b) => a.k.localeCompare(b.k));
  const after = upcoming.filter((e) => e.start.slice(0, 10) > wk.end).slice(0, 5);
  const names = [...wkEvents, ...wkRegs.map((x) => x.r), ...wkDaily.map((x) => x.r)];
  const sub = [wkRenkyu, wkHolidays.join("・")].filter(Boolean).join("・");
  write("dist/weekend.html", layout({
    title: `今週末の神楽(${wkLabel}) | ${cfg.siteName}`,
    desc: padDesc(clip(`今週末、${wkLabel}${wkRenkyu ? `の${wkRenkyu}` : ""}に観られる神楽の開催と定期公演を、日付順にまとめています。${names.length ? `${listNames(names)}${names.length > 3 ? "など" : ""}。` : "開催情報がない週は、このあとの開催を案内します。"}毎日、自動で更新しています。`)),
    path: "/weekend.html", active: "/weekend.html",
    ld: [crumbsLd([["ホーム", "/"], ["今週末の神楽"]]), itemListLd(`今週末の神楽(${wkLabel})`, [...wkEvents.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })), ...[...wkRegs, ...wkDaily].map(({ r }) => ({ href: `/regular/${r.id}.html`, name: r.name }))])].filter(Boolean),
    body: `${crumbNav([["ホーム", "/"], ["今週末の神楽"]])}${hero("今週末の神楽", `${esc(wkLabel)}${sub ? ` ・ ${esc(sub)}` : ""}`)}
<p class="lead">${esc(wkLabel)}に観られる神楽を、日付順にまとめています(${jpDate(today)}時点)。このページは、毎日、自動で更新しています。日時・会場は変更されることがあるため、お出かけの前に、各ページの公式情報をご確認ください。</p>
${adSlot(cfg.adsense.slotList)}<h2>開催・公演${items.length ? `(${items.length}件)` : ""}</h2>
${items.map((x) => x.html).join("") || empty(`${esc(wkLabel)}の開催情報は、いまのところ見つかっていません。${wkDaily.length ? "下の、毎晩の定期公演は、観られます。" : ""}`)}
${dailyBlock(wkDaily)}${wkRegs.length || wkDaily.length ? REG_NOTE : ""}
${after.length ? `<h2>このあとの神楽</h2>${after.map(card).join("")}` : ""}
${otherWays("/weekend.html")}`,
  }));
}
{
  const late = monthDays.length <= 10; // 月末が近いときは、来月の予定も見せる
  const names = [...tmEvents, ...tmRegs.map((x) => x.r)];
  write("dist/this-month.html", layout({
    title: `今月の神楽 ${tmLabel}の開催日程 | ${cfg.siteName}`,
    desc: padDesc(clip(`${tmLabel}、今日から月末までに観られる神楽を、まとめています。${[tmEvents.length ? `開催${tmEvents.length}件` : "", tmRegs.length + tmDaily.length ? `定期公演${tmRegs.length + tmDaily.length}件の公演日` : ""].filter(Boolean).join("と、") || "開催情報がないときは、来月の予定を案内します"}。${names.length ? `${listNames(names)}など。` : ""}毎日、自動で更新しています。`)),
    path: "/this-month.html",
    ld: [crumbsLd([["ホーム", "/"], ["今月の神楽"]]), itemListLd(`今月の神楽(${tmLabel})`, [...tmEvents.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })), ...[...tmRegs, ...tmDaily].map(({ r }) => ({ href: `/regular/${r.id}.html`, name: r.name }))])].filter(Boolean),
    body: `${crumbNav([["ホーム", "/"], ["今月の神楽"]])}${hero("今月の神楽", `${tmLabel} ・ ${esc(mdLabel(today))}から月末まで`)}
<p class="lead">${tmLabel}の、今日(${esc(mdLabel(today))})から月末までに観られる神楽を、まとめています。このページは、毎日、自動で更新しています。日時・会場は変更されることがあるため、お出かけの前に、各ページの公式情報をご確認ください。</p>
${adSlot(cfg.adsense.slotList)}<h2>開催予定${tmEvents.length ? `(${tmEvents.length}件)` : ""}</h2>
${tmEvents.map(card).join("") || empty(`${tmLabel}の、これからの開催情報は、いまのところ見つかっていません。`)}
${months.includes(mk) ? `<p class="meta"><a href="/month/${mk}.html">${tmLabel}の開催一覧を見る ›</a></p>` : ""}
${tmRegs.length ? `<h2>毎週の定期公演</h2>${tmRegs.map(({ r, dates }) => `${regCard(r)}<p class="meta">今月の公演日: ${dates.map((d) => `${+d.slice(8, 10)}日`).join("・")}</p>`).join("")}` : ""}
${dailyBlock(tmDaily)}${tmRegs.length || tmDaily.length ? REG_NOTE : ""}
${late && nmEvents.length ? `<h2>来月(${monthLabel(nextMk)})の神楽</h2>${nmEvents.slice(0, 5).map(card).join("")}${nmEvents.length > 5 || months.includes(nextMk) ? `<p class="meta"><a href="/month/${nextMk}.html">${monthLabel(nextMk)}の開催一覧(${nmEvents.length}件)を見る ›</a></p>` : ""}` : ""}
${otherWays("/this-month.html")}`,
  }));
}

// ---------- はじめての神楽ガイド(「神楽 初めて」「夜神楽 服装」などの検索に当てる、読み物) ----------
{
  const title = "はじめての神楽ガイド 見どころ・マナー・服装";
  write("dist/guide.html", layout({
    title: `${title} | ${cfg.siteName}`,
    desc: "はじめて神楽を観る方へ。能・歌舞伎との違い、石見・広島・備中・高千穂・御嶽神楽の見どころ、撮影やご祝儀のマナー、夜の寒さに備える服装と持ち物を、各地の公式情報をもとにまとめました。",
    path: "/guide.html",
    ld: [crumbsLd([["ホーム", "/"], ["はじめての神楽ガイド"]]), {
      "@context": "https://schema.org", "@type": "Article", headline: title, inLanguage: "ja", datePublished: GUIDE_CHECKED, dateModified: GUIDE_CHECKED,
      author: ORG_LD, publisher: ORG_LD,
      mainEntityOfPage: `${cfg.baseUrl}/guide.html`, image: OG_URL,
    }],
    body: `${crumbNav([["ホーム", "/"], ["はじめての神楽ガイド"]])}${hero("はじめての神楽ガイド", "見どころ・マナー・服装と持ち物")}<div class="prose guide">${guideHtml({
      esc,
      kaguraLink: (k) => (kaguras.includes(k) ? `<a href="/kagura/${encodeURIComponent(k)}.html">${esc(k)}</a>` : esc(k)),
    })}</div>`,
  }));
}

// ---------- 固定ページ ----------
const doc = (path, title, desc, inner, opts = {}) => write(`dist${path}`, layout({ title: `${title} | ${cfg.siteName}`, desc, path, body: `${hero(title, opts.lead ?? "")}<div class="prose">${inner}</div>`, ...opts.layout }));

doc("/submit.html", "開催情報を投稿する", "神楽の開催情報の掲載依頼フォーム", `<p class="meta">掲載される場所、掲載までの流れ、定期公演や年間日程の送り方は、<a href="/organizers.html">主催者・関係者の方へ</a>をご覧ください。</p>${submitForm(cfg)}`, { lead: "神楽の開催情報を、お寄せください(無料)", layout: { noindex: true, withForm: true } });

// 主催者・関係者向け(掲載の依頼を増やす。「神楽 イベント 掲載 無料」のような検索にも当てる)
doc("/organizers.html", "主催者・関係者の方へ", `神楽の主催者・神社・保存会・神楽団・自治体・観光協会の皆さまへ。${cfg.siteName}は、神楽の開催情報を無料で掲載します。掲載される場所、送り方、掲載までの流れ、訂正・削除の方法をご案内します。`,
  organizersHtml({ esc, siteName: cfg.siteName, formReady: formReady(cfg) }),
  { lead: "神楽の開催情報を、無料で掲載します", layout: { ld: crumbsLd([["ホーム", "/"], ["主催者・関係者の方へ"]]) } });

doc("/about.html", "運営者情報", `${cfg.siteName}の運営者情報`, `
<p class="symbol"><img src="/symbol.png" alt="${esc(op.name)}のシンボル" width="120" height="120"></p>
<table class="info"><tr><th>サイト名</th><td>${esc(cfg.siteName)}</td></tr><tr><th>運営者</th><td>${esc(op.name)}</td></tr>
<tr><th>連絡先</th><td>${mailLink()}</td></tr><tr><th>開設</th><td>${esc(op.established)}</td></tr></table>
<h2>このサイトについて</h2>
<p>${esc(cfg.siteName)}は、全国の神楽の開催情報を探しやすくまとめるためのサイトです。神楽は、地域の神社や保存会が長く受け継いできた大切な文化です。その公演に出会う入口になることを目指しています。</p>
<h2>掲載情報について</h2>
<p>開催情報は、主催者からの投稿および公開されている情報をもとに掲載しています。各ページに、情報の出典と確認日を載せています。日時・会場・料金は変更・中止になることがあります。お出かけの前に、必ず主催者の公式情報をご確認ください。</p>
<p>掲載内容の訂正・削除のご依頼は、お問い合わせからご連絡ください。</p>
<h2>収益について</h2>
<p>${cfg.adsense.client || hasAffiliate ? `当サイトは、${[cfg.adsense.client ? "広告(Google AdSense)" : "", hasAffiliate ? "アフィリエイトプログラム" : ""].filter(Boolean).join("および")}による収益で運営しています。` : "現在、当サイトは、広告・アフィリエイトによる収益を、得ていません。今後、導入する場合は、開始の前に、この記載と、プライバシーポリシーを更新します。"}</p>
<p>情報の集め方や、免責については、<a href="/disclaimer.html">免責事項・情報の取り扱い</a>をご覧ください。</p>`);

doc("/contact.html", "お問い合わせ", "掲載・訂正・削除のご連絡", `
<p>次のご連絡は、下のフォームで受け付けています。</p>
<ul><li>開催情報の訂正、掲載の削除のご依頼</li><li>サイトの不具合のご報告</li><li>その他のお問い合わせ</li></ul>
<p>新しい開催情報の掲載は、<a href="/submit.html">投稿フォーム</a>をご利用ください。内容によっては、お返事までお時間をいただくことや、お返事できないことがあります。</p>
${contactForm(cfg)}`, { layout: { withForm: true } });

// プライバシーポリシー・免責事項: 設定(広告・アクセス解析・アフィリエイト・フォーム送信先・自動取得)に合わせて、本文が変わる
const SOURCES_FILE = process.env.SOURCES_FILE ?? "data/sources.json";
const autoSources = existsSync(SOURCES_FILE) ? readJson(SOURCES_FILE).filter((s) => s.enabled !== false && s.termsChecked).map((s) => s.name) : [];
const policyCtx = {
  cfg, op, mailLink, auto: autoSources, autoPublish: cfg.collect?.autoPublish !== false,
  hasAds: !!cfg.adsense.client, hasGA: !!cfg.analyticsId, hasAffil: hasAffiliate,
  form: { ready: formReady(cfg), providerName: cfg.form?.providerName },
};
doc("/privacy.html", "プライバシーポリシー", `${cfg.siteName}の個人情報・外部サービス・Cookieの取り扱い方針`, privacyHtml(policyCtx));
doc("/disclaimer.html", "免責事項・情報の取り扱い", `${cfg.siteName}の免責事項と、掲載情報の集め方・自動処理についての説明`, disclaimerHtml(policyCtx));
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
  ["/about.html", staticDay], ["/contact.html", staticDay], ["/privacy.html", staticDay], ["/disclaimer.html", staticDay],
  // 検索に載せないページ(noindex)は、サイトマップにも入れない
  ...kaguras.filter((k) => upcoming.some((e) => e.kagura === k) || regular.some((r) => r.kagura === k)).map((k) => [`/kagura/${encodeURIComponent(k)}.html`, lastmodOf([...upcoming, ...regular].filter((x) => x.kagura === k))]),
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

write("dist/404.html", layout({
  title: `ページが見つかりません | ${cfg.siteName}`, desc: "お探しのページは見つかりませんでした", path: "/404.html", noindex: true,
  body: `${hero("ページが見つかりません", "URLが変わったか、すでに掲載が終了した可能性があります。")}
<p><a class="btn" href="/">開催一覧へ戻る</a> <a class="btn ghost" href="/calendar.html">カレンダーから探す</a></p>`,
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
