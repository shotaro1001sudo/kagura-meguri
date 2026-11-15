import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import * as cheerio from 'cheerio';
import {VC,vcTag,vcEnabled} from '../scripts/lib/valuecommerce.mjs';
import {experienceDirectory,experienceRegions} from '../scripts/lib/visitor-planning.mjs';
import {cspFor} from '../scripts/lib/csp.mjs';
function choice(w, marketing, ready=true) { w.kaguraConsent={snapshot:()=>({ready,marketing})};w.dispatchEvent(new w.Event('kagura:consent')); }
export function valuecommerceIssuedTests({ok,section}) {
  section('VC: issued tag fidelity, inert resources, explicit marketing consent');
  // CSS fallback is present even when the CMP or our controller never loads.
  const emptyDirectory=experienceDirectory({sid:VC.sid,pid:VC.activity,allowed:true});
  const fallbackDom=new JSDOM('<style>'+readFileSync('scripts/style.css','utf8')+'</style>'+emptyDirectory,{runScripts:'outside-only'});
  const fw=fallbackDom.window,fd=fw.document;
  const fallbackCount=()=>[...fd.querySelectorAll('.experience-unavailable')].filter(n=>fw.getComputedStyle(n).display!=='none').length;
  const activeLinks=()=>fd.querySelectorAll('.experience-area [data-vc-ad] > a').length; // 県ごとのリンク(一覧の上の画像バナーは数えない)
  ok(fallbackCount()===47&&activeLinks()===0&&fd.querySelectorAll('img').length===0,'広告/CMPスクリプト停止時も47県の非広告案内があり外部画像なし');
  ok([...fd.querySelectorAll('a.experience-unavailable')].length===47&&[...fd.querySelectorAll('a.experience-unavailable')].every(a=>/^https:\/\/www\.jalan\.net\/activity\/\d{6}\/\?fromPage=search-area$/.test(a.getAttribute('href'))&&!/sponsored/.test(a.getAttribute('rel'))&&!a.hasAttribute('data-affiliate-category'))&&!fd.querySelector('.experience-display-help'),'広告を読み込めないときは、同じ県の体験一覧へ広告ではない普通のリンクで案内する(技術的な説明文は出さない)');
  fw.eval(readFileSync('scripts/client/valuecommerce-consent.js','utf8'));
  ok(fallbackCount()===47&&activeLinks()===0,'CMP未準備は広告を出さず空欄案内を維持');
  choice(fw,false,false);
  ok(fallbackCount()===47&&activeLinks()===0,'未選択時も広告を読み込まず普通のリンクを維持');
  choice(fw,true);choice(fw,true);
  ok(fallbackCount()===0&&activeLinks()===47,'明示許可・重複通知でも広告/案内を二重表示しない');
  choice(fw,false);
  ok(fallbackCount()===47&&activeLinks()===0&&fd.querySelectorAll('img').length===0,'撤回後は広告を除去し47県の案内を戻す');
  fw.close();
  const evidence=JSON.parse(readFileSync('tests/fixtures/valuecommerce-issued.json','utf8'));
  const ads=[];
  for(const example of evidence.examples) {
    const original=cheerio.load(example.code), href=original('a').attr('href');
    const destination=new URL(href,'https://kagurameguri.jp').searchParams.get('vc_url');
    const markup=vcTag({...example,destination,meta:{'data-goatcounter-click':example.kind==='banner'?'banner-jalan/test':example.kind.startsWith('rail')?'rail-jalan/test':'stay-jalan/test'}});
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
  ok(areas('.experience-area [data-vc-ad]').length===47 && areas('.experience-banner [data-vc-ad="activityBanner"]').length===1 && areas('[data-vc-ad]').length===48 && experienceRegions.every(x=>areas(`a[href*="${encodeURIComponent(x.url)}"]`).length===1),'47県は正式MyLinkと既存の地域対応を維持');
  ok(experienceDirectory({sid:VC.sid,pid:VC.activity,allowed:false})==='','CSP/同意管理構成が未対応なら非表示');
  const script=readFileSync('scripts/client/valuecommerce-consent.js','utf8');
  for (const ready of [false,true]) for (const marketing of [false,true]) {
    const dom=new JSDOM(ads.join(''),{runScripts:'outside-only'}),w=dom.window;
    w.eval(script);
    ok(w.document.querySelectorAll('img').length===0,'Missing CMP keeps issued tags inert');
    choice(w,marketing,ready);
    const count=ready&&marketing?evidence.examples.length:0;
    ok(w.document.querySelectorAll('img').length===count,'Only explicit ready marketing grant displays issued tags');
    const originals=[...w.document.querySelectorAll('img')];
    choice(w,marketing,ready);w.eval(script);
    ok(w.document.querySelectorAll('img').length===count && originals.every(n=>n.isConnected),'Duplicate events reuse nodes');
    choice(w,false);
    ok(w.document.querySelectorAll('img').length===0,'Rejection/revocation removes resources');
    choice(w,true);
    const granted=[...w.document.querySelectorAll('img')];
    choice(w,false);choice(w,true);
    ok(granted.every(n=>n.isConnected),'Regrant reuses issued resources');
    w.kaguraConsent={snapshot(){throw Error('unavailable')}};w.dispatchEvent(new w.Event('kagura:consent'));
    ok(w.document.querySelectorAll('img').length===0,'Unreadable CMP fails closed');
    w.close();
  }

  { // 2026-11-15: PCの両サイドのPR枠の広告は、PR枠が出る画面でだけ読み込む。スマホの帯の広告は、帯が出る画面でだけ読み込む(見えない広告の画像を取りに行かない)
    const RAIL_Q='(min-width:1400px) and (min-height:520px)',STRIP_Q='not all and '+RAIL_Q;
    const railTag=vcTag({kind:'railNta',className:'rail-banner',meta:{'data-goatcounter-click':'rail-nta/jr-hotel','data-vc-media':RAIL_Q}}),stripTag=vcTag({kind:'railNta',className:'strip-banner',meta:{'data-goatcounter-click':'rail-nta/strip-jr-hotel','data-vc-media':STRIP_Q}}),plain=vcTag({kind:'banner',meta:{'data-goatcounter-click':'banner-jalan/test'}});
    const dom=new JSDOM(`<div id="rail">${railTag}</div><div id="strip">${stripTag}</div><div id="plain">${plain}</div>`,{runScripts:'outside-only'}),w=dom.window;let wide=false;
    w.matchMedia=q=>({matches:q.startsWith('not all')?!wide:wide});
    w.eval(script);
    const imgs=id=>w.document.querySelectorAll('#'+id+' img').length,hidden=id=>w.document.querySelector('#'+id+' [data-vc-ad]').hidden;
    ok(imgs('rail')+imgs('strip')+imgs('plain')===0,'画面の条件つきの広告も、同意の前は読み込まない');
    choice(w,true);
    ok(imgs('rail')===0&&hidden('rail')&&imgs('strip')===1&&!hidden('strip')&&imgs('plain')===1,'スマホの幅: 帯の広告だけを読み込み、両サイドのPR枠の広告は読み込まない(条件のない広告は、いつも読み込む)');
    wide=true;choice(w,true);
    ok(imgs('rail')===1&&!hidden('rail')&&imgs('strip')===0&&hidden('strip')&&imgs('plain')===1,'PCの幅に変わったら、両サイドのPR枠の広告を読み込み、帯の広告は外す');
    wide=false;choice(w,true);const again=w.document.querySelector('#strip img');wide=true;choice(w,true);wide=false;choice(w,true);
    ok(w.document.querySelector('#strip img')===again&&imgs('rail')===0,'幅が行き来しても、同じ画像を作り直さない');
    choice(w,false);
    ok(imgs('rail')+imgs('strip')+imgs('plain')===0,'同意の取り消しで、条件つきの広告も外す');
    ok(/addEventListener\('resize'/.test(script)&&script.includes("getAttribute('data-vc-media')")&&(()=>{try{vcTag({kind:'banner',meta:{'data-other':'x'}});return false}catch{return true}})(),'画面の大きさが変わったら合わせ直す。広告の外側に付けられる属性は、決めたものだけ');
    w.close();
  }

  section('VC wrapper GA4: unchanged fields, statistics gate, deduplication');
  const d=new JSDOM(directory,{url:'https://kagurameguri.jp/experiences.html?secret=x',runScripts:'outside-only',pretendToBeVisual:true}),win=d.window,events=[];let notify;
  win.IntersectionObserver=class{constructor(fn){notify=fn}observe(){}unobserve(){}};
  win.gtag=(...a)=>events.push(a);win.kaguraGa4Allowed=false;
  win.document.addEventListener('click',e=>e.preventDefault());
  win.eval(readFileSync('scripts/client/affiliate.js','utf8'));win.eval(script);
  const slot=win.document.querySelector('[data-vc-ad]'),show=()=>notify([{target:slot,isIntersecting:true,intersectionRatio:1}]);
  show();ok(events.length===0,'不活性広告をGA4表示数にしない');
  choice(win,true);
  function sendToWin(name){win.dispatchEvent(new win.Event(name))}
  slot.querySelector('a').click();show();ok(events.length===0,'広告同意だけではGA4へ送らない');
  win.kaguraGa4Allowed=true;sendToWin('kagura:analytics-ready');show();show();slot.querySelector('img').click();slot.querySelector('a').click();
  ok(events.filter(e=>e[1]==='affiliate_view').length===1&&events.filter(e=>e[1]==='affiliate_click').length===2,'外側計測で表示1回・各クリック1回');
  ok(events.every(e=>e[2].affiliate_partner==='vc-jalan-activity'&&e[2].affiliate_placement==='experience_directory'&&Object.keys(e[2]).length===5)&&!JSON.stringify(events).includes('secret'),'既存の分析契約を維持しURL/新しい識別子を追加しない');
  win.kaguraGa4Allowed=false;slot.querySelector('a').click();show();ok(events.length===3,'自己除外・統計同意撤回ゲートを維持');
  choice(win,false);win.kaguraGa4Allowed=true;show();ok(events.length===3,'広告撤回後の古いIntersection通知を無視');
  win.close();
}
