// 営業(このPCだけに保存。GitHub には送らない): 協賛・有料プラン・送客の提案先の台帳と、契約のあとの請求・入金。
// 相手ごとに「候補 → 送信済み → 返信あり → 商談中 → 契約 / 見送り」を記録する。相手への連絡・条件・契約は運営者が行う(管理者用ページからは送らない)
import { h, $, S, view, render, call, toast, fail, confirmBox, askBox, openForm, field, input, badge, chip, seg, more, kv, note, icon, ext, yen, jpDate, monthLabel, addMonth, addDays, curMonth, copyText, openMail, empty } from "./ui.js";

// 段階を進めるボタン: 今の段階 → [次の段階, ボタンの文]
const NEXT_STAGE = { candidate: [["sent", "送った"]], sent: [["replied", "返信があった"], ["sent", "もう一度送った"]], replied: [["talking", "商談に進んだ"], ["won", "契約した"]], talking: [["won", "契約した"]], won: [], lost: [["candidate", "候補に戻す"]] };
const ORDER = ["candidate", "sent", "replied", "talking", "won", "lost"];
const stageBadge = (st) => badge({ candidate: "info", sent: "warn", replied: "warn", talking: "warn", won: "ok", lost: "mut" }[st] || "info", S.pipeline.stages[st] || st);
const unseenOf = (x) => (x.replies || []).filter((r) => !r.auto && (!x.replySeenAt || r.date > x.replySeenAt));

/** いま営業で行うこと(「やること」と、メニューの件数に出す)。count は件数に数える数(なければ n) */
export function salesTodos() {
  const P = S.pipeline;
  if (!P) return [];
  const sm = P.summary, B = P.billingSummary, wk = sm.week;
  const fresh = P.leads.filter((x) => x.stage === "candidate" && x.source === "weekly-analytics").length;
  const go = (st) => ["sales", st ? { salesSt: st } : undefined];
  return [
    { n: sm.unseen || 0, label: "相手から届いた新しい返信", go: go("sent") },
    { n: sm.due.length, label: "連絡する日が来た相手", go: go("sent") },
    { n: B?.noInvoice.length || 0, label: "契約したのに、請求書がまだの相手", go: go("won") },
    { n: B?.overdue || 0, label: "支払いの期限を過ぎた請求", go: go("won") },
    { n: B?.renew.length || 0, label: "更新の連絡をする時期の契約", go: go("won") },
    { n: !P.billingReady && P.leads.some((x) => x.stage === "won") ? 1 : 0, label: "請求の振込先が未設定", go: go("won") },
    // 送れる候補がない時は、メニューの数字に数えない(押しても消せないため)。営業の画面には出す
    { n: wk.short ? wk.guide - wk.count : 0, nText: wk.short ? `あと${wk.guide - wk.count}件` : "", count: wk.short && sm.candidates ? 1 : 0, label: "今週の提案が、1週の目安に足りません",
      note: !sm.candidates ? "いま送れる候補はありません。3日に1回の分析で候補が足されます" : fresh ? `分析が足した候補が ${fresh} 件あります。内容を確かめて送ります` : "候補に送って、「送った」を押します", go: go("candidate") },
  ].filter((r) => r.n);
}
export const salesCount = () => salesTodos().reduce((a, r) => a + (r.count ?? r.n), 0);

// ---------- 操作 ----------
async function seenReplies(x) {
  try { await call("/api/pipeline/seen", { id: x.id }); toast("返信を確かめた印を付けました。段階は、やりとりに合わせて進めてください"); render(); }
  catch (err) { fail(err); }
}
// 段階を変える。メモ(と、やりとり中なら次に連絡する日)を聞く
async function moveLead(x, stage, onlyDate) {
  const P = S.pipeline, needDate = onlyDate || ["replied", "talking"].includes(stage);
  const def = addDays(S.today, P.followDays);
  const label = P.stages[stage];
  const v = await askBox({
    title: onlyDate ? `「${x.name}」に、次に連絡する日` : `「${x.name}」を「${label}」にします`,
    body: onlyDate ? "連絡する日が来ると、「やること」に出ます。" : stage === "sent" ? `送った日を記録し、${P.followDays}日後を「次に連絡する日」にします。` : stage === "won" ? "契約した日を記録します。このあと、請求書を作れます。" : stage === "lost" ? "見送りにすると、連絡の予定から外れます。" : "",
    points: [["local", "このPCにだけ記録します。"], ...(stage === "lost" && !onlyDate ? [["undo", "「見送り」の一覧から、「候補に戻す」で戻せます。"]] : [])],
    fields: [...(needDate ? [{ name: "nextAt", label: "次に連絡する日", type: "date", required: true, min: S.today, value: onlyDate && x.nextAt > S.today ? x.nextAt : def }] : []),
      ...(onlyDate ? [] : [{ name: "note", label: stage === "lost" ? "理由・メモ(なくても構いません)" : "メモ(なくても構いません)", type: "textarea", placeholder: stage === "won" ? "例: 月5,000円で3か月" : "" }])],
    ok: onlyDate ? "日を変える" : `「${label}」にする` });
  if (!v) return;
  try { await call("/api/pipeline/stage", { id: x.id, stage, note: onlyDate ? "連絡する日を変更" : v.note, nextAt: v.nextAt }); toast(onlyDate ? "連絡する日を変えました" : `「${label}」にしました`); render(); }
  catch (err) { fail(err); }
}
// 営業の文案を、Gmail の作成画面で開く(送信はしない。差出人は Gmail で既定にした編集部アドレス)
function composeLead(x) { openMail(x.email, x.subject || "", x.body || ""); }

