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
// 「実際のページ」のリンクは、行き先が分かるように、県名・神楽の名前・公演名を文字にする。
// 見本(協賛枠・記事広告・載せ方の例)には、特定の神楽の名前・団体の名前を使わない(「◯◯温泉旅館」のように書く。tests/sponsor.mjs で確認)。
// 記事広告の見本ページ(/pr/sample.html、noindex)の本文は sponsorArticleSampleHtml。
// 協賛枠の表示の仕組みは scripts/lib/sponsor-slots.mjs(データは data/sponsors.json)。
import { approx } from "./media-stats.mjs";

/**
 * 協賛のページと記事広告の見本ページだけの CSS。layout の head に入れる(CSP はインラインの style をハッシュで許可する)。
 * 全ページ共通の scripts/style.css には入れない(全ページが重くなり、クイズのページが 140KB の上限を超えるため)。
 * 協賛枠そのもの(.sponsor-slot・.pr)は全ページで使うので style.css のまま。
 */
export const SPONSOR_CSS = `<style>
.sp-stats{margin:44px 0 0;padding:4px 22px 18px;border:1px solid color-mix(in srgb,var(--line) 75%,transparent);border-radius:var(--radius);background:var(--card);box-shadow:var(--shadow)}
.prose .sp-stats h2{margin:22px 0 4px}.prose .sp-stats h3{margin:22px 0 10px;font-size:var(--fs-s);color:var(--mut);letter-spacing:.08em}
.prose .sp-tiles{list-style:none;padding:0;margin:0;display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(min(100%,140px),1fr))}
.prose .sp-tiles li{margin:0;padding:12px 14px;border-radius:var(--radius-s);background:var(--bg);display:flex;flex-direction:column;gap:2px}
.sp-tiles .k{font-size:var(--fs-xs);color:var(--mut);line-height:1.6}
.sp-tiles .v{font-family:var(--serif);font-size:var(--fs-xl);color:var(--ac);line-height:1.3;font-variant-numeric:tabular-nums}
.sp-tiles .v small{font-family:var(--sans);font-size:var(--fs-xs);color:var(--mut);margin-left:3px}
.sp-tiles .n{font-size:var(--fs-2xs);color:var(--mut);line-height:1.6}
.prose .sp-src{margin:10px 0 0;font-size:var(--fs-xs);color:var(--mut);line-height:1.8}
.prose .sp-top{margin:8px 0 0;padding-left:1.6em;columns:2 16em;column-gap:28px}.prose .sp-top li{margin:0 0 6px;break-inside:avoid}
.prose .sp-menu{list-style:none;padding:0;margin:16px 0 0;display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))}
.prose .sp-plan{margin:0;padding:16px 18px 14px;border:1px solid color-mix(in srgb,var(--line) 75%,transparent);border-radius:var(--radius);background:var(--card);box-shadow:var(--shadow);display:flex;flex-direction:column}
.prose .sp-plan .tag{margin:0;font-size:var(--fs-2xs);color:var(--mut);letter-spacing:.06em}
.prose .sp-plan h3{margin:4px 0 2px;font-size:var(--fs-l)}
.prose .sp-plan .price{margin:0 0 10px;color:var(--ac);font-weight:500}
.sp-plan dl{margin:0;padding-top:10px;border-top:1px solid var(--line);font-size:var(--fs-s);line-height:1.75}
.sp-plan dt{font-size:var(--fs-2xs);color:var(--mut);letter-spacing:.06em}.sp-plan dd{margin:0 0 8px}
.ocards .eg{display:block;margin-top:4px;font-size:var(--fs-xs);color:var(--mut)}
.ocards.noic li{padding-left:18px}
.sp-sample{margin:18px 0 0}.sp-sample figcaption{font-size:var(--fs-xs);color:var(--mut)}.sp-sample .sponsor-slot{margin:6px 0 0}
.sp-sample .sp-title{font-weight:500;color:var(--ac);text-decoration:underline;text-underline-offset:3px}
.prose .sp-sample+.octa{margin-top:14px}
.sp-article{margin:6px 0 0;padding:16px 18px 14px;border:1px dashed var(--line);border-radius:4px;background:var(--card)}
.prose .sp-article p{margin:0;font-size:var(--fs-s);line-height:1.9}
.sp-article-by,.prose .sp-article-toc{font-size:var(--fs-xs);color:var(--mut)}.prose .sp-article-toc{margin-top:10px}
.prose .sp-article-title{margin:8px 0 6px;font-family:var(--serif);font-weight:500;font-size:var(--fs-xl);line-height:1.5}
.sp-ready dl{margin:4px 0 0;font-size:var(--fs-s);line-height:1.75}.sp-ready dt{font-size:var(--fs-2xs);color:var(--mut);letter-spacing:.06em;margin-top:8px}.sp-ready dd{margin:0}
.pr-byline{font-size:var(--fs-s);color:var(--mut)}
.prose .pr-photo{margin:20px 0}.pr-photo-box{display:grid;place-items:center;min-height:180px;padding:16px;border:1px dashed var(--mut);border-radius:var(--radius);color:var(--mut);font-size:var(--fs-s);text-align:center;background:var(--card)}.pr-photo figcaption{font-size:var(--fs-xs);color:var(--mut);margin-top:6px}
.pr-facts{display:grid;grid-template-columns:max-content 1fr;gap:6px 16px;font-size:var(--fs-s)}.pr-facts dt{color:var(--mut)}.pr-facts dd{margin:0}
.pr-about{margin-top:40px;padding:4px 22px 18px;border:1px solid color-mix(in srgb,var(--line) 75%,transparent);border-radius:var(--radius);background:var(--card)}.prose .pr-about h2{margin-top:18px}.pr-about .cta-end{margin-top:20px}
@media(min-width:641px){.sp-steps{grid-template-columns:repeat(2,minmax(0,1fr))}.sp-steps li:nth-child(2n):after{display:none}}
</style>`;

