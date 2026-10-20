// 英語の入口ページ(/en/)の本文。海外からの旅行者向け。
// 事実は、日本語ページ(ガイド・歴史・各神楽の紹介)と同じ出典・同じ確認済みの内容だけを使う。
// 開催情報の詳細は日本語のまま(英語ページから、日本語の一覧・詳細へリンクする)。
// 神楽・開催の名前は、日本語の表記を <span lang="ja" translate="no"> に入れ、ブラウザの自動翻訳で崩れないようにする。

import { SOURCES as GUIDE_SOURCES } from "./guide.mjs";
import { SOURCES as HISTORY_SOURCES } from "./history.mjs";
import { figure, flow, table, icon, stageDiagram } from "./figures.mjs";

export const CHECKED = "2026-10-20";
export const SITE_EN = "Kagura Meguri";

const EXTRA_SOURCES = [
  { id: "horowasan", name: "保呂羽山の霜月神楽", by: "るるぶ&more.(横手市教育委員会)", url: "https://rurubu.jp/andmore/spot/20000345" },
  { id: "onmatsuri", name: "春日若宮おん祭 お渡り式・桟敷席", by: "奈良市観光協会(プレスリリース)", url: "https://kyodonewsprwire.jp/release/202610147844" },
  { id: "shiromi", name: "銀鏡神楽(銀鏡神社大祭)", by: "西都市観光協会", url: "https://www.saito-kanko.jp/tourisms/%E9%8A%80%E9%8F%A1%E7%A5%9E%E6%A5%BD/" },
];
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

