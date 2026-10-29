import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from '../scripts/adapters/national-official.mjs';
import {reconcile} from '../scripts/lib/collect-core.mjs';
import {fingerprint,recordWatch} from '../scripts/lib/source-watch.mjs';
import {strictRobotsAllows} from '../scripts/lib/strict-robots.mjs';
const sources=JSON.parse(readFileSync('data/sources.json','utf8'));
const newSources=sources.filter(s=>s.nationalExpansion);
assert.equal(newSources.length,15);
assert.equal(new Set(sources.map(s=>s.id)).size,sources.length);
assert(newSources.filter(s=>s.enabled).every(s=>s.termsChecked && s.requestDelayMs>=5000));
assert.equal(newSources.filter(s=>s.enabled && s.collectionMode==='events').length,2);
assert(newSources.filter(s=>s.collectionMode==='review').every(s=>s.adapter==='official-watch'));
const source=sources.find(s=>s.id==='iinan-kaguradan');
const sample=`<h2>2026年</h2>
<p>10月30日（金） 花栗地区 奉納神楽<br>場所:島根県飯石郡飯南町花栗1014 武内神社<br>時間:19:30～<br>演目:神降し</p>
<p>11月3日（祝） 出雲井神社例大祭奉納<br>場所:雲南市三刀屋町殿河内309 出雲井神社<br>時間:14:15〜<br>演目:大蛇</p>
<p>11月14日（土） ラジオ関西<br>場所:飯南町<br>時間:12:00～<br>※一般観覧不可</p>
<p>11月29日（日） 第34回神楽祭<br>場所:佐伯区民文化センターホール<br>時間:9:30開演(9:00開場) 飯南は16:40頃の出演</p>
<p>12月6日（日） 飯南神楽団20周年記念公演<br>場所:赤名農村環境改善センター<br>時間:10:00開演</p>
<h3>以下公演済み</h3><p>12月9日（水） 過去の神楽<br>場所:飯南町<br>時間:10:00開演</p>`;
const items=parse(sample,source);
assert.equal(items.length,3);assert.equal(items[0].start,'2026-10-30T19:30');
assert.equal(items[1].city,'雲南市');assert.equal(items[1].venue,'出雲井神社');
assert.equal(items[2].start,'2026-12-06T10:00');
assert.throws(()=>parse(sample.replace('<h2>2026年</h2>',''),source));
assert.throws(()=>parse(sample.replace('12月6日','2月31日'),source));
assert.equal(parse(sample.replace('時間:10:00開演','時間:10:00開演 中止'),source).length,2);
assert.equal(parse(sample.replace('赤名農村環境改善センター','会場未定'),source).length,2);
const now=new Date('2026-10-30T00:00:00+09:00');
const first=reconcile({events:[],candidates:items,source,now});
assert.equal(first.summary.published.length,3);
const again=reconcile({events:first.events,candidates:items,source,now});
assert.equal(again.summary.published.length,0);assert.equal(again.events.length,3);
const ham=sources.find(s=>s.id==='hamamatsu-kawai-hanamai');
const h='<h1>川合花の舞</h1><p>更新日:2026年9月24日</p><p>日程：2026年10月31日（土曜日）午後2時頃から深夜<br>場所：八坂神社、静岡県浜松市天竜区佐久間町川合833-2-2</p>';
assert.equal(parse(h,ham)[0].start,'2026-10-31T00:00');assert.equal(parse(h,ham)[0].timeUnknown,true);
assert.equal(parse(h,ham)[0].end,undefined);
assert.throws(()=>parse(h.replace('2026年10月31日','10月31日'),ham));
assert.throws(()=>parse(h.replace('2026年10月31日','2026年2月31日'),ham));
const f=fingerprint(h,ham.url), w=recordWatch(null,[f],ham,'2026-10-30');
assert(w.pending);assert(!JSON.stringify(w.pages).includes('午後2時'));
const acknowledged={...w,reviewedDigest:w.digest};
assert.equal(recordWatch(acknowledged,[f],ham,'2026-10-31').pending,false);
assert.equal(recordWatch(w,[f],ham,'2026-10-31').pending,true);
assert(recordWatch(acknowledged,[fingerprint(h.replace('10月31日','11月1日'),ham.url)],ham,'2026-10-31').pending);
assert.notEqual(fingerprint(h+'<a href="/old.pdf">日程</a>',ham.url).digest,fingerprint(h+'<a href="/new.pdf">日程</a>',ham.url).digest);
assert.equal(fingerprint(h+'<script>random1</script>',ham.url).digest,fingerprint(h+'<script>random2</script>',ham.url).digest);
for(const status of [403,429,500]) assert.equal((await strictRobotsAllows('https://example.org/a','KaguraMeguriBot/1.0',async()=>new Response('',{status}))).ok,false);
assert.equal((await strictRobotsAllows('https://example.org/a','KaguraMeguriBot/1.0',async()=>new Response('',{status:404}))).ok,true);
assert.equal((await strictRobotsAllows('https://example.org/a','KaguraMeguriBot/1.0',async()=>{throw Error('offline')})).ok,false);
assert.equal((await strictRobotsAllows('https://example.org/a','KaguraMeguriBot/1.0',async()=>new Response('User-agent: *\nDisallow: /'))).ok,false);
console.log('全国収集: 日時・公開範囲・重複・変更監視・robots検査 passed');
