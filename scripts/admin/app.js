// 管理者用ページの画面。受け取ったデータは、すべて文字として表示する(HTML として解釈しない)
"use strict";
const TOKEN = document.querySelector('meta[name="admin-token"]').content;
let S = null; // サーバーから受け取った状態
const view = { tab: "home", evFilter: "upcoming", evQuery: "", sub: "open", con: "open", selSubmit: null, selContact: null };

// ---------- 小さな道具 ----------
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}
const $ = (s) => document.querySelector(s);
const main = $("#main");
function toast(msg, bad) { const t = $("#toast"); t.textContent = msg; t.className = "toast on" + (bad ? " bad" : ""); clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = "toast" + (bad ? " bad" : "")), bad ? 7000 : 3500); }

async function call(path, body) {
  const r = await fetch(path, { method: body ? "POST" : "GET", headers: { "x-admin-token": TOKEN, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({ error: "応答を読めませんでした" }));
  if (!r.ok) { const e = new Error(j.error || `エラー ${r.status}`); e.fields = j.fields; throw e; }
  if (j.state) S = j.state;
  return j;
}

const WD = "日月火水木金土";
const jpDate = (d) => { if (!d) return ""; const x = new Date(d.slice(0, 10) + "T00:00:00Z"); return `${d.slice(0, 4)}/${+d.slice(5, 7)}/${+d.slice(8, 10)}(${WD[x.getUTCDay()]})`; };
const when = (e) => `${jpDate(e.start)}${e.timeUnknown ? "" : " " + e.start.slice(11, 16)}${e.end ? "〜" + (e.end.slice(0, 10) === e.start.slice(0, 10) ? "" : jpDate(e.end) + " ") + e.end.slice(11, 16) : ""}`;
const recv = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const nowJst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16);
// サイトと同じ考え方: 終了時刻がなければ、開始から3時間(時刻未定は、その日いっぱい)を開催中とみなす
function ended(e) {
  if (e.end) return e.end < nowJst();
  if (e.timeUnknown) return e.start.slice(0, 10) < S.today;
  const t = new Date(e.start + ":00Z").getTime() + 3 * 3600e3;
  return new Date(t).toISOString().slice(0, 16) < nowJst();
}
function evState(e) {
  if (e.status === "withdrawn") return ["withdrawn", "取り下げ"];
  if (e.status !== "published") return ["pending", "確認待ち"];
  return ended(e) ? ["ended", "終了"] : ["published", "掲載中"];
}
const daysSince = (d) => Math.round((new Date(S.today) - new Date(d)) / 864e5);
const badge = (cls, text) => h("span", { class: `badge b-${cls}` }, text);
const pageUrl = (id) => `${S.baseUrl}/events/${id}.html`;
const ext = (href, text) => (/^https:\/\//.test(href || "") ? h("a", { href, target: "_blank", rel: "noopener noreferrer" }, text || href) : text || href || "");
const isOpen = (x) => x.status === "new" || x.status === "doing";

// ---------- 描画 ----------
function render() {
  document.querySelectorAll("#tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === view.tab)));
  const open = (k) => S.inbox.filter((x) => x.kind === k && isOpen(x)).length;
  $("#n-submit").textContent = open("submit") || ""; $("#n-contact").textContent = open("contact") || "";
  $("#n-decide").textContent = decisions().total || "";
  $("#n-goal").textContent = planOpen().length || "";
  $("#n-tasks").textContent = S.tasks?.attention || S.tasks?.missed || "";
  $("#n-sales").textContent = S.pipeline?.summary.due.length || "";
  main.replaceChildren(...({ home: homeView, decide: decideView, goal: goalView, sales: salesView, tasks: tasksView, events: eventsView, submit: () => inboxView("submit"), contact: () => inboxView("contact") }[view.tab])().flat(Infinity).filter((x) => x != null && x !== ""));
}

// ---------- 判断待ち(人が決めること) ----------
// 1. 自動収集の保留(掲載 / 却下) 2. 週次の振り返りの【人】の項目 3. 検索の改善案(Claude に頼む / 見送る)
// 目標・KPI・収益化の案は「目標・収益」のタブで決める(件数は、そのタブに出す。二重に数えない)
function decisions() {
  const pending = S.events.filter((e) => e.status === "pending").sort((a, b) => a.start.localeCompare(b.start));
  const done = new Set(S.committedIds || []);
  const proposals = S.proposals || [];
  const openProps = proposals.filter((p) => p.status === "proposed" && !done.has(p.id));
  const actions = S.review?.actions || [];
  const plan = planOpen();
  return { upcoming: pending.filter((e) => !ended(e)), past: pending.filter(ended), actions, proposals, openProps, done, plan, total: pending.length + actions.length + openProps.length };
}
const goTab = (tab, extra) => (ev) => { ev.preventDefault(); Object.assign(view, { tab }, extra || {}); render(); main.focus(); window.scrollTo(0, 0); };
// 見出し(件数つき)と、ひとことの説明。長い説明は「詳しく」に畳む
const secHead = (title, n, lead, more) => [
  h("h3", { class: "sec-h" }, title, n == null ? "" : h("span", { class: "pill" + (n ? "" : " zero") }, String(n))),
  lead ? h("p", { class: "lead" }, lead) : "",
  more ? h("details", { class: "more" }, h("summary", null, "詳しい説明"), h("p", { class: "mut" }, more)) : "",
];
const allClear = (text) => h("p", { class: "clear" }, "✓ ", text);

function decideView() {
  const d = decisions();
  const pendCard = (e, past) => h("section", { class: "panel decision" },
    h("div", { class: "card-h" }, h("h4", null, e.name), badge("pending", past ? "開催日が過ぎた保留" : "保留")),
    h("p", { class: "mut" }, `${when(e)} ・ ${e.prefecture}${e.city || ""} ${e.venue || "(会場未確認)"}${e.kagura ? " ・ " + e.kagura : " ・ 神楽の種類が空"}`),
    (e.holdReasons || []).length ? h("ul", { class: "reasons" }, e.holdReasons.map((r) => h("li", null, r))) : h("p", { class: "mut" }, "保留の理由の記録はありません。"),
    h("p", { class: "links" }, e.url ? ext(e.url, "公式情報を開く") : h("span", { class: "mut" }, "公式情報のURLなし"), e.sourceUrl && e.sourceUrl !== e.url ? [" ・ ", ext(e.sourceUrl, `取得元(${e.source || "収集元"})`)] : ""),
    h("div", { class: "bar" },
      past ? "" : h("button", { class: "btn", onclick: () => openEditor({ ...e, checked: S.today }, null, { approve: true }) }, "内容を確かめて掲載する"),
      h("button", { class: "btn ghost", onclick: () => rejectEvent(e) }, past ? "却下して片付ける" : "却下する")));
  const link = (href, text) => (href ? ext(href, text) : "");
  const actLinks = { "collect-stale": [`${S.repo}/actions/workflows/collect.yml`, "週次の自動収集の実行記録"], "collect-errors": [`${S.repo}/issues?q=is%3Aopen+週次の自動収集`, "週次の自動収集の Issue"],
    "social-missed": ["https://publish.buffer.com/", "Buffer の予約"], "social-metrics-unavailable": ["https://publish.buffer.com/settings/api", "Buffer の API キー"] };
  const prop = (p, closed) => h("section", { class: "panel decision" },
    h("div", { class: "card-h" }, h("h4", null, p.id), badge(p.status === "declined" ? "rejected" : p.status === "proposed" ? (d.done.has(p.id) ? "doing" : "new") : "published", p.status === "proposed" && d.done.has(p.id) ? "実施(コミットあり)" : S.proposalStatus[p.status] || p.status)),
    h("dl", { class: "kv" }, h("dt", null, "対象"), h("dd", null, p.target || ""), h("dt", null, "変える内容"), h("dd", null, p.change || ""),
      p.result ? [h("dt", null, "効果"), h("dd", null, typeof p.result === "string" ? p.result : JSON.stringify(p.result))] : "",
      p.declinedAt ? [h("dt", null, "見送り"), h("dd", null, `${p.declinedAt}${p.declineNote ? " ・ " + p.declineNote : ""}`)] : ""),
    closed ? "" : promptBox(promptFor("proposal", p)),
    closed ? (p.status === "declined" ? h("div", { class: "bar mt" }, h("button", { class: "btn ghost small", onclick: () => setProposal(p, "proposed") }, "見送りを戻す")) : "")
      : h("div", { class: "bar mt" },
        h("button", { class: "btn", onclick: () => copyPrompt(promptFor("proposal", p)) }, "プロンプトをコピー"),
        h("button", { class: "btn ghost", onclick: () => setProposal(p, "declined") }, "見送る")));
  const closedProps = d.proposals.filter((p) => !d.openProps.includes(p));

  const groups = [
    { n: d.upcoming.length, body: () => [
      ...secHead("保留中の開催", d.upcoming.length, "公式情報で日時・会場を確かめて、「掲載」か「却下」を選びます。どちらも、すぐにサイトに反映します。",
        "週次の自動収集で、自動の検査に通らなかった開催です。却下したものは data/rejected.json に記録され、自動収集で取り直しません。"),
      d.upcoming.length ? d.upcoming.map((e) => pendCard(e, false)) : allClear("保留中の開催はありません。"),
      d.past.length ? h("details", { class: "mt" }, h("summary", null, `開催日が過ぎた保留(${d.past.length}件)`), h("p", { class: "mut" }, "サイトには載っていません。却下すると、一覧から片付きます。"), d.past.map((e) => pendCard(e, true))) : ""] },
    { n: d.actions.length, body: () => [
      ...secHead("振り返りで、人が行うこと", d.actions.length, "確認先のリンクから確かめ、終えたら振り返りの Issue にチェックを入れます。",
        `${S.review?.updated || ""} の週次の振り返り(GitHub の Issue)の【人】の項目です。このPCの画面と GitHub の両方を見なくて済むように、ここにも出しています。`),
      !S.review ? h("p", { class: "mut" }, "週次の振り返りのデータ(data/weekly-review.json)がありません。")
        : d.actions.length ? [h("ul", { class: "acts panel" }, d.actions.map((a) => h("li", null, a.text, actLinks[a.key] && S.repo ? [" ", link(...actLinks[a.key])] : ""))),
            S.repo ? h("p", { class: "links" }, link(`${S.repo}/issues?q=is%3Aopen+週次の振り返り`, "振り返りの Issue を開く")) : ""]
        : allClear("人が行う項目はありません。")] },
    { n: d.openProps.length, body: () => [
      ...secHead("検索の改善案", d.openProps.length, "やるものは、プロンプト案をコピーして Claude に貼り付けます。やらないものは「見送る」。",
        "毎週月曜の分析(このPCの analytics/)が出した案です。コミットに ID が入ると「実施(コミットあり)」になり、効果は翌週以降の分析が判定します。見送ると、次の週から同じ案が出なくなります。この記録はこのPCだけに残り、GitHub には送りません。"),
      !d.proposals.length ? h("p", { class: "mut" }, "このPCに、検索・アクセスの分析(analytics/state.json)がありません。毎週月曜 9:00 の分析タスクが作ります。")
        : [d.openProps.length ? d.openProps.map((p) => prop(p, false)) : allClear("決めていない改善案はありません。"),
          closedProps.length ? h("details", { class: "mt" }, h("summary", null, `実施・見送りの済んだ案(${closedProps.length}件)`), closedProps.map((p) => prop(p, true))) : ""]] },
  ];
  // 決めることがあるものを上に。済んだものは、下に1行ずつ
  const open = groups.filter((g) => g.n), cleared = groups.filter((g) => !g.n);
  return [
    h("h2", null, "判断待ち"),
    d.total ? h("p", { class: "lead" }, `決めることが ${d.total} 件あります。上から順に進めてください。`) : allClear("いま決めることはありません。"),
    open.map((g) => h("div", { class: "group" }, g.body())),
    d.plan.length ? h("p", { class: "callout bar" }, h("span", null, `目標・収益にも、決めていない KPI・収益化の案が ${d.plan.length} 件あります。`), h("a", { href: "#", class: "btn ghost small", onclick: goTab("goal") }, "目標・収益を開く")) : "",
    cleared.length ? h("div", { class: "group cleared" }, cleared.map((g) => h("div", null, g.body()))) : "",
  ];
}

async function rejectEvent(e) {
  if (!confirm(`「${e.name}」(${when(e)})を却下します。\n開催データから外し、週次の自動収集でも取り直しません(サイトには、もともと載っていません)。よろしいですか？`)) return;
  toast("保存して公開しています…(数十秒かかることがあります)");
  try { const r = await call("/api/events/reject", { id: e.id }); published(r, "却下しました"); render(); }
  catch (err) { toast(err.message, true); }
}
// ---------- プロンプト案(Claude に頼むときの文。管理者用ページは提示とコピーだけ) ----------
function promptFor(kind, x) {
  if (kind === "proposal") return `検索の改善案 ${x.id} を実施してください。
対象: ${x.target || ""}
変える内容: ${x.change || ""}
コミットのメッセージに ${x.id} を入れてください。`;
  return `${x.ask || `収益化の案「${x.title}」を進めてください。`}
(案の ID: ${x.id}。概要: ${x.summary || ""}。最初の一歩: ${x.firstStep || ""}。気をつけること: ${x.risk || ""})
コミットのメッセージに ${x.id} を入れてください。`;
}
const promptBox = (text) => h("details", { class: "more prompt" }, h("summary", null, "プロンプト案"), h("pre", null, text));
async function copyPrompt(text) {
  try { await navigator.clipboard.writeText(text); toast("プロンプト案をコピーしました。Claude に貼り付けてください"); }
  catch { toast("コピーできませんでした。「プロンプト案」を開いて、文を選んでコピーしてください", true); }
}
async function setProposal(p, status) {
  let note = "";
  if (status === "declined") { const v = prompt(`${p.id} を見送ります。理由があれば書いてください(空でも構いません)。`, ""); if (v === null) return; note = v.trim(); }
  try { await call("/api/proposals/update", { id: p.id, status, note }); toast(status === "declined" ? "見送りにしました" : "提案中に戻しました"); render(); }
  catch (err) { toast(err.message, true); }
}

// ---------- 目標・収益(analytics/plan.json。このPCだけ・GitHub に送らない) ----------
// 最終目標 → KPI(月ごとの目標と実績)→ 収益化の案。実績は、自動の分(週次の分析が state.json の kpi に書く)と、手入力の分(plan.json の manual)
function planOpen() {
  const p = S.plan;
  if (!p) return [];
  return [...p.kpis.map((x) => ({ kind: "kpi", ...x })), ...p.monetization.map((x) => ({ kind: "mon", ...x }))].filter((x) => x.status === "proposed");
}
const yen = (n) => (n == null ? "—" : "¥" + Math.round(n).toLocaleString("ja-JP"));
const num = (n, unit) => (n == null ? "—" : unit === "円" ? yen(n) : Math.round(n).toLocaleString("ja-JP") + (unit === "回" ? "" : unit));
const curMonth = () => S.today.slice(0, 7);
const addMonth = (m, k) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + k, 1)).toISOString().slice(0, 7);
const monthLabel = (m) => `${m.slice(0, 4)}年${+m.slice(5, 7)}月`;
// その月の実績。自動の値がない・手入力が空のときは、足さずに「含まれていない分」として返す(0 とみなさない)
function actual(id, m) {
  const a = S.plan.actuals?.months?.[m] || {};
  const man = S.plan.manual?.[m] || {};
  if (id === "revenue") {
    const parts = { "バリューコマース": a.revenueVc, "楽天": man.rakuten, "AdSense": man.adsense, "協賛・有料プラン": man.direct };
    let sum = 0, any = false; const missing = [];
    for (const [k, v] of Object.entries(parts)) { if (v == null) missing.push(k); else { sum += v; any = true; } }
    return { v: any ? sum : null, missing };
  }
  if (id === "contracts" || id === "pitches") { const v = man[id] ?? a[id] ?? null; return { v, missing: v == null ? ["営業の台帳・手入力"] : [] }; }
  if (id === "conversions") return { v: a.conversionsVc ?? null, missing: ["楽天(数えていません)"] };
  return { v: a[id] ?? null, missing: a[id] == null ? ["週次の分析"] : [] };
}
const decidedLine = (x) => (x.decidedAt ? [h("dt", null, S.planStatus[x.status] || "決定"), h("dd", null, `${x.decidedAt}${x.note ? " ・ " + x.note : ""}`)] : "");
function goalView() {
  const p = S.plan;
  if (!p) return [h("h2", null, "目標・収益"), h("p", { class: "warn" }, "このPCに、目標の計画(analytics/plan.json)がありません。Claude に「最終目標から KPI を作って」と頼んでください。")];
  const g = p.goal || {};
  const now = curMonth();
  const left = g.targetMonth ? Math.max(0, (+g.targetMonth.slice(0, 4) - +now.slice(0, 4)) * 12 + (+g.targetMonth.slice(5, 7) - +now.slice(5, 7))) : null;
  const rev = actual("revenue", now), revPrev = actual("revenue", addMonth(now, -1));
  const kpiRev = p.kpis.find((k) => k.id === "revenue");
  const months = [...new Set(p.kpis.flatMap((k) => Object.keys(k.targets || {})))].sort();
  const cols = [addMonth(now, -1), now, ...months.filter((m) => m > now)];
  const stBadge = (st) => badge({ proposed: "new", adopted: "published", declined: "rejected", done: "done" }[st] || "new", S.planStatus[st] || st);
  // 状態ごとに切り替えて見る(検討中・採用・実施済み・見送り)。決め終えたもの(実施済み・見送り)は、1行で短く出す
  const PLAN_GROUPS = [["proposed", "検討中", "まだ決めていない案です。「採用する」か「見送る」を押してください。"], ["adopted", "採用", "採用して、これから行う・行っている案です。"],
    ["done", "実施済み", "やり終えた案です。"], ["declined", "見送り(却下)", "見送った案です。理由を書いたものは、横に出ます。"]];
  const statusGroups = (key, list, card, short) => {
    const groups = PLAN_GROUPS.filter(([st]) => !(key === "kpiSt" && st === "done")); // KPI に「実施済み」はない
    const count = (st) => list.filter((x) => x.status === st).length;
    const valid = groups.some(([st]) => st === view[key]);
    const cur = valid ? view[key] : count("proposed") ? "proposed" : "adopted";
    const [, label, lead] = groups.find(([st]) => st === cur);
    const items = list.filter((x) => x.status === cur);
    return [
      h("div", { class: "seg", role: "group", "aria-label": "状態で切り替える" }, groups.map(([st, text]) =>
        h("button", { type: "button", class: "seg-b", "aria-pressed": String(st === cur), onclick: () => { view[key] = st; render(); } }, text, h("span", { class: "cnt" }, String(count(st)))))),
      h("p", { class: "mut seg-lead" }, lead),
      items.length ? (["done", "declined"].includes(cur) ? h("ul", { class: "plan-rows" }, items.map(short)) : items.map(card))
        : h("p", { class: "mut" }, `「${label}」のものはありません。`),
    ];
  };
  const shortRow = (x, title, extra) => h("li", null,
    h("span", { class: "t" }, title),
    extra || "",
    h("span", { class: "mut" }, [x.decidedAt, x.note].filter(Boolean).join(" ・ ")),
    h("button", { class: "btn ghost small", onclick: () => setPlan(x.title ? "mon" : "kpi", x, "proposed") }, "検討中に戻す"));

  const kpiButtons = (k) => k.status === "proposed"
    ? [h("button", { class: "btn small", onclick: () => setPlan("kpi", k, "adopted") }, "採用する"), h("button", { class: "btn ghost small", onclick: () => editTargets(k) }, "目標の数を変える"), h("button", { class: "btn ghost small", onclick: () => setPlan("kpi", k, "declined") }, "見送る")]
    : k.status === "adopted" ? [h("button", { class: "btn ghost small", onclick: () => editTargets(k) }, "目標の数を変える"), h("button", { class: "btn ghost small", onclick: () => setPlan("kpi", k, "proposed") }, "検討中に戻す")]
    : [h("button", { class: "btn ghost small", onclick: () => setPlan("kpi", k, "proposed") }, "検討中に戻す")];
  const kpiCard = (k) => h("section", { class: "panel decision" + (k.status === "declined" ? " dim" : "") },
    h("div", { class: "card-h" }, h("h4", null, k.kind === "KGI" ? h("span", { class: "kgi" }, "最終目標") : "", k.name), stBadge(k.status)),
    h("p", { class: "mut" }, k.why || ""),
    h("div", { class: "scroll" }, h("table", { class: "kpi" },
      h("thead", null, h("tr", null, h("th", null, ""), cols.map((m) => h("th", { class: m === now ? "now" : null }, monthLabel(m), m === now ? h("small", null, "今月") : "")))),
      h("tbody", null,
        h("tr", null, h("th", null, "目標"), cols.map((m) => h("td", { class: m === now ? "now" : null }, num(k.targets?.[m], k.unit)))),
        h("tr", null, h("th", null, "実績"), cols.map((m) => {
          if (m > now) return h("td", null, "");
          const a = actual(k.id, m), t = k.targets?.[m];
          const cls = [m === now ? "now" : "", a.v == null || t == null ? "" : a.v >= t ? "ok" : m < now ? "ng" : ""].filter(Boolean).join(" ") || null;
          return h("td", { class: cls, title: a.missing.length ? "含まれていない分: " + a.missing.join("・") : null }, num(a.v, k.unit), a.missing.length && a.v != null ? "*" : "");
        }))))),
    h("details", { class: "more" }, h("summary", null, "測り方"),
      h("dl", { class: "kv" }, h("dt", null, "測り方"), h("dd", null, k.source || ""), h("dt", null, "決めた時点"), h("dd", null, k.current || ""), decidedLine(k))),
    h("div", { class: "bar mt" }, kpiButtons(k)));

  const monButtons = (m) => m.status === "proposed"
    ? [h("button", { class: "btn small", onclick: () => setPlan("mon", m, "adopted") }, "採用する"), h("button", { class: "btn ghost small", onclick: () => setPlan("mon", m, "declined") }, "見送る")]
    : m.status === "adopted" ? [h("button", { class: "btn small", onclick: () => copyPrompt(promptFor("mon", m)) }, "プロンプトをコピー"), h("button", { class: "btn ghost small", onclick: () => setPlan("mon", m, "done") }, "実施済みにする"), h("button", { class: "btn ghost small", onclick: () => setPlan("mon", m, "proposed") }, "検討中に戻す")]
    : [h("button", { class: "btn ghost small", onclick: () => setPlan("mon", m, "proposed") }, "検討中に戻す")];
  const monCard = (m) => h("section", { class: "panel decision" + (m.status === "declined" ? " dim" : "") },
    h("div", { class: "card-h" }, h("h4", null, h("span", { class: "mut" }, m.id, " "), m.title), stBadge(m.status)),
    h("p", { class: "chips" },
      m.expectedYen ? h("span", { class: "chip" }, `見込み 月 ${yen(m.expectedYen[0])}〜${yen(m.expectedYen[1])}`) : "",
      m.effort ? h("span", { class: "chip" }, `手間 ${m.effort}`) : ""),
    h("p", null, m.summary || ""),
    h("p", { class: "next" }, h("b", null, "最初の一歩: "), m.firstStep || ""),
    ["proposed", "adopted"].includes(m.status) ? promptBox(promptFor("mon", m)) : "",
    h("details", { class: "more" }, h("summary", null, "理由・気をつけること"),
      h("dl", { class: "kv" }, h("dt", null, "理由"), h("dd", null, m.why || ""), h("dt", null, "気をつけること"), h("dd", null, m.risk || ""), decidedLine(m))),
    h("div", { class: "bar mt" }, monButtons(m)));

  const adoptedExp = p.monetization.filter((m) => ["adopted", "done"].includes(m.status) && m.expectedYen).reduce((a, m) => [a[0] + m.expectedYen[0], a[1] + m.expectedYen[1]], [0, 0]);
  const openKpis = p.kpis.filter((k) => k.status === "proposed").length, openMons = p.monetization.filter((m) => m.status === "proposed").length;
  const pct = g.monthlyRevenueYen ? Math.min(100, Math.round((adoptedExp[1] / g.monthlyRevenueYen) * 100)) : 0;
  return [
    h("h2", null, "目標・収益"),
    h("section", { class: "panel goal" },
      h("div", { class: "card-h" }, h("h3", { class: "goal-h" }, g.title || "最終目標"), g.deadline ? h("span", { class: "mut" }, `${g.deadline.replace(/-/g, "/")} までに`) : ""),
      h("div", { class: "stats" },
        h("div", { class: "stat" }, h("b", null, num(rev.v, "円")), h("span", null, "今月の売上"), rev.missing.length ? h("small", { class: "mut" }, "未入力: " + rev.missing.join("・")) : ""),
        h("div", { class: "stat" }, h("b", null, num(kpiRev?.targets?.[now] ?? null, "円")), h("span", null, "今月の目標")),
        h("div", { class: "stat" }, h("b", null, num(revPrev.v, "円")), h("span", null, "先月の売上")),
        h("div", { class: "stat" }, h("b", null, left == null ? "—" : left + "か月"), h("span", null, "目標の月まで"))),
      h("div", { class: "meter-l" }, h("span", null, "採用した収益化の案で届く見込み"), h("span", null, `月 ${yen(adoptedExp[0])}〜${yen(adoptedExp[1])} / ${yen(g.monthlyRevenueYen)}`)),
      h("progress", { class: "meter", max: "100", value: String(pct), "aria-label": `採用した案で、目標の ${pct}%` }),
      g.outlook ? h("details", { class: "more" }, h("summary", null, "見立て・売上の数え方"), h("p", { class: "mut" }, g.outlook), g.definition ? h("p", { class: "mut" }, g.definition) : "") : ""),
    openKpis + openMons ? h("p", { class: "callout" }, `まだ決めていないものが ${openKpis + openMons} 件あります(KPI ${openKpis}・収益化の案 ${openMons})。各カードの「採用する」か「見送る」を押してください。`) : "",

    ...secHead("収益化の案", openMons, "採用したら、プロンプト案をコピーして Claude に貼り付けます。終えたら「実施済みにする」。",
      "営業・契約・リンクの発行など、人が行う部分は「最初の一歩」を見てください。採用・見送りは、このPCの analytics/plan.json にだけ保存し、GitHub には送りません。"),
    statusGroups("monSt", p.monetization, monCard, (m) => shortRow(m, [h("span", { class: "mut" }, m.id, " "), m.title],
      m.expectedYen ? h("span", { class: "chip" }, `見込み 月 ${yen(m.expectedYen[0])}〜${yen(m.expectedYen[1])}`) : "")),

    ...secHead("KPI", openKpis, "月ごとの目標と実績です。実績の * は、まだ含まれていない分があるもの(数字にマウスを置くと出ます)。",
      "バリューコマースの報酬・セッション・広告のクリックは、毎週月曜の分析が自動で入れます。楽天・AdSense・協賛と、契約・提案の数は、下の「実績を入れる」で入れます。目標の数は、採用の前でも後でも変えられます。"),
    statusGroups("kpiSt", p.kpis, kpiCard, (k) => shortRow(k, k.name)),

    ...secHead("実績を入れる", null, "自動で取れない分を、月ごとに入れます。空欄は「未入力」として扱い、0 とはみなしません。"),
    manualForm(),
  ];
}
function manualForm() {
  const months = [curMonth(), addMonth(curMonth(), -1)];
  const m = months.includes(view.manualMonth) ? view.manualMonth : months[0];
  const row = S.plan.manual?.[m] || {};
  const form = h("form", { class: "panel", onsubmit: async (ev) => {
    ev.preventDefault();
    const values = {};
    for (const k of Object.keys(S.manualFields)) { const v = form.elements[k].value.trim(); values[k] = v === "" ? null : Number(v); }
    try { await call("/api/plan/manual", { month: m, values }); toast(`${monthLabel(m)}の実績を保存しました`); render(); }
    catch (err) { toast(err.message, true); }
  } },
    h("div", { class: "bar" }, h("label", { for: "mm" }, "月"), h("select", { id: "mm", onchange: (ev) => { view.manualMonth = ev.target.value; render(); } }, months.map((x) => h("option", { value: x, selected: x === m }, monthLabel(x))))),
    h("div", { class: "grid" }, Object.entries(S.manualFields).map(([k, label]) => h("div", { class: "f" }, h("label", { for: "man-" + k }, label), h("input", { id: "man-" + k, name: k, type: "number", min: "0", step: "1", inputmode: "numeric", value: row[k] ?? "", placeholder: "未入力" })))),
    h("p", { class: "mut" }, "楽天は楽天アフィリエイトの成果報酬、AdSense は見積もり収益額の、その月の額です。空欄は「未入力」として扱い、0 とはみなしません。"),
    h("div", { class: "bar mt" }, h("button", { class: "btn", type: "submit" }, "保存する"), row.updatedAt ? h("span", { class: "mut" }, `前回の保存: ${row.updatedAt}`) : ""));
  return form;
}
async function setPlan(kind, x, status) {
  let note = "";
  if (status === "declined") { const v = prompt(`「${x.name || x.title}」を見送ります。理由があれば書いてください(空でも構いません)。`, ""); if (v === null) return; note = v.trim(); }
  try {
    await call("/api/plan/item", { kind, id: x.id, status, note });
    toast({ adopted: "採用しました", declined: "見送りにしました", done: "実施済みにしました", proposed: "検討中に戻しました" }[status]);
    render();
  } catch (err) { toast(err.message, true); }
}
// 入力の途中は、画面を描き直さない(書いた文が消えないように)
const typing = () => { const a = document.activeElement; return !!a && (a.matches("textarea, input, select") || !!a.closest("dialog[open]")); };
function editTargets(k) {
  const dlg = $("#dlg"), form = $("#dlg-form");
  const months = Object.keys(k.targets || {}).sort();
  form.replaceChildren(
    h("h2", null, `目標の数を変える: ${k.name}`),
    h("p", { class: "mut" }, `単位: ${k.unit}。月ごとの目標です。`),
    h("div", { class: "grid" }, months.map((m) => h("div", { class: "f" }, h("label", { for: "t-" + m }, monthLabel(m)), h("input", { id: "t-" + m, name: m, type: "number", min: "0", step: "1", required: true, value: k.targets[m] })))),
    h("div", { class: "bar mt" }, h("button", { class: "btn", value: "save" }, "保存する"), h("button", { class: "btn ghost", value: "cancel", formnovalidate: true }, "やめる")));
  form.onsubmit = async (ev) => {
    if (ev.submitter?.value !== "save") return;
    ev.preventDefault();
    const targets = {};
    for (const m of months) targets[m] = Number(form.elements[m].value);
    try { await call("/api/plan/item", { kind: "kpi", id: k.id, targets }); dlg.close(); toast("目標の数を保存しました"); render(); }
    catch (err) { toast(err.message, true); }
  };
  dlg.showModal();
}

// ---------- 営業(analytics/pipeline.json。このPCだけ・GitHub に送らない) ----------
// 協賛・有料プラン・送客の提案先を、候補 → 送信済み → 返信あり → 商談中 → 契約 / 見送り で記録する。
// 「提案した相手の数」「有償の契約数」の KPI は、ここから月ごとに数える(目標・収益の手入力があれば、そちらを優先)
// 段階を進めるボタン: 今の段階 → [次の段階, ボタンの文]
const NEXT_STAGE = { candidate: [["sent", "送った"]], sent: [["replied", "返信があった"], ["sent", "もう一度送った"]], replied: [["talking", "商談に進んだ"], ["won", "契約した"]], talking: [["won", "契約した"]], won: [], lost: [["candidate", "候補に戻す"]] };
function salesView() {
  const P = S.pipeline;
  if (!P) return [h("h2", null, "営業")];
  const sm = P.summary, leads = P.leads;
  const stageBadge = (st) => badge({ candidate: "new", sent: "doing", replied: "doing", talking: "doing", won: "published", lost: "rejected" }[st] || "new", P.stages[st] || st);
  const tgt = (t, v, unit) => (t ? `${v} / ${t.value}${unit}` : `${v}${unit}`);
  const tNote = (t) => (t && t.month !== sm.month.month ? h("small", { class: "mut" }, `目標は${monthLabel(t.month)}の分`) : "");
  const order = ["candidate", "sent", "replied", "talking", "won", "lost"];
  const valid = order.includes(view.salesSt);
  const cur = valid ? view.salesSt : sm.due.length || sm.count.sent + sm.count.replied + sm.count.talking ? "sent" : "candidate";
  // 「送信済み」の欄には、やりとりの途中(返信あり・商談中)も入れる
  const inGroup = (x) => (cur === "sent" ? ["sent", "replied", "talking"].includes(x.stage) : x.stage === cur);
  const list = leads.filter(inGroup).sort((a, b) => (a.nextAt || "9").localeCompare(b.nextAt || "9") || a.id.localeCompare(b.id));
  const groups = [["candidate", "候補(まだ送っていない)", sm.count.candidate], ["sent", "やりとり中", sm.count.sent + sm.count.replied + sm.count.talking], ["won", "契約", sm.count.won], ["lost", "見送り", sm.count.lost]];
  const dueSet = new Set(sm.due.map((d) => d.id));
  const card = (x) => h("section", { class: "panel decision" + (x.stage === "lost" ? " dim" : "") },
    h("div", { class: "card-h" }, h("h4", null, h("span", { class: "mut" }, x.id, " "), x.name), stageBadge(x.stage)),
    h("p", { class: "chips" }, h("span", { class: "chip" }, x.kind), h("span", { class: "chip" }, `${x.offer} ${P.offers[x.offer] || ""}`),
      x.monthlyYen ? h("span", { class: "chip" }, `月 ${yen(x.monthlyYen)}`) : "",
      x.nextAt && !["won", "lost", "candidate"].includes(x.stage) ? h("span", { class: "chip" + (dueSet.has(x.id) ? " due" : "") }, `次に連絡する日 ${jpDate(x.nextAt)}${dueSet.has(x.id) ? "(来ています)" : ""}`) : ""),
    h("dl", { class: "kv" },
      x.contact ? [h("dt", null, "宛先・窓口"), h("dd", null, x.contact)] : "",
      x.url ? [h("dt", null, "連絡先・出典"), h("dd", null, ext(x.url))] : "",
      x.sentAt ? [h("dt", null, "最初に送った日"), h("dd", null, jpDate(x.sentAt))] : "",
      x.wonAt ? [h("dt", null, "契約した日"), h("dd", null, jpDate(x.wonAt))] : "",
      x.memo ? [h("dt", null, "メモ"), h("dd", null, x.memo)] : ""),
    x.log?.length ? h("details", { class: "more" }, h("summary", null, `記録(${x.log.length})`),
      h("ul", { class: "plan-rows" }, x.log.slice().reverse().map((l) => h("li", null, h("span", { class: "t" }, jpDate(l.date)), stageBadge(l.stage), h("span", { class: "mut" }, l.note || ""))))) : "",
    h("div", { class: "bar mt" },
      (NEXT_STAGE[x.stage] || []).map(([st, label], i) => h("button", { class: "btn small" + (i ? " ghost" : ""), onclick: () => moveLead(x, st) }, label)),
      ["sent", "replied", "talking"].includes(x.stage) ? h("button", { class: "btn ghost small", onclick: () => moveLead(x, x.stage, true) }, "連絡する日を変える") : "",
      h("button", { class: "btn ghost small", onclick: () => editLead(x) }, "編集"),
      !["lost", "won"].includes(x.stage) ? h("button", { class: "btn ghost small", onclick: () => moveLead(x, "lost") }, "見送り") : "",
      x.stage === "won" ? h("button", { class: "btn ghost small", onclick: () => moveLead(x, "lost") }, "契約が終わった") : ""));

  const wk = sm.week, mo = sm.month;
  return [
    h("h2", null, "営業"),
    h("section", { class: "panel goal" },
      h("div", { class: "stats" },
        h("div", { class: "stat" + (wk.short ? " ng" : "") }, h("b", null, wk.guide == null ? String(wk.count) : `${wk.count} / ${wk.guide}`), h("span", null, `今週の提案(${+wk.from.slice(5, 7)}/${+wk.from.slice(8, 10)}〜)`), wk.short ? h("small", { class: "mut" }, `目安まで あと${wk.guide - wk.count}件`) : ""),
        h("div", { class: "stat" }, h("b", null, tgt(mo.pitchTarget, mo.pitches, "件")), h("span", null, "今月の提案"), tNote(mo.pitchTarget)),
        h("div", { class: "stat" }, h("b", null, tgt(mo.contractTarget, mo.contracts, "件")), h("span", null, "契約"), tNote(mo.contractTarget)),
        h("div", { class: "stat" }, h("b", null, yen(sm.wonMonthlyYen)), h("span", null, "契約の月額の合計"))),
      h("p", { class: "mut small" }, `返信率: ${sm.replyRate ? `${sm.replyRate.replied} / ${sm.replyRate.sent}件` : "まだ送っていません"} ・ 1週の目安は、提案の月の目標を週に割ったものです。提案した数・契約数は「目標・収益」の KPI に自動で入ります(手入力があれば、手入力を優先)。`)),
    sm.due.length ? [h("h3", { class: "sec-h" }, "連絡する日が来た相手", h("span", { class: "pill" }, String(sm.due.length))),
      h("ul", { class: "plan-rows" }, sm.due.map((d) => { const x = leads.find((y) => y.id === d.id); return h("li", null, h("span", { class: "t" }, d.name), stageBadge(d.stage), h("span", { class: "mut" }, d.late ? `${d.late}日過ぎ` : "今日"),
        (NEXT_STAGE[x.stage] || []).slice(0, 1).map(([st, label]) => h("button", { class: "btn small", onclick: () => moveLead(x, st) }, label)),
        h("button", { class: "btn ghost small", onclick: () => moveLead(x, x.stage, true) }, "日を延ばす")); }))] : "",
    h("div", { class: "bar mt" }, h("button", { class: "btn", onclick: () => editLead(null) }, "相手を追加")),
    h("div", { class: "seg", role: "group", "aria-label": "段階で切り替える" }, groups.map(([st, text, n]) =>
      h("button", { type: "button", class: "seg-b", "aria-pressed": String(st === cur), onclick: () => { view.salesSt = st; render(); } }, text, h("span", { class: "cnt" }, String(n))))),
    list.length ? list.map(card) : h("p", { class: "mut" }, "この段階の相手はいません。"),
    h("p", { class: "mut small" }, "台帳は、このPCの analytics/pipeline.json にだけ保存し、GitHub には送りません。相手への連絡・条件・契約は運営者が行います。毎週月曜の分析も、この台帳を読んで提案のペースと連絡の漏れを報告します。"),
  ];
}
// 段階を変える。メモ(と、やりとり中なら次に連絡する日)を聞く
async function moveLead(x, stage, onlyDate) {
  const P = S.pipeline;
  let note = "", nextAt;
  if (onlyDate || ["replied", "talking"].includes(stage)) {
    const def = new Date(Date.parse(S.today) + P.followDays * 864e5).toISOString().slice(0, 10);
    const v = prompt(`「${x.name}」に次に連絡する日(YYYY-MM-DD)`, onlyDate && x.nextAt > S.today ? x.nextAt : def);
    if (v === null) return;
    nextAt = v.trim();
  }
  if (!onlyDate) {
    const v = prompt(`「${x.name}」を「${P.stages[stage]}」にします。メモがあれば書いてください(空でも構いません)。`, "");
    if (v === null) return;
    note = v.trim();
  } else note = "連絡する日を変更";
  try { await call("/api/pipeline/stage", { id: x.id, stage, note, nextAt }); toast(onlyDate ? "連絡する日を変えました" : `「${P.stages[stage]}」にしました`); render(); }
  catch (err) { toast(err.message, true); }
}
function editLead(x) {
  const P = S.pipeline, dlg = $("#dlg"), form = $("#dlg-form");
  const v = x || { kind: P.kinds[0], offer: "MON-1" };
  const field = (name, label, input) => h("div", { class: "f" }, h("label", { for: "ld-" + name }, label), input, h("small", { class: "err", id: "err-" + name }));
  form.replaceChildren(
    h("h2", null, x ? `相手を編集: ${x.name}` : "相手を追加"),
    h("div", { class: "grid" },
      field("name", "相手の名前(団体・施設)", h("input", { id: "ld-name", name: "name", required: true, maxlength: 80, value: v.name || "" })),
      field("kind", "種類", h("select", { id: "ld-kind", name: "kind" }, P.kinds.map((k) => h("option", { value: k, selected: k === v.kind }, k)))),
      field("offer", "提案の中身", h("select", { id: "ld-offer", name: "offer" }, Object.entries(P.offers).map(([k, t]) => h("option", { value: k, selected: k === v.offer }, `${k === "other" ? "" : k + " "}${t}`)))),
      field("contact", "宛先・窓口", h("input", { id: "ld-contact", name: "contact", maxlength: 200, value: v.contact || "" })),
      field("url", "連絡先・出典の URL", h("input", { id: "ld-url", name: "url", type: "url", maxlength: 300, value: v.url || "" })),
      field("monthlyYen", "契約の月額(円・決まったら)", h("input", { id: "ld-monthlyYen", name: "monthlyYen", type: "number", min: "0", step: "1", value: v.monthlyYen ?? "" })),
      x && ["sent", "replied", "talking"].includes(x.stage) ? field("nextAt", "次に連絡する日", h("input", { id: "ld-nextAt", name: "nextAt", type: "date", value: v.nextAt || "" })) : ""),
    field("memo", "メモ", h("textarea", { id: "ld-memo", name: "memo", rows: 3, class: "full", maxlength: 1000 }, v.memo || "")),
    h("div", { class: "bar mt" }, h("button", { class: "btn", value: "save" }, "保存する"), h("button", { class: "btn ghost", value: "cancel", formnovalidate: true }, "やめる")));
  form.onsubmit = async (ev) => {
    if (ev.submitter?.value !== "save") return;
    ev.preventDefault();
    const f = form.elements, val = (k) => (f[k] ? f[k].value : "");
    const lead = { id: x?.id, name: val("name"), kind: val("kind"), offer: val("offer"), contact: val("contact"), url: val("url"), memo: val("memo"), nextAt: x ? val("nextAt") || x.nextAt || "" : "",
      monthlyYen: val("monthlyYen") === "" ? null : Number(val("monthlyYen")) };
    form.querySelectorAll(".err").forEach((e) => (e.textContent = ""));
    try { await call("/api/pipeline/save", { lead }); dlg.close(); toast(x ? "保存しました" : "台帳に追加しました"); render(); }
    catch (err) { for (const [k, m] of Object.entries(err.fields || {})) { const e = $("#err-" + k); if (e) e.textContent = m; } toast(err.message, true); }
  };
  dlg.showModal();
}

// ---------- 概要: 運営の状況(数字・グラフ・信号。読むだけ。決めることは各タブで) ----------
// 1. 売上と目標 2. 集客の推移 3. 運営が止まっていないか 4. 掲載の量と鮮度。データはサーバーの /api/overview(overview.mjs)
const SVGNS = "http://www.w3.org/2000/svg";
function sv(tag, attrs, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v); else el.setAttribute(k, String(v));
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false && c !== "") el.append(c instanceof Node ? c : String(c));
  return el;
}
const fmtN = (n) => (n == null ? "—" : Math.round(n).toLocaleString("ja-JP"));
const md = (d) => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;
const mShort = (m) => `${+m.slice(5, 7)}月`;
const valueOf = (v, unit) => (unit === "円" ? yen(v) : unit === "回" || !unit ? fmtN(v) : v == null ? "—" : fmtN(v) + unit);
// 日付だけ(YYYY-MM-DD)は日付で、時刻つきは「今日 9:30」の形で
const whenText = (x) => (!x ? "" : x.length === 10 ? `${+x.slice(5, 7)}/${+x.slice(8, 10)}` : at(x));
function niceMax(v) {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v)), f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}
const tickText = (v, unit) => (unit === "円" ? (v >= 10000 ? `${v / 10000}万` : fmtN(v)) : v >= 10000 ? `${Math.round(v / 1000)}K` : fmtN(v));

