import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const code=readFileSync("scripts/apps-script/analytics-sheet-sync.gs","utf8");
function harness() {
  const props={},tabs=new Map(),calls=[],triggers=[];
  let released=0;
  const state={gaFailure:false,gscStatus:200,pageStatus:200,pageRows:undefined,brokenPageRead:false,empty:false,zone:"Asia/Tokyo",query:"=private_formula()",brokenRead:false};
  const ss={getId:()=>"13wwhjxbh9SH0xMXpd8uhNGgiCTv6gJ52qEBNMB-x8vY",getSheetByName:name=>tabs.get(name),insertSheet(name){
    const s={values:[],maxRows:1000,getLastRow(){return this.values.length;},getMaxRows(){return this.maxRows;},
      insertRowsAfter(_at,count){this.maxRows+=count;},setFrozenRows(){},getRange(r,c,n,width){return {
        getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:width},(_,j)=>{
          const value=s.values[r-1+i]?.[c-1+j]??"";
          if(state.brokenPageRead&&name==="13_計測内訳"&&s.values[r-1+i]?.[2]==="page"&&s.values[r-1+i]?.[1]==="GSC"&&j===7)return "corrupt";
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
      const kind=request.dimensions[0],value=kind==="date"?"2026-10-20":kind==="page"?"https://kagurameguri.jp/guide.html":state.query;
      return {getResponseCode:()=>kind==="page"?state.pageStatus:state.gscStatus,getContentText:()=>JSON.stringify({rows:kind==="page"&&state.pageRows!==undefined?state.pageRows:state.empty?[]:[{keys:[value],clicks:1,impressions:10,ctr:0.1,position:5}]})};
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
  ok(h.run().status==="success"&&h.calls.length===8,"1回の正常実行は8読取で成功");
  const daily=h.records("12_計測日次"),ga=daily.find(r=>r[0]==="GA4-2026-10-20"),gsc=daily.find(r=>r[0]==="GSC-2026-10-20");
  ok(daily.length===56&&ga[4]===1&&gsc[4]===""&&gsc[8]===1,"28日×2媒体を別定義で保存");
  ok(ga[3]==="Asia/Tokyo"&&gsc[3]==="America/Los_Angeles","GA4とGSCの異なる時間帯を保持");
  const missing=daily.find(r=>r[0]==="GA4-2026-10-23");
  ok(missing[4]===""&&missing[12].includes("not_returned"),"未返却日を明示して0アクセスと混同しない");
  ok(h.calls.find(c=>c.source==="GSC").request.endDate==="2026-10-22"&&h.calls[0].request.dateRanges[0].endDate==="2026-10-23","GSCのPT前日とGA4のプロパティ前日を使う");
  h.run();ok(h.calls.length===8,"同日成功済みの媒体を再取得しない");
  const details=h.records("13_計測内訳");
  const pageRequest=h.calls.find(c=>c.source==="GSC"&&c.request.dimensions[0]==="page").request;
  ok(JSON.stringify(pageRequest)==='{"startDate":"2026-09-25","endDate":"2026-10-22","dimensions":["page"],"type":"web","dataState":"final","rowLimit":1000}',"GSC page単独・PTの28日・final・最大1000件、追加filter/paginationなし");
  ok(h.calls.filter(c=>c.source==="GSC").map(c=>c.request.dimensions.join()).join()==="date,query,page","既存date/queryとpageを別要求にし、query×pageを取得しない");
  const page=details.find(r=>r[1]==="GSC"&&r[2]==="page");
  ok(page[0]==="GSC-page-2026-10-22-https://kagurameguri.jp/guide.html"&&page[3]==="2026-09-25"&&page[4]==="2026-10-22"&&page[5]==="America/Los_Angeles"&&page[7]==="[1,10,0.1,5]","page専用IDとURL・期間・時間帯・4指標を既存内訳列へ保存");
  ok(page[8].includes("page aggregation differs from property totals")&&h.log("2026-10-24-GSC")[3].includes("page:")&&h.log("2026-10-24-GSC")[3].includes("saved/readback verified"),"ページ集約と全体の差を注記し、page取得と保存読戻を実行記録へ残す");
  ok(details.some(r=>r[6]==="'=private_formula()"),"検索語の数式注入を防止");
  h.props.KAGURA_ANALYTICS_LAST_SUCCESS_GA4="";h.props.KAGURA_ANALYTICS_LAST_SUCCESS_GSC="";
  h.run();ok(h.records("13_計測内訳").length===details.length,"媒体の最新内訳を置換し日々の同じ28日分を蓄積しない");
  ok(h.records("14_計測実行").filter(r=>r[0]==="2026-10-24-GA4").length===1,"同日再取得は元の実行IDを更新");

  const partial=harness();partial.ready();partial.state.gscStatus=403;
  ok(partial.run().error==="SYNC_PARTIAL"&&partial.props.KAGURA_ANALYTICS_LAST_SUCCESS_GA4==="2026-10-24"&&!partial.props.KAGURA_ANALYTICS_LAST_SUCCESS_GSC,"GSC失敗でもGA4を保存し全体はpartial");
  ok(partial.log("2026-10-24-GSC")[3].includes("GSC_HTTP_403")&&!JSON.stringify(partial.records("14_計測実行")).includes("secret"),"HTTP原因を安全なコードで残しトークン/応答本文を残さない");
  partial.state.gscStatus=200;partial.run();
  ok(partial.calls.filter(c=>c.source==="GA4").length===5&&partial.calls.filter(c=>c.source==="GSC").length===4,"再実行では失敗した媒体だけ取得");

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

  section("GSCページ内訳: 上限・失敗・置換・読戻");
  const pageRow=(url="https://kagurameguri.jp/guide.html")=>({keys:[url],clicks:1,impressions:10,ctr:0.1,position:5});
  const capped=harness();capped.ready();capped.state.pageRows=Array.from({length:1000},(_,i)=>pageRow("https://kagurameguri.jp/events/test-"+i+".html"));
  ok(capped.run().status==="success"&&capped.calls.length===8&&capped.records("13_計測内訳").filter(r=>r[1]==="GSC"&&r[2]==="page").length===1000,"1000ページでも追加ページングせず1回で保存する");
  ok(capped.log("2026-10-24-GSC")[3].includes("limit reached; completeness not guaranteed")&&capped.records("13_計測内訳").filter(r=>r[1]==="GSC"&&r[2]==="page").every(r=>r[8].includes("limit reached")),"上限到達を行と実行ログの両方に残し、全件とは扱わない");
  const gaSnapshot=JSON.stringify(capped.records("13_計測内訳").filter(r=>r[1]==="GA4"));
  const historicalDaily=[...capped.records("12_計測日次").find(r=>r[1]==="GSC")];historicalDaily[0]="GSC-2026-08-01";historicalDaily[2]="2026-08-01";
  const historicalRun=["2026-08-02-GSC","success","2026-08-02 07:30:00","saved/readback verified"];
  capped.tabs.get("12_計測日次").values.push(historicalDaily);capped.tabs.get("14_計測実行").values.push(historicalRun);
  capped.props.KAGURA_ANALYTICS_LAST_SUCCESS_GSC="";capped.state.pageRows=[];
  ok(capped.run().status==="success"&&capped.records("13_計測内訳").filter(r=>r[1]==="GSC"&&r[2]==="page").length===0,"page空応答でも日次があれば媒体success、古い1000ページを清掃して0行へ置換");
  ok(capped.log("2026-10-24-GSC")[3].includes("missing pages are not zero; no_rows")&&JSON.stringify(capped.records("13_計測内訳").filter(r=>r[1]==="GA4"))===gaSnapshot&&capped.records("13_計測内訳").some(r=>r[1]==="GSC"&&r[2]==="query"),"空pageは0指標を捏造せず、GA4とGSC queryは維持");
  ok(JSON.stringify(capped.records("12_計測日次").find(r=>r[0]===historicalDaily[0]))===JSON.stringify(historicalDaily)&&JSON.stringify(capped.log(historicalRun[0]))===JSON.stringify(historicalRun),"page最新置換でも期間外の日次履歴・過去日の実行記録は保持");
  const pageFailure=harness();pageFailure.ready();pageFailure.run();
  const oldDaily=JSON.stringify(pageFailure.records("12_計測日次")),oldDetails=JSON.stringify(pageFailure.records("13_計測内訳"));
  pageFailure.props.KAGURA_ANALYTICS_LAST_SUCCESS_GSC="";pageFailure.state.pageStatus=403;
  ok(pageFailure.run().error==="SYNC_PARTIAL"&&!pageFailure.props.KAGURA_ANALYTICS_LAST_SUCCESS_GSC&&pageFailure.props.KAGURA_ANALYTICS_LAST_SUCCESS_GA4==="2026-10-24","pageだけ失敗した場合もGSC全体を未確認とし、GA4成功を維持");
  ok(JSON.stringify(pageFailure.records("12_計測日次"))===oldDaily&&JSON.stringify(pageFailure.records("13_計測内訳"))===oldDetails&&pageFailure.log("2026-10-24-GSC")[3].includes("GSC_HTTP_403"),"page取得失敗は既存GSC日次/query/pageを置換せず、エラーを記録");
  const attempts=pageFailure.calls.length;pageFailure.run();ok(pageFailure.calls.length===attempts,"page失敗も同じ媒体別2回上限に含め、自動再試行を増やさない");
  for(const rows of [[pageRow("")],[pageRow("not-a-url")],[pageRow(null)],[pageRow("https://other.test/")],[pageRow("https://kagurameguri.jp/ bad")],[{...pageRow(),clicks:null}],[{...pageRow(),keys:[]}],[pageRow(),pageRow()],[null],Array.from({length:1001},(_,i)=>pageRow("https://kagurameguri.jp/"+i))]) {
    const invalid=harness();invalid.ready();invalid.state.pageRows=rows;
    ok(invalid.run().error==="SYNC_PARTIAL"&&invalid.log("2026-10-24-GSC")[3].includes("GSC_SCHEMA_INVALID")&&!invalid.props.KAGURA_ANALYTICS_LAST_SUCCESS_GSC&&invalid.records("13_計測内訳").every(r=>r[1]==="GA4"),"不正pageのキー・指標・重複・過剰行を成功や0に変換しない");
  }
  const readback=harness();readback.ready();readback.state.brokenPageRead=true;
  ok(readback.run().error==="SYNC_PARTIAL"&&readback.props.KAGURA_ANALYTICS_LAST_SUCCESS_GA4&&!readback.props.KAGURA_ANALYTICS_LAST_SUCCESS_GSC&&readback.log("2026-10-24-GSC")[3].includes("SHEET_READBACK_MISMATCH"),"page保存の読戻不一致はGSC成功を更新せずGA4を保持");
  readback.state.brokenPageRead=false;
  ok(readback.run().status==="success"&&readback.calls.filter(c=>c.source==="GA4").length===5&&readback.calls.filter(c=>c.source==="GSC").length===6&&readback.records("13_計測内訳").filter(r=>r[1]==="GSC"&&r[2]==="page").length===1,"読戻失敗後はGSCだけ再取得し、pageを重複させず回復する");
}
