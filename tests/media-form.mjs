// 写真・動画の受付フォームを作る Apps Script(scripts/apps-script/media-form.gs)のテスト。
// Google の FormApp を、呼ばれた内容を記録する偽物に差し替えて実行し、質問・検証・分岐・公開の設定と、
// 利用規約・MEDIA.md・サイトの表示との文言のずれがないかを確かめる。
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { PROVIDERS } from "../scripts/lib/media.mjs";

const read = (p) => readFileSync(p, "utf8");

function fakeGoogle() {
  const created = [], logs = [], store = {};
  const validation = (kind) => { const v = { kind, rules: [] }; const b = new Proxy({}, { get: (_, k) => k === "build" ? () => v : (...a) => { v.rules.push([k, ...a]); return b; } }); return b; };
  const item = (type) => {
    const it = { type, props: {}, choices: null };
    return Object.assign(it, {
      setTitle(t) { it.props.title = t; return it; }, setHelpText(t) { it.props.help = t; return it; },
      setRequired(r) { it.props.required = r; return it; }, setValidation(v) { it.props.validation = v; return it; },
      createChoice(value, nav) { return { value, nav }; }, setChoices(c) { it.choices = c; return it; },
    });
  };
  const makeForm = (title) => {
    const f = { title, items: [], settings: {}, id: `form-${created.length + 1}` };
    const set = (k) => (v) => { f.settings[k] = v; return f; };
    Object.assign(f, {
      setTitle: set("title"), setDescription: set("description"), setConfirmationMessage: set("confirmation"), setAllowResponseEdits: set("allowEdits"),
      setPublishingSummary: set("summary"), setShowLinkToRespondAgain: set("again"), setProgressBar: set("progress"),
      getId: () => f.id, getEditUrl: () => `https://docs.google.com/forms/d/${f.id}/edit`, getPublishedUrl: () => `https://docs.google.com/forms/d/e/${f.id}-pub/viewform`,
      shortenFormUrl: () => `https://forms.gle/${f.id}`,
    });
    for (const [m, t] of [["addTextItem", "text"], ["addMultipleChoiceItem", "choice"], ["addCheckboxItem", "checkbox"], ["addPageBreakItem", "page"]]) f[m] = () => { const i = item(t); f.items.push(i); return i; };
    return f;
  };
  const FormApp = {
    create: (t) => { const f = makeForm(t); created.push(f); return f; },
    openById: (id) => { const f = created.find((x) => x.id === id); if (!f) throw new Error("not found"); return f; },
    createTextValidation: () => validation("text"), createCheckboxValidation: () => validation("checkbox"),
  };
  const PropertiesService = { getScriptProperties: () => ({ getProperty: (k) => store[k] ?? null, setProperty: (k, v) => { store[k] = v; } }) };
  return { context: { FormApp, PropertiesService, Logger: { log: (s) => logs.push(String(s)) } }, created, logs, store };
}

