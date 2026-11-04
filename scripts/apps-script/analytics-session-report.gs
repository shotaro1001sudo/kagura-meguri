/** Optional manual read-only report. Requires analytics-sheet-sync.gs and EXISTING
 * authorized AnalyticsData access. No installation, scopes, triggers or Sheet writes.
 * Never sum sessions across dates, pages or events to calculate a union.
 */
function kaguraSessionRequests_(from, to, page) {
  const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  if (!validDay(from) || !validDay(to) || from > to || (Date.parse(to)-Date.parse(from))/86400000 >= 28)
    throw kaguraFailure_('SESSION_DATE_RANGE_INVALID');
  if (page !== undefined && !KAGURA_ANALYTICS_SYNC.FUNNEL_PAGES.includes(page) &&
    !/^\/(events|regular)\/[A-Za-z0-9_-]+\.html$/.test(page)) throw kaguraFailure_('SESSION_PAGE_INVALID');
  const groups = [
    ['all', []], ['view_event', ['view_event']],
    ['official_link_click', ['official_link_click']], ['affiliate_click', ['affiliate_click']],
    ['outbound_union', ['official_link_click', 'affiliate_click']]
  ];
  return groups.map(([kind, events]) => {
    const expressions = [];
    if (events.length) expressions.push({filter:{fieldName:'eventName',inListFilter:{values:events,caseSensitive:true}}});
    if (page !== undefined) expressions.push({filter:{fieldName:'pagePath',stringFilter:{value:page,matchType:'EXACT',caseSensitive:true}}});
    const request = {dateRanges:[{startDate:from,endDate:to}],dimensions:[],
      metrics:[{name:'sessions'},{name:'eventCount'}],limit:1,returnPropertyQuota:true};
    if (expressions.length) request.dimensionFilter = {andGroup:{expressions}};
    return {kind, request};
  });
}
function readKaguraSessionReport(from, to, page) {
  const jobs = kaguraSessionRequests_(from,to,page); // Validate before any API call.
  if (!checkKaguraAnalyticsSetup().readyForOwnerTest) throw kaguraFailure_('SESSION_EXISTING_SETUP_REQUIRED');
  const props = PropertiesService.getScriptProperties();
  const zone = props.getProperty('KAGURA_GA4_TIMEZONE') || 'Asia/Tokyo';
  const property = props.getProperty('KAGURA_GA4_PROPERTY_ID');
  // Five bounded reads only; do not call from the daily trigger or retry automatically.
  return jobs.map(({kind,request}) => {
    let report;
    try { report = AnalyticsData.Properties.runReport(request,'properties/'+property); }
    catch (error) { throw kaguraFailure_(kaguraErrorCode_(error)); }
    // Protobuf JSON may omit empty dimensionHeaders/dimensionValues for no dimensions.
    const normalized = {...report, dimensionHeaders:report?.dimensionHeaders ?? [],
      rows:report?.rows?.map(row => ({...row,dimensionValues:row.dimensionValues ?? []}))};
    const rows = kaguraReportRows_(normalized,[],['sessions','eventCount']);
    if (rows.length > 1 || (report.rowCount || 0) > 1) throw kaguraFailure_('GA4_SCHEMA_INVALID');
    if (report.metadata?.timeZone !== zone) throw kaguraFailure_('GA4_TIMEZONE_MISMATCH');
    if (rows.some(row => row.some(value => !Number.isSafeInteger(value)))) throw kaguraFailure_('GA4_METRIC_INVALID');
    const metadata = report.metadata || {};
    return {kind,from,to,page:page === undefined ? null : page,timezone:zone,
      sessions:rows[0]?.[0] ?? null,eventCount:rows[0]?.[1] ?? null,
      quality:[rows.length ? 'returned' : 'no_rows (not zero)',
        'GA4 reported sessions (HLL++ approximate); not additive; not people, reservations or revenue',
        'consent/self/debug exclusion not certified; processing/revisions possible',
        metadata.subjectToThresholding ? 'thresholded' : '',
        metadata.samplingMetadatas?.length ? 'sampled' : '',
        metadata.dataLossFromOtherRow ? 'data_loss_from_other_row' : ''].filter(Boolean).join('; '),
      fetchedAt:new Date().toISOString()};
  });
}
