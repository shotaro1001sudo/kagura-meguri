import { reservationLabel } from '../scripts/lib/reservation.mjs';
export function reservationTests({ok, section}) {
  section('予約状態の共通表示');
  for (const [input, expected] of [
    [{},'要確認'],[{fee:'無料',booking:'予約については公式へ'},'要確認'],
    [{reservationStatus:'unknown',reservation:'不要'},'要確認'],
    [{reservationStatus:'required'},'事前予約が必要'],
    [{reservationStatus:'recommended'},'事前予約を推奨'],
    [{reservationStatus:'not_required'},'事前申込不要'],
    [{reservationStatus:'recommended',reservationSameDay:true},'事前予約を推奨(当日受付あり・定員に注意)'],
    [{reservationStatus:'required',reservationSameDay:true},'要確認'],
    [{reservationStatus:'invalid'},'要確認'],
    [{reservation:'不要（当日会場へ）'},'不要（当日会場へ）'],
    [{reservation:{status:'required'}},'要確認']
  ]) ok(reservationLabel(input)===expected,`予約状態 ${JSON.stringify(input)}`);
}
