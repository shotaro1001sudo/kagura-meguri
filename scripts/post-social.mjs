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
// X Premium(config.json の social.xPremiumUntil の前日まで): 長い投稿にする。Buffer が長い投稿を断ったときは、その投稿だけ280字の文面で送り直す。
// 予約済みの見直し: 毎回、Buffer の予約済み(まだ出ていない)の投稿を読み、今の作り方で作り直した文面と違えば書き換える
//   (Premium の切り替え・書き出しの1行・開催の情報の更新を、予約済みの分にも反映する)。手で直された投稿・30分以内に出る投稿は変えない。
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { planDays, composeById } from "./lib/x-post.mjs";
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
// 文字数の上限で断られたときの返事(Buffer が X の Premium をまだ認識していない等)。280字の文面で送り直す
export const isLengthError = (message) => !isScheduleLimit(message) && /character|too long|length|文字/i.test(String(message ?? ""));

/** 送った文面の指紋。予約済みを見直すとき、手で直されていないか(送ったときのままか)を確かめる */
export const textHash = (text) => createHash("sha256").update(String(text)).digest("hex").slice(0, 16);

export const scheduledPostsQuery = ({ organizationId, channelId, after }) => `query {
  posts(first: 50${after ? `, after: ${gqlStr(after)}` : ""}, input: {
    organizationId: ${gqlStr(organizationId)},
    filter: { status: [scheduled], channelIds: [${gqlStr(channelId)}] }
  }) {
    edges { node { id text dueAt } }
    pageInfo { endCursor hasNextPage }
  }
}`;

// 時刻(mode・dueAt)は渡さない = 予約の時刻はそのままで、文面だけを変える
export const editPostQuery = ({ id, text }) => `mutation {
  editPost(input: { id: ${gqlStr(id)}, text: ${gqlStr(text)} }) {
    ... on PostActionSuccess { post { id dueAt } }
    ... on MutationError { message }
  }
}`;

// Buffer が認識している、X のサブスクの種類(Buffer はこれで、長い投稿を受け付けるかを決めているとみられる)
export const channelSubscriptionQuery = (channelId) => `query {
  channel(input: { id: ${gqlStr(channelId)} }) { metadata { ... on TwitterMetadata { subscriptionType } } }
}`;
/** Buffer が X の有料プランを認識していないと分かる値か(空・none・free)。分からない値なら、長い投稿を試す */
export const notPremium = (type) => !type || /^(none|free)$/i.test(String(type).trim());

export const REFRESH_MARGIN_MIN = 30; // これより先に出る予約だけを書き換える(送信の直前に変えない)

/**
 * 予約済みの見直しで、書き換えるものを決める(外部へは送らない部分)。
 * queue: Buffer の予約済み [{ id, text, dueAt }]、compose(rec): 今の作り方の文面 { text, shortText, style, link, long } か null、
 * legacy(rec): 指紋の記録がない以前の予約が「送ったときのまま」とみなせる文面の候補
 */
