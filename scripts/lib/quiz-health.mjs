// 好み診断の定期点検(週次の振り返りが使う)。外部へは送らない。
// 診断の推薦は data/kagura-info.json の本文を根拠にしているので、本文の書き換え・解説の追加・掲載の変化に合わせて見直す。
// 見直したら node scripts/quiz-review.mjs --accept で、今の根拠の本文を「確認済み」として data/quiz-review.json に残す。
import { createHash } from "node:crypto";
import { traditions, evidenceText, QUIZ_CHECKED, QUIZ_EXCLUDED } from "./quiz.mjs";

export const QUIZ_STALE_DAYS = 120;  // 診断の全体の見直し(質問・対象・完了率)の目安の間隔
export const UNCOVERED_MIN = 3;      // 解説がないために診断に入れない神楽を知らせる、掲載件数の下限

const hash = (s) => createHash("sha256").update(String(s)).digest("hex").slice(0, 12);
const dayNum = (ymd) => Math.floor(Date.parse(`${ymd}T00:00:00Z`) / 86400e3);

/** いまの根拠の本文の指紋({"石見神楽/tagline": "…"})。確認済みの記録と比べ、書き換わった根拠を見つける */
export function evidenceHashes(info) {
  const out = {};
  for (const t of traditions) for (const [, path] of t.evidence) out[`${t.kind}/${path}`] = hash(evidenceText(info[t.kind] ?? {}, path));
  return out;
}

/**
 * @param info      data/kagura-info.json
 * @param events    data/events.json(掲載中 published だけを数える)
 * @param regular   data/regular.json
 * @param baseline  data/quiz-review.json({ reviewed, evidence })。なければ、変更は数えない
 */
export function quizHealth({ info = {}, events = [], regular = [], todayJst, baseline = null, checked = QUIZ_CHECKED }) {
  const inQuiz = new Set(traditions.map((t) => t.kind));
  const missing = [];
  for (const t of traditions) for (const [, path] of t.evidence) if (!evidenceText(info[t.kind] ?? {}, path)) missing.push(`${t.kind}/${path}`);
  const now = evidenceHashes(info);
  const changed = baseline?.evidence ? Object.keys(now).filter((k) => baseline.evidence[k] !== now[k] && !missing.includes(k)) : [];
  // 解説(出典・一言紹介・特徴2つ以上)があるのに、診断の対象でも対象外の理由つきでもない神楽
  const newKinds = Object.entries(info).filter(([k, v]) => v?.source && v.tagline && (v.features?.length ?? 0) >= 2 && !inQuiz.has(k) && !(k in QUIZ_EXCLUDED)).map(([k]) => k);
  const live = events.filter((e) => e.status === "published" && (e.end || e.start).slice(0, 10) >= todayJst);
  const count = {};
  for (const e of live) if (e.kagura) count[e.kagura] = (count[e.kagura] ?? 0) + 1;
  // 掲載が多いのに解説がなく、診断に入れられない神楽(解説を書けば、診断と SNS の読み物に使える)
  const uncovered = Object.entries(count).filter(([k, n]) => n >= UNCOVERED_MIN && !info[k]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja")).map(([kind, n]) => ({ kind, n }));
  // 診断ですすめても、いま観に行ける掲載がない神楽(参考。結果の画面では、条件で観られる別の神楽を案内する)
  const regKinds = new Set(regular.filter((r) => !r.until || r.until >= todayJst).map((r) => r.kagura));
  const noShows = traditions.map((t) => t.kind).filter((k) => !count[k] && !regKinds.has(k));
  return {
    kinds: traditions.length,
    checked,
    checkedDaysAgo: dayNum(todayJst) - dayNum(checked),
    reviewed: baseline?.reviewed ?? "",
    missing, changed, newKinds, uncovered, noShows,
  };
}

/** data/quiz-review.json に残す「確認済み」の記録 */
export const acceptBaseline = (info, todayJst) => ({ reviewed: todayJst, evidence: evidenceHashes(info) });
