// 静的サイト生成: data/events.json + data/regular.json + config.json -> dist/
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { cspFor, FRAME_BUSTER } from "./lib/csp.mjs";
import { submitForm, contactForm, formScript } from "./lib/form.mjs";

// テスト用の切り替え: EVENTS_FILE / REGULAR_FILE(データ)/ OUT_DIR(出力先)/ BUILD_NOW(日本時間の現在 "YYYY-MM-DDTHH:mm")
const OUT = process.env.OUT_DIR ?? "dist";
const EVENTS_FILE = process.env.EVENTS_FILE ?? "data/events.json";
const REGULAR_FILE = process.env.REGULAR_FILE ?? "data/regular.json";
const readJson = (p) => JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
const cfg = readJson("config.json");
if (process.env.TEST_ADSENSE) cfg.adsense.client = process.env.TEST_ADSENSE;
if (process.env.TEST_FORM_ENDPOINT) cfg.form = { ...cfg.form, endpoint: process.env.TEST_FORM_ENDPOINT };
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
const ldJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c"); // </script> による構造崩れを防ぐ

// ---------- 収益化 ----------
const a = cfg.affiliate;
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
    .map(([i, t, s, u]) => `<a href="${esc(u)}" rel="sponsored noopener" target="_blank"><span class="ico">${i}</span><b>${t}</b><small>${s}</small></a>`)
    .join("")}</div><small class="meta">※ 広告・アフィリエイトリンクを含みます</small></aside>`;
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
const [mailUser, mailDomain] = /^[^\s@]+@[^\s@]+$/.test(op.contact) ? op.contact.split("@") : [null, null];
const mailLink = () => (mailUser ? `<a class="mail" data-u="${esc(mailUser)}" data-d="${esc(mailDomain)}" href="/contact.html">お問い合わせフォーム</a>` : esc(op.contact));
const MAIL_SCRIPT = `document.querySelectorAll('a.mail').forEach(function(a){var m=a.dataset.u+'@'+a.dataset.d;a.href='mailto:'+m;a.textContent=m})`;

// ---------- 共通レイアウト ----------
const css = readFileSync("scripts/style.css", "utf8").replace(/\r\n?/g, "\n");
const NAV = [["/", "一覧"], ["/map.html", "地図"], ["/calendar.html", "カレンダー"], ["/kagura/", "神楽の種類"]];
const FONT_URL = "https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500&family=Zen+Kaku+Gothic+New:wght@400;500&display=swap";
const FONT_SCRIPT = `(function(){var l=document.getElementById('gf');if(l)l.addEventListener('load',function(){l.media='all'})})()`;

const layout = ({ title, desc, path, body, ld, head = "", active = "", noindex = false, withForm = false }) => {
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script>${FRAME_BUSTER}</script>
<meta name="referrer" content="strict-origin-when-cross-origin">${noindex ? '<meta name="robots" content="noindex,follow">' : ""}
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${cfg.baseUrl}${path}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="website"><meta property="og:url" content="${cfg.baseUrl}${path}"><meta property="og:site_name" content="${esc(cfg.siteName)}"><meta property="og:locale" content="ja_JP"><meta name="twitter:card" content="summary">
<meta name="theme-color" content="#f3eee4" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#171513" media="(prefers-color-scheme: dark)">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='9' fill='%239a3d2f'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link id="gf" rel="stylesheet" href="${FONT_URL}" media="print"><script>${FONT_SCRIPT}</script><noscript><link rel="stylesheet" href="${FONT_URL}"></noscript>
<style>${css}</style>${head}${cfg.adsense.client ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${cfg.adsense.client}" crossorigin="anonymous"></script>` : ""}
${cfg.analyticsId ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${cfg.analyticsId}"></script><script>window.dataLayer=[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${cfg.analyticsId}')</script>` : ""}
${ld ? `<script type="application/ld+json">${ldJson(ld)}</script>` : ""}</head><body>
<a class="skip" href="#main">本文へ移動</a>
<header class="top"><div class="wrap"><a class="logo" href="/">${esc(cfg.siteName)}</a><nav aria-label="メインメニュー">${NAV.map(([h, t]) => `<a href="${h}"${h === active ? ' class="on" aria-current="page"' : ""}>${t}</a>`).join("")}</nav></div></header>
<div class="wrap"><main id="main">${body}</main>
<footer><a href="/submit.html">開催情報を掲載する(無料)</a><br>
<a href="/about.html">運営者情報</a> ・ <a href="/contact.html">お問い合わせ</a> ・ <a href="/privacy.html">プライバシーポリシー</a><br>© ${esc(cfg.siteName)}</footer></div>
${body.includes('class="mail"') ? `<script>${MAIL_SCRIPT}</script>` : ""}${withForm ? `<script>${formScript(cfg)}</script>` : ""}</body></html>`;
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
const sourceNote = (x) => (x.source || x.checked ? `<p class="meta">情報の出典: ${esc(x.source ?? "")}${x.checked ? ` ・ 確認日 ${jpDate(x.checked)}` : ""}。内容は変更されることがあるため、お出かけの前に公式情報をご確認ください。</p>` : "");
const geoNote = (x) => (x.geoPrecision === "city" ? '<p class="meta">※ 地図のピンは、市区町村のおおよその位置です。正確な場所は公式情報をご確認ください。</p>' : x.geoPrecision === "area" ? '<p class="meta">※ 地図のピンは、町名ごとのおおよその位置です。正確な場所は公式情報をご確認ください。</p>' : "");
const zoomOf = (x) => (x.geoPrecision === "city" ? 11 : x.geoPrecision === "area" ? 13 : 15);
const mapBlock = (x) => (x.lat != null ? `<div id="map" style="height:260px" role="region" aria-label="会場周辺の地図"></div><script>document.addEventListener('DOMContentLoaded',function(){var b=document.getElementById('map');if(typeof L==='undefined'){b.hidden=true;return}var m=L.map('map',{scrollWheelZoom:false}).setView([${x.lat},${x.lng}],${zoomOf(x)});L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap'}).addTo(m);L.marker([${x.lat},${x.lng}]).addTo(m)})</script>${geoNote(x)}` : "");
rmSync(OUT, { recursive: true, force: true });

// クライアント用の軽量データ (地図・カレンダー)
const lite = events.map(({ id, name, kagura, prefecture, city, venue, start, end, lat, lng, fee, timeUnknown }) => ({ id, name, kagura, prefecture, city, venue, start, end, lat, lng, fee, timeUnknown, up: isUpcoming({ start, end, timeUnknown }) }));
write("dist/events.json", JSON.stringify(lite));
write("dist/regular.json", JSON.stringify(regular.map(({ id, name, kagura, prefecture, city, venue, schedule, lat, lng }) => ({ id, name, kagura, prefecture, city, venue, schedule, lat, lng }))));

const prefs = [...new Set([...upcoming, ...regular].map((e) => e.prefecture))];
const kaguras = [...new Set([...events, ...regular].map((e) => e.kagura).filter(Boolean))];

// ---------- トップ ----------
write("dist/index.html", layout({
  title: `${cfg.siteName} | 全国の神楽 開催情報`, desc: cfg.description, path: "/", active: "/",
  ld: { "@context": "https://schema.org", "@type": "WebSite", name: cfg.siteName, url: `${cfg.baseUrl}/`, inLanguage: "ja", description: cfg.description },
  body: `<section class="hero home-hero">
<svg class="enso" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 8C27 7 8 26 9 50c1 24 21 42 45 41 22-1 38-17 38-38" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>
<div class="copy"><h1>神々へ捧ぐ舞を、<br>訪ねる旅へ。</h1><p>全国の神楽の開催情報を、静かに、ひとつの場所に。</p></div>
<div class="vert" aria-hidden="true">笛と太鼓、夜の社に舞う</div></section>
<h2>これからの神楽</h2>
<div class="filters">${upcoming.length ? `<label class="sr" for="f">都道府県で絞り込む</label><select id="f"><option value="">全国</option>${[...new Set(upcoming.map((e) => e.prefecture))].map((p) => `<option>${esc(p)}</option>`).join("")}</select>` : ""}
<a class="btn ghost" href="/submit.html">開催情報を投稿する</a></div>
${adSlot(cfg.adsense.slotList)}
<div id="list">${upcoming.map((e) => `<div data-p="${esc(e.prefecture)}">${card(e)}</div>`).join("") || empty("現在掲載中の開催情報はありません。開催情報の掲載は、上のボタン、またはフッターからお寄せください。")}</div>
<p class="empty" id="none" hidden>この地域の開催予定は、いまのところありません。</p>
<script>(function(){var f=document.getElementById('f');if(!f)return;f.addEventListener('change',function(){var n=0;document.querySelectorAll('#list>div').forEach(function(d){var h=!!f.value&&d.dataset.p!==f.value;d.hidden=h;if(!h)n++});document.getElementById('none').hidden=n>0})})()</script>
${regular.length ? `<h2>いつでも観られる定期公演</h2><div class="reglist">${regular.map(regCard).join("")}</div>` : ""}
${prefs.length ? `<h2>都道府県から探す</h2><div class="taglist">${prefs.map((p) => `<a class="tag" href="/pref/${encodeURIComponent(p)}.html">${esc(p)}</a>`).join("")}</div>` : ""}
${kaguras.length ? `<h2>神楽の種類から探す</h2><div class="taglist">${kaguras.map((k) => kaguraTag(k)).join("")}</div>` : ""}`,
}));

// ---------- 地図 (Leaflet + OpenStreetMap) ----------
write("dist/map.html", layout({
  title: `神楽 開催マップ | ${cfg.siteName}`, desc: "全国の神楽の開催場所を地図から探せます", path: "/map.html", active: "/map.html",
  head: LEAFLET,
  body: `${hero("開催マップ", "これから開催される神楽と、定期公演の会場を、地図で探せます")}<div id="map" role="region" aria-label="開催場所の地図"></div>
<p class="meta" id="mapmsg" aria-live="polite"></p>
<p class="meta">地図データ © OpenStreetMap contributors</p>${adSlot(cfg.adsense.slotList)}
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
  title: `神楽 開催カレンダー | ${cfg.siteName}`, desc: "月ごとの神楽開催日をカレンダーで確認", path: "/calendar.html", active: "/calendar.html",
  body: `${hero("開催カレンダー", "日付のある開催を、月ごとに見られます。毎晩・毎週の定期公演は、一覧のページにまとめています。")}
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
  title: `神楽の種類 | ${cfg.siteName}`, desc: "石見神楽、高千穂神楽など神楽の種類別に開催情報を探せます", path: "/kagura/", active: "/kagura/",
  body: `${hero("神楽の種類", "流派・系統ごとに開催情報を探せます")}${kaguras
    .map((k) => `<div class="card"><div><h3><a href="/kagura/${encodeURIComponent(k)}.html">${esc(k)}</a></h3><div class="meta">開催予定 ${upcoming.filter((e) => e.kagura === k).length} 件 ・ 定期公演 ${regular.filter((r) => r.kagura === k).length} 件</div></div></div>`)
    .join("") || empty("掲載中の神楽の種類は、まだありません。")}${adSlot(cfg.adsense.slotList)}`,
}));
for (const k of kaguras) {
  const list = upcoming.filter((e) => e.kagura === k), reg = regular.filter((r) => r.kagura === k);
  const first = [...events, ...regular].find((e) => e.kagura === k);
  write(`dist/kagura/${k}.html`, layout({
    title: `${k}の開催情報 | ${cfg.siteName}`, desc: `${k}の公演日程・会場一覧`, path: `/kagura/${encodeURIComponent(k)}.html`, active: "/kagura/", noindex: list.length + reg.length === 0,
    body: `${hero(esc(k), "開催予定の公演")}${adSlot(cfg.adsense.slotList)}${list.map(card).join("")}${reg.length ? `<h2>定期公演</h2>${reg.map(regCard).join("")}` : ""}${list.length + reg.length ? "" : empty("現在の開催予定はありません。")}
${affiliateBlock({ prefecture: first.prefecture, city: "", kagura: k })}`,
  }));
}

// ---------- 都道府県ページ ----------
for (const p of [...new Set([...events, ...regular].map((e) => e.prefecture))]) {
  const list = events.filter((e) => e.prefecture === p && isUpcoming(e)), reg = regular.filter((r) => r.prefecture === p);
  write(`dist/pref/${p}.html`, layout({
    title: `${p}の神楽 開催情報 | ${cfg.siteName}`, desc: `${p}で開催される神楽の日程・会場一覧`, path: `/pref/${encodeURIComponent(p)}.html`, noindex: list.length + reg.length === 0,
    body: `${hero(`${esc(p)}の神楽`, "開催情報")}${adSlot(cfg.adsense.slotList)}${list.map(card).join("")}${reg.length ? `<h2>定期公演</h2>${reg.map(regCard).join("")}` : ""}${list.length + reg.length ? "" : empty("現在の開催予定はありません。")}${affiliateBlock({ prefecture: p, city: "", kagura: "神楽" })}`,
  }));
}

// ---------- 詳細ページ(日付のある開催) ----------
const crumbs = (pref, name) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: cfg.siteName, item: `${cfg.baseUrl}/` }, { "@type": "ListItem", position: 2, name: pref, item: `${cfg.baseUrl}/pref/${encodeURIComponent(pref)}.html` }, { "@type": "ListItem", position: 3, name }] });
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
  if (e.description) ld.description = e.description;
  if (e.fee) ld.offers = { "@type": "Offer", description: e.fee, url: e.url || `${cfg.baseUrl}/events/${e.id}.html` };
  if (e.lat != null) ld.location.geo = { "@type": "GeoCoordinates", latitude: e.lat, longitude: e.lng };
  const q = encodeURIComponent(`${e.venue} ${e.prefecture}${e.city}`.trim());
  // iCalendar(RFC 5545): UID/DTSTAMP 必須、CRLF 改行、文字のエスケープ、時間未定は終日扱い
  const ie = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const ymd = (s) => s.slice(0, 10).replace(/-/g, "");
  const dt = (s) => `${ymd(s)}T${s.slice(11, 13)}${s.slice(14, 16)}00`;
  const nextDay = (s) => new Date(asMs(s.slice(0, 10) + "T00:00") + 864e5).toISOString().slice(0, 10).replace(/-/g, "");
  const endForIcs = e.end || new Date(asMs(e.start) + 2 * 3600e3).toISOString().slice(0, 16);
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${cfg.siteName}//JA`, "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:${e.id}@${cfg.domain || "kagura"}`, `DTSTAMP:${nowJst.slice(0, 10).replace(/-/g, "")}T000000Z`,
    `SUMMARY:${ie(e.name)}`,
    ...(e.timeUnknown ? [`DTSTART;VALUE=DATE:${ymd(e.start)}`, `DTEND;VALUE=DATE:${nextDay(e.end || e.start)}`]
      : [`DTSTART;TZID=Asia/Tokyo:${dt(e.start)}`, `DTEND;TZID=Asia/Tokyo:${dt(endForIcs)}`]),
    `LOCATION:${ie(`${e.venue ?? ""} ${e.prefecture}${e.city ?? ""}`.trim())}`,
    ...(e.url ? [`URL:${e.url}`] : []),
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n") + "\r\n";
  write(`dist/events/${e.id}.ics`, ics);
  const when = e.timeUnknown
    ? fmt(e.start).replace(/ \d\d:\d\d$/, "") + (e.end && e.end.slice(0, 10) !== e.start.slice(0, 10) ? ` 〜 ${fmt(e.end).replace(/ \d\d:\d\d$/, "")}` : "") + "(時間は公式情報をご確認ください)"
    : fmt(e.start) + (e.end ? " 〜 " + fmt(e.end) : "");
  write(`dist/events/${e.id}.html`, layout({
    title: `${e.name}(${jpDate(e.start.slice(0, 10))}) | ${e.prefecture} | ${cfg.siteName}`, desc: `${fmt(e.start).replace(e.timeUnknown ? / \d\d:\d\d$/ : /$^/, "")} ${e.venue ? e.venue + "(" : "("}${e.prefecture}${e.city ?? ""})${e.kagura ? "の" + e.kagura : "の神楽"}`, path: `/events/${e.id}.html`, noindex: !isUpcoming(e), ld: [ld, crumbs(e.prefecture, e.name)],
    head: e.lat != null ? LEAFLET : "",
    body: `${hero(esc(e.name), `${kaguraTag(e.kagura)}<a class="tag" href="/pref/${encodeURIComponent(e.prefecture)}.html">${esc(e.prefecture)}</a>${isUpcoming(e) ? "" : '<span class="tag">終了しました</span>'}`)}
<table class="info"><tr><th>日時</th><td>${when}</td></tr><tr><th>会場</th><td>${e.venue ? esc(e.venue) : "公式情報をご確認ください"}</td></tr>
<tr><th>場所</th><td>${esc(e.prefecture)} ${esc(e.city)}</td></tr><tr><th>料金</th><td>${e.fee ? esc(e.fee) : "公式情報をご確認ください"}</td></tr></table>
<p>${esc(e.description)}</p>
<p>${e.url ? `<a class="btn" href="${esc(e.url)}" rel="noopener" target="_blank">公式情報を見る</a> ` : ""}<a class="btn ghost" href="/events/${e.id}.ics">カレンダーに追加</a> <a class="btn ghost" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">経路を調べる</a></p>
${mapBlock(e)}
${sourceNote(e)}
${adSlot(cfg.adsense.slotDetail)}${affiliateBlock(e)}`,
  }));
}

