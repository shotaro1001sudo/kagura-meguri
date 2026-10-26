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
    `<a class="stay-banner" href="${esc(b.url)}" ${attrs(true, `banner-${k}/${id}`)} data-banner-partner="${k}"><img src="${esc(b.imageUrl)}" alt="${esc(b.name)}の宿泊予約" loading="lazy" decoding="async"></a>`);
  if(on.jalan)items.push(vcTag({kind:"banner",className:"stay-banner",meta:{"data-goatcounter-click":`banner-jalan/${id}`,"data-banner-partner":"jalan"}}));
  return items.length ? `<div class="stay-banners">${items.join("")}</div>` : "";
}
