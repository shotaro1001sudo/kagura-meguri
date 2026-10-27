import {readFileSync,writeFileSync,rmSync} from 'node:fs';
import * as cheerio from 'cheerio';
import {reconcile} from '../scripts/lib/collect-core.mjs';
export function asakitaFactsTests({ok,section,build}) {
  section('安佐北11/15: 公式確認した開演・会場と未確認終了');
  const e=JSON.parse(readFileSync('data/events.json','utf8')).find(e=>e.id==='npo-hiroshima-0cf097bb64');
  ok(e.start==='2026-11-15T14:00'&&!e.timeUnknown&&!e.end,'14時開演・終了は未確認のまま');
  ok(e.venue==='安佐北区民文化センター ホール'&&e.description.includes('開場13:00、開演14:00')&&e.checked==='2026-10-27','開場と開演を分離し会場/確認日を保持');
  const r=reconcile({events:[e],candidates:[{...e,start:'2026-11-15T00:00',timeUnknown:true,venue:'',description:''}],source:{id:'npo-hiroshima',name:e.source},now:new Date('2026-10-28T12:00+09:00'),cfg:{autoPublish:true}});
  ok(r.events.length===1&&r.events[0].start===e.start&&r.events[0].venue===e.venue&&r.events[0].description===e.description,'元の時刻未確認候補の再収集で補完内容が消えず重複しない');
  const fixture='tests/fixtures/asakita-facts.tmp.json',out='dist-test-asakita-facts';
  try {
    writeFileSync(fixture,JSON.stringify([e]));const b=build(fixture,out,{BUILD_NOW:'2026-10-27T12:00'});ok(b.status===0,'安佐北実データの生成成功');
    if(b.status!==0)return;
    const $=cheerio.load(readFileSync(`${out}/events/${e.id}.html`,'utf8'));
    const ld=$('script[type="application/ld+json"]').toArray().flatMap(n=>JSON.parse($(n).text())).find(x=>x['@type']==='Event');
    ok(ld.startDate==='2026-11-15T14:00+09:00'&&!ld.endDate&&ld.location.name===e.venue,'Event構造化データに確認済み開始/会場のみ反映し終了を捏造しない');
    ok($('main').text().includes('開場13:00、開演14:00')&&$('main a').toArray().some(n=>$(n).attr('href')===e.url),'詳細本文に時刻と公式リンクを反映');
    const cal=new URL($('a[href^="https://calendar.google.com/calendar/render"]').first().attr('href'));
    ok(cal.searchParams.get('dates').startsWith('20261115T140000/')&&cal.searchParams.get('text').includes('終了未確認'),'カレンダーは14時開始・未確認終了の既存注記を維持');
  }finally{rmSync(fixture,{force:true});rmSync(out,{recursive:true,force:true});}
}
