import { fetchCollectionPage } from '../scripts/lib/collection-fetch.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { isSocialPost, socialPlatform, socialFacts, socialEvidenceErrors, socialDuplicate, socialPostKey } from '../scripts/lib/social-evidence.mjs';
import { reconcile } from '../scripts/lib/collect-core.mjs';
import { upsertEvent } from '../scripts/admin/store.mjs';
const now = new Date(), checked = new Date(now.getTime()+9*3600e3).toISOString().slice(0,10);
const start = new Date(now.getTime()+7*864e5).toISOString().slice(0,10)+'T18:00';
const base = { id:'social-test', name:'テスト神楽', kagura:'石見神楽', prefecture:'島根県', city:'浜田市', venue:'テスト会館', start, fee:'', url:'https://x.com/test/status/12345', checked, source:'テスト保存会', status:'published' };
const verified = (e=base) => ({...e, socialEvidence:{postUrl:e.url, organizer:'テスト保存会', authorityUrl:'https://example.org/official', authorityNote:'自治体の紹介ページから投稿元へのリンクを確認', checked, publicAccess:true, facts:socialFacts(e)}});
for (const url of ['https://x.com/test/status/12345','https://twitter.com/test/status/12345?s=20','https://www.instagram.com/p/Ab_c-1/','https://www.instagram.com/reel/Ab_c-1/','https://www.facebook.com/test/posts/pfbid123','https://www.facebook.com/events/12345/','https://m.facebook.com/permalink.php?story_fbid=pfbid123&id=123']) {
 assert(isSocialPost(url),url);assert.deepEqual(socialEvidenceErrors(verified({...base,url})),[]);
}
for (const url of ['https://x.com/test','https://instagram.com/test/','https://facebook.com/share/p/123','https://x.com.evil.test/test/status/123','https://user:secret@x.com/test/status/123','http://x.com/test/status/123','https://t.co/123','https://instagram.com/stories/test/123/','https://facebook.com/login/','javascript:alert(1)']) assert(!isSocialPost(url),url);
assert.equal(socialPlatform('https://mobile.twitter.com/a'),'x');
assert.equal(socialPostKey(base.url),socialPostKey('https://twitter.com/renamed/status/12345?s=20'));
assert(socialDuplicate(base,{...base,name:'別の表記',url:'https://twitter.com/renamed/status/12345?s=20',venue:'別表記'}));
assert(socialDuplicate(base,{...base,name:'別の表記',url:'https://instagram.com/p/abc/'}));
assert(!socialDuplicate(base,{...base,start:start.slice(0,10)+'T20:00',url:'https://instagram.com/p/abc/'}));
assert(socialEvidenceErrors(base).length);
for (const change of [{start:start.slice(0,10)+'T19:00'}, {venue:'別の会場'}, {fee:'有料'}, {checked:'2099-01-01'}]) assert(socialEvidenceErrors({...verified(),...change}).length);
for (const change of [{publicAccess:false},{authorityUrl:'javascript:alert(1)'},{checked:'2026-02-30'},{organizer:''}]) assert(socialEvidenceErrors({...verified(),socialEvidence:{...verified().socialEvidence,...change}}).length);
assert(socialEvidenceErrors(verified({...base,start:'2026-02-30T18:00'})).length);
const unknown=verified({...base,start:start.slice(0,10)+'T00:00',timeUnknown:true});assert.deepEqual(socialEvidenceErrors(unknown),[]);
const source={id:'test',name:'test',url:'https://example.org',kagura:'石見神楽',prefecture:'島根県'};
const auto=reconcile({events:[],candidates:[base],source,now});assert.equal(auto.summary.published.length,0);assert.equal(auto.summary.held.length,1);
assert(upsertEvent([],base,null,'published').errs);
const adminInput={...base,socialVerified:true,socialOrganizer:'テスト保存会',socialAuthorityUrl:'https://example.org/',socialAuthorityNote:'団体の紹介から確認'};
assert.equal(upsertEvent([],adminInput,null,'published').event.status,'published');
const edited=[verified()];assert(upsertEvent(edited,{...base,venue:'別会場'},base.id,'published').errs);assert.equal(edited[0].venue,base.venue);
const dir=mkdtempSync(join(tmpdir(),'social-evidence-')), path=join(dir,'events.json'), input=join(dir,'candidate.json');
const run=(script,args=[],env={},cwd=process.cwd())=>spawnSync(process.execPath,[resolve(script),...args],{cwd,encoding:'utf8',env:{...process.env,...env}});
try {
 const sources=join(dir,'sources.json'), summary=join(dir,'summary.json'), preload=join(dir,'no-network.mjs');
 writeFileSync(sources,JSON.stringify(['https://x.com/test','https://instagram.com/test','https://facebook.com/test'].map((url,i)=>({id:'sns-'+i,url,termsChecked:checked,enabled:true,adapter:'jsonld'}))));
 writeFileSync(preload,'globalThis.fetch = () => { throw new Error("NETWORK_ATTEMPT"); };');
 writeFileSync(path,'[]');
 const collect=spawnSync(process.execPath,['--import',pathToFileURL(preload).href,'scripts/collect.mjs'],{encoding:'utf8',env:{...process.env,EVENTS_FILE:path,SOURCES_FILE:sources,SUMMARY_FILE:summary,REPORT_FILE:join(dir,'report.md'),SOURCE_WATCH_FILE:join(dir,'watch.json'),REJECTED_FILE:join(dir,'rejected.json')}});
 assert.equal(collect.status,0,collect.stderr);assert(!collect.stdout.includes('NETWORK_ATTEMPT'));assert.equal((collect.stdout.match(/SNSの自動取得は無効/g)||[]).length,3);assert.deepEqual(JSON.parse(readFileSync(path)),[]);
 writeFileSync(path,'[]');writeFileSync(input,JSON.stringify({...verified(),description:'投稿全文',image:'photo.jpg',auto:true}));
 let r=run('scripts/import-social.mjs',[input],{EVENTS_FILE:path});assert.equal(r.status,0,r.stderr);
 let rows=JSON.parse(readFileSync(path));assert.equal(rows[0].status,'pending');for(const k of ['socialEvidence','description','image','auto'])assert(!(k in rows[0]));
 assert.notEqual(run('scripts/import-social.mjs',[input],{EVENTS_FILE:path}).status,0);
 const {mkdirSync}=await import('node:fs');mkdirSync(join(dir,'data'));const reviewPath=join(dir,'data/events.json');
 writeFileSync(reviewPath,JSON.stringify(rows));assert.notEqual(run('scripts/review.mjs',['approve','all'],{},dir).status,0);assert.equal(JSON.parse(readFileSync(reviewPath))[0].status,'pending');
 writeFileSync(reviewPath,JSON.stringify([{...verified(),status:'pending'}]));r=run('scripts/review.mjs',['approve','all'],{},dir);assert.equal(r.status,0,r.stderr);
 writeFileSync(path,JSON.stringify([base]));r=run('scripts/build.mjs',[],{EVENTS_FILE:path,OUT_DIR:join(dir,'out')});assert.notEqual(r.status,0);assert(r.stderr.includes('SNS:'));
 writeFileSync(path,JSON.stringify([verified()]));r=run('scripts/build.mjs',[],{EVENTS_FILE:path,OUT_DIR:join(dir,'out')});assert.equal(r.status,0,r.stderr);
 const html=readFileSync(join(dir,'out/events/social-test.html'),'utf8');assert(html.includes('X（Twitter）の公開投稿'));assert(html.includes('確認'));assert(!html.includes('platform.twitter.com'));
 writeFileSync(path,JSON.stringify([verified(),{...base,id:'duplicate',url:'https://example.org',name:'別タイトル'}]));assert.notEqual(run('scripts/build.mjs',[],{EVENTS_FILE:path,OUT_DIR:join(dir,'out')}).status,0);
 writeFileSync(path,JSON.stringify([{...verified(),status:'pending'}]));r=run('scripts/build.mjs',[],{EVENTS_FILE:path,OUT_DIR:join(dir,'out')});assert.equal(r.status,0,r.stderr);assert(!existsSync(join(dir,'out/events/social-test.html')));
} finally { rmSync(dir,{recursive:true,force:true}); }
console.log('SNS evidence: intake, admin, approve all, build gate, stale facts, duplicates, and display passed.');

