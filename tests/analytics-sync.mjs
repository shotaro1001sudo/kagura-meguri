import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const code=readFileSync("scripts/apps-script/analytics-sheet-sync.gs","utf8");
function harness() {
  const props={},tabs=new Map(),calls=[],triggers=[];
  let released=0;
  const state={gaFailure:false,gscStatus:200,empty:false,zone:"Asia/Tokyo",query:"=private_formula()",brokenRead:false};
  const ss={getId:()=>"13wwhjxbh9SH0xMXpd8uhNGgiCTv6gJ52qEBNMB-x8vY",getSheetByName:name=>tabs.get(name),insertSheet(name){
    const s={values:[],maxRows:1000,getLastRow(){return this.values.length;},getMaxRows(){return this.maxRows;},
      insertRowsAfter(_at,count){this.maxRows+=count;},setFrozenRows(){},getRange(r,c,n,width){return {
        getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:width},(_,j)=>{
          const value=s.values[r-1+i]?.[c-1+j]??"";
          return state.brokenRead&&name==="12_計測日次"&&r===1&&i===1&&j===4?"corrupt":value;
        })),
        setValues(rows){rows.forEach((row,i)=>{s.values[r-1+i]??=[];row.forEach((v,j)=>{s.values[r-1+i][c-1+j]=v;});});},
        clearContent(){s.values.splice(r-1,n);},setWrap(){}
      };}
    };tabs.set(name,s);return s;
  }};
  const context={Map,Date,Number,Array,JSON,Object,String,encodeURIComponent,
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>{props[k]=v;}})},
    SpreadsheetApp:{getActiveSpreadsheet:()=>ss,flush(){}},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){released++;}})},
    Utilities:{formatDate(_date,zone,pattern){
      if(pattern.includes("HH"))return "2026-10-24 07:30:00";
      return zone==="America/Los_Angeles"?"2026-10-23":"2026-10-24";
    }},
    AnalyticsData:{Properties:{runReport(request){
      calls.push({source:"GA4",request});
      if(state.gaFailure)throw new Error("403 Permission denied: secret-response-token");
      const dimension=request.dimensions[0].name;
      const value={date:"20261020",sessionSourceMedium:"google / organic",deviceCategory:"mobile",pagePath:"/",eventName:"page_view"}[dimension];
      return {dimensionHeaders:request.dimensions,metricHeaders:request.metrics,rows:state.empty?[]:[{
        dimensionValues:[{value}],metricValues:request.metrics.map(m=>({value:m.name==="engagementRate"?"0.5":"1"}))
      }],rowCount:state.empty?0:1,metadata:{timeZone:state.zone}};
    }}},
    ScriptApp:{getOAuthToken:()=>"secret-oauth-token",getProjectTriggers:()=>triggers,
      newTrigger(handler){const builder={timeBased(){return this;},inTimezone(zone){this.zone=zone;return this;},
        atHour(hour){this.hour=hour;return this;},everyDays(days){this.days=days;return this;},create(){
          triggers.push({getHandlerFunction:()=>handler,zone:this.zone,hour:this.hour,days:this.days});return triggers.at(-1);
        }};return builder;}
    },
    UrlFetchApp:{fetch(_url,options){
      const request=JSON.parse(options.payload);calls.push({source:"GSC",request});
      const value=request.dimensions[0]==="date"?"2026-10-20":state.query;
      return {getResponseCode:()=>state.gscStatus,getContentText:()=>JSON.stringify({rows:state.empty?[]:[{keys:[value],clicks:1,impressions:10,ctr:0.1,position:5}]})};
    }}
  };
  runInNewContext(code,context);
  const ready=()=>{props.KAGURA_ANALYTICS_FREE_CONFIRMED="yes";props.KAGURA_GA4_PROPERTY_ID="123456";};
  const run=()=>{try{return context.dailyKaguraAnalyticsSync();}catch(error){return {error:error.message};}};
  const records=name=>tabs.get(name)?.values.slice(1)||[];
  const log=id=>records("14_計測実行").find(row=>row[0]===id);
  return {props,tabs,calls,triggers,state,context,ss,ready,run,records,log,get released(){return released;}};
}