// ツールチップ(マウスとキーボードの両方。値は表でも見られるので、ここだけに頼らない)
const tip = h("div", { class: "tip", role: "tooltip" });
document.body.append(tip);
function showTip(el, lines) {
  tip.replaceChildren(...lines.map((l, i) => h(i ? "span" : "b", null, l)));
  tip.classList.add("on");
  const anchor = el.parentNode?.querySelector?.(".col") || el; // 棒があれば、棒の上に出す
  const r = anchor.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
  const x = Math.max(8, Math.min(r.left + r.width / 2 - tw / 2, innerWidth - tw - 8));
  const y = r.top - th - 8 < 8 ? r.bottom + 8 : r.top - th - 8;
  tip.style.left = x + "px"; tip.style.top = y + "px";
}
const hideTip = () => tip.classList.remove("on");
const tipAttrs = (lines) => ({ tabindex: "0", role: "img", "aria-label": lines.join("、"),
  onmouseenter: (e) => showTip(e.currentTarget, lines), onfocus: (e) => showTip(e.currentTarget, lines), onmouseleave: hideTip, onblur: hideTip });
addEventListener("scroll", hideTip, { passive: true });

// 縦の棒(1系列)と、目標の横線。値のそろっていない期間(今月・今週・計測の欠け)は薄い色。最後の値だけ数字を出す
const colPath = (x, y, w, hgt, r) => `M${x},${y + hgt}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + hgt}Z`;
function columnChart({ label, items, unit, height = 190, table }) {
  const subs = items.some((x) => x.sub);
  const W = 640, L = 48, R = 8, T = 22, B = subs ? 40 : 28, H = height + (subs ? 12 : 0);
  const vals = items.flatMap((x) => [x.value, x.target]).filter((v) => v != null);
  const max = niceMax(Math.max(0, ...vals));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const band = (W - L - R) / Math.max(1, items.length), bw = Math.min(24, band * 0.56);
  const lastIdx = items.reduce((a, x, i) => (x.value != null ? i : a), -1);
  const grid = [0, max / 2, max].map((v) => [
    v ? sv("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), class: "grid" }) : "",
    sv("text", { x: L - 6, y: y(v) + 4, class: "tick", "text-anchor": "end" }, tickText(v, unit))]);
  const marks = items.map((x, i) => {
    const cx = L + band * i + band / 2, g = [];
    if (x.value > 0) { const top = y(x.value), base = y(0); g.push(sv("path", { d: colPath(cx - bw / 2, top, bw, base - top, Math.min(4, base - top)), class: "col" + (x.partial ? " partial" : "") })); }
    if (x.target != null) g.push(sv("line", { x1: cx - band * 0.38, x2: cx + band * 0.38, y1: y(x.target), y2: y(x.target), class: "tgt" }));
    if (i === lastIdx) g.push(sv("text", { x: cx, y: y(Math.max(x.value, 0)) - 7, class: "vlab", "text-anchor": "middle" }, valueOf(x.value, unit)));
    g.push(sv("text", { x: cx, y: H - B + 16, class: "tick", "text-anchor": "middle" }, x.label));
    if (x.sub) g.push(sv("text", { x: cx, y: H - B + 30, class: "tick", "text-anchor": "middle" }, x.sub));
    g.push(sv("rect", { x: L + band * i, y: T - 8, width: band, height: H - T - B + 8, class: "hit", ...tipAttrs(x.tip) }));
    return sv("g", { class: "m" }, g);
  });
  const hasT = items.some((x) => x.target != null), hasP = items.some((x) => x.partial);
  return h("figure", { class: "chart" },
    h("figcaption", null, label),
    sv("svg", { viewBox: `0 0 ${W} ${H}`, class: "viz", role: "group", "aria-label": label }, grid, sv("line", { x1: L, x2: W - R, y1: y(0), y2: y(0), class: "axis" }), marks),
    hasT || hasP ? h("p", { class: "legend" },
      hasT ? [h("span", { class: "key k-col", "aria-hidden": "true" }), "実績", h("span", { class: "key k-tgt", "aria-hidden": "true" }), "目標"] : "",
      hasP ? [h("span", { class: "key k-part", "aria-hidden": "true" }), "途中・値のそろっていない期間"] : "") : "",
    table ? h("details", { class: "more" }, h("summary", null, "表で見る"), h("div", { class: "scroll" }, h("table", { class: "num" },
      h("thead", null, h("tr", null, table.head.map((c) => h("th", null, c)))), h("tbody", null, table.rows.map((r) => h("tr", null, r.map((c) => h("td", null, c)))))))) : "");
}
// 横の棒(数字はすべて棒の横に出す)
function hbars(items, fmt = fmtN) {
  const max = Math.max(1, ...items.map((x) => x.value || 0));
  return h("div", { class: "hbars" }, items.map((x) => {
    const bar = h("span", { class: "hb" });
    bar.style.width = `${Math.max(x.value ? 1.5 : 0, (x.value / max) * 100)}%`;
    return h("div", { class: "hrow" }, h("span", { class: "hl", title: x.label }, x.label, x.note ? h("small", null, x.note) : ""), h("span", { class: "ht" }, bar), h("span", { class: "hv" }, fmt(x.value)));
  }));
}
// 前の期間との比べ(上がるのが良いか、下がるのが良いか)
function deltaOf(cur, prev, { lowerBetter = false, abs = false, enough = true, rank = false } = {}) {
  if (cur == null || prev == null || !enough) return h("small", { class: "mut" }, "比べられる前の期間がありません");
  const d = abs ? cur - prev : prev ? ((cur - prev) / prev) * 100 : null;
  if (d == null) return h("small", { class: "mut" }, "前の期間が 0");
  const up = d > 0, good = d === 0 ? null : up !== lowerBetter;
  // 順位は、数が小さくなるのが「上がる」。矢印は良し悪しの向きに合わせる
  if (rank) return h("small", { class: "delta " + (good == null ? "" : good ? "good" : "bad") }, d === 0 ? "→ 前の7日と同じ" : `${good ? "▲" : "▼"} ${Math.abs(d).toFixed(1)} ${good ? "上がった" : "下がった"}(前の7日より)`);
  const txt = abs ? `${up ? "+" : ""}${d.toFixed(1)}` : `${up ? "+" : ""}${Math.round(d)}%`;
  return h("small", { class: "delta " + (good == null ? "" : good ? "good" : "bad") }, d === 0 ? "→ " : up ? "▲ " : "▼ ", txt, " 前の7日より");
}
const tile = (label, value, ...notes) => h("div", { class: "stat" }, h("span", null, label), h("b", null, value), notes);
const tileLink = (label, value, go, ...notes) => h("a", { href: "#", class: "stat", onclick: goTab(...go) }, h("span", null, label), h("b", null, value), notes);
const sec = (id, title, lead) => [h("h3", { class: "dash-h", id }, title), lead ? h("p", { class: "mut small lead" }, lead) : ""];
const PACE = { ahead: ["good", "先行"], on: ["good", "予定どおり"], behind: ["bad", "遅れ"] };
// 進み具合のメーター: 実績 / 目標(線は、今日までに来ていたい位置)
function paceMeter(value, target, p) {
  if (value == null || !target) return h("span", { class: "mut small" }, "—");
  const fill = h("span", { class: "pm-fill" + (p?.state === "behind" ? " bad" : "") });
  fill.style.width = `${Math.min(100, (value / target) * 100)}%`;
  const mark = h("span", { class: "pm-mark", title: "今日までの目安" });
  mark.style.left = `${Math.min(100, (p?.frac ?? 1) * 100)}%`;
  return h("span", { class: "pm" }, h("span", { class: "pm-track", role: "img", "aria-label": `目標の ${Math.round((value / target) * 100)}%。今日までの目安は ${Math.round((p?.frac ?? 1) * 100)}%` }, fill, mark),
    p ? h("small", { class: "delta " + PACE[p.state][0] }, PACE[p.state][1]) : "");
}

function revenueBlock(R) {
  const head = sec("dash-revenue", "売上と目標", "広告・アフィリエイトの報酬と、協賛・有料プランの収入の合計。楽天・AdSense・協賛は「目標・収益」で手入力した額です。");
  if (!R) return [head, h("p", { class: "warn" }, "目標の計画(analytics/plan.json)がありません。")];
  const n = R.now, g = R.goal;
  const missing = (m) => (m?.length ? h("small", { class: "mut" }, "未入力: " + m.join("・")) : h("small", { class: "mut" }, "すべて入力済み"));
  const tiles = h("div", { class: "stats four" },
    tile("今月の売上(見込み)", yen(n.value), missing(n.missing)),
    tile("今月の目標", n.target ? yen(n.target) : "なし",
      n.pace ? h("small", { class: "delta " + PACE[n.pace.state][0] }, `${PACE[n.pace.state][1]}(今日までの目安 ${yen(n.pace.expected)})`)
        : !n.target && R.nextTarget ? h("small", { class: "mut" }, `${monthLabel(R.nextTarget.month)}から ${yen(R.nextTarget.value)}`) : ""),
    tile("先月の売上", yen(R.prev.value), missing(R.prev.missing)),
    tile("最終目標", g.title || "—", h("small", { class: "mut" }, g.targetMonth ? `${monthLabel(g.targetMonth)}まで あと ${g.monthsLeft} か月` : "")));
  const chart = columnChart({
    label: "月ごとの売上と目標(円)", unit: "円",
    items: R.months.map((m) => ({ label: mShort(m.month), sub: m.current ? "今月" : "", value: m.future ? null : m.value, target: m.target, partial: m.current,
      tip: [m.future ? `目標 ${yen(m.target)}` : `${yen(m.value)}${m.current ? "(途中)" : ""}`, monthLabel(m.month), ...(m.future ? [] : [m.target != null ? `目標 ${yen(m.target)}` : "目標なし"]), ...(!m.future && m.missing.length ? ["未入力: " + m.missing.join("・")] : [])] })),
    table: { head: ["月", "売上", "目標", "未入力"], rows: R.months.map((m) => [monthLabel(m.month), m.future ? "" : yen(m.value), m.target == null ? "—" : yen(m.target), m.future ? "" : m.missing.join("・")]) },
  });
  const parts = h("p", { class: "small mut" }, "今月の内訳: ", n.parts.map((p, i) => [i ? " ・ " : "", `${p.label} ${p.value == null ? "未入力" : yen(p.value)}`]));
  const lead = h("div", { class: "scroll" }, h("table", { class: "num kpis" },
    h("thead", null, h("tr", null, ["先行指標", "今月", "今月の目標", "進み具合", "先月"].map((c) => h("th", null, c)))),
    h("tbody", null, R.leading.map((k) => h("tr", null,
      h("th", null, k.name),
      h("td", null, valueOf(k.value, k.unit), k.value != null && k.days ? h("small", { class: "mut" }, ` (${k.days}日分)`) : "", k.value == null ? h("small", { class: "mut" }, " " + k.missing.join("・")) : ""),
      h("td", null, k.target != null ? valueOf(k.target, k.unit) : k.nextTarget ? h("span", { class: "mut" }, `${mShort(k.nextTarget[0])}から ${valueOf(k.nextTarget[1], k.unit)}`) : "—"),
      h("td", null, paceMeter(k.value, k.target, k.pace)),
      h("td", null, valueOf(k.prev, k.unit)))))));
  return [head, tiles, chart, parts, lead,
    h("p", { class: "small" }, `採用した収益化の案の見込み: 月 ${yen(R.adopted[0])}〜${yen(R.adopted[1])} ・ `, h("a", { href: "#", onclick: goTab("goal") }, "目標・収益を開く →"))];
}

function trafficBlock(T) {
  const head = sec("dash-traffic", "集客の推移", "Search Console(検索)と GA4(サイトの訪問)。数字は週次の分析が、このPCに取り込みます。検索は2〜3日遅れて確定します。");
  if (!T?.has) return [head, h("p", { class: "warn" }, "日ごとの数字(analytics/series.json)がまだありません。週次の分析のあとに出ます。")];
  const s = T.sessions, q = T.search;
  const span = (w) => (w ? `${md(w.cur.from)}〜${md(w.cur.to)}` : "");
  const enough = (w, k) => !!w && w.cur[k] >= 6 && w.prev[k] >= 6;
  const tiles = h("div", { class: "stats" },
    tile("訪問(セッション)", fmtN(s?.cur.sessions), h("small", { class: "mut" }, span(s)), s ? deltaOf(s.cur.sessions, s.prev.sessions, { enough: enough(s, "gaDays") }) : ""),
    tile("検索のクリック", fmtN(q?.cur.clicks), h("small", { class: "mut" }, span(q)), q ? deltaOf(q.cur.clicks, q.prev.clicks, { enough: enough(q, "gscDays") }) : ""),
    tile("検索の表示回数", fmtN(q?.cur.impr), h("small", { class: "mut" }, span(q)), q ? deltaOf(q.cur.impr, q.prev.impr, { enough: enough(q, "gscDays") }) : ""),
    tile("平均掲載順位", q?.cur.pos == null ? "—" : q.cur.pos.toFixed(1) + "位", h("small", { class: "mut" }, "小さいほど上"), q ? deltaOf(q.cur.pos, q.prev.pos, { lowerBetter: true, abs: true, rank: true, enough: enough(q, "gscDays") }) : ""),
    tile("広告のクリック", fmtN(T.affClicks28?.count), h("small", { class: "mut" }, T.affClicks28 ? `28日間(${md(T.affClicks28.from)}〜${md(T.affClicks28.to)})` : "まだ記録がありません")));
  const weekly = (k, daysK, unit, label) => { const weeks = T.weeks.slice(Math.max(0, T.weeks.findIndex((w) => w[daysK] > 0))); return columnChart({
    label, unit,
    items: weeks.map((w, i) => ({ label: md(w.from), sub: w[daysK] < 7 ? `${w[daysK]}日分` : "", value: w[k], partial: w[daysK] < 7,
      tip: [`${fmtN(w[k])} ${unit === "回" ? "" : unit}`.trim(), `${md(w.from)}〜${md(w.to)} の週`, `値のある日 ${w[daysK]}/7 日${i === weeks.length - 1 ? "(今週)" : ""}`] })),
    table: { head: ["週", label.replace(/(週ごとの)/, ""), "値のある日"], rows: weeks.map((w) => [`${md(w.from)}〜${md(w.to)}`, fmtN(w[k]), `${w[daysK]}/7`]) },
  }); };
  const page = (p) => { try { return decodeURI(p); } catch { return p; } };
  const lists = h("div", { class: "cols" },
    T.pages.length ? h("div", null, h("h4", null, "検索から来たページ(28日・クリック)"), hbars(T.pages.map((p) => ({ label: page(p.key), value: p.clicks, note: `表示 ${fmtN(p.impr)}・${p.pos.toFixed(1)}位` })))) : "",
    T.queries.length ? h("div", null, h("h4", null, "検索語(28日・クリック)"), hbars(T.queries.map((p) => ({ label: p.key, value: p.clicks, note: `表示 ${fmtN(p.impr)}・${p.pos.toFixed(1)}位` })))) : "",
    T.sources.length ? h("div", null, h("h4", null, "どこから来たか(28日・セッション)"), hbars(T.sources.map((p) => ({ label: p.key, value: p.sessions })))) : "");
  return [head, tiles,
    h("div", { class: "cols" }, weekly("sessions", "gaDays", "回", "週ごとの訪問(セッション)"), weekly("clicks", "gscDays", "回", "週ごとの検索のクリック")),
    lists,
    h("p", { class: "small mut" }, `日ごとの数字: ${T.updated ?? "—"} まで取り込み済み${T.range28 ? ` ・ 28日の内訳: ${T.range28}` : ""}`),
    T.caveats.length ? h("ul", { class: "small mut caveats" }, T.caveats.map((c) => h("li", null, c))) : ""];
}

const SIG = { stop: ["■", "停止"], warn: ["▲", "注意"], unknown: ["?", "不明"], ok: ["●", "正常"] };
function opsBlock(O) {
  const head = sec("dash-ops", "運営が止まっていないか", "自動の仕組みが、予定どおり動いているか。GitHub の実行とサイトの表示は、10分ごとに確かめ直します。");
  if (!O) return head;
  const order = { stop: 0, warn: 1, unknown: 2, ok: 3 };
  const sigs = [...O.signals].sort((a, b) => order[a.state] - order[b.state]);
  const sum = h("p", { class: "sigsum" }, ["stop", "warn", "unknown", "ok"].map((k) => h("span", { class: "s-" + k }, h("i", { "aria-hidden": "true" }, SIG[k][0]), ` ${SIG[k][1]} ${O.counts[k]}`)),
    h("button", { class: "btn ghost small", onclick: () => loadOverview(true) }, "いますぐ確かめる"));
  return [head, sum, h("ul", { class: "sigs" }, sigs.map((x) => h("li", { class: "sig s-" + x.state },
    h("span", { class: "si" }, h("i", { "aria-hidden": "true" }, SIG[x.state][0]), " ", SIG[x.state][1]),
    h("span", { class: "sn" }, h("b", null, x.label), h("small", null, x.schedule)),
    h("span", { class: "sd" }, x.detail, x.last ? h("small", { class: "mut" }, ` ・ 最終 ${whenText(x.last)}`) : "", x.url ? [" ", ext(x.url, "記録")] : ""))))];
}

function listingBlock(Lg) {
  const head = sec("dash-listing", "掲載の量と鮮度", "サイトに載っている開催の数と、確かめてからの日数。数字を押すと、その一覧を開きます。");
  if (!Lg) return head;
  const tiles = h("div", { class: "stats four" },
    tileLink("これからの開催", fmtN(Lg.upcoming), ["events", { evFilter: "upcoming" }], h("small", { class: "mut" }, `うち自動収集 ${fmtN(Lg.auto)}`)),
    tile("7日以内", fmtN(Lg.next7)), tile("30日以内", fmtN(Lg.next30)), tile("定期公演", fmtN(Lg.regular)),
    tileLink("保留中", fmtN(Lg.pending), ["decide"], h("small", { class: "mut" }, "掲載か却下を決める")),
    tileLink("確認日が60日を過ぎた", fmtN(Lg.stale), ["events", { evFilter: "stale" }], h("small", { class: "mut" }, "公式情報で確かめ直す")),
    tile("時刻未定(14日以内)", fmtN(Lg.timeUnknown14)), tile("地図の位置なし", fmtN(Lg.noGeo)));
  const chart = columnChart({ label: "これからの開催(週ごと・開始日)", unit: "件",
    items: Lg.weeks.map((w, i) => ({ label: md(w.from), sub: i === 0 ? "今週" : "", value: w.count, tip: [`${w.count} 件`, `${md(w.from)}〜${md(w.to)} の週`] })),
    table: { head: ["週", "開催"], rows: Lg.weeks.map((w) => [`${md(w.from)}〜${md(w.to)}`, String(w.count)]) } });
  const c = Lg.collect;
  return [head, tiles, h("div", { class: "cols" }, chart, h("div", null, h("h4", null, "地方ごと(30日以内)"), hbars(Lg.regions.map((r) => ({ label: r.name, value: r.count }))))),
    c ? h("p", { class: "small" }, `前回の自動収集(${whenText(c.date)}): 新しく掲載 ${fmtN(c.published)} 件 ・ 保留 ${fmtN(c.held)} 件 ・ エラー ${fmtN(c.errors)} 件`) : "",
    Lg.expiring.length ? [h("h4", null, "期限が近い広告リンク"), h("ul", { class: "small" }, Lg.expiring.map((o) => h("li", null, `${o.title}: ${o.expiresAt}${o.days < 0 ? "(切れて、表示が止まっています)" : `(あと ${o.days} 日)`}`)))] : ""];
}

// やることの帯: 件数のあるものだけ。決めるのは各タブで
function todoChips() {
  const inb = (k) => S.inbox.filter((x) => x.kind === k && isOpen(x)).length;
  const dc = decisions();
  const prevMonth = S.plan ? addMonth(curMonth(), -1) : null;
  const manualMissing = S.plan && prevMonth >= (S.plan.goal?.setAt || "").slice(0, 7) && ["rakuten", "adsense", "direct"].some((k) => S.plan.manual?.[prevMonth]?.[k] == null);
  const todos = [
    { n: dc.upcoming.length + dc.past.length, title: "保留中の開催", go: ["decide"] },
    { n: inb("submit"), title: "未対応の申請", go: ["submit", { sub: "open" }] },
    { n: inb("contact"), title: "未対応・対応中の問い合わせ", go: ["contact", { con: "open" }] },
    { n: dc.actions.length, title: "振り返りで、人が行うこと", go: ["decide"] },
    { n: dc.openProps.length, title: "検索の改善案", go: ["decide"] },
    { n: dc.plan.length, title: "KPI・収益化の案", go: ["goal"] },
    { n: manualMissing ? 1 : 0, title: `${prevMonth ? monthLabel(prevMonth) : ""}の実績が未入力`, go: ["goal"] },
    { n: S.pipeline?.summary.due.length || 0, title: "連絡する日が来た営業の相手", go: ["sales"] },
    { n: S.pipeline?.summary.week.short ? S.pipeline.summary.week.guide - S.pipeline.summary.week.count : 0, title: "今週の提案が目安に足りない(件)", go: ["sales"] },
    { n: S.tasks?.attention || S.tasks?.missed || 0, title: "確かめたい予定タスク", go: ["tasks"] },
    { n: staleEvents().length, title: "確認日から60日を過ぎた開催", go: ["events", { evFilter: "stale" }] },
  ].filter((t) => t.n);
  const unpublished = !!(S.pending && (S.pending.uncommitted || S.pending.unpushed));
  return [
    unpublished ? h("p", { class: "callout" }, "サイトに反映していない変更があります(保存はできています)。 ", h("button", { class: "btn small", id: "repub", onclick: republish }, "もう一度公開する")) : "",
    h("div", { class: "todo-strip" }, h("span", { class: "mut small" }, "判断・対応:"),
      todos.length ? todos.map((t) => h("a", { href: "#", class: "tchip", onclick: goTab(...t.go) }, h("b", null, String(t.n)), " ", t.title)) : h("span", { class: "clear" }, "✓ いま決めることはありません")),
  ];
}

async function loadOverview(fresh) {
  view.ovState = "loading";
  if (fresh && view.tab === "home") render();
  try { view.ov = await call("/api/overview" + (fresh ? "?fresh=1" : "")); view.ovError = ""; }
  catch (err) { view.ovError = err.message; }
  view.ovState = "done";
  if (view.tab === "home" && !typing()) render();
}

function homeView() {
  if (!view.ov && view.ovState !== "loading") loadOverview();
  const O = view.ov, rf = S.refresh || {};
  const nav = h("nav", { class: "jump small", "aria-label": "概要の中の移動" }, [["dash-revenue", "売上と目標"], ["dash-traffic", "集客"], ["dash-ops", "運営の信号"], ["dash-listing", "掲載"]].map(([id, t]) =>
    h("a", { href: "#" + id, onclick: (ev) => { ev.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); } }, t)));
  return [
    h("div", { class: "dash-top" }, h("h2", null, "運営の状況"),
      h("span", { class: "mut small" }, `画面: ${at(view.loadedAt)}`, O ? ` ・ 集計: ${at(O.generatedAt)}` : "", rf.hours ? ` ・ ${rf.hours}時間おきに自動で更新` : ""),
      h("button", { class: "btn ghost small", id: "refresh", onclick: refreshNow }, "いますぐ更新")),
    todoChips(),
    O && O.ops.worst !== "ok" ? h("p", { class: "callout sig-alert s-" + O.ops.worst }, h("i", { "aria-hidden": "true" }, SIG[O.ops.worst][0]), " ",
      `運営の信号に「${SIG[O.ops.worst][1]}」があります: `, O.ops.signals.filter((x) => x.state === O.ops.worst).map((x) => x.label).join("・"), " ", h("a", { href: "#dash-ops", onclick: (ev) => { ev.preventDefault(); document.getElementById("dash-ops")?.scrollIntoView({ behavior: "smooth" }); } }, "見る")) : "",
    nav,
    view.ovError ? h("p", { class: "warn" }, `運営の状況を読めませんでした(${view.ovError})。 `, h("button", { class: "btn ghost small", onclick: () => loadOverview(true) }, "もう一度")) : "",
    !O ? h("p", { class: "mut" }, "運営の状況を集めています…(GitHub とサイトを確かめるので、数秒かかります)") : [
      revenueBlock(O.revenue), trafficBlock(O.traffic), opsBlock(O.ops), listingBlock(O.listing)],

    h("h3", { class: "dash-h" }, "そのほか"),
    S.mailReady
      ? h("div", { class: "bar" }, h("button", { class: "btn ghost", id: "fetch", onclick: fetchMail }, "新しい申請・問い合わせを読み込む"),
          h("span", { class: "mut" }, S.lastFetch ? `前回: ${new Date(S.lastFetch).toLocaleString("ja-JP")}` : "まだ読み込んでいません"))
      : h("div", { class: "warn" }, h("p", null, "Gmail の設定がまだありません。リポジトリの ADMIN.md の手順で、admin.local.json を作ってください(GitHub には上がりません)。設定後、この画面を開き直します。")),
    isPc() ? [h("h4", null, "スマホで開く"), phoneBox()] : "",
    h("details", { class: "more mt" }, h("summary", null, "公開のしくみ・数字の出どころ"),
      h("p", { class: "mut" }, "開催の追加・編集・取り下げ・再掲載と、保留の掲載・却下は、保存と同時に、コミットして GitHub に送ります(数分後にサイトに反映)。送る前に、サイトを作れるかを確かめます。KPI・収益化の案・問い合わせのメモは、このPCだけに保存し、GitHub には送りません。"),
      h("p", { class: "mut" }, "売上と集客の数字は、週次の分析(毎週月曜・このPCの予定タスク)が非公開のスプレッドシートから analytics/ に取り込んだものです。公開のサイトや GitHub には出しません。")),
  ];
}

