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
  emit('observer-installed','document-start');
  let previous='';let ticks=0;
  const timer=setInterval(()=>{const s=state(),key=JSON.stringify({...s,time:0});if(key!==previous){previous=key;emit('state-transition','sample');}if(++ticks>=400)clearInterval(timer);},25);
  document.addEventListener('DOMContentLoaded',()=>emit('DOMContentLoaded','document'),{once:true});
  window.addEventListener('load',()=>emit('window-load','window'),{once:true});
})();