/** 見本に使う、架空の提供者と記事(特定の神楽・団体の名前を使わない) */
export const SAMPLE_SPONSOR = {
  inn: { name: "◯◯温泉旅館", title: "神楽の夜は、会場から歩いて行ける温泉宿へ", text: "公演のあとも、ゆっくり湯につかれます。神楽の日だけの夕食の時間もご用意しています。" },
  station: { name: "道の駅◯◯", title: "公演の前の腹ごしらえに。地元の味と、神楽の面のお土産", text: "会場へ向かう道の途中にあります。神楽の日は、閉まる時間を遅くしています。" },
  article: {
    title: "神楽の夜は、会場から歩いて行ける温泉宿へ",
    lead: "秋の夜、神楽の舞台がはねたあと。冷えた体を温める湯と、朝までゆっくり休める部屋が、会場から歩いて行けるところにあります。◯◯温泉旅館で過ごす、神楽の日の夜と翌朝をご紹介します。",
    sections: [
      ["会場から宿まで", "公演の会場から宿までは、提灯の明かりをたどって歩ける距離です。夜道でも迷わない道順を、宿の方に教えてもらいました。車で来る方のための駐車場と、公演の日の混み具合も聞いています。"],
      ["神楽の日だけの夕食の時間", "公演の時間に合わせて、夕食を早めにも、公演のあとにもできます。地元の野菜と川魚を使った膳は、舞台を観る前にも、観たあとにも、ちょうどよい量です。"],
      ["公演のあとの湯", "夜遅くまで入れる内湯と、小さな露天があります。舞台の余韻のまま、静かな湯につかって、冷えた体を温められます。"],
      ["翌朝のおすすめ", "朝食のあとは、宿から歩ける神社と、帰り道の道の駅へ。前の晩に観た演目のことを、宿の方に聞いてみるのも、この地域ならではの楽しみです。"],
    ],
    facts: [["宿の名前", "◯◯温泉旅館"], ["所在地", "◯◯県◯◯市"], ["神楽の会場から", "歩いて行ける距離(詳しくは記事の中で)"], ["予約・お問い合わせ", "宿の公式サイト(見本のため、リンクはありません)"]],
  },
};

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
  const eg = (x) => (x ? `<span class="eg">実際のページ: <a href="${x.href}">${esc(x.name)}</a></span>` : "");
  const S = SAMPLE_SPONSOR;
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
<ul class="ocards noic">
<li><b>開催日と会場を調べる方</b>公演の日時・会場・料金・予約の要否を確かめて、出かける計画を立てる方のためのページです。</li>
<li><b>好きな神楽を追いかける方</b>流派や系統など、神楽の種類ごとに、開催と定期公演をまとめています。</li>
<li><b>遠くから訪ねる方</b>開催のページから、会場の近くの宿・交通・周辺の体験を探せるようにしています。</li>
</ul>
<p>一般の旅行サイトとちがい、神楽という目的がはっきりした方が読むサイトです。協賛の情報は、その神楽の地域や、公演の前後の過ごし方として届けます。</p>

