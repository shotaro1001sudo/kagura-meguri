// Render the already-approved, upcoming, ordered list from the shared build pipeline.
// No independent dates/content/API calls: the detailed cards remain the source of truth.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function upcomingSummary(list, {formatWhen, id = 'upcoming-summary'} = {}) {
  const items = list.slice(0, 3);
  return `<section class="upcoming-summary" aria-labelledby="${esc(id)}"><h2 id="${esc(id)}">直近の公演日程</h2>${items.length ? `<p>掲載中の開催予定です。公演名から詳細・公式情報を確認できます。</p><ul>${items.map(e => `<li><a href="/events/${esc(e.id)}.html">${esc(e.name)}</a><br><span>${esc(formatWhen(e))}</span><br><span>会場：${esc(e.venue || '未確認')}</span></li>`).join('')}</ul><p class="meta">日時・会場は変更される場合があります。お出かけ前に公式情報をご確認ください。</p>` : '<p>現在、掲載中の開催予定はありません。日程が確認でき次第、掲載します。</p>'}</section>`;
}

export function upcomingSummaryDescription(list, {formatWhen}) {
  const next = list[0];
  return next ? `直近は${formatWhen(next)}、${next.name}。会場：${next.venue || '未確認'}。掲載中の開催予定${list.length}件。詳細と公式情報を確認できます。` : '現在、掲載中の開催予定はありません。日程が確認でき次第、掲載します。';
}
