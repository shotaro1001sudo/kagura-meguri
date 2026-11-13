// 契約の前後の書類とお金の流れ: 見積書 → (契約) → 請求書 → 入金の確認 → 領収書 → 掲載 → 更新の連絡(管理者用ページの「営業」から)
//
// 保存するもの(どちらも analytics/ の中。.gitignore 済み。このPCだけ。GitHub には送らない):
//   analytics/billing.json  … 請求書に載せる差出人と振込先(運営者が画面で入れる。口座の情報なので、公開しない)
//   analytics/pipeline.json … 相手ごとの請求(lead.invoices)と、掲載の期間(lead.contract)
// 後払い(2026-11-14 から): 掲載を始めたあとに請求書を送り、翌月の末までに振り込んでもらう。入金の前でも掲載する。金額は税込の総額で書く(適格請求書の登録はしていない前提。登録したら invoiceRegNo を入れる)
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

export const BILLING_DEFAULTS = { issuerName: "神楽めぐり編集部", issuerEmail: "henshubu@kagurameguri.jp", issuerSite: "https://kagurameguri.jp/", feeNote: "振込手数料は、お手数ですがご負担ください。", invoiceRegNo: "" };
const B_LIMITS = { issuerName: 60, issuerRep: 40, issuerEmail: 120, issuerSite: 200, bankName: 40, branchName: 40, accountType: 4, accountNumber: 8, accountHolder: 60, feeNote: 200, invoiceRegNo: 14, note: 300 };

export function loadBilling(root) {
  const p = billingFile(root);
  const j = existsSync(p) ? JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, "")) : {};
  return { ...BILLING_DEFAULTS, ...j };
}
/** 支払いの期限の既定: 請求した月の、翌月の末(月末締め・翌月末払い。請求書を作るときに変えられる) */
export const defaultDueAt = (today) => monthEnd(new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7), 1)).toISOString().slice(0, 7));
/** 振込先がそろっているか(請求書を作る前に確かめる) */
export const billingReady = (b) => !!(b.bankName && b.branchName && b.accountType && b.accountNumber && b.accountHolder && b.issuerName);

export function validateBilling(x) {
  const errs = {};
  if (!String(x.issuerName ?? "").trim()) errs.issuerName = "差出人の名前を入力してください";
  if (x.issuerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.issuerEmail)) errs.issuerEmail = "メールアドレスの形が正しくありません";
  if (x.accountType && !["普通", "当座"].includes(x.accountType)) errs.accountType = "普通か当座を選んでください";
  if (x.accountNumber && !/^\d{7}$/.test(x.accountNumber)) errs.accountNumber = "7桁の半角数字で入れてください";
  if (x.invoiceRegNo && !/^T\d{13}$/.test(x.invoiceRegNo)) errs.invoiceRegNo = "T と13桁の数字で入れてください(登録していなければ空欄)";
  for (const [k, n] of Object.entries(B_LIMITS)) if (String(x[k] ?? "").length > n) errs[k] = `${n}字以内にしてください`;
  return errs;
}

export function saveBilling(root, input) {
  const keys = Object.keys(B_LIMITS);
  const x = Object.fromEntries(keys.filter((k) => input[k] !== undefined).map((k) => [k, typeof input[k] === "string" ? input[k].trim() : input[k]]));
  const next = { ...loadBilling(root), ...x }; // 一部だけの更新も、全体で確かめる
  const errs = validateBilling(next);
  if (Object.keys(errs).length) return { code: 400, error: "入力を確かめてください", fields: errs };
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
 * 請求書を作る(契約した相手だけ。後払いなので、掲載を始めたあとに作る)。input: { item, amount, period(YYYY-MM。掲載の始まりの月), months(何か月分。既定1), dueAt(既定は翌月の末) }
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
    const dueAt = String(input.dueAt || defaultDueAt(today));
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
 *   running: 今月が掲載の期間の相手(取り消していない請求書があるもの。後払いなので、入金の前でも載せている)
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
  const running = won.filter((x) => (x.invoices ?? []).some((i) => i.status !== "void" && i.period <= m && (i.to ?? i.period) >= m)).map((x) => ({ id: x.id, name: x.name }));
  return { unpaid, overdue: unpaid.filter((i) => i.overdue).length, noInvoice, renew, paidByMonth, running };
}

