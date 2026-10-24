// PLAN-004: 編集上のおすすめ。性格・適性の診断ではない。回答はブラウザ内のみ。
export const QUIZ_CHECKED = '2026-10-25';
export const questions = [
  ['最初に目を奪われる一場面は？', ['大きく躍動する舞','面や衣装の細部','登場人物が向き合う場面','舞台全体の静かな佇まい']],
  ['好きな舞の動きは？', ['勢いのある動き','衣装の動きまで眺めたい','人物の気持ちが伝わる動き','ゆっくり丁寧な動き']],
  ['登場人物のどこが気になる？', ['力強い立ち回り','面の造形','役柄や関係','登場すると変わる空気']],
  ['物語で惹かれる展開は？', ['手に汗握る対決','華やかな場面転換','人物の選択や成長','不思議な出来事との出会い']],
  ['心が動く音の雰囲気は？', ['勢いあるリズム','場面ごとの音色の変化','物語を想像できる掛け合い','余韻を味わう響き']],
  ['面や衣装のどこを見たい？', ['動いた時の迫力','模様や細かな装飾','役柄を表す工夫','舞台全体との調和']],
  ['観覧で大切にしたい体験は？', ['舞の勢いを感じる','姿をじっくり眺める','物語を理解する','場の雰囲気に浸る']],
  ['多彩な演目からどう選びたい？', ['動きの変化で選ぶ','面や衣装の違いで選ぶ','物語のつながりで選ぶ','余韻を楽しめるものを選ぶ']],
  ['観終わった後に欲しい気持ちは？', ['胸が高鳴る','美しい姿を覚えていたい','誰かに物語を話したい','静かに余韻に浸りたい']],
  ['最後にもう一度観たい一場面は？', ['躍動する舞','印象的な面や衣装','人物が決断する場面','神秘的な佇まい']]
].map(([text,labels],i)=>({text,choices:labels.map((label,j)=>({label,axis:['P','V','S','R'][j]})).slice(i%4).concat(labels.map((label,j)=>({label,axis:['P','V','S','R'][j]})).slice(0,i%4))}));

export const axes = {
  P:{label:'迫力・躍動',reason:'勢いのある動きや立ち回りを選んだ回答が多くありました。',programs:['orochi']},
  V:{label:'面や衣装の視覚的な魅力',reason:'姿や造形、見た目の変化を眺めたいという回答が多くありました。',programs:['orochi']},
  S:{label:'物語・人物',reason:'人物の関係や物語の展開を楽しみたいという回答が多くありました。',programs:['iwado']},
  R:{label:'静けさ・神秘的な雰囲気',reason:'丁寧な動きや余韻、場の雰囲気を味わう回答が多くありました。',programs:['shioharai']}
};
export const programs = {
  orochi:{name:'大蛇（石見神楽）',text:'大きな蛇胴の動きと対決が見どころ。動きや姿に注目して観る演目の一例です。',source:'https://iwamikagura.jp/enmoku/orochi/'},
  iwado:{name:'岩戸（石見神楽）',text:'岩戸に隠れた天照大御神を迎え出す、神々の工夫を描く物語です。',source:'https://iwamikagura.jp/enmoku/iwado/'},
  shioharai:{name:'塩祓（石見神楽）',text:'神々を迎えるために場を清める儀式の舞。所作と場の意味に目を向ける入口として選びました。',source:'https://iwamikagura.jp/enmoku/shioharai/'}
};
// タイトルの語句一致で推測せず、当該公演の公式演目を確認した対応のみ。
export const programEvents = [{program:'iwado',id:'npo-hiroshima-aa5a8fc7cf',day:'2026-11-08',source:'https://mitocho-kankou.jp/page2140/'}];

export function scoreAnswers(answers) {
  if (!Array.isArray(answers)||answers.length!==10||Array.from(answers).some(a=>!['P','V','S','R'].includes(a))) return null;
  const counts={P:0,V:0,S:0,R:0};
  answers.forEach(a=>counts[a]++);
  const max=Math.max(...Object.values(counts));
  return {counts,winners:Object.keys(counts).filter(k=>counts[k]===max)};
}
