import { readFileSync } from 'node:fs';
import { load } from 'cheerio';

// 開催・定期公演のページの宿の枠と、本文の案内(2026-10-30 運営者の判断)
// - 宿の枠は見出しと宿のボタンだけ(公演・会場、公演情報へ戻るリンク、宿泊の説明、検索の条件は置かない)
// - じゃらんと楽天トラベルは同じ書き方(「◯◯の宿を…で探す」)・同じ枠線のボタン
// - ガイドへの案内・広島の「観覧前に確認」・持ち物と行き帰りのカードは置かない(周辺体験のカードは残す)
export function stayPlanningTests({ ok, section }) {
  section('公演のページの宿の枠と本文の案内');
  for (const path of ['events/t-full.html', 'regular/r-nightly.html']) {
    const $ = load(readFileSync('dist-test-ga4-affiliate/' + path, 'utf8'));
    const box = $('.d-side .stay, .d-side .aff').first();
    ok(box.length === 1 && box.find('.stay-planning,.stay-cond').length === 0 && !/公演：|会場：|公演の日時・予約案内を確認|宿泊を検討する方へ|大人2名/.test(box.text()), path + ': 宿の枠に公演・会場・宿泊の説明・検索の条件を出さない');
    const buttons = box.find('.staylinks').children();
    const labels = buttons.toArray().map((x) => $(x).is('[data-vc-ad]') ? $(x).find('template').html()?.replace(/<[^>]+>/g, '') : $(x).text());
    ok(buttons.length === 2 && buttons.toArray().every((x) => $(x).hasClass('stay-btn')) && $(buttons[0]).is('[data-vc-ad]') && $(buttons[1]).is('a[rel~=sponsored]'), path + ': じゃらんと楽天トラベルを、同じ枠線のボタン(stay-btn)で並べる');
    ok(/^.+の宿をじゃらんで探す$/.test(labels[0]) && labels[1] === labels[0].replace('じゃらん', '楽天トラベル'), path + ': じゃらんと楽天トラベルを同じ書き方にする', labels.join(' / '));
    ok($('.guide-link,.viewing-preparation').length === 0 && !$('main').text().includes('ガイドもどうぞ'), path + ': ガイドへの案内・観覧前に確認を置かない');
    ok($('.planning-links.solo').length === 1 && $('.planning-links a[href^="/guide.html"]').length === 0 && $('.planning-links>#nearby-experiences').length === 1, path + ': 持ち物・行き帰りのカードを置かず、周辺体験のカードだけにする');
  }
  const hiroshima = load(readFileSync('dist-test-ga4-affiliate/events/t-timeunknown.html', 'utf8'));
  ok(hiroshima('.viewing-preparation,.guide-link').length === 0, '広島の公演のページも、観覧前に確認を置かない');
  const pref = load(readFileSync('dist-test-ga4-affiliate/pref/広島県.html', 'utf8'));
  ok(pref('.stay-planning,.stay-cond').length === 0 && pref('.viewing-preparation').length === 1, '県のページは変えない(公演固有の案内を混ぜず、広島の観覧準備の案内は残す)');
}
