// 好み診断の点検: node scripts/quiz-review.mjs          … いまの状態を表示する(書き込みなし)
//                  node scripts/quiz-review.mjs --accept … 根拠の本文を見直したあと、今の本文を「確認済み」にする(data/quiz-review.json)
// 週次の振り返り(scripts/weekly-review.mjs)も、同じ点検を使って「今週やること」を出す。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { quizHealth, acceptBaseline } from "./lib/quiz-health.mjs";

const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, "")) : fallback);
const today = process.env.REVIEW_NOW || new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const file = process.env.QUIZ_REVIEW_FILE ?? "data/quiz-review.json";
const info = readJson("data/kagura-info.json", {});

if (process.argv.includes("--accept")) {
  writeFileSync(file, JSON.stringify(acceptBaseline(info, today), null, 2) + "\n");
  console.log(`${file}: 根拠の本文を ${today} 時点で確認済みにしました`);
} else {
  const h = quizHealth({ info, events: readJson("data/events.json", []), regular: readJson("data/regular.json", []), todayJst: today, baseline: readJson(file, null) });
  console.log(`好み診断: 対象 ${h.kinds} 種類 / 全体の見直し ${h.checked}(${h.checkedDaysAgo} 日前)/ 根拠の確認 ${h.reviewed || "未"}`);
  const list = (label, xs) => console.log(`${label}: ${xs.length ? xs.join("、") : "なし"}`);
  list("根拠が見つからない", h.missing);
  list("根拠の本文が変わった", h.changed);
  list("解説があるのに対象外", h.newKinds);
  list("掲載が多いのに解説がない", h.uncovered.map((u) => `${u.kind}(${u.n}件)`));
  list("いま掲載中の公演がない", h.noShows);
}
