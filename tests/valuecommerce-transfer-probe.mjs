import {createCmpRequestPolicy} from './helpers/cmp-request-policy.mjs';
import {cookieMetadata} from './helpers/cookie-metadata.mjs';
import {summarizeSdkPhase,assertSdkPhase} from './helpers/vc-sdk-assertions.mjs';
import {boundedCdp} from './helpers/bounded-cdp.mjs';
// Dependency-free isolated CDP probe. Default is guard preflight ONLY.
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {vcTag} from '../scripts/lib/valuecommerce.mjs';
import {cspFor} from '../scripts/lib/csp.mjs';
if(process.env.VC_SDK_SEQUENCE==='1'&&(process.env.VC_UI_SEQUENCE==='1'||process.env.VC_MOCK_UI==='1'||process.env.VC_REAL_CMP!=='1'))throw Error('SDK verification requires real CMP and excludes UI/mock modes');
const consentLogOptIn=process.env.VC_ALLOW_CONSENT_LOG==='1';
if(consentLogOptIn&&(process.env.VC_REAL_CMP!=='1'||process.env.VC_SDK_SEQUENCE!=='1'))throw Error('Consent-log opt-in requires isolated real CMP SDK verification');
const cmpRequestPolicy=createCmpRequestPolicy({enabled:consentLogOptIn});
const mockUi=process.env.VC_MOCK_UI==='1';
if(mockUi&&process.env.VC_REAL_CMP==='1')throw Error('Choose mock UI or real CMP, not both.');
const chromePath=process.env.CHROMIUM_BIN;
if(!chromePath)throw Error('Set CHROMIUM_BIN to an existing Chrome/Chromium executable; do not install.');
const cfg=JSON.parse(readFileSync('config.json','utf8'));
const readiness=readFileSync('scripts/client/valuecommerce-ready.js','utf8');
const controller=readFileSync('scripts/client/valuecommerce-consent.js','utf8');
const ads=vcTag({kind:'stay',destination:'https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=%8D%82%90%E7%95%E4%92%AC',text:'高千穂町の宿をじゃらんで探す'})+vcTag({kind:'activity',destination:'https://www.jalan.net/activity/450000/?fromPage=search-area',text:'宮崎県の体験をじゃらんで探す'})+vcTag({kind:'banner'});
let html=`<!doctype html><html><head><meta charset="utf-8"><script>${readiness}</script><script id="Cookiebot" src="https://consent.cookiebot.com/uc.js" data-cbid="${cfg.cookiebotId}" data-blockingmode="auto"></script><script>${controller}</script></head><body><p>広告・通信遮断検証（ローカルのみ）</p>${ads}</body></html>`;
if(process.env.VC_FIXTURE==='generated')html=readFileSync('tests/fixtures/vc-generated-event.html','utf8');
else html=html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="'+cspFor(html,cfg)+'">');
if(mockUi)html='<!doctype html><style>body{margin:0;height:2000px}#CybotCookiebotDialog{position:fixed;top:950px;left:20px;width:500px;background:white}</style><div id="CybotCookiebotDialog"><button id="CybotCookiebotDialogBodyContentTextToggle" onclick="this.dataset.clicked=String(Number(this.dataset.clicked||0)+1)">もっと見る</button></div>';
let live=false;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/worker.js'?'text/javascript':'text/html; charset=utf-8');res.end(req.url==='/worker.js'?"fetch('https://guard.invalid/worker').catch(()=>{});":req.url==='/cmp'&&live?html:'<!doctype html><title>Guard preflight</title>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const profile=mkdtempSync(join(tmpdir(),'vc-guard-'));
const chrome=spawn(chromePath,['--headless','--window-size=1280,1400','--force-device-scale-factor=1','--disable-gpu','--disable-background-networking','--disable-component-update','--disable-default-apps','--no-first-run','--disable-sync','--disable-extensions',...(process.platform==='linux'?['--no-sandbox']:[]),'--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
let ws;let fatal=null;const evidence={consentLogScope:{explicitOptIn:consentLogOptIn,maximumRequests:4,endpoint:'https://consent.cookiebot.com/logconsent.ashx',method:'GET',redirectsAllowed:false},targets:[],blocked:[],continued:[],states:[],responses:[],failures:[],consoleErrors:[],cmpEvents:[]};
const checkpoint=operation=>{evidence.operations??=[];evidence.operations.push(operation);writeFileSync(process.env.VC_EVIDENCE_FILE||'vc-probe-checkpoint.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify({checkpoint:operation}));};
const safeUrl=value=>{try{const u=new URL(value);return u.origin+u.pathname.replace(/[a-f0-9]{8}-[a-f0-9-]{27,}/gi,'[id]');}catch{return '[non-url]'}};
const safeText=value=>String(value).replace(/https?:\/\/[^\s"'<>]+/g,safeUrl).slice(0,800);
try {
 const endpoint=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Chrome startup timeout')),10000);let s='';chrome.stderr.on('data',b=>{s+=b;const m=s.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(t);resolve(m[1]);}});chrome.on('error',reject);});
 ws=new WebSocket(endpoint);await new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('WebSocket open timeout')),8000);ws.onopen=()=>{clearTimeout(timer);r();};ws.onerror=e=>{clearTimeout(timer);j(e);};});
 const guards=new Map(),waiters=new Map(),workerRequests=new Map();
 const transport=boundedCdp(value=>ws.send(value),{checkpoint}),send=transport.send;
 ws.onclose=()=>transport.close();
 const auto={autoAttach:true,waitForDebuggerOnStart:true,flatten:true};
 ws.onmessage=async e=>{const m=JSON.parse(e.data);if(m.id){transport.receive(m);return;}
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
     await send('Audits.enable',{},sid);
     await send('Runtime.addBinding',{name:'vcProbeEvent'},sid);
     await send('Page.enable',{},sid);
     await send('Page.addScriptToEvaluateOnNewDocument',{source:readFileSync('tests/fixtures/vc-observe.js','utf8'),runImmediately:true},sid);
    }
    guards.set(t.targetId,sid);evidence.targets.push({id:t.targetId,type:t.type,guardInstalled:true});
    await send('Runtime.runIfWaitingForDebugger',{},sid);waiters.get(t.targetId)?.(sid);
   }
   if(m.method==='Runtime.bindingCalled'&&m.params.name==='vcProbeEvent'){try{evidence.cmpEvents.push({targetSession:m.sessionId,executionContextId:m.params.executionContextId,...JSON.parse(m.params.payload)});}catch{}}
   if(m.method==='Runtime.consoleAPICalled'&&['error','warning'].includes(m.params.type))evidence.consoleErrors.push({type:m.params.type,text:safeText(m.params.args.map(x=>x.value??x.description??'').join(' '))});
   if(m.method==='Runtime.exceptionThrown')evidence.consoleErrors.push({type:'exception',text:safeText(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)});
   if(m.method==='Log.entryAdded'&&['error','warning'].includes(m.params.entry.level))evidence.consoleErrors.push({type:m.params.entry.level,text:safeText(m.params.entry.text)});
   if(m.method==='Network.responseReceivedExtraInfo'&&m.params.blockedCookies?.length){evidence.cookieIssues??=[];evidence.cookieIssues.push({source:'response-extra',requestId:m.params.requestId,blocked:m.params.blockedCookies.map(x=>({reasons:x.blockedReasons,cookie:cookieMetadata(x.cookie)}))});}
   if(m.method==='Network.requestWillBeSentExtraInfo'&&m.params.associatedCookies?.length){evidence.cookieIssues??=[];evidence.cookieIssues.push({source:'request-extra',requestId:m.params.requestId,cookies:m.params.associatedCookies.map(x=>({blockedReasons:x.blockedReasons,cookie:cookieMetadata(x.cookie)}))});}
   if(m.method==='Audits.issueAdded'&&m.params.issue.details.cookieIssueDetails){const d=m.params.issue.details.cookieIssueDetails;evidence.cookieIssues??=[];evidence.cookieIssues.push({source:'browser-audit',code:m.params.issue.code,operation:d.operation,exclusionReasons:d.cookieExclusionReasons,warningReasons:d.cookieWarningReasons,cookie:cookieMetadata(d.cookie)});}
   if(m.method==='Network.responseReceived')evidence.responses.push({url:safeUrl(m.params.response.url),status:m.params.response.status,mime:m.params.response.mimeType,fromDiskCache:m.params.response.fromDiskCache===true});
   if(m.method==='Network.loadingFailed')evidence.failures.push({url:safeUrl(workerRequests.get(m.sessionId+':'+m.params.requestId)),error:m.params.errorText,blockedReason:m.params.blockedReason});
   if(m.method==='Network.requestWillBeSent')workerRequests.set(m.sessionId+':'+m.params.requestId,m.params.request.url);
   if(m.method==='Network.loadingFailed'&&m.params.blockedReason){const url=workerRequests.get(m.sessionId+':'+m.params.requestId);if(url){const u=new URL(url);evidence.blocked.push({targetSession:m.sessionId,host:u.hostname,path:u.pathname,guard:'Network.setBlockedURLs',blockedReason:m.params.blockedReason});}}
   if(m.method==='Fetch.requestPaused'){
    const {requestId,request}=m.params,u=new URL(request.url);
    const local=u.origin===origin&&!m.params.redirectedRequestId;
    const policy=cmpRequestPolicy({url:request.url,method:request.method,live,redirected:!!m.params.redirectedRequestId});
    const cmp=policy.allow;
    const entry={targetSession:m.sessionId,host:u.hostname,path:new URL(safeUrl(request.url)).pathname,method:request.method,...(u.hostname.endsWith('.valuecommerce.com')&&/^\d+$/.test(u.searchParams.get('pid')||'')?{placement:u.searchParams.get('pid')}: {})};
    if(policy.consentLog){evidence.consentLogRequests??=[];evidence.consentLogRequests.push({...entry,allowed:cmp,ordinal:policy.ordinal,limit:policy.limit});checkpoint({phase:'consent-log-decision',allowed:cmp,ordinal:policy.ordinal});}
    (local||cmp?evidence.continued:evidence.blocked).push(entry);
    await send(local||cmp?'Fetch.continueRequest':'Fetch.failRequest',local||cmp?{requestId}:{requestId,errorReason:'BlockedByClient'},m.sessionId);
   }
  }catch(e){fatal=String(e);/* A failed guard leaves the new target paused. */}
 };
 await send('Target.setDiscoverTargets',{discover:true});await send('Target.setAutoAttach',auto);
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});
 const session=await Promise.race([guards.has(targetId)?Promise.resolve(guards.get(targetId)):new Promise(r=>waiters.set(targetId,r)),new Promise((_,j)=>setTimeout(()=>j(Error('Guard attach timeout')),10000))]);
 const evaluate=async (expression,label='read-dom')=>{if(fatal)throw Error(fatal);checkpoint({phase:'evaluate',label});const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:false,timeout:3000},session);if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 await send('Page.navigate',{url:origin+'/'},session);await new Promise(r=>setTimeout(r,500));
 await evaluate(`(()=>{for(const [tag,attr,path] of [['img','src','image'],['script','src','script'],['iframe','src','frame']]){const e=document.createElement(tag);e[attr]='https://guard.invalid/'+path;document.body.appendChild(e)}fetch('https://guard.invalid/fetch').catch(()=>{});new Worker('/worker.js');})()`);
 const popup=await send('Target.createTarget',{url:'about:blank'});
 const popupSession=await Promise.race([guards.has(popup.targetId)?Promise.resolve(guards.get(popup.targetId)):new Promise(r=>waiters.set(popup.targetId,r)),new Promise((_,j)=>setTimeout(()=>j(Error('Popup guard timeout')),10000))]);
 await send('Page.navigate',{url:'https://guard.invalid/popup'},popupSession);
 await new Promise(r=>setTimeout(r,1500));
 const expected=['/image','/script','/frame','/fetch','/worker','/popup'];
 evidence.preflight={expected,allBlocked:expected.every(p=>evidence.blocked.some(x=>x.host==='guard.invalid'&&x.path===p)),noExternalContinued:evidence.continued.every(x=>x.host==='127.0.0.1'),fatal};
 if(fatal||!evidence.preflight.allBlocked||!evidence.preflight.noExternalContinued)throw Error('Preflight failed; real CMP/advertising fixture NOT enabled.');
 await send('Target.closeTarget',{targetId:popup.targetId});
 await send('Page.bringToFront',{},session);
 if(process.env.VC_REAL_CMP==='1'||mockUi){
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1400,deviceScaleFactor:1,mobile:false},session);
  live=true;await send('Page.navigate',{url:origin+'/cmp'},session);await new Promise(r=>setTimeout(r,7000));
  const snapshot=async label=>{const state=await evaluate(`(()=>{const c=window.Cookiebot,d=document.querySelector('#CybotCookiebotDialog');const visible=e=>!!(e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');return {observerInstalled:window.__vcProbeObserver===true,viewport:{width:innerWidth,height:innerHeight,outerWidth,outerHeight,dpr:devicePixelRatio,screenWidth:screen.width,screenHeight:screen.height,clientWidth:document.documentElement.clientWidth,clientHeight:document.documentElement.clientHeight,scrollX,scrollY,visual:visualViewport?{width:visualViewport.width,height:visualViewport.height,offsetTop:visualViewport.offsetTop,offsetLeft:visualViewport.offsetLeft,scale:visualViewport.scale}:null},hasResponse:c?.hasResponse,consented:c?.consented,declined:c?.declined,marketing:c?.consent?.marketing,method:c?.consent?.method,gate:window.kaguraVcConsent?.state,images:document.querySelectorAll('[data-vc-ad]>a img').length,dialogVisible:visible(d),dialogText:d?.textContent.slice(0,800),controls:[...document.querySelectorAll('#CybotCookiebotDialog button,#CybotCookiebotDialog a,#CybotCookiebotDialog input,#CybotCookiebotDialog [role=button],#CookiebotWidget button')].filter(visible).map(e=>({rect:{x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height},id:e.id,tag:e.tagName,type:e.getAttribute('type'),checked:typeof e.checked==='boolean'?e.checked:undefined,disabled:!!e.disabled,labels:e.labels?[...e.labels].map(l=>l.textContent.trim().slice(0,100)):[],role:e.getAttribute('role'),ariaLabel:e.getAttribute('aria-label'),text:(e.textContent||e.value||'').trim().slice(0,100)}))}})()`);evidence.states.push({label,...state,blockedRequests:evidence.blocked.length,vcRequests:evidence.blocked.filter(x=>x.host.endsWith('.valuecommerce.com')).length});return state;};
  const capture=async label=>{await send('Page.bringToFront',{},session);evidence.states.push({label:label+'-layout',layout:await send('Page.getLayoutMetrics',{},session),window:await send('Browser.getWindowForTarget',{targetId})});if(process.env.VC_CAPTURE_DIR){mkdirSync(process.env.VC_CAPTURE_DIR,{recursive:true});const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},session);writeFileSync(join(process.env.VC_CAPTURE_DIR,label+'.png'),Buffer.from(shot.data,'base64'));}};
  const initial=await snapshot('initial');await capture('initial');
  evidence.frames=await send('Page.getFrameTree',{},session).then(r=>({mainFrameId:r.frameTree.frame.id,childFrameCount:r.frameTree.childFrames?.length||0}));
  if(!initial.observerInstalled||!evidence.cmpEvents.some(e=>e.event==='observer-installed'&&e.path==='/cmp'))throw Error('Document-start observer handshake missing; diagnostics unreliable.');
  if(process.env.VC_SDK_SEQUENCE==='1'){
   if(initial.gate!=='unselected'||initial.hasResponse!==false||initial.images===0)throw Error('Real initial unselected state not established for SDK sequence');
   evidence.sdkScope='Actual vendor SDK in isolated profile; NOT public banner UI verification. Initial unselected advertising attempts are permitted by B policy and intercepted. Removal cannot undo earlier requests.';
   const expectedImages=initial.images;
   evidence.sdkPhases=[];
   const persistenceOnly=process.env.VC_SDK_PERSISTENCE_ONLY==='1';
   const cookieCheckpoint=async label=>{const cookies=await send('Network.getCookies',{urls:[origin+'/cmp']},session);const info=await send('Target.getTargetInfo',{targetId});const doc=await evaluate('({origin:location.origin,pathname:location.pathname,port:location.port,secureContext:isSecureContext})','cookie-context');evidence.cookieSnapshots??=[];evidence.cookieSnapshots.push({label,targetId,browserContextId:info.targetInfo.browserContextId||'default-isolated-profile',...doc,cookies:cookies.cookies.map(cookieMetadata)});checkpoint({phase:'cookie-metadata',label});};
   await cookieCheckpoint('initial');
   for(const name of (persistenceOnly?['reject','reload']:['reject','reload','allow','withdraw'])){
    const before=evidence.blocked.length,mountStart=evidence.cmpEvents.length;
    await cookieCheckpoint('before-'+name);
    checkpoint({phase:'sdk-before',name});
    if(name==='reload')await send('Page.reload',{ignoreCache:true},session);
    else if(name==='withdraw')await evaluate("(()=>{if(typeof Cookiebot?.withdraw!=='function')throw Error('Documented withdraw unavailable');Cookiebot.withdraw();return true;})()",'sdk-withdraw');
    else await evaluate(`(()=>{if(typeof Cookiebot?.submitCustomConsent!=='function')throw Error('Documented submitCustomConsent unavailable');Cookiebot.submitCustomConsent(false,false,${name==='allow'});return true;})()`,'sdk-'+name);
    // Await observable real state, never mutate properties or synthesize consent events.
    let matched=false;
    for(let tick=0;tick<20;tick++){
     await new Promise(r=>setTimeout(r,250));
     matched=await evaluate(`(()=>{const c=window.Cookiebot;return typeof c?.hasResponse==='boolean'&&c?.consent?.marketing===${name==='allow'}${name==='withdraw'?'':'&&c.hasResponse===true'};})()`,'sdk-state-'+name);
     if(matched)break;
    }
    await new Promise(r=>setTimeout(r,1000));
    const state=await snapshot('sdk-'+name);
    const mounts=evidence.cmpEvents.slice(mountStart).filter(x=>x.event==='vc-mount').reduce((n,x)=>n+x.count,0);
    const result=summarizeSdkPhase(name,before,evidence.blocked,state,mounts);result.observedExpectedApiState=matched;evidence.sdkPhases.push(result);
    await cookieCheckpoint('after-'+name);
    checkpoint({phase:'sdk-after',name});await capture('sdk-'+name);
    if(!matched)throw Error('SDK state transition did not complete: '+name);
    assertSdkPhase(result,expectedImages);
   }
   evidence.sdkPassed=!persistenceOnly;evidence.persistenceOnly=persistenceOnly;
  }
  if(process.env.VC_UI_SEQUENCE==='1'||mockUi){
   const click=async selectors=>{
    const selector=await evaluate(`(()=>{for(const s of ${JSON.stringify(selectors)}){const e=document.querySelector(s);if(e&&!e.disabled&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'){e.scrollIntoView({block:'center',inline:'center'});return s;}}return null})()`,'control-scroll');
    if(!selector)throw Error('Required real CMP UI control absent: '+selectors.join(','));
    await new Promise(r=>setTimeout(r,200));
    const pos=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;const r=e.getBoundingClientRect(),x=(Math.max(0,r.left)+Math.min(innerWidth,r.right))/2,y=(Math.max(0,r.top)+Math.min(innerHeight,r.bottom))/2,h=document.elementFromPoint(x,y);return {x,y,id:e.id,hit:!!h&&(h===e||e.contains(h)),visible:r.width>0&&r.height>0&&x>=0&&y>=0&&x<innerWidth&&y<innerHeight,frame:location.pathname};})()`,'control-hit-test');
    evidence.states.push({label:'ui-target',selector,...pos});
    await capture('before-'+(pos?.id||'missing'));
    evidence.states.push({label:'target-ancestors',selector,ancestors:await evaluate(`(()=>{const a=[];let e=document.querySelector(${JSON.stringify(selector)});for(let i=0;e&&i<7;i++,e=e.parentElement){const c=getComputedStyle(e),r=e.getBoundingClientRect();a.push({id:e.id,tag:e.tagName,position:c.position,display:c.display,overflowY:c.overflowY,height:c.height,maxHeight:c.maxHeight,transform:c.transform,rect:{x:r.x,y:r.y,width:r.width,height:r.height},scrollTop:e.scrollTop,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight});}return a;})()`,'control-ancestors')});
    if(!pos?.hit||!pos.visible)throw Error('CMP control does not own its visible viewport hit point.');
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:pos.x,y:pos.y},session);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x:pos.x,y:pos.y,button:'left',clickCount:1},session);
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:pos.x,y:pos.y,button:'left',clickCount:1},session);
    await new Promise(r=>setTimeout(r,1200));
   };
   if(mockUi){await click(['#CybotCookiebotDialogBodyContentTextToggle']);const count=await evaluate("document.querySelector('#CybotCookiebotDialogBodyContentTextToggle').dataset.clicked",'mock-click-assert');if(count!=='1')throw Error('Mock visible control did not receive exactly one click');evidence.mockUi={passed:true,clicks:1,notRealCMP:true};}else{
   const deny=['#CybotCookiebotDialogBodyButtonDecline'];
   const allow=['#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll']; // Generic Accept/OK may submit selected categories, not all.
   const reopen=async()=>{await click(['#CookiebotWidget-button']);await click(['#CookiebotWidget-btn-change']);};
   if(!initial.dialogVisible||initial.hasResponse!==false||initial.gate!=='unselected')throw Error('Real unselected dialog not ready; UI sequence NOT started.');
   if(!initial.controls.some(c=>c.id==='CybotCookiebotDialogBodyButtonDecline')){await click(['#CybotCookiebotDialogBodyContentTextToggle','#CybotCookiebotDialogBodyButtonDetails']);await snapshot('details-expanded');await capture('details-expanded');}
   await click(deny);let state=await snapshot('reject');if(state.hasResponse!==true||state.marketing!==false||state.images!==0)throw Error('Real rejection not established.');
   const beforeReload=evidence.blocked.filter(x=>x.host.endsWith('.valuecommerce.com')).length;
   await send('Page.reload',{ignoreCache:true},session);await new Promise(r=>setTimeout(r,5000));state=await snapshot('reload-rejection');if(state.hasResponse!==true||state.marketing!==false||state.images!==0||evidence.blocked.filter(x=>x.host.endsWith('.valuecommerce.com')).length!==beforeReload)throw Error('Saved rejection not established; consent logging remains blocked.');
   await reopen();await click(allow);state=await snapshot('allow');if(state.hasResponse!==true||state.marketing!==true||state.method!=='explicit'||state.gate!=='allowed'||state.images===0)throw Error('Explicit allowance not established.');
   await reopen();await click(deny);state=await snapshot('revoke');if(state.marketing!==false||state.images!==0)throw Error('Revocation not established.');
   }
  }
 }
 evidence.scope='Default preflight; VC_REAL_CMP=1 captures actual initial CMP diagnostics; VC_UI_SEQUENCE=1 attempts bounded real UI sequence, stopping on absent controls/state failure. No Cookiebot properties are overridden.';
 if(fatal)throw Error(fatal);
} catch(e){evidence.error=String(e);process.exitCode=1;}
finally{checkpoint({phase:'final',error:evidence.error||null});console.log(JSON.stringify({final:evidence}));ws?.close();chrome.kill();server.close();await new Promise(r=>setTimeout(r,300));try{rmSync(profile,{recursive:true,force:true});}catch{console.error('Temporary isolated Chrome profile cleanup pending; do not upload it.');}}
