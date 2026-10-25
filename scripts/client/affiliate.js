// Google Analytics 4: count only sponsored affiliate links.
// Existing data-goatcounter-click attributes are reused without changing GoatCounter.
document.addEventListener("click", (event) => {
  const target = event.target;
  const link = target instanceof Element ? target.closest("a[data-goatcounter-click]") : null;
  if (!link || !link.relList.contains("sponsored")) return;

  // The bootstrap enables GA4 only after explicit statistics consent.
  // Do not trust Cookiebot's potentially automatic/implied consent here.
  if (window.kaguraGa4Allowed !== true) return;

  const category=link.getAttribute('data-affiliate-category');
  if(category) {
    const partner=link.getAttribute('data-affiliate-partner'),placement=link.getAttribute('data-affiliate-placement'),id=link.getAttribute('data-affiliate-id');
    if(!['supplies','experiences','rental'].includes(category)||!['rakuten-ichiba','vc-asoview','vc-jalan-rental'].includes(partner)||!['guide_supplies','guide_rental','experience_guide','event_experiences','event_rental','regular_experiences','regular_rental'].includes(placement)||!/^[-a-z0-9]{1,48}$/.test(id??'')||typeof window.gtag!=='function')return;
    window.gtag('event','affiliate_click',{affiliate_partner:partner,affiliate_category:category,affiliate_placement:placement,affiliate_content_id:id,affiliate_page_path:window.location.pathname});
    return;
  }

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

// 新しい3カテゴリは、同意後に実際に見えた広告リンクを1ページ1回だけ数える。
// 未表示・同意前の広告を表示数に混ぜない。古いブラウザで推測の表示数を送らない。
(() => {
  if(typeof IntersectionObserver!=='function'||typeof document.querySelectorAll!=='function')return;
  const sent=new Set();
  const observer=new IntersectionObserver(entries=>{
    if(window.kaguraGa4Allowed!==true||typeof window.gtag!=='function'||document.visibilityState!=='visible')return;
    for(const entry of entries) {
      const link=entry.target;
      if(!entry.isIntersecting||entry.intersectionRatio<0.5||sent.has(link)||!link.relList.contains('sponsored'))continue;
      const category=link.getAttribute('data-affiliate-category'),partner=link.getAttribute('data-affiliate-partner'),placement=link.getAttribute('data-affiliate-placement'),id=link.getAttribute('data-affiliate-id');
      if(!['supplies','experiences','rental'].includes(category)||!['rakuten-ichiba','vc-asoview','vc-jalan-rental'].includes(partner)||!['guide_supplies','guide_rental','experience_guide','event_experiences','event_rental','regular_experiences','regular_rental'].includes(placement)||!/^[-a-z0-9]{1,48}$/.test(id??''))continue;
      window.gtag('event','affiliate_view',{affiliate_partner:partner,affiliate_category:category,affiliate_placement:placement,affiliate_content_id:id,affiliate_page_path:window.location.pathname});
      sent.add(link);observer.unobserve(link);
    }
  },{threshold:0.5});
  function observe(){for(const link of document.querySelectorAll('a[data-affiliate-category]'))if(!sent.has(link)){observer.unobserve(link);observer.observe(link);}}
  window.addEventListener('kagura:analytics-ready',observe);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')observe();});
  observe();
})();
