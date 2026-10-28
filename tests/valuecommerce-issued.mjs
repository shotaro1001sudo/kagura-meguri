import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import * as cheerio from 'cheerio';
import {VC,vcTag,vcEnabled} from '../scripts/lib/valuecommerce.mjs';
import {experienceDirectory,experienceRegions} from '../scripts/lib/visitor-planning.mjs';
import {cspFor} from '../scripts/lib/csp.mjs';
export function valuecommerceIssuedTests({ok,section}) {
  section('VC: issued tag fidelity, inert resources, explicit marketing consent');
  // CSS fallback is present even when the CMP or our controller never loads.
  const emptyDirectory=experienceDirectory({sid:VC.sid,pid:VC.activity,allowed:true});
  const fallbackDom=new JSDOM('<style>'+readFileSync('scripts/style.css','utf8')+'</style>'+emptyDirectory,{runScripts:'outside-only'});
  const fw=fallbackDom.window,fd=fw.document;
  const fallbackCount=()=>[...fd.querySelectorAll('.experience-unavailable')].filter(n=>fw.getComputedStyle(n).display!=='none').length;
  const activeLinks=()=>fd.querySelectorAll('[data-vc-ad] > a').length;
  ok(fallbackCount()===47&&activeLinks()===0&&fd.querySelectorAll('img').length===0,'広告/CMPスクリプト停止時も47県の非広告案内があり外部画像なし');
  ok([...fd.querySelectorAll('a.experience-unavailable')].length===47&&[...fd.querySelectorAll('a.experience-unavailable')].every(a=>/^https:\/\/www\.jalan\.net\/activity\/\d{6}\/\?fromPage=search-area$/.test(a.getAttribute('href'))&&!/sponsored/.test(a.getAttribute('rel'))&&!a.hasAttribute('data-affiliate-category'))&&!fd.querySelector('.experience-display-help'),'広告を読み込めないときは、同じ県の体験一覧へ広告ではない普通のリンクで案内する(技術的な説明文は出さない)');
  fw.eval(readFileSync('scripts/client/valuecommerce-consent.js','utf8'));
  ok(fallbackCount()===47&&activeLinks()===0,'CMP未準備は広告を出さず空欄案内を維持');
  fw.Cookiebot={hasResponse:false,consent:{marketing:false,method:null}};
  fw.dispatchEvent(new fw.Event('CookiebotOnDialogDisplay'));
  ok(fallbackCount()===0&&activeLinks()===47,'確認済み未選択では元の正式47広告だけ表示');
  fw.Cookiebot={hasResponse:true,consent:{marketing:true,method:'explicit'}};
  fw.dispatchEvent(new fw.Event('CookiebotOnConsentReady'));
  fw.dispatchEvent(new fw.Event('CookiebotOnConsentReady'));
  ok(fallbackCount()===0&&activeLinks()===47,'明示許可・重複通知でも広告/案内を二重表示しない');
  fw.Cookiebot.consent.marketing=false;
  fw.dispatchEvent(new fw.Event('CookiebotOnDecline'));
  ok(fallbackCount()===47&&activeLinks()===0&&fd.querySelectorAll('img').length===0,'明示拒否・撤回後は広告を除去し47県の案内を戻す');
  fw.close();
  const evidence=JSON.parse(readFileSync('tests/fixtures/valuecommerce-issued.json','utf8'));
  const ads=[];
  for(const example of evidence.examples) {
    const original=cheerio.load(example.code), href=original('a').attr('href');
    const destination=new URL(href,'https://kagurameguri.jp').searchParams.get('vc_url');
    const markup=vcTag({...example,destination,meta:{'data-goatcounter-click':example.kind==='banner'?'banner-jalan/test':'stay-jalan/test'}});
    const generated=cheerio.load(markup),img=generated('img');
    ok(generated('a').attr('href')===href && img.attr('src')===original('img').attr('src'),'公式原本hrefと画像URLが完全一致: '+example.text);
    ok(['height','width','border'].every(k=>img.attr(k)===original('img').attr(k)),'計測画像寸法を変更/省略しない');
    ok(generated('a').text()===original('a').text()&&generated('a').attr('rel').includes('nofollow'),'本文とnofollowを保持');
    ok(Object.keys(generated('a')[0].attribs).every(k=>['href','rel','target'].includes(k)) && Object.keys(img[0].attribs).every(k=>['src','height','width','border','alt'].includes(k)),'原本内部に非許容のdata/class等を追加しない');
    ok(generated('[data-vc-ad][hidden] template').length===1 && generated('template').contents().find('a').length===1,'広告全体が不活性template内にある');
    ads.push(markup);
  }
  ok(!vcEnabled({sid:VC.sid,pid:'892725735',allowed:true},'stay')&&!vcEnabled({sid:VC.sid,pid:VC.stay},'stay'),'旧通常テキストPID・許可なしをMyLink扱いしない');
  const cfg=JSON.parse(readFileSync('config.json','utf8'));
  ok(cfg.affiliate.jalanPid===VC.stay && cfg.affiliate.jalanActivityPid===VC.activity,'宿新PID・体験既存PIDが設定と一致');
  const policy=cspFor(ads.join(''),cfg),strict=cspFor(ads.join(''),{...cfg,adsense:{client:''}});
  ok(policy.split(';').find(x=>x.trim().startsWith('img-src ')).split(' ').includes('https:')&&!strict.includes('ad.jp.ap.valuecommerce.com')&&!strict.split(';').find(x=>x.trim().startsWith('img-src ')).split(' ').includes('https:'),'本番既存HTTPS許可を利用し厳格CSPにVCドメインを追加しない');
  const directory=experienceDirectory({sid:VC.sid,pid:VC.activity,allowed:true}),areas=cheerio.load(directory);
  ok(areas('[data-vc-ad]').length===47 && experienceRegions.every(x=>areas(`a[href*="${encodeURIComponent(x.url)}"]`).length===1),'47県は正式MyLinkと既存の地域対応を維持');
  ok(experienceDirectory({sid:VC.sid,pid:VC.activity,allowed:false})==='','CSP/同意管理構成が未対応なら非表示');
  const script=readFileSync('scripts/client/valuecommerce-consent.js','utf8');
  // Real first-visit configuration: banner shown but no submitted/loaded consent event.
  for(const [state,expected] of [
    [{hasResponse:false,consented:false,declined:false,consent:{marketing:false,method:null}},'unselected'],
    [{hasResponse:true,declined:true,consent:{marketing:false,method:'explicit'}},'denied'],
    [{hasResponse:false,consent:{marketing:false}},'unknown'],
    [{hasResponse:false,consent:{marketing:true,method:null}},'unknown'],
    [{hasResponse:true,consent:{marketing:true,method:'implied'}},'unknown']
  ]) {
    const d=new JSDOM(ads.join(''),{runScripts:'outside-only'}),v=d.window;
    v.Cookiebot=state;v.eval(script);v.dispatchEvent(new v.Event('CookiebotOnDialogInit'));
    ok(v.kaguraVcConsent.state==='unknown'&&v.document.querySelectorAll('[data-vc-ad]>a img').length===0,'DialogInit/default values alone do not authorize display');
    v.dispatchEvent(new v.Event('CookiebotOnDialogDisplay'));
    ok(v.kaguraVcConsent.state===expected&&v.document.querySelectorAll('[data-vc-ad]>a img').length===(expected==='unselected'?5:0),'Documented DialogDisplay preserves strict state distinction: '+expected);
    v.Cookiebot.hasResponse=true;v.Cookiebot.consent={marketing:false,method:'explicit'};v.dispatchEvent(new v.Event('CookiebotOnDecline'));
    v.dispatchEvent(new v.Event('CookiebotOnDialogDisplay'));
    ok(v.kaguraVcConsent.state==='denied'&&v.document.querySelectorAll('[data-vc-ad]>a img').length===0,'Reopening rejected banner never reclassifies it as unselected');
    d.window.close();
  }
  {
    const d=new JSDOM('<!doctype html>',{url:'http://127.0.0.1/cmp',runScripts:'outside-only'}),logs=[];
    d.window.vcProbeEvent=value=>logs.push(JSON.parse(value));
    d.window.eval(readFileSync('tests/fixtures/vc-observe.js','utf8'));
    d.window.dispatchEvent(new d.window.Event('CookiebotOnDialogDisplay'));
    d.window.document.dispatchEvent(new d.window.Event('CookiebotOnDialogInit'));
    ok(logs[0]?.event==='observer-installed'&&logs[0]?.adapterPresent===false,'Diagnostic observer proves installation before adapter');
    ok(logs.some(x=>x.event==='CookiebotOnDialogDisplay'&&x.listener==='window-capture')&&logs.some(x=>x.event==='CookiebotOnDialogInit'&&x.listener==='document-capture'),'Diagnostic captures window and non-bubbling document events');
    ok(d.window.Cookiebot===undefined&&!JSON.stringify(logs).includes('CookieConsent='),'Diagnostic never manufactures CMP state or reads cookie tokens');
    d.window.close();
  }
  for(const early of [true,false]) for(const denied of [true,false]) {
    const d=new JSDOM(ads.join(''),{runScripts:'outside-only'}),v=d.window;
    v.eval(readFileSync('scripts/client/valuecommerce-ready.js','utf8'));
    v.Cookiebot={hasResponse:denied,consent:{marketing:false,method:denied?'explicit':null}};
    if(!early)v.eval(script);
    v.dispatchEvent(new v.Event('CookiebotOnDialogDisplay'));
    if(early)v.eval(script);
    const expected=denied?'denied':'unselected';
    ok(v.kaguraVcConsent.state===expected,'DialogDisplay before/after adapter preserves '+expected);
    const originals=[...v.document.querySelectorAll('[data-vc-ad]>a img')];
    v.dispatchEvent(new v.Event('CookiebotOnDialogDisplay'));v.eval(script);
    ok(v.document.querySelectorAll('[data-vc-ad]>a img').length===(denied?0:5)&&originals.every(n=>n.isConnected),'Repeated readiness does not duplicate or bypass rejection');
    v.Cookiebot.hasResponse=true;v.Cookiebot.consent={marketing:false,method:'explicit'};v.dispatchEvent(new v.Event('CookiebotOnDecline'));
    ok(v.kaguraVcConsent.state==='denied'&&v.document.querySelectorAll('[data-vc-ad]>a img').length===0,'Early capture does not override later rejection/revocation');
    d.window.close();
  }
  {
    const d=new JSDOM(ads.join(''),{runScripts:'outside-only'}),v=d.window;
    v.eval(readFileSync('scripts/client/valuecommerce-ready.js','utf8'));
    v.Cookiebot={hasResponse:false,loaded:true,consent:{marketing:false,method:null}};v.eval(script);
    ok(v.kaguraVcConsent.state==='unknown'&&v.document.querySelectorAll('[data-vc-ad]>a img').length===0,'Loaded/default API values without observed event remain unknown');
    d.window.close();
  }
  {
    const d=new JSDOM(ads.join(''),{runScripts:'outside-only'}),v=d.window;
    v.eval(readFileSync('scripts/client/valuecommerce-ready.js','utf8'));
    v.Cookiebot={hasResponse:false,consent:{marketing:false,method:null}};v.dispatchEvent(new v.Event('CookiebotOnDialogDisplay'));
    v.Cookiebot.hasResponse=true;v.Cookiebot.consent={marketing:false,method:'explicit'};v.dispatchEvent(new v.Event('CookiebotOnDecline'));v.eval(script);
    ok(v.kaguraVcConsent.state==='denied'&&v.document.querySelectorAll('[data-vc-ad]>a img').length===0,'Rejection before deferred adapter wins over earlier unselected event');
    d.window.close();
  }
  const dom=new JSDOM(ads.join(''),{url:'https://kagurameguri.jp/example.html',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;const imageNodes=new Set();let insertions=0;const append=w.Node.prototype.appendChild;
  w.Node.prototype.appendChild=function(node){if(this.matches?.('[data-vc-ad]'))for(const img of node.querySelectorAll('img'))if(!imageNodes.has(img)){imageNodes.add(img);insertions++;}return append.call(this,node)};
  w.eval(script);ok(w.document.querySelectorAll('img').length===0&&insertions===0,'Cookiebotなしで広告画像リクエストを生成しない');
  const send=name=>w.dispatchEvent(new w.Event(name));
  w.Cookiebot={hasResponse:false,consent:{marketing:false,method:null}};
  send('pageshow');ok(insertions===0&&w.kaguraVcConsent.state==='unknown','APIの初期falseを準備完了前に未選択と誤認しない');
  for(const cb of [{hasResponse:true,consent:{statistics:true,marketing:false,method:'explicit'}},{hasResponse:true,consent:{marketing:false}},{hasResponse:true,consent:{marketing:true,method:'implied'}},{hasResponse:false,consent:{marketing:true,method:null}},{hasResponse:false,consent:{marketing:false}}]) {w.Cookiebot=cb;send('CookiebotOnConsentReady');}
  ok(insertions===0,'保存済み拒否・旧拒否・曖昧な旧許可・不整合・不完全状態で画像ゼロ');
  w.Cookiebot={hasResponse:false,consent:{marketing:false,method:null}};send('CookiebotOnConsentReady');
  ok(w.kaguraVcConsent.state==='unselected'&&insertions===5&&w.document.querySelectorAll('img').length===5,'準備完了後に確認できた未選択だけ原本を表示');
  send('CookiebotOnConsentReady');send('CookiebotOnAccept');w.eval(script);
  ok(insertions===5,'重複通知・連打相当・再初期化で画像を再生成しない');
  w.Cookiebot.hasResponse=true;w.Cookiebot.consent={marketing:false,method:'explicit'};send('CookiebotOnDecline');
  ok(w.kaguraVcConsent.state==='denied'&&w.document.querySelectorAll('img,a').length===0&&[...w.document.querySelectorAll('[data-vc-ad]')].every(x=>x.hidden),'未選択から拒否で広告DOMを除去');
  w.Cookiebot.consent.marketing=true;send('CookiebotOnAccept');
  ok(w.kaguraVcConsent.state==='allowed'&&insertions===5&&[...w.document.querySelectorAll('img')].every(x=>imageNodes.has(x)),'再許可は元の画像要素を再利用、src再生成なし');
  send('pagehide');send('pageshow');ok(w.kaguraVcConsent.state==='unknown'&&w.document.querySelectorAll('img').length===0,'戻る/履歴復帰は古い許可を使わず新しいCMP通知待ち');
  send('CookiebotOnLoad');ok(insertions===5&&w.document.querySelectorAll('img').length===5,'復帰後のCookiebot OnLoad（保存状態読込完了）でも同じ原本を復元');
  Object.defineProperty(w,'Cookiebot',{configurable:true,get(){throw Error('unreadable')}});send('CookiebotOnConsentReady');
  ok(w.kaguraVcConsent.state==='unknown'&&w.document.querySelectorAll('img').length===0,'CMP読取例外で停止・DOM除去');
  for(const state of [{hasResponse:false,consent:{marketing:false,method:null}},{hasResponse:true,consent:{marketing:false,method:'explicit'}},{hasResponse:true,consent:{marketing:true,method:'explicit'}}]) {
    const reload=new JSDOM(ads[0],{url:'https://kagurameguri.jp/',runScripts:'outside-only'}),rw=reload.window;
    rw.Cookiebot=state;rw.eval(script);ok(rw.document.querySelectorAll('img').length===0,'reload/遷移でも準備完了まではゼロ');
    rw.dispatchEvent(new rw.Event('CookiebotOnConsentReady'));
    ok(rw.document.querySelectorAll('img').length===(state.hasResponse&&!state.consent.marketing?0:1),'reload時の3状態を別々に評価');rw.close();
  }
  w.close();

  section('VC wrapper GA4: unchanged fields, statistics gate, deduplication');
  const d=new JSDOM(directory,{url:'https://kagurameguri.jp/experiences.html?secret=x',runScripts:'outside-only',pretendToBeVisual:true}),win=d.window,events=[];let notify;
  win.IntersectionObserver=class{constructor(fn){notify=fn}observe(){}unobserve(){}};
  win.gtag=(...a)=>events.push(a);win.kaguraGa4Allowed=false;
  win.document.addEventListener('click',e=>e.preventDefault());
  win.eval(readFileSync('scripts/client/affiliate.js','utf8'));win.eval(script);
  const slot=win.document.querySelector('[data-vc-ad]'),show=()=>notify([{target:slot,isIntersecting:true,intersectionRatio:1}]);
  show();ok(events.length===0,'不活性広告をGA4表示数にしない');
  win.Cookiebot={hasResponse:true,consent:{marketing:true,method:'explicit'}};sendToWin('CookiebotOnAccept');
  function sendToWin(name){win.dispatchEvent(new win.Event(name))}
  slot.querySelector('a').click();show();ok(events.length===0,'広告同意だけではGA4へ送らない');
  win.kaguraGa4Allowed=true;sendToWin('kagura:analytics-ready');show();show();slot.querySelector('img').click();slot.querySelector('a').click();
  ok(events.filter(e=>e[1]==='affiliate_view').length===1&&events.filter(e=>e[1]==='affiliate_click').length===2,'外側計測で表示1回・各クリック1回');
  ok(events.every(e=>e[2].affiliate_partner==='vc-jalan-activity'&&e[2].affiliate_placement==='experience_directory'&&Object.keys(e[2]).length===5)&&!JSON.stringify(events).includes('secret'),'既存の分析契約を維持しURL/新しい識別子を追加しない');
  win.kaguraGa4Allowed=false;slot.querySelector('a').click();show();ok(events.length===3,'自己除外・統計同意撤回ゲートを維持');
  win.Cookiebot.consent.marketing=false;sendToWin('CookiebotOnDecline');win.kaguraGa4Allowed=true;show();ok(events.length===3,'広告撤回後の古いIntersection通知を無視');
  win.close();
}
