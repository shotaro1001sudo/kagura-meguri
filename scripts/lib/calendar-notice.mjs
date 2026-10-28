// Calendar input conventions are not additional event facts.
export function calendarNotice(event) {
  if (event.timeUnknown) return {
    suffix: '(時刻未確認・日付のみ)',
    text: '開始・終了時刻は未確認です。日付のみの予定であり、終日開催や終日の観覧を意味しません。'
  };
  if (!event.end) return {
    suffix: '(終了未確認・仮2時間)',
    text: '終了時刻は未確認です。カレンダーの終了は入力用に開始の2時間後を仮設定しており、公演の終了時刻ではありません。公式情報を確認し、必要に応じて予定を編集してください。'
  };
  return {suffix:'',text:''};
}
