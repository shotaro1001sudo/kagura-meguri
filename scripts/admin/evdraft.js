// 開催の説明の下書き(scripts/admin/event-draft.mjs)。
// 申請から掲載した開催などで説明(開催ページの冒頭の概要)がないものに、予定タスクが公式の情報から下書きを書く。
// 開催ページと同じ並びで読み、「公開する」か「作り直しを頼む」を選ぶ
import { h, S, render, call, toast, fail, confirmBox, askBox, badge, note, ext, busy, jpDate } from "./ui.js";
import { published } from "./events.js";

// 確かめ待ちの下書き / 予定タスクが書くのを待っている開催(作り直しを頼んだものを含む)
export const eventDrafts = () => (S.eventGaps || []).filter((g) => g.draft?.status === "draft");
// 並びは予定タスクが書く順(event-draft.mjs の nextBatch と同じ): 作り直し → これからの開催の近い順 → 終わった開催の新しい順
export const eventWaiting = () => {
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const rank = (g) => (g.draft?.status === "redo" ? 0 : (g.end || g.start).slice(0, 10) < today ? 2 : 1);
  return (S.eventGaps || []).filter((g) => !g.draft || g.draft.status === "redo")
    .sort((a, b) => rank(a) - rank(b) || (rank(a) === 2 ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start)));
};

const RESERVATION = { required: "事前予約が必要", recommended: "事前予約を推奨", not_required: "事前申込不要" };
const hm = (dt) => (dt ? `${+dt.slice(5, 7)}/${+dt.slice(8, 10)} ${dt.slice(11, 16)}` : "");
const sec = (title, ...kids) => h("section", { class: "kd-sec" }, h("h4", null, title), kids);

export function eventDraftCard(g) {
  const d = g.draft, v = d.draft;
  // 未確認だった項目のうち、下書きで埋めるもの(すでに入っている値は変えない)
  const fills = [
    v.fee != null ? ["料金", "未確認", v.fee] : null,
    v.end != null ? ["終了", "未確認", hm(v.end)] : null,
    v.reservationStatus != null ? ["予約要否", "未確認", RESERVATION[v.reservationStatus] ?? v.reservationStatus] : null,
  ].filter(Boolean);
  const left = [g.unknown?.fee && v.fee == null ? "料金" : "", g.unknown?.end && v.end == null ? "終了時刻" : "", g.unknown?.reservationStatus && v.reservationStatus == null ? "予約要否" : ""].filter(Boolean);
  const publish = async (ev) => {
    const btn = ev.currentTarget;
    if (!(await confirmBox({ title: `「${g.name}」の説明を公開しますか?`, body: "ほかの開催の保存と同じ確認(サイトの作り直し・データのテスト)を通してから送ります。", ok: "公開する",
      points: [["site", `開催ページの冒頭の説明に出ます${fills.length ? `。${fills.map((f) => f[0]).join("・")}も入れます` : ""}。`], ["info", "公開したあとに直すときは、「開催」の一覧から、この開催を編集します。"]] }))) return;
    try {
      await busy(btn, "確かめて、公開しています…", async () => {
        const r = await call("/api/event-draft/publish", { id: g.id });
        const p = r.publish;
        if (p && !p.ok && ["build", "test", "geo"].includes(p.step))
          toast(`「${g.name}」の説明は、サイトの確認に通らなかったので、公開せずに下書きに戻しました。「作り直しを頼む」で、直してほしい点に下の内容を貼ってください。\n${(p.log || "").split("\n").slice(-6).join("\n")}`, { bad: true, keep: true });
        else published(r, `「${g.name}」の説明を公開しました`);
      });
      render();
    } catch (err) { fail(err); }
  };
  const redo = async () => {
    const a = await askBox({ title: `「${g.name}」の説明の作り直しを頼みます`, body: "次の朝の予定タスクが、書いた点を直して、下書きを作り直します。",
      fields: [{ name: "note", label: "直してほしい点", type: "textarea", required: true, maxlength: 1000, placeholder: "例: 開始時刻の案内も入れてほしい。駐車場のことは書かないでほしい" }], ok: "作り直しを頼む" });
    if (!a) return;
    try { await call("/api/event-draft/redo", { id: g.id, note: a.note }); toast("作り直しを頼みました(次の朝の予定タスクが作ります)"); render(); }
    catch (err) { fail(err); }
  };
  return h("article", { class: "card kdraft" },
    h("div", { class: "card-h" }, h("h3", null, `${g.name}の説明(下書き)`), badge("info", "確かめ待ち")),
    h("p", { class: "mut small" }, `${jpDate(d.createdAt)}に予定タスクが作成 ・ ${hm(g.start)} ・ ${g.prefecture}${g.city} ${g.venue}${g.kagura ? " ・ " + g.kagura : ""}`),
    d.lastError ? note("warn", "前に公開しようとしたとき、サイトの確認に通りませんでした。「作り直しを頼む」で、直してほしい点に、この内容を貼ってください。", h("pre", { class: "draft" }, d.lastError.split("\n").slice(-8).join("\n"))) : "",
    d.note ? note("info", h("b", null, "予定タスクから: "), d.note) : "",
    sec("説明(開催ページの冒頭に出ます)", h("p", null, v.description)),
    fills.length ? sec("未確認だった項目に入れるもの", h("ul", null, fills.map(([k, from, to]) => h("li", null, h("b", null, k), `: ${from} → ${to}`)))) : "",
    left.length ? h("p", { class: "mut small" }, `公式の情報で確かめられなかったので、「未確認」のままにする項目: ${left.join("・")}`) : "",
    sec("参考にしたページ(開いて、書いてあることと合うかを確かめます)", h("ul", null, (v.refs || []).map((r) => h("li", null, ext(r.url, r.name))))),
    h("div", { class: "bar" }, h("button", { class: "btn primary", onclick: publish }, "公開する"), h("button", { class: "btn", onclick: redo }, "作り直しを頼む")));
}

/** 下書きを待っている開催(予定タスクが毎朝作る) */
export function eventWaitingNote() {
  const w = eventWaiting();
  if (!w.length) return "";
  return h("p", { class: "mut small" }, "説明の下書きを待っている開催: ",
    w.slice(0, 5).map((g) => `${g.name}${g.draft?.status === "redo" ? "(作り直しを頼みました)" : ""}`).join("、") + (w.length > 5 ? ` ほか${w.length - 5}件` : ""),
    `。毎朝の予定タスク「神楽の解説・開催の説明の下書き」が、1回に5件まで(作り直し → これからの開催の近い順 → 終わった開催)作ります${w.length > 5 ? `(全部で${w.length}件。あと${Math.ceil(w.length / 5)}回ほど)` : ""}。`);
}
