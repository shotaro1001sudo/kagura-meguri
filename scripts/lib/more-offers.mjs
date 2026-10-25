// 神楽を「もっと知る」本・映像・グッズ(種類・歴史のページ)と、神楽の町のふるさと納税(県のページ)。
// 本人が楽天アフィリエイトの管理画面で発行したリンクだけを、data/more-offers.json に登録して使う(URLは1文字も変えない)。
// 承認・確認日・期限・リンクの形式がそろったものだけを出す。カテゴリを無効にすれば、まとめて消せる。
const date = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cityOf = (s) => String(s ?? "").replace(/^.*郡/, "");

// 提供元: 名前と、リンク先(楽天の pc= の行き先)として認めるホスト
export const PROVIDERS = {
  "rakuten-books": { category: "learn", name: "楽天ブックス", targets: ["books.rakuten.co.jp", "item.rakuten.co.jp"] }, // 楽天市場の「楽天ブックス」店(item.rakuten.co.jp/book/)も含む
  "rakuten-ichiba": { category: "learn", name: "楽天市場", targets: ["item.rakuten.co.jp", "search.rakuten.co.jp"] },
  "rakuten-furusato": { category: "furusato", name: "楽天ふるさと納税", targets: ["item.rakuten.co.jp", "event.rakuten.co.jp", "search.rakuten.co.jp"] },
};

export function validMoreOffer(o, today) {
  if (!o || o.enabled !== true || o.approved !== true || !date(today) || !date(o.verifiedAt) || !date(o.expiresAt)) return false;
  if (o.verifiedAt > today || o.expiresAt < today || Date.parse(today) - Date.parse(o.verifiedAt) > 90 * 864e5) return false;
  const p = PROVIDERS[o.provider];
  if (!p || p.category !== o.category || typeof o.id !== "string" || !/^[-a-z0-9]{1,48}$/.test(o.id)) return false;
  if (!["title", "note", "approvalReference"].every((k) => typeof o[k] === "string" && o[k].trim())) return false;
  if (o.category === "learn" && !(typeof o.kagura === "string" && o.kagura.trim())) return false; // 種類の名前、または "*"(全般)
  if (o.kaguras !== undefined && (!Array.isArray(o.kaguras) || !o.kaguras.length || !o.kaguras.every(k => typeof k === "string" && k.trim() && k !== "*"))) return false;
  if (o.category === "furusato" && !["prefecture", "city"].every((k) => typeof o[k] === "string" && o[k].trim())) return false;
  try {
    if (typeof o.url !== "string" || /[\s\\\u0000-\u001f\u007f]/.test(o.url)) return false;
    const u = new URL(o.url);
    if (u.protocol !== "https:" || u.hostname !== "hb.afl.rakuten.co.jp" || u.username || u.password || u.port || u.hash) return false;
    if (!/^\/(hgc|ichiba)\/[A-Za-z0-9._/-]+\/$/.test(u.pathname) || !u.searchParams.has("pc")) return false;
    for (const key of ["pc", "m"]) if (u.searchParams.has(key)) {
      const t = new URL(u.searchParams.get(key));
      if (t.protocol !== "https:" || t.username || t.password || t.port || !p.targets.includes(t.hostname)) return false;
    }
    // 商品画像(任意): 同じ発行コードの画像URL(hbb.afl.rakuten.co.jp/hgb/<リンクと同じID>/)だけを認める
    if (o.imageUrl !== undefined) {
      if (typeof o.imageUrl !== "string" || /[\s\\\u0000-\u001f\u007f]/.test(o.imageUrl)) return false;
      const img = new URL(o.imageUrl), id = u.pathname.split("/")[2];
      if (img.protocol !== "https:" || img.hostname !== "hbb.afl.rakuten.co.jp" || img.pathname !== `/hgb/${id}/` || img.username || img.password || img.port) return false;
    }
    return true;
  } catch { return false; }
}

/** 条件に合う広告(最大3件)。learn: { kagura }(種類の名前。"*" の全般向けも含める)/ furusato: { prefecture } */
export function moreOffersFor(settings, category, context, today) {
  if (settings?.categories?.[category]?.enabled !== true || !Array.isArray(settings.offers)) return [];
  const seen = new Set();
  return settings.offers.filter((o) => {
    if (!validMoreOffer(o, today) || o.category !== category || seen.has(o.id) || seen.has(o.url)) return false;
    if (category === "learn" && !(o.kaguras ? o.kaguras.includes(context.kagura) : o.kagura === "*" || o.kagura === context.kagura)) return false;
    if (category === "furusato" && o.prefecture !== context.prefecture) return false;
    // 個別公演は開催市町村も一致させる。県の一覧ページは県単位のまま。
    if (category === "furusato" && "city" in context && (!cityOf(context.city) || cityOf(o.city) !== cityOf(context.city))) return false;
    seen.add(o.id); seen.add(o.url); return true;
  }).sort((a, b) => (a.kagura === "*") - (b.kagura === "*")).slice(0, 3);
}

