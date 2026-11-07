// SNSの反応の評価(PDCA の Check → Act): Buffer の投稿ごとの反応を、テーマ別の「相対値」にまとめる(外部へは送らない部分)
// 取得は scripts/social-metrics.mjs。結果(data/social-performance.json)には、表示回数などの実数を残さない(相対値と件数だけ)。
// 使い道: x-post.mjs が、反応のよいテーマを先に出す(themeWeights)。週次の振り返りが、弱いテーマを「やること」にする。

export const MIN_SAMPLES = 3;   // テーマの評価に使う最小の投稿数(これ未満は「様子見」)
export const LOOKBACK_DAYS = 35; // 評価に使う期間(反応の集計に1日ほどかかるので、直近2日は除く)
export const SETTLE_DAYS = 2;
const VIEW_TYPES = ["impressions", "views", "reach"];
const ENGAGE_TYPES = ["reactions", "reposts", "comments", "shares", "clicks", "linkClicks", "saves"];

/** 投稿IDから、テーマを決める(social-posted.json の id: 開催は events.json の id、読み物は r:<theme>:...) */
export function themeOf(id = "") {
  const m = /^r:(\w+):/.exec(id);
  return m ? m[1] : "event";
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return null;
  const h = Math.floor(s.length / 2);
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};

/** Buffer の metrics([{type, value}])から、表示回数と反応数を取り出す。表示回数がなければ null(0 とは扱わない) */
export function readMetrics(metrics = []) {
  const by = new Map();
  for (const m of metrics ?? []) if (m && typeof m.value === "number" && Number.isFinite(m.value)) by.set(String(m.type), m.value);
  const views = VIEW_TYPES.map((t) => by.get(t)).find((v) => v != null) ?? null;
  const present = ENGAGE_TYPES.filter((t) => by.has(t));
  const engagements = present.length ? present.reduce((a, t) => a + by.get(t), 0) : null;
  return { views, engagements };
}

/**
 * 投稿ごとの反応を、テーマ別の相対値にする。
 * score = 反応数 ÷ 表示回数(表示回数が取れない投稿は除く)。テーマの index = テーマの中央値 ÷ 全体の中央値
 * @param buffer   Buffer から取った送信済みの投稿 [{ id, dueAt, metrics }]
 * @param posted   data/social-posted.json([{ id, bufferId, type, date }])
 */
export function summarizePerformance(buffer, posted, todayJst) {
  const byBuffer = new Map(posted.filter((p) => p.bufferId).map((p) => [p.bufferId, p]));
  const today = Date.parse(`${todayJst}T00:00:00+09:00`);
  const from = today - LOOKBACK_DAYS * 86400e3, to = today - SETTLE_DAYS * 86400e3;
  const rows = [];
  for (const b of buffer) {
    const p = byBuffer.get(b.id);
    if (!p) continue; // このサイトの予約(post-social)で入れた投稿だけ
    const at = Date.parse(b.dueAt ?? p.dueAt ?? "");
    if (!(at >= from && at < to)) continue;
    const { views, engagements } = readMetrics(b.metrics);
    if (!views || engagements == null) continue;
    rows.push({ theme: themeOf(p.id), score: engagements / views, views });
  }
  const overall = median(rows.map((r) => r.score));
  const themes = {};
  for (const t of [...new Set(rows.map((r) => r.theme))].sort()) {
    const rs = rows.filter((r) => r.theme === t);
    const reach = median(rs.map((r) => r.views)) / (median(rows.map((r) => r.views)) || 1);
    themes[t] = {
      n: rs.length,
      // 反応率(反応 ÷ 表示)の、全体に対する倍率。件数が少ないものは評価しない
      index: rs.length >= MIN_SAMPLES && overall ? round1(median(rs.map((r) => r.score)) / overall) : null,
      // 表示回数の、全体に対する倍率(届きやすさ)
      reach: rs.length >= MIN_SAMPLES ? round1(reach) : null,
    };
  }
  return { updated: todayJst, status: rows.length ? "ok" : "no_data", samples: rows.length, period: { days: LOOKBACK_DAYS, settleDays: SETTLE_DAYS }, themes };
}
const round1 = (x) => Math.round(x * 10) / 10;

/** x-post.mjs で使う、テーマの重み(評価できたものだけ)。反応率と届きやすさの平均 */
export function themeWeights(perf) {
  const w = {};
  for (const [t, v] of Object.entries(perf?.themes ?? {})) if (v.index != null) w[t] = round1((v.index + (v.reach ?? v.index)) / 2);
  return w;
}
