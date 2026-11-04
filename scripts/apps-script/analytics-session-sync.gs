/** Optional companion to analytics-sheet-sync.gs + analytics-session-report.gs.
 * Latest 28-day native GA4 snapshot; distinct storage namespace, not another provider.
 * No new scopes, services or triggers. Five reads/attempt, <=2 attempts/day.
 */
function syncKaguraSessionSnapshot() {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  if (!ss || ss.getId()!==KAGURA_ANALYTICS_SYNC.SPREADSHEET_ID) throw kaguraFailure_('BOUND_SHEET_REQUIRED');
  const lock=LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw kaguraFailure_('SYNC_ALREADY_RUNNING');
  try { return kaguraSyncSessionSnapshot_(ss,new Date()); }
  finally { lock.releaseLock(); }
}
// Called with the existing script lock held, whether manually or by daily sync.
function kaguraSyncSessionSnapshot_(ss,now) {
  const props=PropertiesService.getScriptProperties(), source='GA4_SESSION';
  const day=kaguraDay_(now,'Asia/Tokyo',0), fetched=Utilities.formatDate(now,'Asia/Tokyo','yyyy-MM-dd HH:mm:ss');
  const property=props.getProperty('KAGURA_GA4_PROPERTY_ID'),zone=props.getProperty('KAGURA_GA4_TIMEZONE')||'Asia/Tokyo';
  const prefix='KAGURA_SESSION_',config=property+'|'+zone+'|28|schema1';
  const log=(status,note)=>kaguraUpsert_(ss,KAGURA_ANALYTICS_SYNC.RUNS,KAGURA_ANALYTICS_SYNC.RUN_HEADER,
    [[day+'-'+source,status,fetched,note]]);
  try {
    if (typeof readKaguraSessionReport!=='function' || !checkKaguraAnalyticsSetup().readyForOwnerTest) {
      log('setup_required','SESSION_EXISTING_SETUP_REQUIRED; no API reads; snapshot not current');
      return {status:'setup_required'};
    }
    if (props.getProperty(prefix+'LAST_SUCCESS')===day && props.getProperty(prefix+'CONFIG')===config)
      return {status:props.getProperty(prefix+'STATE')||'success',skipped:true};
    // Validate both destinations before spending any API request.
    kaguraTable_(ss,KAGURA_ANALYTICS_SYNC.DETAIL,KAGURA_ANALYTICS_SYNC.DETAIL_HEADER);
    kaguraTable_(ss,KAGURA_ANALYTICS_SYNC.RUNS,KAGURA_ANALYTICS_SYNC.RUN_HEADER);
    const previous=String(props.getProperty(prefix+'ATTEMPTS')||'').split(':');
    const attempts=previous[0]===day?Number(previous[1])||0:0;
    if (attempts>=2) {
      log('error','DAILY_ATTEMPT_LIMIT; snapshot not current');
      return {status:'error',reason:'DAILY_ATTEMPT_LIMIT'};
    }
    props.setProperty(prefix+'ATTEMPTS',day+':'+(attempts+1));
    const from=kaguraDay_(now,zone,-28),to=kaguraDay_(now,zone,-1);
    const reports=readKaguraSessionReport(from,to);
    const kinds=['all','view_event','official_link_click','affiliate_click','outbound_union'];
    if (!Array.isArray(reports) || reports.length!==kinds.length || reports.some((r,i)=>
      r.kind!==kinds[i] || r.from!==from || r.to!==to || r.timezone!==zone || r.page!==null ||
      typeof r.quality!=='string' || [r.sessions,r.eventCount].some(v=>v!==null&&(!Number.isSafeInteger(v)||v<0)) ||
      (r.sessions===null)!==(r.eventCount===null))) throw kaguraFailure_('SESSION_SCHEMA_INVALID');
    const rows=reports.map(r=>[source+'-'+to+'-'+r.kind,source,'period_sessions',from,to,zone,r.kind,
      JSON.stringify([r.sessions,r.eventCount]),'metrics=sessions,eventCount; schema=1; period_days=28; '+r.quality,fetched]);
    // GA4 and GSC writers replace only their own exact source; these five rows survive.
    kaguraUpsert_(ss,KAGURA_ANALYTICS_SYNC.DETAIL,KAGURA_ANALYTICS_SYNC.DETAIL_HEADER,rows,source);
    const status=reports.every(r=>r.sessions===null)?'no_data':'success';
    log(status,'from='+from+'; to='+to+'; timezone='+zone+'; saved/readback verified; attempt='+(attempts+1)+
      '; GA4 native sessions (HLL++ approximate); not additive; consent/self/debug not certified; check each row quality');
    props.setProperty(prefix+'CONFIG',config);
    props.setProperty(prefix+'STATE',status);
    props.setProperty(prefix+'LAST_SUCCESS',day); // Only after both readbacks.
    return {status,from,to,timezone:zone};
  } catch (error) {
    const reason=kaguraErrorCode_(error);
    log('error',reason+'; snapshot not current; previous/partial rows must not be used as current');
    return {status:'error',reason};
  }
}
