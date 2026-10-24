(() => {
  const box=document.getElementById('quiz-offer');
  if(!box||typeof box.show!=='function'||window.top!==window.self)return;
  const key='km-quiz-offer';
  try{if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,'0');sessionStorage.removeItem(key);}catch{return;}
  const started=Date.now(),desktop=matchMedia('(hover: hover) and (pointer: fine)').matches;
  let peak=scrollY,previous=null;
  const close=box.querySelector('button');
  function visible(n){return n&&getComputedStyle(n).display!=='none'&&getComputedStyle(n).visibility!=='hidden'&&n.getClientRects().length>0;}
  function offer(){
    if(Date.now()-started<30000||document.visibilityState!=='visible'||box.open)return;
    if(document.activeElement?.matches('input,textarea,select,[contenteditable]:not([contenteditable="false"])'))return;
    if(Array.from(document.querySelectorAll('dialog[open],[role="dialog"][aria-modal="true"],#CybotCookiebotDialog')).some(n=>n!==box&&visible(n)))return;
    try{if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,'1');}catch{return;}
    previous=document.activeElement;
    box.show();close.focus({preventScroll:true});
    document.removeEventListener('mouseout',leave);window.removeEventListener('scroll',scroll);
  }
  function leave(e){if(desktop&&e.relatedTarget===null&&e.clientY<=0)offer();}
  function scroll(){
    peak=Math.max(peak,scrollY);
    const distance=document.documentElement.scrollHeight-innerHeight;
    if(!desktop&&distance>0&&peak>=Math.max(200,distance/2)&&peak-scrollY>=200)offer();
  }
  function dismiss(){box.close();if(previous?.isConnected)previous.focus({preventScroll:true});}
  close.addEventListener('click',dismiss);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&box.open){e.preventDefault();dismiss();}});
  document.addEventListener('mouseout',leave);window.addEventListener('scroll',scroll,{passive:true});
})();
