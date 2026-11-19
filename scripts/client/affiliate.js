// Google Analytics 4: count only sponsored affiliate links.
// Existing data-goatcounter-click attributes are reused without changing GoatCounter.
// 宿の枠の置き場所(MEAS-20261117-2、2026-11-20): 開催ページの宿の枠(aside.stay)は event_stay、種類・県・定期公演のページの宿の枠(aside.aff)は travel_block。
// 枠に付けた data-aff-box で決め、表示とクリックを同じ名前で数える(なければ、これまでどおり stay_banner・side_rail)
window.kaguraAffBox = (el) => { const b = el?.closest?.("[data-aff-box]")?.getAttribute("data-aff-box"); return b === "event_stay" || b === "travel_block" ? b : ""; };
document.addEventListener("click", (event) => {
  const target = event.target;
  let link = target instanceof Element ? target.closest("a[data-goatcounter-click]") : null;
  if (!link && target instanceof Element) {
    const candidate = target.closest("a");
    if (candidate?.closest("[data-vc-ad]")) link = candidate;
  }
  if (!link || !link.relList.contains("sponsored")) return;
  link = link.closest?.("[data-vc-ad]") || link;

  // The bootstrap enables GA4 only after explicit statistics consent.
  // Only the consent bootstrap may enable analytics.
  if (window.kaguraCheckAnalyticsConsent && !window.kaguraCheckAnalyticsConsent()) return;
  if (window.kaguraGa4Allowed !== true) return;

  const category=link.getAttribute('data-affiliate-category');
  if(category) {
    const partner=link.getAttribute('data-affiliate-partner'),placement=link.getAttribute('data-affiliate-placement'),id=link.getAttribute('data-affiliate-id');
    if(!['supplies','experiences','rental','learn','furusato'].includes(category)||!['rakuten','rakuten-ichiba','vc-asoview','vc-jalan-rental','rakuten-rental','rakuten-carshare','vc-jalan-activity','rakuten-books','rakuten-furusato'].includes(partner)||!['guide_supplies','guide_rental','experience_guide','experience_directory','nearby_experiences','event_experiences','event_rental','regular_experiences','regular_rental','kagura_learn','history_learn','pref_furusato','kagura_furusato','event_learn','event_furusato','regular_learn','regular_furusato'].includes(placement)||!/^[-a-z0-9]{1,48}$/.test(id??'')||typeof window.gtag!=='function')return;
    window.gtag('event','affiliate_click',{affiliate_partner:partner,affiliate_category:category,affiliate_placement:placement,affiliate_content_id:id,affiliate_page_path:window.location.pathname});
    return;
  }

  const label = link.getAttribute("data-goatcounter-click") || "";
  // stay-hotel/<開催ID>: 会場近くの宿の写真カード(楽天トラベルの施設検索 API)。広告主は楽天
  const match = /^(stay|aff|banner|rail)-(jalan|rakuten|amazon|jtb|nta|hotel)\/(.+)$/.exec(label);
  if (!match || typeof window.gtag !== "function") return;

  window.gtag("event", "affiliate_click", {
    affiliate_partner: match[2] === "hotel" ? "rakuten" : match[2],
    affiliate_placement: (match[1] !== "rail" && window.kaguraAffBox(link)) || (match[1] === "stay" ? "event_stay" : match[1] === "banner" ? "stay_banner" : match[1] === "rail" ? "side_rail" : "travel_block"),
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
    if(window.kaguraCheckAnalyticsConsent && !window.kaguraCheckAnalyticsConsent())return;
    if(window.kaguraGa4Allowed!==true||typeof window.gtag!=='function'||document.visibilityState!=='visible')return;
    for(const entry of entries) {
      const link=entry.target;
      const source=link.matches?.('[data-vc-ad]')?link.querySelector(':scope > a'):link;
      if(!source||!entry.isIntersecting||entry.intersectionRatio<0.5||sent.has(link)||!source.relList.contains('sponsored'))continue;
      // 宿のバナー(banner-)と、PCの両サイドのPR枠・一覧の途中の帯(rail-)。クリックと同じ配置の名前で、表示も数える(2026-11-15 の監査で rail- を足した)
      const bm=/^(banner|rail)-(jalan|rakuten|jtb|nta)\/(.+)$/.exec(link.getAttribute('data-goatcounter-click')||'');
      if(bm&&link.hasAttribute('data-banner-partner')) {
        window.gtag('event','affiliate_view',{affiliate_partner:bm[2],affiliate_placement:bm[1]==='rail'?'side_rail':(window.kaguraAffBox(link)||'stay_banner'),affiliate_content_id:bm[3],affiliate_page_path:window.location.pathname});
        sent.add(link);observer.unobserve(link);continue;
      }
      // 宿の枠の中の、バナー以外の広告リンク(会場近くの宿の写真カード stay-hotel/、本・グッズ aff-amazon/)。クリックと同じ置き場所で、表示も数える(MEAS-20261117-2)
      const sm=/^(stay|aff)-(rakuten|jalan|amazon|hotel)\/(.+)$/.exec(link.getAttribute('data-goatcounter-click')||''),box=window.kaguraAffBox(link);
      if(sm&&box) {
        window.gtag('event','affiliate_view',{affiliate_partner:sm[2]==='hotel'?'rakuten':sm[2],affiliate_placement:box,affiliate_content_id:sm[3],affiliate_page_path:window.location.pathname});
        sent.add(link);observer.unobserve(link);continue;
      }
      const category=link.getAttribute('data-affiliate-category'),partner=link.getAttribute('data-affiliate-partner'),placement=link.getAttribute('data-affiliate-placement'),id=link.getAttribute('data-affiliate-id');
      if(!['supplies','experiences','rental','learn','furusato'].includes(category)||!['rakuten','rakuten-ichiba','vc-asoview','vc-jalan-rental','rakuten-rental','rakuten-carshare','vc-jalan-activity','rakuten-books','rakuten-furusato'].includes(partner)||!['guide_supplies','guide_rental','experience_guide','experience_directory','nearby_experiences','event_experiences','event_rental','regular_experiences','regular_rental','kagura_learn','history_learn','pref_furusato','kagura_furusato','event_learn','event_furusato','regular_learn','regular_furusato'].includes(placement)||!/^[-a-z0-9]{1,48}$/.test(id??''))continue;
      window.gtag('event','affiliate_view',{affiliate_partner:partner,affiliate_category:category,affiliate_placement:placement,affiliate_content_id:id,affiliate_page_path:window.location.pathname});
      sent.add(link);observer.unobserve(link);
    }
  },{threshold:0.5});
  function observe(){for(const link of document.querySelectorAll('a[data-affiliate-category],a[data-banner-partner],[data-vc-ad][data-affiliate-category],[data-vc-ad][data-banner-partner],[data-aff-box] a[data-goatcounter-click][rel~="sponsored"]'))if(!sent.has(link)){observer.unobserve(link);observer.observe(link);}}
  window.addEventListener('kagura:analytics-ready',observe);
  window.addEventListener('kagura:ads-ready',observe);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')observe();});
  observe();
})();