// ---------- 詳細ページ(定期公演) ----------
for (const r of regular) {
  const q = encodeURIComponent(`${r.venue ?? ""} ${r.prefecture}${r.city ?? ""}`.trim());
  const row = (th, v) => (v ? `<tr><th>${th}</th><td>${esc(v)}</td></tr>` : "");
  write(`dist/regular/${r.id}.html`, layout({
    title: `${r.name} | 定期公演 | ${r.prefecture} | ${cfg.siteName}`, desc: `${r.schedule}(${r.prefecture}${r.city ?? ""} ${r.venue ?? ""})の${r.kagura || "神楽"}の定期公演`.replace(/\s+\)/, ")"), path: `/regular/${r.id}.html`, ld: crumbs(r.prefecture, r.name),
    head: r.lat != null ? LEAFLET : "",
    body: `${hero(esc(r.name), `<span class="tag">定期公演</span>${kaguraTag(r.kagura)}<a class="tag" href="/pref/${encodeURIComponent(r.prefecture)}.html">${esc(r.prefecture)}</a>`)}
<table class="info">${row("開催", r.schedule)}${row("期間", r.season)}${row("休演日", r.closed)}${row("会場", r.venue)}${row("場所", `${r.prefecture} ${r.city ?? ""}`.trim())}${row("料金", r.fee || "公式情報をご確認ください")}${row("予約", r.booking)}</table>
<p>${esc(r.description)}</p>
<p>${r.url ? `<a class="btn" href="${esc(r.url)}" rel="noopener" target="_blank">公式情報を見る</a> ` : ""}<a class="btn ghost" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">経路を調べる</a></p>
${mapBlock(r)}
${sourceNote(r)}
${adSlot(cfg.adsense.slotDetail)}${affiliateBlock(r)}`,
  }));
}

