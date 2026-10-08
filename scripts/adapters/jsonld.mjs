// アダプタ: ページ内の schema.org Event(JSON-LD)を読む。サイトごとの作り込みが不要なので、まずこれを試す。
import * as cheerio from "cheerio";
import { clean, findPrefecture } from "../lib/util.mjs";

const flatten = (node) => {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (node["@graph"]) return flatten(node["@graph"]);
  return [node];
};
const isEvent = (n) => [].concat(n["@type"] ?? []).some((t) => /Event$/.test(t));
const iso = (s) => (s ? String(s).replace(/([+-]\d\d:?\d\d|Z)$/, "").slice(0, 16) : null);

export function parse(html, source) {
  const $ = cheerio.load(html);
  const out = [];
  out.skippedPeriod = 0;
  $('script[type="application/ld+json"]').each((_, el) => {
    let json;
    try { json = JSON.parse($(el).text()); } catch { return; }
    for (const n of flatten(json).filter(isEvent)) {
      // 「2025-09-14〜2027-03-14」のように、複数の開催日を1本の期間で表すページは日付が不正確になるため除外する
      if (n.startDate && n.endDate && new Date(n.endDate) - new Date(n.startDate) > 3 * 864e5) { out.skippedPeriod++; continue; }
      const loc = Array.isArray(n.location) ? n.location[0] : n.location ?? {};
      const addr = loc.address ?? {};
      const addrText = typeof addr === "string" ? addr : clean(`${addr.addressRegion ?? ""}${addr.addressLocality ?? ""}${addr.streetAddress ?? ""}`);
      out.push({
        name: clean(n.name),
        start: iso(n.startDate),
        end: iso(n.endDate),
        venue: clean(loc.name),
        prefecture: (typeof addr === "object" && addr.addressRegion) || findPrefecture(addrText),
        city: typeof addr === "object" ? clean(addr.addressLocality) : "",
        address: typeof addr === "object" ? clean(addr.streetAddress) : "",
        url: typeof n.url === "string" ? new URL(n.url, source.url).href : source.url,
      });
    }
  });
  return out;
}
