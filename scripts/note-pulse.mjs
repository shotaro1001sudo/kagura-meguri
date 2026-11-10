// note の最後の投稿日を、公開の RSS から読む: node scripts/note-pulse.mjs
//
// 週次の振り返り(weekly-review.yml)が、振り返りの前に動かす。
// note の投稿は、このPCの予定タスクが行う(PC やアプリが閉じていると動かない)。GitHub からは PC の中が見えないので、
// 公開されている跡(RSS)で「止まっていないか」を確かめる。
// 読むもの: https://note.com/<config.note.urlname>/rss(公開の情報だけ。ログインしない)
// 書くもの: NOTE_PULSE_FILE(既定 data/note-pulse.json。コミットしない)
//           { status: "ok" | "unavailable" | "no_account", lastPost: "YYYY-MM-DD" | null, reason }
// 失敗しても止めない(振り返りは続ける。読めなければ「確認できませんでした」と出るだけ)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, "")) : fallback);

/** RSS の本文から、いちばん新しい投稿の日(日本時間)。投稿がなければ null。RSS として読めなければ例外 */
export function lastPostDay(xml) {
  if (!/<rss[\s>]/.test(xml)) throw new Error("RSS ではない応答");
  const times = [...xml.matchAll(/<item>[\s\S]*?<pubDate>([^<]+)<\/pubDate>/g)].map((m) => Date.parse(m[1])).filter(Number.isFinite);
  if (!times.length) return null;
  return new Date(Math.max(...times) + 9 * 3600e3).toISOString().slice(0, 10);
}

async function main() {
  const out = process.env.NOTE_PULSE_FILE ?? "data/note-pulse.json";
  const write = (o) => { writeFileSync(out, JSON.stringify(o, null, 2)); console.log(`note の投稿: ${o.status}${o.lastPost ? `(最後は ${o.lastPost})` : ""}${o.reason ? ` ${o.reason}` : ""}`); };
  const urlname = String(readJson("config.json", {}).note?.urlname ?? "").trim();
  if (!/^[\w-]+$/.test(urlname)) return write({ status: "no_account", lastPost: null });
  try {
    const res = await fetch(`https://note.com/${urlname}/rss`, { headers: { "user-agent": "kagura-meguri-weekly-review" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    write({ status: "ok", lastPost: lastPostDay(await res.text()) });
  } catch (err) {
    write({ status: "unavailable", lastPost: null, reason: String(err.message).slice(0, 120) });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
