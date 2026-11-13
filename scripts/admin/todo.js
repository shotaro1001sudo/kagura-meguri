// やること: 人が決めること・対応することを、全部のメニューから集めて、上から順に並べる(最初に開く画面)。
// ここで決められるもの: 保留の開催(掲載・却下)、Claude に頼むこと、振り返りで自分が行うこと、検索・計測の改善案。
// ほかのメニューで行うもの(受信箱・営業・目標・収益・動いているか)は、件数と行き先を出す
import { h, S, view, render, call, toast, undoToast, fail, askReason, badge, chip, count, more, allClear, kv, icon, ext, jpDate, when, addMonth, curMonth, monthLabel, goLink, copyPrompt, promptBox, inboxOpen, loading } from "./ui.js";
import { ended, openEditor, rejectEvent, staleEvents } from "./events.js";
import { planOpen } from "./goal.js";
import { salesTodos } from "./sales.js";
import { overview, sigMark } from "./dash.js";

// ---------- 決めること(保留・振り返り・改善案・Claude に頼むこと) ----------
export function decisions() {
  const pending = S.events.filter((e) => e.status === "pending").sort((a, b) => a.start.localeCompare(b.start));
  const done = new Set(S.committedIds || []); // 作業の記録(コミット)に管理番号が書かれたもの = 実施済み
  const proposals = S.proposals || [];
  const openProps = proposals.filter((p) => p.status === "proposed" && !done.has(p.id));
  const actions = S.review?.actions || [];
  const advice = S.advice || [];
  const openAdv = advice.filter((a) => a.status === "proposed" && !done.has(a.id));
  // 週次の振り返りの【Claude】の項目(頼まれるまで進まないので、「Claude に頼む」のいちばん上に、頼む文つきで出す)
  // 振り返りの Issue でチェックを付けた項目は、サーバーが外して、済みとして別に渡す
  const claudeActs = S.review?.claude || [];
  const reviewDone = [...(S.review?.done?.claude || []).map((a) => ({ ...a, owner: "Claude" })), ...(S.review?.done?.actions || []).map((a) => ({ ...a, owner: "人" }))];
  return { upcoming: pending.filter((e) => !ended(e)), past: pending.filter(ended), actions, claudeActs, reviewDone, proposals, openProps, advice, openAdv, done };
}

// ---------- 頼む文(Claude に頼むときの文。管理者用ページは、出してコピーするだけ) ----------
export function promptFor(kind, x) {
  if (kind === "advice") return `${x.ask || x.title}
(助言の ID: ${x.id}。${x.detail ? `内容: ${x.detail}。` : ""}${x.why ? `理由: ${x.why}` : ""})
ファイルを変えるときは、コミットのメッセージに ${x.id} を入れてください。`;
  if (kind === "proposal" && x.kind === "measure") return `計測の改善案 ${x.id} を実施してください。
計測したいこと: ${x.target || ""}
変える内容: ${x.change || ""}
分かるようになること: ${x.why || ""}
個人を特定できる情報は送らず、同意(Cookie)の設定とプライバシーポリシーの範囲で計測してください。範囲を超えるなら、先に相談してください。
Google 側(Apps Script・GA4 の管理画面)の作業が要るなら、手順を書いてください。
コミットのメッセージに ${x.id} を入れてください。`;
  if (kind === "proposal") return `検索の改善案 ${x.id} を実施してください。
対象: ${x.target || ""}
変える内容: ${x.change || ""}
コミットのメッセージに ${x.id} を入れてください。`;
  return `${x.ask || `収益化の案「${x.title}」を進めてください。`}
(案の ID: ${x.id}。概要: ${x.summary || ""}。最初の一歩: ${x.firstStep || ""}。気をつけること: ${x.risk || ""})
コミットのメッセージに ${x.id} を入れてください。`;
}
const copyBtn = (text) => h("button", { class: "btn tonal", onclick: () => copyPrompt(text) }, icon("copy"), "頼む文をコピー");

async function setAdvice(a, status, quiet) {
  let note = "";
  if (status === "declined") { note = await askReason(a.title); if (note === null) return; }
  const before = a.status;
  try {
    await call("/api/advice/update", { id: a.id, status, note });
    const msg = { done: "済みにしました", declined: "見送りにしました", proposed: "「まだ決めていない」に戻しました" }[status];
    if (quiet || status === "proposed") toast(msg); else undoToast(msg, () => setAdvice({ ...a, status }, before, true));
    render();
  } catch (err) { fail(err); }
}
async function setProposal(p, status, quiet) {
  let note = "";
  if (status === "declined") { note = await askReason(`${p.kind === "measure" ? "計測" : "検索"}の改善案: ${p.target || p.id}`); if (note === null) return; }
  try {
    await call("/api/proposals/update", { id: p.id, status, note });
    if (status === "declined" && !quiet) undoToast("見送りにしました", () => setProposal(p, "proposed", true)); else toast(status === "declined" ? "見送りにしました" : "「まだ決めていない」に戻しました");
    render();
  } catch (err) { fail(err); }
}

