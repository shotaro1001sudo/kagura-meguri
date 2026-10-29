// Acknowledge only the exact fingerprint already reviewed; a newer change remains pending.
import { readFileSync,writeFileSync } from 'node:fs';
const file=process.env.SOURCE_WATCH_FILE ?? 'data/source-watch.json';
const [id,digest]=process.argv.slice(2), state=JSON.parse(readFileSync(file,'utf8'));
if(!id || !/^[a-f0-9]{64}$/.test(digest??'') || state[id]?.digest!==digest) {
  console.error('Usage: node scripts/review-source.mjs <sourceId> <reviewed sha256> (current fingerprint required)'); process.exit(1);
}
state[id].reviewedDigest=digest;state[id].pending=false;
writeFileSync(file,JSON.stringify(state,null,2)+'\n');
console.log(`${id}: reviewed (public events unchanged)`);
