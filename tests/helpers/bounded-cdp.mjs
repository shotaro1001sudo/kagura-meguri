// Test transport only: no browser state or network policy changes.
export function boundedCdp(write,{timeoutMs=8000,checkpoint=()=>{}}={}) {
 let serial=0;const pending=new Map();
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
  const id=++serial,entry={id,method,sessionId:sessionId||'browser'};
  checkpoint({...entry,phase:'start'});
  const timer=setTimeout(()=>{pending.delete(id);checkpoint({...entry,phase:'timeout'});reject(Error(`CDP timeout ${method} id=${id} after ${timeoutMs}ms`));},timeoutMs);
  pending.set(id,{resolve,reject,timer,entry});
  try{write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));}catch(e){clearTimeout(timer);pending.delete(id);reject(e);}
 });
 const receive=m=>{const p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);checkpoint({...p.entry,phase:m.error?'error':'complete'});m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);};
 const close=()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('CDP connection closed'));}pending.clear();};
 return {send,receive,close};
}
