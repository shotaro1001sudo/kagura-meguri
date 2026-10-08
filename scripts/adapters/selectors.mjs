// アダプタ: CSSセレクタで一覧ページから取り出す。サイトごとの違いは data/sources.json の "selectors" に書くだけ。
// 例: "selectors": { "item": ".event-list li", "name": "a", "date": ".date", "place": ".place", "link": "a" }
// 日付は日本語表記("2026年11月20日 19:00" / "11月20日" など)を解釈する。取れない行は捨てる。
// 任意項目: "filter"(行のテキストに含まれるべき正規表現。例 "神楽")、"namePrefix"(名称の前に付ける文字)、
//           source.prefecture / source.city(場所から読めないときの既定値)
import * as cheerio from "cheerio";
import { clean, findPrefecture, parseJaDate } from "../lib/util.mjs";

export function parse(html, source) {
  const sel = source.selectors;
  if (!sel?.item) throw new Error("selectors.item が未設定です");
  const $ = cheerio.load(html);
  const out = [];
  $(sel.item).each((_, el) => {
    const $el = $(el);
    const pick = (s) => (s ? clean($el.find(s).first().text() || (s === "self" ? $el.text() : "")) : "");
    if (source.filter && !new RegExp(source.filter).test($el.text())) return;
    const date = parseJaDate(pick(sel.date) || clean($el.text()));
    const name = (source.namePrefix || "") + pick(sel.name);
    if (!date || !name) return;
    const place = pick(sel.place).replace(/^(会場|場所|開催場所)\s*[:：]\s*/, "");
    const href = sel.link === "self" ? $el.attr("href") : sel.link ? $el.find(sel.link).first().attr("href") : null;
    // 「島根県大田市 〇〇神社」→ 県 / 市区町村 / 会場に分ける(会場に県名を残すと緯度経度の検索がぶれる)
    const prefecture = findPrefecture(place) || source.prefecture || "";
    let rest = place.replace(prefecture, "").trim();
    let city = source.city || ""; // 市区町村は設定値を優先(「神楽門前湯治村」のような施設名を市町村と誤認しないため)
    if (city && rest.startsWith(city)) rest = rest.slice(city.length).trim();
    else if (!city) {
      const m = rest.match(/^(?:[^\s]{1,6}郡)?[^\s]{1,6}?[市区町村]/);
      if (m) { city = m[0]; rest = rest.slice(city.length).trim(); }
    }
    out.push({
      name,
      start: date.start,
      end: date.end,
      timeUnknown: date.hasTime ? undefined : true,
      venue: clean(rest),
      prefecture,
      city,
      url: href ? new URL(href, source.url).href : source.url,
    });
  });
  return out;
}
