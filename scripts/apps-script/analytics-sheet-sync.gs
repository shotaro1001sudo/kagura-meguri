/** GA4/GSC -> existing PRIVATE bound Sheet. Deployment never runs this script.
 * Require owner-confirmed no-billing setup, explicit read-only OAuth scopes and
 * API enablement. Preserve existing VC functions/scopes/triggers. Never log tokens.
 */
const KAGURA_ANALYTICS_SYNC = Object.freeze({
  SPREADSHEET_ID: "13wwhjxbh9SH0xMXpd8uhNGgiCTv6gJ52qEBNMB-x8vY",
  SITE: "https://kagurameguri.jp/", DAYS: 28, LIMIT: 1000, MAX_ATTEMPTS: 2,
  DAILY: "12_計測日次", DETAIL: "13_計測内訳", RUNS: "14_計測実行",
  DAILY_HEADER: ["ID","source","date","timezone","active_users","sessions","PV","engagement_rate","clicks","impressions","CTR","position","quality","fetched_at_JST"],
  DETAIL_HEADER: ["ID","source","breakdown","from","to","timezone","dimension","metrics_json","quality","fetched_at_JST"],
  RUN_HEADER: ["ID","status","fetched_at_JST","notes"]
});
function kaguraDay_(date, zone, offset) {
  const day = Utilities.formatDate(date, zone, "yyyy-MM-dd");
  return new Date(Date.parse(day + "T12:00:00Z") + offset * 86400000).toISOString().slice(0,10);
}
function kaguraFailure_(code) { const error = new Error(code); error.kaguraCode = code; return error; }
function kaguraErrorCode_(error) {
  if (/^[A-Z0-9_]+$/.test(error?.kaguraCode || "")) return error.kaguraCode;
  const message = String(error?.message || "");
  if (/not defined|undefined.*Properties/.test(message)) return "SERVICE_NOT_ENABLED";
  if (/403|permission|authoriz|access denied/i.test(message)) return "PERMISSION_OR_API_DISABLED";
  if (/429|quota|rate limit/i.test(message)) return "QUOTA_EXCEEDED";
  return "UNCLASSIFIED_ERROR"; // Do not expose provider messages/response bodies.
}
function kaguraSafeCell_(value) {
  return typeof value === "string" && /^[=+@-]/.test(value) ? "'" + value : value;
}
function kaguraComparable_(rows) {
  return JSON.stringify(rows.map(row=>row.map(v=>typeof v === "string" ? v.replace(/^'(?=[=+@-])/, "") : v)));
}
function kaguraTable_(ss,name,header) {
  let sheet=ss.getSheetByName(name);
  if(!sheet) sheet=ss.insertSheet(name);
  const rows=sheet.getLastRow()?sheet.getRange(1,1,sheet.getLastRow(),header.length).getValues():[];
  if(rows.length && rows[0].join()!==header.join()) throw kaguraFailure_("SHEET_HEADERS_MISMATCH");
  return {sheet,rows};
}
function kaguraUpsert_(ss,name,header,rows,replaceSource) {
  const table=kaguraTable_(ss,name,header);
  const records=new Map(table.rows.slice(1).filter(row=>row[0] && (!replaceSource || row[1]!==replaceSource)).map(row=>[String(row[0]),row]));
  rows.forEach(row=>records.set(String(row[0]),row.map(kaguraSafeCell_)));
  const values=[header].concat(Array.from(records.values()));
  if(values.length>20000) throw kaguraFailure_("SHEET_ROW_LIMIT");
  if(table.sheet.getMaxRows()<values.length) table.sheet.insertRowsAfter(table.sheet.getMaxRows(),values.length-table.sheet.getMaxRows());
  table.sheet.getRange(1,1,values.length,header.length).setValues(values);
  if(table.rows.length>values.length) table.sheet.getRange(values.length+1,1,table.rows.length-values.length,header.length).clearContent();
  table.sheet.setFrozenRows(1);
  table.sheet.getRange(1,1,values.length,header.length).setWrap(true);
  SpreadsheetApp.flush();
  const saved=table.sheet.getRange(1,1,values.length,header.length).getValues();
  if(kaguraComparable_(saved)!==kaguraComparable_(values)) throw kaguraFailure_("SHEET_READBACK_MISMATCH");
}
function kaguraReportRows_(report,dimensions,metrics) {
  if(!report || !Array.isArray(report.dimensionHeaders) || !Array.isArray(report.metricHeaders) ||
    report.dimensionHeaders.map(x=>x.name).join()!==dimensions.join() ||
    report.metricHeaders.map(x=>x.name).join()!==metrics.join() ||
    (report.rows!==undefined && !Array.isArray(report.rows))) throw kaguraFailure_("GA4_SCHEMA_INVALID");
  return (report.rows||[]).map(row=>{
    if(row.dimensionValues?.length!==dimensions.length || row.metricValues?.length!==metrics.length) throw kaguraFailure_("GA4_SCHEMA_INVALID");
    const numbers=row.metricValues.map(x=>{
      if(x.value==null || String(x.value).trim()==="" || !Number.isFinite(Number(x.value)) || Number(x.value)<0) throw kaguraFailure_("GA4_METRIC_INVALID");
      return Number(x.value);
    });
    return row.dimensionValues.map(x=>x.value).concat(numbers);
  });
}
function kaguraDailyRows_(source,from,to,zone,observed,quality,fetched) {
  const byDate=new Map();
  observed.forEach(row=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(row[0]) || row[0]<from || row[0]>to || byDate.has(row[0])) throw kaguraFailure_("DATE_RANGE_INVALID");
    byDate.set(row[0],row.slice(1));
  });
  const rows=[];
  for(let timestamp=Date.parse(from+"T12:00:00Z");timestamp<=Date.parse(to+"T12:00:00Z");timestamp+=86400000) {
    const day=new Date(timestamp).toISOString().slice(0,10), values=byDate.get(day);
    const metrics=Array(8).fill("");
    if(values) values.forEach((value,i)=>{metrics[(source==="GA4"?0:4)+i]=value;});
    rows.push([source+"-"+day,source,day,zone,...metrics,quality+(values?"":"; not_returned (not zero)"),fetched]);
  }
  return rows;
}
function kaguraCollectGa4_(property,zone,now,fetched) {
    const from=kaguraDay_(now,zone,-KAGURA_ANALYTICS_SYNC.DAYS),to=kaguraDay_(now,zone,-1),details=[],flags=[];
  let observed=[];
  const jobs=[
    ["daily",["date"],["activeUsers","sessions","screenPageViews","engagementRate"]],
    ["source",["sessionSourceMedium"],["sessions"]],
    ["device",["deviceCategory"],["sessions"]],
    ["page",["pagePath"],["screenPageViews"]],
    ["event",["eventName"],["eventCount"]]
  ];
  for(const [kind,dimensions,metrics] of jobs) {
    const report=AnalyticsData.Properties.runReport({dateRanges:[{startDate:from,endDate:to}],
      dimensions:dimensions.map(name=>({name})),metrics:metrics.map(name=>({name})),limit:KAGURA_ANALYTICS_SYNC.LIMIT,returnPropertyQuota:true,
      orderBys:dimensions.map(dimensionName=>({dimension:{dimensionName}}))},"properties/"+property);
    const rows=kaguraReportRows_(report,dimensions,metrics);
    if(report.metadata?.timeZone!==zone) throw kaguraFailure_("GA4_TIMEZONE_MISMATCH");
    const quality=["processing/revisions possible; self/debug not certified",
      report.rowCount>rows.length?"truncated":"",report.metadata?.subjectToThresholding?"thresholded":"",
      report.metadata?.samplingMetadatas?.length?"sampled":""].filter(Boolean).join("; ");
    flags.push(kind+": "+quality+(rows.length?"":"; no_rows"));
    if(kind==="daily") {
      observed=rows.map(row=>[String(row[0]).replace(/^(\d{4})(\d{2})(\d{2})$/,"$1-$2-$3"),...row.slice(1)]);
      if(observed.some(row=>row[4]>1)) throw kaguraFailure_("GA4_METRIC_INVALID");
    } else rows.forEach(row=>details.push(["GA4-"+kind+"-"+to+"-"+row[0],"GA4",kind,from,to,zone,row[0],JSON.stringify(row.slice(1)),quality,fetched]));
  }
  return {daily:kaguraDailyRows_("GA4",from,to,zone,observed,flags[0],fetched),details,
    status:observed.length?"success":"no_data",note:flags.join(" / ")+"; missing_days="+(KAGURA_ANALYTICS_SYNC.DAYS-observed.length)};
}
function kaguraCollectGsc_(now,fetched) {
  const zone="America/Los_Angeles",from=kaguraDay_(now,zone,-KAGURA_ANALYTICS_SYNC.DAYS),to=kaguraDay_(now,zone,-1),details=[];
  let observed=[];
  const flags=[];
  for(const kind of ["daily","query","page"]) {
    const response=UrlFetchApp.fetch("https://www.googleapis.com/webmasters/v3/sites/"+encodeURIComponent(KAGURA_ANALYTICS_SYNC.SITE)+"/searchAnalytics/query",{
      method:"post",contentType:"application/json",followRedirects:false,muteHttpExceptions:true,
      headers:{Authorization:"Bearer "+ScriptApp.getOAuthToken()},
      payload:JSON.stringify({startDate:from,endDate:to,dimensions:[kind==="daily"?"date":kind],type:"web",dataState:"final",rowLimit:KAGURA_ANALYTICS_SYNC.LIMIT})
    });
    const status=response.getResponseCode();
    if(status!==200) throw kaguraFailure_("GSC_HTTP_"+Number(status));
    let report;
    try {report=JSON.parse(response.getContentText());} catch(_) {throw kaguraFailure_("GSC_JSON_INVALID");}
    if(!report || report.error || (report.rows!==undefined && !Array.isArray(report.rows))) throw kaguraFailure_("GSC_SCHEMA_INVALID");
    const rows=report.rows||[],quality=(kind==="page"
      ?"final; top rows only; page aggregation differs from property totals; missing pages are not zero"
      :"final; anonymized queries omitted; top rows only")+(rows.length===KAGURA_ANALYTICS_SYNC.LIMIT?"; limit reached; completeness not guaranteed":"");
    if(rows.length>KAGURA_ANALYTICS_SYNC.LIMIT) throw kaguraFailure_("GSC_SCHEMA_INVALID");
    const pageKeys=new Set();
    rows.forEach(row=>{
      if(!row || row.keys?.length!==1 || ![row.clicks,row.impressions,row.ctr,row.position].every(v=>Number.isFinite(v)&&v>=0) || row.ctr>1) throw kaguraFailure_("GSC_SCHEMA_INVALID");
      if(kind==="page") {
        const page=row.keys[0];
        if(typeof page!=="string" || !page.startsWith(KAGURA_ANALYTICS_SYNC.SITE) || /[\s\u0000-\u001f\u007f]/.test(page) || pageKeys.has(page)) throw kaguraFailure_("GSC_SCHEMA_INVALID");
        pageKeys.add(page);
      }
      if(kind==="daily") observed.push([row.keys[0],row.clicks,row.impressions,row.ctr,row.position]);
      else details.push(["GSC-"+kind+"-"+to+"-"+row.keys[0],"GSC",kind,from,to,zone,row.keys[0],JSON.stringify([row.clicks,row.impressions,row.ctr,row.position]),quality,fetched]);
    });
    flags.push(kind+": "+quality+(rows.length?"":"; no_rows"));
  }
  return {daily:kaguraDailyRows_("GSC",from,to,zone,observed,flags[0],fetched),details,
    status:observed.length?"success":"no_data",note:flags.join(" / ")+"; missing_days="+(KAGURA_ANALYTICS_SYNC.DAYS-observed.length)};
}
/** Local settings only: never calls GA4/GSC, grants access, or creates a trigger. */
function checkKaguraAnalyticsSetup() {
  const props=PropertiesService.getScriptProperties();
  const free=props.getProperty("KAGURA_ANALYTICS_FREE_CONFIRMED")==="yes";
  const property=/^\d+$/.test(props.getProperty("KAGURA_GA4_PROPERTY_ID")||""),ss=SpreadsheetApp.getActiveSpreadsheet();
  const bound=!!ss && ss.getId()===KAGURA_ANALYTICS_SYNC.SPREADSHEET_ID;
  return {freeConfirmed:free,propertyIdConfigured:property,
    ga4ServiceAvailable:typeof AnalyticsData!=="undefined",boundSheet:bound,
    readyForOwnerTest:free&&property&&bound&&typeof AnalyticsData!=="undefined",
    note:"OAuth scopes/API enablement and access still require owner test; no API requests made"};
}
/** Max 8 API calls/run; source-specific same-day success guard, <=2 attempts/source/day. */
function dailyKaguraAnalyticsSync() {
  const props=PropertiesService.getScriptProperties(),ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss || ss.getId()!==KAGURA_ANALYTICS_SYNC.SPREADSHEET_ID) throw kaguraFailure_("BOUND_SHEET_REQUIRED");
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000)) throw kaguraFailure_("SYNC_ALREADY_RUNNING");
  try {
    const now=new Date(),day=kaguraDay_(now,"Asia/Tokyo",0),fetched=Utilities.formatDate(now,"Asia/Tokyo","yyyy-MM-dd HH:mm:ss");
    const log=(id,status,note)=>kaguraUpsert_(ss,KAGURA_ANALYTICS_SYNC.RUNS,KAGURA_ANALYTICS_SYNC.RUN_HEADER,[[id,status,fetched,note]]);
    const free=props.getProperty("KAGURA_ANALYTICS_FREE_CONFIRMED")==="yes";
    const property=props.getProperty("KAGURA_GA4_PROPERTY_ID");
    if(!free || !/^\d+$/.test(property||"")) {
      log(day,"setup_required",free?"PROPERTY_ID_REQUIRED":"FREE_SETUP_NOT_CONFIRMED");
      throw kaguraFailure_(free?"PROPERTY_ID_REQUIRED":"FREE_SETUP_NOT_CONFIRMED");
    }
    // Validate all destination schemas before spending an API request.
    try {
      kaguraTable_(ss,KAGURA_ANALYTICS_SYNC.DAILY,KAGURA_ANALYTICS_SYNC.DAILY_HEADER);
      kaguraTable_(ss,KAGURA_ANALYTICS_SYNC.DETAIL,KAGURA_ANALYTICS_SYNC.DETAIL_HEADER);
    } catch(error) {log(day,"error",kaguraErrorCode_(error));throw kaguraFailure_("DESTINATION_INVALID");}
    const results=[];
    for(const source of ["GA4","GSC"]) {
      const key="KAGURA_ANALYTICS_LAST_SUCCESS_"+source;
      const config=source==="GA4"?property+"|"+(props.getProperty("KAGURA_GA4_TIMEZONE")||"Asia/Tokyo"):KAGURA_ANALYTICS_SYNC.SITE;
      if(props.getProperty(key)===day && props.getProperty("KAGURA_ANALYTICS_CONFIG_"+source)===config) {
        results.push(props.getProperty("KAGURA_ANALYTICS_STATE_"+source)||"success");continue;
      }
      const attemptKey="KAGURA_ANALYTICS_ATTEMPTS_"+source;
      const previous=String(props.getProperty(attemptKey)||"").split(":");
      const attempts=previous[0]===day?Number(previous[1])||0:0;
      if(attempts>=KAGURA_ANALYTICS_SYNC.MAX_ATTEMPTS) {log(day+"-"+source,"error","DAILY_ATTEMPT_LIMIT; automatic retries stopped");results.push("error");continue;}
      props.setProperty(attemptKey,day+":"+(attempts+1));
      try {
        const data=source==="GA4"?kaguraCollectGa4_(property,props.getProperty("KAGURA_GA4_TIMEZONE")||"Asia/Tokyo",now,fetched):kaguraCollectGsc_(now,fetched);
        kaguraUpsert_(ss,KAGURA_ANALYTICS_SYNC.DAILY,KAGURA_ANALYTICS_SYNC.DAILY_HEADER,data.daily);
        // Details hold the latest successful snapshot per source, not 28-day copies every day.
        kaguraUpsert_(ss,KAGURA_ANALYTICS_SYNC.DETAIL,KAGURA_ANALYTICS_SYNC.DETAIL_HEADER,data.details,source);
        log(day+"-"+source,data.status,data.note+"; saved/readback verified; attempt="+(attempts+1));
        props.setProperty("KAGURA_ANALYTICS_CONFIG_"+source,config);
        props.setProperty("KAGURA_ANALYTICS_STATE_"+source,data.status);
        props.setProperty(key,day); // Only after data and execution record readbacks.
        results.push(data.status);
      } catch(error) {
        log(day+"-"+source,"error",kaguraErrorCode_(error)+"; source not confirmed; previous/partial rows must not be used as current");
        results.push("error");
      }
    }
    const status=results.includes("error")?(results.some(x=>x!=="error")?"partial":"error"):results.includes("no_data")?"no_data":"success";
    log(day,status,"GA4="+results[0]+"; GSC="+results[1]+"; independent saves; no_data/not_returned are not zero");
    if(status==="success" || status==="no_data") props.setProperty("KAGURA_ANALYTICS_LAST_SUCCESS",day);
    if(status==="partial" || status==="error") throw kaguraFailure_("SYNC_"+status.toUpperCase());
    return {status,sources:results};
  } finally {lock.releaseLock();}
}
/** Owner-only explicit opt-in after the first verified sync. No VC trigger changes. */
function installKaguraAnalyticsDailyTrigger() {
  const props=PropertiesService.getScriptProperties();
  const ga4=props.getProperty("KAGURA_ANALYTICS_LAST_SUCCESS_GA4"),gsc=props.getProperty("KAGURA_ANALYTICS_LAST_SUCCESS_GSC");
  const config=props.getProperty("KAGURA_GA4_PROPERTY_ID")+"|"+(props.getProperty("KAGURA_GA4_TIMEZONE")||"Asia/Tokyo");
  if(props.getProperty("KAGURA_ANALYTICS_FREE_CONFIRMED")!=="yes" || !ga4 || ga4!==gsc ||
    props.getProperty("KAGURA_ANALYTICS_CONFIG_GA4")!==config ||
    props.getProperty("KAGURA_ANALYTICS_CONFIG_GSC")!==KAGURA_ANALYTICS_SYNC.SITE) throw kaguraFailure_("FIRST_VERIFIED_SYNC_REQUIRED");
  const existing=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==="dailyKaguraAnalyticsSync");
  if(existing.length>1) throw kaguraFailure_("DUPLICATE_TRIGGERS_REVIEW_REQUIRED");
  if(existing.length===1) return {status:"already_installed"};
  ScriptApp.newTrigger("dailyKaguraAnalyticsSync").timeBased().inTimezone("Asia/Tokyo").atHour(7).everyDays(1).create();
  return {status:"installed",schedule:"07:00-08:00 Asia/Tokyo; approximate"};
}
