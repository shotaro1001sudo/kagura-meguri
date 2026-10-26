// Read-only local real-CMP probe. Never spoof the site's origin or change CMP configuration.
// Only public Cookiebot GET assets may leave the browser; ads/analytics and consent logging are blocked.
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {vcTag} from '../scripts/lib/valuecommerce.mjs';
import {cspFor} from '../scripts/lib/csp.mjs';
const cfg=JSON.parse(readFileSync('config.json','utf8'));
const controller=readFileSync('scripts/client/valuecommerce-consent.js','utf8');
const ads=vcTag({kind:'stay',destination:'https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=%8D%82%90%E7%95%E4%92%AC',text:'高千穂町の宿をじゃらんで探す'})+vcTag({kind:'activity',destination:'https://www.jalan.net/activity/450000/?fromPage=search-area',text:'宮崎県の体験をじゃらんで探す'})+vcTag({kind:'banner'});
let html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><script id="Cookiebot" src="https://consent.cookiebot.com/uc.js" data-cbid="${cfg.cookiebotId}" data-blockingmode="auto" type="text/javascript"></script><script>${controller}</script></head><body><main><p>広告・ローカル通信遮断検証</p>${ads}</main></body></html>`;
html=html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="'+cspFor(html,cfg)+'">');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://localhost:'+server.address().port,profile=mkdtempSync(join(tmpdir(),'vc-real-cmp-'));
const hosts=['consent.cookiebot.com','consentcdn.cookiebot.com','imgsct.cookiebot.com'];
// Honor the environment's existing outbound proxy; do not change/bypass its configuration.
const proxyHosts=[...new Set(['HTTPS_PROXY','HTTP_PROXY','https_proxy','http_proxy'].flatMap(k=>{try{return [new URL(process.env[k]).hostname]}catch{return []}}))];
const chrome=spawn(process.env.CHROMIUM_BIN||'/usr/bin/chromium',['--headless','--no-sandbox','--disable-gpu','--disable-background-networking','--disable-component-update','--disable-default-apps','--no-first-run','--disable-sync','--metrics-recording-only','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1, '+[...hosts,...proxyHosts].map(h=>'EXCLUDE '+h).join(', '),'--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
let ws;
try {
 const endpoint=await new Promise((resolve,reject)=>{let out='';const t=setTimeout(()=>reject(Error('Chromium startup timeout')),10000);chrome.stderr.on('data',d=>{out+=d;const m=out.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(t);resolve(m[1]);}});chrome.on('error',reject);});
 const pages=await(await fetch('http://127.0.0.1:'+new URL(endpoint).port+'/json/list')).json();ws=new WebSocket(pages[0].webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
 let id=0;const pending=new Map(),permitted=[],blocked=[],failures=[],logs=[],requests=new Map();
 const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});
 const brief=url=>{try{const u=new URL(url);return u.origin+u.pathname}catch{return url}};
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p?.reject(Error(JSON.stringify(m.error)));else p?.resolve(m.result);return;}
  if(m.method==='Fetch.requestPaused'){
   const {requestId,request}=m.params,u=new URL(request.url),local=u.origin===origin||u.hostname==='127.0.0.1';
   const asset=hosts.includes(u.hostname)&&u.protocol==='https:'&&request.method==='GET'&&!/logconsent|collect|\/log(?:\.|\/)/i.test(u.pathname);
   if(!local)(asset?permitted:blocked).push(brief(request.url));
   send(local||asset?'Fetch.continueRequest':'Fetch.failRequest',local||asset?{requestId}:{requestId,errorReason:'BlockedByClient'}).catch(()=>{});
  }
  if(m.method==='Network.requestWillBeSent')requests.set(m.params.requestId,brief(m.params.request.url));
  if(m.method==='Network.loadingFailed')failures.push({url:requests.get(m.params.requestId),error:m.params.errorText,blockedReason:m.params.blockedReason});
  if(m.method==='Runtime.consoleAPICalled')logs.push(m.params.args.map(a=>a.value||a.description||'').join(' ').slice(0,1000));
  if(m.method==='Log.entryAdded')logs.push(m.params.entry.text.slice(0,1000));
 };
 for(const method of ['Page.enable','Runtime.enable','Network.enable','Log.enable'])await send(method);
 await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const snap=()=>evaluate(`(()=>{let cmp;try{const c=window.Cookiebot;cmp=c?{apiAvailable:typeof c.hasResponse==='boolean'&&typeof c.consent?.marketing==='boolean',hasResponse:c.hasResponse,marketing:c.consent?.marketing,statistics:c.consent?.statistics,method:c.consent?.method}:null}catch(e){cmp={error:String(e)}}return {origin:location.origin,readyState:document.readyState,cmp,gate:window.kaguraVcConsent?.state,liveImages:document.querySelectorAll('[data-vc-ad] > a img').length,buttons:[...document.querySelectorAll('#CybotCookiebotDialog button,#CybotCookiebotDialog a[role=button]')].map(x=>({id:x.id,text:x.textContent.trim().slice(0,80)})),dialogText:document.querySelector('#CybotCookiebotDialog')?.textContent.trim().slice(0,1000)}})()`);
 await send('Page.navigate',{url:origin+'/'});
 await new Promise(r=>setTimeout(r,7000));
 const initial=await snap();
 console.log(JSON.stringify({initial,permittedPublicCmpRequests:permitted,blockedOtherRequests:blocked,failures,logs,actualExternalAdOrGaRequests:0,note:'No CMP API states overridden. No ad links clicked. Actual selection tests require a functional licensed local CMP.'},null,2));
} finally {ws?.close();chrome.kill('SIGTERM');server.close();await new Promise(r=>setTimeout(r,150));rmSync(profile,{recursive:true,force:true});}
