// Render actual generated pages offline. External requests are blocked before send.
// Test media is a labelled solid rectangle, never a public performance image.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep,extname} from 'node:path';
import {boundedCdp} from './helpers/bounded-cdp.mjs';
const root=resolve(process.env.CARDS_QA_SITE_DIR||'dist');
const server=createServer((q,r)=>{let path;try{path=resolve(root,'.'+decodeURIComponent(new URL(q.url,'http://local').pathname));if(!path.startsWith(root+sep)&&path!==root)throw Error();if(path===root||q.url.endsWith('/'))path=join(path,'index.html');if(path===join(root,'card-test.webp'))path=resolve('tests/fixtures/card-test.webp');if(!existsSync(path))throw Error();r.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp'})[extname(path)]||'application/octet-stream');r.end(readFileSync(path));}catch{r.statusCode=404;r.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const profile=mkdtempSync(join(tmpdir(),'cards-ui-'));
const chrome=spawn(process.env.CHROMIUM_BIN||'/usr/bin/chromium',['--headless','--no-sandbox','--disable-gpu','--disable-background-networking','--no-first-run','--disable-sync','--disable-extensions','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
let ws;
try{
 const endpoint=await new Promise((resolve,reject)=>{let out='';const t=setTimeout(()=>reject(Error('startup timeout')),10000);chrome.stderr.on('data',d=>{out+=d;const m=out.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(t);resolve(m[1]);}});});
 const tabs=await(await fetch('http://127.0.0.1:'+new URL(endpoint).port+'/json/list')).json();ws=new WebSocket(tabs[0].webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 const transport=boundedCdp(x=>ws.send(x)),send=transport.send;let blocked=0,loads=0;
 ws.onmessage=async e=>{const m=JSON.parse(e.data);if(m.method==='Page.loadEventFired')loads++;if(m.id){transport.receive(m);return;}if(m.method==='Fetch.requestPaused'){const {requestId,request}=m.params;const local=new URL(request.url).origin===origin;if(!local)blocked++;await send(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId}:{requestId,errorReason:'BlockedByClient'});}};
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,timeout:3000});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
 await send('Page.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});

 const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(join(tmpdir(),name+'.png'),Buffer.from(r.data,'base64'));};
 const results=[];
 for(const color of ['light','dark']) for(const width of [1280,390,320]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'},{name:'prefers-color-scheme',value:color}]});
  for(const path of ['/','/calendar.html','/pref/広島県.html','/weekend.html']){
   const previous=loads;await send('Page.navigate',{url:origin+encodeURI(path)});
   for(let i=0;i<250&&loads===previous;i++)await new Promise(r=>setTimeout(r,20));assert(loads>previous);
   for(let i=0;i<100 && !(await evaluate('!!document.querySelector(".performance-card")'));i++)await new Promise(r=>setTimeout(r,30));
   assert(await evaluate('!!document.querySelector(".performance-card")'),path);
   assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false,path+' overflow');
   await evaluate('document.querySelector(".performance-card").scrollIntoView({block:"center",behavior:"instant"})');
   await shot('cards-'+color+'-'+width+'-'+(path==='/'?'home':path.split('/').at(-1)));
   if(path==='/calendar.html') {
    await evaluate(`document.getElementById('pref').value='広島県';document.getElementById('pref').dispatchEvent(new Event('change'))`);
    assert(await evaluate(`Array.from(document.querySelectorAll('#results li')).every(x=>x.textContent.includes('広島県'))`));
    await evaluate(`document.getElementById('reset').click();document.getElementById('tab-kw').click();document.getElementById('keyword').value='絶対に存在しない公演テスト';document.getElementById('keyword').dispatchEvent(new Event('input'))`);
    assert.equal(await evaluate('document.querySelectorAll("#results li").length'),0);
   }
   if(path!=='/calendar.html') {
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    await evaluate(`document.querySelector('.performance-card h3 a,.performance-card h4 a').focus()`);
    assert(await evaluate(`document.activeElement.matches('.performance-card h3 a,.performance-card h4 a')`));
    assert.equal(await evaluate(`getComputedStyle(document.activeElement.closest('.performance-card')).outlineStyle`),'solid');
   }
   results.push({color,width,path,overflow:false});
  }
 }
 // Exercise the actual shared renderer with a labelled solid test rectangle.
 await send('Page.navigate',{url:origin+'/'});await new Promise(r=>setTimeout(r,400));
 const {performancePhoto}=await import('../scripts/lib/performance-photos.mjs');
 const fixture={src:'/card-test.webp',width:640,height:480,alt:'試験用の単色画像',caption:'レイアウト試験用の単色画像',credit:'Test',sourceUrl:'https://example.com',permission:'Test only',permissionUrl:'https://example.com'};
 for(const width of [1280,390,320]) {
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
  await evaluate(`document.querySelectorAll('.performance-photo').forEach(x=>x.remove());document.querySelector('.performance-card').insertAdjacentHTML('beforeend',${JSON.stringify(performancePhoto(fixture))})`);
  await new Promise(r=>setTimeout(r,150));
  assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);
  await evaluate('document.querySelector(".performance-card").scrollIntoView({block:"center",behavior:"instant"})');
  await new Promise(r=>setTimeout(r,150));
  assert(await evaluate(`document.querySelector('.performance-photo img').naturalWidth===640`));
  await shot('cards-fixture-'+width);
  await evaluate(readFileSync('scripts/client/performance-photos.js','utf8'));
  await evaluate(`document.querySelector('.performance-photo img').src='/missing.webp'`);
  await new Promise(r=>setTimeout(r,100));
  assert(await evaluate(`document.querySelector('.performance-photo').hidden`));
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.performance-card')).gridTemplateColumns.split(' ').length`),2);
 }
 console.log(JSON.stringify({results,fixtureWidths:[1280,390,320],failedPhotoCollapsed:true,externalRequestsBlocked:blocked}));
}finally{ws?.close();chrome.kill();server.close();await new Promise(r=>setTimeout(r,200));rmSync(profile,{recursive:true,force:true});}
