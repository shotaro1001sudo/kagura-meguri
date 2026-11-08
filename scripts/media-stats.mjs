// 「広告・協賛のご案内」に載せるアクセス数の概数を、非公開の分析データから作る(MON-2)。
//   node scripts/media-stats.mjs
// 読む: analytics/series.json・analytics/state.json(非公開・git に入らない)
// 書く: data/media-stats.json(公開。丸めた概数と、よく読まれているページのパスだけ)
// 週次の分析タスクが series.json を更新した後に実行する。書いたファイルは、ほかの変更と同じくコミットして公開する。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { computeMediaStats, mediaStatsErrors, approx } from "./lib/media-stats.mjs";

const read = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);
const series = read("analytics/series.json");
if (!series) { console.error("analytics/series.json がありません(週次の分析タスクが作ります)"); process.exit(1); }
const state = read("analytics/state.json");
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

const stats = computeMediaStats(series, state, today);
const errs = mediaStatsErrors(stats);
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
writeFileSync("data/media-stats.json", JSON.stringify(stats, null, 1) + "\n");

const line = (label, b, k) => (b ? `${label}: ${approx(b[k])}(${b.from}〜${b.to})` : `${label}: 載せない(値が返ってきた日が足りない)`);
console.log([
  "data/media-stats.json を書きました",
  line("検索の表示回数", stats.search, "impressions"),
  line("検索からの訪問", stats.search, "clicks"),
  line("ページの閲覧数", stats.analytics, "pageviews"),
  `よく読まれているページ: ${stats.topPages.join(", ") || "なし"}`,
].join("\n"));
