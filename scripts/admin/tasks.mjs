// 予定タスク(Claude デスクトップアプリの「スケジュール済みタスク」)を、管理者用ページに出すための読み取り。
//   読むのは、アプリが保存している scheduled-tasks.json と、各タスクの SKILL.md の見出し(name・description)と、
//   タスクが動かしたセッションの記録(題名・結果のひとことだけ)。書き換えはしない。
//   画面に出すのは、名前・説明・予定・次回・前回・止まっていないか・最近の実行の結果だけ
//   (タスクの指示文・許可した操作・作業フォルダなどは出さない)。
// 時刻はすべて日本時間で考える(このPCは日本時間で動かしている前提。アプリの予定もこのPCの時刻で動く)
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

const JST = 9 * 3600e3;
const WD = "日月火水木金土";

/** アプリの scheduled-tasks.json の場所。ADMIN_TASKS_FILE で差し替えられる。複数あれば、最後に更新されたもの */
export function findTasksFile(env = process.env) {
  if (env.ADMIN_TASKS_FILE) return existsSync(env.ADMIN_TASKS_FILE) ? env.ADMIN_TASKS_FILE : null;
  const base = env.LOCALAPPDATA ? join(env.LOCALAPPDATA, "Claude-Data") : null;
  if (!base || !existsSync(base)) return null;
  const found = [];
  const dirs = (p) => { try { return readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => join(p, d.name)); } catch { return []; } };
  for (const a of dirs(base)) for (const b of dirs(join(a, "claude-code-sessions"))) for (const c of dirs(b)) {
    const f = join(c, "scheduled-tasks.json");
    if (existsSync(f)) found.push([statSync(f).mtimeMs, f]);
  }
  return found.sort((x, y) => y[0] - x[0])[0]?.[1] ?? null;
}

// ---------- cron(分 時 日 月 曜日) ----------
function field(s, min, max) {
  if (s === "*") return null; // 制限なし
  const out = new Set();
  for (const part of s.split(",")) {
    const m = part.match(/^(\*|\d+)(?:-(\d+))?(?:\/(\d+))?$/);
    if (!m) throw new Error(`読めない予定です: ${s}`);
    const lo = m[1] === "*" ? min : +m[1];
    const hi = m[2] != null ? +m[2] : m[1] === "*" || m[3] ? max : lo;
    const step = m[3] ? +m[3] : 1;
    for (let v = lo; v <= hi; v += step) out.add(max === 7 && v === 7 ? 0 : v); // 曜日の 7 は日曜
  }
  return out;
}
export function parseCron(expr) {
  const f = String(expr).trim().split(/\s+/);
  if (f.length !== 5) throw new Error(`読めない予定です: ${expr}`);
  return { min: field(f[0], 0, 59), hour: field(f[1], 0, 23), dom: field(f[2], 1, 31), mon: field(f[3], 1, 12), dow: field(f[4], 0, 7) };
}
// 日本時間の「日」が予定に合うか(日と曜日の両方に指定があれば、どちらかに合えばよい。cron と同じ)
function dayOk(c, d) {
  const dom = !c.dom || c.dom.has(d.getUTCDate()), dow = !c.dow || c.dow.has(d.getUTCDay());
  if (c.mon && !c.mon.has(d.getUTCMonth() + 1)) return false;
  return c.dom && c.dow ? dom || dow : dom && dow;
}
const sorted = (set, min, max) => (set ? [...set].sort((a, b) => a - b) : Array.from({ length: max - min + 1 }, (_, i) => min + i));

/** from より後(dir=1)・前(dir=-1)で、いちばん近い予定の時刻(ミリ秒)。2年以内に無ければ null */
export function cronStep(expr, from, dir = 1) {
  const c = parseCron(expr);
  const hours = sorted(c.hour, 0, 23), mins = sorted(c.min, 0, 59);
  if (dir < 0) { hours.reverse(); mins.reverse(); }
  const t = new Date(from + JST);
  let day = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  for (let i = 0; i < 800; i++, day += dir * 864e5) {
    if (!dayOk(c, new Date(day))) continue;
    for (const hh of hours) for (const mm of mins) {
      const at = day + hh * 3600e3 + mm * 60e3 - JST;
      if (dir > 0 ? at > from : at <= from) return at;
    }
  }
  return null;
}

/** 予定を、ふつうの日本語にする(よく使う形だけ。ほかは cron のまま) */
export function describeCron(expr) {
  const [mi, ho, dom, mon, dow] = String(expr).trim().split(/\s+/);
  if (!/^\d+$/.test(mi) || !/^\d+$/.test(ho) || mon !== "*") return `cron: ${expr}`;
  const at = `${+ho}:${mi.padStart(2, "0")}`;
  if (dom === "*" && dow === "*") return `毎日 ${at}`;
  if (/^\*\/\d+$/.test(dom) && dow === "*") return `${dom.slice(2)}日に1回 ${at}`;
  if (dom === "*" && /^[0-7](,[0-7])*$/.test(dow)) return `毎週${dow.split(",").map((d) => WD[+d % 7]).join("・")}曜 ${at}`;
  if (/^\d+$/.test(dom) && dow === "*") return `毎月${+dom}日 ${at}`;
  return `cron: ${expr}`;
}

