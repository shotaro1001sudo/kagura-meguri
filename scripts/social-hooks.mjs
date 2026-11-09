// X投稿の「書き出しの1行」を、過去の反応を見ながら書くための道具(週次の分析タスクが使う)
//
//   node scripts/social-hooks.mjs preview [日数=7]
//     … これから出る読み物(明日から)と、反応の上位・下位の投稿の文面、書き方・時間帯・テーマの相対値を JSON で出す
//   node scripts/social-hooks.mjs set '{"r:kind:高千穂神楽":"書き出しの1行", ...}'
//     … 書き出しを data/social-hooks.json に足す(1回に MAX_SET 件まで。使えない行・知らない ID は理由つきで外す)
//
// 書いた data/social-hooks.json は、管理者用ページの定期の更新が、自動で公開する(この道具は commit しない)。
// 予約は前の晩なので、書き出しは明日以降の投稿から効く。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { readingCandidates, planDays, validHook, addDaysJst, HOOK_MAX } from "./lib/x-post.mjs";
import { themeWeights } from "./lib/social-performance.mjs";

export const MAX_SET = 15;
const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, "")) : fallback);
const jstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

/** 書き出しを足す。返り値: { hooks(新しい全体), added: [id], skipped: [{id, why}] } */
export function mergeHooks(current, incoming, knownIds) {
  const hooks = { ...current };
  const added = [], skipped = [];
  for (const [id, raw] of Object.entries(incoming ?? {})) {
    if (added.length >= MAX_SET) { skipped.push({ id, why: `1回に${MAX_SET}件まで` }); continue; }
    if (!knownIds.has(id)) { skipped.push({ id, why: "読み物の ID ではありません" }); continue; }
    if (!validHook(raw)) { skipped.push({ id, why: `4〜${HOOK_MAX}字で、URL・#・@・改行を含めない` }); continue; }
    hooks[id] = raw.trim();
    added.push(id);
  }
  return { hooks, added, skipped };
}

function main() {
  const [cmd, arg] = process.argv.slice(2);
  const file = process.env.HOOKS_FILE ?? "data/social-hooks.json";
  const cfg = readJson("config.json", {});
  const info = readJson("data/kagura-info.json", {});
  const hooks = readJson(file, {});
  const today = process.env.POST_NOW || jstToday();
  const cands = readingCandidates(info, cfg.baseUrl, today, hooks);
  if (cmd === "set") {
    const r = mergeHooks(hooks, JSON.parse(arg ?? "{}"), new Set(cands.map((c) => c.id)));
    writeFileSync(file, JSON.stringify(r.hooks, null, 2) + "\n");
    console.log(JSON.stringify({ added: r.added, skipped: r.skipped }, null, 2));
    return;
  }
  if (cmd !== "preview") { console.error("使い方: node scripts/social-hooks.mjs preview [日数] | set '<JSON>'"); process.exit(2); }
  const days = Math.min(14, Math.max(1, Number(arg) || 7));
  const perf = readJson("data/social-performance.json", {});
  const posted = readJson("data/social-posted.json", []);
  const tomorrow = addDaysJst(today, 1);
  // 予約済みの枠は除いて、明日から days 日分を、いまの決め方で予想する(開催の増減で、少しずれることがある)
  const plan = planDays({ days, events: readJson("data/events.json", []), info, posted, todayJst: tomorrow, baseUrl: cfg.baseUrl, social: cfg.social ?? {}, now: Date.parse(`${tomorrow}T00:00:00+09:00`), weights: themeWeights(perf), hooks });
  const byId = new Map(cands.map((c) => [c.id, c]));
  const text = (id) => byId.get(id)?.text ?? posted.find((p) => p.id === id)?.id ?? id;
  console.log(JSON.stringify({
    performance: { status: perf.status, samples: perf.samples, styles: perf.styles ?? {}, slots: perf.slots ?? {}, themes: perf.themes ?? {} },
    top: (perf.top ?? []).map((id) => ({ id, text: text(id) })),
    bottom: (perf.bottom ?? []).map((id) => ({ id, text: text(id) })),
    upcoming: plan.filter((p) => p.type === "reading").map((p) => ({ id: p.id, date: p.date, hook: hooks[p.id] ?? "", body: byId.get(p.id)?.body ?? "", title: byId.get(p.id)?.title ?? "" })),
    hookCount: Object.keys(hooks).length,
  }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
