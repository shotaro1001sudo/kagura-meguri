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
    const ids=new Set();
    scored.winners.forEach(k=>{const a=data.axes[k];head.append(el('p',a.label,'quiz-type-label'),el('p',a.reason));a.programs.forEach(id=>ids.add(id));});
    result.append(head);
    // 回答の内訳(画面に出すだけ。保存も送信もしない)
    const bars=el('ul',null,'quiz-bars');bars.setAttribute('aria-label','回答の内訳');
    Object.keys(data.axes).sort((x,y)=>scored.counts[y]-scored.counts[x]).forEach(k=>{
      const li=el('li',null,scored.winners.includes(k)?'win':''),bar=el('span',null,'bar');bar.style.setProperty('--n',scored.counts[k]);
      li.append(el('span',data.axes[k].label,'name'),bar,el('span',`${scored.counts[k]}問`,'num'));bars.append(li);
    });
    result.append(el('h3','回答の内訳'),bars);
    result.append(el('h3','おすすめの演目'),el('p','以下は公式の演目解説を参考に編集部が選んだ、石見神楽の演目の一例です。地域全体の特徴や、上演を保証するものではありません。','meta annotation'));
    ids.forEach(id=>{
      const p=data.programs[id],box=el('div',null,'quiz-program');box.append(el('h4',p.name),el('p',p.text));
      const source=el('a','演目の公式解説');source.href=p.source;source.target='_blank';source.rel='noopener noreferrer';const note=el('p',null,'meta annotation');note.append(source);box.append(note);result.append(box);
    });
    const nowJst=new Date(Date.now()+9*3600e3).toISOString().slice(0,16);
    const matches=data.events.filter(e=>ids.has(e.program)&&e.start>nowJst);
    result.append(el('h3','この演目を予定している公演'));
    if(!matches.length)result.append(el('p','現在掲載中の該当公演はありません'));
    const seen=new Set();matches.forEach(e=>{
      if(seen.has(e.id))return;seen.add(e.id);
      const line=el('div',null,'quiz-event'),link=el('a',null);link.href=`/events/${e.id}.html`;link.addEventListener('click',()=>event('quiz_event_click'));
      link.append(el('b',jpDay(e.start)),el('span',e.name));
      const proof=el('a','演目の掲載元');proof.href=e.source;proof.target='_blank';proof.rel='noopener noreferrer';
      const meta=el('p',null,'meta annotation');if(e.place)meta.append(`${e.place} ・ `);meta.append(proof);line.append(link,meta);result.append(line);
    });
    result.append(el('p','日程・出演演目は変更されることがあります。お出かけ前に公式情報をご確認ください。','meta annotation'));
    const search=el('a','ほかの公演を探す','btn');search.href='/calendar.html';search.addEventListener('click',()=>event('quiz_search_click'));
    const restart=el('button','もう一度診断する','btn ghost');restart.type='button';restart.addEventListener('click',begin);
    const actions=el('p',null,'quiz-actions');actions.append(search,restart);result.append(actions);heading.focus();event('quiz_complete');
  });
})();