/** 請求書を送るメールの文面(運営者が送る。振込先は請求書の PDF に書くので、本文には書かない) */
export function invoiceMail(lead, inv, b) {
  const yen = (n) => n.toLocaleString("ja-JP");
  const d = (s) => `${+s.slice(0, 4)}年${+s.slice(5, 7)}月${+s.slice(8, 10)}日`;
  return {
    subject: `【${b.issuerName}】請求書のご送付(${inv.item})`,
    body: `${lead.name}\n${lead.contact ? lead.contact + "\n" : ""}\nいつもお世話になっております。${b.issuerName}です。\nこのたびは、お申し込みをいただき、ありがとうございます。\n\n掲載を始めましたので、請求書をお送りします(添付の PDF をご確認ください)。\n\n・品目: ${inv.item}\n・金額: ${yen(inv.amount)}円(税込)\n・お支払いの期限: ${d(inv.dueAt)}\n\n期限までに、お振り込みをお願いいたします。お支払いの時期にご事情がございましたら、どうぞお知らせください。\nご不明な点があれば、このメールにご返信ください。\n\n${b.issuerName}${b.issuerRep ? `\n代表 ${b.issuerRep}` : ""}\n${b.issuerSite}\n${b.issuerEmail}`,
  };
}

// ---------- 見積書・領収書 ----------
// 見積書: 契約の前に出す(見送りの相手には作らない)。相手ごとに lead.quotes に残す。番号は KQ-YYYYMM-NNN(発行した月ごとの通し番号)。
//   行は QUOTE_MAX_LINES 行まで。値引きは、金額をマイナスにした行で書く(例: 「神楽団・主催者さま向けの割引」-48,000)。合計は1円以上。
//   振込先は載せない(請求書に載せる)。金額は税込の総額。
// 領収書: 入金済みの請求書から作る。新しく保存するものはない(番号は 請求番号-R、領収日は入金を確かめた日)。
export const QUOTE_STATUS = { open: "有効", void: "取り消し" };
export const QUOTE_VALID_DAYS = 30; // 有効期限の既定(発行日から)
export const QUOTE_MAX_LINES = 4;
const jpDay = (s) => `${+s.slice(0, 4)}年${+s.slice(5, 7)}月${+s.slice(8, 10)}日`;
const yenText = (n) => `${n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("ja-JP")}円`; // 値引きの行は「−48,000円」
const signature = (b) => `${b.issuerName}${b.issuerRep ? `\n代表 ${b.issuerRep}` : ""}\n${b.issuerSite}\n${b.issuerEmail}`;
const addressee = (lead) => `${lead.name}\n${lead.contact ? lead.contact + "\n" : ""}`;

/** 次の見積番号: KQ-YYYYMM-NNN(全部の相手で数える) */
export function nextQuoteNo(leads, today) {
  const ym = today.slice(0, 7).replace("-", "");
  const n = leads.flatMap((x) => x.quotes ?? []).reduce((m, q) => { const k = q.no?.match(new RegExp(`^KQ-${ym}-(\\d+)$`)); return k ? Math.max(m, +k[1]) : m; }, 0);
  return `KQ-${ym}-${String(n + 1).padStart(3, "0")}`;
}

/**
 * 見積書を作る。input: { lines: [{ item, amount }], term(掲載の期間などの文。なくても可), validUntil(有効期限), note(備考。なくても可) }
 * 空の行(品目も金額もない)は捨てる。誤りは fields に、行ごとの名前(item1・amount1 …)で返す
 */
