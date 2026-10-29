// Optional live, read-only verification. No events/state/files are changed.
import {readFileSync} from 'node:fs';
import {strictRobotsAllows} from './lib/strict-robots.mjs';
import {fingerprint} from './lib/source-watch.mjs';
import {sleep} from './lib/util.mjs';
const sources=JSON.parse(readFileSync('data/sources.json','utf8')).filter(s=>s.nationalExpansion && s.enabled);
const ua='KaguraMeguriBot/1.0 (+https://kagurameguri.jp/contact.html)';
let failures=0;
for(const source of sources) {
  try {
    const adapter=await import(`./adapters/${source.adapter}.mjs`);
    let items=[], snapshots=[];
    for(const url of adapter.urls?.(source) ?? [source.url]) {
      const robots=await strictRobotsAllows(url,ua);
      if(!robots.ok)throw Error(robots.reason);
      await sleep(source.requestDelayMs);
      const res=await fetch(url,{headers:{'user-agent':ua},signal:AbortSignal.timeout(15000)});
      if(!res.ok)throw Error(`HTTP ${res.status}`);
      if(new URL(res.url).origin!==new URL(url).origin)throw Error('cross-origin redirect');
      const html=await res.text();snapshots.push(fingerprint(html,url));
      items.push(...adapter.parse(html,source,url));
    }
    console.log(JSON.stringify({id:source.id,ok:true,mode:source.collectionMode,pages:snapshots.length,items}));
  } catch(e) {console.log(JSON.stringify({id:source.id,ok:false,error:e.message}));failures++;}
}
if(failures)process.exitCode=1;
