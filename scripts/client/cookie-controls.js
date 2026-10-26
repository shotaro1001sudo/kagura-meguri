// Reopen the native popup only on explicit action; never submit a consent choice.
(() => {
  const button=document.getElementById('cookie-settings-open');
  const status=document.getElementById('cookie-settings-status');
  if(!button||!status)return;
  const en=document.documentElement.lang==='en';
  let pending=false,cooling=false,timer;
  const text=en?{
    pending:'Opening cookie settings…',opened:'Choose your cookie settings in the popup.',
    unavailable:'Cookie settings could not be opened. Please reload the page and try again.'
  }:{pending:'Cookie設定を開いています…',opened:'ポップアップでCookieの設定を選べます。',unavailable:'Cookie設定を開けませんでした。ページを再読み込みしてからお試しください。'};
  const update=()=>{button.setAttribute('aria-disabled',String(pending||cooling));};
  const finish=key=>{pending=false;clearTimeout(timer);button.removeAttribute('aria-busy');status.textContent=text[key];update();};
  window.addEventListener('CookiebotOnDialogDisplay',()=>{if(pending)finish('opened');});
  button.addEventListener('click',()=>{
    if(pending||cooling)return;
    let cb;
    try{cb=window.Cookiebot;if(typeof cb?.renew!=='function'){status.textContent=text.unavailable;return;}}
    catch{status.textContent=text.unavailable;return;}
    pending=true;cooling=true;update();button.setAttribute('aria-busy','true');status.textContent=text.pending;
    setTimeout(()=>{cooling=false;update();},1000);
    timer=setTimeout(()=>{if(pending)finish('unavailable');},8000);
    try{
      cb.renew();
      // An already-open native popup need not emit a second display event.
      const popup=document.getElementById('CybotCookiebotDialog');
      if(pending&&popup&&popup.getClientRects().length&&getComputedStyle(popup).visibility==='visible'&&getComputedStyle(popup).opacity!=='0'&&popup.getAttribute('aria-hidden')!=='true')finish('opened');
    }catch{finish('unavailable');}
  });
})();