<h2>このような方へ</h2>
<p>載せ方の例は、架空のものです。地域や神楽の種類に合わせて、ご一緒に考えます。</p>
<ul class="ocards noic sp-who">
<li><b>観光協会・自治体</b>神楽を目当てに来る方に、地域の見どころや交通を案内したい。<span class="eg">載せ方の例: 「神楽の前に寄りたい、◯◯の見どころと駐車場の案内」</span></li>
<li><b>宿・温泉地</b>定期公演や秋祭りの時期に、会場の近くに泊まれることを知らせたい。<span class="eg">載せ方の例: 「${esc(S.inn.title)}」</span></li>
<li><b>道の駅・飲食店・お土産</b>公演の前後に立ち寄れるお店として、知ってもらいたい。<span class="eg">載せ方の例: 「${esc(S.station.title)}」</span></li>
</ul>

<h2 id="menu">掲載のメニュー</h2>
<p>目的に合わせて選べます。組み合わせることもできます。</p>
<ul class="sp-menu">
<li class="sp-plan">
<p class="tag">観光協会・宿・お店の方へ</p>
<h3>協賛枠(月ごと)</h3>
<p class="price">${esc(monthlyText)}</p>
<dl><dt>載る場所</dt><dd>地域(県、または市町村)を決めると、その地域の県・開催・定期公演・神楽の種類のページにまとめて載ります。ひとつの祭りが終わっても、地域にほかの公演や定期公演があれば、そのページで載り続けます</dd><dt>内容</dt><dd>見出し・ひとこと・リンク。「PR」と提供者の名前を表示</dd><dt>期間</dt><dd>月ごと。1年を通して続けて載せることも、秋祭りの時期だけにすることもできます</dd></dl>
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
<p class="sp-src">${priced ? "協賛枠の料金には、選んだ地域の県・開催・定期公演・神楽の種類のページへの掲載を含みます。お支払いは、請求書をお送りして銀行振込の前払いです。協賛枠は月ごとのお申し込みで、やめるときは前の月の末までにお知らせください。" : "協賛枠と記事広告の料金は、載せる場所と期間に応じてお見積もりします。"}</p>

<h2>載る場所と見え方</h2>
<p>協賛枠は、選んだ地域の次のページの上のほう(県・神楽の種類のページは説明のすぐ下、開催・定期公演のページは要点の横。スマホでは公演の情報のすぐ下)に、開催情報とは別の枠で載ります。開催のページは公演の日が過ぎると外れますが、地域に定期公演やほかの開催があれば、そのページに続けて載ります。載る場所の見込みは、お申し込みの前にお知らせします。</p>
<ul class="ocards noic sp-where">
<li><b>県のページ</b>その県の神楽と開催予定をまとめたページ。${eg(pref)}</li>
<li><b>神楽の種類のページ</b>神楽の種類ごとの日程と解説のページ。${eg(kagura)}</li>
<li><b>開催のページ</b>地域や神楽の種類を決めて、その開催のページに。${eg(ev)}</li>
<li><b>定期公演のページ</b>毎週・毎晩の定期公演のページに、会場の近くの情報として。${eg(reg)}</li>
</ul>

<h3>見本: 協賛枠(月ごと)</h3>
<p>見出し・ひとこと・リンクの文字だけの枠です。「PR」の印と提供者の名前がつきます。記事広告をお申し込みの方は「PR記事」の印で載り、そこから記事へご案内します。</p>
<figure class="sp-sample">
<figcaption>見え方の見本(提供者の名前は架空のものです)</figcaption>
<div class="sponsor-slot" aria-hidden="true"><p class="sp-head">地域の協賛</p><ul>
<li class="sp-item"><span class="pr">PR</span><span class="sp-title">${esc(S.inn.title)}</span><p>${esc(S.inn.text)}</p><p class="sp-by">提供: ${esc(S.inn.name)}</p></li>
<li class="sp-item"><span class="pr">PR記事</span><span class="sp-title">${esc(S.station.title)}</span><p>${esc(S.station.text)}</p><p class="sp-by">提供: ${esc(S.station.name)}</p></li>
</ul><p class="sp-note">協賛の有無で、開催情報の掲載や並び順は変わりません。</p></div>
</figure>

