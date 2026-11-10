(() => {
  const root=document.getElementById('quiz');if(!root)return;
  const data=JSON.parse(document.getElementById('quiz-data').textContent);
  const engine=(/* quizEngine */)(data.questions,data.traditions);
  // 定期公演の休演表示(サイトの一覧と同じ考え方): 曜日の決まりどおりなら公演がある日から、14日以上あいていたら「休演中・次の公演は1月16日(土)」。それ以外は ""
  const addDay=(s,n)=>new Date(Date.parse(s+'T00:00:00Z')+n*864e5).toISOString().slice(0,10);
  const regularPause=(r,today)=>{const d=(r.next||[]).find(x=>x>=today),base=r.nominal&&r.nominal>=today?r.nominal:today;if(d&&d<addDay(base,r.pauseDays||14))return '';if(!d)return '休演中・次の公演日は未定';const w='日月火水木金土'[new Date(d+'T00:00:00Z').getUTCDay()];return `休演中・次の公演は${+d.slice(5,7)}月${+d.slice(8,10)}日(${w})`};
  const start=document.getElementById('quiz-start'),form=document.getElementById('quiz-form'),field=document.getElementById('quiz-field'),progress=document.getElementById('quiz-progress'),back=document.getElementById('quiz-back'),next=document.getElementById('quiz-next'),result=document.getElementById('quiz-result'),error=document.getElementById('quiz-error');
  const count=data.questions.length;
  let index=0,answers=[],day='',complete=false;
  function event(name){if(window.kaguraGa4Allowed===true&&typeof window.gtag==='function')window.gtag('event',name,{content_type:'kagura_quiz'});}
  function el(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
  function link(text,href,cls,ga){if(!href)return el('span',text,cls);const a=el('a',text,cls);a.href=href;if(ga)a.addEventListener('click',()=>event(ga));return a;}
  function draw(){
    field.replaceChildren();error.textContent='';progress.textContent=`${index+1}/${count}`;progress.style.setProperty('--p',`${(index+1)/count*100}%`);
    const q=data.questions[index],legend=el('legend',q.text);legend.tabIndex=-1;field.append(legend);
    if(q.type==='region'){
      const label=el('label','地域を選ぶ(都道府県、または地方のどこでも)','quiz-select-label'),select=el('select');select.id='quiz-region';label.htmlFor=select.id;
      q.choices.forEach(c=>{const o=el('option',c.label);o.value=c.id;select.append(o)});
      data.regions.forEach(([r,ps])=>{const g=el('optgroup');g.label=r;const any=el('option',`${r}のどこでも`);any.value='地方:'+r;g.append(any);ps.forEach(p=>{const o=el('option',p);o.value=p;g.append(o)});select.append(g)});
      select.value=answers[index];select.addEventListener('change',()=>{answers[index]=select.value});field.append(label,select);
      field.append(el('p','選んだ地域の公演を、好みに近い神楽から探します。好みの順位は変わりません。','meta'));
    }else{
      q.choices.forEach(c=>{const label=el('label',null,'quiz-choice'+(c.id==='unknown'?' quiz-unknown':'')),radio=el('input');radio.type='radio';radio.name='answer';radio.value=c.id;radio.checked=answers[index]===c.id;
        radio.addEventListener('change',()=>{answers[index]=c.id;error.textContent='';next.disabled=false;const date=document.getElementById('quiz-day');if(date)date.hidden=c.id!=='specified';});label.append(radio,el('span',c.label));field.append(label);});
    }
    if(q.type==='date'){
      const label=el('label','希望日(日本時間)','quiz-date-label');label.id='quiz-day';label.hidden=answers[index]!=='specified';const input=el('input');input.type='date';input.value=day;input.addEventListener('input',()=>{day=input.value});label.append(input);field.append(label);
    }
    back.disabled=index===0;next.disabled=!answers[index];next.textContent=index===count-1?'結果を見る':'次へ';legend.focus();
  }
  function begin(){try{sessionStorage.setItem('km-quiz-offer','1')}catch{}index=0;answers=data.questions.map(q=>q.type==='preference'?null:'unknown');day='';complete=false;result.hidden=true;result.replaceChildren();start.hidden=true;form.hidden=false;draw();event('quiz_start');}
  start.textContent=`${count}問の診断をはじめる`;start.hidden=false;start.addEventListener('click',begin);back.addEventListener('click',()=>{if(index>0){index--;draw()}});
  const md=s=>`${+s.slice(5,7)}月${+s.slice(8,10)}日`,datesLabel=ds=>!ds?'指定なし':ds[0]===ds[1]?md(ds[0]):`${md(ds[0])}〜${md(ds[1])}`;
  const regionLabel=r=>['unknown','all'].includes(r)?'全国':r.startsWith('地方:')?r.slice(3)+'地方':r;
  // 回答に合う根拠を、同じ本文ごとにまとめる(「速く勇ましい舞・面や衣装の華やかさ」+ 根拠の本文)
  function reasons(t,max){
    const groups=[];for(const m of t.matched){const g=groups.find(g=>g.text===m.text);if(g)g.labels.push(data.features[m.feature].label);else groups.push({text:m.text,labels:[data.features[m.feature].label]});}
    const list=el('ul',null,'quiz-reasons');groups.slice(0,max).forEach(g=>{const li=el('li');li.append(el('b',g.labels.join('・')),el('span',g.text,'quiz-evidence'));list.append(li)});return list;
  }
  function eventLine(e,budget){
    const line=el('div',null,'quiz-event');line.append(link(e.name,`/events/${e.id}.html`,null,'quiz_event_click'),el('p',e.when||e.start.slice(0,10)),el('p',[e.kind,e.place].filter(Boolean).join(' ・ '),'meta'));
    if(budget)line.append(el('p',engine.duration(e,budget),'meta'));return line;
  }
  form.addEventListener('submit',e=>{
    e.preventDefault();if(complete)return;
    if(!answers[index]){error.textContent='ひとつ選んでください。「まだ分からない」でも進めます。';return;}
    if(data.questions[index].type==='date'&&answers[index]==='specified'&&!engine.validDate(day)){error.textContent='希望日を入力するか、「まだ決めていない」を選んでください。';return;}
    if(index<count-1){index++;draw();return;}
    const scored=engine.scoreAnswers(answers);if(!scored){error.textContent='回答を確認してください。';return;}
    complete=true;form.hidden=true;result.hidden=false;
    const byId=Object.fromEntries(data.questions.map((q,i)=>[q.id,answers[i]])),conditions={region:byId.region,date:byId.date,day};
    const budget=byId.time==='short'?'short':'';
    const best=scored.ranked[0],type=scored.top.slice(0,2).map(f=>data.features[f].type).join(' × ');
    // 1. 回答から見た、好みの傾向(性格ではなく、選んだ観かたのまとめ)
    const head=el('div',null,'quiz-type'),heading=el('h2',best?'あなたの好みの傾向':'まずは、気になる公演を探してみませんか');heading.tabIndex=-1;head.append(heading);
    if(best){
      head.append(el('p',type,'quiz-type-label'),el('p',scored.top.slice(0,2).map(f=>data.features[f].note+'。').join('')));
      const chips=el('ul',null,'quiz-chips');scored.top.slice(0,5).forEach(f=>chips.append(el('li',data.features[f].label)));head.append(chips);
    }else head.append(el('p','まだ好みが決まっていないため、特定の神楽をおすすめと判定していません。初めてなら、はじめての神楽ガイドから読むのもおすすめです。'));
    head.append(el('p','回答と出典つきの解説をもとにした編集上の提案です。性格・適性や相性の確率を示すものではありません。神楽の特徴や演目は、地域・団体・公演によって異なります。','meta'));
    result.append(head);
    if(!best){const p=el('p');p.append(link('はじめての神楽ガイドを読む','/guide.html','btn ghost'));result.append(p);}
    // 2. いちばん近い神楽と、ほかの候補(根拠の本文つき)
    if(best){
      result.append(el('h3','いちばん近い神楽'));
      const box=el('section',null,'quiz-program quiz-best'),h=el('h4');h.append(link(best.kind,best.href));box.append(h,el('p',best.tagline,'quiz-tagline'));
      box.append(el('p','回答の好みと重なる、この神楽の特徴(出典の本文より)'),reasons(best,3));
      const tips=(best.viewing||[]).filter(v=>!best.matched.slice(0,3).some(m=>m.text===v));
      if(tips.length){const tip=el('div',null,'quiz-tip');tip.append(el('b','観に行くときのヒント'));tips.forEach(v=>tip.append(el('p',v)));box.append(tip);}
      box.append(el('p',`解説の出典：${best.source}。実際の上演内容は公演詳細・公式情報をご確認ください。`,'meta'));
      const more=el('p');more.append(link(`${best.kind}の解説を読む`,best.href,'btn ghost sm'));box.append(more);result.append(box);
      if(scored.ranked.length>1){
        result.append(el('h3','こちらも好みに近い神楽'));
        scored.ranked.slice(1).forEach(t=>{const b=el('section',null,'quiz-program'),h=el('h4');h.append(link(t.kind,t.href));b.append(h,el('p',t.tagline,'quiz-tagline'),reasons(t,1),el('p',`解説の出典：${t.source}`,'meta'));result.append(b);});
      }
      if(scored.tied)result.append(el('p','好みの近さが同じ候補があります。並びは編集上の掲載順で、優劣を示すものではありません。','meta'));
    }
    const help={highlights:'解説ページの「特徴」や「主な演目」から見どころを確認できます。',synopsis:'解説ページの「主な演目」から、掲載されているあらすじを確認できます。',history:'解説ページでは、掲載されている歴史や地域の背景もご覧ください。',watch:'事前知識がなくても、まずは気になる公演の公式案内から観覧方法を確認できます。'};
    if(help[byId.help])result.append(el('p',help[byId.help]+' この回答は推薦の順位には使っていません。','quiz-help'));
    // 3. 観に行ける公演: 好みに近い神楽(最大3種類)の掲載公演を、地域・日程で絞る
    const now=new Date(Date.now()+9*3600e3).toISOString().slice(0,16),dates=engine.range(conditions.date,day,now),kinds=best?scored.ranked.map(t=>t.kind):data.traditions.map(t=>t.kind);
    result.append(el('h3','観に行ける公演'),el('p',`地域：${regionLabel(conditions.region)} ／ 日程：${datesLabel(dates)}`,'quiz-conditions'));
    const matches=engine.selectEvents(data.events,kinds,conditions,now,data.regions);
    matches.slice(0,6).forEach(e=>result.append(eventLine(e,budget)));
    if(matches.length>6)result.append(el('p',`ほかに${matches.length-6}件あります。各神楽のページから探せます。`));
    if(!matches.length){
      result.append(el('p',best?'好みに近い神楽には、この条件で掲載中の公演がありません。':'この条件で掲載中の公演には、該当するものがありません。条件を変えるか、ほかの公演を探せます。'));
      // 条件に合う公演がある種類のうち、好みにいちばん近いもの(上の3種類より、好みの近さは下がる)
      const alt=best&&scored.all.slice(3).find(t=>engine.selectEvents(data.events,[t.kind],conditions,now,data.regions).length);
      if(alt){
        const box=el('section',null,'quiz-alt'),h=el('h4');h.append(el('span','この条件で観られる中では '),link(alt.kind,alt.href));box.append(h,el('p',alt.tagline,'quiz-tagline'),reasons(alt,1),el('p','好みの近さは、上の神楽より下がります。','meta'));
        engine.selectEvents(data.events,[alt.kind],conditions,now,data.regions).slice(0,3).forEach(e=>box.append(eventLine(e,budget)));result.append(box);
      }
    }
    const regs=data.regular.filter(r=>kinds.includes(r.kind)&&(!r.until||r.until>=(dates&&dates[0]>now.slice(0,10)?dates[0]:now.slice(0,10)))&&engine.inRegion(r.prefecture,conditions.region,data.regions));
    // 定期公演は、休演の時期(秋祭りの間など)があるため、休演中なら「休演中」と次の公演日を添える(外さずに出す)
    if(regs.length){result.append(el('h3','定期公演'),el('p','曜日を決めて上演している公演です。休演の時期や休演日があります。希望日・時間への適合は確認していない参考情報なので、開催日と所要時間は詳細・公式情報をご確認ください。','meta'));regs.forEach(r=>{const p=el('p',null,'quiz-event'),st=regularPause(r,now.slice(0,10));p.append(link(r.name,`/regular/${r.id}.html`,null,'quiz_event_click'));if(st)p.append(el('span',` ${st}`,'quiz-paused'));p.append(el('span',` ${r.prefecture||'地域要確認'}・${r.schedule}`));result.append(p)})}
    // 4. シェア(押したときだけ。結果はURLに入れない)と、次の操作
    if(best){
      const text=`神楽の好み診断の結果は「${type}」。いちばん近い神楽は「${best.kind}」でした。`,url=data.url||location.origin+'/quiz.html';
      const share=el('div',null,'quiz-share');share.append(el('p','結果をシェアする(回答の中身は入りません)','meta'));
      const x=link('Xでシェア',`https://x.com/intent/post?text=${encodeURIComponent(text+' #神楽')}&url=${encodeURIComponent(url)}`,'btn ghost sm','quiz_share');x.target='_blank';x.rel='noopener';
      const copy=el('button','結果をコピー','btn ghost sm');copy.type='button';const done=el('span','','meta quiz-copied');done.setAttribute('role','status');
      copy.addEventListener('click',()=>{event('quiz_share');const ok=()=>{done.textContent='コピーしました'};try{navigator.clipboard.writeText(text+' '+url).then(ok,()=>{done.textContent='コピーできませんでした'})}catch{done.textContent='コピーできませんでした'}});
      share.append(x,copy,done);result.append(share);
    }
    const search=link('ほかの公演を探す','/calendar.html','btn','quiz_search_click');
    const restart=el('button','もう一度診断する','btn ghost');restart.type='button';restart.addEventListener('click',begin);const actions=el('p',null,'quiz-actions');actions.append(search,restart);result.append(actions);heading.focus();event('quiz_complete');
  });
})();
