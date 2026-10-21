// ValueCommerce monthly aggregate: never log or persist credentials, tokens or order rows.
// Only anonymous month/status counts and summed publisher remuneration go to a private Google Sheet.
import { createSign } from "node:crypto";
import { pathToFileURL } from "node:url";

export const VC_TOKEN_URL = "https://api.valuecommerce.com/auth/v1/affiliate/token/?grant_type=client_credentials";
export const VC_REPORT_URL = "https://api.valuecommerce.com/report/v3/affiliate/transaction/";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
export const TARGET_TAB = "11_VC月次成果";
export const HEADER = ["注文月","保留件数","保留報酬見込円","承認件数","承認報酬円","拒否件数","拒否報酬円","請求済件数","請求済報酬円","注文件数合計","承認・請求済参考報酬円","取得日時JST","確認状態","根拠"];

export function jstDate(now) {
  return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0,10);
}
export function monthWindows(now, count = 25) {
  if(!Number.isInteger(count)||count<1||count>25) throw new Error("集計月数が不正です");
  const today=jstDate(now), [year, month]=today.split("-").map(Number);
  return Array.from({length:count},(_,n)=>{
    const first = new Date(Date.UTC(year,month-1-n,1));
    const y=first.getUTCFullYear(),m=first.getUTCMonth()+1;
    const start = first.toISOString().slice(0,10);
    const last = new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);
    return {month:start.slice(0,7),from:start,to:last>today?today:last};
  });
}

async function fetchJson(fetcher,url,options) {
  let resp;
  try {
    resp = await fetcher(url,{...options,redirect:"error",signal:AbortSignal.timeout(20000)});
  } catch { throw new Error("ネットワーク障害またはタイムアウト"); }
  if (!resp?.ok) throw new Error("HTTP " + (Number.isInteger(resp?.status) ? resp.status : "error"));
  try {
    const json=await resp.json();
    if(!json||json.error||!json.resultSet) throw new Error("invalid");
    return json.resultSet;
  } catch {
    throw new Error("API応答形式エラー");
  }
}
async function valueCommerceToken(fetcher,key,secret) {
  if (!key||!secret) throw new Error("ValueCommerce Secrets未設定");
  const authorization="Bearer "+Buffer.from(key+"|"+secret,"utf8").toString("base64");
  const response=await fetchJson(fetcher,VC_TOKEN_URL,{headers:{Authorization:authorization,Accept:"application/json"}});
  const token=response.rowData?.bearer_token;
  if(typeof token!=="string"||token.length===0) throw new Error("トークン応答形式エラー");
  return token;
}

export async function fetchMonthOrders(fetcher,token,{from,to},{maxPages=8,limit=1000}={}) {
  const seen=new Map();
  let offset=0;
  for(let page=0;page<maxPages;page++){
    const url=new URL(VC_REPORT_URL);
    for(const [k,v] of Object.entries({
      criteria:"o",from_date:from,to_date:to,approval_status:"p,a,c,i",
      via_ad:"true",via_vpc:"false",limit:String(limit),offset:String(offset),
      field:"transactionOid,affilId,orderDate,approvalStatus,affilPayment,updDate",
    }))url.searchParams.set(k,v);
    const data=await fetchJson(fetcher,url.toString(),{headers:{Authorization:"Bearer "+token,Accept:"application/json"}});
    const orders=data.rowData??[];
    if(!Array.isArray(orders))throw new Error("注文レポート形式エラー");
    for(const item of orders){
      const id=item?.transactionOid;
      if(typeof id!=="number"&&typeof id!=="string")throw new Error("注文識別子形式エラー");
      const site=String(item.affilId??"");
      const key=site+"|"+String(id);
      const prev=seen.get(key);
      if(!prev||String(item.updDate||"")>=String(prev.updDate||""))seen.set(key,item);
    }
    const next=data.responseInfo?.nextOffset??data.nextOffset;
    if(next===-1||next==="-1") return [...seen.values()];
    if(next===undefined&&orders.length<limit) return [...seen.values()];
    if(!Number.isInteger(Number(next))||Number(next)<=offset)throw new Error("ページ位置エラー");
    offset=Number(next);
  }
  throw new Error("ページ数上限。部分集計を保存しません");
}

