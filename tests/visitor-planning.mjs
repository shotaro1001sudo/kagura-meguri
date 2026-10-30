import * as rawCheerio from "cheerio";
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import { renderedCheerio as cheerio } from "./rendered-vc.mjs";
import {JSDOM,VirtualConsole} from 'jsdom';
import {CARSHARE_BANNER,RENTAL_BANNER,rentalSearch,validOffer,offersFor,offerCards,experiences,experiencesFor,experienceSection,experienceRegions,experienceDirectory,planningLinks} from '../scripts/lib/visitor-planning.mjs';
import {PREFECTURES,REGIONS} from '../scripts/lib/util.mjs';

export function visitorPlanningTests({ok,section,OUT,build}) {
  section('観覧準備3企画: 広告の個別承認・期限・対象地域・安全なURL');
  const today='2026-10-25',context={id:'t-full',prefecture:'宮崎県',city:'西臼杵郡高千穂町'};
  const base={enabled:true,approved:true,verifiedAt:today,expiresAt:'2026-12-01',title:'確認済み候補',reason:'用途の説明',criteria:'選ぶ基準',unnecessary:'不要な場面もある',approvalReference:'テスト専用の承認記録（実広告ではない）'};
  const supplies={...base,id:'test-supplies',category:'supplies',provider:'rakuten-ichiba',url:'https://hb.afl.rakuten.co.jp/hgc/test.shop/?pc=https%3A%2F%2Fsearch.rakuten.co.jp%2Fsearch%2Fmall%2Fcushion%2F'};
  const experience={...base,id:'test-experience',category:'experiences',provider:'vc-asoview',prefecture:'宮崎県',city:'高千穂町',url:'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=1111111&pid=2222222&vc_url=https%3A%2F%2Fwww.asoview.com%2F'};
  const rental={...base,id:'test-rental',category:'rental',provider:'vc-jalan-rental',prefecture:'宮崎県',city:'高千穂町',url:'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=1111111&pid=3333333&vc_url=https%3A%2F%2Fwww.jalan.net%2Frentacar%2F'};
  const settings={categories:{supplies:{enabled:true},experiences:{enabled:true},rental:{enabled:true}},offers:[supplies,experience,rental]};
  ok(settings.offers.every(o=>validOffer(o,today)),'3カテゴリの個別正式リンクを扱える');
  for(const patch of [{approved:false},{enabled:false},{verifiedAt:'2026-11-01'},{verifiedAt:'2026-01-01'},{verifiedAt:'2026-02-30'},{expiresAt:'2026-10-24'},{approvalReference:''},{eventIds:'all'},{url:'javascript:alert(1)'},{url:'http://hb.afl.rakuten.co.jp/hgc/test/'},{url:'https://hb.afl.rakuten.co.jp.evil.test/hgc/test/'},{url:'https://user:pass@hb.afl.rakuten.co.jp/hgc/test/'},{url:'https://hb.afl.rakuten.co.jp:444/hgc/test/'},{url:supplies.url+'#fragment'},{url:supplies.url+'&m=https%3A%2F%2Fevil.test%2F'}])ok(!validOffer({...supplies,...patch},today),'未確認・対象外・危険リンクを非表示: '+Object.keys(patch).join());
  const rakutenRental={...base,id:'test-rakuten-rental',category:'rental',provider:'rakuten-rental',scope:'national',url:'https://hb.afl.rakuten.co.jp/hgc/test.rental/?pc=https%3A%2F%2Ftravel.rakuten.co.jp%2Fcars%2F'};
  const rentalSettings={categories:{rental:{enabled:true}},offers:[rakutenRental]};
  ok(validOffer(rakutenRental,today)&&offersFor(rentalSettings,'rental',{prefecture:'島根県',city:'浜田市'},today).length===1,'専用の全国検索リンクは特定の神楽に限定せず利用できる');
  for(const url of ['https://hb.afl.rakuten.co.jp/hgc/test.rental/','https://hb.afl.rakuten.co.jp/hgc/test.rental/?pc=https%3A%2F%2Ftravel.rakuten.co.jp%2F','https://hb.afl.rakuten.co.jp/hgc/test.rental/?pc=https%3A%2F%2Fitem.rakuten.co.jp%2F','https://hb.afl.rakuten.co.jp/hgc/test.rental/?pc=https%3A%2F%2Fcars.travel.rakuten.co.jp.evil.test%2F'])ok(!validOffer({...rakutenRental,url},today),'レンタカーに宿泊・市場・不明遷移を流用しない');
  ok(!validOffer({...rental,scope:'national'},today)&&!validOffer({...experience,scope:'national'},today),'地域限定の既存案件を全国へ拡大しない');
  const nationalRental=cheerio.load(offerCards(rentalSettings,'rental',{},today,'guide_rental'));
  ok(nationalRental('a[rel~=sponsored]').attr('href')===rakutenRental.url&&nationalRental.root().text().includes('全国の店舗を検索'),'全国レンタカーは全国検索と広告を明示し発行URLを保持');
  ok(!validOffer({...rental,url:rental.url.replace('rentacar','hotel')},today),'宿泊向けの遷移先をレンタカーへ流用しない');
  ok(!validOffer({...rental,provider:'vc-asoview'},today),'広告主とカテゴリが一致しないリンクを非表示');
  ok(offersFor(settings,'experiences',context,today).length===1&&offersFor(settings,'experiences',{prefecture:'宮崎県',city:'延岡市'},today).length===0,'県だけで別の市町村へ体験広告を広げない');
  ok(offersFor({...settings,offers:[{...experience,eventIds:['another-event']}]},'experiences',context,today).length===0,'当該公演の限定条件を守る');
  ok(offersFor({...settings,offers:[supplies,supplies,{...supplies,id:'copy'}]},'supplies',{},today).length===1,'同じID・URLの二重表示を防ぐ');
  ok(offerCards({categories:{},offers:settings.offers},'rental',context,today,'event_rental')===''&&offerCards({categories:{rental:{enabled:true}},offers:[]},'rental',context,today,'event_rental')==='','未設定で空枠・仮カードを出さない');
  const escaped=cheerio.load(offerCards({...settings,offers:[{...supplies,title:'<img src=x onerror=alert(1)>',reason:'<script>bad()</script>'}]},'supplies',{},today,'guide_supplies'));
  ok(escaped('img,script,[onerror]').length===0&&escaped('h3').text().includes('<img'),'設定の文章をHTMLとして実行しない');
  ok(escaped('a[rel~=sponsored][rel~=noopener][target=_blank]').length===1&&escaped('a').text().includes('楽天市場')&&escaped('a').text().includes('広告'),'リンク先名と広告を明示し安全な外部リンクにする');
  ok(experiencesFor(context,today).length===2&&experiencesFor({prefecture:'大分県',city:'高千穂町'},today).length===0,'公式確認済みの2体験を当該地域だけへ接続');
  ok(experiencesFor(context,'2027-02-01').length===0,'90日を超えた未再確認の体験を出し続けない');
  // 休止の案内は、公式で確認できた時点のものだけを出す。10/25・26の台風による休止は、10/30に公式の営業カレンダーで終了を確認した
  const boat=experiences.find(x=>x.id==='takachiho-boat'),boatNotice=boat.notice;
  boat.notice='確認時点で、営業休止が案内されています。';
  const noticed=cheerio.load(experienceSection(context,today));
  boat.notice=boatNotice;
  ok(noticed('.planning-notice').text().includes('営業休止')&&experienceSection(context,today).includes('移動時間は未確認'),'確認時点の休止があれば明示し、移動の未確認も明示して、間に合うと断言しない');
  ok(!experienceSection(context,today).includes('10月25・26日'),'終わった休止(10月25・26日)の案内を出し続けない');
  const national=cheerio.load(experienceDirectory({sid:'3784232',pid:'892732911',allowed:true}));
  ok(experienceRegions.length===47&&new Set(experienceRegions.map(x=>x.url)).size===47&&PREFECTURES.every(p=>experienceRegions.some(x=>x.prefecture===p)),'全国47都道府県の実際の検索先が揃い、県とURLの重複がない');
  ok(national('.experience-areas a:not(.experience-unavailable)').length===47&&national('.experience-areas a.experience-unavailable').length===47&&!national.root().text().includes('高千穂'),'全国向けの入口を特定の神楽や施設の紹介に限定しない');
  for(const prefecture of PREFECTURES){
    const page=cheerio.load(experienceSection({prefecture,city:'未登録の開催市'},today,{sid:'3784232',pid:'892732911',allowed:true}));
    const expected=experienceRegions.find(x=>x.prefecture===prefecture);
    ok(new URL(page('#nearby-experiences a').first().attr('href'),'https://kagurameguri.jp').searchParams.get('vc_url')===expected.url&&page('h2').text().includes(prefecture),`${prefecture}: 開催県の体験検索を引き継ぐ`);
    const card=cheerio.load(planningLinks({prefecture},today,{sid:'3784232',pid:'892732911',allowed:true}));
    ok(card('.planning-links>a').length===2&&card('.planning-links>#nearby-experiences').length===1&&new URL(card('#nearby-experiences a').first().attr('href'),'https://kagurameguri.jp').searchParams.get('vc_url')===expected.url&&!card.html().includes('href="#nearby-experiences"'),`${prefecture}: 公演の「周辺体験」のカードの中で、当該県の体験を探せる`);
  }
  const aff={sid:'3784232',pid:'892732911',allowed:true},affPage=cheerio.load(experienceSection({prefecture:'高知県'},today,aff)),affLink=affPage('#nearby-experiences a').first(),kochi=experienceRegions.find(x=>x.prefecture==='高知県');
  ok(affLink.attr('href')==='//ck.jp.ap.valuecommerce.com/servlet/referral?sid=3784232&pid=892732911&vc_url='+encodeURIComponent(kochi.url)&&affLink.attr('rel').includes('sponsored')&&affPage.text().includes('アフィリエイトリンク')&&!affPage.text().includes('広告リンクではありません'),'体験用pidがあれば、県の体験一覧をバリューコマース経由の広告リンクとして明示する');
  const affNational=cheerio.load(experienceDirectory(aff));
  ok(affNational('.experience-areas a[rel~=sponsored]').length===47&&affNational('.experience-areas a:not(.experience-unavailable)').toArray().every(x=>affNational(x).attr('href').includes('pid=892732911')),'全国一覧の47都道府県すべてに体験用pidが付く');
  ok(!experienceSection({prefecture:"高知県"},today,{sid:"1111111",pid:""}).includes("www.jalan.net"),"pid未設定なら通常の体験検索を出さない");
  ok(experienceSection({prefecture:'未確認県'},today)===''&&planningLinks({},today).includes('href="/experiences.html"'),'地域不明は他県を推測せず全国入口へ案内');
  const kochiSection=cheerio.load(experienceSection({prefecture:'高知県'},today,aff)),takachihoCard=cheerio.load(planningLinks(context,today,aff));
  ok(kochiSection('.planning-eyebrow').text()==='周辺体験'&&![experienceSection({prefecture:'高知県'},today,aff),planningLinks(context,today,aff)].some(h=>h.includes('公演の前後も楽しむ')),'「公演の前後も楽しむ」の呼び方をやめ、都道府県のページの欄も「周辺体験」とよぶ');
  ok(takachihoCard('#nearby-experiences details summary').filter((i,x)=>takachihoCard(x).text()==='開催地域での施設紹介例').next('.planning-grid').find('.planning-card').length===2&&takachihoCard('#nearby-experiences h2,#nearby-experiences h3:not(.planning-card h3)').length===0,'施設紹介例は、周辺体験のカードの中で折りたたむ(カードの中に見出しの欄を作らない)');
  ok(experienceRegions.find(x=>x.prefecture==='静岡県').url.includes('/210000/')&&experienceRegions.find(x=>x.prefecture==='岐阜県').url.includes('/220000/'),'地域コードをJISコードから推測せず公式のリンク対応を保持');
  ok(experienceDirectory() === "", "未設定の体験ディレクトリは通常検索で代替しない");
  // 体験の全国一覧: 同じ文の広告リンクが47個並ぶと県名を探しにくいので、地方ごとに折りたたむ(運営者の判断 2026-10-30)
  const regions=affNational('details.experience-region');
  ok(regions.length===REGIONS.length&&regions.toArray().every(d=>!affNational(d).attr('open'))&&affNational('.taglist').length===0,'47都道府県は地方ごとの折りたたみにし、最初はすべて閉じる(地方へのページ内リンクの列は置かない)');
  ok(REGIONS.every(([name,prefs],i)=>{const d=affNational(`#experience-region-${i}`),label=d.children('summary').text();return label.startsWith(name)&&prefs.every(p=>label.includes(p==='北海道'?p:p.replace(/[都府県]$/,'')))&&d.find('.experience-area').length===prefs.length;}),'地方の見出しに、含まれる県の名前を添え、その地方の県だけを中に並べる');
  const areaBoxes=affNational('.experience-area').toArray();
  ok(areaBoxes.length===47&&areaBoxes.every(x=>/^experience-pref-\d{6}$/.test(affNational(x).attr('id'))&&affNational(x).find('[data-vc-ad]').length===1&&affNational(x).find('a.experience-unavailable').length===1)&&affNational('[data-vc-ad][id]').length===0,'県ごとの枠に移動先のIDを置き、広告の枠にはIDを付けない(IDの重複なし)');
  const pageTargets=[...new Set(PREFECTURES.flatMap(prefecture=>[experienceSection({prefecture},today,aff),planningLinks({prefecture},today,aff)]).flatMap(h=>[...h.matchAll(/href="\/experiences\.html#([^"]+)"/g)].map(m=>m[1])))];
  ok(pageTargets.length===47&&pageTargets.every(id=>affNational(`#${id}`).closest('details.experience-region').length===1),'県のページ・公演のページの「ほかの都道府県から探す」は、全国一覧の中の当該県へつながる');
  const openerErrors=[],openerConsole=new VirtualConsole();openerConsole.on('jsdomError',e=>openerErrors.push(e));
  const opener=new JSDOM(experienceDirectory(aff),{url:'https://kagurameguri.jp/experiences.html#experience-pref-340000',runScripts:'outside-only',virtualConsole:openerConsole}),ow=opener.window;
  ow.Element.prototype.scrollIntoView=function(){ow.scrolled=this.id;};
  ow.eval(readFileSync('scripts/client/details-target.js','utf8'));
  const chugoku=ow.document.querySelector('#experience-pref-340000')?.closest('details');
  ok(chugoku?.open&&ow.scrolled===chugoku.id&&[...ow.document.querySelectorAll('details.experience-region')].filter(d=>d.open).length===1,'リンクで来たときは、その県の地方だけを開き、地方の見出しから表示する');
  ow.location.hash='#experience-pref-470000';ow.dispatchEvent(new ow.HashChangeEvent('hashchange'));
  ok(ow.document.querySelector('#experience-pref-470000')?.closest('details')?.open&&chugoku?.open,'ページ内で別の県へ移ったときも、その地方を開く(開いている地方は閉じない)');
  for(const hash of ['#%E0%A4%A','#missing','#experience-area-h'])ow.location.hash=hash,ow.dispatchEvent(new ow.HashChangeEvent('hashchange'));
  ok(openerErrors.length===0&&[...ow.document.querySelectorAll('details.experience-region')].filter(d=>d.open).length===2,'壊れたリンク・存在しない行き先・折りたたみの外の行き先では何もしない');ow.close();
  // 都道府県のページ: 体験検索のボタンを1行に置き、その下に「ほかの都道府県から探す」
  const prefActions=cheerio.load(experienceSection({prefecture:'広島県'},today,aff))('.nearby-actions');
  ok(prefActions.children().length===2&&prefActions.children().first().is('[data-vc-ad]')&&prefActions.children().last().is('a.nearby-more[href="/experiences.html#experience-pref-340000"]'),'都道府県のページの周辺体験: 体験検索のボタンと、その下のほかの都道府県への入口');
  // 公演のページのカード: 主ボタン(体験検索)と、区切りの下の小さな入口(ほかの都道府県・施設紹介例)
  const nearbyCard=cheerio.load(planningLinks(context,today,aff))('#nearby-experiences'),nearbySub=nearbyCard.children('.nearby-sub');
  ok(nearbyCard.children('.nearby-main').children('[data-vc-ad]').length===1&&nearbySub.children('a.nearby-more').length===1&&nearbySub.children('details.pc-more').children('summary').toArray().some(x=>x.children.map(c=>c.data).join('')==='開催地域での施設紹介例')&&nearbyCard.children('p').length===0,'公演のページの周辺体験: 体験検索を主ボタンにし、ほかの都道府県と施設紹介例を区切りの下にそろえる');
  const home=cheerio.load(readFileSync(join(OUT,'index.html'),'utf8')),guide=cheerio.load(readFileSync(join(OUT,'guide.html'),'utf8'));
  ok(home('.planning-links a').length===3&&home('.home-discovery').next().hasClass('home-hero'),'公演探しを保持し、3つの観覧準備入口を用意');
  const fullEvent=cheerio.load(readFileSync(join(OUT,'events/t-full.html'),'utf8')),weekly=cheerio.load(readFileSync(join(OUT,'regular/r-weekly.html'),'utf8'));
  ok([fullEvent,weekly].every(p=>p('.d-rest .planning-links>#nearby-experiences').length===1&&p('#nearby-experiences').length===1&&p('.planning-links>a[href="#nearby-experiences"]').length===0&&!p.html().includes('公演の前後も楽しむ')),'開催・定期公演のページでは、周辺体験の欄をカードに集約し、別の欄を作らない');
  ok(guide('#packing .planning-card').length===4&&guide('#transport .planning-steps li').length===3,'持ち物4種類と公共交通→貸出返却→会場経路の順で案内');
  ok(guide('.planning-ads').length===0,'本番の新規3カテゴリは未承認なので広告を出さない');

  const supplied=JSON.parse(readFileSync('data/visitor-planning.json','utf8'));
  // 観覧用品は運営者の判断で止めている(2026-10-30)。商品の決まりは、カテゴリを有効にした写しで確かめる
  ok(supplied.categories.supplies.enabled===false&&offersFor(supplied,'supplies',{},today).length===0,'本番データ: 観覧用品の広告は止めている(運営者の判断)');
  const suppliesOn={...supplied,categories:{...supplied.categories,supplies:{enabled:true}}};
  const selected=offersFor(suppliesOn,'supplies',{},today);
  const published=cheerio.load(offerCards(suppliesOn,'supplies',{},today,'guide_supplies'));
  ok(selected.length===3&&published('a[data-affiliate-category=supplies]').length===3,'本人提供の3商品だけを用品広告として表示');
  ok(published('a[data-affiliate-category=supplies]').toArray().every((a,i)=>published(a).attr('href')===selected[i].url&&new URL(selected[i].url).searchParams.get('pc')===selected[i].destinationUrl),'発行URLの全パラメーターを保持し、選定商品と遷移先が一致');
  ok(!supplied.categories.experiences.enabled&&supplied.categories.rental.enabled&&!published.root().text().includes('ポイント10倍')&&!published.root().text().includes('2,268円'),'体験は無効、レンタカーのみ追加有効、期限付きの価格・ポイントを固定表示しない');
  ok(offersFor(suppliesOn,'supplies',{},'2026-11-24').length===3&&offersFor(suppliesOn,'supplies',{},'2026-11-25').length===0,'再確認期限の当日まで表示し、翌日から3商品を非表示');

  const ownerRental=supplied.offers.find(o=>o.provider==='rakuten-rental');
  ok(validOffer(ownerRental,today),'本人発行のhsc画像バナーを承認条件つきで扱える');
  for(const patch of [{url:ownerRental.url+'&pc=https://evil.test/'},{imageUrl:ownerRental.imageUrl.replace('2762496','1234567')},{url:ownerRental.url.replace('_RTLink152141','_RTLink111111')},{provider:'rakuten-ichiba'},{scope:undefined},{approved:false}])ok(!validOffer({...ownerRental,...patch},today),'バナーの組み替え・未承認・別用途を拒否: '+Object.keys(patch).join());
  const banner=cheerio.load(rentalSearch(supplied,{guide:true},today,'guide_rental'));
  ok(banner('a[rel~=sponsored]').attr('href')===RENTAL_BANNER.url&&banner('img').attr('src')===RENTAL_BANNER.imageUrl&&banner('a').attr('aria-label').includes('レンタカー'),'本人発行のリンクと画像を保持し、画像に依存しないリンク名を持つ');
  const expired=cheerio.load(rentalSearch(supplied,{},'2026-11-25','guide_rental'));
  ok(expired("img,[rel~=sponsored],[data-rental-search]").length===0,"バナー期限切れで通常検索を含む収益枠を省略");

  const carshare=supplied.offers.find(o=>o.provider==='rakuten-carshare');
  const cars=cheerio.load(rentalSearch(supplied,{guide:true},today,'guide_rental'));
  const shareLink=cars('[data-affiliate-partner=rakuten-carshare]');
  ok(validOffer(carshare,today)&&shareLink.length===1&&shareLink.attr('href')===CARSHARE_BANNER.url&&shareLink.find('img').attr('src')===CARSHARE_BANNER.imageUrl,'カーシェアも本人発行のURLと画像を保持');
  ok(shareLink.attr('aria-label').includes('カーシェア')&&!shareLink.attr('aria-label').includes('レンタカー')&&shareLink.closest('article').text().includes('対応エリア・ステーション'),'サービス名と対応エリアの確認を案内しレンタカーと混同しない');
  ok(!validOffer({...carshare,provider:'rakuten-rental'},today)&&!validOffer({...ownerRental,provider:'rakuten-carshare'},today)&&!validOffer({...carshare,imageUrl:RENTAL_BANNER.imageUrl},today),'カーシェアとレンタカーのコード・画像の取り違えを拒否');
  ok(offersFor(supplied,'rental',{prefecture:'宮崎県',city:'高千穂町'},today).length===2&&offersFor(supplied,'rental',{prefecture:'島根県',city:'浜田市'},today).length===2,'両サービスの入口を開催場所に限定せず案内し、利用可能と断言しない');
  const fullPage=cheerio.load(readFileSync(join(OUT,'events/t-full.html'),'utf8')),dayPage=cheerio.load(readFileSync(join(OUT,'events/t-long.html'),'utf8')),unknownPage=cheerio.load(readFileSync(join(OUT,'events/t-timeunknown.html'),'utf8')),pastPage=cheerio.load(readFileSync(join(OUT,'events/t-past.html'),'utf8'));
  ok([fullPage,dayPage,unknownPage].every(p=>p(".stay").length===0),"宿未設定では時刻に関わらず枠を省略");
  ok(!fullPage(".page-notes").text().includes("人数・宿泊日はリンク先で変更"),"未設定の宿泊条件注記も省略");
  const direct=fullPage('[data-rental-search]');
  ok(direct.length===0 && guide("[data-rental-search]").length===0,"未発行レンタカーの通常検索を省略");
  ok(pastPage(".stay,[data-rental-search]").length===0 && fullPage("[data-official-link]").length>0,"終了済みの宿・車は省略し公式公演情報は保持");

  const temp=mkdtempSync(join(tmpdir(),'km-planning-'));
  try {
    const file=join(temp,'settings.json');writeFileSync(file,JSON.stringify(settings));
    const output=join(temp,'all');const built=build('tests/fixtures/events.test.json',output,{VISITOR_PLANNING_FILE:file,TEST_PLANNING_OFF:'0',BUILD_NOW:today+'T12:00',TEST_AFF_TRAVEL:'1',TEST_GA:'G-TEST123456'});
    ok(built.status===0,'3カテゴリを有効にした本物のビルドが成功',built.stderr);
    if(built.status===0) {
      const g=cheerio.load(readFileSync(join(output,'guide.html'),'utf8')),event=cheerio.load(readFileSync(join(output,'events/t-full.html'),'utf8')),past=cheerio.load(readFileSync(join(output,'events/t-past.html'),'utf8')),other=cheerio.load(readFileSync(join(output,'events/t-xss.html'),'utf8'));
      ok(g('a[data-affiliate-category=supplies]').length===1&&g('a[data-affiliate-category=rental]').length===1,'ガイドの該当箇所に用品・レンタカーを表示');
      ok(event('a[data-affiliate-category=experiences]').length===1&&event('a[data-affiliate-category=rental]').length===1,'対象公演だけに体験・レンタカーを表示');
      ok(past('.planning-ads,.planning-links,#nearby-experiences').length===0&&other(':is(a[data-affiliate-category=supplies],a[data-affiliate-category=experiences],a[data-affiliate-category=rental])').length===0,'終了済み・地域不一致の公演に広告を出さない(本・ふるさと納税の紹介は別の仕組み)');
      ok(event('.d-side .staylinks a[rel~=sponsored]').length===2&&event('[data-official-link]').length===1,'既存の宿泊2件と公式情報ボタンを維持');
      ok(event('main').html().indexOf('data-official-link')<event('main').html().indexOf('planning-ads'),'公式予約情報を広告より先に表示');
    }
    const issuedOutput=join(temp,'issued');
    const issued=build('tests/fixtures/events.test.json',issuedOutput,{VISITOR_PLANNING_FILE:'data/visitor-planning.json',TEST_PLANNING_OFF:'0',BUILD_NOW:today+'T12:00'});
    ok(issued.status===0,'本人提供コードの実設定でビルド成功',issued.stderr);
    if(issued.status===0){
      const actual=cheerio.load(readFileSync(join(issuedOutput,'guide.html'),'utf8'));
      const csp=actual('meta[http-equiv="Content-Security-Policy"]').attr('content')||'';
      ok(actual('[data-affiliate-category=supplies]').length===0&&actual('.pick').length===0&&actual('[data-affiliate-category=rental]').length===2&&actual('.planning-banner img').attr('src')===RENTAL_BANNER.imageUrl,'実ビルドでは観覧用品を出さず、車移動のバナー2件は残す');
      ok(/img-src[^;]*https:\/\/hbb\.afl\.rakuten\.co\.jp/.test(csp)&&!/script-src[^;]*hbb\.afl/.test(csp),'画像配信元だけCSPで許可し、スクリプトには許可しない');
    }
    const partial={...settings,categories:{supplies:{enabled:true},experiences:{enabled:false},rental:{enabled:false}}};writeFileSync(file,JSON.stringify(partial));
    const part=build('tests/fixtures/events.test.json',join(temp,'part'),{VISITOR_PLANNING_FILE:file,TEST_PLANNING_OFF:'0',BUILD_NOW:today+'T12:00'});
    ok(part.status===0&&cheerio.load(readFileSync(join(temp,'part/guide.html'),'utf8'))('[data-affiliate-category]').length===1,'一部カテゴリだけの有効化も独立する');
  } finally {rmSync(temp,{recursive:true,force:true});}

  section('3企画の広告計測: 同意後の可視表示とクリック・個人情報なし');
  const html=offerCards(settings,'supplies',{},today,'guide_supplies');
  const dom=new JSDOM(html,{url:'https://kagurameguri.jp/guide.html?private=secret',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,sent=[];let notify;
  w.IntersectionObserver=class {constructor(fn){notify=fn}observe(){}unobserve(){}};
  w.gtag=(...args)=>sent.push(args);w.kaguraGa4Allowed=false;
  w.eval(readFileSync('scripts/client/affiliate.js','utf8'));
  const link=w.document.querySelector('a');link.addEventListener('click',e=>e.preventDefault());
  const show=ratio=>notify([{target:link,isIntersecting:true,intersectionRatio:ratio}]);
  show(1);link.click();ok(sent.length===0,'同意前や自己除外中は表示・クリックを送信しない');
  w.kaguraGa4Allowed=true;show(.25);ok(sent.length===0,'半分未満の表示を表示数にしない');show(1);show(1);link.click();
  ok(sent.filter(s=>s[1]==='affiliate_view').length===1&&sent.filter(s=>s[1]==='affiliate_click').length===1,'可視表示1回とクリックを別々に計測');
  ok(sent.every(s=>s[2].affiliate_category==='supplies'&&s[2].affiliate_placement==='guide_supplies')&&!JSON.stringify(sent).includes('secret')&&!JSON.stringify(sent).includes('http'),'カテゴリと公開IDだけを送りリンククエリ・注文・個人情報を送らない');
  w.kaguraGa4Allowed=false;link.click();ok(sent.length===2,'同意撤回後は再度送信しない');dom.window.close();

  section('楽天の車移動・じゃらん体験: 実際の生成リンクのGA4回帰');
  const directoryHtml=experienceDirectory(aff);
  const directoryPage=cheerio.load(directoryHtml);
  const areaIds=directoryPage('[data-affiliate-id]').toArray().map(a=>directoryPage(a).attr('data-affiliate-id'));
  ok(areaIds.length===47&&new Set(areaIds).size===47&&areaIds.every(id=>/^experience-pref-\d{6}$/.test(id)), '体験IDは既存の公開地域コードから作り、47県で重複しない');
  const nearbyHtml=experienceSection({prefecture:'高知県'},today,aff);
  ok(cheerio.load(nearbyHtml)('[data-affiliate-id]').attr('data-affiliate-id')===directoryPage('[data-affiliate-id=experience-pref-390000]').attr('data-affiliate-id'),'同じ地域のIDは全国入口と公演内で安定している');
  const rendered=[
    directoryHtml,nearbyHtml,
    ...['guide_rental','event_rental','regular_rental'].map(placement=>rentalSearch(supplied,{guide:true},today,placement)),
    offerCards(settings,'experiences',context,today,'event_experiences'),
    offerCards(settings,'rental',context,today,'event_rental'),
  ].join('');
  function exercise(markup,expectAllowed) {
    const d=new JSDOM(markup,{url:'https://kagurameguri.jp/experiences.html?private=secret',runScripts:'outside-only',pretendToBeVisual:true});
    const win=d.window,events=[],observed=[];let emit;
    win.IntersectionObserver=class {constructor(fn){emit=fn}observe(a){observed.push(a)}unobserve(){}};
    win.gtag=(...args)=>events.push(args);win.kaguraGa4Allowed=false;
    win.document.addEventListener('click',e=>e.preventDefault()); // 外部遷移・実広告クリックを発生させない
    win.eval(readFileSync('scripts/client/affiliate.js','utf8'));
    win.Cookiebot={hasResponse:true,consent:{marketing:true,method:'explicit'}};
    win.eval(readFileSync('scripts/client/valuecommerce-consent.js','utf8'));
    win.dispatchEvent(new win.Event('CookiebotOnConsentReady'));
    const links=[...win.document.querySelectorAll('a[data-affiliate-category],[data-vc-ad][data-affiliate-category]')];
    const click=a=>(a.matches('[data-vc-ad]')?a.querySelector(':scope > a'):a).click();
    const show=(ratio=1)=>emit(links.map(target=>({target,isIntersecting:true,intersectionRatio:ratio})));
    show();links.forEach(click);ok(events.length===0,'同意前・自己除外ゲートfalseでは新しい広告も送らない');
    win.kaguraGa4Allowed=true;observed.length=0;win.dispatchEvent(new win.Event('kagura:analytics-ready'));
    ok(links.every(a=>observed.includes(a)),'同意準備完了時に可視状態を再観測する');
    show(.49);ok(events.length===0,'可視50%未満は送信しない');
    Object.defineProperty(win.document,'visibilityState',{value:'hidden',configurable:true});show();
    ok(events.length===0,'非表示タブでは表示数を送らない');
    Object.defineProperty(win.document,'visibilityState',{value:'visible',configurable:true});
    win.document.dispatchEvent(new win.Event('visibilitychange'));show(.5);show();
    links.forEach(a=>{click(a);click(a);});
    const views=events.filter(e=>e[1]==='affiliate_view'),clicks=events.filter(e=>e[1]==='affiliate_click');
    ok(views.length===(expectAllowed?links.length:0)&&clicks.length===(expectAllowed?links.length*2:0),'許可リンクは要素ごと表示1回・実操作ごとクリック1回、未許可は両方0回');
    if(expectAllowed)ok(views.every(([type,name,p],i)=>type==='event'&&p.affiliate_partner===links[i].dataset.affiliatePartner&&p.affiliate_content_id===links[i].dataset.affiliateId&&p.affiliate_placement===links[i].dataset.affiliatePlacement&&p.affiliate_category===links[i].dataset.affiliateCategory&&p.affiliate_page_path==='/experiences.html'&&Object.keys(p).length===5)&&!JSON.stringify(events).includes('secret'),'既存の5項目だけを送り、URLクエリや新しい識別情報を含めない');
    const count=events.length;win.kaguraGa4Allowed=false;show();links.forEach(click);
    win.kaguraGa4Allowed=true;win.dispatchEvent(new win.Event('kagura:analytics-ready'));show();
    ok(events.length===count,'同意撤回中は送らず、再同意しても表示を二重計測しない');
    win.gtag=undefined;links.forEach(click);show();ok(events.length===count,'GA4未読込時も送信しない');
    win.close();
  }
  exercise(rendered,true);
  const sample=rawCheerio.load(nearbyHtml)('[data-vc-ad]').first().toString();
  const rejected=[
    ['data-affiliate-partner','unknown-provider'],['data-affiliate-placement','unknown-placement'],
    ['data-affiliate-category','unknown-category'],['data-affiliate-id',''],['data-affiliate-id','private@example.test'],['rel','noopener'],
  ].map(([key,value])=>{const p=rawCheerio.load(sample);p(key==='rel'?'a':'[data-vc-ad]').attr(key,value);return p('[data-vc-ad]').toString();}).join('');
  exercise(rejected,false);
}
