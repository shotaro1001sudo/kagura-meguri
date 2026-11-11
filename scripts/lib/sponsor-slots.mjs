// 協賛枠(PR)の置き場所。MON-2
// データは data/sponsors.json(最初は空)。契約が決まった協賛だけを、運営者が手で登録する。
// - 開催情報とは別の枠に、「PR」(記事広告は「PR記事」)と表示して載せる。リンクは rel="sponsored"。
// - 協賛の有無で、開催情報の掲載・並び順・本文は変えない(この枠は、開催の一覧の後ろ・広告の枠の並びに置く)。
// - 期間(start〜end、日本時間の日付)の外は出さない。approved:true のものだけ。1ページに最大2件。
// - 並び順は、始まった日・ID の順(料金で順を変えない)。
// - 閲覧数などの数字は、ここにも書かない。
//
// 1件の形:
// { "id": "shimane-kanko-2026-12",           英小文字・数字・ハイフン
//   "kind": "monthly" | "article",           月額の協賛 / 1回ごとの記事広告(取材記事)
//   "sponsor": "◯◯観光協会",                 提供者の名前(必ず表示する)
//   "title": "…", "text": "…",               見出し(40字まで)・ひとこと(120字まで)
//   "url": "https://…" または "/pr/….html",  リンク先
//   "start": "2026-12-01", "end": "2026-12-31",
//   "approved": true, "contractRef": "…",     契約・確認の控え(ページには出さない)
//   "placements": [ { "page": "pref", "prefecture": "島根県" }, { "page": "event", "prefecture": "島根県", "kagura": "石見神楽" } ] }
// placements の page: pref(県のページ)・kagura(神楽の種類のページ)・event(開催のページ)・regular(定期公演のページ)・feature(特集のページ。id に特集の ID。例: { "page": "feature", "id": "tohyama-shimotsuki" })。
// 条件(prefecture・kagura・city・id)は、書いたものがすべて、そのページの値と一致したときだけ出す。条件が1つもない置き場所は誤りとする。

const PAGES = ["pref", "kagura", "event", "regular", "feature"];
const KEYS = ["prefecture", "kagura", "city", "id"];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const URL_OK = /^(https:\/\/[^\s"'<>]+|\/[^\s"'<>]*)$/;
export const SPONSOR_MAX_PER_PAGE = 2;

/** データの誤りを、文の配列で返す(空なら正しい) */
export function sponsorErrors(list) {
  if (!Array.isArray(list)) return ["sponsors: 配列ではありません"];
  const errs = [], ids = new Set();
  for (const [i, s] of list.entries()) {
    const at = `sponsors[${i}]${s?.id ? `(${s.id})` : ""}`;
    if (!s || typeof s !== "object") { errs.push(`${at}: 形が正しくありません`); continue; }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(s.id ?? "")) errs.push(`${at}: id は英小文字・数字・ハイフン`);
    else if (ids.has(s.id)) errs.push(`${at}: id が重複しています`);
    ids.add(s.id);
    if (!["monthly", "article"].includes(s.kind)) errs.push(`${at}: kind は monthly か article`);
    for (const k of ["sponsor", "title"]) if (!String(s[k] ?? "").trim()) errs.push(`${at}: ${k} がありません`);
    if (String(s.title ?? "").length > 40) errs.push(`${at}: title は40字まで`);
    if (String(s.text ?? "").length > 120) errs.push(`${at}: text は120字まで`);
    if (!URL_OK.test(s.url ?? "") || /^\/\//.test(s.url ?? "")) errs.push(`${at}: url は https:// か / で始まるサイト内のパス`);
    if (!DAY.test(s.start ?? "") || !DAY.test(s.end ?? "") || s.start > s.end) errs.push(`${at}: start・end は YYYY-MM-DD で、start ≦ end`);
    if (typeof s.approved !== "boolean") errs.push(`${at}: approved は true か false`);
    if (s.approved && !String(s.contractRef ?? "").trim()) errs.push(`${at}: approved:true には contractRef(契約・確認の控え)が必要`);
    if (!Array.isArray(s.placements) || !s.placements.length) errs.push(`${at}: placements がありません`);
    else for (const p of s.placements) {
      if (!PAGES.includes(p?.page)) errs.push(`${at}: placements の page は ${PAGES.join("・")} のどれか`);
      else if (!KEYS.some((k) => String(p[k] ?? "").trim())) errs.push(`${at}: placements に条件(${KEYS.join("・")})が1つもありません`);
    }
  }
  return errs;
}

/** その日に出してよい協賛だけを、決まった順で返す */
export const activeSponsors = (list, today) =>
  (Array.isArray(list) ? list : []).filter((s) => s.approved === true && s.start <= today && today <= s.end)
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));

const matches = (p, page, ctx) => p.page === page && KEYS.every((k) => !String(p[k] ?? "").trim() || p[k] === ctx[k]);

/**
 * 協賛枠の HTML(当てはまる協賛がなければ空文字)
 * @param {object[]} active activeSponsors の結果
 * @param {"pref"|"kagura"|"event"|"regular"|"feature"} page
 * @param {{prefecture?:string,kagura?:string,city?:string,id?:string}} ctx そのページの値
 */
export function sponsorSlot(active, page, ctx, { esc, side = false }) {
  const hit = active.filter((s) => s.placements.some((p) => matches(p, page, ctx))).slice(0, SPONSOR_MAX_PER_PAGE);
  if (!hit.length) return "";
  const item = (s) => {
    const external = /^https:/.test(s.url);
    const label = s.kind === "article" ? "PR記事" : "PR";
    return `<li class="sp-item" data-sponsor="${esc(s.id)}"><span class="pr">${label}</span><a href="${esc(s.url)}" rel="sponsored${external ? " noopener" : ""}"${external ? ' target="_blank"' : ""} data-goatcounter-click="sponsor/${esc(s.id)}" data-goatcounter-title="sponsor/${esc(s.id)}">${esc(s.title)}</a>${s.text ? `<p>${esc(s.text)}</p>` : ""}<p class="sp-by">提供: ${esc(s.sponsor)}</p></li>`;
  };
  return `<aside class="sponsor-slot${side ? " side" : ""}" aria-label="地域の協賛(PR)"><p class="sp-head">地域の協賛</p><ul>${hit.map(item).join("")}</ul><p class="sp-note">協賛の有無で、開催情報の掲載や並び順は変わりません。<a href="/sponsor.html">広告・協賛のご案内</a></p></aside>`;
}
