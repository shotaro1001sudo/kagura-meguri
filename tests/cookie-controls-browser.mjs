// Render actual generated pages offline. External requests are blocked before send.
// The popup below is a local mock, not proof of vendor UI/consent persistence.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep,extname} from 'node:path';
import {boundedCdp} from './helpers/bounded-cdp.mjs';
const root=resolve(process.env.COOKIE_QA_SITE_DIR||'dist'),baseline=process.env.COOKIE_QA_BASELINE==='1';
const server=createServer((q,r)=>{let path;try{path=resolve(root,'.'+decodeURIComponent(new URL(q.url,'http://local').pathname));if(!path.startsWith(root+sep)&&path!==root)throw Error();if(path===root||q.url.endsWith('/'))path=join(path,'index.html');if(!existsSync(path))throw Error();r.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg'})[extname(path)]||'application/octet-stream');r.end(readFileSync(path));}catch{r.statusCode=404;r.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const profile=mkdtempSync(join(tmpdir(),'cookie-ui-'));
const chrome=spawn(process.env.CHROMIUM_BIN||'/usr/bin/chromium',['--headless','--no-sandbox','--disable-gpu','--disable-background-networking','--no-first-run','--disable-sync','--disable-extensions','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
let ws;
try{
 const endpoint=await new Promise((resolve,reject)=>{let out='';const t=setTimeout(()=>reject(Error('startup timeout')),10000);chrome.stderr.on('data',d=>{out+=d;const m=out.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(t);resolve(m[1]);}});});
 const tabs=await(await fetch('http://127.0.0.1:'+new URL(endpoint).port+'/json/list')).json();ws=new WebSocket(tabs[0].webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 const transport=boundedCdp(x=>ws.send(x)),send=transport.send;let blocked=0,loads=0;
 ws.onmessage=async e=>{const m=JSON.parse(e.data);if(m.method==='Page.loadEventFired')loads++;if(m.id){transport.receive(m);return;}if(m.method==='Fetch.requestPaused'){const {requestId,request}=m.params;const local=new URL(request.url).origin===origin;if(!local)blocked++;await send(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId}:{requestId,errorReason:'BlockedByClient'});}};
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,timeout:3000});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
 await send('Page.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 const key=async(key,code,windowsVirtualKeyCode)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:key===' '?{text:' ',unmodifiedText:' '}:{})});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode});};
 const navigate=async()=>{const previous=loads;await send('Page.bringToFront');await send('Page.navigate',{url:origin+'/'});for(let i=0;i<250&&loads===previous;i++)await new Promise(r=>setTimeout(r,20));assert(loads>previous);};
 const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(join(tmpdir(),name+'.png'),Buffer.from(r.data,'base64'));};
 const results=[];
 for(const [width,height] of [[1280,900],[390,844],[320,640]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await navigate();await shot('cookie-home-'+(baseline?'before':'after')+'-'+width);
  if(baseline)continue;
  assert.equal(await evaluate('document.querySelectorAll("#cookie-settings-open").length'),1);assert.equal(await evaluate('document.querySelectorAll("#cookie-reject-optional").length'),0);
  assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);
  // Native Tab reaches the sole footer entry from its preceding navigation element.
  await evaluate("(()=>{const f=document.querySelector('footer'),links=f.querySelectorAll('a');links[links.length-1].focus();})()");await key('Tab','Tab',9);assert.equal(await evaluate('document.activeElement.id'),'cookie-settings-open');
  await evaluate("document.activeElement.scrollIntoView({block:'center',behavior:'instant'})");
  const geometry=await evaluate("(()=>{const b=document.activeElement,r=b.getBoundingClientRect();return {height:r.height,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b,outline:getComputedStyle(b).outlineStyle};})()");assert(geometry.height>=44&&geometry.hit&&geometry.outline!=='none');
  // No CMP: honest failure, no invented consent confirmation.
  await key('Enter','Enter',13);assert.match(await evaluate('document.querySelector("#cookie-settings-status").textContent'),/開けません/);
  await evaluate(`(()=>{window.calls=0;window.submissions=0;const popup=document.createElement('div');popup.id='CybotCookiebotDialog';popup.setAttribute('role','dialog');popup.style.cssText='display:none;position:fixed;left:18px;bottom:18px;width:min(374px,calc(100vw - 36px));height:258px;background:#fff;border:1px solid #444;z-index:2147483647;padding:12px;box-sizing:border-box';popup.innerHTML='<p>ローカル模擬ポップアップ</p><button type="button">拒否</button><button type="button">カスタム化</button><button type="button">全て許可</button>';document.body.append(popup);window.Cookiebot={hasResponse:false,consent:{necessary:true,preferences:false,statistics:false,marketing:false,method:null},renew(){calls++;popup.style.display='block';window.dispatchEvent(new Event('CookiebotOnDialogDisplay'));},submitCustomConsent(){submissions++;}};})()`);
  await key(width===1280?'Enter':' ',width===1280?'Enter':'Space',width===1280?13:32);await key('Enter','Enter',13);assert.equal(await evaluate('calls'),1);assert.equal(await evaluate('submissions'),0);assert.match(await evaluate('document.querySelector("#cookie-settings-status").textContent'),/ポップアップ/);
  // When the vendor popup covers the entry, native choices remain the active route.
  assert.equal(await evaluate("(()=>{const b=document.querySelector('#CybotCookiebotDialog button'),r=b.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b;})()"),true);
  await shot('cookie-settings-popup-'+width);
  // Test-only closing models vendor dismissal; opening again changes no consent.
  await evaluate("document.getElementById('CybotCookiebotDialog').style.display='none'");await new Promise(r=>setTimeout(r,1100));await key('Enter','Enter',13);assert.equal(await evaluate('calls'),2);assert.equal(await evaluate('Cookiebot.hasResponse'),false);assert.equal(await evaluate('submissions'),0);
  results.push({viewportWidth:width,viewportHeight:height,...geometry,keyboard:true,renewCalls:2,consentSubmissions:0,popupMock:true});
 }
 console.log(JSON.stringify({baseline,results,externalRequestsBlocked:blocked,externalContinued:0,realCmp:false}));
}finally{ws?.close();chrome.kill();server.close();await new Promise(r=>setTimeout(r,200));rmSync(profile,{recursive:true,force:true});}
