// Test harness only. No query values, cookie values or response bodies are recorded.
export function createCmpRequestPolicy({enabled=false,maxConsentLogs=4}={}) {
 let continuedLogs=0;
 return ({url,method,live=false,redirected=false})=>{
  let u;try{u=new URL(url);}catch{return {allow:false};}
  const log=u.origin==='https://consent.cookiebot.com'&&u.pathname==='/logconsent.ashx'&&!u.username&&!u.password;
  if(log){
   const allow=enabled&&live&&method==='GET'&&!redirected&&continuedLogs<maxConsentLogs;
   if(allow)continuedLogs++;
   return {allow,consentLog:true,ordinal:continuedLogs,limit:maxConsentLogs};
  }
  // Reject redirects, including redirects from the log endpoint to another CMP resource.
  return {allow:live&&!redirected&&method==='GET'&&u.protocol==='https:'&&['consent.cookiebot.com','consentcdn.cookiebot.com','imgsct.cookiebot.com'].includes(u.hostname)&&!u.username&&!u.password&&!u.port&&!/logconsent|collect|\/log(?:\.|\/)/i.test(u.pathname)};
 };
}
