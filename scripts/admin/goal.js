// 目標・収益(このPCだけに保存。GitHub には送らない): 売上と目標 / 収益化の案 / 目標の数字(KPI) / 実績を入れる
// 実績は、自動の分(週次の分析が入れる)と、手入力の分(楽天・AdSense・協賛など)
import { h, S, view, render, call, toast, undoToast, fail, askReason, openForm, field, input, badge, chip, seg, more, kv, note, loading, icon, yen, num, curMonth, addMonth, monthLabel, copyPrompt, promptBox, goLink } from "./ui.js";
import { overview, loadOverview, columnChart, tile, paceMeter, valueOf, PACE } from "./dash.js";
import { promptFor } from "./todo.js";

export function planOpen() {
  const p = S.plan;
  if (!p) return [];
  return [...p.kpis.map((x) => ({ kind: "kpi", ...x })), ...p.monetization.map((x) => ({ kind: "mon", ...x }))].filter((x) => x.status === "proposed");
}
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

async function setPlan(kind, x, status, quiet) {
  let reason = "";
  if (status === "declined") { reason = await askReason(x.name || x.title); if (reason === null) return; }
  const before = x.status;
  try {
    await call("/api/plan/item", { kind, id: x.id, status, note: reason });
    const msg = { adopted: "採用しました", declined: "見送りにしました", done: "実施済みにしました", proposed: "「検討中」に戻しました" }[status];
    if (quiet || status === "proposed") toast(msg); else undoToast(msg, () => setPlan(kind, { ...x, status }, before, true));
    render();
  } catch (err) { fail(err); }
}
function editTargets(k) {
  const months = Object.keys(k.targets || {}).sort();
  openForm({ title: `目標の数を変える: ${k.name}`, intro: h("p", { class: "mut" }, `月ごとの目標です(単位: ${k.unit})。このPCにだけ保存します。`),
    body: h("div", { class: "grid" }, months.map((m) => field("t-" + m, monthLabel(m), input("t-" + m, k.targets[m], { type: "number", min: "0", step: "1", required: true, inputmode: "numeric" })))),
    onSubmit: async (form) => {
      const targets = {};
      for (const m of months) targets[m] = Number(form.elements["t-" + m].value);
      await call("/api/plan/item", { kind: "kpi", id: k.id, targets });
      toast("目標の数を保存しました"); render();
    } });
}