// ---------- カード ----------
const pendCard = (e, past) => h("article", { class: "card" },
  h("div", { class: "card-h" }, h("h3", null, e.name), badge(past ? "mut" : "info", past ? "開催日が過ぎた保留" : "保留")),
  h("p", { class: "mut" }, `${when(e)} ・ ${e.prefecture}${e.city || ""} ${e.venue || "(会場が未確認)"}${e.kagura ? " ・ " + e.kagura : " ・ 神楽の種類が空"}`),
  (e.holdReasons || []).length ? h("ul", { class: "reasons" }, e.holdReasons.map((r) => h("li", null, r))) : h("p", { class: "mut small" }, "保留になった理由の記録はありません。"),
  h("div", { class: "bar" },
    past ? "" : h("button", { class: "btn tonal", onclick: () => openEditor({ ...e, checked: S.today }, null, { approve: true }) }, "内容を確かめて掲載する"),
    h("button", { class: "btn", onclick: () => rejectEvent(e) }, past ? "却下して片付ける" : "却下する"),
    e.url ? ext(e.url, "公式情報を開く") : h("span", { class: "mut small" }, "公式情報の URL なし"),
    e.sourceUrl && e.sourceUrl !== e.url ? ext(e.sourceUrl, `取得元(${e.source || "収集元"})`) : ""));

function adviceCard(a, d, closed) {
  const doneByLog = d.done.has(a.id) && a.status === "proposed";
  return h("article", { class: "card" + (a.status === "declined" ? " dim" : "") },
    h("div", { class: "card-h" }, h("h3", null, a.title), chip(S.adviceKinds?.[a.kind] || a.kind),
      closed ? badge(a.status === "declined" ? "mut" : "ok", doneByLog ? "実施済み(作業の記録あり)" : S.adviceStatus?.[a.status] || a.status) : ""),
    a.detail ? h("p", null, a.detail) : "",
    closed ? "" : h("div", { class: "bar" }, copyBtn(promptFor("advice", a)),
      h("button", { class: "btn", onclick: () => setAdvice(a, "done") }, "済みにする"),
      h("button", { class: "btn quiet", onclick: () => setAdvice(a, "declined") }, "見送る")),
    more("詳しく", kv(["理由", a.why], ["管理番号", `${a.id}${a.date ? `(${jpDate(a.date)})` : ""}`], ["済みにした日", a.doneAt && jpDate(a.doneAt)],
      ["見送り", a.declinedAt && `${jpDate(a.declinedAt)}${a.declineNote ? " ・ " + a.declineNote : ""}`]), closed ? "" : promptBox(promptFor("advice", a))),
    closed ? h("div", { class: "bar" }, h("button", { class: "btn sm", onclick: () => setAdvice(a, "proposed") }, "「まだ決めていない」に戻す")) : "");
}
function proposalCard(p, d, closed) {
  const measure = p.kind === "measure", doneByLog = p.status === "proposed" && d.done.has(p.id);
  return h("article", { class: "card" + (p.status === "declined" ? " dim" : "") },
    h("div", { class: "card-h" }, h("h3", null, p.target || p.id), chip(measure ? "計測" : "検索"),
      closed ? badge(p.status === "declined" ? "mut" : "ok", doneByLog ? "実施済み(作業の記録あり)" : S.proposalStatus[p.status] || p.status) : ""),
    kv(["変える内容", p.change], [measure ? "分かるようになること" : "理由", p.why], ["効果", p.result && (typeof p.result === "string" ? p.result : JSON.stringify(p.result))],
      ["見送り", p.declinedAt && `${p.declinedAt}${p.declineNote ? " ・ " + p.declineNote : ""}`]),
    closed ? (p.status === "declined" ? h("div", { class: "bar" }, h("button", { class: "btn sm", onclick: () => setProposal(p, "proposed") }, "見送りを戻す")) : "")
      : h("div", { class: "bar" }, copyBtn(promptFor("proposal", p)), h("button", { class: "btn quiet", onclick: () => setProposal(p, "declined") }, "見送る")),
    more("詳しく", kv(["管理番号", p.id], ["作業する人", p.owner]), closed ? "" : promptBox(promptFor("proposal", p))));
}
// ほかのメニューで行うもの: 件数と行き先だけを出す
const linkRows = (rows) => h("ul", { class: "linkrows" }, rows.filter((r) => r.n).map((r) =>
  h("li", null, h("a", { href: "#/" + r.go[0], onclick: goLink(...r.go) }, h("span", { class: "lr-n" }, r.nText || `${r.n}件`), h("span", { class: "lr-t" }, r.label, r.note ? h("small", null, r.note) : ""), icon("chev")))));

