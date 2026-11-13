// 週次の分析(Claude の定期タスク)が、営業の候補を「候補」の段階で analytics/pipeline.json に足すための入口。
//   使い方: node scripts/admin/propose-lead.mjs <候補の JSON ファイル>
//   JSON は配列(3件まで)。各候補: { name, kind, offer, url, contact, email, formUrl, phone, subject, body, memo }
//   kind は 神楽団 / 主催者・保存会 / 観光協会・自治体 / 宿 / 会場・施設 / その他。offer は MON-1(神楽団・保存会・主催者向け。同じメニューを半額で)/ MON-2 / other。
// 送るのは運営者(管理者用ページの「営業」で確かめてから)。このスクリプトは足すだけで、既存の相手は変えない。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { addSuggestedLeads } from "./pipeline.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const file = process.argv[2];
if (!file) { console.error("使い方: node scripts/admin/propose-lead.mjs <候補の JSON ファイル>"); process.exit(2); }
let items;
try { items = JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, "")); }
catch (e) { console.error(`JSON が読めません: ${e.message}`); process.exit(2); }
const r = addSuggestedLeads(root, Array.isArray(items) ? items : [items], today);
if (r.error) { console.error(r.error); process.exit(1); }
for (const x of r.added) console.log(`追加: ${x.id} ${x.name}`);
for (const n of r.skipped) console.log(`同じ名前の相手が台帳にあるので、足さなかった: ${n}`);
for (const e of r.errors) console.log(`足せなかった: ${e.name ?? ""} ${e.error}${e.fields ? " " + JSON.stringify(e.fields) : ""}`);
if (r.errors.length && !r.added.length) process.exit(1);
