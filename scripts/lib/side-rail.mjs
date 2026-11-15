import { vcTag } from "./valuecommerce.mjs";
// PC の画面の両サイドの PR 枠(2026-11-15 運営者の依頼)。
// 出すのは、開催・定期公演・都道府県・神楽の種類のページと、今週末・今月・日付と場所で探すページ(同日に追加)だけ。幅の広い画面だけに出し、スマホや幅のせまい画面では出さない。
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
  { id: "onsen", side: "left", partner: "jtb", name: "JTB", vc: "railJtb", rate: "国内宿泊 2.09%" },
  { id: "onsen-gensen", side: "left", partner: "rakuten", name: "楽天トラベル", alt: "源泉掛け流しの温泉宿を楽天トラベルで探す", size: 240, rate: "宿泊 1%",
    ...rk({ hs: "59865325.85ae46a1.585fa57b.dad29d3a", me: "2100001", raw: '{"page":"shop","type":"pict","col":1,"cat":"3","ban":615619,"amp":false}' }) },
  { id: "jr-hotel", side: "right", partner: "nta", name: "日本旅行", vc: "railNta", rate: "国内パッケージ成約 3.3%(2026-12-31 までのキャンペーン。ふだんは 2.2%)" },
  { id: "rentacar", side: "right", partner: "rakuten", name: "楽天トラベル レンタカー", alt: "レンタカーを楽天トラベルで予約する", size: 300, rate: "レンタカー 2%(専用のバナー経由)",
    ...rk({ hs: "59865392.63f8ca10.585fa57b.dad29d3a", me: "2100017", raw: '{"page":"shop","type":"pict","col":1,"cat":"1","ban":2762506,"amp":false}' }) },
  { id: "experiences", side: "right", partner: "rakuten", name: "楽天トラベル 観光体験", alt: "現地の観光体験を楽天トラベルで予約する", size: 250, rate: "観光体験 2%(専用のバナー経由)",
    ...rk({ hs: "59865479.483ffafe.585fa57b.dad29d3a", me: "2100034", raw: '{"page":"shop","type":"pict","col":1,"cat":1,"ban":2185638,"amp":false}' }) },
];

/**
 * ページごとの並び(上から。2026-11-15 運営者の依頼で、今週末・今月・日付と場所で探すページにも出す)。書いていないページは、RAIL_BANNERS の side と順のまま。
 * 画面の高さで下から隠れ、バリューコマースの広告(じゃらん・JTB・日本旅行)は広告の同意がないと出ないので、
 * どの並びも、上のほうに「そのページの人に合うもの」を置き、同意がなくても楽天のバナーが左右に2つずつ残るようにする。
 * - 今週末: もうすぐ出かける人。右は 車(レンタカー)→ 現地の体験 → JR+ホテル。左は 直前の予約に強いじゃらんを先に。右の列の「週末の宿を探す」の横に、宿ではないものを並べる
 * - 今月: 数週間先の予定を立てる人。開催ページと同じ並び(右は JR+ホテル → レンタカー → 体験)
 * - 日付・場所で探す: 先の日付・遠くの地域まで調べる人。右は JR+ホテル → 体験 → レンタカー。左は 旅行会社のJTBを先に
 */
export const RAIL_ORDER = {
  "/weekend.html": { left: ["ryokan", "onsen-rotenburo", "onsen", "onsen-gensen"], right: ["rentacar", "experiences", "jr-hotel"] },
  "/calendar.html": { left: ["onsen", "onsen-rotenburo", "ryokan", "onsen-gensen"], right: ["jr-hotel", "experiences", "rentacar"] },
};
const RAIL_EXTRA_PAGES = ["/weekend.html", "/this-month.html", "/calendar.html"];

/** PR 枠を出すページか(開催・定期公演・都道府県・神楽の種類と、今週末・今月・日付と場所で探す) */
export const railPage = (path) => /^\/(events|regular|pref|kagura)\//.test(path) || RAIL_EXTRA_PAGES.includes(path);

/** そのページの、左右それぞれのバナー(上から) */
export const railBannersFor = (path, s) => RAIL_ORDER[path]
  ? RAIL_ORDER[path][s].map((id) => RAIL_BANNERS.find((b) => b.id === id))
  : RAIL_BANNERS.filter((b) => b.side === s);

/**
 * 両サイドの PR 枠。on: { rakuten, jalan, jtb, nta }(提携IDが設定されているか。jtb・nta はバリューコマースのサイトIDと同意の仕組みがそろっているか)。attrs(on, name): 外部リンクの属性。wide: 本文が広いページか
 * 枠ごとに、下の右端に「PR」を1つ(ほかの広告の枠と同じ決まり)。
 * path: ページのパス(並びを決める。RAIL_ORDER)。car: 開催・定期公演のページの「車で行くなら」の枠(2026-11-15 運営者の依頼)。右の枠のいちばん上に置き、中身の重なる楽天のレンタカーのバナーは出さない
 */
export function sideRailHtml({ on, attrs, esc, wide = false, car = "", path = "" }) {
  const side = (s) => {
    const banners = railBannersFor(path, s).filter((b) => on[b.partner] && !(car && b.id === "rentacar")).map((b) => b.vc
      ? vcTag({ kind: b.vc, className: "rail-banner", meta: { "data-goatcounter-click": `rail-${b.partner}/${b.id}`, "data-banner-partner": b.partner } })
      : `<a class="rail-banner" href="${esc(b.url)}" ${attrs(true, `rail-${b.partner}/${b.id}`)} data-banner-partner="${b.partner}"><img src="${esc(b.imageUrl)}" alt="${esc(b.alt)}" width="${b.size}" height="${b.size}" loading="lazy" decoding="async"></a>`);
    const items = s === "right" && car ? [car, ...banners] : banners;
    return items.length ? `<aside class="side-rail side-rail-${s === "left" ? "l" : "r"}${wide ? " w" : ""}" aria-label="広告">${items.join("")}<span class="pr pr-foot">PR</span></aside>` : "";
  };
  return side("left") + side("right");
}
