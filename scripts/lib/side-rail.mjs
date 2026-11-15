import { vcTag } from "./valuecommerce.mjs";
// PC の画面の両サイドの PR 枠(2026-11-15 運営者の依頼)。
// 出すのは、開催・定期公演・都道府県・神楽の種類のページだけ。幅の広い画面だけに出し、スマホや幅のせまい画面では出さない。
// 画面を下へ動かしても、横に付いてくる。バナーは、1画面に収まる数だけ(高さの足りない画面では、下のものから隠す)。
//
// バナーは、楽天アフィリエイトの管理画面で本人のアカウントから発行したものだけ(2026-11-15、Chrome で発行)。
// 発行コードの <a href> と <img src> を、そのまま使う。ut は、JSON を base64 にしたものを encodeURIComponent した値(= は %3D)。
// 料率は、発行した日に管理画面・楽天トラベルのアフィリエイトの案内で確かめた値(続くとは限らない)。
const rk = ({ hs, me, raw }) => ({
  url: `https://hb.afl.rakuten.co.jp/hsc/${hs}/?link_type=pict&ut=${encodeURIComponent(Buffer.from(raw).toString("base64"))}`,
  imageUrl: `https://hbb.afl.rakuten.co.jp/hsb/${hs}/?me_id=${me}&me_adv_id=${JSON.parse(raw).ban}&t=pict`,
});

export const RAIL_ISSUED = "2026-11-15";

/** side: 左右のどちらの枠か。並びは、配列の順(上から)。rate は記録だけで、ページには出さない */
export const RAIL_BANNERS = [
  { id: "onsen-rotenburo", side: "left", partner: "rakuten", name: "楽天トラベル", alt: "露天風呂のある宿を楽天トラベルで探す", size: 240, rate: "宿泊 1%",
    ...rk({ hs: "59865281.e4d6d731.585fa57b.dad29d3a", me: "2100001", raw: '{"page":"shop","type":"pict","col":1,"cat":"3","ban":2475223,"amp":false}' }) },
  // じゃらんnet: バリューコマースの発行コード(公式の非JSタグ)を、広告の同意があるときだけ出す(vcTag)。宿泊 1.1%(2026-11-15 管理画面)
  { id: "ryokan", side: "left", partner: "jalan", name: "じゃらんnet", vc: "rail", rate: "宿泊 1.1%" },
  { id: "onsen-gensen", side: "left", partner: "rakuten", name: "楽天トラベル", alt: "源泉掛け流しの温泉宿を楽天トラベルで探す", size: 240, rate: "宿泊 1%",
    ...rk({ hs: "59865325.85ae46a1.585fa57b.dad29d3a", me: "2100001", raw: '{"page":"shop","type":"pict","col":1,"cat":"3","ban":615619,"amp":false}' }) },
  { id: "rentacar", side: "right", partner: "rakuten", name: "楽天トラベル レンタカー", alt: "レンタカーを楽天トラベルで予約する", size: 300, rate: "レンタカー 2%(専用のバナー経由)",
    ...rk({ hs: "59865392.63f8ca10.585fa57b.dad29d3a", me: "2100017", raw: '{"page":"shop","type":"pict","col":1,"cat":"1","ban":2762506,"amp":false}' }) },
  { id: "experiences", side: "right", partner: "rakuten", name: "楽天トラベル 観光体験", alt: "現地の観光体験を楽天トラベルで予約する", size: 250, rate: "観光体験 2%(専用のバナー経由)",
    ...rk({ hs: "59865479.483ffafe.585fa57b.dad29d3a", me: "2100034", raw: '{"page":"shop","type":"pict","col":1,"cat":1,"ban":2185638,"amp":false}' }) },
];

/** PR 枠を出すページか(開催・定期公演・都道府県・神楽の種類) */
export const railPage = (path) => /^\/(events|regular|pref|kagura)\//.test(path);

/**
 * 両サイドの PR 枠。on: { rakuten, jalan }(提携IDが設定されているか)。attrs(on, name): 外部リンクの属性。wide: 本文が広いページか
 * 枠ごとに、下の右端に「PR」を1つ(ほかの広告の枠と同じ決まり)。
 */
export function sideRailHtml({ on, attrs, esc, wide = false }) {
  const side = (s) => {
    const items = RAIL_BANNERS.filter((b) => b.side === s && on[b.partner]).map((b) => b.vc
      ? vcTag({ kind: b.vc, className: "rail-banner", meta: { "data-goatcounter-click": `rail-${b.partner}/${b.id}`, "data-banner-partner": b.partner } })
      : `<a class="rail-banner" href="${esc(b.url)}" ${attrs(true, `rail-${b.partner}/${b.id}`)} data-banner-partner="${b.partner}"><img src="${esc(b.imageUrl)}" alt="${esc(b.alt)}" width="${b.size}" height="${b.size}" loading="lazy" decoding="async"></a>`);
    return items.length ? `<aside class="side-rail side-rail-${s === "left" ? "l" : "r"}${wide ? " w" : ""}" aria-label="広告">${items.join("")}<span class="pr pr-foot">PR</span></aside>` : "";
  };
  return side("left") + side("right");
}
