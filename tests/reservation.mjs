import { reservationLabel } from '../scripts/lib/reservation.mjs';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import * as cheerio from 'cheerio';
export function reservationTests({ok, section}) {
  section('予約状態の共通表示・広島の直近日程');
  for (const [input, expected] of [
    [{},'要確認'],[{fee:'無料',booking:'予約については公式へ'},'要確認'],
    [{reservationStatus:'unknown',reservation:'不要'},'要確認'],
    [{reservationStatus:'required'},'事前予約が必要'],
    [{reservationStatus:'recommended'},'事前予約を推奨'],
    [{reservationStatus:'not_required'},'事前申込不要'],
    [{reservationStatus:'recommended',reservationSameDay:true},'事前予約を推奨（当日受付あり・定員に注意）'],
    [{reservationStatus:'required',reservationSameDay:true},'要確認'],
    [{reservationStatus:'invalid'},'要確認'],
    [{reservation:'不要（当日会場へ）'},'不要（当日会場へ）'],
    [{reservation:{status:'required'}},'要確認']
  ]) ok(reservationLabel(input)===expected,`予約状態 ${JSON.stringify(input)}`);
  const out='dist-test-reservation';
  const result=spawnSync('node',['scripts/build.mjs'],{encoding:'utf8',env:{...process.env,OUT_DIR:out,BUILD_NOW:'2026-10-25T12:00',TEST_ADS_OFF:'1',TEST_AFF_OFF:'1',TEST_PLANNING_OFF:'1',TEST_GA:'',TEST_CB:'',TEST_GOATCOUNTER:''}});
  ok(result.status===0,'実掲載データで固定日付ビルド',result.stderr);
  if(result.status!==0)return;
  const page=p=>cheerio.load(readFileSync(`${out}/${p}`,'utf8'));
  const events=JSON.parse(readFileSync('data/events.json','utf8'));
  const regular=JSON.parse(readFileSync('data/regular.json','utf8'));
  const tak=regular.find(e=>e.id==='takachiho-jinja-kagura');
  const nag=events.find(e=>e.id==='otoyo-nagafuchi-kagura-2026');
  const home=page('index.html'),detail=page(`regular/${tak.id}.html`), event=page(`events/${nag.id}.html`);
  ok(home('.event-facts').text().includes(reservationLabel(tak)) && detail('table.info').text().includes(reservationLabel(tak)), '高千穂のトップ・詳細で同じ予約状態');
  ok(detail('table.info').text().includes(tak.booking),'高千穂の受付方法全文を維持');
  ok(event('table.info').text().includes('事前申込不要') && page('pref/高知県.html')('.event-facts').text().includes('事前申込不要'),'永渕の詳細・県一覧で申込不要を表示');
  ok(tak.checked==='2026-10-09' && nag.checked==='2026-10-12' && tak.reservationChecked==='2026-10-25' && nag.reservationChecked==='2026-10-25','既存確認日と予約再確認日を区別');
  const h=page('pref/広島県.html'), intro=h('.pref-upcoming');
  ok(intro.length===1 && intro.find('li').length===3,'広島だけ直近3公演を表示');
  const ids=intro.find('li a').map((_,a)=>h(a).attr('href')).get();
  ok(new Set(ids).size===3 && ids.every(url=>h(`.pref-month a[href='${url}']`).length===1),'直近リンクは掲載日程の詳細へ、重複なし');
  ok(h('main').html().indexOf('pref-upcoming')<h('main').html().indexOf('pref-month-nav'),'直近日程を月別導線より先に表示');
  ok(h('#hiroshima-regular').length===1 && intro.find('[href="#hiroshima-regular"]').length===1,'定期公演へのページ内リンクが解決');
  ok(page('pref/高知県.html')('.pref-upcoming').length===0,'他県の冒頭構成は変更しない');
  ok(h('meta[name="description"]').attr('content').includes('月別スケジュール'),'広島descriptionに日程の探し方');
}
