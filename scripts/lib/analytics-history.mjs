// 中長期の分析のための、計測の内訳の履歴と、月ごと・28日ごとの推移(どれも非公開の analytics/ だけで使う)。
//
// 統合管理台帳の 13_計測内訳 は、毎日「直近28日」の内訳で置き換わる(過去の内訳は残らない)。
// そこで、分析タスクが台帳を読むたびに、その時点の内訳を analytics/history/<期間の末日>.json に写して残す。
// 残した内訳を、重ならない28日ずつ(直近 / その前の28日 / 約3か月前)で比べると、検索語・ページ・流入元の
// 伸び縮みが分かる。日ごとの合計(analytics/series.json の days)からは、月ごとの合計と前年同月比を出す。
//
// 数字の扱い(docs/analytics-quality.md と同じ):
// - 値がない日・行は 0 にしない(未返却)。GSC の内訳は上位の行だけなので、出てこない語を「0 になった」と言い切らない。
// - CTR・掲載順位は単純に足したり平均したりしない(表示回数で重み付けする)。GA4 のユーザー数は日ごとに足さない。

const DAY = 864e5;
const toMs = (d) => Date.parse(`${d}T00:00:00Z`);
const addDays = (d, n) => new Date(toMs(d) + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((toMs(b) - toMs(a)) / DAY);
const daysInMonth = (m) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
const r1 = (x) => Math.round(x * 10) / 10;
const pct = (now, before) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

/** 13_計測内訳 の行を、「媒体/内訳 + 期間」ごとのスナップショットにまとめる */
export function snapshotsFromRows(rows = []) {
  const out = {};
  for (const x of rows) {
    if (!x?.source || !x?.breakdown || !x?.to || x.dimension == null) continue;
    let m;
    try { m = JSON.parse(x.metrics_json); } catch { continue; }
    if (!Array.isArray(m)) continue;
    const key = `${x.source}/${x.breakdown}`;
    const id = `${key}|${x.to}`;
    const s = (out[id] ??= { key, source: x.source, breakdown: x.breakdown, from: x.from ?? null, to: x.to, fetchedAt: x.fetched_at_JST ?? null, quality: x.quality ?? "", rows: {} });
    if (x.fetched_at_JST && (!s.fetchedAt || x.fetched_at_JST > s.fetchedAt)) s.fetchedAt = x.fetched_at_JST;
    s.rows[String(x.dimension)] = m;
  }
  return Object.values(out);
}

/**
 * 履歴(期間の末日 → { to, snapshots: { "媒体/内訳": スナップショット } })に、新しいスナップショットを足す。
 * 同じ末日・同じ内訳が既にあれば、取得日時が新しいときだけ置き換える(GA4 はあとから数字が直ることがある)。
 * 返り値: { history, changed: [書き換えた末日] }
 */
export function mergeSnapshots(history = {}, snaps = []) {
  const h = structuredClone(history);
  const changed = new Set();
  for (const s of snaps) {
    const day = (h[s.to] ??= { to: s.to, snapshots: {} });
    const old = day.snapshots[s.key];
    if (old && old.fetchedAt && s.fetchedAt && old.fetchedAt >= s.fetchedAt) continue;
    if (old && !s.fetchedAt) continue;
    day.snapshots[s.key] = s;
    changed.add(s.to);
  }
  return { history: h, changed: [...changed].sort() };
}

/** 日ごとの合計(series.days)から、月ごとの合計。値が返ってきた日数も残す(足りない月は「途中」) */
export function monthlyTotals(days = {}, today = null) {
  const months = {};
  for (const [d, v] of Object.entries(days)) {
    const m = d.slice(0, 7);
    const a = (months[m] ??= { month: m, days: daysInMonth(m), gaDays: 0, sessions: 0, pv: 0, gscDays: 0, gscClicks: 0, gscImpr: 0, posWeighted: 0 });
    if (v.sessions != null) { a.gaDays++; a.sessions += v.sessions; a.pv += v.pv ?? 0; }
    if (v.gscImpr != null || v.gscClicks != null) {
      a.gscDays++; a.gscClicks += v.gscClicks ?? 0; a.gscImpr += v.gscImpr ?? 0;
      if (v.gscPos != null && v.gscImpr) a.posWeighted += v.gscPos * v.gscImpr;
    }
  }
  const cur = today ? today.slice(0, 7) : null;
  return Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).map((a) => ({
    month: a.month,
    partial: a.month === cur || a.gaDays < a.days || a.gscDays < a.days,
    ga: a.gaDays ? { days: a.gaDays, sessions: a.sessions, pv: a.pv, sessionsPerDay: r1(a.sessions / a.gaDays) } : null,
    gsc: a.gscDays ? { days: a.gscDays, clicks: a.gscClicks, impressions: a.gscImpr, clicksPerDay: r1(a.gscClicks / a.gscDays),
      position: a.gscImpr ? r1(a.posWeighted / a.gscImpr) : null } : null,
  }));
}

