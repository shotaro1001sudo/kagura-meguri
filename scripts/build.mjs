// 静的サイト生成: data/events.json + config.json -> dist/
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";

const cfg = JSON.parse(readFileSync("config.json", "utf8"));
const all = JSON.parse(readFileSync("data/events.json", "utf8").replace(/^﻿/, "")).filter((e) => e.status === "published");
const now = new Date();
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isUpcoming = (e) => new Date(e.end || e.start) >= now;
const pad = (n) => String(n).padStart(2, "0");
const fmt = (s) => { const d = new Date(s); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const events = all.sort((a, b) => new Date(a.start) - new Date(b.start));
const upcoming = events.filter(isUpcoming);
const WD = ["日", "月", "火", "水", "木", "金", "土"];

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
const adSlot = (slot) =>
  cfg.adsense.client && slot
    ? `<ins class="adsbygoogle" style="display:block" data-ad-client="${cfg.adsense.client}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>`
    : `<div class="adph">広告枠</div>`;

// ---------- デザイン ----------
const css = readFileSync("scripts/style.css", "utf8");

const NAV = [["/", "一覧"], ["/map.html", "地図"], ["/calendar.html", "カレンダー"], ["/kagura/", "神楽の種類"]];
const layout = ({ title, desc, path, body, ld, head = "", active = "" }) => `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${cfg.baseUrl}${path}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500&family=Zen+Kaku+Gothic+New:wght@400;500&display=swap">
<style>${css}</style>${head}${cfg.adsense.client ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${cfg.adsense.client}" crossorigin="anonymous"></script>` : ""}
${cfg.analyticsId ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${cfg.analyticsId}"></script><script>window.dataLayer=[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${cfg.analyticsId}')</script>` : ""}
${ld ? `<script type="application/ld+json">${JSON.stringify(ld)}</script>` : ""}</head><body>
<header class="top"><div class="wrap"><a class="logo" href="/">${esc(cfg.siteName)}</a><nav>${NAV.map(([h, t]) => `<a href="${h}"${h === active ? ' class="on"' : ""}>${t}</a>`).join("")}</nav></div></header>
<div class="wrap"><main>${body}</main>
<footer><a href="${esc(cfg.submitFormUrl)}">開催情報を掲載する(無料)</a><br>
<a href="/about.html">運営者情報</a> ・ <a href="/contact.html">お問い合わせ</a> ・ <a href="/privacy.html">プライバシーポリシー</a><br>© ${esc(cfg.siteName)}</footer></div></body></html>`;

const card = (e) => {
  const d = new Date(e.start);
  return `<div class="card"><div class="date"><small>${d.getMonth() + 1}月 ${WD[d.getDay()]}</small><b>${d.getDate()}</b></div><div>
<h3><a href="/events/${e.id}.html">${esc(e.name)}</a></h3>
<div class="meta">${e.timeUnknown ? "時間は公式情報で確認" : `${pad(d.getHours())}:${pad(d.getMinutes())}〜`} ・ ${esc(e.prefecture)} ${esc(e.city)}${e.fee ? ` ・ ${esc(e.fee)}` : ""}</div>
<a class="tag gold" href="/kagura/${encodeURIComponent(e.kagura)}.html">${esc(e.kagura)}</a></div></div>`;
};
const write = (p, c) => { mkdirSync(p.replace(/[\\/][^\\/]*$/, "") || ".", { recursive: true }); writeFileSync(p, c); };
const hero = (h, p) => `<section class="hero"><h1>${h}</h1>${p ? `<p>${p}</p>` : ""}</section>`;
rmSync("dist", { recursive: true, force: true });

// クライアント用の軽量データ (地図・カレンダー)
const lite = events.map(({ id, name, kagura, prefecture, city, venue, start, end, lat, lng, fee }) => ({ id, name, kagura, prefecture, city, venue, start, end, lat, lng, fee, up: isUpcoming({ start, end }) }));
write("dist/events.json", JSON.stringify(lite));

const prefs = [...new Set(upcoming.map((e) => e.prefecture))];
const kaguras = [...new Set(events.map((e) => e.kagura).filter(Boolean))];

// トップ
write("dist/index.html", layout({
  title: `${cfg.siteName} | 全国の神楽 開催情報`, desc: cfg.description, path: "/", active: "/",
  body: `<section class="hero home-hero">
<svg class="enso" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 8C27 7 8 26 9 50c1 24 21 42 45 41 22-1 38-17 38-38" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>
<div class="copy"><h1>神々へ捧ぐ舞を、<br>訪ねる旅へ。</h1><p>全国の神楽の開催情報を、静かに、ひとつの場所に。</p></div>
<div class="vert" aria-hidden="true">笛と太鼓、夜の社に舞う</div></section>
<h2>これからの神楽</h2>
<div class="filters"><select id="f"><option value="">全国</option>${prefs.map((p) => `<option>${esc(p)}</option>`).join("")}</select>
<a class="btn ghost" href="${esc(cfg.submitFormUrl)}">開催情報を投稿する</a></div>
${adSlot(cfg.adsense.slotList)}
<div id="list">${upcoming.map((e) => `<div data-p="${esc(e.prefecture)}">${card(e)}</div>`).join("") || "<p>現在掲載中の開催情報はありません。</p>"}</div>
<script>f.onchange=()=>document.querySelectorAll('#list>div').forEach(d=>d.hidden=f.value&&d.dataset.p!==f.value)</script>
<h2>都道府県から探す</h2>${prefs.map((p) => `<a class="tag" href="/pref/${encodeURIComponent(p)}.html">${esc(p)}</a>`).join("")}
<h2>神楽の種類から探す</h2>${kaguras.map((k) => `<a class="tag gold" href="/kagura/${encodeURIComponent(k)}.html">${esc(k)}</a>`).join("")}`,
}));

// 地図 (Leaflet + OpenStreetMap)
write("dist/map.html", layout({
  title: `神楽 開催マップ | ${cfg.siteName}`, desc: "全国の神楽の開催場所を地図から探せます", path: "/map.html", active: "/map.html",
  head: `<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>`,
  body: `${hero("開催マップ", "これから開催される神楽を地図で探せます")}<div id="map"></div>
<p class="meta">地図データ © OpenStreetMap contributors</p>${adSlot(cfg.adsense.slotList)}
<script>
const map=L.map('map').setView([36.5,137.5],5);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap'}).addTo(map);
fetch('/events.json').then(r=>r.json()).then(list=>{
  const pts=[];const e=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  list.filter(x=>x.up&&x.lat&&x.lng).forEach(x=>{
    const d=new Date(x.start);
    L.marker([x.lat,x.lng]).addTo(map).bindPopup('<b>'+e(x.name)+'</b><br>'+(d.getMonth()+1)+'/'+d.getDate()+' '+e(x.prefecture)+e(x.city)+'<br><a href="/events/'+x.id+'.html">詳細を見る</a>');
    pts.push([x.lat,x.lng]);});
  if(pts.length>1)map.fitBounds(pts,{padding:[40,40]});else if(pts.length)map.setView(pts[0],9);
});
</script>`,
}));

// カレンダー
write("dist/calendar.html", layout({
  title: `神楽 開催カレンダー | ${cfg.siteName}`, desc: "月ごとの神楽開催日をカレンダーで確認", path: "/calendar.html", active: "/calendar.html",
  body: `${hero("開催カレンダー", "")}
<div class="calhead"><button id="pv">‹ 前月</button><h2 id="ttl"></h2><button id="nx">次月 ›</button></div>
<div class="cal" id="cal"></div>${adSlot(cfg.adsense.slotList)}
<script>
let list=[],cur=new Date();cur.setDate(1);
const e=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function draw(){
  const y=cur.getFullYear(),m=cur.getMonth();ttl.textContent=y+'年'+(m+1)+'月';
  const first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate(),today=new Date();
  let h=['日','月','火','水','木','金','土'].map(w=>'<div class="h">'+w+'</div>').join('');
  for(let i=0;i<first;i++)h+='<div class="d o"></div>';
  for(let d=1;d<=days;d++){
    const key=y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const ev=list.filter(x=>x.start.slice(0,10)===key);
    const t=today.getFullYear()==y&&today.getMonth()==m&&today.getDate()==d;
    h+='<div class="d'+(t?' t':'')+((first+d-1)%7==0?' sun':'')+'"><i>'+d+'</i>'+ev.map(x=>'<a href="/events/'+x.id+'.html" title="'+e(x.name)+'">'+e(x.name)+'</a>').join('')+'</div>';
  }
  cal.innerHTML=h;
}
pv.onclick=()=>{cur.setMonth(cur.getMonth()-1);draw()};nx.onclick=()=>{cur.setMonth(cur.getMonth()+1);draw()};
fetch('/events.json').then(r=>r.json()).then(l=>{list=l;
  const up=l.filter(x=>x.up)[0];if(up){cur=new Date(up.start);cur.setDate(1)}draw()});
draw();
</script>`,
}));

// 神楽の種類 一覧 + 個別
write("dist/kagura/index.html", layout({
  title: `神楽の種類 | ${cfg.siteName}`, desc: "石見神楽、高千穂神楽など神楽の種類別に開催情報を探せます", path: "/kagura/", active: "/kagura/",
  body: `${hero("神楽の種類", "流派・系統ごとに開催情報を探せます")}${kaguras
    .map((k) => `<div class="card"><div><h3><a href="/kagura/${encodeURIComponent(k)}.html">${esc(k)}</a></h3><div class="meta">開催予定 ${upcoming.filter((e) => e.kagura === k).length} 件</div></div></div>`)
    .join("")}${adSlot(cfg.adsense.slotList)}`,
}));
for (const k of kaguras) {
  const list = upcoming.filter((e) => e.kagura === k);
  write(`dist/kagura/${k}.html`, layout({
    title: `${k}の開催情報 | ${cfg.siteName}`, desc: `${k}の公演日程・会場一覧`, path: `/kagura/${encodeURIComponent(k)}.html`, active: "/kagura/",
    body: `${hero(esc(k), "開催予定の公演")}${adSlot(cfg.adsense.slotList)}${list.map(card).join("") || "<p>現在の開催予定はありません。</p>"}
${affiliateBlock({ prefecture: events.find((e) => e.kagura === k).prefecture, city: "", kagura: k })}`,
  }));
}

// 都道府県ページ
for (const p of [...new Set(events.map((e) => e.prefecture))]) {
  const list = events.filter((e) => e.prefecture === p && isUpcoming(e));
  write(`dist/pref/${p}.html`, layout({
    title: `${p}の神楽 開催情報 | ${cfg.siteName}`, desc: `${p}で開催される神楽の日程・会場一覧`, path: `/pref/${encodeURIComponent(p)}.html`,
    body: `${hero(`${esc(p)}の神楽`, "開催情報")}${adSlot(cfg.adsense.slotList)}${list.map(card).join("") || "<p>現在の開催予定はありません。</p>"}${affiliateBlock({ prefecture: p, city: "", kagura: "神楽" })}`,
  }));
}

// 詳細ページ
for (const e of events) {
  const ld = {
    "@context": "https://schema.org", "@type": "Event", name: e.name, startDate: e.start, endDate: e.end,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", description: e.description,
    location: { "@type": "Place", name: e.venue, address: { "@type": "PostalAddress", addressRegion: e.prefecture, addressLocality: e.city, addressCountry: "JP" } },
  };
  if (e.lat) ld.location.geo = { "@type": "GeoCoordinates", latitude: e.lat, longitude: e.lng };
  const q = encodeURIComponent(`${e.venue} ${e.prefecture}${e.city}`);
  const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${e.name}\nDTSTART:${e.start.replace(/[-:]/g, "")}00\nDTEND:${(e.end || e.start).replace(/[-:]/g, "")}00\nLOCATION:${e.venue}\nEND:VEVENT\nEND:VCALENDAR`;
  write(`dist/events/${e.id}.ics`, ics);
  write(`dist/events/${e.id}.html`, layout({
    title: `${e.name} | ${e.prefecture} | ${cfg.siteName}`, desc: `${fmt(e.start)} ${e.venue}(${e.prefecture}${e.city})の${e.kagura}`, path: `/events/${e.id}.html`, ld,
    head: e.lat ? `<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>` : "",
    body: `${hero(esc(e.name), `<a class="tag gold" href="/kagura/${encodeURIComponent(e.kagura)}.html">${esc(e.kagura)}</a><a class="tag" href="/pref/${encodeURIComponent(e.prefecture)}.html">${esc(e.prefecture)}</a>${isUpcoming(e) ? "" : '<span class="tag">終了しました</span>'}`)}
<table class="info"><tr><th>日時</th><td>${e.timeUnknown ? fmt(e.start).replace(/ \d\d:\d\d$/, "") + "(時間は公式情報をご確認ください)" : fmt(e.start) + (e.end ? " 〜 " + fmt(e.end) : "")}</td></tr><tr><th>会場</th><td>${esc(e.venue)}</td></tr>
<tr><th>場所</th><td>${esc(e.prefecture)} ${esc(e.city)}</td></tr><tr><th>料金</th><td>${esc(e.fee || "")}</td></tr></table>
<p>${esc(e.description)}</p>
<p>${e.url ? `<a class="btn" href="${esc(e.url)}" rel="noopener" target="_blank">公式情報を見る</a> ` : ""}<a class="btn ghost" href="/events/${e.id}.ics">カレンダーに追加</a> <a class="btn ghost" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">経路を調べる</a></p>
${e.lat ? `<div id="map" style="height:260px"></div><script>const m=L.map('map',{scrollWheelZoom:false}).setView([${e.lat},${e.lng}],12);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap'}).addTo(m);L.marker([${e.lat},${e.lng}]).addTo(m)</script>` : ""}
${adSlot(cfg.adsense.slotDetail)}${affiliateBlock(e)}`,
  }));
}

// 固定ページ (運営者情報 / お問い合わせ / プライバシーポリシー / 免責)
const op = cfg.operator;
const isMail = /^[^\s@]+@[^\s@]+$/.test(op.contact);
const contactHtml = isMail ? `<a href="mailto:${esc(op.contact)}">${esc(op.contact)}</a>` : /^https?:/.test(op.contact) ? `<a href="${esc(op.contact)}" rel="noopener">お問い合わせフォーム</a>` : esc(op.contact);
const doc = (path, title, desc, inner) => write(`dist${path}`, layout({ title: `${title} | ${cfg.siteName}`, desc, path, body: `${hero(title, "")}<div class="prose">${inner}</div>` }));

doc("/about.html", "運営者情報", `${cfg.siteName}の運営者情報`, `
<table class="info"><tr><th>サイト名</th><td>${esc(cfg.siteName)}</td></tr><tr><th>運営者</th><td>${esc(op.name)}</td></tr>
<tr><th>連絡先</th><td>${contactHtml}</td></tr><tr><th>開設</th><td>${esc(op.established)}</td></tr></table>
<h2>このサイトについて</h2>
<p>${esc(cfg.siteName)}は、全国の神楽の開催情報を探しやすくまとめるためのサイトです。神楽は、地域の神社や保存会が長く受け継いできた大切な文化です。その公演に出会う入口になることを目指しています。</p>
<h2>掲載情報について</h2>
<p>開催情報は、主催者からの投稿および公開されている情報をもとに掲載しています。日時・会場・料金は変更・中止になることがあります。お出かけの前に、必ず主催者の公式情報をご確認ください。</p>
<p>掲載内容の訂正・削除のご依頼は、お問い合わせからご連絡ください。</p>
<h2>収益について</h2>
<p>当サイトは、広告(Google AdSenseなど)およびアフィリエイトプログラムによる収益で運営しています。</p>`);

doc("/contact.html", "お問い合わせ", "掲載・訂正・削除のご連絡", `
<p>次のご連絡は、下記の連絡先で受け付けています。</p>
<ul><li>開催情報の掲載、訂正、削除のご依頼</li><li>サイトの不具合のご報告</li><li>その他のお問い合わせ</li></ul>
<p>連絡先: ${contactHtml}</p>
<p>開催情報の掲載は、<a href="${esc(cfg.submitFormUrl)}">投稿フォーム</a>からも受け付けています。内容によっては、お返事までお時間をいただくことや、お返事できないことがあります。</p>`);

doc("/privacy.html", "プライバシーポリシー", `${cfg.siteName}の個人情報・Cookie・広告に関する方針`, `
<p>${esc(op.name)}(以下「運営者」)は、${esc(cfg.siteName)}(以下「当サイト」)における利用者の情報を、以下の方針に基づいて取り扱います。</p>
<h2>1. 取得する情報</h2>
<p>当サイトは、閲覧時にアクセスログ(IPアドレス、ブラウザの種類、閲覧ページ、日時など)が記録されることがあります。お問い合わせや開催情報の投稿の際には、ご入力いただいた氏名・連絡先などを取得します。</p>
<h2>2. 利用目的</h2>
<ul><li>お問い合わせへの対応</li><li>掲載情報の確認・訂正・削除</li><li>サイトの利用状況の把握と改善</li><li>不正利用の防止</li></ul>
<h2>3. 広告の配信について</h2>
<p>当サイトは、第三者配信の広告サービス「Google AdSense」を利用する場合があります。Googleを含む第三者配信事業者は、Cookieを使用して、利用者が当サイトや他のサイトに過去にアクセスした際の情報に基づいて広告を配信します。</p>
<p>利用者は、<a href="https://myadcenter.google.com/" rel="noopener" target="_blank">Googleの広告設定</a>で、パーソナライズ広告を無効にできます。また、<a href="https://optout.aboutads.info/" rel="noopener" target="_blank">www.aboutads.info</a>で、第三者配信事業者のCookieによるパーソナライズ広告を無効にできる場合があります。Googleによる情報の取り扱いについては、<a href="https://policies.google.com/technologies/ads?hl=ja" rel="noopener" target="_blank">Googleのポリシーと規約</a>をご確認ください。</p>
<h2>4. アクセス解析について</h2>
<p>当サイトは、Googleによるアクセス解析ツール「Googleアナリティクス」を利用する場合があります。このツールはCookieを使用してトラフィックデータを収集しますが、個人を特定する情報は含まれません。Cookieは、ブラウザの設定で無効にできます。詳しくは、<a href="https://marketingplatform.google.com/about/analytics/terms/jp/" rel="noopener" target="_blank">Googleアナリティクス利用規約</a>をご確認ください。</p>
<h2>5. アフィリエイトプログラムについて</h2>
<p>当サイトは、楽天アフィリエイト、バリューコマース、Amazonアソシエイト・プログラムなどのアフィリエイトプログラムに参加する場合があります。リンク先で商品・サービスをご利用いただくと、運営者に報酬が支払われることがあります。該当するリンクの近くに、その旨を表示しています。</p>
<p>Amazonのアソシエイトとして、${esc(cfg.siteName)}は適格販売により収入を得ています。</p>
<h2>6. 個人情報の第三者提供</h2>
<p>法令に基づく場合を除き、ご本人の同意なく、個人情報を第三者に提供しません。</p>
<h2>7. 免責事項</h2>
<p>当サイトの掲載情報の正確性には注意していますが、内容を保証するものではありません。日時・会場・料金は変更や中止になることがあるため、最新の情報は主催者の公式情報をご確認ください。当サイトの情報を利用して生じた損害について、運営者は責任を負いません。リンク先のサイトで提供される情報やサービスについても同様です。</p>
<h2>8. 著作権</h2>
<p>当サイトの文章・デザインの著作権は運営者に帰属します。掲載している開催情報の事実(日時・場所など)の権利は、各主催者に属します。権利を侵害する掲載があった場合は、お問い合わせからご連絡ください。速やかに対応します。</p>
<h2>9. 方針の変更</h2>
<p>この方針は、必要に応じて見直し、変更することがあります。変更後の内容は、このページに掲載した時点から効力を持ちます。</p>
<p class="meta">最終更新: ${esc(op.updated)}</p>`);

// sitemap / robots / ads.txt
const urls = ["/", "/map.html", "/calendar.html", "/kagura/", "/about.html", "/contact.html", "/privacy.html",
  ...kaguras.map((k) => `/kagura/${encodeURIComponent(k)}.html`),
  ...[...new Set(events.map((e) => e.prefecture))].map((p) => `/pref/${encodeURIComponent(p)}.html`),
  ...events.map((e) => `/events/${e.id}.html`)];
write("dist/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${cfg.baseUrl}${u}</loc></url>`).join("")}</urlset>`);
if (cfg.domain) write("dist/CNAME", cfg.domain + "\n");
write("dist/robots.txt", `User-agent: *\nAllow: /\nSitemap: ${cfg.baseUrl}/sitemap.xml\n`);
if (cfg.adsense.client) write("dist/ads.txt", `google.com, ${cfg.adsense.client.replace("ca-", "")}, DIRECT, f08c47fec0942fa0\n`);
console.log(`built: ${events.length} events (${upcoming.length} upcoming), ${urls.length} pages`);
