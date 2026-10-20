// GA4 basic consent mode: never load gtag.js until explicit statistics consent.
// The generator embeds this bootstrap early in <head>, before async Cookiebot.
(() => {
  const tag = document.currentScript;
  const measurementId = tag?.getAttribute("data-ga4-id") || "";
  if (!/^G-[A-Z0-9]+$/.test(measurementId)) return;

  // When Cookiebot is configured, missing/unavailable consent is DENIED.
  const consentRequired = tag.hasAttribute("data-require-statistics-consent");
  let started = false;
  window.kaguraGa4Allowed = false;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  // This command only queues locally; no Google script or analytics request is made yet.
  window.gtag("consent", "default", { analytics_storage: "denied" });

  function explicitlyAllowed() {
    const cb = window.Cookiebot;
    // Cookiebot can grant *implied* consent automatically in some regions.
    // Require a real response and an explicit choice to prevent silent tracking.
    return cb?.hasResponse === true &&
      cb.consent?.statistics === true &&
      cb.consent?.method === "explicit";
  }

  function syncConsent() {
    const allowed = !consentRequired || explicitlyAllowed();
    window.kaguraGa4Allowed = allowed;
    if (!allowed) {
      if (started) {
        // A Google tag cannot be reliably unloaded. Deny storage, then reload
        // so that the next page does not initialize GA4 after consent is revoked.
        window.gtag("consent", "update", { analytics_storage: "denied" });
        window.location.reload();
      }
      return;
    }
    if (started) return; // Cookiebot may fire both Ready and Accept.
    started = true;
    window.gtag("consent", "update", { analytics_storage: "granted" });
    window.gtag("js", new Date());
    window.gtag("config", measurementId);
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
    document.head.appendChild(script);
  }

  if (consentRequired) {
    window.addEventListener("CookiebotOnConsentReady", syncConsent);
    window.addEventListener("CookiebotOnAccept", syncConsent);
    window.addEventListener("CookiebotOnDecline", syncConsent);
  }
  syncConsent();
})();
