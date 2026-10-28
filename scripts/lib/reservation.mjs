// Reviewed structured status only: never infer requirements from fee/booking prose.
const LABELS = {unknown:'要確認', required:'事前予約が必要', recommended:'事前予約を推奨', not_required:'事前申込不要'};
export function reservationLabel(event = {}) {
  if (event.reservationStatus !== undefined) {
    const status = event.reservationStatus;
    if (!Object.hasOwn(LABELS, status) || status === 'unknown') return LABELS.unknown;
    // Conflicting required + walk-in data must not promise admission.
    if (status === 'required' && event.reservationSameDay === true) return LABELS.unknown;
    return LABELS[status] + (event.reservationSameDay === true ? '(当日受付あり・定員に注意)' : '');
  }
  return typeof event.reservation === 'string' && event.reservation.trim() ? event.reservation.trim() : LABELS.unknown;
}