// ---------- 固定ページ ----------
const doc = (path, title, desc, inner, opts = {}) => write(`dist${path}`, layout({ title: `${title} | ${cfg.siteName}`, desc, path, body: `${hero(title, opts.lead ?? "")}<div class="prose">${inner}</div>`, ...opts.layout }));

doc("/submit.html", "開催情報を投稿する", "神楽の開催情報の掲載依頼フォーム", submitForm(cfg), { lead: "神楽の開催情報を、お寄せください(無料)", layout: { noindex: true, withForm: true } });

doc("/about.html", "運営者情報", `${cfg.siteName}の運営者情報`, `
<table class="info"><tr><th>サイト名</th><td>${esc(cfg.siteName)}</td></tr><tr><th>運営者</th><td>${esc(op.name)}</td></tr>
<tr><th>連絡先</th><td>${mailLink()}</td></tr><tr><th>開設</th><td>${esc(op.established)}</td></tr></table>
<h2>このサイトについて</h2>
<p>${esc(cfg.siteName)}は、全国の神楽の開催情報を探しやすくまとめるためのサイトです。神楽は、地域の神社や保存会が長く受け継いできた大切な文化です。その公演に出会う入口になることを目指しています。</p>
<h2>掲載情報について</h2>
<p>開催情報は、主催者からの投稿および公開されている情報をもとに掲載しています。各ページに、情報の出典と確認日を載せています。日時・会場・料金は変更・中止になることがあります。お出かけの前に、必ず主催者の公式情報をご確認ください。</p>
<p>掲載内容の訂正・削除のご依頼は、お問い合わせからご連絡ください。</p>
<h2>収益について</h2>
<p>当サイトは、広告(Google AdSenseなど)およびアフィリエイトプログラムによる収益で運営しています。</p>`);

