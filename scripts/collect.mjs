// 公式サイトからの開催情報の収集: node scripts/collect.mjs [sourceId]
// - data/sources.json の、規約確認済み(termsChecked あり)かつ enabled なサイトだけを対象にする
// - robots.txt を守り、リクエスト間隔をあけ、連絡先つきUAで名乗る
// - 取り込むのは事実(名称・日時・場所・出典URL)だけ。本文や写真は取り込まない
// - 取り込んだものは必ず status:"pending"。公開は node scripts/review.mjs で人が承認する
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { clean, hash, robotsAllows, sleep } from "./lib/util.mjs";

const cfg = JSON.parse(readFileSync("config.json", "utf8").replace(/^﻿/, ""));
const UA = `KaguraMeguriBot/1.0 (+${cfg.baseUrl}/about.html; ${cfg.operator.contact})`;
const DELAY_MS = 3000;
const only = process.argv[2];

if (!existsSync("data/sources.json")) { console.log("data/sources.json がありません。data/sources.example.json を参考に作成してください"); process.exit(0); }
const sources = JSON.parse(readFileSync("data/sources.json", "utf8").replace(/^﻿/, ""));
const events = JSON.parse(readFileSync("data/events.json", "utf8").replace(/^﻿/, ""));
const key = (e) => `${e.name}|${e.start}|${e.prefecture}`;
const rejected = existsSync("data/rejected.json") ? JSON.parse(readFileSync("data/rejected.json", "utf8").replace(/^﻿/, "")) : [];
const seen = new Set([...events.map((e) => e.id), ...rejected.map((e) => e.id)]);
const seenKey = new Set(events.map(key));
const now = new Date();
const report = [];
let added = 0;

for (const s of sources) {
  if (only && s.id !== only) continue;
  if (s.enabled === false) continue;
  if (!s.termsChecked) { report.push(`- ⚠ ${s.id}: 利用規約の確認日(termsChecked)が未記入のためスキップ`); continue; }
  try {
    const robots = await robotsAllows(s.url, UA);
    if (!robots.ok) { report.push(`- ⛔ ${s.id}: ${robots.reason}。取得しません`); continue; }
    const res = await fetch(s.url, { headers: { "user-agent": UA, "accept-language": "ja" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) { report.push(`- ❌ ${s.id}: HTTP ${res.status}`); continue; }
    const html = await res.text();
    const adapter = await import(pathToFileURL(`${process.cwd()}/scripts/adapters/${s.adapter}.mjs`).href);
    const items = adapter.parse(html, s);
    let n = 0, skipped = 0;
    for (const it of items) {
      const ev = {
        id: `${s.id}-${hash(it.name, it.start)}`,
        name: clean(it.name),
        kagura: s.kagura || "",
        prefecture: it.prefecture || s.prefecture || "",
        city: it.city || "",
        venue: it.venue || "",
        address: it.address || undefined,
        start: it.start,
        end: it.end || undefined,
        timeUnknown: it.timeUnknown || undefined,
        fee: "",
        url: it.url || s.url,
        description: "",
        source: s.name,
        sourceUrl: s.url,
        collectedAt: now.toISOString().slice(0, 10),
        status: "pending",
      };
      if (!ev.name || !ev.start || new Date(ev.end || ev.start) < now) { skipped++; continue; }
      if (seen.has(ev.id) || seenKey.has(key(ev))) { skipped++; continue; }
      events.push(JSON.parse(JSON.stringify(ev)));
      seen.add(ev.id); seenKey.add(key(ev)); n++;
    }
    added += n;
    report.push(`- ✅ ${s.id} (${s.name}): 新規 ${n} 件 / 既存・過去などで除外 ${skipped} 件 / 取得 ${items.length} 件${items.length === 0 ? " ← 0件。ページ構造が変わった可能性" : ""}${items.skippedPeriod ? ` / 期間指定のため除外 ${items.skippedPeriod} 件(複数日をまとめたページ。手で確認)` : ""}`);
  } catch (err) { report.push(`- ❌ ${s.id}: ${err.message}`); }
  await sleep(DELAY_MS);
}

writeFileSync("data/events.json", JSON.stringify(events, null, 2));
const text = `# 収集レポート ${now.toISOString().slice(0, 10)}\n\n${report.join("\n") || "- 対象サイトなし"}\n\n新規 pending: ${added} 件。内容を確認し、\`node scripts/review.mjs\` で承認してください。\n`;
writeFileSync("data/collect-report.md", text);
console.log(text);
