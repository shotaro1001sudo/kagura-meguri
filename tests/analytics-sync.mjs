import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const code=readFileSync("scripts/apps-script/analytics-sheet-sync.gs","utf8");
function harness() {
  const props={},tabs=new Map(),calls=[],triggers=[];
  let released=0;
  const diagnostics=[];
  const state={coerceOverallId:false,coerceDates:false,sheetZone:"Asia/Tokyo",brokenRunRead:false,gaFailure:false,gaMetrics:{},funnelRows:undefined,funnelRowCount:undefined,funnelStatus:false,deviceRows:undefined,deviceStatus:200,brokenFunnelRead:false,gscStatus:200,pageStatus:200,pageRows:undefined,brokenPageRead:false,empty:false,zone:"Asia/Tokyo",query:"=private_formula()",brokenRead:false};
  const ss={getSpreadsheetTimeZone:()=>state.sheetZone,getId:()=>"13wwhjxbh9SH0xMXpd8uhNGgiCTv6gJ52qEBNMB-x8vY",getSheetByName:name=>tabs.get(name),insertSheet(name){
    const s={values:[],maxRows:1000,getLastRow(){return this.values.length;},getMaxRows(){return this.maxRows;},
      insertRowsAfter(_at,count){this.maxRows+=count;},setFrozenRows(){},getRange(r,c,n,width){return {
        getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:width},(_,j)=>{
          let value=s.values[r-1+i]?.[c-1+j]??"";
          const field=s.values[0]?.[c-1+j];
          if(state.coerceDates && r-1+i>0 && ["date","from","to","fetched_at_JST"].includes(field) && typeof value==='string' && /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/.test(value)) {
            const offset=state.sheetZone==='Asia/Tokyo'?'+09:00':'-07:00';
            value=new FixedDate(value.replace(' ','T')+(value.length===10?'T00:00:00':'')+offset);
          }
          if(state.coerceOverallId && name==='14_計測実行' && r-1+i>0 && c-1+j===0 && typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) value=new FixedDate(value+'T00:00:00'+(state.sheetZone==='Asia/Tokyo'?'+09:00':'-07:00'));
          if(state.brokenRunRead && name==='14_計測実行' && r-1+i>0 && c-1+j===3)return 'corrupt';
          if(state.brokenFunnelRead&&name==="13_計測内訳"&&s.values[r-1+i]?.[2]==="page_event"&&j===7)return "corrupt";
          if(state.brokenPageRead&&name==="13_計測内訳"&&s.values[r-1+i]?.[2]==="page"&&s.values[r-1+i]?.[1]==="GSC"&&j===7)return "corrupt";
          return state.brokenRead&&name==="12_計測日次"&&r===1&&i===1&&j===4?"corrupt":value;
        })),
        setValues(rows){rows.forEach((row,i)=>{s.values[r-1+i]??=[];row.forEach((v,j)=>{s.values[r-1+i][c-1+j]=v;});});},
        clearContent(){s.values.splice(r-1,n);},setWrap(){}
      };}
    };tabs.set(name,s);return s;
  }};
  class FixedDate extends Date { constructor(...args){super(...(args.length?args:['2026-10-23T22:30:00Z']));} }
  const context={Map,Date:FixedDate,Number,Array,JSON,Object,String,encodeURIComponent,console:{error:msg=>diagnostics.push(msg)},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>{props[k]=v;}})},
    SpreadsheetApp:{getActiveSpreadsheet:()=>ss,flush(){}},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){released++;}})},
    Utilities:{formatDate(date,zone,pattern){
      const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).map(x=>[x.type,x.value]));
      const day=parts.year+'-'+parts.month+'-'+parts.day,time=parts.hour+':'+parts.minute+':'+parts.second;
      return pattern==='HH:mm:ss'?time:pattern.includes('HH')?day+' '+time:day;
    }},
    AnalyticsData:{Properties:{runReport(request){
      calls.push({source:"GA4",request});
      if(state.gaFailure)throw new Error("403 Permission denied: secret-response-token");
      const dimension=request.dimensions[0].name,funnel=request.dimensions.length===2;
      if(funnel&&state.funnelStatus)throw new Error("403 secret-response");
      const value={date:"20261020",sessionSourceMedium:"google / organic",deviceCategory:"mobile",pagePath:"/",eventName:"page_view"}[dimension];
      return {dimensionHeaders:request.dimensions,metricHeaders:request.metrics,rows:funnel&&state.funnelRows!==undefined?state.funnelRows:state.empty?[]:[{
        dimensionValues:request.dimensions.map(d=>({value:d.name==="eventName"&&funnel?"affiliate_click":value})),metricValues:request.metrics.map(m=>({value:dimension==="sessionSourceMedium"&&m.name in state.gaMetrics?state.gaMetrics[m.name]:m.name==="engagementRate"?"0.5":"1"}))
      }],rowCount:funnel&&state.funnelRowCount!==undefined?state.funnelRowCount:state.empty?0:1,metadata:{timeZone:state.zone}};
    }}},
    ScriptApp:{getOAuthToken:()=>"secret-oauth-token",getProjectTriggers:()=>triggers,
      newTrigger(handler){const builder={timeBased(){return this;},inTimezone(zone){this.zone=zone;return this;},
        atHour(hour){this.hour=hour;return this;},everyDays(days){this.days=days;return this;},create(){
          triggers.push({getHandlerFunction:()=>handler,zone:this.zone,hour:this.hour,days:this.days});return triggers.at(-1);
        }};return builder;}
    },
    UrlFetchApp:{fetch(_url,options){
      const request=JSON.parse(options.payload);calls.push({source:"GSC",request});
      const kind=request.dimensions[0],value=kind==="date"?"2026-10-20":kind==="page"?"https://kagurameguri.jp/guide.html":kind==="device"?"MOBILE":state.query;
      return {getResponseCode:()=>kind==="page"?state.pageStatus:kind==="device"?state.deviceStatus:state.gscStatus,getContentText:()=>JSON.stringify({rows:kind==="device"&&state.deviceRows!==undefined?state.deviceRows:kind==="page"&&state.pageRows!==undefined?state.pageRows:state.empty?[]:[{keys:[value],clicks:1,impressions:10,ctr:0.1,position:5}]})};
    }}
  };
  runInNewContext(code,context);
  const ready=()=>{props.KAGURA_ANALYTICS_FREE_CONFIRMED="yes";props.KAGURA_GA4_PROPERTY_ID="123456";};
  const run=()=>{try{return context.dailyKaguraAnalyticsSync();}catch(error){return {error:error.message};}};
  const records=name=>tabs.get(name)?.values.slice(1)||[];
  const log=id=>records("14_計測実行").find(row=>row[0]===id);
  return {props,tabs,calls,triggers,state,context,ss,ready,run,records,log,diagnostics,get released(){return released;}};
}

