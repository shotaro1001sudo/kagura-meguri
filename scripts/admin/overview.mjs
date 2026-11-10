// 管理者用ページの運営の状況: 売上・集客・信号・掲載を、数字と信号でまとめる(読むだけ。何も書き換えない)。画面では「目標・収益」「数字」「動いているか」と、「やること」の上の信号に出す
//   1. 売上と目標   analytics/plan.json(目標・KPI・手入力の実績)+ analytics/state.json の kpi + analytics/series.json
//   2. 集客の推移   analytics/series.json(日ごとの GA4・Search Console。週次の分析タスクが更新)と state.json のスナップショット
//   3. 運営の信号   GitHub Actions の実行(gh)・サイトの表示・計測・週次の分析・予定タスク・Note・自動の読み込み・広告の期限
//   4. 掲載の量と鮮度 data/events.json・regular.json・collect-summary.json と、広告リンクの期限
// 数字が取れないものは null(0 にしない)。理由を missing / detail に書く。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { REGIONS, regionOf } from "../lib/util.mjs";
import { affiliateCoverage } from "../lib/affiliate-coverage.mjs";
import { reviewChecks, reviewIssueDate } from "./store.mjs";

const DAY = 864e5;
const readJson = (root, p, fb = null) => { try { return JSON.parse(readFileSync(join(root, p), "utf8")); } catch { return fb; } };
const readText = (root, p) => { try { return readFileSync(join(root, p), "utf8"); } catch { return ""; } };
export const addDays = (d, k) => new Date(Date.parse(d + "T00:00:00Z") + k * DAY).toISOString().slice(0, 10);
export const mondayOf = (d) => addDays(d, -((new Date(d + "T00:00:00Z").getUTCDay() + 6) % 7));
export const addMonth = (m, k) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + k, 1)).toISOString().slice(0, 7);
const daysInMonth = (m) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
const daysBetween = (a, b) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / DAY);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

// ---------- 推移(日ごとの数字 → 週・月) ----------
// GA4 の sessions と、Search Console のクリック・表示回数・掲載順位(表示回数で重み付け)。値のない日は数えない
function agg(days, from, to) {
  const ga = [], gsc = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const x = days?.[d];
    if (x?.sessions != null) ga.push(x);
    if (x?.gscImpr != null) gsc.push(x);
  }
  const impr = sum(gsc.map((x) => x.gscImpr));
  return {
    from, to, span: daysBetween(from, to) + 1,
    sessions: ga.length ? sum(ga.map((x) => x.sessions)) : null, gaDays: ga.length,
    clicks: gsc.length ? sum(gsc.map((x) => x.gscClicks ?? 0)) : null, impr: gsc.length ? impr : null, gscDays: gsc.length,
    pos: impr ? sum(gsc.map((x) => (x.gscPos ?? 0) * x.gscImpr)) / impr : null,
  };
}
/** 月曜はじまりの週ごと(n 週。今週は途中)。各週に、値のあった日数(gaDays・gscDays)を付ける */
export function weekBuckets(days, today, n = 10) {
  const start = addDays(mondayOf(today), -7 * (n - 1));
  const weeks = Array.from({ length: n }, (_, i) => { const from = addDays(start, 7 * i); const to = addDays(from, 6) < today ? addDays(from, 6) : today; return agg(days, from, to); });
  // 計測を始める前の、値のない週は出さない
  const first = weeks.findIndex((w) => w.gaDays || w.gscDays);
  return first < 0 ? [] : weeks.slice(first);
}
/** 直近7日とその前の7日(指標ごとに、値のある最後の日で区切る。GSC は2〜3日遅れて確定するため) */
export function recentWindows(days, metric) {
  const has = metric === "sessions" ? (x) => x?.sessions != null : (x) => x?.gscImpr != null;
  const last = Object.keys(days || {}).filter((d) => has(days[d])).sort().at(-1);
  if (!last) return null;
  const cur = agg(days, addDays(last, -6), last), prev = agg(days, addDays(last, -13), addDays(last, -7));
  return { cur, prev };
}
const monthAgg = (days, m) => agg(days, m + "-01", m + "-" + String(daysInMonth(m)).padStart(2, "0"));

