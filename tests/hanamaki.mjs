import { discover, parse, monthUrls } from '../scripts/adapters/hanamaki-hayachine.mjs';
import { guardEvent } from '../scripts/lib/collect-core.mjs';

export function hanamakiTests({ok,section}) {
  section('花巻候補: 合成HTMLの安全検査（実HTML未検証）');
  const s={url:'https://www.kanko-hanamaki.ne.jp/event/',kagura:'早池峰神楽'};
  const url=s.url+'event_detail.php?id=1060';
  const html=(day='2026年11月8日(日)',time='午前11時 から 午後3時 まで（午前10時開場、正午から午後1時休憩）')=>`<h3>おおはさま神楽の日【11月 大償神楽】</h3><p>掲載日2026年10月1日</p><dl><dt>開催日</dt><dd>${day}</dd><dt>開催時間</dt><dd>${time}</dd><dt>住所</dt><dd>花巻市大迫交流活性化センター（岩手県花巻市大迫町）</dd><dt>電話</dt><dd>連絡先は抽出しない</dd></dl>`;
  const reject=(fn)=>{try{fn();return false}catch{return true}};
  const links=discover(`<a href="event_detail.php?id=1060&m=11">おおはさま神楽の日</a><a href="event_detail.php?id=1060">おおはさま神楽の日</a><a href="https://other.example/event/event_detail.php?id=4">おおはさま神楽の日</a><a href="event_detail.php?id=5">神楽の企画展</a>`,s);
  ok(links.length===1&&links[0]===url,'対象公演・同一オリジンのみ、月パラメータ違いの重複を除く');
  ok(reject(()=>discover('<p>構造変更</p>',s))&&reject(()=>discover(Array.from({length:13},(_,i)=>`<a href="event_detail.php?id=${i}">おおはさま神楽の日</a>`).join(''),s)),'リンク0件・13件以上は停止');
  const e=parse(html(),s,url)[0];
  ok(e.start==='2026-11-08T11:00'&&e.end==='2026-11-08T15:00','開場10時・休憩13時と開演11時/終演15時を混同しない');
  ok(e.venue==='花巻市大迫交流活性化センター'&&e.kagura==='大償神楽'&&e.fee===''&&!JSON.stringify(e).includes('連絡先'),'会場・出演神楽の分類だけを抽出、連絡先や本文を含めない');
  ok(parse(html(),s,'https://other.example/event/event_detail.php?id=1060').length===0,'他オリジンの詳細は読み取らない');
  const past=parse(html('2023年11月12日(日)'),s,url)[0];
  ok(past.start.startsWith('2023-11-12')&&guardEvent(past,{now:new Date('2026-10-25T00:00Z')}).includes('すでに終わった日付'),'詳細の2023年を現在年へ読み替えず、過去公演として除外対象にする');
  ok(reject(()=>parse(html('11月8日'),s,url))&&reject(()=>parse(html('2026年11月8日・15日'),s,url)),'年なし・複数日の欄は停止');
  ok(reject(()=>parse(html('2026年2月31日'),s,url))&&reject(()=>parse(html('2026年13月1日'),s,url)),'存在しない開催日は停止');
  ok(reject(()=>parse(html('2026年11月8日','午後3時から午前11時'),s,url))&&reject(()=>parse(html('2026年11月8日','25:00'),s,url)),'逆転時刻・24時以降を停止');
  ok(parse(html('2026年11月8日',''),s,url)[0].timeUnknown===true,'時刻未発表は時間未定にする');
  ok(reject(()=>parse(html().replace('<dt>開催日</dt>','<dt>投稿日</dt>'),s,url)),'開催日ラベルなしは投稿日へフォールバックしない');
  ok(reject(()=>parse(html()+'<dl><dt>開催日</dt><dd>2026年11月15日</dd></dl>',s,url)),'異なる開催日欄が混在した場合は停止');
  ok(monthUrls(s,new Date('2026-12-31T18:00:00Z')).map(u=>new URL(u).searchParams.get('m')).join()==='1,2,3','JSTの日付で年越し3か月を列挙し、掲載年は推測しない');
}