// ---------- やることのまとまり(件数のあるものだけを、上から順に出す) ----------
export function todoGroups() {
  const d = decisions(), plan = planOpen();
  const prevMonth = S.plan ? addMonth(curMonth(), -1) : null;
  const manualMissing = !!S.plan && prevMonth >= (S.plan.goal?.setAt || "").slice(0, 7) && ["rakuten", "adsense", "direct"].some((k) => S.plan.manual?.[prevMonth]?.[k] == null && !(k === "rakuten" && S.plan.actuals?.months?.[prevMonth]?.revenueRakuten != null));
  const E = S.earnings, earnBad = E ? (E.vc.ready && E.vc.error && (!E.vc.fetchedAt || E.vc.errorAt >= E.vc.fetchedAt) ? 1 : 0) + (E.rakuten.problem ? 1 : 0) : 0;
  const tasksBad = S.tasks?.attention || S.tasks?.missed || 0;
  const sales = salesTodos();
  const closedAdv = d.advice.filter((a) => !d.openAdv.includes(a)), closedProps = d.proposals.filter((p) => !d.openProps.includes(p));
  const actLinks = { "collect-stale": [`${S.repo}/actions/workflows/collect.yml`, "週次の自動収集の実行記録"], "collect-errors": [`${S.repo}/issues?q=is%3Aopen+週次の自動収集`, "週次の自動収集の連絡(GitHub)"],
    "social-missed": ["https://publish.buffer.com/", "Buffer の予約"], "social-metrics-unavailable": ["https://publish.buffer.com/settings/api", "Buffer の API キー"] };
  // 週次の振り返りの【Claude】の項目を、まとめて1枚に(片付くと、次の週の振り返りから消える)
  const reviewAsk = `週次の振り返り(${S.review?.updated || ""})の Claude の項目をやってください。
${d.claudeActs.map((a) => `- ${a.text}`).join("\n")}
公式の情報で確かめられたことだけを直し、終わったら、振り返りの Issue の該当の項目にチェックを付けてください。`;
  const reviewCard = !d.claudeActs.length ? "" : h("article", { class: "card" },
    h("div", { class: "card-h" }, h("h3", null, `週次の振り返りの Claude の項目(${d.claudeActs.length}件)`), chip("振り返り"), badge("info", "頼むと進む")),
    h("ul", { class: "reasons" }, d.claudeActs.map((a) => h("li", null, a.text, a.weeks > 1 ? `(${a.weeks} 週つづいています)` : ""))),
    h("div", { class: "bar" }, copyBtn(reviewAsk), S.review?.issueUrl ? ext(S.review.issueUrl, "振り返りの Issue を開く") : ""),
    h("p", { class: "mut small" }, S.review?.issueRead === false ? "振り返りの Issue のチェックを読めませんでした(gh を確かめてください)。" : "終わった項目は、振り返りの Issue でチェックを付けると、ここから消えます(反映は数分以内。すぐ見るときは「最新にする」)。"),
    promptBox(reviewAsk));
  return [
    { id: "ops", title: "止まっているものを確かめる", n: tasksBad, lead: "決まった時刻に動くはずの作業に、動いていないものがあります。",
      body: () => linkRows([{ n: tasksBad, label: "確かめたい予定タスク", note: "PC の Claude アプリが、決まった時刻に動かす作業です", go: ["status"] }]) },
    { id: "held", title: "保留中の開催を決める", n: d.upcoming.length + d.past.length, clear: "保留中の開催はありません。",
      lead: "自動で集めた開催のうち、自動の検査に通らなかったものです。公式情報で日時・会場を確かめて、「掲載」か「却下」を選びます。",
      body: () => [d.upcoming.map((e) => pendCard(e, false)),
        d.past.length ? h("details", { class: "more", open: d.upcoming.length ? null : true }, h("summary", null, `開催日が過ぎた保留(${d.past.length}件)`), h("p", { class: "mut small" }, "サイトには載っていません。却下すると、一覧から片付きます。"), d.past.map((e) => pendCard(e, true))) : ""] },
    { id: "inbox", title: "申請・問い合わせに対応する", n: inboxOpen("submit") + inboxOpen("contact"), clear: "未対応の申請・問い合わせはありません。", lead: "フォームから届いたものです。「受信箱」で対応します。",
      body: () => linkRows([{ n: inboxOpen("submit"), label: "未対応の掲載の申請", go: ["inbox", { box: "submit", sub: "open" }] }, { n: inboxOpen("contact"), label: "未対応・対応中の問い合わせ", go: ["inbox", { box: "contact", con: "open" }] }]) },
    { id: "sales", title: "営業の相手に連絡する", n: sales.reduce((a, r) => a + (r.count ?? r.n), 0), clear: S.pipeline ? "営業で、いま連絡することはありません。" : null, lead: "協賛・有料プランの提案先とのやりとりです。「営業」で行います。",
      body: () => linkRows(sales) },
    { id: "claude", title: "Claude に頼む", n: d.openAdv.length + (d.claudeActs.length ? 1 : 0), clear: "いま Claude に頼めることはありません。",
      lead: "Claude が進められる作業です。やるものは「頼む文をコピー」を押して、Claude に貼り付けます。終わったら「済みにする」、やらないものは「見送る」。",
      help: "毎週月曜の分析が、営業の候補・文案、掲載の穴、目標の見直し、記事の題材などを、週に5件まで出します。見送ると、同じ助言は出なくなります。この記録はこのPCだけに残ります。",
      body: () => [reviewCard, d.openAdv.map((a) => adviceCard(a, d, false))] },
    { id: "review", title: "振り返りで、自分が行うこと", n: d.actions.length, clear: S.review ? "振り返りで、自分が行う項目はありません。" : null, missing: S.review ? null : "週次の振り返りのデータが、まだありません。",
      lead: "毎週月曜の振り返りで出た、人が行う項目です。リンク先で確かめ、終えたら、GitHub の振り返りのページでチェックを入れます(チェックを入れると、ここから消えます)。",
      body: () => [h("ul", { class: "acts card" }, d.actions.map((a) => h("li", null, a.text, actLinks[a.key] && S.repo ? [" ", ext(...actLinks[a.key])] : ""))),
        S.repo ? h("p", { class: "small" }, ext(`${S.repo}/issues?q=is%3Aopen+週次の振り返り`, "振り返りのページ(GitHub)を開く")) : ""] },
    { id: "props", title: "検索・計測の改善案を決める", n: d.openProps.length, clear: d.proposals.length ? "決めていない改善案はありません。" : null, missing: d.proposals.length ? null : "検索・アクセスの分析が、まだこのPCにありません(毎週月曜 9:00 の分析が作ります)。",
      lead: "検索で見つけてもらいやすくする案と、数字を測れるようにする案です。やるものは「頼む文をコピー」を押して、Claude に貼り付けます。やらないものは「見送る」。",
      help: "毎週月曜の分析が出します。Claude が作業を終えると「実施済み(作業の記録あり)」になり、効果は翌週からの分析が確かめます。見送ると、同じ案は出なくなります。この記録はこのPCだけに残ります。",
      body: () => d.openProps.map((p) => proposalCard(p, d, false)) },
    { id: "goal", title: "目標・収益を決める", n: plan.length + (manualMissing ? 1 : 0) + earnBad, clear: S.plan ? "目標・収益で、いま決めることはありません。" : null, lead: "「目標・収益」で行います。",
      body: () => linkRows([{ n: plan.filter((x) => x.kind === "mon").length, label: "決めていない収益化の案", note: "採用するか、見送るかを選びます", go: ["goal", { goalSec: "mon", monSt: "proposed" }] },
        { n: plan.filter((x) => x.kind === "kpi").length, label: "決めていない目標の数字", note: "採用するか、見送るかを選びます", go: ["goal", { goalSec: "kpi", kpiSt: "proposed" }] },
        { n: manualMissing ? 1 : 0, label: `${prevMonth ? monthLabel(prevMonth) : ""}の実績が未入力`, note: "AdSense・協賛の額を入れます(楽天は自動)", go: ["goal", { goalSec: "manual", manualMonth: prevMonth }] },
        { n: earnBad, label: "広告の報酬を読み込めていません", note: E?.rakuten.problem ? "楽天は、Chrome で楽天アフィリエイトにログインすると、次の回に読み込みます" : "バリューコマースのキーを確かめます", go: ["settings"] }]) },
  ].map((g) => ({ ...g, closed: g.id === "claude" ? closedAdv : g.id === "props" ? closedProps : [] }));
}
export const todoCount = () => todoGroups().reduce((a, g) => a + g.n, 0);

