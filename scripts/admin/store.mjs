import { isSocialEvent, socialEvidenceErrors, socialDuplicate, socialFacts } from '../lib/social-evidence.mjs';
import { deriveActuals } from "./overview.mjs";
import { loadPipeline, pipelineMonths } from "./pipeline.mjs";
const todayJst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
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
  mailIgnore: join(root, ".admin/mail-ignore.json"),
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
// 編集部あての直接のメールで、受信箱に出さない差出人(アドレスかドメイン)。運営者が画面で決める。このPCだけ
export const loadMailIgnore = (root) => { const v = readJson(paths(root).mailIgnore, []); return Array.isArray(v) ? v.filter((x) => typeof x === "string" && x) : []; };
export function saveMailIgnore(root, list) { const p = paths(root); if (!existsSync(p.dir)) mkdirSync(p.dir, { recursive: true }); writeJson(p.mailIgnore, [...new Set(list.map((x) => String(x).toLowerCase().trim()).filter(Boolean))].sort()); }
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

// ---------- 人の判断(画面の「やること」) ----------

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

/** 振り返りの Issue の本文から、チェックを付けた項目の key を拾う(「- [x] … <!-- key -->」の行) */
export function reviewChecks(body = "") {
  const keys = [];
  for (const line of String(body).split(/\r?\n/)) {
    const m = line.match(/^\s*[-*] \[[xX]\] .*?<!--\s*([\w-]+)\s*-->\s*$/);
    if (m) keys.push(m[1]);
  }
  return keys;
}
/** 振り返りの Issue の本文に書かれた、振り返りの日付(「<!-- weekly-review YYYY-MM-DD -->」) */
export const reviewIssueDate = (body = "") => String(body).match(/<!--\s*weekly-review\s+(\d{4}-\d{2}-\d{2})\s*-->/)?.[1] ?? null;

/**
 * 週次の振り返り(data/weekly-review.json)のうち、人が行う項目と、Claude に頼む項目。保留の判断は、開催の欄で別に見せる。
 * issues: GitHub の、開いている振り返りの Issue([{ date, url, checked }])。同じ日付の Issue でチェックを付けた項目は、済みとして外す
 * (振り返りのデータは週に1回しか作られないので、チェックはここで反映する)
 */
export function loadReview(root, issues = null) {
  const r = readJson(paths(root).review, null);
  if (!r) return null;
  const issue = Array.isArray(issues) ? issues.find((x) => x?.date && x.date === r.updated) ?? null : null;
  const checked = new Set(issue?.checked ?? []);
  const human = (r.actions ?? []).filter((a) => a.owner === "人" && a.key !== "held");
  const claude = (r.actions ?? []).filter((a) => a.owner === "Claude").map(({ key, text, weeks }) => ({ key, text, weeks: weeks ?? 1 }));
  // claude: Claude に頼むと進む項目(「やること」の「Claude に頼む」のいちばん上に、頼む文つきで出す。頼まれるまで進まないので、見えるところに置く)
  return { updated: r.updated ?? null, actions: human.filter((a) => !checked.has(a.key)), claude: claude.filter((a) => !checked.has(a.key)),
    done: { actions: human.filter((a) => checked.has(a.key)).map(({ key, text }) => ({ key, text })), claude: claude.filter((a) => checked.has(a.key)) },
    issueUrl: issue?.url ?? null, issueRead: Array.isArray(issues) };
}

