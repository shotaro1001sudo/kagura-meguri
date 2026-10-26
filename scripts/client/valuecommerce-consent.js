// B policy: confirmed unselected/allowed states may display the complete issued tag.
// Cookiebot readiness is required; missing/errored/ambiguous state never means unselected.
(() => {
  if(window.kaguraVcConsent)return;
  const status=window.kaguraVcConsent={state:'unknown'};
  let readyObject=null;
  const nodes=new Map();
  function readState() {
    try {
      const cb=window.Cookiebot;
      if(!cb||cb!==readyObject||typeof cb.hasResponse!=='boolean'||typeof cb.consent?.marketing!=='boolean')return 'unknown';
      if(cb.hasResponse && cb.consent.marketing===false)return 'denied'; // Includes old saved rejections.
      if(cb.hasResponse && cb.consent.marketing===true && cb.consent.method==='explicit')return 'allowed';
      if(cb.hasResponse===false && cb.consent.marketing===false && cb.consent.method===null)return 'unselected';
    } catch (_) { /* An unreadable CMP is not permission to load resources. */ }
    return 'unknown';
  }
  function sync() {
    status.state=readState();
    const display=status.state==='unselected'||status.state==='allowed';
    for(const slot of document.querySelectorAll('[data-vc-ad]')) {
      if(!display) {
        // Requests already initiated cannot be undone. Keep the original nodes only in memory.
        for(const child of [...slot.childNodes])if(child.nodeName!=='TEMPLATE')child.remove();
        slot.hidden=true;
        continue;
      }
      if(!nodes.has(slot)) {
        const template=slot.querySelector('template');
        if(!template)continue;
        nodes.set(slot,[...template.content.cloneNode(true).childNodes]);
      }
      // Reuse the same nodes and src attributes; never recreate an image on duplicate events.
      for(const node of nodes.get(slot))if(node.parentNode!==slot)slot.appendChild(node);
      slot.hidden=false;
    }
    window.dispatchEvent(new Event('kagura:ads-ready'));
  }
  function ready() {
    try { readyObject=window.Cookiebot||null; } catch (_) { readyObject=null; }
    sync();
  }
  // DialogDisplay is the documented signal that an unanswered banner is displayed.
  // ConsentReady/Load describe loaded or submitted consent, not first script readiness.
  // Keep the full hasResponse/marketing/method checks; DialogInit alone is insufficient.
  for(const name of ['CookiebotOnDialogDisplay','CookiebotOnConsentReady','CookiebotOnLoad','CookiebotOnAccept','CookiebotOnDecline'])window.addEventListener(name,ready);
  // Register immediately after the existing synchronous Cookiebot script; render after DOM parsing.
  document.addEventListener('DOMContentLoaded',sync);
  window.addEventListener('pagehide',()=>{readyObject=null;sync();});
  window.addEventListener('pageshow',sync); // Restored pages remain unknown until CMP reports readiness again.
  sync();
})();
