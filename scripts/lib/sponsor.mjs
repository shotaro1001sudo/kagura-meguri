// 「広告・協賛のご案内」(/sponsor.html)の本文。媒体資料を兼ねる(MON-2)。
// 地域の観光協会・宿・道の駅・お店などに、月額の協賛枠と、1回ごとの記事広告(取材記事)を案内する。
// 並び: 要点 → 数字で見る(掲載の件数・アクセスの概数)→ メニューと料金の比べ → 載る場所と見本 → 方針 → 流れ → よくある質問。
// ここに書く「載せる場所」は、サイトに実在するページだけにする(tests/sponsor.mjs で確認)。
// 数字は「数字で見る」(.sp-stats)と団体ページの料金(ul.plans)だけに置く。
//   - 掲載の件数は、ビルドの時点の実数(サイトの作りの事実)。
//   - アクセスは、data/media-stats.json の概数だけ(上から2桁で切り捨て。scripts/lib/media-stats.mjs)。集計期間・出典を必ず添える。
//   - 集計が古い・無いときは、アクセスの数字を出さず、「ご相談の際にお伝えします」とだけ書く。
// 読者の傾向は、確かめていないことを書かない。書くのは「どんなことを調べる人のためのページか」(サイトの作りの事実)だけ。
// 中立の方針(掲載は無料・協賛で掲載や並び順を変えない・PRの表示)は、「主催者の方へ」と食い違わないようにする。
// 例のリンクは、行き先が分かるように、県名・神楽の名前・公演名を文字にする。
// 協賛枠の表示の仕組みは scripts/lib/sponsor-slots.mjs(データは data/sponsors.json)。
import { approx } from "./media-stats.mjs";

const jpDay = (d) => d.replace(/^(\d{4})-0?(\d+)-0?(\d+)$/, "$1年$2月$3日");
const jpShort = (d) => d.replace(/^\d{4}-0?(\d+)-0?(\d+)$/, "$1月$2日");

/**
 * @param {{ esc: (s:string)=>string, siteName: string,
 *   pref?: { name: string, href: string }, kagura?: { name: string, href: string }, ev?: { name: string, href: string }, reg?: { name: string, href: string },
 *   plans?: { name: string, priceText: string, includes: string[] }[],
 *   prices?: { monthly?: number, article?: number },   協賛枠(月額)と記事広告(1本)の料金。税込。無いものは「お見積もり」
 *   facts?: { events: number, prefs: number, kaguras: number, regular: number },
 *   stats?: { updated: string, search?: { from: string, to: string, impressions: number, clicks: number, impressions7?: number, clicks7?: number }, analytics?: { from: string, to: string, pageviews: number, users: number } } | null,
 *   topPages?: { name: string, href: string }[] }} x
 */
