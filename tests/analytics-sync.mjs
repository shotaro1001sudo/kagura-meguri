import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

export function analyticsSyncTests({ ok, section }) {
  section("分析保存: 実測・欠損・重複・無料確認ゲート");
  const script=readFileSync("scripts/apps-script/analytics-sheet-sync.gs","utf8");
  const props={}, apiCalls=[], tabs=new Map();
  const ss={getSheetByName:name=>tabs.get(name),insertSheet(name){
    const s={values:[],getLastRow(){return this.values.length;},setFrozenRows(){},getRange(_r,_c,n){
      return {getValues:()=>s.values.slice(0,n),setValues:rows=>{s.values=rows;},setWrap(){}};
    }}; tabs.set(name,s);return s;
  }};
  const context={Map,Date,Number,Array,JSON,Object,String,encodeURIComponent,
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>{props[k]=v;}})},
    SpreadsheetApp:{getActiveSpreadsheet:()=>ss,flush(){}},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
    Utilities:{formatDate(date,zone,pattern){
      if(pattern.includes("HH"))return "2026-10-23 08:00:00";
      return zone==="America/Los_Angeles"?"2026-10-22":"2026-10-23";
    }},
    AnalyticsData:{Properties:{runReport(request){
      apiCalls.push(request);
      return {dimensionHeaders:request.dimensions,metricHeaders:request.metrics,
        rows:request.dimensions[0].name==="date"?[{dimensionValues:[{value:"20261020"}],
          metricValues:request.metrics.map(()=>({value:"1"}))}]:[],rowCount:1,metadata:{timeZone:"Asia/Tokyo"}};
    }}},
    ScriptApp:{getOAuthToken:()=>"never-log-this"},
    UrlFetchApp:{fetch(_url,options){apiCalls.push(JSON.parse(options.payload));return {
      getResponseCode:()=>200,getContentText:()=>JSON.stringify({rows:[{keys:["2026-10-20"],clicks:1,impressions:10,ctr:0.1,position:5}]})};}}
  };
  runInNewContext(script,context);
  let blocked=false; try {context.dailyKaguraAnalyticsSync();}catch(_){blocked=true;}
  ok(blocked && apiCalls.length===0,"無料条件未確認ならAPIを一切呼ばない");
  props.KAGURA_ANALYTICS_FREE_CONFIRMED="yes";
  blocked=false; try {context.dailyKaguraAnalyticsSync();}catch(_){blocked=true;}
  ok(blocked && apiCalls.length===0,"プロパティID未設定でもAPIを呼ばない");
  props.KAGURA_GA4_PROPERTY_ID="123456";
  context.dailyKaguraAnalyticsSync();
  ok(apiCalls.length===7,"日次実行は7回の読取に上限を固定");
  const daily=tabs.get("12_計測日次").values;
  ok(daily.length===3 && daily[1][4]===1 && daily[2][4]==="" && daily[2][8]===1,
    "GA4/GSCを別行・別定義で保存し未取得を0で埋めない");
  ok(daily[1][3]==="Asia/Tokyo" && daily[2][3]==="America/Los_Angeles",
    "GA4のプロパティ時間帯とGSCのPT時間帯を保持");
  context.dailyKaguraAnalyticsSync();
  ok(apiCalls.length===7,"成功済みの日は二重取得しない");
  ok(context.kaguraSafeCell_("=IMPORTXML(secret)").startsWith("'") && context.kaguraSafeCell_(4)===4,
    "検索語の数式注入を防ぎ数値型を保持");
  context.kaguraUpsert_(ss,"check",["id","value"],[["a",1]]);
  context.kaguraUpsert_(ss,"check",["id","value"],[["a",2]]);
  ok(tabs.get("check").values.length===2 && tabs.get("check").values[1][1]===2,
    "同じIDの再集計は上書きし重複行を増やさない");
  blocked=false;try{context.kaguraReportRows_({dimensionHeaders:[{name:"date"}],metricHeaders:[{name:"sessions"}],
    rows:[{dimensionValues:[{value:"20261020"}],metricValues:[{value:"NaN"}]}]},["date"],["sessions"]);}catch(_){blocked=true;}
  ok(blocked,"不正な数値をゼロに変換せず保存前に止める");
  props.KAGURA_ANALYTICS_LAST_SUCCESS="";
  context.UrlFetchApp.fetch=()=>({getResponseCode:()=>403});
  const oldDaily=JSON.stringify(tabs.get("12_計測日次").values);
  blocked=false;try{context.dailyKaguraAnalyticsSync();}catch(error){blocked=!error.message.includes("never-log-this");}
  ok(blocked && oldDaily===JSON.stringify(tabs.get("12_計測日次").values) && !props.KAGURA_ANALYTICS_LAST_SUCCESS,
    "API失敗時は既存記録を壊さず成功扱いせず秘密をログに出さない");
}
