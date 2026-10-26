import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { questions,features,traditions,quizEngine } from '../scripts/lib/quiz.mjs';
export function quizTests({ok,section,OUT}) {
  section('診断: 根拠付き推薦・任意条件・未確定情報');
  const info=JSON.parse(readFileSync('data/kagura-info.json','utf8').replace(/^\uFEFF/,''));
  const mapped=traditions.map(t=>({...t,evidence:t.evidence.map(([feature,path])=>({feature,path,text:path.split('.').reduce((v,k)=>v?.[k],info[t.kind])}))}));
  const engine=quizEngine(questions,mapped),unknown=questions.map(()=>'unknown');
  ok(questions.length===10&&questions.filter(q=>q.type==='preference').length===7,'好み7問と任意条件3問');
  ok(questions.every(q=>q.choices.some(c=>c.id==='unknown'))&&new Set(questions.map(q=>q.id)).size===questions.length,'全問に不明を用意しID重複なし');
  ok(mapped.every(t=>info[t.kind].source&&t.evidence.every(e=>features[e.feature]&&typeof e.text==='string'&&e.text.length)),'全推薦特徴に既存解説の根拠フィールド');
  ok(engine.scoreAnswers(unknown).ranked.length===0,'全不明を特定タイプへ誘導しない');
  ok([null,[],Array(10),Array(10).fill('invalid')].every(a=>engine.scoreAnswers(a)===null),'不正・未回答を判定しない');
  const pref=['visual','both','change','both','mask','history','beauty','unknown','unknown','unknown'];
  const scored=engine.scoreAnswers(pref);
  ok(scored.ranked.length<=3&&scored.ranked.every(t=>t.matched.length&&t.matched.every(e=>scored.scores[e.feature]>0)),'最大3種類と回答に合う根拠のみ');
  ok(Math.abs(Object.values(scored.scores).reduce((a,b)=>a+b,0)-6)<1e-9,'複数特徴の選択肢も各問の合計1点、案内質問は非加点');
  const changed=[...pref];changed[5]='watch';changed[7]='広島県';changed[8]='next';changed[9]='short';
  ok(JSON.stringify(engine.scoreAnswers(changed))===JSON.stringify(scored),'説明希望と地域・日付・時間は推薦順位に影響しない');
  const tie=quizEngine(questions,Array.from({length:4},(_,i)=>({kind:String(i),evidence:[{feature:'mask',text:'根拠'}]}))).scoreAnswers(pref);
  ok(tie.tied&&tie.ranked.map(t=>t.kind).join()==='0,1,2','同点は安定した掲載順で最大3件、同点を明示');
  ok(JSON.stringify(engine.scoreAnswers(pref))===JSON.stringify(scored),'再集計は決定的、重複加点なし');
  const now='2026-10-31T23:59';
  const events=[
    {id:'past',start:'2026-10-30T10:00',end:'2026-10-30T12:00'},
    {id:'ongoing',start:'2026-10-31T23:00',end:'2026-11-01T01:00'},
    {id:'today',start:'2026-10-31T00:00',timeUnknown:true},
    {id:'tomorrow',start:'2026-11-01T00:00',timeUnknown:true},
    {id:'multi',start:'2026-10-30T10:00',end:'2026-11-02T15:00'},
    {id:'noend',start:'2026-10-31T22:00'},
    {id:'old-noend',start:'2026-10-31T19:00'},
  ].map(e=>({...e,kind:'石見神楽',prefecture:'島根県'}));
  const selected=engine.selectEvents(events,['石見神楽'],{},now).map(e=>e.id);
  ok(['ongoing','today','tomorrow','multi','noend'].every(id=>selected.includes(id))&&!selected.includes('past')&&!selected.includes('old-noend'),'開催中・複数日・当日時刻不明を維持、終了と3時間超を除外');
  ok(!engine.upcoming(events.find(e=>e.id==='today'),'2026-11-01T00:00'),'JST日付境界で時刻不明の前日公演を除外');
  ok(engine.upcoming({start:'2026-11-01T00:00',end:'2026-11-01T01:00'},'2026-11-01T01:00'),'終了境界は既存サイトと同じ包含');
  ok(engine.range('next','',now).join()==='2026-11-01,2026-11-30'&&engine.range('next','','2026-12-31T23:59').join()==='2027-01-01,2027-01-31','月末と年末の来月計算');
  ok(engine.range('month','','2028-02-29T12:00').join()==='2028-02-01,2028-02-29','うるう月');
  ok(!engine.validDate('2026-02-30')&&engine.validDate('2028-02-29'),'不正日付を正規化して受理しない');
  ok(engine.selectEvents(events,['石見神楽'],{region:'広島県'},now).length===0,'指定県が違えば表示しない');
  ok(engine.selectEvents(events,['石見神楽'],{date:'specified',day:'2026-11-01'},now).map(e=>e.id).sort().join()==='multi,ongoing,tomorrow','日付指定は日またぎの重なりも含む');
  ok(engine.selectEvents([...events,events[1]],['石見神楽'],{},now).length===selected.length,'公演IDを重複表示しない');
  for(const e of events.filter(e=>['multi','today','noend'].includes(e.id)))ok(engine.duration(e,'short')==='所要時間は要確認',e.id+': 不明な所要時間を適合済みにしない');
  ok(engine.duration({start:'2026-11-01T10:00',end:'2026-11-01T11:00'},'short').includes('60分')&&engine.duration({start:'2026-11-01T10:00',end:'2026-11-01T17:00'},'half').includes('途中観覧'),'掲載時間枠だけから必要観覧時間を断定しない');
  const html=readFileSync(join(OUT,'quiz.html'),'utf8');
  const dataMatch=html.match(/(<script id="quiz-data" type="application\/json">)([\s\S]*?)(<\/script>)/);
  const config=JSON.parse(dataMatch[2]);
  ok(config.questions.length===questions.length&&config.prefectures.length===47,'同じ質問定義と47都道府県を配信');
  ok(config.events.every(e=>config.traditions.some(t=>t.kind===e.kind)&&typeof e.when==='string'),'公演表示日時は既存の共通書式を使用');
  function setupQuiz(configOverride){const markup=configOverride?html.replace(dataMatch[0],dataMatch[1]+JSON.stringify(configOverride)+dataMatch[3]):html;const dom=new JSDOM(markup,{url:'https://kagurameguri.jp/quiz.html',runScripts:'dangerously',pretendToBeVisual:true});const w=dom.window,d=w.document,calls=[];w.kaguraGa4Allowed=true;w.gtag=(...a)=>calls.push(a);return {dom,w,d,calls};}
  function pick(d,id){d.querySelector(`input[value="${id}"]`).click();d.querySelector('#quiz-next').click();}
  let ui=setupQuiz();let {d,w,calls}=ui;
  d.querySelector('#quiz-start').click();ok(d.querySelector('#quiz-next').disabled&&d.querySelector('#quiz-progress').textContent==='1/10','初問の未選択と進捗');
  pick(d,'visual');pick(d,'slow');d.querySelector('#quiz-back').click();ok(d.querySelector('input[value="slow"]').checked,'戻って選択を保持');pick(d,'both');
  for(const id of ['change','both','mask','history','beauty'])pick(d,id);
  ok(d.querySelector('#quiz-region')&&!d.querySelector('#quiz-next').disabled,'地域は未指定で進める');
  d.querySelector('#quiz-region').value='広島県';d.querySelector('#quiz-region').dispatchEvent(new w.Event('change'));d.querySelector('#quiz-next').click();
  d.querySelector('input[value="specified"]').click();d.querySelector('#quiz-next').click();ok(d.querySelector('#quiz-error').textContent.includes('希望日'),'指定日が空なら結果へ進めない');
  pick(d,'unknown');pick(d,'short');
  ok(d.querySelectorAll('.quiz-program').length===scored.ranked.length&&d.querySelector('.quiz-conditions').textContent.includes('広島県'),'3件以内の推薦と観覧条件を表示');
  ok(d.querySelector('#quiz-result').textContent.includes('公演によって異なります')&&!d.querySelector('#quiz-result').textContent.includes('近く観られる'),'地域文化の断定と地理的な近さの誤認を避ける');
  const n=calls.filter(c=>c[1]==='quiz_complete').length;d.querySelector('#quiz-form').dispatchEvent(new w.Event('submit',{cancelable:true}));ok(calls.filter(c=>c[1]==='quiz_complete').length===n,'二重完了なし');
  d.querySelector('#quiz-result a[href="/calendar.html"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
  ok(calls.every(c=>Object.keys(c[2]).join()==='content_type')&&!JSON.stringify(calls).includes('answers'),'既存イベントだけ、回答・条件・結果は送信しない');
  d.querySelector('#quiz-result button').click();ok(d.querySelector('#quiz-next').disabled&&d.querySelector('#quiz-result').hidden,'再開は回答と結果を初期化');
  w.kaguraGa4Allowed=false;const before=calls.length;d.querySelector('#quiz-result button')?.click();ok(calls.length===before,'非許可時には送信しない');ui.dom.window.close();
  const emptyConfig={...config,events:[],regular:[]};ui=setupQuiz(emptyConfig);d=ui.d;d.querySelector('#quiz-start').click();for(const q of questions){if(q.type==='region')d.querySelector('#quiz-next').click();else pick(d,'unknown');}
  ok(d.querySelectorAll('.quiz-program').length===0&&d.querySelector('#quiz-result').textContent.includes('該当するものがありません')&&d.querySelector('a[href="/calendar.html"]'),'全不明・0件でも一般検索へ進める');ui.dom.window.close();

  section('診断案内: 閲覧後の推測・フォーカスを奪わない・1回制限');
  const js=readFileSync('scripts/client/quiz-offer.js','utf8');
  function setup(desktop=true,blockedStorage=false,saved=false) {
    const dom=new JSDOM('<button id="previous">前の操作</button><form><input id="editing"></form><a id="official" href="https://example.com">公式</a><aside id="quiz-offer" hidden><button>閉じる</button><a href="/quiz.html">好みから探す</a></aside>',{url:'https://kagurameguri.jp/',runScripts:'outside-only',pretendToBeVisual:true});
    const w=dom.window,d=w.document,box=d.querySelector('#quiz-offer');let now=0,y=0;
    w.Date.now=()=>now;w.matchMedia=()=>({matches:desktop});
    Object.defineProperty(w,'scrollY',{get:()=>y});Object.defineProperty(w,'innerHeight',{value:800});Object.defineProperty(d.documentElement,'scrollHeight',{value:2400});
    box.getBoundingClientRect=()=>({top:540,bottom:780,height:240});
    if(saved)w.sessionStorage.setItem('km-quiz-offer','1');
    if(blockedStorage)Object.defineProperty(w,'sessionStorage',{get(){throw Error('blocked')}});
    w.eval(js);
    return {dom,w,d,box,time:n=>now=n,scroll:n=>{y=n;w.dispatchEvent(new w.Event('scroll'));},leave:(y=-1,x=null)=>d.dispatchEvent(new w.MouseEvent('mouseout',{clientY:y,relatedTarget:x})),hide:value=>{Object.defineProperty(d,'visibilityState',{configurable:true,value});d.dispatchEvent(new w.Event('visibilitychange'));},close:()=>dom.window.close()};
  }
  let t=setup();t.leave();ok(t.box.hidden,'30秒前には表示しない');t.time(31000);t.leave();ok(t.box.hidden,'PCも滞在時間だけでは表示しない');t.scroll(200);t.leave(20);ok(t.box.hidden,'左右や下端退出では表示しない');
  t.d.querySelector('#editing').focus();t.leave();ok(t.box.hidden,'入力中は案内しない');
  const consent=t.d.createElement('div');consent.setAttribute('role','dialog');consent.getClientRects=()=>[{}];t.d.body.append(consent);t.d.querySelector('#previous').focus();t.leave();ok(t.box.hidden,'CMP/他のダイアログ表示中は案内しない');consent.remove();
  t.hide('hidden');t.leave();ok(t.box.hidden,'非表示タブでは案内しない');t.hide('visible');t.leave();ok(!t.box.hidden&&t.w.sessionStorage.getItem('km-quiz-offer')==='1','閲覧後のPC上端退出で1回表示');
  ok(t.d.activeElement.id==='previous','表示してもフォーカスを奪わない');
  t.d.dispatchEvent(new t.w.KeyboardEvent('keydown',{key:'Escape',cancelable:true}));ok(t.box.hidden&&t.d.activeElement.id==='previous','Escapeで閉じる、外のフォーカス維持');t.leave();ok(t.box.hidden,'閉じた後は再表示しない');t.close();
  t=setup(false);t.time(31000);t.leave();ok(t.box.hidden,'スマホではマウス退出を使わない');t.scroll(900);t.scroll(750);ok(t.box.hidden,'上スクロール200px未満は表示しない');t.scroll(650);ok(!t.box.hidden,'半分以上閲覧後の上方向200pxで案内');
  t.box.querySelector('button').focus();t.box.querySelector('button').click();ok(t.box.hidden&&!t.d.body.classList.contains('quiz-offer-visible'),'閉じるボタンと余白解除');t.close();
  for(const [storage,saved] of [[true,false],[false,true]]){t=setup(true,storage,saved);t.time(31000);t.scroll(200);t.leave();ok(t.box.hidden,'保存不可/表示済みは表示しない');t.close();}
  t=setup();t.time(1000);t.hide('hidden');t.time(60000);t.hide('visible');t.scroll(200);t.leave();ok(t.box.hidden,'非表示の滞在時間を閲覧と数えない');t.time(90000);t.leave();ok(!t.box.hidden,'可視閲覧時間が閾値に達してから表示');t.hide('hidden');ok(t.box.hidden,'タブ非表示では既存案内も閉じる');t.close();
  t=setup();t.time(31000);t.scroll(200);t.d.querySelector('#editing').dispatchEvent(new t.w.Event('input',{bubbles:true}));t.d.querySelector('#previous').focus();t.leave();ok(t.box.hidden,'入力済みフォームはフォーカス外でも抑制');t.close();
  t=setup();t.time(31000);t.scroll(200);t.box.getBoundingClientRect=()=>({top:20,height:700});t.leave();ok(t.box.hidden&&!t.w.sessionStorage.getItem('km-quiz-offer'),'安全な表示領域がない場合は出さない');t.close();
  t=setup();t.time(31000);t.scroll(200);t.leave();t.w.dispatchEvent(new t.w.Event('CookiebotOnDialogDisplay'));ok(t.box.hidden,'案内後にCMPを開いた場合も除去');
  const click=new t.w.MouseEvent('click',{bubbles:true,cancelable:true});t.d.querySelector('#official').dispatchEvent(click);ok(!click.defaultPrevented,'公式リンクのクリックを横取りしない');t.close();
  t=setup();t.time(31000);t.scroll(200);t.leave();t.w.dispatchEvent(new t.w.Event('resize'));ok(t.box.hidden,'画面回転/リサイズ時は閉じて再配置による遮蔽を避ける');t.close();
  ok(!/beforeunload|pushState|popstate|showModal|box\.show\(/.test(js),'離脱ダイアログ・履歴操作・モーダル表示なし');
  ok(!/gtag|fetch\(|sendBeacon/.test(js),'新規計測や外部通信なし');
  for(const page of ['quiz.html','contact.html','submit.html','privacy.html','terms.html','disclaimer.html','en/index.html'])ok(!readFileSync(join(OUT,page),'utf8').includes('id="quiz-offer"'),`${page}: 案内対象外`);
  const home=readFileSync(join(OUT,'index.html'),'utf8');ok(home.includes('気になる神楽、まだ迷っていますか？')&&home.includes('好みから探す')&&home.includes('role="region"'),'押し付けない案内文と非モーダル領域');
}
