// 「広告・協賛のご案内」(/sponsor.html)の本文。媒体資料を兼ねる(MON-2)。2026-11-14 に、0から作り直した。
// 考え方: 細かく書かない。メニューと料金は「目安」として短く見せ、内容・期間・ご予算は相談しながら決められることを、いちばん強く伝える。
// 並び: 書き出し(型は決まっていない) → メニューと料金の目安(品書きの形) → こんなご相談も、お受けします → 数字 → 流れ → お約束 → 相談の入口。
//   ・メニュー: 協賛枠(月額)・記事広告(1本)・年間協賛(年額)。料金は config.json の sponsorPrices。
//   ・神楽団・保存会・主催者の方は、同じメニューを値引きする(sponsorPrices.organizerRate。0.5 = 半額。2026-11-14 運営者の判断: 神楽を続ける側には、できるだけ負担をかけない)。
//     団体ページ(月額のプラン・申し込みフォーム・特定商取引法に基づく表記)は、同じ日にやめた。
//   ・支払いは後払い(2026-11-14 運営者の判断。掲載を始めたあとに請求書、翌月の末までに銀行振込)。
//   ・「載るページの例」は、サイトに実在するページだけにする(tests/sponsor.mjs で確認)。
//   ・数字を書くのは、メニュー(.sp-menu・.sp-group)と「数字で見る」(.sp-stats)だけ。ほかの文には数字を書かない(「ひと月」「一本」と書く)。
//       - 掲載の件数は、ビルドの時点の実数(サイトの作りの事実)。
//       - アクセスは、data/media-stats.json の概数だけ(上から2桁で切り捨て。scripts/lib/media-stats.mjs)。集計期間・出典を必ず添える。
//       - 集計が古い・無いときは、アクセスの数字を出さず、「ご相談の際にお伝えします」とだけ書く。
//   ・読者の傾向は、確かめていないことを書かない。
//   ・中立の方針(掲載は無料・協賛で掲載や並び順を変えない・PRの表示)は、「主催者の方へ」と食い違わないようにする。
//   ・見本には、特定の神楽の名前・団体の名前を使わない(「◯◯温泉旅館」のように書く。tests/sponsor.mjs で確認)。
// 記事広告の見本ページ(/pr/sample.html、noindex)の本文は sponsorArticleSampleHtml。
// 協賛枠の表示の仕組みは scripts/lib/sponsor-slots.mjs(データは data/sponsors.json)。
import { approx } from "./media-stats.mjs";

/**
 * 協賛のページと記事広告の見本ページだけの CSS。layout の head に入れる(CSP はインラインの style をハッシュで許可する)。
 * 全ページ共通の scripts/style.css には入れない(その2ページでしか使わないため)。
 * 協賛枠そのもの(.sponsor-slot・.pr)は全ページで使うので style.css のまま。色は、サイトの変数だけを使う(夜の配色でもそのまま通る)。
 */
