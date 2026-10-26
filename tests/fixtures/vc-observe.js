// Read-only diagnostic instrumentation, injected by CDP before document scripts.
(() => {
  if (window.__vcProbeObserver) return;
  window.__vcProbeObserver = true;
  const state = () => {
    const c=window.Cookiebot;
    return {time:Math.round(performance.now()),path:location.pathname,top:window===window.top,readyState:document.readyState,
      adapterPresent:!!window.kaguraVcConsent,gate:window.kaguraVcConsent?.state,
      hasResponse:c?.hasResponse,consented:c?.consented,declined:c?.declined,
      marketing:c?.consent?.marketing,method:c?.consent?.method,
      methodType:typeof c?.consent?.method};
  };
  const emit=(event,listener)=>window.vcProbeEvent(JSON.stringify({event,listener,...state()}));
  for(const name of ['CookiebotOnConsentReady','CookiebotOnLoad','CookiebotOnAccept','CookiebotOnDecline','CookiebotOnDialogInit','CookiebotOnDialogDisplay','CookiebotOnTagsExecuted']) {
    window.addEventListener(name,()=>emit(name,'window-capture'),true);
    document.addEventListener(name,()=>emit(name,'document-capture'),true);
  }
  new MutationObserver(records=>{let count=0;for(const r of records){if(!r.target.closest?.('[data-vc-ad]'))continue;for(const n of r.addedNodes){if(n.nodeType!==1||n.tagName==='TEMPLATE')continue;count+=(n.tagName==='IMG'?1:0)+(n.querySelectorAll?.('img').length||0);}}if(count)window.vcProbeEvent(JSON.stringify({event:'vc-mount',count,...state()}));}).observe(document,{childList:true,subtree:true});
  emit('observer-installed','document-start');
  let previous='';let ticks=0;
  const timer=setInterval(()=>{const s=state(),key=JSON.stringify({...s,time:0});if(key!==previous){previous=key;emit('state-transition','sample');}if(++ticks>=400)clearInterval(timer);},25);
  document.addEventListener('DOMContentLoaded',()=>emit('DOMContentLoaded','document'),{once:true});
  window.addEventListener('load',()=>emit('window-load','window'),{once:true});
})();
