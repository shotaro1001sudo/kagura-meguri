import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {cookieControls} from '../scripts/lib/cookie-controls.mjs';
const script=readFileSync('scripts/client/cookie-controls.js','utf8');
function setup(cb){const d=new JSDOM('<html lang="ja"><body>'+cookieControls()+'</body></html>',{runScripts:'outside-only'});let timeout;d.window.setTimeout=f=>{timeout=f;return 1;};d.window.clearTimeout=()=>{timeout=null;};d.window.Cookiebot=cb;d.window.eval(script);return {d,w:d.window,b:d.window.document.querySelector('button'),text:()=>d.window.document.querySelector('[role=status]').textContent,timeout:()=>timeout?.()};}
const state=()=>({hasResponse:false,consent:{necessary:true,preferences:false,statistics:false,marketing:false,method:null}});
for(const cb of [undefined,{}, {...state(),submitCustomConsent:null}, {...state(),hasResponse:undefined,submitCustomConsent(){throw Error('must not call');}}]){const t=setup(cb);t.b.click();assert.match(t.text(),/読み込めません/);assert.equal(t.b.hasAttribute('aria-disabled'),false);t.d.window.close();}
{
 let calls=0;const cb=state();cb.submitCustomConsent=(...args)=>{calls++;assert.deepEqual(args,[false,false,false]);};const t=setup(cb);assert.equal(calls,0);t.b.focus();t.b.click();t.b.click();assert.equal(calls,1);assert.match(t.text(),/確認しています/);assert.equal(t.w.document.activeElement,t.b);assert.equal(t.b.getAttribute('aria-disabled'),'true');t.timeout();assert.match(t.text(),/確認できません/);t.b.click();assert.equal(calls,1);t.d.window.close();
}
{
 let calls=0;const cb=state();cb.submitCustomConsent=(p,s,m)=>{calls++;cb.hasResponse=true;cb.consent={necessary:true,preferences:p,statistics:s,marketing:m,method:'explicit'};};const t=setup(cb);t.b.click();assert.equal(calls,1);assert.match(t.text(),/拒否する設定/);t.b.click();assert.equal(calls,1);assert.equal(cb.consent.necessary,true);t.d.window.close();
}
{
 const cb=state();cb.submitCustomConsent=()=>{};const t=setup(cb);t.b.click();cb.hasResponse=true;cb.consent.method='explicit';cb.consent.statistics=true;t.w.dispatchEvent(new t.w.Event('CookiebotOnDecline'));assert.match(t.text(),/確認しています/);cb.consent.statistics=false;t.w.dispatchEvent(new t.w.Event('CookiebotOnConsentReady'));assert.match(t.text(),/拒否する設定/);t.d.window.close();
}
{
 let calls=0;const cb=state();cb.hasResponse=true;cb.consent.method='explicit';cb.submitCustomConsent=()=>calls++;const t=setup(cb);t.b.click();assert.equal(calls,0);assert.match(t.text(),/拒否する設定/);t.d.window.close();
}
{
 let calls=0;const cb=state();cb.submitCustomConsent=()=>{calls++;throw Error('unavailable');};const t=setup(cb);t.b.click();t.b.click();assert.equal(calls,1);assert.match(t.text(),/確認できません/);t.d.window.close();
}
const t=setup(state());assert.equal(t.b.type,'button');assert.equal(t.b.textContent,'任意Cookieを拒否');assert.equal(t.b.getAttribute('aria-describedby'),'cookie-reject-help cookie-reject-status');assert.equal(t.w.document.querySelector('[role=status]').getAttribute('aria-live'),'polite');assert.match(cookieControls(true),/Reject optional cookies/);t.d.window.close();
console.log('Cookie refusal controls: explicit action, necessary-only arguments, unavailable/error, strict feedback, timeout, repeated clicks and accessible markup passed (mock only)');
