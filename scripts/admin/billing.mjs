// 契約のあとの流れ: 請求書 → 入金の確認 → 掲載 → 更新の連絡(管理者用ページの「営業」の「契約」から)
//
// 保存するもの(どちらも analytics/ の中。.gitignore 済み。このPCだけ。GitHub には送らない):
//   analytics/billing.json  … 請求書に載せる差出人と振込先(運営者が画面で入れる。口座の情報なので、公開しない)
//   analytics/pipeline.json … 相手ごとの請求(lead.invoices)と、掲載の期間(lead.contract)
// 前払い: 入金を確かめてから掲載する。金額は税込の総額で書く(適格請求書の登録はしていない前提。登録したら invoiceRegNo を入れる)
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { loadPipeline } from "./pipeline.mjs";

export const INVOICE_STATUS = { unpaid: "入金待ち", paid: "入金済み", void: "取り消し" };
export const RENEW_NOTICE_DAYS = 14; // 掲載の終わりの何日前から、更新の連絡を知らせるか
const DAY = 864e5;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;
const billingFile = (root) => join(root, "analytics", "billing.json");
const pipelineFile = (root) => join(root, "analytics", "pipeline.json");
const addDays = (d, k) => new Date(Date.parse(d + "T00:00:00Z") + k * DAY).toISOString().slice(0, 10);
const monthEnd = (m) => `${m}-${String(new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate()).padStart(2, "0")}`;
const writeJson = (p, v) => { if (!existsSync(dirname(p))) mkdirSync(dirname(p), { recursive: true }); writeFileSync(p + ".tmp", JSON.stringify(v, null, 2)); renameSync(p + ".tmp", p); };

export const BILLING_DEFAULTS = { issuerName: "神楽めぐり編集部", issuerEmail: "henshubu@kagurameguri.jp", issuerSite: "https://kagurameguri.jp/", payDays: 10, feeNote: "振込手数料は、お手数ですがご負担ください。", invoiceRegNo: "" };
const B_LIMITS = { issuerName: 60, issuerEmail: 120, issuerSite: 200, bankName: 40, branchName: 40, accountType: 4, accountNumber: 8, accountHolder: 60, feeNote: 200, invoiceRegNo: 14, note: 300 };

export function loadBilling(root) {
  const p = billingFile(root);
  const j = existsSync(p) ? JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, "")) : {};
  return { ...BILLING_DEFAULTS, ...j };
}
/** 振込先がそろっているか(請求書を作る前に確かめる) */
export const billingReady = (b) => !!(b.bankName && b.branchName && b.accountType && b.accountNumber && b.accountHolder && b.issuerName);

export function validateBilling(x) {
  const errs = {};
  if (!String(x.issuerName ?? "").trim()) errs.issuerName = "差出人の名前を入力してください";
  if (x.issuerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.issuerEmail)) errs.issuerEmail = "メールアドレスの形が正しくありません";
  if (x.accountType && !["普通", "当座"].includes(x.accountType)) errs.accountType = "普通か当座を選んでください";
  if (x.accountNumber && !/^\d{7}$/.test(x.accountNumber)) errs.accountNumber = "7桁の半角数字で入れてください";
  if (x.invoiceRegNo && !/^T\d{13}$/.test(x.invoiceRegNo)) errs.invoiceRegNo = "T と13桁の数字で入れてください(登録していなければ空欄)";
  if (x.payDays != null && !(Number.isInteger(x.payDays) && x.payDays >= 1 && x.payDays <= 60)) errs.payDays = "1〜60 の日数で入れてください";
  for (const [k, n] of Object.entries(B_LIMITS)) if (String(x[k] ?? "").length > n) errs[k] = `${n}字以内にしてください`;
  return errs;
}

