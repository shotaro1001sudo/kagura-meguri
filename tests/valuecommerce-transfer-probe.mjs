// Dependency-free isolated CDP probe. Default is guard preflight ONLY.
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {vcTag} from '../scripts/lib/valuecommerce.mjs';
import {cspFor} from '../scripts/lib/csp.mjs';
const chromePath=process.env.CHROMIUM_BIN;
if(!chromePath)throw Error('Set CHROMIUM_BIN to an existing Chrome/Chromium executable; do not install.');
const cfg=JSON.parse(readFileSync('config.json','utf8'));
const controller=readFileSync('scripts/client/valuecommerce-consent.js','utf8');
const ads=vcTag({kind:'stay',destination:'https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=%8D%82%90%E7%95%E4%92%AC',text:'高千穂町の宿をじゃらんで探す'})+vcTag({kind:'activity',destination:'https://www.jalan.net/activity/450000/?fromPage=search-area',text:'宮崎県の体験をじゃらんで探す'})+vcTag({kind:'banner'});
let html=`<!doctype html><html><head><meta charset="utf-8"><script id="Cookiebot" src="https://consent.cookiebot.com/uc.js" data-cbid="${cfg.cookiebotId}" data-blockingmode="auto"></script><script>${controller}</script></head><body><p>広告・通信遮断検証（ローカルのみ）</p>${ads}</body></html>`;
if(process.env.VC_FIXTURE==='generated')html=readFileSync('tests/fixtures/vc-generated-event.html','utf8');
else html=html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="'+cspFor(html,cfg)+'">');
let live=false;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/worker.js'?'text/javascript':'text/html; charset=utf-8');res.end(req.url==='/worker.js'?"fetch('https://guard.invalid/worker').catch(()=>{});":req.url==='/cmp'&&live?html:'<!doctype html><title>Guard preflight</title>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const profile=mkdtempSync(join(tmpdir(),'vc-guard-'));
const chrome=spawn(chromePath,['--headless','--disable-gpu','--disable-background-networking','--disable-component-update','--disable-default-apps','--no-first-run','--disable-sync','--disable-extensions',...(process.platform==='linux'?['--no-sandbox']:[]),'--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
let ws;let fatal=null;const evidence={targets:[],blocked:[],continued:[],states:[],responses:[],failures:[],consoleErrors:[],cmpEvents:[]};
const safeUrl=value=>{try{const u=new URL(value);return u.origin+u.pathname.replace(/[a-f0-9]{8}-[a-f0-9-]{27,}/gi,'[id]');}catch{return '[non-url]'}};
const safeText=value=>String(value).replace(/https?:\/\/[^\s"'<>]+/g,safeUrl).slice(0,800);
try {
 const endpoint=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Chrome startup timeout')),10000);let s='';chrome.stderr.on('data',b=>{s+=b;const m=s.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(t);resolve(m[1]);}});chrome.on('error',reject);});
 ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let id=0;const pending=new Map(),guards=new Map(),waiters=new Map(),workerRequests=new Map();
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
 const auto={autoAttach:true,waitForDebuggerOnStart:true,flatten:true};
 ws.onmessage=async e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(JSON.stringify(m.error))):p?.resolve(m.result);return;}
  try {
   if(m.method==='Target.attachedToTarget'){
    const sid=m.params.sessionId,t=m.params.targetInfo;
    await send('Runtime.enable',{},sid);
    await send('Network.enable',{},sid);
    // Pause every new target until request interception and recursive auto-attach are active.
    if(['worker','service_worker','shared_worker'].includes(t.type)){
     await send('Network.enable',{},sid);
     await send('Network.setBlockedURLs',{urls:['*']},sid);
    }else{
     await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},sid);
     await send('Target.setAutoAttach',auto,sid);
     await send('Log.enable',{},sid);
     await send('Runtime.addBinding',{name:'vcProbeEvent'},sid);
     await send('Page.addScriptToEvaluateOnNewDocument',{source:`for(const name of ['CookiebotOnConsentReady','CookiebotOnLoad','CookiebotOnAccept','CookiebotOnDecline','CookiebotOnDialogInit','CookiebotOnDialogDisplay','CookiebotOnTagsExecuted'])window.addEventListener(name,()=>{const c=window.Cookiebot;window.vcProbeEvent(JSON.stringify({event:name,hasResponse:c?.hasResponse,marketing:c?.consent?.marketing,method:c?.consent?.method}));});`},sid);
    }
    guards.set(t.targetId,sid);evidence.targets.push({id:t.targetId,type:t.type,guardInstalled:true});
    await send('Runtime.runIfWaitingForDebugger',{},sid);waiters.get(t.targetId)?.(sid);
   }
   if(m.method==='Runtime.bindingCalled'&&m.params.name==='vcProbeEvent'){try{evidence.cmpEvents.push({targetSession:m.sessionId,...JSON.parse(m.params.payload)});}catch{}}
   if(m.method==='Runtime.consoleAPICalled'&&['error','warning'].includes(m.params.type))evidence.consoleErrors.push({type:m.params.type,text:safeText(m.params.args.map(x=>x.value??x.description??'').join(' '))});
   if(m.method==='Runtime.exceptionThrown')evidence.consoleErrors.push({type:'exception',text:safeText(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)});
   if(m.method==='Log.entryAdded'&&['error','warning'].includes(m.params.entry.level))evidence.consoleErrors.push({type:m.params.entry.level,text:safeText(m.params.entry.text)});
   if(m.method==='Network.responseReceived')evidence.responses.push({url:safeUrl(m.params.response.url),status:m.params.response.status,mime:m.params.response.mimeType,fromDiskCache:m.params.response.fromDiskCache===true});
   if(m.method==='Network.loadingFailed')evidence.failures.push({url:safeUrl(workerRequests.get(m.sessionId+':'+m.params.requestId)),error:m.params.errorText,blockedReason:m.params.blockedReason});
   if(m.method==='Network.requestWillBeSent')workerRequests.set(m.sessionId+':'+m.params.requestId,m.params.request.url);
   if(m.method==='Network.loadingFailed'&&m.params.blockedReason){const url=workerRequests.get(m.sessionId+':'+m.params.requestId);if(url){const u=new URL(url);evidence.blocked.push({targetSession:m.sessionId,host:u.hostname,path:u.pathname,guard:'Network.setBlockedURLs',blockedReason:m.params.blockedReason});}}
   if(m.method==='Fetch.requestPaused'){
    const {requestId,request}=m.params,u=new URL(request.url);
    const local=u.origin===origin;
    const cmp=live&&request.method==='GET'&&u.protocol==='https:'&&['consent.cookiebot.com','consentcdn.cookiebot.com','imgsct.cookiebot.com'].includes(u.hostname)&&!/logconsent|collect|\/log(?:\.|\/)/i.test(u.pathname);
    const entry={targetSession:m.sessionId,host:u.hostname,path:new URL(safeUrl(request.url)).pathname,method:request.method};
    (local||cmp?evidence.continued:evidence.blocked).push(entry);
    await send(local||cmp?'Fetch.continueRequest':'Fetch.failRequest',local||cmp?{requestId}:{requestId,errorReason:'BlockedByClient'},m.sessionId);
   }
  }catch(e){fatal=String(e);/* A failed guard leaves the new target paused. */}
 };
 await send('Target.setDiscoverTargets',{discover:true});await send('Target.setAutoAttach',auto);
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});
 const session=await Promise.race([guards.has(targetId)?Promise.resolve(guards.get(targetId)):new Promise(r=>waiters.set(targetId,r)),new Promise((_,j)=>setTimeout(()=>j(Error('Guard attach timeout')),10000))]);
 const evaluate=async expression=>{if(fatal)throw Error(fatal);const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},session);if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 await send('Page.navigate',{url:origin+'/'},session);await new Promise(r=>setTimeout(r,500));
 await evaluate(`(()=>{for(const [tag,attr,path] of [['img','src','image'],['script','src','script'],['iframe','src','frame']]){const e=document.createElement(tag);e[attr]='https://guard.invalid/'+path;document.body.appendChild(e)}fetch('https://guard.invalid/fetch').catch(()=>{});new Worker('/worker.js');})()`);
 const popup=await send('Target.createTarget',{url:'about:blank'});
 const popupSession=await Promise.race([guards.has(popup.targetId)?Promise.resolve(guards.get(popup.targetId)):new Promise(r=>waiters.set(popup.targetId,r)),new Promise((_,j)=>setTimeout(()=>j(Error('Popup guard timeout')),10000))]);
 await send('Page.navigate',{url:'https://guard.invalid/popup'},popupSession);
 await new Promise(r=>setTimeout(r,1500));
 const expected=['/image','/script','/frame','/fetch','/worker','/popup'];
 evidence.preflight={expected,allBlocked:expected.every(p=>evidence.blocked.some(x=>x.host==='guard.invalid'&&x.path===p)),noExternalContinued:evidence.continued.every(x=>x.host==='127.0.0.1'),fatal};
 if(fatal||!evidence.preflight.allBlocked||!evidence.preflight.noExternalContinued)throw Error('Preflight failed; real CMP/advertising fixture NOT enabled.');
 if(process.env.VC_REAL_CMP==='1'){
  live=true;await send('Page.navigate',{url:origin+'/cmp'},session);await new Promise(r=>setTimeout(r,7000));
  const snapshot=async label=>{const state=await evaluate(`(()=>{const c=window.Cookiebot,d=document.querySelector('#CybotCookiebotDialog');const visible=e=>!!(e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');return {hasResponse:c?.hasResponse,marketing:c?.consent?.marketing,method:c?.consent?.method,gate:window.kaguraVcConsent?.state,images:document.querySelectorAll('[data-vc-ad]>a img').length,dialogVisible:visible(d),dialogText:d?.textContent.slice(0,800),controls:[...document.querySelectorAll('#CybotCookiebotDialog button,#CookiebotWidget button')].filter(visible).map(e=>({id:e.id,text:e.textContent.trim().slice(0,100)}))}})()`);evidence.states.push({label,...state,blockedRequests:evidence.blocked.length,vcRequests:evidence.blocked.filter(x=>x.host.endsWith('.valuecommerce.com')).length});return state;};
  const initial=await snapshot('initial');
  if(process.env.VC_UI_SEQUENCE==='1'){
   const click=async selectors=>{const pos=await evaluate(`(()=>{for(const selector of ${JSON.stringify(selectors)}){const e=document.querySelector(selector);if(e&&!e.disabled&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'){const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,id:e.id};}}return null})()`);if(!pos)throw Error('Required real CMP UI control absent: '+selectors.join(','));await send('Input.dispatchMouseEvent',{type:'mousePressed',x:pos.x,y:pos.y,button:'left',clickCount:1},session);await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:pos.x,y:pos.y,button:'left',clickCount:1},session);await new Promise(r=>setTimeout(r,1200));};
   const deny=['#CybotCookiebotDialogBodyButtonDecline'];
   const allow=['#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll','#CybotCookiebotDialogBodyButtonAccept'];
   const reopen=async()=>{await click(['#CookiebotWidget-button']);await click(['#CookiebotWidget-btn-change']);};
   if(!initial.dialogVisible||initial.hasResponse!==false||initial.gate!=='unselected')throw Error('Real unselected dialog not ready; UI sequence NOT started.');
   await click(deny);let state=await snapshot('reject');if(state.hasResponse!==true||state.marketing!==false||state.images!==0)throw Error('Real rejection not established.');
   const beforeReload=evidence.blocked.filter(x=>x.host.endsWith('.valuecommerce.com')).length;
   await send('Page.reload',{ignoreCache:true},session);await new Promise(r=>setTimeout(r,5000));state=await snapshot('reload-rejection');if(state.hasResponse!==true||state.marketing!==false||state.images!==0||evidence.blocked.filter(x=>x.host.endsWith('.valuecommerce.com')).length!==beforeReload)throw Error('Saved rejection not established; consent logging remains blocked.');
   await reopen();await click(allow);state=await snapshot('allow');if(state.hasResponse!==true||state.marketing!==true||state.method!=='explicit'||state.gate!=='allowed'||state.images===0)throw Error('Explicit allowance not established.');
   await reopen();await click(deny);state=await snapshot('revoke');if(state.marketing!==false||state.images!==0)throw Error('Revocation not established.');
  }
 }
 evidence.scope='Default preflight; VC_REAL_CMP=1 captures actual initial CMP diagnostics; VC_UI_SEQUENCE=1 attempts bounded real UI sequence, stopping on absent controls/state failure. No Cookiebot properties are overridden.';
 if(fatal)throw Error(fatal);
} catch(e){evidence.error=String(e);process.exitCode=1;}
finally{console.log(JSON.stringify(evidence,null,2));ws?.close();chrome.kill();server.close();await new Promise(r=>setTimeout(r,300));try{rmSync(profile,{recursive:true,force:true});}catch{console.error('Temporary isolated Chrome profile cleanup pending; do not upload it.');}}