// Redirects retain normal source behavior, but SNS is rejected before any request.
for (const target of ['https://x.com/a/status/1','https://instagram.com/p/a/','https://facebook.com/a/posts/1']) {
 const calls=[];
 await assert.rejects(fetchCollectionPage('https://example.org/start',{}, {checkRobots:async()=>({ok:true}),delay:async()=>{},fetchImpl:async url=>{calls.push(url);return new Response(null,{status:302,headers:{location:target}});}}),/SNS/);
 assert.deepEqual(calls,['https://example.org/start']);
}
const calls=[],robots=[];
const result=await fetchCollectionPage('https://example.org/start',{}, {checkRobots:async url=>{robots.push(url);return {ok:true};},delay:async()=>{},fetchImpl:async url=>{calls.push(url);return url.endsWith('/start')?new Response(null,{status:301,headers:{location:'/new'}}):new Response('ok');}});
assert.equal(await result.text(),'ok');assert.deepEqual(calls,['https://example.org/start','https://example.org/new']);assert.deepEqual(robots,['https://example.org/new']);
await assert.rejects(fetchCollectionPage('https://example.org/start',{}, {sameOrigin:true,checkRobots:async()=>({ok:true}),delay:async()=>{},fetchImpl:async()=>new Response(null,{status:302,headers:{location:'https://other.example.org/'}})}),/別サイト/);
await assert.rejects(fetchCollectionPage('https://example.org/start',{}, {checkRobots:async()=>({ok:false,reason:'robots denied'}),delay:async()=>{},fetchImpl:async()=>new Response(null,{status:302,headers:{location:'/private'}})}),/robots denied/);
console.log('Collection redirects: normal redirects retained, robots checked, SNS blocked before access.');
