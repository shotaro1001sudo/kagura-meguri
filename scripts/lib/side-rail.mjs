import { vcTag } from "./valuecommerce.mjs";
// PC の画面の両サイドの PR 枠(2026-11-15 運営者の依頼)。
// 出すのは、開催・定期公演・都道府県・神楽の種類のページと、今週末・今月・日付と場所で探す・地図で探すページ(同日に追加)だけ。幅の広い画面だけに出し、スマホや幅のせまい画面では出さない。
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

/** side: 左右のどちらの枠か(開催・定期公演・都道府県・神楽の種類のページ)。並びは、配列の順(上から)。rate は記録だけで、ページには出さない */
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
  // ここから下は、探すページ向けに足した楽天トラベルのバナー(2026-11-15 に同じ管理画面で発行。side なし = RAIL_ORDER に書いたページだけに出す)。料率は、管理画面のリンク作成の画面の表示(1.0%)
  // 絵柄に、日付の決まった催し・割引率・人物の入ったもの(秋冬SALE、5と0のつく日、人気温泉地20%OFF など)は、内容が合わなくなるので選ばない
  { id: "bus", partner: "rakuten", name: "楽天トラベル 高速バス", alt: "高速バス・観光バスを楽天トラベルで予約する", size: 300, rate: "1%",
    ...rk({ hs: "598ad61b.b9aefa3b.585fa57b.dad29d3a", me: "2100001", raw: '{"page":"shop","type":"pict","col":1,"cat":"118","ban":2189627,"amp":false}' }) },
  { id: "tour", partner: "rakuten", name: "楽天トラベル 国内ツアー", alt: "航空券と宿の国内ツアーを楽天トラベルで探す", size: 300, rate: "1%",
    ...rk({ hs: "598ad703.7cf5a466.585fa57b.dad29d3a", me: "2100001", raw: '{"page":"shop","type":"pict","col":1,"cat":"27","ban":2188663,"amp":false}' }) },
  { id: "station", partner: "rakuten", name: "楽天トラベル", alt: "駅・空港の名前から宿を楽天トラベルで探す", size: 240, rate: "宿泊 1%",
    ...rk({ hs: "598ad749.f69e4450.585fa57b.dad29d3a", me: "2100001", raw: '{"page":"shop","type":"pict","col":1,"cat":"63","ban":615648,"amp":false}' }) },
];

/**
 * ページごとの並び(上から。2026-11-15 運営者の依頼で、今週末・今月・日付と場所で探す・地図で探すページにも出す)。書いていないページは、RAIL_BANNERS の side と順のまま。
 * 画面の高さで下から隠れ(高さ 900px 未満は上から3つ、720px 未満は2つ)、バリューコマースの広告(じゃらん・JTB・日本旅行)は広告の同意がないと出ないので、
 * どの並びも、上のほうに「そのページの人に合うもの」を置き、同意がなくても楽天のバナーが左右に2つ以上残るようにする。
 * - 今週末: もうすぐ出かける人。右は 行き方(レンタカー → 高速バス)→ 現地の体験 → JR+ホテル。左は 直前の予約に強いじゃらんを先に。右の列の「週末の宿を探す」の横に、宿ではないものを並べる
 * - 今月: 数週間先の予定を立てる人。右は JR+ホテル → レンタカー → 高速バス → 体験。左は開催ページと同じ
 * - 日付・場所で探す: 先の日付・遠くの地域まで調べる人。右は JR+ホテル → 国内ツアー(航空券+宿)→ 体験 → レンタカー。左は 旅行会社のJTB → 駅・空港から宿を検索
 * - 地図で探す: 場所から探す人。右は 行き方(レンタカー → 高速バス → JR+ホテル)→ 体験。左は 駅・空港から宿を検索 を先に
 */
export const RAIL_ORDER = {
  "/weekend.html": { left: ["ryokan", "onsen-rotenburo", "onsen", "onsen-gensen"], right: ["rentacar", "bus", "experiences", "jr-hotel"] },
  "/this-month.html": { left: ["onsen-rotenburo", "ryokan", "onsen", "onsen-gensen"], right: ["jr-hotel", "rentacar", "bus", "experiences"] },
  "/calendar.html": { left: ["onsen", "station", "ryokan", "onsen-rotenburo"], right: ["jr-hotel", "tour", "experiences", "rentacar"] },
  "/map.html": { left: ["station", "ryokan", "onsen-rotenburo", "onsen"], right: ["rentacar", "bus", "jr-hotel", "experiences"] },
};