// SKILL.md の見出し(--- で囲んだ部分)から、name と description だけを読む
function front(file) {
  try {
    const m = readFileSync(file, "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const get = (k) => m?.[1].match(new RegExp(`^${k}:\\s*(.*)$`, "m"))?.[1].trim() ?? "";
    return { name: get("name"), description: get("description") };
  } catch { return { name: "", description: "" }; }
}
const iso = (ms) => (ms == null || Number.isNaN(ms) ? null : new Date(ms).toISOString());
const ms = (v) => (v == null ? null : typeof v === "number" ? v : Date.parse(v));

// 予定の時刻から、これだけ過ぎても動いていなければ「止まっている」とみなす(アプリは数分ずらして動かすため)
const GRACE = 2 * 3600e3;

/**
 * 予定タスクの一覧。runs: true なら、各タスクの最近の実行(セッションの記録)も読む。
 * 返すのは画面に出してよい項目だけ。
 */
export function loadTasks({ file = findTasksFile(), now = Date.now(), runs = false } = {}) {
  if (!file) return { found: false, tasks: [] };
  let raw;
  try { raw = JSON.parse(readFileSync(file, "utf8")); } catch (err) { return { found: true, error: `予定タスクの記録を読めませんでした(${err.code || err.message})`, tasks: [] }; }
  const runMap = runs ? loadRuns(dirname(file)) : null;
  const tasks = (raw.scheduledTasks || []).map((t) => {
    const fm = t.filePath ? front(t.filePath) : {};
    const created = ms(t.createdAt), last = ms(t.lastRunAt), lastFor = ms(t.lastScheduledFor);
    let schedule, next = null, prev = null, error = "";
    if (t.cronExpression) {
      schedule = describeCron(t.cronExpression);
      try { next = t.enabled ? cronStep(t.cronExpression, now, 1) : null; prev = cronStep(t.cronExpression, now - GRACE, -1); }
      catch (err) { error = err.message; }
    } else if (t.fireAt != null) {
      const at = ms(t.fireAt);
      schedule = `1回だけ ${fmt(at)}`;
      next = t.enabled && at > now ? at : null;
      prev = at <= now - GRACE ? at : null;
    } else schedule = "手動で動かすだけ";
    // 前回の予定の時刻に、動いた記録がない(作る前の予定は数えない)
    const ranSince = Math.max(lastFor ?? -Infinity, last ?? -Infinity);
    const missed = !!(t.enabled && prev != null && prev > (created ?? -Infinity) && !(ranSince >= prev - GRACE));
    const out = { id: t.id, title: t.displayName || fm.name || t.id, description: fm.description || "", schedule, enabled: !!t.enabled,
      nextRun: iso(next), lastRun: iso(last), missed, missedAt: missed ? iso(prev) : null, error };
    if (runMap) out.runs = (runMap.get(t.id) || []).slice(0, 5);
    return out;
  });
  // 有効なものを先に、次回が近い順
  tasks.sort((a, b) => (b.enabled - a.enabled) || (a.nextRun ?? "9").localeCompare(b.nextRun ?? "9"));
  return { found: true, tasks, missed: tasks.filter((t) => t.missed).length };
}

/** タスクが動かしたセッションの記録から、開始時刻・結果・ひとことだけを集める(新しい順) */
export function loadRuns(dir) {
  const map = new Map();
  let names = [];
  try { names = readdirSync(dir).filter((n) => /^local_[\w-]+\.json$/.test(n)); } catch { return map; }
  for (const n of names) {
    let s;
    try { s = JSON.parse(readFileSync(join(dir, n), "utf8")); } catch { continue; }
    if (!s?.scheduledTaskId) continue;
    const sum = s.postTurnSummary || {};
    const run = { startedAt: iso(ms(s.createdAt)), lastActivityAt: iso(ms(s.lastActivityAt)),
      status: sum.status_category || (s.completedTurns ? "completed" : "unknown"),
      summary: String(sum.status_detail || s.turnWrapUp?.description || "").slice(0, 300), needsAction: String(sum.needs_action || "").slice(0, 300) };
    if (!map.has(s.scheduledTaskId)) map.set(s.scheduledTaskId, []);
    map.get(s.scheduledTaskId).push(run);
  }
  for (const list of map.values()) list.sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
  return map;
}

function fmt(at) {
  const d = new Date(at + JST);
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WD[d.getUTCDay()]}) ${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
