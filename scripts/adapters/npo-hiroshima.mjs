// アダプタ: NPO広島神楽芸術研究所「神楽日程表」(sche14.cgi)。ページは Shift_JIS で、月ごとに分かれている。
// 1件ごとに「<a name="番号"></a><table> 見出し(日付・【県】名称) / 本文(■会場/開演/入場料/公式リンク)」の形。
// 設定(data/sources.json): "months"(今月から何か月分を読むか)、"exclude"(除く名称の正規表現。定期公演など)、
//                         "cityHints"(会場名などに含まれる語 → 市区町村。例 {"湯治村": "安芸高田市"})、
//                         "kaguraByPrefecture"(県ごとの神楽の種類。例 {"島根県": "石見神楽"}。なければ source.kagura)
import * as cheerio from "cheerio";
import { clean, findPrefecture } from "../lib/util.mjs";

const nfkc = (s) => clean(String(s ?? "").normalize("NFKC"));

/** 読むページの URL(今月から months か月分) */
export function urls(source, now = new Date()) {
  const base = new URL(source.url);
  const jst = new Date(now.getTime() + 9 * 3600e3);
  let y = jst.getUTCFullYear(), m = jst.getUTCMonth() + 1;
  const list = [];
  for (let i = 0; i < (source.months ?? 3); i++) {
    const u = new URL(base); u.search = `?year=${y}&mon=${m}`; list.push(u.href);
    if (++m > 12) { m = 1; y++; }
  }
  return list;
}

/** ページは Shift_JIS。バイト列から文字にする */
export const decode = (buf) => new TextDecoder("shift_jis").decode(buf);

export function parse(html, source, pageUrl = source.url) {
  const $ = cheerio.load(html);
  const exclude = source.exclude ? new RegExp(source.exclude) : null;
  const hints = Object.entries(source.cityHints ?? {});
  const out = [];
  $("a[name]").each((_, a) => {
    const id = $(a).attr("name");
    if (!/^\d+$/.test(id)) return;
    const table = $(a).next("table");
    const head = table.find("tr").first();
    const headText = nfkc(head.text());
    const d = headText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    const title = nfkc(head.find("b").first().text());
    if (!d || !title) return;
    const prefecture = findPrefecture(title) || source.prefecture || "";
    const name = title.replace(/^【[^】]*】\s*/, "");
    if (!name || (exclude && exclude.test(name))) return;
    const body = table.find("tr").eq(1);
    const text = nfkc(body.text());
    const field = (label) => (text.match(new RegExp(`■${label}[^/／]*[/／]\\s*([^■※▼]*)`)) ?? [])[1]?.trim() ?? "";
    const venue = field("会場").slice(0, 80);
    const t = text.match(/開演\s*[/／:]?\s*(\d{1,2}):(\d{2})/);
    const fee = field("(?:入場料|料金|観覧料)").slice(0, 80);
    // 会場・名称・本文に含まれる語から、市区町村を推定する(分からなければ空。地図には、ピンを置かない)
    // まず名称と会場から探し、なければ本文から(本文には、チケットの販売所など、別の町の名前が出ることがあるため)
    const findCity = (s) => hints.find(([k]) => s.includes(k))?.[1] ?? "";
    const city = findCity(`${title} ${venue}`) || findCity(text);
    // 公式情報: 本文の中の、主催者などのページへのリンク(なければ、日程表のその行)
    const link = body.find('a[href^="http"]').map((_, x) => $(x).attr("href")).get().find((h) => !/\.(jpe?g|png|gif|pdf)$/i.test(h));
    const pad = (n) => String(n).padStart(2, "0");
    const day = `${d[1]}-${pad(d[2])}-${pad(d[3])}`;
    out.push({
      name, prefecture, city, venue,
      kagura: source.kaguraByPrefecture?.[prefecture] || source.kagura || "",
      start: `${day}T${t ? `${pad(t[1])}:${t[2]}` : "00:00"}`,
      timeUnknown: t ? undefined : true,
      fee,
      url: link || `${pageUrl.split("#")[0]}#${id}`,
    });
  });
  return out;
}
