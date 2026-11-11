// Calendar input conventions are not additional event facts.
// text: カレンダーの予定(Google カレンダー・ICS)の説明欄に入れる全文。予定だけを後から見ても、仮の時刻だと分かるように。
// short: 開催ページの「日時」の欄に出す短い形。すぐ上のリンクが「仮登録(終了未確認)」と書いているので、要点だけにする(要点の枠で注意書きが長くならないように)
export function calendarNotice(event) {
  if (event.timeUnknown) {
    const text = '開始・終了時刻は未確認です。日付のみの予定であり、終日開催や終日の観覧を意味しません。';
    return { suffix: '(時刻未確認・日付のみ)', text, short: text };
  }
  if (!event.end) {
    const sessions = event.sessions?.length ? `開始は${event.sessions.join('・')}の${event.sessions.length}回です。この予定は初回の開始を仮登録します。` : '';
    return {
      suffix: '(終了未確認・仮2時間)',
      text: sessions + '終了時刻は未確認です。カレンダーの終了は入力用に開始の2時間後を仮設定しており、公演の終了時刻ではありません。公式情報を確認し、必要に応じて予定を編集してください。',
      short: sessions + '終了時刻は未確認です。カレンダーには、入力用に仮の終了(開始の2時間後)が入ります。'
    };
  }
  return {suffix:'',text:'',short:''};
}