// ---------- 売上と KPI ----------
/** 週次の分析の kpi(state.json)に、series.json から出せる分を足す(分析の値を優先。取れない値は書かない) */
export function deriveActuals(state, series) {
  const months = structuredClone(state?.kpi?.months ?? {});
  const add = (m, k, v) => { if (v == null) return; months[m] ??= {}; if (months[m][k] == null) months[m][k] = v; };
  for (const [m, v] of Object.entries(series?.vcMonths ?? {})) {
    add(m, "revenueVc", (v.pendingYen ?? 0) + (v.approvedYen ?? 0) + (v.billedYen ?? 0));
    add(m, "conversionsVc", v.orders);
  }
  const ms = new Set(Object.keys(series?.days ?? {}).map((d) => d.slice(0, 7)));
  for (const m of ms) { const a = monthAgg(series.days, m); if (a.gaDays) { add(m, "sessions", a.sessions); if (months[m].sessionsDays == null) months[m].sessionsDays = a.gaDays; } }
  return Object.keys(months).length ? { updated: state?.kpi?.updated ?? series?.updated ?? null, months } : null;
}
const MANUAL_PARTS = [["rakuten", "楽天"], ["adsense", "AdSense"], ["direct", "協賛・有料プラン"]];
export function revenueOf(actuals, manual, m) {
  const a = actuals?.months?.[m] ?? {}, man = manual?.[m] ?? {};
  const parts = [["vc", "バリューコマース", a.revenueVc], ...MANUAL_PARTS.map(([k, label]) => [k, label, man[k]])].map(([key, label, v]) => ({ key, label, value: v ?? null }));
  const known = parts.filter((p) => p.value != null);
  return { value: known.length ? sum(known.map((p) => p.value)) : null, parts, missing: parts.filter((p) => p.value == null).map((p) => p.label) };
}
function kpiActual(id, actuals, manual, m) {
  const a = actuals?.months?.[m] ?? {}, man = manual?.[m] ?? {};
  if (id === "revenue") { const r = revenueOf(actuals, manual, m); return { value: r.value, missing: r.missing }; }
  if (id === "contracts" || id === "pitches") { const v = man[id] ?? a[id] ?? null; return { value: v, missing: v == null ? ["営業の台帳・手入力"] : [] }; }
  if (id === "conversions") return { value: a.conversionsVc ?? null, missing: ["楽天(数えていません)"] };
  return { value: a[id] ?? null, missing: a[id] == null ? ["週次の分析"] : [] };
}
/**
 * 月の途中のペース: 目標を経過日数で按分した値と比べる。ahead(1.1倍以上)/ on(0.9倍以上)/ behind
 * 実績がない・目標がないときは null(判定しない)
 */
