// 管理者用ページの画面の起動: メニューの切り替え・件数の表示・状況の読み直し。
// 画面ごとの中身は、それぞれのファイルにある(todo.js やること / events.js 開催 / inbox.js 受信箱 / sales.js 営業 / goal.js 目標・収益 /
// numbers.js 数字 / status.js 動いているか / settings.js 設定)。共通の部品は ui.js、グラフと状況の読み込みは dash.js
import { h, $, S, setState, view, hooks, render, call, toast, fail, typing, at, inboxOpen, note, busy, TOKEN } from "./ui.js";
import { loadOverview } from "./dash.js";
import { todoView, todoCount } from "./todo.js";
import { eventsView, republish } from "./events.js";
import { inboxView } from "./inbox.js";
import { salesView, salesCount } from "./sales.js";
import { goalView, planOpen } from "./goal.js";
import { numbersView } from "./numbers.js";
import { statusView } from "./status.js";
import { settingsView } from "./settings.js";

const PAGES = { todo: ["やること", todoView], events: ["開催", eventsView], inbox: ["受信箱", inboxView], sales: ["営業", salesView], goal: ["目標・収益", goalView],
  numbers: ["数字", numbersView], status: ["動いているか", statusView], settings: ["設定", settingsView] };
const MORE = ["goal", "numbers", "status", "settings"]; // スマホでは「ほか」の中に入れる
const main = $("#main");

