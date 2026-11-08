import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import * as cheerio from 'cheerio';
import {sameEvent,guardEvent} from '../scripts/lib/collect-core.mjs';
// 2026-11-05 に登録した京築神楽8件。その後、管理者用ページで保留を掲載・却下したり、
// 開催を取り下げたり、確認日を更新したりしても成り立つことだけを確かめる(当時の状態を決め打ちしない)。
const rows=JSON.parse(readFileSync('data/events.json')), events=rows.filter(e=>e.id.startsWith('keichiku-'));
const rejected=new Set(JSON.parse(readFileSync('data/rejected.json')).map(r=>r.id));
const STARTS={'keichiku-20261107':'2026-11-07T13:00','keichiku-20261108':'2026-11-08T15:00','keichiku-20261114':'2026-11-14T14:00','keichiku-20261115':'2026-11-15T15:00','keichiku-20261121':'2026-11-21T13:00','keichiku-20261122':'2026-11-22T15:30','keichiku-20261127':'2026-11-27T14:00','keichiku-20261205':'2026-12-05T14:00'};
// 8件のうち、データから消えてよいのは、管理者用ページで却下した(rejected.json に記録がある)ものだけ
for(const id of Object.keys(STARTS))assert(events.some(e=>e.id===id)||rejected.has(id),`${id} がデータにも却下の記録にもない`);
assert(events.every(e=>e.id in STARTS),'登録していない京築の ID がある');
for(const e of events)assert.equal(e.start,STARTS[e.id]);
const nakatsu=events.find(e=>e.id==='keichiku-20261114');if(nakatsu){assert.equal(nakatsu.prefecture,'大分県');assert.equal(nakatsu.city,'中津市');assert.equal(nakatsu.address,'上如水499');}
for(const e of events){
 assert(['published','pending','withdrawn'].includes(e.status),`${e.id}: ${e.status}`);
 assert.equal(e.prefecture,e.id==='keichiku-20261114'?'大分県':'福岡県');
 assert.equal(e.url,'https://www.crossroadfukuoka.jp/feature/keichiku-kagura');assert.match(e.checked,/^\d{4}-\d{2}-\d{2}$/);assert(e.checked>='2026-11-05',`${e.id}: 確認日 ${e.checked}`);assert.equal(e.socialEvidence,undefined);assert.equal(e.auto,undefined);
 assert.deepEqual(guardEvent(e,{now:new Date(e.checked+'T00:00:00Z')}),[]);
 assert.equal(rows.filter(x=>x.status==='published'&&sameEvent(x,e)).length,e.status==='published'?1:0);
 assert.equal(e.end,undefined);assert.equal(e.fee,'');assert.equal(e.reservationStatus,'unknown');assert.equal(e.stayLinks,false);
 if(e.status==='published'){assert(e.lat>33&&e.lat<34);assert(e.lng>131&&e.lng<132);if(e.geoSourceUrl!==undefined)assert(e.geoSourceUrl.startsWith('https://'));}
 else if(e.status==='pending'){assert(e.holdReasons.length);assert.equal(e.lat,undefined);}
}
const dir=mkdtempSync(join(tmpdir(),'keichiku-'));
try {
 const r=spawnSync(process.execPath,['scripts/build.mjs'],{encoding:'utf8',env:{...process.env,OUT_DIR:dir,BUILD_NOW:'2026-11-05T12:00'}});assert.equal(r.status,0,r.stderr);
 const lite=JSON.parse(readFileSync(join(dir,'events.json')));for(const e of events.filter(e=>e.status!=='published'))assert(!lite.some(x=>x.id===e.id));
 for(const e of events.filter(e=>e.status==='published')){
  const $=cheerio.load(readFileSync(join(dir,`events/${e.id}.html`),'utf8'));
  const raw=JSON.parse($('script[type="application/ld+json"]').first().text()), ld=(Array.isArray(raw)?raw:[raw]).find(x=>x['@type']==='Event');
  assert.equal(ld.startDate,e.start+'+09:00');assert.equal(ld.endDate,undefined);assert.equal(ld.isAccessibleForFree,undefined);assert.equal(ld.location.geo.latitude,e.lat);assert.equal(ld.location.geo.longitude,e.lng);assert.equal(ld.location.address.addressRegion,e.prefecture);
  assert($('table.info').text().includes(e.venue));assert($('main').text().includes(e.address));assert($('main').text().includes('雨天時の対応は未確認'));assert.equal($('.stay').length,0);
  assert(lite.some(x=>x.id===e.id));assert(readFileSync(join(dir,`pref/${e.prefecture}.html`),'utf8').includes(e.id));assert(readFileSync(join(dir,'events.ics'),'utf8').includes(e.id));
 }
}finally{rmSync(dir,{recursive:true,force:true});}
const n=s=>events.filter(e=>e.status===s).length;
console.log(`Keichiku: ${n('published')} published + ${n('pending')} held + ${n('withdrawn')} withdrawn + ${8-events.length} rejected; dates, Oita venue, duplicates, unknown fields and output verified.`);
