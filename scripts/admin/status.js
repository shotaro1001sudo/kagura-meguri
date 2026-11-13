// 動いているか: 自動の仕組みの信号(正常・注意・停止・不明)と、予定タスク(PC の Claude アプリが決まった時刻に動かす作業。読むだけ)
import { h, S, view, render, call, fail, badge, more, kv, note, loading, allClear, ext, at, whenText } from "./ui.js";
import { overview, loadOverview, SIG, sigMark } from "./dash.js";

const RUN = { completed: ["ok", "完了"], blocked: ["warn", "止まった"], failed: ["stop", "失敗"], error: ["stop", "失敗"], running: ["info", "実行中"] };

function opsPart() {
  const O = overview()?.ops;
  if (!O) return view.ovError ? note("warn", `状況を読めませんでした(${view.ovError})。 `, h("button", { class: "btn sm", onclick: () => loadOverview(true) }, "もう一度確かめる")) : loading("GitHub とサイトを確かめています…(数秒かかります)");
  const order = { stop: 0, warn: 1, unknown: 2, ok: 3 };
  const sigs = [...O.signals].sort((a, b) => order[a.state] - order[b.state]);
  const bad = sigs.filter((x) => x.state === "stop" || x.state === "warn").length;
  return [
    h("div", { class: "toolbar" },
      h("p", { class: "sigsum" }, ["stop", "warn", "unknown", "ok"].map((k) => h("span", { class: "s-" + k }, h("i", { "aria-hidden": "true" }, SIG[k][0]), ` ${SIG[k][1]} ${O.counts[k]}`))),
      h("button", { class: "btn", disabled: view.ovState === "loading", onclick: () => loadOverview(true) }, view.ovState === "loading" ? "確かめています…" : "いますぐ確かめる")),
    bad ? "" : allClear("止まっているもの・注意が要るものは、ありません。"),
    h("ul", { class: "sigs" }, sigs.map((x) => h("li", { class: "sig s-" + x.state },
      sigMark(x.state),
      h("div", { class: "sn" }, h("b", null, x.label), h("span", { class: "sd" }, x.detail)),
      h("small", { class: "mut sm-meta" }, x.schedule, x.last ? ` ・ 最後 ${whenText(x.last)}` : "", x.url ? [" ・ ", ext(x.url, "実行の記録")] : "")))),
  ];
}

async function loadTaskRuns() {
  view.tasksLoaded = "loading";
  try { view.tasksData = await call("/api/tasks"); S.tasks = view.tasksData; } catch (err) { fail(err); }
  view.tasksLoaded = true;
  if (view.tab === "status") render();
}
function tasksPart() {
  if (!view.tasksLoaded) loadTaskRuns();
  const T = view.tasksData || S.tasks || { tasks: [] };
  if (!T.found) return note("info", "このPCで、Claude デスクトップアプリの予定タスクの記録が見つかりません。");
  const card = (t) => h("article", { class: "card" + (t.enabled ? "" : " dim") },
    h("div", { class: "card-h" }, h("h3", null, t.title),
      t.missed ? badge("stop", "動いていない") : t.issues?.length ? badge("warn", "要確認") : t.enabled ? badge("ok", "有効") : t.finished ? badge("mut", "完了(1回だけ)") : badge("mut", "停止中")),
    t.description ? h("p", { class: "mut small" }, t.description) : "",
    (t.issues ?? []).filter((x, i) => !(t.missed && i === 0)).map((x) => note("warn", x)),
    t.missed ? note("stop", `${at(t.missedAt)} の予定に、動いた記録がありません。その時刻に PC が切れていたか、アプリが閉じていた可能性があります。下の「最近の実行」の理由も見てください。`) : "",
    t.error ? note("warn", t.error) : "",
    kv(["予定", t.schedule], ["次回", t.nextRun ? at(t.nextRun) + " ごろ" : "—"], ["前回", at(t.lastRun)]),
    t.browser ? h("p", { class: "mut small" }, "ブラウザを使うタスクです。ブラウザの操作は、毎回その場での承認が要るので、予定の時刻に PC の前にいないと、承認待ちのまま止まります。PC の前にいる時刻に予定を合わせてください。") : "",
    t.runs?.length ? h("details", { class: "more", open: t.missed || t.runs[0].needsAction ? true : null }, h("summary", null, `最近の実行(${t.runs.length})`),
      h("ul", { class: "runs" }, t.runs.map((r) => h("li", null,
        h("span", { class: "nw" }, at(r.startedAt), " "), badge(...(RUN[r.status] || ["mut", r.status])), " ", r.summary || h("span", { class: "mut" }, "(ひとことなし)"),
        r.needsAction ? h("div", { class: "small" }, h("b", null, "人がやること: "), r.needsAction) : "")))) : "");
  const done = T.tasks.filter((t) => t.finished);
  return [
    T.error ? note("warn", T.error) : "",
    T.missed || T.attention ? "" : allClear("止まっている予定タスクはありません。"),
    T.tasks.filter((t) => !t.finished).map(card),
    done.length ? more(`終わった1回だけのタスク(${done.length})`, done.map(card)) : "",
    view.tasksLoaded === "loading" ? loading("最近の実行を読み込んでいます…")
      : h("div", { class: "bar" }, h("button", { class: "btn sm", onclick: () => { view.tasksLoaded = false; render(); } }, "予定タスクを読み込み直す")),
  ];
}

export function statusView() {
  return [
    h("p", { class: "lead" }, "人の手を使わずに動いている仕組みが、予定どおり動いているかを見ます。「停止」「注意」があれば、ひとことの説明を読んで確かめてください。"),
    h("section", { "aria-labelledby": "st-ops" }, h("h2", { id: "st-ops", class: "sec" }, "自動の仕組み"), opsPart(),
      h("p", { class: "mut small" }, "GitHub の実行とサイトの表示は、10分ごとに確かめ直します。")),
    h("section", { "aria-labelledby": "st-tasks" }, h("h2", { id: "st-tasks", class: "sec" }, "予定タスク"),
      h("p", { class: "mut" }, "Claude デスクトップアプリが、このPCで決まった時刻に動かす作業です(Note の投稿・3日に1回の分析など)。PC が起動していて、アプリが開いているときだけ動きます。予定の変更は、PC のアプリで行います。"),
      tasksPart()),
  ];
}
