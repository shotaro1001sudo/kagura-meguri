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
  $("#n-tasks").textContent = S.tasks?.missed || "";
  $("#n-claude").textContent = jobsToCheck().length || "";
  main.replaceChildren(...({ home: homeView, decide: decideView, goal: goalView, claude: jobsView, tasks: tasksView, events: eventsView, submit: () => inboxView("submit"), contact: () => inboxView("contact") }[view.tab])().flat(Infinity).filter((x) => x != null && x !== ""));
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
    closed ? (p.status === "declined" ? h("div", { class: "bar mt" }, h("button", { class: "btn ghost small", onclick: () => setProposal(p, "proposed") }, "見送りを戻す")) : "")
      : h("div", { class: "bar mt" },
        jobFor(p.id) ? jobLink(jobFor(p.id)) : h("button", { class: "btn", onclick: () => askClaude(p) }, "Claude に任せる"),
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
      ...secHead("検索の改善案", d.openProps.length, "やるものは「Claude に任せる」、やらないものは「見送る」。Claude の作業の結果は「Claude に任せる」のタブで見て、公開するかを決めます。",
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
function askClaude(p) {
  const note = prompt(`${p.id} を Claude に任せます。\n専用の作業用フォルダで作業し、終わったら「Claude に任せる」のタブで結果を見て、公開するかを決めます。\n\n補足があれば書いてください(空でも構いません)。`, "");
  if (note === null) return;
  startJob({ kind: "proposal", id: p.id, note });
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
  if (id === "contracts" || id === "pitches") return { v: man[id] ?? null, missing: man[id] == null ? ["手入力"] : [] };
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
  const order = { proposed: 0, adopted: 1, done: 2, declined: 3 };
  const sorted = (list) => [...list].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

  const kpiButtons = (k) => k.status === "proposed"
    ? [h("button", { class: "btn small", onclick: () => setPlan("kpi", k, "adopted") }, "採用する"), h("button", { class: "btn ghost small", onclick: () => editTargets(k) }, "目標の数を変える"), h("button", { class: "btn ghost small", onclick: () => setPlan("kpi", k, "declined") }, "見送る")]
    : k.status === "adopted" ? [h("button", { class: "btn ghost small", onclick: () => editTargets(k) }, "目標の数を変える"), h("button", { class: "btn ghost small", onclick: () => setPlan("kpi", k, "proposed") }, "提案中に戻す")]
    : [h("button", { class: "btn ghost small", onclick: () => setPlan("kpi", k, "proposed") }, "提案中に戻す")];
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
    : m.status === "adopted" ? [jobFor(m.id) ? jobLink(jobFor(m.id)) : h("button", { class: "btn small", onclick: () => askMon(m) }, "Claude に任せる"), h("button", { class: "btn ghost small", onclick: () => setPlan("mon", m, "done") }, "実施済みにする"), h("button", { class: "btn ghost small", onclick: () => setPlan("mon", m, "proposed") }, "提案中に戻す")]
    : [h("button", { class: "btn ghost small", onclick: () => setPlan("mon", m, "proposed") }, "提案中に戻す")];
  const monCard = (m) => h("section", { class: "panel decision" + (m.status === "declined" ? " dim" : "") },
    h("div", { class: "card-h" }, h("h4", null, h("span", { class: "mut" }, m.id, " "), m.title), stBadge(m.status)),
    h("p", { class: "chips" },
      m.expectedYen ? h("span", { class: "chip" }, `見込み 月 ${yen(m.expectedYen[0])}〜${yen(m.expectedYen[1])}`) : "",
      m.effort ? h("span", { class: "chip" }, `手間 ${m.effort}`) : ""),
    h("p", null, m.summary || ""),
    h("p", { class: "next" }, h("b", null, "最初の一歩: "), m.firstStep || ""),
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

    ...secHead("収益化の案", openMons, "採用したら「Claude に任せる」。結果を見て公開すると「実施済み」になります。人が行う部分(営業・契約など)だけの案は、終えたら「実施済みにする」。",
      "営業・契約・リンクの発行など、人が行う部分は「最初の一歩」を見てください。採用・見送りは、このPCの analytics/plan.json にだけ保存し、GitHub には送りません。"),
    sorted(p.monetization).map(monCard),

    ...secHead("KPI", openKpis, "月ごとの目標と実績です。実績の * は、まだ含まれていない分があるもの(数字にマウスを置くと出ます)。",
      "バリューコマースの報酬・セッション・広告のクリックは、毎週月曜の分析が自動で入れます。楽天・AdSense・協賛と、契約・提案の数は、下の「実績を入れる」で入れます。目標の数は、採用の前でも後でも変えられます。"),
    sorted(p.kpis).map(kpiCard),

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
    toast({ adopted: "採用しました", declined: "見送りにしました", done: "実施済みにしました", proposed: "提案中に戻しました" }[status]);
    render();
    if (kind === "mon" && status === "adopted") askMon(S.plan.monetization.find((m) => m.id === x.id) || x);
  } catch (err) { toast(err.message, true); }
}
function askMon(m) {
  const note = prompt(`「${m.title}」を Claude に任せますか？\n専用の作業用フォルダで作業し、終わったら「Claude に任せる」のタブで結果を見て、公開するかを決めます。\n\n補足があれば書いてください(空でも構いません)。任せないときは「キャンセル」。`, "");
  if (note === null) return;
  startJob({ kind: "mon", id: m.id, note });
}

// ---------- Claude に任せる(1件ごとに専用の作業用フォルダ。結果を見て、公開するかを決める) ----------
const ATTN = new Set(["review", "answered", "failed"]), BUSY = new Set(["queued", "running", "publishing"]);
const jobsToCheck = () => (S.jobs || []).filter((j) => ATTN.has(j.status));
const jobFor = (id) => (S.jobs || []).find((j) => j.source?.id === id && (ATTN.has(j.status) || BUSY.has(j.status)));
const jobLink = (j) => h("a", { href: "#", class: "btn ghost small", onclick: goTab("claude") }, `Claude: ${S.jobStatus[j.status] || j.status} →`);
const JOB_BADGE = { queued: "pending", running: "doing", review: "new", answered: "new", failed: "rejected", publishing: "doing", published: "done", discarded: "ended" };
async function startJob(body) {
  try {
    const r = await call("/api/jobs/start", body);
    toast(`Claude に任せました: ${r.job.title}\n「Claude に任せる」のタブで、進み具合と結果を見られます。`);
    pollJobs(); render();
  } catch (err) { toast(err.message, true); }
}
function jobsView() {
  const c = S.claude || {};
  const jobs = S.jobs || [];
  const att = jobs.filter((j) => ATTN.has(j.status)), busy = jobs.filter((j) => BUSY.has(j.status)), old = jobs.filter((j) => !ATTN.has(j.status) && !BUSY.has(j.status));
  const draft = (k) => view.drafts?.[k] ?? "";
  const keep = (k) => (ev) => { view.drafts = { ...(view.drafts || {}), [k]: ev.target.value }; };
  const form = h("form", { class: "panel", onsubmit: async (ev) => {
    ev.preventDefault();
    const text = form.elements.ask.value.trim();
    if (!text) return toast("頼む内容を書いてください", true);
    await startJob({ kind: "free", text });
    view.drafts = { ...(view.drafts || {}), new: "" }; render();
  } },
    h("label", { for: "ask", class: "small mut" }, "Claude に頼むこと(サイトの文・ページ・仕組みの変更、調べものなど)"),
    h("textarea", { id: "ask", name: "ask", rows: 4, class: "full", maxlength: 8000, placeholder: "例: 島根県の開催一覧のページに、初めての人向けの見方の説明を足して", oninput: keep("new") }, draft("new")),
    h("div", { class: "bar mt" }, h("button", { class: "btn", type: "submit", disabled: c.loggedIn ? null : true }, "Claude に任せる"),
      h("span", { class: "mut small" }, "1件ごとに専用の作業用フォルダで動くので、ほかの作業や、このPCの作業中のファイルに影響しません。GitHub に送るのは、結果を見て「公開する」を押したときだけです。")));
  const login = !c.exe ? h("p", { class: "warn" }, "このPCで、Claude アプリの Claude Code が見つかりません。Claude デスクトップアプリを入れて、一度開いてください。")
    : !c.loggedIn ? h("div", { class: "warn" }, h("p", null, "Claude に作業を任せるには、このPCで、最初に1回だけ Claude にログインします(Claude アプリと同じアカウント)。"),
        h("div", { class: "bar" }, isPc() ? h("button", { class: "btn small", onclick: claudeLogin }, "Claude にログインする") : h("span", { class: "mut small" }, "ログインは PC の画面から行います。"),
          h("button", { class: "btn ghost small", onclick: claudeCheck }, "ログインを確かめ直す")))
    : "";
  return [
    h("h2", null, "Claude に任せる"),
    login,
    form,
    ...secHead("確認すること", att.length, "結果を読んで、「公開する」「返事を送る」「やめる」のどれかを選びます。"),
    att.length ? att.map(jobCard) : allClear("確認することはありません。"),
    busy.length ? [...secHead("作業中・順番待ち", busy.length), busy.map(jobCard)] : "",
    old.length ? h("details", { class: "mt" }, h("summary", null, `終わった作業(${old.length}件。30日で消えます)`), old.map(jobCard)) : "",
  ];
}
function jobCard(j) {
  const last = [...(j.turns || [])].reverse().find((t) => t.who === "claude");
  const asked = (j.turns || [])[0];
  const key = "r-" + j.id;
  const replyBox = j.canReply && ATTN.has(j.status) ? h("form", { class: "mt", onsubmit: async (ev) => {
    ev.preventDefault();
    const text = ev.target.elements.text.value.trim();
    if (!text) return toast("返事を書いてください", true);
    try { await call("/api/jobs/reply", { id: j.id, text }); view.drafts = { ...(view.drafts || {}), [key]: "" }; toast("返事を送りました。Claude が続きを始めます"); pollJobs(); render(); }
    catch (err) { toast(err.message, true); }
  } },
    h("label", { for: key, class: "small mut" }, j.question ? "質問への返事" : "続けて頼むこと・直してほしいこと"),
    h("textarea", { id: key, name: "text", rows: 2, class: "full", maxlength: 8000, oninput: (ev) => { view.drafts = { ...(view.drafts || {}), [key]: ev.target.value }; } }, view.drafts?.[key] ?? ""),
    h("div", { class: "bar mt" }, h("button", { class: "btn small" + (j.question ? "" : " ghost"), type: "submit" }, "返事を送る"))) : "";
  const pub = j.publish;
  return h("section", { class: "panel decision job" },
    h("div", { class: "card-h" }, h("h4", null, j.title), badge(JOB_BADGE[j.status] || "ended", S.jobStatus[j.status] || j.status)),
    h("p", { class: "mut small" }, `頼んだ日時: ${at(j.createdAt)}${j.endedAt && !BUSY.has(j.status) ? ` ・ 終わった日時: ${at(j.endedAt)}` : ""}`),
    asked ? h("details", { class: "more" }, h("summary", null, "頼んだ内容・やり取り"), (j.turns || []).map((t) => h("div", { class: "turn " + t.who }, h("small", { class: "mut" }, t.who === "you" ? "あなた" : "Claude", " ・ ", at(t.at)), h("pre", null, t.text)))) : "",
    BUSY.has(j.status) ? [h("p", { class: "small" }, j.status === "queued" ? "順番を待っています…" : j.status === "publishing" ? "確認のビルドとテストをして、GitHub に送っています…(数分かかります)" : "作業しています…"),
      j.progress?.length ? h("ul", { class: "runs small" }, j.progress.slice(-8).map((p) => h("li", null, h("span", { class: "nw mut" }, at(p.at), " "), p.text))) : ""] : "",
    j.question ? h("div", { class: "callout" }, h("b", null, "Claude からの質問"), h("pre", null, j.question))
      : last && !BUSY.has(j.status) ? h("div", { class: "answer" }, h("b", { class: "small mut" }, "Claude の返事"), h("pre", null, last.text)) : "",
    j.error && j.status === "failed" ? h("p", { class: "warn small" }, j.error) : "",
    j.files?.length ? h("details", { class: "more", open: j.status === "review" ? true : null }, h("summary", null, `変えたファイル(${j.files.length}) ・ コミット ${j.commits} 件`),
      h("ul", { class: "files small" }, j.files.map((f) => { const [st, ...p] = f.split("\t"); return h("li", null, h("span", { class: "mut" }, { A: "追加", M: "変更", D: "削除", R: "名前の変更" }[st[0]] || st, " "), p.join(" → ")); }))) : "",
    j.dirty ? h("p", { class: "warn small" }, "コミットしていない変更があります。公開する前に、Claude に「コミットして」と返事を送ってください。") : "",
    j.denied?.length ? h("details", { class: "more" }, h("summary", null, `許可していないため、できなかった操作(${j.denied.length})`), h("ul", { class: "small" }, j.denied.map((d) => h("li", null, d)))) : "",
    pub && !pub.ok ? h("div", { class: "warn small" }, h("b", null, { build: "サイトを作る確認で、問題が見つかりました", test: "テストで、問題が見つかりました", rebase: "GitHub の最新と重なりました", push: "GitHub に送れませんでした" }[pub.step] || "公開できませんでした"), h("pre", null, (pub.log || "").split("\n").slice(-8).join("\n"))) : "",
    pub && pub.ok ? h("p", { class: "clear small" }, `✓ GitHub に送りました${pub.commit ? `(${pub.commit})` : ""}。数分後にサイトに反映します。${pub.note || ""}`) : "",
    replyBox,
    ATTN.has(j.status) ? h("div", { class: "bar mt" },
      j.status === "review" ? h("button", { class: "btn", onclick: () => publishJob(j), disabled: j.dirty ? true : null }, "公開する") : "",
      h("button", { class: "btn ghost", onclick: () => discardJob(j) }, j.status === "review" ? "やめる(変更を捨てる)" : "閉じる")) : "");
}
async function publishJob(j) {
  if (!confirm(`「${j.title}」の変更(コミット ${j.commits} 件)を公開します。\nGitHub の最新に重ね、サイトを作る確認とテストが通れば、GitHub に送ります(数分後にサイトに反映)。よろしいですか？`)) return;
  toast("確認のビルドとテストをして、公開しています…(数分かかることがあります)");
  try {
    const r = await call("/api/jobs/publish", { id: j.id });
    if (r.publish?.ok) toast(`公開しました。数分後にサイトに反映します${r.publish.synced === false ? "\n(このPCのいつものフォルダは、次の更新のときに最新にします)" : ""}`);
    else toast(`公開できませんでした。カードに理由を出しました。`, true);
    render();
  } catch (err) { toast(err.message, true); }
}
async function discardJob(j) {
  if (j.status === "review" && !confirm(`「${j.title}」の変更を捨てます(GitHub には何も送りません)。よろしいですか？`)) return;
  try { await call("/api/jobs/discard", { id: j.id }); toast(j.status === "review" ? "変更を捨てました" : "閉じました"); render(); }
  catch (err) { toast(err.message, true); }
}
async function claudeLogin() {
  try { await call("/api/claude/login", {}); toast("ログインの黒い画面を開きました。ブラウザでログインを終えたら、「ログインを確かめ直す」を押してください。"); }
  catch (err) { toast(err.message, true); }
}
async function claudeCheck() {
  try { const r = await call("/api/claude"); S.claude = r.claude; toast(r.claude.loggedIn ? "ログインできています" : "まだログインしていません", !r.claude.loggedIn); render(); }
  catch (err) { toast(err.message, true); }
}
// 作業中のものがある間は、数秒おきに進み具合を読む。入力の途中は、画面を描き直さない(書いた文が消えないように)
const typing = () => { const a = document.activeElement; return !!a && (a.matches("textarea, input, select") || !!a.closest("dialog[open]")); };
function pollJobs() {
  if (pollJobs.t) return;
  pollJobs.t = setTimeout(async () => {
    pollJobs.t = null;
    try {
      const r = await call("/api/jobs");
      const changed = JSON.stringify(r.jobs) !== JSON.stringify(S.jobs);
      S.jobs = r.jobs; S.claude = r.claude;
      if (changed) {
        // 終わった作業を知らせる
        if (r.jobs.some((j) => ATTN.has(j.status) && pollJobs.busy?.has(j.id))) toast("Claude の作業が終わりました。「Claude に任せる」のタブで確認してください");
        if (typing()) $("#n-claude").textContent = jobsToCheck().length || ""; else render();
      }
      pollJobs.busy = new Set(r.jobs.filter((j) => BUSY.has(j.status)).map((j) => j.id));
      if (pollJobs.busy.size) pollJobs();
    } catch { pollJobs(); }
  }, document.hidden ? 30e3 : 4e3);
}
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

function homeView() {
  const st = S.events.map(evState);
  const count = (k) => st.filter(([s]) => s === k).length;
  const inb = (k) => S.inbox.filter((x) => x.kind === k && isOpen(x)).length;
  const old = staleEvents().length;
  const dc = decisions();
  const unpublished = !!(S.pending && (S.pending.uncommitted || S.pending.unpushed));
  const prevMonth = S.plan ? addMonth(curMonth(), -1) : null;
  const manualMissing = S.plan && prevMonth >= (S.plan.goal?.setAt || "").slice(0, 7) && ["rakuten", "adsense", "direct"].some((k) => S.plan.manual?.[prevMonth]?.[k] == null);
  // 今日やること: 件数・ひとこと・行き先。0 件のものは、下に「済み」として1行にまとめる
  const todos = [
    { n: unpublished ? 1 : 0, unit: "", title: "サイトに反映していない変更", desc: "保存はできています。もう一度、公開してください。", btn: h("button", { class: "btn", id: "repub", onclick: republish }, "もう一度公開する"), urgent: true },
    { n: dc.upcoming.length + dc.past.length, title: "保留中の開催", desc: "公式情報を確かめて、掲載か却下を選ぶ", go: ["decide"] },
    { n: inb("submit"), title: "未対応の申請", desc: "投稿フォームからの掲載依頼", go: ["submit", { sub: "open" }] },
    { n: inb("contact"), title: "未対応・対応中の問い合わせ", desc: "お問い合わせフォームのメール", go: ["contact", { con: "open" }] },
    { n: dc.actions.length, title: "振り返りで、人が行うこと", desc: "週次の振り返りの【人】の項目", go: ["decide"] },
    { n: jobsToCheck().length, title: "Claude の作業の確認", desc: "結果を読んで、公開するか・返事を送るか・やめるかを選ぶ", go: ["claude"] },
    { n: dc.openProps.length, title: "検索の改善案", desc: "Claude に任せるか、見送るかを選ぶ", go: ["decide"] },
    { n: dc.plan.length, title: "KPI・収益化の案", desc: "採用するか、見送るかを選ぶ", go: ["goal"] },
    { n: manualMissing ? 1 : 0, unit: "", title: `${prevMonth ? monthLabel(prevMonth) : ""}の実績が未入力`, desc: "楽天・AdSense・協賛の額を入れる", go: ["goal"] },
    { n: S.tasks?.missed || 0, title: "動いていない予定タスク", desc: "予定の時刻に動いた記録がない。理由を見て直す", go: ["tasks"] },
    { n: old, title: "確認日から60日を過ぎた開催", desc: "公式情報で、変更がないか確かめる", go: ["events", { evFilter: "stale" }] },
  ];
  const row = (t) => h("li", { class: "todo" + (t.urgent ? " urgent" : "") },
    h("span", { class: "todo-n" }, t.unit === "" ? "!" : String(t.n)),
    h("span", { class: "todo-t" }, h("b", null, t.title), h("small", null, t.desc)),
    t.btn || h("a", { href: "#", class: "btn small", onclick: goTab(...t.go) }, "開く"));
  const open = todos.filter((t) => t.n), done = todos.filter((t) => !t.n && t.unit !== "");
  const g = S.plan?.goal;
  const rev = S.plan ? actual("revenue", curMonth()) : null;
  const target = S.plan?.kpis.find((k) => k.id === "revenue")?.targets?.[curMonth()];
  const stat = (n, label, go) => h("a", { href: "#", class: "stat", onclick: goTab(...go) }, h("b", null, String(n)), h("span", null, label));
  const rf = S.refresh || {}, lr = rf.last;
  return [
    h("h2", null, "今日やること"),
    h("div", { class: "bar small mut" },
      h("span", null, `画面の更新: ${at(view.loadedAt)}`, rf.hours ? ` ・ ${rf.hours}時間おきに、GitHub の最新と Gmail を自動で読み込みます` : ""),
      h("button", { class: "btn ghost small", id: "refresh", onclick: refreshNow }, "いますぐ更新")),
    lr ? h("p", { class: "small mut" }, `前回の自動の読み込み: ${at(lr.at)} ・ ${[lr.git?.text, lr.mail?.text].filter(Boolean).join(" ・ ")}`) : "",
    lr && (lr.git?.ok === false || lr.mail?.ok === false) ? h("p", { class: "warn small" }, [lr.git, lr.mail].filter((x) => x && x.ok === false).map((x) => x.text).join("\n")) : "",
    open.length ? h("ul", { class: "todos" }, open.map(row)) : allClear("いまやることはありません。"),
    done.length ? h("p", { class: "mut small" }, "✓ 済み: ", done.map((t) => t.title).join("・")) : "",

    g ? [h("h3", null, "目標の進み具合"),
      h("a", { href: "#", class: "panel goal-mini", onclick: goTab("goal") },
        h("span", null, h("small", null, "最終目標"), h("b", null, g.title || "")),
        h("span", null, h("small", null, "今月の売上"), h("b", null, num(rev.v, "円")), rev.missing.length ? h("small", { class: "mut" }, "未入力あり") : ""),
        h("span", null, h("small", null, "今月の目標"), h("b", null, num(target ?? null, "円"))),
        h("span", { class: "go" }, "目標・収益を開く →"))] : "",

    h("h3", null, "サイトの開催"),
    h("div", { class: "stats" },
      stat(count("published"), "掲載中", ["events", { evFilter: "upcoming" }]),
      stat(count("ended"), "終了", ["events", { evFilter: "ended" }]),
      stat(count("withdrawn"), "取り下げ", ["events", { evFilter: "withdrawn" }])),

    h("h3", null, "Gmail から読み込む"),
    S.mailReady
      ? h("div", { class: "bar" }, h("button", { class: "btn ghost", id: "fetch", onclick: fetchMail }, "新しい申請・問い合わせを読み込む"),
          h("span", { class: "mut" }, S.lastFetch ? `前回: ${new Date(S.lastFetch).toLocaleString("ja-JP")}` : "まだ読み込んでいません"))
      : h("div", { class: "warn" }, h("p", null, "Gmail の設定がまだありません。リポジトリの ADMIN.md の手順で、admin.local.json を作ってください(GitHub には上がりません)。設定後、この画面を開き直します。")),
    isPc() ? [h("h3", null, "スマホで開く"), phoneBox()] : "",
    h("details", { class: "more mt" }, h("summary", null, "公開のしくみ"),
      h("p", { class: "mut" }, "開催の追加・編集・取り下げ・再掲載と、保留の掲載・却下は、保存と同時に、コミットして GitHub に送ります(数分後にサイトに反映)。送る前に、サイトを作れるかを確かめます。終了した開催は、サイトの一覧・地図・カレンダーから自動で外れ、ページは「終了しました」として残ります。KPI・収益化の案・問い合わせのメモは、このPCだけに保存し、GitHub には送りません。")),
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
      t.missed ? badge("new", "動いていない") : t.enabled ? badge("done", "有効") : badge("ended", "停止中")),
    t.description ? h("p", { class: "mut small" }, t.description) : "",
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
    T.missed ? "" : allClear("止まっている予定タスクはありません。"),
    T.tasks.map(card),
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
  if (S.jobs?.some((j) => BUSY.has(j.status))) pollJobs();
  if (typing()) { reload.later = true; return; }
  render();
}
async function refreshNow() {
  const b = $("#refresh"); if (b) { b.disabled = true; b.textContent = "読み込んでいます…"; }
  try { const r = await call("/api/refresh", {}); view.loadedAt = new Date().toISOString(); toast([r.refresh.git?.text, r.refresh.mail?.text].filter(Boolean).join("\n") || "更新しました"); render(); }
  catch (err) { toast(err.message, true); if (b) { b.disabled = false; b.textContent = "いますぐ更新"; } }
}
document.addEventListener("focusout", () => setTimeout(() => { if (reload.later && !typing()) { reload.later = false; render(); } }, 0));
document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - Date.parse(view.loadedAt || 0) > 30 * 60e3) reload(); });
call("/api/state").then((j) => {
  S = j; view.loadedAt = new Date().toISOString(); render();
  if (S.jobs?.some((x) => BUSY.has(x.status))) pollJobs();
  // サーバーが数時間おきに読み込むので、画面も同じ間隔で読み直す(少し遅らせて、読み込みのあとに)
  const hours = S.refresh?.hours || 3;
  setInterval(reload, hours * 3600e3 + 5 * 60e3);
}).catch((err) => { main.replaceChildren(h("p", { class: "warn" }, err.message)); });
