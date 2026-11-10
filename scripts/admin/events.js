// 開催: 一覧(掲載中・保留・終了・取り下げ)、追加・編集、取り下げ・再掲載、保留の掲載・却下。
// 開催データを変える操作は、保存と同時にサイトへ送る(公開)。だから、押す前に確認の画面を出す
import { h, $, S, view, render, call, toast, fail, confirmBox, openForm, field, input, badge, seg, ext, pageUrl, when, jpDate, nowJst, daysSince, note, icon, busy, empty } from "./ui.js";

// サイトと同じ考え方: 終了時刻がなければ、開始から3時間(時刻未定は、その日いっぱい)を開催中とみなす
export function ended(e) {
  if (e.end) return e.end < nowJst();
  if (e.timeUnknown) return e.start.slice(0, 10) < S.today;
  const t = new Date(e.start + ":00Z").getTime() + 3 * 3600e3;
  return new Date(t).toISOString().slice(0, 16) < nowJst();
}
export function evState(e) {
  if (e.status === "withdrawn") return ["withdrawn", "取り下げ", "mut"];
  if (e.status !== "published") return ["pending", "保留", "info"];
  return ended(e) ? ["ended", "終了", "mut"] : ["published", "掲載中", "ok"];
}
const isStale = (e) => evState(e)[0] === "published" && e.checked && daysSince(e.checked) > 60;
// 確認日から60日を過ぎた、掲載中の開催(一覧の「要確認」)
export const staleEvents = () => S.events.filter(isStale);

// 保存のあとの、公開(サイトへ送る)の結果を知らせる。失敗の知らせは、閉じるまで消さない
export function published(r, what) {
  const p = r.publish;
  const geo = r.geocode ? "\n" + r.geocode.split("\n").filter((l) => /^(OK|NG|--)/.test(l)).join("\n") : "";
  if (!p || p.ok) return toast(`${what}。サイトに送りました(数分後に表示が変わります)${geo}`);
  const step = { build: "サイトを作る確認で、問題が見つかりました", test: "開催データの検査で、問題が見つかりました(このまま送ると、サイトの公開が止まります)", commit: "変更を記録できませんでした", push: "GitHub に送れませんでした" }[p.step] || "公開できませんでした";
  toast(`${what}が、サイトにはまだ出ていません。${step}。\n保存はできています。画面の上の「もう一度公開する」で、やり直せます。\n${(p.log || "").split("\n").slice(-4).join("\n")}`, { bad: true, keep: true });
}
const sending = () => toast("保存して、サイトに送っています…(数十秒かかることがあります)", { busy: true });
export async function republish(ev) {
  try { await busy(ev?.currentTarget, "公開しています…", async () => { const r = await call("/api/publish", {}); published(r, "変更を送りました"); }); render(); }
  catch (err) { fail(err); }
}

export async function rejectEvent(e) {
  if (!(await confirmBox({ title: "この開催を却下しますか?", body: `「${e.name}」(${when(e)})`, danger: true, ok: "却下する",
    points: [["site", "サイトには、もともと載っていません。保留の一覧から外します。"], ["noundo", "週次の自動収集でも、取り直さなくなります。あとで載せたくなったら、「開催を追加する」から入れ直します。"]] }))) return;
  sending();
  try { const r = await call("/api/events/reject", { id: e.id }); published(r, "却下しました"); render(); }
  catch (err) { fail(err); }
}
export async function setEventStatus(e, status) {
  const off = status === "withdrawn";
  if (!(await confirmBox(off
    ? { title: "この開催を取り下げますか?", body: `「${e.name}」(${when(e)})`, danger: true, ok: "取り下げる", points: [["site", "すぐにサイトに送り、数分後に、一覧からもページからも外れます。"], ["undo", "「開催」の「取り下げ」の一覧から、「再掲載」で戻せます。"]] }
    : { title: "この開催を、もう一度掲載しますか?", body: `「${e.name}」(${when(e)})`, ok: "再掲載する", points: [["site", "すぐにサイトに送り、数分後に表示されます。"], ["undo", "「取り下げ」で、また外せます。"]] }))) return;
  sending();
  try { const r = await call("/api/events/status", { id: e.id, status }); published(r, off ? "取り下げました" : "掲載に戻しました"); render(); }
  catch (err) { fail(err); }
}