<h3>見本: 記事広告(お申し込みごと)</h3>
<p>宿や道の駅での過ごし方を、神楽と合わせて、編集部が取材して書きます。写真も載せられます。見出しの立て方と文章の雰囲気は、見本のページでご覧ください。</p>
<figure class="sp-sample sp-sample-article">
<figcaption>記事の冒頭の見本(宿は架空のものです)</figcaption>
<div class="sp-article" aria-hidden="true">
<p class="sp-article-by"><span class="pr">PR記事</span>この記事は、${esc(S.inn.name)}の提供でお届けします。取材・文: ${esc(siteName)}編集部</p>
<p class="sp-article-title">${esc(S.article.title)}</p>
<p class="sp-article-lead">${esc(S.article.lead)}</p>
<p class="sp-article-toc">記事の流れ: ${S.article.sections.map(([h]) => esc(h)).join(" / ")} / 宿の情報</p>
</div>
</figure>
<p class="octa"><a class="btn ghost" href="/pr/sample.html">記事広告の見本ページを見る</a></p>

<h3>ご用意いただくもの</h3>
<p>お申し込みの際に、次のものをお知らせください。文章は、編集部で整えることもできます。</p>
<ul class="ocards noic sp-ready">
<li><b>協賛枠(月ごと)</b><dl><dt>提供者の名前</dt><dd>枠に表示します。例: ${esc(S.inn.name)}</dd><dt>見出し</dt><dd>一行。例: 「${esc(S.inn.title)}」</dd><dt>ひとこと</dt><dd>二〜三文。例: 「${esc(S.inn.text)}」</dd><dt>リンク先と地域</dt><dd>公式サイトなどのリンク先と、載せたい地域(県、または市町村)・期間</dd></dl></li>
<li><b>記事広告(お申し込みごと)</b><dl><dt>取材の日</dt><dd>お話をうかがえる日と、見せていただける場所</dd><dt>紹介したいこと</dt><dd>神楽の日の過ごし方、こだわり、神楽を観に来る方へのひとこと</dd><dt>写真</dt><dd>あればお借りします。なければ取材の際に編集部が撮ります</dd><dt>リンク先・連絡先</dt><dd>記事に載せる公式サイトと、予約や問い合わせの窓口</dd></dl></li>
</ul>

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
<details><summary>写真や地図は載せられますか?</summary><p>協賛枠は、見出し・ひとこと・リンクの文字だけです。写真や地図、道順も載せたいときは、記事広告をご利用ください(<a href="/pr/sample.html">記事広告の見本</a>)。</p></details>
<details><summary>どの地域を選べばよいですか?</summary><p>神楽を観に来た方が、お店や宿に立ち寄れる範囲でお選びください。県全体でも、市町村を決めることもできます。地域に定期公演やほかの開催があれば、ひとつの祭りが終わっても、そのページで載り続けます。</p></details>
</div>

<p class="cta-end"><a class="btn" href="/contact.html">協賛・記事広告について問い合わせる</a></p>
`;
}

/**
 * 記事広告の見本ページ(/pr/sample.html、noindex)の本文。架空の宿を例にし、特定の神楽・団体の名前は使わない。
 * 実際の記事広告も、この形(PR記事の表示 → 導入 → 写真 → 見出しごとの本文 → 提供者の情報 → この記事について)で作る。
 */
export function sponsorArticleSampleHtml({ esc, siteName }) {
  const A = SAMPLE_SPONSOR.article, by = SAMPLE_SPONSOR.inn.name;
  return `
<p class="pr-byline"><span class="pr">PR記事</span>この記事は、${esc(by)}の提供でお届けします(見本)。取材・文: ${esc(siteName)}編集部</p>
<p class="olead">${esc(A.lead)}</p>
<figure class="pr-photo" aria-hidden="true"><div class="pr-photo-box">写真が入ります(取材の際に撮影したもの、または提供者からお借りしたもの)</div><figcaption>写真には、短い説明文を添えます。</figcaption></figure>
${A.sections.map(([h, t]) => `<h2>${esc(h)}</h2><p>${esc(t)}</p>`).join("\n")}
<h2>宿の情報</h2>
<dl class="pr-facts">${A.facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
<section class="pr-about" aria-label="記事広告について">
<h2>この記事について</h2>
<p>このページは、記事広告の<strong>見本</strong>です。宿や提供者は架空のもので、実在の施設・団体とは関係ありません。</p>
<ul class="rules">
<li>記事広告は、提供者から掲載料をいただいて、${esc(siteName)}編集部が取材して書きます。公開の前に、提供者に内容をご確認いただきます。</li>
<li>記事には「PR記事」と表示し、提供者の名前を載せます。外へのリンクには、検索エンジンに広告であると伝える印(sponsored)を付けます。</li>
<li>協賛の有無で、開催情報の掲載や並び順は変わりません。</li>
</ul>
<p class="cta-end"><a class="btn" href="/contact.html">記事広告について問い合わせる</a><a class="btn ghost" href="/sponsor.html">広告・協賛のご案内へ戻る</a></p>
</section>`;
}