/** PR 枠を出すページか(開催・定期公演・都道府県・神楽の種類と、今週末・今月・日付と場所で探す・地図で探す) */
export const railPage = (path) => /^\/(events|regular|pref|kagura)\//.test(path) || Object.hasOwn(RAIL_ORDER, path);

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
      ? vcTag({ kind: b.vc, className: "rail-banner", meta: { "data-goatcounter-click": `rail-${b.partner}/${b.id}`, "data-banner-partner": b.partner, "data-vc-media": railMedia(wide) } })
      : `<a class="rail-banner" href="${esc(b.url)}" ${attrs(true, `rail-${b.partner}/${b.id}`)} data-banner-partner="${b.partner}"><img src="${esc(b.imageUrl)}" alt="${esc(b.alt)}" width="${b.size}" height="${b.size}" loading="lazy" decoding="async"></a>`);
    const items = s === "right" && car ? [car, ...banners] : banners;
    return items.length ? `<aside class="side-rail side-rail-${s === "left" ? "l" : "r"}${wide ? " w" : ""}" aria-label="広告">${items.join("")}<span class="pr pr-foot">PR</span></aside>` : "";
  };
  return side("left") + side("right");
}

// 両サイドの PR 枠が出る画面の条件(style.css の @media と同じ)。バリューコマースの広告は、この条件に合う画面でだけ読み込む(スマホでは読み込まない)
export const railMedia = (wide) => `(min-width:${wide ? 1400 : 1280}px) and (min-height:520px)`;
// 帯が出る画面の条件 = 本文が広いページ(公演ページ)で、両サイドの PR 枠が出ない画面
export const STRIP_MEDIA = `not all and ${railMedia(true)}`;

/**
 * スマホなど、両サイドの PR 枠が出ない画面向けの帯「旅の手配」(2026-11-15 運営者の依頼)。公演ページ(開催・定期公演)の、宿・体験の枠のすぐ下に1本だけ置く。
 * 横に送って見るバナーの列。公演の概要・宿・体験より上には置かない(宿・体験は、今後、協賛枠にするかもしれないので、帯は必ずその下)。
 * 並び: 行き方(レンタカー・カーシェア = lead。「車で行くなら」の枠をここにまとめる)→ JR+ホテル → 高速バス → 温泉宿(JTB)→ 露天風呂の宿(楽天)。
 * 体験のバナーは、すぐ上の体験の枠と重なるので入れない。宿の枠と重なる宿のバナーは、最後の2つだけ。
 * クリックの名前は rail-<広告主>/strip-<バナーのID>(GA4 の配置は side_rail のまま。中身のIDの strip- で、帯のクリックと見分ける)
 */
export const STRIP_ORDER = ["jr-hotel", "bus", "onsen", "onsen-rotenburo"];
export function prStripHtml({ on, attrs, esc, lead = [] }) {
  const banners = STRIP_ORDER.map((id) => RAIL_BANNERS.find((b) => b.id === id)).filter((b) => on[b.partner]).map((b) => b.vc
    ? vcTag({ kind: b.vc, className: "strip-banner", meta: { "data-goatcounter-click": `rail-${b.partner}/strip-${b.id}`, "data-banner-partner": b.partner, "data-vc-media": STRIP_MEDIA } })
    : `<a class="strip-banner" href="${esc(b.url)}" ${attrs(true, `rail-${b.partner}/strip-${b.id}`)} data-banner-partner="${b.partner}"><img src="${esc(b.imageUrl)}" alt="${esc(b.alt)}" width="${b.size}" height="${b.size}" loading="lazy" decoding="async"></a>`);
  const items = [...lead, ...banners];
  return items.length ? `<aside class="pr-strip" aria-labelledby="pr-strip-h"><h2 id="pr-strip-h">旅の手配</h2><div class="pr-strip-row" role="group" aria-label="旅の手配の広告(横に送って見られます)" tabindex="0">${items.join("")}</div><span class="pr pr-foot">PR</span></aside>` : "";
}
