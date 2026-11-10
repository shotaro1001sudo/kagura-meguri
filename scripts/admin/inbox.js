// 受信箱: 投稿フォームからの掲載の申請と、お問い合わせ。メールから読み込んだものを一覧にし、選ぶと中身と操作が出る。
// 投稿者の名前・メールアドレス・メモは、このPCの中だけに保存する
import { h, S, view, render, call, toast, fail, confirmBox, badge, seg, kv, note, icon, ext, pageUrl, jpDate, recv, isOpen, inboxOpen, openMail, busy, empty } from "./ui.js";
import { openEditor, setEventStatus, evState } from "./events.js";

const STATUS_FILTER = { submit: [["open", "未対応"], ["published", "掲載済み"], ["rejected", "却下"], ["all", "すべて"]], contact: [["open", "未対応・対応中"], ["done", "完了"], ["all", "すべて"]] };
const TONE = { new: "info", doing: "warn", done: "ok", published: "ok", rejected: "mut" };

export async function fetchMail(ev) {
  try {
    await busy(ev?.currentTarget, "読み込んでいます…", async () => {
      const r = await call("/api/fetch-mail", {});
      toast(`新しく ${r.added} 件を読み込みました${r.replies ? `。営業の相手からの返信 ${r.replies} 件(「営業」に出ます)` : ""}${r.pruned ? `(保存期間を過ぎた ${r.pruned} 件を削除)` : ""}${r.replyError ? `。営業の返信は読み込めませんでした(${r.replyError})` : ""}`, !!r.replyError);
    });
    render();
  } catch (err) { fail(err); }
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

function detail(x, back) {
  const ev = x.eventId ? S.events.find((e) => e.id === x.eventId) : null;
  const target = x.target && x.target.startsWith(S.baseUrl + "/events/") ? S.events.find((e) => pageUrl(e.id) === x.target.split(/[?#]/)[0]) : null;
  const memo = h("textarea", { id: "memo", rows: 3, class: "full", maxlength: 2000 }, x.memo || "");
  const upd = async (body, msg) => { try { await call("/api/inbox/update", { id: x.id, ...body }); toast(msg); render(); } catch (err) { fail(err); } };
  const reject = async () => {
    if (await confirmBox({ title: "この申請を却下しますか?", body: x.draft?.name || x.subject, danger: true, ok: "却下する", points: [["local", "サイトには何も載りません。投稿した人への連絡は、下の「見送りのお知らせ」から自分で送ります。"], ["undo", "「対応中に戻す」で戻せます。"]] })) upd({ status: "rejected" }, "却下しました");
  };
  const sub = x.kind === "submit";
  return h("section", { class: "card", "aria-labelledby": "inb-h" },
    h("button", { class: "btn sm quiet", onclick: back }, icon("back"), "一覧に戻る"),
    h("div", { class: "card-h" }, h("h2", { id: "inb-h", tabindex: "-1" }, x.subject), badge(TONE[x.status] || "info", S.inboxStatus[x.status])),
    !x.viaForm ? note("warn", "このメールは、フォームの送信サービス以外から届いています。なりすましの可能性があるので、内容を慎重に確かめてください。") : "",
    kv(["受信", new Date(x.received).toLocaleString("ja-JP")], ["送った人", `${x.sender || "(名前なし)"} ${x.email ? "<" + x.email + ">" : ""}`],
      ...Object.entries(x.fields).filter(([k]) => !/お名前|メールアドレス/.test(k)).map(([k, v]) => [k, /^https:\/\//.test(v) ? ext(v) : v])),
    x.kind === "contact" && !Object.keys(x.fields).length ? h("pre", { class: "draft" }, x.message) : "",
    ev ? h("p", null, "掲載した開催: ", ext(pageUrl(ev.id), ev.name), " ", badge(evState(ev)[2], evState(ev)[1])) : "",
    h("h3", null, "対応する"),
    h("div", { class: "bar" },
      sub && x.status !== "published" ? h("button", { class: "btn tonal", onclick: () => openEditor({ ...x.draft, source: "", checked: S.today, status: "pending" }, x) }, "内容を確かめて掲載する") : "",
      sub && x.status !== "rejected" && x.status !== "published" ? h("button", { class: "btn", onclick: reject }, "却下する") : "",
      ev ? h("button", { class: "btn", onclick: () => openEditor(ev) }, "掲載内容を編集") : "",
      ev && ev.status !== "withdrawn" ? h("button", { class: "btn", onclick: () => setEventStatus(ev, "withdrawn") }, "掲載を取り下げる") : "",
      target ? h("button", { class: "btn", onclick: () => openEditor(target) }, "対象の開催を編集") : "",
      target && target.status !== "withdrawn" ? h("button", { class: "btn", onclick: () => setEventStatus(target, "withdrawn") }, "対象の開催を取り下げる") : "",
      sub && x.status === "new" ? h("button", { class: "btn", onclick: () => upd({ status: "doing" }, "対応中にしました") }, "対応中にする") : "",
      sub && x.status !== "new" && x.status !== "doing" ? h("button", { class: "btn quiet", onclick: () => upd({ status: "doing" }, "対応中に戻しました") }, "対応中に戻す") : ""),
    x.kind === "contact" ? h("div", { class: "f inline" }, h("label", { for: "con-st" }, "対応の状況"),
      h("select", { id: "con-st", onchange: (e2) => upd({ status: e2.target.value }, "対応の状況を変えました") }, ["new", "doing", "done"].map((s) => h("option", { value: s, selected: x.status === s }, S.inboxStatus[s])))) : "",
    x.email ? [h("h3", null, "返信する"), h("p", { class: "mut small" }, S.gmailUser ? "定型文を入れて、Gmail の作成画面を開きます。送るのは自分です。" : "定型文を入れて、メールアプリを開きます。送るのは自分です。"),
      h("div", { class: "bar" }, replies(x, ev).map(([label, body]) => h("button", { class: "btn", onclick: () => openMail(x.email, "Re: " + x.subject, body) }, label)))] : "",
    h("h3", null, h("label", { for: "memo" }, "メモ")), h("p", { class: "mut small" }, "このPCの中だけに保存します。"), memo,
    h("div", { class: "bar" }, h("button", { class: "btn", onclick: () => upd({ memo: memo.value }, "メモを保存しました") }, "メモを保存")));
}

export function inboxView() {
  const kind = view.box === "contact" ? "contact" : "submit";
  const key = kind === "submit" ? "sub" : "con", selKey = kind === "submit" ? "selSubmit" : "selContact";
  const items = S.inbox.filter((x) => x.kind === kind).filter((x) => view[key] === "all" || (view[key] === "open" ? isOpen(x) : x.status === view[key]));
  const sel = S.inbox.find((x) => x.kind === kind && x.id === view[selKey]) || null;
  const head = [
    seg("受信箱の種類", [["submit", "掲載の申請", inboxOpen("submit") || null], ["contact", "問い合わせ", inboxOpen("contact") || null]], kind, (k) => { view.box = k; render(); }),
    !S.mailReady ? note("warn", "メールを読み込む設定が、まだありません。「設定」の「メールの読み込み」を見てください。") : "",
  ];
  if (sel) return [head, detail(sel, () => { view[selKey] = null; render(); })];
  const open = (x) => { view[selKey] = x.id; render(); window.scrollTo(0, 0); document.getElementById("inb-h")?.focus({ preventScroll: true }); };
  return [head,
    h("div", { class: "toolbar" },
      seg("状態で絞り込む", STATUS_FILTER[kind], view[key], (v) => { view[key] = v; render(); }),
      S.mailReady ? h("button", { class: "btn", onclick: fetchMail }, icon("refresh"), "新しいメールを読み込む") : ""),
    h("p", { class: "mut small", role: "status" }, `${items.length} 件${S.lastFetch ? ` ・ 前回の読み込み: ${new Date(S.lastFetch).toLocaleString("ja-JP")}` : ""}`),
    items.length ? h("ul", { class: "rows" }, items.map((x) => h("li", null, h("button", { class: "inb", onclick: () => open(x) },
      h("span", { class: "inb-when" }, recv(x.received)),
      h("span", { class: "inb-main" }, h("b", null, kind === "submit" ? x.draft?.name || x.subject : x.topic || x.subject),
        h("span", { class: "mut small" }, kind === "submit" ? `${jpDate(x.draft?.start)} ${x.draft?.prefecture || ""}${x.draft?.city || ""}` : x.sender || "")),
      badge(TONE[x.status] || "info", S.inboxStatus[x.status]), icon("chev")))))
      : empty(view[key] === "open" ? (kind === "submit" ? "未対応の申請はありません" : "未対応の問い合わせはありません") : "当てはまるものはありません", "フォームから届くと、ここに並びます。"),
  ];
}
