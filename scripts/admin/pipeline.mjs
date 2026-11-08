// 営業の台帳(analytics/pipeline.json。このPCだけ・git に入らない)
//   協賛・有料プラン・送客の提案先を、候補 → 送信済み → 返信あり → 商談中 → 契約 / 見送り の段階で記録する。
//   提案した数・契約数の KPI(plan.json の pitches・contracts)は、ここから月ごとに数える(手入力があれば、手入力を優先)。
//   週次の分析タスクも、このファイルを読んで「今週の提案のペース」と「連絡する日が来た相手」を報告する。
// 相手の名前・窓口・条件は、公開のリポジトリ・Issue に書かない。
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";

export const STAGES = { candidate: "候補", sent: "送信済み", replied: "返信あり", talking: "商談中", won: "契約", lost: "見送り" };
// 返事を待つ・やりとりの途中の段階(連絡する日を見張る)
export const ACTIVE = ["sent", "replied", "talking"];
export const KINDS = ["神楽団", "主催者・保存会", "観光協会・自治体", "宿", "会場・施設", "その他"];
export const OFFERS = { "MON-1": "有料プラン(団体ページ)", "MON-2": "協賛・記事広告", "MON-3": "送客(観覧・体験)", other: "その他" };
// 送ってから返事がないとき、次に連絡する日の目安
export const FOLLOW_DAYS = 7;

const DAY = 864e5;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LIMITS = { name: 80, contact: 200, url: 300, email: 120, formUrl: 300, phone: 40, subject: 120, body: 4000, memo: 1000, note: 300 };
// 相手ごとの連絡先(メール・フォーム・電話)と、送る文案(件名・本文)も、ここに持つ。送るのは運営者(画面は Gmail の作成画面を開くだけ)
const TEXT_FIELDS = ["name", "kind", "offer", "contact", "url", "email", "formUrl", "phone", "subject", "body", "memo", "nextAt"];
const file = (root) => join(root, "analytics", "pipeline.json");
const addDays = (d, k) => new Date(Date.parse(d + "T00:00:00Z") + k * DAY).toISOString().slice(0, 10);
const mondayOf = (d) => addDays(d, -((new Date(d + "T00:00:00Z").getUTCDay() + 6) % 7));
const addMonth = (m, k) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + k, 1)).toISOString().slice(0, 7);
const daysInMonth = (m) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();

export function loadPipeline(root) {
  const p = file(root);
  if (!existsSync(p)) return { updated: null, leads: [] };
  const j = JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, ""));
  return { updated: j.updated ?? null, leads: Array.isArray(j.leads) ? j.leads : [] };
}
function savePipeline(root, pl) {
  const p = file(root);
  if (!existsSync(dirname(p))) mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p + ".tmp", JSON.stringify(pl, null, 2));
  renameSync(p + ".tmp", p);
}
const nextId = (leads) => `L-${String(leads.reduce((n, x) => Math.max(n, +(x.id?.match(/^L-(\d+)$/)?.[1] ?? 0)), 0) + 1).padStart(3, "0")}`;

/** 入力の確認。問題のある項目名と理由を返す(空なら OK) */
export function validateLead(x) {
  const errs = {};
  if (!String(x.name ?? "").trim()) errs.name = "相手の名前を入力してください";
  if (!KINDS.includes(x.kind)) errs.kind = "種類を選んでください";
  if (!(x.offer in OFFERS)) errs.offer = "提案の中身を選んでください";
  if (x.url && !/^https?:\/\/[^\s]+$/.test(x.url)) errs.url = "http(s):// で始まるURLを入力してください";
  if (x.formUrl && !/^https?:\/\/[^\s]+$/.test(x.formUrl)) errs.formUrl = "http(s):// で始まるURLを入力してください";
  if (x.email && !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(x.email)) errs.email = "メールアドレスの形が正しくありません(1件だけ)";
  if (x.phone && !/^[0-9()\-\s]+$/.test(x.phone)) errs.phone = "半角の数字とハイフンで入力してください";
  if (x.nextAt && !DATE.test(x.nextAt)) errs.nextAt = "日付の形式が正しくありません";
  if (x.monthlyYen != null && (typeof x.monthlyYen !== "number" || !Number.isFinite(x.monthlyYen) || x.monthlyYen < 0)) errs.monthlyYen = "0 以上の数で入れてください(空欄は未定)";
  for (const [k, n] of Object.entries(LIMITS)) if (String(x[k] ?? "").length > n) errs[k] = `${n}字以内にしてください`;
  return errs;
}

