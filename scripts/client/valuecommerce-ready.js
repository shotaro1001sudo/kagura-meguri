// No rendering, network, storage or consent decisions: capture readiness before CMP can emit.
(() => {
  if(window.kaguraVcReady)return;
  const signal=window.kaguraVcReady={object:null};
  const remember=()=>{try{signal.object=window.Cookiebot||null;}catch{signal.object=null;}};
  for(const event of ['CookiebotOnDialogDisplay','CookiebotOnConsentReady','CookiebotOnLoad','CookiebotOnAccept','CookiebotOnDecline'])window.addEventListener(event,remember);
  window.addEventListener('pagehide',()=>{signal.object=null;});
})();
