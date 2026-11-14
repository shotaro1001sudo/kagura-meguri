import { upcomingSummary, upcomingSummaryDescription } from '../scripts/lib/upcoming-summary.mjs';
import * as cheerio from 'cheerio';
export function upcomingSummaryTests({ok,section}) {
  section('直近の開催の要約(共通の部品)');
  const items=Array.from({length:4},(_,i)=>({id:'event-'+i,name:'公演'+i,start:'2026-11-03T08:45',venue:'会場'+i}));
  const before=JSON.stringify(items),h=cheerio.load(upcomingSummary(items,{formatWhen:e=>e.start}));
  ok(h('li').length===3 && h('li a').map((_,a)=>h(a).attr('href')).get().join()==='/events/event-0.html,/events/event-1.html,/events/event-2.html','同日も共有パイプラインの順序を維持し最大3件');
  ok(JSON.stringify(items)===before,'入力の並びや内容を変更しない');
  const empty=cheerio.load(upcomingSummary([],{formatWhen:()=>''}));
  ok(empty('a').length===0&&empty('section').text().includes('開催予定はありません'),'0件でも開催日を作らない');
  ok(upcomingSummaryDescription([],{formatWhen:()=>''}).includes('開催予定はありません'),'空のdescriptionに架空日程を出さない');
  const unsafe=cheerio.load(upcomingSummary([{id:'safe',name:'<script>危険</script>',venue:'<会場>'}],{formatWhen:()=>'<時刻>'}));
  ok(unsafe('script').length===0&&unsafe('li').text().includes('<会場>'),'データ値をHTMLエスケープ');
  const missing=cheerio.load(upcomingSummary([{id:'unknown',name:'公演'}],{formatWhen:()=> '2026年11月3日（時間は公式情報をご確認ください）'}));
  ok(missing('li').text().includes('時間は公式情報をご確認ください')&&missing('li').text().includes('会場：未確認'),'時間/会場未確定を捏造しない');
}
