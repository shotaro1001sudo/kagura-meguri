// 「広告・協賛について」(/sponsor.html)の本文。
// 地域の観光協会・宿・お店などに、協賛枠とPR記事を案内する。
// ここに書く「載せる場所」は、サイトに実在するページだけにする(tests/sponsor.mjs で確認)。
// 閲覧数などの数字や、読者の傾向は、ページに書かない(確かめていないため。数字はご相談の際に伝える)。
// 中立の方針(掲載は無料・協賛で掲載や並び順を変えない・PRの表示)は、「主催者の方へ」と食い違わないようにする。
// 例のリンクは、行き先が分かるように、県名・公演名を文字にする。

/** @param {{ esc: (s:string)=>string, siteName: string, pref?: { name: string, href: string }, reg?: { name: string, href: string }, plans?: { name: string, priceText: string, includes: string[] }[] }} x */
export function sponsorHtml({ esc, siteName, pref, reg, plans = [] }) {
  const eg = (x) => (x ? `(例: <a href="${x.href}">${esc(x.name)}</a>)` : "");
  return `
<p class="olead">${esc(siteName)}は、全国の神楽の開催情報をまとめたサイトです。神楽を観に来る方に、会場の近くの宿やお店、観光の情報を届けませんか。地域の皆さまからの<strong>協賛</strong>を受け付けています。</p>
<ul class="opoints">
<li><b>出かける方に届く</b><span>開催日や会場を調べている方が読むページに載ります。</span></li>
<li><b>地域ごとに載る</b><span>都道府県や定期公演のページに、その地域の情報として載ります。</span></li>
</ul>
<p class="octa"><a class="btn" href="/contact.html">協賛について問い合わせる</a></p>

<h2>このような方へ</h2>
<ul class="ocards">
<li><b>観光協会・自治体</b>神楽を目当てに来る方に、地域の見どころや交通を案内したい。</li>
<li><b>宿・温泉地</b>定期公演や秋祭りの時期に、会場の近くに泊まれることを知らせたい。</li>
<li><b>飲食店・道の駅・お土産</b>公演の前後に立ち寄れるお店として、知ってもらいたい。</li>
</ul>

<h2>載せられる場所</h2>
<ul class="ocards">
<li><b>都道府県のページの協賛枠</b>その県の神楽と開催予定をまとめたページ${eg(pref)}に載せます。</li>
<li><b>定期公演のページの協賛枠</b>毎週・毎晩の定期公演のページ${eg(reg)}に、会場の近くの情報として載せます。</li>
<li><b>PR記事</b>地域の観光や、神楽と合わせて楽しめる過ごし方を紹介する記事です。記事は編集部が書き、公開の前に内容をご確認いただきます。</li>
</ul>
<p>料金は、載せる場所と期間に応じてお見積もりします。これまでの閲覧数などは、ご相談の際にお伝えします。</p>
${plans.length ? `
<h2>神楽団・主催者の方へ: 団体ページ</h2>
<p>写真・動画・演目の紹介をまとめた、団体だけのページを月額でご用意します(<a href="/partner/sample.html">見本</a>)。</p>
<ul class="ocards plans">${plans.map((p) => `<li><b>${esc(p.name)}<span class="plan-price">${esc(p.priceText)}</span></b>${p.includes.map(esc).join("。")}。</li>`).join("")}</ul>
<p class="octa"><a class="btn" href="/apply.html">団体ページを申し込む</a></p>
` : ""}
<h2>掲載の方針</h2>
<ul class="rules">
<li><strong>開催情報の掲載は、これからも無料</strong>です。協賛の有無で、掲載するかどうか・並び順・本文は変えません。</li>
<li>協賛枠とPR記事には、<strong>「PR」と表示</strong>します。リンクには、検索エンジンに広告であると伝える印(sponsored)を付けます。</li>
<li>神楽団・保存会・神社の名前や写真は、その団体の了解があるときだけ使います。</li>
<li>次のものは載せません: 事実と異なる表示、神事や地域の文化を軽んじる内容、投資や賭け事、成人向けの内容、政党や宗教への勧誘。</li>
<li>掲載の前に、内容を確かめます。方針に合わない場合は、お断りすることがあります。</li>
</ul>

<h2>掲載までの流れ</h2>
<ol class="steps">
<li><b>ご相談</b><span><a href="/contact.html">お問い合わせ</a>の「ご用件」で「広告・取材などのご相談」を選び、載せたい場所と時期をお知らせください。</span></li>
<li><b>お見積もり</b><span>載せる場所・期間・料金をお伝えします。</span></li>
<li><b>原稿の確認</b><span>載せる文章と画像が、掲載の方針に合っているかを確かめます。</span></li>
<li><b>掲載</b><span>決めた期間だけ載せ、期間が終わったら外します。</span></li>
</ol>

<h2>よくあるご質問</h2>
<div class="faq">
<details><summary>協賛すると、開催情報が目立つように載りますか?</summary><p>いいえ。開催情報は、協賛の有無にかかわらず、同じ形・同じ順で載せます。協賛枠は、開催情報とは別の場所に「PR」と表示して載せます。</p></details>
<details><summary>神楽の開催情報を載せるのに、費用はかかりますか?</summary><p>かかりません。<a href="/organizers.html">主催者の方へ</a>のとおり、開催情報の掲載は無料です。</p></details>
<details><summary>短い期間だけでも載せられますか?</summary><p>はい。秋祭りの時期だけなど、期間を区切ってご相談ください。</p></details>
</div>

<p class="cta-end"><a class="btn" href="/contact.html">協賛について問い合わせる</a></p>
`;
}
