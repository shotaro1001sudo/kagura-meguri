import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { questions,scoreAnswers,programs,programEvents } from '../scripts/lib/quiz.mjs';

export function quizTests({ok,section,OUT}) {
  section('10問診断: 配点・画面・同点・やり直し・個別回答を送らない');
  ok(questions.length===10&&questions.every(q=>new Set(q.choices.map(c=>c.axis)).size===4),'10問が各4軸の選択肢を持つ');
  ok(new Set(questions.map(q=>q.choices[0].axis)).size===4,'選択肢の先頭位置を分散する');
  for(const axis of ['P','V','S','R'])ok(scoreAnswers(Array(10).fill(axis)).winners.join()===axis,`全問${axis}の判定`);
  ok(scoreAnswers(['P','V','P','V','P','V','P','V','P','V']).winners.join()==='P,V','同点を併記する');
  ok([null,[],Array(10),Array(10).fill('X'),Array(9).fill('P')].every(a=>scoreAnswers(a)===null),'未回答・不正回答を結果にしない');
  ok(Object.values(programs).every(p=>p.source.startsWith('https://iwamikagura.jp/enmoku/'))&&programEvents.every(e=>e.source&&e.day),'演目出典と公演ごとの確認根拠を保持');
  const html=readFileSync(join(OUT,'quiz.html'),'utf8');
  const dom=new JSDOM(html,{url:'https://kagurameguri.jp/quiz.html',runScripts:'dangerously',pretendToBeVisual:true});
  const w=dom.window,d=w.document,calls=[];w.kaguraGa4Allowed=true;w.gtag=(...args)=>calls.push(args);
  ok(!d.querySelector('#quiz-offer')&&d.querySelector('noscript'),'診断ページは案内対象外、JSなしの検索入口を持つ');
  d.querySelector('#quiz-start').click();
  ok(d.querySelector('#quiz-next').disabled&&d.querySelector('#quiz-progress').textContent==='1/10','未回答で進めず進捗を表示');
  d.querySelector('input[value=P]').click();d.querySelector('#quiz-next').click();d.querySelector('input[value=V]').click();d.querySelector('#quiz-back').click();
  ok(d.querySelector('input[value=P]').checked,'前に戻ると選択を保持');
  d.querySelector('input[value=V]').click();
  while(!d.querySelector('#quiz-form').hidden){d.querySelector('input[value=V]').click();d.querySelector('#quiz-next').click();}
  ok(d.querySelector('.quiz-type').textContent.includes('面や衣装の視覚的な魅力')&&!d.querySelector('.quiz-type').textContent.includes('迫力・躍動'),'回答変更を再集計し、重複加点しない');
  const bars=[...d.querySelectorAll('.quiz-bars li')].map(li=>li.textContent);
  ok(bars.length===4&&bars[0]==='面や衣装の視覚的な魅力10問'&&bars.slice(1).every(t=>t.endsWith('0問')),'回答の内訳を4軸すべて、多い順に表示する');
  ok(d.querySelector('#quiz-progress').style.getPropertyValue('--p')==='100%','進み具合の線を問いの番号に合わせる');
  ok(d.querySelector('#quiz-result').textContent.includes('現在掲載中の該当公演はありません'),'確認済み公演0件の表示');
  const firstCount=calls.filter(c=>c[1]==='quiz_complete').length;
  d.querySelector('#quiz-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  ok(calls.filter(c=>c[1]==='quiz_complete').length===firstCount,'結果の多重送信を防ぐ');
  ok(calls.every(c=>Object.keys(c[2]).join()==='content_type')&&!JSON.stringify(calls).includes('answers'),'個別回答やスコアを計測に送らない');
  d.querySelector('#quiz-result button').click();ok(d.querySelector('#quiz-next').disabled&&d.querySelector('#quiz-result').hidden,'やり直しで回答を消す');
  const before=calls.length;w.kaguraGa4Allowed=false;d.querySelector('#quiz-start').click();ok(calls.length===before,'同意・自己除外で許可がない場合はイベントを送らない');
  dom.window.close();

  const dataMatch=html.match(/(<script id="quiz-data" type="application\/json">)([\s\S]*?)(<\/script>)/);
  const config=JSON.parse(dataMatch[2]);
  ok(config.events.length===0,'未確認のテスト公演を、語句一致などで演目に紐付けない');
  config.events=[{program:'iwado',id:'verified-future',name:'確認済み未来公演',start:'2050-01-01T10:00',place:'島根県 益田市',source:programEvents[0].source},{program:'iwado',id:'expired',name:'終了済み公演',start:'2000-01-01T10:00',source:programEvents[0].source},{program:'shioharai',id:'different',name:'異なる演目',start:'2050-01-01T10:00',source:programEvents[0].source}];
  const futureDom=new JSDOM(html.replace(dataMatch[0],dataMatch[1]+JSON.stringify(config)+dataMatch[3]),{url:'https://kagurameguri.jp/quiz.html',runScripts:'dangerously',pretendToBeVisual:true});
  const fd=futureDom.window.document;fd.querySelector('#quiz-start').click();
  while(!fd.querySelector('#quiz-form').hidden){fd.querySelector('input[value=S]').click();fd.querySelector('#quiz-next').click();}
  ok(fd.querySelector('#quiz-result a[href="/events/verified-future.html"]')&&!fd.querySelector('#quiz-result a[href="/events/expired.html"]')&&!fd.querySelector('#quiz-result a[href="/events/different.html"]'),'結果は該当演目の未来公演だけを表示し、ビルド後に終了した公演も除外');
  const ev=fd.querySelector('#quiz-result .quiz-event');
  ok(ev.querySelector('a').textContent==='1月1日(土)確認済み未来公演'&&ev.textContent.includes('島根県 益田市'),'公演は日本語の日付(曜日つき)と開催地で示す');
  ok(fd.querySelector('.quiz-type-label').textContent==='物語・人物','結果の楽しみ方を見出しとして大きく示す');
  futureDom.window.close();

  section('離脱意向案内: 待機・端末・1回制限・競合回避');
  const js=readFileSync('scripts/client/quiz-offer.js','utf8');
  function setup(desktop=true,blocked=false) {
    const dom=new JSDOM('<button id="previous">前の操作</button><input id="editing"><dialog id="quiz-offer"><button>閉じる</button><a href="/quiz.html">診断</a></dialog>',{url:'https://kagurameguri.jp/',runScripts:'outside-only',pretendToBeVisual:true});
    const w=dom.window,d=w.document,box=d.querySelector('dialog');let now=0,y=0;
    w.Date.now=()=>now;w.matchMedia=()=>({matches:desktop});
    Object.defineProperty(w,'scrollY',{get:()=>y});Object.defineProperty(w,'innerHeight',{value:800});Object.defineProperty(d.documentElement,'scrollHeight',{value:2400});
    box.show=()=>box.setAttribute('open','');box.close=()=>box.removeAttribute('open');
    if(blocked)Object.defineProperty(w,'sessionStorage',{get(){throw Error('blocked')}});
    w.eval(js);
    return {dom,w,d,box,time:n=>now=n,scroll:n=>{y=n;w.dispatchEvent(new w.Event('scroll'));},leave:(y=-1,x=null)=>d.dispatchEvent(new w.MouseEvent('mouseout',{clientY:y,relatedTarget:x})),close:()=>dom.window.close()};
  }
  let t=setup();t.leave();ok(!t.box.open,'30秒前には表示しない');t.time(31000);t.leave(20);ok(!t.box.open,'左右や下端退出では表示しない');
  t.d.querySelector('#editing').focus();t.leave();ok(!t.box.open,'入力中は案内しない');
  const consent=t.d.createElement('div');consent.setAttribute('role','dialog');consent.setAttribute('aria-modal','true');consent.getClientRects=()=>[{}];t.d.body.append(consent);t.d.querySelector('#previous').focus();t.leave();ok(!t.box.open,'他のモーダル表示中は案内しない');consent.remove();
  Object.defineProperty(t.d,'visibilityState',{configurable:true,value:'hidden'});t.leave();ok(!t.box.open,'非表示タブでは案内しない');
  Object.defineProperty(t.d,'visibilityState',{value:'visible'});t.leave();ok(t.box.open&&t.w.sessionStorage.getItem('km-quiz-offer')==='1','待機後のPC上端退出で1回表示');
  t.d.dispatchEvent(new t.w.KeyboardEvent('keydown',{key:'Escape'}));ok(!t.box.open&&t.d.activeElement.id==='previous','Escapeで閉じてフォーカスを戻す');t.leave();ok(!t.box.open,'閉じた後は再表示しない');t.close();
  t=setup(false);t.time(31000);t.leave();ok(!t.box.open,'スマホではマウス退出を使わない');t.scroll(900);t.scroll(750);ok(!t.box.open,'スマホの上スクロール200px未満は表示しない');t.scroll(650);ok(t.box.open,'半分以上閲覧後の上方向200pxでスマホ案内');t.box.querySelector('button').click();ok(!t.box.open,'閉じるボタンが機能');t.close();
  t=setup(true,true);t.time(31000);t.leave();ok(!t.box.open,'保存領域が使えない場合は自動表示しない');t.close();
  for(const page of ['contact.html','submit.html','privacy.html','terms.html','disclaimer.html','en/index.html'])ok(!readFileSync(join(OUT,page),'utf8').includes('id="quiz-offer"'),`${page}: 案内を設置しない`);
  ok(readFileSync(join(OUT,'index.html'),'utf8').includes('id="quiz-offer"'),'トップに案内を設置');
}
