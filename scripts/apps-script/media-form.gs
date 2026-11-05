/**
 * 神楽めぐり｜写真・動画の受付フォーム(Google フォーム)を作る
 *
 * 使い方(1回だけ。くわしくは MEDIA.md):
 *   1. 運営に使う Google アカウントで https://script.google.com を開き、「新しいプロジェクト」を作る
 *   2. この全文を「コード.gs」に貼り付けて保存し、関数 createMediaForm を選んで「実行」する
 *      (初回は権限の確認が出る。Google フォームの作成だけに使う)
 *   3. 「実行ログ」に出る編集用 URL を開き、「写真」の質問(ファイルのアップロード)を手で1つ足す
 *      ※ ファイルのアップロードの質問は、Google の仕組み上、プログラムからは作れない
 *
 * もう一度実行しても、2つ目は作らない(作成済みのフォームの URL を表示する)。
 * 質問の文言は、利用規約(写真・動画の提供)・プライバシーポリシー・MEDIA.md と合わせている。変えるときは、そろえて直す。
 */
const MEDIA_FORM = Object.freeze({
  TITLE: "神楽の写真・動画を送る|神楽めぐり",
  SITE: "https://kagurameguri.jp",
  PROP: "MEDIA_FORM_ID", // 作成したフォームの ID(二重に作らないため)
  ROLES: ["観覧した方", "神楽団・保存会・主催者"], // scripts/lib/media.mjs の PROVIDERS と同じ
  NAME_YES: "載せる(ニックネームでも構いません。団体の方は団体名)",
  NAME_NO: "載せない(「読者提供」と表示します)",
  // 4つすべてに印がないと送れない(利用規約の「写真・動画の提供」の保証と、外国の事業者への提供の同意)
  CHECKS: [
    "自分で撮影したもの(または、撮影した人・権利を持つ団体から、提供の許可を得たもの)です",
    "撮影や公開が禁止・制限されている場所・場面で撮影したものではありません",
    "観客など、舞い手以外の人の顔が、はっきり写っていません",
    "利用規約(写真・動画の提供)と、プライバシーポリシー(外国にある事業者への提供を含みます)に同意します",
  ],
});

/** フォームの説明(回答する人が最初に読む) */
function mediaFormDescription_() {
  return [
    "神楽の写真と、YouTube に公開した動画を募集しています。お送りいただいたものは、神楽めぐり編集部が確かめてから、サイトの「神楽の種類」のページに掲載します(すべてを掲載するとは限りません)。",
    "",
    "・写真のファイルを送るには、Google アカウントへのログインが必要です。Google の仕組みにより、送ったファイルの名前に Google アカウントの名前が付くなど、アカウントの情報の一部が編集部に伝わる場合があります。",
    "・写真は縮小して掲載し、撮影した位置などの、写真に含まれる情報(Exif)は取り除きます。",
    "・動画のファイルは受け付けていません。YouTube に公開した動画(限定公開を含みます)の URL をお送りください。",
    "・ご連絡先のメールアドレスは、確認のご連絡にだけ使います。サイトには表示しません。",
    "",
    "利用規約: " + MEDIA_FORM.SITE + "/terms.html",
    "プライバシーポリシー: " + MEDIA_FORM.SITE + "/privacy.html",
  ].join("\n");
}

/** 送信後に出る文 */
function mediaFormConfirmation_() {
  return "お送りいただき、ありがとうございます。編集部で内容を確かめてから掲載します(数日かかることがあります)。掲載をやめたいときは、" + MEDIA_FORM.SITE + "/contact.html からご連絡ください。";
}

