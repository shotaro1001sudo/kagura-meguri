import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

export function valuecommerceGASTests({ok,section}){
  section("Apps Script: Cloudプロジェクト新規作成なしで非公開Sheetsに月次集計");
  const source=readFileSync("scripts/apps-script/valuecommerce-sheet-sync.gs","utf8");
  ok(!/(^|\s)(eval|fetch)\s*\(/.test(source),"危険なevalや汎用fetchを使わない");
  ok(!/GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON/.test(source),"サービスアカウント鍵やGoogle Cloudプロジェクト設定が不要");
  const cells=Array.from({length:25},()=>Array(14).fill(""));
  const fetches=[],logs=[],triggers=[];
  let writes=0,requestFail=false;
  const context={
    Map,Date,Number,Object,Array,String,Math,LockService:{
      getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})
    },
    PropertiesService:{
      getScriptProperties:()=>({getProperty:(name)=>({
        VC_CLIENT_KEY:"example-key",VC_CLIENT_SECRET:"example-secret"}[name])})
    },
    Utilities:{
      base64Encode:s=>Buffer.from(s,"utf8").toString("base64"),
      formatDate:(date,tz,pattern)=>{
        if(pattern==="yyyy-MM-dd")return date.toLocaleDateString("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"});
        if(pattern==="yyyy-MM-dd HH:mm:ss")return date.toLocaleString("sv-SE",{timeZone:tz,hour12:false}).replace(" "," ");
        throw Error("unexpected pattern");
      },
    },
    UrlFetchApp:{fetch:(url,params)=>{
      fetches.push({url,params});
      if(requestFail)return {getResponseCode:()=>401,getContentText:()=>JSON.stringify({error:"bad"})};
      const token=url.includes("/auth/")?{bearer_token:"test-token"}:undefined;
      const data=token?{rowData:token}:{rowData:[],responseInfo:{nextOffset:-1}};
      return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({resultSet:data})};
    }},
    SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:name=>{
      if(name!=="11_VC月次成果")throw Error("wrong sheet");
      return {getRange:(r,c,h,w)=>({
        getValues:()=>cells.map(row=>[...row]),
        setValues:matrix=>{
          writes++;
          if(r!==2||c!==1||h!==25||w!==14)throw Error("wrong write range");
          for(let i=0;i<25;i++)cells[i]=[...matrix[i]];
        },
      })};
    }})},
    ScriptApp:{
      getProjectTriggers:()=>triggers,
      deleteTrigger:t=>{const i=triggers.indexOf(t);if(i>=0)triggers.splice(i,1)},
      newTrigger:handler=>{
        const t={getHandlerFunction:()=>handler};
        const chain={
          timeBased:()=>chain,
          atHour:()=>chain,
          everyDays:()=>chain,
          inTimezone:()=>chain,
          create:()=>{triggers.push(t);return t;}
        };return chain;
      }
    },
    console:{log:s=>logs.push(String(s)),error:s=>logs.push(String(s))},
  };
  runInNewContext(source,context);
  ok(context.vcMonthWindow_("2026-10-21",0).to==="2026-10-21"&&
     context.vcMonthWindow_("2026-10-21",1).to==="2026-09-30"&&
     context.vcMonthWindow_("2026-10-21",24).from==="2024-10-01","25か月の月窓・JST月境界を正しく作る");
  const fixed={month:"2026-10",from:"2026-10-01",to:"2026-10-21"};
  const orders=[{affilId:3784232,orderDate:"2026-10-01 10:00:00",transactionOid:1,approvalStatus:"A",affilPayment:300},
    {affilId:3784232,orderDate:"2026-10-01 12:00:00",transactionOid:2,approvalStatus:"P",affilPayment:20},
    {affilId:9999999,orderDate:"2026-10-01 12:00:00",transactionOid:3,approvalStatus:"I",affilPayment:4000}];
  const row=context.vcAggregate_(orders,fixed,"2026-10-21 09:00:00");
  ok(row[0]==="2026-10"&&row[1]===1&&row[2]===20&&row[3]===1&&row[4]===300&&row[9]===2&&row[10]===300,"別サイトを除外しP/A/C/I別合計を出す");
  context.dailyValueCommerceSync();
  ok(writes===1&&fetches.length===5&&cells.length===25&&cells.filter(r=>r[0]).length===4,"4か月分だけAPI照会し一括で書く");
  ok(cells.filter(r=>r[0]).every(r=>r[9]===0&&r[12].includes("入金未照合")),"取得済み0件と入金未確認を分ける");
  ok(!logs.join(" ").includes("example-secret")&&!logs.join(" ").includes("test-token"),"認証情報・トークンをログに書かない");
  const before=writes;
  requestFail=true;
  try{context.dailyValueCommerceSync()}catch(_){}
  ok(writes===before,"APIエラーでSheetsを上書きしない");
  context.createDailyTrigger();context.createDailyTrigger();
  ok(triggers.length===1,"日次トリガーの二重登録を防ぐ");
  context.stopDailyTrigger();
  ok(triggers.length===0,"日次トリガー停止機能");
}
