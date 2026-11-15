// 一覧の途中にはさむ帯の、先頭の中身(2026-11-15 運営者の依頼。帯ごとの見出しとバナーは side-rail.mjs の INLIST_THEMES)。
//
// 毎日のビルドで、そのときの一覧から作り直す。運営者が手で直すところはない:
// - 協賛: 帯の直前の5件のどれかが、契約中の協賛(data/sponsors.json の area など)の地域に当てはまれば、その協賛を出す。
//   契約を登録すれば、次のビルドから自動で出る(期間が終われば自動で消える)。帯には1個だけ出すので、どの帯でも協賛がいちばん先。
// - 当てはまる協賛がなければ、その帯のバナー(INLIST_THEMES。公演の掲載・宿・協賛のご案内・体験…)が出る。
//   (同日まで出していた「直前の5件に合わせた宿の検索」と「協賛の募集」の文字のマスは、運営者の依頼で、画像のバナーに置きかえた)
// - クリックの名前: 協賛は sponsor/<ID>/inlist。
//
// この関数は、日付と場所で探すページのスクリプトの中にも、そのまま入れる(検索の結果がブラウザで決まるため)。
// そのため、外のもの(import・ほかの関数)は使わない。古いブラウザでも動く書き方にする。
/**
 * @param {{prefecture:string, city?:string, day:string, id?:string}[]} items 帯の直前の5件(day は YYYY-MM-DD)
 * @param {number} k 一覧の中で何本目の帯か(0 から)
 * @param {number} total その一覧に入る帯の数
 * @param {{sponsorTile?:(x:object)=>string}} o sponsorTile: その開催に当てはまる協賛のマス(なければ "")
 * @returns {string[]} 出す候補のマス(先頭が出る。空なら、その帯のバナー)
 */
export function inlistLead(items, k, total, o) {
  var i, sp = "";
  if (o.sponsorTile) for (i = 0; i < items.length && !sp; i++) sp = o.sponsorTile(items[i]) || "";
  return sp ? [sp] : [];
}

/** 一覧に入る帯の数(5件ごと。最後の件のあとには入れない) */
export const inlistCount = (len, every) => Math.max(0, Math.floor((len - 1) / every));
