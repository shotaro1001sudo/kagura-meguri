// アダプタ: 観光三重(三重県観光連盟)のイベント検索「神楽」の結果から、神楽の催しを取り出す。
// 一覧(検索結果)には会場がないため、名称に「神楽」を含む催しだけ、詳細ページ(/event/数字)を読む。
// 詳細ページの「詳細情報」の欄(開催期間・会場・住所)だけを使う。紹介文・写真は使わない。
// 方針(分からないものは推測しない):
//  - 年が書かれていない開催期間(「毎年12月01日」など)は読まない
//  - 御祈祷・厄除・初詣など、観覧の公演ではない催しは除く
//  - 時刻は欄にないため、時間未定として取り込む(人が確かめて書き足す)
import * as cheerio from "cheerio";

export const EXCLUDE = /祈祷|祈願|厄除|厄祓|初詣|初神楽|節分|展示|企画展|特別展/;
const DETAIL = /^\/event\/\d+$/;
const pad = (n) => String(n).padStart(2, "0");
const norm = (s) => String(s ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();

// 一覧から、名称に「神楽」を含む詳細ページだけを拾う(最大12件)
export function discover(html, source, pageUrl = source.url) {
  const $ = cheerio.load(html);
  const base = new URL(source.url);
  const links = new Set();
  $("a.card[href]").each((_, a) => {
    const title = norm($(a).find(".card-text.fw-bold").first().text());
    if (!/神楽/.test(title) || EXCLUDE.test(title)) return;
    const u = new URL($(a).attr("href"), pageUrl);
    if (u.origin === base.origin && DETAIL.test(u.pathname)) links.add(u.href);
  });
  if (!links.size) throw new Error("観光三重の検索結果に、名称に「神楽」を含む催しがありません(構造が変わったか、掲載がない)");
  return [...links].slice(0, 12);
}

function field($, label) {
  let v = "";
  $("div.fw-bold").each((_, el) => {
    if (!v && norm($(el).text()) === label) v = norm($(el).next().text());
  });
  return v;
}

export function parse(html, source, pageUrl = source.url) {
  if (!DETAIL.test(new URL(pageUrl).pathname)) return []; // 一覧ページそのものからは取らない
  const $ = cheerio.load(html);
  // 名称は <title> の「名称 | イベント | 観光三重」の先頭(見出し h1 には読み仮名が付くため使わない)
  const name = norm($("title").text().split("|")[0]);
  if (!/神楽/.test(name) || EXCLUDE.test(name)) return [];
  const period = field($, "開催期間");
  const d = [...period.matchAll(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/g)];
  if (!d.length) return [];
  const day = (m) => `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  const venue = field($, "会場");
  const address = field($, "住所").replace(/^三重県/, "");
  if (!venue || !address || /^(北海道|東京都|大阪府|京都府|.{2,3}県)/.test(address)) return []; // 県外は扱わない
  const cm = address.match(/^((?:[^\s]{1,4}郡)?[^\s]{1,5}?[市町村])/);
  if (!cm) return [];
  const kagura = /伊勢大神楽/.test(name) ? "伊勢大神楽" : (name.match(/([一-龥々ヶァ-ヴー]{1,8}神楽)/)?.[1] ?? "");
  // 複数の日付が並ぶ欄(「御渡祭:12月12日、例大祭:12月20日」など)は、どの日に神楽があるか分からないので読まない
  if (d.length > 1 && !/[〜~～-]/.test(period)) return [];
  return [{
    name,
    kagura,
    start: `${day(d[0])}T00:00`,
    ...(d.length > 1 && day(d[1]) !== day(d[0]) ? { end: `${day(d[1])}T23:59` } : {}),
    timeUnknown: true,
    venue,
    address,
    prefecture: "三重県",
    city: cm[1],
    url: pageUrl,
  }];
}
