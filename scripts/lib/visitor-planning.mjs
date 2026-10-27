import { vcEnabled, vcTag } from "./valuecommerce.mjs";
import { offerEligibility } from "./offer-eligibility.mjs";
// IDEA-003/004/005: 編集記事と広告設定を分離。宿泊のIDから別案件のURLを作らない。
import { readFileSync } from 'node:fs';
import { PREFECTURES, REGIONS } from './util.mjs';
const directory = JSON.parse(readFileSync(new URL('../../data/experience-regions.json',import.meta.url),'utf8'));
export const experienceRegions = directory.regions;
if(experienceRegions.length!==47||new Set(experienceRegions.map(x=>x.prefecture)).size!==47||!PREFECTURES.every(p=>experienceRegions.some(x=>x.prefecture===p))||experienceRegions.some(x=>!/^https:\/\/www\.jalan\.net\/activity\/\d{6}\/\?fromPage=search-area$/.test(x.url)))throw Error('体験の地域リンクを確認してください');
const experienceArea = p => experienceRegions.find(x=>x.prefecture===p);
const areaId = x => 'experience-pref-'+new URL(x.url).pathname.split('/')[2];
// 体験(じゃらん遊び・体験)専用にバリューコマースで発行したpid。宿のpidは使わない。aff={sid,pid}が揃うときだけ広告リンクにする。
const affOn = aff => vcEnabled(aff,"activity");
const areaTag = (x,placement,className='') => vcTag({kind:'activity',destination:x.url,text:x.prefecture+'の体験をじゃらんで探す',className,id:placement==='experience_directory'?areaId(x):'',meta:{'data-goatcounter-click':'experience-jalan/'+areaId(x).replace('experience-pref-',''),'data-affiliate-category':'experiences','data-affiliate-partner':'vc-jalan-activity','data-affiliate-placement':placement,'data-affiliate-id':areaId(x)}});
const adNote = aff => affOn(aff)?'<span class="pr">広告</span> じゃらん遊び・体験へのアフィリエイトリンクです。予約で当サイトに報酬が入ることがあります。':'広告リンクではありません。';
export function experienceDirectory(aff) {
  if (!affOn(aff)) return "";
  return `<section class="planning-section" aria-labelledby="experience-area-h"><h2 id="experience-area-h">訪問先の都道府県から探す</h2><p>全国47都道府県の体験一覧へ進めます。神楽の種類や、このサイトの公演掲載の有無にかかわらず利用できます。</p><p class="meta annotation">リンク先は「じゃらん遊び・体験」です。県内全域の検索なので、会場からの距離・市町村・体験日・所要時間をリンク先で確認してください。${adNote(aff)}</p><p class="meta experience-display-help">県名だけが表示される場合、体験広告は読み込まれていません。<a href="#cookie-controls">Cookie設定</a>や読み込み制限をご確認ください。設定を開くだけでは同意内容は変わりません。</p><nav class="taglist" aria-label="体験を地方から探す">${REGIONS.map(([name],i)=>`<a class="tag" href="#experience-region-${i}">${esc(name)}</a>`).join('')}</nav>${REGIONS.map(([name,prefs],i)=>`<section id="experience-region-${i}" class="planning-section"><h3>${esc(name)}</h3><div class="experience-areas">${prefs.map(p=>{const x=experienceArea(p);return areaTag(x,'experience_directory')+`<span class="experience-unavailable">${esc(p)}</span>`;}).join('')}</div></section>`).join('')}<p class="meta annotation">地域リンクの出典: <a href="${directory.source}" target="_blank" rel="noopener noreferrer">じゃらん遊び・体験の全国エリア一覧</a> ／ 確認日: ${directory.checked}。プラン数・価格・空き状況はこのサイトで表示していません。</p></section>`;
}
export const CHECKED = '2026-10-25';
const esc = (s='') => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = s => typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s;
const cityOf = s => String(s??'').replace(/^.*郡/,'');
const providers = {
  'rakuten-carshare':{category:'rental',name:'楽天カーシェア',host:'hb.afl.rakuten.co.jp'},
  'rakuten-rental':{category:'rental',name:'楽天トラベル',host:'hb.afl.rakuten.co.jp'},
  'rakuten-ichiba':{category:'supplies',name:'楽天市場',host:'hb.afl.rakuten.co.jp'},
  'vc-asoview':{category:'experiences',name:'アソビュー！',host:'ck.jp.ap.valuecommerce.com'},
  'vc-jalan-rental':{category:'rental',name:'じゃらんレンタカー',host:'ck.jp.ap.valuecommerce.com'}
};
// 本人提供の不透明なhscバナーは、この発行済みのURLと画像の組だけを許可。
export const RENTAL_BANNER = {
  "url": "https://hb.afl.rakuten.co.jp/hsc/58ccf272.42d284bf.585fa57b.dad29d3a/_RTLink152141?link_type=pict&ut=eyJwYWdlIjoic2hvcCIsInR5cGUiOiJwaWN0IiwiY29sIjoxLCJjYXQiOjEsImJhbiI6Mjc2MjQ5NiwiYW1wIjpmYWxzZX0%3D",
  "imageUrl": "https://hbb.afl.rakuten.co.jp/hsb/58ccf272.42d284bf.585fa57b.dad29d3a/?me_id=2100017&me_adv_id=2762496&t=pict"
};
export const CARSHARE_BANNER = {
  "url": "https://hb.afl.rakuten.co.jp/hsc/58cd09f6.7960bea0.585fa57b.dad29d3a/_RTLink152141?link_type=pict&ut=eyJwYWdlIjoic2hvcCIsInR5cGUiOiJwaWN0IiwiY29sIjoxLCJjYXQiOjEsImJhbiI6MjEzODQyNiwiYW1wIjpmYWxzZX0%3D",
  "imageUrl": "https://hbb.afl.rakuten.co.jp/hsb/58cd09f6.7960bea0.585fa57b.dad29d3a/?me_id=2101064&me_adv_id=2138426&t=pict"
};
export function validOffer(o,today) {
  if(offerEligibility(o,today))return false;
  if(!o||o.enabled!==true||o.approved!==true||!date(today)||!date(o.verifiedAt)||!date(o.expiresAt)||o.verifiedAt>today||o.expiresAt<today||o.expiresAt<o.verifiedAt)return false;
  if(Date.parse(today)-Date.parse(o.verifiedAt)>90*864e5)return false;
  const p=providers[o.provider];
  if(!p||p.category!==o.category||typeof o.id!=='string'||!/^[-a-z0-9]{1,48}$/.test(o.id))return false;
  if(!['title','reason','criteria','unnecessary','approvalReference'].every(k=>typeof o[k]==='string'&&o[k].trim()))return false;
  const national=['rakuten-rental','rakuten-carshare'].includes(o.provider)&&o.category==='rental'&&o.scope==='national';
  if(o.scope!==undefined&&!national)return false;
  if(o.category!=='supplies'&&!national&&!['prefecture','city'].every(k=>typeof o[k]==='string'&&o[k].trim()))return false;
  if(o.eventIds!==undefined&&(!Array.isArray(o.eventIds)||!o.eventIds.every(id=>typeof id==='string'&&/^[-a-z0-9]+$/.test(id))))return false;
  try {
    if(typeof o.url!=='string'||/[\s\\\u0000-\u001f\u007f]/.test(o.url))return false;
    const u=new URL(o.url);
    if(u.protocol!=='https:'||u.hostname!==p.host||u.username||u.password||u.port||u.hash)return false;
    if(u.pathname.startsWith('/hsc/')) {
      const issued={'rakuten-rental':RENTAL_BANNER,'rakuten-carshare':CARSHARE_BANNER}[o.provider];
      return !!issued&&o.url===issued.url&&o.imageUrl===issued.imageUrl&&o.scope==='national';
    }
    if(o.imageUrl!==undefined)return false;
    if(o.provider==='rakuten-ichiba'||o.provider==='rakuten-rental') {
      if(!/^\/(hgc|ichiba)\/[A-Za-z0-9._/-]+\/$/.test(u.pathname))return false;
      if(o.provider==='rakuten-rental'&&!u.searchParams.has('pc'))return false;
      for(const key of ['pc','m'])if(u.searchParams.has(key)) {
        const target=new URL(u.searchParams.get(key));
        if(target.protocol!=='https:'||target.username||target.password||target.port)return false;
        if(o.provider==='rakuten-rental') {
          if(!((target.hostname==='travel.rakuten.co.jp'&&target.pathname.startsWith('/cars/'))||target.hostname==='cars.travel.rakuten.co.jp'))return false;
        } else if(!['search.rakuten.co.jp','item.rakuten.co.jp','books.rakuten.co.jp'].includes(target.hostname))return false;
      }
    } else {
      if(u.pathname!=='/servlet/referral'||!['sid','pid'].every(k=>/^\d+$/.test(u.searchParams.get(k)??'')))return false;
      if(u.searchParams.has('vc_url')) {
        const target=new URL(u.searchParams.get('vc_url'));
        if(target.protocol!=='https:'||target.username||target.password||target.port)return false;
        if(o.provider==='vc-asoview'&&!['asoview.com','www.asoview.com'].includes(target.hostname))return false;
        if(o.provider==='vc-jalan-rental'&&(!['jalan.net','www.jalan.net'].includes(target.hostname)||!target.pathname.startsWith('/rentacar/')))return false;
      }
    }
    return true;
  } catch {return false;}
}
export function offersFor(settings,category,context={},today) {
  if(settings?.categories?.[category]?.enabled!==true||!Array.isArray(settings.offers))return [];
  const seen=new Set();
  return settings.offers.filter(o=>{
    if(!validOffer(o,today)||o.category!==category||seen.has(o.id)||seen.has(o.url))return false;
    if(category!=='supplies'&&o.scope!=='national'&&!context.guide&&(context.prefecture!==o.prefecture||cityOf(context.city)!==cityOf(o.city)))return false;
    if(Array.isArray(o.eventIds)&&o.eventIds.length&&!o.eventIds.includes(context.id))return false;
    seen.add(o.id);seen.add(o.url);return true;
  }).slice(0,category==='supplies'?5:3);
}
export function offerCards(settings,category,context,today,placement) {
  const offers=offersFor(settings,category,context,today);
  if(!offers.length)return '';
  const labels={supplies:'観覧用品を探す',experiences:'体験プランを探す',rental:'レンタカー・カーシェアを探す'};
  const action=o=>o.provider==='rakuten-carshare'?'カーシェアを探す':category==='rental'?'レンタカーを探す':labels[category];
  return `<section class="planning-ads" aria-label="${labels[category]}・広告"><p class="meta annotation"><span class="pr">広告</span> 外部サービスの広告です。購入・予約で当サイトに報酬が入ることがあります。</p><div class="planning-grid">${offers.map(o=>`<article class="planning-card${category==='rental'?' compact':''}">${category!=='supplies'&&category!=='rental'?`<p class="meta">${`${esc(o.prefecture)} ${esc(o.city)}`}</p>`:''}<h3>${esc(o.title)}</h3>${category==='rental'?'':`<p>${esc(o.reason)}</p>`}<details class="pc-more"><summary>${category==='rental'?'詳しく・注意':'選び方・注意'}</summary>${category==='rental'?`<p class="meta">${o.provider==='rakuten-carshare'?'対応エリア・ステーションを確認':o.scope==='national'?'全国の店舗を検索':`${esc(o.prefecture)} ${esc(o.city)}`}</p><p>${esc(o.reason)}</p>`:''}<dl><dt>選ぶときに</dt><dd>${esc(o.criteria)}</dd><dt>不要な場面・注意</dt><dd>${esc(o.unnecessary)}</dd></dl>${category==='rental'?`<p class="meta annotation">掲載情報確認: ${o.verifiedAt}</p>`:''}</details><a class="${o.imageUrl?'planning-banner':'btn ghost sm'}" href="${esc(o.url)}" aria-label="${esc(providers[o.provider].name)}で${action(o)}（広告）" target="_blank" rel="sponsored noopener noreferrer" data-goatcounter-click="planning-${category}/${o.id}" data-affiliate-category="${category}" data-affiliate-partner="${o.provider}" data-affiliate-placement="${esc(placement)}" data-affiliate-id="${o.id}">${o.imageUrl?`<img src="${esc(o.imageUrl)}" alt="" loading="lazy"><span>${esc(providers[o.provider].name)}で${action(o)}（広告）</span>`:`${esc(providers[o.provider].name)}で${action(o)}（広告）`}</a>${category==='rental'?'':`<p class="meta annotation">掲載情報確認: ${o.verifiedAt}</p>`}</article>`).join('')}</div></section>`;
}
export const experiences = [
  {id:'takachiho-boat',prefecture:'宮崎県',city:'高千穂町',name:'高千穂峡の貸しボート',place:'高千穂峡',reason:'峡谷の景色を水上から眺めたい方へ。神楽とは違う角度から土地の自然に触れる候補です。',detail:'予約方法・営業カレンダー・天候による休止を公式案内で確認してください。',source:'https://takachiho-kanko.info/boat/d/',by:'高千穂町観光協会',notice:'10月25日確認時点で、10月25・26日の営業休止が案内されています。再開状況も公式案内をご確認ください。'},
  {id:'amaterasu-cart',prefecture:'宮崎県',city:'高千穂町',name:'あまてらす鉄道のカート乗車',place:'旧高千穂駅',reason:'旧鉄道の線路や鉄橋の景色を楽しみたい方へ。地域を眺める乗車体験の候補です。',detail:'グランドスーパーカートの乗車は往復約30分。事前予約は受け付けず当日窓口で購入する案内です。待ち時間・休園日・天候による運休も公式で確認してください。',source:'https://amaterasu-railway.jp/attraction',by:'高千穂あまてらす鉄道',notice:''}
];
export function experiencesFor(context,today) {
  if(!date(today)||today<CHECKED||Date.parse(today)-Date.parse(CHECKED)>90*864e5)return [];
  return experiences.filter(x=>context.guide||(context.prefecture===x.prefecture&&(!context.city||cityOf(context.city)===x.city)));
}
// 体験の注意書きと、開催地域の施設紹介例。周辺体験のカードの中(compact)では、紹介例を折りたたむ。
const experienceNotes=(items,aff,compact)=>{
  const grid=`<div class="planning-grid">${items.map(x=>`<article class="planning-card"><p class="meta">${esc(x.prefecture)} ${esc(x.city)}・${esc(x.place)}</p><h3>${esc(x.name)}</h3><p>${esc(x.reason)}</p><p>${esc(x.detail)}</p>${x.notice?`<p class="planning-notice">${esc(x.notice)}</p>`:''}<a class="btn ghost sm" href="${x.source}" target="_blank" rel="noopener noreferrer">公式で営業・利用方法を確認</a><p class="meta annotation">公式案内: ${esc(x.by)} ／ 確認日: ${CHECKED}</p></article>`).join('')}</div>`;
  return `<details class="pc-more"><summary>ご注意</summary><p class="meta annotation">県内全域の一覧です。会場からの距離・市町村・日付・所要時間はリンク先で確認してください。公演会場からの移動時間は未確認です。${adNote(aff)}公演の受付・移動・食事の時間を先に確保して、訪問先の体験を選びましょう。</p></details>${items.length?(compact?`<details class="pc-more"><summary>開催地域での施設紹介例</summary>${grid}</details>`:`<h3>開催地域での施設紹介例</h3>${grid}`):''}<p class="meta annotation">営業状況・空き・価格はリアルタイム表示ではありません。公演前に利用できることを保証するものではありません。</p>`;
};
// 都道府県のページの欄。
export function experienceSection(context,today,aff) {
  const area=experienceArea(context.prefecture);if(!area)return '';
  return `<section id="nearby-experiences" class="planning-section" aria-labelledby="nearby-experiences-h"><p class="planning-eyebrow">周辺体験</p><h2 id="nearby-experiences-h">${esc(context.prefecture)}で立ち寄れる体験を探す</h2>${affOn(aff)?`<p>${areaTag(area,'nearby_experiences','vc-experience')} <a href="/experiences.html#${areaId(area)}">ほかの都道府県から探す</a></p>`:""}${experienceNotes(experiencesFor(context,today),aff,false)}</section>`;
}
// 公演のページでは、周辺体験のカードの中に開催県の体験検索をまとめる。
export function experienceCard(context,today,aff) {
  const area=experienceArea(context.prefecture);if(!area)return '';
  return `<section id="nearby-experiences" class="planning-nearby" aria-labelledby="nearby-experiences-h"><span class="meta">周辺体験</span><b id="nearby-experiences-h">神楽までの半日、何する？</b>${affOn(aff)?`<p>${areaTag(area,'nearby_experiences','vc-experience')}</p><a class="nearby-more" href="/experiences.html#${areaId(area)}">ほかの都道府県から探す</a>`:""}${experienceNotes(experiencesFor(context,today),aff,true)}</section>`;
}
// 開催県がわかる公演では周辺体験をカードにまとめ、わからなければ全国の入口へのリンクにする。
export function planningLinks(context={},today=CHECKED,aff) {
  const nearby=experienceCard(context,today,aff);
  return `<nav class="planning-links" aria-label="神楽旅の準備"><a href="/guide.html#packing"><span class="meta">持ち物</span><b>夜神楽の持ち物を選ぶ</b></a><a href="/guide.html#transport"><span class="meta">行き帰り</span><b>車で行く神楽旅</b></a>${nearby||'<a href="/experiences.html"><span class="meta">周辺体験</span><b>神楽までの半日、何する？</b></a>'}</nav>`;
}
export function rentalSearch(settings,context,today,placement) {
  const ads=offerCards(settings,'rental',context,today,placement);
  return ads;
}
export function transportSection(settings,context,today,placement) {
  const ads=rentalSearch(settings,context,today,placement);
  if (!ads) return "";
  return `<section class="planning-section" aria-labelledby="rental-h"><h2 id="rental-h">車で行くなら</h2><p class="planning-lead">レンタカーやカーシェアは、ここから探せます。</p><details class="pc-more"><summary>移動の注意</summary><p class="meta annotation">会場の公式アクセスと公共交通を先に確認し、貸出・返却店舗の営業時間、終演後の移動、駐車場の有無も確かめましょう。</p></details>${ads}</section>`;
}
