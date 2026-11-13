// 契約の前後の書類とお金の流れ(見積書 → 請求書 → 入金 → 領収書 → 掲載 → 更新)のテスト。作業用のフォルダだけを使う
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { defaultDueAt, loadBilling, saveBilling, billingReady, addInvoice, setInvoiceStatus, billingSummary, nextInvoiceNo, invoiceMail, RENEW_NOTICE_DAYS, addQuote, setQuoteStatus, nextQuoteNo, quoteMail, receiptOf, receiptMail, QUOTE_VALID_DAYS, QUOTE_MAX_LINES } from "../scripts/admin/billing.mjs";

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
    const good = saveBilling(root, { issuerName: "神楽めぐり編集部", bankName: "テスト銀行", branchName: "本店", accountType: "普通", accountNumber: "1234567", accountHolder: "テスト タロウ" });
    ok(!good.error && billingReady(loadBilling(root)) && existsSync(join(root, "analytics", "billing.json")), "振込先は analytics/billing.json(非公開)に保存する");

    ok(addInvoice(root, "L-002", { item: "x", amount: 1, period: "2026-12" }, today).code === 400, "契約していない相手には、請求書を作らない");
    const e1 = addInvoice(root, "L-001", { item: "", amount: -1, period: "12月", dueAt: "2026-11-01" }, today);
    ok(e1.code === 400 && e1.fields.item && e1.fields.amount && e1.fields.period && e1.fields.dueAt, "品目・金額・掲載の月・期限(今日以降)を確かめる", JSON.stringify(e1.fields));
    const r1 = addInvoice(root, "L-001", { item: "協賛枠(神楽めぐり)2026年12月分", amount: 5000, period: "2026-12" }, today);
    ok(r1.invoice?.no === "KM-202611-001" && r1.invoice.dueAt === "2026-12-31" && r1.invoice.status === "unpaid" && defaultDueAt("2026-12-15") === "2027-01-31" && defaultDueAt("2027-01-31") === "2027-02-28", "請求番号は KM-年月-通し番号。支払いの期限は既定で翌月の末(後払い。月末締め・翌月末払い)", JSON.stringify(r1.invoice));
    ok(r1.lead.contract.from === "2026-12" && r1.lead.contract.to === "2026-12", "掲載の期間(契約)を、請求した月で記録する");
    const r2 = addInvoice(root, "L-001", { item: "協賛枠 3か月", amount: 15000, period: "2027-01", months: 3, dueAt: "2026-12-20" }, today);
    ok(r2.invoice.no === "KM-202611-002" && r2.invoice.to === "2027-03" && r2.lead.contract.to === "2027-03", "何か月分かまとめた請求は、掲載の期間をその分だけ延ばす");
    ok(nextInvoiceNo([{ invoices: [{ no: "KM-202611-007" }] }], "2026-12-01") === "KM-202612-001", "月が変われば、通し番号は1から");

    let s = billingSummary(JSON.parse(readFileSync(join(root, "analytics", "pipeline.json"), "utf8")).leads, "2026-12-25");
    ok(s.unpaid.length === 2 && s.overdue === 1 && s.unpaid[0].overdue && s.unpaid[0].no === "KM-202611-002", "入金待ちと、期限を過ぎた請求を数える", JSON.stringify(s.unpaid.map((i) => [i.no, i.overdue])));
    ok(s.running.map((r) => r.id).join() === "L-001" && billingSummary(JSON.parse(readFileSync(join(root, "analytics", "pipeline.json"), "utf8")).leads, "2026-11-25").running.length === 0, "後払い: 入金の前でも、掲載の期間に入っていれば「掲載中の相手」に入る(期間の前は入らない)");
    ok(setInvoiceStatus(root, "L-001", "KM-202611-001", "paid", "2026-12-05", "2026-12-09").code === 400, "入金の日に、未来の日は入れられない");
    setInvoiceStatus(root, "L-001", "KM-202611-001", "paid", "2026-12-05", "2026-12-03");
    s = billingSummary(JSON.parse(readFileSync(join(root, "analytics", "pipeline.json"), "utf8")).leads, "2026-12-05");
    ok(s.unpaid.length === 1 && s.running.map((r) => r.id).join() === "L-001" && s.paidByMonth["2026-12"] === 5000, "入金済みにすると、入金待ちから外れ、入金の月の合計に入る", JSON.stringify(s));
    s = billingSummary(JSON.parse(readFileSync(join(root, "analytics", "pipeline.json"), "utf8")).leads, "2027-03-20");
    ok(s.renew.length === 1 && s.renew[0].days === 11 && RENEW_NOTICE_DAYS === 14, "掲載の終わりの2週間前から、更新の連絡を知らせる", JSON.stringify(s.renew));
    ok(billingSummary(JSON.parse(readFileSync(join(root, "analytics", "pipeline.json"), "utf8")).leads, "2027-03-01").renew.length === 0, "まだ先なら、知らせない");
    ok(billingSummary([{ id: "L-9", name: "x", stage: "won", wonAt: "2026-11-01" }], today).noInvoice.length === 1, "契約したのに請求書がない相手を知らせる");
    setInvoiceStatus(root, "L-001", "KM-202611-002", "void", "2026-12-05");
    const pl = JSON.parse(readFileSync(join(root, "analytics", "pipeline.json"), "utf8"));
    ok(pl.leads[0].invoices[1].status === "void" && pl.leads[0].log.some((l) => /KM-202611-002 を「取り消し」/.test(l.note)), "取り消しも、記録に残す");

    const m = invoiceMail(pl.leads[0], pl.leads[0].invoices[0], loadBilling(root));
    ok(m.subject.includes("請求書") && m.body.includes("5,000円(税込)") && m.body.includes("2026年12月31日") && !m.body.includes("1234567"), "送るメールの文面: 金額と期限を書き、口座番号は本文に書かない(請求書の PDF に書く)");
    ok(m.body.includes("掲載を始めましたので、請求書をお送りします") && m.body.includes("期限までに、お振り込みをお願いいたします") && !m.body.includes("ご入金を確かめたあとに、掲載を始めます"), "請求書のメールは後払いの文面(掲載を始めたあとに送る。入金を待って掲載する、とは書かない)");
    ok(m.body.includes("神楽めぐり編集部\nhttps://"), "代表者名が空欄なら、署名に出さない");
    saveBilling(root, { issuerRep: "見本 太郎" });
    const m2 = invoiceMail(pl.leads[0], pl.leads[0].invoices[0], loadBilling(root));
    ok(m2.body.includes("神楽めぐり編集部\n代表 見本 太郎") && m2.subject.startsWith("【神楽めぐり編集部】"), "代表者名を入れたら、署名に「代表 ○○」を出す(件名は屋号のまま)");
    ok(!/shotaro|gmail\.com/i.test(m.body + JSON.stringify(loadBilling(root))), "差出人に、個人の Gmail を出さない");
    // ---------- 見積書(契約の前に出す。値引きはマイナスの行) ----------
    section("営業: 見積書・領収書");
    const readLeads = () => JSON.parse(readFileSync(join(root, "analytics", "pipeline.json"), "utf8")).leads;
    const q0 = addQuote(root, "L-002", { lines: [{ item: "", amount: "" }] }, today);
    ok(q0.code === 400 && q0.fields.item1, "見積書: 品目と金額が1行もなければ作らない", JSON.stringify(q0.fields));
    const q1e = addQuote(root, "L-002", { lines: [{ item: "年間協賛", amount: "abc" }, { item: "", amount: 100 }], validUntil: "2026-11-01", term: "あ".repeat(61) }, today);
    ok(q1e.code === 400 && q1e.fields.amount1 && q1e.fields.item2 && q1e.fields.validUntil && q1e.fields.term, "見積書: 金額は整数、品目は必須、有効期限は今日以降、期間は60字まで(行ごとに誤りを返す)", JSON.stringify(q1e.fields));
    ok(addQuote(root, "L-002", { lines: [{ item: "年間協賛", amount: 48000 }, { item: "割引", amount: -48000 }] }, today).fields?.amount1, "見積書: 合計が0円以下なら作らない");
    const q1 = addQuote(root, "L-002", { lines: [{ item: "年間協賛(神楽めぐり)", amount: "96000" }, { item: "神楽団・主催者さま向けの割引", amount: "-48000" }, { item: "", amount: "" }], term: "2027年4月〜2028年3月", note: "内容は、ご相談に合わせて調整いたします。" }, today);
    ok(q1.quote?.no === "KQ-202611-001" && q1.quote.total === 48000 && q1.quote.lines.length === 2 && q1.quote.status === "open" && q1.quote.validUntil === "2026-12-21" && QUOTE_VALID_DAYS === 30,
      "見積書: 番号は KQ-年月-通し番号。値引きの行を足して合計を出す。空の行は捨て、有効期限は既定で30日後", JSON.stringify(q1.quote));
    ok(q1.lead.stage === "talking" && q1.lead.log.some((l) => /見積書 KQ-202611-001\(48,000円/.test(l.note)) && !q1.lead.invoices && !q1.lead.contract, "見積書は契約の前でも作れ、段階・請求・掲載の期間は変えない(記録には残す)");
    const q2 = addQuote(root, "L-001", { lines: [{ item: "協賛枠 3か月", amount: 15000 }] }, today);
    ok(q2.quote.no === "KQ-202611-002" && nextQuoteNo(readLeads(), "2026-12-01") === "KQ-202612-001" && nextInvoiceNo(readLeads(), today) === "KM-202611-003", "見積番号は全部の相手で通し。月が変われば1から。請求番号とは別に数える");
    ok(addQuote(root, "L-001", { lines: Array.from({ length: QUOTE_MAX_LINES + 2 }, (_, k) => ({ item: "行" + k, amount: 1000 })) }, today).quote.lines.length === QUOTE_MAX_LINES, "見積書の行は、決めた数まで");
    writeFileSync(join(root, "analytics", "pipeline.json"), JSON.stringify({ updated: today, leads: [...readLeads(), { id: "L-003", name: "見送りの相手", kind: "宿", offer: "MON-2", stage: "lost" }] }));
    ok(addQuote(root, "L-003", { lines: [{ item: "協賛枠", amount: 5000 }] }, today).code === 400, "見送りの相手には、見積書を作らない");
    const qm = quoteMail(q1.lead, q1.quote, loadBilling(root));
    ok(qm.subject === "【神楽めぐり編集部】お見積書のご送付" && qm.body.includes("・年間協賛(神楽めぐり): 96,000円") && qm.body.includes("・神楽団・主催者さま向けの割引: −48,000円") && qm.body.includes("お見積もりの金額: 48,000円(税込)") && qm.body.includes("有効期限: 2026年12月21日") && qm.body.includes("掲載の期間: 2027年4月〜2028年3月"),
      "見積書を送るメール: 行ごとの金額(値引きは −)・合計・期間・有効期限を書く", qm.body);
    ok(qm.body.includes("ご事情に合わせて調整いたします") && qm.body.includes("どうぞお気になさらないでください") && !qm.body.includes("1234567") && !/お願いいたします。?\n\n神楽/.test(qm.body), "見積書のメールは押し付けない言い方で、口座番号は書かない");
    ok(setQuoteStatus(root, "L-002", "KQ-202611-001", "void", today).quote.status === "void" && setQuoteStatus(root, "L-002", "KQ-999", "void", today).code === 404 && setQuoteStatus(root, "L-002", "KQ-202611-001", "x", today).code === 400
      && readLeads()[1].log.some((l) => /KQ-202611-001 を「取り消し」/.test(l.note)), "見積書の取り消しも、記録に残す(ない番号・知らない状態は誤り)");

    // ---------- 領収書(入金済みの請求書から。新しく保存するものはない) ----------
    const paidInv = pl.leads[0].invoices[0], voidInv = pl.leads[0].invoices[1];
    const rc = receiptOf(paidInv);
    ok(rc && rc.no === "KM-202611-001-R" && rc.date === "2026-12-03" && rc.amount === 5000 && rc.invoiceNo === "KM-202611-001", "領収書: 番号は 請求番号-R、領収日は入金を確かめた日、金額は請求と同じ", JSON.stringify(rc));
    ok(receiptOf(voidInv) === null && receiptOf({ ...paidInv, status: "unpaid" }) === null && receiptMail(pl.leads[0], voidInv, loadBilling(root)) === null, "領収書は、入金済みの請求書にだけ作る(入金待ち・取り消しには作らない)");
    const rm = receiptMail(pl.leads[0], paidInv, loadBilling(root));
    ok(rm.subject.includes("領収書") && rm.body.includes("2026年12月3日に、ご入金を確かめました") && rm.body.includes("金額: 5,000円(税込)") && rm.body.includes("代表 見本 太郎") && !rm.body.includes("1234567"), "領収書を送るメール: 入金を確かめた日と金額を書き、口座番号は書かない", rm.body);
    // 画面: 見積書・領収書は、請求書と同じ枠(印刷して PDF に保存)で出し、入金済みの請求にだけ領収書のボタンを出す
    const ui = readFileSync("scripts/admin/sales.js", "utf8"), srv = readFileSync("scripts/admin/server.mjs", "utf8");
    ok(ui.includes('h("h1", null, "御見積書")') && ui.includes('h("h1", null, "領収書")') && ui.includes('i.status === "paid" ? h("button", { class: "btn sm", onclick: () => showReceipt(x, i) }') && ui.includes("quoteBox(x),") && ui.includes("この金額で請求書を作る"),
      "画面: 相手のカードに見積書の欄、入金済みの請求に領収書のボタン、見積書の金額から請求書を作れる");
    ok(srv.includes('"POST /api/billing/quote"') && srv.includes('"POST /api/billing/quote-status"') && srv.includes('body.kind === "receipt"') && srv.includes("領収書は、入金済みの請求書にだけ作れます"), "サーバー: 見積書を作る・取り消す、領収書の文面は入金済みだけ");

    let ignored = false;
    try { execFileSync("git", ["check-ignore", "-q", "analytics/billing.json"]); ignored = true; } catch { ignored = false; }
    ok(ignored, "analytics/billing.json は git の対象外(振込先を公開しない)");
  } finally { rmSync(root, { recursive: true, force: true }); }
}