// ---------- 売上と目標(数字とグラフ。読むだけ) ----------
function revenuePart(p) {
  const g = p.goal || {}, O = overview(), R = O?.revenue;
  const adopted = p.monetization.filter((m) => ["adopted", "done"].includes(m.status) && m.expectedYen).reduce((a, m) => [a[0] + m.expectedYen[0], a[1] + m.expectedYen[1]], [0, 0]);
  const pct = g.monthlyRevenueYen ? Math.min(100, Math.round((adopted[1] / g.monthlyRevenueYen) * 100)) : 0;
  const goalBox = h("section", { class: "card" },
    h("div", { class: "card-h" }, h("h2", null, g.title || "最終目標"), g.deadline ? h("span", { class: "mut" }, `${g.deadline.replace(/-/g, "/")} までに`) : ""),
    h("div", { class: "meter-l" }, h("span", null, "採用した収益化の案で届く見込み"), h("span", null, `月 ${yen(adopted[0])}〜${yen(adopted[1])} / ${yen(g.monthlyRevenueYen)}`)),
    h("progress", { class: "meter", max: "100", value: String(pct), "aria-label": `採用した案で、目標の ${pct}%` }),
    g.outlook ? more("見立て・売上の数え方", h("p", { class: "mut" }, g.outlook), g.definition ? h("p", { class: "mut" }, g.definition) : "") : "");
  if (!R) return [goalBox, view.ovError ? note("warn", `売上の数字を読めませんでした(${view.ovError})。 `, h("button", { class: "btn sm", onclick: () => loadOverview(true) }, "もう一度読み込む")) : loading("売上の数字を集めています…")];
  const n = R.now;
  const missing = (m) => (m?.length ? h("small", { class: "mut" }, "未入力: " + m.join("・")) : h("small", { class: "mut" }, "すべて入力済み"));
  const tiles = h("div", { class: "stats" },
    tile("今月の売上(見込み)", yen(n.value), missing(n.missing)),
    tile("今月の目標", n.target ? yen(n.target) : "なし",
      n.pace ? h("small", { class: "delta " + PACE[n.pace.state][0] }, `${PACE[n.pace.state][1]}(今日までの目安 ${yen(n.pace.expected)})`)
        : !n.target && R.nextTarget ? h("small", { class: "mut" }, `${monthLabel(R.nextTarget.month)}から ${yen(R.nextTarget.value)}`) : ""),
    tile("先月の売上", yen(R.prev.value), missing(R.prev.missing)),
    tile("目標の月まで", R.goal.targetMonth ? `あと ${R.goal.monthsLeft} か月` : "—", h("small", { class: "mut" }, R.goal.targetMonth ? monthLabel(R.goal.targetMonth) : "")));
  const mShort = (m) => `${+m.slice(5, 7)}月`;
  const chart = columnChart({
    label: "月ごとの売上と目標(円)", unit: "円",
    items: R.months.map((m) => ({ label: mShort(m.month), sub: m.current ? "今月" : "", value: m.future ? null : m.value, target: m.target, partial: m.current,
      tip: [m.future ? `目標 ${yen(m.target)}` : `${yen(m.value)}${m.current ? "(途中)" : ""}`, monthLabel(m.month), ...(m.future ? [] : [m.target != null ? `目標 ${yen(m.target)}` : "目標なし"]), ...(!m.future && m.missing.length ? ["未入力: " + m.missing.join("・")] : [])] })),
    table: { head: ["月", "売上", "目標", "未入力"], rows: R.months.map((m) => [monthLabel(m.month), m.future ? "" : yen(m.value), m.target == null ? "—" : yen(m.target), m.future ? "" : m.missing.join("・")]) },
  });
  const parts = h("p", { class: "small mut" }, "今月の内訳: ", n.parts.map((x, i) => [i ? " ・ " : "", `${x.label} ${x.value == null ? "未入力" : yen(x.value)}`]));
  const lead = h("div", { class: "scroll" }, h("table", { class: "num kpis" },
    h("caption", null, "売上につながる数字(今月)"),
    h("thead", null, h("tr", null, ["項目", "今月", "今月の目標", "進み具合", "先月"].map((c) => h("th", { scope: "col" }, c)))),
    h("tbody", null, R.leading.map((k) => h("tr", null,
      h("th", { scope: "row" }, k.name),
      h("td", null, valueOf(k.value, k.unit), k.value != null && k.days ? h("small", { class: "mut" }, ` (${k.days}日分)`) : "", k.value == null ? h("small", { class: "mut" }, " " + k.missing.join("・")) : ""),
      h("td", null, k.target != null ? valueOf(k.target, k.unit) : k.nextTarget ? h("span", { class: "mut" }, `${mShort(k.nextTarget[0])}から ${valueOf(k.nextTarget[1], k.unit)}`) : "—"),
      h("td", null, paceMeter(k.value, k.target, k.pace)),
      h("td", null, valueOf(k.prev, k.unit)))))));
  return [tiles, goalBox, h("section", { class: "card" }, chart, parts), h("section", { class: "card" }, lead),
    h("p", { class: "mut small" }, "売上は、広告・アフィリエイトの報酬と、協賛・有料プランの収入の合計です。楽天・AdSense・協賛は「実績を入れる」で入れた額、ほかは毎週月曜の分析が自動で入れます。")];
}