export function saveBilling(root, input) {
  const keys = [...Object.keys(B_LIMITS), "payDays"];
  const x = Object.fromEntries(keys.filter((k) => input[k] !== undefined).map((k) => [k, typeof input[k] === "string" ? input[k].trim() : input[k]]));
  if (x.payDays === "" || x.payDays == null) delete x.payDays; else x.payDays = Number(x.payDays);
  const errs = validateBilling(x);
  if (Object.keys(errs).length) return { code: 400, error: "入力を確かめてください", fields: errs };
  const next = { ...loadBilling(root), ...x };
  writeJson(billingFile(root), next);
  return { billing: next };
}

function withLead(root, id, fn) {
  const pl = loadPipeline(root);
  const lead = pl.leads.find((y) => y.id === id);
  if (!lead) return { code: 404, error: "相手が見つかりません" };
  const r = fn(lead, pl);
  if (r?.error) return r;
  pl.updated = r?.today ?? pl.updated;
  writeJson(pipelineFile(root), pl);
  return { lead, ...r };
}

/** 次の請求番号: KM-YYYYMM-NNN(発行した月ごとの通し番号。全部の相手で数える) */
export function nextInvoiceNo(leads, today) {
  const ym = today.slice(0, 7).replace("-", "");
  const n = leads.flatMap((x) => x.invoices ?? []).reduce((m, i) => { const k = i.no?.match(new RegExp(`^KM-${ym}-(\\d+)$`)); return k ? Math.max(m, +k[1]) : m; }, 0);
  return `KM-${ym}-${String(n + 1).padStart(3, "0")}`;
}

/**
 * 請求書を作る(契約した相手だけ)。input: { item, amount, period(YYYY-MM。掲載の月), months(何か月分。既定1), dueAt }
 * 掲載の期間(lead.contract)を、請求した月まで延ばす(更新の連絡の目安になる)
 */
export function addInvoice(root, id, input, today) {
  const b = loadBilling(root);
  if (!billingReady(b)) return { code: 400, error: "先に「請求の設定」で振込先を入れてください" };
  return withLead(root, id, (lead, pl) => {
    if (lead.stage !== "won") return { code: 400, error: "請求書は、契約した相手にだけ作れます" };
    const errs = {};
    const item = String(input.item ?? "").trim();
    const amount = Number(input.amount);
    const months = input.months == null || input.months === "" ? 1 : Number(input.months);
    const period = String(input.period ?? "");
    const dueAt = String(input.dueAt || addDays(today, b.payDays ?? BILLING_DEFAULTS.payDays));
    if (!item || item.length > 80) errs.item = "品目を80字以内で入れてください";
    if (!Number.isInteger(amount) || amount <= 0 || amount > 10_000_000) errs.amount = "税込の金額を、1円以上の整数で入れてください";
    if (!MONTH.test(period)) errs.period = "掲載の月を選んでください";
    if (!Number.isInteger(months) || months < 1 || months > 12) errs.months = "1〜12か月で入れてください";
    if (!DATE.test(dueAt) || dueAt < today) errs.dueAt = "支払いの期限は、今日以降の日付にしてください";
    if (Object.keys(errs).length) return { code: 400, error: "入力を確かめてください", fields: errs };
    const to = new Date(Date.UTC(+period.slice(0, 4), +period.slice(5, 7) - 1 + months - 1, 1)).toISOString().slice(0, 7);
    const inv = { no: nextInvoiceNo(pl.leads, today), issuedAt: today, item, amount, period, to, dueAt, status: "unpaid" };
    (lead.invoices ??= []).push(inv);
    const c = (lead.contract ??= {});
    if (!c.from || period < c.from) c.from = period;
    if (!c.to || to > c.to) c.to = to;
    (lead.log ??= []).push({ date: today, stage: "won", note: `請求書 ${inv.no}(${amount.toLocaleString("ja-JP")}円・期限 ${dueAt})` });
    lead.updatedAt = today;
    return { invoice: inv, today };
  });
}