/** 相手を追加・編集する(段階は変えない。段階は setStage で、記録を残して変える) */
export function saveLead(root, input, today) {
  const pl = loadPipeline(root);
  const s = (k) => (typeof input[k] === "string" ? input[k].trim() : "");
  const x = { ...Object.fromEntries(TEXT_FIELDS.map((k) => [k, s(k)])), body: typeof input.body === "string" ? input.body.replace(/\r\n/g, "\n").trim() : "",
    monthlyYen: input.monthlyYen === "" || input.monthlyYen == null ? null : input.monthlyYen };
  const errs = validateLead(x);
  if (Object.keys(errs).length) return { code: 400, error: "入力内容を確認してください", fields: errs };
  let lead;
  if (input.id) {
    lead = pl.leads.find((y) => y.id === input.id);
    if (!lead) return { code: 404, error: "相手が見つかりません" };
  } else {
    if (pl.leads.some((y) => y.name === x.name && y.offer === x.offer && y.stage !== "lost")) return { code: 400, error: "同じ相手・同じ提案が、すでに台帳にあります", fields: { name: "すでにあります" } };
    lead = { id: nextId(pl.leads), stage: "candidate", createdAt: today, log: [{ date: today, stage: "candidate", note: "台帳に追加" }] };
    pl.leads.push(lead);
  }
  for (const k of TEXT_FIELDS) { if (x[k]) lead[k] = x[k]; else delete lead[k]; }
  if (x.monthlyYen != null) lead.monthlyYen = x.monthlyYen; else delete lead.monthlyYen;
  lead.updatedAt = today;
  pl.updated = today;
  savePipeline(root, pl);
  return { lead };
}

/**
 * 週次の分析が見つけた営業の候補を、「候補」として台帳に足す(scripts/admin/propose-lead.mjs から呼ぶ)。
 * 1回に3件まで。同じ名前の相手(見送りも含む)がすでにあれば足さない。送るのは、運営者が確かめてから。
 */
export function addSuggestedLeads(root, items, today) {
  if (!Array.isArray(items) || !items.length) return { code: 400, error: "候補がありません" };
  if (items.length > 3) return { code: 400, error: "1回に足せるのは3件までです" };
  const norm = (s) => String(s ?? "").replace(/[\s　]+/g, "");
  const added = [], skipped = [], errors = [];
  for (const it of items) {
    if (!it || typeof it !== "object") { errors.push({ error: "形が正しくありません" }); continue; }
    if (loadPipeline(root).leads.some((y) => norm(y.name) === norm(it.name))) { skipped.push(it.name); continue; }
    const r = saveLead(root, { ...it, id: undefined }, today);
    if (r.error) { errors.push({ name: it.name, error: r.error, fields: r.fields }); continue; }
    // 分析が足した印(画面に出す)
    const pl = loadPipeline(root);
    const lead = pl.leads.find((y) => y.id === r.lead.id);
    lead.source = "weekly-analytics";
    lead.log[0].note = "週次の分析が候補として追加";
    savePipeline(root, pl);
    added.push(lead);
  }
  return { added, skipped, errors };
}

/**
 * 段階を変える。記録(log)に日付とメモを残す。
 * 送信済みにした最初の日を sentAt(提案した数は、この日の月で数える)、契約にした日を wonAt に残す。
 * 送信済み・返信ありにしたとき、連絡する日が空なら、FOLLOW_DAYS 日後を入れる。契約・見送りでは、連絡する日を消す。
 */
