(() => {
  const box=document.getElementById('quiz-offer');
  if(!box||typeof matchMedia!=='function'||window.top!==window.self||location.pathname==='/quiz.html')return;
  const key='km-quiz-offer';
  try{if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,'0');sessionStorage.removeItem(key);}catch{return;}
  const desktop=matchMedia('(hover: hover) and (pointer: fine)').matches;
  let peak=scrollY,previous=null,dirty=false,shown=false,elapsed=0,visibleSince=document.visibilityState==='visible'?Date.now():null;
  const close=box.querySelector('button');
  const visible=n=>n&&!n.hidden&&getComputedStyle(n).display!=='none'&&getComputedStyle(n).visibility!=='hidden'&&n.getClientRects().length>0;
  const typing=()=>document.activeElement?.matches('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
  const blocked=()=>Array.from(document.querySelectorAll('dialog[open],[role="dialog"],#CybotCookiebotDialog')).some(n=>visible(n));
  const engagedTime=()=>elapsed+(visibleSince===null?0:Date.now()-visibleSince);
  function dismiss(){
    if(box.hidden)return;
    const restore=box.contains(document.activeElement);box.hidden=true;document.body.style.removeProperty('--quiz-offer-space');document.body.classList.remove('quiz-offer-visible');observer.disconnect();
    if(restore&&previous?.isConnected)previous.focus({preventScroll:true});
  }
  const observer=new MutationObserver(()=>{if(!box.hidden&&(blocked()||typing()))dismiss();});
  function offer(){
    if(shown||engagedTime()<30000||document.visibilityState!=='visible'||dirty||typing()||blocked())return;
    try{if(sessionStorage.getItem(key))return;}catch{return;}
    // 本文と重ならない余白があるPCだけ右下へ。スマホ/狭幅は読んでいる本文の区切りに挿入する。
    const main=document.querySelector('main');
    const mainRect=main?.getBoundingClientRect();
    const inline=!desktop||!mainRect||innerWidth-mainRect.right<372;
    if(inline&&main){
      const candidates=Array.from(main.querySelectorAll('.card,section,article,p')).filter(n=>!box.contains(n)&&n!==box&&!n.closest('a,button,form,header,aside')&&n.getBoundingClientRect().bottom>=innerHeight*.4&&n.getBoundingClientRect().bottom<=innerHeight);
      const anchor=candidates.sort((a,b)=>Math.abs(a.getBoundingClientRect().bottom-innerHeight*.7)-Math.abs(b.getBoundingClientRect().bottom-innerHeight*.7))[0];
      box.classList.add('quiz-offer-inline');if(anchor)anchor.after(box);else main.append(box);
    }
    let bottom=16;
    if(!inline)for(const n of document.querySelectorAll('body *')){
      if(n===box||box.contains(n)||!visible(n))continue;
      const style=getComputedStyle(n),r=n.getBoundingClientRect();
      if(['fixed','sticky'].includes(style.position)&&r.top>=innerHeight/2&&r.top<innerHeight&&r.bottom>0)bottom=Math.max(bottom,innerHeight-r.top+12);
    }
    box.style.bottom=`${bottom}px`;box.hidden=false;
    const rect=box.getBoundingClientRect();
    if(rect.height>innerHeight*.45||(!inline&&rect.top<Math.max(100,innerHeight*.3))){box.hidden=true;return;}
    try{sessionStorage.setItem(key,'1');}catch{box.hidden=true;return;}
    shown=true;previous=document.activeElement;
    if(!inline){document.body.style.setProperty('--quiz-offer-space',`${rect.height+bottom}px`);document.body.classList.add('quiz-offer-visible');}
    // region + hidden を使用し、dialog.show()の暗黙のフォーカス移動も避ける。
    observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open','hidden','style','class','aria-modal']});
    document.removeEventListener('mouseout',leave);window.removeEventListener('scroll',scroll);
  }
  function leave(e){if(desktop&&peak>=120&&e.relatedTarget===null&&e.clientY<=0)offer();}
  function scroll(){
    peak=Math.max(peak,scrollY);
    const distance=document.documentElement.scrollHeight-innerHeight;
    if(!desktop&&distance>0&&peak>=Math.max(200,distance/2)&&peak-scrollY>=200)offer();
  }
  function visibility(){if(visibleSince!==null)elapsed+=Date.now()-visibleSince;visibleSince=document.visibilityState==='visible'?Date.now():null;if(visibleSince===null)dismiss();}
  close.addEventListener('click',dismiss);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!box.hidden){e.preventDefault();dismiss();}});
  document.addEventListener('input',e=>{if(e.target.closest('form')){dirty=true;dismiss();}});
  document.addEventListener('focusin',()=>{if(typing())dismiss();});
  window.addEventListener('CookiebotOnDialogDisplay',dismiss);
  window.addEventListener('resize',dismiss); // 回転・狭幅化で本文を覆う位置に残さない。
  document.addEventListener('visibilitychange',visibility);
  document.addEventListener('mouseout',leave);window.addEventListener('scroll',scroll,{passive:true});
})();
