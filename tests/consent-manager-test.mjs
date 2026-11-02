// Real vendored CMP in an offline DOM: no external resources or analytics execute.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
const vendor='assets/vendor/cookieconsent-3.2.1/';
for(const [file,hash] of Object.entries({
 'cookieconsent.umd.js':'a5b75180b11975bc4cde2a42f6a0ae285d37f13730574c38c80bd48dc6b301d5',
 'cookieconsent.css':'dd7ad33177579ec69138b107f107ea6bbb2c3e54cfae9c03ca6691e112b4a711',
 LICENSE:'e3cf4e09e007ffede1a8a50aa006b489a5eafd466a2094551a0ac2b308230bfd'
}))assert.equal(createHash('sha256').update(readFileSync(vendor+file)).digest('hex'),hash);
const code=readFileSync('scripts/client/consent-manager.js','utf8');
async function setup({cookie='',js=true,css=true}={}){
 const d=new JSDOM('<!doctype html><link rel="stylesheet" href="/vendor/cookieconsent-3.2.1/cookieconsent.css"><body>',{url:'https://kagurameguri.jp/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=d.window;w.matchMedia=()=>({matches:false});
 if(css)Object.defineProperty(w.document.querySelector('link'),'sheet',{value:{cssRules:[{}]}});
 if(cookie)w.document.cookie=cookie;
 if(js)w.eval(readFileSync(vendor+'cookieconsent.umd.js','utf8'));
 w.eval(code);await new Promise(r=>setTimeout(r,40));return w;
}
for(const failure of [{js:false},{css:false}]){const w=await setup(failure);assert.equal(w.kaguraConsent.snapshot().statistics,false);assert.throws(()=>w.kaguraConsent.open());w.close();}
let w=await setup({cookie:'CookieConsent=legacy-grant'});
assert.equal(w.kaguraConsent.snapshot().statistics,false);assert.equal(w.kaguraConsent.snapshot().marketing,false);
w.CookieConsent.acceptCategory(['analytics']);
assert.equal(w.kaguraConsent.snapshot().statistics,true);assert.equal(w.kaguraConsent.snapshot().marketing,false);
const saved=w.document.cookie.split('; ').find(c=>c.startsWith('kagura_consent_v1='));w.close();w=await setup({cookie:saved});assert.equal(w.kaguraConsent.snapshot().statistics,true);
w.CookieConsent.acceptCategory(['marketing']);assert.equal(w.kaguraConsent.snapshot().statistics,false);assert.equal(w.kaguraConsent.snapshot().marketing,true);
w.CookieConsent.acceptCategory([]);assert.equal(w.kaguraConsent.snapshot().statistics,false);assert.equal(w.kaguraConsent.snapshot().marketing,false);
w.kaguraConsent.open();assert.equal(w.kaguraConsent.snapshot().marketing,false);
w.CookieConsent.acceptCategory('all');assert.equal(w.kaguraConsent.snapshot().statistics,true);
// Simulate another tab clearing/expiring its consent; stale in-memory grants are insufficient.
w.document.cookie='kagura_consent_v1=; Max-Age=0; path=/';
assert.equal(w.kaguraConsent.snapshot().statistics,false);assert.equal(w.kaguraConsent.snapshot().marketing,false);
w.close();
console.log('Pinned local CookieConsent: license/hash, old consent ignored, failure closed, persistence, categories, reopen and revocation passed');
