// 週次の分析(Claude の定期タスク)が、新しい収益化の案を「検討中」で analytics/plan.json に足すための入口。
//   使い方: node scripts/admin/propose-mon.mjs <案の JSON ファイル>
//   JSON は配列(2件まで)。各案: { title, summary, why, expectedYen: [下限, 上限], effort, risk, firstStep, ask, evidence }
// 採用・見送りは、運営者が管理者用ページの「目標・収益」で決める。このスクリプトは足すだけで、既存の案は変えない。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { addMonetizationProposals } from "./store.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const file = process.argv[2];
if (!file) { console.error("使い方: node scripts/admin/propose-mon.mjs <案の JSON ファイル>"); process.exit(2); }
let items;
try { items = JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, "")); }
catch (e) { console.error(`JSON が読めません: ${e.message}`); process.exit(2); }
const r = addMonetizationProposals(root, Array.isArray(items) ? items : [items]);
if (r.error) { console.error(r.error); process.exit(1); }
for (const x of r.added) console.log(`追加: ${x.id} ${x.title}`);
for (const t of r.skipped) console.log(`同じ題名の案があるので、足さなかった: ${t}`);
