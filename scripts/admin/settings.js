// 設定: スマホで開く(PC の画面だけ)・メールの読み込み・自動の読み込み・請求の設定・しくみと言葉の説明
import { h, S, view, render, call, toast, fail, confirmBox, note, loading, more, kv, ext, at } from "./ui.js";
import { fetchMail } from "./inbox.js";
import { editBilling } from "./sales.js";

// ---------- スマホで開く(Tailscale 経由。PC の画面だけに出す) ----------
const isPc = () => ["127.0.0.1", "localhost"].includes(location.hostname);
async function loadPhone() {
  view.phone = { loading: true }; render();
  try { view.phone = await call("/api/phone"); } catch (err) { view.phone = null; fail(err); }
  render();
}
async function resetPhone() {
  if (!(await confirmBox({ title: "スマホ用の鍵を作り直しますか?", danger: true, ok: "鍵を作り直す", points: [["noundo", "これまで開けていたスマホは、新しい QR コードを読むまで開けなくなります。"], ["info", "スマホをなくしたときに使います。"]] }))) return;
  try { await call("/api/phone/reset", {}); toast("鍵を作り直しました。新しい QR コードを読んでください"); await loadPhone(); }
  catch (err) { fail(err); }
}
function phoneBox() {
  const p = view.phone;
  if (!p) return [h("p", null, "外出先のスマホからも、この画面を開けます(このPCが起動していて、管理者用ページが動いている間だけ)。"),
    h("div", { class: "bar" }, h("button", { class: "btn", onclick: loadPhone }, "スマホ用の QR コードを出す"))];
  if (p.loading) return loading("調べています…");
  if (!p.ready) return [
    note("warn", "このPCで Tailscale(自分の端末だけをつなぐ無料のアプリ)が見つかりません。次の手順のあと、管理者用ページを開き直してください。"),
    h("ol", { class: "steps" },
      h("li", null, "このPCとスマホに Tailscale を入れ、同じアカウントでログインする(", ext("https://tailscale.com/download", "ダウンロード"), ")"),
      h("li", null, "Tailscale の管理画面で、MagicDNS と HTTPS 証明書を有効にする(", ext("https://login.tailscale.com/admin/dns", "DNS の設定"), ")"),
      h("li", null, "このPCで、コマンド ", h("code", null, "tailscale serve --bg 4300"), " を1回だけ実行する(このPCの管理者用ページを、自分の端末だけに見せる設定)")),
    h("p", { class: "mut small" }, "詳しくは、リポジトリの ADMIN.md の「スマホから開く」。"),
    h("div", { class: "bar" }, h("button", { class: "btn sm", onclick: loadPhone }, "もう一度調べる"))];
  return h("div", { class: "phone" },
    h("img", { class: "qr", src: "data:image/svg+xml;base64," + btoa(p.qr), alt: "スマホ用の QR コード", width: "200", height: "200" }),
    h("div", null,
      h("p", null, "スマホのカメラで読むと、そのスマホで管理者用ページが開きます(鍵が入り、90日間はそのまま開けます)。"),
      h("p", { class: "mut small" }, "アドレス: https://", p.host, "/ ・ スマホで Tailscale をオンにしておく必要があります。"),
      note("warn", "この QR コードは、スマホの鍵です。ほかの人に見せたり、写真で送ったりしないでください。"),
      h("div", { class: "bar" },
        h("button", { class: "btn sm", onclick: () => { view.phone = null; render(); } }, "QR コードを隠す"),
        h("button", { class: "btn sm quiet", onclick: resetPhone }, "鍵を作り直す(今までのスマホを締め出す)"))));
}

