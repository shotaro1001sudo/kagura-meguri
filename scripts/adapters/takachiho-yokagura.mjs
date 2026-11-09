// アダプタ: 高千穂町観光協会「夜神楽日程表」。
// 表の1行は「日付 | 地区(公民館) | 神社 | 神楽宿 + 神事・舞入れの時刻 | 距離 | 駐車台数」。
// 来場者が向かうのは神楽宿なので、会場は4列目の神楽宿を使う(3列目の神社は、神事の神社であって会場ではない)。
//  - 「神事のみ」(神楽の公開がない)と「個人宅」(住所を公開しない宿)は、掲載しない
//  - 時刻は、神事と舞入れのどちらを開始とするかを自動では決めず、時間未定のまま取り込む(人が確かめて書き足す)
//  - ID(名称+日付から作る)を変えないため、名称と日付の読み方は selectors アダプタのまま
import { parse as parseList } from "./selectors.mjs";

const SPLIT = /(神事|舞入れ|舞い入れ)/;

export function parse(html, source, pageUrl = source.url) {
  const cfg = { ...source, url: pageUrl, selectors: { ...source.selectors, place: source.selectors?.yado ?? "li:nth-child(4)" } };
  const out = [];
  for (const it of parseList(html, cfg)) {
    const raw = it.venue ?? "";
    if (/神事のみ/.test(raw)) continue;
    const venue = raw.split(SPLIT)[0].replace(/^神楽宿\s*[:：]\s*/, "").trim();
    if (!venue || /個人宅/.test(venue)) continue;
    out.push({ ...it, venue });
  }
  return out;
}
