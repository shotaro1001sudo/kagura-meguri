export const vcAttempts=rows=>rows.filter(x=>x.host?.endsWith('.valuecommerce.com'));
export function summarizeSdkPhase(name,before,after,state,mounts){
 const attempts=vcAttempts(after.slice(before));
 const counts={};for(const x of attempts){const key=[x.host,x.path,x.placement||'',x.method].join('|');counts[key]=(counts[key]||0)+1;}
 return {name,state,attempts:attempts.length,uniqueAttempts:Object.keys(counts).length,attemptCounts:counts,mounts};
}
export function assertSdkPhase(p,expectedImages){
 const s=p.state;
 if(p.name==='allow'){
  if(s.hasResponse!==true||s.marketing!==true||s.method!=='explicit'||s.gate!=='allowed'||s.images!==expectedImages||p.mounts!==expectedImages||Object.values(p.attemptCounts).some(n=>n>1)||p.attempts>expectedImages)throw Error('SDK explicit allowance/mount-once verification failed');
 }else{
  if(s.marketing!==false||s.images!==0||p.mounts!==0||p.attempts!==0||!['denied','unknown'].includes(s.gate))throw Error('SDK rejection/reload/withdraw caused VC resource activity');
  if(p.name!=='withdraw'&&s.hasResponse!==true)throw Error('SDK saved explicit rejection not established');
 }
}
