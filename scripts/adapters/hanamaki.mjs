// アダプタ: 花巻観光協会のイベントカレンダー(月ごとのページ index.php?m=月)から、神楽の催しを取り出す。
// 一覧の読み取りは selectors アダプタと同じ(data/sources.json の "selectors")。ここでは、
//  - 今月から months か月ぶん(既定3)のページを読む
//  - 神楽を含んでいても、展示(企画展・特別展)や併催の催し(キッチンカーなど)は除く
// 日付は一覧の「2026年11月8日(日)」の形から読む(年が書かれている)。時刻は一覧にないため、時間未定として取り込む。
import { parse as parseList } from "./selectors.mjs";

export const EXCLUDE = /展|キッチンカー|物産|マルシェ|スイーツ/;

export function urls(source, now = new Date()) {
  const m0 = new Date(now.getTime() + 9 * 3600e3).getUTCMonth() + 1; // 日本時間の月
  const n = source.months ?? 3;
  return Array.from({ length: n }, (_, i) => {
    const u = new URL(source.url);
    u.searchParams.set("m", String(((m0 - 1 + i) % 12) + 1));
    return u.href;
  });
}

export function parse(html, source, pageUrl = source.url) {
  // 場所の先頭の地区名(<span>大迫</span>)は、会場名ではないので外す
  const body = String(html).replace(/(<p class="p-bold">)\s*<span>[^<]*<\/span>/g, "$1");
  return parseList(body, { ...source, url: pageUrl }).filter((e) => !EXCLUDE.test(e.name));
}
