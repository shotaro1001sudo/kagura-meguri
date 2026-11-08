import { isSocialEvent, socialEvidenceErrors, socialDuplicate, socialFacts } from '../lib/social-evidence.mjs';
import { deriveActuals } from "./overview.mjs";
import { sameEvent } from '../lib/collect-core.mjs';
// 管理者用ページのデータ: 開催(data/events.json)と、Gmail から読み込んだ申請・問い合わせ(.admin/inbox.json)
// .admin/ と admin.local.json は、投稿者の名前・メールアドレスやパスワードを含むため、Git には入れない(.gitignore)。
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { PREFECTURES } from "../lib/util.mjs";

const readJson = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, "")) : d);
// 書き込み途中で止まっても、元のファイルが壊れないように、別名で書いてから置き換える
const writeJson = (p, v) => { writeFileSync(p + ".tmp", JSON.stringify(v, null, 2)); renameSync(p + ".tmp", p); };

export const paths = (root) => ({
  events: join(root, "data/events.json"),
  dir: join(root, ".admin"),
  inbox: join(root, ".admin/inbox.json"),
  local: join(root, "admin.local.json"),
  config: join(root, "config.json"),
  rejected: join(root, "data/rejected.json"),
  review: join(root, "data/weekly-review.json"),
  analytics: join(root, "analytics/state.json"),
  plan: join(root, "analytics/plan.json"),
});

export const loadEvents = (root) => readJson(paths(root).events, []);
export const saveEvents = (root, events) => writeJson(paths(root).events, events);
export const loadConfig = (root) => readJson(paths(root).config, {});
export const loadLocal = (root) => readJson(paths(root).local, {});
export function loadInbox(root) { const b = readJson(paths(root).inbox, {}); return { items: b.items ?? [], lastFetch: b.lastFetch ?? null }; }
export function saveInbox(root, box) { const p = paths(root); if (!existsSync(p.dir)) mkdirSync(p.dir, { recursive: true }); writeJson(p.inbox, box); }

// 申請・問い合わせの状態。「完了・掲載済み・却下」は、対応が終わった状態(closedAt を付ける)
export const INBOX_STATUS = { new: "未対応", doing: "対応中", done: "完了", published: "掲載済み", rejected: "却下" };
const CLOSED = new Set(["done", "published", "rejected"]);
export function setInboxStatus(item, status, today) {
  if (!INBOX_STATUS[status]) throw new Error(`不明な状態: ${status}`);
  item.status = status;
  if (CLOSED.has(status)) item.closedAt ??= today; else delete item.closedAt;
}

// プライバシーポリシーの保存期間(対応完了から12か月を目安)を過ぎた記録を消す
export function pruneInbox(box, today) {
  const limit = new Date(`${today}T00:00:00Z`); limit.setUTCFullYear(limit.getUTCFullYear() - 1);
  const cut = limit.toISOString().slice(0, 10);
  const before = box.items.length;
  box.items = box.items.filter((x) => !(x.closedAt && x.closedAt < cut));
  return before - box.items.length;
}

const DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
export const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LIMITS = { name: 80, kagura: 40, city: 40, venue: 80, address: 100, fee: 80, url: 300, description: 300, source: 80 };

/** 開催データの確認。問題のある項目名と理由を返す(空なら OK) */
export function validateEvent(e, events, originalId = null) {
  const errs = {};
  if (!ID.test(e.id ?? "")) errs.id = "英小文字・数字と、ハイフン(-)だけで入力してください";
  else if (e.id !== originalId && events.some((x) => x.id === e.id)) errs.id = "同じIDの開催が、すでにあります";
  for (const k of ["name", "kagura", "city", "venue", "source"]) if (!String(e[k] ?? "").trim()) errs[k] = "入力してください";
  if (!PREFECTURES.includes(e.prefecture)) errs.prefecture = "都道府県を選んでください";
  if (!DT.test(e.start ?? "")) errs.start = "開催日を入力してください";
  if (e.end && !DT.test(e.end)) errs.end = "終了の日時の形式が正しくありません";
  else if (e.end && e.end < e.start) errs.end = "終了は、開始より後にしてください";
  if (e.url && !/^https:\/\/[^\s]+$/.test(e.url)) errs.url = "https:// で始まるURLを入力してください";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.checked ?? "")) errs.checked = "確認日を入力してください";
  for (const [k, n] of Object.entries(LIMITS)) if (String(e[k] ?? "").length > n) errs[k] = `${n}字以内にしてください`;
  return errs;
}

// 画面から受け取った項目だけを取り込む(それ以外の項目は、元のデータのまま残す)
const FIELDS = ["id", "name", "kagura", "prefecture", "city", "venue", "address", "start", "end", "timeUnknown", "fee", "url", "description", "source", "checked"];
const PLACE = ["prefecture", "city", "venue", "address"];
export function cleanEvent(input) {
  const e = {};
  for (const k of FIELDS) {
    const v = input[k];
    if (k === "timeUnknown") { if (v === true) e.timeUnknown = true; continue; }
    const s = typeof v === "string" ? v.trim() : "";
    if (s || k === "fee") e[k] = s;
  }
  if (e.timeUnknown && e.start) e.start = `${e.start.slice(0, 10)}T00:00`;
  return e;
}

