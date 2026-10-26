/**
 * 自由記述の料金は券種・販売窓口・手数料・残席の証拠ではない。
 * Offerは生成せず、条件を伴わない明示的な無料だけをEventへ反映する。
 * 申込不要は料金条件ではないため許可する。寄付/購入/別途料金などは推測しない。
 */
export function eventFeeSchema(fee) {
  if(typeof fee !== 'string') return {};
  const text=fee.normalize('NFKC').trim();
  return /^(?:観覧|参加|入場)?無料(?:\((?:事前申込不要|申込不要)\))?$/.test(text) ? {isAccessibleForFree:true} : {};
}
