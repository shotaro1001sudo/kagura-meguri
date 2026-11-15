import { vcTag } from "./valuecommerce.mjs";
// Rakuten issued banner; VC uses the complete official non-JS tag, consent-gated.
export const STAY_BANNERS = {
  rakuten: {
    name: "楽天トラベル",
    url: "https://hb.afl.rakuten.co.jp/hsc/58cd42a3.a31a7bc6.585fa57b.dad29d3a/?link_type=pict&ut=eyJwYWdlIjoic2hvcCIsInR5cGUiOiJwaWN0IiwiY29sIjoxLCJjYXQiOiIxMzMiLCJiYW4iOjIxODg2NTgsImFtcCI6ZmFsc2V9",
    imageUrl: "https://hbb.afl.rakuten.co.jp/hsb/58cd42a3.a31a7bc6.585fa57b.dad29d3a/?me_id=2100001&me_adv_id=2188658&t=pict",
  },

};
// 画像の配信元(CSPの img-src)。楽天は、画像のURLが別のホストへ転送される(hbb → ba)
export const BANNER_IMG_HOSTS = ["https://hbb.afl.rakuten.co.jp", "https://ba.afl.rakuten.co.jp"];

/** 宿のバナー。on: { rakuten, jalan }(各サービスの提携IDが設定されているか)。attrs(on, label): 外部リンクの属性 */
export function stayBannersHtml({ on, id, attrs, esc }) {
  const items = Object.entries(STAY_BANNERS).filter(([k]) => on[k]).map(([k, b]) =>
    `<a class="stay-banner" href="${esc(b.url)}" ${attrs(true, `banner-${k}/${id}`)} data-banner-partner="${k}"><img src="${esc(b.imageUrl)}" alt="${esc(b.name)}の宿泊予約" width="468" height="60" loading="lazy" decoding="async"></a>`);
  if(on.jalan)items.push(vcTag({kind:"banner",className:"stay-banner",meta:{"data-goatcounter-click":`banner-jalan/${id}`,"data-banner-partner":"jalan"}}));
  return items.length ? `<div class="stay-banners">${items.join("")}</div>` : "";
}

// 都道府県のページの「◯◯県の体験」の枠(2026-11-15 運営者の依頼「◯◯県の宿の下に、同じ枠の大きさで。じゃらんやアソビューなど、宿と同じバナー画像の大きさと配置に」)。
// 楽天トラベル 観光体験は、同日に本人のアカウントで発行した 486×60(宿の楽天のバナー 468×60 と同じくらいの横長。絵柄は「楽天ポイントがたまる、使える! チケット購入はこちら」)。
// じゃらん遊び・体験・アソビュー!は、同日に発行したバリューコマースの 468×60(宿のじゃらんのバナーと同じ大きさ。広告の同意があるときだけ出る。valuecommerce.mjs の activityWide・asoviewWide)。
export const EXP_BANNER = {
  name: "楽天トラベル 観光体験",
  url: `https://hb.afl.rakuten.co.jp/hsc/598e2466.ccdf10d6.585fa57b.dad29d3a/?link_type=pict&ut=${encodeURIComponent(Buffer.from('{"page":"shop","type":"pict","col":1,"cat":"1","ban":2185650,"amp":false}').toString("base64"))}`,
  imageUrl: "https://hbb.afl.rakuten.co.jp/hsb/598e2466.ccdf10d6.585fa57b.dad29d3a/?me_id=2100034&me_adv_id=2185650&t=pict",
};
/** 体験のバナー。on: { rakuten, vc }(vc: じゃらん遊び・体験の提携があるか)。計測は、体験の広告の決まり(GA4 の配置 nearby_experiences)。id: 県の名前 */
export function expBannersHtml({ on, id, attrs, esc }) {
  const ga = (partner, cid) => ({ "data-affiliate-category": "experiences", "data-affiliate-partner": partner, "data-affiliate-placement": "nearby_experiences", "data-affiliate-id": cid });
  const data = (o) => Object.entries(o).map(([k, v]) => `${k}="${esc(v)}"`).join(" ");
  const items = [];
  // 486×60 は、横に並べたときに 468×60 と同じ高さになるよう、幅の割合を 486 にする(style.css の .stay-banner.w486)
  if (on.rakuten) items.push(`<a class="stay-banner w486" href="${esc(EXP_BANNER.url)}" ${attrs(true, `experience-rakuten/pref-${id}`)} ${data(ga("rakuten", "pref-rakuten-experiences"))}><img src="${esc(EXP_BANNER.imageUrl)}" alt="現地の観光体験を楽天トラベルで探す" width="486" height="60" loading="lazy" decoding="async"></a>`);
  if (on.vc) {
    // 同日「体験のバナーが3つになって見づらい、2つにして」: 宿の枠と同じ 楽天+じゃらん の2つにした(アソビューの 468×60 は発行済みだが、ここには出さない)
    items.push(vcTag({ kind: "activityWide", className: "stay-banner", meta: { "data-goatcounter-click": `experience-jalan/pref-${id}`, ...ga("vc-jalan-activity", "pref-jalan-activity") } }));
  }
  return items.length ? `<div class="stay-banners">${items.join("")}</div>` : "";
}