// ---------- 一覧 ----------
const FILTERS = [["upcoming", "これから"], ["pending", "保留"], ["stale", "要確認(確認日から60日超え)"], ["ended", "終了"], ["withdrawn", "取り下げ"], ["all", "すべて"]];
const inFilter = (f, e, st) => f === "all" || (f === "upcoming" ? st[0] === "published" || st[0] === "pending" : f === "stale" ? isStale(e) : st[0] === f);
function rowsFor() {
  const q = view.evQuery.trim();
  return S.events.map((e) => ({ e, st: evState(e) }))
    .filter(({ e, st }) => inFilter(view.evFilter, e, st))
    .filter(({ e }) => !q || [e.name, e.kagura, e.prefecture, e.city, e.venue, e.id].join(" ").includes(q))
    .sort((a, b) => (view.evFilter === "ended" ? b.e.start.localeCompare(a.e.start) : a.e.start.localeCompare(b.e.start)));
}
const approve = (e) => openEditor({ ...e, checked: S.today }, null, { approve: true });
function eventRow({ e, st }) {
  return h("li", { class: "ev" },
    h("div", { class: "ev-when" }, h("b", null, jpDate(e.start).slice(5)), h("span", null, e.timeUnknown ? "時刻未定" : e.start.slice(11, 16) + (e.end ? "〜" + e.end.slice(11, 16) : ""))),
    h("div", { class: "ev-main" },
      h("p", { class: "ev-name" }, st[0] === "published" ? ext(pageUrl(e.id), e.name) : e.name),
      h("p", { class: "mut small" }, [e.kagura, `${e.prefecture}${e.city || ""}`, e.venue].filter(Boolean).join(" ・ ")),
      h("p", { class: "ev-tags" }, badge(st[2], st[1]),
        !e.lat && e.status === "published" ? badge("warn", "地図の位置なし") : "",
        isStale(e) ? badge("warn", `要確認(確認日 ${e.checked})`) : e.checked ? h("span", { class: "mut small" }, `確認日 ${e.checked}`) : "")),
    h("div", { class: "ev-act" },
      e.status === "pending" ? [h("button", { class: "btn sm tonal", onclick: () => approve(e) }, "確かめて掲載"), h("button", { class: "btn sm", onclick: () => rejectEvent(e) }, "却下")] : "",
      h("button", { class: "btn sm", onclick: () => openEditor(e), "aria-label": `${e.name} を編集` }, "編集"),
      e.status === "withdrawn" ? h("button", { class: "btn sm", onclick: () => setEventStatus(e, "published"), "aria-label": `${e.name} を再掲載` }, "再掲載")
        : e.status === "published" ? h("button", { class: "btn sm", onclick: () => setEventStatus(e, "withdrawn"), "aria-label": `${e.name} を取り下げ` }, "取り下げ") : ""));
}
function listBox() {
  const rows = rowsFor(), shown = rows.slice(0, view.evLimit);
  return h("div", { id: "ev-list" },
    h("p", { class: "mut small", role: "status" }, `${rows.length} 件${rows.length > shown.length ? `(はじめの ${shown.length} 件を表示)` : ""}`),
    rows.length ? h("ul", { class: "rows" }, shown.map(eventRow))
      : empty("当てはまる開催はありません", view.evQuery ? "絞り込みの言葉を変えるか、上の切り替えで「すべて」を選んでください。" : "上の切り替えで、ほかの一覧を見られます。"),
    rows.length > shown.length ? h("div", { class: "bar center" }, h("button", { class: "btn", onclick: () => { view.evLimit += 40; render(); } }, `さらに ${Math.min(40, rows.length - shown.length)} 件を表示`)) : "");
}
export function eventsView() {
  const cnt = (f) => S.events.filter((e) => inFilter(f, e, evState(e))).length;
  const search = h("input", { type: "search", id: "ev-q", placeholder: "名称・地域・会場", value: view.evQuery,
    oninput: (ev) => { view.evQuery = ev.target.value; view.evLimit = 40; $("#ev-list").replaceWith(listBox()); } }); // 一覧だけを描き直す(入力の途中で、欄が作り直されないように)
  return [
    h("p", { class: "lead" }, "サイトに載せる開催の一覧です。追加・編集・取り下げは、保存と同時にサイトへ送ります。"),
    h("div", { class: "toolbar" },
      h("div", { class: "f inline" }, h("label", { for: "ev-q" }, "絞り込む"), search),
      h("button", { class: "btn primary", onclick: () => openEditor(null) }, icon("plus"), "開催を追加する")),
    seg("表示する開催", FILTERS.map(([k, t]) => [k, t, cnt(k)]), view.evFilter, (k) => { view.evFilter = k; view.evLimit = 40; render(); }),
    listBox(),
  ];
}