/**
 * 開催を追加・更新する。originalId が null なら追加。
 * 場所が変わったら、緯度経度を消す(保存後の位置の取得で、付け直す)。
 */
export function upsertEvent(events, input, originalId, status) {
  const e = cleanEvent(input);
  const errs = validateEvent(e, events, originalId);
  if (Object.keys(errs).length) return { errs };
  const i = originalId ? events.findIndex((x) => x.id === originalId) : -1;
  if (originalId && i < 0) return { errs: { id: "元の開催が見つかりません(ほかで消された可能性があります)" } };
  const prev = i >= 0 ? events[i] : {};
  const next = { ...prev };
  for (const k of FIELDS) { if (k in e) next[k] = e[k]; else delete next[k]; }
  next.status = status ?? prev.status ?? "published";
  if (isSocialEvent(next)) {
    if (input.socialVerified === true) next.socialEvidence = {
      postUrl: next.url, organizer: String(input.socialOrganizer ?? '').trim(),
      authorityUrl: String(input.socialAuthorityUrl ?? '').trim(), authorityNote: String(input.socialAuthorityNote ?? '').trim(),
      checked: next.checked, publicAccess: true, facts: socialFacts(next)
    };
    if (next.status === 'published') {
      const reasons = socialEvidenceErrors(next);
      if (events.some(x => x.id !== originalId && x.status !== 'withdrawn' && (sameEvent(next, x) || socialDuplicate(next, x)))) reasons.push('SNS: 同一公演の候補があります。既存公演を編集してください');
      if (reasons.length) return { errs: { url: reasons.join(' / ') } };
    }
  }
  if (PLACE.some((k) => (prev[k] ?? "") !== (next[k] ?? ""))) { delete next.lat; delete next.lng; delete next.geoPrecision; }
  // 項目の並びを、既存のデータにそろえる(差分を読みやすくする)
  const order = [...FIELDS.filter((k) => k !== "timeUnknown").slice(0, 9), "timeUnknown", "fee", "url", "description", "source", "checked", "status"];
  const sorted = Object.fromEntries([...order.filter((k) => k in next).map((k) => [k, next[k]]), ...Object.entries(next).filter(([k]) => !order.includes(k))]);
  if (i >= 0) events[i] = sorted; else events.push(sorted);
  return { event: sorted };
}

// ---------- 人の判断(判断待ちのタブ) ----------

/**
 * 保留中の開催を却下する(scripts/review.mjs reject と同じ扱い)。
 * 開催データから外し、data/rejected.json に記録する(週次の自動収集が、同じものを取り直さない)。
 * 掲載中のものは却下しない(サイトから外すときは「取り下げ」を使う)。
 */
export function rejectPending(root, id) {
  const events = loadEvents(root);
  const e = events.find((x) => x.id === id);
  if (!e) return { code: 404, error: "開催が見つかりません" };
  if (e.status !== "pending") return { code: 400, error: "却下できるのは、保留中の開催だけです(掲載中のものは「取り下げ」を使ってください)" };
  const p = paths(root);
  const rejected = readJson(p.rejected, []);
  if (!rejected.some((x) => x.id === e.id)) rejected.push({ id: e.id, name: e.name, start: e.start });
  writeJson(p.rejected, rejected);
  saveEvents(root, events.filter((x) => x.id !== id));
  return { event: e };
}

/** 週次の振り返り(data/weekly-review.json)のうち、人が行う項目。保留の判断は、開催の欄で別に見せる */
export function loadReview(root) {
  const r = readJson(paths(root).review, null);
  if (!r) return null;
  return { updated: r.updated ?? null, actions: (r.actions ?? []).filter((a) => a.owner === "人" && a.key !== "held") };
}

// 検索の改善案(analytics/state.json。このPCだけ・git に入らない)。運営者が決められるのは「見送る」と「見送りを戻す」だけ
// (実施・効果の判定は、週次の分析タスクが行う)
export const PROPOSAL_STATUS = { proposed: "提案中", implemented: "実施済み", evaluated: "効果を判定済み", declined: "見送り" };
export function loadProposals(root) {
  const s = readJson(paths(root).analytics, null);
  return (s?.proposals ?? []).map(({ id, date, target, change, status, implementedAt, result, declinedAt, declineNote }) => ({ id, date, target, change, status, implementedAt, result, declinedAt, declineNote }));
}
export function setProposalStatus(root, id, status, today, note = "") {
  if (!["declined", "proposed"].includes(status)) return { code: 400, error: "変えられるのは「見送る」と「見送りを戻す」だけです" };
  const p = paths(root);
  const s = readJson(p.analytics, null);
  const x = s?.proposals?.find((y) => y.id === id);
  if (!x) return { code: 404, error: "改善案が見つかりません" };
  if (!["proposed", "declined"].includes(x.status)) return { code: 400, error: "実施済みの改善案は、見送りにできません" };
  x.status = status;
  if (status === "declined") { x.declinedAt = today; if (note) x.declineNote = String(note).slice(0, 300); else delete x.declineNote; }
  else { delete x.declinedAt; delete x.declineNote; }
  writeJson(p.analytics, s);
  return { proposal: x };
}

