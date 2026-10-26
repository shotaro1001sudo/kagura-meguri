// Owner-issued public ad tags, checked 2026-10-25. Do not reuse text PID 892725735 for MyLink.
export const VC = Object.freeze({sid:'3784232',stay:'892732997',activity:'892732911',banner:'892732859'});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const vcEnabled=(aff,kind)=>aff?.allowed===true && aff.sid===VC.sid && aff.pid===VC[kind];
export function vcHref(kind,destination) {
  if(!['stay','activity','banner'].includes(kind))throw Error('Unknown VC placement');
  let suffix='';
  if(kind!=='banner') {
    const u=new URL(destination);
    if(u.origin!=='https://www.jalan.net'||u.username||u.password||u.hash||
      (kind==='stay'?u.pathname!=='/uw/uwp2011/uww2011init.do':!/^\/activity\/\d{6}\/$/.test(u.pathname)))throw Error('Invalid issued MyLink destination');
    suffix='&vc_url='+encodeURIComponent(destination);
  }
  return `//ck.jp.ap.valuecommerce.com/servlet/referral?sid=${VC.sid}&pid=${VC[kind]}${suffix}`;
}
/** Tracking/layout metadata belongs outside the issued anchor/image. Template contents are inert. */
export function vcTag({kind,destination,text,meta={},className='',id=''}) {
  const href=vcHref(kind,destination),pid=VC[kind];
  if(meta["data-goatcounter-click"] && !meta["data-goatcounter-title"])meta={...meta,"data-goatcounter-title":meta["data-goatcounter-click"]};
  const attrs=Object.entries(meta).map(([key,value])=>{
    if(!/^data-(goatcounter-(click|title)|affiliate-(category|partner|placement|id)|banner-partner)$/.test(key))throw Error('Invalid VC wrapper metadata');
    return `${key}="${esc(value)}"`;
  }).join(' ');
  const img=`<img src="//ad.jp.ap.valuecommerce.com/servlet/gifbanner?sid=${VC.sid}&amp;pid=${pid}"${kind==='banner'?'':' height="1" width="0"'} border="0" alt="${kind==='banner'?'じゃらんnetの宿泊予約':''}">`;
  return `<span data-vc-ad="${kind}" class="vc-ad ${esc(className)}"${id?` id="${esc(id)}"`:''} ${attrs} hidden><template><a href="${esc(href)}" rel="nofollow sponsored noopener noreferrer" target="_blank">${img}${kind==='banner'?'':esc(text)}</a></template></span>`;
}
