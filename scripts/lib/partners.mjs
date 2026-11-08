// 有料の「団体ページ」と、県・神楽の種類のページの「PR枠」(MON-1)
// - データは data/partners.json(既定は空)。料金とプランは config.json の partner.plans
// - 開催情報の掲載・並び順・本文は、団体ページの有無で変えない。PR枠は開催情報の一覧より後ろの、別の枠に「PR」と表示して出す
// - 団体ページから外へのリンクには rel="sponsored" を付ける
// - 掲載期間(start〜end)の外の団体は、ページもPR枠も出さない
import { existsSync } from "node:fs";
import { PREFECTURES } from "./util.mjs";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{1,40}$/;
const HTTPS = /^https:\/\/[^\s"'<>]+$/;
const VIDEO = /^https:\/\/(www\.youtube\.com\/watch\?v=|youtu\.be\/|www\.youtube\.com\/shorts\/)[\w-]+/;

export const partnerHref = (id) => `/partner/${id}.html`;
export const yen = (n) => `${Number(n).toLocaleString("ja-JP")}円`;

/** プランの一覧(config.json の partner.plans)。料金の書き方をそろえる */
export const plansOf = (cfg) => (cfg.partner?.plans ?? []).map((p) => ({ ...p, priceText: `月額${yen(p.monthly)}(税込)` }));

/**
 * 団体のデータを確かめる。誤りの文の配列を返す(空なら正しい)
 * @param {any[]} rows @param {{ plans: {id:string}[], assetDir?: string }} o
 */
export function validatePartners(rows, { plans, assetDir = "assets" }) {
  const errs = [], ids = new Set(), planIds = plans.map((p) => p.id);
  if (!Array.isArray(rows)) return ["partners は配列にしてください"];
  for (const p of rows) {
    const at = `[partner ${p?.id ?? "?"}]`;
    if (!SLUG.test(p?.id ?? "")) { errs.push(`${at} id は英小文字・数字・ハイフンにしてください`); continue; }
    if (ids.has(p.id)) errs.push(`${at} id が重複しています`); ids.add(p.id);
    if (!p.name || typeof p.name !== "string" || p.name.length > 60) errs.push(`${at} name(団体名)は60字までの文字にしてください`);
    if (!planIds.includes(p.plan)) errs.push(`${at} plan は ${planIds.join(" / ")} のどれかにしてください`);
    if (!PREFECTURES.includes(p.prefecture)) errs.push(`${at} prefecture は都道府県名にしてください`);
    if (!p.kagura || typeof p.kagura !== "string") errs.push(`${at} kagura(神楽の種類)を入れてください`);
    if (!DAY.test(p.start ?? "") || !DAY.test(p.end ?? "") || p.end < p.start) errs.push(`${at} start / end は YYYY-MM-DD で、end は start 以降にしてください`);
    if (p.consent !== true) errs.push(`${at} consent: true(団体の了解・原稿の確認が済んだ)がないと載せられません`);
    if (!p.intro || p.intro.length > 600) errs.push(`${at} intro(紹介文)は600字までで入れてください`);
    if (p.tagline != null && (typeof p.tagline !== "string" || p.tagline.length > 40)) errs.push(`${at} tagline は40字までにしてください`);
    for (const ph of p.photos ?? []) {
      if (!ph?.src?.startsWith(`/partners/${p.id}/`) || !/\.(jpe?g|png|webp)$/i.test(ph.src)) errs.push(`${at} 写真は /partners/${p.id}/ の jpg・png・webp にしてください: ${ph?.src}`);
      else if (!existsSync(`${assetDir}${ph.src}`)) errs.push(`${at} 写真のファイルがありません: ${assetDir}${ph.src}`);
      if (!ph?.alt) errs.push(`${at} 写真には alt(何が写っているか)を入れてください`);
      if (!ph?.credit) errs.push(`${at} 写真には credit(撮影・提供)を入れてください`);
    }
    if ((p.photos ?? []).length > 8) errs.push(`${at} 写真は8枚までにしてください`);
    for (const v of p.videos ?? []) if (!VIDEO.test(v?.url ?? "") || !v?.title) errs.push(`${at} 動画は YouTube の動画のURLと title にしてください: ${v?.url}`);
    for (const r of p.repertoire ?? []) if (!r?.name || (r.text ?? "").length > 300) errs.push(`${at} 演目は name と、300字までの text にしてください`);
    if ((p.repertoire ?? []).length > 12) errs.push(`${at} 演目は12件までにしてください`);
    for (const l of p.links ?? []) if (!HTTPS.test(l?.url ?? "") || !l?.label) errs.push(`${at} リンクは https の url と label にしてください: ${l?.url}`);
  }
  return errs;
}

/** 掲載期間の中の団体だけ(並びは、掲載の開始が早い順 → id。お金の額では並べない) */
export const activePartners = (rows, today) => rows.filter((p) => p.start <= today && today <= p.end).sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));