export function pace(value, target, month, today) {
  if (value == null || !target) return null;
  const frac = month < today.slice(0, 7) ? 1 : month > today.slice(0, 7) ? 0 : +today.slice(8, 10) / daysInMonth(month);
  if (!frac) return null;
  const expected = target * frac, ratio = value / expected;
  return { expected, ratio, frac, state: ratio >= 1.1 ? "ahead" : ratio >= 0.9 ? "on" : "behind" };
}
export function revenueSection(plan, actuals, today) {
  if (!plan?.goal) return null;
  const g = plan.goal, now = today.slice(0, 7);
  const kRev = plan.kpis.find((k) => k.id === "revenue");
  const start = addMonth((g.setAt || today).slice(0, 7), -1);
  const end = g.targetMonth && g.targetMonth >= now ? g.targetMonth : now;
  const months = [];
  for (let m = start; m <= end && months.length < 12; m = addMonth(m, 1)) {
    const r = m <= now ? revenueOf(actuals, plan.manual, m) : { value: null, parts: [], missing: [] };
    months.push({ month: m, value: r.value, parts: r.parts, missing: r.missing, target: kRev?.targets?.[m] ?? null, current: m === now, future: m > now });
  }
  const cur = months.find((x) => x.current) ?? { month: now, value: null, parts: [], missing: [], target: null };
  const nextTarget = Object.entries(kRev?.targets ?? {}).filter(([m]) => m >= now).sort()[0] ?? null;
  const monthsLeft = g.targetMonth ? Math.max(0, (+g.targetMonth.slice(0, 4) - +now.slice(0, 4)) * 12 + (+g.targetMonth.slice(5, 7) - +now.slice(5, 7))) : null;
  const prev = revenueOf(actuals, plan.manual, addMonth(now, -1));
  const leading = plan.kpis.filter((k) => k.id !== "revenue" && k.status !== "declined").map((k) => {
    const c = kpiActual(k.id, actuals, plan.manual, now), p = kpiActual(k.id, actuals, plan.manual, addMonth(now, -1));
    const t = k.targets?.[now] ?? null;
    return { id: k.id, name: k.name, unit: k.unit, status: k.status, value: c.value, missing: c.missing, prev: p.value, target: t,
      nextTarget: Object.entries(k.targets ?? {}).filter(([m]) => m > now).sort()[0] ?? null, pace: pace(c.value, t, now, today),
      days: k.id === "sessions" ? actuals?.months?.[now]?.sessionsDays ?? null : null };
  });
  return {
    goal: { title: g.title, monthly: g.monthlyRevenueYen ?? null, deadline: g.deadline ?? null, targetMonth: g.targetMonth ?? null, monthsLeft, outlook: g.outlook ?? "" },
    months, now: { ...cur, pace: pace(cur.value, cur.target, now, today) }, prev: { month: addMonth(now, -1), value: prev.value, missing: prev.missing },
    nextTarget: nextTarget && { month: nextTarget[0], value: nextTarget[1] }, leading,
    adopted: plan.monetization.filter((m) => ["adopted", "done"].includes(m.status) && m.expectedYen).reduce((a, m) => [a[0] + m.expectedYen[0], a[1] + m.expectedYen[1]], [0, 0]),
    updated: actuals?.updated ?? null,
  };
}

// ---------- 集客 ----------
export function trafficSection(series, state, today) {
  const days = series?.days ?? {};
  const has = Object.keys(days).length > 0;
  const snap = state?.snapshot ?? null;
  const pick = (obj, n) => Object.entries(obj ?? {}).filter(([k, v]) => Array.isArray(v)).sort((a, b) => b[1][0] - a[1][0]).slice(0, n)
    .map(([k, v]) => ({ key: k, clicks: v[0], impr: v[1], ctr: v[2], pos: v[3] }));
  return {
    has, updated: series?.updated ?? null, caveats: series?.caveats ?? [],
    weeks: has ? weekBuckets(days, today, 10) : [],
    sessions: has ? recentWindows(days, "sessions") : null, search: has ? recentWindows(days, "gsc") : null,
    pages: pick(snap?.gscPages28, 8), queries: pick(snap?.gscQueries28, 8), range28: snap?.gscPages28?.range ?? null,
    sources: Object.entries(snap?.ga4Source28 ?? {}).filter(([k, v]) => typeof v === "number").sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => ({ key: k, sessions: v })),
    sourcesRange: snap?.ga4Source28 ? `${snap.ga4Source28.from}..${snap.ga4Source28.to}` : null,
    affClicks28: series?.affClicks28 ?? null,
  };
}

