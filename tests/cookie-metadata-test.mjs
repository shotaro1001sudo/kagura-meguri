import assert from 'node:assert/strict';
import {cookieMetadata} from './helpers/cookie-metadata.mjs';
const result=cookieMetadata({name:'CookieConsent',domain:'127.0.0.1',path:'/',secure:true,sameSite:'Lax',expires:123,value:'DO_NOT_LOG',cookieLine:'secret',headers:{Cookie:'secret'},token:'secret'});
assert.deepEqual(result,{name:'CookieConsent',domain:'127.0.0.1',path:'/',expires:123,secure:true,sameSite:'Lax'});
assert(!JSON.stringify(result).includes('secret'));assert(!JSON.stringify(result).includes('DO_NOT_LOG'));
console.log('Cookie metadata whitelist omits values, cookie lines, headers and tokens');