export function addQuote(root, id, input, today) {
  return withLead(root, id, (lead, pl) => {
    if (lead.stage === "lost") return { code: 400, error: "見送りの相手には、見積書を作れません" };
    const errs = {};
    const raw = (Array.isArray(input.lines) ? input.lines : []).slice(0, QUOTE_MAX_LINES).map((l, i) => ({ i: i + 1, item: String(l?.item ?? "").trim(), amount: l?.amount === "" || l?.amount == null ? null : Number(l.amount) }));
    const used = raw.filter((l) => l.item || l.amount != null);
    for (const l of used) {
      if (!l.item || l.item.length > 80) errs[`item${l.i}`] = "品目を80字以内で入れてください";
      if (!Number.isInteger(l.amount) || l.amount === 0 || Math.abs(l.amount) > 10_000_000) errs[`amount${l.i}`] = "税込の金額を、整数で入れてください(値引きはマイナス)";
    }
    if (!used.length) errs.item1 = "品目と金額を、1行は入れてください";
    const total = used.reduce((a, l) => a + (Number.isInteger(l.amount) ? l.amount : 0), 0);
    if (used.length && !Object.keys(errs).length && total <= 0) errs.amount1 = "合計が1円以上になるようにしてください";
    const term = String(input.term ?? "").trim(), note = String(input.note ?? "").trim();
    const validUntil = String(input.validUntil || addDays(today, QUOTE_VALID_DAYS));
    if (term.length > 60) errs.term = "60字以内にしてください";
    if (note.length > 200) errs.note = "200字以内にしてください";
    if (!DATE.test(validUntil) || validUntil < today) errs.validUntil = "有効期限は、今日以降の日付にしてください";
    if (Object.keys(errs).length) return { code: 400, error: "入力を確かめてください", fields: errs };
    const quote = { no: nextQuoteNo(pl.leads, today), issuedAt: today, lines: used.map(({ item, amount }) => ({ item, amount })), total, validUntil, status: "open", ...(term ? { term } : {}), ...(note ? { note } : {}) };
    (lead.quotes ??= []).push(quote);
    (lead.log ??= []).push({ date: today, stage: lead.stage, note: `見積書 ${quote.no}(${yenText(total)}・有効期限 ${validUntil})` });
    lead.updatedAt = today;
    return { quote, today };
  });
}

/** 見積書を取り消す・有効に戻す */
export function setQuoteStatus(root, id, no, status, today) {
  if (!(status in QUOTE_STATUS)) return { code: 400, error: "不明な状態です" };
  return withLead(root, id, (lead) => {
    const q = (lead.quotes ?? []).find((y) => y.no === no);
    if (!q) return { code: 404, error: "見積書が見つかりません" };
    q.status = status;
    (lead.log ??= []).push({ date: today, stage: lead.stage, note: `${q.no} を「${QUOTE_STATUS[status]}」に` });
    lead.updatedAt = today;
    return { quote: q, today };
  });
}

/** 見積書を送るメールの文面(運営者が送る。押し付けない言い方で、内容は相談に合わせて直せると書く) */
export function quoteMail(lead, q, b) {
  return {
    subject: `【${b.issuerName}】お見積書のご送付`,
    body: `${addressee(lead)}\nいつもお世話になっております。${b.issuerName}です。\nこのたびは、ご相談をいただき、ありがとうございます。\n\nお見積書をお送りします(添付の PDF をご確認ください)。\n\n${q.lines.map((l) => `・${l.item}: ${yenText(l.amount)}`).join("\n")}\n・お見積もりの金額: ${yenText(q.total)}(税込)\n${q.term ? `・掲載の期間: ${q.term}\n` : ""}・有効期限: ${jpDay(q.validUntil)}\n\n内容や期間、金額は、ご事情に合わせて調整いたします。ご希望がございましたら、どうぞお気軽にお知らせください。\nもし今回は難しいようでしたら、どうぞお気になさらないでください。\n\n${signature(b)}`,
  };
}

/** 領収書の中身(入金済みの請求書だけ。そうでなければ null) */
export const receiptOf = (inv) => (inv?.status === "paid" && inv.paidAt ? { no: `${inv.no}-R`, date: inv.paidAt, amount: inv.amount, item: inv.item, invoiceNo: inv.no } : null);

/** 領収書を送るメールの文面(入金済みの請求書だけ。そうでなければ null) */
export function receiptMail(lead, inv, b) {
  const r = receiptOf(inv);
  if (!r) return null;
  return {
    subject: `【${b.issuerName}】領収書のご送付(${r.item})`,
    body: `${addressee(lead)}\nいつもお世話になっております。${b.issuerName}です。\nこのたびは、お振り込みをいただき、ありがとうございます。${jpDay(r.date)}に、ご入金を確かめました。\n\n領収書をお送りします(添付の PDF をご確認ください)。\n\n・品目: ${r.item}\n・金額: ${yenText(r.amount)}(税込)\n・領収日: ${jpDay(r.date)}\n\n引き続き、どうぞよろしくお願いいたします。\nご不明な点があれば、このメールにご返信ください。\n\n${signature(b)}`,
  };
}
