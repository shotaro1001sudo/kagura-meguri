/**
 * Optional GA4/GSC -> PRIVATE, bound Sheets collector. Not enabled by deployment.
 * No API keys, Windsor, BigQuery, payment setup, or automatic trigger creation.
 * Owner must verify no-billing setup and set KAGURA_ANALYTICS_FREE_CONFIRMED=yes.
 * Enable the AnalyticsData advanced service in the existing default GAS project.
 * Search Console API must be enabled in that project's API configuration as well.
 * Required scopes: analytics.readonly, webmasters.readonly, spreadsheets.currentonly,
 * script.external_request. Do not replace the manifest of an existing VC script.
 */
const KAGURA_ANALYTICS_SYNC = Object.freeze({
  SITE: "https://kagurameguri.jp/", DAYS: 28, LIMIT: 1000,
  DAILY: "12_計測日次", DETAIL: "13_計測内訳", RUNS: "14_計測実行"
});

function kaguraDay_(date, zone, offset) {
  const day = Utilities.formatDate(date, zone, "yyyy-MM-dd");
  return new Date(Date.parse(day + "T12:00:00Z") + offset * 86400000).toISOString().slice(0, 10);
}

function kaguraSafeCell_(value) {
  // Sheet search queries must never become formulas.
  return typeof value === "string" && /^[=+@-]/.test(value) ? "'" + value : value;
}

function kaguraReportRows_(report, dimensions, metrics) {
  if (!report || !Array.isArray(report.dimensionHeaders) || !Array.isArray(report.metricHeaders)) {
    throw new Error("GA4 response schema invalid");
  }
  if (report.dimensionHeaders.map(x=>x.name).join() !== dimensions.join() ||
      report.metricHeaders.map(x=>x.name).join() !== metrics.join()) throw new Error("GA4 headers mismatch");
  return (report.rows || []).map(row => {
    if (row.dimensionValues?.length !== dimensions.length || row.metricValues?.length !== metrics.length) {
      throw new Error("GA4 row schema invalid");
    }
    const values = row.metricValues.map(x => {
      if (x.value === "" || x.value == null || !Number.isFinite(Number(x.value))) throw new Error("GA4 metric invalid");
      return Number(x.value);
    });
    return row.dimensionValues.map(x=>x.value).concat(values);
  });
}

function kaguraUpsert_(ss, name, header, rows) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const existing = sheet.getLastRow() ? sheet.getRange(1,1,sheet.getLastRow(),header.length).getValues() : [];
  if (existing.length && existing[0].join() !== header.join()) throw new Error("Sheet headers mismatch: " + name);
  const records = new Map(existing.slice(1).filter(row=>row[0]).map(row=>[String(row[0]),row]));
  rows.forEach(row => records.set(String(row[0]), row.map(kaguraSafeCell_)));
  const values = [header].concat(Array.from(records.values()));
  sheet.getRange(1,1,values.length,header.length).setValues(values);
  sheet.setFrozenRows(1);
  sheet.getRange(1,1,values.length,header.length).setWrap(true);
}