export function mediaFormTests({ ok, section }) {
  section("写真・動画の受付フォーム(Apps Script)");
  const src = read("scripts/apps-script/media-form.gs");
  const g = fakeGoogle();
  runInNewContext(src + "\nthis.__id = createMediaForm();", g.context);
  const f = g.created[0];
  ok(g.created.length === 1 && g.context.__id === f.id && g.store.MEDIA_FORM_ID === f.id, "フォームを1つ作り、ID を覚えておく");
  const items = f.items, titles = items.map((i) => i.props.title);
  ok(JSON.stringify(titles) === JSON.stringify(["神楽の種類", "動画の URL(YouTube)", "撮影した時期", "撮影した場所・公演", "演目(分かれば)", "ご関係", "掲載するお名前", "掲載するお名前", "掲載するお名前・団体名", "ご連絡先と確認", "ご連絡先のメールアドレス", "確認"]), "質問の並び(MEDIA.md の表と同じ)", titles.join(" / "));
  const by = (t, type) => items.find((i) => i.props.title === t && (!type || i.type === type));
  ok(by("神楽の種類").props.required === true && by("ご関係").props.required === true && by("ご連絡先のメールアドレス").props.required === true && by("確認").props.required === true && !by("動画の URL(YouTube)").props.required && !by("撮影した時期").props.required, "必須は、神楽の種類・ご関係・掲載するお名前・メールアドレス・確認だけ(写真だけ・動画だけでも送れる)");
  ok(by("動画の URL(YouTube)").props.validation.rules.some((r) => r[0] === "requireTextIsUrl") && by("ご連絡先のメールアドレス").props.validation.rules.some((r) => r[0] === "requireTextIsEmail"), "動画は URL、連絡先はメールアドレスの形かを確かめる");
  ok(by("掲載するお名前・団体名").props.validation.rules.some((r) => r[0] === "requireTextLengthLessThanOrEqualTo" && r[1] === 40) && by("神楽の種類").props.validation.rules.some((r) => r[1] === 40), "名前と神楽の種類は40字まで(サイトのデータの上限と同じ)");
  ok(JSON.stringify(by("ご関係").choices.map((c) => c.value)) === JSON.stringify(Object.values(PROVIDERS)), "ご関係の選択肢は、管理者用ページの「提供者の区分」と同じ");
  const nameQ = by("掲載するお名前", "choice"), [namePage, contactPage] = items.filter((i) => i.type === "page");
  ok(nameQ.props.required === true && nameQ.choices.length === 2 && nameQ.choices[0].nav === namePage && nameQ.choices[1].nav === contactPage && /載せる/.test(nameQ.choices[0].value) && /読者提供/.test(nameQ.choices[1].value), "「載せない」を選んだ人は、名前のページを飛ばす(載せる人だけ、名前を必須で書く)");
  const checks = by("確認");
  ok(checks.type === "checkbox" && checks.choices.length === 4 && checks.props.validation.rules.some((r) => r[0] === "requireSelectAtLeast" && r[1] === 4), "確認は4つすべてに印がないと送れない");
  const media = read("MEDIA.md"), terms = read("scripts/lib/policy.mjs");
  ok(checks.choices.every((c) => media.includes(c.value)), "確認の4つの文言は、MEDIA.md と同じ");
  ok(["自ら撮影したもの", "撮影や公開が禁止・制限されている場所・場面", "舞い手以外の人の顔がはっきり分かるもの"].every((t) => terms.includes(t)) && /外国にある事業者への提供を含みます/.test(checks.choices[3].value), "確認の内容は、利用規約の保証(撮影者・場所・観客の顔)と、外国の事業者への提供の同意に対応している");
  const desc = f.settings.description;
  ok(desc.includes("https://kagurameguri.jp/terms.html") && desc.includes("https://kagurameguri.jp/privacy.html") && desc.includes("Google アカウントへのログインが必要") && desc.includes("Google アカウントの名前が付く") && desc.includes("Exif") && desc.includes("動画のファイルは受け付けていません"), "説明: 規約とポリシーへのリンク・ログインが必要なこと・アカウント名・Exif・動画は URL だけ(プライバシーポリシーと同じ内容)");
  ok(f.settings.summary === false && f.settings.allowEdits === false && f.settings.confirmation.includes("/contact.html"), "ほかの人の回答を見せない・送ったあとは編集できない・送信後に掲載をやめる窓口を示す");
  const log = g.logs.join("\n");
  ok(log.includes(f.getEditUrl()) && log.includes("https://forms.gle/") && log.includes("ファイルのアップロード") && log.includes("「神楽の種類」の質問を押してから") && log.includes("最大ファイル数は 10"), "実行ログに、編集用・回答用の URL と、手で足す「写真」の質問の作り方を出す");
  ok(/^https:\/\/(docs\.google\.com\/forms\/|forms\.gle\/)/.test("https://forms.gle/x") && /forms\.gle/.test(read("scripts/lib/media.mjs")), "回答用の短い URL(forms.gle)は、config.json の media.formUrl に、そのまま入れられる");
  g.logs.length = 0;
  runInNewContext("this.__id2 = createMediaForm();", g.context);
  ok(g.created.length === 1 && g.context.__id2 === f.id && g.logs.join("").includes("作成済み"), "もう一度実行しても、2つ目は作らない");
}