export function setStage(root, id, stage, today, note = "", nextAt) {
  if (!(stage in STAGES)) return { code: 400, error: "不明な段階です" };
  if (nextAt && !DATE.test(nextAt)) return { code: 400, error: "連絡する日の形式が正しくありません" };
  const pl = loadPipeline(root);
  const lead = pl.leads.find((y) => y.id === id);
  if (!lead) return { code: 404, error: "相手が見つかりません" };
  // 送信済みを飛ばして返信あり・商談中・契約にしても、提案した数には入れる
  if (["sent", "replied", "talking", "won"].includes(stage)) lead.sentAt ??= today;
  if (stage === "won") lead.wonAt = today; else if (lead.stage === "won") delete lead.wonAt;
  if (stage === "candidate") delete lead.sentAt;
  lead.stage = stage;
  if (nextAt) lead.nextAt = nextAt;
  else if (["won", "lost", "candidate"].includes(stage)) delete lead.nextAt;
  else if (["sent", "replied"].includes(stage)) lead.nextAt = addDays(today, FOLLOW_DAYS);
  else if (!lead.nextAt || lead.nextAt <= today) lead.nextAt = addDays(today, FOLLOW_DAYS);
  (lead.log ??= []).push({ date: today, stage, ...(note ? { note: String(note).slice(0, LIMITS.note) } : {}) });
  lead.updatedAt = today;
  pl.updated = today;
  savePipeline(root, pl);
  return { lead };
}

/** 月ごとの、提案した数(sentAt の月)と、契約数(その月の末までに契約し、見送りになっていないもの) */
export function pipelineMonths(leads, today) {
  if (!leads.length) return {};
  const first = leads.map((x) => (x.createdAt || x.sentAt || today).slice(0, 7)).sort()[0];
  const out = {};
  for (let m = first; m <= today.slice(0, 7); m = addMonth(m, 1)) {
    const end = `${m}-${String(daysInMonth(m)).padStart(2, "0")}`;
    out[m] = {
      pitches: leads.filter((x) => x.sentAt?.startsWith(m)).length,
      contracts: leads.filter((x) => x.stage === "won" && x.wonAt && x.wonAt <= end).length,
    };
  }
  return out;
}

/**
 * 画面と週次の分析に出す、まとめ。
 *   week: 今週(月曜はじまり)に送った数と、今月の目標から出した1週の目安
 *   month: 今月の提案した数・契約数と、目標(今月の目標がなければ、次の目標の月)
 *   due: 連絡する日が来た(過ぎた)相手 / candidates: まだ送っていない候補の数
 */
export function pipelineSummary(pl, kpis = [], today) {
  const leads = pl.leads ?? [];
  const m = today.slice(0, 7);
  const months = pipelineMonths(leads, today);
  const target = (id) => {
    const t = kpis.find((k) => k.id === id && k.status !== "declined")?.targets ?? {};
    if (t[m] != null) return { month: m, value: t[m] };
    const next = Object.entries(t).filter(([k]) => k > m).sort()[0];
    return next ? { month: next[0], value: next[1] } : null;
  };
  const tp = target("pitches"), tc = target("contracts");
  const mon = mondayOf(today);
  const weekCount = leads.filter((x) => x.sentAt && x.sentAt >= mon && x.sentAt <= today).length;
  const weekGuide = tp ? Math.ceil((tp.value * 7) / daysInMonth(tp.month)) : null;
  const due = leads.filter((x) => ACTIVE.includes(x.stage) && x.nextAt && x.nextAt <= today).sort((a, b) => a.nextAt.localeCompare(b.nextAt))
    .map((x) => ({ id: x.id, name: x.name, stage: x.stage, nextAt: x.nextAt, late: Math.round((Date.parse(today) - Date.parse(x.nextAt)) / DAY) }));
  const count = Object.fromEntries(Object.keys(STAGES).map((s) => [s, leads.filter((x) => x.stage === s).length]));
  return {
    week: { from: mon, count: weekCount, guide: weekGuide, short: weekGuide != null && weekCount < weekGuide },
    month: { month: m, pitches: months[m]?.pitches ?? 0, contracts: months[m]?.contracts ?? 0, pitchTarget: tp, contractTarget: tc },
    months, due, count, candidates: count.candidate,
    wonMonthlyYen: leads.filter((x) => x.stage === "won" && x.monthlyYen).reduce((a, x) => a + x.monthlyYen, 0),
    replyRate: (() => { const sent = leads.filter((x) => x.sentAt).length; const rep = leads.filter((x) => x.sentAt && x.log?.some((l) => ["replied", "talking", "won"].includes(l.stage))).length; return sent ? { sent, replied: rep } : null; })(),
  };
}
