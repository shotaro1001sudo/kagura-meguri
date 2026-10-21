import { generateKeyPairSync } from "node:crypto";
import { monthWindows, fetchMonthOrders, aggregateMonth, runSync } from "../scripts/valuecommerce-monthly-sync.mjs";

export async function valuecommerceSummaryTests({ok,section}) {
  section("ValueCommerce→非公開Google Sheets：月次集計と漏えい防止");
  const now=new Date("2026-10-21T09:00:00Z");
  const months=monthWindows(now,2);
  ok(months[0].month==="2026-10"&&months[0].to==="2026-10-21"&&months[1].month==="2026-09"&&months[1].to==="2026-09-30","JSTの月初・月末を正確に分離");

  const one={transactionOid:1,affilId:3784232,orderDate:"2026-10-20 10:00:00",approvalStatus:"A",affilPayment:105,updDate:"2026-10-20 10:00:00"};
  const duplicate={...one,approvalStatus:"I",updDate:"2026-10-21 10:00:00"};
  const seen=[];
  const get=async(url)=>{
    const u=new URL(url);seen.push(u);
    const offset=Number(u.searchParams.get("offset")||0);
    return {ok:true,json:async()=>({resultSet:{
      rowData:offset===0?[one]:[duplicate],
      responseInfo:{nextOffset:offset===0?1:-1},
    }})};
  };
  const rows=await fetchMonthOrders(get,"test-bearer",{from:"2026-10-01",to:"2026-10-21"},{limit:1,maxPages:3});
  ok(rows.length===1&&rows[0].approvalStatus==="I"&&seen.length===2,"注文IDと更新日時で重複を除去、ページ送りにも対応");
  ok(seen.every(u=>u.searchParams.get("field")==="transactionOid,affilId,orderDate,approvalStatus,affilPayment,updDate"),"注文詳細や顧客情報を要求しない");
  const agg=aggregateMonth([one,{...one,transactionOid:2,approvalStatus:"P",affilPayment:20},
    {...one,transactionOid:3,approvalStatus:"C",affilPayment:5},
    {...one,affilId:987654,transactionOid:4,affilPayment:99999}],3784232,months[0],"2026-10-21 18:00:00");
  ok(agg[0]==="2026-10"&&agg[1]===1&&agg[2]===20&&agg[3]===1&&agg[4]===105&&agg[5]===1&&agg[6]===5&&agg[9]===3&&agg[10]===105,"状態ごとの件数・金額を集計し他サイト分は除外");
  let rejected=false;
  try{aggregateMonth([{...one,affilPayment:"unknown"}],3784232,months[0],"x");}
  catch{rejected=true;}
  ok(rejected,"不明な金額は0円に置換せず取得失敗扱い");

  let calls=0;
  try{await runSync({now,fetcher:async()=>{calls++;throw Error("no");},config:{}});}
  catch{}
  ok(calls===0,"非公開保存先の認証がなければAPIへ一切問い合わせない");

  const privateKey=generateKeyPairSync("rsa",{modulusLength:2048,privateKeyEncoding:{type:"pkcs8",format:"pem"},publicKeyEncoding:{type:"spki",format:"pem"}}).privateKey;
  const service=JSON.stringify({type:"service_account",client_email:"unit-test@example.iam.gserviceaccount.com",private_key:privateKey});
  let sheetRows,reportCalls=0,successLog="";
  const fetcher=async(url,opt)=>{
    if(url.startsWith("https://oauth2.googleapis.com/token"))return{ok:true,json:async()=>({access_token:"google-test-token"})};
    if(url.startsWith("https://api.valuecommerce.com/auth"))return{ok:true,json:async()=>({resultSet:{rowData:{bearer_token:"vc-test-token"}}})};
    if(url.startsWith("https://api.valuecommerce.com/report/")){
      reportCalls++;
      const month=new URL(url).searchParams.get("from_date")?.slice(0,7);
      return{ok:true,json:async()=>({resultSet:{rowData:month==="2026-10"?[one,{...one,transactionOid:5,approvalStatus:"I",affilPayment:35}]:[],responseInfo:{nextOffset:-1}}})};
    }
    if(url.startsWith("https://sheets.googleapis.com/")){
      sheetRows=JSON.parse(opt.body);
      successLog="private-write";
      return{ok:true};
    }
    throw Error("unexpected destination");
  };
  const synced=await runSync({now,months:2,fetcher,config:{
    VALUECOMMERCE_CLIENT_KEY:"mock-key",VALUECOMMERCE_CLIENT_SECRET:"mock-secret",
    VALUECOMMERCE_SITE_ID:"3784232",GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON:service,
    GOOGLE_SHEETS_SPREADSHEET_ID:"1234567890abcdefghijklmnopqrstuv",
  }});
  ok(synced.months===2&&reportCalls===2&&successLog==="private-write","全月分取得後に1回だけSheetsへ書き込む");
  const posted=sheetRows?.data?.[0]?.values;
  ok(posted?.length===2&&posted[0][10]===140&&posted[0][9]===2&&posted[1][9]===0&&sheetRows.valueInputOption==="RAW","25か月集計設計の読み書きを模擬。請求済みを入金済みに誤認しない");

  let didWrite=false;
  const deny=async(url)=> {
    if(url.includes("oauth2.googleapis.com"))return{ok:true,json:async()=>({access_token:"google-test-token"})};
    if(url.includes("/auth/"))return{ok:true,json:async()=>({resultSet:{rowData:{bearer_token:"vc-test-token"}}})};
    if(url.includes("/report/"))throw Error("network");
    didWrite=true;return{ok:true};
  };
  let failed=false;
  try{await runSync({now,months:1,fetcher:deny,config:{
    VALUECOMMERCE_CLIENT_KEY:"a",VALUECOMMERCE_CLIENT_SECRET:"b",VALUECOMMERCE_SITE_ID:"3784232",
    GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON:service,GOOGLE_SHEETS_SPREADSHEET_ID:"1234567890abcdefghijklmnopqrstuv",
  }});}catch{failed=true;}
  ok(failed&&!didWrite,"API失敗時は部分的な成果数値を一切保存しない");
}
