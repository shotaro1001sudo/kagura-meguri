// 英語の入口ページ(/en/)の本文。海外からの旅行者向け。
// 事実は、日本語ページ(ガイド・歴史・各神楽の紹介)と同じ出典・同じ確認済みの内容だけを使う。
// 開催情報の詳細は日本語のまま(英語ページから、日本語の一覧・詳細へリンクする)。
// 神楽・開催の名前は、日本語の表記を <span lang="ja" translate="no"> に入れ、ブラウザの自動翻訳で崩れないようにする。

import { SOURCES as GUIDE_SOURCES } from "./guide.mjs";
import { SOURCES as HISTORY_SOURCES } from "./history.mjs";
import { figure, flow, table, icon, stageDiagram } from "./figures.mjs";

export const CHECKED = "2026-10-20";
export const SITE_EN = "Kagura Meguri";

const EXTRA_SOURCES = [];
const ALL_SOURCES = [...GUIDE_SOURCES, ...HISTORY_SOURCES.filter((s) => !GUIDE_SOURCES.some((g) => g.id === s.id)), ...EXTRA_SOURCES];

// 都道府県の英語名
export const PREF_EN = {
  "北海道": "Hokkaido", "青森県": "Aomori", "岩手県": "Iwate", "宮城県": "Miyagi", "秋田県": "Akita", "山形県": "Yamagata", "福島県": "Fukushima",
  "茨城県": "Ibaraki", "栃木県": "Tochigi", "群馬県": "Gunma", "埼玉県": "Saitama", "千葉県": "Chiba", "東京都": "Tokyo", "神奈川県": "Kanagawa",
  "新潟県": "Niigata", "富山県": "Toyama", "石川県": "Ishikawa", "福井県": "Fukui", "山梨県": "Yamanashi", "長野県": "Nagano", "岐阜県": "Gifu", "静岡県": "Shizuoka", "愛知県": "Aichi",
  "三重県": "Mie", "滋賀県": "Shiga", "京都府": "Kyoto", "大阪府": "Osaka", "兵庫県": "Hyogo", "奈良県": "Nara", "和歌山県": "Wakayama",
  "鳥取県": "Tottori", "島根県": "Shimane", "岡山県": "Okayama", "広島県": "Hiroshima", "山口県": "Yamaguchi",
  "徳島県": "Tokushima", "香川県": "Kagawa", "愛媛県": "Ehime", "高知県": "Kochi",
  "福岡県": "Fukuoka", "佐賀県": "Saga", "長崎県": "Nagasaki", "熊本県": "Kumamoto", "大分県": "Oita", "宮崎県": "Miyazaki", "鹿児島県": "Kagoshima", "沖縄県": "Okinawa",
};

// 神楽の種類の英語名(日本語の種類名 → 英語名)。紹介文は載せない(特定の神楽を取り上げないため。すべての種類を同じ扱いにする)
export const KAGURA_EN = [
  { key: "石見神楽", name: "Iwami Kagura" },
  { key: "高千穂神楽", name: "Takachiho Kagura" },
  { key: "広島神楽", name: "Hiroshima Kagura" },
  { key: "安芸高田神楽", name: "Akitakata Kagura" },
  { key: "備中神楽", name: "Bitchu Kagura" },
  { key: "花祭", name: "Hanamatsuri" },
  { key: "遠山の霜月祭", name: "Tohyama Shimotsuki Festival" },
  { key: "伊勢大神楽", name: "Ise Daikagura" },
  { key: "土佐の神楽", name: "Tosa Kagura" },
  { key: "庄内神楽", name: "Shonai Kagura" },
  { key: "御嶽神楽", name: "Ondake Kagura" },
  { key: "銀鏡神楽", name: "Shiromi Kagura" },
  { key: "保呂羽山の霜月神楽", name: "Horowasan Shimotsuki Kagura" },
  { key: "春日若宮おん祭", name: "Kasuga Wakamiya On-matsuri" },
  { key: "秩父神楽", name: "Chichibu Kagura" },
  { key: "鷲宮催馬楽神楽", name: "Washinomiya Saibara Kagura" },
  { key: "相模里神楽", name: "Sagami Sato Kagura" },
  { key: "鎌倉神楽", name: "Kamakura Kagura" },
  { key: "海南神社面神楽", name: "Kainan Shrine Men Kagura" },
  { key: "鶴岡八幡宮の御神楽", name: "Mikagura of Tsurugaoka Hachimangu" },
];

