import assert from 'node:assert/strict';
import {mkdtempSync, copyFileSync, readFileSync, rmSync, cpSync, mkdirSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {resolve, join} from 'node:path';
import {JSDOM} from 'jsdom';
import {loadPerformancePhotos, performancePhoto} from '../scripts/lib/performance-photos.mjs';

const root=mkdtempSync(join(tmpdir(),'performance-photos-'));
try {
  // Solid color rectangle is solely a test fixture, never a published event photo.
  copyFileSync('tests/fixtures/card-test.webp',join(root,'test.webp'));
  const records={events:[{id:'test'}],regular:[{id:'regular-test'}]};
  const photo={kind:'events',id:'test',file:'test.webp',alt:'試験用 <画像>',caption:'試験用の説明',credit:'試験用クレジット',sourceUrl:'https://example.com/source',permissionUrl:'https://example.com/license',permission:'試験用許諾',rightsConfirmed:true,checkedAt:'2026-11-05',width:640,height:480};
  const load=p=>loadPerformancePhotos({publicationEnabled:true,photos:[p]},records,'2026-11-05',root);
  assert.equal(loadPerformancePhotos(JSON.parse(readFileSync('data/performance-photos.json')),records,'2026-11-05',root).size,0);
  assert.throws(()=>loadPerformancePhotos({publicationEnabled:false,photos:[photo]},records,'2026-11-05',root),/停止中/);
  for(const change of [{rightsConfirmed:false},{permission:''},{sourceUrl:'javascript:alert(1)'},{permissionUrl:'http://example.com'},{file:'../test.webp'},{file:'https://example.com/a.webp'},{id:'missing'},{checkedAt:'2026-11-06'},{checkedAt:'2026-02-30'},{width:0}]) assert.throws(()=>load({...photo,...change}));
  assert.throws(()=>loadPerformancePhotos({publicationEnabled:true,photos:[photo,photo]},records,'2026-11-05',root),/指定が不正/);
  assert(load({...photo,kind:'regular',id:'regular-test'}).has('regular/regular-test'));
  const verified=load(photo).get('events/test');
  assert.equal(verified.permissionUrl,photo.permissionUrl);
  assert.equal(verified.rightsConfirmed,undefined,'internal review data not sent to browser');
  assert.equal(performancePhoto(null),'','no placeholder for absent photo');
  const dom=new JSDOM(`<div class="performance-card"><a href="/events/test.html">公演</a>${performancePhoto(verified)}</div>`,{runScripts:'outside-only'});
  const doc=dom.window.document,img=doc.querySelector('img');
  assert.equal(img.alt,photo.alt);assert.equal(img.getAttribute('loading'),'lazy');assert.equal(img.getAttribute('decoding'),'async');assert.equal(doc.querySelectorAll('figure a').length,2);
  assert.equal(doc.querySelector('figure script'),null);
  assert.equal(doc.querySelector('img').getAttribute('width'),'640');
  dom.window.eval(readFileSync('scripts/client/performance-photos.js','utf8'));
  img.dispatchEvent(new dom.window.Event('error'));
  assert(doc.querySelector('figure').hidden);assert(doc.querySelector('a[href="/events/test.html"]'));
  doc.body.insertAdjacentHTML('beforeend',performancePhoto(verified));
  const dynamic=doc.querySelector('body>figure');dynamic.querySelector('img').dispatchEvent(new dom.window.Event('error'));
  assert(dynamic.hidden,'finder-inserted failed photos also collapse');
  dom.window.close();
  // Build enabled-photo fixtures in isolation; production manifest stays disabled.
  const sandbox=join(root,'build');mkdirSync(sandbox);
  for(const dir of ['scripts','node_modules']) symlinkSync(resolve(dir),join(sandbox,dir),'dir');
  for(const dir of ['data','assets']) cpSync(dir,join(sandbox,dir),{recursive:true});
  copyFileSync('config.json',join(sandbox,'config.json'));
  mkdirSync(join(sandbox,'assets/performance-photos'));
  copyFileSync('tests/fixtures/card-test.webp',join(sandbox,'assets/performance-photos/test.webp'));
  const event=JSON.parse(readFileSync('data/events.json')).find(e=>e.status==='published');
  const regular=JSON.parse(readFileSync('data/regular.json')).find(e=>e.status==='published');
  writeFileSync(join(sandbox,'data/performance-photos.json'),JSON.stringify({publicationEnabled:true,photos:[{...photo,id:event.id},{...photo,kind:'regular',id:regular.id}]}));
  execFileSync(process.execPath,[resolve('scripts/build.mjs')],{cwd:sandbox,env:{...process.env,BUILD_NOW:'2026-11-05T12:00',OUT_DIR:'dist'},stdio:'pipe'});
  const lite=JSON.parse(readFileSync(join(sandbox,'dist/events.json')));
  assert.equal(lite.find(e=>e.id===event.id).photo.src,'/performance-photos/test.webp');
  assert.equal(readFileSync(join(sandbox,'dist/performance-photos/test.webp')).length,readFileSync('tests/fixtures/card-test.webp').length);
  assert.match(readFileSync(join(sandbox,'dist/calendar.html'),'utf8'),/function performancePhoto/);
  assert.match(readFileSync(join(sandbox,'dist/calendar.html'),'utf8'),/naturalWidth === 0/);
  const regPage=readFileSync(join(sandbox,'dist/this-month.html'),'utf8');
  assert.match(regPage,/class="performance-photo"/);

  console.log('performance photos: permission gate, validation, escaping, metadata, missing/failed/dynamic images passed');
} finally {rmSync(root,{recursive:true,force:true});}
