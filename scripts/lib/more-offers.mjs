// 神楽を「もっと知る」本・映像・グッズ(種類・歴史のページ)と、神楽の町のふるさと納税(県のページ)。
// 本人が楽天アフィリエイトの管理画面で発行したリンクだけを、data/more-offers.json に登録して使う(URLは1文字も変えない)。
// 承認・確認日・期限・リンクの形式がそろったものだけを出す。カテゴリを無効にすれば、まとめて消せる。
import { readFileSync } from "node:fs";
import { PREFECTURES } from "./util.mjs";
import { offerEligibility } from "./offer-eligibility.mjs";
export const normalizeOfferText = s => typeof s === "string" ? s.normalize("NFKC").replace(/\s+/gu, "") : "";
const prefectureOf = s => PREFECTURES.includes(normalizeOfferText(s)) ? normalizeOfferText(s) : "";
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// 郡山市などの市名を壊さない。郡付き町村だけを別名にする。
const cityOf = s => normalizeOfferText(s).replace(/^[^郡]+郡(?=.+[町村]$)/u, "");

// 提供元: 名前と、リンク先(楽天の pc= の行き先)として認めるホスト
export const PROVIDERS = {
  "rakuten-books": { category: "learn", name: "楽天ブックス", targets: ["books.rakuten.co.jp", "item.rakuten.co.jp"] }, // 楽天市場の「楽天ブックス」店(item.rakuten.co.jp/book/)も含む
  "rakuten-ichiba": { category: "learn", name: "楽天市場", targets: ["item.rakuten.co.jp", "search.rakuten.co.jp"] },
  "rakuten-furusato": { category: "furusato", name: "楽天ふるさと納税", targets: ["item.rakuten.co.jp", "event.rakuten.co.jp", "search.rakuten.co.jp"] },
};

