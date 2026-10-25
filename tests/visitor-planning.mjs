import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import * as cheerio from 'cheerio';
import {JSDOM} from 'jsdom';
import {validOffer,offersFor,offerCards,experiencesFor,experienceSection} from '../scripts/lib/visitor-planning.mjs';

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
  const home=cheerio.load(readFileSync(join(OUT,'index.html'),'utf8')),guide=cheerio.load(readFileSync(join(OUT,'guide.html'),'utf8'));
  ok(home('.planning-links a').length===3&&home('.home-discovery').next().hasClass('home-hero'),'公演探しを保持し、3つの観覧準備入口を用意');
  ok(guide('#packing .planning-card').length===4&&guide('#transport .planning-steps li').length===3,'持ち物4種類と公共交通→貸出返却→会場経路の順で案内');
  ok(guide('.planning-ads').length===0,'本番の新規3カテゴリは未承認なので広告を出さない');

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
      ok(event('.staylinks a[rel~=sponsored]').length===2&&event('[data-official-link]').length===1,'既存の宿泊2件と公式情報ボタンを維持');
      ok(event('main').html().indexOf('data-official-link')<event('main').html().indexOf('planning-ads'),'公式予約情報を広告より先に表示');
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