// 最終目標・KPI・収益化の案(analytics/plan.json。このPCだけ・git に入らない)。運営者が採用・見送り・目標の変更・実績の入力をする
// 実績は、週次の分析タスクが analytics/state.json の kpi に書く(自動の分)。手入力の分は plan.json の manual
export const PLAN_STATUS = { proposed: "提案中", adopted: "採用", declined: "見送り", done: "実施済み" };
export const MANUAL_FIELDS = { rakuten: "楽天の報酬(円)", adsense: "AdSense の収益(円)", direct: "協賛・有料プランの収入(円)", contracts: "有償の契約数(件)", pitches: "提案した相手の数(件)" };
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
export function loadPlan(root) {
  const p = readJson(paths(root).plan, null);
  if (!p) return null;
  const s = readJson(paths(root).analytics, null);
  // 実績: 週次の分析の kpi に、日ごとの記録(analytics/series.json)から出せる分を足す(分析の値を優先)
  const series = readJson(join(root, "analytics", "series.json"), null);
  return { goal: p.goal ?? null, kpis: p.kpis ?? [], monetization: p.monetization ?? [], manual: p.manual ?? {}, actuals: deriveActuals(s, series), updated: p.updated ?? null };
}
export function setPlanItem(root, { kind, id, status, note = "", targets }, today) {
  const p = paths(root);
  const plan = readJson(p.plan, null);
  if (!plan) return { code: 404, error: "analytics/plan.json がありません" };
  const list = kind === "kpi" ? plan.kpis : kind === "mon" ? plan.monetization : null;
  if (!list) return { code: 400, error: "種類が正しくありません" };
  const x = list.find((y) => y.id === id);
  if (!x) return { code: 404, error: "項目が見つかりません" };
  if (targets !== undefined) {
    if (kind !== "kpi" || !targets || typeof targets !== "object" || Array.isArray(targets)) return { code: 400, error: "目標の形が正しくありません" };
    const clean = {};
    for (const [m, v] of Object.entries(targets)) {
      if (!MONTH.test(m) || typeof v !== "number" || !Number.isFinite(v) || v < 0) return { code: 400, error: "目標は、月(YYYY-MM)ごとの 0 以上の数で入れてください" };
      clean[m] = v;
    }
    if (!Object.keys(clean).length) return { code: 400, error: "目標が空です" };
    x.targets = clean; x.targetsChangedAt = today;
  }
  if (status !== undefined) {
    const allowed = kind === "kpi" ? ["proposed", "adopted", "declined"] : ["proposed", "adopted", "declined", "done"];
    if (!allowed.includes(status)) return { code: 400, error: "その状態にはできません" };
    if (status === "done" && x.status !== "adopted") return { code: 400, error: "実施済みにできるのは、採用した案だけです" };
    x.status = status;
    if (status === "proposed") { delete x.decidedAt; delete x.note; }
    else { x.decidedAt = today; if (note) x.note = String(note).slice(0, 300); else if (status !== "done") delete x.note; }
  }
  plan.updated = today;
  writeJson(p.plan, plan);
  return { item: x };
}
export function setManual(root, month, values, today) {
  const p = paths(root);
  const plan = readJson(p.plan, null);
  if (!plan) return { code: 404, error: "analytics/plan.json がありません" };
  if (!MONTH.test(month || "")) return { code: 400, error: "月が正しくありません" };
  const row = { ...(plan.manual?.[month] ?? {}) };
  for (const [k, v] of Object.entries(values || {})) {
    if (!(k in MANUAL_FIELDS)) return { code: 400, error: "入れられない項目があります" };
    if (v === null || v === "") { row[k] = null; continue; }
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return { code: 400, error: `${MANUAL_FIELDS[k]}は、0 以上の数で入れてください(空欄は未入力)` };
    row[k] = v;
  }
  plan.manual = { ...(plan.manual ?? {}), [month]: { ...row, updatedAt: today } };
  plan.updated = today;
  writeJson(p.plan, plan);
  return { manual: plan.manual[month] };
}

/** 申請の内容から、ID の候補を作る(日付+連番。画面で書き換えられる) */
export function suggestId(draft, events) {
  const base = `ev-${(draft.start || "").slice(0, 10).replace(/-/g, "") || "new"}`;
  let id = base, n = 2;
  while (events.some((x) => x.id === id)) id = `${base}-${n++}`;
  return id;
}
