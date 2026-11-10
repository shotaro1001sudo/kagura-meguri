// 週次の振り返り(PDCA の Check と Act): node scripts/weekly-review.mjs
//
// 読むもの: data/events.json, data/collect-summary.json, data/social-posted.json, data/social-performance.json, data/kagura-info.json, data/sources.json,
//           data/regular.json, data/quiz-review.json(好み診断の点検)
//           先週の振り返り Issue の本文(PREV_REVIEW_FILE。なければ持ち越しなし)
// 書くもの: data/weekly-review.json(最新の数字・やること・推移。Claude の定期タスクが次の計画に使う)
//           REVIEW_OUT(既定 data/weekly-review.md。Issue の本文。コミットしない)
// テスト用の切り替え: REVIEW_NOW(日本時間の日付 YYYY-MM-DD)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { reviewMetrics, decideActions, ageActions, carryOver, renderReview, nextState } from "./lib/weekly-review.mjs";
import { quizHealth } from "./lib/quiz-health.mjs";
import { MAX_PER_RUN } from "./lib/x-post.mjs";

const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, "")) : fallback);
const today = process.env.REVIEW_NOW || new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const stateFile = process.env.REVIEW_STATE ?? "data/weekly-review.json";

const cfg = readJson("config.json", {});
const src = readJson("data/sources.json", []);
const events = readJson("data/events.json", []), info = readJson("data/kagura-info.json", {});
const metrics = reviewMetrics({
  events,
  summary: readJson("data/collect-summary.json", {}),
  posted: readJson("data/social-posted.json", []),
  info,
  sources: Array.isArray(src) ? src : src.sources ?? [],
  todayJst: today,
  baseUrl: cfg.baseUrl,
  performance: readJson(process.env.PERFORMANCE_FILE ?? "data/social-performance.json", null),
  // 好み診断の点検(根拠の本文の変更・対象外の神楽・見直しの間隔)
  quiz: quizHealth({ info, events, regular: readJson("data/regular.json", []), todayJst: today, baseline: readJson("data/quiz-review.json", null) }),
  // このPCで動く仕組みの脈: 週次の分析が毎週公開する概数の日付と、note の公開 RSS の最後の投稿日(scripts/note-pulse.mjs)
  mediaStats: readJson(process.env.MEDIA_STATS_FILE ?? "data/media-stats.json", null),
  note: process.env.NOTE_PULSE_FILE ? readJson(process.env.NOTE_PULSE_FILE, null) : null,
  perDay: cfg.social?.perDay ?? null,
  eventsPerDay: Math.min(MAX_PER_RUN, (cfg.social?.eventSlots ?? [0, 3]).length),
});
const state = readJson(stateFile, null);
const prev = state?.history?.length ? state.metrics?.date !== today ? state.metrics : null : null;
// やることに、何週つづいているかを付ける(先週の記録と比べる)
const progress = ageActions(decideActions(metrics, prev), state, today);
const actions = progress.actions;
const prevBody = process.env.PREV_REVIEW_FILE && existsSync(process.env.PREV_REVIEW_FILE) ? readFileSync(process.env.PREV_REVIEW_FILE, "utf8") : "";
const carried = carryOver(prevBody);

writeFileSync(stateFile, JSON.stringify(nextState(state, metrics, actions, progress), null, 2));
writeFileSync(process.env.REVIEW_OUT ?? "data/weekly-review.md", renderReview(metrics, prev, actions, carried, progress));
console.log(`週次の振り返り ${today}: やること ${actions.length} 件(先週から解消 ${progress.resolved.length} 件)、持ち越し ${carried.length} 件`);
