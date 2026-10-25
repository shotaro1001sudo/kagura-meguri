import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import * as cheerio from 'cheerio';
import {JSDOM} from 'jsdom';
import {CARSHARE_BANNER,RENTAL_BANNER,rentalSearch,validOffer,offersFor,offerCards,experiencesFor,experienceSection,experienceRegions,experienceDirectory,planningLinks} from '../scripts/lib/visitor-planning.mjs';
import {PREFECTURES} from '../scripts/lib/util.mjs';

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
  ok(experienceSection(context,today).includes('営業休止')&&experienceSection(context,today).includes('移動時間は未確認'),'確認時点の休止と移動の未確認を明示し、間に合うと断言しない');
  const national=cheerio.load(experienceDirectory());
  ok(experienceRegions.length===47&&new Set(experienceRegions.map(x=>x.url)).size===47&&PREFECTURES.every(p=>experienceRegions.some(x=>x.prefecture===p)),'全国47都道府県の実際の検索先が揃い、県とURLの重複がない');
  ok(national('.experience-areas a').length===47&&!national.root().text().includes('高千穂'),'全国向けの入口を特定の神楽や施設の紹介に限定しない');
  for(const prefecture of PREFECTURES){
    const page=cheerio.load(experienceSection({prefecture,city:'未登録の開催市'},today));
    const expected=experienceRegions.find(x=>x.prefecture===prefecture);
    ok(page('#nearby-experiences a').first().attr('href')===expected.url&&page('h2').text().includes(prefecture),`${prefecture}: 開催県の体験検索を引き継ぐ`);
    ok(planningLinks({prefecture},today).includes('href="#nearby-experiences"'),`${prefecture}: 公演から当該県の案内へ進める`);
  }
  const aff={sid:'1111111',pid:'4444444'},affPage=cheerio.load(experienceSection({prefecture:'高知県'},today,aff)),affLink=affPage('#nearby-experiences a').first(),kochi=experienceRegions.find(x=>x.prefecture==='高知県');
  ok(affLink.attr('href')==='https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=1111111&pid=4444444&vc_url='+encodeURIComponent(kochi.url)&&affLink.attr('rel').includes('sponsored')&&affLink.text().includes('（広告）')&&affPage.text().includes('アフィリエイトリンク')&&!affPage.text().includes('広告リンクではありません'),'体験用pidがあれば、県の体験一覧をバリューコマース経由の広告リンクとして明示する');
  const affNational=cheerio.load(experienceDirectory(aff));
  ok(affNational('.experience-areas a[rel~=sponsored]').length===47&&affNational('.experience-areas a').toArray().every(x=>affNational(x).attr('href').includes('pid=4444444')),'全国一覧の47都道府県すべてに体験用pidが付く');
  ok(experienceSection({prefecture:'高知県'},today,{sid:'1111111',pid:''}).includes('広告リンクではありません'),'pid未設定なら広告ではない通常リンクのまま');
  ok(experienceSection({prefecture:'未確認県'},today)===''&&planningLinks({},today).includes('href="/experiences.html"'),'地域不明は他県を推測せず全国入口へ案内');
  ok(experienceRegions.find(x=>x.prefecture==='静岡県').url.includes('/210000/')&&experienceRegions.find(x=>x.prefecture==='岐阜県').url.includes('/220000/'),'地域コードをJISコードから推測せず公式のリンク対応を保持');
  ok(national('.experience-areas a').toArray().every(a=>!national(a).attr('rel').includes('sponsored')&&!national(a).attr('data-affiliate-category')),'一般検索先は広告・成果リンクとして扱わない');
  const home=cheerio.load(readFileSync(join(OUT,'index.html'),'utf8')),guide=cheerio.load(readFileSync(join(OUT,'guide.html'),'utf8'));
  ok(home('.planning-links a').length===3&&home('.home-discovery').next().hasClass('home-hero'),'公演探しを保持し、3つの観覧準備入口を用意');
  ok(guide('#packing .planning-card').length===4&&guide('#transport .planning-steps li').length===3,'持ち物4種類と公共交通→貸出返却→会場経路の順で案内');
  ok(guide('.planning-ads').length===0,'本番の新規3カテゴリは未承認なので広告を出さない');

  const supplied=JSON.parse(readFileSync('data/visitor-planning.json','utf8'));
  const selected=offersFor(supplied,'supplies',{},today);
  const published=cheerio.load(offerCards(supplied,'supplies',{},today,'guide_supplies'));
  ok(selected.length===3&&published('a[data-affiliate-category=supplies]').length===3,'本人提供の3商品だけを用品広告として表示');
  ok(published('a[data-affiliate-category=supplies]').toArray().every((a,i)=>published(a).attr('href')===selected[i].url&&new URL(selected[i].url).searchParams.get('pc')===selected[i].destinationUrl),'発行URLの全パラメーターを保持し、選定商品と遷移先が一致');
  ok(!supplied.categories.experiences.enabled&&supplied.categories.rental.enabled&&!published.root().text().includes('ポイント10倍')&&!published.root().text().includes('2,268円'),'体験は無効、レンタカーのみ追加有効、期限付きの価格・ポイントを固定表示しない');
  ok(offersFor(supplied,'supplies',{},'2026-11-24').length===3&&offersFor(supplied,'supplies',{},'2026-11-25').length===0,'再確認期限の当日まで表示し、翌日から3商品を非表示');

  const ownerRental=supplied.offers.find(o=>o.provider==='rakuten-rental');
  ok(validOffer(ownerRental,today),'本人発行のhsc画像バナーを承認条件つきで扱える');
  for(const patch of [{url:ownerRental.url+'&pc=https://evil.test/'},{imageUrl:ownerRental.imageUrl.replace('2762496','1234567')},{url:ownerRental.url.replace('_RTLink152141','_RTLink111111')},{provider:'rakuten-ichiba'},{scope:undefined},{approved:false}])ok(!validOffer({...ownerRental,...patch},today),'バナーの組み替え・未承認・別用途を拒否: '+Object.keys(patch).join());
  const banner=cheerio.load(rentalSearch(supplied,{guide:true},today,'guide_rental'));
  ok(banner('a[rel~=sponsored]').attr('href')===RENTAL_BANNER.url&&banner('img').attr('src')===RENTAL_BANNER.imageUrl&&banner('a').attr('aria-label').includes('レンタカー'),'本人発行のリンクと画像を保持し、画像に依存しないリンク名を持つ');
  const expired=cheerio.load(rentalSearch(supplied,{},'2026-11-25','guide_rental'));
  ok(expired('img,[rel~=sponsored]').length===0&&expired('[data-rental-search]').length===1,'バナー期限切れで広告を消し、通常の公式リンクを保持');

  const carshare=supplied.offers.find(o=>o.provider==='rakuten-carshare');
  const cars=cheerio.load(rentalSearch(supplied,{guide:true},today,'guide_rental'));
  const shareLink=cars('[data-affiliate-partner=rakuten-carshare]');
  ok(validOffer(carshare,today)&&shareLink.length===1&&shareLink.attr('href')===CARSHARE_BANNER.url&&shareLink.find('img').attr('src')===CARSHARE_BANNER.imageUrl,'カーシェアも本人発行のURLと画像を保持');
  ok(shareLink.attr('aria-label').includes('カーシェア')&&!shareLink.attr('aria-label').includes('レンタカー')&&shareLink.closest('article').text().includes('対応エリア・ステーション'),'サービス名と対応エリアの確認を案内しレンタカーと混同しない');
  ok(!validOffer({...carshare,provider:'rakuten-rental'},today)&&!validOffer({...ownerRental,provider:'rakuten-carshare'},today)&&!validOffer({...carshare,imageUrl:RENTAL_BANNER.imageUrl},today),'カーシェアとレンタカーのコード・画像の取り違えを拒否');
  ok(offersFor(supplied,'rental',{prefecture:'宮崎県',city:'高千穂町'},today).length===2&&offersFor(supplied,'rental',{prefecture:'島根県',city:'浜田市'},today).length===2,'両サービスの入口を開催場所に限定せず案内し、利用可能と断言しない');
  const fullPage=cheerio.load(readFileSync(join(OUT,'events/t-full.html'),'utf8')),dayPage=cheerio.load(readFileSync(join(OUT,'events/t-long.html'),'utf8')),unknownPage=cheerio.load(readFileSync(join(OUT,'events/t-timeunknown.html'),'utf8')),pastPage=cheerio.load(readFileSync(join(OUT,'events/t-past.html'),'utf8'));
  ok(fullPage('.stay h2').text().includes('夜の観覧後')&&!dayPage('.stay h2').text().includes('夜')&&!unknownPage('.stay h2').text().includes('夜'),'夜公演だけ宿泊を強調し、昼・時刻不明は夜と断定しない');
  ok(fullPage('.page-notes').text().includes('最終チェックイン')&&fullPage('.page-notes').text().includes('人数・宿泊日はリンク先で変更'),'宿泊条件の変更と距離・最終チェックインの確認を案内');
  const direct=fullPage('[data-rental-search]');
  ok(direct.attr('href')==='https://travel.rakuten.co.jp/cars/'&&!direct.attr('rel').includes('sponsored')&&!direct.attr('data-affiliate-category')&&guide('[data-rental-search]').length===1,'未発行のレンタカーは通常の公式リンク、ガイドからも利用可能');
  ok(pastPage('.stay,[data-rental-search]').length===0&&fullPage('main').html().indexOf('data-official-link')<fullPage('main').html().indexOf('data-rental-search'),'終了済みは宿・車を出さず、公式情報を先に案内');

  const temp=mkdtempSync(join(tmpdir(),'km-planning-'));
  try {
    const file=join(temp,'settings.json');writeFileSync(file,JSON.stringify(settings));
    const output=join(temp,'all');const built=build('tests/fixtures/events.test.json',output,{VISITOR_PLANNING_FILE:file,TEST_PLANNING_OFF:'0',BUILD_NOW:today+'T12:00',TEST_AFF_TRAVEL:'1',TEST_GA:'G-TEST123456'});
    ok(built.status===0,'3カテゴリを有効にした本物のビルドが成功',built.stderr);
    if(built.status===0) {
      const g=cheerio.load(readFileSync(join(output,'guide.html'),'utf8')),event=cheerio.load(readFileSync(join(output,'events/t-full.html'),'utf8')),past=cheerio.load(readFileSync(join(output,'events/t-past.html'),'utf8')),other=cheerio.load(readFileSync(join(output,'events/t-xss.html'),'utf8'));
      ok(g('a[data-affiliate-category=supplies]').length===1&&g('a[data-affiliate-category=rental]').length===1,'ガイドの該当箇所に用品・レンタカーを表示');
      ok(event('a[data-affiliate-category=experiences]').length===1&&event('a[data-affiliate-category=rental]').length===1,'対象公演だけに体験・レンタカーを表示');
      ok(past('.planning-ads,.planning-links,#nearby-experiences').length===0&&other('a[data-affiliate-category]').length===0,'終了済み・地域不一致の公演に広告を出さない');
      ok(event('.d-side a.stay-banner[rel~=sponsored]').length===2&&event('[data-official-link]').length===1,'既存の宿泊2件と公式情報ボタンを維持');
      ok(event('main').html().indexOf('data-official-link')<event('main').html().indexOf('planning-ads'),'公式予約情報を広告より先に表示');
    }
    const issuedOutput=join(temp,'issued');
    const issued=build('tests/fixtures/events.test.json',issuedOutput,{VISITOR_PLANNING_FILE:'data/visitor-planning.json',TEST_PLANNING_OFF:'0',BUILD_NOW:today+'T12:00'});
    ok(issued.status===0,'本人提供コードの実設定でビルド成功',issued.stderr);
    if(issued.status===0){
      const actual=cheerio.load(readFileSync(join(issuedOutput,'guide.html'),'utf8'));
      const csp=actual('meta[http-equiv="Content-Security-Policy"]').attr('content')||'';
      ok(actual('[data-affiliate-category=supplies]').length===3&&actual('[data-affiliate-category=rental]').length===2&&actual('.planning-banner img').attr('src')===RENTAL_BANNER.imageUrl,'実ビルドで用品3商品と車移動のバナー2件を併載');
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
}
