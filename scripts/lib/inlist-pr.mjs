// 一覧の途中にはさむ帯の、先頭の中身(2026-11-15 運営者の依頼。同日に「案3だけ」= 何本目かで中身を分ける形にした。帯ごとの見出しとバナーは side-rail.mjs の INLIST_THEMES)。
//
// 毎日のビルドで、そのときの一覧から作り直す。運営者が手で直すところはない:
// - 宿(1本目の帯だけ): 帯の直前の5件で、いちばん多い場所(同じ数なら先に出てくる場所)の、いちばん早い日の1泊・大人2名の検索を、楽天トラベルで開く。
//   場所は会場の市区町村(郡は外す。STAY_AREA の呼びかえも同じ)。日付が今日より前(続いている開催)なら、今日にする。
// - 協賛: その5件のどれかが、契約中の協賛(data/sponsors.json の area など)の地域に当てはまれば、その協賛を出す。
//   契約を登録すれば、次のビルドから自動で出る(期間が終われば自動で消える)。
// - 協賛の募集: 当てはまる協賛がないとき、その一覧の2本目の帯(帯が1本だけなら1本目)に1回だけ出す。料金は config.json の sponsorPrices から。
// - クリックの名前: 帯の何本目か(list1・list2…)を入れる。宿は rail-rakuten/listN-stay、バナーは rail-rakuten/listN-<バナーのID>
//   (GA4 の配置は side_rail のまま。中身のIDで見分ける)、協賛は sponsor/<ID>/inlist、募集は sponsor-recruit/listN。
//
// この関数は、日付と場所で探すページのスクリプトの中にも、そのまま入れる(検索の結果がブラウザで決まるため)。
// そのため、外のもの(import・ほかの関数)は使わない。古いブラウザでも動く書き方にする。
/**
 * @param {{prefecture:string, city?:string, day:string, id?:string}[]} items 帯の直前の5件(day は YYYY-MM-DD)
 * @param {number} k 一覧の中で何本目の帯か(0 から)
 * @param {number} total その一覧に入る帯の数
 * @param {{affId?:string, today:string, stayArea?:Record<string,string>, esc:(s:string)=>string, sponsorTile?:(x:object)=>string, recruit?:string}} o
 *   affId: 楽天アフィリエイトのID(なければ宿は出さない)。sponsorTile: その開催に当てはまる協賛のマス(なければ "")。recruit: 募集のマス(@N@ が帯の番号になる)
 * @returns {string[]} 帯の先頭に並べるマス
 */
export function inlistLead(items, k, total, o) {
  var WD = ["日", "月", "火", "水", "木", "金", "土"], n = {}, first = {}, best = "", out = [], i, sp = "";
  function place(x) { var c = x.city ? String(x.city).replace(/^.*郡/, "") : x.prefecture || ""; return (o.stayArea && o.stayArea[c]) || c; }
  for (i = 0; i < items.length; i++) {
    var p = place(items[i]), d = String(items[i].day || "");
    if (!p || !/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    n[p] = (n[p] || 0) + 1;
    if (!first[p] || d < first[p]) first[p] = d;
    if (!best || n[p] > n[best]) best = p;
  }
  if (k === 0 && best && o.affId) {
    var day = first[best] < o.today ? o.today : first[best];
    var t = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10))), u = new Date(t.getTime() + 864e5);
    var dest = "https://kw.travel.rakuten.co.jp/keyword/Search.do?" + ["charset=utf-8", "f_query=" + encodeURIComponent(best),
      "f_nen1=" + t.getUTCFullYear(), "f_tuki1=" + (t.getUTCMonth() + 1), "f_hi1=" + t.getUTCDate(),
      "f_nen2=" + u.getUTCFullYear(), "f_tuki2=" + (u.getUTCMonth() + 1), "f_hi2=" + u.getUTCDate(), "f_otona_su=2", "f_heya_su=1"].join("&");
    var href = "https://hb.afl.rakuten.co.jp/hgc/" + o.affId + "/?pc=" + encodeURIComponent(dest) + "&m=" + encodeURIComponent(dest);
    var name = "rail-rakuten/list" + (k + 1) + "-stay";
    out.push('<a class="strip-banner strip-text strip-stay" href="' + o.esc(href) + '" rel="sponsored noopener" target="_blank" data-goatcounter-click="' + name + '" data-goatcounter-title="' + name + '" data-banner-partner="rakuten">'
      + '<b>' + (t.getUTCMonth() + 1) + "月" + t.getUTCDate() + "日(" + WD[t.getUTCDay()] + ")</b><span>" + o.esc(best) + "周辺の宿</span><small>楽天トラベルで探す</small></a>");
  }
  if (o.sponsorTile) for (i = 0; i < items.length && !sp; i++) sp = o.sponsorTile(items[i]) || "";
  if (sp) out.push(sp);
  else if (o.recruit && (k === 1 || (k === 0 && total === 1))) out.push(o.recruit.replace(/@N@/g, String(k + 1)));
  return out;
}

/** 一覧に入る帯の数(5件ごと。最後の件のあとには入れない) */
export const inlistCount = (len, every) => Math.max(0, Math.floor((len - 1) / every));
