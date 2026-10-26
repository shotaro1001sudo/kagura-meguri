import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {cookieControls} from '../scripts/lib/cookie-controls.mjs';
const script=readFileSync('scripts/client/cookie-controls.js','utf8');
function setup(cb){const d=new JSDOM('<html lang="ja"><body>'+cookieControls()+'</body></html>',{runScripts:'outside-only'}),timers=new Map();let n=0;d.window.setTimeout=(f,ms)=>{timers.set(++n,{f,ms});return n;};d.window.clearTimeout=id=>timers.delete(id);d.window.Cookiebot=cb;d.window.eval(script);return {d,w:d.window,b:d.window.document.querySelector('button'),text:()=>d.window.document.querySelector('[role=status]').textContent,tick:ms=>{for(const [id,t] of [...timers])if(t.ms===ms){timers.delete(id);t.f();}}};}
for(const cb of [undefined,{}, {renew:null}]){const t=setup(cb);t.b.click();assert.match(t.text(),/開けません/);t.d.window.close();}
{
 let calls=0,submissions=0;const cb={renew(){calls++;},submitCustomConsent(){submissions++;}};const t=setup(cb);assert.equal(calls,0);t.w.dispatchEvent(new t.w.Event('CookiebotOnDialogDisplay'));assert.equal(t.text(),'');t.b.focus();t.b.click();t.b.click();assert.equal(calls,1);assert.equal(t.w.document.activeElement,t.b);assert.match(t.text(),/開いています/);t.tick(1000);t.b.click();assert.equal(calls,1);t.tick(8000);assert.match(t.text(),/開けません/);t.b.click();assert.equal(calls,2);assert.equal(submissions,0);t.d.window.close();
}
{
 let calls=0;const cb={hasResponse:true,consent:{necessary:true,preferences:false,statistics:false,marketing:false,method:'explicit'},renew(){calls++;t.w.dispatchEvent(new t.w.Event('CookiebotOnDialogDisplay'));}};const before=JSON.stringify(cb.consent);const t=setup(cb);t.b.click();t.b.click();assert.equal(calls,1);assert.match(t.text(),/ポップアップ/);assert.equal(JSON.stringify(cb.consent),before);assert.equal(cb.hasResponse,true);t.tick(1000);t.b.click();assert.equal(calls,2);t.d.window.close();
}
{
 let calls=0;const t=setup({renew(){calls++;throw Error('unready');}});t.b.click();t.b.click();assert.equal(calls,1);assert.match(t.text(),/開けません/);t.tick(1000);t.b.click();assert.equal(calls,2);t.d.window.close();
}
const t=setup({});assert.equal(t.b.type,'button');assert.equal(t.b.textContent,'Cookie設定');assert.equal(t.b.getAttribute('aria-describedby'),'cookie-settings-status');assert.equal(t.w.document.querySelector('[role=status]').getAttribute('aria-live'),'polite');assert.match(cookieControls(true),/Cookie settings/);assert.equal(t.w.document.querySelectorAll('button').length,1);assert(!script.includes('submitCustomConsent('));assert(!script.includes('.withdraw('));t.d.window.close();
console.log('Native Cookie settings entry: renew-only, keyboard markup, unavailable/error/timeout, real display-event feedback, repeat suppression and reopen passed (mocks only)');

{
 let calls=0;const t=setup({renew(){calls++;}}),popup=t.w.document.createElement('div');popup.id='CybotCookiebotDialog';popup.getClientRects=()=>[{width:300,height:250}];t.w.document.body.append(popup);t.b.click();assert.equal(calls,1);assert.match(t.text(),/ポップアップ/);t.d.window.close();
}