const kName = (jp) => KAGURA_EN.find((k) => k.key === jp)?.name;

/** 出典の番号を、ページごとに振る */
function makeCiter(esc) {
  const order = [];
  const cite = (...ids) => ids.map((id) => {
    if (!ALL_SOURCES.some((s) => s.id === id)) throw new Error(`no such source: ${id}`);
    let n = order.indexOf(id) + 1;
    const first = n === 0;
    if (first) { order.push(id); n = order.length; }
    return `<sup class="cite"><a href="#src-${n}"${first ? ` id="ref-${n}"` : ""} aria-label="Source ${n}">[${n}]</a></sup>`;
  }).join("");
  const sourcesHtml = () => `<h2 id="sources">Sources</h2><ol class="sources">${order.map((id, i) => {
    const s = ALL_SOURCES.find((x) => x.id === id);
    return `<li id="src-${i + 1}"><a href="${s.url}" rel="noopener" target="_blank" lang="ja" translate="no">${esc(s.name)}</a> (${esc(s.by)}; Japanese) <a class="back" href="#ref-${i + 1}" aria-label="Back to source ${i + 1}">↩</a></li>`;
  }).join("")}</ol><p class="meta">Last checked: ${CHECKED}. This page summarises the sources above. Dates, venues and rules can change, so always check with the organiser before you go.</p>`;
  return { cite, sourcesHtml };
}