function editLead(x) {
  const P = S.pipeline, v = x || { kind: P.kinds[0], offer: "MON-1" };
  openForm({
    title: x ? `相手を編集: ${x.name}` : "相手を追加",
    intro: h("p", { class: "mut" }, "このPCにだけ保存します。連絡先は、公式のページで確かめたものを入れてください。"),
    body: [h("div", { class: "grid" },
      field("name", "相手の名前(団体・施設)", input("name", v.name, { required: true, maxlength: 80 })),
      field("kind", "種類", h("select", { id: "f-kind", name: "kind" }, P.kinds.map((k) => h("option", { value: k, selected: k === v.kind }, k)))),
      field("offer", "提案の中身", h("select", { id: "f-offer", name: "offer" }, Object.entries(P.offers).map(([k, t]) => h("option", { value: k, selected: k === v.offer }, t)))),
      field("contact", "宛先・窓口", input("contact", v.contact, { maxlength: 200 }), { optional: true }),
      field("email", "メールアドレス", input("email", v.email, { type: "email", maxlength: 120 }), { optional: true, help: "公式に載っているもの。1件だけ" }),
      field("formUrl", "問い合わせフォームの URL", input("formUrl", v.formUrl, { type: "url", maxlength: 300, placeholder: "https://" }), { optional: true }),
      field("phone", "電話", input("phone", v.phone, { type: "tel", maxlength: 40 }), { optional: true }),
      field("url", "出典の URL", input("url", v.url, { type: "url", maxlength: 300, placeholder: "https://" }), { optional: true }),
      field("monthlyYen", "契約の月額(円)", input("monthlyYen", v.monthlyYen, { type: "number", min: "0", step: "1", inputmode: "numeric" }), { optional: true, help: "決まったら入れます" }),
      x && ["sent", "replied", "talking"].includes(x.stage) ? field("nextAt", "次に連絡する日", input("nextAt", v.nextAt, { type: "date" })) : ""),
    field("subject", "文案の件名", input("subject", v.subject, { class: "full", maxlength: 120 }), { optional: true }),
    field("body", "文案の本文", h("textarea", { id: "f-body", name: "body", rows: 12, class: "full", maxlength: 4000 }, v.body || ""), { optional: true }),
    field("memo", "メモ", h("textarea", { id: "f-memo", name: "memo", rows: 3, class: "full", maxlength: 1000 }, v.memo || ""), { optional: true })],
    onSubmit: async (form) => {
      const f = form.elements, val = (k) => (f[k] ? f[k].value : "");
      const lead = { id: x?.id, name: val("name"), kind: val("kind"), offer: val("offer"), contact: val("contact"), url: val("url"), email: val("email"), formUrl: val("formUrl"), phone: val("phone"), subject: val("subject"), body: val("body"), memo: val("memo"), nextAt: x ? val("nextAt") || x.nextAt || "" : "",
        monthlyYen: val("monthlyYen") === "" ? null : Number(val("monthlyYen")) };
      await call("/api/pipeline/save", { lead });
      toast(x ? "保存しました" : "台帳に追加しました"); render();
    },
  });
}