export function analyticsSyncTests({ok,section}) {
  section("分析保存: 独立取得・保存照合・エラー診断・日次制御");
  for(const zone of ['Asia/Tokyo','America/Los_Angeles']) {
    const dates=harness();dates.ready();dates.state.coerceDates=true;dates.state.sheetZone=zone;
    ok(dates.run().status==='success',`日付/日時のDate読戻をシート時間帯で照合 ${zone}`);
    const count=dates.calls.length;
    ok(dates.run().status==='success'&&dates.calls.length===count,`Date履歴再読込でも同日重複抑止 ${zone}`);
    ok(dates.records('13_計測内訳').some(r=>r[2]==='page_event')&&dates.records('13_計測内訳').some(r=>r[1]==='GSC'&&r[2]==='device'),'追加内訳まで保存する');
  }
  for(const zone of ['Asia/Tokyo','America/Los_Angeles']) {
    const ids=harness();ids.ready();ids.state.coerceDates=true;ids.state.coerceOverallId=true;ids.state.sheetZone=zone;
    ok(ids.run().status==='success'&&ids.props.KAGURA_ANALYTICS_LAST_SUCCESS==='2026-10-24',`全体IDがDateでも全体readbackを確認 ${zone}`);
    const before=ids.calls.length;ids.run();
    ok(ids.calls.length===before&&ids.records('14_計測実行').filter(r=>r[0]==='2026-10-24').length===1,`旧Date IDを同じキーに正規化し全体行重複なし ${zone}`);
    ok(ids.records('14_計測実行').some(r=>r[0]==='2026-10-24-GA4')&&ids.records('14_計測実行').some(r=>r[0]==='2026-10-24-GSC'),'媒体別IDのsuffix維持');
  }
  const ids=harness(),DId=ids.context.Date,header=['ID','status','fetched_at_JST','notes'];
  const cmpId=(id,name='14_計測実行')=>ids.context.kaguraComparable_([header,[id,'success','2026-10-24 07:30:00','verified']],header,'Asia/Tokyo',name);
  ok(cmpId(new DId('2026-10-23T15:00:00Z'))===cmpId('2026-10-24'),'全体IDの暦日はJSTで照合');
  ok(cmpId(new DId('2026-10-23T15:00:00Z'))!==cmpId('2026-10-25'),'別日のIDは不一致');
  ok(cmpId(new DId('2026-10-23T15:00:00Z'))!==cmpId('2026-10-24-GA4'),'Date IDと媒体suffix IDは不一致');
  ok(cmpId(46319)!==cmpId('46319'),'数値IDと文字列IDを同一視しない');
  ok(cmpId(new DId('2026-10-23T15:00:00Z'),'12_計測日次')!==cmpId('2026-10-24','12_計測日次'),'別シートのIDは日付正規化しない');
  for(const raw of ['invalid','2026-10-23T15:00:01Z','2026-10-23T15:00:00.001Z']) {let rejected=false;try{cmpId(new DId(raw));}catch(_){rejected=true;}ok(rejected,'不正/非0時/ミリ秒IDを拒否 '+raw);}
  const retryId=harness();retryId.ready();retryId.run();
  const ledger=retryId.tabs.get('14_計測実行'),DateId=retryId.context.Date;
  ledger.values.find(r=>r[0]==='2026-10-24')[0]=new DateId('2026-10-23T15:00:00Z');
  ledger.values.push(['2026-10-24','success','2026-10-24 07:30:00','unverified duplicate']);
  ledger.values.push([new DateId('2026-10-22T15:00:00Z'),'error','2026-10-23 07:30:00','historical']);
  delete retryId.props.KAGURA_ANALYTICS_LAST_SUCCESS;
  retryId.state.coerceOverallId=true;retryId.state.coerceDates=true;
  const requestCount=retryId.calls.length;
  ok(retryId.run().status==='success'&&retryId.calls.length===requestCount&&retryId.props.KAGURA_ANALYTICS_LAST_SUCCESS==='2026-10-24','媒体成功/全体未確認からAPI再取得なしで全体readback成功後にガード更新');
  ok(retryId.records('14_計測実行').filter(r=>r[0]==='2026-10-24').length===1&&retryId.records('14_計測実行').some(r=>r[0]==='2026-10-23'&&r[3]==='historical'),'Dateと文字列の同日IDを更新で集約し別日の履歴を保持');
  delete retryId.props.KAGURA_ANALYTICS_LAST_SUCCESS;retryId.state.brokenRunRead=true;
  ok(retryId.run().error==='SHEET_READBACK_MISMATCH'&&!retryId.props.KAGURA_ANALYTICS_LAST_SUCCESS&&retryId.calls.length===requestCount,'全体記録に本当の不一致があればガード未更新、API再取得なし');
  const cmp=harness(),compare=(rows,header)=>cmp.context.kaguraComparable_(rows,header,'Asia/Tokyo');
  const D=cmp.context.Date;
  ok(compare([['date'],[new D('2026-10-19T15:00:00Z')]],['date'])===compare([['date'],['2026-10-20']],['date']),'UTC前日でも日付はシート暦日を保持');
  ok(compare([['fetched_at_JST'],[new D('2026-10-23T22:30:00Z')]],['fetched_at_JST'])!==compare([['fetched_at_JST'],['2026-10-24 07:30:01']],['fetched_at_JST']),'日時1秒差は不一致');
  ok(compare([['sessions'],[1]],['sessions'])!==compare([['sessions'],['1']],['sessions']),'数値と文字列を同一視しない');
  ok(compare([['dimension'],["'=SUM(1)"]],['dimension'])===compare([['dimension'],['=SUM(1)']],['dimension']),'数式escapeの既存比較を保持');
  let nonMidnight=false;try{compare([['date'],[new D('2026-10-20T01:00:00Z')]],['date']);}catch(_){nonMidnight=true;}
  ok(nonMidnight,'日付欄の余計な時刻を切り捨てない');
  let invalidDate=false;try{compare([['date'],[new D('invalid')]],['date']);}catch(_){invalidDate=true;}
  ok(invalidDate,'不正Dateを空欄やnullとして受理しない');
  ok(compare([['dimension'],[new D('2026-10-19T15:00:00Z')]],['dimension'])!==compare([['dimension'],['2026-10-20']],['dimension']),'日付正規化をdimension列へ拡張しない');
  const corruptedDates=harness();corruptedDates.ready();corruptedDates.state.coerceDates=true;corruptedDates.state.brokenPageRead=true;
  ok(corruptedDates.run().error==='SYNC_PARTIAL'&&!corruptedDates.props.KAGURA_ANALYTICS_LAST_SUCCESS_GSC&&corruptedDates.props.KAGURA_ANALYTICS_LAST_SUCCESS_GA4,'Date正規化後も実データ破損は成功にしない');
  const logging=harness();logging.ready();logging.state.gaFailure=true;logging.state.brokenRunRead=true;
  ok(logging.run().error==='SHEET_READBACK_MISMATCH'&&logging.calls.some(c=>c.source==='GSC'),'エラー記録の不一致でもGSC取得へ進み、全体を成功としない');
  ok(!logging.props.KAGURA_ANALYTICS_LAST_SUCCESS_GA4&&!logging.props.KAGURA_ANALYTICS_LAST_SUCCESS_GSC&&!logging.props.KAGURA_ANALYTICS_LAST_SUCCESS,'実行記録が壊れた場合は成功ガードを更新しない');
  ok(logging.diagnostics.length===2&&!logging.diagnostics.join().includes('secret')&&logging.released===1,'安全な原因コードだけ診断しロック解放');
  const h=harness();
  ok(!h.context.checkKaguraAnalyticsSetup().readyForOwnerTest&&h.calls.length===0,"設定診断はAPIを呼ばない");
  ok(h.run().error==="FREE_SETUP_NOT_CONFIRMED"&&h.calls.length===0&&h.log("2026-10-24")[1]==="setup_required","無料条件未確認を実行台帳に記録しAPIを止める");
  h.props.KAGURA_ANALYTICS_FREE_CONFIRMED="yes";
  ok(h.run().error==="PROPERTY_ID_REQUIRED"&&h.calls.length===0,"プロパティ未設定もAPIなしで理由を区別する");
  h.ready();
  ok(h.run().status==="success"&&h.calls.length===10,"1回の正常実行は10読取で成功");
  const daily=h.records("12_計測日次"),ga=daily.find(r=>r[0]==="GA4-2026-10-20"),gsc=daily.find(r=>r[0]==="GSC-2026-10-20");
  ok(daily.length===56&&ga[4]===1&&gsc[4]===""&&gsc[8]===1,"28日×2媒体を別定義で保存");
  ok(ga[3]==="Asia/Tokyo"&&gsc[3]==="America/Los_Angeles","GA4とGSCの異なる時間帯を保持");
  const missing=daily.find(r=>r[0]==="GA4-2026-10-23");
  ok(missing[4]===""&&missing[12].includes("not_returned"),"未返却日を明示して0アクセスと混同しない");
  ok(h.calls.find(c=>c.source==="GSC").request.endDate==="2026-10-22"&&h.calls[0].request.dateRanges[0].endDate==="2026-10-23","GSCのPT前日とGA4のプロパティ前日を使う");
  h.run();ok(h.calls.length===10,"同日成功済みの媒体を再取得しない");
  const details=h.records("13_計測内訳");
  const pageRequest=h.calls.find(c=>c.source==="GSC"&&c.request.dimensions[0]==="page").request;
  ok(JSON.stringify(pageRequest)==='{"startDate":"2026-09-25","endDate":"2026-10-22","dimensions":["page"],"type":"web","dataState":"final","rowLimit":1000}',"GSC page単独・PTの28日・final・最大1000件、追加filter/paginationなし");
  ok(h.calls.filter(c=>c.source==="GSC").map(c=>c.request.dimensions.join()).join()==="date,query,page,device","既存date/queryとpageを別要求にし、query×pageを取得しない");
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
  ok(partial.calls.filter(c=>c.source==="GA4").length===6&&partial.calls.filter(c=>c.source==="GSC").length===5,"再実行では失敗した媒体だけ取得");

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
  ok(config.calls.filter(c=>c.source==="GA4").length===12,"プロパティ設定変更時に別プロパティの成功記録を流用しない");
  config.props.KAGURA_GA4_PROPERTY_ID="777777";rejected=false;
  try{config.context.installKaguraAnalyticsDailyTrigger();}catch(_){rejected=true;}
  ok(rejected,"設定変更後に旧プロパティの成功でトリガーを作らない");
  const wrongSheet=harness();wrongSheet.ready();wrongSheet.ss.getId=()=>"another-sheet";
  ok(wrongSheet.run().error==="BOUND_SHEET_REQUIRED"&&wrongSheet.calls.length===0,"指定以外のSheetへデータを保存しない");

  section("GSCページ内訳: 上限・失敗・置換・読戻");
  const pageRow=(url="https://kagurameguri.jp/guide.html")=>({keys:[url],clicks:1,impressions:10,ctr:0.1,position:5});
  const capped=harness();capped.ready();capped.state.pageRows=Array.from({length:1000},(_,i)=>pageRow("https://kagurameguri.jp/events/test-"+i+".html"));
  ok(capped.run().status==="success"&&capped.calls.length===10&&capped.records("13_計測内訳").filter(r=>r[1]==="GSC"&&r[2]==="page").length===1000,"1000ページでも追加ページングせず1回で保存する");
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
  ok(readback.run().status==="success"&&readback.calls.filter(c=>c.source==="GA4").length===6&&readback.calls.filter(c=>c.source==="GSC").length===8&&readback.records("13_計測内訳").filter(r=>r[1]==="GSC"&&r[2]==="page").length===1,"読戻失敗後はGSCだけ再取得し、pageを重複させず回復する");

  section("意思決定用内訳: 流入元品質・固定ページ導線・検索端末");
  const sourceReq=h.calls.find(c=>c.source==="GA4"&&c.request.dimensions[0].name==="sessionSourceMedium").request;
  ok(sourceReq.metrics.map(m=>m.name).join()==="sessions,engagedSessions,engagementRate"&&sourceReq.dimensions.length===1,"流入元の既存1要求に品質2指標だけを追加する");
  const sourceRow=details.find(r=>r[1]==="GA4"&&r[2]==="source");
  ok(sourceRow[7]==="[1,1,0.5]"&&sourceRow[8].includes("schema=2"),"sourceの旧sessions先頭を維持し、3指標の順序とschemaを明示");
  const funnelReq=h.calls.find(c=>c.source==="GA4"&&c.request.dimensions.length===2).request;
  const filters=funnelReq.dimensionFilter.andGroup.expressions.map(e=>e.filter),pages=filters[0].inListFilter.values,events=filters[1].inListFilter.values;
  ok(funnelReq.dimensions.map(d=>d.name).join()==="pagePath,eventName"&&funnelReq.metrics.map(m=>m.name).join()==="eventCount"&&funnelReq.limit===1000&&funnelReq.dateRanges[0].startDate==="2026-09-26"&&funnelReq.dateRanges[0].endDate==="2026-10-23","ページ別導線はGA4時間帯28日・標準2dimension・eventCount・1000件上限");
  ok(filters.map(f=>f.fieldName).join()==="pagePath,eventName"&&filters.every(f=>f.inListFilter.caseSensitive)&&events.join()==="official_link_click,affiliate_click,affiliate_view","API側で既存の公式/広告イベントだけをcase-sensitive完全一致で限定");
  const regular=JSON.parse(readFileSync('data/regular.json','utf8')).map(r=>'/regular/'+r.id+'.html');
  const fixed=['/','/index.html','/guide.html','/experiences.html','/weekend.html','/this-month.html','/map.html','/calendar.html','/kagura/index.html',...regular];
  ok(pages.length===15&&new Set(pages).size===pages.length&&pages.every(p=>fixed.includes(p)),"許可パスはrepoの固定ページと実在定期公演だけで任意slugを含まない");
  const browser=readFileSync('scripts/client/analytics-events.js','utf8')+readFileSync('scripts/client/affiliate.js','utf8');
  ok(events.every(e=>browser.includes(e))&&!JSON.stringify(funnelReq).includes('pageLocation'),"新規イベントやフルURL・利用者IDの要求を追加しない");
  const funnelRow=details.find(r=>r[2]==="page_event");
  ok(funnelRow[0]==='GA4-page_event-2026-10-23-["/","affiliate_click"]'&&funnelRow[6]==='["/","affiliate_click"]'&&funnelRow[7]==='[1]'&&funnelRow[8].includes('not users or conversions'),"page_eventはJSONの複合dimension/IDで衝突を避け、イベント件数を人数や成約と区別");
  const deviceReq=h.calls.find(c=>c.source==="GSC"&&c.request.dimensions[0]==="device").request;
  ok(deviceReq.dimensions.length===1&&deviceReq.startDate==='2026-09-25'&&deviceReq.endDate==='2026-10-22'&&deviceReq.dataState==='final'&&deviceReq.type==='web'&&deviceReq.rowLimit===1000,"GSC deviceはPTの28日・final・webの単独集約");
  const deviceRow=details.find(r=>r[1]==='GSC'&&r[2]==='device');
  ok(deviceRow[0]==='GSC-device-2026-10-22-MOBILE'&&deviceRow[7]==='[1,10,0.1,5]'&&deviceRow[8].includes('not additive'),"GSC端末4指標とGA4端末sessionsを別媒体・別IDで保持");
  const optional=harness();optional.ready();optional.state.gaMetrics={engagedSessions:null,engagementRate:''};
  ok(optional.run().status==='success'&&optional.records('13_計測内訳').find(r=>r[2]==='source')[7]==='[1,null,null]'&&optional.log('2026-10-24-GA4')[3].includes('optional_metrics_missing (not zero)'),"任意品質指標の値欠損はnullと注記で保存し、sessionsや0と取り違えない");
  for(const metrics of [{sessions:null},{engagedSessions:'NaN'},{engagedSessions:'-1'},{engagedSessions:'2'},{engagementRate:'1.1'},{engagementRate:'Infinity'}]) {
    const invalid=harness();invalid.ready();invalid.state.gaMetrics=metrics;
    ok(invalid.run().error==='SYNC_PARTIAL'&&!invalid.props.KAGURA_ANALYTICS_LAST_SUCCESS_GA4&&invalid.props.KAGURA_ANALYTICS_LAST_SUCCESS_GSC&&invalid.log('2026-10-24-GA4')[3].includes('GA4_METRIC_INVALID'),"必須sessions欠損・不正品質指標ではGA4を成功にせずGSC保存を継続");
  }
  const route=(path='/',event='affiliate_click',value='1')=>({dimensionValues:[{value:path},{value:event}],metricValues:[{value}]});
  for(const rows of [[route('/guide.html?email=secret')],[route('/user/private-name.html')],[route('/events/private-name.html')],[route('/%67uide.html')],[route('/','purchase')],[route('/','affiliate_click',null)],[route(),route()]]) {
    const invalid=harness();invalid.ready();invalid.state.funnelRows=rows;
    ok(invalid.run().error==='SYNC_PARTIAL'&&!invalid.props.KAGURA_ANALYTICS_LAST_SUCCESS_GA4&&invalid.records('13_計測内訳').every(r=>r[1]==='GSC')&&!JSON.stringify(invalid.records('14_計測実行')).includes('private-name'),"返却側もパス/イベント/指標/複合ID重複を検証し、不正値を保存・ログ出力しない");
  }
  const replace=harness();replace.ready();replace.run();
  const gscSnapshot=JSON.stringify(replace.records('13_計測内訳').filter(r=>r[1]==='GSC'));
  replace.props.KAGURA_ANALYTICS_LAST_SUCCESS_GA4='';replace.state.funnelRows=[route('/guide.html','affiliate_click','2'),route('/guide.html','affiliate_view','3')];replace.state.gaMetrics={sessions:'4',engagedSessions:'2',engagementRate:'0.5'};
  ok(replace.run().status==='success'&&replace.records('13_計測内訳').filter(r=>r[2]==='page_event').length===2&&replace.records('13_計測内訳').find(r=>r[2]==='source')[7]==='[4,2,0.5]'&&JSON.stringify(replace.records('13_計測内訳').filter(r=>r[1]==='GSC'))===gscSnapshot,'sourceを同じIDで更新し古いpage_eventを置換、GSC原本を保持');
  const emptyNew=harness();emptyNew.ready();emptyNew.state.funnelRows=[];emptyNew.state.deviceRows=[];
  ok(emptyNew.run().status==='success'&&emptyNew.records('13_計測内訳').every(r=>r[2]!=='page_event'&&!(r[1]==='GSC'&&r[2]==='device'))&&emptyNew.log('2026-10-24-GA4')[3].includes('page_event:')&&emptyNew.log('2026-10-24-GSC')[3].includes('missing devices are not zero; CTR/position are not additive; no_rows'),'新内訳が空でも日次があればsuccess、架空0行を作らずno_rowsを記録');
  for(const rows of [[pageRow('PHONE')],[pageRow('mobile')],[pageRow('MOBILE'),pageRow('MOBILE')],[{...pageRow('TABLET'),ctr:2}]]) {
    const invalid=harness();invalid.ready();invalid.state.deviceRows=rows;
    ok(invalid.run().error==='SYNC_PARTIAL'&&invalid.props.KAGURA_ANALYTICS_LAST_SUCCESS_GA4&&!invalid.props.KAGURA_ANALYTICS_LAST_SUCCESS_GSC&&invalid.log('2026-10-24-GSC')[3].includes('GSC_SCHEMA_INVALID'),'GSC端末は3種の列挙値・重複なし・正しい数値だけを保存');
  }
  const failNew=harness();failNew.ready();failNew.run();const saved=JSON.stringify(failNew.records('13_計測内訳'));
  failNew.props.KAGURA_ANALYTICS_LAST_SUCCESS_GA4='';failNew.state.funnelStatus=true;
  ok(failNew.run().error==='SYNC_PARTIAL'&&JSON.stringify(failNew.records('13_計測内訳'))===saved&&failNew.calls.filter(c=>c.source==='GSC').length===4,'page_event要求失敗ではGA4の旧スナップショットを保持し成功済みGSCを再取得しない');
  const corruptFunnel=harness();corruptFunnel.ready();corruptFunnel.state.brokenFunnelRead=true;
  ok(corruptFunnel.run().error==='SYNC_PARTIAL'&&!corruptFunnel.props.KAGURA_ANALYTICS_LAST_SUCCESS_GA4&&corruptFunnel.props.KAGURA_ANALYTICS_LAST_SUCCESS_GSC&&corruptFunnel.log('2026-10-24-GA4')[3].includes('SHEET_READBACK_MISMATCH'),'複合dimension行のreadback不一致でも成功ガードを進めない');
  corruptFunnel.state.brokenFunnelRead=false;
  ok(corruptFunnel.run().status==='success'&&corruptFunnel.records('13_計測内訳').filter(r=>r[2]==='page_event').length===1&&corruptFunnel.calls.filter(c=>c.source==='GA4').length===12&&corruptFunnel.calls.filter(c=>c.source==='GSC').length===4,'読戻失敗はGA4だけ上限内で再取得し、重複なく回復する');
  const truncated=harness();truncated.ready();truncated.state.funnelRowCount=1001;
  ok(truncated.run().status==='success'&&truncated.records('13_計測内訳').find(r=>r[2]==='page_event')[8].includes('truncated')&&truncated.calls.length===10,'GA4返却件数が総行数より少なければ打切り注記、追加ページングなし');
  const deviceFailure=harness();deviceFailure.ready();deviceFailure.run();const prior=JSON.stringify(deviceFailure.records('13_計測内訳'));
  deviceFailure.props.KAGURA_ANALYTICS_LAST_SUCCESS_GSC='';deviceFailure.state.deviceStatus=429;
  ok(deviceFailure.run().error==='SYNC_PARTIAL'&&JSON.stringify(deviceFailure.records('13_計測内訳'))===prior&&deviceFailure.log('2026-10-24-GSC')[3].includes('GSC_HTTP_429')&&deviceFailure.calls.filter(c=>c.source==='GA4').length===6,'device要求失敗でもGSC旧行を保持しGA4成功と取得回数を維持');
  let badHeader=false;
  try{h.context.kaguraReportRows_({dimensionHeaders:[{name:'sessionSourceMedium'}],metricHeaders:[{name:'sessions'}],rows:[]},['sessionSourceMedium'],['sessions','engagedSessions','engagementRate'],['engagedSessions','engagementRate']);}catch(_){badHeader=true;}
  ok(badHeader,'任意指標でも列定義欠落はschemaエラーとし、旧配列を新schemaとして誤読しない');
}