const ja = (s, esc) => `<span lang="ja" translate="no">${esc(s)}</span>`;
const fmtDate = (s) => new Date(`${s.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/**
 * @param {object} x
 * @param {(s:string)=>string} x.esc
 * @param {Array} x.upcoming これからの開催(日付順)
 * @param {(k:string)=>string|null} x.kaguraHref 日本語の神楽の種類ページの URL(なければ null)
 * @param {{key:string, prefs:string[]}[]} x.styles サイトに載っている神楽の種類(日本語の「種類で探す」と同じ順番)と、都道府県
 */
export function englishPages({ esc, upcoming, kaguraHref, styles: styleList = [] }) {
  const styles = styleList.map((x) => ({ ...x, en: kName(x.key), href: kaguraHref(x.key) })).filter((x) => x.href);
  const pages = {};

  // ---------- Home ----------
  {
    const { cite, sourcesHtml } = makeCiter(esc);
    const picks = [];
    const seen = new Set();
    for (const e of upcoming) { if (!seen.has(e.kagura) && picks.length < 8) { seen.add(e.kagura); picks.push(e); } }
    pages.index = {
      title: `Kagura: Japan's Sacred Dance Theatre | ${SITE_EN}`,
      h1: "Kagura: Japan's sacred dance theatre",
      sub: "Find a performance, plan your visit and know what to expect.",
      desc: "Kagura is Japan's ancient Shinto dance theatre. Find upcoming shows, explore regional styles and read our beginner's guide.",
      body: () => `
<p>Kagura is music and dance performed as an offering to the gods at Shinto shrines. Masked dancers bring Japanese myths to life to the beat of drums, flutes and gongs. Japan has more than 4,000 kagura traditions, and many are still kept alive by local people in village shrines, theatres and festivals.${cite("kyogikai")}</p>
<p>This site lists kagura performances from all over Japan. The event pages are in Japanese, but your browser can translate them for you (see the <a href="/en/guide.html">first-timer's guide</a>).</p>
<p><a class="btn" href="/en/guide.html">First-timer's guide</a> <a class="btn ghost" href="/en/kagura.html">Kagura styles</a> <a class="btn ghost" href="/en/history.html">History</a></p>

<h2>Why see kagura?</h2>
<div class="gcards">
<section class="gcard"><h3>${icon("eye")}Close to the stage</h3><p>Many performances take place in small shrines and halls. Visitors are welcomed as part of the community, and you are often just a few steps from the dancers.${cite("jta")}</p></section>
<section class="gcard"><h3>${icon("calendar")}Easy to follow</h3><p>Most plays are based on myths and folk tales, with clear-cut heroes and monsters. The costumes and masks tell you who's who, and some shows feature lightning-fast costume changes and fire-breathing serpents.${cite("hiroshima")}</p></section>
<section class="gcard"><h3>${icon("car")}Different in every region</h3><p>The rhythm, costumes and plays change from one valley to the next, and travelling to see different styles is half the fun.</p></section>
</div>

<h2>Upcoming performances</h2>
<p class="meta">A selection of upcoming performances, one for each style. Event names and details are in Japanese.</p>
<div class="tblwrap" role="region" aria-label="Upcoming performances" tabindex="0"><table class="tbl cmp"><thead><tr><th scope="col">Date</th><th scope="col">Style</th><th scope="col">Event</th><th scope="col">Where</th></tr></thead><tbody>
${picks.map((e) => `<tr><th scope="row">${fmtDate(e.start)}</th><td data-k="Style">${esc(kName(e.kagura) ?? "Kagura")}</td><td data-k="Event"><a href="/events/${e.id}.html" hreflang="ja" lang="ja" translate="no">${esc(e.name)}</a></td><td data-k="Where">${esc(PREF_EN[e.prefecture] ?? "")}</td></tr>`).join("")}
</tbody></table></div>
<p><a class="btn" href="/calendar.html" hreflang="ja">All performances (Japanese)</a> <a class="btn ghost" href="/map.html" hreflang="ja">Map (Japanese)</a> <a class="btn ghost" href="/weekend.html" hreflang="ja">This weekend (Japanese)</a></p>

<h2>Where to see kagura</h2>
<p>Kagura is performed at shrine festivals, in community halls and on theatre stages all over Japan. Some venues hold regular shows on fixed days, which makes them easy to plan around; festival performances take place on set dates, often at night.</p>
<p>To find what is on near you or along your route, use the calendar, the map or the list of all kagura styles. These pages are in Japanese, but your browser can translate them.</p>
<p><a class="btn" href="/calendar.html" hreflang="ja">Calendar (Japanese)</a> <a class="btn ghost" href="/map.html" hreflang="ja">Map (Japanese)</a> <a class="btn ghost" href="/en/kagura.html">All kagura styles</a></p>
${sourcesHtml()}`,
    };
  }

  // ---------- Guide ----------
  {
    const { cite, sourcesHtml } = makeCiter(esc);
    pages.guide = {
      title: `Kagura Guide for First-Timers | ${SITE_EN}`,
      h1: "Kagura guide for first-timers",
      sub: "Getting there, etiquette and what to bring",
      desc: "How to find, get to and enjoy kagura in Japan: booking, transport, etiquette, photography, offerings and what to bring.",
      body: () => `
<p>Kagura is performed in shrines, community halls and theatres all over Japan. This page covers the practical side for visitors from abroad: how to find a performance, how to get there, how to behave and what to bring.</p>
<nav class="toc" id="toc" aria-label="Contents"><ol><li><a href="#find">How to find a performance</a></li><li><a href="#types">Shrine festival or theatre?</a></li><li><a href="#stage">Reading the stage</a></li><li><a href="#getting">Getting there and booking</a></li><li><a href="#etiquette">Etiquette</a></li><li><a href="#bring">What to bring</a></li></ol></nav>

<h2 id="find">How to find a performance</h2>
${figure(flow([
  { t: `${icon("calendar")}Search`, d: "Use this site's calendar, map and 'This weekend' pages (in Japanese)" },
  { t: `${icon("eye")}Translate`, d: "Turn on your browser's translation (Chrome, Edge, Safari)" },
  { t: `${icon("phone")}Check`, d: "Dates, venues and prices can change, so follow the official link on each page" },
  { t: `${icon("car")}Plan`, d: "Many venues are rural and shows go on late, so plan your last train, bus or taxi" },
], "Steps to find a performance", "h"), "Four simple steps to finding and planning a visit. The event pages are in Japanese, but your browser can translate them.")}
<p><a class="btn" href="/calendar.html" hreflang="ja">Calendar (Japanese)</a> <a class="btn ghost" href="/map.html" hreflang="ja">Map (Japanese)</a> <a class="btn ghost" href="/weekend.html" hreflang="ja">This weekend (Japanese)</a></p>

<h2 id="types">Shrine festival or theatre?</h2>
${table(["", "Shrine festival or all-night kagura", "Theatre or festival stage"], [
  ["What it is", `An offering to the local deity, often held at night (sometimes all night long) in a shrine, a private home or a community hall.${cite("takachiho")}`, `A performance staged for an audience, often with an MC or a printed synopsis of the story.${cite("akitakata")}`],
  ["Atmosphere", "Ritual and community. You are a guest of the village.", "Relaxed. Some people eat, drink and cheer during the show."],
  ["Planning", "Dates and venues can change from year to year, so contact the local tourist office about two weeks in advance.", "Fixed dates. Some shows require a reservation."],
], "Shrine festival or theatre", "chk")}

<h2 id="stage">Reading the stage</h2>
${figure(stageDiagram(), "An example of how a kagura stage is laid out; every venue is different. The music (hayashi) is played on drums, a hand gong and flute, and follows the movements of the dancers.")}

<h2 id="getting">Getting there and booking</h2>
<ul>
<li>Shrine kagura often takes place at night, so a taxi or car is recommended. Shrines in town often have little or no parking.${cite("iwamiqa")}</li>
<li>Some shows require a reservation. Online booking may open weeks in advance, and some venues keep a limited number of tickets for sale at the door on the day.${cite("takachiho")}</li>
<li>Village kagura schedules can change from year to year. Check with the local tourist association about two weeks before you go.</li>
<li>Some regular shows require advance tickets, so check the official page for each event.</li>
</ul>

<h2 id="etiquette">Etiquette</h2>
${table(["", "Do", "Don't"], [
  [`${icon("camera")}Photos`, "Ask the troupe or shrine officials first. If photography is allowed, stay out of other people's way.", "Don't use a flash, tripod, selfie stick or stool, and never step in front of the dancers."],
  [`${icon("voice")}The stage`, "Check with the organiser (often a member of the shrine committee) before going near or onto the performance area.", "Don't walk onto the dance floor; at some kagura, this is strictly forbidden."],
  [`${icon("bin")}Rubbish`, "Take your rubbish home with you, even where eating and drinking are allowed.", "Don't leave anything behind."],
  [`${icon("flower")}Offerings`, "In some regions, it is customary to give the troupe a small cash tip (called ohana). It is always optional.", "Don't feel obliged. At some shrine kagura, a small offering is expected at the reception desk, so ask if you are unsure."],
], "Etiquette", "chk")}
<p>The rules vary from place to place and from one performance to another. If in doubt, ask the organiser or a local.${cite("iwamiqa", "jta")}</p>

<h2 id="bring">What to bring</h2>
${table(["When", "Useful items"], [
  ["Winter nights", "Blanket, warm clothing, hand warmers"],
  ["Summer nights", "Insect repellent, towel"],
  ["All-night kagura", "Warm clothing (especially for your feet), drinks and snacks"],
  ["Any time of year", "Food and drinks, a folding chair, a lap blanket, some cash"],
], "What to bring", "chk")}
<p>Some rituals involve fire and flying sparks, which can burn small holes in synthetic jackets, and the smell of smoke will cling to your clothes.${cite("iida")}</p>
<p><a class="btn" href="/en/">Back to the English home</a> <a class="btn ghost" href="/guide.html" hreflang="ja">Full Japanese guide</a></p>
${sourcesHtml()}`,
    };
  }

  // ---------- Kagura styles ----------
  // 特定の神楽を取り上げないよう、紹介文は載せず、サイトに載っているすべての種類を、日本語の「種類で探す」と同じ順番・同じ扱いで並べる
  {
    const { cite, sourcesHtml } = makeCiter(esc);
    pages.kagura = {
      title: `Kagura Styles in Japan | ${SITE_EN}`,
      h1: "Kagura styles",
      sub: "Every style featured on this site, listed equally",
      desc: "The main lineages of kagura, plus a full list of every kagura style featured on this site, with links to dates and venues.",
      body: () => `
<p>Kagura takes many forms. The music, costumes and plays differ from region to region, and often from one village to the next.</p>
<h2>The main lineages</h2>
<p>Kagura is broadly divided into mikagura, performed at the imperial court, and sato-kagura, performed at shrines and in communities throughout Japan. Sato-kagura is usually grouped into four lineages, although the categories and names vary between dictionaries and researchers.${cite("kotobank")}</p>
${table(["Lineage", "Characteristics"], [
  ["Miko kagura", "Based on rites of possession, oracles and the calming of spirits performed by priests and shrine maidens."],
  ["Izumo style", "Typified by the Shichiza rites and shinno plays of Sada Shrine in Shimane, combining dances with ritual objects and myth plays."],
  ["Ise style", "Derived from the hot-water (yudate) kagura of Ise Shrine, in which water is boiled in a cauldron before the gods."],
  ["Shishi kagura", "Lion dances that use the power of the lion's head to drive away evil, prevent fires and pray for good health."],
], "The main lineages of kagura", "chk")}

<h2>All styles on this site</h2>
<p class="meta">Listed in the same order as the Japanese "browse by style" page. Each link opens the Japanese page with upcoming dates and venues.</p>
${table(["Style", "Prefecture", "Dates and venues"], styles.map((k) => [esc(k.en || k.key) + (k.en ? ` <small lang="ja" translate="no">${esc(k.key)}</small>` : ""), esc(k.prefs.map((x) => PREF_EN[x] || x).join(", ")), `<a href="${k.href}" hreflang="ja">Japanese page</a>`]), "All kagura styles on this site", "styles")}
<p><a class="btn" href="/en/guide.html">First-timer's guide</a> <a class="btn ghost" href="/kagura/" hreflang="ja">Browse by style (Japanese)</a></p>
${sourcesHtml()}`,
    };
  }

  // ---------- History ----------
  {
    const { cite, sourcesHtml } = makeCiter(esc);
    const items = [
      ["Myth", "The sun goddess Amaterasu hides in a cave, and the world is plunged into darkness. The goddess Ame-no-Uzume dances, the gods laugh, and light returns. This story is told as the origin of kagura.", ["wiki-iwato", "kotobank"]],
      ["807", "The word 'kagura' appears in writing for the first time (in the Kogo Shui).", ["kotobank"]],
      ["1002", "The imperial court's kagura ceremony begins (some sources say 1005). It later becomes an annual event held every December.", ["kotobank", "wiki-mikagura"]],
      ["1608", "At Sada Shrine, priests are said to have created 'shinno', kagura plays modelled on noh theatre.", ["wiki-sada"]],
      ["Edo period", "Ise's 'daidai kagura' spreads across the country, and Edo (now Tokyo) develops its own village kagura.", ["kotobank"]],
      ["Early Meiji", "Priests are banned from performing kagura, and in many areas villagers take over as dancers.", ["wiki-iwami", "matsue", "kotobank"]],
      ["1976", "Japan begins designating Important Intangible Folk Cultural Properties, and kagura from many regions come under national protection.", ["wiki-juyo"]],
      ["2025", "Kagura is selected as Japan's candidate for UNESCO's list, with the nomination planned for 2028.", ["wiki-kagura"]],
    ];
    pages.history = {
      title: `History of Kagura: From Myth to UNESCO | ${SITE_EN}`,
      h1: "A short history of kagura",
      sub: "From the age of the gods to the present day",
      desc: "How kagura began and changed: the Amaterasu myth, imperial court rites, noh influence, the Meiji reforms and UNESCO.",
      body: () => `
<p>The word 'kagura' is generally thought to come from 'kamikura', meaning a seat for the gods.${cite("kotobank")} Kagura developed along two broad lines: mikagura, performed at the imperial court, and sato-kagura, the village kagura performed at shrines throughout Japan.${cite("kotobank")}</p>
<h2>Timeline</h2>
<ol class="flow v" aria-label="Kagura timeline">${items.map(([y, t, c]) => `<li><span class="n" aria-hidden="true">•</span><b>${esc(y)}</b><span class="d">${esc(t)}${cite(...c)}</span></li>`).join("")}</ol>
<p class="meta">Dates before the modern era are based on encyclopedias and local records, and there are several theories about the origins of kagura.</p>
<p><a class="btn" href="/history/" hreflang="ja">Detailed history (Japanese)</a> <a class="btn ghost" href="/en/kagura.html">Kagura styles</a></p>
${sourcesHtml()}`,
    };
  }
  return pages;
}