// ---------- 契約のあと: 請求 → 入金の確認 → 掲載 → 更新の連絡 ----------
const fullDate = (s) => `${+s.slice(0, 4)}年${+s.slice(5, 7)}月${+s.slice(8, 10)}日`;
const invBadge = (i) => badge({ unpaid: i.dueAt < S.today ? "stop" : "warn", paid: "ok", void: "mut" }[i.status] || "info", i.status === "unpaid" && i.dueAt < S.today ? "期限切れ" : S.pipeline.invoiceStatus[i.status]);
const periodText = (i) => (i.to && i.to !== i.period ? `${monthLabel(i.period)}〜${monthLabel(i.to)}` : monthLabel(i.period));
async function setInvoice(x, i, status) {
  let paidAt;
  if (status === "paid") {
    const v = await askBox({ title: "入金を確かめましたか?", body: `「${x.name}」の ${i.no}(${yen(i.amount)})`, points: [["local", "このPCにだけ記録します。"], ["undo", "「入金待ちに戻す」で戻せます。"]],
      fields: [{ name: "paidAt", label: "入金を確かめた日", type: "date", required: true, value: S.today }], ok: "入金済みにする" });
    if (!v) return;
    paidAt = v.paidAt;
  } else if (!(await confirmBox(status === "void"
    ? { title: `請求書 ${i.no} を取り消しますか?`, body: `「${x.name}」あて ${yen(i.amount)}`, danger: true, ok: "取り消す", points: [["local", "このPCの記録だけを変えます。相手に送った請求書は、自分で取り消しを伝えてください。"], ["undo", "「入金待ちに戻す」で戻せます。"]] }
    : { title: `請求書 ${i.no} を「入金待ち」に戻しますか?`, body: `「${x.name}」あて ${yen(i.amount)}`, ok: "入金待ちに戻す", points: [["local", "このPCにだけ記録します。"]] }))) return;
  try { await call("/api/billing/status", { id: x.id, no: i.no, status, paidAt }); toast(status === "paid" ? "入金済みにしました。掲載を始めてください" : "変更しました"); render(); }
  catch (err) { fail(err); }
}
async function invoiceMailOut(x, i) {
  try {
    const { mail: m } = await call("/api/billing/mail", { id: x.id, no: i.no });
    if (x.email) { openMail(x.email, m.subject, m.body); toast("メールを書く画面を開きました。請求書の PDF を添付して、送ってください"); }
    else copyText(`件名: ${m.subject}\n\n${m.body}`, "文面をコピーしました。請求書の PDF を添えて送ってください");
  } catch (err) { fail(err); }
}
export function editBilling() {
  const b = S.pipeline.billing;
  const inp = (name, attrs = {}) => input(name, b[name], attrs);
  openForm({
    title: "請求の設定(差出人と振込先)",
    intro: h("p", { class: "mut" }, "請求書に載せる差出人と振込先です。このPCにだけ保存し、GitHub には送りません。"),
    body: [h("div", { class: "grid" },
      field("issuerName", "差出人(屋号)", inp("issuerName", { required: true, maxlength: 60 })),
      field("issuerRep", "代表者名", inp("issuerRep", { maxlength: 40 }), { optional: true, help: "請求書と、送るメールの署名に出ます" }),
      field("issuerEmail", "連絡先のメール", inp("issuerEmail", { type: "email", maxlength: 120 })),
      field("bankName", "銀行名", inp("bankName", { maxlength: 40, placeholder: "例: ○○銀行" })),
      field("branchName", "支店名", inp("branchName", { maxlength: 40, placeholder: "例: ○○支店" })),
      field("accountType", "口座の種類", h("select", { id: "f-accountType", name: "accountType" }, ["普通", "当座"].map((t) => h("option", { value: t, selected: (b.accountType || "普通") === t }, t)))),
      field("accountNumber", "口座番号(7桁)", inp("accountNumber", { inputmode: "numeric", maxlength: 7, autocomplete: "off" })),
      field("accountHolder", "口座の名義(カナ)", inp("accountHolder", { maxlength: 60 }), { help: "通帳のとおりに。個人の口座なら、本名が相手に見えます" }),
      field("payDays", "支払いの期限(請求日から何日)", input("payDays", b.payDays ?? 10, { type: "number", min: "1", max: "60", inputmode: "numeric" })),
      field("invoiceRegNo", "インボイスの登録番号", inp("invoiceRegNo", { maxlength: 14, placeholder: "T から始まる14桁" }), { optional: true, help: "登録していなければ、空欄" })),
    field("feeNote", "振込手数料の書き方", inp("feeNote", { class: "full", maxlength: 200 }))],
    onSubmit: async (form) => {
      const f = form.elements, billing = {};
      for (const k of ["issuerName", "issuerRep", "issuerEmail", "bankName", "branchName", "accountType", "accountNumber", "accountHolder", "invoiceRegNo", "feeNote"]) billing[k] = f[k].value;
      billing.payDays = f.payDays.value === "" ? null : Number(f.payDays.value);
      await call("/api/billing/settings", { billing });
      toast("請求の設定を保存しました"); render();
    },
  });
}
function newInvoice(x, period) {
  const b = S.pipeline.billing;
  const per = period || (x.contract?.to ? addMonth(x.contract.to, 1) : addMonth(curMonth(), 1));
  const due = addDays(S.today, b.payDays || 10);
  const offerName = { "MON-2": "協賛枠", "MON-1": "有料プラン" }[x.offer] || "掲載";
  const form = openForm({
    title: `請求書を作る: ${x.name}`, ok: "請求書を作る",
    intro: h("p", { class: "mut" }, "前払いです。作ったあと、請求書が開きます。印刷の画面で「PDF に保存」を選び、メールに添えて送ります。"),
    body: [h("div", { class: "grid" },
      field("period", "掲載の始まりの月", input("period", per, { type: "month", required: true })),
      field("months", "何か月分", input("months", "1", { type: "number", min: "1", max: "12", inputmode: "numeric" })),
      field("amount", "金額(税込・円)", input("amount", x.monthlyYen, { type: "number", min: "1", step: "1", required: true, inputmode: "numeric" }), { help: "何か月分かまとめるときは、合計の金額" }),
      field("dueAt", "支払いの期限", input("dueAt", due, { type: "date", required: true }), { help: "掲載の始まりより前にすると、前払いになります" })),
    field("item", "品目", h("input", { id: "f-item", name: "invItem", class: "full", maxlength: 80, required: true, value: `${offerName}(神楽めぐり)${monthLabel(per)}分` }))],
    onSubmit: async (f0) => {
      const f = f0.elements;
      const invoice = { period: f.period.value, months: Number(f.months.value) || 1, amount: Number(f.amount.value), dueAt: f.dueAt.value, item: f.invItem.value };
      const r = await call("/api/billing/invoice", { id: x.id, invoice });
      toast(`${r.invoice.no} を作りました`); render();
      setTimeout(() => showInvoice(S.pipeline.leads.find((y) => y.id === x.id), r.invoice), 0); // 入力の画面が閉じてから開く
    },
  });
  const sync = () => { const v = form.elements.period.value, n = Number(form.elements.months.value) || 1; if (v) form.elements.invItem.value = `${offerName}(神楽めぐり)${n > 1 ? `${monthLabel(v)}から${n}か月分` : `${monthLabel(v)}分`}`; };
  form.elements.period.addEventListener("change", sync); form.elements.months.addEventListener("change", sync);
}
// 請求書(印刷して PDF に保存する)。画面の上に重ねて出し、印刷のときは請求書だけを出す(app.css の @media print)
function showInvoice(x, i) {
  const b = S.pipeline.billing;
  $("#invoice-view")?.remove();
  const back = document.activeElement;
  const sheet = h("article", { class: "invoice-sheet" },
    h("h1", null, "請求書"),
    h("div", { class: "inv-meta" }, h("p", null, `請求番号: ${i.no}`), h("p", null, `請求日: ${fullDate(i.issuedAt)}`)),
    h("div", { class: "inv-parties" },
      h("div", null, h("p", { class: "inv-to" }, `${x.name} 御中`), x.contact ? h("p", null, x.contact) : ""),
      h("div", { class: "inv-from" }, h("p", null, h("b", null, b.issuerName)), b.issuerRep ? h("p", null, `代表 ${b.issuerRep}`) : "", h("p", null, b.issuerEmail), h("p", null, b.issuerSite), b.invoiceRegNo ? h("p", null, `登録番号: ${b.invoiceRegNo}`) : "")),
    h("p", null, "下記のとおり、ご請求申し上げます。"),
    h("p", { class: "inv-total" }, "ご請求金額 ", h("b", null, `${i.amount.toLocaleString("ja-JP")}円`), "(税込)"),
    h("table", { class: "inv-table" },
      h("thead", null, h("tr", null, h("th", null, "品目"), h("th", null, "掲載の期間"), h("th", null, "金額(税込)"))),
      h("tbody", null, h("tr", null, h("td", null, i.item), h("td", null, periodText(i)), h("td", { class: "num" }, `${i.amount.toLocaleString("ja-JP")}円`))),
      h("tfoot", null, h("tr", null, h("th", { colspan: "2" }, "合計"), h("td", { class: "num" }, `${i.amount.toLocaleString("ja-JP")}円`)))),
    h("h2", null, "お振込先"),
    h("dl", { class: "inv-bank" },
      h("dt", null, "銀行"), h("dd", null, `${b.bankName} ${b.branchName}`),
      h("dt", null, "口座"), h("dd", null, `${b.accountType} ${b.accountNumber}`),
      h("dt", null, "名義"), h("dd", null, b.accountHolder),
      h("dt", null, "お支払いの期限"), h("dd", null, fullDate(i.dueAt))),
    h("p", { class: "inv-note" }, b.feeNote),
    h("p", { class: "inv-note" }, "ご入金を確かめたあとに、掲載を始めます。"),
    i.status === "void" ? h("p", { class: "inv-void" }, "この請求書は取り消しました") : "");
  const close = () => { box.remove(); back?.focus?.(); };
  const box = h("div", { id: "invoice-view", class: "invoice-view", role: "dialog", "aria-modal": "true", "aria-label": `請求書 ${i.no}`, onkeydown: (ev) => { if (ev.key === "Escape") close(); } },
    h("div", { class: "bar inv-tools" },
      h("button", { class: "btn primary", onclick: () => window.print() }, "印刷する(「PDF に保存」を選ぶ)"),
      h("button", { class: "btn", onclick: close }, "閉じる"),
      h("span", { class: "mut small" }, `ファイル名の例: 請求書_${i.no}.pdf`)),
    sheet);
  document.body.append(box);
  box.querySelector(".btn").focus();
}
function billingPanel() {
  const P = S.pipeline, B = P.billingSummary, won = P.leads.filter((x) => x.stage === "won").length;
  if (!won && !B.unpaid.length && P.billingReady) return "";
  const lead = (id) => P.leads.find((y) => y.id === id);
  return h("section", { class: "card", "aria-labelledby": "bill-h" },
    h("div", { class: "card-h" }, h("h2", { id: "bill-h" }, "請求と入金"), h("button", { class: "btn sm", onclick: editBilling }, "請求の設定(振込先)")),
    !P.billingReady ? note("warn", "振込先が、まだ入っていません。請求書を作る前に「請求の設定」で入れてください(このPCにだけ保存します)。") : "",
    B.noInvoice.length ? [h("h3", null, "契約したのに、請求書がまだの相手"), h("ul", { class: "plan-rows" }, B.noInvoice.map((r) => h("li", null, h("span", { class: "t" }, r.name), h("span", { class: "mut small" }, `契約 ${jpDate(r.wonAt)}`),
      h("button", { class: "btn sm tonal", disabled: !P.billingReady, onclick: () => newInvoice(lead(r.id)) }, "請求書を作る"))))] : "",
    B.unpaid.length ? [h("h3", null, "入金待ち"), h("ul", { class: "plan-rows" }, B.unpaid.map((i) => h("li", { class: i.overdue ? "att" : "" }, h("span", { class: "t" }, `${i.name} ・ ${yen(i.amount)}`), invBadge(i), h("span", { class: "mut small" }, `${i.no} ・ 期限 ${jpDate(i.dueAt)}`),
      h("button", { class: "btn sm tonal", onclick: () => setInvoice(lead(i.leadId), i, "paid") }, "入金を確かめた"))))] : "",
    B.renew.length ? [h("h3", null, "更新の連絡をする時期"), h("ul", { class: "plan-rows" }, B.renew.map((r) => h("li", { class: "att" }, h("span", { class: "t" }, r.name), h("span", { class: "mut small" }, `掲載は ${jpDate(r.end)} まで(${r.days >= 0 ? `あと${r.days}日` : `${-r.days}日過ぎ`})`),
      h("button", { class: "btn sm tonal", disabled: !P.billingReady, onclick: () => newInvoice(lead(r.id), addMonth(r.to, 1)) }, "次の月の請求書を作る"))))] : "",
    B.publishReady.length ? h("p", { class: "mut small" }, `入金済みで、今月が掲載の期間の相手: ${B.publishReady.map((r) => r.name).join("、")}。協賛枠に載っているか確かめてください(載せるのは、Claude に「協賛枠に○○を載せて」と頼めます)。`) : "",
    Object.keys(B.paidByMonth).length ? h("p", { class: "mut small" }, "入金の合計: ", Object.entries(B.paidByMonth).sort().reverse().slice(0, 3).map(([m, v]) => `${monthLabel(m)} ${yen(v)}`).join(" ・ "), "(「目標・収益」の「実績を入れる」の、協賛・有料プランの収入に入れる目安)") : "",
    more("請求の流れ", h("p", { class: "mut" }, "契約したら請求書を作る → PDF にしてメールで送る → 入金を確かめたら「入金を確かめた」→ 掲載を始める → 終わりの2週間前に更新の連絡。前払いなので、入金の前には掲載しません。")));
}
function billingBox(x) {
  const P = S.pipeline;
  if (x.stage !== "won" && !(x.invoices || []).length) return "";
  const invs = (x.invoices || []).slice().reverse();
  return h("details", { class: "more", open: x.stage === "won" ? true : null }, h("summary", null, `請求と入金(${invs.length}件)`, x.contract?.to ? chip(`掲載 ${monthLabel(x.contract.from)}〜${monthLabel(x.contract.to)}`) : ""),
    invs.length ? h("ul", { class: "plan-rows" }, invs.map((i) => h("li", null, h("span", { class: "t" }, `${i.no} ・ ${i.item} ・ ${yen(i.amount)}`), invBadge(i),
      h("span", { class: "mut small" }, `${periodText(i)} ・ 期限 ${jpDate(i.dueAt)}${i.paidAt ? ` ・ 入金 ${jpDate(i.paidAt)}` : ""}`),
      h("span", { class: "bar" },
        i.status === "unpaid" ? h("button", { class: "btn sm tonal", onclick: () => setInvoice(x, i, "paid") }, "入金を確かめた") : "",
        h("button", { class: "btn sm", onclick: () => showInvoice(x, i) }, "請求書を表示(PDF に保存)"),
        i.status !== "void" ? h("button", { class: "btn sm", onclick: () => invoiceMailOut(x, i) }, x.email ? "送るメールを開く" : "送る文面をコピー") : "",
        i.status === "unpaid" ? h("button", { class: "btn sm quiet", onclick: () => setInvoice(x, i, "void") }, "取り消す") : "",
        i.status !== "unpaid" ? h("button", { class: "btn sm quiet", onclick: () => setInvoice(x, i, "unpaid") }, "入金待ちに戻す") : "")))) : h("p", { class: "mut small" }, "まだ請求書はありません。"),
    x.stage === "won" ? h("div", { class: "bar" }, h("button", { class: "btn sm tonal", disabled: !P.billingReady, onclick: () => newInvoice(x) }, "請求書を作る"), !P.billingReady ? h("span", { class: "mut small" }, "先に「請求の設定」で振込先を入れてください") : "") : "");
}