/** PR枠に出す団体(PR枠つきのプランで、県または神楽の種類が合うもの。最大3件) */
export const prSlotPartners = (active, plans, { prefecture, kagura }) => {
  const withSlot = new Set(plans.filter((p) => p.prSlot).map((p) => p.id));
  return active.filter((p) => withSlot.has(p.plan) && (prefecture ? p.prefecture === prefecture : p.kagura === kagura)).slice(0, 3);
};

/** 県・神楽の種類のページのPR枠。開催情報の一覧とは別の枠で、「PR」と表示する */
export function prSlotHtml(list, { esc }) {
  if (!list.length) return "";
  return `<aside class="pr-slot" aria-label="PR 神楽団の紹介"><p class="pr-slot-h"><span class="pr">PR</span>神楽団の紹介</p><ul>${list.map((p) => `<li><a href="${partnerHref(p.id)}">${esc(p.name)}</a>${p.tagline ? `<span>${esc(p.tagline)}</span>` : ""}</li>`).join("")}</ul><p class="pr-slot-note">掲載料をいただいている団体の紹介です。開催情報の掲載や並び順には関係しません。</p></aside>`;
}

/** 団体ページの本文(見本のページでも同じひな形を使う)。prefHref / kaguraHref は、ページがないとき null を返す */
export function partnerBody(p, { esc, prefHref, kaguraHref, jpDate, sample = false }) {
  const ext = (url, text) => `<a href="${esc(url)}" rel="sponsored noopener" target="_blank">${esc(text)}</a>`;
  const photos = sample
    ? `<div class="partner-photos">${["舞台の写真", "面・衣装の写真", "稽古の写真"].map((t) => `<figure><div class="ph-sample" role="img" aria-label="${t}(見本)">${t}</div><figcaption>撮影・提供: 団体</figcaption></figure>`).join("")}</div>`
    : (p.photos ?? []).length ? `<div class="partner-photos">${p.photos.map((ph) => `<figure><img src="${esc(ph.src)}" alt="${esc(ph.alt)}" loading="lazy" decoding="async"><figcaption>撮影・提供: ${esc(ph.credit)}</figcaption></figure>`).join("")}</div>` : "";
  const reps = (p.repertoire ?? []).length ? `<h2>演目の紹介</h2><dl class="partner-reps">${p.repertoire.map((r) => `<div><dt>${esc(r.name)}</dt>${r.text ? `<dd>${esc(r.text)}</dd>` : ""}</div>`).join("")}</dl>` : "";
  const videos = (p.videos ?? []).length ? `<h2>動画</h2><ul class="partner-links">${p.videos.map((v) => `<li>${sample ? esc(v.title) : ext(v.url, v.title)} <span class="meta-s">(YouTube)</span></li>`).join("")}</ul>` : "";
  const links = (p.links ?? []).length ? `<h2>公式の案内</h2><ul class="partner-links">${p.links.map((l) => `<li>${sample ? esc(l.label) : ext(l.url, l.label)}</li>`).join("")}</ul>` : "";
  return `<p class="pr-note"><span class="pr">PR</span>${sample ? "これは団体ページの見本です。実際の団体ではありません。" : `このページは、${esc(p.name)}から掲載料をいただいて載せている団体ページです。`}開催情報の掲載や並び順には関係しません。</p>
${photos}
<h2>${esc(p.name)}について</h2>
${String(p.intro).split(/\n+/).map((t) => `<p>${esc(t)}</p>`).join("")}
${reps}${videos}${links}
<h2>この地域の神楽</h2>
${sample ? `<p>${esc(p.prefecture)}の神楽・${esc(p.kagura)}のページへのリンクが入ります。</p>` : `<p>${[[prefHref(p.prefecture), `${p.prefecture}の神楽の日程`], [kaguraHref(p.kagura), `${p.kagura}の日程`]].map(([h, t]) => (h ? `<a href="${h}">${esc(t)}</a>` : "")).filter(Boolean).join("・") || '<a href="/calendar.html">全国の神楽の日程</a>'}</p>`}
<p class="meta-s">${sample ? "掲載期間がここに入ります。" : `掲載期間: ${esc(jpDate(p.start))}〜${esc(jpDate(p.end))}`}内容は団体からいただいたものを、編集部が確かめて載せています。</p>`;
}