// 神楽の種類の英語名と紹介(日本語の紹介ページと同じ内容)。key は、日本語の神楽の種類名
export const KAGURA_EN = [
  { key: "石見神楽", name: "Iwami Kagura", where: "Shimane (Iwami region)", season: "Year-round shows in hot-spring towns; autumn shrine festivals",
    text: "Fast, energetic rhythm (hachi-choshi), gold-and-silver embroidered costumes and papier-mache masks made from local Sekishu washi paper. The giant serpent (Orochi) dance, with a lightweight serpent body that spits fire and smoke, is the star attraction. Regular shows are held in Hamada, Masuda, Gotsu (Arifuku Onsen) and Yunotsu Onsen.", cites: ["wiki-iwami", "shimane"] },
  { key: "高千穂神楽", name: "Takachiho Kagura", where: "Miyazaki (Takachiho)", season: "Nightly all year; village all-night kagura from mid-November to early February",
    text: "Every night at 20:00, Takachiho Shrine shows four of the 33 traditional dances in about an hour. From mid-November to early February, around 20 villages hold all-night yokagura in private homes or community halls. Designated an Important Intangible Folk Cultural Property of Japan in 1978.", cites: ["takachiho", "wiki-takachiho"] },
  { key: "広島神楽", name: "Hiroshima Kagura", where: "Hiroshima", season: "Weekly regular shows; festivals and competitions in autumn",
    text: "Hiroshima has several styles. The mountain villages of the north have fast, flashy kagura with quick costume changes; the coastal areas have slower, more ritual styles. A regular show is held every Wednesday.", cites: ["hiroshima", "hiroshima-city"] },
  { key: "備中神楽", name: "Bitchu Kagura", where: "Okayama (Bitchu region)", season: "Monthly shows at Korakuen Garden and Takahashi",
    text: "An Important Intangible Folk Cultural Property (1979). It combines Shinto ritual with theatrical myth plays, and features a comic character who trades jokes with the drummer. Regular shows are held at Korakuen, one of Japan's Three Great Gardens (admission to the garden required).", cites: ["wiki-bitchu"] },
  { key: "花祭", name: "Hanamatsuri", where: "Aichi (Toei Town)", season: "November to January, one village at a time",
    text: "An all-night winter festival said to be over 700 years old and designated an Important Intangible Folk Cultural Property. Masked demons and gods dance around a fire and a cauldron. Entry is free; visitors bring a small cash offering and receive a local gift in return.", cites: ["aichinow"] },
  { key: "遠山の霜月祭", name: "Tohyama Shimotsuki Festival", where: "Nagano (Iida, Tohyama valley)", season: "December, shrine by shrine",
    text: "An overnight hot-water ritual (yudate kagura) in eight shrines of the Tohyama valley. Masked gods appear and splash boiling water. Designated an Important Intangible Folk Cultural Property in 1979.", cites: ["iida"] },
  { key: "伊勢大神楽", name: "Ise Daikagura", where: "Mie (Kuwana)", season: "Annual finale on December 24",
    text: "Lion dances and traditional acrobatics (plate spinning and more) by troupes that tour the country all year. On December 24, all troupes return to Masuda Shrine in Kuwana to perform every piece. Designated an Important Intangible Folk Cultural Property in 1981.", cites: ["wiki-ise"] },
  { key: "土佐の神楽", name: "Tosa Kagura", where: "Kochi (mountain villages)", season: "Autumn shrine festivals",
    text: "Kagura of the Shikoku mountains, designated an Important Intangible Folk Cultural Property in 1980. Famous for sword dances and acrobatic dances with trays and halberds, and for dramatic scenes where a demon is talked into fleeing.", cites: ["tosa"] },
  { key: "庄内神楽", name: "Shonai Kagura", where: "Oita (Yufu)", season: "Third Saturday, May to October; Shonai Kagura Festival in autumn",
    text: "A lively kagura with fast drumming and flute. A record of a performance in 1778 survives. Regular shows are held at the Shonai sports park stage.", cites: ["wiki-shonai"] },
  { key: "御嶽神楽", name: "Ondake Kagura", where: "Oita (Bungo-ono)", season: "Monthly shows at Kagura Kaikan; April festival",
    text: "Dynamic, powerful dances based on Japanese myths; 33 dances are handed down. An Important Intangible Folk Cultural Property. Regular performances are held at Kagura Kaikan in Kiyokawa.", cites: ["ondake"] },
  { key: "銀鏡神楽", name: "Shiromi Kagura", where: "Miyazaki (Saito)", season: "December 12-16 (main all-night kagura: Dec 14-15)",
    text: "Held during the annual festival of Shiromi Shrine. Thirty-three kagura are performed through the night, ending the next afternoon with the hunting-themed 'Shishitogiri' and the 'Kamiokuri' farewell to the gods.", cites: ["shiromi"] },
  { key: "保呂羽山の霜月神楽", name: "Horowasan Shimotsuki Kagura", where: "Akita (Yokote)", season: "November 7-8, overnight",
    text: "An overnight hot-water (yudate) kagura of 33 dances at Hauchiwake Shrine's village shrine in Yokote. A shrine maiden dances and delivers an oracle, and the climax is when sacred water from the cauldron is sprinkled on worshippers with bamboo leaves. It is a nationally designated Important Intangible Folk Cultural Property. Admission is free (a small offering is customary).", cites: ["horowasan"] },
  { key: "春日若宮おん祭", name: "Kasuga Wakamiya On-matsuri", where: "Nara (Kasuga Taisha)", season: "December 17 (procession and night rites)",
    text: "The December festival of Wakamiya, a sub-shrine of Kasuga Taisha. On December 17 a procession of performing groups goes to the Otabisho, where shrine maidens' kagura, dengaku and bugaku are offered into the night. Grandstand seats are available by reservation.", cites: ["onmatsuri"] },
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
  }).join("")}</ol><p class="meta">Checked on ${CHECKED}. Summarised from the sources above. Details such as dates, venues and rules may change; always check the organiser's information.</p>`;
  return { cite, sourcesHtml };
}

const ja = (s, esc) => `<span lang="ja" translate="no">${esc(s)}</span>`;
const fmtDate = (s) => new Date(`${s.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/**
 * @param {object} x
 * @param {(s:string)=>string} x.esc
 * @param {Array} x.upcoming これからの開催(日付順)
 * @param {(k:string)=>string|null} x.kaguraHref 日本語の神楽の種類ページの URL(なければ null)
 */
export function englishPages({ esc, upcoming, kaguraHref }) {
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
      sub: "Find a performance, plan your visit, and learn what to expect.",
      desc: "Kagura is Japan's ancient Shinto dance theatre. Find upcoming shows, regional styles and a first-timer's guide.",
      body: () => `
<p>Kagura is a dance and music offering made to the gods at Shinto shrines. Masked dancers act out stories from Japanese myths, to the sound of drums, flutes and gongs. Many of the more than 4,000 kagura traditions in Japan are still performed by local people, in village shrines, theatres and festivals.${cite("kyogikai")}</p>
<p>This site lists kagura performances all over Japan. Event pages are in Japanese. You can read them with your browser's translation feature (see the <a href="/en/guide.html">first-timer's guide</a>).</p>
<p><a class="btn" href="/en/guide.html">First-timer's guide</a> <a class="btn ghost" href="/en/kagura.html">Kagura styles by region</a> <a class="btn ghost" href="/en/history.html">History</a></p>

