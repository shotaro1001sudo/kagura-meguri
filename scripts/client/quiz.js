(() => {
  const root=document.getElementById('quiz');
  if (!root) return;
  const data=JSON.parse(document.getElementById('quiz-data').textContent);
  const scoreAnswers=/* scoreAnswers */;
  const start=document.getElementById('quiz-start'), form=document.getElementById('quiz-form');
  const field=document.getElementById('quiz-field'), progress=document.getElementById('quiz-progress');
  const back=document.getElementById('quiz-back'), next=document.getElementById('quiz-next');
  const result=document.getElementById('quiz-result'), error=document.getElementById('quiz-error');
  let index=0,answers=Array(10).fill(null),complete=false;
  function event(name) {
    if (window.kaguraGa4Allowed===true && typeof window.gtag==='function') window.gtag('event',name,{content_type:'kagura_quiz'});
  }
  function el(tag,text,cls) {const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
  function draw() {
    field.replaceChildren(); error.textContent='';
    progress.textContent=`${index+1}/10`;
    const q=data.questions[index],legend=el('legend',q.text);legend.tabIndex=-1;field.append(legend);
    q.choices.forEach(choice=>{
      const label=el('label',null,'quiz-choice'),radio=el('input');radio.type='radio';radio.name='answer';radio.value=choice.axis;radio.checked=answers[index]===choice.axis;
      radio.addEventListener('change',()=>{answers[index]=choice.axis;error.textContent='';next.disabled=false;});
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
    const heading=el('h2',scored.winners.length>1?'あなたは、いくつもの楽しみ方に惹かれています':'あなたが惹かれるのは…');heading.tabIndex=-1;result.append(heading);
    const ids=new Set();
    scored.winners.forEach(k=>{const a=data.axes[k];result.append(el('h3',a.label),el('p',a.reason));a.programs.forEach(id=>ids.add(id));});
    result.append(el('p','以下は公式の演目解説を参考に編集部が選んだ、石見神楽の演目の一例です。地域全体の特徴や、上演を保証するものではありません。','meta annotation'));
    ids.forEach(id=>{
      const p=data.programs[id];result.append(el('h3',p.name),el('p',p.text));
      const source=el('a','演目の公式解説');source.href=p.source;source.target='_blank';source.rel='noopener noreferrer';const note=el('p',null,'meta annotation');note.append(source);result.append(note);
    });
    const nowJst=new Date(Date.now()+9*3600e3).toISOString().slice(0,16);
    const matches=data.events.filter(e=>ids.has(e.program)&&e.start>nowJst);
    result.append(el('h3','この演目を予定している公演'));
    if(!matches.length)result.append(el('p','現在掲載中の該当公演はありません'));
    const seen=new Set();matches.forEach(e=>{
      if(seen.has(e.id))return;seen.add(e.id);
      const line=el('p'),link=el('a',`${e.start.slice(0,10)} ${e.name}`);link.href=`/events/${e.id}.html`;link.addEventListener('click',()=>event('quiz_event_click'));
      const proof=el('a','演目の掲載元');proof.href=e.source;proof.target='_blank';proof.rel='noopener noreferrer';line.append(link,el('br'),proof);result.append(line);
    });
    result.append(el('p','日程・出演演目は変更されることがあります。お出かけ前に公式情報をご確認ください。','meta annotation'));
    const search=el('a','ほかの公演を探す','btn');search.href='/calendar.html';search.addEventListener('click',()=>event('quiz_search_click'));
    const restart=el('button','もう一度診断する','btn ghost');restart.type='button';restart.addEventListener('click',begin);
    const actions=el('p',null,'quiz-actions');actions.append(search,restart);result.append(actions);heading.focus();event('quiz_complete');
  });
})();
