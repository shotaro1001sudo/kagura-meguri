// 英語のページ(/en/)の本文。海外からの旅行者向け。
// 事実は、日本語ページ(ガイド・歴史・各神楽の紹介・定期公演)と同じ出典・同じ確認済みの内容だけを使う。
// 種類の解説と定期公演は、日本語の本文を訳したもの(data/kagura-info-en.json・data/regular-en.json。古くなった訳の点検は english-data.mjs)。
// 開催の名前は日本語のまま(公式の表記)。<span lang="ja" translate="no"> に入れ、ブラウザの自動翻訳で崩れないようにする。
// 訳の中の [[日本語]] は、読みを確かめられなかった固有名(推測で読みを書かず、日本語の表記のまま見せる)。

import { SOURCES as GUIDE_SOURCES } from "./guide.mjs";
import { SOURCES as HISTORY_SOURCES } from "./history.mjs";
import { figure, flow, table, icon, stageDiagram } from "./figures.mjs";
import { regularStatus } from "./dates.mjs";
import { infoFresh, regularFresh } from "./english-data.mjs";

export const CHECKED = "2026-11-26"; // ガイド・歴史・トップの出典を確かめた日
export const UPDATED = "2026-11-26"; // 英語ページの中身を最後に変えた日(日程・定期公演・種類のページを加えた)
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

// 神楽の種類の英語名と、英語ページの URL の名前(slug)。日本語の種類名 → 英語名
export const KAGURA_EN = [
  { key: "石見神楽", name: "Iwami Kagura", slug: "iwami-kagura" },
  { key: "高千穂神楽", name: "Takachiho Kagura", slug: "takachiho-kagura" },
  { key: "芸北神楽", name: "Geihoku Kagura", slug: "geihoku-kagura" },
  { key: "十二神祇神楽", name: "Juni Jingi Kagura", slug: "juni-jingi-kagura" },
  { key: "備中神楽", name: "Bitchu Kagura", slug: "bitchu-kagura" },
  { key: "花祭", name: "Hanamatsuri", slug: "hanamatsuri" },
  { key: "遠山の霜月祭", name: "Tohyama Shimotsuki Festival", slug: "tohyama-shimotsuki-festival" },
  { key: "伊勢大神楽", name: "Ise Daikagura", slug: "ise-daikagura" },
  { key: "土佐の神楽", name: "Tosa Kagura", slug: "tosa-kagura" },
  { key: "庄内神楽", name: "Shonai Kagura", slug: "shonai-kagura" },
  { key: "御嶽神楽", name: "Ontake Kagura", slug: "ontake-kagura" },
  { key: "銀鏡神楽", name: "Shiromi Kagura", slug: "shiromi-kagura" },
  { key: "保呂羽山の霜月神楽", name: "Horowasan Shimotsuki Kagura", slug: "horowasan-shimotsuki-kagura" },
  { key: "春日若宮おん祭", name: "Kasuga Wakamiya On-matsuri", slug: "kasuga-wakamiya-onmatsuri" },
  { key: "秩父神楽", name: "Chichibu Kagura", slug: "chichibu-kagura" },
  { key: "鷲宮催馬楽神楽", name: "Washinomiya Saibara Kagura", slug: "washinomiya-saibara-kagura" },
  { key: "相模里神楽", name: "Sagami Sato Kagura", slug: "sagami-sato-kagura" },
  { key: "鎌倉神楽", name: "Kamakura Kagura", slug: "kamakura-kagura" },
  { key: "海南神社面神楽", name: "Kainan Shrine Mask Kagura", slug: "kainan-shrine-mask-kagura" },
  { key: "鶴岡八幡宮の御神楽", name: "Mikagura of Tsurugaoka Hachimangu", slug: "tsurugaoka-hachimangu-mikagura" },
  { key: "早池峰神楽", name: "Hayachine Kagura", slug: "hayachine-kagura" },
  { key: "南部神楽", name: "Nanbu Kagura", slug: "nanbu-kagura" },
  { key: "岩手の神楽", name: "Kagura of Iwate", slug: "iwate-kagura" },
  { key: "青森の神楽", name: "Kagura of Aomori", slug: "aomori-kagura" },
  { key: "出雲神楽", name: "Izumo Kagura", slug: "izumo-kagura" },
  { key: "飯南神楽", name: "Iinan Kagura", slug: "iinan-kagura" },
  { key: "豊前神楽", name: "Buzen Kagura", slug: "buzen-kagura" },
  { key: "豊後神楽", name: "Bungo Kagura", slug: "bungo-kagura" },
  { key: "江戸里神楽", name: "Edo Sato Kagura", slug: "edo-sato-kagura" },
  { key: "都々古別神社の御神楽", name: "Mikagura of Tsutsukowake Shrine", slug: "tsutsukowake-shrine-mikagura" },
  { key: "湯立神楽", name: "Yudate Kagura", slug: "yudate-kagura" },
  { key: "番楽", name: "Bangaku", slug: "bangaku" },
  { key: "椎葉神楽", name: "Shiiba Kagura", slug: "shiiba-kagura" },
  { key: "巫女神楽", name: "Miko Kagura", slug: "miko-kagura" },
  { key: "平戸神楽", name: "Hirado Kagura", slug: "hirado-kagura" },
];

