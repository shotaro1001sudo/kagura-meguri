// 中長期の分析: 計測の内訳を履歴に残し、月ごと・28日ごとの推移をまとめる(すべて非公開の analytics/ の中)。
//
//   node scripts/analytics-history.mjs save     … analytics/sheet.json の 13_計測内訳 を analytics/history/<期間の末日>.json に残す
//                                                 (分析タスクが xlsx-to-json.mjs のすぐ後に実行する)
//   node scripts/analytics-history.mjs trends   … analytics/series.json と履歴から、推移を analytics/trends.json に書く
//                                                 (月次の分析タスクが読む。画面には短い要約だけを出す)
//
// 数字は公開しない。analytics/ は .gitignore 済み。
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { snapshotsFromRows, mergeSnapshots, buildTrends } from "./lib/analytics-history.mjs";

const DIR = "analytics/history";
const read = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

function loadHistory() {
  if (!existsSync(DIR)) return {};
  const h = {};
  for (const f of readdirSync(DIR)) if (/^\d{4}-\d{2}-\d{2}\.json$/.test(f)) h[f.slice(0, 10)] = JSON.parse(readFileSync(join(DIR, f), "utf8"));
  return h;
}

const cmd = process.argv[2];
if (cmd === "save") {
  const sheet = read("analytics/sheet.json");
  const rows = sheet?.sheets?.["13_計測内訳"];
  if (!Array.isArray(rows)) { console.error("analytics/sheet.json に 13_計測内訳 がありません(先に xlsx-to-json.mjs を実行する)"); process.exit(1); }
  const { history, changed } = mergeSnapshots(loadHistory(), snapshotsFromRows(rows));
  mkdirSync(DIR, { recursive: true });
  for (const d of changed) writeFileSync(join(DIR, `${d}.json`), JSON.stringify(history[d]) + "\n");
  const all = Object.keys(history).sort();
  console.log(changed.length ? `内訳の履歴に残しました: ${changed.join(", ")}` : "内訳の履歴: 新しい内訳はありません(同じ期間は保存済み)");
  console.log(`履歴: ${all.length} 日分(${all[0] ?? "-"} 〜 ${all.at(-1) ?? "-"})`);
} else if (cmd === "trends") {
  const t = buildTrends({ series: read("analytics/series.json"), history: loadHistory(), today });
  writeFileSync("analytics/trends.json", JSON.stringify(t, null, 1) + "\n");
  console.log("analytics/trends.json を書きました");
  console.log(`月ごとの記録: ${t.monthly.map((m) => m.month + (m.partial ? "(途中)" : "")).join(", ") || "なし"}`);
  console.log(`内訳の履歴: ${t.history.snapshots} 日分(${t.history.first ?? "-"} 〜 ${t.history.last ?? "-"})`);
  for (const [k, b] of Object.entries(t.breakdowns)) {
    console.log(`${k}: 前の28日と${b.vsPrev28 ? "比べた" : `まだ比べられない(末日が ${b.prev28AvailableFrom} 以降の内訳から)`} / 3か月前と${b.vs3MonthsAgo ? "比べた" : "まだ比べられない"}`);
  }
} else {
  console.error("使い方: node scripts/analytics-history.mjs save | trends");
  process.exit(1);
}
