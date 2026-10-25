// 神楽を「もっと知る」本・映像・グッズ(種類・歴史のページ)と、神楽の町のふるさと納税(県のページ)。
// 本人が楽天アフィリエイトの管理画面で発行したリンクだけを、data/more-offers.json に登録して使う(URLは1文字も変えない)。
// 承認・確認日・期限・リンクの形式がそろったものだけを出す。カテゴリを無効にすれば、まとめて消せる。
const date = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cityOf = (s) => String(s ?? "").replace(/^.*郡/, "");

// 提供元: 名前と、リンク先(楽天の pc= の行き先)として認めるホスト
export const PROVIDERS = {
  "rakuten-books": { category: "learn", name: "楽天ブックス", targets: ["books.rakuten.co.jp"] },
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
    return true;
  } catch { return false; }
}

/** 条件に合う広告(最大3件)。learn: { kagura }(種類の名前。"*" の全般向けも含める)/ furusato: { prefecture } */
export function moreOffersFor(settings, category, context, today) {
  if (settings?.categories?.[category]?.enabled !== true || !Array.isArray(settings.offers)) return [];
  const seen = new Set();
  return settings.offers.filter((o) => {
    if (!validMoreOffer(o, today) || o.category !== category || seen.has(o.id) || seen.has(o.url)) return false;
    if (category === "learn" && !(o.kagura === "*" || o.kagura === context.kagura)) return false;
    if (category === "furusato" && o.prefecture !== context.prefecture) return false;
    seen.add(o.id); seen.add(o.url); return true;
  }).sort((a, b) => (a.kagura === "*") - (b.kagura === "*")).slice(0, 3);
}

const pick = (o, placement) => `<p class="pick"><span class="pr">PR</span><a href="${esc(o.url)}" target="_blank" rel="sponsored noopener noreferrer" data-goatcounter-click="more-${o.category}/${o.id}" data-affiliate-category="${o.category}" data-affiliate-partner="${o.provider}" data-affiliate-placement="${esc(placement)}" data-affiliate-id="${o.id}">${esc(o.title)}</a><small>${esc(PROVIDERS[o.provider].name)}${o.category === "furusato" ? ` ・ ${esc(cityOf(o.city))}` : ""} ・ ${esc(o.note)}</small></p>`;
const adNote = '<p class="meta annotation"><span class="pr">PR</span> 紹介している商品・返礼品のリンクは広告(アフィリエイトリンク)です。購入・寄付で当サイトに報酬が入ることがあります。</p>';

/** 種類・歴史のページ: 「もっと楽しむ」本・映像・グッズ */
export function learnSection(settings, context, today, placement) {
  const list = moreOffersFor(settings, "learn", context, today);
  if (!list.length) return "";
  const title = context.kagura && context.kagura !== "*" ? `${esc(context.kagura)}をもっと楽しむ` : "神楽をもっと知る";
  return `<section class="more-picks" aria-labelledby="learn-h"><h2 id="learn-h">${title}</h2><p>観る前後に、本や映像で物語や背景を知っておくと、舞の見え方が変わります。</p><div class="picks">${list.map((o) => pick(o, placement)).join("")}</div>${adNote}</section>`;
}

/** 県のページ: 神楽の町のふるさと納税 */
export function furusatoSection(settings, context, today, placement) {
  const list = moreOffersFor(settings, "furusato", context, today);
  if (!list.length) return "";
  return `<section class="more-picks" aria-labelledby="furusato-h"><h2 id="furusato-h">神楽の町を応援する</h2><p>ふるさと納税で、神楽を受け継ぐ${esc(context.prefecture)}の町を応援できます。</p><div class="picks">${list.map((o) => pick(o, placement)).join("")}</div>${adNote}</section>`;
}
