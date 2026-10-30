// Shared context only: no booking/transport inference and no affiliate URL generation.
export function stayPlanningContext(event, { when = '', dated = false, esc }) {
  return `<div class="stay-planning"><p class="meta">公演：${esc(when || '日時未確認')}<br>会場：${esc(event.venue || '未確認')}</p>
<p><a href="#performance-info">公演の日時・予約案内を確認</a></p>
<p class="meta">宿泊を検討する方へ。${dated ? '検索は開催日の1泊・大人2名です。宿泊日・人数はリンク先で変更できます。' : '観覧日を決めて、リンク先で宿泊日・人数を指定してください。休演日・受付方法は公演情報でご確認ください。'}</p></div>`;
}