const pick = (o, placement) => `<p class="pick${o.imageUrl ? " has-img" : ""}"><span class="pr">PR</span><a href="${esc(o.url)}" target="_blank" rel="sponsored noopener noreferrer" data-goatcounter-click="more-${o.category}/${o.id}" data-affiliate-category="${o.category}" data-affiliate-partner="${o.provider}" data-affiliate-placement="${esc(placement)}" data-affiliate-id="${o.id}">${o.imageUrl ? `<img src="${esc(o.imageUrl)}" alt="" width="72" height="72" loading="lazy" decoding="async">` : ""}<span>${esc(o.title)}</span></a><small>${esc(PROVIDERS[o.provider].name)}${o.category === "furusato" ? ` ・ ${esc(cityOf(o.city))}` : ""} ・ ${esc(o.note)}</small></p>`;
const adNote = '<p class="meta annotation"><span class="pr">PR</span> 紹介している商品・返礼品のリンクは広告(アフィリエイトリンク)です。購入・寄付で当サイトに報酬が入ることがあります。</p>';

// 発行リンクがまだないときの代わり: 楽天の検索ページへの、ふつうのリンク(広告ではない・報酬なし)
const searchLink = (href, label, gc) => `<a class="search-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer" data-goatcounter-click="${esc(gc)}">${label}</a>`;
const booksSearch = (kw) => searchLink(`https://books.rakuten.co.jp/search?sitem=${encodeURIComponent(kw)}`, `楽天ブックスで「${esc(kw)}」の本を探す`, `more-learn-search/${kw}`);
const furusatoSearch = (town) => searchLink(`https://search.rakuten.co.jp/search/mall/${encodeURIComponent(`ふるさと納税 ${town}`)}/`, `${esc(town)}のふるさと納税を見る`, `more-furusato-search/${town}`);
const plainNote = '<p class="meta annotation">本・ふるさと納税の検索ページへのリンクは、広告ではありません。在庫・返礼品の内容は、リンク先で確認してください。</p>';

/** 本・映像・グッズ: 発行リンクがあれば紹介(PR)、なければ楽天ブックスの検索へ。side: 右の列の小さな枠 */
export function learnBlock(settings, context, today, placement, { side = false } = {}) {
  const list = moreOffersFor(settings, "learn", context, today);
  const kw = context.kagura && context.kagura !== "*" ? context.kagura : "神楽";
  const title = kw === "神楽" ? "神楽をもっと知る" : `${esc(kw)}をもっと楽しむ`;
  const inner = list.length ? `<div class="picks">${list.map((o) => pick(o, placement)).join("")}</div>${adNote}` : `<p class="search-links">${booksSearch(kw)}</p>${plainNote}`;
  return side
    ? `<aside class="side-box" aria-labelledby="${placement}-h"><h2 id="${placement}-h">${title}</h2><p>本や映像で、物語や背景を。</p>${inner}</aside>`
    : `<section class="more-picks" aria-labelledby="${placement}-h"><h2 id="${placement}-h">${title}</h2><p>観る前後に、本や映像で物語や背景を知っておくと、舞の見え方が変わります。</p>${inner}</section>`;
}

/** ふるさと納税: 発行リンクがあれば紹介(PR)、なければ町ごとの検索へ。towns: 神楽が開かれる市町村(最大3) */
export function furusatoBlock(settings, context, today, placement, { side = false } = {}) {
  const list = moreOffersFor(settings, "furusato", context, today);
  const towns = [...new Set((context.towns ?? []).map(cityOf).filter(Boolean))].slice(0, 3);
  if (!list.length && !towns.length) return "";
  const inner = list.length ? `<div class="picks">${list.map((o) => pick(o, placement)).join("")}</div>${adNote}` : `<p class="search-links">${towns.map(furusatoSearch).join("")}</p>${plainNote}`;
  return side
    ? `<aside class="side-box" aria-labelledby="${placement}-h"><h2 id="${placement}-h">神楽の町を応援する</h2><p>ふるさと納税で、神楽を受け継ぐ町へ。</p>${inner}</aside>`
    : `<section class="more-picks" aria-labelledby="${placement}-h"><h2 id="${placement}-h">神楽の町を応援する</h2><p>ふるさと納税で、神楽を受け継ぐ${esc(context.prefecture)}の町を応援できます。</p>${inner}</section>`;
}