// 検索の改善案(analytics/state.json。このPCだけ・git に入らない)。運営者が決められるのは「見送る」と「見送りを戻す」だけ
// (実施・効果の判定は、週次の分析タスクが行う)
export const PROPOSAL_STATUS = { proposed: "提案中", implemented: "実施済み", evaluated: "効果を判定済み", declined: "見送り" };
export function loadProposals(root) {
  const s = readJson(paths(root).analytics, null);
  // kind: "measure" は計測の改善案(ID は MEAS-…)。why は、その計測で何が分かるようになるか。owner は、誰が作業するか(Claude / 運営者)
  return (s?.proposals ?? []).map(({ id, date, target, change, status, implementedAt, result, declinedAt, declineNote, kind, why, owner }) => ({ id, date, target, change, status, implementedAt, result, declinedAt, declineNote,
    kind: kind === "measure" || /^MEAS-/.test(id ?? "") ? "measure" : "search", ...(why ? { why } : {}), ...(owner ? { owner } : {}) }));
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

// Claude に頼めること(助言)。週次の分析が analytics/state.json の advice に書く(ID は ADV-日付-番号)。
// 営業の候補・文案、掲載の穴、KPI の見直し、記事の題材など、運営者が「頼む」だけで Claude が進められるもの。
// 運営者は画面で「済みにする」「見送る」(と、その取り消し)を選ぶ。中身は分析が書き、画面からは変えない
export const ADVICE_KINDS = { sales: "営業", listing: "掲載", revenue: "収益", kpi: "目標・KPI", content: "記事・SNS", ops: "運営", other: "その他" };
export const ADVICE_STATUS = { proposed: "提案中", done: "済み", declined: "見送り" };
export function loadAdvice(root) {
  const s = readJson(paths(root).analytics, null);
  return (s?.advice ?? []).filter((x) => x && x.id && x.title).map(({ id, date, kind, title, detail, why, ask, status, doneAt, declinedAt, declineNote }) =>
    ({ id, date, kind: kind in ADVICE_KINDS ? kind : "other", title, detail, why, ask, status: status in ADVICE_STATUS ? status : "proposed", doneAt, declinedAt, declineNote }));
}
export function setAdviceStatus(root, id, status, today, note = "") {
  if (!(status in ADVICE_STATUS)) return { code: 400, error: "その状態にはできません" };
  const p = paths(root);
  const s = readJson(p.analytics, null);
  const x = s?.advice?.find((y) => y.id === id);
  if (!x) return { code: 404, error: "助言が見つかりません" };
  x.status = status;
  delete x.doneAt; delete x.declinedAt; delete x.declineNote;
  if (status === "done") x.doneAt = today;
  if (status === "declined") { x.declinedAt = today; if (note) x.declineNote = String(note).slice(0, 300); }
  writeJson(p.analytics, s);
  return { advice: x };
}

// 最終目標・KPI・収益化の案(analytics/plan.json。このPCだけ・git に入らない)。運営者が採用・見送り・目標の変更・実績の入力をする
// 実績は、週次の分析タスクが analytics/state.json の kpi に書く(自動の分)。手入力の分は plan.json の manual
export const PLAN_STATUS = { proposed: "検討中", adopted: "採用", declined: "見送り", done: "実施済み" };
export const MANUAL_FIELDS = { rakuten: "楽天の報酬(円)", adsense: "AdSense の収益(円)", direct: "協賛・有料プランの収入(円)", contracts: "有償の契約数(件)", pitches: "提案した相手の数(件)" };
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
export function loadPlan(root, today = todayJst()) {
  const p = readJson(paths(root).plan, null);
  if (!p) return null;
  const s = readJson(paths(root).analytics, null);
  // 実績: 週次の分析の kpi に、日ごとの記録(analytics/series.json)から出せる分を足す(分析の値を優先)
  const series = readJson(join(root, "analytics", "series.json"), null);
  let actuals = deriveActuals(s, series);
  // 提案した数・契約数は、営業の台帳(analytics/pipeline.json)から月ごとに数える(手入力があれば、画面と概要は手入力を優先)
  const pm = pipelineMonths(loadPipeline(root).leads, today);
  if (Object.keys(pm).length) {
    actuals = actuals ?? { updated: null, months: {} };
    for (const [m, v] of Object.entries(pm)) actuals.months[m] = { ...(actuals.months[m] ?? {}), pitches: v.pitches, contracts: v.contracts };
  }
  // 目標の数の見直しの案(元の目標の控え before は、画面に渡さない)
  const targetPlans = (p.targetPlans ?? []).filter((x) => x?.id && x.title && Array.isArray(x.options) && x.options.length)
    .map(({ before, ...x }) => ({ ...x, status: ["proposed", "adopted", "declined"].includes(x.status) ? x.status : "proposed" }));
  return { goal: p.goal ?? null, kpis: p.kpis ?? [], monetization: p.monetization ?? [], targetPlans, manual: p.manual ?? {}, actuals, updated: p.updated ?? null };
}
// 月(YYYY-MM)ごとの 0 以上の数か。正しければ写しを、誤り・空なら null を返す
function cleanTargets(targets) {
  if (!targets || typeof targets !== "object" || Array.isArray(targets)) return null;
  const clean = {};
  for (const [m, v] of Object.entries(targets)) {
    if (!MONTH.test(m) || typeof v !== "number" || !Number.isFinite(v) || v < 0) return null;
    clean[m] = v;
  }
  return Object.keys(clean).length ? clean : null;
}
/**
 * 目標の数の見直しの案(plan.json の targetPlans)。いくつかの KPI の目標を、まとめて差し替える案を、2〜3通り並べたもの。
 *   { id: "ADV-…", title, detail, basis: [前提の文], status: "proposed"|"adopted"|"declined", recommended: "B",
 *     options: [{ key: "B", title, summary, targets: { contracts: { "2026-12": 3, … }, pitches: {…} }, why?: { contracts: "…" }, rows?: [[見出し, { 月: 値 }, 単位]] }] }
 * 運営者が1つを選ぶと(adopted)、その案の targets(と why)を KPI に入れ、元の目標は before に残す。
 * 「検討中」に戻すと、before から元の目標に戻す。見送り(declined)は KPI を変えない。
 */
export function decideTargetPlan(root, { id, status, option, note = "" }, today) {
  const p = paths(root);
  const plan = readJson(p.plan, null);
  if (!plan) return { code: 404, error: "analytics/plan.json がありません" };
  const x = plan.targetPlans?.find((y) => y.id === id);
  if (!x) return { code: 404, error: "見直しの案が見つかりません" };
  if (!["proposed", "adopted", "declined"].includes(status)) return { code: 400, error: "その状態にはできません" };
  const kpi = (kid) => plan.kpis?.find((k) => k.id === kid);
  if (status === "proposed") {
    for (const [kid, b] of Object.entries(x.before ?? {})) {
      const k = kpi(kid);
      if (!k) continue;
      k.targets = b.targets; k.targetsChangedAt = today;
      if (b.why !== undefined) k.why = b.why;
    }
    x.status = "proposed";
    delete x.before; delete x.chosen; delete x.decidedAt; delete x.note;
  } else {
    if ((x.status ?? "proposed") !== "proposed") return { code: 400, error: "先に「検討中」に戻してください" };
    if (status === "adopted") {
      const opt = x.options?.find((o) => o.key === option);
      if (!opt) return { code: 400, error: "選ぶ案が正しくありません" };
      const entries = Object.entries(opt.targets ?? {});
      if (!entries.length) return { code: 400, error: "この案には目標の数がありません" };
      const next = {};
      for (const [kid, t] of entries) {
        if (!kpi(kid)) return { code: 400, error: `目標の数字(${kid})が見つかりません` };
        next[kid] = cleanTargets(t);
        if (!next[kid]) return { code: 400, error: `案の目標(${kid})の形が正しくありません` };
      }
      x.before = {};
      for (const [kid, t] of Object.entries(next)) {
        const k = kpi(kid);
        x.before[kid] = { targets: k.targets, ...(opt.why?.[kid] ? { why: k.why ?? "" } : {}) };
        k.targets = t; k.targetsChangedAt = today;
        if (opt.why?.[kid]) k.why = String(opt.why[kid]).slice(0, 200);
      }
      x.chosen = option;
    }
    x.status = status; x.decidedAt = today;
    if (note) x.note = String(note).slice(0, 300); else delete x.note;
  }
  plan.updated = today;
  writeJson(p.plan, plan);
  return { item: x };
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
/**
 * 週次の分析が見つけた新しい収益化の案を、「検討中」で plan.json に足す(scripts/admin/propose-mon.mjs から呼ぶ)。
 * 採用・見送りは運営者が決めるので、ここでは足すだけ。既存の案は変えない。
 * 同じ題名の案(見送った案も含む)があれば足さない。1回に足せるのは2件まで。
 */
const MON_TEXT = { title: 40, summary: 300, why: 200, effort: 40, risk: 100, firstStep: 200, ask: 200, evidence: 300 };
export function addMonetizationProposals(root, items, today = todayJst()) {
  const p = paths(root);
  const plan = readJson(p.plan, null);
  if (!plan) return { code: 404, error: "analytics/plan.json がありません" };
  if (!Array.isArray(items) || !items.length) return { code: 400, error: "案がありません" };
  if (items.length > 2) return { code: 400, error: "1回に足せるのは2件までです" };
  plan.monetization ??= [];
  const norm = (s) => String(s ?? "").replace(/\s+/g, "");
  const added = [], skipped = [];
  for (const it of items) {
    const x = {};
    for (const [k, n] of Object.entries(MON_TEXT)) {
      const v = typeof it?.[k] === "string" ? it[k].trim() : "";
      if (v.length > n) return { code: 400, error: `${k} は${n}字以内にしてください` };
      if (v) x[k] = v;
    }
    for (const k of ["title", "summary", "why", "firstStep"]) if (!x[k]) return { code: 400, error: `${k} がありません` };
    const y = it.expectedYen;
    if (!Array.isArray(y) || y.length !== 2 || !y.every((v) => Number.isInteger(v) && v >= 0) || y[0] > y[1]) return { code: 400, error: "expectedYen は [下限, 上限] の 0 以上の整数(円/月)にしてください" };
    if (plan.monetization.some((m) => norm(m.title) === norm(x.title))) { skipped.push(x.title); continue; }
    const id = `MON-${plan.monetization.reduce((n, m) => Math.max(n, +(m.id?.match(/^MON-(\d+)$/)?.[1] ?? 0)), 0) + 1}`;
    const item = { id, ...x, expectedYen: y, status: "proposed", proposedAt: today, source: "weekly-analytics" };
    if (!item.ask) item.ask = `${id} を進めて`;
    plan.monetization.push(item);
    added.push(item);
  }
  if (added.length) { plan.updated = today; writeJson(p.plan, plan); }
  return { added, skipped };
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