const WORDS = [
  ["頼む文", "Claude に作業を頼むときに貼り付ける文です(プロンプトとも呼びます)。この画面は文を出すだけで、Claude に作業はさせません。"],
  ["目標の数字", "最終目標(売上)に届くために、月ごとに追う数字です(KPI とも呼びます)。"],
  ["作業の記録", "Claude が作業を終えたときに GitHub に残す記録です(コミットとも呼びます)。管理番号が書かれていると、「実施済み」と分かります。"],
  ["管理番号", "改善案や助言に付く番号です(SEO-…・MEAS-…・ADV-…・MON-…)。Claude に頼むときの目印になります。"],
  ["保留", "自動で集めた開催のうち、自動の検査に通らなかったものです。人が公式情報で確かめてから載せます。"],
  ["サイトに送る(公開)", "保存した開催データを GitHub に送ることです。数分後に、サイトの表示が変わります。"],
  ["振り返りのページ", "毎週月曜に GitHub にできる、点検の結果と「今週やること」のページです(Issue とも呼びます)。"],
  ["予定タスク", "PC の Claude アプリが、決まった時刻に動かす作業です(Note の投稿・3日に1回の分析など)。"],
];

export function settingsView() {
  const rf = S.refresh || {};
  return [
    isPc() ? h("section", { class: "card", "aria-labelledby": "set-phone" }, h("h2", { id: "set-phone" }, "スマホで開く"), phoneBox()) : "",
    h("section", { class: "card", "aria-labelledby": "set-mail" }, h("h2", { id: "set-mail" }, "メールの読み込み"),
      S.mailReady
        ? [h("p", null, "フォームから届いた申請・問い合わせと、営業の相手からの返信を、Gmail から読み込みます。Gmail のメールを、既読にしたり消したりはしません。"),
          h("div", { class: "bar" }, h("button", { class: "btn", onclick: fetchMail }, "新しいメールを読み込む"), h("span", { class: "mut small" }, S.lastFetch ? `前回: ${new Date(S.lastFetch).toLocaleString("ja-JP")}` : "まだ読み込んでいません"))]
        : note("warn", "Gmail の設定が、まだありません。リポジトリの ADMIN.md の「最初に1回だけ: Gmail の設定」の手順で、admin.local.json を作ってください(GitHub には上がりません)。設定のあと、この画面を開き直します。")),
    h("section", { class: "card", "aria-labelledby": "set-auto" }, h("h2", { id: "set-auto" }, "自動の読み込み"),
      h("p", null, rf.hours ? `管理者用ページが動いている間、${rf.hours}時間おきに、GitHub の最新の取り込みと、メールの読み込みを行います。画面の上の「最新にする」で、すぐにも行えます。` : "自動の読み込みは、止めています。画面の上の「最新にする」で、手で行えます。"),
      rf.last ? kv(["前回", `${at(rf.last.at)}(${rf.last.why})`], ["GitHub", rf.last.git?.text], ["メール", rf.last.mail?.text], ["X の書き出し", rf.last.hooks?.text]) : h("p", { class: "mut small" }, "まだ読み込んでいません(起動の1分後に、最初の読み込みをします)。")),
    S.pipeline ? h("section", { class: "card", "aria-labelledby": "set-bill" }, h("h2", { id: "set-bill" }, "請求の設定"),
      h("p", null, "請求書に載せる差出人と振込先です。このPCにだけ保存します。"),
      S.pipeline.billingReady ? "" : note("info", "振込先が、まだ入っていません。"),
      h("div", { class: "bar" }, h("button", { class: "btn", onclick: editBilling }, "差出人と振込先を入れる・変える"))) : "",
    h("section", { class: "card", "aria-labelledby": "set-how" }, h("h2", { id: "set-how" }, "しくみと、言葉の説明"),
      more("サイトに出るもの・このPCだけのもの",
        h("p", { class: "mut" }, "開催の追加・編集・取り下げ・再掲載と、保留の掲載・却下は、保存と同時に GitHub に送ります(数分後にサイトに出ます)。送る前に、サイトを作れるかを確かめ、作れないときは送りません。送れなかったときは、画面の上に「もう一度公開する」が出ます。"),
        h("p", { class: "mut" }, "目標の数字・収益化の案・営業の台帳・請求・問い合わせのメモは、このPCだけに保存し、GitHub には送りません。売上と集客の数字も、公開のサイトや GitHub には出しません。")),
      more("言葉の説明", h("dl", { class: "words" }, WORDS.map(([w, t]) => [h("dt", null, w), h("dd", null, t)])))),
  ];
}