export const SPONSOR_CSS = `<style>
.prose.sp-page{max-width:none}
.sp-page>p,.sp-page>ul.rules{max-width:40em}
.prose .sp-open{margin:4px 0 0;max-width:none;font-family:var(--serif);font-size:clamp(1.3rem,3.6vw,1.75rem);line-height:1.75;letter-spacing:.06em;text-wrap:balance;word-break:auto-phrase}
.prose .sp-open+p{margin-top:18px;line-height:2.05}
.prose .sp-cta{margin:22px 0 0;max-width:none}
.prose.sp-page h2{margin:64px 0 6px;font-size:var(--fs-xl)}
.prose .sp-sub{margin:0 0 18px;color:var(--mut)}
.sp-menu-box{padding:6px 26px 20px;border:1px solid var(--edge);border-radius:var(--radius);background:var(--card);box-shadow:var(--shadow)}
.prose .sp-menu{list-style:none;margin:0;padding:0}
.prose .sp-menu>li{margin:0;padding:20px 0 18px;border-bottom:1px solid var(--line)}
.sp-row{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:flex-end;gap:2px 12px}
.prose .sp-row h3{margin:0;font-size:var(--fs-xl);letter-spacing:.1em}
.sp-dots{flex:1 1 2em;min-width:2em;align-self:center;border-bottom:1px dotted var(--mut);opacity:.7;transform:translateY(.2em)}
.prose .sp-row .price{margin:0;font-family:var(--serif);font-size:var(--fs-xl);color:var(--ac);white-space:nowrap;font-variant-numeric:tabular-nums}
.sp-row .price small{font-family:var(--sans);font-size:var(--fs-xs);color:var(--mut);margin-left:2px}
.prose .sp-desc{margin:8px 0 0;max-width:38em;font-size:var(--fs-s);line-height:1.9}
.prose .sp-for{margin:6px 0 0;font-size:var(--fs-xs);color:var(--mut)}
.prose .sp-try{margin:8px 0 0;font-size:var(--fs-s);color:var(--ac)}
.prose .sp-any{margin:18px 0 0;font-family:var(--serif);font-size:var(--fs-l);line-height:1.9;text-wrap:balance;word-break:auto-phrase}
.prose .sp-terms{margin:6px 0 0;font-size:var(--fs-s);color:var(--mut);line-height:1.9}
.sp-group{margin:16px 0 0;padding:18px 26px 16px;border:1px solid color-mix(in srgb,var(--ac) 35%,var(--line));border-radius:var(--radius);background:color-mix(in srgb,var(--ac) 4%,var(--card))}
.prose .sp-group-h{margin:0 0 4px;font-family:var(--serif);font-size:var(--fs-l);line-height:1.7;letter-spacing:.06em;text-wrap:balance;word-break:auto-phrase}
.sp-group-h span{display:inline-block}
.prose .sp-half{list-style:none;margin:4px 0 8px;padding:0;display:flex;flex-wrap:wrap;gap:2px 22px;font-family:var(--serif);font-size:var(--fs-l);color:var(--ac);font-variant-numeric:tabular-nums}
.prose .sp-half li{margin:0;white-space:nowrap}.sp-half small{font-family:var(--sans);font-size:var(--fs-xs);color:var(--mut);margin-left:2px}
.prose .sp-group ul+p{margin:0;max-width:44em;font-size:var(--fs-s);line-height:1.9}
.sp-look{display:grid;gap:18px 32px;margin:36px 0 0;align-items:start}
@media(min-width:760px){.sp-look{grid-template-columns:minmax(0,5fr) minmax(0,6fr)}}
.prose .sp-look h3{margin:0 0 6px}.prose .sp-look p{margin:0 0 8px;font-size:var(--fs-s);line-height:1.9}
.prose .sp-eg{font-size:var(--fs-xs);color:var(--mut);line-height:2}
.sp-sample{margin:0}.sp-sample figcaption{font-size:var(--fs-xs);color:var(--mut)}.sp-sample .sponsor-slot{margin:6px 0 0}
.sp-sample .sp-title{font-weight:500;color:var(--ac);text-decoration:underline;text-underline-offset:3px}
.sp-asks{margin:8px 0 0;border-top:1px solid var(--line)}
.sp-asks>div{display:grid;gap:4px 28px;padding:18px 0;border-bottom:1px solid var(--line)}
@media(min-width:680px){.sp-asks>div{grid-template-columns:minmax(0,5fr) minmax(0,7fr);align-items:baseline}}
.sp-asks dt{font-family:var(--serif);font-size:var(--fs-l);line-height:1.7;letter-spacing:.06em}
.sp-asks dd{margin:0;font-size:var(--fs-s);line-height:1.9}
.sp-stats{margin:8px 0 0}
.prose .sp-tiles{list-style:none;padding:0;margin:0;display:grid;gap:10px;grid-template-columns:repeat(2,minmax(0,1fr))}
.prose .sp-tiles+.sp-tiles{margin-top:10px;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))}
@media(min-width:680px){.prose .sp-tiles{grid-template-columns:repeat(4,minmax(0,1fr))}}
.prose .sp-tiles li{margin:0;padding:12px 14px;border-radius:var(--radius-s);border:1px solid var(--edge);background:var(--card);display:flex;flex-direction:column;gap:2px}
.sp-tiles .k{font-size:var(--fs-xs);color:var(--mut);line-height:1.6}
.sp-tiles .v{font-family:var(--serif);font-size:var(--fs-xl);color:var(--ac);line-height:1.3;font-variant-numeric:tabular-nums}
.sp-tiles .v small{font-family:var(--sans);font-size:var(--fs-xs);color:var(--mut);margin-left:3px}
.sp-tiles .n{font-size:var(--fs-2xs);color:var(--mut);line-height:1.6}
.prose .sp-src{margin:10px 0 0;max-width:none;font-size:var(--fs-xs);color:var(--mut);line-height:1.8}
.prose .sp-steps{margin-top:14px}
.sp-end{margin:72px 0 0;padding:34px 26px 8px;border-top:1px solid var(--line);text-align:center}
.prose .sp-end p{margin:0 auto;max-width:34em}
.prose .sp-end .sp-open{margin-bottom:10px}
.prose .sp-end .sp-cta{margin-top:20px}.sp-end .btn{margin:0 4px 8px}
@media(max-width:480px){.sp-row{display:block}.sp-dots{display:none}.prose .sp-row .price{margin-top:2px}}
@media(max-width:640px){.sp-group{padding:16px 18px 14px}.sp-menu-box{padding:2px 18px 16px}.sp-cta .btn{display:flex;width:100%;margin-right:0}.sp-end{padding:28px 6px 0}}
.sp-article-by{font-size:var(--fs-xs);color:var(--mut)}
.pr-byline{font-size:var(--fs-s);color:var(--mut)}
.prose .pr-photo{margin:20px 0}.pr-photo-box{display:grid;place-items:center;min-height:180px;padding:16px;border:1px dashed var(--mut);border-radius:var(--radius);color:var(--mut);font-size:var(--fs-s);text-align:center;background:var(--card)}.pr-photo figcaption{font-size:var(--fs-xs);color:var(--mut);margin-top:6px}
.pr-facts{display:grid;grid-template-columns:max-content 1fr;gap:6px 16px;font-size:var(--fs-s)}.pr-facts dt{color:var(--mut)}.pr-facts dd{margin:0}
.pr-about{margin-top:40px;padding:4px 22px 18px;border:1px solid var(--edge);border-radius:var(--radius);background:var(--card)}.prose .pr-about h2{margin-top:18px}.pr-about .cta-end{margin-top:20px}
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

/** お問い合わせフォームの「ご用件」の選択肢の名前(tests/sponsor.mjs が、実物のフォームと照らす) */
export const SPONSOR_TOPIC = "広告・取材などのご相談";

const jpDay = (d) => d.replace(/^(\d{4})-0?(\d+)-0?(\d+)$/, "$1年$2月$3日");
const jpShort = (d) => d.replace(/^\d{4}-0?(\d+)-0?(\d+)$/, "$1月$2日");

/**
 * @param {{ esc: (s:string)=>string, siteName: string,
 *   pref?: { name: string, href: string }, kagura?: { name: string, href: string }, ev?: { name: string, href: string }, reg?: { name: string, href: string },
 *   prices?: { monthly?: number, article?: number, annual?: number, trial?: boolean, organizerRate?: number },   協賛枠(月額)・記事広告(1本)・年間協賛(年額)。税込。無いものは「お見積もり」。trial: 協賛枠のはじめのひと月を無料にする。organizerRate: 神楽団・保存会・主催者の方の料金の割合(0.5 = 半額)
 *   facts?: { events: number, prefs: number, kaguras: number, regular: number },
 *   stats?: { updated: string, search?: { from: string, to: string, impressions: number, clicks: number, impressions7?: number, clicks7?: number }, analytics?: { from: string, to: string, pageviews: number, users: number } } | null }} x
 */
export function sponsorHtml({ esc, siteName, pref, kagura, ev, reg, prices = {}, facts, stats }) {
  const yen = (n) => `${Number(n).toLocaleString("ja-JP")}円`;
  const ok = (n) => Number.isFinite(n) && n > 0;
  const price = (n, unit) => (ok(n) ? `${unit}${yen(n)}<small>(税込)</small>` : "お見積もり");
  const S = SAMPLE_SPONSOR;
  const s = stats?.search, a = stats?.analytics;
  const tile = (label, value, unit, note = "") => `<li><span class="k">${label}</span><span class="v">${value}<small>${unit}</small></span>${note ? `<span class="n">${note}</span>` : ""}</li>`;
  const line = (name, priceHtml, desc, who, extra = "") => `<li>
