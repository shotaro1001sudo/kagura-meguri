import assert from 'node:assert/strict';
import {createCmpRequestPolicy} from './helpers/cmp-request-policy.mjs';
const req={url:'https://consent.cookiebot.com/logconsent.ashx?secret=never-record',method:'GET',live:true};
assert.equal(createCmpRequestPolicy()(req).allow,false);
const policy=createCmpRequestPolicy({enabled:true});
for(const change of [{live:false},{method:'POST'},{redirected:true},{url:'http://consent.cookiebot.com/logconsent.ashx'},{url:'https://consent.cookiebot.com:444/logconsent.ashx'},{url:'https://consent.cookiebot.com/logconsent.ashx/extra'},{url:'https://consentcdn.cookiebot.com/logconsent.ashx'},{url:'https://consent.cookiebot.com.evil.invalid/logconsent.ashx'},{url:'https://user:pass@consent.cookiebot.com/logconsent.ashx'},{url:'https://ad.jp.ap.valuecommerce.com/servlet/gifbanner'},{url:'https://www.google-analytics.com/g/collect'}])assert.equal(policy({...req,...change}).allow,false,JSON.stringify(change));
for(let i=1;i<=4;i++){const result=policy(req);assert.equal(result.allow,true);assert.equal(result.ordinal,i);assert.equal(JSON.stringify(result).includes('never-record'),false);}
assert.equal(policy(req).allow,false);
assert.equal(policy({...req,url:'https://consent.cookiebot.com/uc.js',redirected:true}).allow,false);
assert.equal(policy({...req,url:'https://consent.cookiebot.com/uc.js'}).allow,true);
console.log('CMP request policy: default denial, exact opt-in endpoint, redirect denial, four-request cap and redacted evidence passed (local only)');
