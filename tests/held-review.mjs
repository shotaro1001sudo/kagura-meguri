import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, rmSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import * as cheerio from 'cheerio';
import {reconcile, sameEvent} from '../scripts/lib/collect-core.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const rows=read('data/events.json'), review=read('data/held-review-2026-11-04.json'), sources=read('data/sources.json');
const rejected=new Set(read('data/rejected.json').map(r=>r.id));
const approved=review.records.filter(r=>r.decision==='published'), held=review.records.filter(r=>r.decision==='pending');
assert.equal(approved.length,16);assert.equal(held.length,9);
assert.equal(approved.filter(r=>r.id.startsWith('takachiho')).length,14);
assert.equal(approved.filter(r=>r.name.includes('日神楽')).length,3);
// 2026-11-04 の見直しのあと、管理者用ページで判断が変わってもよい(当時の状態を決め打ちしない)。
// ただし、掲載中のものは、保留の理由(時刻不明・個人宅・神事のみ・町や市の中心の地図)が解消されていること。
const BAD=/個人宅|神事のみ/;
const publishable=(e,label)=>{
 assert(!e.timeUnknown&&!/T00:00$/.test(e.start),`${label}: 開始時刻が不明のまま掲載している`);
 assert(!e.holdReasons,`${label}: 保留の理由が残ったまま掲載している`);
 assert(!e.geoPrecision,`${label}: 地図が町・地域の中心(${e.geoPrecision})のまま掲載している`);
 assert(Number.isFinite(e.lat)&&Number.isFinite(e.lng),`${label}: 地図の位置がない`);
 assert(!BAD.test(e.description+e.venue),`${label}: 個人宅・神事のみの開催を掲載している`);
 assert.equal(rows.filter(x=>x.status==='published'&&sameEvent(x,e)).length,1,`${label}: 掲載が重複している`);
};
const now=new Map(review.records.map(r=>[r.id,rows.find(e=>e.id===r.id)]));
for(const r of review.records){
 const e=now.get(r.id), label=`${r.id}(${r.name})`;
 if(!e){assert(r.decision==='pending'&&rejected.has(r.id),`${label}: データにも却下の記録にもない`);continue;}
 assert.equal(e.start.slice(0,10),r.start.slice(0,10),`${label}: 開催日が変わっている`);
 if(r.decision==='published'){
  assert(['published','withdrawn'].includes(e.status),`${label}: 掲載と判断したものが ${e.status}`);
  if(e.status==='published'){publishable(e,label);assert(e.description.includes('終演時刻'));}
 }else if(e.status==='pending'){assert(e.holdReasons.length);assert.equal(e.lat,undefined);assert.equal(e.lng,undefined);}
 else if(e.status==='published'){
  // 保留から掲載にしたもの: 見直しの後に公式情報で確かめ直し(確認日・出典・位置の出典)、理由を解消していること
  publishable(e,label);
  assert(e.checked>review.checked,`${label}: 見直し(${review.checked})の後に確かめ直した確認日がない`);
  assert(e.url.startsWith('https://')&&!/docs\.google\.com\/forms/.test(e.url),`${label}: 公式の案内の URL がない`);
  assert(e.geoSourceUrl?.startsWith('https://'),`${label}: 地図の位置の出典がない`);
  assert(e.description.length>0,`${label}: 説明がない`);
 }else assert.equal(e.status,'withdrawn',`${label}: ${e.status}`);
}
// Replaying the collector's original uncorrected venue/time must retain review decisions,
// IDs, public facts and the remaining holds rather than duplicate or undo the review.
for(const id of ['takachiho-yokagura','npo-hiroshima','akitakata']){
 const source=sources.find(s=>s.id===id);
 const candidates=review.records.filter(r=>now.get(r.id)?.sourceId===id).map(r=>({...rows.find(e=>e.id===r.id),...(r.previous??{}),timeUnknown:(r.previous?.start??r.start).endsWith('T00:00')}));
 const result=reconcile({events:rows,candidates,source,now:new Date('2026-11-04T12:00:00+09:00')});
 assert.equal(result.events.length,rows.length);assert.equal(result.summary.published.length,0);
 for(const r of review.records.filter(r=>now.get(r.id))){const e=result.events.find(e=>e.id===r.id), before=now.get(r.id);for(const k of ['status','name','start','venue','lat','lng','description'])assert.equal(e[k],before[k]);}
}
const dir=mkdtempSync(join(tmpdir(),'held-review-'));
try{
 const build=spawnSync(process.execPath,['scripts/build.mjs'],{env:{...process.env,OUT_DIR:dir,BUILD_NOW:'2026-11-04T12:00'},encoding:'utf8'});assert.equal(build.status,0,build.stderr);
 const lite=JSON.parse(readFileSync(join(dir,'events.json'),'utf8'));
 for(const r of approved.filter(r=>now.get(r.id).status==='published')){
  const html=readFileSync(join(dir,`events/${r.id}.html`),'utf8'),$=cheerio.load(html);
  assert($('table.info').text().includes(r.venue));assert($('table.info').text().includes(r.start.slice(11).replace(/^0/,'')));
  const ld=JSON.parse($('script[type="application/ld+json"]').first().text());const ev=(Array.isArray(ld)?ld:[ld]).find(x=>x['@type']==='Event');
  assert.equal(ev.startDate,r.start+'+09:00');assert.equal(ev.location.geo.latitude,r.lat);assert.equal(ev.location.geo.longitude,r.lng);
  assert(lite.some(e=>e.id===r.id));assert(!html.includes('adsbygoogle.js'));
 }
 for(const r of held){
  const e=now.get(r.id);
  if(e?.status==='published'){assert(existsSync(join(dir,`events/${r.id}.html`)));assert(lite.some(x=>x.id===r.id));}
  else{assert(!existsSync(join(dir,`events/${r.id}.html`)));assert(!lite.some(x=>x.id===r.id));}
 }
}finally{rmSync(dir,{recursive:true,force:true});}
const count=(rs,st)=>rs.filter(r=>(now.get(r.id)?.status??'rejected')===st).length;
console.log(`Held review: 16 approved (${count(approved,'published')} published, ${count(approved,'withdrawn')} withdrawn); 9 held (${count(held,'pending')} still held, ${count(held,'published')} resolved and published, ${count(held,'rejected')} rejected); venue/time/category/maps and next collection verified.`);
