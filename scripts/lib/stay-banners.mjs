// 宿の画像バナー(楽天トラベル・じゃらんnet)。本人が各管理画面で発行したコードの、リンクと画像の組だけを許可する。
// リンクは1文字も変えない(発行IDが成果の計測に使われる)。表示用の JavaScript と、見えない計測画像(1px)は使わない。
// じゃらんは、発行コードが JavaScript(jsbanner)だったため、その出力(リンクと画像)を静的に書き直した。広告主は本人が じゃらんnet と確認済み。
// 受領: 2026-10-25。画像の実際の見た目・最終の遷移先・成果計測は、未確認。
export const STAY_BANNERS = {
  rakuten: {
    name: "楽天トラベル",
    url: "https://hb.afl.rakuten.co.jp/hsc/58cd42a3.a31a7bc6.585fa57b.dad29d3a/?link_type=pict&ut=eyJwYWdlIjoic2hvcCIsInR5cGUiOiJwaWN0IiwiY29sIjoxLCJjYXQiOiIxMzMiLCJiYW4iOjIxODg2NTgsImFtcCI6ZmFsc2V9",
    imageUrl: "https://hbb.afl.rakuten.co.jp/hsb/58cd42a3.a31a7bc6.585fa57b.dad29d3a/?me_id=2100001&me_adv_id=2188658&t=pict",
  },
  jalan: {
    name: "じゃらんnet",
    url: "https://ck.jp.ap.valuecommerce.com/servlet/referral?va=2847639&sid=3784232&pid=892732859",
    imageUrl: "https://i.imgvc.com/vc/images/00/2b/73/97.jpeg",
  },
};
// 画像の配信元(CSPの img-src)。楽天は、画像のURLが別のホストへ転送される(hbb → ba)
export const BANNER_IMG_HOSTS = ["https://hbb.afl.rakuten.co.jp", "https://ba.afl.rakuten.co.jp", "https://i.imgvc.com"];

/** 宿のバナー。on: { rakuten, jalan }(各サービスの提携IDが設定されているか)。attrs(on, label): 外部リンクの属性 */
export function stayBannersHtml({ on, id, attrs, esc }) {
  const items = Object.entries(STAY_BANNERS).filter(([k]) => on[k]).map(([k, b]) =>
    `<a class="stay-banner" href="${esc(b.url)}" ${attrs(true, `banner-${k}/${id}`)} data-banner-partner="${k}"><img src="${esc(b.imageUrl)}" alt="${esc(b.name)}の宿泊予約" loading="lazy" decoding="async"></a>`);
  return items.length ? `<div class="stay-banners">${items.join("")}</div>` : "";
}
