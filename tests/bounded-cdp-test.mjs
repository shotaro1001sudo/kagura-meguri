import assert from 'node:assert/strict';
import {boundedCdp} from './helpers/bounded-cdp.mjs';
const logs=[],wires=[];const c=boundedCdp(s=>wires.push(JSON.parse(s)),{timeoutMs:25,checkpoint:x=>logs.push(x)});
const first=c.send('Runtime.evaluate');await assert.rejects(first,/CDP timeout Runtime.evaluate/);
assert.deepEqual(logs.map(x=>x.phase),['start','timeout']);
c.receive({id:1,result:{late:true}}); // Late response must not crash or resolve another request.
const second=c.send('Page.getFrameTree');c.receive({id:2,result:{ok:true}});assert.deepEqual(await second,{ok:true});
const third=c.send('Page.captureScreenshot');c.close();await assert.rejects(third,/connection closed/);
console.log('bounded CDP: timeout, checkpoint, late response, success, close passed');
