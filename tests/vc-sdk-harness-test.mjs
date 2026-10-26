import assert from 'node:assert/strict';
import {summarizeSdkPhase,assertSdkPhase} from './helpers/vc-sdk-assertions.mjs';
const denied={hasResponse:true,marketing:false,method:'explicit',gate:'denied',images:0};
assertSdkPhase(summarizeSdkPhase('reject',0,[],denied,0),2);
const a={source:'Fetch.requestPaused',targetSession:'session',requestId:'fetch-a',networkId:'network-a',host:'ad.jp.ap.valuecommerce.com',path:'/servlet/gifbanner',method:'GET',placement:'892732997'};
const b={...a,requestId:'fetch-b',networkId:'network-b',placement:'892732911'};
const allowed={hasResponse:true,marketing:true,method:'explicit',gate:'allowed',images:2};
const p=summarizeSdkPhase('allow',0,[a,b],allowed,2);assert.equal(p.uniqueAttempts,2);assertSdkPhase(p,2);
assert.throws(()=>assertSdkPhase(summarizeSdkPhase('allow',0,[a,{...a,requestId:'actual-second-fetch'}],allowed,2),2),/mount-once/);
assert.throws(()=>assertSdkPhase(summarizeSdkPhase('reject',0,[a],denied,0),2),/activity/);
assert.throws(()=>assertSdkPhase(summarizeSdkPhase('reload',0,[],denied,1),2),/activity/);
assert.throws(()=>assertSdkPhase(summarizeSdkPhase('withdraw',0,[],{...denied,hasResponse:false,gate:'unselected'},0),2),/activity/);
assertSdkPhase(summarizeSdkPhase('withdraw',0,[],{...denied,hasResponse:false,gate:'unknown'},0),2);
console.log('SDK harness assertions: denial, reload, unique placement counts, duplicate mounts and withdrawal boundaries passed (not real CMP)');
// Test-only JSDOM verifies that even a transient mount removed before sampling is counted.
const {JSDOM}=await import('jsdom');
const {readFileSync}=await import('node:fs');
const d=new JSDOM('<span data-vc-ad="stay"></span>',{url:'http://127.0.0.1/cmp',runScripts:'outside-only'}),logs=[];
d.window.vcProbeEvent=s=>logs.push(JSON.parse(s));
d.window.eval(readFileSync('tests/fixtures/vc-observe.js','utf8'));
const anchor=d.window.document.createElement('a');anchor.append(d.window.document.createElement('img'));
d.window.document.querySelector('[data-vc-ad]').append(anchor);anchor.remove();
await new Promise(r=>setTimeout(r,0));
assert.equal(logs.filter(x=>x.event==='vc-mount').reduce((n,x)=>n+x.count,0),1);
d.window.close();
console.log('SDK mount observer: transient add/remove is detected (test-only DOM)');

const failed={source:'Network.loadingFailed',targetSession:'session',requestId:'network-a',host:a.host,path:a.path};
const paired=summarizeSdkPhase('allow',0,[a,failed,b,{...failed,requestId:'network-b'},a],allowed,2);
assert.equal(paired.attempts,2);assert.equal(paired.uniqueAttempts,2);assertSdkPhase(paired,2);
const redirect={...a,requestId:'redirect-fetch',redirectedRequestId:a.requestId};
assert.equal(summarizeSdkPhase('allow',0,[a,redirect],allowed,2).attempts,2);
assert.throws(()=>assertSdkPhase(summarizeSdkPhase('allow',0,[a,redirect],allowed,2),2),/mount-once/);
assert.throws(()=>assertSdkPhase(summarizeSdkPhase('allow',0,[a,b],allowed,3),2),/mount-once/);
console.log('Request accounting: actual Fetch identities, paired failure notifications, duplicate delivery and distinct redirect attempts verified');

assertSdkPhase(summarizeSdkPhase('withdraw-reload',0,[],{...denied,hasResponse:false,gate:'unknown'},0),2);
assert.throws(()=>assertSdkPhase(summarizeSdkPhase('withdraw-reload',0,[a],{...denied,hasResponse:false,gate:'unselected',images:2},2),2),/activity/);
