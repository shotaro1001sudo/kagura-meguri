// 週次の自動収集: 新しく掲載した開催に、アフィリエイトのリンクが紐づくかを確かめる。
// リンクそのものは、公開時のビルド(scripts/build.mjs)が開催の県・市区町村・日付から自動で作る。ここでは、その材料と設定がそろっているかを見る。
//  - 宿: じゃらん(バリューコマース sid + jalanPid)・楽天トラベル(楽天アフィリエイトID)。市区町村がなければ県名で検索する
//  - 体験: じゃらん遊び・体験(sid + jalanActivityPid)。県が47都道府県の一覧にあること
//  - 移動: 全国向けのレンタカー・カーシェア(data/visitor-planning.json の承認済みで、期限内のもの)
// 掲載の再確認期限(expiresAt)が近い広告は、期限が切れると自動で表示されなくなるため、早めに知らせる
import { experienceRegions, offersFor } from "./visitor-planning.mjs";

import { createMoreOfferIndex } from "./more-offers.mjs";
import { offerEligibility } from "./offer-eligibility.mjs";

const DAY = 864e5;
const daysUntil = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

/**
 * @param {{ events: object[], affiliate: object, planning: object, today: string, warnDays?: number }} x
 * @returns {{ rows: {id:string,name:string,stay:string[],experience:boolean,rental:string[],missing:string[]}[], expiring: {id:string,title:string,expiresAt:string,days:number}[], missingIds: string[] }}
 */
export function affiliateCoverage({ events, affiliate = {}, planning = {}, more = null, today, warnDays = 14 }) {
  const jalanOn = !!(affiliate.valueCommerceSid && affiliate.jalanPid);
  const rakutenOn = !!affiliate.rakutenAffiliateId;
  const activityOn = !!(affiliate.valueCommerceSid && affiliate.jalanActivityPid);
  const missingIds = [
    !rakutenOn && "楽天アフィリエイトID(rakutenAffiliateId)",
    !jalanOn && "じゃらんnetのpid(valueCommerceSid・jalanPid)",
    !activityOn && "じゃらん遊び・体験のpid(jalanActivityPid)",
  ].filter(Boolean);
  const index = createMoreOfferIndex(more, today);
  const counts = more ? Object.fromEntries(["learn","furusato"].filter(k=>!index.configured[k]).map(k=>[k+"_unconfigured",1])) : {};
  const diagnostics = [...index.diagnostics, ...(planning.offers ?? []).map(o=>({id:o.id,category:o.category,reason:offerEligibility(o,today)})).filter(o=>o.reason)];
  for (const d of diagnostics) counts[d.reason]=(counts[d.reason]??0)+1;
  const rows = events.map((e) => {
    const stay = [jalanOn && "じゃらん", rakutenOn && "楽天トラベル"].filter(Boolean);
    const experience = activityOn && experienceRegions.some((r) => r.prefecture === e.prefecture);
    const rental = offersFor(planning, "rental", e, today).map((o) => (o.provider === "rakuten-carshare" ? "カーシェア" : "レンタカー"));
    const learn = index.select("learn", e).map(o=>o.id), furusato = index.select("furusato",{...e,city:e.city??""}).map(o=>o.id);
    if(more && !learn.length) counts.learn_unmatched=(counts.learn_unmatched??0)+1;
    if(more && !furusato.length) counts.furusato_unmatched=(counts.furusato_unmatched??0)+1;
    const missing = [
      more && !learn.length && "本・グッズ",
      more && !furusato.length && "ふるさと納税",
      stay.length < 2 && "宿",
      !experience && "体験",
      !rental.length && "レンタカー・カーシェア",
    ].filter(Boolean);
    return { id: e.id, name: e.name, stay, experience, rental, learn, furusato, missing };
  });
  const expiring = [...(planning.offers ?? []).map(o=>({...o,source:"data/visitor-planning.json"})), ...(more?.offers ?? []).map(o=>({...o,source:"data/more-offers.json"}))]
    .filter((o) => o.enabled && o.approved && typeof o.expiresAt === "string")
    .map((o) => ({ id: o.id, source:o.source, title: o.title, expiresAt: o.expiresAt, days: daysUntil(today, o.expiresAt) }))
    .filter((o) => o.days <= warnDays)
    .sort((a, b) => a.days - b.days);
  return { rows, expiring, missingIds, diagnostics, counts };
}

/** レポート(Markdown)の節。注意が要るものがあれば attention: true */
export function coverageReport(cov) {
  const lines = [];
  if (cov.missingIds.length) lines.push(`- ⚠ 提携IDが未設定: ${cov.missingIds.join("、")}`);
  for (const o of cov.expiring.slice(0,50)) lines.push(o.days < 0
    ? `- ⚠ 掲載の再確認期限が切れて、表示が止まっています: ${o.title}(${o.expiresAt})`
    : `- ⚠ 掲載の再確認期限まで${o.days}日: ${o.title}(${o.expiresAt})。リンク先を確かめ、${o.source ?? "data/visitor-planning.json"} の verifiedAt・expiresAt を更新してください`);
  if(cov.counts && Object.keys(cov.counts).length) lines.push(`- 集約診断: ${JSON.stringify(cov.counts)}`);
  if(cov.rows.length>50 || cov.expiring.length>50) lines.push(`- 詳細は各50件まで表示（公演${cov.rows.length}件、期限注意${cov.expiring.length}件）。件数集計は全件。`);
  for (const r of cov.rows.slice(0,50)) lines.push(`- ${r.missing.length ? "⚠" : "✅"} ${r.name}: 宿 ${r.stay.join("・") || "なし"} / 体験 ${r.experience ? "じゃらん遊び・体験" : "なし"} / 移動 ${r.rental.join("・") || "なし"}${r.missing.includes("本・グッズ")?" / 本・グッズ 未一致":""}${r.missing.includes("ふるさと納税")?" / ふるさと納税 未一致":""}`);
  const attention = (cov.diagnostics??[]).some(d=>d.reason!=="disabled" && d.reason!=="category_disabled") || cov.missingIds.length > 0 || cov.expiring.length > 0 || cov.rows.some((r) => r.missing.length);
  return { text: lines.join("\n") || "- 新しく掲載した開催はありません", attention };
}
