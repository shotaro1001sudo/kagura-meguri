import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { questions,features,traditions,quizEngine,evidenceWeight,evidenceText } from '../scripts/lib/quiz.mjs';
import { quizHealth,acceptBaseline,evidenceHashes,QUIZ_STALE_DAYS } from '../scripts/lib/quiz-health.mjs';
import { reviewMetrics,decideActions,renderReview } from '../scripts/lib/weekly-review.mjs';
export function quizTests({ok,section,OUT}) {
  section('診断: 根拠付き推薦・好みの近さ・任意条件');
  const info=JSON.parse(readFileSync('data/kagura-info.json','utf8').replace(/^﻿/,''));
  const mapped=traditions.map(t=>({...t,evidence:t.evidence.map(([feature,path])=>({feature,path,weight:evidenceWeight(path),text:evidenceText(info[t.kind],path)}))}));
  const engine=quizEngine(questions,mapped),unknown=questions.map(()=>'unknown');
  const prefQs=questions.filter(q=>q.type==='preference'),scoredIdx=questions.map((q,i)=>q.type==='preference'&&!q.explanationOnly?i:-1).filter(i=>i>=0);
  ok(questions.length===9&&prefQs.length===7&&scoredIdx.length===6,'好み7問(うち採点6問)と、地域・日程の2問');
  ok(questions.every(q=>q.choices.some(c=>c.id==='unknown'))&&new Set(questions.map(q=>q.id)).size===questions.length&&questions.every(q=>new Set(q.choices.map(c=>c.id)).size===q.choices.length),'全問に「まだ分からない」、IDの重複なし');
  ok(prefQs.every(q=>q.choices.every(c=>{const w=Object.values(c.weights);return c.id==='unknown'||q.explanationOnly?w.length===0:Math.abs(w.reduce((a,b)=>a+b,0)-1)<1e-9;})),'採点する選択肢は、どれも合計1点(複数の好みには分けて配る)。「分からない」と案内の質問は0点');
  ok(Object.keys(features).every(f=>prefQs.some(q=>q.choices.some(c=>f in c.weights)))&&prefQs.every(q=>q.choices.every(c=>Object.keys(c.weights).every(f=>features[f]))),'すべての好みの軸に、選べる回答がある(使われない軸・未定義の軸なし)');
  ok(mapped.length===19&&mapped.every(t=>info[t.kind]?.source&&info[t.kind].tagline&&t.evidence.every(e=>features[e.feature]&&e.text.length>4)),'19種類すべて、出典つきの解説の本文を根拠にする');
  ok(mapped.every(t=>t.evidence.every(e=>e.weight===(/^(tagline|intro)/.test(e.path)?2:1))),'特徴の強さは機械的: 紹介の中心(tagline・intro)なら2、ほかは1');
  ok(evidenceText(info['石見神楽'],'intro~1').startsWith('古事記や日本書紀')&&evidenceText(info['石見神楽'],'tagline')==='テンポの速い「八調子」と、金糸・銀糸の豪華な衣装'&&evidenceText(info['石見神楽'],'intro~9')===''&&evidenceText(info['石見神楽'],'nope.0')==='','根拠の本文: 紹介文はその1文だけ、一言紹介は地域のあとだけ。ないものは空(ビルドが止まる)');
  ok(new Set(mapped.map(t=>JSON.stringify(engine.profile(t)))).size===mapped.length,'種類ごとの特徴の組み合わせが、すべて違う(同じ結果になる種類がない)');
  ok(engine.scoreAnswers(unknown).ranked.length===0,'全部「分からない」なら、特定の種類をすすめない');
  ok([null,[],Array(9),Array(9).fill('invalid'),Array(10).fill('unknown')].every(a=>engine.scoreAnswers(a)===null),'不正・未回答・数の違う回答を判定しない');
  // 全組み合わせ(採点6問)で、どの種類も1位になりうる・特定の種類にかたよらない
  const first={};let total=0,blank=0;
  (function rec(k,ans){if(k===scoredIdx.length){total++;const r=engine.scoreAnswers(ans);if(!r.ranked.length){blank++;return;}first[r.ranked[0].kind]=(first[r.ranked[0].kind]||0)+1;return;}for(const c of questions[scoredIdx[k]].choices){const a=[...ans];a[scoredIdx[k]]=c.id;rec(k+1,a);}})(0,unknown);
  const shares=mapped.map(t=>(first[t.kind]||0)/total);
  ok(mapped.every(t=>first[t.kind]>0)&&blank===1,'回答の全組み合わせで、19種類どれもが1位になりうる(全部分からないの1通りだけ判定なし)',JSON.stringify(first));
  ok(Math.max(...shares)<0.2,'どの種類も、1位になる組み合わせは全体の2割未満(かたよりの上限)',String(Math.max(...shares)));
  const only=(qid,cid)=>{const a=[...unknown];a[questions.findIndex(q=>q.id===qid)]=cid;return engine.scoreAnswers(a);};
  const yu=only('scene','yudate');
  ok(yu.ranked.length===3&&yu.ranked.every(t=>t.matched.some(e=>e.feature==='yudate'))&&mapped.filter(t=>t.evidence.some(e=>e.feature==='yudate')).length>3,'湯立てだけを選ぶと、湯立ての根拠がある種類だけが上位に来る(特徴の多い種類が割り込まない)');
  const pref=['drama','fast','visual','short','quiet','story','history','unknown','unknown'];
  const scored=engine.scoreAnswers(pref);
  ok(scored.ranked.length===3&&scored.ranked.every(t=>t.matched.length&&t.matched.every(e=>scored.prefs[e.feature]>0)),'最大3種類と、回答に合う根拠だけ');
  ok(scored.ranked.every(t=>t.matched.every((e,i,a)=>i===0||scored.top.indexOf(a[i-1].feature)<=scored.top.indexOf(e.feature))),'理由は、回答で強く選んだ好みの順に並ぶ');
  ok(scored.ranked.every(t=>new Set(t.matched.map(e=>e.feature)).size===t.matched.length),'同じ特徴の根拠は1つだけ示す(根拠の数で有利にしない)');
  ok(Math.abs(Object.values(scored.prefs).reduce((a,b)=>a+b,0)-6)<1e-9&&scored.top[0]==='drama','採点6問の合計は6点、いちばん多く選んだ好みが傾向の先頭');
  const changed=[...pref];changed[6]='watch';changed[7]='広島県';changed[8]='next';
  ok(JSON.stringify(engine.scoreAnswers(changed))===JSON.stringify(scored),'案内の希望と、地域・日程は、好みの順位に影響しない');
  const tie=quizEngine(questions,Array.from({length:4},(_,i)=>({kind:String(i),evidence:[{feature:'drama',weight:1,text:'根拠'}]}))).scoreAnswers(pref);
  ok(tie.tied&&tie.ranked.map(t=>t.kind).join()==='0,1,2','同点は安定した掲載順で最大3件、同点を明示');
  ok(JSON.stringify(engine.scoreAnswers(pref))===JSON.stringify(scored),'再集計は決定的');
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
  ok(engine.range('weekend','','2026-11-09T10:00').join()==='2026-11-14,2026-11-15'&&engine.range('weekend','','2026-11-14T10:00').join()==='2026-11-14,2026-11-15'&&engine.range('weekend','','2026-11-15T10:00').join()==='2026-11-15,2026-11-15'&&engine.range('weekend','','2026-12-31T10:00').join()==='2027-01-02,2027-01-03','今週末: 平日は次の土日、土曜は当日から、日曜は当日だけ(年またぎも)');
  ok(!engine.validDate('2026-02-30')&&engine.validDate('2028-02-29'),'不正日付を正規化して受理しない');
  ok(engine.selectEvents(events,['石見神楽'],{region:'広島県'},now).length===0,'指定県が違えば表示しない');
  const regions=[['中国',['島根県','広島県']],['四国',['高知県']]];
  ok(engine.selectEvents(events,['石見神楽'],{region:'地方:中国'},now,regions).length===selected.length&&engine.selectEvents(events,['石見神楽'],{region:'地方:四国'},now,regions).length===0&&engine.inRegion('島根県','all',regions)&&!engine.inRegion('島根県','地方:なし',regions),'地方のどこでも(地方:中国)で、地方内の県の公演を探す');
  ok(engine.selectEvents(events,['石見神楽'],{date:'specified',day:'2026-11-01'},now).map(e=>e.id).sort().join()==='multi,ongoing,tomorrow','日付指定は日またぎの重なりも含む');
  ok(engine.selectEvents([...events,events[1]],['石見神楽'],{},now).length===selected.length,'公演IDを重複表示しない');
  for(const e of events.filter(e=>['multi','today','noend'].includes(e.id)))ok(engine.duration(e,'short')==='所要時間は要確認',e.id+': 不明な所要時間を適合済みにしない');
  ok(engine.duration({start:'2026-11-01T10:00',end:'2026-11-01T11:00'},'short').includes('60分')&&engine.duration({start:'2026-11-01T10:00',end:'2026-11-01T17:00'},'short').includes('途中観覧'),'掲載時間枠だけから必要観覧時間を断定しない');

  section('診断: ページの表示と操作(回答は送らない)');
  const html=readFileSync(join(OUT,'quiz.html'),'utf8');
  const dataMatch=html.match(/(<script id="quiz-data" type="application\/json">)([\s\S]*?)(<\/script>)/);
  const config=JSON.parse(dataMatch[2]);
  ok(config.questions.length===questions.length&&config.regions.flatMap(([,ps])=>ps).length===47&&config.url==='https://kagurameguri.jp/quiz.html','同じ質問定義・47都道府県(地方ごと)・シェア用の正規URLを配信');
  ok(config.traditions.length===19&&config.traditions.every(t=>t.tagline&&(t.href===''||t.href.startsWith('/kagura/'))&&t.evidence.every(e=>e.text&&e.weight)),'19種類の一言紹介・解説ページ・根拠の本文を配信');
  ok(config.events.every(e=>config.traditions.some(t=>t.kind===e.kind)&&typeof e.when==='string'),'公演表示日時は既存の共通書式を使用');
  ok(html.includes('診断のしくみ')&&traditions.every(t=>html.includes('>'+t.kind+'</'))&&html.includes('点数や一致率は出しません'),'診断のしくみと、対象19種類の解説へのリンクをページに載せる');
  const appTag=html.match(/<script defer src="\/quiz-app\.js\?v=[0-9a-f]{10}"><\/script>/)?.[0],appJs=readFileSync(join(OUT,'quiz-app.js'),'utf8');
  ok(appTag&&!html.includes('function scoreAnswers')&&appJs.includes('function scoreAnswers'),'画面のプログラムは別ファイル(版つき)にして、ページを軽くする');
  function setupQuiz(configOverride){const page=html.replace(appTag,()=>'<script>'+appJs+'</script>');const markup=configOverride?page.replace(dataMatch[0],()=>dataMatch[1]+JSON.stringify(configOverride).replace(/</g,'\\u003c')+dataMatch[3]):page;const dom=new JSDOM(markup,{url:'https://kagurameguri.jp/quiz.html',runScripts:'dangerously',pretendToBeVisual:true});const w=dom.window,d=w.document,calls=[];w.kaguraGa4Allowed=true;w.gtag=(...a)=>calls.push(a);return {dom,w,d,calls};}
  function pick(d,id){d.querySelector(`input[value="${id}"]`).click();d.querySelector('#quiz-next').click();}
  function region(d,w,v){const s=d.querySelector('#quiz-region');s.value=v;s.dispatchEvent(new w.Event('change'));d.querySelector('#quiz-next').click();}
  let ui=setupQuiz();let {d,w,calls}=ui;
  d.querySelector('#quiz-start').click();ok(d.querySelector('#quiz-next').disabled&&d.querySelector('#quiz-progress').textContent==='1/9','初問の未選択と進捗');
  pick(d,'drama');pick(d,'slow');d.querySelector('#quiz-back').click();ok(d.querySelector('input[value="slow"]').checked,'戻って選択を保持');pick(d,'fast');
  for(const id of ['visual','short','quiet','story','history'])pick(d,id);
  ok(d.querySelector('#quiz-region')&&!d.querySelector('#quiz-next').disabled&&d.querySelector('#quiz-region optgroup')&&d.querySelector('#quiz-region option[value="地方:中国"]'),'地域は未指定で進める。地方ごとにまとめ、地方のどこでも選べる');
  region(d,w,'広島県');
  d.querySelector('input[value="specified"]').click();d.querySelector('#quiz-next').click();ok(d.querySelector('#quiz-error').textContent.includes('希望日'),'指定日が空なら結果へ進めない');
  pick(d,'unknown');
  const res=d.querySelector('#quiz-result');
  ok(d.querySelectorAll('.quiz-program').length===scored.ranked.length&&d.querySelector('.quiz-best h4').textContent===scored.ranked[0].kind&&d.querySelector('.quiz-conditions').textContent.includes('広島県'),'いちばん近い神楽と、ほかの候補(最大3種類)、観覧条件を表示');
  ok(d.querySelector('.quiz-type-label').textContent===scored.top.slice(0,2).map(f=>features[f].type).join(' × ')&&d.querySelectorAll('.quiz-chips li').length>0,'回答から見た好みの傾向(上位2つ)を示す');
  ok([...d.querySelectorAll('.quiz-reasons .quiz-evidence')].every(n=>mapped.some(t=>t.evidence.some(e=>e.text===n.textContent))),'理由として示す文は、すべて解説の本文そのまま');
  ok(res.textContent.includes('地域・団体・公演によって異なります')&&res.textContent.includes('性格・適性や相性の確率を示すものではありません')&&!/\d+\s*[%％]|\d+点/.test(res.textContent.replace(/\d+月\d+日|\d{4}年|\d+:\d+|\d+分/g,'')),'断定を避け、点数や一致率を出さない');
  const n=calls.filter(c=>c[1]==='quiz_complete').length;d.querySelector('#quiz-form').dispatchEvent(new w.Event('submit',{cancelable:true}));ok(calls.filter(c=>c[1]==='quiz_complete').length===n,'二重完了なし');
  const share=d.querySelector('.quiz-share a'),shared=share&&decodeURIComponent(share.href);
  ok(share&&share.href.startsWith('https://x.com/intent/post?')&&shared.endsWith('url=https://kagurameguri.jp/quiz.html')&&!pref.filter(a=>a!=='unknown').some(a=>shared.includes(a)),'シェアは押したときだけ。URLに回答や結果を入れない');
  share.addEventListener('click',e=>e.preventDefault());share.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
  d.querySelector('#quiz-result a[href="/calendar.html"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
  ok(calls.some(c=>c[1]==='quiz_share')&&calls.every(c=>['quiz_start','quiz_complete','quiz_event_click','quiz_search_click','quiz_share'].includes(c[1])&&Object.keys(c[2]).join()==='content_type')&&!JSON.stringify(calls).includes('answers'),'計測は決まったイベント名だけ。回答・条件・結果は送信しない');
  d.querySelector('#quiz-result .quiz-actions button').click();ok(d.querySelector('#quiz-next').disabled&&d.querySelector('#quiz-result').hidden,'再開は回答と結果を初期化');
  w.kaguraGa4Allowed=false;const before=calls.length;d.querySelector('#quiz-back').click();pick(d,'drama');ok(calls.length===before,'非許可時には送信しない');ui.dom.window.close();
  const emptyConfig={...config,events:[],regular:[]};ui=setupQuiz(emptyConfig);d=ui.d;d.querySelector('#quiz-start').click();for(const q of questions){if(q.type==='region')d.querySelector('#quiz-next').click();else pick(d,'unknown');}
  ok(d.querySelectorAll('.quiz-program').length===0&&d.querySelector('#quiz-result').textContent.includes('該当するものがありません')&&d.querySelector('#quiz-result a[href="/calendar.html"]')&&d.querySelector('#quiz-result a[href="/guide.html"]')&&!d.querySelector('.quiz-share'),'全不明・0件でも、ガイドと一般検索へ進める(シェアは出さない)');ui.dom.window.close();
  // 好みに近い3種類に条件の公演がないとき: 条件で観られる中で好みに近い種類を、近さが下がると明記して示す
  const lower=scored.all[5].kind,far={...config,events:[{id:'x1',name:'テスト公演',start:'2030-01-05T10:00',end:'2030-01-05T12:00',when:'2030年1月5日',prefecture:'高知県',place:'高知県',kind:lower}],regular:[]};
  ui=setupQuiz(far);d=ui.d;w=ui.w;d.querySelector('#quiz-start').click();for(const id of ['drama','fast','visual','short','quiet','story','history'])pick(d,id);region(d,w,'地方:四国');pick(d,'unknown');
  ok(d.querySelector('.quiz-alt h4')?.lastChild?.textContent===lower&&d.querySelector('.quiz-alt').textContent.includes('好みの近さは、上の神楽より下がります')&&d.querySelector('.quiz-alt a[href="/events/x1.html"]'),'条件に合う公演がなければ、観られる中で好みに近い種類を(近さが下がると明記して)示す');ui.dom.window.close();

  // いちばん近い神楽の枠: 共通の .quiz-program{padding:8px 0 10px}(左右0)に負けず、枠の内側に左右の余白がある(2026-11-09 スマホで文字が枠線に接していた)
  const css=readFileSync('scripts/style.css','utf8');
  ok(/\.quiz-program\.quiz-best\{padding:\d+px [1-9]\d*px/.test(css)&&/max-width:560px\)\{\.quiz-program\.quiz-best\{padding:\d+px [1-9]\d*px/.test(css)&&!/(^|[}\s])\.quiz-best\{padding/.test(css),'いちばん近い神楽の枠は、PCでもスマホでも左右の余白を持つ(共通の指定に上書きされない)');

  section('診断の定期点検(週次の振り返り)');
  {
    const base=acceptBaseline(info,'2026-11-09'),today='2026-11-16';
    const h=quizHealth({info,events:[],regular:[],todayJst:today,baseline:base,checked:'2026-11-09'});
    ok(h.kinds===19&&!h.missing.length&&!h.changed.length&&!h.newKinds.length&&h.checkedDaysAgo===7,'確認済みのままなら、根拠の変更・欠け・対象外の神楽はない');
    const saved=JSON.parse(readFileSync('data/quiz-review.json','utf8'));
    ok(Object.keys(evidenceHashes(info)).every(k=>k in saved.evidence)&&/^\d{4}-\d{2}-\d{2}$/.test(saved.reviewed),'data/quiz-review.json に、いまの根拠がすべて確認済みとして載っている(根拠を足したら --accept する)');
    const edited=structuredClone(info);edited['広島神楽'].features[0]='書き換えた本文。';delete edited['花祭'].tagline;
    const h2=quizHealth({info:edited,events:[],regular:[],todayJst:today,baseline:base});
    ok(h2.changed.includes('広島神楽/features.0')&&h2.missing.some(k=>k.startsWith('花祭/tagline'))&&!h2.changed.some(k=>k.startsWith('花祭/tagline')),'解説の本文が変われば「変更」、消えれば「見つからない」として分けて挙げる');
    ok(quizHealth({info:edited,events:[],regular:[],todayJst:today,baseline:null}).changed.length===0,'確認済みの記録がなければ、変更は数えない');
    const more={...info,新しい神楽:{source:'出典',tagline:'県 ・ 一言',features:['特徴1。','特徴2。']},['安芸高田神楽']:{...info['安芸高田神楽'],tagline:'x',features:['a','b']}};
    ok(quizHealth({info:more,events:[],regular:[],todayJst:today}).newKinds.join()==='新しい神楽','解説がそろったのに対象外の神楽を挙げる(理由つきの対象外 QUIZ_EXCLUDED は除く)');
    const ev=(id,kagura,start,status='published')=>({id,kagura,start,status});
    const evs=[ev('a','出雲神楽','2026-11-20'),ev('b','出雲神楽','2026-12-01'),ev('c','出雲神楽','2026-12-05'),ev('d','豊後神楽','2026-12-01'),ev('e','豊後神楽','2026-12-02'),ev('f','豊後神楽','2026-12-03','pending'),ev('g','出雲神楽','2026-11-01'),ev('h','石見神楽','2026-12-01'),ev('i','石見神楽','2026-12-02'),ev('j','石見神楽','2026-12-03')];
    const h3=quizHealth({info,events:evs,regular:[{kagura:'広島神楽'}],todayJst:today});
    ok(JSON.stringify(h3.uncovered)==='[{"kind":"出雲神楽","n":3}]','掲載中で今後の開催が3件以上あるのに解説がない神楽だけを挙げる(保留中・終わった開催・解説のある神楽は除く)',JSON.stringify(h3.uncovered));
    ok(!h3.noShows.includes('石見神楽')&&!h3.noShows.includes('広島神楽')&&h3.noShows.includes('花祭'),'いま掲載中の公演も定期公演もない対象を挙げる');
    const m=reviewMetrics({events:[],todayJst:today,quiz:{...h3,changed:['石見神楽/features.0'],missing:['花祭/tagline'],newKinds:['新しい神楽'],checkedDaysAgo:QUIZ_STALE_DAYS+1}});
    const keys=decideActions(m,null).filter(a=>a.key.startsWith('quiz-'));
    ok(['quiz-evidence-missing','quiz-evidence-changed','quiz-new-kinds','quiz-uncovered','quiz-stale'].every(k=>keys.some(a=>a.key===k))&&keys.every(a=>a.owner==='Claude'),'点検で見つかったことを、Claude の「今週やること」にする');
    ok(!decideActions(reviewMetrics({events:[],todayJst:today,quiz:h}),null).some(a=>a.key.startsWith('quiz-'))&&!decideActions(reviewMetrics({events:[],todayJst:today}),null).some(a=>a.key.startsWith('quiz-')),'問題がない週・点検の結果がない週は、診断の項目を出さない');
    const md=renderReview(m,null,[],[]);
    ok(md.includes('### 好み診断')&&md.includes('対象 19 種類')&&md.includes('いま掲載中の公演がない対象'),'振り返りの Issue に、診断の点検の数字を載せる');
  }

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
  t=setup();t.time(31000);t.scroll(200);t.leave();t.w.dispatchEvent(new t.w.Event('kagura:consent-dialog'));ok(t.box.hidden,'案内後にCMPを開いた場合も除去');
  const click=new t.w.MouseEvent('click',{bubbles:true,cancelable:true});t.d.querySelector('#official').dispatchEvent(click);ok(!click.defaultPrevented,'公式リンクのクリックを横取りしない');t.close();
  t=setup();t.time(31000);t.scroll(200);t.leave();t.w.dispatchEvent(new t.w.Event('resize'));ok(t.box.hidden,'画面回転/リサイズ時は閉じて再配置による遮蔽を避ける');t.close();
  ok(!/beforeunload|pushState|popstate|showModal|box\.show\(/.test(js),'離脱ダイアログ・履歴操作・モーダル表示なし');
  ok(!/gtag|fetch\(|sendBeacon/.test(js),'新規計測や外部通信なし');
  for(const page of ['quiz.html','contact.html','submit.html','privacy.html','terms.html','disclaimer.html','en/index.html'])ok(!readFileSync(join(OUT,page),'utf8').includes('id="quiz-offer"'),`${page}: 案内対象外`);
  const home=readFileSync(join(OUT,'index.html'),'utf8');ok(home.includes('気になる神楽、まだ迷っていますか？')&&home.includes('好みから探す')&&home.includes('role="region"'),'押し付けない案内文と非モーダル領域');
}
