// 編集上の提案。回答はブラウザのメモリ内のみ。根拠は既存解説のフィールドを参照。
export const QUIZ_CHECKED = '2026-10-26';
const choice = (id, label, features = []) => ({ id, label, features });
const unknown = choice('unknown', 'まだ分からない');
const preference = (id, text, choices) => ({ id, text, type: 'preference', choices: [...choices, unknown] });
export const questions = [
  preference('attention','最初に目を向けたいのは？', [choice('movement','大きな動き',['movement']),choice('visual','面や衣装',['mask','costume']),choice('story','登場人物',['story']),choice('ritual','祭りや奉納の様子',['ritual'])]),
  preference('pace','気になる舞の動きは？',[choice('fast','速くダイナミック',['movement']),choice('slow','ゆったり、細部まで',['slow']),choice('both','どちらも',['movement','slow'])]),
  preference('scene','見てみたい場面は？',[choice('battle','対決や立ち回り',['battle']),choice('story','登場人物のやり取り',['story']),choice('change','姿が変わる場面',['change']),choice('ritual','神を迎える・送る儀式',['ritual'])]),
  preference('story','物語はどう楽しみたい？',[choice('synopsis','あらすじを知って観たい',['story']),choice('sensory','動きや音から感じたい',['gesture','music']),choice('both','どちらも',['story','gesture','music'])]),
  preference('detail','じっくり見聞きしたいのは？',[choice('mask','面の表情や造形',['mask']),choice('costume','衣装の細工',['costume']),choice('gesture','舞い手の所作',['gesture']),choice('music','囃子や楽器',['music'])]),
  {...preference('help','初めて観るとき、あるとうれしい案内は？',[choice('highlights','見どころの案内'),choice('synopsis','あらすじ'),choice('history','地域の歴史'),choice('watch','まずはそのまま観たい')]), explanationOnly:true},
  preference('feeling','観終わったあとに味わいたいのは？',[choice('excited','胸が高鳴る気持ち',['movement']),choice('beauty','姿の美しさの余韻',['mask','costume']),choice('story','誰かに物語を話したい気持ち',['story']),choice('culture','地域の文化に触れた実感',['ritual'])]),
  {id:'region',type:'region',text:'探したい地域は？(任意)',choices:[choice('unknown','まだ決めていない'),choice('all','全国から探す')]},
  {id:'date',type:'date',text:'いつ観に行きたい？(任意)',choices:[choice('unknown','まだ決めていない'),choice('specified','日付を指定する'),choice('month','今月'),choice('next','来月')]},
  {id:'budget',type:'condition',text:'観覧に使いたい時間は？(任意)',choices:[choice('unknown','まだ決めていない'),choice('short','短時間(2時間以内を目安)'),choice('half','半日ほど(4時間以内を目安)'),choice('long','長時間も検討できる')]}
];
export const features = {movement:'大きな動き',slow:'ゆったりした舞',mask:'面',costume:'衣装',story:'物語',ritual:'祭り・奉納',battle:'対決',change:'姿の変化',gesture:'所作',music:'囃子'};
// [特徴, kagura-info.json 内の根拠フィールド]。複数特徴を持てるが根拠のない特徴は加えない。
export const traditions = [
  {kind:'石見神楽',evidence:[['movement','features.0'],['mask','features.2'],['costume','features.2'],['music','features.1'],['battle','programs.1.text'],['story','intro'],['ritual','programs.0.text']]},
  {kind:'広島神楽',evidence:[['change','features.1'],['story','programs.1.text'],['movement','features.0'],['slow','features.2'],['ritual','features.2']]},
  {kind:'御嶽神楽',evidence:[['movement','features.1'],['music','features.1'],['ritual','features.2'],['story','programs.1.text']]},
  {kind:'伊勢大神楽',evidence:[['movement','programs.1.text'],['ritual','features.0']]},
  {kind:'遠山の霜月祭',evidence:[['mask','intro'],['ritual','intro']]},
  {kind:'花祭',evidence:[['mask','features.0'],['ritual','features.0'],['story','programs.2.text']]},
  {kind:'備中神楽',evidence:[['story','features.1'],['ritual','features.0'],['movement','programs.1.text']]},
  {kind:'秩父神楽',evidence:[['story','features.0'],['ritual','features.1']]},
  {kind:'相模里神楽',evidence:[['mask','intro'],['story','features.0'],['gesture','features.0'],['music','features.0']]},
  {kind:'高千穂神楽',evidence:[['slow','programs.2.text'],['ritual','features.3'],['story','programs.0.text']]},
  {kind:'銀鏡神楽',evidence:[['mask','features.1'],['ritual','intro']]},
  {kind:'保呂羽山の霜月神楽',evidence:[['ritual','features.0'],['gesture','features.1']]}
];
// ブラウザにも同じ関数を埋め込み、採点・期限判定の別実装を作らない。
export function quizEngine(questions, traditions) {
  function scoreAnswers(answers) {
    if(!Array.isArray(answers)||answers.length!==questions.length)return null;
    const scores={}, reasons={};
    for(let i=0;i<questions.length;i++) {
      const q=questions[i]; if(q.type!=='preference')continue;
      const c=q.choices.find(c=>c.id===answers[i]);if(!c)return null;
      if(q.explanationOnly)continue;
      for(const f of c.features){scores[f]=(scores[f]||0)+1/c.features.length;(reasons[f]??=[]).push(c.label);}
    }
    const ranked=traditions.map((t,order)=>{const matched=t.evidence.filter(e=>scores[e.feature]>0);return {...t,order,matched,score:matched.reduce((n,e)=>n+scores[e.feature],0)};}).filter(t=>t.score>0).sort((a,b)=>Math.abs(b.score-a.score)>1e-9?b.score-a.score:a.order-b.order);
    return {scores,reasons,ranked:ranked.slice(0,3),tied:ranked.some((t,i)=>i>0&&i<=3&&Math.abs(t.score-ranked[i-1].score)<1e-9)};
  }
  const stamp=s=>Date.parse(s+':00Z'); // JST壁時計を比較用の同じ軸へ置く。OS timezone非依存。
  function upcoming(e,now) {
    if(e.timeUnknown)return (e.end||e.start).slice(0,10)>=now.slice(0,10);
    return (e.end?stamp(e.end):stamp(e.start)+3*3600e3)>=stamp(now);
  }
  function range(mode,date,now) {
    if(mode==='specified')return validDate(date)?[date,date]:null;
    if(mode!=='month'&&mode!=='next')return null;
    const d=new Date(now.slice(0,10)+'T00:00:00Z');if(mode==='next')d.setUTCMonth(d.getUTCMonth()+1,1);else d.setUTCDate(1);
    const start=d.toISOString().slice(0,10);d.setUTCMonth(d.getUTCMonth()+1,0);return [start,d.toISOString().slice(0,10)];
  }
  function validDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s||'')&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;}
  function duration(e,budget) {
    // 開催時間枠と必要観覧時間は別。長時間・複数回・日またぎは適合を断定しない。
    if(e.timeUnknown||!e.end||e.sessions?.length||e.start.slice(0,10)!==e.end.slice(0,10))return '所要時間は要確認';
    const minutes=(stamp(e.end)-stamp(e.start))/60000;
    if(minutes<=0)return '所要時間は要確認';
    if(budget==='short'||budget==='half')return minutes<=(budget==='short'?120:240)?`掲載時間枠は${minutes}分(観覧方法は要確認)`:'希望より長い開催時間枠です。途中観覧の可否は要確認';
    return `掲載時間枠は${minutes}分(必要な観覧時間とは限りません)`;
  }
  function selectEvents(events,kinds,conditions,now) {
    const dates=range(conditions.date,conditions.day,now),seen=new Set();
    return events.filter(e=>{if(seen.has(e.id)||!kinds.includes(e.kind)||!upcoming(e,now))return false;seen.add(e.id);return (!conditions.region||['all','unknown'].includes(conditions.region)||e.prefecture===conditions.region)&&(!dates||(e.start.slice(0,10)<=dates[1]&&(e.end||e.start).slice(0,10)>=dates[0]));}).sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
  }
  return {scoreAnswers,upcoming,range,validDate,duration,selectEvents};
}