export function validMoreOffer(o, today) {
  if (offerEligibility(o, today)) return false;
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

/** Build once per snapshot/date. No network; issued URLs are never rewritten. */
export function createMoreOfferIndex(settings, today) {
  const learn = new Map(), pref = new Map(), city = new Map(), aliases = new Map();
  const add = (map, key, o) => { if (!map.has(key)) map.set(key, []); map.get(key).push(o); };
  const diagnostics = [];
  for (const o of settings?.offers ?? []) {
    const reason = offerEligibility(o, today) || (!validMoreOffer(o, today) ? "invalid_offer" : "");
    if (reason) { diagnostics.push({id:o?.id ?? "", category:o?.category ?? "", reason}); continue; }
    if (settings?.categories?.[o.category]?.enabled !== true) { diagnostics.push({id:o.id,category:o.category,reason:"category_disabled"}); continue; }
    if (o.category === "learn") {
      for (const k of new Set((o.kaguras ?? [o.kagura]).map(normalizeOfferText))) add(learn, k, o);
    } else {
      const p = prefectureOf(o.prefecture), c = normalizeOfferText(o.city);
      if (!p || !/^[^/?,]+[市区町村]$/u.test(c)) { diagnostics.push({id:o.id,category:o.category,reason:"invalid_region"}); continue; }
      add(pref, p, o); add(city, p+"/"+c, o);
      const key=p+"/"+cityOf(c);
      if (!aliases.has(key)) aliases.set(key,new Set());
      aliases.get(key).add(c);
    }
  }
  // Cap each bucket once; deduplicate before the cap to preserve the three distinct offers.
  const top = items => { const ids=new Set(),urls=new Set(); return items.filter(o=>{
    if(ids.has(o.id)||urls.has(o.url))return false; ids.add(o.id);urls.add(o.url);return true;
  }).slice(0,3); };
  for (const map of [learn,pref,city]) for (const [key,items] of map) map.set(key,top(items));
  const select = (category, context={}) => {
    if ("prefecture" in context && !prefectureOf(context.prefecture)) return [];
    if (category === "learn") {
      const k=normalizeOfferText(context.kagura);
      // Unknown/empty types never inherit a general product. Explicit * is the general history page.
      if (!k || (!learn.has(k) && k!=="*" && !knownKaguras.has(k))) return [];
      return top([...(learn.get(k)??[]),...(k==="*"?[]:learn.get("*")??[])]);
    }
    if (category !== "furusato") return [];
    const p=prefectureOf(context.prefecture);
    if (!p) return [];
    if (!("city" in context)) return (pref.get(p)??[]).slice();
    const c=normalizeOfferText(context.city), key=p+"/"+cityOf(c), names=aliases.get(key);
    if (!c || !names || names.size!==1) return [];
    const canonical=[...names][0];
    // An explicitly different county must not match a short alias.
    if (c!==canonical && c!==cityOf(canonical)) return [];
    return (city.get(p+"/"+canonical)??[]).slice();
  };
  return Object.freeze({select, diagnostics, today, configured: {learn:learn.size>0,furusato:city.size>0}});
}
// Editorial type catalog, loaded once; an approved product may also declare a specific type.
const knownKaguras = new Set(Object.keys(JSON.parse(readFileSync(new URL("../../data/kagura-info.json",import.meta.url),"utf8"))).map(normalizeOfferText));
export function moreOffersFor(settings, category, context, today) {
  const index = typeof settings?.select === "function" ? settings : createMoreOfferIndex(settings,today);
  return index.today === today ? index.select(category,context) : [];
}

const pick = (o, placement) => `<p class="pick${o.imageUrl ? " has-img" : ""}"><span class="pr">PR</span><a href="${esc(o.url)}" target="_blank" rel="sponsored noopener noreferrer" data-goatcounter-click="more-${o.category}/${o.id}" data-affiliate-category="${o.category}" data-affiliate-partner="${o.provider}" data-affiliate-placement="${esc(placement)}" data-affiliate-id="${o.id}">${o.imageUrl ? `<img src="${esc(o.imageUrl)}" alt="" width="72" height="72" loading="lazy" decoding="async">` : ""}<span>${esc(o.title)}</span></a><small>${esc(PROVIDERS[o.provider].name)}${o.category === "furusato" ? ` ・ ${esc(cityOf(o.city))}` : ""} ・ ${esc(o.note)}</small></p>`;
const adNote = '<p class="meta annotation"><span class="pr">PR</span> 紹介している商品・返礼品のリンクは広告(アフィリエイトリンク)です。購入・寄付で当サイトに報酬が入ることがあります。</p>';

/** 本・映像・グッズ: 発行リンクがあれば紹介(PR)、なければ枠を省略。side: 右の列の小さな枠 */
export function learnBlock(settings, context, today, placement, { side = false } = {}) {
  const list = moreOffersFor(settings, "learn", context, today);
  if (!list.length) return "";
  const kw = context.kagura && context.kagura !== "*" ? context.kagura : "神楽";
  const title = kw === "神楽" ? "神楽をもっと知る" : `${esc(kw)}をもっと楽しむ`;
  const inner = `<div class="picks">${list.map((o) => pick(o, placement)).join("")}</div>${adNote}`;
  return side
    ? `<aside class="side-box" aria-labelledby="${placement}-h"><h2 id="${placement}-h">${title}</h2><p>本や映像で、物語や背景を。</p>${inner}</aside>`
    : `<section class="more-picks" aria-labelledby="${placement}-h"><h2 id="${placement}-h">${title}</h2><p>観る前後に、本や映像で物語や背景を知っておくと、舞の見え方が変わります。</p>${inner}</section>`;
}

/** ふるさと納税: 発行リンクがあれば紹介(PR)、なければ枠を省略。towns: 神楽が開かれる市町村(最大3) */
export function furusatoBlock(settings, context, today, placement, { side = false } = {}) {
  const list = moreOffersFor(settings, "furusato", context, today);
  if (!list.length) return "";
  const inner = `<div class="picks">${list.map((o) => pick(o, placement)).join("")}</div>${adNote}`;
  return side
    ? `<aside class="side-box" aria-labelledby="${placement}-h"><h2 id="${placement}-h">神楽の町を応援する</h2><p>ふるさと納税で、神楽を受け継ぐ町へ。</p>${inner}</aside>`
    : `<section class="more-picks" aria-labelledby="${placement}-h"><h2 id="${placement}-h">神楽の町を応援する</h2><p>ふるさと納税で、神楽を受け継ぐ${esc(context.prefecture)}の町を応援できます。</p>${inner}</section>`;
}
