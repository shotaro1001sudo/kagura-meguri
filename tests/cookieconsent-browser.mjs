// Render actual generated pages offline. External requests are blocked before send.
// The popup below is a local mock, not proof of vendor UI/consent persistence.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep,extname} from 'node:path';
import {boundedCdp} from './helpers/bounded-cdp.mjs';
const root=resolve(process.env.COOKIE_QA_SITE_DIR||'dist');
const server=createServer((q,r)=>{let path;try{path=resolve(root,'.'+decodeURIComponent(new URL(q.url,'http://local').pathname));if(!path.startsWith(root+sep)&&path!==root)throw Error();if(path===root||q.url.endsWith('/'))path=join(path,'index.html');if(!existsSync(path))throw Error();r.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg'})[extname(path)]||'application/octet-stream');let content=readFileSync(path);if(extname(path)==='.html')content=Buffer.from(content.toString().replaceAll('data-ga4-host="kagurameguri.jp"','data-ga4-host="127.0.0.1"'));r.end(content);}catch{r.statusCode=404;r.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const profile=mkdtempSync(join(tmpdir(),'cookie-ui-'));
const chrome=spawn(process.env.CHROMIUM_BIN||'/usr/bin/chromium',['--headless','--no-sandbox','--disable-gpu','--disable-background-networking','--no-first-run','--disable-sync','--disable-extensions','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
let ws;
try{
 const endpoint=await new Promise((resolve,reject)=>{let out='';const t=setTimeout(()=>reject(Error('startup timeout')),10000);chrome.stderr.on('data',d=>{out+=d;const m=out.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(t);resolve(m[1]);}});});
 const tabs=await(await fetch('http://127.0.0.1:'+new URL(endpoint).port+'/json/list')).json();ws=new WebSocket(tabs[0].webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 const transport=boundedCdp(x=>ws.send(x)),send=transport.send;let blocked=0,loads=0,failAsset=false;const requests=[];
 ws.onmessage=async e=>{const m=JSON.parse(e.data);if(m.method==='Page.loadEventFired')loads++;if(m.id){transport.receive(m);return;}if(m.method==='Fetch.requestPaused'){const {requestId,request}=m.params;if(request.url.startsWith('https://www.googletagmanager.com/gtag/js')){requests.push(request.url);blocked++;await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/javascript'}],body:Buffer.from('window.__mockGoogle=true;').toString('base64')});return;}const local=new URL(request.url).origin===origin && !(failAsset && request.url.endsWith('/'+failAsset));requests.push(request.url);if(!local)blocked++;await send(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId}:{requestId,errorReason:'BlockedByClient'});}};
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,timeout:3000});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
 await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 const key=async(key,code,windowsVirtualKeyCode)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:key===' '?{text:' ',unmodifiedText:' '}:{})});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode});};
 const navigate=async(path='/events/hiroshima-asakita-kagura-2026-11-15.html')=>{const previous=loads;await send('Page.bringToFront');await send('Page.navigate',{url:origin+path});for(let i=0;i<250&&loads===previous;i++)await new Promise(r=>setTimeout(r,20));assert(loads>previous);};
 const settle=()=>new Promise(r=>setTimeout(r,250));
 const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(join(tmpdir(),name+'.png'),Buffer.from(r.data,'base64'));};
 const results=[];
 const waitFor=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,30));}throw Error('Timeout: '+expression);};
 const state=()=>evaluate(`({choice:window.kaguraConsent?.snapshot(),ga:!!window.kaguraGa4Allowed,gaTags:document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]').length,vc:document.querySelectorAll('[data-vc-ad]>a').length,signals:(window.dataLayer||[]).map(x=>Array.from(x)).filter(x=>x[0]==='consent'),overflow:document.documentElement.scrollWidth>innerWidth})`);
 const click=async text=>{const found=await evaluate(`(()=>{const b=[...document.querySelectorAll('#cc-main button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}&&b.getClientRects().length);if(!b)return false;b.click();return true;})()`);assert(found,'button '+text);await settle();};
 for(const width of [1280,390]) {
  await send('Network.clearBrowserCookies');await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:false});
  await navigate('/experiences.html');await waitFor('!!window.kaguraConsent && !!document.querySelector("#cc-main .cm")');await settle();
  let x=await state();assert.equal(x.gaTags,0);assert.equal(x.vc,0);assert.equal(x.overflow,false);assert.equal(x.signals[0][1],'default');for(const v of Object.values(x.signals[0][2]))assert.equal(v,'denied');
  await shot('cookieconsent-first-'+width);
  // Reject with keyboard and confirm focus can reach the real vendor control.
  await evaluate(`(()=>{const b=[...document.querySelectorAll('#cc-main button')].find(b=>b.textContent==='任意Cookieを拒否');b.focus();})()`);await key('Enter','Enter',13);await settle();
  x=await state();assert.equal(x.gaTags,0);assert.equal(x.vc,0);assert.equal(x.choice.statistics,false);
  await navigate('/experiences.html');await waitFor('window.kaguraConsent?.snapshot().ready');assert.equal((await state()).gaTags,0);
  // Reopen via footer keyboard; opening alone cannot grant permission.
  await evaluate('document.getElementById("cookie-settings-open").focus()');await key('Enter','Enter',13);await waitFor('document.documentElement.classList.contains("show--preferences")');await new Promise(r=>setTimeout(r,400));
  assert.equal((await state()).gaTags,0);
  await shot('cookieconsent-settings-'+width);
  assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);
  // Focus stays inside preferences when tabbing, including at the end.
  for(let i=0;i<20;i++){await key('Tab','Tab',9);assert.equal(await evaluate('!!document.activeElement.closest("#cc-main")'),true);}
  // Real granular controls: analytics only.
  await evaluate(`document.querySelector('#cc-main input[value="analytics"]').click()`);
  await click('選択を保存');await waitFor(`document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]').length===1`);
  x=await state();assert.equal(x.choice.statistics,true);assert.equal(x.choice.marketing,false);assert.equal(x.vc,0);assert.equal(x.signals.at(-1)[2].ad_storage,'denied');
  await navigate('/experiences.html');await waitFor(`document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]').length===1`);
  await evaluate('window.dispatchEvent(new Event("kagura:consent"));window.dispatchEvent(new Event("kagura:consent"))');assert.equal((await state()).gaTags,1);
  // Revocation reloads after consent is persisted; no analytics tag on the new page.
  const before=loads;await evaluate('window.kaguraConsent.open()');await click('任意Cookieを拒否');await waitFor('!!window.kaguraConsent');await settle();assert(loads>before);x=await state();assert.equal(x.gaTags,0);assert.equal(x.vc,0);
  await evaluate('window.kaguraConsent.open()');await evaluate(`document.querySelector('#cc-main input[value="marketing"]').click()`);await click('選択を保存');
  x=await state();assert.equal(x.choice.marketing,true);assert.equal(x.choice.statistics,false);assert(x.vc>0);assert.equal(x.gaTags,0);
  const original=await evaluate('window.__original=document.querySelector("[data-vc-ad]>a");true');
  await evaluate('window.dispatchEvent(new Event("kagura:consent"))');assert.equal(await evaluate('window.__original===document.querySelector("[data-vc-ad]>a")'),true);
  await navigate('/experiences.html');await waitFor('window.kaguraConsent?.snapshot().marketing');assert((await state()).vc>0);assert.equal((await state()).gaTags,0);
  await evaluate('window.kaguraConsent.open()');await click('すべて許可');await waitFor(`document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]').length===1`);
  // Asset failure despite a saved grant must not enable either integration.
  for(const asset of ['cookieconsent.umd.js','cookieconsent.css','consent-manager.js']){failAsset=asset;await navigate('/experiences.html');await settle();x=await state();assert.equal(x.gaTags,0,asset);assert.equal(x.vc,0,asset);}failAsset=false;
  results.push({width,firstVisit:true,reject:true,statisticsOnly:true,marketingOnly:true,persistence:true,revokeReload:true,keyboard:true,assetFailureClosed:true});
 }
 assert(!requests.some(u=>/gc\.zgo\.at|adsbygoogle\.js|consent\.cookiebot/.test(u)));
 console.log(JSON.stringify({results,externalRequestsBlocked:blocked,externalContinued:0,realLocalCMP:true}));
}finally{ws?.close();chrome.kill();server.close();await new Promise(r=>setTimeout(r,200));rmSync(profile,{recursive:true,force:true});}
