(() => {
  const root=document.getElementById('quiz');if(!root)return;
  const data=JSON.parse(document.getElementById('quiz-data').textContent);
  const engine=(/* quizEngine */)(data.questions,data.traditions);
  const start=document.getElementById('quiz-start'),form=document.getElementById('quiz-form'),field=document.getElementById('quiz-field'),progress=document.getElementById('quiz-progress'),back=document.getElementById('quiz-back'),next=document.getElementById('quiz-next'),result=document.getElementById('quiz-result'),error=document.getElementById('quiz-error');
  const count=data.questions.length;
  let index=0,answers=[],day='',complete=false;
  function event(name){if(window.kaguraGa4Allowed===true&&typeof window.gtag==='function')window.gtag('event',name,{content_type:'kagura_quiz'});}
  function el(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
  function draw(){
    field.replaceChildren();error.textContent='';progress.textContent=`${index+1}/${count}`;progress.style.setProperty('--p',`${(index+1)/count*100}%`);
    const q=data.questions[index],legend=el('legend',q.text);legend.tabIndex=-1;field.append(legend);
    if(q.type==='region'){
      const label=el('label','都道府県を選ぶ','quiz-select-label'),select=el('select');select.id='quiz-region';label.htmlFor=select.id;
      [...q.choices,...data.prefectures.map(p=>({id:p,label:p}))].forEach(c=>{const o=el('option',c.label);o.value=c.id;select.append(o)});select.value=answers[index];select.addEventListener('change',()=>{answers[index]=select.value});field.append(label,select);
    }else{
      q.choices.forEach(c=>{const label=el('label',null,'quiz-choice'),radio=el('input');radio.type='radio';radio.name='answer';radio.value=c.id;radio.checked=answers[index]===c.id;
        radio.addEventListener('change',()=>{answers[index]=c.id;error.textContent='';next.disabled=false;const date=document.getElementById('quiz-day');if(date)date.hidden=c.id!=='specified';});label.append(radio,el('span',c.label));field.append(label);});
    }
    if(q.type==='date'){
      const label=el('label','希望日（日本時間）','quiz-date-label');label.id='quiz-day';label.hidden=answers[index]!=='specified';const input=el('input');input.type='date';input.value=day;input.addEventListener('input',()=>{day=input.value});label.append(input);field.append(label);
    }
    if(q.id==='budget')field.append(el('p','時間は比較の目安です。途中観覧の可否や所要時間が不明な公演を、希望に合うと断定しません。','meta'));
    back.disabled=index===0;next.disabled=!answers[index];next.textContent=index===count-1?'結果を見る':'次へ';legend.focus();
  }
  function begin(){try{sessionStorage.setItem('km-quiz-offer','1')}catch{}index=0;answers=data.questions.map(q=>q.type==='preference'?null:'unknown');day='';complete=false;result.hidden=true;result.replaceChildren();start.hidden=true;form.hidden=false;draw();event('quiz_start');}
  start.textContent=`${count}問の診断をはじめる`;start.hidden=false;start.addEventListener('click',begin);back.addEventListener('click',()=>{if(index>0){index--;draw()}});
  form.addEventListener('submit',e=>{
    e.preventDefault();if(complete)return;
    if(!answers[index]){error.textContent='ひとつ選んでください。「まだ分からない」でも進めます。';return;}
    if(data.questions[index].type==='date'&&answers[index]==='specified'&&!engine.validDate(day)){error.textContent='希望日を入力するか、「まだ決めていない」を選んでください。';return;}
    if(index<count-1){index++;draw();return;}
    const scored=engine.scoreAnswers(answers);if(!scored){error.textContent='回答を確認してください。';return;}
    complete=true;form.hidden=true;result.hidden=false;
    const byId=Object.fromEntries(data.questions.map((q,i)=>[q.id,answers[i]])),conditions={region:byId.region,date:byId.date,day,budget:byId.budget};
    const head=el('div',null,'quiz-type'),heading=el('h2',scored.ranked.length?'好みから見つける神楽':'まずは、気になる公演を探してみませんか');heading.tabIndex=-1;head.append(heading,el('p','回答と出典付きの解説をもとにした編集上の提案です。性格・適性や相性の確率を示すものではありません。神楽の特徴や演目は、地域・団体・公演によって異なります。'));result.append(head);
    if(!scored.ranked.length)result.append(el('p','まだ好みが決まっていないため、特定の神楽をおすすめと判定していません。対象の神楽のうち、条件に合う掲載公演を下に示します。'));
    if(scored.tied)result.append(el('p','同じ点数の候補があります。表示は編集上の掲載順で最大3種類です。優劣を示す順番ではありません。','meta'));
    scored.ranked.forEach(t=>{
      const box=el('section',null,'quiz-program'),h=el('h3'),a=el('a',t.kind);a.href=t.href;h.append(a);box.append(h);
      t.matched.slice().sort((a,b)=>scored.scores[b.feature]-scored.scores[a.feature]).slice(0,2).forEach(m=>{box.append(el('p',`「${scored.reasons[m.feature][0]}」という回答から、${data.features[m.feature]}の見どころをご案内します。`),el('p',m.text,'quiz-evidence'));});
      box.append(el('p',`解説の出典：${t.source}。実際の上演内容は公演詳細・公式情報をご確認ください。`,'meta'));result.append(box);
    });
    const help={highlights:'解説ページの「特徴」や「主な演目」から見どころを確認できます。',synopsis:'解説ページの「主な演目」から、掲載されているあらすじを確認できます。',history:'解説ページでは、掲載されている歴史や地域の背景もご覧ください。',watch:'事前知識がなくても、まずは気になる公演の公式案内から観覧方法を確認できます。'};
    if(help[byId.help])result.append(el('p',help[byId.help]+' この回答は推薦順位には使っていません。'));
    const now=new Date(Date.now()+9*3600e3).toISOString().slice(0,16),dates=engine.range(conditions.date,day,now),kinds=scored.ranked.length?scored.ranked.map(t=>t.kind):data.traditions.map(t=>t.kind);
    result.append(el('h3','条件から探す開催情報'),el('p',`推薦対象は現在${data.traditions.length}種類です。掲載のない神楽や公演もあります。`,'meta'));
    result.append(el('p',`地域：${['unknown','all'].includes(conditions.region)?'全国':conditions.region} ／ 日程：${dates?dates.join('〜'):'未指定'}（日本時間）。時間の希望は候補を除外せず、各公演に確認事項を示します。`,'quiz-conditions'));
    const matches=engine.selectEvents(data.events,kinds,conditions,now);
    if(!matches.length)result.append(el('p','現在掲載中の公演には、該当するものがありません。条件を変えるか、ほかの公演を探せます。'));
    matches.slice(0,6).forEach(e=>{const line=el('div',null,'quiz-event'),a=el('a',e.name);a.href=`/events/${e.id}.html`;a.addEventListener('click',()=>event('quiz_event_click'));line.append(a,el('p',e.when||e.start.slice(0,10)),el('p',[e.kind,e.place].filter(Boolean).join(' ・ '),'meta'),el('p',engine.duration(e,conditions.budget),'meta'));result.append(line)});
    if(matches.length>6)result.append(el('p',`ほかに${matches.length-6}件あります。各神楽のページから探せます。`));
    const regs=data.regular.filter(r=>kinds.includes(r.kind)&&(!r.until||r.until>=(dates&&dates[0]>now.slice(0,10)?dates[0]:now.slice(0,10)))&&(['all','unknown'].includes(conditions.region)||r.prefecture===conditions.region));
    if(regs.length){result.append(el('h3','日程を個別に確認する定期公演'),el('p','以下は希望日・時間への適合を確認していない参考情報です。開催日、休演、所要時間は詳細・公式情報をご確認ください。','meta'));regs.forEach(r=>{const p=el('p',null,'quiz-event'),a=el('a',r.name);a.href=`/regular/${r.id}.html`;a.addEventListener('click',()=>event('quiz_event_click'));p.append(a,el('span',` ${r.prefecture||'地域要確認'}・${r.schedule}`));result.append(p)})}
    const search=el('a','ほかの公演を探す','btn');search.href='/calendar.html';search.addEventListener('click',()=>event('quiz_search_click'));
    const restart=el('button','もう一度診断する','btn ghost');restart.type='button';restart.addEventListener('click',begin);const actions=el('p',null,'quiz-actions');actions.append(search,restart);result.append(actions);heading.focus();event('quiz_complete');
  });
})();