// ---------- 相手のカード ----------
// Gmail で見つけた、相手からのメール(新しいものが上)。まだ確かめていない返信は開いて出す
const gmailMsg = (mid) => `https://mail.google.com/mail/?authuser=${encodeURIComponent(S.gmailUser || "")}#search/${encodeURIComponent("rfc822msgid:" + String(mid).replace(/^<|>$/g, ""))}`;
function replyBox(x) {
  const rs = (x.replies || []).slice().reverse();
  if (!rs.length) return "";
  const unseen = unseenOf(x);
  return h("details", { class: "more replies", open: unseen.length ? true : null },
    h("summary", null, `相手からのメール(${rs.length}件)`, unseen.length ? chip(`新しい返信 ${unseen.length}件`, "due") : ""),
    h("ul", { class: "plan-rows" }, rs.map((r) => h("li", null,
      h("span", { class: "t" }, r.subject || "(件名なし)"), h("span", { class: "mut small" }, `${jpDate(r.date.slice(0, 10))} ・ ${r.from}${r.auto ? " ・ 自動返信" : ""}`),
      r.snippet ? h("span", { class: "snip" }, r.snippet) : "",
      ext(gmailMsg(r.messageId), "Gmail で開く")))),
    unseen.length ? h("div", { class: "bar" }, h("button", { class: "btn sm tonal", onclick: () => seenReplies(x) }, "返信を確かめた")) : "");
}
function leadCard(x, dueSet) {
  const P = S.pipeline, r = (P.summary.rows || []).find((y) => y.id === x.id);
  const next = NEXT_STAGE[x.stage] || [], active = ["sent", "replied", "talking"].includes(x.stage);
  return h("article", { class: "card" + (x.stage === "lost" ? " dim" : "") + (r?.attention ? " att" : "") },
    h("div", { class: "card-h" }, h("h3", null, x.name), stageBadge(x.stage)),
    h("p", { class: "chips" }, chip(x.kind), chip(P.offers[x.offer] || x.offer),
      x.monthlyYen ? chip(`月 ${yen(x.monthlyYen)}`) : "",
      x.source === "weekly-analytics" && x.stage === "candidate" ? chip(`分析が追加(${jpDate(x.createdAt)})`) : "",
      x.nextAt && active ? chip(`次に連絡する日 ${jpDate(x.nextAt)}${dueSet.has(x.id) ? "(来ています)" : ""}`, dueSet.has(x.id) ? "due" : "") : ""),
    r ? kv(["状況", r.status], ["結果", r.result]) : "",
    replyBox(x),
    h("div", { class: "bar" },
      next.map(([st, label], i) => h("button", { class: "btn" + (i ? "" : " tonal"), onclick: () => moveLead(x, st) }, label)),
      active ? h("button", { class: "btn", onclick: () => moveLead(x, x.stage, true) }, "連絡する日を変える") : "",
      h("button", { class: "btn", onclick: () => editLead(x), "aria-label": `${x.name} を編集` }, "編集"),
      !["lost", "won"].includes(x.stage) ? h("button", { class: "btn quiet", onclick: () => moveLead(x, "lost") }, "見送り") : "",
      x.stage === "won" ? h("button", { class: "btn quiet", onclick: () => moveLead(x, "lost") }, "契約が終わった") : ""),
    billingBox(x),
    x.body ? h("details", { class: "more", open: x.stage === "candidate" ? true : null }, h("summary", null, "送る文案"),
      h("p", null, h("b", null, "件名: "), x.subject || ""),
      h("pre", { class: "draft" }, x.body),
      h("div", { class: "bar" },
        x.email ? h("button", { class: "btn sm tonal", onclick: () => composeLead(x) }, "Gmail の作成画面で開く") : "",
        h("button", { class: "btn sm", onclick: () => copyText(`${x.subject ? "件名: " + x.subject + "\n\n" : ""}${x.body}`, "文案をコピーしました") }, x.email ? "文案をコピー" : "文案をコピー(フォームに貼る)"),
        x.formUrl ? h("a", { class: "btn sm", href: x.formUrl, target: "_blank", rel: "noopener noreferrer" }, "フォームを開く") : ""),
      h("p", { class: "mut small" }, "送るのは運営者です。送ったら「送った」を押してください。")) : "",
    h("details", { class: "more", open: x.stage === "candidate" && !x.email && !x.formUrl && !x.phone ? true : null }, h("summary", null, "連絡先・メモ"),
      kv(["宛先・窓口", x.contact], ["メール", x.email], ["問い合わせフォーム", x.formUrl && ext(x.formUrl)], ["電話", x.phone],
        !x.email && !x.formUrl && !x.phone ? ["連絡先", h("span", { class: "warn-t" }, "未確認(「編集」で入れます)")] : null,
        ["出典", x.url && ext(x.url)], ["最初に送った日", x.sentAt && jpDate(x.sentAt)], ["契約した日", x.wonAt && jpDate(x.wonAt)], ["メモ", x.memo], ["管理番号", x.id])),
    x.log?.length ? h("details", { class: "more" }, h("summary", null, `記録(${x.log.length})`),
      h("ul", { class: "plan-rows" }, x.log.slice().reverse().map((l) => h("li", null, h("span", { class: "t" }, jpDate(l.date)), stageBadge(l.stage), h("span", { class: "mut small" }, l.note || ""))))) : "");
}

