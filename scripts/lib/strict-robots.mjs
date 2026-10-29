import { robotsAllows } from './util.mjs';
// New sources fail closed for access denial/network errors; 404 means no file.
export async function strictRobotsAllows(url, ua, fetchImpl=fetch) {
  let failure='';
  const result=await robotsAllows(url,ua,async (u,opts)=>{
    try {
      const res=await fetchImpl(u,{...opts,signal:AbortSignal.timeout(15000)});
      if(!res.ok && res.status!==404 && res.status!==410) failure=`robots.txt HTTP ${res.status}`;
      if(res.url && new URL(res.url).origin!==new URL(u).origin) failure='robots.txt の別サイト転送';
      return res;
    } catch { failure='robots.txt 取得失敗'; throw Error(failure); }
  });
  return failure?{ok:false,reason:failure}:result;
}
