// アダプタ: iCalendar(.ics)の公開フィードを読む。自治体・観光協会のイベントカレンダーに、よくある形式。
// 読むのは、SUMMARY(名称)・DTSTART/DTEND(日時)・LOCATION(場所)・URL だけ。説明文(DESCRIPTION)は、取り込まない。
import { clean, findPrefecture } from "../lib/util.mjs";

const unfold = (t) => t.replace(/\r?\n[ \t]/g, ""); // 折り返された行を、つなぐ
const unesc = (s) => s.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1");
const pad = (n) => String(n).padStart(2, "0");

// DTSTART:20261120T200000 / DTSTART;TZID=Asia/Tokyo:20261120T200000 / DTSTART;VALUE=DATE:20261120 / ...Z(UTC)
function dt(line) {
  const m = line.match(/^[A-Z-]+((?:;[^:]+)*):(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
  if (!m) return null;
  const [, params, y, mo, d, h, mi, , z] = m;
  if (h === undefined) return { date: `${y}-${mo}-${d}`, allDay: true };
  if (z) { const t = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi) + 9 * 3600e3); return { date: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`, time: `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}` }; }
  return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}` };
}

export function parse(text, source) {
  const out = [];
  for (const block of unfold(text).split("BEGIN:VEVENT").slice(1)) {
    const body = block.split("END:VEVENT")[0];
    const get = (k) => body.split(/\r?\n/).find((l) => l.startsWith(k + ":") || l.startsWith(k + ";"));
    const s = get("SUMMARY"), a = get("DTSTART"); if (!s || !a) continue;
    const start = dt(a); if (!start) continue;
    const b = get("DTEND"), end = b ? dt(b) : null;
    const loc = clean(unesc((get("LOCATION") ?? "").replace(/^LOCATION[^:]*:/, "")));
    const u = (get("URL") ?? "").replace(/^URL[^:]*:/, "").trim();
    const prefecture = findPrefecture(loc) || source.prefecture || "";
    const rest = loc.replace(prefecture, "").trim();
    let city = source.city || "", venue = rest;
    if (city && rest.startsWith(city)) venue = rest.slice(city.length).trim();
    else if (!city) { const m = rest.match(/^(?:[^\s]{1,6}郡)?[^\s]{1,6}?[市区町村]/); if (m) { city = m[0]; venue = rest.slice(city.length).trim(); } }
    // 終日(時間なし)の終了日は、翌日の0時で表されるため、前日に直す
    let endIso;
    if (end && !(start.allDay && end.allDay)) endIso = `${end.date}T${end.time ?? "00:00"}`;
    else if (end && start.allDay) { const e = new Date(Date.parse(`${end.date}T00:00:00Z`) - 864e5).toISOString().slice(0, 10); if (e > start.date) endIso = `${e}T00:00`; }
    out.push({
      name: clean(unesc(s.replace(/^SUMMARY[^:]*:/, ""))), start: `${start.date}T${start.time ?? "00:00"}`, end: endIso,
      timeUnknown: start.allDay ? true : undefined, prefecture, city, venue: clean(venue),
      url: /^https?:\/\//.test(u) ? u : source.url,
    });
  }
  return out;
}
