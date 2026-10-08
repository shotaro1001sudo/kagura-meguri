// pending の確認と承認:
//   node scripts/review.mjs                 一覧を表示
//   node scripts/review.mjs approve <id>... 承認して公開対象にする("all" で全件)
//   node scripts/review.mjs reject <id>...  却下して削除(同じものを再取得しないよう data/rejected.json に記録)
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const read = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, "")) : d);
const events = read("data/events.json", []);
const rejected = read("data/rejected.json", []);
const [cmd, ...ids] = process.argv.slice(2);
const pending = events.filter((e) => e.status === "pending");

if (!cmd) {
  if (!pending.length) console.log("pending はありません");
  for (const e of pending) {
    console.log(`${e.id}\n  ${e.name} / ${e.start} / ${e.prefecture}${e.city} ${e.venue}\n  出典: ${e.source} ${e.sourceUrl}\n  公式: ${e.url}${e.kagura ? "" : "\n  ⚠ kagura(神楽の種類)が空です"}${e.prefecture ? "" : "\n  ⚠ prefecture が空です"}`);
  }
  console.log(`\n${pending.length} 件`);
  process.exit(0);
}

const targets = ids[0] === "all" ? pending : pending.filter((e) => ids.includes(e.id));
if (!targets.length) { console.log("対象がありません"); process.exit(1); }

if (cmd === "approve") {
  const bad = targets.filter((e) => !e.prefecture || !e.kagura);
  if (bad.length) { console.log(`prefecture / kagura が空のものは承認できません。先に data/events.json で埋めてください:\n${bad.map((e) => "  " + e.id).join("\n")}`); process.exit(1); }
  targets.forEach((e) => { e.status = "published"; });
  console.log(`${targets.length} 件を公開対象にしました`);
} else if (cmd === "reject") {
  const set = new Set(targets.map((e) => e.id));
  rejected.push(...targets.map((e) => ({ id: e.id, name: e.name, start: e.start })));
  writeFileSync("data/rejected.json", JSON.stringify(rejected, null, 2));
  writeFileSync("data/events.json", JSON.stringify(events.filter((e) => !set.has(e.id)), null, 2));
  console.log(`${targets.length} 件を却下しました`);
  process.exit(0);
} else { console.log("approve / reject / (なし) のいずれかを指定してください"); process.exit(1); }
writeFileSync("data/events.json", JSON.stringify(events, null, 2));