export function salesView() {
  const P = S.pipeline;
  if (!P) return [note("warn", "営業の台帳を読めませんでした。")];
  const sm = P.summary, leads = P.leads, wk = sm.week, mo = sm.month;
  const tgt = (t, v, unit) => (t ? `${v} / ${t.value}${unit}` : `${v}${unit}`);
  const tNote = (t) => (t && t.month !== mo.month ? h("small", { class: "mut" }, `目標は${monthLabel(t.month)}の分`) : "");
  const valid = ORDER.includes(view.salesSt);
  const cur = valid ? view.salesSt : sm.due.length || sm.count.sent + sm.count.replied + sm.count.talking ? "sent" : "candidate";
  // 「やりとり中」には、送信済み・返信あり・商談中をまとめる
  const inGroup = (x) => (cur === "sent" ? ["sent", "replied", "talking"].includes(x.stage) : x.stage === cur);
  const list = leads.filter(inGroup).sort((a, b) => (a.nextAt || "9").localeCompare(b.nextAt || "9") || a.id.localeCompare(b.id));
  const groups = [["candidate", "候補(まだ送っていない)", sm.count.candidate], ["sent", "やりとり中", sm.count.sent + sm.count.replied + sm.count.talking], ["won", "契約", sm.count.won], ["lost", "見送り", sm.count.lost]];
  const dueSet = new Set(sm.due.map((d) => d.id));
  const withUnseen = leads.filter((x) => unseenOf(x).length);
  return [
    h("p", { class: "lead" }, "協賛・有料プランの提案先とのやりとりを記録します。連絡は自分で行い、ここでは「送った」「返信があった」などを押して残します。"),
    h("div", { class: "stats" },
      h("div", { class: "stat" + (wk.short ? " ng" : "") }, h("span", { class: "stat-l" }, `今週の提案(${+wk.from.slice(5, 7)}/${+wk.from.slice(8, 10)}〜)`), h("b", null, wk.guide == null ? String(wk.count) : `${wk.count} / ${wk.guide}`), wk.short ? h("small", null, `1週の目安まで あと${wk.guide - wk.count}件`) : ""),
      h("div", { class: "stat" }, h("span", { class: "stat-l" }, "今月の提案"), h("b", null, tgt(mo.pitchTarget, mo.pitches, "件")), tNote(mo.pitchTarget)),
      h("div", { class: "stat" }, h("span", { class: "stat-l" }, "今月の契約"), h("b", null, tgt(mo.contractTarget, mo.contracts, "件")), tNote(mo.contractTarget)),
      h("div", { class: "stat" }, h("span", { class: "stat-l" }, "契約の月額の合計"), h("b", null, yen(sm.wonMonthlyYen)), h("small", { class: "mut" }, `返信率 ${sm.replyRate ? `${sm.replyRate.replied} / ${sm.replyRate.sent}件` : "—"}`))),
    withUnseen.length || sm.due.length ? h("section", { class: "card att", "aria-labelledby": "sales-now" }, h("h2", { id: "sales-now" }, "いま連絡すること"),
      withUnseen.length ? [h("h3", null, `新しい返信が届いています(${sm.unseen}件)`), h("ul", { class: "plan-rows" }, withUnseen.map((x) => { const last = x.replies.filter((r) => !r.auto).at(-1);
        return h("li", null, h("span", { class: "t" }, x.name), h("span", { class: "mut small" }, `${jpDate(last.date.slice(0, 10))} 「${last.subject || "(件名なし)"}」`),
          h("button", { class: "btn sm tonal", onclick: () => { view.salesSt = "sent"; render(); document.getElementById("leads-h")?.scrollIntoView({ block: "start" }); } }, "やりとり中を開く")); }))] : "",
      sm.due.length ? [h("h3", null, `連絡する日が来た相手(${sm.due.length}件)`), h("ul", { class: "plan-rows" }, sm.due.map((d) => { const x = leads.find((y) => y.id === d.id); return h("li", null, h("span", { class: "t" }, d.name), stageBadge(d.stage), h("span", { class: "mut small" }, d.late ? `${d.late}日過ぎ` : "今日"),
        (NEXT_STAGE[x.stage] || []).slice(0, 1).map(([st, label]) => h("button", { class: "btn sm tonal", onclick: () => moveLead(x, st) }, label)),
        h("button", { class: "btn sm", onclick: () => moveLead(x, x.stage, true) }, "日を延ばす")); }))] : "") : "",
    billingPanel(),
    h("div", { class: "toolbar" }, h("h2", { id: "leads-h" }, "相手の一覧"), h("button", { class: "btn primary", onclick: () => editLead(null) }, icon("plus"), "相手を追加")),
    seg("段階で切り替える", groups, cur, (st) => { view.salesSt = st; render(); }),
    list.length ? list.map((x) => leadCard(x, dueSet)) : empty("この段階の相手はいません", cur === "candidate" ? "「相手を追加」から入れられます。毎週月曜の分析も、候補を足します。" : ""),
    (sm.rows || []).length ? more(`全員の状況と結果を、表で見る(${sm.rows.length}件)`,
      h("div", { class: "scroll" }, h("table", { class: "leadsum" },
        h("thead", null, h("tr", null, ["相手", "段階", "状況", "結果"].map((c) => h("th", { scope: "col" }, c)))),
        h("tbody", null, sm.rows.slice().sort((a, b) => ORDER.indexOf(a.stage) - ORDER.indexOf(b.stage) || a.id.localeCompare(b.id)).map((r) =>
          h("tr", { class: (r.attention ? "att" : "") + (r.stage === "lost" ? " dim" : "") }, h("td", null, r.name), h("td", null, stageBadge(r.stage)), h("td", null, r.status), h("td", null, r.result)))))),
      h("p", { class: "mut small" }, "色が付いた行は、新しい返信があるか、連絡する日が来た相手です。")) : "",
    more("営業の記録について", h("p", { class: "mut" }, "台帳は、このPCにだけ保存し、GitHub には送りません。提案した数・契約数は、「目標・収益」の目標の数字に自動で入ります(手で入れた数があれば、そちらを優先)。1週の目安は、提案の月の目標を週に割ったものです。"),
      h("p", { class: "mut" }, "返信は、メールを読み込むときに、台帳のメールアドレス(独自ドメインなら同じドメイン)から届いたメールを探して記録します。自動返信は「返信あり」に数えません。個人の Gmail から返信が来た場合は見つけられないので、手で「返信があった」を押してください。"),
      h("p", { class: "mut" }, "毎週月曜の分析も、この台帳を読んで、提案のペースと連絡の漏れを報告します。")),
  ];
}