<div class="sp-row"><h3>${name}</h3><span class="sp-dots" aria-hidden="true"></span><p class="price">${priceHtml}</p></div>
<p class="sp-desc">${desc}</p>${extra}
<p class="sp-for">${who}</p>
</li>`;
  const egs = [pref, kagura, ev, reg].filter(Boolean);
  // 神楽団・保存会・主催者の方の料金(同じメニューを、決めた割合で。3つとも料金が決まっているときだけ出す)
  const rate = prices.organizerRate, org = (n) => yen(Math.round(n * rate));
  const orgOff = ok(rate) && rate < 1 && ok(prices.monthly) && ok(prices.article) && ok(prices.annual);
  const orgLabel = rate === 0.5 ? "半額" : `${Math.round((1 - rate) * 10)}割引き`;
  const cta = (ghost = "") => `<p class="sp-cta octa"><a class="btn" href="/contact.html">協賛・広告について相談する</a>${ghost}</p>`;

  return `
<p class="sp-open">載せ方に、決まった型はありません。</p>
<p>${esc(siteName)}は、全国の神楽の開催日・会場・定期公演をまとめた、<strong>神楽に特化したサイト</strong>です。神楽を観に出かける方へ、会場の近くの宿やお店、地域の見どころを届けませんか。下のメニューは目安です。<strong>内容も、期間も、ご予算も、ご相談しながら決められます。</strong></p>
${cta(`<a class="btn ghost" href="#menu">メニューと料金の目安を見る</a>`)}

