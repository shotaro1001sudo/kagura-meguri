(() => {
  const root=document.getElementById('quiz');
  if (!root) return;
  const data=JSON.parse(document.getElementById('quiz-data').textContent);
  const scoreAnswers=/* scoreAnswers */;
  const start=document.getElementById('quiz-start'), form=document.getElementById('quiz-form');
  const field=document.getElementById('quiz-field'), progress=document.getElementById('quiz-progress');
  const back=document.getElementById('quiz-back'), next=document.getElementById('quiz-next');
  const result=document.getElementById('quiz-result'), error=document.getElementById('quiz-error');
  let index=0,answers=Array(10).fill(null),complete=false,tapped=false;
  function event(name) {
    if (window.kaguraGa4Allowed===true && typeof window.gtag==='function') window.gtag('event',name,{content_type:'kagura_quiz'});
  }
  function el(tag,text,cls) {const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
  // 「2026-11-08T13:00」→「11月8日(日)」
  function jpDay(s) {const [y,m,d]=s.slice(0,10).split('-').map(Number);return `${m}月${d}日(${'日月火水木金土'[new Date(Date.UTC(y,m-1,d)).getUTCDay()]})`;}
  function draw() {
    field.replaceChildren(); error.textContent=''; tapped=false;
    progress.textContent=`${index+1}/10`;progress.style.setProperty('--p',`${(index+1)*10}%`);
    const q=data.questions[index],legend=el('legend',q.text);legend.tabIndex=-1;field.append(legend);
    q.choices.forEach(choice=>{
      const label=el('label',null,'quiz-choice'),radio=el('input');radio.type='radio';radio.name='answer';radio.value=choice.axis;radio.checked=answers[index]===choice.axis;
      // 指で選んだときだけ、少し待って次の問いへ進む(キーボードの矢印キーで選び直すときは進まない)
      label.addEventListener('pointerdown',()=>{tapped=true;});label.addEventListener('pointercancel',()=>{tapped=false;});
      radio.addEventListener('change',()=>{
        answers[index]=choice.axis;error.textContent='';next.disabled=false;
        if(tapped&&index<9){const at=index;setTimeout(()=>{if(at===index&&!complete){index++;draw();}},280);}
        tapped=false;
      });
      label.append(radio,el('span',choice.label));field.append(label);
    });
    back.disabled=index===0;next.disabled=!answers[index];next.textContent=index===9?'結果を見る':'次へ';legend.focus();
  }
  function begin() {
    try{sessionStorage.setItem('km-quiz-offer','1')}catch{}
    index=0;answers=Array(10).fill(null);complete=false;result.hidden=true;result.replaceChildren();start.hidden=true;form.hidden=false;draw();event('quiz_start');
  }
  start.hidden=false;start.addEventListener('click',begin);
  back.addEventListener('click',()=>{if(index>0){index--;draw();}});
  form.addEventListener('submit',e=>{
    e.preventDefault();if(complete)return;
    if(!answers[index]){error.textContent='ひとつ選んでから進んでください。';return;}
    if(index<9){index++;draw();return;}
    const scored=scoreAnswers(answers);if(!scored){error.textContent='回答を確認して、もう一度お試しください。';return;}
    complete=true;form.hidden=true;result.hidden=false;
    // 結果の要: 惹かれる楽しみ方を大きく示す(同点は併記)
    const head=el('div',null,'quiz-type');
    const heading=el('h2',scored.winners.length>1?'あなたは、いくつもの楽しみ方に惹かれています':'あなたが惹かれるのは');heading.tabIndex=-1;head.append(heading);
    const kinds=[];
    scored.winners.forEach(k=>{const a=data.axes[k];head.append(el('p',a.label,'quiz-type-label'),el('p',a.reason));a.kinds.forEach(x=>{if(!kinds.some(y=>y.kind===x.kind))kinds.push(x);});});
    result.append(head);
    // 回答の内訳(画面に出すだけ。保存も送信もしない)
    const bars=el('ul',null,'quiz-bars');bars.setAttribute('aria-label','回答の内訳');
    Object.keys(data.axes).sort((x,y)=>scored.counts[y]-scored.counts[x]).forEach(k=>{
      const li=el('li',null,scored.winners.includes(k)?'win':''),bar=el('span',null,'bar');bar.style.setProperty('--n',scored.counts[k]);
      li.append(el('span',data.axes[k].label,'name'),bar,el('span',`${scored.counts[k]}問`,'num'));bars.append(li);
    });
    result.append(el('h3','回答の内訳'),bars);
    // おすすめの神楽(各地の主要な神楽から、回答の多い楽しみ方に合うもの)
    result.append(el('h3','おすすめの神楽'));
    kinds.forEach(x=>{
      const k=data.kinds[x.kind],box=el('div',null,'quiz-program'),h=el('h4'),link=el('a',x.kind);link.href=k.href;h.append(link);
      box.append(h,el('p',k.tagline,'meta'),el('p',x.why));
      if(k.program)box.append(el('p',`代表的な演目「${k.program.name}」: ${k.program.text}`,'quiz-sample'));
      result.append(box);
    });
    result.append(el('p','特徴は、各神楽の解説ページ(出典つき)をもとに編集部がまとめたものです。演目の上演を約束するものではありません。','meta annotation'));
    // その神楽の、これからの公演(近い順に6件まで)と定期公演
    const want=new Set(kinds.map(x=>x.kind)),nowJst=new Date(Date.now()+9*3600e3).toISOString().slice(0,16);
    const matches=data.events.filter(e=>want.has(e.kind)&&e.start>nowJst).sort((a,b)=>a.start<b.start?-1:1);
    const regs=data.regular.filter(r=>want.has(r.kind));
    result.append(el('h3','近く観られる公演'));
    if(!matches.length&&!regs.length)result.append(el('p','現在掲載中の該当公演はありません'));
    const seen=new Set();matches.slice(0,6).forEach(e=>{
      if(seen.has(e.id))return;seen.add(e.id);
      const line=el('div',null,'quiz-event'),link=el('a',null);link.href=`/events/${e.id}.html`;link.addEventListener('click',()=>event('quiz_event_click'));
      link.append(el('b',jpDay(e.start)),el('span',e.name));line.append(link,el('p',[e.kind,e.place].filter(Boolean).join(' ・ '),'meta annotation'));result.append(line);
    });
    regs.forEach(r=>{
      const line=el('div',null,'quiz-event'),link=el('a',null);link.href=`/regular/${r.id}.html`;link.addEventListener('click',()=>event('quiz_event_click'));
      link.append(el('b','定期公演'),el('span',r.name));line.append(link,el('p',[r.kind,r.schedule].filter(Boolean).join(' ・ '),'meta annotation'));result.append(line);
    });
    if(matches.length>6)result.append(el('p',`ほかに${matches.length-6}件の公演があります。各神楽のページから探せます。`,'meta'));
    result.append(el('p','日程・演目は変更されることがあります。お出かけ前に公式情報をご確認ください。','meta annotation'));
    const search=el('a','ほかの公演を探す','btn');search.href='/calendar.html';search.addEventListener('click',()=>event('quiz_search_click'));
    const restart=el('button','もう一度診断する','btn ghost');restart.type='button';restart.addEventListener('click',begin);
    const actions=el('p',null,'quiz-actions');actions.append(search,restart);result.append(actions);heading.focus();event('quiz_complete');
  });
})();
