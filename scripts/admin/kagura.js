// 神楽の種類の解説の下書き(scripts/admin/kagura-draft.mjs)。
// 予定タスクが出典つきで書いた下書きを、種類のページと同じ並びで読み、「公開する」か「作り直しを頼む」を選ぶ
import { h, S, render, call, toast, fail, confirmBox, askBox, badge, note, ext, busy, jpDate } from "./ui.js";
import { published } from "./events.js";

// 確かめ待ちの下書き / 予定タスクが書くのを待っている種類(作り直しを頼んだものを含む)
export const kaguraDrafts = () => (S.kaguraGaps || []).filter((g) => g.draft?.status === "draft");
export const kaguraWaiting = () => (S.kaguraGaps || []).filter((g) => !g.draft || g.draft.status === "redo");

const EMPTY = "なし(ページに「情報がありません。」と出ます)";
const sec = (title, ...kids) => h("section", { class: "kd-sec" }, h("h4", null, title), kids);
const lines = (xs) => (xs?.length ? h("ul", null, xs.map((t) => h("li", null, t))) : h("p", { class: "mut small" }, EMPTY));

export function draftCard(g) {
  const d = g.draft, v = d.info;
  const publish = async (ev) => {
    const btn = ev.currentTarget;
    if (!(await confirmBox({ title: `「${g.kind}」の解説を公開しますか?`, body: "サイトの全部のテストを通してから送ります(1分ほどかかります)。", ok: "公開する",
      points: [["site", `種類のページの「${g.kind}とは」・歴史・特徴・主な演目・観賞のコツに出ます。`], ["info", "公開したあとに直すときは、Claude に頼みます。"]] }))) return;
    try {
      await busy(btn, "テストを通して、公開しています…(1分ほど)", async () => {
        const r = await call("/api/kagura/publish", { kind: g.kind });
        const p = r.publish;
        if (p && !p.ok && ["build", "test", "geo"].includes(p.step))
          toast(`「${g.kind}」の解説は、サイトのテストに通らなかったので、公開せずに下書きに戻しました。「作り直しを頼む」で、直してほしい点に下の内容を貼ってください。\n${(p.log || "").split("\n").slice(-6).join("\n")}`, { bad: true, keep: true });
        else published(r, `「${g.kind}」の解説を公開しました`);
      });
      render();
    } catch (err) { fail(err); }
  };
  const redo = async () => {
    const a = await askBox({ title: `「${g.kind}」の下書きの作り直しを頼みます`, body: "次の朝の予定タスクが、書いた点を直して、下書きを作り直します。",
      fields: [{ name: "note", label: "直してほしい点", type: "textarea", required: true, maxlength: 1000, placeholder: "例: 歴史の2つ目の段落の出典が見つからない。公式の説明に合わせてほしい" }], ok: "作り直しを頼む" });
    if (!a) return;
    try { await call("/api/kagura/redo", { kind: g.kind, note: a.note }); toast("作り直しを頼みました(次の朝の予定タスクが作ります)"); render(); }
    catch (err) { fail(err); }
  };
  return h("article", { class: "card kdraft" },
    h("div", { class: "card-h" }, h("h3", null, `${g.kind}の解説(下書き)`), badge("info", "確かめ待ち")),
    h("p", { class: "mut small" }, `${jpDate(d.createdAt)}に予定タスクが作成 ・ 掲載している開催・定期公演 ${g.count}件`),
    d.lastError ? note("warn", "前に公開しようとしたとき、サイトのテストに通りませんでした。「作り直しを頼む」で、直してほしい点に、この内容を貼ってください。", h("pre", { class: "draft" }, d.lastError.split("\n").slice(-8).join("\n"))) : "",
    d.note ? note("info", h("b", null, "予定タスクから: "), d.note) : "",
    d.warnings?.length ? note("warn", h("ul", { class: "reasons" }, d.warnings.map((w) => h("li", null, w)))) : "",
    h("p", { class: "kd-tagline" }, v.tagline),
    sec(`${g.kind}とは`, h("p", null, v.intro)),
    sec("歴史", (v.history || []).map((t) => h("p", null, t))),
    sec("特徴", lines(v.features)),
    sec("主な演目", v.programs?.length ? h("ul", null, v.programs.map((p) => h("li", null, h("b", null, p.name), " ", p.text))) : h("p", { class: "mut small" }, EMPTY)),
    sec("観賞のコツ", lines(v.viewing)),
    sec("出典(ページに出る名前)", h("p", null, v.source)),
    sec("参考にしたページ(開いて、書いてあることと合うかを確かめます)", h("ul", null, (v.refs || []).map((r) => h("li", null, ext(r.url, r.name))))),
    h("div", { class: "bar" }, h("button", { class: "btn primary", onclick: publish }, "公開する"), h("button", { class: "btn", onclick: redo }, "作り直しを頼む")));
}

/** 下書きを待っている種類(予定タスクが毎朝作る) */
export function waitingNote() {
  const w = kaguraWaiting();
  if (!w.length) return "";
  return h("p", { class: "mut small" }, "下書きを待っている種類: ",
    w.map((g) => `${g.kind}${g.draft?.status === "redo" ? "(作り直しを頼みました)" : ""}`).join("、"),
    "。毎朝の予定タスク「神楽の解説・開催の説明の下書き」が作ります。");
}