// ---------- 掲載の量と鮮度 ----------
const nowJst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16);
// サイトと同じ考え方: 終了時刻がなければ、開始から3時間(時刻未定は、その日いっぱい)を開催中とみなす
export function isEnded(e, today, now = nowJst()) {
  if (e.end) return e.end < now;
  if (e.timeUnknown) return e.start.slice(0, 10) < today;
  return new Date(Date.parse(e.start + ":00Z") + 3 * 3600e3).toISOString().slice(0, 16) < now;
}
export function listingSection({ events = [], regular = [], collect = null, more = null, planning = null, affiliate = {}, today, now }) {
  const live = events.filter((e) => e.status === "published" && !isEnded(e, today, now));
  const within = (n) => live.filter((e) => e.start.slice(0, 10) <= addDays(today, n)).length;
  const start = mondayOf(today);
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const from = addDays(start, 7 * i), to = addDays(from, 6);
    return { from, to, count: live.filter((e) => { const d = e.start.slice(0, 10); return d >= from && d <= to; }).length };
  });
  const in30 = live.filter((e) => e.start.slice(0, 10) <= addDays(today, 30));
  const regions = REGIONS.map(([name]) => ({ name, count: in30.filter((e) => regionOf(e.prefecture) === name).length }));
  const stale = live.filter((e) => !e.checked || daysBetween(e.checked, today) > 60);
  let expiring = [];
  try { expiring = affiliateCoverage({ events: [], affiliate, planning: planning ?? {}, more, today }).expiring; } catch { expiring = []; }
  return {
    upcoming: live.length, next7: within(7), next30: within(30), regular: regular.length,
    pending: events.filter((e) => e.status === "pending").length, withdrawn: events.filter((e) => e.status === "withdrawn").length,
    stale: stale.length, noGeo: live.filter((e) => e.lat == null || e.lng == null).length,
    timeUnknown14: live.filter((e) => e.timeUnknown && e.start.slice(0, 10) <= addDays(today, 14)).length,
    auto: live.filter((e) => e.auto).length, weeks, regions,
    expiring: expiring.map((o) => ({ id: o.id, title: o.title, expiresAt: o.expiresAt, days: o.days })),
    collect: collect && { date: collect.date, published: collect.published ?? null, held: collect.held ?? null, errors: collect.errors ?? null, withdrawn: collect.withdrawn ?? null },
  };
}

// ---------- 運営の信号 ----------
const hoursSince = (iso, nowMs) => (iso ? (nowMs - Date.parse(iso)) / 3600e3 : Infinity);
/** NOTE-LOG.md から、最後の投稿日と、その後の止まった記録(ログイン切れなど) */
export function parseNoteLog(text) {
  let lastPost = null, lastPostTitle = "", problem = null;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^- (\d{4}-\d{2}-\d{2}) \/ (.+)$/);
    if (!m) continue;
    const [date, rest] = [m[1], m[2]];
    if (/https:\/\/note\.com\//.test(rest)) { if (!lastPost || date >= lastPost) { lastPost = date; lastPostTitle = rest.split(" / ")[1] ?? ""; if (problem && problem.date <= date) problem = null; } }
    else if (/投稿なし|ログイン切れ|失敗|中止/.test(rest)) { if (!lastPost || date >= lastPost) problem = { date, text: rest.split(" / ").slice(0, 2).join(" ・ ") }; }
  }
  return { lastPost, lastPostTitle, problem };
}
const RUN_TEXT = { success: "成功", failure: "失敗", cancelled: "取り消し", skipped: "スキップ", timed_out: "時間切れ", startup_failure: "起動の失敗" };
/**
 * GitHub Actions のワークフロー1つの信号。maxHours 以内に成功していれば正常
 * 最新が失敗 → 停止(その後に成功があれば注意)。成功が古い → 注意
 */
