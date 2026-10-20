// Google Analytics 4: count only sponsored affiliate links.
// Existing data-goatcounter-click attributes are reused without changing GoatCounter.
document.addEventListener("click", (event) => {
  const target = event.target;
  const link = target instanceof Element ? target.closest("a[data-goatcounter-click]") : null;
  if (!link || !link.relList.contains("sponsored")) return;

  // The bootstrap enables GA4 only after explicit statistics consent.
  // Do not trust Cookiebot's potentially automatic/implied consent here.
  if (window.kaguraGa4Allowed !== true) return;

  const label = link.getAttribute("data-goatcounter-click") || "";
  const match = /^(stay|aff)-(jalan|rakuten|amazon)\/(.+)$/.exec(label);
  if (!match || typeof window.gtag !== "function") return;

  window.gtag("event", "affiliate_click", {
    affiliate_partner: match[2],
    affiliate_placement: match[1] === "stay" ? "event_stay" : "travel_block",
    affiliate_content_id: match[3],
    affiliate_page_path: window.location.pathname
  });
});
