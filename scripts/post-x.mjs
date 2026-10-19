// 開催の2週間前から3日前までの神楽を、Xに自動で投稿する: node scripts/post-x.mjs
//
// 設定(GitHub の Secrets に入れる。リポジトリのファイルには、書かない):
//   X_API_KEY / X_API_SECRET           … X Developer Portal の「Consumer Keys」
//   X_ACCESS_TOKEN / X_ACCESS_SECRET   … 同「Access Token and Secret」(権限は Read and Write)
// どれかが空、または DRY_RUN=true のときは、投稿せず、投稿する予定の文面だけを表示する(記録もしない)。
// 投稿済みの記録: data/x-posted.json(同じ開催を、二度投稿しないため)
// テスト用の切り替え: EVENTS_FILE / POSTED_FILE / POST_NOW(日本時間の日付 YYYY-MM-DD)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { pickEvents, composeText, oauthHeader } from "./lib/x-post.mjs";

const API = "https://api.x.com/2/tweets";
const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, "")) : fallback);
const jstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

async function postTweet(text, keys) {
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: oauthHeader({ method: "POST", url: API, keys }), "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Xへの投稿に失敗しました: HTTP ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
  return body.data?.id;
}

async function main() {
  const cfg = readJson("config.json", {});
  const eventsFile = process.env.EVENTS_FILE ?? "data/events.json";
  const postedFile = process.env.POSTED_FILE ?? "data/x-posted.json";
  const events = readJson(eventsFile, []);
  const posted = readJson(postedFile, []);
  const today = process.env.POST_NOW || jstToday();
  const keys = { apiKey: process.env.X_API_KEY, apiSecret: process.env.X_API_SECRET, accessToken: process.env.X_ACCESS_TOKEN, accessSecret: process.env.X_ACCESS_SECRET };
  const live = process.env.DRY_RUN !== "true" && Object.values(keys).every((v) => (v ?? "").trim());
  if (live) for (const k of Object.keys(keys)) keys[k] = keys[k].trim();
  else console.log("【試運転】Xの鍵が未設定、または DRY_RUN のため、投稿せず、文面だけ表示します");

  const targets = pickEvents(events, posted, today);
  if (!targets.length) { console.log(`${today}: 投稿する開催はありません`); return; }
  let failed = false;
  for (const e of targets) {
    const text = composeText(e, cfg.baseUrl);
    console.log(`--- ${e.id} ---\n${text}\n`);
    if (!live) continue;
    try {
      const tweetId = await postTweet(text, keys);
      posted.push({ id: e.id, tweetId, date: today });
      writeFileSync(postedFile, JSON.stringify(posted, null, 2) + "\n"); // 1件ごとに記録(途中で失敗しても、重複しない)
      console.log(`投稿しました: ${tweetId}`);
    } catch (err) { console.error(err.message); failed = true; break; }
  }
  if (failed) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().catch((err) => { console.error(err.message); process.exit(1); });