<h2>Why see kagura?</h2>
<div class="gcards">
<section class="gcard"><h3>${icon("eye")}Close to the stage</h3><p>Many performances are in small shrines and halls. Visitors are welcome as part of the community, and the audience is often only a few steps from the dancers.${cite("jta")}</p></section>
<section class="gcard"><h3>${icon("calendar")}Easy to follow</h3><p>Most plays are myths and folk tales with clear heroes and monsters. Costumes and masks tell you who is who, and some programmes even include quick costume changes and fire-breathing serpents.${cite("hiroshima")}</p></section>
<section class="gcard"><h3>${icon("car")}Different in every region</h3><p>Rhythm, costumes and plays differ from valley to valley. Travelling to see different styles is part of the fun.</p></section>
</div>

<h2>Upcoming performances</h2>
<p class="meta">A selection of the next performances, one per style. Names and details are in Japanese.</p>
<div class="tblwrap" role="region" aria-label="Upcoming performances" tabindex="0"><table class="tbl cmp"><thead><tr><th scope="col">Date</th><th scope="col">Style</th><th scope="col">Event</th><th scope="col">Where</th></tr></thead><tbody>
${picks.map((e) => `<tr><th scope="row">${fmtDate(e.start)}</th><td data-k="Style">${esc(kName(e.kagura) ?? "Kagura")}</td><td data-k="Event"><a href="/events/${e.id}.html" hreflang="ja" lang="ja" translate="no">${esc(e.name)}</a></td><td data-k="Where">${esc(PREF_EN[e.prefecture] ?? "")}, <span lang="ja" translate="no">${esc(e.city)}</span></td></tr>`).join("")}
</tbody></table></div>
<p><a class="btn" href="/calendar.html" hreflang="ja">All performances (Japanese)</a> <a class="btn ghost" href="/map.html" hreflang="ja">Map (Japanese)</a> <a class="btn ghost" href="/weekend.html" hreflang="ja">This weekend (Japanese)</a></p>

<h2>Where to see kagura</h2>
<p>Regular shows happen on fixed days, so they are easy to plan around. Festival performances are on specific dates, often at night.</p>
${table(["Where", "Schedule", "Style"], [
  ["Takachiho Shrine, Miyazaki", "Every night, 20:00-21:00", "Takachiho Kagura"],
  ["Hiroshima Prefectural Cultural Centre", "Every Wednesday", "Hiroshima Kagura"],
  ["Hot-spring towns and shrines in Shimane (Hamada, Masuda, Gotsu, Yunotsu)", "Many weekends and evenings", "Iwami Kagura"],
  ["Korakuen Garden, Okayama", "Monthly, usually the second Sunday", "Bitchu Kagura"],
  ["Kagura Kaikan, Oita (Kiyokawa)", "Monthly", "Ondake Kagura"],
  ["Toei Town, Aichi", "November to January", "Hanamatsuri"],
], "Where to see kagura", "chk")}
<p><a href="/en/kagura.html">See all styles and where to find them</a></p>
${sourcesHtml()}`,
    };
  }

  // ---------- Guide ----------
  {
    const { cite, sourcesHtml } = makeCiter(esc);
    pages.guide = {
      title: `Kagura Guide for First-Timers | ${SITE_EN}`,
      h1: "Kagura guide for first-timers",
      sub: "Getting there, etiquette, what to bring",
      desc: "How to find, reach and enjoy kagura in Japan: booking, transport, etiquette, photos, offerings and what to bring.",
      body: () => `
<p>Kagura performances are held in shrines, community halls and theatres across Japan. This page explains the practical side for visitors from abroad: how to find a performance, how to get there, how to behave, and what to bring.</p>
<nav class="toc" id="toc" aria-label="Contents"><ol><li><a href="#find">How to find a performance</a></li><li><a href="#types">Shrine festival or theatre?</a></li><li><a href="#stage">Reading the stage</a></li><li><a href="#getting">Getting there and booking</a></li><li><a href="#etiquette">Etiquette</a></li><li><a href="#bring">What to bring</a></li></ol></nav>