function setCount(key, n) {
  document.querySelectorAll(`[data-n="${key}"]`).forEach((el) => el.replaceChildren(...(n ? [h("span", { "aria-hidden": "true" }, String(n)), h("span", { class: "sr" }, `${n}件`)] : [])));
}
// ---------- 描画 ----------
hooks.render = () => {
  if (!S) return;
  if (!PAGES[view.tab]) view.tab = "todo";
  const [title, page] = PAGES[view.tab];
  document.title = `${title} | 管理者用ページ | 神楽めぐり`;
  $("#title").textContent = title;
  document.querySelectorAll("a[data-tab]").forEach((a) => { if (a.dataset.tab === view.tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  $("#more-btn").classList.toggle("on", MORE.includes(view.tab));
  // メニューの件数: 「やること」は全部の合計。ほかは、そのメニューで行う分
  const goalN = planOpen().length, statusN = S.tasks?.attention || S.tasks?.missed || 0;
  setCount("todo", todoCount());
  setCount("inbox", inboxOpen("submit") + inboxOpen("contact"));
  setCount("sales", salesCount());
  setCount("goal", goalN);
  setCount("status", statusN);
  setCount("more", goalN + statusN);
  // まだサイトに送っていない変更(保存はできている)は、どの画面でも上に出す
  const unpublished = !!(S.pending && (S.pending.uncommitted || S.pending.unpushed));
  $("#banner").replaceChildren(
    ...(S.codeChanged ? [note("warn", "管理者用ページのプログラムが新しくなりました。いまは古いプログラムのまま動いているので、開き直してください。 ",
      S.canRestart ? h("button", { class: "btn sm", onclick: restartAdmin }, "開き直す") : "黒い画面(Kagura Meguri Admin)を閉じて、デスクトップのショートカットから開きます。")] : []),
    ...(unpublished ? [note("warn", "サイトに送っていない変更があります(保存はできています)。 ", h("button", { class: "btn sm", onclick: republish }, "もう一度公開する"))] : []));
  $("#loaded").textContent = view.loadedAt ? `${at(view.loadedAt)} の状況` : "";
  // 描き直しても、キーボードの位置(フォーカス)を失わない: 同じボタンがあればそこへ、なくなっていれば本文の先頭へ
  const a = document.activeElement, keep = main.contains(a) && a !== main;
  const same = (el) => el.id === a.id && el.textContent === a.textContent && el.getAttribute("aria-label") === a.getAttribute("aria-label");
  const nth = keep ? [...main.querySelectorAll(a.tagName)].filter(same).indexOf(a) : -1;
  main.replaceChildren(...[page()].flat(Infinity).filter((x) => x != null && x !== "" && x !== false));
  if (keep) ([...main.querySelectorAll(a.tagName)].filter(same)[nth] || main).focus({ preventScroll: true });
};

// ---------- メニュー(アドレスの # で、いまの画面を覚える。戻るボタンでも戻れる) ----------
const tabFromHash = () => location.hash.replace(/^#\/?/, "") || "todo";
addEventListener("hashchange", () => {
  const tab = tabFromHash();
  if (!PAGES[tab]) return; // ページの中の移動(#main など)は、そのまま
  view.tab = tab;
  if ($("#more").open) $("#more").close();
  render(); window.scrollTo(0, 0); $("#title").focus({ preventScroll: true });
});
addEventListener("popstate", () => { const tab = tabFromHash(); if (PAGES[tab] && tab !== view.tab) { view.tab = tab; render(); } });
$("#more-btn").addEventListener("click", () => $("#more").showModal());
$("#more").addEventListener("click", (ev) => { if (ev.target === ev.currentTarget || ev.target.closest("a")) ev.currentTarget.close(); });
$("#ask").addEventListener("click", (ev) => { if (ev.target === ev.currentTarget) ev.currentTarget.close(); }); // 確認の画面は、外を押すと「やめる」

// ---------- 開き直す(サーバーを起動し直して、新しいプログラムで動かす) ----------
async function restartAdmin(ev) {
  ev.currentTarget.disabled = true;
  try { await call("/api/restart", {}); } catch (err) { ev.currentTarget.disabled = false; return fail(err); }
  toast("開き直しています…(10秒ほど)", { busy: true });
  // 止まってから、新しいサーバーが応答するまで待って、画面を読み込み直す(新しい合言葉の画面になる)
  const t0 = Date.now();
  await new Promise((r) => setTimeout(r, 2500));
  while (Date.now() - t0 < 60e3) {
    try { const r = await fetch("/", { cache: "no-store" }); if (r.ok && !(await r.text()).includes(TOKEN)) { location.reload(); return; } } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  toast("開き直せませんでした。黒い画面(Kagura Meguri Admin)が開いているかを確かめて、デスクトップのショートカットから開いてください。", true);
}

// ---------- 状況の読み直し ----------
// 数時間おき・画面に戻ってきたとき。入力の途中は描き直さず、終わってから
async function reload() {
  try { setState(await call("/api/state")); view.loadedAt = new Date().toISOString(); } catch { return; }
  view.ov = null; view.ovError = ""; // 運営の状況は、使う画面を開いたときに集め直す
  if (typing()) { reload.later = true; return; }
  render();
}
// 「最新にする」: GitHub の最新の取り込みと、メールの読み込み(定期の更新と同じ)
async function refreshNow(ev) {
  try {
    await busy(ev.currentTarget, "読み込んでいます…", async () => {
      const r = await call("/api/refresh", {});
      view.loadedAt = new Date().toISOString();
      const bad = [r.refresh.git, r.refresh.mail, r.refresh.hooks, r.refresh.vc].some((x) => x && x.ok === false);
      toast([r.refresh.git?.text, r.refresh.mail?.text, r.refresh.vc?.text, r.refresh.hooks?.text].filter(Boolean).join("\n") || "最新にしました", bad);
    });
    render(); loadOverview(true);
  } catch (err) { fail(err); }
}
$("#refresh").addEventListener("click", refreshNow);
document.addEventListener("focusout", () => setTimeout(() => { if (reload.later && !typing()) { reload.later = false; render(); } }, 0));
document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - Date.parse(view.loadedAt || 0) > 30 * 60e3) reload(); });

// ---------- 起動 ----------
async function start() {
  view.tab = PAGES[tabFromHash()] ? tabFromHash() : "todo";
  try {
    setState(await call("/api/state"));
    view.loadedAt = new Date().toISOString();
    render();
    // サーバーが数時間おきに読み込むので、画面も同じ間隔で読み直す(少し遅らせて、読み込みのあとに)
    const hours = S.refresh?.hours || 3;
    setInterval(reload, hours * 3600e3 + 5 * 60e3);
  } catch (err) {
    main.replaceChildren(note("stop", h("b", null, "画面を読み込めませんでした。"), " ", err.message, " ", h("button", { class: "btn sm", onclick: () => { main.replaceChildren(h("div", { class: "loading", role: "status" }, h("span", { class: "spin", "aria-hidden": "true" }), "読み込んでいます…")); start(); } }, "もう一度読み込む")));
  }
}
start();