// ---------- 開催の編集(申請の許可・保留の掲載にも使う) ----------
// opts.approve: 保留中の開催を、内容を確かめて掲載する(自動収集の ID は変えない)
export function openEditor(e, item, opts = {}) {
  const d = e || {};
  const start = d.start || "", end = d.end || "", posting = !!(item || opts.approve);
  const chk = (id, label, checked) => h("div", { class: "f chk wide" }, h("input", { type: "checkbox", id: "f-" + id, checked: !!checked }), h("label", { for: "f-" + id }, label));
  const group = (title, ...kids) => h("fieldset", { class: "fs" }, h("legend", null, title), h("div", { class: "grid" }, kids));
  const social = d.socialEvidence || {};
  const body = [
    posting ? note("warn", "公式情報のページを開き、日時・会場が合っているかを確かめてから掲載してください。出典には、確かめたページの名前を入れます。", d.url ? [" ", ext(d.url, "公式情報のページを開く")] : "") : "",
    opts.approve && (d.holdReasons || []).length ? note("info", h("b", null, "保留になった理由"), h("ul", { class: "reasons" }, d.holdReasons.map((r) => h("li", null, r)))) : "",
    group("名前と種類",
      field("name", "名称", input("name", d.name, { required: true, maxlength: 80 }), { wide: true }),
      field("kagura", "神楽の種類", input("kagura", d.kagura, { required: true, maxlength: 40, placeholder: "例: 石見神楽" })),
      field("fee", "料金", input("fee", d.fee, { maxlength: 80, placeholder: "例: 無料" }), { optional: true })),
    group("いつ",
      field("date", "開催日", input("date", start.slice(0, 10), { type: "date" })),
      field("time", "開始時刻", input("time", d.timeUnknown ? "" : start.slice(11, 16), { type: "time" })),
      chk("timeUnknown", "時刻は未定・不明", d.timeUnknown),
      field("enddate", "終了日", input("enddate", end && end.slice(0, 10) !== start.slice(0, 10) ? end.slice(0, 10) : "", { type: "date" }), { optional: true, help: "空なら、開催日と同じ日" }),
      field("endtime", "終了時刻", input("endtime", end.slice(11, 16), { type: "time" }), { optional: true })),
    group("どこで",
      field("prefecture", "都道府県", h("select", { id: "f-prefecture", name: "prefecture" }, h("option", { value: "" }, "選んでください"), S.prefectures.map((p) => h("option", { selected: p === d.prefecture }, p)))),
      field("city", "市区町村", input("city", d.city, { maxlength: 40 })),
      field("venue", "会場名", input("venue", d.venue, { maxlength: 80 })),
      field("address", "番地までの住所", input("address", d.address, { maxlength: 100 }), { optional: true, help: "地図の位置を付けるのに使います" })),
    group("内容と出典",
      field("url", "公式情報のページの URL", input("url", d.url, { type: "url", maxlength: 300, placeholder: "https://" }), { wide: true }),
      field("description", "ひとこと説明(300字まで)", h("textarea", { id: "f-description", name: "description", rows: 3, maxlength: 300 }, d.description || ""), { wide: true, optional: true }),
      field("source", "出典(確かめたページの名前)", input("source", d.source, { maxlength: 80, placeholder: "例: 〇〇町観光協会" })),
      field("checked", "確認日", input("checked", d.checked || S.today, { type: "date" }), { help: "公式情報で確かめた日" })),
    h("details", { class: "more fs-more", open: social.organizer || social.authorityUrl ? true : null }, h("summary", null, "SNS の投稿をもとに載せるとき"),
      h("div", { class: "grid" },
        field("socialOrganizer", "SNS の保存会・社中の名前", input("socialOrganizer", social.organizer, { maxlength: 100 })),
        field("socialAuthorityUrl", "公式アカウントだと分かるページの URL", input("socialAuthorityUrl", social.authorityUrl, { type: "url", maxlength: 500 }), { help: "団体のサイト・自治体の紹介など" }),
        field("socialAuthorityNote", "主体を確かめた内容", input("socialAuthorityNote", social.authorityNote, { maxlength: 300, placeholder: "例: 観光協会の紹介から、投稿元へのリンクを確認" }), { wide: true }),
        chk("socialVerified", "SNS の個別の投稿を、ログインせずに読み、公式の投稿元・開催日・会場・入力した事実を確かめました(検索の要約だけでは、チェックしない)"))),
    h("details", { class: "more fs-more" }, h("summary", null, "ページの番号(ID)"),
      h("div", { class: "grid" },
        // 掲載後の ID は変えない(ページの URL が変わり、リンク切れになる)
        field("id", "ID(ページの URL になります。英小文字・数字・ハイフン)", input("id", d.id, { required: true, pattern: "[a-z0-9-]+", readonly: e && !item ? true : null }), { wide: true, help: e && !item ? "掲載したあとは変えられません" : "候補が入っています。そのままで構いません" }))),
  ];
  const okText = posting ? "掲載する(サイトに出ます)" : "保存する(サイトに送ります)";
  openForm({
    title: posting ? "内容を確かめて掲載する" : e ? "開催を編集する" : "開催を追加する", body, ok: okText, busyText: "保存して、サイトに送っています…(数十秒かかります)", map: { start: "date", end: "endtime" },
    onSubmit: async () => {
      const v = (id) => $("#f-" + id).value.trim();
      const unknown = $("#f-timeUnknown").checked, date = v("date");
      const endDate = v("enddate") || date;
      const ev2 = { id: v("id"), name: v("name"), kagura: v("kagura"), prefecture: v("prefecture"), city: v("city"), venue: v("venue"), address: v("address"),
        start: date ? `${date}T${unknown ? "00:00" : v("time") || "00:00"}` : "", end: v("endtime") && date ? `${endDate}T${v("endtime")}` : "",
        timeUnknown: unknown || (!!date && !v("time")), fee: v("fee"), url: v("url"), description: v("description"), source: v("source"), checked: v("checked"), socialOrganizer: v("socialOrganizer"), socialAuthorityUrl: v("socialAuthorityUrl"), socialAuthorityNote: v("socialAuthorityNote"), socialVerified: $("#f-socialVerified").checked };
      const r = await call("/api/events/save", { event: ev2, originalId: e && !item ? e.id : null, inboxId: item ? item.id : null, approve: !!opts.approve });
      published(r, posting ? "掲載しました" : "保存しました");
      render();
    },
  });
}