export function workflowSignal(runs, name, maxHours, nowMs) {
  if (!Array.isArray(runs)) return { state: "unknown", detail: "GitHub の実行記録を読めません" + (runs?.error ? `(${runs.error})` : "") };
  const mine = runs.filter((r) => r.workflowName === name).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!mine.length) return { state: "unknown", detail: "最近の実行の記録がありません" };
  const latest = mine[0], done = mine.find((r) => r.status === "completed");
  const lastOk = mine.find((r) => r.conclusion === "success");
  const base = { last: latest.createdAt, url: latest.url };
  if (latest.status !== "completed") return { ...base, state: hoursSince(lastOk?.createdAt, nowMs) <= maxHours ? "ok" : "warn", detail: "実行中" + (lastOk ? ` ・ 前回の成功 ${lastOk.createdAt}` : "") };
  if (done.conclusion !== "success" && done.conclusion !== "skipped") return { ...base, state: "stop", detail: `最新の実行が${RUN_TEXT[done.conclusion] ?? done.conclusion}` + (lastOk ? ` ・ 前回の成功 ${lastOk.createdAt}` : "") };
  if (hoursSince(lastOk?.createdAt, nowMs) > maxHours) return { ...base, state: "warn", detail: `予定の間隔(${Math.round(maxHours / 24 * 10) / 10}日)を過ぎても、成功の記録がない` };
  return { ...base, state: "ok", detail: `最新の実行: ${RUN_TEXT[done.conclusion] ?? done.conclusion}` };
}
export function opsSection({ runs, site, state, series, tasks, refresh, pending, noteLog, socialPosted, collect, weeklyReview, expiring, today, nowMs }) {
  const S = [];
  const add = (id, label, schedule, sig, extra = {}) => S.push({ id, label, schedule, ...sig, ...extra });
  add("site", "サイトの表示", "開いた時と自動の更新で確認", site == null ? { state: "unknown", detail: "まだ確かめていません" }
    : site.ok ? { state: "ok", detail: `表示できます(${site.ms}ミリ秒)`, last: site.at } : { state: "stop", detail: `表示できません(${site.status || site.error})`, last: site.at });
  add("deploy", "公開(サイトの作り直し)", "毎日 3:00 と、変更のたび", workflowSignal(runs, "build-and-deploy", 30, nowMs));
  const col = workflowSignal(runs, "weekly-collect", 8 * 24 + 6, nowMs);
  if (collect) { col.detail += ` ・ ${collect.date}: 新規の掲載 ${collect.published ?? "—"}・保留 ${collect.held ?? "—"}・エラー ${collect.errors ?? "—"}`; if (col.state === "ok" && collect.errors) col.state = "warn"; }
  add("collect", "週次の自動収集", "毎週月曜 4:00", col);
  const sns = workflowSignal(runs, "post-social", 30, nowMs);
  const posted = (socialPosted ?? []).filter((p) => p.date && p.date > addDays(today, -7)).length;
  sns.detail += ` ・ 直近7日の予約 ${posted} 件`;
  if (sns.state === "ok" && !(socialPosted ?? []).some((p) => p.date >= addDays(today, -1))) { sns.state = "warn"; sns.detail += "(昨日・今日の予約がない)"; }
  add("sns", "SNS(X)の投稿", "毎日 5:15 に予約", sns);
  // 振り返りは、実行の記録がなくても、data/weekly-review.json の日付で確かめる
  let rev = workflowSignal(runs, "weekly-review", 8 * 24 + 6, nowMs);
  if (rev.state === "unknown" && weeklyReview?.updated) { const a = daysBetween(weeklyReview.updated, today); rev = a <= 8 ? { state: "ok", detail: `前回の振り返り: ${weeklyReview.updated}(${a}日前)`, last: weeklyReview.updated } : { state: "warn", detail: `前回の振り返りから ${a} 日`, last: weeklyReview.updated }; }
  add("review", "週次の振り返り", "毎週(自動収集のあと)", rev);
  // 計測: 取得の成否(直近7日)と、最新の日の数字があるか
  const health = state?.snapshot?.health;
  const lastGa = Object.keys(series?.days ?? {}).filter((d) => series.days[d].sessions != null).sort().at(-1) ?? null;
  // 取得が止まった日があっても、分析の時点の直近3日が続けて成功していれば「回復した」とみなす(止まった日の数字は後から取り直される)
  const winEnd = health?.window?.split("..")[1] ?? state?.updated ?? null;
  const missing = health?.missingRuns ?? [];
  const recovered = !!(winEnd && missing.length && missing.every((d) => d <= addDays(winEnd, -3)));
  const meas = !series && !health ? { state: "unknown", detail: "計測の記録(analytics/series.json)がありません" }
    : health && health.successDays7 < 6 && recovered ? { state: "ok", detail: `${missing.join("・")} は取得が止まっていましたが、その後は毎日成功しています(${state?.updated ?? ""} の分析) ・ 最新の数字 ${lastGa ?? "—"}` }
    : health && health.successDays7 < 6 ?{ state: "warn", detail: `${state?.updated ?? ""} の分析の時点で、直近7日の取得の成功 ${health.successDays7}/7 日(${health.missingRuns?.length ? "記録なし: " + health.missingRuns.join("・") : ""})` }
    : { state: "ok", detail: `取得の成功 ${health ? health.successDays7 + "/7 日" : "—"} ・ 最新の数字 ${lastGa ?? "—"}` };
  add("measure", "計測(GA4・Search Console)", "毎朝 7 時台(スプレッドシート)", meas, { last: lastGa });
  const age = state?.updated ? daysBetween(state.updated, today) : null;
  add("analysis", "週次の分析", "毎週月曜(このPC)", age == null ? { state: "unknown", detail: "まだ分析の記録がありません" }
    : age <= 8 ? { state: "ok", detail: `前回の分析: ${state.updated}(${age}日前)` } : { state: "warn", detail: `前回の分析から ${age} 日。予定タスクを確かめてください` }, { last: state?.updated });
  // 予定タスク: 予定どおり動かなかった・途中で止まったものを注意に。ブラウザを使うタスクは、予定の時刻に承認が要ることを添える
  const troubled = (tasks?.tasks ?? []).filter((t) => t.issues?.length || t.missed);
  const browserTasks = (tasks?.tasks ?? []).filter((t) => t.browser);
  const browserNote = browserTasks.length ? ` ・ ブラウザを使うので、予定の時刻に承認が要る: ${browserTasks.map((t) => t.title).join("・")}` : "";
  add("tasks", "予定タスク(PC の Claude)", "Note・分析・月次の調査など", !tasks?.found ? { state: "unknown", detail: "予定タスクの記録が見つかりません" }
    : tasks.error ? { state: "unknown", detail: tasks.error }
    : troubled.length ? { state: "warn", detail: troubled.map((t) => `${t.title}: ${(t.issues ?? [])[0] ?? "動いていません"}`).join(" / ") + browserNote }
    : { state: "ok", detail: `${tasks.tasks.filter((t) => t.enabled).length} 件、予定どおり${browserNote}` });
  const note = noteLog ?? {};
  const nAge = note.lastPost ? daysBetween(note.lastPost, today) : null;
  add("note", "Note の投稿", "2日おき(PC の予定タスク)", note.problem ? { state: "warn", detail: `${note.problem.date}: ${note.problem.text}` }
    : nAge == null ? { state: "unknown", detail: "投稿の記録(NOTE-LOG.md)がありません" }
    : nAge <= 4 ? { state: "ok", detail: `前回: ${note.lastPost}「${note.lastPostTitle}」` } : { state: "warn", detail: `前回の投稿から ${nAge} 日(${note.lastPost})` }, { last: note.lastPost });
  const lr = refresh?.last;
  add("refresh", "管理者ページの自動の読み込み", `${refresh?.hours ? refresh.hours + "時間おき" : "止めています"}(GitHub・Gmail)`, !lr ? { state: "unknown", detail: "起動の1分後に、最初の読み込みをします" }
    : [lr.git, lr.mail].some((x) => x && x.ok === false) ? { state: "warn", detail: [lr.git, lr.mail].filter((x) => x && x.ok === false).map((x) => x.text).join(" ・ "), last: lr.at }
    : { state: "ok", detail: [lr.git?.text, lr.mail?.text].filter(Boolean).join(" ・ "), last: lr.at });
  const unpub = !!(pending && (pending.uncommitted || pending.unpushed));
  add("pending", "サイトに反映していない変更", "管理者ページの保存のたび", unpub ? { state: "warn", detail: "開催データの保存はできています。画面の上の「もう一度公開する」で送ってください" } : { state: "ok", detail: "ありません" });
  const exp = expiring ?? [], gone = exp.filter((o) => o.days < 0), soon = exp.filter((o) => o.days >= 0);
  add("ads", "広告リンクの期限", "期限が切れると、自動で表示が止まる", gone.length ? { state: "warn", detail: `期限切れ ${gone.length} 件(表示が止まっています)${soon.length ? ` ・ 14日以内に切れる ${soon.length} 件` : ""}` }
    : soon.length ? { state: "warn", detail: `14日以内に切れる ${soon.length} 件(最短 ${soon[0].expiresAt})` } : { state: "ok", detail: "14日以内に切れるものはありません" });
  const order = { stop: 0, warn: 1, unknown: 2, ok: 3 };
  return { signals: S, counts: Object.fromEntries(["ok", "warn", "stop", "unknown"].map((k) => [k, S.filter((s) => s.state === k).length])), worst: [...S].sort((a, b) => order[a.state] - order[b.state])[0]?.state ?? "ok" };
}