<h2 id="find">How to find a performance</h2>
${figure(flow([
  { t: `${icon("calendar")}Search`, d: "Use this site's Japanese calendar, map, and 'this weekend' pages" },
  { t: `${icon("eye")}Translate`, d: "Use your browser's translate button (Chrome, Edge, Safari)" },
  { t: `${icon("phone")}Check`, d: "Dates, venues and prices can change. Open the official link on each page" },
  { t: `${icon("car")}Plan`, d: "Many venues are rural and shows run at night. Plan your last train, bus or taxi" },
], "Steps to find a performance", "h"), "A simple way to find and plan a visit. Event pages are in Japanese, but your browser can translate them.")}
<p><a class="btn" href="/calendar.html" hreflang="ja">Calendar (Japanese)</a> <a class="btn ghost" href="/map.html" hreflang="ja">Map (Japanese)</a> <a class="btn ghost" href="/weekend.html" hreflang="ja">This weekend (Japanese)</a></p>

<h2 id="types">Shrine festival or theatre?</h2>
${table(["", "Shrine festival or all-night kagura", "Theatre or festival stage"], [
  ["What it is", `An offering to the local god. Often held at night, sometimes all night, in a shrine, a house or a community hall.${cite("takachiho")}`, `A show for audiences, with a host or a printed synopsis of the story.${cite("akitakata")}`],
  ["Mood", "Ritual and community. You are a guest of the village.", "Relaxed. Some audiences eat, drink and cheer."],
  ["Planning", "Dates and venues can change each year. Contact the local tourist office about two weeks ahead.", "Fixed dates. Some shows need a reservation."],
], "Shrine festival or theatre", "chk")}

<h2 id="stage">Reading the stage</h2>
${figure(stageDiagram(), "One example of how a kagura stage is arranged. Every venue is different. The music (hayashi) is played on drums, hand gong and flute, and follows the dancers' movement.")}

<h2 id="getting">Getting there and booking</h2>
<ul>
<li>Shrine kagura is often at night. Taxis or a car are recommended, and city shrines often have almost no parking.${cite("iwamiqa")}</li>
<li>Some shows require a reservation. For example, the nightly show at Takachiho Shrine takes online booking from 30 days ahead, and also sells a limited number of same-day tickets at the door.${cite("takachiho")}</li>
<li>For village kagura, schedules can change by year. Ask the local tourist association about two weeks before.</li>
<li>Some regular shows need advance tickets; check the official page of each event.</li>
</ul>

<h2 id="etiquette">Etiquette</h2>
${table(["", "Do", "Don't"], [
  [`${icon("camera")}Photos`, "Ask the troupe or shrine officials first. Where allowed, keep out of other people's way.", "Don't use a flash, a tripod, a selfie stick or a stool, and don't step in front of dancers."],
  [`${icon("voice")}The stage`, "Ask the organiser (often a shrine committee member) before going near or onto the stage area.", "Don't walk into the dance floor (in Takachiho, entering it is strictly forbidden)."],
  [`${icon("bin")}Rubbish`, "Take your rubbish home, even where eating and drinking are allowed.", "Don't leave anything behind."],
  [`${icon("flower")}Offerings`, "In some regions it is customary to give the troupe a small tip (called ohana) in cash. It is always optional.", "Don't feel obliged. Some shrine kagura expect a small offering at the reception desk; ask if unsure."],
], "Etiquette", "chk")}
<p>Rules depend on the place and the performance. If you are unsure, ask the organiser or a local person.${cite("iwamiqa", "jta")}</p>

<h2 id="bring">What to bring</h2>
${table(["When", "Useful items"], [
  ["Winter nights", "Blanket, warm clothing, hand warmers"],
  ["Summer nights", "Insect repellent, towel"],
  ["All-night kagura", "Warm clothing (especially for your feet), drinks and snacks"],
  ["Any season", "Drinks and food, a folding chair, a lap blanket, some cash"],
], "What to bring", "chk")}
<p>Fire and sparks are part of some rituals, so synthetic jackets can get small holes. Smoke smell stays on clothes.${cite("iida")}</p>
<p><a class="btn" href="/en/">Back to the English home</a> <a class="btn ghost" href="/guide.html" hreflang="ja">Full Japanese guide</a></p>
${sourcesHtml()}`,
    };
  }

  // ---------- Kagura styles ----------
  {
    const { cite, sourcesHtml } = makeCiter(esc);
    pages.kagura = {
      title: `Kagura Styles by Region in Japan | ${SITE_EN}`,
      h1: "Kagura styles by region",
      sub: "Where to see each style, and when",
      desc: "From Iwami and Takachiho to Hanamatsuri and Ise Daikagura: Japan's main kagura styles, and when and where to see them.",
      body: () => `