/** 質問を並べる(ファイルのアップロードの質問は、作成後に「神楽の種類」のすぐ下へ手で足す) */
function buildMediaForm_(form) {
  form.setTitle(MEDIA_FORM.TITLE)
    .setDescription(mediaFormDescription_())
    .setConfirmationMessage(mediaFormConfirmation_())
    .setAllowResponseEdits(false)
    .setPublishingSummary(false) // ほかの人の回答(写真・名前・連絡先)を、回答者に見せない
    .setShowLinkToRespondAgain(true)
    .setProgressBar(true);
  const upTo = (n) => FormApp.createTextValidation().setHelpText(n + "字以内でお書きください").requireTextLengthLessThanOrEqualTo(n).build();

  // 1ページ目: 写真・動画について
  form.addTextItem().setTitle("神楽の種類").setHelpText("例: 石見神楽、高千穂神楽、広島神楽。分からなければ、地域の名前でも構いません。").setRequired(true).setValidation(upTo(40));
  form.addTextItem().setTitle("動画の URL(YouTube)")
    .setHelpText("YouTube に公開した動画(限定公開を含みます)の URL。動画のファイルは受け付けていません。写真だけのときは、空欄で構いません。")
    .setValidation(FormApp.createTextValidation().setHelpText("https:// で始まる URL をお書きください").requireTextIsUrl().build());
  form.addTextItem().setTitle("撮影した時期").setHelpText("例: 2026年11月").setValidation(upTo(20));
  form.addTextItem().setTitle("撮影した場所・公演").setHelpText("例: 浜田市・〇〇神社の秋祭り").setValidation(upTo(60));
  form.addTextItem().setTitle("演目(分かれば)").setHelpText("例: 大蛇、塵輪").setValidation(upTo(60));
  const role = form.addMultipleChoiceItem().setTitle("ご関係").setRequired(true);
  role.setChoices(MEDIA_FORM.ROLES.map((r) => role.createChoice(r)));
  const name = form.addMultipleChoiceItem().setTitle("掲載するお名前").setHelpText("サイトの写真・動画の下に表示する名前です。").setRequired(true);

  // 2ページ目(「載せる」を選んだ人だけ): 掲載するお名前
  const namePage = form.addPageBreakItem().setTitle("掲載するお名前");
  form.addTextItem().setTitle("掲載するお名前・団体名").setHelpText("「撮影: (お名前)」、団体の方は「提供: (団体名)」と表示します。").setRequired(true).setValidation(upTo(40));

  // 3ページ目: ご連絡先と確認
  const contactPage = form.addPageBreakItem().setTitle("ご連絡先と確認");
  form.addTextItem().setTitle("ご連絡先のメールアドレス").setHelpText("確認のご連絡にだけ使います。サイトには表示しません。").setRequired(true)
    .setValidation(FormApp.createTextValidation().setHelpText("メールアドレスをお書きください").requireTextIsEmail().build());
  const checks = form.addCheckboxItem().setTitle("確認").setHelpText("4つすべてに印を付けてください。").setRequired(true);
  checks.setChoices(MEDIA_FORM.CHECKS.map((c) => checks.createChoice(c)));
  checks.setValidation(FormApp.createCheckboxValidation().setHelpText("4つすべてに印を付けてください").requireSelectAtLeast(MEDIA_FORM.CHECKS.length).build());

  // 「載せない」を選んだ人は、名前のページを飛ばす
  name.setChoices([name.createChoice(MEDIA_FORM.NAME_YES, namePage), name.createChoice(MEDIA_FORM.NAME_NO, contactPage)]);
  return form;
}

/** 作成後に、手で行うこと(実行ログに出す) */
function mediaFormNextSteps_(form, url) {
  return [
    "写真・動画の受付フォームを作りました。",
    "編集用: " + form.getEditUrl(),
    "回答用(config.json の media.formUrl に入れる): " + url,
    "",
    "このあと、手で行うこと:",
    "1. 編集用の URL を開き、「神楽の種類」の質問を押してから、右の「+」(質問を追加)を押す",
    "2. 質問の種類を「ファイルのアップロード」にする(注意が出たら「続行」)。題は「写真」、説明は「長い辺が大きすぎない、JPEG か PNG の写真」",
    "   「特定のファイル形式のみ許可」をオンにして「画像」、最大ファイル数は 10、最大ファイルサイズは 10 MB。「必須」はオフ",
    "3. 画面右上に「公開」ボタンが出ていれば押す(公開済みなら不要)",
    "4. 「回答」タブの「︙」で「新しい回答についてのメール通知を受け取る」をオンにする",
    "5. 回答用の URL から試しに1回送り、届くことを確かめる(試しの回答と写真は、確かめたら削除)",
  ].join("\n");
}

/** これを1回実行する */
function createMediaForm() {
  const props = PropertiesService.getScriptProperties();
  const known = props.getProperty(MEDIA_FORM.PROP);
  if (known) {
    try {
      const f = FormApp.openById(known);
      Logger.log("作成済みです(2つ目は作りません)。\n編集用: " + f.getEditUrl() + "\n回答用: " + f.getPublishedUrl());
      return known;
    } catch (e) {
      // 作成済みのフォームが削除されていたら、作り直す
    }
  }
  const form = buildMediaForm_(FormApp.create(MEDIA_FORM.TITLE));
  props.setProperty(MEDIA_FORM.PROP, form.getId());
  let url = form.getPublishedUrl();
  try { url = form.shortenFormUrl(url); } catch (e) { /* 短縮できなければ、長い URL のまま使う */ }
  Logger.log(mediaFormNextSteps_(form, url));
  return form.getId();
}