// ---------- 外の確認(テストでは差し替える) ----------
// 信号に使うワークフロー(ファイル名)。ほかの実行(公開のあとの引き継ぎなど)が多くても埋もれないよう、ワークフローごとに読む
export const WATCHED = ["deploy.yml", "collect.yml", "post-social.yml", "weekly-review.yml"];
const ghList = (root, wf) => new Promise((resolve) => {
  execFile("gh", ["run", "list", "--workflow", wf, "--limit", "8", "--json", "workflowName,status,conclusion,createdAt,url,event"], { cwd: root, timeout: 20000, windowsHide: true }, (err, out) => {
    if (err) return resolve({ error: err.code === "ENOENT" ? "gh が見つかりません" : "gh の実行に失敗しました" });
    try { resolve(JSON.parse(out)); } catch { resolve({ error: "gh の出力を読めません" }); }
  });
});
/** GitHub Actions の最近の実行(gh)。1つも読めないときは { error } */
export async function loadRuns(root) {
  const lists = await Promise.all(WATCHED.map((wf) => ghList(root, wf)));
  const ok = lists.filter(Array.isArray);
  return ok.length ? ok.flat() : lists[0];
}
/** 開いている週次の振り返りの Issue(gh)。返すのは [{ date, url, checked }](checked はチェックを付けた項目の key)。読めないときは { error } */
export function loadReviewIssues(root) {
  return new Promise((resolve) => {
    execFile("gh", ["issue", "list", "--state", "open", "--limit", "5", "--search", "週次の振り返り in:title", "--json", "title,body,url"], { cwd: root, timeout: 15000, windowsHide: true }, (err, out) => {
      if (err) return resolve({ error: err.code === "ENOENT" ? "gh が見つかりません" : "gh の実行に失敗しました" });
      try {
        resolve(JSON.parse(out).filter((x) => /^週次の振り返り[(（]/.test(x.title ?? "")).map((x) => ({ date: reviewIssueDate(x.body), url: x.url, checked: reviewChecks(x.body) })).filter((x) => x.date));
      } catch { resolve({ error: "gh の出力を読めません" }); }
    });
  });
}
/** 公開サイトのトップを開けるか */
export async function checkSite(baseUrl) {
  if (!/^https:\/\//.test(baseUrl || "")) return null;
  const t0 = Date.now(), at = new Date().toISOString();
  try {
    const r = await fetch(baseUrl.replace(/\/$/, "") + "/", { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(10000) });
    return { ok: r.ok, status: r.status, ms: Date.now() - t0, at };
  } catch (err) { return { ok: false, error: err.name === "TimeoutError" ? "10秒で応答なし" : "つながりません", ms: Date.now() - t0, at }; }
}

/** 概要の全体。ext: { runs, site, tasks, refresh, pending }(サーバーが集めたもの) */
export function buildOverview(root, { today, nowMs = Date.now(), now, runs, site, tasks, refresh, pending, plan }) {
  const state = readJson(root, "analytics/state.json");
  const series = readJson(root, "analytics/series.json");
  const cfg = readJson(root, "config.json", {});
  const ev = readJson(root, "data/events.json", []);
  const events = Array.isArray(ev) ? ev : ev.events ?? [];
  const rg = readJson(root, "data/regular.json", []);
  const regular = Array.isArray(rg) ? rg : rg.regular ?? [];
  const collect = readJson(root, "data/collect-summary.json");
  const listing = listingSection({ events, regular, collect, more: readJson(root, "data/more-offers.json"), planning: readJson(root, "data/visitor-planning.json"), affiliate: cfg.affiliate ?? {}, today, now });
  const actuals = plan?.actuals ?? deriveActuals(state, series); // loadPlan の実績(営業の台帳の数を含む)を優先
  return {
    generatedAt: new Date(nowMs).toISOString(), today,
    revenue: plan ? revenueSection({ ...plan, manual: plan.manual ?? {} }, actuals, today) : null,
    traffic: trafficSection(series, state, today),
    ops: opsSection({ runs, site, state, series, tasks, refresh, pending, noteLog: parseNoteLog(readText(root, "NOTE-LOG.md")), socialPosted: readJson(root, "data/social-posted.json", []), collect, weeklyReview: readJson(root, "data/weekly-review.json"), expiring: listing.expiring, today, nowMs }),
    listing,
  };
}
