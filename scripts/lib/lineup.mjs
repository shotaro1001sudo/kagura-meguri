// 出演する神楽団と演目(開催データの lineup)。神楽団ページ(/troupe/)・演目ページ(/program/)と、開催ページの「出演」の行に使う。
//   lineup: [{ "troupe": "津浪神楽団", "programs": ["八岐大蛇"] }, ...]  programs は空でもよい(演目が未発表)
//   lineupMore: true … 掲載したほかにも出演がある(「ほか」と表示する)
// 名前は公式の表記のまま持つ(「神楽團」と「神楽団」はまとめない)。演目だけ、同じものの表記の違いをまとめる。
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ファイル名(ページのURL)に使えない文字
const BAD = /[\\/?#%<>:*"|\u0000-\u001f\u007f「」]/;
export const LIMITS = { troupe: 40, program: 30, troupes: 30, programs: 10 };

// 同じ演目の表記の違い → まとめる名前(ページの名前)。別の演目を混ぜないよう、確かなものだけを足す
export const PROGRAM_ALIASES = { "瀧夜叉姫": "滝夜叉姫", "大蛇": "八岐大蛇", "八岐の大蛇": "八岐大蛇", "紅葉狩り": "紅葉狩" };
export const programKey = (p) => PROGRAM_ALIASES[p] ?? p;
/** まとめた演目の、すべての表記(ページの名前が先頭) */
export const programNames = (key) => [key, ...Object.entries(PROGRAM_ALIASES).filter(([, v]) => v === key).map(([k]) => k)];

export const troupeHref = (t) => `/troupe/${encodeURIComponent(t)}.html`;
export const programHref = (p) => `/program/${encodeURIComponent(programKey(p))}.html`;
export const troupesOf = (e) => (e.lineup ?? []).map((x) => x.troupe);

/** 開催データの lineup を確かめる。問題があれば理由の一覧を返す */
export function checkLineup(e) {
  const errs = [];
  if (e.lineup == null) return e.lineupMore == null ? errs : ["lineupMore は lineup と一緒に使ってください"];
  if (!Array.isArray(e.lineup)) return ["lineup は配列にしてください"];
  if (e.lineup.length > LIMITS.troupes) errs.push(`lineup は${LIMITS.troupes}団体までにしてください`);
  if (e.lineupMore != null && typeof e.lineupMore !== "boolean") errs.push("lineupMore は true か false にしてください");
  const seen = new Set();
  for (const x of e.lineup) {
    const t = x?.troupe;
    if (typeof t !== "string" || !t.trim() || t !== t.trim() || t.length > LIMITS.troupe || BAD.test(t)) { errs.push(`出演団体の名前が正しくありません(${String(t)})。${LIMITS.troupe}字まで、記号 / ? # % < > : * " | 「」 は使えません`); continue; }
    if (seen.has(t)) errs.push(`出演団体が重複しています(${t})。演目は1つの団体にまとめてください`);
    seen.add(t);
    if (!Array.isArray(x.programs)) { errs.push(`${t} の programs は配列にしてください(演目が未発表なら [])`); continue; }
    if (x.programs.length > LIMITS.programs) errs.push(`${t} の演目は${LIMITS.programs}までにしてください`);
    for (const p of x.programs) if (typeof p !== "string" || !p.trim() || p !== p.trim() || p.length > LIMITS.program || BAD.test(p)) errs.push(`${t} の演目の名前が正しくありません(${String(p)})。${LIMITS.program}字まで、記号と「」は使えません`);
    if (new Set(x.programs).size !== x.programs.length) errs.push(`${t} の演目が重複しています`);
    for (const k of Object.keys(x)) if (!["troupe", "programs"].includes(k)) errs.push(`${t} に不明な項目 ${k} があります`);
  }
  return errs;
}

/**
 * 管理者用ページの入力(1行に1団体。「団体: 演目、演目」)を、lineup にする。
 * 演目の「」は外す。区切りは「、」「,」(「大鬼・小鬼」のように「・」を含む演目があるため、「・」では分けない)
 */
export function parseLineupText(text = "") {
  const lineup = [];
  for (const raw of String(text).replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^([^:：]+?)\s*[:：]\s*(.*)$/);
    const troupe = (m ? m[1] : line).trim();
    const programs = m ? m[2].split(/[、,，]/).map((p) => p.trim().replace(/^「(.*)」$/, "$1").trim()).filter(Boolean) : [];
    const same = lineup.find((x) => x.troupe === troupe);
    if (same) same.programs.push(...programs.filter((p) => !same.programs.includes(p)));
    else lineup.push({ troupe, programs: [...new Set(programs)] });
  }
  return lineup;
}
/** lineup を、管理者用ページの入力の形に戻す */
export const lineupText = (lineup = []) => lineup.map((x) => (x.programs.length ? `${x.troupe}: ${x.programs.join("、")}` : x.troupe)).join("\n");

/** 開催ページの「出演」の行(神楽団と演目へのリンク) */
export function lineupCell(e) {
  const items = (e.lineup ?? []).map((x) => `<li><a href="${troupeHref(x.troupe)}">${esc(x.troupe)}</a>${x.programs.length ? `<span class="lp">${x.programs.map((p) => `<a href="${programHref(p)}">「${esc(p)}」</a>`).join("")}</span>` : ""}</li>`);
  if (e.lineupMore) items.push('<li class="lp-more">ほか</li>');
  return `<ul class="lineup">${items.join("")}</ul>`;
}

/** 一覧のカードに出す、短い出演の表示(3団体まで。リンクにはしない) */
export function lineupShort(e) {
  const t = troupesOf(e);
  if (!t.length) return "";
  const more = t.length > 3 || e.lineupMore;
  return `${t.slice(0, 3).join("・")}${more ? " ほか" : ""}`;
}