/** 見本のページに使う、架空の団体 */
export const SAMPLE_PARTNER = {
  id: "sample", name: "〇〇神楽団(見本)", plan: "page_pr", prefecture: "広島県", kagura: "芸北神楽", tagline: "新舞と旧舞を受け継ぐ神楽団",
  intro: "ここに、団体の成り立ちや、大切にしていること、主な公演の場所を書きます(600字まで)。\n写真・動画・演目の紹介と合わせて、初めての方にも団体の魅力が伝わるページにします。",
  repertoire: [{ name: "演目の名前", text: "あらすじや見どころを、300字までで紹介します。" }, { name: "演目の名前", text: "団体ならではの演出や、衣装・面の特徴などを書けます。" }],
  videos: [{ title: "公演の動画(YouTube へのリンク)" }], links: [{ label: "団体の公式サイト・SNS" }],
};

/** 申し込みのページの本文(プラン・できること・条件・流れ)。フォームは呼び出し側で後ろに付ける */
export function applyHtml({ esc, plans }) {
  const card = (p) => `<li><b>${esc(p.name)}<span class="plan-price">${esc(p.priceText)}</span></b><span>${p.includes.map(esc).join("。")}。</span></li>`;
  return `<p>神楽団・保存会・主催者の皆さまに、写真・動画・演目の紹介をまとめた<strong>団体ページ</strong>を、月額でご用意します。<a href="${partnerHref("sample")}">団体ページの見本</a>をご覧ください。</p>
<h2>プランと料金</h2>
<ul class="ocards plans">${plans.map(card).join("")}</ul>
<h2>お申し込みの条件</h2>
<ul class="rules">
<li><strong>開催情報の掲載は、これからも無料</strong>です。お申し込みの有無で、開催情報を載せるかどうか・並び順・本文は変えません。</li>
<li>団体ページとPR枠には<strong>「PR」と表示</strong>し、団体ページから外へのリンクには、広告であることを示す印(sponsored)を付けます。</li>
<li>写真・動画・文章は、団体が権利を持つもの、または使う了解を得たものに限ります。載せる前に、編集部が内容を確かめます。</li>
<li>料金は前払いです。お申し込みの後に請求書をお送りしますので、期日までに銀行振込でお支払いください(振込手数料はご負担ください)。</li>
<li>1か月単位でご利用いただけます。やめるときは、前の月の末日までにご連絡ください。お支払い済みの月の料金は、編集部の都合で載せられなかった場合を除き、お返しできません。</li>
<li>神事や地域の文化を軽んじる内容、事実と異なる表示は載せません。方針に合わない場合は、お断りすることがあります。</li>
</ul>
<h2>掲載までの流れ</h2>
<ol class="steps">
<li><b>お申し込み</b><span>下のフォームから、プランと団体の情報をお送りください。</span></li>
<li><b>原稿のご相談</b><span>写真・動画・演目の紹介文をお送りいただき、編集部がページの形にします。</span></li>
<li><b>ご請求・お支払い</b><span>請求書をお送りします。銀行振込でお支払いください。</span></li>
<li><b>掲載</b><span>入金と、公開前の内容のご確認を経て、ページを公開します。</span></li>
</ol>
<p>販売事業者などの表示は、<a href="/tokushoho.html">特定商取引法に基づく表記</a>をご覧ください。</p>
<h2>お申し込みフォーム</h2>`;
}

/** 特定商取引法に基づく表記 */
export function tokushohoHtml({ esc, opName, plans }) {
  const row = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`;
  return `<table class="info tokushoho">
${row("販売事業者", esc(opName))}
${row("運営責任者", "請求があった場合には、遅滞なく開示します")}
${row("所在地", "請求があった場合には、遅滞なく開示します")}
${row("電話番号", "請求があった場合には、遅滞なく開示します")}
${row("連絡先", '<a href="/contact.html">お問い合わせフォーム</a>(ご用件で「広告・取材などのご相談」を選んでください)')}
${row("販売するもの", `団体ページ(写真・動画・演目の紹介をまとめたページ)と、県・神楽の種類のページのPR枠の掲載。<a href="/apply.html">プランの内容</a>`)}
${row("販売価格", plans.map((p) => `${esc(p.name)}: ${esc(p.priceText)}`).join("<br>"))}
${row("商品代金以外の必要料金", "振込手数料(お客様のご負担)")}
${row("お支払い方法", "銀行振込(請求書をお送りします)")}
${row("お支払いの時期", "掲載する月の前に、請求書に書いた期日までにお支払いください(前払い)")}
${row("提供の時期", "入金と、公開前の内容のご確認を終えてから、ページを公開します")}
${row("解約・返金", "1か月単位でご利用いただけます。解約は、前の月の末日までにご連絡ください。お支払い済みの月の料金は、当方の都合で掲載できなかった場合を除き、お返しできません")}
</table>
<p>開催情報の掲載は無料です。有料のプランのお申し込みの有無で、開催情報の掲載や並び順は変わりません。</p>`;
}