/** 請求の状態を変える(入金済み・取り消し・入金待ちに戻す)。入金済みにした日を paidAt に残す */
export function setInvoiceStatus(root, id, no, status, today, paidAt) {
  if (!(status in INVOICE_STATUS)) return { code: 400, error: "不明な状態です" };
  if (paidAt && (!DATE.test(paidAt) || paidAt > today)) return { code: 400, error: "入金の日は、今日までの日付にしてください" };
  return withLead(root, id, (lead) => {
    const inv = (lead.invoices ?? []).find((i) => i.no === no);
    if (!inv) return { code: 404, error: "請求書が見つかりません" };
    inv.status = status;
    if (status === "paid") inv.paidAt = paidAt || today; else delete inv.paidAt;
    (lead.log ??= []).push({ date: today, stage: lead.stage, note: `${inv.no} を「${INVOICE_STATUS[status]}」に` });
    lead.updatedAt = today;
    return { invoice: inv, today };
  });
}

/**
 * 契約した相手の、請求と入金と更新のまとめ(画面と週次の分析が使う)
 *   unpaid: 入金待ち(overdue: 期限を過ぎた) / noInvoice: 契約したのに請求書がない
 *   renew: 掲載の終わりが RENEW_NOTICE_DAYS 日以内で、その次の月の請求がない / paidByMonth: 入金した月ごとの合計(円)
 *   publishReady: 入金済みで、掲載の期間に入っている(協賛枠を出してよい)相手
 */
export function billingSummary(leads, today) {
  const won = leads.filter((x) => x.stage === "won");
  const all = leads.flatMap((x) => (x.invoices ?? []).map((i) => ({ ...i, leadId: x.id, name: x.name })));
  const unpaid = all.filter((i) => i.status === "unpaid").map((i) => ({ ...i, overdue: i.dueAt < today })).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const noInvoice = won.filter((x) => !(x.invoices ?? []).some((i) => i.status !== "void")).map((x) => ({ id: x.id, name: x.name, wonAt: x.wonAt }));
  const renew = won.filter((x) => x.contract?.to).map((x) => ({ id: x.id, name: x.name, to: x.contract.to, end: monthEnd(x.contract.to), days: Math.round((Date.parse(monthEnd(x.contract.to)) - Date.parse(today)) / DAY) }))
    .filter((r) => r.days <= RENEW_NOTICE_DAYS && r.days >= -31);
  const paidByMonth = {};
  for (const i of all) if (i.status === "paid" && i.paidAt) paidByMonth[i.paidAt.slice(0, 7)] = (paidByMonth[i.paidAt.slice(0, 7)] ?? 0) + i.amount;
  const m = today.slice(0, 7);
  const publishReady = won.filter((x) => (x.invoices ?? []).some((i) => i.status === "paid" && i.period <= m && (i.to ?? i.period) >= m)).map((x) => ({ id: x.id, name: x.name }));
  return { unpaid, overdue: unpaid.filter((i) => i.overdue).length, noInvoice, renew, paidByMonth, publishReady };
}

/** 請求書を送るメールの文面(運営者が送る。振込先は請求書の PDF に書くので、本文には書かない) */
export function invoiceMail(lead, inv, b) {
  const yen = (n) => n.toLocaleString("ja-JP");
  const d = (s) => `${+s.slice(0, 4)}年${+s.slice(5, 7)}月${+s.slice(8, 10)}日`;
  return {
    subject: `【${b.issuerName}】請求書のご送付(${inv.item})`,
    body: `${lead.name}\n${lead.contact ? lead.contact + "\n" : ""}\nいつもお世話になっております。${b.issuerName}です。\nこのたびは、お申し込みをいただき、ありがとうございます。\n\n下記のとおり、請求書をお送りします(添付の PDF をご確認ください)。\n\n・品目: ${inv.item}\n・金額: ${yen(inv.amount)}円(税込)\n・お支払いの期限: ${d(inv.dueAt)}\n\nご入金を確かめたあとに、掲載を始めます。掲載が始まりましたら、あらためてご連絡します。\nご不明な点があれば、このメールにご返信ください。\n\n${b.issuerName}\n${b.issuerSite}\n${b.issuerEmail}`,
  };
}
