// Explicit visitor action only. The CMP owns consent storage and notifications.
(() => {
  const button=document.getElementById('cookie-reject-optional');
  const status=document.getElementById('cookie-reject-status');
  if(!button||!status)return;
  const en=document.documentElement.lang==='en';
  let submitted=false,pending=false,timer;
  const messages=en?{
    unavailable:'Cookie settings are not ready. Please reload the page and try again.',
    pending:'Checking your cookie choice…',
    success:'Optional cookies are rejected. Necessary cookies remain enabled.',
    failed:'The change could not be confirmed. Please reload the page and check your settings.'
  }:{
    unavailable:'Cookie設定を読み込めません。ページを再読み込みしてからお試しください。',
    pending:'Cookie設定を確認しています…',
    success:'任意Cookieを拒否する設定になりました。必須Cookieは維持されます。',
    failed:'設定の変更を確認できませんでした。ページを再読み込みして、設定をご確認ください。'
  };
  const report=key=>{status.textContent=messages[key];};
  function rejected(cb) {
    return cb?.hasResponse===true&&cb.consent?.method==='explicit'&&cb.consent.necessary===true&&
      ['preferences','statistics','marketing'].every(k=>cb.consent[k]===false);
  }
  function confirm() {
    if(!pending)return;
    try {if(!rejected(window.Cookiebot))return;} catch {return;}
    pending=false;clearTimeout(timer);button.removeAttribute('aria-busy');report('success');
  }
  button.addEventListener('click',()=>{
    if(submitted)return;
    let cb;
    try {
      cb=window.Cookiebot;
      if(typeof cb?.submitCustomConsent!=='function'||typeof cb.hasResponse!=='boolean'||cb.consent?.necessary!==true||
        !['preferences','statistics','marketing'].every(k=>typeof cb.consent[k]==='boolean')){report('unavailable');return;}
      if(rejected(cb)){report('success');return;}
    } catch {report('unavailable');return;}
    // At most one submission per page, even if a response is slow, fails or throws.
    submitted=true;pending=true;button.setAttribute('aria-disabled','true');button.setAttribute('aria-busy','true');report('pending');
    timer=setTimeout(()=>{if(!pending)return;pending=false;button.removeAttribute('aria-busy');report('failed');},8000);
    try {cb.submitCustomConsent(false,false,false);confirm();}
    catch {pending=false;clearTimeout(timer);button.removeAttribute('aria-busy');report('failed');}
  });
  for(const name of ['CookiebotOnConsentReady','CookiebotOnAccept','CookiebotOnDecline'])window.addEventListener(name,confirm);
})();