const kEntry = (jp) => KAGURA_EN.find((k) => k.key === jp);
const kName = (jp) => kEntry(jp)?.name;
/** 種類の英語ページの URL */
export const enStylePath = (jp) => (kEntry(jp) ? `/en/kagura/${kEntry(jp).slug}.html` : null);

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
    return `<li id="src-${i + 1}"><a href="${s.url}" rel="noopener" target="_blank" lang="ja" translate="no">${esc(s.name)}</a> (<span lang="ja" translate="no">${esc(s.by)}</span>; Japanese) <a class="back" href="#ref-${i + 1}" aria-label="Back to source ${i + 1}">↩</a></li>`;
  }).join("")}</ol><p class="meta">Last checked: ${CHECKED}. This page summarises the sources above. Dates, venues and rules can change, so always check with the organiser before you go.</p>`;
  return { cite, sourcesHtml };
}

const ja = (s, esc) => `<span lang="ja" translate="no">${esc(s)}</span>`;
/** 訳の本文: [[日本語]] を、日本語の表記として見せる */
export const enText = (s, esc) => esc(s).replace(/\[\[([^\]]+)\]\]/g, (_, j) => `<span lang="ja" translate="no">${j}</span>`);
const utc = (s) => new Date(`${s.slice(0, 10)}T00:00:00Z`);
const fmtDate = (s) => utc(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const fmtDay = (s) => utc(s).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const fmtDayY = (s) => utc(s).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const fmtMonth = (ym) => utc(`${ym}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const fmtMd = (md) => utc(`2000-${md}`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
/** 開催の日付(複数日なら「Sat, Dec 5 - Sun, Dec 6」) */
const dateText = (e, withYear = false) => {
  const a = e.start.slice(0, 10), b = (e.end || "").slice(0, 10);
  const f = withYear ? fmtDayY : fmtDay;
  return b && b !== a ? `${fmtDay(a)} - ${f(b)}` : f(a);
};
/** 開催の時刻(分からなければ TBA。日をまたぐ開催は始まりだけ) */
const timeText = (e) => {
  if (e.timeUnknown) return "TBA";
  const t = (s) => (s && s.length > 10 ? s.slice(11, 16) : "");
  const a = t(e.start), b = e.end && e.end.slice(0, 10) === e.start.slice(0, 10) ? t(e.end) : "";
  if (!a) return "See details";
  return b && b !== a ? `${a}-${b}` : e.end && e.end.slice(0, 10) !== e.start.slice(0, 10) ? `From ${a}` : a;
};
/** 年の範囲(「2026」「2026-27」) */
export const yearsText = (list) => {
  const ys = [...new Set(list.map((e) => e.start.slice(0, 4)))].sort();
  if (!ys.length) return "";
  return ys.length === 1 ? ys[0] : +ys.at(-1) === +ys[0] + 1 ? `${ys[0]}-${ys.at(-1).slice(2)}` : `${ys[0]}-${ys.at(-1)}`;
};
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** 題: 候補のうち、サイト名を付けて60字以内に入る最初のもの */
const fitTitle = (cands) => `${cands.find((c) => `${c} | ${SITE_EN}`.length <= 60) ?? cands.at(-1)} | ${SITE_EN}`;
/** 説明文: 文を順に足し、160字以内に収める(文は、言い方の候補の配列でもよい。入る最初の候補を使い、どれも入らなければ飛ばす) */
const fitDesc = (parts) => parts.filter(Boolean).reduce((out, p) => {
  const fit = [p].flat().filter(Boolean).map((x) => (out ? `${out} ${x}` : x)).find((x) => x.length <= 160);
  return fit ?? out;
}, "");
const fmtMonthShort = (ym) => utc(`${ym}-01`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/**
 * @param {object} x
 * @param {(s:string)=>string} x.esc
 * @param {Array} x.upcoming これからの開催(日付順)
 * @param {Array} x.regular 続いている定期公演
 * @param {(k:string)=>string|null} x.kaguraHref 日本語の神楽の種類ページの URL(なければ null)
 * @param {{key:string, prefs:string[], indexed:boolean}[]} x.styles サイトに載っている神楽の種類(日本語の「種類で探す」と同じ順番)
 * @param {object} x.infoJa data/kagura-info.json
 * @param {object} x.infoEn data/kagura-info-en.json
 * @param {object} x.regularEn data/regular-en.json
 * @param {string} x.today 日本時間の今日(YYYY-MM-DD)
 * 返り値: ページの一覧 [{ key, path, ja, crumbs, title, h1, sub, desc, body, modified, noindex, type }]
 */
export function englishPages({ esc, upcoming, regular = [], kaguraHref, styles: styleList = [], infoJa = {}, infoEn = {}, regularEn = {}, prefInfo = {}, today }) {
  // 英語のページがある種類: サイトに種類のページがあり、訳がある種類
  const styles = styleList.map((x) => ({ ...x, en: kName(x.key), href: kaguraHref(x.key), tr: infoEn[x.key], path: infoEn[x.key] && enStylePath(x.key) })).filter((x) => x.href);
  const pageOf = (k) => styles.find((s) => s.key === k && s.path);
  const styleLink = (k) => (pageOf(k) ? `<a href="${pageOf(k).path}">${esc(kName(k))}</a>` : esc(kName(k) ?? "Kagura"));
  const evLink = (e) => `<a href="/events/${e.id}.html" hreflang="ja" lang="ja" translate="no">${esc(e.name)}</a>`;
  const prefEn = (p) => PREF_EN[p] ?? "";
  const regTr = (r) => (regularFresh(r, regularEn[r.id]) ? regularEn[r.id] : null);
  const nextText = (r) => {
    const { next, paused } = regularStatus(r, today);
    return next ? `${paused ? "On a break. Next: " : ""}${fmtDayY(next)}` : "No dates announced";
  };
  const regAnchor = (r) => `/en/regular-shows.html#${r.id}`;
  const pages = [];

  // ---------- Home ----------
  {
    const { cite, sourcesHtml } = makeCiter(esc);
    const picks = [];
    const seen = new Set();
    for (const e of upcoming) { if (!seen.has(e.kagura) && picks.length < 8) { seen.add(e.kagura); picks.push(e); } }
    pages.push({
      key: "index", path: "/en/", ja: "/", crumbs: [["Home"]], modified: UPDATED,
      title: `Kagura: Japan's Sacred Dance Theatre | ${SITE_EN}`,
      h1: "Kagura: Japan's sacred dance theatre",
      sub: "Find a performance, plan your visit and know what to expect.",
      desc: "Kagura is Japan's ancient Shinto dance theatre. Find upcoming performances and regular shows, explore regional styles and read our guide for first-timers.",
      body: () => `
<p>Kagura is music and dance performed as an offering to the gods at Shinto shrines. Masked dancers bring Japanese myths to life to the beat of drums, flutes and gongs. Japan has more than 4,000 kagura traditions, and many are still kept alive by local people in village shrines, theatres and festivals.${cite("kyogikai")}</p>
<p>This site lists kagura performances from all over Japan. The calendar, the regular shows and the guides to each style are in English. The event pages are in Japanese, but your browser can translate them for you (see the <a href="/en/guide.html">first-timer's guide</a>).</p>
<p><a class="btn" href="/en/calendar.html">Performance calendar</a> <a class="btn ghost" href="/en/kagura.html">Kagura styles</a> <a class="btn ghost" href="/en/guide.html">First-timer's guide</a></p>

<h2>Why see kagura?</h2>
<div class="gcards">
<section class="gcard"><h3>${icon("eye")}Close to the stage</h3><p>Many performances take place in small shrines and halls. Visitors are welcomed as part of the community, and you are often just a few steps from the dancers.${cite("jta")}</p></section>
<section class="gcard"><h3>${icon("calendar")}Easy to follow</h3><p>Most plays are based on myths and folk tales, with clear-cut heroes and monsters. The costumes and masks tell you who's who, and some shows feature lightning-fast costume changes and fire-breathing serpents.${cite("hiroshima", "akitakata-koho")}</p></section>
<section class="gcard"><h3>${icon("car")}Different in every region</h3><p>The rhythm, costumes and plays change from one valley to the next, and travelling to see different styles is half the fun.</p></section>
</div>

<h2>Upcoming performances</h2>
<p class="meta">A selection of upcoming performances, one for each style. Event names and details are in Japanese.</p>
<div class="tblwrap" role="region" aria-label="Upcoming performances" tabindex="0"><table class="tbl cmp"><thead><tr><th scope="col">Date</th><th scope="col">Style</th><th scope="col">Event</th><th scope="col">Where</th></tr></thead><tbody>
${picks.map((e) => `<tr><th scope="row">${fmtDate(e.start)}</th><td data-k="Style">${styleLink(e.kagura)}</td><td data-k="Event">${evLink(e)}</td><td data-k="Where">${esc(prefEn(e.prefecture))}</td></tr>`).join("")}
</tbody></table></div>
<p><a class="btn" href="/en/calendar.html">All upcoming performances</a> <a class="btn ghost" href="/en/regular-shows.html">Regular shows</a> <a class="btn ghost" href="/map.html" hreflang="ja">Map (Japanese)</a></p>

<h2>Where to see kagura</h2>
<p>Kagura is performed at shrine festivals, in community halls and on theatre stages all over Japan. Some venues hold regular shows on fixed days, which makes them easy to plan around; festival performances take place on set dates, often at night.</p>
<p>To find what is on near you or along your route, use the calendar, the list of regular shows or the guides to each kagura style. The map is in Japanese, but your browser can translate it.</p>
<p><a class="btn" href="/en/calendar.html">Calendar</a> <a class="btn ghost" href="/en/regular-shows.html">Regular shows</a> <a class="btn ghost" href="/en/kagura.html">All kagura styles</a></p>
${sourcesHtml()}`,
    });
  }

  // ---------- Guide ----------
  {
    const { cite, sourcesHtml } = makeCiter(esc);
    pages.push({
      key: "guide", path: "/en/guide.html", ja: "/guide.html", modified: UPDATED,
      title: `Kagura Guide for First-Timers | ${SITE_EN}`,
      h1: "Kagura guide for first-timers",
      sub: "Getting there, etiquette and what to bring",
      desc: "How to find, get to and enjoy kagura in Japan: booking, transport, etiquette, photography, offerings and what to bring, for visitors from abroad.",
      body: () => `
<p>Kagura is performed in shrines, community halls and theatres all over Japan. This page covers the practical side for visitors from abroad: how to find a performance, how to get there, how to behave and what to bring.</p>
<nav class="toc" id="toc" aria-label="Contents"><ol><li><a href="#find">How to find a performance</a></li><li><a href="#types">Shrine festival or theatre?</a></li><li><a href="#stage">Reading the stage</a></li><li><a href="#getting">Getting there and booking</a></li><li><a href="#etiquette">Etiquette</a></li><li><a href="#bring">What to bring</a></li></ol></nav>

<h2 id="find">How to find a performance</h2>
${figure(flow([
  { t: `${icon("calendar")}Search`, d: "Use this site's English calendar and list of regular shows, or the map and 'This weekend' pages (in Japanese)" },
  { t: `${icon("eye")}Translate`, d: "Event pages are in Japanese. Turn on your browser's translation (Chrome, Edge, Safari)" },
  { t: `${icon("phone")}Check`, d: "Dates, venues and prices can change, so follow the official link on each page" },
  { t: `${icon("car")}Plan`, d: "Many venues are rural and shows go on late, so plan your last train, bus or taxi" },
], "Steps to find a performance", "h"), "Four simple steps to finding and planning a visit. The event pages are in Japanese, but your browser can translate them.")}
<p><a class="btn" href="/en/calendar.html">Calendar</a> <a class="btn ghost" href="/en/regular-shows.html">Regular shows</a> <a class="btn ghost" href="/map.html" hreflang="ja">Map (Japanese)</a> <a class="btn ghost" href="/weekend.html" hreflang="ja">This weekend (Japanese)</a></p>

<h2 id="types">Shrine festival or theatre?</h2>
${table(["", "Shrine festival or all-night kagura", "Theatre or festival stage"], [
  ["What it is", `An offering to the local deity, often held at night (sometimes all night long) in a shrine, a private home or a community hall.${cite("takachiho")}`, `A performance staged for an audience, often with an MC or a printed synopsis of the story.${cite("akitakata")}`],
  ["Atmosphere", "Ritual and community. You are a guest of the village.", "Relaxed. Some people eat, drink and cheer during the show."],
  ["Planning", "Dates and venues can change from year to year, so contact the local tourist office about two weeks in advance.", "Fixed dates. Some shows require a reservation."],
], "Shrine festival or theatre", "chk")}

<h2 id="stage">Reading the stage</h2>
${figure(stageDiagram("en"), "An example of how a kagura stage is laid out; every venue is different. The music (hayashi) is played on drums, a hand gong and flute, and follows the movements of the dancers.")}

<h2 id="getting">Getting there and booking</h2>
<ul>
<li>Shrine kagura often takes place at night, so a taxi or car is recommended. Shrines in town often have little or no parking.${cite("iwamiqa")}</li>
<li>Some shows require a reservation. Online booking may open weeks in advance, and some venues keep a limited number of tickets for sale at the door on the day.${cite("takachiho")}</li>
<li>Village kagura schedules can change from year to year. Check with the local tourist association about two weeks before you go.</li>
<li>Some regular shows require advance tickets, so check the official page for each event. The <a href="/en/regular-shows.html">list of regular shows</a> gives the booking rules for each venue.</li>
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
    });
  }

  // 広島県の神楽の分け方(data/pref-info.json の 広島県.en)。以前の「Hiroshima Kagura」のページの代わりに、種類の一覧の中で、誰の分け方かを書いて紹介する(2026-11-26)
  const hiroshimaGroups = () => {
    const g = prefInfo["広島県"], t = g?.en;
    if (!t?.groups?.length) return "";
    const refs = (g.refs ?? []).filter((r) => r?.url);
    return `<h2 id="hiroshima">${esc(t.title)}</h2><p>${esc(t.lead)}</p>${table(["Group", "Area", "In brief"], t.groups.map((x, i) => {
      const kind = g.groups?.[i]?.kind, pg = kind && pageOf(kind);
      return [(pg ? `<a href="${pg.path}">${esc(x.name)}</a>` : esc(x.name)) + (x.alias ? ` <small>${esc(x.alias)}</small>` : ""), esc(x.area), esc(x.text)];
    }), "Kagura in Hiroshima Prefecture", "chk")}<p>${esc(t.note)}</p>${refs.length ? `<p class="meta">Sources (Japanese): ${refs.map((r) => `<a href="${esc(r.url)}" rel="noopener" target="_blank" lang="ja" translate="no">${esc(r.name)}</a>`).join(" / ")}. Checked: ${esc(g.checked ?? "")}.</p>` : ""}`;
  };

  // ---------- Kagura styles ----------
  // 特定の神楽を取り上げないよう、サイトに載っているすべての種類を、日本語の「種類で探す」と同じ順番・同じ扱い(名前・一言・県・リンク)で並べる
  {
    const { cite, sourcesHtml } = makeCiter(esc);
    pages.push({
      key: "kagura", path: "/en/kagura.html", ja: "/kagura/",
      title: `Kagura Styles in Japan: Every Regional Style | ${SITE_EN}`,
      h1: "Kagura styles",
      sub: "Every kagura featured on this site, listed equally",
      desc: "The main lineages of kagura, plus every kagura style featured on this site, with English guides to upcoming dates, history, main plays and viewing tips.",
      modified: UPDATED,
      body: () => `
<p>Kagura takes many forms. The music, costumes and plays differ from region to region, and often from one village to the next.</p>
<h2>The main lineages</h2>
<p>Kagura is broadly divided into mikagura, performed at the imperial court, and sato-kagura, performed at shrines and in communities throughout Japan. Sato-kagura is usually grouped into four lineages, following the classification of the folklorist Honda Yasuji (1906-2001). This is one way of organising them; other researchers divide and name them differently.${cite("kb-minzokugeino", "kotobank")}</p>
${table(["Lineage", "Characteristics"], [
  ["Miko kagura", "Based on rites of possession, oracles and the calming of spirits performed by priests and shrine maidens."],
  ["Izumo style", "Typified by the Shichiza rites and shinno plays of Sada Shrine in Shimane, combining dances with ritual objects and myth plays."],
  ["Ise style", "Derived from the hot-water (yudate) kagura of Ise Shrine, in which water is boiled in a cauldron before the gods."],
  ["Shishi kagura", "Lion dances that use the power of the lion's head to drive away evil, prevent fires and pray for good health."],
], "The main lineages of kagura", "chk")}

<h2>All styles on this site</h2>
<p class="meta">Listed in the same order as the Japanese "browse by style" page, from north to south. The names are of different kinds: some are regional names, some are the names of festivals, and some are forms of dance. Each page begins by saying what its name refers to. Each name opens an English guide with upcoming dates, history and main plays. The Japanese page has the full listings.</p>
${table(["Style", "In a word", "Prefecture", "Japanese page"], styles.map((k) => [
  (k.path ? `<a href="${k.path}">${esc(k.en)}</a>` : k.en ? esc(k.en) : ja(k.key, esc)) + (k.en ? ` <small lang="ja" translate="no">${esc(k.key)}</small>` : ""),
  k.tr ? esc(k.tr.tagline) : "",
  esc(k.prefs.map((x) => PREF_EN[x] || x).join(", ")),
  `<a href="${k.href}" hreflang="ja">Dates (Japanese)</a>`,
]), "All kagura styles on this site", "styles")}
${hiroshimaGroups()}
<p><a class="btn" href="/en/calendar.html">Performance calendar</a> <a class="btn ghost" href="/en/guide.html">First-timer's guide</a> <a class="btn ghost" href="/kagura/" hreflang="ja">Browse by style (Japanese)</a></p>
${sourcesHtml()}`,
    });
  }

  // ---------- History ----------
  {
    const { cite, sourcesHtml } = makeCiter(esc);
    const items = [
      ["Myth", "The sun goddess Amaterasu hides in a cave, and the world is plunged into darkness. The goddess Ame-no-Uzume dances, the gods laugh, and light returns. This story is told as the origin of kagura.", ["kojiki-iwaya2", "kotobank"]],
      ["807", "The word 'kagura' appears in writing for the first time (in the Kogo Shui).", ["kotobank"]],
      ["1002", "The imperial court's kagura ceremony begins (some sources say 1005). It later becomes an annual event held every December.", ["kotobank"]],
      ["1608", "At Sada Shrine, priests are said to have created 'shinno', kagura plays modelled on noh theatre.", ["matsue-sada"]],
      ["Edo period", "Ise's 'daidai kagura' spreads across the country, and Edo (now Tokyo) develops its own village kagura.", ["kotobank"]],
      ["Meiji era", "The government bans priests from performing kagura, and ordinary people also come to perform it.", ["jh-iwami", "matsue", "kotobank"]],
      ["1976", "Sada Shinno and other traditions are designated Important Intangible Folk Cultural Properties, and kagura from many regions come under national protection.", ["mext-120", "bunka-sada"]],
      ["2025", "Kagura is selected as Japan's new candidate for UNESCO's list. The decision is expected around December 2028.", ["bunka-unesco-r7"]],
    ];
    pages.push({
      key: "history", path: "/en/history.html", ja: "/history/",
      title: `History of Kagura: From Myth to UNESCO | ${SITE_EN}`,
      h1: "A short history of kagura",
      sub: "From the age of the gods to the present day",
      desc: "How kagura began and changed: the Amaterasu myth, imperial court rites, the influence of noh, the Meiji reforms and the road to UNESCO.",
      modified: CHECKED,
      body: () => `
<p>The word 'kagura' is generally thought to come from 'kamikura', meaning a seat for the gods.${cite("kotobank")} Kagura developed along two broad lines: mikagura, performed at the imperial court, and sato-kagura, the village kagura performed at shrines throughout Japan.${cite("kotobank")}</p>
<h2>Timeline</h2>
<ol class="flow v" aria-label="Kagura timeline">${items.map(([y, t, c]) => `<li><span class="n" aria-hidden="true">•</span><b>${esc(y)}</b><span class="d">${esc(t)}${cite(...c)}</span></li>`).join("")}</ol>
<p class="meta">Dates before the modern era are based on encyclopedias and local records, and there are several theories about the origins of kagura.</p>
<p><a class="btn" href="/history/" hreflang="ja">Detailed history (Japanese)</a> <a class="btn ghost" href="/en/kagura.html">Kagura styles</a></p>
${sourcesHtml()}`,
    });
  }

  // ---------- Calendar ----------
  // これからの開催を、月ごとの表で。種類の名前は英語ページへ、開催の名前は日本語の開催ページへ
  {
    const months = [...new Set(upcoming.map((e) => e.start.slice(0, 7)))].sort();
    const years = yearsText(upcoming);
    const prefs = [...new Set(upcoming.map((e) => prefEn(e.prefecture)).filter(Boolean))];
    const row = (e) => [esc(dateText(e)), esc(timeText(e)), styleLink(e.kagura), evLink(e), esc(prefEn(e.prefecture))];
    pages.push({
      key: "calendar", path: "/en/calendar.html", ja: "/calendar.html", crumbs: [["Home", "/en/"], ["Calendar"]],
      title: fitTitle([`Kagura Performance Calendar ${years}`, "Kagura Performance Calendar"]),
      h1: "Kagura performance calendar",
      sub: upcoming.length ? `${plural(upcoming.length, "upcoming performance")} across Japan, month by month` : "Upcoming kagura performances across Japan",
      desc: fitDesc([`Upcoming kagura performances in Japan, month by month: ${plural(upcoming.length, "date")} with start times, styles and prefectures.`, "Each links to the event page and the official information.", "Updated daily."]),
      modified: today, type: "CollectionPage",
      body: () => `
<p>Every upcoming kagura performance listed on this site, in date order. Event names are shown in Japanese, as on the official pages. Click a name to open the event page (in Japanese) with the venue, prices and the official link; your browser can translate it. Click a style to read about it in English.</p>
${months.length > 1 ? `<nav class="chiprow en-months" aria-label="Jump to a month">${months.map((m) => `<a class="chip" href="#m-${m}">${esc(fmtMonth(m))}</a>`).join("")}</nav>` : ""}
${months.length ? months.map((m) => `<h2 id="m-${m}">${esc(fmtMonth(m))}</h2>${table(["Date", "Time", "Style", "Event", "Where"], upcoming.filter((e) => e.start.slice(0, 7) === m).map(row), `Kagura performances in ${fmtMonth(m)}`, "en-cal")}`).join("") : "<p>No upcoming performances are listed at the moment.</p>"}
${prefs.length ? `<p class="meta">Prefectures in this calendar: ${esc(prefs.join(", "))}.</p>` : ""}
${regular.length ? `<h2 id="regular">Regular shows</h2>
<p>Some venues stage kagura every week or every night. These shows are not in the calendar above.</p>
${table(["Show", "Style", "When", "Next"], regular.map((r) => [regTr(r) ? `<a href="${regAnchor(r)}">${esc(regTr(r).name)}</a>` : `<a href="${regAnchor(r)}" lang="ja" translate="no">${esc(r.name)}</a>`, styleLink(r.kagura), regTr(r) ? esc(regTr(r).schedule) : `<a href="/regular/${r.id}.html" hreflang="ja">See the Japanese page</a>`, esc(nextText(r))]), "Regular kagura shows", "en-reg")}` : ""}
<p><a class="btn" href="/en/regular-shows.html">Regular shows in detail</a> <a class="btn ghost" href="/calendar.html" hreflang="ja">Search in Japanese</a> <a class="btn ghost" href="/map.html" hreflang="ja">Map (Japanese)</a></p>
<p class="meta">Updated: ${today}. Dates and times can change, and some events may be cancelled because of the weather. Always check the official information before you go.</p>`,
    });
  }

  // ---------- Regular shows ----------
  {
    const card = (r) => {
      const t = regTr(r);
      const rows = t ? [
        ["Style", styleLink(r.kagura)],
        ["Where", `${esc(t.venue)}, ${esc(t.place)}`],
        ["When", esc(t.schedule)],
        t.season && ["Season", esc(t.season)],
        (t.closed || r.closedDates?.length) && ["No show on", t.closed ? esc(t.closed) : esc(r.closedDates.map(fmtMd).join(", "))],
        ["Next show", esc(nextText(r))],
        ["Admission", esc(t.fee)],
        t.booking && ["Booking", esc(t.booking)],
      ].filter(Boolean) : [["Style", styleLink(r.kagura)], ["Next show", esc(nextText(r))]];
      const prog = t && Array.isArray(r.program) ? r.program.filter((p) => p.date >= today).slice(0, 8) : [];
      return `<section class="en-show" id="${esc(r.id)}" aria-labelledby="h-${esc(r.id)}"><h2 id="h-${esc(r.id)}">${t ? esc(t.name) : `<span lang="ja" translate="no">${esc(r.name)}</span>`}</h2>
${t ? `<p class="meta">Japanese name: ${ja(r.name, esc)}</p>` : `<p>Our English summary of this show is being updated. See the Japanese page for the latest details.</p>`}
<table class="info en-info"><tbody>${rows.map(([h, d]) => `<tr><th scope="row">${h}</th><td>${d}</td></tr>`).join("")}</tbody></table>
${t ? `<p>${esc(t.description)}</p>` : ""}
${t?.steps ? `<h3>How to get in</h3>${t.stepsLead ? `<p>${esc(t.stepsLead)}</p>` : ""}<ol class="en-steps">${t.steps.map((s) => `<li><b>${esc(s.t)}</b> ${esc(s.d)}</li>`).join("")}</ol>` : ""}
${prog.length ? `<h3>Next performances</h3>${table(["Date", "Time", "Hall", "Troupe"], prog.map((p) => [esc(fmtDayY(p.date)), esc((p.time.match(/\d{1,2}:\d{2}/g) ?? []).join(" and ") || "See details"), esc(t.halls?.[p.hall] ?? p.hall), ja(p.troupe, esc)]), `Next performances: ${t.name}`, "en-prog")}${t.programNote ? `<p class="meta">${esc(t.programNote)}</p>` : ""}` : ""}
<p><a class="btn ghost" href="/regular/${esc(r.id)}.html" hreflang="ja">Details in Japanese</a> <a class="btn ghost" href="${esc(r.url)}" rel="noopener" target="_blank" hreflang="ja">Official website (Japanese)</a></p>
<p class="meta">Source: ${ja(r.source ?? "", esc)}. Checked: ${esc(r.checked ?? "")}.</p></section>`;
    };
    pages.push({
      key: "regular", path: "/en/regular-shows.html", ja: null, crumbs: [["Home", "/en/"], ["Calendar", "/en/calendar.html"], ["Regular shows"]],
      title: fitTitle(["Regular Kagura Shows: Weekly and Nightly", "Regular Kagura Shows"]),
      h1: "Regular kagura shows",
      sub: "Kagura you can see every week or every night",
      desc: fitDesc([`${plural(regular.length, "venue")} in Japan that stage kagura on fixed days, every week or every night.`, "Times, admission, how to book and the next show date for each, in English."]),
      modified: today, type: "CollectionPage",
      body: () => `
<p>Some venues stage kagura on fixed days, every week or even every night. They are the easiest way to fit kagura into a trip. Here is each regular show on this site, with its times, admission and booking rules.</p>
<nav class="toc" aria-label="Shows on this page"><ol>${regular.map((r) => `<li><a href="#${esc(r.id)}">${regTr(r) ? esc(regTr(r).name) : ja(r.name, esc)}</a></li>`).join("")}</ol></nav>
${regular.map(card).join("")}
<p><a class="btn" href="/en/calendar.html">Performance calendar</a> <a class="btn ghost" href="/en/guide.html">First-timer's guide</a></p>
<p class="meta">Translated from our Japanese pages, which are based on each venue's official information. Shows can be cancelled or changed, so always check the official website before you go.</p>`,
    });
  }

  // ---------- 種類ごとのページ ----------
  for (const s of styles.filter((x) => x.path)) {
    const k = s.key, t = s.tr, jaInfo = infoJa[k] ?? {}, name = s.en;
    const list = upcoming.filter((e) => e.kagura === k), regs = regular.filter((r) => r.kagura === k);
    const years = yearsText(list);
    const where = s.prefs.map(prefEn).filter(Boolean);
    const ul = (xs) => `<ul>${xs.map((x) => `<li>${enText(x, esc)}</li>`).join("")}</ul>`;
    const sections = [
      ["dates", "Dates", "Upcoming performances"],
      t.intro && ["about", "About", `About ${name}`],
      t.history?.length && ["history", "History", "History"],
      t.features?.length && ["features", "Highlights", "Highlights"],
      t.programs?.length && ["plays", "Main plays", "Main plays"],
      t.viewing?.length && ["tips", "Tips", "Tips for watching"],
      ["sources", "Sources", "Sources"],
    ].filter(Boolean);
    const h2 = (id) => { const x = sections.find((y) => y[0] === id); return `<h2 id="${id}">${esc(x[2])}</h2>`; };
    const datesHtml = `${h2("dates")}${list.length ? table(["Date", "Time", "Event", "Where"], list.map((e) => [esc(dateText(e, true)), esc(timeText(e)), evLink(e), esc(prefEn(e.prefecture))]), `Upcoming performances of ${name}`, "en-cal") : regs.length ? "" : `<p>No performances are listed at the moment. Past dates and news are on the <a href="${s.href}" hreflang="ja">Japanese page</a>.</p>`}
${regs.length ? `<h3>Regular shows</h3><ul class="en-reglist">${regs.map((r) => `<li><a href="${regAnchor(r)}">${regTr(r) ? esc(regTr(r).name) : ja(r.name, esc)}</a>${regTr(r) ? `: ${esc(regTr(r).schedule)}` : ""}. <span class="meta">Next: ${esc(nextText(r))}</span></li>`).join("")}</ul>` : ""}
<p><a class="btn ghost" href="${s.href}" hreflang="ja">All dates (Japanese)</a> <a class="btn ghost" href="/en/calendar.html">Full calendar</a></p>`;
    const fresh = infoFresh(jaInfo, t); // 日本語の演目名を添えるのは、訳が今の日本語と合っているときだけ(演目の数や順番が変わっていることがある)
    const plays = (t.programs ?? []).map((p, i) => `<dt>${enText(p.name, esc)}${fresh && jaInfo.programs?.[i]?.name ? ` <small lang="ja" translate="no">${esc(jaInfo.programs[i].name)}</small>` : ""}</dt><dd>${enText(p.text, esc)}</dd>`).join("");
    const refs = (jaInfo.refs ?? []).filter((r) => r?.url);
    pages.push({
      key: `style:${k}`, path: s.path, ja: s.href, crumbs: [["Home", "/en/"], ["Kagura styles", "/en/kagura.html"], [name]],
      title: fitTitle(years ? [`${name}: ${years} Schedule and Guide`, `${name} ${years}: Dates and Guide`, `${name} ${years} Schedule`, `${name} Schedule and Guide`, `${name} Guide`, name] : [`${name}: Dates, History and Guide`, `${name}: Guide and Dates`, `${name} Guide`, name]),
      h1: name,
      sub: t.tagline,
      // 説明文: 名前と一言 → 開催の数と県(地元の県ではなく、開催のある県) → 解説の中身
      desc: fitDesc([
        `${name}: ${t.tagline.replace(/[.!]$/, "")}.`.length <= 120 ? `${name}: ${t.tagline.replace(/[.!]$/, "")}.` : `${name}, explained in English.`,
        list.length ? [
          `Upcoming: ${plural(list.length, "date")}${where.length ? ` in ${where.join(", ")}` : ""} from ${fmtMonthShort(list[0].start.slice(0, 7))}${regs.length ? `, plus ${plural(regs.length, "regular show")}` : ""}.`,
          `Upcoming: ${plural(list.length, "date")} from ${fmtMonthShort(list[0].start.slice(0, 7))}${regs.length ? `, plus ${plural(regs.length, "regular show")}` : ""}.`,
          `Upcoming: ${plural(list.length, "date")}${regs.length ? ` and ${plural(regs.length, "regular show")}` : ""}.`,
        ] : regs.length ? `${plural(regs.length, "regular show")} with times and booking.` : "",
        "History, main plays and viewing tips.",
      ]),
      modified: [t.checked, ...list.map((e) => e.checked), ...regs.map((r) => r.checked)].filter(Boolean).sort().at(-1),
      noindex: !s.indexed,
      about: { "@type": "Thing", name, alternateName: k },
      body: () => `
<p class="meta">Japanese name: ${ja(k, esc)} · Area: ${esc(t.area)}</p>
<nav class="chiprow en-jump" aria-label="On this page">${sections.map(([id, label]) => `<a class="chip" href="#${id}">${esc(label)}</a>`).join("")}</nav>
${datesHtml}
${t.intro ? `${h2("about")}${t.naming ? `<p>${enText(t.naming, esc)}</p>` : ""}<p>${enText(t.intro, esc)}</p>` : ""}
${t.history?.length ? `${h2("history")}${ul(t.history)}` : ""}
${t.features?.length ? `${h2("features")}${ul(t.features)}` : ""}
${t.programs?.length ? `${h2("plays")}<dl class="en-plays">${plays}</dl>` : ""}
${t.viewing?.length ? `${h2("tips")}${ul(t.viewing)}` : ""}
${(t.sections ?? []).map((x) => `<h2 id="${esc(x.id)}">${esc(x.title)}</h2>${(x.paras ?? []).map((p) => `<p>${enText(p, esc)}</p>`).join("")}`).join("")}
${h2("sources")}<p>This page is an English translation of our <a href="${s.href}" hreflang="ja">Japanese page about ${esc(name)}</a>. It is based on the sources below (in Japanese).</p>
<ul class="sources">${jaInfo.source ? `<li>${ja(jaInfo.source, esc)}</li>` : ""}${refs.map((r) => `<li><a href="${esc(r.url)}" rel="noopener" target="_blank" lang="ja" translate="no">${esc(r.name)}</a></li>`).join("")}</ul>
<p class="meta">Translation checked: ${esc(t.checked)}.${fresh ? "" : " The Japanese page has been updated since then; it has the latest information."} Dates, venues and prices can change, so always check the official information before you go.</p>
<p><a class="btn" href="/en/kagura.html">All kagura styles</a> <a class="btn ghost" href="/en/guide.html">First-timer's guide</a></p>`,
    });
  }
  return pages;
}
