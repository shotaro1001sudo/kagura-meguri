// GA4 basic consent mode: never load gtag.js until explicit statistics consent.
// The generator embeds this bootstrap early in <head>, before the deferred local CMP.
(() => {
  const tag = document.currentScript;
  const measurementId = tag?.getAttribute("data-ga4-id") || "";
  if (!/^G-[A-Z0-9]+$/.test(measurementId)) return;

  // One bootstrap per document, even if another integration inserts it again.
  if (window.kaguraAnalytics) return;
  const state = window.kaguraAnalytics = { status: "waiting_consent", version: "2026-11-04" };
  const loc = window.location;
  let excluded = false;
  try {
    const params = new URLSearchParams(loc.search || "");
    const choice = params.get("analytics");
    if (choice === "off") window.localStorage.setItem("kagura.analytics.exclude", "1");
    if (choice === "on") window.localStorage.removeItem("kagura.analytics.exclude");
    excluded = choice === "off" || window.localStorage.getItem("kagura.analytics.exclude") === "1";
  } catch (_) {
    // An explicit opt-out still works when browser storage is unavailable.
    excluded = /(?:^|[?&])analytics=off(?:&|$)/.test(loc.search || "");
  }
  const productionHost = tag.getAttribute("data-ga4-host");
  if (productionHost && loc.hostname !== productionHost) excluded = true;
  if (/(?:^|[?&])(?:gtm_debug|gtm_preview|debug_mode)=/.test(loc.search || "")) excluded = true;
  window.kaguraGa4Allowed = false;
  function stopForExclusion() {
    excluded = true; // Sticky for this document. Re-enable only with a fresh navigation.
    window.kaguraGa4Allowed = false;
    window['ga-disable-' + measurementId] = true;
    state.status = 'excluded';
  }
  function refreshExclusion() {
    let off = new URLSearchParams(loc.search || '').get('analytics') === 'off';
    try { off = off || window.localStorage.getItem('kagura.analytics.exclude') === '1'; } catch (_) {}
    if (excluded || off) { stopForExclusion(); return true; }
    return false;
  }
  // A cached document or another already-open tab must not retain stale permission.
  window.addEventListener('storage', (event) => {
    if (event.key === 'kagura.analytics.exclude' && event.newValue === '1') stopForExclusion();
  });
  window.addEventListener('pageshow', refreshExclusion);
  window.addEventListener('focus', refreshExclusion);
  window.addEventListener('popstate', refreshExclusion);
  if (excluded) { stopForExclusion(); return; }

  // Consent is always required, including missing CMP configuration or failed assets.
  let started = false;
  window.kaguraGa4Allowed = false;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  // This command only queues locally; no Google script or analytics request is made yet.
  window.gtag("consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });

  function explicitlyAllowed() {
    try { return window.kaguraConsent?.snapshot()?.statistics === true; }
    catch (_) { return false; }
  }

  function syncConsent() {
    if (refreshExclusion()) return;
    const allowed = explicitlyAllowed();
    window.kaguraGa4Allowed = allowed;
    if (!allowed) {
      state.status = "waiting_consent";
      if (started) {
        window["ga-disable-" + measurementId] = true;
        // A Google tag cannot be reliably unloaded. Deny storage, then reload
        // so that the next page does not initialize GA4 after consent is revoked.
        window.gtag("consent", "update", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
        window.location.reload();
      }
      return;
    }
    if (state.status === "tag_error") { window.kaguraGa4Allowed = false; return; }
    if (started) return; // The CMP may emit more than one callback.
    started = true;
    state.status = "loading";
    window.gtag("consent", "update", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    window.gtag("js", new Date());
    // Keep only controlled campaign tags. Never send form/query/hash contents.
    const page = new URL(loc.href);
    const original = new URLSearchParams(page.search);
    page.search = ""; page.hash = "";
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
      const value = original.get(key);
      if (value && /^[A-Za-z0-9_-]{1,80}$/.test(value)) page.searchParams.set(key, value);
    }
    let referrer = "";
    try { referrer = new URL(document.referrer).origin + "/"; } catch (_) {}
    window.gtag("config", measurementId, {
      page_location: page.href, page_referrer: referrer,
      allow_google_signals: false, allow_ad_personalization_signals: false
    });
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
    script.onload = () => { if (!refreshExclusion()) state.status = "tag_loaded"; };
    script.onerror = () => { if (refreshExclusion()) return; state.status = "tag_error"; window.kaguraGa4Allowed = false; };
    document.head.appendChild(script);
    // Notify the interaction tracker on a late consent choice as well.
    window.dispatchEvent(new Event("kagura:analytics-ready"));
  }

  // Recheck persisted consent immediately before custom events (including another tab).
  window.kaguraCheckAnalyticsConsent = () => {
    if (refreshExclusion()) return false;
    if (!explicitlyAllowed()) { syncConsent(); return false; }
    // Sending an event must never initialize the tag or recursively emit ready.
    return window.kaguraGa4Allowed === true;
  };
  window.addEventListener("kagura:consent", syncConsent);
  window.addEventListener("focus", syncConsent);
  window.addEventListener("pageshow", syncConsent);
  syncConsent();
})();