// ---------- 収益化の案・目標の数字: 状態で切り替えて見る(検討中・採用・実施済み・見送り) ----------
const PLAN_GROUPS = [["proposed", "検討中", "まだ決めていない案です。「採用する」か「見送る」を押してください。"], ["adopted", "採用", "採用して、これから行う・行っている案です。"],
  ["done", "実施済み", "やり終えた案です。"], ["declined", "見送り(却下)", "見送った案です。理由を書いたものは、横に出ます。"]];
const stBadge = (st) => badge({ proposed: "info", adopted: "ok", declined: "mut", done: "ok" }[st] || "info", S.planStatus[st] || st);
function statusGroups(key, list, card, short) {
  const groups = PLAN_GROUPS.filter(([st]) => !(key === "kpiSt" && st === "done")); // 目標の数字に「実施済み」はない
  const n = (st) => list.filter((x) => x.status === st).length;
  const valid = groups.some(([st]) => st === view[key]);
  const cur = valid ? view[key] : n("proposed") ? "proposed" : "adopted";
  const [, label, lead] = groups.find(([st]) => st === cur);
  const items = list.filter((x) => x.status === cur);
  return [
    h("div", { class: "seg", role: "group", "aria-label": "状態で切り替える" }, groups.map(([st, text]) =>
      h("button", { type: "button", class: "seg-b", "aria-pressed": String(st === cur), onclick: () => { view[key] = st; render(); } }, text, h("span", { class: "cnt" }, String(n(st)))))),
    h("p", { class: "mut seg-lead" }, lead),
    items.length ? (["done", "declined"].includes(cur) ? h("ul", { class: "plan-rows card" }, items.map(short)) : items.map(card))
      : h("p", { class: "mut" }, `「${label}」のものはありません。`),
  ];
}
const shortRow = (x, title, extra) => h("li", null,
  h("span", { class: "t" }, title), extra || "",
  h("span", { class: "mut small" }, [x.decidedAt, x.note].filter(Boolean).join(" ・ ")),
  h("button", { class: "btn sm", onclick: () => setPlan(x.title ? "mon" : "kpi", x, "proposed") }, "「検討中」に戻す"));
const decided = (x) => [S.planStatus[x.status] || "決めた日", x.decidedAt && `${x.decidedAt}${x.note ? " ・ " + x.note : ""}`];