<h2 id="menu">メニューと料金の目安</h2>
<p class="sp-sub">組み合わせも、時期を区切ることもできます。</p>
<div class="sp-menu-box">
<ul class="sp-menu">
${line("協賛枠", price(prices.monthly, "月額"), "選んだ地域の神楽のページに、見出しとひとこと、リンクを載せます。ひと月から。秋祭りの時期だけでも載せられます。", "宿・お店・道の駅・施設の方に", prices.trial && ok(prices.monthly) ? `<p class="sp-try">はじめての方は、ひと月、無料でお試しいただけます。</p>` : "")}
${line("記事広告", price(prices.article, "1本"), `神楽と合わせて楽しめる過ごし方として、編集部がお話をうかがい、取材して書きます。写真や地図も載せられます(<a href="/pr/sample.html">記事の見本</a>)。`, "じっくり伝えたい方に")}
${line("年間協賛", price(prices.annual, "年額"), "一年を通した協賛枠に、記事広告を二本。季節に合わせた内容の差し替えや、催しのお知らせも、その都度ご相談いただけます。ご請求は、年に一度です。", "観光協会・自治体・温泉地の方に")}
</ul>
<p class="sp-any">ここにない形も、どうぞご相談ください。</p>
<p class="sp-terms">金額・期間・内容は、ご事情に合わせて調整します。お見積書・ご請求書・領収書をお出しします。お支払いは後払いです。掲載を始めたあとにご請求書をお送りしますので、翌月の末までに、銀行振込でお願いします。時期や分け方も、ご相談ください。</p>
</div>
${orgOff ? `<div class="sp-group"><p class="sp-group-h"><span>神楽団・保存会・主催者の方は、</span><span>どのメニューも${orgLabel}です</span></p><ul class="sp-half"><li>協賛枠 月額${org(prices.monthly)}</li><li>記事広告 1本${org(prices.article)}</li><li>年間協賛 年額${org(prices.annual)}<small>(税込)</small></li></ul><p>公演のお知らせ、団員や後援会の募集、団の紹介記事などにお使いいただけます。神楽を受け継ぐ皆さまのご負担は、できるだけ小さくしたいと考えています。ご予算に合わせた載せ方も、ご相談ください。</p></div>` : ""}

<div class="sp-look">
<div>
<h3>協賛枠の見え方</h3>
<p>開催情報とは別の枠に、「PR」の印と提供者のお名前をつけて載せます。載るのは、選んだ地域の、県・神楽の種類・開催・定期公演の各ページです。</p>
${egs.length ? `<p class="sp-eg">載るページの例: ${egs.map((x) => `<a href="${x.href}">${esc(x.name)}</a>`).join("、")}</p>` : ""}
</div>
<figure class="sp-sample">
<figcaption>見本(提供者のお名前は架空のものです)</figcaption>
<div class="sponsor-slot" aria-hidden="true"><p class="sp-head">地域の協賛</p><ul>
<li class="sp-item"><span class="pr">PR</span><span class="sp-title">${esc(S.inn.title)}</span><p>${esc(S.inn.text)}</p><p class="sp-by">提供: ${esc(S.inn.name)}</p></li>
</ul></div>
</figure>
</div>

