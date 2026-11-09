// 契約のあとの流れ(請求書 → 入金 → 掲載 → 更新)のテスト。作業用のフォルダだけを使う
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { loadBilling, saveBilling, billingReady, addInvoice, setInvoiceStatus, billingSummary, nextInvoiceNo, invoiceMail, RENEW_NOTICE_DAYS } from "../scripts/admin/billing.mjs";

export function billingTests({ ok, section }) {
  section("営業: 契約のあとの請求・入金・更新");
  const root = mkdtempSync(join(tmpdir(), "kagura-billing-"));
  try {
    mkdirSync(join(root, "analytics"));
    const leads = [
      { id: "L-001", name: "○○温泉旅館", kind: "宿", offer: "MON-2", stage: "won", wonAt: "2026-11-20", monthlyYen: 5000, email: "info@example.jp", contact: "ご担当者さま" },
      { id: "L-002", name: "△△神楽団", kind: "神楽団", offer: "MON-1", stage: "talking", sentAt: "2026-11-01" },
    ];
    writeFileSync(join(root, "analytics", "pipeline.json"), JSON.stringify({ updated: "2026-11-20", leads }));
    const today = "2026-11-21";

    ok(!billingReady(loadBilling(root)) && loadBilling(root).issuerName === "神楽めぐり編集部", "振込先が入るまでは、請求書を作れない状態(差出人の既定は 神楽めぐり編集部)");
    ok(addInvoice(root, "L-001", { item: "協賛枠", amount: 5000, period: "2026-12" }, today).code === 400, "振込先がなければ、請求書を作らない");
    const bad = saveBilling(root, { issuerName: "神楽めぐり編集部", bankName: "テスト銀行", branchName: "本店", accountType: "普通", accountNumber: "12345", accountHolder: "テスト タロウ", invoiceRegNo: "123" });
    ok(bad.code === 400 && bad.fields.accountNumber && bad.fields.invoiceRegNo, "口座番号は7桁、インボイスの登録番号は T+13桁(違えば保存しない)", JSON.stringify(bad.fields));
    const good = saveBilling(root, { issuerName: "神楽めぐり編集部", bankName: "テスト銀行", branchName: "本店", accountType: "普通", accountNumber: "1234567", accountHolder: "テスト タロウ", payDays: 10 });
    ok(!good.error && billingReady(loadBilling(root)) && existsSync(join(root, "analytics", "billing.json")), "振込先は analytics/billing.json(非公開)に保存する");

    ok(addInvoice(root, "L-002", { item: "x", amount: 1, period: "2026-12" }, today).code === 400, "契約していない相手には、請求書を作らない");
    const e1 = addInvoice(root, "L-001", { item: "", amount: -1, period: "12月", dueAt: "2026-11-01" }, today);
    ok(e1.code === 400 && e1.fields.item && e1.fields.amount && e1.fields.period && e1.fields.dueAt, "品目・金額・掲載の月・期限(今日以降)を確かめる", JSON.stringify(e1.fields));
    const r1 = addInvoice(root, "L-001", { item: "協賛枠(神楽めぐり)2026年12月分", amount: 5000, period: "2026-12" }, today);
    ok(r1.invoice?.no === "KM-202611-001" && r1.invoice.dueAt === "2026-12-01" && r1.invoice.status === "unpaid", "請求番号は KM-年月-通し番号。期限は既定で請求日の10日後", JSON.stringify(r1.invoice));
    ok(r1.lead.contract.from === "2026-12" && r1.lead.contract.to === "2026-12", "掲載の期間(契約)を、請求した月で記録する");
    const r2 = addInvoice(root, "L-001", { item: "協賛枠 3か月", amount: 15000, period: "2027-01", months: 3, dueAt: "2026-12-20" }, today);
    ok(r2.invoice.no === "KM-202611-002" && r2.invoice.to === "2027-03" && r2.lead.contract.to === "2027-03", "何か月分かまとめた請求は、掲載の期間をその分だけ延ばす");
    ok(nextInvoiceNo([{ invoices: [{ no: "KM-202611-007" }] }], "2026-12-01") === "KM-202612-001", "月が変われば、通し番号は1から");

    let s = billingSummary(JSON.parse(readFileSync(join(root, "analytics", "pipeline.json"), "utf8")).leads, "2026-12-05");
    ok(s.unpaid.length === 2 && s.overdue === 1 && s.unpaid[0].overdue, "入金待ちと、期限を過ぎた請求を数える", JSON.stringify(s.unpaid.map((i) => [i.no, i.overdue])));
    ok(s.publishReady.length === 0, "入金の前は、掲載してよい相手に入れない(前払い)");
    ok(setInvoiceStatus(root, "L-001", "KM-202611-001", "paid", "2026-12-05", "2026-12-09").code === 400, "入金の日に、未来の日は入れられない");
    setInvoiceStatus(root, "L-001", "KM-202611-001", "paid", "2026-12-05", "2026-12-03");
    s = billingSummary(JSON.parse(readFileSync(join(root, "analytics", "pipeline.json"), "utf8")).leads, "2026-12-05");
    ok(s.unpaid.length === 1 && s.publishReady.map((r) => r.id).join() === "L-001" && s.paidByMonth["2026-12"] === 5000, "入金済みにすると、掲載してよい相手に入り、入金の月の合計に入る", JSON.stringify(s));
    s = billingSummary(JSON.parse(readFileSync(join(root, "analytics", "pipeline.json"), "utf8")).leads, "2027-03-20");
    ok(s.renew.length === 1 && s.renew[0].days === 11 && RENEW_NOTICE_DAYS === 14, "掲載の終わりの2週間前から、更新の連絡を知らせる", JSON.stringify(s.renew));
    ok(billingSummary(JSON.parse(readFileSync(join(root, "analytics", "pipeline.json"), "utf8")).leads, "2027-03-01").renew.length === 0, "まだ先なら、知らせない");
    ok(billingSummary([{ id: "L-9", name: "x", stage: "won", wonAt: "2026-11-01" }], today).noInvoice.length === 1, "契約したのに請求書がない相手を知らせる");
    setInvoiceStatus(root, "L-001", "KM-202611-002", "void", "2026-12-05");
    const pl = JSON.parse(readFileSync(join(root, "analytics", "pipeline.json"), "utf8"));
    ok(pl.leads[0].invoices[1].status === "void" && pl.leads[0].log.some((l) => /KM-202611-002 を「取り消し」/.test(l.note)), "取り消しも、記録に残す");

    const m = invoiceMail(pl.leads[0], pl.leads[0].invoices[0], loadBilling(root));
    ok(m.subject.includes("請求書") && m.body.includes("5,000円(税込)") && m.body.includes("2026年12月1日") && !m.body.includes("1234567"), "送るメールの文面: 金額と期限を書き、口座番号は本文に書かない(請求書の PDF に書く)");
    ok(!/shotaro|gmail\.com/i.test(m.body + JSON.stringify(loadBilling(root))), "差出人に、個人の Gmail を出さない");
    let ignored = false;
    try { execFileSync("git", ["check-ignore", "-q", "analytics/billing.json"]); ignored = true; } catch { ignored = false; }
    ok(ignored, "analytics/billing.json は git の対象外(振込先を公開しない)");
  } finally { rmSync(root, { recursive: true, force: true }); }
}