function kpiCard(k, cols, now) {
  const buttons = k.status === "proposed"
    ? [h("button", { class: "btn tonal", onclick: () => setPlan("kpi", k, "adopted") }, "採用する"), h("button", { class: "btn", onclick: () => editTargets(k) }, "目標の数を変える"), h("button", { class: "btn quiet", onclick: () => setPlan("kpi", k, "declined") }, "見送る")]
    : k.status === "adopted" ? [h("button", { class: "btn", onclick: () => editTargets(k) }, "目標の数を変える"), h("button", { class: "btn quiet", onclick: () => setPlan("kpi", k, "proposed") }, "「検討中」に戻す")]
    : [h("button", { class: "btn", onclick: () => setPlan("kpi", k, "proposed") }, "「検討中」に戻す")];
  return h("article", { class: "card" + (k.status === "declined" ? " dim" : "") },
    h("div", { class: "card-h" }, h("h3", null, k.name), k.kind === "KGI" ? chip("最終目標", "ac") : "", stBadge(k.status)),
    k.why ? h("p", { class: "mut" }, k.why) : "",
    h("div", { class: "scroll" }, h("table", { class: "kpi" },
      h("thead", null, h("tr", null, h("td", null, ""), cols.map((m) => h("th", { scope: "col", class: m === now ? "now" : null }, monthLabel(m), m === now ? h("small", null, "今月") : "")))),
      h("tbody", null,
        h("tr", null, h("th", { scope: "row" }, "目標"), cols.map((m) => h("td", { class: m === now ? "now" : null }, num(k.targets?.[m], k.unit)))),
        h("tr", null, h("th", { scope: "row" }, "実績"), cols.map((m) => {
          if (m > now) return h("td", null, "");
          const a = actual(k.id, m), t = k.targets?.[m];
          const cls = [m === now ? "now" : "", a.v == null || t == null ? "" : a.v >= t ? "ok" : m < now ? "ng" : ""].filter(Boolean).join(" ") || null;
          return h("td", { class: cls, title: a.missing.length ? "含まれていない分: " + a.missing.join("・") : null }, num(a.v, k.unit), a.missing.length && a.v != null ? h("abbr", { title: "含まれていない分: " + a.missing.join("・") }, "*") : "");
        }))))),
    h("div", { class: "bar" }, buttons),
    more("測り方", kv(["測り方", k.source], ["決めた時点の数字", k.current], decided(k))));
}
function monCard(m) {
  const buttons = m.status === "proposed"
    ? [h("button", { class: "btn tonal", onclick: () => setPlan("mon", m, "adopted") }, "採用する"), h("button", { class: "btn quiet", onclick: () => setPlan("mon", m, "declined") }, "見送る")]
    : m.status === "adopted" ? [h("button", { class: "btn tonal", onclick: () => copyPrompt(promptFor("mon", m)) }, icon("copy"), "頼む文をコピー"), h("button", { class: "btn", onclick: () => setPlan("mon", m, "done") }, "実施済みにする"), h("button", { class: "btn quiet", onclick: () => setPlan("mon", m, "proposed") }, "「検討中」に戻す")]
    : [h("button", { class: "btn", onclick: () => setPlan("mon", m, "proposed") }, "「検討中」に戻す")];
  return h("article", { class: "card" + (m.status === "declined" ? " dim" : "") },
    h("div", { class: "card-h" }, h("h3", null, m.title), stBadge(m.status)),
    h("p", { class: "chips" },
      m.expectedYen ? chip(`見込み 月 ${yen(m.expectedYen[0])}〜${yen(m.expectedYen[1])}`) : "",
      m.effort ? chip(`手間 ${m.effort}`) : "",
      m.source === "weekly-analytics" ? chip(`週次の分析の提案${m.proposedAt ? `(${m.proposedAt})` : ""}`) : ""),
    m.summary ? h("p", null, m.summary) : "",
    m.firstStep ? h("p", { class: "next" }, h("b", null, "最初の一歩: "), m.firstStep) : "",
    h("div", { class: "bar" }, buttons),
    more("理由・気をつけること", kv(["理由", m.why], ["気をつけること", m.risk], ["根拠", m.evidence], ["管理番号", m.id], decided(m)), ["proposed", "adopted"].includes(m.status) ? promptBox(promptFor("mon", m)) : ""));
}

function manualForm() {
  const months = [curMonth(), addMonth(curMonth(), -1)];
  const m = months.includes(view.manualMonth) ? view.manualMonth : months[0];
  const row = S.plan.manual?.[m] || {};
  const form = h("form", { class: "card", novalidate: true, onsubmit: async (ev) => {
    ev.preventDefault();
    const values = {};
    for (const k of Object.keys(S.manualFields)) { const v = form.elements[k].value.trim(); values[k] = v === "" ? null : Number(v); }
    try { await call("/api/plan/manual", { month: m, values }); toast(`${monthLabel(m)}の実績を保存しました`); render(); }
    catch (err) { fail(err); }
  } },
    h("div", { class: "f inline" }, h("label", { for: "mm" }, "どの月の実績ですか"), h("select", { id: "mm", onchange: (ev) => { view.manualMonth = ev.target.value; render(); } }, months.map((x) => h("option", { value: x, selected: x === m }, monthLabel(x) + (x === curMonth() ? "(今月)" : "(先月)"))))),
    h("div", { class: "grid" }, Object.entries(S.manualFields).map(([k, label]) => h("div", { class: "f" }, h("label", { for: "man-" + k }, label), h("input", { id: "man-" + k, name: k, type: "number", min: "0", step: "1", inputmode: "numeric", value: row[k] ?? "", placeholder: "未入力" })))),
    h("p", { class: "mut small" }, "楽天は楽天アフィリエイトの成果報酬、AdSense は見積もり収益額の、その月の額です。空欄は「未入力」として扱い、0 とはみなしません。提案・契約の数は、営業の台帳から自動で入るので、直したいときだけ入れます。"),
    h("div", { class: "bar" }, h("button", { class: "btn primary", type: "submit" }, "保存する"), row.updatedAt ? h("span", { class: "mut small" }, `前回の保存: ${row.updatedAt}`) : ""));
  return form;
}

