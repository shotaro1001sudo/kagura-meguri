// その日のSNS投稿(開催のお知らせ+神楽の読み物)を、Buffer の予約投稿に入れる: node scripts/post-social.mjs
//
// 設定:
//   BUFFER_API_KEY(GitHub の Secrets に入れる。リポジトリのファイルには、書かない)
//     … Buffer の Settings → API で発行する個人用のAPIキー
//   config.json の social … 投稿枠(firstSlot / intervalHours / perDay)と、Buffer のチャンネル(bufferChannelId。空なら X のチャンネルを自動で探す)
// BUFFER_API_KEY が空、または DRY_RUN=true のときは、送らずに、予定の文面と時刻だけを表示する(記録もしない)。
// 投稿済みの記録: data/social-posted.json(同じ開催・同じ枠を、二度入れないため)
// テスト用の切り替え: EVENTS_FILE / POSTED_FILE / POST_NOW(日本時間の日付 YYYY-MM-DD)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { planDay } from "./lib/x-post.mjs";

const API = "https://api.buffer.com";
const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, "")) : fallback);
const jstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const jstLabel = (iso) => new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(5, 16).replace("T", " ");

async function gql(key, query, variables = {}) {
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.errors?.length) throw new Error(`Buffer API エラー: HTTP ${res.status} ${JSON.stringify(body.errors ?? body).slice(0, 300)}`);
  return body.data;
}

async function findChannel(key) {
  const { account } = await gql(key, "query { account { organizations { id name } } }");
  const found = [];
  for (const org of account?.organizations ?? []) {
    const { channels } = await gql(key, `query { channels(input: { organizationId: ${gqlStr(org.id)} }) { id name service } }`);
    found.push(...(channels ?? []));
  }
  const x = found.filter((c) => ["twitter", "x"].includes(String(c.service).toLowerCase()));
  if (x.length !== 1) throw new Error(`X のチャンネルを1つに決められません(${found.map((c) => `${c.name}:${c.service}:${c.id}`).join(", ") || "チャンネルなし"})。config.json の social.bufferChannelId に、使うチャンネルのIDを入れてください`);
  return x[0].id;
}

// 公式ドキュメントの例と同じ形(値は JSON の文字列表記 = GraphQL の文字列として正しい)で書く
export const gqlStr = (v) => JSON.stringify(String(v));
export const createPostQuery = ({ text, channelId, dueAt }) => `mutation {
  createPost(input: {
    text: ${gqlStr(text)},
    channelId: ${gqlStr(channelId)},
    schedulingType: automatic,
    mode: customScheduled,
    dueAt: ${gqlStr(dueAt)}
  }) {
    ... on PostActionSuccess { post { id dueAt } }
    ... on MutationError { message }
  }
}`;

async function main() {
  const cfg = readJson("config.json", {});
  const social = cfg.social ?? {};
  const postedFile = process.env.POSTED_FILE ?? "data/social-posted.json";
  const events = readJson(process.env.EVENTS_FILE ?? "data/events.json", []);
  const info = readJson("data/kagura-info.json", {});
  const posted = readJson(postedFile, []);
  const today = process.env.POST_NOW || jstToday();
  const key = (process.env.BUFFER_API_KEY ?? "").trim();
  const live = process.env.DRY_RUN !== "true" && !!key;
  if (!live) console.log("【試運転】BUFFER_API_KEY が未設定、または DRY_RUN のため、Buffer には入れず、文面だけ表示します");

  const now = process.env.POST_NOW ? Date.parse(`${today}T00:00:00+09:00`) : Date.now();
  const plan = planDay({ events, info, posted, todayJst: today, baseUrl: cfg.baseUrl, social, now });
  if (!plan.length) { console.log(`${today}: 予約する投稿はありません`); return; }

  const channelId = live ? (social.bufferChannelId || await findChannel(key)) : "";
  let failed = false;
  for (const p of plan) {
    console.log(`--- ${jstLabel(p.dueAt)} [${p.type}] ${p.id} ---\n${p.text}\n`);
    if (!live) continue;
    try {
      const data = await gql(key, createPostQuery({ text: p.text, channelId, dueAt: p.dueAt }));
      const r = data.createPost ?? {};
      if (!r.post?.id) throw new Error(`Buffer に予約できませんでした: ${r.message ?? JSON.stringify(r).slice(0, 200)}`);
      posted.push({ id: p.id, type: p.type, dueAt: p.dueAt, bufferId: r.post.id, date: today });
      writeFileSync(postedFile, JSON.stringify(posted, null, 2) + "\n"); // 1件ごとに記録(途中で失敗しても、重複しない)
      console.log(`予約しました: ${r.post.id}`);
    } catch (err) { console.error(err.message); failed = true; break; }
  }
  if (failed) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().catch((err) => { console.error(err.message); process.exit(1); });
