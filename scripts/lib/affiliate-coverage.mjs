// 週次の自動収集: 新しく掲載した開催に、アフィリエイトのリンクが紐づくかを確かめる。
// リンクそのものは、公開時のビルド(scripts/build.mjs)が開催の県・市区町村・日付から自動で作る。ここでは、その材料と設定がそろっているかを見る。
//  - 宿: じゃらん(バリューコマース sid + jalanPid)・楽天トラベル(楽天アフィリエイトID)。市区町村がなければ県名で検索する
//  - 体験: じゃらん遊び・体験(sid + jalanActivityPid)。県が47都道府県の一覧にあること
//  - 移動: 全国向けのレンタカー・カーシェア(data/visitor-planning.json の承認済みで、期限内のもの)
// 掲載の再確認期限(expiresAt)が近い広告は、期限が切れると自動で表示されなくなるため、早めに知らせる
import { experienceRegions, offersFor } from "./visitor-planning.mjs";

const DAY = 864e5;
const daysUntil = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

/**
 * @param {{ events: object[], affiliate: object, planning: object, today: string, warnDays?: number }} x
 * @returns {{ rows: {id:string,name:string,stay:string[],experience:boolean,rental:string[],missing:string[]}[], expiring: {id:string,title:string,expiresAt:string,days:number}[], missingIds: string[] }}
 */
export function affiliateCoverage({ events, affiliate = {}, planning = {}, today, warnDays = 14 }) {
  const jalanOn = !!(affiliate.valueCommerceSid && affiliate.jalanPid);
  const rakutenOn = !!affiliate.rakutenAffiliateId;
  const activityOn = !!(affiliate.valueCommerceSid && affiliate.jalanActivityPid);
  const missingIds = [
    !rakutenOn && "楽天アフィリエイトID(rakutenAffiliateId)",
    !jalanOn && "じゃらんnetのpid(valueCommerceSid・jalanPid)",
    !activityOn && "じゃらん遊び・体験のpid(jalanActivityPid)",
  ].filter(Boolean);
  const rows = events.map((e) => {
    const stay = [jalanOn && "じゃらん", rakutenOn && "楽天トラベル"].filter(Boolean);
    const experience = activityOn && experienceRegions.some((r) => r.prefecture === e.prefecture);
    const rental = offersFor(planning, "rental", e, today).map((o) => (o.provider === "rakuten-carshare" ? "カーシェア" : "レンタカー"));
    const missing = [
      stay.length < 2 && "宿",
      !experience && "体験",
      !rental.length && "レンタカー・カーシェア",
    ].filter(Boolean);
    return { id: e.id, name: e.name, stay, experience, rental, missing };
  });
  const expiring = (planning.offers ?? [])
    .filter((o) => o.enabled && o.approved && typeof o.expiresAt === "string")
    .map((o) => ({ id: o.id, title: o.title, expiresAt: o.expiresAt, days: daysUntil(today, o.expiresAt) }))
    .filter((o) => o.days <= warnDays)
    .sort((a, b) => a.days - b.days);
  return { rows, expiring, missingIds };
}

/** レポート(Markdown)の節。注意が要るものがあれば attention: true */
export function coverageReport(cov) {
  const lines = [];
  if (cov.missingIds.length) lines.push(`- ⚠ 提携IDが未設定: ${cov.missingIds.join("、")}`);
  for (const o of cov.expiring) lines.push(o.days < 0
    ? `- ⚠ 掲載の再確認期限が切れて、表示が止まっています: ${o.title}(${o.expiresAt})`
    : `- ⚠ 掲載の再確認期限まで${o.days}日: ${o.title}(${o.expiresAt})。リンク先を確かめ、data/visitor-planning.json の verifiedAt・expiresAt を更新してください`);
  for (const r of cov.rows) lines.push(`- ${r.missing.length ? "⚠" : "✅"} ${r.name}: 宿 ${r.stay.join("・") || "なし"} / 体験 ${r.experience ? "じゃらん遊び・体験" : "なし"} / 移動 ${r.rental.join("・") || "なし"}`);
  const attention = cov.missingIds.length > 0 || cov.expiring.length > 0 || cov.rows.some((r) => r.missing.length);
  return { text: lines.join("\n") || "- 新しく掲載した開催はありません", attention };
}
