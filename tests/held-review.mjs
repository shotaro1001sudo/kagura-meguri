import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, rmSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import * as cheerio from 'cheerio';
import {reconcile, sameEvent} from '../scripts/lib/collect-core.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const rows=read('data/events.json'), review=read('data/held-review-2026-11-04.json'), sources=read('data/sources.json');
const approved=review.records.filter(r=>r.decision==='published'), held=review.records.filter(r=>r.decision==='pending');
assert.equal(approved.length,16);assert.equal(held.length,9);
assert.equal(approved.filter(r=>r.id.startsWith('takachiho')).length,14);
assert.equal(approved.filter(r=>r.name.includes('日神楽')).length,3);
for(const r of review.records){
 const e=rows.find(e=>e.id===r.id);assert.equal(e.status,r.decision);
 if(r.decision==='published'){
  assert.equal(e.start,r.start);assert.equal(e.venue,r.venue);assert.equal(e.lat,r.lat);assert.equal(e.lng,r.lng);
  assert(!e.timeUnknown&&!e.holdReasons&&!e.geoPrecision);assert(e.description.includes('終演時刻'));
  assert(!/個人宅|神事のみ/.test(e.description+e.venue));
  assert.equal(rows.filter(x=>x.status==='published'&&sameEvent(x,e)).length,1,'No published duplicate');
 }else{assert(e.holdReasons.length);assert.equal(e.lat,undefined);assert.equal(e.lng,undefined);}
}
// Replaying the collector's original uncorrected venue/time must retain review decisions,
// IDs, public facts and the remaining holds rather than duplicate or undo the review.
for(const id of ['takachiho-yokagura','npo-hiroshima','akitakata']){
 const source=sources.find(s=>s.id===id);
 const candidates=review.records.filter(r=>rows.find(e=>e.id===r.id).sourceId===id).map(r=>({...rows.find(e=>e.id===r.id),...(r.previous??{}),timeUnknown:(r.previous?.start??r.start).endsWith('T00:00')}));
 const result=reconcile({events:rows,candidates,source,now:new Date('2026-11-04T12:00:00+09:00')});
 assert.equal(result.events.length,rows.length);assert.equal(result.summary.published.length,0);
 for(const r of review.records){const e=result.events.find(e=>e.id===r.id), before=rows.find(e=>e.id===r.id);for(const k of ['status','name','start','venue','lat','lng','description'])assert.equal(e[k],before[k]);}
}
const dir=mkdtempSync(join(tmpdir(),'held-review-'));
try{
 const build=spawnSync(process.execPath,['scripts/build.mjs'],{env:{...process.env,OUT_DIR:dir,BUILD_NOW:'2026-11-04T12:00'},encoding:'utf8'});assert.equal(build.status,0,build.stderr);
 const lite=JSON.parse(readFileSync(join(dir,'events.json'),'utf8'));
 for(const r of approved){
  const html=readFileSync(join(dir,`events/${r.id}.html`),'utf8'),$=cheerio.load(html);
  assert($('table.info').text().includes(r.venue));assert($('table.info').text().includes(r.start.slice(11).replace(/^0/,'')));
  const ld=JSON.parse($('script[type="application/ld+json"]').first().text());const ev=(Array.isArray(ld)?ld:[ld]).find(x=>x['@type']==='Event');
  assert.equal(ev.startDate,r.start+'+09:00');assert.equal(ev.location.geo.latitude,r.lat);assert.equal(ev.location.geo.longitude,r.lng);
  assert(lite.some(e=>e.id===r.id));assert(!html.includes('adsbygoogle.js'));
 }
 for(const r of held){assert(!existsSync(join(dir,`events/${r.id}.html`)));assert(!lite.some(e=>e.id===r.id));}
}finally{rmSync(dir,{recursive:true,force:true});}
console.log('Held review: 16 verified events published; 9 unresolved held; venue/time/category/maps and next collection verified.');
