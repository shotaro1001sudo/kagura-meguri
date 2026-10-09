// 公式サイトからの開催情報の、週次の自動収集と、自動掲載: node scripts/collect.mjs [sourceId]
//
// 流れ: 取得 → 読み取り(アダプタ) → 1件ずつ自動検査 → 掲載 / 保留 / 取り下げ → レポート
//  - data/sources.json の、規約確認済み(termsChecked あり)かつ enabled の収集元だけを対象にする
//  - robots.txt を守り、リクエスト間隔をあけ、連絡先つきUAで名乗る
//  - 取り込むのは事実(名称・日時・場所・出典URL)だけ。本文や写真は取り込まない
//  - 判断のルールは scripts/lib/collect-core.mjs。設定は config.json の "collect"
//  - 検査に通ったものは、自動で status:"published"。通らないものは "pending"(node scripts/review.mjs で、人が確認)
//  - 運営者が登録した情報(auto でないもの)は、書き換えない
// テスト用の切り替え: EVENTS_FILE / SOURCES_FILE / REJECTED_FILE / REPORT_FILE / SUMMARY_FILE / COLLECT_NOW / COLLECT_DELAY_MS
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { robotsAllows, sleep } from "./lib/util.mjs";
import { reconcile, DEFAULTS, today } from "./lib/collect-core.mjs";

const readJson = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, "")) : d);
const EVENTS_FILE = process.env.EVENTS_FILE ?? "data/events.json";
const SOURCES_FILE = process.env.SOURCES_FILE ?? "data/sources.json";
const REJECTED_FILE = process.env.REJECTED_FILE ?? "data/rejected.json";
const REPORT_FILE = process.env.REPORT_FILE ?? "data/collect-report.md";
const SUMMARY_FILE = process.env.SUMMARY_FILE ?? "data/collect-summary.json";

const cfg = readJson("config.json", {});
const ccfg = { ...DEFAULTS, ...(cfg.collect ?? {}) };
if (process.env.COLLECT_AUTOPUBLISH) ccfg.autoPublish = process.env.COLLECT_AUTOPUBLISH === "1"; // テスト用
// 取得先に名乗る名前。連絡先は、メールアドレスではなく、お問い合わせのページで示す
const UA = `KaguraMeguriBot/1.0 (+${cfg.baseUrl}/contact.html)`;
const DELAY_MS = Number(process.env.COLLECT_DELAY_MS ?? 3000);
const now = process.env.COLLECT_NOW ? new Date(process.env.COLLECT_NOW) : new Date();
const only = process.argv[2];

if (!existsSync(SOURCES_FILE)) { console.log(`${SOURCES_FILE} がありません。data/sources.example.json を参考に作成してください`); process.exit(0); }
const sources = readJson(SOURCES_FILE, []);
let events = readJson(EVENTS_FILE, []);
const rejectedIds = new Set(readJson(REJECTED_FILE, []).map((e) => e.id));

const lines = [], published = [], held = [], withdrawn = [];
let errors = 0, notes = 0, inactive = 0;

for (const s of sources) {
  if (only && s.id !== only) continue;
  if (s.enabled === false) { lines.push(`- ⏸ ${s.id}: 停止中(enabled: false)`); continue; }
  if (!s.termsChecked) { lines.push(`- ⚠ ${s.id}: 利用規約の確認日(termsChecked)が未記入のため、取得していません`); inactive++; continue; }
  try {
    const robots = await robotsAllows(s.url, UA);
    if (!robots.ok) { lines.push(`- ⛔ ${s.id}: ${robots.reason}。取得しません`); errors++; continue; }
    const res = await fetch(s.url, { headers: { "user-agent": UA, "accept-language": "ja" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) { lines.push(`- ❌ ${s.id}: HTTP ${res.status}(この収集元は、今回、変更していません)`); errors++; continue; }
    const body = await res.text();
    const adapter = await import(pathToFileURL(`${process.cwd()}/scripts/adapters/${s.adapter}.mjs`).href);
    const items = adapter.parse(body, s);
    const r = reconcile({ events, candidates: items, source: s, now, rejectedIds, cfg: ccfg });
    events = r.events;
    published.push(...r.summary.published); held.push(...r.summary.held); withdrawn.push(...r.summary.withdrawn);
    notes += r.summary.notes.length;
    const x = r.summary;
    lines.push(`- ✅ ${s.id}(${s.name}): 取得 ${x.fetched} 件 → 新規掲載 ${x.published.length} / 保留 ${x.held.length} / 取り下げ ${x.withdrawn.length} / 変更なし ${x.unchanged} / 重複 ${x.duplicates} / 過去 ${x.past} / 却下済み ${x.rejected}${items.skippedPeriod ? ` / 期間指定で除外 ${items.skippedPeriod}` : ""}${x.fetched === 0 ? " ← 0件。ページ構造が変わった可能性" : ""}`);
    for (const n of x.notes) lines.push(`    - ⚠ ${n}`);
  } catch (err) { lines.push(`- ❌ ${s.id}: ${err.message}(この収集元は、今回、変更していません)`); errors++; }
  await sleep(DELAY_MS);
}

writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2));
const li = (e) => `- **${e.name}**(${e.start.slice(0, 10)} ${e.prefecture}${e.city ?? ""} ${e.venue ?? ""})[公式](${e.url})${e.note ? ` — ${e.note}` : ""}`;
const attention = held.length > 0 || errors > 0 || notes > 0;
const text = `# 週次の自動収集レポート ${today(now)}

${attention ? "**⚠ 確認が必要な項目があります。**" : "確認が必要な項目は、ありません。"}${inactive ? `(ただし、規約の確認待ちで、止まっている収集元が ${inactive} つあります)` : ""}  自動掲載: ${ccfg.autoPublish ? "オン" : "オフ(すべて保留)"}

## 収集元ごとの結果
${lines.join("\n") || "- 対象の収集元なし(規約を確認し、termsChecked を記入した収集元がありません)"}

## 自動で掲載したもの(${published.length}件)
${published.map(li).join("\n") || "- なし"}

## 保留(掲載していないもの。要確認 ${held.length}件)
${held.map((e) => `${li(e)}\n  - 理由: ${(e.holdReasons ?? []).join(" / ")}`).join("\n") || "- なし"}
掲載してよければ \`node scripts/review.mjs approve <id>\`、不要なら \`reject <id>\` を実行してください。

## 取り下げたもの(${withdrawn.length}件)
${withdrawn.map((e) => `${li(e)}\n  - 理由: ${e.withdrawnReason}`).join("\n") || "- なし"}
`;
writeFileSync(REPORT_FILE, text);
// 通知(LINE)用の明細。公開してよい事実(名称・日付・場所・URL・理由)だけ
const pick = (e, reason) => ({ name: e.name, start: e.start, prefecture: e.prefecture, city: e.city ?? "", url: e.url, ...(e.note ? { note: e.note } : {}), ...(reason ? { reason } : {}) });
writeFileSync(SUMMARY_FILE, JSON.stringify({
  date: today(now), autoPublish: ccfg.autoPublish, published: published.length, held: held.length, withdrawn: withdrawn.length, errors, inactive, needsAttention: attention,
  items: { published: published.map((e) => pick(e)), held: held.map((e) => pick(e, (e.holdReasons ?? []).join(" / "))), withdrawn: withdrawn.map((e) => pick(e, e.withdrawnReason)) },
}, null, 2));
console.log(text);
