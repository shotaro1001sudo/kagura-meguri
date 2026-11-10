// 管理者用ページの画面の、共通の道具(状態・サーバーとのやりとり・部品・確認の画面・お知らせ・日付や金額の書き方)。
// 受け取ったデータは、すべて文字として表示する(HTML として解釈しない)
export const TOKEN = document.querySelector('meta[name="admin-token"]').content;
export let S = null; // サーバーから受け取った状態
export const setState = (s) => { S = s; };
// 画面の見え方(どのメニューか・絞り込み・選んでいるもの)
export const view = { tab: "todo", evFilter: "upcoming", evQuery: "", evLimit: 40, box: "submit", sub: "open", con: "open", selSubmit: null, selContact: null };
export const hooks = { render: () => {} };
export const render = () => hooks.render();

// ---------- 小さな道具 ----------
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false && c !== "") el.append(c instanceof Node ? c : String(c));
  return el;
}
const SVGNS = "http://www.w3.org/2000/svg";
export function sv(tag, attrs, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v); else el.setAttribute(k, String(v));
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false && c !== "") el.append(c instanceof Node ? c : String(c));
  return el;
}
export const $ = (s) => document.querySelector(s);
// 絵記号(app.html の先頭に置いた形を使う)。飾りなので、読み上げには出さない
export const icon = (name) => sv("svg", { class: "ic", "aria-hidden": "true", focusable: "false" }, sv("use", { href: "#i-" + name }));

