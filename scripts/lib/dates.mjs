// 日付の計算(日本の祝日・週末・連休)。日付は "YYYY-MM-DD" の文字列で扱う(サーバーの時区に依存させない)
//
// 祝日は「国民の祝日に関する法律」(2020年以降の形)に沿って計算する:
//  固定の祝日・ハッピーマンデー・春分/秋分(1980〜2099年の近似式)・振替休日・国民の休日(祝日に挟まれた平日)
//  法改正や、特例の祝日(オリンピックの年の移動など)は、反映されない。

const pad = (n) => String(n).padStart(2, "0");
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const toUtc = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const fromUtc = (ms) => { const d = new Date(ms); return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); };
export const addDays = (s, n) => fromUtc(toUtc(s) + n * 864e5);
export const weekday = (s) => new Date(toUtc(s)).getUTCDay(); // 0 = 日曜
const nthMonday = (y, m, n) => { const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); return 1 + ((8 - first) % 7) + (n - 1) * 7; };
const equinox = (y, base) => Math.floor(base + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));

const cache = new Map();
/** その年の祝日: Map("YYYY-MM-DD" → 名前) */
export function jpHolidays(y) {
  if (cache.has(y)) return cache.get(y);
  const h = new Map([
    [ymd(y, 1, 1), "元日"], [ymd(y, 1, nthMonday(y, 1, 2)), "成人の日"], [ymd(y, 2, 11), "建国記念の日"], [ymd(y, 2, 23), "天皇誕生日"],
    [ymd(y, 3, equinox(y, 20.8431)), "春分の日"], [ymd(y, 4, 29), "昭和の日"], [ymd(y, 5, 3), "憲法記念日"], [ymd(y, 5, 4), "みどりの日"], [ymd(y, 5, 5), "こどもの日"],
    [ymd(y, 7, nthMonday(y, 7, 3)), "海の日"], [ymd(y, 8, 11), "山の日"], [ymd(y, 9, nthMonday(y, 9, 3)), "敬老の日"], [ymd(y, 9, equinox(y, 23.2488)), "秋分の日"],
    [ymd(y, 10, nthMonday(y, 10, 2)), "スポーツの日"], [ymd(y, 11, 3), "文化の日"], [ymd(y, 11, 23), "勤労感謝の日"],
  ]);
  // 国民の休日: 前日と翌日が祝日の平日(日曜を除く)
  for (const d of [...h.keys()]) {
    const mid = addDays(d, 1), next = addDays(d, 2);
    if (!h.has(mid) && h.has(next) && weekday(mid) !== 0) h.set(mid, "国民の休日");
  }
  // 振替休日: 祝日が日曜なら、その後の最初の「祝日でない日」
  for (const d of [...h.keys()].sort()) {
    if (weekday(d) !== 0) continue;
    let x = addDays(d, 1);
    while (h.has(x)) x = addDays(x, 1);
    h.set(x, "振替休日");
  }
  cache.set(y, h);
  return h;
}
export const holidayName = (s) => jpHolidays(+s.slice(0, 4)).get(s) ?? "";
/** 土日・祝日か */
export const isRestDay = (s) => weekday(s) === 0 || weekday(s) === 6 || !!holidayName(s);

/** 連続する休日のかたまり(s を含む)。s が休日でなければ null */
function restBlock(s) {
  if (!isRestDay(s)) return null;
  let a = s, b = s;
  while (isRestDay(addDays(a, -1))) a = addDays(a, -1);
  while (isRestDay(addDays(b, 1))) b = addDays(b, 1);
  return { start: a, end: b };
}

/**
 * 「今週末」の範囲。土日を含む連休のかたまりで、今日より前の日は含めない。
 *  - 今日が土日(または、土日につながる祝日)なら、今日から、その連休の終わりまで
 *  - それ以外は、次の土曜を含む連休(金曜・月曜の祝日も含む)
 * @returns {{start, end, days: string[], holiday: boolean}}
 */
export function weekendRange(today) {
  let blk = restBlock(today);
  const hasWeekend = (b) => { for (let d = b.start; d <= b.end; d = addDays(d, 1)) if (weekday(d) === 0 || weekday(d) === 6) return true; return false; };
  if (!blk || !hasWeekend(blk)) {
    let sat = addDays(today, 1);
    while (weekday(sat) !== 6) sat = addDays(sat, 1);
    blk = restBlock(sat);
  }
  const start = blk.start < today ? today : blk.start;
  const days = [];
  for (let d = start; d <= blk.end; d = addDays(d, 1)) days.push(d);
  return { start, end: blk.end, days, holiday: days.some((d) => !!holidayName(d)) };
}

const WD = "日月火水木金土";
/** "2026-10-10" → "10月10日(土)" */
export const mdLabel = (s) => `${+s.slice(5, 7)}月${+s.slice(8, 10)}日(${WD[weekday(s)]})`;
/** "10月10日(土)〜12日(月・祝)" のような範囲の表記 */
export function rangeLabel(a, b) {
  const w = (s) => `${WD[weekday(s)]}${holidayName(s) && weekday(s) !== 0 ? "・祝" : ""}`;
  const one = (s, withMonth) => `${withMonth ? `${+s.slice(5, 7)}月` : ""}${+s.slice(8, 10)}日(${w(s)})`;
  if (a === b) return one(a, true);
  return `${one(a, true)}〜${one(b, a.slice(0, 7) !== b.slice(0, 7))}`;
}

/**
 * 定期公演が、その日に行われる予定か(データの weekdays / months / closedDates / until による)。
 * weekdays がない公演は、日付が分からないため、false。
 */
export function regularOn(r, s) {
  if (!Array.isArray(r.weekdays) || !r.weekdays.includes(weekday(s))) return false;
  if (r.until && s > r.until) return false;
  if (Array.isArray(r.months) && !r.months.includes(+s.slice(5, 7))) return false;
  if (Array.isArray(r.closedDates) && r.closedDates.includes(s.slice(5))) return false;
  return true;
}
export const isDaily = (r) => Array.isArray(r.weekdays) && r.weekdays.length === 7;