<p>Kagura differs by region. Below are the main styles that you can see on this site, with the season and place to look for each. For the details of upcoming events, follow the link to the Japanese page of each style.</p>
<h2>Main styles</h2>
${KAGURA_EN.map((k) => { const href = kaguraHref(k.key); return `<section class="gcard" id="${esc(k.name.toLowerCase().replace(/[^a-z]+/g, "-"))}" style="margin:12px 0"><h3>${esc(k.name)} <small lang="ja" translate="no">${esc(k.key)}</small></h3><p><b>Where:</b> ${esc(k.where)}<br><b>When:</b> ${esc(k.season)}</p><p>${esc(k.text)}${cite(...k.cites)}</p>${href ? `<p><a href="${href}" hreflang="ja">Upcoming ${esc(k.name)} events (Japanese)</a></p>` : ""}</section>`; }).join("")}
<p><a class="btn" href="/en/guide.html">First-timer's guide</a> <a class="btn ghost" href="/kagura/" hreflang="ja">Browse by style (Japanese)</a></p>
${sourcesHtml()}`,
    };
  }

  // ---------- History ----------
  {
    const { cite, sourcesHtml } = makeCiter(esc);
    const items = [
      ["Myth", "The goddess Amaterasu hides in a cave and the world goes dark. The goddess Ame-no-Uzume dances, the gods laugh, and light returns. This story is told as the origin of kagura.", ["wiki-iwato", "kotobank"]],
      ["807", "The word 'kagura' first appears in a written text (Kogo Shui).", ["kotobank"]],
      ["1002", "The imperial court's kagura ceremony begins (some say 1005); it later becomes an annual event each December.", ["kotobank", "wiki-mikagura"]],
      ["1189", "A document in Takachiho mentions a seven-day-and-night 'gojinraku'.", ["wiki-takachiho"]],
      ["1608", "At Sada Shrine, priests are said to start 'shinno', kagura plays that borrow the form of noh theatre.", ["wiki-sada"]],
      ["Edo period", "Ise's 'daidai kagura' spreads across the country; Edo develops its own village kagura. In the early 1800s, Bitchu kagura takes its present form.", ["kotobank", "wiki-bitchu"]],
      ["Early Meiji", "Priests are barred from performing kagura, and villagers take over as dancers. In Iwami, the fast 'hachi-choshi' rhythm spreads.", ["wiki-iwami", "matsue"]],
      ["1976", "Japan begins designating Important Intangible Folk Cultural Properties; Sada Shin-no is among the first.", ["wiki-juyo", "wiki-sada"]],
      ["1978-81", "Takachiho, Bitchu, Tohyama, Tosa and Ise Daikagura are designated.", ["wiki-takachiho", "wiki-bitchu", "iida", "tosa", "wiki-ise"]],
      ["2011", "Sada Shin-no is inscribed on UNESCO's Intangible Cultural Heritage list.", ["wiki-sada"]],
      ["2025", "Kagura is chosen as a candidate for UNESCO's list (nomination planned for 2028).", ["wiki-kagura"]],
    ];
    pages.history = {
      title: `History of Kagura: From Myth to UNESCO | ${SITE_EN}`,
      h1: "A short history of kagura",
      sub: "From a myth in the age of the gods to today",
      desc: "How kagura began and changed: the Amaterasu myth, imperial court rites, noh influence, Meiji reforms and UNESCO.",
      body: () => `
<p>The word 'kagura' is thought to come from 'kamikura', the seat of a god.${cite("kotobank")} Kagura developed in two broad streams: the imperial court's mikagura, and the village kagura (sato-kagura) performed in shrines across Japan.${cite("kotobank")}</p>
<h2>Timeline</h2>
<ol class="flow v" aria-label="Kagura timeline">${items.map(([y, t, c]) => `<li><span class="n" aria-hidden="true">•</span><b>${esc(y)}</b><span class="d">${esc(t)}${cite(...c)}</span></li>`).join("")}</ol>
<p class="meta">Dates before the modern era come from encyclopedias and local records, and the origins of kagura have several theories.</p>
<p><a class="btn" href="/history/" hreflang="ja">Detailed history (Japanese)</a> <a class="btn ghost" href="/en/kagura.html">Kagura styles</a></p>
${sourcesHtml()}`,
    };
  }
  return pages;
}
