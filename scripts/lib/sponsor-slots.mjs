// 協賛枠(PR)の置き場所。MON-2
// データは data/sponsors.json(最初は空)。契約が決まった協賛だけを、運営者が手で登録する。
// - 開催情報とは別の枠に、「PR」(記事広告は「PR記事」)と表示して載せる。リンクは rel="sponsored"。
// - 協賛の有無で、開催情報の掲載・並び順・本文は変えない(枠は、あればページの上のほうに出す: 県・種類のページは説明の直後、開催・定期公演のページは右の列の先頭。なければ何も出さない)。
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
//   "placements": [ { "page": "area", "prefecture": "島根県", "cities": ["大田市", "浜田市"] } ] }
// placements の page:
// - area(地域。おすすめ): その地域(県、または県の中の市町村)の、県のページ・開催のページ・定期公演のページ・神楽の種類のページ(その地域の開催があるもの)に、まとめて出す。
//   ひとつの祭りや公演が終わっても、地域のほかのページで出続ける(1年を通して載せられる)。prefecture は必須、cities は任意(郡は書いても書かなくてもよい。政令市は区も含む)。
// - pref(県のページ)・kagura(神楽の種類のページ)・event(開催のページ)・regular(定期公演のページ): そのページだけに出す。
//   条件(prefecture・kagura・city・id)は、書いたものがすべて、そのページの値と一致したときだけ出す。条件が1つもない置き場所は誤りとする。
// 祭りの時期が過ぎると載る場所がなくなる置き場所もあるため、sponsorCoverage で「契約の終わりまで載り続けるか」を確かめる(公開のビルドと管理者用ページが知らせる)。

const PAGES = ["area", "pref", "kagura", "event", "regular"];
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
      else if (p.page === "area") {
        if (!String(p.prefecture ?? "").trim()) errs.push(`${at}: area には prefecture(県)が必要`);
        if (p.cities != null && (!Array.isArray(p.cities) || !p.cities.length || p.cities.some((c) => typeof c !== "string" || !c.trim()))) errs.push(`${at}: area の cities は、市町村名の配列(書かないときは県全体)`);
        if (KEYS.some((k) => k !== "prefecture" && p[k] != null)) errs.push(`${at}: area に書ける条件は prefecture と cities だけ`);
      }
      else if (!KEYS.some((k) => String(p[k] ?? "").trim())) errs.push(`${at}: placements に条件(${KEYS.join("・")})が1つもありません`);
    }
  }
  return errs;
}

/** その日に出してよい協賛だけを、決まった順で返す */
export const activeSponsors = (list, today) =>
  (Array.isArray(list) ? list : []).filter((s) => s.approved === true && s.start <= today && today <= s.end)
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));

const town = (c = "") => String(c).replace(/^.+?郡/, "");
/** 市町村が、地域の cities に入るか(郡は除いて比べる。「広島市」は「広島市安佐北区」も含む) */
const inCities = (city, cities) => cities.some((c) => town(city) === town(c) || (town(city).startsWith(town(c)) && /市$/.test(c) && /区$/.test(city)));
const inArea = (p, x) => x.prefecture === p.prefecture && (!p.cities || inCities(x.city ?? "", p.cities));
/** その置き場所が、そのページに当てはまるか。ctx.places は、神楽の種類のページに載っている開催・定期公演の場所の一覧 */
const matches = (p, page, ctx) => {
  if (p.page === "area") {
    if (page === "pref") return ctx.prefecture === p.prefecture;
    if (page === "kagura") return (ctx.places ?? []).some((x) => inArea(p, x));
    return ["event", "regular"].includes(page) && inArea(p, ctx);
  }
  return p.page === page && KEYS.every((k) => !String(p[k] ?? "").trim() || p[k] === ctx[k]);
};

/**
 * 協賛枠の HTML(当てはまる協賛がなければ空文字)
 * @param {object[]} active activeSponsors の結果
 * @param {"pref"|"kagura"|"event"|"regular"} page
 * @param {{prefecture?:string,kagura?:string,city?:string,id?:string,places?:{prefecture:string,city?:string}[]}} ctx そのページの値(places は神楽の種類のページだけ)
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

/**
 * 協賛が「どこに・いつまで」載るかの見込み(契約の終わりまで載り続けるかを確かめる)。
 * 今日以降に載る契約(approved・end が今日以降)ごとに、いま載るページの数(種類ごと)と、載る場所が続く最後の日を返す。
 * - 開催のページは、その開催の日まで。定期公演のページは until まで(なければ続く)。
 * - 県・神楽の種類のページは、検索に出ている間(これからの開催か定期公演がある間)。
 * last: null は「定期公演などがあり、終わりの見込みがない(続く)」。short: 契約の終わり(end)より前に、載る場所がなくなる見込み。
 * @param {object[]} list sponsors.json
 * @param {{events:object[], regular:object[], today:string, drafts?:boolean}} o events は掲載中(published)のもの。終わった開催は数えない。drafts: 未承認(approved:false)の下書きも見込みに入れる(契約の前に、載る場所を確かめる用)
 */
export function sponsorCoverage(list, { events = [], regular = [], today, drafts = false }) {
  const lastOf = (e) => (e.end || e.start).slice(0, 10);
  const evs = events.filter((e) => (e.status ?? "published") === "published" && lastOf(e) >= today);
  const regs = regular.filter((r) => !r.until || r.until >= today);
  // 載る場所の候補: [種類, そのページの値, そのページが続く最後の日(null は続く)]
  const group = (key) => {
    const m = new Map();
    for (const x of [...evs, ...regs]) {
      const k = x[key]; if (!k) continue;
      const g = m.get(k) ?? { places: [], last: "" };
      g.places.push({ prefecture: x.prefecture, city: x.city ?? "" });
      const l = x.start ? lastOf(x) : x.until ?? null;
      g.last = g.last === null || l === null ? null : (l > g.last ? l : g.last);
      m.set(k, g);
    }
    return m;
  };
  const pages = [
    ...evs.map((e) => ["event", e, lastOf(e)]),
    ...regs.map((r) => ["regular", r, r.until ?? null]),
    ...[...group("prefecture")].map(([p, g]) => ["pref", { prefecture: p }, g.last]),
    ...[...group("kagura")].map(([k, g]) => ["kagura", { kagura: k, places: g.places }, g.last]),
  ];
  return (Array.isArray(list) ? list : []).filter((s) => (s?.approved === true || (drafts && s?.approved === false)) && s.end >= today && Array.isArray(s.placements))
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id))
    .map((s) => {
      const hit = pages.filter(([page, ctx]) => s.placements.some((p) => matches(p, page, ctx)));
      const count = Object.fromEntries(["pref", "kagura", "event", "regular"].map((t) => [t, hit.filter(([page]) => page === t).length]));
      const last = !hit.length ? "" : hit.some(([, , l]) => l === null) ? null : hit.map(([, , l]) => l).sort().at(-1);
      return { id: s.id, sponsor: s.sponsor, approved: s.approved, start: s.start, end: s.end, pages: hit.length, count, last, short: last !== null && last < s.end };
    });
}
