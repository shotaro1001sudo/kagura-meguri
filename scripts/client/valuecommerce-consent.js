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
  function sync() {
    status.state=readState();
    const display=status.state==='allowed';
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
  window.addEventListener('kagura:consent',sync);
  document.addEventListener('DOMContentLoaded',sync);
  window.addEventListener('pageshow',sync);
  window.addEventListener('focus',sync);
  sync();
})();