// ---------- 予定タスク(Claude アプリのスケジュール済みタスク。読むだけ) ----------
const RUN = { completed: ["done", "完了"], blocked: ["doing", "止まった"], failed: ["new", "失敗"], error: ["new", "失敗"], running: ["pending", "実行中"] };
const at = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso), diff = Math.round((new Date(d.toDateString()) - new Date(new Date().toDateString())) / 864e5);
  const rel = { "-1": "昨日", 0: "今日", 1: "明日" }[diff];
  return `${rel ? rel + " " : `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]}) `}${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
};
function tasksView() {
  if (!view.tasksLoaded) loadTaskRuns();
  const T = view.tasksData || S.tasks || { tasks: [] };
  if (!T.found) return [h("h2", null, "予定タスク"), h("p", { class: "warn" }, "このPCで、Claude デスクトップアプリの予定タスクの記録が見つかりません。")];
  const card = (t) => h("div", { class: "panel task" + (t.enabled ? "" : " dim") },
    h("div", { class: "card-h" }, h("h4", null, t.title),
      t.missed ? badge("new", "動いていない") : t.issues?.length ? badge("new", "要確認") : t.enabled ? badge("done", "有効") : t.finished ? badge("ended", "完了(1回だけ)") : badge("ended", "停止中")),
    t.description ? h("p", { class: "mut small" }, t.description) : "",
    (t.issues ?? []).filter((x, i) => !(t.missed && i === 0)).map((x) => h("p", { class: "warn small" }, x)),
    t.browser ? h("p", { class: "small" }, "ブラウザを使うタスクです。ブラウザの操作は、予定タスクでも毎回その場での承認が要るため、予定の時刻に PC の前にいないと、承認待ちのまま止まります。PC の前にいる時刻に予定を合わせてください。") : "",
    h("dl", { class: "kv" },
      h("dt", null, "予定"), h("dd", null, t.schedule),
      h("dt", null, "次回"), h("dd", null, t.nextRun ? at(t.nextRun) + " ごろ" : "—"),
      h("dt", null, "前回"), h("dd", null, at(t.lastRun))),
    t.missed ? h("p", { class: "warn small" }, `${at(t.missedAt)} の予定に、動いた記録がありません。その時刻にPCが切れていたか、アプリが閉じていた可能性があります。下の「最近の実行」の理由も見てください。`) : "",
    t.error ? h("p", { class: "warn small" }, t.error) : "",
    t.runs?.length ? h("details", { class: "more", open: t.missed || t.runs[0].needsAction ? true : null }, h("summary", null, `最近の実行(${t.runs.length})`),
      h("ul", { class: "runs" }, t.runs.map((r) => h("li", null,
        h("span", { class: "nw" }, at(r.startedAt), " "), badge(...(RUN[r.status] || ["ended", r.status])), " ", r.summary || h("span", { class: "mut" }, "(ひとことなし)"),
        r.needsAction ? h("div", { class: "small" }, "→ 人がやること: ", r.needsAction) : "")))) : "");
  return [
    h("h2", null, "予定タスク"),
    h("p", { class: "lead" }, "Claude デスクトップアプリが、このPCで決まった時刻に動かす作業です。PC が起動していて、アプリが開いているときだけ動きます。変更は PC のアプリで行います。"),
    T.error ? h("p", { class: "warn" }, T.error) : "",
    T.missed || T.attention ? "" : allClear("止まっている予定タスクはありません。"),
    T.tasks.filter((t) => !t.finished).map(card),
    T.tasks.some((t) => t.finished) ? h("details", { class: "more" }, h("summary", null, `終わった1回だけのタスク(${T.tasks.filter((t) => t.finished).length})`), T.tasks.filter((t) => t.finished).map(card)) : "",
    view.tasksLoaded === "loading" ? h("p", { class: "mut small" }, "最近の実行を読み込んでいます…")
      : h("button", { class: "btn ghost small", onclick: () => { view.tasksLoaded = false; render(); } }, "読み込み直す"),
  ];
}
async function loadTaskRuns() {
  view.tasksLoaded = "loading";
  try { view.tasksData = await call("/api/tasks"); S.tasks = view.tasksData; } catch (err) { toast(err.message, true); }
  view.tasksLoaded = true;
  if (view.tab === "tasks") render();
}

// ---------- スマホで開く(Tailscale 経由。PC の画面だけに出す) ----------
const isPc = () => ["127.0.0.1", "localhost"].includes(location.hostname);
function phoneBox() {
  const p = view.phone;
  if (!p) return h("div", { class: "panel" },
    h("p", { class: "lead" }, "外出先のスマホからも、この画面を開けます(このPCが起動していて、この管理者用ページが動いている間だけ)。"),
    h("button", { class: "btn ghost", onclick: loadPhone }, "スマホ用の QR コードを出す"));
  if (p.loading) return h("p", { class: "mut" }, "調べています…");
  if (!p.ready) return h("div", { class: "panel" },
    h("p", { class: "warn" }, "このPCで Tailscale が見つかりません。次の手順のあと、管理者用ページを開き直してください。"),
    h("ol", { class: "steps" },
      h("li", null, "このPCとスマホに、Tailscale(無料)を入れ、同じアカウントでログインする(", ext("https://tailscale.com/download", "ダウンロード"), ")"),
      h("li", null, "Tailscale の管理画面で、MagicDNS と HTTPS 証明書を有効にする(", ext("https://login.tailscale.com/admin/dns", "DNS の設定"), ")"),
      h("li", null, "このPCで、コマンド ", h("code", null, "tailscale serve --bg 4300"), " を1回だけ実行する(このPCの管理者用ページを、自分の端末だけに https で見せる設定)")),
    h("p", { class: "mut" }, "詳しくは、リポジトリの ADMIN.md の「スマホから開く」。"),
    h("button", { class: "btn ghost small", onclick: loadPhone }, "もう一度調べる"));
  return h("div", { class: "panel phone" },
    h("img", { class: "qr", src: "data:image/svg+xml;base64," + btoa(p.qr), alt: "スマホ用の QR コード", width: "200", height: "200" }),
    h("div", null,
      h("p", { class: "lead" }, "スマホのカメラで読むと、このスマホで管理者用ページが開きます(鍵が入り、90日間はそのまま開けます)。"),
      h("p", { class: "mut" }, "アドレス: https://", p.host, "/ ・ スマホで Tailscale をオンにしておく必要があります。"),
      h("p", { class: "warn small" }, "この QR コードは、スマホの鍵です。ほかの人に見せたり、写真で送ったりしないでください。"),
      h("div", { class: "bar" },
        h("button", { class: "btn ghost small", onclick: () => { view.phone = null; render(); } }, "QR コードを隠す"),
        h("button", { class: "btn ghost small", onclick: resetPhone }, "鍵を作り直す(今までのスマホを締め出す)"))));
}
async function loadPhone() {
  view.phone = { loading: true }; render();
  try { view.phone = await call("/api/phone"); } catch (err) { view.phone = null; toast(err.message, true); }
  render();
}
async function resetPhone() {
  if (!confirm("スマホ用の鍵を作り直します。これまで開けていたスマホは、新しい QR コードを読むまで開けなくなります。よろしいですか？")) return;
  try { await call("/api/phone/reset", {}); toast("鍵を作り直しました。新しい QR コードを読んでください"); await loadPhone(); }
  catch (err) { toast(err.message, true); }
}

// 確認日から60日を過ぎた、掲載中の開催(開催一覧の「要確認」)
function staleEvents() { return S.events.filter((e) => evState(e)[0] === "published" && e.checked && daysSince(e.checked) > 60); }

// 保存のあとの、公開(コミットと push)の結果を知らせる
function published(r, what) {
  const p = r.publish;
  const geo = r.geocode ? "\n" + r.geocode.split("\n").filter((l) => /^(OK|NG|--)/.test(l)).join("\n") : "";
  if (!p || p.ok) return toast(`${what}。サイトに反映しました(数分後に表示が変わります)${geo}`);
  const step = { build: "サイトを作る確認で、問題が見つかりました", test: "開催データのテストで、問題が見つかりました(このまま送ると、GitHub の公開処理が止まります)", commit: "コミットできませんでした", push: "GitHub に送れませんでした" }[p.step] || "公開できませんでした";
  toast(`${what}が、サイトには反映していません。${step}。\n概要の「もう一度公開する」で、やり直せます。\n${(p.log || "").split("\n").slice(-4).join("\n")}`, true);
}
async function republish() {
  const b = $("#repub"); b.disabled = true; b.textContent = "公開しています…";
  try { const r = await call("/api/publish", {}); published(r, "変更を送りました"); render(); }
  catch (err) { toast(err.message, true); b.disabled = false; b.textContent = "もう一度公開する"; }
}

async function fetchMail() {
  const b = $("#fetch"); b.disabled = true; b.textContent = "読み込んでいます…";
  try { const r = await call("/api/fetch-mail", {}); toast(`新しく ${r.added} 件を読み込みました${r.pruned ? `(保存期間を過ぎた ${r.pruned} 件を削除)` : ""}`); render(); }
  catch (err) { toast(err.message, true); b.disabled = false; b.textContent = "新しい申請・問い合わせを読み込む"; }
}

function eventsView() {
  const q = view.evQuery.trim();
  const rows = S.events
    .map((e) => ({ e, st: evState(e) }))
    .filter(({ e, st }) => view.evFilter === "all" || (view.evFilter === "upcoming" ? st[0] === "published" || st[0] === "pending" : view.evFilter === "stale" ? st[0] === "published" && e.checked && daysSince(e.checked) > 60 : st[0] === view.evFilter))
    .filter(({ e }) => !q || [e.name, e.kagura, e.prefecture, e.city, e.venue, e.id].join(" ").includes(q))
    .sort((a, b) => (view.evFilter === "ended" ? b.e.start.localeCompare(a.e.start) : a.e.start.localeCompare(b.e.start)));
  const sel = h("select", { "aria-label": "表示する開催", onchange: (ev) => { view.evFilter = ev.target.value; render(); } },
    ...[["upcoming", "これから(掲載中)"], ["stale", "要確認(確認日から60日超え)"], ["ended", "終了"], ["withdrawn", "取り下げ"], ["all", "すべて"]].map(([v, t]) => h("option", { value: v, selected: view.evFilter === v }, t)));
  const search = h("input", { type: "search", placeholder: "名称・地域で絞り込む", value: view.evQuery, "aria-label": "絞り込み",
    oninput: (ev) => { view.evQuery = ev.target.value; const pos = ev.target.selectionStart; render(); const i = main.querySelector("input[type=search]"); i.focus(); i.setSelectionRange(pos, pos); } });
  return [
    h("h2", null, "開催一覧"),
    h("div", { class: "bar" }, sel, search, h("button", { class: "btn ghost", onclick: () => openEditor(null) }, "開催を追加する"), h("span", { class: "mut" }, `${rows.length} 件`)),
    rows.length ? h("table", null,
      h("thead", null, h("tr", null, h("th", null, "日時"), h("th", null, "名称"), h("th", { class: "hide-sm" }, "場所"), h("th", null, "状態"), h("th", { class: "hide-sm" }, "確認日"), h("th", null, ""))),
      h("tbody", null, rows.map(({ e, st }) => h("tr", null,
        h("td", null, when(e)),
        h("td", null, st[0] === "published" ? ext(pageUrl(e.id), e.name) : e.name, h("div", { class: "mut" }, e.kagura || "")),
        h("td", { class: "hide-sm" }, `${e.prefecture}${e.city || ""}`, h("div", { class: "mut" }, e.venue || "")),
        h("td", null, badge(...st), !e.lat && e.status === "published" ? h("div", null, badge("old", "位置なし")) : ""),
        h("td", { class: "hide-sm nw" }, e.checked || "", st[0] === "published" && e.checked && daysSince(e.checked) > 60 ? h("div", null, badge("old", "要確認")) : ""),
        h("td", { class: "act" },
          h("button", { class: "btn ghost small", onclick: () => openEditor(e) }, "編集"), " ",
          e.status === "pending"
            ? [h("button", { class: "btn small", onclick: () => openEditor({ ...e, checked: S.today }, null, { approve: true }) }, "確かめて掲載"), " ", h("button", { class: "btn ghost small", onclick: () => rejectEvent(e) }, "却下")]
            : e.status === "withdrawn"
            ? h("button", { class: "btn ghost small", onclick: () => setEventStatus(e, "published") }, "再掲載")
            : h("button", { class: "btn ghost small", onclick: () => setEventStatus(e, "withdrawn") }, "取り下げ"))))))
      : h("p", { class: "mut" }, "該当する開催はありません。"),
  ];
}

async function setEventStatus(e, status) {
  const msg = status === "withdrawn" ? `「${e.name}」を取り下げます。すぐにサイトに反映し、数分後に、一覧からもページからも外れます。よろしいですか？` : `「${e.name}」を、もう一度掲載します(すぐにサイトに反映します)。よろしいですか？`;
  if (!confirm(msg)) return;
  toast("保存して公開しています…(数十秒かかることがあります)");
  try { const r = await call("/api/events/status", { id: e.id, status }); published(r, status === "withdrawn" ? "取り下げました" : "掲載に戻しました"); render(); }
  catch (err) { toast(err.message, true); }
}

// ---------- 開催の編集(申請の許可にも使う) ----------
// opts.approve: 保留中の開催を、内容を確かめて掲載する(自動収集の ID は変えない)
function openEditor(e, item, opts = {}) {
  const d = e || {};
  const dlg = $("#dlg"), form = $("#dlg-form");
  const f = (id, label, input, wide) => h("div", { class: "f" + (wide ? " wide" : "") }, h("label", { for: "e-" + id }, label), input, h("small", { class: "err", id: "err-" + id }));
  const inp = (id, v, a = {}) => h("input", { id: "e-" + id, name: id, value: v ?? "", ...a });
  const start = d.start || "", end = d.end || "";
  form.replaceChildren(
    h("h2", null, item || opts.approve ? "内容を確かめて掲載する" : e ? "開催を編集する" : "開催を追加する"),
    item || opts.approve ? h("p", { class: "warn" }, "公式情報のURLを開き、日時・会場が合っているかを確かめてから掲載してください。出典には、確かめたページの名前を入れます。") : "",
    opts.approve && (d.holdReasons || []).length ? h("div", { class: "warn mt" }, h("b", null, "保留の理由"), h("ul", { class: "reasons" }, d.holdReasons.map((r) => h("li", null, r)))) : "",
    h("div", { class: "grid" },
      f("id", "ID(ページのURLになる。英小文字・数字・ハイフン)", inp("id", d.id, { required: true, pattern: "[a-z0-9-]+", readonly: e && !item ? true : null })), // 掲載後の ID は変えない(ページの URL が変わり、リンク切れになる)
      f("name", "名称", inp("name", d.name, { required: true, maxlength: 80 }), true),
      f("kagura", "神楽の種類", inp("kagura", d.kagura, { required: true, maxlength: 40 })),
      f("prefecture", "都道府県", h("select", { id: "e-prefecture", name: "prefecture" }, h("option", { value: "" }, "選択"), S.prefectures.map((p) => h("option", { selected: p === d.prefecture }, p)))),
      f("city", "市区町村", inp("city", d.city, { maxlength: 40 })),
      f("venue", "会場名", inp("venue", d.venue, { maxlength: 80 })),
      f("address", "番地までの住所(任意)", inp("address", d.address, { maxlength: 100 })),
      f("date", "開催日", inp("date", start.slice(0, 10), { type: "date" })),
      f("time", "開始時刻", inp("time", d.timeUnknown ? "" : start.slice(11, 16), { type: "time" })),
      h("div", { class: "f chk" }, h("input", { type: "checkbox", id: "e-timeUnknown", checked: !!d.timeUnknown }), h("label", { for: "e-timeUnknown" }, "時刻は未定・不明")),
      f("enddate", "終了日(任意。空なら開催日と同じ)", inp("enddate", end && end.slice(0, 10) !== start.slice(0, 10) ? end.slice(0, 10) : "", { type: "date" })),
      f("endtime", "終了時刻(任意)", inp("endtime", end.slice(11, 16), { type: "time" })),
      f("fee", "料金(任意)", inp("fee", d.fee, { maxlength: 80 })),
      f("url", "公式情報のURL", inp("url", d.url, { type: "url", maxlength: 300, placeholder: "https://" }), true),
      f("description", "ひとこと説明(300字まで)", h("textarea", { id: "e-description", rows: 3, maxlength: 300 }, d.description || ""), true),
      f("source", "出典(確かめたページの名前)", inp("source", d.source, { maxlength: 80, placeholder: "例: 〇〇町観光協会" })),
      f("socialOrganizer", "SNSの保存会・社中名（SNS掲載時）", inp("socialOrganizer", d.socialEvidence?.organizer, { maxlength: 100 })),
      f("socialAuthorityUrl", "公式アカウントの根拠URL（団体サイト・自治体の紹介など）", inp("socialAuthorityUrl", d.socialEvidence?.authorityUrl, { type: "url", maxlength: 500 })),
      f("socialAuthorityNote", "主体を確認した内容（例: 観光協会の紹介から投稿元へのリンクを確認）", inp("socialAuthorityNote", d.socialEvidence?.authorityNote, { maxlength: 300 }), true),
      h("div", { class: "f chk" }, h("input", { type: "checkbox", id: "e-socialVerified" }), h("label", { for: "e-socialVerified" }, "SNSの個別投稿をログインせずに読み、公式の投稿元・開催日・会場・入力した事実を確認しました（検索要約だけではチェックしない）")),
      f("checked", "確認日", inp("checked", d.checked || S.today, { type: "date" }))),
    h("div", { class: "bar mt" },
      h("button", { class: "btn", value: "save", id: "e-save" }, item || opts.approve ? "許可して掲載する" : "保存する"),
      h("button", { class: "btn ghost", value: "cancel", formnovalidate: true }, "やめる"),
      d.url ? ext(d.url, "公式情報のURLを開く") : ""));
  form.onsubmit = async (ev) => {
    if (ev.submitter?.value !== "save") return;
    ev.preventDefault();
    const v = (id) => $("#e-" + id).value.trim();
    const unknown = $("#e-timeUnknown").checked, date = v("date");
    const endDate = v("enddate") || date;
    const ev2 = { id: v("id"), name: v("name"), kagura: v("kagura"), prefecture: v("prefecture"), city: v("city"), venue: v("venue"), address: v("address"),
      start: date ? `${date}T${unknown ? "00:00" : v("time") || "00:00"}` : "", end: v("endtime") && date ? `${endDate}T${v("endtime")}` : "",
      timeUnknown: unknown || (!!date && !v("time")), fee: v("fee"), url: v("url"), description: v("description"), source: v("source"), checked: v("checked"), socialOrganizer: v("socialOrganizer"), socialAuthorityUrl: v("socialAuthorityUrl"), socialAuthorityNote: v("socialAuthorityNote"), socialVerified: $("#e-socialVerified").checked };
    form.querySelectorAll(".err").forEach((x) => (x.textContent = "")); form.querySelectorAll("[aria-invalid]").forEach((x) => x.removeAttribute("aria-invalid"));
    const btn = $("#e-save"); btn.disabled = true; btn.textContent = "保存して公開しています…(数十秒かかることがあります)";
    try {
      const r = await call("/api/events/save", { event: ev2, originalId: e && !item ? e.id : null, inboxId: item ? item.id : null, approve: !!opts.approve });
      dlg.close();
      published(r, opts.approve ? "掲載しました" : "保存しました");
      render();
    } catch (err) {
      btn.disabled = false; btn.textContent = item || opts.approve ? "許可して掲載する" : "保存する";
      const map = { start: "date", end: "endtime" };
      for (const [k, m] of Object.entries(err.fields || {})) { const id = map[k] || k; const el = $("#err-" + id); if (el) el.textContent = m; $("#e-" + id)?.setAttribute("aria-invalid", "true"); }
      toast(err.message, true);
    }
  };
  dlg.showModal();
}

// ---------- 申請・問い合わせ ----------
const STATUS_FILTER = { submit: [["open", "未対応"], ["published", "掲載済み"], ["rejected", "却下"], ["all", "すべて"]], contact: [["open", "未対応・対応中"], ["done", "完了"], ["all", "すべて"]] };
function inboxView(kind) {
  const key = kind === "submit" ? "sub" : "con", selKey = kind === "submit" ? "selSubmit" : "selContact";
  const items = S.inbox.filter((x) => x.kind === kind).filter((x) => view[key] === "all" || (view[key] === "open" ? isOpen(x) : x.status === view[key]));
  const sel = items.find((x) => x.id === view[selKey]) || null;
  return [
    h("h2", null, kind === "submit" ? "開催登録の申請" : "問い合わせ"),
    h("div", { class: "bar" },
      h("select", { "aria-label": "状態で絞り込む", onchange: (ev) => { view[key] = ev.target.value; render(); } }, STATUS_FILTER[kind].map(([v, t]) => h("option", { value: v, selected: view[key] === v }, t))),
      S.mailReady ? h("button", { class: "btn ghost", id: "fetch", onclick: fetchMail }, "Gmail から読み込む") : "",
      h("span", { class: "mut" }, `${items.length} 件`)),
    items.length ? h("table", null,
      h("thead", null, h("tr", null, h("th", null, "受信"), h("th", null, kind === "submit" ? "名称" : "ご用件"), h("th", { class: "hide-sm" }, kind === "submit" ? "開催日・場所" : "お名前"), h("th", null, "状態"))),
      h("tbody", null, items.map((x) => h("tr", { class: x === sel ? "sel" : "" },
        h("td", null, recv(x.received)),
        h("td", null, h("a", { href: "#", onclick: (ev) => { ev.preventDefault(); view[selKey] = x.id; render(); } }, kind === "submit" ? x.draft?.name || x.subject : x.topic || x.subject)),
        h("td", { class: "hide-sm" }, kind === "submit" ? `${jpDate(x.draft?.start)} ${x.draft?.prefecture || ""}${x.draft?.city || ""}` : x.sender),
        h("td", null, badge(x.status, S.inboxStatus[x.status]))))))
      : h("p", { class: "mut" }, "該当するものはありません。"),
    sel ? detail(sel) : "",
  ];
}

function detail(x) {
  const ev = x.eventId ? S.events.find((e) => e.id === x.eventId) : null;
  const target = x.target && x.target.startsWith(S.baseUrl + "/events/") ? S.events.find((e) => pageUrl(e.id) === x.target.split(/[?#]/)[0]) : null;
  const memo = h("textarea", { rows: 3, class: "full", "aria-label": "メモ", maxlength: 2000 }, x.memo || "");
  const upd = async (body, msg) => { try { await call("/api/inbox/update", { id: x.id, ...body }); toast(msg); render(); } catch (err) { toast(err.message, true); } };
  return h("section", { class: "panel" },
    h("h3", null, x.subject),
    !x.viaForm ? h("p", { class: "warn" }, "このメールは、フォームの送信サービス(Web3Forms)以外から届いています。なりすましの可能性があるため、内容を慎重に確かめてください。") : "",
    h("dl", { class: "kv" },
      h("dt", null, "受信"), h("dd", null, new Date(x.received).toLocaleString("ja-JP")),
      h("dt", null, "送信者"), h("dd", null, `${x.sender || "(名前なし)"} ${x.email ? "<" + x.email + ">" : ""}`),
      ...Object.entries(x.fields).filter(([k]) => !/お名前|メールアドレス/.test(k)).flatMap(([k, v]) => [h("dt", null, k), h("dd", null, /^https:\/\//.test(v) ? ext(v) : v)])),
    x.kind === "contact" && !Object.keys(x.fields).length ? h("pre", null, x.message) : "",
    ev ? h("p", null, "掲載した開催: ", ext(pageUrl(ev.id), ev.name), " ", badge(...evState(ev))) : "",
    h("div", { class: "bar mt" },
      x.kind === "submit" && x.status !== "published" ? h("button", { class: "btn", onclick: () => openEditor({ ...x.draft, source: "", checked: S.today, status: "pending" }, x) }, "内容を確かめて掲載する") : "",
      x.kind === "submit" && x.status !== "rejected" && x.status !== "published" ? h("button", { class: "btn ghost", onclick: () => confirm("この申請を却下します。よろしいですか？(サイトには何も載りません)") && upd({ status: "rejected" }, "却下しました") }, "却下") : "",
      ev && ev.status !== "withdrawn" ? h("button", { class: "btn ghost", onclick: () => setEventStatus(ev, "withdrawn") }, "掲載を取り下げる") : "",
      ev ? h("button", { class: "btn ghost", onclick: () => openEditor(ev) }, "掲載内容を編集") : "",
      target ? h("button", { class: "btn ghost", onclick: () => openEditor(target) }, "対象の開催を編集") : "",
      target && target.status !== "withdrawn" ? h("button", { class: "btn ghost", onclick: () => setEventStatus(target, "withdrawn") }, "対象の開催を取り下げる") : "",
      x.kind === "contact" ? h("select", { "aria-label": "対応状況", onchange: (e2) => upd({ status: e2.target.value }, "対応状況を変えました") },
        ["new", "doing", "done"].map((s) => h("option", { value: s, selected: x.status === s }, S.inboxStatus[s]))) : "",
      x.kind === "submit" && x.status === "new" ? h("button", { class: "btn ghost", onclick: () => upd({ status: "doing" }, "対応中にしました") }, "対応中にする") : "",
      x.kind === "submit" && x.status !== "new" && x.status !== "doing" ? h("button", { class: "btn ghost", onclick: () => upd({ status: "doing" }, "対応中に戻しました") }, "対応中に戻す") : ""),
    x.email ? h("div", { class: "bar" }, h("span", { class: "mut" }, S.gmailUser ? "返信(Gmail の作成画面が開きます):" : "返信(メールアプリが開きます):"), replies(x, ev).map(([label, body]) => h("button", { class: "btn ghost small", onclick: () => mail(x, body) }, label))) : "",
    h("h3", null, "メモ(このPCの中だけに保存)"), memo,
    h("div", { class: "bar mt" }, h("button", { class: "btn ghost small", onclick: () => upd({ memo: memo.value }, "メモを保存しました") }, "メモを保存")));
}

function replies(x, ev) {
  const sign = `\n\n${S.operator}(${S.site})`;
  if (x.kind === "contact") return [["返信を書く", `お問い合わせいただき、ありがとうございます。\n\n${sign}`]];
  return [
    ["掲載のお知らせ", `このたびは開催情報をお寄せいただき、ありがとうございました。公式情報で内容を確認し、次のページに掲載しました。\n${ev ? pageUrl(ev.id) : "(掲載したページのURL)"}\n内容に変更がありましたら、お問い合わせフォームからお知らせください。${sign}`],
    ["出典を尋ねる", `開催情報をお寄せいただき、ありがとうございます。掲載にあたり、日時と会場を確認できる公式のページ(主催者・神社・自治体・観光協会など)を、お教えいただけますでしょうか。${sign}`],
    ["見送りのお知らせ", `開催情報をお寄せいただき、ありがとうございます。公式の情報で内容を確認できなかったため、今回は掲載を見送らせていただきます。公式のページが公開されましたら、あらためてお寄せください。${sign}`],
  ];
}
// 返信は Gmail の作成画面で開く(差出人は、Gmail で既定にした編集部アドレス)。Gmail の設定がなければ、メールアプリで開く
function mail(x, body) {
  const subject = "Re: " + x.subject;
  if (S.gmailUser) {
    const q = new URLSearchParams({ view: "cm", fs: "1", authuser: S.gmailUser, to: x.email, su: subject, body });
    window.open(`https://mail.google.com/mail/?${q}`, "_blank", "noopener,noreferrer");
    return;
  }
  h("a", { href: `mailto:${encodeURIComponent(x.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` }).click();
}

