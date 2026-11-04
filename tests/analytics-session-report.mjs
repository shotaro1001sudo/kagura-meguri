import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const code=readFileSync('scripts/apps-script/analytics-sheet-sync.gs','utf8')+'\n'+readFileSync('scripts/apps-script/analytics-session-report.gs','utf8');
let calls=[], response, ready=true;
const context={Date, PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='KAGURA_GA4_PROPERTY_ID'?'123':'Asia/Tokyo'})},
 AnalyticsData:{Properties:{runReport:r=>{calls.push(r);return response;}}}};
runInNewContext(code,context);
context.checkKaguraAnalyticsSetup=()=>({readyForOwnerTest:ready});
const report=(sessions=2,eventCount=7)=>({dimensionHeaders:[],metricHeaders:[{name:'sessions'},{name:'eventCount'}],rowCount:1,
 rows:[{dimensionValues:[],metricValues:[{value:String(sessions)},{value:String(eventCount)}]}],metadata:{timeZone:'Asia/Tokyo'}});
response=report();
const result=context.readKaguraSessionReport('2026-10-27','2026-11-02');
assert.equal(calls.length,5);
assert.ok(calls.every(r=>r.dimensions.length===0 && r.dateRanges.length===1 && r.metrics[0].name==='sessions'));
assert.equal(result[4].sessions,2); // NOT official 2 + affiliate 2.
assert.equal(result[4].eventCount,7); // Counts preserved separately.
assert.equal(calls[4].dimensionFilter.andGroup.expressions[0].filter.inListFilter.values.join(), 'official_link_click,affiliate_click');
assert.equal(calls[0].dimensionFilter,undefined);
const page=context.kaguraSessionRequests_('2026-10-27','2026-11-02','/events/test.html');
assert.ok(page.every(j=>j.request.dimensionFilter.andGroup.expressions.at(-1).filter.stringFilter.matchType==='EXACT'));
for(const args of [['2026-02-30','2026-03-01'],['2026-10-01','2026-11-02'],['2026-11-02','2026-10-27'],['2026-10-27','2026-11-02','/events/test.html?private=x']]) {
 assert.throws(()=>context.readKaguraSessionReport(...args));
}
assert.equal(calls.length,5);
ready=false;assert.throws(()=>context.readKaguraSessionReport('2026-10-27','2026-11-02'));assert.equal(calls.length,5);ready=true;
response=report();delete response.dimensionHeaders;delete response.rows[0].dimensionValues;
assert.equal(context.readKaguraSessionReport('2026-10-27','2026-11-02')[0].sessions,2);
response={...report(),rowCount:0,rows:[]};
assert.equal(context.readKaguraSessionReport('2026-10-27','2026-11-02')[0].sessions,null);
for(const bad of [{...report(),metadata:{timeZone:'UTC'}},report('NaN'),report(-1),report(1.5),{...report(),rowCount:2}]) {
 response=bad;assert.throws(()=>context.readKaguraSessionReport('2026-10-27','2026-11-02'));
}
response=report();response.metadata={timeZone:'Asia/Tokyo',subjectToThresholding:true,samplingMetadatas:[{}],dataLossFromOtherRow:true};
assert.match(context.readKaguraSessionReport('2026-10-27','2026-11-02')[0].quality,/thresholded; sampled; data_loss/);
console.log('PASS GA4 session reporting: period totals, union, exact page, guards, empty/error/quality');