/** 月ごとの合計に、前月比・前年同月比(1日あたりで比べる。月の途中・欠けた日があっても比べられるように)を付ける */
export function monthlyChanges(monthly) {
  const by = Object.fromEntries(monthly.map((m) => [m.month, m]));
  const prevMonth = (m) => { const [y, mo] = m.split("-").map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`; };
  const lastYear = (m) => `${+m.slice(0, 4) - 1}${m.slice(4)}`;
  const cmp = (a, b) => (a && b ? {
    sessionsPerDay: a.ga && b.ga ? pct(a.ga.sessionsPerDay, b.ga.sessionsPerDay) : null,
    gscClicksPerDay: a.gsc && b.gsc ? pct(a.gsc.clicksPerDay, b.gsc.clicksPerDay) : null,
  } : null);
  return monthly.map((m) => ({ ...m, vsPrevMonth: cmp(m, by[prevMonth(m.month)]), vsLastYear: cmp(m, by[lastYear(m.month)]) }));
}

/** 直近の日から7日ずつさかのぼった、28日の合計(返ってきた日が24日以上の期間だけ) */
export function rolling28(days = {}, points = 13) {
  const dates = Object.keys(days).sort();
  if (!dates.length) return [];
  const out = [];
  for (let i = 0, end = dates.at(-1); i < points; i++, end = addDays(end, -7)) {
    const from = addDays(end, -27);
    if (from < dates[0]) break;
    let gaDays = 0, sessions = 0, gscDays = 0, clicks = 0, impr = 0;
    for (let d = from; d <= end; d = addDays(d, 1)) {
      const v = days[d]; if (!v) continue;
      if (v.sessions != null) { gaDays++; sessions += v.sessions; }
      if (v.gscImpr != null || v.gscClicks != null) { gscDays++; clicks += v.gscClicks ?? 0; impr += v.gscImpr ?? 0; }
    }
    out.push({ from, to: end,
      sessions: gaDays >= 24 ? sessions : null, gaDays,
      gscClicks: gscDays >= 24 ? clicks : null, gscImpressions: gscDays >= 24 ? impr : null, gscDays });
  }
  return out.reverse();
}

/** 履歴から、内訳 key のスナップショットのうち、末日が target にいちばん近いもの(± tol 日以内) */
export function pickSnapshot(history, key, target, tol) {
  let best = null, bestGap = Infinity;
  for (const day of Object.values(history)) {
    const s = day.snapshots?.[key]; if (!s) continue;
    const gap = Math.abs(daysBetween(s.to, target));
    if (gap <= tol && gap < bestGap) { best = s; bestGap = gap; }
  }
  return best;
}

const latestSnapshot = (history, key) => Object.values(history).map((d) => d.snapshots?.[key]).filter(Boolean).sort((a, b) => a.to.localeCompare(b.to)).at(-1) ?? null;

// 内訳ごとに、比べる指標(GSC: クリック・表示回数・掲載順位、GA4: 先頭の数)
const KINDS = {
  "GSC/query": { gsc: true }, "GSC/page": { gsc: true }, "GSC/device": { gsc: true },
  "GA4/page": {}, "GA4/source": {}, "GA4/event": {}, "GA4/device": {}, "GA4/page_event": {},
};

/**
 * 2つの28日の内訳を比べる。GSC は上位の行だけなので、片方にしかない行は「新しく出てきた」「上位から外れた」と書く(0 とは言わない)。
 * minBase: 伸び縮みを比べる最小の大きさ(GSC は表示回数、GA4 は数)
 */
export function compareSnapshots(now, before, { gsc = false, minBase = gsc ? 20 : 5, top = 10 } = {}) {
  const val = (m) => m?.[0] ?? 0, base = (m) => (gsc ? m?.[1] ?? 0 : m?.[0] ?? 0);
  const keys = new Set([...Object.keys(now.rows), ...Object.keys(before.rows)]);
  const both = [], added = [], dropped = [];
  for (const k of keys) {
    const a = now.rows[k], b = before.rows[k];
    if (a && b) {
      if (Math.max(base(a), base(b)) < minBase) continue;
      const row = { key: k, now: val(a), before: val(b), diff: val(a) - val(b), change: pct(val(a), val(b)) };
      if (gsc) Object.assign(row, { imprNow: a[1], imprBefore: b[1], posNow: r1(a[3]), posBefore: r1(b[3]), posDiff: r1(a[3] - b[3]) });
      both.push(row);
    } else if (a && base(a) >= minBase) added.push({ key: k, now: val(a), ...(gsc ? { impr: a[1], pos: r1(a[3]) } : {}) });
    else if (b && base(b) >= minBase) dropped.push({ key: k, before: val(b), ...(gsc ? { impr: b[1], pos: r1(b[3]) } : {}) });
  }
  const res = {
    now: { from: now.from, to: now.to }, before: { from: before.from, to: before.to },
    risers: both.filter((r) => r.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, top),
    fallers: both.filter((r) => r.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, top),
    added: added.sort((a, b) => (b.impr ?? b.now) - (a.impr ?? a.now)).slice(0, top),
    dropped: dropped.sort((a, b) => (b.impr ?? b.before) - (a.impr ?? a.before)).slice(0, top),
  };
  if (gsc) {
    res.positionUp = both.filter((r) => r.posDiff <= -1).sort((a, b) => a.posDiff - b.posDiff).slice(0, top); // 順位は小さいほど上
    res.positionDown = both.filter((r) => r.posDiff >= 1).sort((a, b) => b.posDiff - a.posDiff).slice(0, top);
  }
  return res;
}

/**
 * 中長期の推移をまとめる。比べる過去の内訳がまだないときは、いつから比べられるかを返す。
 * 期間: 直近の28日 / その前の28日(重ならない) / 約3か月前(84日前)の28日
 */
export function buildTrends({ series = null, history = {}, today }) {
  const monthly = monthlyChanges(monthlyTotals(series?.days ?? {}, today));
  const breakdowns = {};
  for (const [key, opt] of Object.entries(KINDS)) {
    const latest = latestSnapshot(history, key);
    if (!latest) continue;
    const prev = pickSnapshot(history, key, addDays(latest.to, -28), 5);
    const q3 = pickSnapshot(history, key, addDays(latest.to, -84), 7);
    breakdowns[key] = {
      latest: { from: latest.from, to: latest.to, rows: Object.keys(latest.rows).length },
      vsPrev28: prev ? compareSnapshots(latest, prev, opt) : null,
      vs3MonthsAgo: q3 ? compareSnapshots(latest, q3, opt) : null,
      ...(prev ? {} : { prev28AvailableFrom: addDays(Object.values(history).map((d) => d.snapshots?.[key]?.to).filter(Boolean).sort()[0], 28 - 5) }),
    };
  }
  const snapDates = Object.keys(history).sort();
  return {
    today, monthly, rolling28: rolling28(series?.days ?? {}),
    history: { snapshots: snapDates.length, first: snapDates[0] ?? null, last: snapDates.at(-1) ?? null },
    breakdowns,
    caveats: [
      "GSC の内訳は上位の行だけ(匿名化された検索語は出ない)。片方にしかない行は「上位に出てきた・外れた」であって、0 になったとは限らない",
      "GA4 は同意した訪問だけの数。2026-10-23 より前は計測の不調があり、比べる基準にしない",
      "月の比較は1日あたりで比べている(月の途中・値が返ってこなかった日があるため)",
    ],
  };
}
