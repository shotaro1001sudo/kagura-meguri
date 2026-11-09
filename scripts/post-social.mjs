// 今日の残りと翌日のSNS投稿(開催のお知らせ+神楽の読み物)を、Buffer の予約投稿に入れる: node scripts/post-social.mjs
// (毎晩、翌日分を前もって入れる。朝にも念のため動き、空いた枠だけ埋める)
//
// 設定:
//   BUFFER_API_KEY(GitHub の Secrets に入れる。リポジトリのファイルには、書かない)
//     … Buffer の Settings → API で発行する個人用のAPIキー
//   config.json の social … 投稿枠(firstSlot / intervalHours / perDay)と、Buffer のチャンネル(bufferChannelId。空なら X のチャンネルを自動で探す)
// BUFFER_API_KEY が空、または DRY_RUN=true のときは、送らずに、予定の文面と時刻だけを表示する(記録もしない)。
// 投稿済みの記録: data/social-posted.json(同じ開催・同じ枠を、二度入れないため)
// POST_DAYS: 何日分を決めるか(既定 2 = 今日の残りと翌日。朝の念のための起動は 1 = 今日だけ。Buffer の無料プランは予約10件まで)
// テスト用の切り替え: EVENTS_FILE / POSTED_FILE / POST_NOW(日本時間の日付 YYYY-MM-DD)
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { planDays } from "./lib/x-post.mjs";
import { themeWeights } from "./lib/social-performance.mjs";

const API = "https://api.buffer.com";
const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, "")) : fallback);
const jstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const jstLabel = (iso) => new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(5, 16).replace("T", " ");

export async function gql(key, query, variables = {}) {
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await res.json().catch(() => ({}));
  const unauthorized = res.status === 401 || body.errors?.some((e) => e.extensions?.code === "UNAUTHORIZED");
  if (unauthorized) throw new Error("Buffer API が認証を拒否しました。APIキーの期限切れ、または取り消しの可能性があります。新しいキーを発行し、Secrets の BUFFER_API_KEY を更新してください");
  if (!res.ok || body.errors?.length) throw new Error(`Buffer API エラー: HTTP ${res.status} ${JSON.stringify(body.errors ?? body).slice(0, 300)}`);
  return body.data;
}

/** X のチャンネルと、その組織(organization)を探す。channelId を渡すと、そのチャンネルの組織を探す */
export async function findXChannel(key, channelId = "") {
  const { account } = await gql(key, "query { account { organizations { id name } } }");
  const found = [];
  for (const org of account?.organizations ?? []) {
    const { channels } = await gql(key, `query { channels(input: { organizationId: ${gqlStr(org.id)} }) { id name service } }`);
    found.push(...(channels ?? []).map((c) => ({ ...c, organizationId: org.id })));
  }
  const x = channelId ? found.filter((c) => c.id === channelId) : found.filter((c) => ["twitter", "x"].includes(String(c.service).toLowerCase()));
  if (x.length !== 1) throw new Error(`X のチャンネルを1つに決められません(${found.map((c) => `${c.name}:${c.service}:${c.id}`).join(", ") || "チャンネルなし"})。config.json の social.bufferChannelId に、使うチャンネルのIDを入れてください`);
  return { channelId: x[0].id, organizationId: x[0].organizationId };
}
const findChannel = async (key) => (await findXChannel(key)).channelId;

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

// Buffer の予約件数の上限(無料プランは10件)に当たったときの返事。失敗ではなく、残りは次の起動で埋める
export const isScheduleLimit = (message) => /scheduled posts limit reached/i.test(String(message ?? ""));

export const KEY_NOTICE_DAYS = 14;
/** APIキーの期限(config.json の social.bufferKeyExpires, YYYY-MM-DD)が近い・過ぎたときの知らせ。なければ "" */
export function keyExpiryNotice(expires, todayJst) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expires ?? "")) return "";
  const days = Math.round((Date.parse(`${expires}T00:00:00Z`) - Date.parse(`${todayJst}T00:00:00Z`)) / 86400e3);
  if (days > KEY_NOTICE_DAYS) return "";
  return days < 0
    ? `BufferのAPIキーの期限(${expires})が過ぎています。新しいキーを発行し、Secrets の BUFFER_API_KEY と config.json の social.bufferKeyExpires を更新してください`
    : `BufferのAPIキーの期限(${expires})まで、あと${days}日です。新しいキーを発行し、Secrets の BUFFER_API_KEY と config.json の social.bufferKeyExpires を更新してください`;
}

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
  const notice = keyExpiryNotice(social.bufferKeyExpires, today);
  if (notice) {
    console.log(notice);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `key_notice=${notice}\n`); // ワークフローが Issue で知らせる
  }

  const now = process.env.POST_NOW ? Date.parse(`${today}T00:00:00+09:00`) : Date.now();
  // 反応のよいテーマを先に出す(週次の振り返りが data/social-performance.json を更新する)
  const weights = themeWeights(readJson(process.env.PERFORMANCE_FILE ?? "data/social-performance.json", {}));
  if (Object.keys(weights).length) console.log(`テーマの重み(反応の相対値): ${JSON.stringify(weights)}`);
  const days = process.env.POST_DAYS === "1" ? 1 : 2;
  // 書き出しの1行(週次の分析が、反応を見ながら書く。管理者用ページが自動で公開する)
  const hooks = readJson(process.env.HOOKS_FILE ?? "data/social-hooks.json", {});
  const plan = planDays({ days, events, info, posted, todayJst: today, baseUrl: cfg.baseUrl, social, now, weights, hooks });
  if (!plan.length) { console.log(`${today}〜翌日: 予約する投稿はありません(枠はすべて予約済みか、過ぎています)`); return; }

  const channelId = live ? (social.bufferChannelId || await findChannel(key)) : "";
  let failed = false;
  for (const p of plan) {
    console.log(`--- ${jstLabel(p.dueAt)} [${p.type}${p.style === "hook" ? "・書き出しあり" : ""}${p.link ? "" : "・URLなし"}] ${p.id} ---\n${p.text}\n`);
    if (!live) continue;
    try {
      const data = await gql(key, createPostQuery({ text: p.text, channelId, dueAt: p.dueAt }));
      const r = data.createPost ?? {};
      if (!r.post?.id && isScheduleLimit(r.message)) {
        // 夜の起動が翌朝まで遅れると、今日の残り+翌日で10件を超えることがある。入らなかった枠は記録せず、次の起動で入れる
        console.log(`Buffer の予約件数の上限に達したため、ここで止めます(残りは次の起動で入れます): ${r.message}`);
        break;
      }
      if (!r.post?.id) throw new Error(`Buffer に予約できませんでした: ${r.message ?? JSON.stringify(r).slice(0, 200)}`);
      posted.push({ id: p.id, type: p.type, style: p.style, link: p.link, dueAt: p.dueAt, bufferId: r.post.id, date: p.date });
      writeFileSync(postedFile, JSON.stringify(posted, null, 2) + "\n"); // 1件ごとに記録(途中で失敗しても、重複しない)
      console.log(`予約しました: ${r.post.id}`);
    } catch (err) { console.error(err.message); failed = true; break; }
  }
  if (failed) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().catch((err) => { console.error(err.message); process.exit(1); });
