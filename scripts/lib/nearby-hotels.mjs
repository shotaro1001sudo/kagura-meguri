// 会場の近くの宿(楽天トラベルの施設検索 API の結果)を、開催ページのカードにする(MON-6)。
// 取得は scripts/fetch-hotels.mjs(公開のたび)。ここは、検査と表示だけ。
export const HOTEL_RADIUS_KM = 3; // API の上限(3km)
export const HOTELS_PER_EVENT = 3;
export const HOTEL_LOOKAHEAD_DAYS = 120; // 先すぎる開催は、料金が当日とずれるので出さない
export const HOTEL_MAX_AGE_DAYS = 3; // 取得から日がたったデータは出さない(料金が古くなるため)
export const HOTEL_IMG_HOST = "https://img.travel.rakuten.co.jp";
const AFF_HOST = "https://hb.afl.rakuten.co.jp/";

const str = (v, max) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** API の応答(formatVersion 1 / 2 どちらも)から、表示してよい宿だけを取り出す。
 *  リンクは楽天アフィリエイトの URL(affiliateId を付けて取った URL)だけ、写真は楽天トラベルの画像の URL だけ。 */
export function cleanHotels(json) {
  const rows = (json?.hotels ?? []).map((h) => {
    const parts = Array.isArray(h) ? h : Array.isArray(h?.hotel) ? h.hotel : [];
    return Object.assign({}, ...parts.filter((p) => p && typeof p === "object"));
  });
  const out = [], seen = new Set();
  for (const r of rows) {
    const b = r.hotelBasicInfo ?? {};
    const no = Number(b.hotelNo), name = str(b.hotelName, 60), url = str(b.hotelInformationUrl, 2000);
    const image = str(b.hotelImageUrl || b.hotelThumbnailUrl, 500);
    const charge = Number(b.hotelMinCharge);
    if (!no || seen.has(no) || !name || !url.startsWith(AFF_HOST) || !image.startsWith(HOTEL_IMG_HOST + "/")) continue;
    seen.add(no);
    out.push({ no, name, url, image, minCharge: Number.isFinite(charge) && charge > 0 ? Math.round(charge) : null, access: str(b.access, 80), review: Number(b.reviewAverage) > 0 ? Math.round(Number(b.reviewAverage) * 10) / 10 : null });
  }
  return out;
}

/** 書き出したデータを読み、新しいものだけ使う。壊れていたり古いときは空(=カードを出さない) */
export function loadHotels(raw, nowJst) {
  try {
    const d = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!d?.fetchedAt || !d.byEvent) return null;
    const age = (Date.parse(nowJst.slice(0, 10)) - Date.parse(d.fetchedAt.slice(0, 10))) / 864e5;
    if (!(age >= 0 && age <= HOTEL_MAX_AGE_DAYS)) return null;
    const byEvent = {};
    for (const [id, list] of Object.entries(d.byEvent)) {
      const ok = cleanHotels({ hotels: (Array.isArray(list) ? list : []).map((h) => [{ hotelBasicInfo: { hotelNo: h.no, hotelName: h.name, hotelInformationUrl: h.url, hotelImageUrl: h.image, hotelMinCharge: h.minCharge, access: h.access, reviewAverage: h.review } }]) });
      if (ok.length) byEvent[id] = ok.slice(0, HOTELS_PER_EVENT);
    }
    return { fetchedAt: d.fetchedAt, byEvent };
  } catch { return null; }
}

/** 宿のカード。esc: HTML エスケープ、attrs(name): 広告リンクの属性(rel=sponsored など) */
export function hotelCardsHtml(list, { eventId, fetchedAt, esc, attrs }) {
  if (!list?.length) return "";
  const [, m, d] = fetchedAt.slice(0, 10).split("-").map(Number);
  const yen = (n) => n.toLocaleString("ja-JP");
  const items = list.map((h) => `<li><a class="hotel-card" href="${esc(h.url)}" ${attrs(`stay-hotel/${eventId}`)}><img src="${esc(h.image)}" alt="" width="96" height="72" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="hotel-body"><b>${esc(h.name)}</b>${h.minCharge ? `<span class="hotel-price">${yen(h.minCharge)}円〜</span>` : ""}${h.review ? `<span class="hotel-review">評価 ${h.review.toFixed(1)}</span>` : ""}${h.access ? `<small>${esc(h.access)}</small>` : ""}</span></a></li>`).join("");
  return `<div class="hotels"><p class="hotels-h">会場から約${HOTEL_RADIUS_KM}km以内の宿(楽天トラベル)</p><ul class="hotel-cards">${items}</ul><p class="hotels-note">料金は楽天トラベルに載っている最安料金の目安で、${m}月${d}日時点のものです。宿泊日・人数・空室で変わります。<a href="https://webservice.rakuten.co.jp/" target="_blank" rel="noopener">Supported by Rakuten Developers</a></p></div>`;
}
