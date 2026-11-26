// 英語ページの翻訳データ(data/kagura-info-en.json・data/regular-en.json)の決まりと点検。
// 翻訳は、日本語の本文(出典つき)を訳したものだけ。訳したときの日本語の本文の指紋(basis)を一緒に残し、
// 日本語の本文が書き換わったら「訳が古い」として週次の振り返りで知らせる(好み診断の点検 quiz-health.mjs と同じ考え方)。
import { createHash } from "node:crypto";

// 種類の解説で訳す欄(日本語の data/kagura-info.json の欄)
export const INFO_FIELDS = ["tagline", "intro", "history", "features", "programs", "viewing"];
// 定期公演で訳す欄(日本語の data/regular.json の欄)
export const REGULAR_FIELDS = ["name", "venue", "schedule", "closed", "season", "fee", "booking", "description", "bookingFlow", "programNote"];

const hash = (s) => createHash("sha256").update(String(s)).digest("hex").slice(0, 12);
/** 訳したときの日本語の本文の指紋 */
// あとから足した欄(naming: 呼び名の説明、sections: 追加の欄)は、日本語にあるときだけ指紋に入れる(欄を足しても、これまでの訳の指紋は変わらない)
export const INFO_EXTRA_FIELDS = ["naming", "sections"];
export const basisOf = (ja, fields) => hash(JSON.stringify([...fields.map((f) => ja?.[f] ?? null), ...(fields === INFO_FIELDS ? INFO_EXTRA_FIELDS.filter((f) => ja?.[f] != null).map((f) => [f, ja[f]]) : [])]));

/** 訳が今の日本語に合っているか(basis が一致するか) */
export const infoFresh = (ja, en) => !!en && en.basis === basisOf(ja, INFO_FIELDS);
export const regularFresh = (ja, en) => !!en && en.basis === basisOf(ja, REGULAR_FIELDS);

/**
 * 英語ページの点検(週次の振り返りが使う)
 * @param info      data/kagura-info.json
 * @param infoEn    data/kagura-info-en.json
 * @param regular   data/regular.json(続いているものだけを見る)
 * @param regularEn data/regular-en.json
 * @param kinds     サイトに種類のページがある神楽(掲載のある種類)
 * 返り値: { missing: 訳のない種類, stale: 日本語が書き換わった種類, regularMissing, regularStale }
 */
export function englishHealth({ info = {}, infoEn = {}, regular = [], regularEn = {}, kinds = [], todayJst = "" }) {
  const withInfo = kinds.filter((k) => info[k]?.intro);
  const live = regular.filter((r) => (r.status ?? "published") === "published" && (!r.until || !todayJst || r.until >= todayJst));
  return {
    missing: withInfo.filter((k) => !infoEn[k]),
    stale: withInfo.filter((k) => infoEn[k] && !infoFresh(info[k], infoEn[k])),
    regularMissing: live.filter((r) => !regularEn[r.id]).map((r) => r.id),
    regularStale: live.filter((r) => regularEn[r.id] && !regularFresh(r, regularEn[r.id])).map((r) => r.id),
  };
}