export function analyticsSyncTests({ok,section}) {
  section("分析保存: 独立取得・保存照合・エラー診断・日次制御");
  const h=harness();
  ok(!h.context.checkKaguraAnalyticsSetup().readyForOwnerTest&&h.calls.length===0,"設定診断はAPIを呼ばない");
  ok(h.run().error==="FREE_SETUP_NOT_CONFIRMED"&&h.calls.length===0&&h.log("2026-10-24")[1]==="setup_required","無料条件未確認を実行台帳に記録しAPIを止める");
  h.props.KAGURA_ANALYTICS_FREE_CONFIRMED="yes";
  ok(h.run().error==="PROPERTY_ID_REQUIRED"&&h.calls.length===0,"プロパティ未設定もAPIなしで理由を区別する");
  h.ready();
  ok(h.run().status==="success"&&h.calls.length===7,"1回の正常実行は7読取で成功");
  const daily=h.records("12_計測日次"),ga=daily.find(r=>r[0]==="GA4-2026-10-20"),gsc=daily.find(r=>r[0]==="GSC-2026-10-20");
  ok(daily.length===56&&ga[4]===1&&gsc[4]===""&&gsc[8]===1,"28日×2媒体を別定義で保存");
  ok(ga[3]==="Asia/Tokyo"&&gsc[3]==="America/Los_Angeles","GA4とGSCの異なる時間帯を保持");
  const missing=daily.find(r=>r[0]==="GA4-2026-10-23");
  ok(missing[4]===""&&missing[12].includes("not_returned"),"未返却日を明示して0アクセスと混同しない");
  ok(h.calls.find(c=>c.source==="GSC").request.endDate==="2026-10-22"&&h.calls[0].request.dateRanges[0].endDate==="2026-10-23","GSCのPT前日とGA4のプロパティ前日を使う");
  h.run();ok(h.calls.length===7,"同日成功済みの媒体を再取得しない");
  const details=h.records("13_計測内訳");
  ok(details.some(r=>r[6]==="'=private_formula()"),"検索語の数式注入を防止");
  h.props.KAGURA_ANALYTICS_LAST_SUCCESS_GA4="";h.props.KAGURA_ANALYTICS_LAST_SUCCESS_GSC="";
  h.run();ok(h.records("13_計測内訳").length===details.length,"媒体の最新内訳を置換し日々の同じ28日分を蓄積しない");
  ok(h.records("14_計測実行").filter(r=>r[0]==="2026-10-24-GA4").length===1,"同日再取得は元の実行IDを更新");

  const partial=harness();partial.ready();partial.state.gscStatus=403;
  ok(partial.run().error==="SYNC_PARTIAL"&&partial.props.KAGURA_ANALYTICS_LAST_SUCCESS_GA4==="2026-10-24"&&!partial.props.KAGURA_ANALYTICS_LAST_SUCCESS_GSC,"GSC失敗でもGA4を保存し全体はpartial");
  ok(partial.log("2026-10-24-GSC")[3].includes("GSC_HTTP_403")&&!JSON.stringify(partial.records("14_計測実行")).includes("secret"),"HTTP原因を安全なコードで残しトークン/応答本文を残さない");
  partial.state.gscStatus=200;partial.run();
  ok(partial.calls.filter(c=>c.source==="GA4").length===5&&partial.calls.filter(c=>c.source==="GSC").length===3,"再実行では失敗した媒体だけ取得");

  const failed=harness();failed.ready();failed.state.gaFailure=true;failed.state.gscStatus=429;
  failed.run();failed.run();const count=failed.calls.length;failed.run();
  ok(failed.calls.length===count&&failed.log("2026-10-24-GSC")[3].includes("DAILY_ATTEMPT_LIMIT"),"媒体別の失敗試行は1日2回までで停止");
  ok(failed.released===3,"失敗時にもロックを解放");

  const mismatch=harness();mismatch.ready();mismatch.state.zone="UTC";
  ok(mismatch.run().error==="SYNC_PARTIAL"&&mismatch.log("2026-10-24-GA4")[3].includes("GA4_TIMEZONE_MISMATCH")&&mismatch.props.KAGURA_ANALYTICS_LAST_SUCCESS_GSC,"GA4時間帯不一致は保存せずGSCは継続");
  const empty=harness();empty.ready();empty.state.empty=true;
  ok(empty.run().status==="no_data"&&empty.records("12_計測日次").every(r=>r[4]===""&&r[8]===""),"空応答はno_dataとして保存し0で埋めない");
  ok(empty.run().status==="no_data","成功ガード後も空応答をsuccessへ誤変換しない");

  const corrupt=harness();corrupt.ready();corrupt.state.brokenRead=true;
  ok(corrupt.run().error==="SYNC_PARTIAL"&&!corrupt.props.KAGURA_ANALYTICS_LAST_SUCCESS_GA4,"書込後の読戻不一致では成功時刻を進めない");
  const headers=harness();headers.ready();headers.ss.insertSheet("12_計測日次").values=[["wrong"]];
  ok(headers.run().error==="DESTINATION_INVALID"&&headers.calls.length===0&&headers.log("2026-10-24")[3]==="SHEET_HEADERS_MISMATCH","保存先の列不一致はAPI取得前に台帳へ記録");
  let rejected=false;try{h.context.kaguraReportRows_({dimensionHeaders:[{name:"date"}],metricHeaders:[{name:"sessions"}],rows:[{dimensionValues:[{value:"20261020"}],metricValues:[{value:"NaN"}]}]},["date"],["sessions"]);}catch(_){rejected=true;}
  ok(rejected,"不正な数値を0へ変換しない");
  const trigger=harness();trigger.ready();rejected=false;
  try{trigger.context.installKaguraAnalyticsDailyTrigger();}catch(_){rejected=true;}
  ok(rejected&&trigger.triggers.length===0,"初回の両媒体保存成功前にトリガーを作らない");
  trigger.run();trigger.triggers.push({getHandlerFunction:()=>"dailyValueCommerceSync"});
  trigger.context.installKaguraAnalyticsDailyTrigger();trigger.context.installKaguraAnalyticsDailyTrigger();
  ok(trigger.triggers.length===2&&trigger.triggers[1].zone==="Asia/Tokyo"&&trigger.triggers[1].hour===7&&trigger.triggers[1].days===1,"本人起動のトリガー設定は日次7時台で冪等、VCトリガーを維持");
  const config=harness();config.ready();config.run();config.props.KAGURA_GA4_PROPERTY_ID="999999";config.run();
  ok(config.calls.filter(c=>c.source==="GA4").length===10,"プロパティ設定変更時に別プロパティの成功記録を流用しない");
  config.props.KAGURA_GA4_PROPERTY_ID="777777";rejected=false;
  try{config.context.installKaguraAnalyticsDailyTrigger();}catch(_){rejected=true;}
  ok(rejected,"設定変更後に旧プロパティの成功でトリガーを作らない");
  const wrongSheet=harness();wrongSheet.ready();wrongSheet.ss.getId=()=>"another-sheet";
  ok(wrongSheet.run().error==="BOUND_SHEET_REQUIRED"&&wrongSheet.calls.length===0,"指定以外のSheetへデータを保存しない");
}