// ---------- 起動 ----------
document.querySelectorAll("#tabs button").forEach((b) => b.addEventListener("click", () => { view.tab = b.dataset.tab; render(); main.focus(); }));
// 状況を読み直す(数時間おき・画面に戻ってきたとき)。入力の途中は描き直さず、終わってから
async function reload() {
  try { S = await call("/api/state"); view.loadedAt = new Date().toISOString(); } catch { return; }
  if (view.tab === "home") loadOverview(); else view.ov = null; // 概要は、開いたときに集め直す
  if (typing()) { reload.later = true; return; }
  render();
}
async function refreshNow() {
  const b = $("#refresh"); if (b) { b.disabled = true; b.textContent = "読み込んでいます…"; }
  try { const r = await call("/api/refresh", {}); view.loadedAt = new Date().toISOString(); toast([r.refresh.git?.text, r.refresh.mail?.text].filter(Boolean).join("\n") || "更新しました"); render(); loadOverview(true); }
  catch (err) { toast(err.message, true); if (b) { b.disabled = false; b.textContent = "いますぐ更新"; } }
}
document.addEventListener("focusout", () => setTimeout(() => { if (reload.later && !typing()) { reload.later = false; render(); } }, 0));
document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - Date.parse(view.loadedAt || 0) > 30 * 60e3) reload(); });
call("/api/state").then((j) => {
  S = j; view.loadedAt = new Date().toISOString(); render();
  // サーバーが数時間おきに読み込むので、画面も同じ間隔で読み直す(少し遅らせて、読み込みのあとに)
  const hours = S.refresh?.hours || 3;
  setInterval(reload, hours * 3600e3 + 5 * 60e3);
}).catch((err) => { main.replaceChildren(h("p", { class: "warn" }, err.message)); });