export function refreshPlan({ queue, posted, now, compose, legacy = () => [] }) {
  const byBuffer = new Map(posted.filter((p) => p.bufferId).map((p) => [p.bufferId, p]));
  const edits = [], skipped = [], manual = [];
  for (const q of queue) {
    const rec = byBuffer.get(q.id);
    if (!rec) { manual.push(q); continue; } // Buffer で手で入れた予約は、変えない(表示だけ)
    if (!(Date.parse(q.dueAt ?? rec.dueAt) > now + REFRESH_MARGIN_MIN * 60e3)) { skipped.push({ q, rec, why: "まもなく出る" }); continue; }
    const next = compose(rec);
    if (!next) { skipped.push({ q, rec, why: "今のデータから作り直せない(開催の取り下げなど)" }); continue; }
    if (q.text === next.text) continue;
    const untouched = rec.hash ? textHash(q.text) === rec.hash : legacy(rec).includes(q.text);
    if (!untouched) { skipped.push({ q, rec, why: "Buffer で手で直されている" }); continue; }
    edits.push({ q, rec, next });
  }
  return { edits, skipped, manual };
}

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
  if (social.xPremiumUntil) console.log(`X Premium の長い投稿: ${social.xPremiumUntil} の前日に出る投稿まで(それ以降は280字)`);
  const plan = planDays({ days, events, info, posted, todayJst: today, baseUrl: cfg.baseUrl, social, now, weights, hooks });
  const save = () => writeFileSync(postedFile, JSON.stringify(posted, null, 2) + "\n");
  const label = (p) => `[${p.type}${p.style === "hook" ? "・書き出しあり" : ""}${p.long ? (p.format === "medium" ? "・中くらい" : "・長い投稿") : ""}${p.link === "tail" ? "・URLは最後" : p.link ? "" : "・URLなし"}]`;

  // Buffer が X の Premium を認識していなければ、長い投稿は断られるので、最初から280字の文面にする
  let target = null, shortOnly = false;
  if (key && social.xPremiumUntil) {
    try {
      target = await findXChannel(key, social.bufferChannelId || "");
      const type = (await gql(key, channelSubscriptionQuery(target.channelId))).channel?.metadata?.subscriptionType ?? "";
      shortOnly = notPremium(type);
      console.log(`Buffer が認識している X のサブスク: ${type || "(なし)"}${shortOnly ? " → 長い投稿は断られるため、280字で送ります。Buffer で X のチャンネルを接続し直すと、Premium が認識される見込みです(認識されたら、予約済みの分も次の起動で長い投稿に書き換えます)" : ""}`);
    } catch (err) { console.error(`X のサブスクの種類を読めませんでした(長い投稿を試します): ${err.message}`); }
  }
  if (shortOnly) for (const p of plan) Object.assign(p, { text: p.shortText ?? p.text, long: false, format: "short", link: p.link === "tail" ? false : p.link });

  // 予約済みの見直し(Buffer を読めるときだけ。試運転では、変える予定を表示するだけ)
  if (key) {
    try {
      target ??= await findXChannel(key, social.bufferChannelId || "");
      const queue = [];
      let after = "";
      for (let i = 0; i < 4; i++) {
        const { posts: page } = await gql(key, scheduledPostsQuery({ ...target, after }));
        queue.push(...(page?.edges ?? []).map((e) => e.node));
        if (!page?.pageInfo?.hasNextPage) break;
        after = page.pageInfo.endCursor;
      }
      const ctx = { events, info, baseUrl: cfg.baseUrl };
      const compose = (rec) => composeById({ ...ctx, id: rec.id, date: rec.date ?? today, dueAt: rec.dueAt, social: shortOnly ? { ...social, xPremiumUntil: "" } : social, hooks });
      // 指紋の記録がない以前の予約: 280字の作り方で、今の書き出しあり・なしのどちらかと同じなら、送ったときのまま
      const legacy = (rec) => [hooks, {}].map((h) => composeById({ ...ctx, id: rec.id, date: rec.date ?? today, dueAt: rec.dueAt, social: {}, hooks: h })?.text).filter(Boolean);
      const { edits, skipped, manual } = refreshPlan({ queue, posted, now: Date.now(), compose, legacy });
      console.log(`予約済みの見直し: Buffer の予約 ${queue.length} 件 → 書き換え ${edits.length} 件・そのまま ${queue.length - edits.length} 件`);
      for (const { q, rec, why } of skipped) console.log(`  そのまま: ${jstLabel(q.dueAt ?? rec.dueAt)} ${rec.id}(${why})`);
      for (const q of manual) console.log(`--- 手で入れた予約(変えません) ${jstLabel(q.dueAt)} ---\n${q.text}\n`);
      for (const { q, rec, next } of edits) {
        console.log(`--- 書き換え ${jstLabel(q.dueAt ?? rec.dueAt)} ${label(next)} ${rec.id} ---\n${next.text}\n`);
        if (!live) continue;
        let sent = next.text, r = (await gql(key, editPostQuery({ id: q.id, text: sent }))).editPost ?? {};
        if (!r.post?.id && isLengthError(r.message) && next.shortText !== next.text) {
          console.log(`長い投稿を受け付けなかったため、280字の文面にします: ${r.message}`);
          sent = next.shortText;
          r = (await gql(key, editPostQuery({ id: q.id, text: sent }))).editPost ?? {};
        }
        if (!r.post?.id) { console.error(`書き換えられませんでした(予約はそのまま): ${rec.id} ${r.message ?? ""}`); continue; }
        Object.assign(rec, { style: next.style, link: sent === next.text ? next.link : next.link === "tail" ? false : next.link, long: sent === next.text && next.long, format: sent === next.text ? next.format ?? "short" : "short", hash: textHash(sent) });
        save();
      }
    } catch (err) {
      // 見直しに失敗しても、新しい予約は続ける(予約済みは、元の文面のまま出る)
      console.error(`予約済みの見直しに失敗しました(新しい予約は続けます): ${err.message}`);
    }
  }

  if (!plan.length) { console.log(`${today}〜翌日: 予約する投稿はありません(枠はすべて予約済みか、過ぎています)`); return; }
  const channelId = live ? (target?.channelId || social.bufferChannelId || await findChannel(key)) : "";
  let failed = false;
  for (const p of plan) {
    console.log(`--- ${jstLabel(p.dueAt)} ${label(p)} ${p.id} ---\n${p.text}\n`);
    if (!live) continue;
    try {
      let sent = p.text;
      let r = (await gql(key, createPostQuery({ text: sent, channelId, dueAt: p.dueAt }))).createPost ?? {};
      if (!r.post?.id && isLengthError(r.message) && p.shortText && p.shortText !== p.text) {
        console.log(`長い投稿を受け付けなかったため、280字の文面で予約します: ${r.message}`);
        sent = p.shortText;
        r = (await gql(key, createPostQuery({ text: sent, channelId, dueAt: p.dueAt }))).createPost ?? {};
      }
      if (!r.post?.id && isScheduleLimit(r.message)) {
        // 夜の起動が翌朝まで遅れると、今日の残り+翌日で10件を超えることがある。入らなかった枠は記録せず、次の起動で入れる
        console.log(`Buffer の予約件数の上限に達したため、ここで止めます(残りは次の起動で入れます): ${r.message}`);
        break;
      }
      if (!r.post?.id) throw new Error(`Buffer に予約できませんでした: ${r.message ?? JSON.stringify(r).slice(0, 200)}`);
      const short = sent !== p.text;
      posted.push({ id: p.id, type: p.type, style: p.style, link: short && p.link === "tail" ? false : p.link, long: !short && !!p.long, format: short ? "short" : p.format ?? "short", dueAt: p.dueAt, bufferId: r.post.id, date: p.date, hash: textHash(sent) });
      save(); // 1件ごとに記録(途中で失敗しても、重複しない)
      console.log(`予約しました: ${r.post.id}`);
    } catch (err) { console.error(err.message); failed = true; break; }
  }
  if (failed) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().catch((err) => { console.error(err.message); process.exit(1); });