export async function call(path, body) {
  let r;
  try { r = await fetch(path, { method: body ? "POST" : "GET", headers: { "x-admin-token": TOKEN, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw new Error("管理者用ページのプログラムに、つながりません。PC で管理者用ページが動いているか確かめてください。"); }
  const j = await r.json().catch(() => ({ error: "応答を読めませんでした" }));
  if (!r.ok) { const e = new Error(j.error || `エラー ${r.status}`); e.fields = j.fields; throw e; }
  if (j.state) S = j.state;
  return j;
}

// ---------- メニューの移動 ----------
export function go(tab, extra) {
  Object.assign(view, { tab }, extra || {});
  if (location.hash !== "#/" + tab) history.pushState(null, "", "#/" + tab);
  render();
  window.scrollTo(0, 0);
  $("#title")?.focus({ preventScroll: true });
}
export const goLink = (tab, extra) => (ev) => { ev.preventDefault(); go(tab, extra); };

// ---------- お知らせ(画面の下に出る短い知らせ) ----------
// bad: うまくいかなかった知らせ(長めに出す) / keep: 閉じるまで消さない / busy: 処理の途中 / action: 「元に戻す」などのボタン
export function toast(msg, o = {}) {
  if (typeof o === "boolean") o = { bad: o };
  const t = $("#toast");
  clearTimeout(toast.t);
  t.className = "toast on" + (o.bad ? " bad" : "") + (o.busy ? " busy" : "");
  t.setAttribute("role", o.bad ? "alert" : "status");
  t.replaceChildren(
    o.busy ? h("span", { class: "spin", "aria-hidden": "true" }) : "",
    h("span", { class: "toast-msg" }, msg),
    o.action ? h("button", { type: "button", class: "btn sm", onclick: () => { hideToast(); o.action.run(); } }, o.action.label) : "",
    o.busy ? "" : h("button", { type: "button", class: "toast-x", "aria-label": "お知らせを閉じる", onclick: hideToast }, "×"));
  if (!o.busy && !o.keep) toast.t = setTimeout(hideToast, o.bad ? 15000 : o.action ? 10000 : 4500);
}
export function hideToast() { clearTimeout(toast.t); $("#toast").className = "toast"; }
// 操作のあとに「元に戻す」を付けた知らせ
export const undoToast = (msg, undo) => toast(msg, { action: { label: "元に戻す", run: undo } });
export const fail = (err) => toast(err.message, true);

// ボタンを、処理のあいだ押せなくして、文を変える
export async function busy(btn, text, fn) {
  if (!btn) return fn();
  const keep = btn.textContent;
  btn.disabled = true; btn.setAttribute("aria-busy", "true"); btn.textContent = text;
  try { return await fn(); }
  finally { if (btn.isConnected) { btn.disabled = false; btn.removeAttribute("aria-busy"); btn.textContent = keep; } }
}

// ---------- 確認の画面・ひとこと入力の画面(ブラウザ標準の確認の代わり) ----------
// points: [種類, 文]。種類は site(サイトに出る)・local(このPCだけ)・undo(戻せる)・noundo(戻せない)・info
const POINT = { site: ["globe", "サイト"], local: ["pc", "このPCだけ"], undo: ["undo", "戻せます"], noundo: ["alert", "戻せません"], info: ["info", "メモ"] };
function askDialog({ title, body, points = [], fields = [], ok = "はい", cancel = "やめる", danger = false }) {
  const dlg = $("#ask");
  return new Promise((resolve) => {
    const form = h("form", { method: "dialog", novalidate: true },
      h("h2", { id: "ask-title" }, title),
      body ? h("p", { class: "ask-body" }, body) : "",
      points.length ? h("ul", { class: "points" }, points.map(([k, text]) => h("li", { class: "pt-" + k }, icon(POINT[k][0]), h("span", null, h("b", null, POINT[k][1]), " ", text)))) : "",
      fields.map((f) => h("div", { class: "f" }, h("label", { for: "ask-" + f.name }, f.label),
        f.type === "textarea" ? h("textarea", { id: "ask-" + f.name, name: f.name, rows: 3, maxlength: f.maxlength || 300, placeholder: f.placeholder }, f.value || "")
          : h("input", { id: "ask-" + f.name, name: f.name, type: f.type || "text", value: f.value ?? "", required: f.required, min: f.min, maxlength: f.maxlength || 200, placeholder: f.placeholder }),
        f.help ? h("small", { class: "help" }, f.help) : "", h("small", { class: "err", id: "ask-err-" + f.name, role: "alert" }))),
      h("div", { class: "dlg-foot" },
        h("button", { class: "btn", value: "cancel", formnovalidate: true }, cancel),
        h("button", { class: "btn " + (danger ? "danger" : "primary"), value: "ok" }, ok)));
    // 結果は、押したときにその場で返す(閉じたあとの合図 close は、画面が隠れている間は届かないことがあるので、頼らない)
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    form.addEventListener("submit", (ev) => {
      if (ev.submitter?.value !== "ok") return finish(null);
      let bad = null;
      for (const f of fields) { const el = form.elements[f.name], e = $("#ask-err-" + f.name); const miss = f.required && !el.value.trim(); e.textContent = miss ? "入れてください" : ""; if (miss) { el.setAttribute("aria-invalid", "true"); bad ??= el; } else el.removeAttribute("aria-invalid"); }
      if (bad) { ev.preventDefault(); bad.focus(); return; }
      finish(Object.fromEntries(fields.map((f) => [f.name, form.elements[f.name].value.trim()])));
    });
    dlg.replaceChildren(form);
    dlg.setAttribute("aria-labelledby", "ask-title");
    dlg.oncancel = dlg.onclose = () => finish(null); // Esc・外を押したとき
    dlg.showModal();
    (fields.length ? form.elements[fields[0].name] : form.querySelector("button[value=cancel]")).focus();
  });
}
/** 確かめる画面。「はい」なら true */
export const confirmBox = async (o) => (await askDialog(o)) !== null;
/** ひとこと入力の画面。やめたら null、進めたら { 名前: 値 } */
export const askBox = (o) => askDialog(o);
/** 見送りの理由を聞く。やめたら null、空でも進められる */
export async function askReason(what) {
  const v = await askBox({ title: `「${what}」を見送ります`, body: "見送ると、同じ案は出なくなります。理由があれば書いてください(空でも構いません)。",
    points: [["local", "このPCにだけ記録します。"], ["undo", "あとで「元に戻す」で戻せます。"]], fields: [{ name: "note", label: "理由(なくても構いません)", type: "textarea" }], ok: "見送る" });
  return v ? v.note : null;
}

// ---------- 入力の画面(開催の編集・営業の相手・請求書など) ----------
export const field = (name, label, input, o = {}) => {
  input.id ||= "f-" + name;
  if (!input.name && input.type !== "checkbox") input.name = name;
  input.setAttribute("aria-describedby", "err-" + name);
  return h("div", { class: "f" + (o.wide ? " wide" : "") }, h("label", { for: input.id }, label, o.optional ? h("span", { class: "opt" }, "なくても可") : ""), input, o.help ? h("small", { class: "help" }, o.help) : "", h("small", { class: "err", id: "err-" + name, role: "alert" }));
};
export const input = (name, value, attrs = {}) => h("input", { id: "f-" + name, name, value: value ?? "", ...attrs });
/**
 * 入力の画面を開く。onSubmit(form, ボタン) が投げたエラーの fields は、その欄の下に出す(map: サーバーの名前 → 欄の名前)
 */
export function openForm({ title, intro, body, ok = "保存する", busyText = "保存しています…", onSubmit, map = {}, extra }) {
  const dlg = $("#dlg"), form = $("#dlg-form");
  form.replaceChildren(
    h("div", { class: "dlg-head" }, h("h2", { id: "dlg-title" }, title), h("button", { class: "icon-btn", value: "cancel", formnovalidate: true, "aria-label": "閉じる" }, "×")),
    h("div", { class: "dlg-body" }, intro || "", body),
    h("div", { class: "dlg-foot" }, extra || "", h("button", { class: "btn", value: "cancel", formnovalidate: true }, "やめる"), h("button", { class: "btn primary", value: "save" }, ok)));
  dlg.setAttribute("aria-labelledby", "dlg-title");
  form.onsubmit = async (ev) => {
    if (ev.submitter?.value !== "save") return;
    ev.preventDefault();
    form.querySelectorAll(".err").forEach((e) => (e.textContent = ""));
    form.querySelectorAll("[aria-invalid]").forEach((e) => e.removeAttribute("aria-invalid"));
    const btn = ev.submitter;
    try { await busy(btn, busyText, () => onSubmit(form)); dlg.close(); }
    catch (err) {
      let first = null;
      for (const [k, m] of Object.entries(err.fields || {})) {
        const name = map[k] || k, e = $("#err-" + name), el = $("#f-" + name);
        if (e) e.textContent = m;
        if (el) { el.setAttribute("aria-invalid", "true"); const d = el.closest("details"); if (d) d.open = true; first ??= el; } // 畳んだ欄の中なら、開いて見せる
      }
      first?.focus();
      toast(err.message, true);
    }
  };
  dlg.showModal();
  form.querySelector(".dlg-body").scrollTop = 0;
  form.querySelector(".dlg-body :is(input:not([readonly]), select, textarea)")?.focus(); // はじめの入力欄から
  return form;
}

// ---------- 見出し・空の状態・畳んだ説明 ----------
export const badge = (tone, text) => h("span", { class: `badge b-${tone}` }, text);
export const chip = (text, cls) => h("span", { class: "chip" + (cls ? " " + cls : "") }, text);
export const count = (n) => h("span", { class: "pill" + (n ? "" : " zero") }, `${n}件`);
export const more = (summary, ...kids) => h("details", { class: "more" }, h("summary", null, summary), h("div", { class: "more-b" }, kids));
export const allClear = (text) => h("p", { class: "clear" }, icon("check"), text);
export const empty = (title, text, action) => h("div", { class: "empty" }, icon("check"), h("p", { class: "empty-t" }, title), text ? h("p", { class: "mut" }, text) : "", action || "");
export const note = (tone, ...kids) => h("div", { class: "note n-" + tone, role: tone === "stop" ? "alert" : null }, icon(tone === "ok" ? "check" : tone === "info" ? "info" : "alert"), h("div", null, kids));
export const loading = (text) => h("div", { class: "loading", role: "status" }, h("span", { class: "spin", "aria-hidden": "true" }), text);
export const kv = (...pairs) => h("dl", { class: "kv" }, pairs.filter((p) => p && p[1] != null && p[1] !== "").map(([k, v]) => [h("dt", null, k), h("dd", null, v)]));
/** 切り替えのボタンの並び(いま選んでいるものは aria-pressed) */
export const seg = (label, items, cur, pick) => h("div", { class: "seg", role: "group", "aria-label": label }, items.map(([key, text, n]) =>
  h("button", { type: "button", class: "seg-b", "aria-pressed": String(key === cur), onclick: () => pick(key) }, text, n == null ? "" : h("span", { class: "cnt" }, String(n)))));

// ---------- 日付・金額の書き方 ----------
export const WD = "日月火水木金土";
export const jpDate = (d) => { if (!d) return ""; const x = new Date(d.slice(0, 10) + "T00:00:00Z"); return `${d.slice(0, 4)}/${+d.slice(5, 7)}/${+d.slice(8, 10)}(${WD[x.getUTCDay()]})`; };
export const when = (e) => `${jpDate(e.start)}${e.timeUnknown ? "" : " " + e.start.slice(11, 16)}${e.end ? "〜" + (e.end.slice(0, 10) === e.start.slice(0, 10) ? "" : jpDate(e.end) + " ") + e.end.slice(11, 16) : ""}`;
export const recv = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
export const nowJst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16);
export const daysSince = (d) => Math.round((new Date(S.today) - new Date(d)) / 864e5);
export const addDays = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);
export const yen = (n) => (n == null ? "—" : "¥" + Math.round(n).toLocaleString("ja-JP"));
export const num = (n, unit) => (n == null ? "—" : unit === "円" ? yen(n) : Math.round(n).toLocaleString("ja-JP") + (unit === "回" ? "" : unit));
export const fmtN = (n) => (n == null ? "—" : Math.round(n).toLocaleString("ja-JP"));
export const curMonth = () => S.today.slice(0, 7);
export const addMonth = (m, k) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + k, 1)).toISOString().slice(0, 7);
export const monthLabel = (m) => `${m.slice(0, 4)}年${+m.slice(5, 7)}月`;
export const md = (d) => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;
// 「今日 9:30」「11/8(日) 9:30」の形
export const at = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso), diff = Math.round((new Date(d.toDateString()) - new Date(new Date().toDateString())) / 864e5);
  const rel = { "-1": "昨日", 0: "今日", 1: "明日" }[diff];
  return `${rel ? rel + " " : `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]}) `}${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
};
// 日付だけ(YYYY-MM-DD)は日付で、時刻つきは「今日 9:30」の形で
export const whenText = (x) => (!x ? "" : x.length === 10 ? md(x) : at(x));

// ---------- リンク・コピー ----------
export const ext = (href, text) => (/^https:\/\//.test(href || "") ? h("a", { href, target: "_blank", rel: "noopener noreferrer" }, text || href, h("span", { class: "sr" }, "(新しいタブで開きます)")) : text || href || "");
export const pageUrl = (id) => `${S.baseUrl}/events/${id}.html`;
export const isOpen = (x) => x.status === "new" || x.status === "doing";
export const inboxOpen = (k) => S.inbox.filter((x) => x.kind === k && isOpen(x)).length;
export async function copyText(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg); } catch { toast("コピーできませんでした。文を選んでコピーしてください", true); }
}
// Claude に頼む文(プロンプト)。管理者用ページは、文を出してコピーするだけ(Claude に作業はさせない)
export async function copyPrompt(text) {
  try { await navigator.clipboard.writeText(text); toast("頼む文をコピーしました。Claude に貼り付けてください"); }
  catch { toast("コピーできませんでした。「頼む文を見る」を開いて、文を選んでコピーしてください", true); }
}
export const promptBox = (text) => h("details", { class: "more prompt" }, h("summary", null, "頼む文を見る"), h("pre", null, text));
// 入力の途中は、画面を描き直さない(書いた文が消えないように)
export const typing = () => { const a = document.activeElement; return !!a && (a.matches("textarea, input, select") || !!a.closest("dialog[open]")); };
// メールを書く画面を開く(Gmail の設定があれば Gmail、なければメールアプリ)。送るのは運営者
export function openMail(to, subject, body) {
  if (S.gmailUser) {
    const q = new URLSearchParams({ view: "cm", fs: "1", authuser: S.gmailUser, to, su: subject, body });
    window.open(`https://mail.google.com/mail/?${q}`, "_blank", "noopener,noreferrer");
    return;
  }
  h("a", { href: `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` }).click();
}
