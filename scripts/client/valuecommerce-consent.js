// Only explicit marketing consent displays complete issued tags. Missing CMP fails closed.
(() => {
  if(window.kaguraVcConsent)return;
  const status=window.kaguraVcConsent={state:'unknown'};
  const nodes=new Map();
  function readState() {
    try {
      const choice=window.kaguraConsent?.snapshot();
      if(choice?.ready !== true)return 'unknown';
      return choice.marketing === true ? 'allowed' : 'denied';
    } catch (_) { return 'unknown'; }
  }
  // data-vc-media のある広告は、その条件に合う画面でだけ読み込む(PCの両サイドのPR枠はスマホで読み込まず、スマホの帯はPCで読み込まない)。
  // 条件を確かめられないブラウザでは、今までどおり読み込む
  function wanted(slot) {
    const query=slot.getAttribute('data-vc-media');
    if(!query||typeof window.matchMedia!=='function')return true;
    try { return window.matchMedia(query).matches===true; } catch (_) { return true; }
  }
  function sync() {
    status.state=readState();
    const display=status.state==='allowed';
    for(const slot of document.querySelectorAll('[data-vc-ad]')) {
      if(!display||!wanted(slot)) {
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
  window.addEventListener('kagura:consent',sync);
  document.addEventListener('DOMContentLoaded',sync);
  window.addEventListener('pageshow',sync);
  window.addEventListener('focus',sync);
  // 画面の大きさ・向きが変わって条件が変わったら、出す広告を合わせ直す(続けて変わるあいだは待つ。条件つきの広告がないページでは何もしない)
  let timer=0;
  window.addEventListener('resize',()=>{
    if(!document.querySelector('[data-vc-ad][data-vc-media]'))return;
    clearTimeout(timer); timer=setTimeout(sync,200);
  });
  sync();
})();
