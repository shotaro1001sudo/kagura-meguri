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
const areaTag = (x,placement,className='',text=x.prefecture+'の体験をじゃらんで探す') => vcTag({kind:'activity',destination:x.url,text,className,meta:{'data-goatcounter-click':'experience-jalan/'+areaId(x).replace('experience-pref-',''),'data-affiliate-category':'experiences','data-affiliate-partner':'vc-jalan-activity','data-affiliate-placement':placement,'data-affiliate-id':areaId(x)}});
const adNote = aff => affOn(aff)?'<span class="pr">広告</span> じゃらん遊び・体験へのアフィリエイトリンクです。予約で当サイトに報酬が入ることがあります。':'広告リンクではありません。';
// 広告の印: 枠ごとに1つ、枠の下に「PR」だけを置く(2026-11-14 運営者の依頼。リンクの文に「(広告)」は付けない。読み上げの aria-label には残す)
export const PR_FOOT = '<span class="pr pr-foot">PR</span>';
const prFoot = aff => affOn(aff)?PR_FOOT:'';
// 地方の折りたたみの見出しに添える、短い県名(北海道はそのまま)。
const shortPref = p => p==='北海道'?p:p.replace(/[都府県]$/,'');
// 広告(同意が要る)を読み込めないときは、同じ県の「じゃらん遊び・体験」へ広告ではない普通のリンクで案内する(押せない飾りにしない。報酬は発生しない)
// 47都道府県は地方ごとに折りたたむ。広告の文は発行原本のままなので、並べ方で探しやすくする。
// 2026-11-15 運営者の依頼: 一覧の上に、じゃらん遊び・体験の公式の画像バナーを1つ置く(飛び先は全国のトップ)。県ごとのリンクは、県名だけの文字にする(飛び先は県ごと)。
// 県ごとのリンクに画像は付けない: MyLink に付けてよいのは「じゃらんのサイトの中にある画像」だけで、公式バナー(バリューコマースのサーバーにある)は当たらないため
// 2026-11-15 の監査: じゃらんのバナーは広告の同意がないと出ず、そのときこのページに報酬の出るリンクが無くなるため、
// 同意の要らない楽天トラベル 観光体験の 600×200(周辺体験のカードと同じ発行コード。じゃらんのバナーと同じ 3:1)を横に並べる
export function experienceDirectory(aff,{rakuten=false}={}) {
  if (!affOn(aff)) return "";
  const rakutenBanner=rakuten?`<a class="nearby-banner" href="${esc(EXPERIENCE_BANNER.url)}" aria-label="楽天トラベル 観光体験で体験を探す(広告)" target="_blank" rel="sponsored noopener noreferrer" data-goatcounter-click="experience-rakuten/directory-banner" data-goatcounter-title="experience-rakuten/directory-banner" data-affiliate-category="experiences" data-affiliate-partner="rakuten" data-affiliate-placement="experience_directory" data-affiliate-id="rakuten-experiences-banner"><img src="${esc(EXPERIENCE_BANNER.imageUrl)}" alt="現地の観光体験を楽天トラベルで探す" width="600" height="200" loading="lazy" decoding="async"></a>`:'';
  const banner=vcTag({kind:'activityBanner',className:'nearby-banner',meta:{'data-goatcounter-click':'experience-jalan/directory-banner','data-affiliate-category':'experiences','data-affiliate-partner':'vc-jalan-activity','data-affiliate-placement':'experience_directory','data-affiliate-id':'jalan-activity-banner'}});
  return `<section class="planning-section" aria-labelledby="experience-area-h"><h2 id="experience-area-h">訪問先の都道府県から探す</h2><p>このサイトに公演を載せていない県も選べます。</p><div class="experience-banner">${banner}${rakutenBanner}</div><p class="meta annotation">${rakuten?'画像のバナーは「じゃらん遊び・体験」と「楽天トラベル 観光体験」、県名のリンクは「じゃらん遊び・体験」です。':'リンク先は「じゃらん遊び・体験」です。'}県内全域の検索です。会場からの距離や所要時間は、リンク先でご確認ください。${adNote(aff)}</p><div class="experience-regions">${REGIONS.map(([name,prefs],i)=>`<details id="experience-region-${i}" class="experience-region"><summary><b>${esc(name)}</b><span>${prefs.map(shortPref).map(esc).join('・')}</span></summary><div class="experience-areas">${prefs.map(p=>{const x=experienceArea(p);return `<div class="experience-area" id="${areaId(x)}">${areaTag(x,'experience_directory','',p)}<a class="experience-unavailable" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(p)}</a></div>`;}).join('')}</div></details>`).join('')}</div><p class="meta annotation">地域リンクの出典: <a href="${directory.source}" target="_blank" rel="noopener noreferrer">じゃらん遊び・体験の全国エリア一覧</a>(${directory.checked}確認)</p>${PR_FOOT}</section>`;
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
// レンタカーは 2026-11-23 に、PCの両サイドのPR枠と同じ発行(2026-11-15、楽天トラベル レンタカー 300×300「大手レンタカー会社多数! 豊富な車種から比較&予約可能!」)に替えた。
// それまでの 300×250(「旅行いくなら! 楽天トラベルレンタカー」の検索窓の絵)は、開催ページの枠で28日に表示約530回・クリック0回だった。行き先は同じ(travel.rakuten.co.jp/cars/)
export const RENTAL_BANNER = {
  "url": "https://hb.afl.rakuten.co.jp/hsc/59865392.63f8ca10.585fa57b.dad29d3a/?link_type=pict&ut=eyJwYWdlIjoic2hvcCIsInR5cGUiOiJwaWN0IiwiY29sIjoxLCJjYXQiOiIxIiwiYmFuIjoyNzYyNTA2LCJhbXAiOmZhbHNlfQ%3D%3D",
  "imageUrl": "https://hbb.afl.rakuten.co.jp/hsb/59865392.63f8ca10.585fa57b.dad29d3a/?me_id=2100017&me_adv_id=2762506&t=pict",
  "width": 300, "height": 300
};
export const CARSHARE_BANNER = {
  "url": "https://hb.afl.rakuten.co.jp/hsc/58cd09f6.7960bea0.585fa57b.dad29d3a/_RTLink152141?link_type=pict&ut=eyJwYWdlIjoic2hvcCIsInR5cGUiOiJwaWN0IiwiY29sIjoxLCJjYXQiOjEsImJhbiI6MjEzODQyNiwiYW1wIjpmYWxzZX0%3D",
  "imageUrl": "https://hbb.afl.rakuten.co.jp/hsb/58cd09f6.7960bea0.585fa57b.dad29d3a/?me_id=2101064&me_adv_id=2138426&t=pict",
  "width": 300, "height": 250
};
// 発行した画像の大きさ(帯の中で場所を先に取るために書く)
const bannerSize = (o) => { const b = [RENTAL_BANNER, CARSHARE_BANNER].find((x) => x.imageUrl === o.imageUrl); return b ? `width="${b.width}" height="${b.height}"` : 'width="300" height="250"'; };
// 周辺体験のカードに出す、楽天トラベル 観光体験の横長バナー(600×200「旅行先で思い出に残る現地体験を予約しよう！」)。
// 2026-11-15 に楽天アフィリエイトの管理画面(ショップリンクの作成、me_id=2100034)で発行した href と img のまま。同意の要らない広告なので、いつも出る
export const EXPERIENCE_BANNER = {
  url: `https://hb.afl.rakuten.co.jp/hsc/598af1ac.81f4e586.585fa57b.dad29d3a/?link_type=pict&ut=${encodeURIComponent(Buffer.from('{"page":"shop","type":"pict","col":1,"cat":"1","ban":2185647,"amp":false}').toString("base64"))}`,
  imageUrl: "https://hbb.afl.rakuten.co.jp/hsb/598af1ac.81f4e586.585fa57b.dad29d3a/?me_id=2100034&me_adv_id=2185647&t=pict"
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
// verified:false のときは、カードの「掲載情報確認」の日付を出さない(開催・定期公演の「車で行くなら」)
export function offerCards(settings,category,context,today,placement,{verified=true}={}) {
  const offers=offersFor(settings,category,context,today);
  if(!offers.length)return '';
  const labels={supplies:'観覧用品を探す',experiences:'体験プランを探す',rental:'レンタカー・カーシェアを探す'};
  const action=o=>o.provider==='rakuten-carshare'?'カーシェアを探す':category==='rental'?'レンタカーを探す':labels[category];
  return `<section class="planning-ads" aria-label="${labels[category]}・広告"><p class="meta annotation"><span class="pr">広告</span> 外部サービスの広告です。購入・予約で当サイトに報酬が入ることがあります。</p><div class="planning-grid">${offers.map(o=>`<article class="planning-card${category==='rental'?' compact':''}">${category!=='supplies'&&category!=='rental'?`<p class="meta">${`${esc(o.prefecture)} ${esc(o.city)}`}</p>`:''}<h3>${esc(o.title)}</h3>${category==='rental'?'':`<p>${esc(o.reason)}</p>`}${category==='rental'?'':`<details class="pc-more"><summary>選び方・注意</summary><dl><dt>選ぶときに</dt><dd>${esc(o.criteria)}</dd><dt>不要な場面・注意</dt><dd>${esc(o.unnecessary)}</dd></dl></details>`}<a class="${o.imageUrl?'planning-banner':'btn ghost sm'}" href="${esc(o.url)}" aria-label="${esc(providers[o.provider].name)}で${action(o)}(広告)" target="_blank" rel="sponsored noopener noreferrer" data-goatcounter-click="planning-${category}/${o.id}" data-affiliate-category="${category}" data-affiliate-partner="${o.provider}" data-affiliate-placement="${esc(placement)}" data-affiliate-id="${o.id}">${o.imageUrl?`<img src="${esc(o.imageUrl)}" alt="" loading="lazy"><span>${esc(providers[o.provider].name)}で${action(o)}</span>`:`${esc(providers[o.provider].name)}で${action(o)}`}</a>${verified?`<p class="meta annotation">掲載情報確認: ${o.verifiedAt}</p>`:''}</article>`).join('')}</div>${PR_FOOT}</section>`;
}
export const experiences = [
  {id:'takachiho-boat',prefecture:'宮崎県',city:'高千穂町',name:'高千穂峡の貸しボート',place:'高千穂峡',reason:'峡谷の景色を水上から眺めたい方へ。神楽とは違う角度から土地の自然に触れる候補です。',detail:'予約方法・営業カレンダー・天候による休止を公式案内で確認してください。',source:'https://takachiho-kanko.info/boat/d/',by:'高千穂町観光協会',notice:''},
  {id:'amaterasu-cart',prefecture:'宮崎県',city:'高千穂町',name:'あまてらす鉄道のカート乗車',place:'旧高千穂駅',reason:'旧鉄道の線路や鉄橋の景色を楽しみたい方へ。地域を眺める乗車体験の候補です。',detail:'グランドスーパーカートの乗車は往復約30分。事前予約は受け付けず当日窓口で購入する案内です。待ち時間・休園日・天候による運休も公式で確認してください。',source:'https://amaterasu-railway.jp/attraction',by:'高千穂あまてらす鉄道',notice:''}
];
export function experiencesFor(context,today) {
  if(!date(today)||today<CHECKED||Date.parse(today)-Date.parse(CHECKED)>90*864e5)return [];
  return experiences.filter(x=>context.guide||(context.prefecture===x.prefecture&&(!context.city||cityOf(context.city)===x.city)));
}
// 体験の注意書きと、開催地域の施設紹介例。周辺体験のカードの中(compact)では、紹介例を折りたたむ。
const experienceNotes=(items,aff,compact)=>{
  const grid=`<div class="planning-grid">${items.map(x=>`<article class="planning-card"><p class="meta">${esc(x.prefecture)} ${esc(x.city)}・${esc(x.place)}</p><h3>${esc(x.name)}</h3><p>${esc(x.reason)}</p><p>${esc(x.detail)}</p>${x.notice?`<p class="planning-notice">${esc(x.notice)}</p>`:''}<a class="btn ghost sm" href="${x.source}" target="_blank" rel="noopener noreferrer">公式で営業・利用方法を確認</a><p class="meta annotation">公式案内: ${esc(x.by)}(${CHECKED.replace(/^(\d{4})-0?(\d+)-0?(\d+)$/, "$1年$2月$3日")}確認)</p></article>`).join('')}</div>`;
  return `<details class="pc-more"><summary>ご注意</summary><p class="meta annotation">県内全域の一覧です。会場からの距離・市町村・日付・所要時間はリンク先で確認してください。公演会場からの移動時間は未確認です。${adNote(aff)}公演の受付・移動・食事の時間を先に確保して、訪問先の体験を選びましょう。</p></details>${items.length?(compact?`<details class="pc-more"><summary>開催地域での施設紹介例</summary>${grid}</details>`:`<h3>開催地域での施設紹介例</h3>${grid}`):''}<p class="meta annotation">営業状況・空き・価格はリアルタイム表示ではありません。公演前に利用できることを保証するものではありません。</p>`;
};
// 都道府県のページの欄。
export function experienceSection(context,today,aff) {
  const area=experienceArea(context.prefecture);if(!area)return '';
  return `<section id="nearby-experiences" class="planning-section" aria-labelledby="nearby-experiences-h"><p class="planning-eyebrow">周辺体験</p><h2 id="nearby-experiences-h">${esc(context.prefecture)}で立ち寄れる体験を探す</h2>${affOn(aff)?`<div class="nearby-actions">${areaTag(area,'nearby_experiences','vc-experience')}<a class="nearby-more" href="/experiences.html#${areaId(area)}">ほかの都道府県から探す</a></div>`:""}${experienceNotes(experiencesFor(context,today),aff,false)}${prFoot(aff)}</section>`;
}
// 公演のページでは、周辺体験のカードの中に開催県の体験検索をまとめる。
// rakuten: 楽天アフィリエイトのIDがあるか。あれば、ほかの体験の予約サービスとして、楽天トラベル 観光体験のバナーも出す(2026-11-15 運営者の依頼)
export function experienceCard(context,today,aff,{rakuten=false}={}) {
  const area=experienceArea(context.prefecture);if(!area)return '';
  // 並び: じゃらん遊び・体験の画像バナー → ほかの予約サービス(楽天トラベル 観光体験・アソビュー!)。
  // 「◯◯県の体験をじゃらんで探す」のボタンは、画像バナーに置き換えてやめた(2026-11-15 運営者の依頼)。県ごとの入口は、下の「ほかの都道府県から探す」(周辺体験のページの、その県の位置)から。
  // じゃらんとアソビューはバリューコマースの発行コードのまま、広告の同意があるときだけ出す(vcTag)。楽天は同意が要らないので、いつも出る
  const vcBanner=(kind,partner,id,click)=>vcTag({kind,className:'nearby-banner',meta:{'data-goatcounter-click':click,'data-affiliate-category':'experiences','data-affiliate-partner':partner,'data-affiliate-placement':'nearby_experiences','data-affiliate-id':id}});
  const rakutenBanner=rakuten?`<a class="nearby-banner" href="${esc(EXPERIENCE_BANNER.url)}" aria-label="楽天トラベル 観光体験で体験を探す(広告)" target="_blank" rel="sponsored noopener noreferrer" data-goatcounter-click="experience-rakuten/banner" data-goatcounter-title="experience-rakuten/banner" data-affiliate-category="experiences" data-affiliate-partner="rakuten" data-affiliate-placement="nearby_experiences" data-affiliate-id="rakuten-experiences"><img src="${esc(EXPERIENCE_BANNER.imageUrl)}" alt="現地の観光体験を楽天トラベルで探す" width="600" height="200" loading="lazy" decoding="async"></a>`:'';
  // アソビュー!のバナーは 2026-11-23 に外した(絵柄が人物の写真で、28日に表示約160回・クリック0回。じゃらん・楽天と3つ並んで見づらかった。都道府県のページも 11-15 に2つにしている)
  const others=rakutenBanner?`<div class="nearby-others">${rakutenBanner}</div>`:'';
  return `<section id="nearby-experiences" class="planning-nearby" aria-labelledby="nearby-experiences-h"><span class="meta">周辺体験</span><b id="nearby-experiences-h">神楽までの半日、何する？</b>${affOn(aff)?`<div class="nearby-main">${vcBanner('activityBanner','vc-jalan-activity','jalan-activity-banner','experience-jalan/banner')}</div>`:""}${others}<div class="nearby-sub">${affOn(aff)?`<a class="nearby-more" href="/experiences.html#${areaId(area)}">ほかの都道府県から探す</a>`:""}${experienceNotes(experiencesFor(context,today),aff,true)}</div>${affOn(aff)||rakuten?PR_FOOT:''}</section>`;
}
// 開催県がわかる公演では周辺体験をカードにまとめ、わからなければ全国の入口へのリンクにする。
// 開催・定期公演のページ(prep:false)は周辺体験だけにし、持ち物・行き帰りのカードは置かない(2026-10-30 運営者の判断)。
export function planningLinks(context={},today=CHECKED,aff,{prep=true,rakuten=false}={}) {
  const nearby=experienceCard(context,today,aff,{rakuten});
  return `<nav class="planning-links${prep?'':' solo'}" aria-label="神楽旅の準備">${prep?'<a href="/guide.html#packing"><span class="meta">持ち物</span><b>夜神楽の持ち物を選ぶ</b></a><a href="/guide.html#transport"><span class="meta">行き帰り</span><b>車で行く神楽旅</b></a>':''}${nearby||'<a href="/experiences.html"><span class="meta">周辺体験</span><b>神楽までの半日、何する？</b></a>'}</nav>`;
}
export function rentalSearch(settings,context,today,placement,opts) {
  const ads=offerCards(settings,'rental',context,today,placement,opts);
  return ads;
}
// 「車で行くなら」の枠。開催・定期公演のページでは、PCの右のPR枠(rail)に置く(2026-11-15 運営者の依頼)。
// PR枠の中では、枠ごとの「PR」はPR枠の下の1つにまとめる。PR枠が出ない画面(スマホなど)では、同じバナーを帯「旅の手配」の先頭に入れる(rentalStripItems)
// 見出し「車で行くなら」・説明の1行・「移動の注意」・「掲載情報確認」は出さない(2026-11-15 運営者の依頼)。カードの「レンタカーを探す」「カーシェアを探す」とバナーだけにする
export function transportSection(settings,context,today,placement,{rail=false}={}) {
  const ads=rentalSearch(settings,context,today,placement,{verified:false});
  if (!ads) return "";
  return `<section class="${rail?'rail-car':'planning-section'}" aria-label="車で行くなら">${rail?ads.replace(PR_FOOT,''):ads}</section>`;
}
// スマホなどの帯「旅の手配」に入れる、レンタカー・カーシェアのバナー(2026-11-15 運営者の依頼。「車で行くなら」の枠を、帯にまとめる)。
// 発行した href と img のまま。計測は今までどおり(レンタカーの配置 event_rental・regular_rental)。画像は、どちらも 300×250(同日に確かめた大きさ。帯の中で場所を先に取るために書く)
// 画像のない広告(文字のリンクだけを発行したもの)は、同じ高さの文字のタイルにする
// card: 一覧の中のPRと同じ横長のカード(左に絵・右に文字)にする(2026-11-15 運営者の依頼「旅の手配も、一覧と同じ横長バナー画像に」)
export function rentalStripItems(settings,context,today,placement,{card=false}={}) {
  return offersFor(settings,'rental',context,today).map(o=>{
    const label=`${providers[o.provider].name}で${o.provider==='rakuten-carshare'?'カーシェア':'レンタカー'}を探す`;
    return `<a class="strip-banner${o.imageUrl?(card?' strip-card':''):' strip-text'}" href="${esc(o.url)}" aria-label="${esc(label)}(広告)" target="_blank" rel="sponsored noopener noreferrer" data-goatcounter-click="planning-rental/${o.id}" data-affiliate-category="rental" data-affiliate-partner="${o.provider}" data-affiliate-placement="${esc(placement)}" data-affiliate-id="${o.id}">${o.imageUrl&&card?`<img src="${esc(o.imageUrl)}" alt="" ${bannerSize(o)} loading="lazy" decoding="async"><span><b>${esc(label)}</b><small>${esc(providers[o.provider].name)}で見る ›</small></span>`:o.imageUrl?`<img src="${esc(o.imageUrl)}" alt="${esc(label)}" ${bannerSize(o)} loading="lazy" decoding="async">`:`<span>${esc(label)}</span>`}</a>`;
  });
}