export function sponsorHtml({ esc, siteName, pref, kagura, ev, reg, plans = [], prices = {}, facts, stats, topPages = [] }) {
  const yen = (n) => `${Number(n).toLocaleString("ja-JP")}円`;
  const ok = (n) => Number.isFinite(n) && n > 0;
  const monthlyText = ok(prices.monthly) ? `月額${yen(prices.monthly)}(税込)` : "お見積もり";
  const articleText = ok(prices.article) ? `1本${yen(prices.article)}(税込)` : "お見積もり";
  const priced = ok(prices.monthly) && ok(prices.article);
  const eg = (x) => (x ? `<span class="eg">例: <a href="${x.href}">${esc(x.name)}</a></span>` : "");
  const s = stats?.search, a = stats?.analytics;
  const tile = (label, value, unit, note = "") => `<li><span class="k">${label}</span><span class="v">${value}<small>${unit}</small></span>${note ? `<span class="n">${note}</span>` : ""}</li>`;

  const factsHtml = facts ? `
<h3>掲載している情報</h3>
<ul class="sp-tiles">
${tile("これからの開催", facts.events.toLocaleString("ja-JP"), "件")}
${tile("都道府県", String(facts.prefs), "都道府県")}
${tile("神楽の種類", String(facts.kaguras), "種類")}
${tile("毎週・毎晩の定期公演", String(facts.regular), "か所")}
</ul>` : "";

  const accessHtml = s || a ? `
<h3>アクセス(参考)</h3>
<ul class="sp-tiles">
${s ? tile("Googleの検索結果に表示された回数", approx(s.impressions), "回", `直近4週間${s.impressions7 ? `。うち直近1週間で${approx(s.impressions7)}回` : ""}`) : ""}
${s ? tile("検索から訪れた回数", approx(s.clicks), "回", `直近4週間${s.clicks7 ? `。うち直近1週間で${approx(s.clicks7)}回` : ""}`) : ""}
${a ? tile("ページの閲覧数", approx(a.pageviews), "回", "直近4週間。計測に同意した方の分だけ") : ""}
</ul>
<p class="sp-src">${[s && `検索: Google Search Console(${jpShort(s.from)}〜${jpShort(s.to)})`, a && `閲覧数: Googleアナリティクス(${jpShort(a.from)}〜${jpShort(a.to)})`].filter(Boolean).join("・")}。数字は上から2桁で切り捨てた概数です(${jpDay(stats.updated)}更新)。載せたいページごとの数字は、ご相談の際にお伝えします。</p>`
    : `<p class="sp-src">アクセスの数字は、ご相談の際に、載せたいページについてお伝えします。</p>`;

  const topHtml = topPages.length ? `
<h3>よく読まれているページ</h3>
<p class="sp-src">検索から訪れた方が多い順です。</p>
<ol class="sp-top">${topPages.map((p) => `<li><a href="${p.href}">${esc(p.name)}</a></li>`).join("")}</ol>` : "";

  const plan = (p) => p ? `<li class="sp-plan">
<p class="tag">神楽団・主催者の方へ</p>
<h3>${esc(p.name)}</h3>
<p class="price">${esc(p.priceText)}</p>
<dl><dt>載る場所</dt><dd>団体だけのページ(<a href="/partner/sample.html">見本</a>)</dd><dt>内容</dt><dd>${p.includes.map(esc).join("。")}。</dd></dl>
</li>` : "";

  return `
<p class="olead">${esc(siteName)}は、全国の神楽の開催日・会場・定期公演をまとめた、<strong>神楽に特化したサイト</strong>です。神楽を観に出かける方に、会場の近くの宿や道の駅、観光の情報を届けませんか。地域の皆さまからの<strong>協賛</strong>と<strong>記事広告</strong>を受け付けています。</p>
<ul class="opoints">
<li><b>神楽を目当てに出かける方に届く</b><span>「いつ・どこで神楽が観られるか」を調べる方のためのページに載ります。</span></li>
<li><b>地域ごと・神楽の種類ごとに載る</b><span>県・神楽の種類・開催のページに、その地域の情報として載ります。</span></li>
<li><b>「PR」と表示して、開催情報と分ける</b><span>読む方が迷わないよう、開催情報とは別の枠に載せます。</span></li>
</ul>
<p class="octa"><a class="btn" href="/contact.html">協賛・記事広告について問い合わせる</a><a class="btn ghost" href="#menu">メニューと料金を見る</a></p>

<section class="sp-stats" aria-labelledby="sp-stats-h">
<h2 id="sp-stats-h">数字で見る${esc(siteName)}</h2>
${factsHtml}
${accessHtml}
${topHtml}
</section>

<h2>どんな方が読むページか</h2>
<ul class="ocards">
<li><b>開催日と会場を調べる方</b>公演の日時・会場・料金・予約の要否を確かめて、出かける計画を立てる方のためのページです。</li>
<li><b>好きな神楽を追いかける方</b>流派や系統など、神楽の種類ごとに、開催と定期公演をまとめています。</li>
<li><b>遠くから訪ねる方</b>開催のページから、会場の近くの宿・交通・周辺の体験を探せるようにしています。</li>
</ul>
<p>一般の旅行サイトとちがい、神楽という目的がはっきりした方が読むサイトです。協賛の情報は、その神楽の地域や、公演の前後の過ごし方として届けます。</p>

<h2>このような方へ</h2>
<ul class="ocards">
<li><b>観光協会・自治体</b>神楽を目当てに来る方に、地域の見どころや交通を案内したい。</li>
<li><b>宿・温泉地</b>定期公演や秋祭りの時期に、会場の近くに泊まれることを知らせたい。</li>
<li><b>道の駅・飲食店・お土産</b>公演の前後に立ち寄れるお店として、知ってもらいたい。</li>
</ul>

<h2 id="menu">掲載のメニュー</h2>
<p>目的に合わせて選べます。組み合わせることもできます。</p>
<ul class="sp-menu">
<li class="sp-plan">
<p class="tag">観光協会・宿・お店の方へ</p>
<h3>協賛枠(月ごと)</h3>
<p class="price">${esc(monthlyText)}</p>
<dl><dt>載る場所</dt><dd>県・神楽の種類・開催・定期公演のページから、地域や神楽を決めて選べます</dd><dt>内容</dt><dd>見出し・ひとこと・リンク。「PR」と提供者の名前を表示</dd><dt>期間</dt><dd>月ごと。秋祭りの時期だけなど、続けて載せることもできます</dd></dl>
</li>
<li class="sp-plan">
<p class="tag">じっくり紹介したい方へ</p>
<h3>記事広告(お申し込みごと)</h3>
<p class="price">${esc(articleText)}</p>
<dl><dt>載る場所</dt><dd>記事のページ。協賛枠から記事へご案内します</dd><dt>内容</dt><dd>宿や道の駅、地域の観光を、神楽と合わせて楽しめる過ごし方として、編集部が取材して書きます。公開の前に内容をご確認いただきます</dd><dt>表示</dt><dd>「PR記事」と表示します</dd></dl>
</li>
${plans.map(plan).join("")}
</ul>
${plans.length ? `<p class="octa"><a class="btn ghost" href="/apply.html">団体ページを申し込む</a></p>` : ""}
<p class="sp-src">${priced ? "協賛枠の料金には、選んだ定期公演・開催(または神楽の種類)のページと、その県のページへの掲載を含みます。お支払いは、請求書をお送りして銀行振込の前払いです。協賛枠は月ごとのお申し込みで、やめるときは前の月の末までにお知らせください。" : "協賛枠と記事広告の料金は、載せる場所と期間に応じてお見積もりします。"}</p>

<h2>載る場所と見え方</h2>
<p>協賛枠は、次のページに、開催情報の一覧より後ろの、別の枠に載ります。</p>
<ul class="ocards">
<li><b>県のページ</b>その県の神楽と開催予定をまとめたページ。${eg(pref)}</li>
<li><b>神楽の種類のページ</b>神楽の種類ごとの日程と解説のページ。${eg(kagura)}</li>
<li><b>開催のページ</b>地域や神楽の種類を決めて、その開催のページに。${eg(ev)}</li>
<li><b>定期公演のページ</b>毎週・毎晩の定期公演のページに、会場の近くの情報として。${eg(reg)}</li>
</ul>
<figure class="sp-sample">
<figcaption>見え方の見本</figcaption>
<div class="sponsor-slot" aria-hidden="true"><p class="sp-head">地域の協賛</p><ul><li class="sp-item"><span class="pr">PR</span><span class="sp-title">神楽の夜は、会場から歩いて行ける温泉宿へ</span><p>公演のあとも、ゆっくり湯につかれます。神楽の日だけの夕食の時間もご用意しています。</p><p class="sp-by">提供: ◯◯温泉旅館</p></li></ul><p class="sp-note">協賛の有無で、開催情報の掲載や並び順は変わりません。</p></div>
</figure>

<h2>掲載の方針</h2>
<ul class="rules">
<li><strong>開催情報の掲載は、これからも無料</strong>です。協賛の有無で、掲載するかどうか・並び順・本文は変えません。</li>
<li>協賛枠と記事広告には、<strong>「PR」と表示</strong>し、提供者の名前を載せます。リンクには、検索エンジンに広告であると伝える印(sponsored)を付けます。</li>
<li>神楽団・保存会・神社の名前や写真は、その団体の了解があるときだけ使います。</li>
<li>次のものは載せません: 事実と異なる表示、神事や地域の文化を軽んじる内容、投資や賭け事、成人向けの内容、政党や宗教への勧誘。</li>
<li>掲載の前に、内容を確かめます。方針に合わない場合は、お断りすることがあります。</li>
</ul>

<h2>掲載までの流れ</h2>
<ol class="steps sp-steps">
<li><b>ご相談</b><span><a href="/contact.html">お問い合わせ</a>の「ご用件」で「広告・取材などのご相談」を選び、載せたい場所と時期をお知らせください。</span></li>
<li><b>${priced ? "お申し込み" : "お見積もり"}</b><span>${priced ? "載せる場所・期間を決めて、請求書をお送りします。載せたいページの閲覧数などの数字も、お伝えします。" : "載せる場所・期間・料金と、そのページの閲覧数などの数字をお伝えします。"}</span></li>
<li><b>原稿の確認・取材</b><span>載せる文章と画像が、掲載の方針に合っているかを確かめます。記事広告は、取材のうえ編集部が書きます。</span></li>
<li><b>掲載</b><span>決めた期間だけ載せ、期間が終わったら外します。</span></li>
</ol>

<h2>よくあるご質問</h2>
<div class="faq">
<details><summary>協賛すると、開催情報が目立つように載りますか?</summary><p>いいえ。開催情報は、協賛の有無にかかわらず、同じ形・同じ順で載せます。協賛枠は、開催情報とは別の場所に「PR」と表示して載せます。</p></details>
<details><summary>神楽の開催情報を載せるのに、費用はかかりますか?</summary><p>かかりません。<a href="/organizers.html">主催者の方へ</a>のとおり、開催情報の掲載は無料です。</p></details>
<details><summary>短い期間だけでも載せられますか?</summary><p>はい。秋祭りの時期だけなど、月を区切ってご相談ください。</p></details>
<details><summary>載せたいページの閲覧数を教えてもらえますか?</summary><p>はい。このページの数字はサイト全体の概数です。ご相談の際に、載せたい場所のページについてお伝えします。</p></details>
</div>

<p class="cta-end"><a class="btn" href="/contact.html">協賛・記事広告について問い合わせる</a></p>
`;
}
