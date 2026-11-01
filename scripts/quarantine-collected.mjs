// Run after geocoding and before published-event tests. Keep the review report in sync.
import { readFileSync, writeFileSync } from "node:fs";
import { quarantineUnlocated } from "./lib/collection-quarantine.mjs";
const file = process.env.EVENTS_FILE ?? "data/events.json";
const summaryFile = process.env.SUMMARY_FILE ?? "data/collect-summary.json";
const reportFile = process.env.REPORT_FILE ?? "data/collect-report.md";
const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const { events, held } = quarantineUnlocated(read(file));
if (held.length) {
  const summary = read(summaryFile);
  const same = (a, b) => a.name === b.name && a.start === b.start && a.prefecture === b.prefecture;
  const wasPublished = summary.items.published.filter((a) => held.some((b) => same(a, b)));
  summary.items.published = summary.items.published.filter((a) => !held.some((b) => same(a, b)));
  summary.published -= wasPublished.length;
  summary.held += held.length;
  summary.needsAttention = true;
  summary.items.held.push(...held.map((e) => ({ name: e.name, start: e.start, prefecture: e.prefecture, city: e.city ?? "", url: e.url, reason: e.holdReasons.join(" / ") })));
  const report = readFileSync(reportFile, "utf8");
  writeFileSync(reportFile, report + `\n## 位置検査後の訂正（掲載 ${summary.published}件 / 新規保留 ${summary.held}件）\n\n以下は上記の収集時点の掲載判定から除外し、保留にしました。公開されません。\n${held.map((e) => `- **${e.name}** (${e.start}) [公式](${e.url}): ${e.holdReasons.join(" / ")}`).join("\n")}\n`);
  writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  writeFileSync(file, JSON.stringify(events, null, 2));
}
console.log(`位置検査: ${held.length}件を保留`);
