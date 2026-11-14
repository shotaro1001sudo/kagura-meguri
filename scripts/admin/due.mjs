// 予定タスクの「取り戻し」: 予定タスクを毎日(調査は月の1〜10日)動かし、最初にこれで「今回やるか」を決める。
//   PC やアプリが止まっていて抜けた回は、次に動いたとき(アプリは起動時に、抜けた予定を1回動かす)に取り戻す。
//   - analytics: いちばん新しい analytics/weekly-<日付>.md から3日たっていれば、やる(3日に1回)
//   - research: 今月の analytics/research-<YYYY-MM>.md が無ければ、やる(月に1回)
//   読むのはファイルの名前だけ(中身・数字は読まない)。
// 使い方: node scripts/admin/due.mjs analytics   → 1行目が「due: 理由」か「skip: 理由」
import { readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ANALYTICS_EVERY_DAYS = 3;
const JST = 9 * 3600e3;

/** 日本時間の日付(YYYY-MM-DD) */
export const jstDay = (ms) => new Date(ms + JST).toISOString().slice(0, 10);
const dayNum = (d) => Date.parse(d + "T00:00:00Z") / 864e5;
const addDays = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);

/** analytics/ の中で、いちばん新しい分析のレポート(weekly-<日付>.md)の日付。無ければ null */
export function lastReport(dir) {
  let names = [];
  try { names = readdirSync(dir); } catch { return null; }
  const days = names.map((n) => n.match(/^weekly-(\d{4}-\d{2}-\d{2})\.md$/)?.[1]).filter(Boolean).sort();
  return days.at(-1) ?? null;
}

/** 今回やるか。{ due, reason } */
export function dueCheck(root, task, { now = Date.now() } = {}) {
  const today = jstDay(now), dir = join(root, "analytics");
  if (task === "analytics") {
    const last = lastReport(dir);
    if (!last) return { due: true, reason: "これまでの分析のレポートがありません" };
    const gap = dayNum(today) - dayNum(last);
    if (gap >= ANALYTICS_EVERY_DAYS) return { due: true, reason: `前回の分析は ${last}(${gap}日前)です` };
    return { due: false, reason: `前回の分析は ${last}(${gap <= 0 ? "今日" : gap + "日前"})です。次は ${addDays(last, ANALYTICS_EVERY_DAYS)} 以降に動きます` };
  }
  if (task === "research") {
    const month = today.slice(0, 7), file = `research-${month}.md`;
    if (existsSync(join(dir, file))) return { due: false, reason: `今月(${month})の調査は済んでいます(analytics/${file})` };
    return { due: true, reason: `今月(${month})の調査がまだです。結果は analytics/${file} に残します` };
  }
  throw new Error(`知らないタスクです: ${task}(analytics か research)`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  try {
    const r = dueCheck(root, process.argv[2]);
    console.log(`${r.due ? "due" : "skip"}: ${r.reason}`);
  } catch (err) { console.error(err.message); process.exit(1); }
}
