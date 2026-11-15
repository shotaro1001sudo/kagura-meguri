// Owner-issued public ad tags, checked 2026-10-25. Do not reuse text PID 892725735 for MyLink.
// PC の両サイドの PR 枠のバナー(2026-11-15 に本人のアカウントで発行。すべて公式の非JSのコード)
//   rail: じゃらんnet 広告ID 2761812「じゃらん限定プラン」250x250
//   railJtb: JTB 国内宿泊 広告ID 2444891「温泉宿 温泉旅行」300x300
//   railNta: 日本旅行 広告ID 2769016「JR・新幹線+ホテルパック」250x250
// 周辺体験のカードの画像バナー(2026-11-15 に本人のアカウントで発行。公式の非JSのコード)
//   activityBanner: じゃらん 遊び・体験予約(プログラムID 2139176)広告ID 2788658「汎用バナー」600x200。飛び先は jalan.net/activity/
//   asoview: アソビュー!(プログラムID 2130178)広告ID 2697400 600x100。飛び先は asoview.com
export const VC = Object.freeze({sid:'3784232',stay:'892732997',activity:'892732911',banner:'892732859',rail:'892748424',railJtb:'892748443',railNta:'892748444',activityBanner:'892748544',asoview:'892748546'});
const BANNER_ALT={banner:'じゃらんnetの宿泊予約',rail:'じゃらん限定プランの宿をじゃらんnetで探す',railJtb:'温泉宿・温泉旅行をJTBで探す',railNta:'JR・新幹線とホテルのセットを日本旅行で探す',activityBanner:'国内のレジャー・体験をじゃらん遊び・体験で予約する',asoview:'遊び・体験をアソビュー!で探す'};
const BANNERS=new Set(Object.keys(BANNER_ALT));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const vcEnabled=(aff,kind)=>aff?.allowed===true && aff.sid===VC.sid && aff.pid===VC[kind];
export function vcHref(kind,destination) {
  if(!['stay','activity',...BANNERS].includes(kind))throw Error('Unknown VC placement');
  let suffix='';
  if(!BANNERS.has(kind)) {
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
  const banner=BANNERS.has(kind);
  const img=`<img src="//ad.jp.ap.valuecommerce.com/servlet/gifbanner?sid=${VC.sid}&amp;pid=${pid}"${banner?'':' height="1" width="0"'} border="0" alt="${banner?BANNER_ALT[kind]:''}">`;
  return `<span data-vc-ad="${kind}" class="vc-ad ${esc(className)}"${id?` id="${esc(id)}"`:''} ${attrs} hidden><template><a href="${esc(href)}" rel="nofollow sponsored noopener noreferrer" target="_blank">${img}${banner?'':esc(text)}</a></template></span>`;
}