// 上の3つの信号: サイト・自動の仕組み・サイトへの反映。くわしくは「動いているか」
function signalTiles() {
  const O = overview();
  const unpub = !!(S.pending && (S.pending.uncommitted || S.pending.unpushed));
  const worst = (list) => ["stop", "warn", "unknown", "ok"].find((k) => list.some((x) => x.state === k)) || "ok";
  const t = (label, state, text) => h("a", { class: "sigtile s-" + state, href: "#/status", onclick: goLink("status") }, h("span", { class: "st-l" }, label), sigMark(state), h("span", { class: "st-t" }, text));
  let site, auto;
  if (!O) site = auto = view.ovError ? ["unknown", "確かめられませんでした"] : null;
  else {
    const sg = O.ops.signals, a = sg.filter((x) => ["site", "deploy"].includes(x.id)), b = sg.filter((x) => !["site", "deploy", "pending"].includes(x.id));
    const text = (list, okText) => { const w = worst(list); return [w, w === "ok" ? okText : list.filter((x) => x.state === w).map((x) => x.label).join("・")]; };
    site = text(a, "表示も公開も、正常です"); auto = text(b, "すべて予定どおりです");
  }
  const wait = (label) => h("div", { class: "sigtile s-unknown" }, h("span", { class: "st-l" }, label), loading("確かめています…"));
  return h("div", { class: "sigtiles", "aria-label": "いまの状況" },
    site ? t("サイト", ...site) : wait("サイト"),
    auto ? t("自動の仕組み", ...auto) : wait("自動の仕組み"),
    t("サイトへの反映", unpub ? "warn" : "ok", unpub ? "まだ送っていない変更があります" : "すべて反映済みです"));
}

