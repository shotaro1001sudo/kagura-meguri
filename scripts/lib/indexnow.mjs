// IndexNow(Bing などに、新しいページ・変わったページをすぐ知らせる仕組み)
// 公開の前のサイトマップ(いま公開中のもの)と、作り直したサイトマップを比べ、
// 新しく増えたページと、更新日(lastmod)が変わったページだけを知らせる。
// キーは公開してよい値(サイトの /<キー>.txt に同じ値を置いて、持ち主であることを示す)。
// 仕様: https://www.indexnow.org/documentation

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const INDEXNOW_MAX_URLS = 10000; // 1回に送れる上限(仕様)

export const validKey = (key) => typeof key === "string" && /^[a-zA-Z0-9-]{8,128}$/.test(key);

// サイトマップの <url> ごとに、場所と更新日を読む(このサイトが書く形だけを読む)
export function sitemapEntries(xml) {
  const out = new Map();
  for (const m of String(xml ?? "").matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]*)<\/lastmod>)?\s*<\/url>/g)) out.set(m[1].trim(), (m[2] ?? "").trim());
  return out;
}

// 新しく増えたページと、更新日が変わったページ。前のサイトマップが読めないとき(null)は、何も送らない
export function changedUrls(beforeXml, afterXml, baseUrl) {
  if (beforeXml == null) return [];
  const before = sitemapEntries(beforeXml), after = sitemapEntries(afterXml);
  if (before.size === 0) return []; // 取り違え(エラーのページなど)で全部を送らない
  const origin = new URL(baseUrl).origin;
  return [...after].filter(([loc, day]) => before.get(loc) !== day).map(([loc]) => loc)
    .filter((loc) => { try { return new URL(loc).origin === origin; } catch { return false; } })
    .slice(0, INDEXNOW_MAX_URLS);
}

// 送る中身。URL が無ければ null(送らない)
export function indexNowBody({ baseUrl, key, urls }) {
  if (!validKey(key) || !urls?.length) return null;
  const u = new URL(baseUrl);
  return { host: u.host, key, keyLocation: `${u.origin}/${key}.txt`, urlList: urls };
}
