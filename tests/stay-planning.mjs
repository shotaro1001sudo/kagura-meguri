import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { stayPlanningContext } from '../scripts/lib/stay-planning.mjs';

export function stayPlanningTests({ ok, section }) {
  section('公演と宿探しの共通案内');
  const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const unknown = load(stayPlanningContext({}, { esc }));
  ok(unknown.text().includes('日時未確認') && unknown.text().includes('会場：未確認'), '欠損日時・会場を推測しない');
  ok(unknown('a').length === 1 && unknown('a').attr('href') === '#performance-info', '予約先を生成せず既存公演情報を参照する');
  const unsafe = load(stayPlanningContext({ venue: '<img src=x onerror=alert(1)>' }, { when: '<script>bad</script>', esc }));
  ok(unsafe('img,script').length === 0 && unsafe.text().includes('<img'), '会場・日程の文字列をエスケープする');
  for (const when of ['2026年11月7日(土) 開演時刻未確認', '2026年11月7日(土) 13:00〜', '2026年11月7日(土)〜11月8日(日) 開演時刻未確認']) {
    const $ = load(stayPlanningContext({ venue: '会館' }, { when, dated: true, esc }));
    ok($.text().includes(when) && $.text().includes('開催日の1泊・大人2名') && !$.text().includes('終演'), '時刻不明・終了未確認・複数日をそのまま案内: ' + when);
  }
  for (const path of ['events/t-full.html', 'regular/r-nightly.html']) {
    const $ = load(readFileSync('dist-test-ga4-affiliate/' + path, 'utf8'));
    ok($('.stay-planning').length === 1 && $('#performance-info').length === 1, path + ': 共通案内と戻り先が各1件');
    ok($('#performance-info').attr('tabindex') === '-1' && $('.stay-planning a').attr('href') === '#performance-info', path + ': キーボードで戻る対象を指定');
    ok($('.stay-planning').text().includes('宿泊を検討する方へ'), path + ': 宿泊を必須としない');
    ok($('.stay-planning [href^="http"]').length === 0, path + ': 予約・交通・広告先の新規URLを作らない');
    if (path.startsWith('regular')) ok($('.stay-planning').text().includes('リンク先で宿泊日・人数を指定') && !$('.stay-planning').text().includes('開催日の1泊'), '定期公演に具体的宿泊日を捏造しない');
  }
  const pref = load(readFileSync('dist-test-ga4-affiliate/pref/広島県.html', 'utf8'));
  ok(pref('.stay-planning').length === 0, '県・種類の案内に公演固有情報を混ぜない');
}
