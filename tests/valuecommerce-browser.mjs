// Optional local Chromium check. All non-loopback requests are intercepted and failed.
// CMP states are controlled stubs: this does NOT verify Cookiebot's real auto classification.
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {vcTag} from '../scripts/lib/valuecommerce.mjs';
const controller=readFileSync('scripts/client/valuecommerce-consent.js','utf8');
const states={unselected:{hasResponse:false,consent:{marketing:false,method:null}},denied:{hasResponse:true,consent:{marketing:false,method:'explicit'}},allowed:{hasResponse:true,consent:{marketing:true,method:'explicit'}},oldDenied:{hasResponse:true,consent:{marketing:false}},oldUnknown:{hasResponse:true,consent:{marketing:true}},missing:null};
const ads=vcTag({kind:'stay',destination:'https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=%8D%82%90%E7%95%E4%92%AC',text:'高千穂町の宿をじゃらんで探す'})+vcTag({kind:'activity',destination:'https://www.jalan.net/activity/450000/?fromPage=search-area',text:'宮崎県の体験をじゃらんで探す'})+vcTag({kind:'banner'});
const server=createServer((req,res)=>{const url=new URL(req.url,'http://localhost');const mode=url.searchParams.get('mode')||'unselected';res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="ja"><head>${mode==='strict'?'<meta http-equiv="Content-Security-Policy" content="img-src \'self\'">':''}<base href="https://kagurameguri.jp/"><script>window.Cookiebot=${JSON.stringify(Object.hasOwn(states,mode)?states[mode]:states.unselected)};</script>${mode==='noScript'?'':`<script>${controller}</script>`}</head><body><main><p>広告</p>${ads}<a href="https://example.invalid/official">公式情報（クリックしない）</a></main></body></html>`);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,profile=mkdtempSync(join(tmpdir(),'vc-browser-'));
const chrome=spawn(process.env.CHROMIUM_BIN||'/usr/bin/chromium',['--headless','--no-sandbox','--disable-gpu','--disable-background-networking','--disable-component-update','--disable-default-apps','--no-first-run','--disable-sync','--metrics-recording-only','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
let ws;const results=[];
try {
 const endpoint=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('Chromium startup timeout')),10000);chrome.stderr.on('data',d=>{out+=d;const m=out.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timer);resolve(m[1]);}});chrome.on('error',reject);});
 const pages=await(await fetch('http://127.0.0.1:'+new URL(endpoint).port+'/json/list')).json();
 ws=new WebSocket(pages[0].webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
 let id=0;const pending=new Map(),blocked=[];let cspFailures=0,loads=0;
 const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p?.reject(Error(JSON.stringify(m.error)));else p?.resolve(m.result);return;}
  if(m.method==='Fetch.requestPaused'){const {requestId,request}=m.params;const local=request.url.startsWith(origin);if(!local)blocked.push(request.url);send(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId}:{requestId,errorReason:'BlockedByClient'}).catch(()=>{});}
  if(m.method==='Page.loadEventFired')loads++;
  if(m.method==='Network.loadingFailed'&&m.params.blockedReason==='csp')cspFailures++;
 };
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const settle=()=>evaluate('new Promise(r=>setTimeout(r,80))');
 const counts=()=>evaluate('({images:document.querySelectorAll("[data-vc-ad] > a img").length,state:window.kaguraVcConsent?.state})');
 const ready=()=>evaluate('window.dispatchEvent(new Event("CookiebotOnConsentReady"))');
 const hits=()=>blocked.filter(u=>u.startsWith('https://ad.jp.ap.valuecommerce.com/servlet/gifbanner?')).length;
 async function navigate(mode){await send('Page.navigate',{url:origin+'/?mode='+mode});for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,10));if(await evaluate('document.readyState')==='complete')return;}throw Error('page load timeout');}
 for(const mode of ['denied','oldDenied','oldUnknown','missing','noScript','unselected','allowed']) {
  const start=hits();await navigate(mode);assert.equal(hits(),start);assert.equal((await counts()).images,0);
  await ready();await settle();const expected=['unselected','allowed'].includes(mode)?3:0;
  assert.equal((await counts()).images,expected);assert.equal(hits()-start,expected);
  await ready();await evaluate('window.dispatchEvent(new Event("CookiebotOnAccept"));window.dispatchEvent(new Event("pageshow"))');await settle();assert.equal(hits()-start,expected);
  results.push({mode,blockedAdRequests:expected,liveImages:expected});
 }
 for(const mode of ['unselected','denied','allowed']) {
  await navigate(mode);await ready();await settle();const start=hits(),previousLoads=loads;
  await send('Page.reload');for(let i=0;i<100&&loads===previousLoads;i++)await new Promise(r=>setTimeout(r,10));assert(loads>previousLoads);
  assert.equal(hits(),start);await ready();await settle();const expected=mode==='denied'?0:3;assert.equal(hits()-start,expected);
  results.push({reload:mode,blockedAdRequests:expected});
 }
 const before=hits();
 await evaluate('window.Cookiebot.consent.marketing=false;window.dispatchEvent(new Event("CookiebotOnDecline"))');assert.equal((await counts()).images,0);
 await evaluate('window.Cookiebot.consent.marketing=true;window.dispatchEvent(new Event("CookiebotOnAccept"))');await settle();assert.equal((await counts()).images,3);assert.equal(hits(),before);
 await evaluate('window.dispatchEvent(new Event("pagehide"));window.dispatchEvent(new Event("pageshow"))');assert.equal((await counts()).images,0);assert.equal((await counts()).state,'unknown');
 await ready();await settle();assert.equal((await counts()).images,3);assert.equal(hits(),before);
 await evaluate('Object.defineProperty(window,"Cookiebot",{get(){throw Error("unreadable")}});window.dispatchEvent(new Event("CookiebotOnConsentReady"))');assert.equal((await counts()).images,0);assert.equal(hits(),before);
 results.push({withdrawReallowAndBack:'same image nodes; no new intercepted requests',unreadable:'removed'});
 const start=hits();await navigate('strict');await ready();await settle();assert.equal(hits(),start);assert(cspFailures>=3);results.push({strictCsp:'blocked all 3 images; policy not expanded'});
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await navigate('unselected');await ready();await settle();assert.equal((await counts()).images,3);
 results.push({mobileViewport:'390x844, 3 original tags after ready',actualExternalAdRequests:0,realCookiebotAutoClassification:'NOT TESTED (CMP stub)'});
 console.log(JSON.stringify(results,null,2));
} finally {ws?.close();chrome.kill('SIGTERM');server.close();await new Promise(r=>setTimeout(r,150));rmSync(profile,{recursive:true,force:true});}
