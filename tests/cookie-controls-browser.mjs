// Offline real-Chromium keyboard/layout check. CMP is a stub; no real submissions.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {cookieControls} from '../scripts/lib/cookie-controls.mjs';
import {boundedCdp} from './helpers/bounded-cdp.mjs';
const css=readFileSync('scripts/style.css','utf8'),script=readFileSync('scripts/client/cookie-controls.js','utf8');
const html=`<!doctype html><html lang="ja"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body><main class="wrap"><h1>Cookie設定</h1>${cookieControls()}</main><script>window.calls=[];window.Cookiebot={hasResponse:false,consent:{necessary:true,preferences:false,statistics:false,marketing:false,method:null},submitCustomConsent(...args){calls.push(args);this.hasResponse=true;this.consent.method='explicit';window.dispatchEvent(new Event('CookiebotOnDecline'));}};</script><script>${script}</script></body></html>`;
const server=createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(html);});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const profile=mkdtempSync(join(tmpdir(),'cookie-ui-'));
const chrome=spawn(process.env.CHROMIUM_BIN||'/usr/bin/chromium',['--headless','--no-sandbox','--disable-gpu','--disable-background-networking','--no-first-run','--disable-sync','--disable-extensions','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
let ws;
try{
 const endpoint=await new Promise((resolve,reject)=>{let out='';const t=setTimeout(()=>reject(Error('startup timeout')),10000);chrome.stderr.on('data',d=>{out+=d;const m=out.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(t);resolve(m[1]);}});});
 const tabs=await(await fetch('http://127.0.0.1:'+new URL(endpoint).port+'/json/list')).json();ws=new WebSocket(tabs[0].webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 const transport=boundedCdp(x=>ws.send(x)),send=transport.send;let blocked=0;
 ws.onmessage=async e=>{const m=JSON.parse(e.data);if(m.id){transport.receive(m);return;}if(m.method==='Fetch.requestPaused'){const {requestId,request}=m.params;const local=new URL(request.url).origin===origin;if(!local)blocked++;await send(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId}:{requestId,errorReason:'BlockedByClient'});}};
 const evaluate=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true,timeout:3000})).result.value;
 await send('Page.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 const key=async(key,code,windowsVirtualKeyCode)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:key===' '?{text:' ',unmodifiedText:' '}:{})});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode});};
 const results=[];
 for(const [width,height,keyName,code,vk] of [[1280,900,'Enter','Enter',13],[390,844,' ','Space',32]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:origin+'/'});await new Promise(r=>setTimeout(r,300));
  await key('Tab','Tab',9);assert.equal(await evaluate('document.activeElement.id'),'cookie-reject-optional');
  const dimensions=await evaluate('(()=>{const b=document.activeElement,r=b.getBoundingClientRect();return {width:r.width,height:r.height,overflow:document.documentElement.scrollWidth>innerWidth,outline:getComputedStyle(b).outlineStyle};})()');assert(!dimensions.overflow);assert(dimensions.height>=44);assert.notEqual(dimensions.outline,'none');
  await key(keyName,code,vk);await key(keyName,code,vk);assert.deepEqual(await evaluate('calls'),[[false,false,false]],JSON.stringify(await evaluate('({status:document.querySelector("[role=status]").textContent,has:typeof Cookiebot,focused:document.activeElement.id})')));assert.match(await evaluate('document.querySelector("[role=status]").textContent'),/拒否する設定/);assert.equal(await evaluate('Cookiebot.consent.necessary'),true);
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(join(tmpdir(),'cookie-controls-'+width+'.png'),Buffer.from(shot.data,'base64'));
  results.push({viewportWidth:width,viewportHeight:height,key:keyName,calls:1,...dimensions});
 }
 console.log(JSON.stringify({results,blocked,realCmp:false,realConsentSubmissions:0}));
}finally{ws?.close();chrome.kill();server.close();await new Promise(r=>setTimeout(r,200));rmSync(profile,{recursive:true,force:true});}