/** Seven bounded read calls at most, once per JST day; re-read the last 28 days. */
function dailyKaguraAnalyticsSync() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("KAGURA_ANALYTICS_FREE_CONFIRMED") !== "yes") {
    throw new Error("無料・請求先未登録を確認してから設定してください。API取得は未実行です。");
  }
  const property = props.getProperty("KAGURA_GA4_PROPERTY_ID");
  if (!/^\d+$/.test(property || "")) throw new Error("GA4管理画面のプロパティID（アカウントIDではない）が必要です");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("既存の非公開管理Sheetに紐づけて実行してください");
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error("Another analytics sync is running");
  const now = new Date(), day = kaguraDay_(now,"Asia/Tokyo",0);
  try {
    if (props.getProperty("KAGURA_ANALYTICS_LAST_SUCCESS") === day) return;
    const fetched = Utilities.formatDate(now,"Asia/Tokyo","yyyy-MM-dd HH:mm:ss");
    const from = kaguraDay_(now,"Asia/Tokyo",-KAGURA_ANALYTICS_SYNC.DAYS);
    const to = kaguraDay_(now,"Asia/Tokyo",-1);
    const daily = [], details = [], flags = [];
    const jobs = [
      ["daily",["date"],["activeUsers","sessions","screenPageViews","engagementRate"]],
      ["source",["sessionSourceMedium"],["sessions"]],
      ["device",["deviceCategory"],["sessions"]],
      ["page",["pagePath"],["screenPageViews"]],
      ["event",["eventName"],["eventCount"]]
    ];
    for (const [kind,dimensions,metrics] of jobs) {
      const report = AnalyticsData.Properties.runReport({
        dateRanges:[{startDate:from,endDate:to}],
        dimensions:dimensions.map(name=>({name})), metrics:metrics.map(name=>({name})),
        limit:KAGURA_ANALYTICS_SYNC.LIMIT, returnPropertyQuota:true
      },"properties/"+property);
      const rows = kaguraReportRows_(report,dimensions,metrics);
      const zone = report.metadata?.timeZone || "unknown";
      const quality = ["GA4 processing/revisions possible; self/debug not certified",
        zone !== "Asia/Tokyo" ? "timezone mismatch/unknown" : "",
        report.rowCount > rows.length ? "truncated" : "",
        report.metadata?.subjectToThresholding ? "thresholded" : "",
        report.metadata?.samplingMetadatas?.length ? "sampled" : ""].filter(Boolean).join("; ");
      flags.push(kind+": "+quality);
      rows.forEach(row=>{
        if(kind==="daily") {
          const date=String(row[0]).replace(/^(\d{4})(\d{2})(\d{2})$/,"$1-$2-$3");
          daily.push(["GA4-"+date,"GA4",date,zone,...row.slice(1),"","","","",quality,fetched]);
        } else details.push(["GA4-"+kind+"-"+to+"-"+row[0],"GA4",kind,from,to,zone,row[0],JSON.stringify(row.slice(1)),quality,fetched]);
      });
      if (!rows.length) flags.push(kind+": no returned rows (not assumed zero)");
    }
    // Search Console dates are PT, unlike the GA4 property's reporting timezone.
    const gFrom=kaguraDay_(now,"America/Los_Angeles",-28), gTo=kaguraDay_(now,"America/Los_Angeles",-1);
    for (const kind of ["daily","query"]) {
      const response = UrlFetchApp.fetch("https://www.googleapis.com/webmasters/v3/sites/"+
        encodeURIComponent(KAGURA_ANALYTICS_SYNC.SITE)+"/searchAnalytics/query",{
        method:"post",contentType:"application/json",followRedirects:false,muteHttpExceptions:true,
        headers:{Authorization:"Bearer "+ScriptApp.getOAuthToken()},
        payload:JSON.stringify({startDate:gFrom,endDate:gTo,dimensions:[kind==="daily"?"date":"query"],
          type:"web",dataState:"final",rowLimit:KAGURA_ANALYTICS_SYNC.LIMIT})
      });
      if(response.getResponseCode()!==200) throw new Error("GSC HTTP "+response.getResponseCode());
      const report=JSON.parse(response.getContentText()), rows=report.rows || [];
      if(!Array.isArray(rows)) throw new Error("GSC schema invalid");
      const quality="final; queries omit anonymized terms; top rows only"+
        (rows.length===KAGURA_ANALYTICS_SYNC.LIMIT?"; limit reached":"");
      rows.forEach(row=>{
        if(row.keys?.length!==1 || ![row.clicks,row.impressions,row.ctr,row.position].every(Number.isFinite)) throw new Error("GSC row invalid");
        if(kind==="daily") daily.push(["GSC-"+row.keys[0],"GSC",row.keys[0],"America/Los_Angeles",
          "","","","",row.clicks,row.impressions,row.ctr,row.position,quality,fetched]);
        else details.push(["GSC-query-"+gTo+"-"+row.keys[0],"GSC","query",gFrom,gTo,"America/Los_Angeles",
          row.keys[0],JSON.stringify([row.clicks,row.impressions,row.ctr,row.position]),quality,fetched]);
      });
      if(!rows.length) flags.push("GSC "+kind+": no returned rows (not assumed zero)");
    }
    // Only write after every fetch/schema check succeeds. A write error leaves the run unconfirmed.
    kaguraUpsert_(ss,KAGURA_ANALYTICS_SYNC.DAILY,
      ["ID","source","date","timezone","active_users","sessions","PV","engagement_rate","clicks","impressions","CTR","position","quality","fetched_at_JST"],daily);
    kaguraUpsert_(ss,KAGURA_ANALYTICS_SYNC.DETAIL,
      ["ID","source","breakdown","from","to","timezone","dimension","metrics_json","quality","fetched_at_JST"],details);
    kaguraUpsert_(ss,KAGURA_ANALYTICS_SYNC.RUNS,["ID","status","fetched_at_JST","notes"],
      [[day,"success",fetched,flags.join(" / ")]]);
    SpreadsheetApp.flush();
    props.setProperty("KAGURA_ANALYTICS_LAST_SUCCESS",day);
  } catch (_) {
    // Never print raw response bodies, OAuth tokens or search terms into logs.
    throw new Error("Analytics sync failed; do not treat absent data as zero. Check API enablement, permissions, quota and target headers. Sheets may be partially written.");
  } finally { lock.releaseLock(); }
}
