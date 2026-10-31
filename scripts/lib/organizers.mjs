// 「主催者の方へ」(/organizers.html)の本文。
// ここに書く「掲載すると載る場所・機能」は、サイトに実在するものだけにする(tests/organizers.mjs で確認)。
// 掲載の方針は、免責事項・プライバシーポリシーの記載と、食い違わないようにする。
// 読みやすさ: 要点を先にカードで示し、手順は番号つき、よくあるご質問は開閉式にする。文は短く、読点は少なめに。
// 使いやすさ: 送り方ごとに行き先のボタンを置く。スマホでは、冒頭と最後のボタンが見えない間だけ、画面の下に申し込みボタンを固定する(organizers.js)。

import { icon } from "./figures.mjs";

/** @param {{ esc: (s:string)=>string, siteName: string, formReady: boolean }} x */
export function organizersHtml({ esc, siteName, formReady }) {
  return `
<p class="olead">${esc(siteName)}は、全国の神楽の開催情報をまとめたサイトです。主催者・神社・保存会・神楽団・自治体・観光協会の皆さまからの開催情報を、<strong>無料で掲載</strong>しています。神楽を観に来る方が公演を見つける入口として、ぜひご活用ください。</p>
<ul class="opoints">
<li>${icon("tag")}<b>掲載は無料</b><span>費用は一切かかりません。</span></li>
<li>${icon("check")}<b>公式情報で確認</b><span>主催者などのページで内容を確かめてから載せます。</span></li>
<li>${icon("search")}<b>探しやすく載る</b><span>一覧・地図・日付の検索など、いくつもの入口から見つかります。</span></li>
</ul>
<p class="octa"><a class="btn" href="/submit.html">掲載を依頼する(無料)</a> <a class="btn ghost" href="/contact.html">お問い合わせ</a></p>

<h2>掲載すると、ここに載ります</h2>
<ul class="ocards">
<li>${icon("page")}<b>開催ごとのページ</b>日時・会場・料金と、公式情報へのリンクを載せます。会場の場所(Googleマップでの地図と経路の検索)と、カレンダーへの登録のリンクも付きます。</li>
<li>${icon("pin")}<b>一覧・地図・検索</b>トップの一覧、<a href="/map.html">地図で探す</a>、<a href="/calendar.html">日付・場所で探す</a>に出ます。</li>
<li>${icon("calendar")}<b>日付・地域・種類のページ</b><a href="/weekend.html">今週末の神楽</a>・<a href="/this-month.html">今月の神楽</a>のほか、月別・都道府県別・<a href="/kagura/">種類別</a>のページに自動で載ります。</li>
<li>${icon("globe")}<b>検索エンジン</b>Googleなどの検索エンジンが日時と会場を読み取りやすいように、ページを作っています。</li>
<li>${icon("rss")}<b>新着の配信</b><a href="/calendar.html">Googleカレンダーで購読できる日程</a>と、新着情報のフィードにも載ります。</li>
</ul>

<h2>送り方</h2>
<div class="oways">
<section class="oway"><h3>1件ずつの開催</h3>
<p><a href="/submit.html">掲載の依頼フォーム</a>から、1件ずつお送りください。${formReady ? "" : "現在は、送信ボタンを押すと、入力した内容が入ったメールの作成画面が開きます。そのまま送ってください。"}</p>
<table class="info">
<tr><th>必須</th><td>神楽・イベントの名称 / 神楽の種類 / 都道府県・市区町村 / 会場名 / 開催日</td></tr>
<tr><th>任意</th><td>開始・終了時刻 / 公式情報のURL / 番地までの住所(地図に正しく出すため) / 料金 / ひとこと説明</td></tr>
</table>
<p class="oway-go"><a class="btn" href="/submit.html">掲載の依頼フォームへ</a></p></section>
<section class="oway"><h3>定期公演・年間の日程</h3>
<p>毎週・毎月の定期公演や年間の日程表は、まとめて受け付けます。<a href="/contact.html">お問い合わせ</a>(ご用件は「その他」)から、日程が載っているページのURLか、日程の内容をお知らせください。</p>
<p class="oway-go"><a class="btn ghost" href="/contact.html">お問い合わせで送る</a></p></section>
<section class="oway"><h3>公式サイトの日程から自動で</h3>
<p>公式サイトに載っている日程を、毎週自動で取り込めることがあります。ご希望の方は、<a href="/contact.html">お問い合わせ</a>から日程のページのURLをお知らせください。反対に、自動で取り込んでほしくない場合もお知らせください。</p>
<details class="tech"><summary>Web担当の方へ(自動で取り込める条件)</summary>
<p>日程のページに、イベントの構造化データ(schema.org の Event)を入れている場合や、カレンダー形式(.ics)で公開している場合は、特に正確に取り込めます。取り込む前に、サイトの利用規約と robots.txt を確認します。</p>
</details>
<p class="oway-go"><a class="btn ghost" href="/contact.html">お問い合わせで相談する</a></p></section>
</div>

<h2>掲載までの流れ</h2>
<ol class="steps">
<li><b>受付</b><span>フォームかお問い合わせで受け付けます。</span></li>
<li><b>確認</b><span>主催者や神社、自治体、観光協会などのページで内容を確かめます。必要に応じて、メールで確認のご連絡をします。</span></li>
<li><b>掲載</b><span>確認でき次第、掲載します。開催ページには、情報の出典と確認した日を表示します。</span></li>
</ol>
<p class="meta">内容を確認できない場合や、サイトの方針に合わない場合は、掲載しないことがあります。</p>

<h2>掲載の方針</h2>
<ul class="rules">
<li>載せるのは、<strong>事実の情報と、公式情報へのリンク</strong>です。主催者のサイトの文章・写真・図などは転載しません。</li>
<li><strong>一般の見学を想定していない神事や、公開を望まれない行事</strong>は掲載しません。地域の方が公表している範囲で掲載します。</li>
<li><strong>ご依頼者のお名前・ご連絡先</strong>は、サイトに表示しません(<a href="/privacy.html">プライバシーポリシー</a>)。</li>
<li>掲載は無料です。</li>
</ul>

<h2>訂正・削除・掲載の停止</h2>
<div class="ofix"><p>日程の変更や中止、内容の誤り、掲載の停止のご希望は、<a href="/contact.html">お問い合わせ</a>からお知らせください。該当のページのURLを添えていただくと、すぐに対応できます。詳しくは<a href="/disclaimer.html">免責事項・情報の取り扱い</a>をご覧ください。</p>
<p class="oway-go"><a class="btn ghost" href="/contact.html">訂正・削除を依頼する</a></p></div>

<h2>よくあるご質問</h2>
<div class="faq">
<details><summary>主催者でなくても送れますか?</summary><p>はい、送れます。観覧した方からの情報も受け付けています。ただし、掲載するのは公式情報で内容を確認できたものだけです。</p></details>
<details><summary>写真やチラシを載せられますか?</summary><p>現在、写真・チラシの画像は掲載していません。公式情報のURLをお送りいただければ、開催ページからリンクします。</p></details>
<details><summary>はじめて観る方に、案内したいことがあります</summary><p>撮影の決まりや予約の方法などは、「ひとこと説明」の欄か公式情報のページに書いていただくと、確実に伝わります。一般的な見方やマナーは、<a href="/guide.html">はじめての神楽ガイド</a>にまとめています。</p></details>
</div>

<p class="cta-end"><a class="btn" href="/submit.html">掲載を依頼する(無料)</a> <a class="btn ghost" href="/contact.html">お問い合わせ</a></p>
<div class="octa-bar" hidden><a class="btn" href="/submit.html">掲載を依頼する(無料)</a></div>
`;
}