export function todoView() {
  const d = decisions();
  const groups = todoGroups(), open = groups.filter((g) => g.n), rest = groups.filter((g) => !g.n);
  const total = open.reduce((a, g) => a + g.n, 0);
  const stale = staleEvents().length;
  const closed = groups.filter((g) => g.closed.length);
  const closedN = closed.reduce((a, g) => a + g.closed.length, 0) + d.reviewDone.length;
  return [
    signalTiles(),
    total ? h("p", { class: "hero" }, h("b", null, `やることが ${total} 件あります。`), "上から順に進めてください。")
      : h("div", { class: "empty big" }, icon("check"), h("p", { class: "empty-t" }, "いま、やることはありません"), h("p", { class: "mut" }, "新しいものが出ると、ここに並びます。毎週月曜の朝に、まとめて増えます。")),
    open.map((g, i) => h("section", { class: "todo", "aria-labelledby": "todo-" + g.id },
      h("div", { class: "todo-h" }, h("span", { class: "step", "aria-hidden": "true" }, String(i + 1)), h("h2", { id: "todo-" + g.id }, g.title), count(g.n)),
      g.lead ? h("p", { class: "lead" }, g.lead) : "",
      g.help ? more("この項目について", h("p", { class: "mut" }, g.help)) : "",
      g.body())),
    stale ? h("section", { class: "todo soft", "aria-labelledby": "todo-soft" }, h("div", { class: "todo-h" }, h("h2", { id: "todo-soft" }, "余裕があるときに")),
      linkRows([{ n: stale, label: "確認日から60日を過ぎた開催", note: "公式情報で、変更がないかを確かめ直します", go: ["events", { evFilter: "stale" }] }])) : "",
    rest.length && total ? h("section", { class: "todo done", "aria-label": "いま決めることがないもの" }, rest.map((g) => g.missing ? h("p", { class: "mut small" }, g.missing) : g.clear ? allClear(g.clear) : "")) : "",
    closedN ? h("section", { class: "todo done" }, h("details", { class: "more" }, h("summary", null, `済み・見送りにしたもの(${closedN}件)`),
      h("p", { class: "mut small" }, "見送ったものは、ここから戻せます。"),
      d.reviewDone.length ? h("article", { class: "card" }, h("div", { class: "card-h" }, h("h3", null, `週次の振り返り(${S.review?.updated || ""})で、チェックを付けた項目`), badge("ok", "済み")),
        h("ul", { class: "reasons" }, d.reviewDone.map((a) => h("li", null, `【${a.owner}】${a.text}`))),
        S.review?.issueUrl ? h("p", { class: "small" }, ext(S.review.issueUrl, "振り返りの Issue を開く")) : "") : "",
      closed.map((g) => g.id === "claude" ? g.closed.map((a) => adviceCard(a, d, true)) : g.closed.map((p) => proposalCard(p, d, true))))) : "",
  ];
}
