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
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
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
  main.replaceChildren(...({ home: homeView, events: eventsView, submit: () => inboxView("submit"), contact: () => inboxView("contact") }[view.tab])());
}

function homeView() {
  const st = S.events.map(evState);
  const count = (k) => st.filter(([s]) => s === k).length;
  const inb = (k, f) => S.inbox.filter((x) => x.kind === k && f(x)).length;
  const old = S.events.filter((e) => evState(e)[0] === "published" && e.checked && daysSince(e.checked) > 60).length;
  const card = (n, label, tab) => h("div", null, h("b", null, n), tab ? h("a", { href: "#", onclick: (ev) => { ev.preventDefault(); Object.assign(view, tab); render(); } }, label) : label);
  return [
    h("h2", null, "概要"),
    h("div", { class: "cards" },
      card(count("published"), "掲載中の開催", { tab: "events", evFilter: "upcoming" }),
      card(count("ended"), "終了した開催", { tab: "events", evFilter: "ended" }),
      card(count("withdrawn"), "取り下げた開催", { tab: "events", evFilter: "withdrawn" }),
      card(inb("submit", isOpen), "未対応の申請", { tab: "submit", sub: "open" }),
      card(inb("contact", isOpen), "未対応・対応中の問い合わせ", { tab: "contact", con: "open" })),
    old ? h("p", { class: "warn" }, `確認日から60日を過ぎた、掲載中の開催が ${old} 件あります。公式情報で、変更がないか確かめてください(開催一覧の「要確認」)。`) : "",
    h("h3", null, "Gmail から読み込む"),
    S.mailReady
      ? h("div", { class: "bar" }, h("button", { class: "btn", id: "fetch", onclick: fetchMail }, "新しい申請・問い合わせを読み込む"),
          h("span", { class: "mut" }, S.lastFetch ? `前回: ${new Date(S.lastFetch).toLocaleString("ja-JP")}` : "まだ読み込んでいません"))
      : h("div", { class: "warn" }, h("p", null, "Gmail の設定がまだありません。リポジトリの ADMIN.md の手順で、admin.local.json を作ってください(GitHub には上がりません)。設定後、この画面を開き直します。")),
    h("h3", null, "公開について"),
    S.pending && (S.pending.uncommitted || S.pending.unpushed)
      ? h("div", { class: "warn bar" }, h("span", null, "サイトに反映していない変更があります。"), h("button", { class: "btn", id: "repub", onclick: republish }, "もう一度公開する")) : "",
    h("p", { class: "mut" }, "開催の追加・編集・取り下げ・再掲載は、保存と同時に、コミットして GitHub に送ります(数分後にサイトに反映)。送る前に、サイトを作れるかを確かめます。終了した開催は、サイトの一覧・地図・カレンダーから自動で外れ、ページは「終了しました」として残ります。"),
  ];
}

// 保存のあとの、公開(コミットと push)の結果を知らせる
function published(r, what) {
  const p = r.publish;
  const geo = r.geocode ? "\n" + r.geocode.split("\n").filter((l) => /^(OK|NG|--)/.test(l)).join("\n") : "";
  if (!p || p.ok) return toast(`${what}。サイトに反映しました(数分後に表示が変わります)${geo}`);
  const step = { build: "サイトを作る確認で、問題が見つかりました", commit: "コミットできませんでした", push: "GitHub に送れませんでした" }[p.step] || "公開できませんでした";
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
    .filter(({ st }) => view.evFilter === "all" || (view.evFilter === "upcoming" ? st[0] === "published" || st[0] === "pending" : st[0] === view.evFilter))
    .filter(({ e }) => !q || [e.name, e.kagura, e.prefecture, e.city, e.venue, e.id].join(" ").includes(q))
    .sort((a, b) => (view.evFilter === "ended" ? b.e.start.localeCompare(a.e.start) : a.e.start.localeCompare(b.e.start)));
  const sel = h("select", { "aria-label": "表示する開催", onchange: (ev) => { view.evFilter = ev.target.value; render(); } },
    ...[["upcoming", "これから(掲載中)"], ["ended", "終了"], ["withdrawn", "取り下げ"], ["all", "すべて"]].map(([v, t]) => h("option", { value: v, selected: view.evFilter === v }, t)));
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
          e.status === "withdrawn"
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
function openEditor(e, item) {
  const d = e || {};
  const dlg = $("#dlg"), form = $("#dlg-form");
  const f = (id, label, input, wide) => h("div", { class: "f" + (wide ? " wide" : "") }, h("label", { for: "e-" + id }, label), input, h("small", { class: "err", id: "err-" + id }));
  const inp = (id, v, a = {}) => h("input", { id: "e-" + id, name: id, value: v ?? "", ...a });
  const start = d.start || "", end = d.end || "";
  form.replaceChildren(
    h("h2", null, item ? "内容を確かめて掲載する" : e ? "開催を編集する" : "開催を追加する"),
    item ? h("p", { class: "warn" }, "公式情報のURLを開き、日時・会場が合っているかを確かめてから掲載してください。出典には、確かめたページの名前を入れます。") : "",
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
      f("checked", "確認日", inp("checked", d.checked || S.today, { type: "date" }))),
    h("div", { class: "bar mt" },
      h("button", { class: "btn", value: "save", id: "e-save" }, item ? "許可して掲載する" : "保存する"),
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
      timeUnknown: unknown || (!!date && !v("time")), fee: v("fee"), url: v("url"), description: v("description"), source: v("source"), checked: v("checked") };
    form.querySelectorAll(".err").forEach((x) => (x.textContent = "")); form.querySelectorAll("[aria-invalid]").forEach((x) => x.removeAttribute("aria-invalid"));
    const btn = $("#e-save"); btn.disabled = true; btn.textContent = "保存して公開しています…(数十秒かかることがあります)";
    try {
      const r = await call("/api/events/save", { event: ev2, originalId: e && !item ? e.id : null, inboxId: item ? item.id : null });
      dlg.close();
      published(r, "保存しました");
      render();
    } catch (err) {
      btn.disabled = false; btn.textContent = item ? "許可して掲載する" : "保存する";
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
    x.email ? h("div", { class: "bar" }, h("span", { class: "mut" }, "返信(メールアプリが開きます):"), replies(x, ev).map(([label, body]) => h("button", { class: "btn ghost small", onclick: () => mail(x, body) }, label))) : "",
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
function mail(x, body) {
  const a = h("a", { href: `mailto:${encodeURIComponent(x.email)}?subject=${encodeURIComponent("Re: " + x.subject)}&body=${encodeURIComponent(body)}` });
  a.click();
}

// ---------- 起動 ----------
document.querySelectorAll("#tabs button").forEach((b) => b.addEventListener("click", () => { view.tab = b.dataset.tab; render(); main.focus(); }));
call("/api/state").then((j) => { S = j; render(); }).catch((err) => { main.replaceChildren(h("p", { class: "warn" }, err.message)); });
