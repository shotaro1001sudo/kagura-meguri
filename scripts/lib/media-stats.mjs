// 「広告・協賛のご案内」に載せる、アクセス数の参考値(MON-2)。
// - 元は非公開の analytics/series.json(日ごとの GA4・Search Console)と analytics/state.json(ページ別の上位)。
// - 公開用の data/media-stats.json には、丸めた概数だけを書く(上から2桁で切り捨て。日ごとの値・生の数字は書かない)。
//   リポジトリは公開なので、mediaStatsErrors で「丸めていない数字」があればビルドを止める。
// - 集計は直近28日。値が返ってきた日が24日に満たない指標は、載せない(欠けた期間で小さく見せない・大きく見せない)。
// - 検索は、直近7日の値も添える(7日とも返ってきたときだけ)。
// - よく読まれているページは、パスだけ(数字なし。トップページは除く)。
// 作り方: node scripts/media-stats.mjs(週次の分析タスクが、series.json を更新した後に実行する)。

export const STATS_WINDOW = 28;
export const STATS_MIN_DAYS = 24;
export const STATS_MAX_AGE_DAYS = 60;
// 2026-11-14 運営者の依頼: ページに出すのは「1か月間のアクセス数」(直近30日の閲覧数)と「総アクセス数」(計測を始めてからの閲覧数)だけ。
// GA4 は計測に同意した方の分だけで、取得が止まった日もあるため、値のある日が14日以上あれば出す(欠けた日の分は少なめに出るだけで、多くは見せない)
export const MONTH_WINDOW = 30;
export const MONTH_MIN_DAYS = 14; // これより古い集計は、ページに出さない
const TOP_PAGES = 6;

/** 上から2桁を残して切り捨てる(4876 → 4800、19234 → 19000、87 → 87) */
export function roundDown2(n) {
  if (!Number.isFinite(n) || n <= 0) return 0;
  const p = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1);
  return Math.floor(n / p) * p;
}
const isRounded = (n) => Number.isInteger(n) && n >= 0 && roundDown2(n) === n;

/** 「約1.9万」「約4,800」の形 */
export function approx(n) {
  if (n >= 10000) return `約${String(Math.round(n / 1000) / 10).replace(/\.0$/, "")}万`;
  return `約${n.toLocaleString("ja-JP")}`;
}

const addDays = (d, k) => new Date(Date.parse(`${d}T00:00:00Z`) + k * 864e5).toISOString().slice(0, 10);

/** days の中で、key の値がある最後の日から28日をまとめる(返ってきた日が足りなければ null) */
function windowSum(days, keys, size = STATS_WINDOW, min = STATS_MIN_DAYS) {
  const has = (d) => keys.every((k) => Number.isFinite(days[d]?.[k]));
  const last = Object.keys(days).filter(has).sort().at(-1);
  if (!last) return null;
  const from = addDays(last, -(size - 1));
  const inWin = Object.keys(days).filter((d) => d >= from && d <= last && has(d));
  if (inWin.length < min) return null;
  const sums = Object.fromEntries(keys.map((k) => [k, inWin.reduce((s, d) => s + days[d][k], 0)]));
  return { from, to: last, ...sums };
}

/**
 * 公開用の概数を作る
 * @param {{days: Record<string, Record<string, number>>}} series
 * @param {{snapshot?: {gscPages28?: Record<string, any>}}} state
 */
export function computeMediaStats(series, state, today) {
  const days = series?.days ?? {};
  const out = { updated: today, window: STATS_WINDOW };
  const g = windowSum(days, ["gscImpr", "gscClicks"]);
  if (g && g.gscImpr > 0) {
    out.search = { from: g.from, to: g.to, impressions: roundDown2(g.gscImpr), clicks: roundDown2(g.gscClicks) };
    // 直近7日(7日とも返ってきたときだけ)。伸びているサイトなので、4週間の合計だけだと今の規模より小さく見える
    const w = windowSum(days, ["gscImpr", "gscClicks"], 7, 7);
    if (w && w.to === g.to) Object.assign(out.search, { impressions7: roundDown2(w.gscImpr), clicks7: roundDown2(w.gscClicks) });
  }
  const a = windowSum(days, ["pv", "users"], MONTH_WINDOW, MONTH_MIN_DAYS);
  if (a && a.pv > 0) out.analytics = { from: a.from, to: a.to, pageviews: roundDown2(a.pv), users: roundDown2(a.users) };
  // 総アクセス数: 閲覧数の値がある最初の日から、最後の日まで
  const pvDays = Object.keys(days).filter((d) => Number.isFinite(days[d]?.pv)).sort();
  const total = pvDays.reduce((n, d) => n + days[d].pv, 0);
  if (out.analytics && total > 0) out.total = { from: pvDays[0], to: pvDays.at(-1), pageviews: roundDown2(total) };
  const pages = state?.snapshot?.gscPages28 ?? {};
  out.topPages = Object.entries(pages)
    .filter(([p, v]) => p.startsWith("/") && p !== "/" && Array.isArray(v) && Number.isFinite(v[0]))
    .sort((x, y) => y[1][0] - x[1][0] || y[1][1] - x[1][1])
    .map(([p]) => p).slice(0, TOP_PAGES);
  return out;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** 公開用ファイルの誤り(空なら正しい)。丸めていない数字があれば誤り */
export function mediaStatsErrors(s) {
  if (s == null) return [];
  if (typeof s !== "object" || Array.isArray(s)) return ["media-stats: 形が正しくありません"];
  const errs = [];
  if (!DAY.test(s.updated ?? "")) errs.push("media-stats: updated は YYYY-MM-DD");
  const block = (name, keys) => {
    const b = s[name];
    if (b == null) return;
    if (!isRounded(b[keys[0]])) errs.push(`media-stats.${name}.${keys[0]}: ありません`);
    if (!DAY.test(b.from ?? "") || !DAY.test(b.to ?? "") || b.from > b.to) errs.push(`media-stats.${name}: from・to は YYYY-MM-DD で、from ≦ to`);
    for (const k of keys) if (b[k] != null && !isRounded(b[k])) errs.push(`media-stats.${name}.${k}: 上から2桁に丸めた整数だけを書く(生の数字は公開しない)`);
    for (const k of Object.keys(b)) if (![...keys, "from", "to"].includes(k)) errs.push(`media-stats.${name}: 知らない項目 ${k}`);
  };
  block("search", ["impressions", "clicks", "impressions7", "clicks7"]);
  block("analytics", ["pageviews", "users"]);
  block("total", ["pageviews"]);
  if (s.topPages != null && (!Array.isArray(s.topPages) || s.topPages.some((p) => typeof p !== "string" || !/^\/[^\s"'<>]*$/.test(p)))) errs.push("media-stats.topPages: サイト内のパスの配列");
  for (const k of Object.keys(s)) if (!["updated", "window", "search", "analytics", "total", "topPages"].includes(k)) errs.push(`media-stats: 知らない項目 ${k}`);
  return errs;
}

/** その日に載せてよいか(集計が古すぎないか) */
export const statsFresh = (s, today) => {
  const to = s?.search?.to ?? s?.analytics?.to;
  return !!to && (Date.parse(today) - Date.parse(to)) / 864e5 <= STATS_MAX_AGE_DAYS;
};