doc("/contact.html", "お問い合わせ", "掲載・訂正・削除のご連絡", `
<p>次のご連絡は、下のフォームで受け付けています。</p>
<ul><li>開催情報の訂正、掲載の削除のご依頼</li><li>サイトの不具合のご報告</li><li>その他のお問い合わせ</li></ul>
<p>新しい開催情報の掲載は、<a href="/submit.html">投稿フォーム</a>をご利用ください。内容によっては、お返事までお時間をいただくことや、お返事できないことがあります。</p>
${contactForm(cfg)}
<p class="meta">フォームを使えない場合は、${mailLink()}までメールでお知らせください。</p>`, { layout: { withForm: true } });

doc("/privacy.html", "プライバシーポリシー", `${cfg.siteName}の個人情報・Cookie・広告に関する方針`, `
<p>${esc(op.name)}(以下「運営者」)は、${esc(cfg.siteName)}(以下「当サイト」)における利用者の情報を、以下の方針に基づいて取り扱います。</p>
<h2>1. 取得する情報</h2>
<p>当サイトは、閲覧時にアクセスログ(IPアドレス、ブラウザの種類、閲覧ページ、日時など)が記録されることがあります。投稿フォームやお問い合わせフォームをご利用になる際には、ご入力いただいた氏名または団体名、メールアドレス、投稿内容などを取得します。</p>
<h2>2. 利用目的</h2>
<ul><li>投稿・お問い合わせへの対応と、内容の確認のためのご連絡</li><li>掲載情報の確認・訂正・削除</li><li>サイトの利用状況の把握と改善</li><li>不正利用(迷惑投稿など)の防止</li></ul>
<h2>3. 投稿フォーム・お問い合わせフォームについて</h2>
<p>フォームに入力された内容は、${esc(cfg.form?.providerName || "外部のフォーム送信サービス")}を通じて、運営者のメールアドレスに送られます。入力内容が、このサービスの事業者のサーバーを経由する場合があります。メールアドレスなどの連絡先は、サイトには掲載しません。投稿いただいた開催情報(名称・日時・会場など)は、確認のうえ、サイトに掲載することがあります。対応が終わった連絡先の情報は、必要な期間の保管のあと、削除します。</p>
<p>迷惑投稿の防止のため、フォームには自動投稿を見分ける仕組みと、短時間での連続送信を制限する仕組みを設けています。</p>
<h2>4. 広告の配信について</h2>
<p>当サイトは、第三者配信の広告サービス「Google AdSense」を利用する場合があります。Googleを含む第三者配信事業者は、Cookieを使用して、利用者が当サイトや他のサイトに過去にアクセスした際の情報に基づいて広告を配信します。</p>
<p>利用者は、<a href="https://myadcenter.google.com/" rel="noopener" target="_blank">Googleの広告設定</a>で、パーソナライズ広告を無効にできます。また、<a href="https://optout.aboutads.info/" rel="noopener" target="_blank">www.aboutads.info</a>で、第三者配信事業者のCookieによるパーソナライズ広告を無効にできる場合があります。Googleによる情報の取り扱いについては、<a href="https://policies.google.com/technologies/ads?hl=ja" rel="noopener" target="_blank">Googleのポリシーと規約</a>をご確認ください。</p>
<h2>5. アクセス解析について</h2>
<p>当サイトは、Googleによるアクセス解析ツール「Googleアナリティクス」を利用する場合があります。このツールはCookieを使用してトラフィックデータを収集しますが、個人を特定する情報は含まれません。Cookieは、ブラウザの設定で無効にできます。詳しくは、<a href="https://marketingplatform.google.com/about/analytics/terms/jp/" rel="noopener" target="_blank">Googleアナリティクス利用規約</a>をご確認ください。</p>
<h2>6. アフィリエイトプログラムについて</h2>
<p>当サイトは、楽天アフィリエイト、バリューコマース、Amazonアソシエイト・プログラムなどのアフィリエイトプログラムに参加する場合があります。リンク先で商品・サービスをご利用いただくと、運営者に報酬が支払われることがあります。該当するリンクの近くに、その旨を表示しています。</p>
<p>Amazonのアソシエイトとして、${esc(cfg.siteName)}は適格販売により収入を得ています。</p>
<h2>7. 外部サービスの利用について</h2>
<p>当サイトは、地図の表示に Leaflet と OpenStreetMap のタイル、Webフォントの表示に Google Fonts を利用しています。これらの読み込みの際、利用者のIPアドレスなどが、各サービスの事業者に送られます。</p>
<h2>8. 個人情報の第三者提供</h2>
<p>法令に基づく場合を除き、ご本人の同意なく、個人情報を第三者に提供しません。</p>
<h2>9. 免責事項</h2>
<p>当サイトの掲載情報の正確性には注意していますが、内容を保証するものではありません。日時・会場・料金は変更や中止になることがあるため、最新の情報は主催者の公式情報をご確認ください。当サイトの情報を利用して生じた損害について、運営者は責任を負いません。リンク先のサイトで提供される情報やサービスについても同様です。</p>
<h2>10. 著作権</h2>
<p>当サイトの文章・デザインの著作権は運営者に帰属します。掲載している開催情報の事実(日時・場所など)の権利は、各主催者に属します。権利を侵害する掲載があった場合は、お問い合わせからご連絡ください。速やかに対応します。</p>
<h2>11. 方針の変更</h2>
<p>この方針は、必要に応じて見直し、変更することがあります。変更後の内容は、このページに掲載した時点から効力を持ちます。</p>
<p class="meta">最終更新: ${esc(op.updated)}</p>`);

// ---------- sitemap / robots / ads.txt / security.txt / 404 ----------
const urls = ["/", "/map.html", "/calendar.html", "/kagura/", "/about.html", "/contact.html", "/privacy.html",
  // 検索に載せないページ(noindex)は、サイトマップにも入れない
  ...kaguras.filter((k) => upcoming.some((e) => e.kagura === k) || regular.some((r) => r.kagura === k)).map((k) => `/kagura/${encodeURIComponent(k)}.html`),
  ...prefs.map((p) => `/pref/${encodeURIComponent(p)}.html`),
  ...upcoming.map((e) => `/events/${e.id}.html`),
  ...regular.map((r) => `/regular/${r.id}.html`)];
write("dist/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${cfg.baseUrl}${u}</loc><lastmod>${nowJst.slice(0, 10)}</lastmod></url>`).join("")}</urlset>`);

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
