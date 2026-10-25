// Consent-gated funnel events. No text input, link query, form content or user IDs.
(() => {
  if (window.kaguraAnalyticsEvents) return;
  window.kaguraAnalyticsEvents = true;
  const path = window.location.pathname;
  const detail = /^\/(events|regular)\/([A-Za-z0-9_-]+)\.html$/.exec(path);
  function send(name, params) {
    if (window.kaguraGa4Allowed !== true || typeof window.gtag !== "function") return false;
    window.gtag("event", name, { ...params, transport_type: "beacon" });
    return true;
  }
  let viewed = false;
  function view() {
    if (!viewed && detail) viewed = send("view_event", { content_id: detail[2], content_type: detail[1] });
  }
  window.addEventListener("kagura:analytics-ready", view);
  view();
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest("a[href]");
    if (link) {
      let url;
      try { url = new URL(link.href, window.location.href); } catch (_) { return; }
      if (url.origin === window.location.origin) {
        const target = /^\/(events|regular)\/([A-Za-z0-9_-]+)\.html$/.exec(url.pathname);
        if (target) send("select_event", { content_id: target[2], content_type: target[1], source_page: path });
      } else if (detail && (link.hasAttribute("data-official-link") || link.hasAttribute("data-official-side")) && !link.relList.contains("sponsored")) {
        // Official information button only; do not record arbitrary external URLs.
        send("official_link_click", { content_id: detail[2], link_domain: url.hostname });
      }
      return;
    }
    const button = event.target.closest(".regions button[data-r], .regions button[data-p]");
    if (button) send("filter_events", {
      filter_type: button.hasAttribute("data-p") ? "prefecture" : "region"
    });
  });
  document.addEventListener("change", (event) => {
    // Measure the filter kind, never free-text input or its value.
    const target = event.target;
    if (!(target instanceof Element) || !target.closest("#finder")) return;
    if (["region", "pref", "from", "to"].includes(target.id)) {
      send("filter_events", { filter_type: target.id });
    }
  });
})();