export function goalView() {
  const p = S.plan;
  if (!p) return [note("warn", "このPCに、目標の計画がまだありません。Claude に「最終目標から、目標の数字を作って」と頼んでください。")];
  const now = curMonth();
  const months = [...new Set(p.kpis.flatMap((k) => Object.keys(k.targets || {})))].sort();
  const cols = [addMonth(now, -1), now, ...months.filter((m) => m > now)];
  const openKpis = p.kpis.filter((k) => k.status === "proposed").length, openMons = p.monetization.filter((m) => m.status === "proposed").length;
  const SECS = [["overview", "売上と目標"], ["mon", "収益化の案", openMons || null], ["kpi", "目標の数字", openKpis || null], ["manual", "実績を入れる"]];
  const sec = SECS.some(([k]) => k === view.goalSec) ? view.goalSec : "overview";
  const jump = (k, text) => h("a", { href: "#/goal", class: "btn sm", onclick: goLink("goal", { goalSec: k, [k + "St"]: "proposed" }) }, text);
  return [
    seg("目標・収益の中の切り替え", SECS, sec, (k) => { view.goalSec = k; render(); }),
    sec === "overview" && openKpis + openMons ? note("info", `まだ決めていないものが ${openKpis + openMons} 件あります。 `, openMons ? jump("mon", `収益化の案 ${openMons}件`) : "", " ", openKpis ? jump("kpi", `目標の数字 ${openKpis}件`) : "") : "",
    sec === "overview" ? revenuePart(p) : "",
    sec === "mon" ? [h("p", { class: "lead" }, "売上を増やすための案です。採用したら「頼む文をコピー」して Claude に貼り付け、終えたら「実施済みにする」を押します。"),
      more("この項目について", h("p", { class: "mut" }, "新しい案は、毎週月曜の分析が、数字や営業の台帳に根拠があるときだけ足します(週に2件まで)。営業・契約・リンクの発行など、人が行う部分は「最初の一歩」を見てください。採用・見送りは、このPCにだけ保存します。")),
      statusGroups("monSt", p.monetization, monCard, (m) => shortRow(m, m.title, m.expectedYen ? chip(`見込み 月 ${yen(m.expectedYen[0])}〜${yen(m.expectedYen[1])}`) : ""))] : "",
    sec === "kpi" ? [h("p", { class: "lead" }, "最終目標に届くための、月ごとの目標と実績です(KPI とも呼びます)。実績の * は、まだ含まれていない分があるものです。"),
      more("この項目について", h("p", { class: "mut" }, "バリューコマースの報酬・サイトの訪問・広告のクリックは、毎週月曜の分析が自動で入れます。楽天・AdSense・協賛は「実績を入れる」で入れます。目標の数は、採用の前でも後でも変えられます。")),
      statusGroups("kpiSt", p.kpis, (k) => kpiCard(k, cols, now), (k) => shortRow(k, k.name))] : "",
    sec === "manual" ? [h("p", { class: "lead" }, "自動で取れない分を、月ごとに入れます。月が変わったら、先月の分を入れてください。"), manualForm()] : "",
  ];
}