export function aggregateMonth(orders,expectedSiteId,window,checkedAt) {
  const totals={P:{n:0,yen:0},A:{n:0,yen:0},C:{n:0,yen:0},I:{n:0,yen:0}};
  for(const item of orders){
    if(String(item.affilId)!==String(expectedSiteId))continue;
    if(typeof item.orderDate!=="string"||item.orderDate.slice(0,7)!==window.month)
      throw new Error("注文月の不整合");
    const status=String(item.approvalStatus??"").toUpperCase(),s=totals[status];
    if(!s)throw new Error("未知の注文ステータス");
    const amount=item.affilPayment;
    if((typeof amount!=="number"&&typeof amount!=="string")||
       amount===""||!Number.isFinite(Number(amount)))
      throw new Error("報酬額形式エラー");
    s.n++;s.yen+=Number(amount);
  }
  const x=Object.values(totals);
  const totalOrders=x.reduce((a,y)=>a+y.n,0);
  const entitled=totals.A.yen+totals.I.yen; // not necessarily paid
  return [
    window.month,totals.P.n,totals.P.yen,totals.A.n,totals.A.yen,
    totals.C.n,totals.C.yen,totals.I.n,totals.I.yen,totalOrders,entitled,
    checkedAt,"API取得済み・入金未照合",
    "https://pub-docs.valuecommerce.ne.jp/docs/as-78-order-report-api/",
  ];
}

function jwtServiceAccount(service,now) {
  if(service.type!=="service_account"||!service.client_email||!service.private_key)
    throw new Error("Google認証設定形式エラー");
  const iat=Math.floor(now.getTime()/1000), exp=iat+3000;
  const encode=(obj)=>Buffer.from(JSON.stringify(obj)).toString("base64url");
  const head=encode({alg:"RS256",typ:"JWT"});
  const claims=encode({iss:service.client_email,scope:SHEETS_SCOPE,aud:GOOGLE_TOKEN_URL,iat,exp});
  const unsigned=head+"."+claims;
  const signer=createSign("RSA-SHA256");
  signer.update(unsigned);signer.end();
  return unsigned+"."+signer.sign(service.private_key).toString("base64url");
}
async function googleToken(fetcher,credentialText,now) {
  let service;
  try {service=JSON.parse(credentialText);} catch {throw new Error("Google認証設定形式エラー");}
  const assertion=jwtServiceAccount(service,now);
  let response;
  try {
    response=await fetcher(GOOGLE_TOKEN_URL,{
      method:"POST",redirect:"error",signal:AbortSignal.timeout(20000),
      headers:{"Content-Type":"application/x-www-form-urlencoded",Accept:"application/json"},
      body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion}).toString(),
    });
  } catch {throw new Error("Google認証の通信失敗");}
  if(!response?.ok)throw new Error("Google認証HTTP "+response?.status);
  let payload;
  try{payload=await response.json()}catch{throw new Error("Google認証応答形式エラー")}
  if(typeof payload?.access_token!=="string")throw new Error("Google認証応答形式エラー");
  return payload.access_token;
}
async function writeSummary(fetcher,token,sheetId,rows) {
  if(!/^[A-Za-z0-9_-]{20,}$/.test(sheetId))throw new Error("Sheets ID形式エラー");
  const url="https://sheets.googleapis.com/v4/spreadsheets/"+encodeURIComponent(sheetId)+"/values:batchUpdate";
  let response;
  try {
    response=await fetcher(url,{
      method:"POST",redirect:"error",signal:AbortSignal.timeout(20000),
      headers:{Authorization:"Bearer "+token,"Content-Type":"application/json",Accept:"application/json"},
      body:JSON.stringify({valueInputOption:"RAW",data:[{range:"'"+TARGET_TAB+"'!A2:N26",values:rows}]}),
    });
  } catch {throw new Error("Sheets更新の通信失敗");}
  if(!response?.ok)throw new Error("Sheets更新HTTP "+response?.status);
  // Not printing or reading response JSON: only a success indicator.
}

export async function runSync({
  fetcher=globalThis.fetch,
  now=new Date(),
  config=process.env,
  months=25,
}={}) {
  const {VALUECOMMERCE_CLIENT_KEY:key,VALUECOMMERCE_CLIENT_SECRET:secret,
    GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON:credential,GOOGLE_SHEETS_SPREADSHEET_ID:sheetId,
    VALUECOMMERCE_SITE_ID:siteId}=config;
  // Fail closed: never fetch private orders unless the private write target is configured.
  if(!credential||!sheetId||!siteId)throw new Error("プライベート保存先の設定が未完了");
  const googleAccess=await googleToken(fetcher,credential,now);
  const token=await valueCommerceToken(fetcher,key,secret);
  const windows=monthWindows(now,months);
  const at=jstDate(now)+" "+new Date(now.getTime()+9*3600000).toISOString().slice(11,19);
  const rows=[];
  for(const w of windows){
    const orders=await fetchMonthOrders(fetcher,token,w);
    rows.push(aggregateMonth(orders,siteId,w,at));
  }
  // Only commit once ALL months have been completely checked.
  await writeSummary(fetcher,googleAccess,sheetId,rows);
  return {months:rows.length}; // never return individual orders/amounts
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  runSync().then(r=>console.log("ValueCommerce月次成果の非公開Sheets同期が完了しました。対象月数: "+r.months))
    .catch(()=>{console.error("同期未完了。認証・取得・保存のいずれかを確認してください（秘密情報・成果値は非表示）。");process.exitCode=1;});
}
