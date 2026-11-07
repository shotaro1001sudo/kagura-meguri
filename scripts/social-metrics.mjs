// SNSの反応を集めて、テーマ別の相対値にする: node scripts/social-metrics.mjs
//
// 週次の振り返り(weekly-review.yml)が、振り返りの前に動かす。
// 読むもの: Buffer API(送信済みの投稿と、その反応。BUFFER_API_KEY)、data/social-posted.json
// 書くもの: data/social-performance.json(テーマ別の相対値と件数だけ。表示回数などの実数は書かない。リポジトリは公開のため)
// 失敗しても止めない(振り返りは続ける)。状態は status に残す: ok / no_data / unavailable / no_key
// テスト用: METRICS_NOW(日本時間の日付)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { gql, gqlStr, findXChannel } from "./post-social.mjs";
import { summarizePerformance, LOOKBACK_DAYS } from "./lib/social-performance.mjs";

const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, "")) : fallback);
const today = process.env.METRICS_NOW || new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const out = process.env.PERFORMANCE_FILE ?? "data/social-performance.json";
const PAGE = 50, MAX_PAGES = 6; // 1回の実行で最大6回の読み取り(無料プランの上限に十分な余裕)

export const sentPostsQuery = ({ organizationId, channelId, after }) => `query {
  posts(first: ${PAGE}${after ? `, after: ${gqlStr(after)}` : ""}, input: {
    organizationId: ${gqlStr(organizationId)},
    filter: { status: [sent], channelIds: [${gqlStr(channelId)}] }
  }) {
    edges { node { id dueAt metrics { type value } metricsUpdatedAt } }
    pageInfo { endCursor hasNextPage }
  }
}`;

async function main() {
  const key = (process.env.BUFFER_API_KEY ?? "").trim();
  const posted = readJson("data/social-posted.json", []);
  const write = (o) => { writeFileSync(out, JSON.stringify(o, null, 2)); console.log(`SNSの反応: ${o.status}(評価に使った投稿 ${o.samples ?? 0} 件)`); };
  if (!key) return write({ updated: today, status: "no_key", samples: 0, themes: {} });
  try {
    const cfg = readJson("config.json", {});
    const { channelId, organizationId } = await findXChannel(key, cfg.social?.bufferChannelId ?? "");
    const since = Date.parse(`${today}T00:00:00+09:00`) - (LOOKBACK_DAYS + 1) * 86400e3;
    const posts = [];
    let after = "";
    for (let i = 0; i < MAX_PAGES; i++) {
      const { posts: page } = await gql(key, sentPostsQuery({ organizationId, channelId, after }));
      const nodes = (page?.edges ?? []).map((e) => e.node);
      posts.push(...nodes);
      // 並び順は文書にないので、全件が期間より古いページで打ち切る
      if (!page?.pageInfo?.hasNextPage || (nodes.length && nodes.every((n) => Date.parse(n.dueAt) < since))) break;
      after = page.pageInfo.endCursor;
    }
    write(summarizePerformance(posts, posted, today));
  } catch (err) {
    // 反応の読み取り権限(insightsRead)がない・API の変更など。前回の評価は使わない(古い評価で投稿を偏らせない)
    console.error(err.message);
    write({ updated: today, status: "unavailable", reason: String(err.message).slice(0, 200), samples: 0, themes: {} });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