<h2>こんなご相談も、お受けします</h2>
<p class="sp-sub">まだ何も決まっていない段階でも、かまいません。</p>
<dl class="sp-asks">
<div><dt>「秋祭りの時期だけ、載せたい」</dt><dd>ひと月から、時期を決めて載せられます。祭りの前だけ、冬の夜神楽のあいだだけ、という載せ方もできます。</dd></div>
<div><dt>「予算が決まっている」</dt><dd>ご予算をうかがって、その中でできる載せ方をご提案します。</dd></div>
<div><dt>「何を書けばよいか、分からない」</dt><dd>お話をうかがって、編集部が文章を整えます。原稿のご用意は要りません。</dd></div>
<div><dt>「地域の宿やお店で、まとめて載せたい」</dt><dd>組合や商店会、観光協会でまとめたお申し込みも、ご相談ください。</dd></div>
<div><dt>「来年度の予算で、考えたい」</dt><dd>年度の始まりに合わせた掲載にできます。お見積書を先にお出しすることも、お支払いの時期をご事情に合わせることもできます。</dd></div>
<div><dt>「メニューにない形で、協力したい」</dt><dd>催しのお知らせや、いくつかの地域にまたがる掲載など、まずはお聞かせください。</dd></div>
</dl>

<h2 id="sp-stats-h">数字で見る${esc(siteName)}</h2>
<section class="sp-stats" aria-labelledby="sp-stats-h">
<ul class="sp-tiles">
${facts ? `${tile("これからの開催", facts.events.toLocaleString("ja-JP"), "件")}
${tile("掲載している地域", String(facts.prefs), "都道府県")}
${tile("神楽の種類", String(facts.kaguras), "種類")}
${tile("毎週・毎晩の定期公演", String(facts.regular), "か所")}` : ""}
</ul>${s || a ? `
<ul class="sp-tiles">` : ""}
${s ? tile("Googleの検索結果に表示された回数", approx(s.impressions), "回", `直近4週間${s.impressions7 ? `。うち直近1週間で${approx(s.impressions7)}回` : ""}`) : ""}
${s ? tile("検索から訪れた回数", approx(s.clicks), "回", `直近4週間${s.clicks7 ? `。うち直近1週間で${approx(s.clicks7)}回` : ""}`) : ""}
${a ? tile("ページの閲覧数", approx(a.pageviews), "回", "直近4週間。計測に同意した方の分だけ") : ""}
${s || a ? "</ul>" : ""}
${s || a ? `<p class="sp-src">${[s && `検索: Google Search Console(${jpShort(s.from)}〜${jpShort(s.to)})`, a && `閲覧数: Googleアナリティクス(${jpShort(a.from)}〜${jpShort(a.to)})`].filter(Boolean).join("・")}。数字は上から2桁で切り捨てた概数です(${jpDay(stats.updated)}更新)。載せたい地域のページごとの数字は、ご相談の際にお伝えします。</p>`
    : `<p class="sp-src">アクセスの数字は、ご相談の際に、載せたい地域のページについてお伝えします。</p>`}
</section>

<h2>掲載までの流れ</h2>
<ol class="steps sp-steps">
<li><b>ご相談</b><span><a href="/contact.html">お問い合わせ</a>の「ご用件」で「${SPONSOR_TOPIC}」を選び、ご希望をお聞かせください。ひとことだけでも、かまいません。</span></li>
<li><b>ご提案</b><span>載せ方・期間・お見積もりをお送りします。ここまでは無料です。合わなければ、遠慮なくお断りください。</span></li>
<li><b>掲載</b><span>載せる内容をご確認いただいてから、公開します。お支払いは、掲載を始めたあとです。</span></li>
</ol>

<h2>掲載にあたってのお約束</h2>
<ul class="rules">
<li><strong>開催情報の掲載は、これからも無料</strong>です(<a href="/organizers.html">主催者の方へ</a>)。協賛の有無で、掲載するかどうか・並び順・本文は変えません。</li>
<li>協賛枠と記事広告には、<strong>「PR」と表示</strong>し、提供者のお名前を載せます。リンクには、検索エンジンに広告であると伝える印(sponsored)を付けます。</li>
<li>神楽団・保存会・神社のお名前や写真は、その団体の了解があるときだけ使います。</li>
<li>事実と異なる表示や、神事・地域の文化を軽んじる内容などは載せません。掲載の前に内容を確かめ、方針に合わない場合は、お断りすることがあります。</li>
</ul>

<div class="sp-end">
<p class="sp-open">まずは、お気軽にお聞かせください。</p>
<p>載せたい地域や時期、ご予算の目安など、分かる範囲でかまいません。編集部から、メールでお返事します。</p>
${cta()}
</div>
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
