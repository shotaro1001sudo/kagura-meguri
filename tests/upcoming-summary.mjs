import { upcomingSummary, upcomingSummaryDescription } from '../scripts/lib/upcoming-summary.mjs';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import * as cheerio from 'cheerio';
export function upcomingSummaryTests({ok,section}) {
  section('庄内の直近日程: 既存掲載データ・広告前の導線');
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
  for(const [label,now,count] of [['before','2026-11-02T23:59',1],['during','2026-11-03T16:59',1],['expired','2026-11-04T00:00',0]]) {
    const out='dist-test-shonai-'+label;
    const r=spawnSync('node',['scripts/build.mjs'],{encoding:'utf8',env:{...process.env,BUILD_NOW:now,OUT_DIR:out}});
    ok(r.status===0,`JST ${label} build`,r.stderr);if(r.status)continue;
    const page=cheerio.load(readFileSync(out+'/kagura/庄内神楽.html','utf8'));
    ok(page('.upcoming-summary li').length===count,`JST ${label} の掲載数`);
    if(count){
      const summary=page('.upcoming-summary'),detail='/events/shonai-kagura-matsuri-2026.html';
      ok(summary.find('a').attr('href')===detail&&summary.text().includes('2026年11月3日')&&summary.text().includes('8:45〜')&&!summary.text().includes('08:45')&&summary.text().includes('17:00')&&summary.text().includes('由布市庄内総合運動公園'),'掲載データの日時・会場と詳細リンク');
      const description=page('meta[name=description]').attr('content');
      ok(description.includes('2026年11月3日')&&description.includes('8:45〜')&&!description.includes('08:45')&&description.includes('由布市庄内総合運動公園')&&!description.includes('11月〜'),'descriptionも同じ掲載日時・会場を使用');
      const ad=page('main a[rel~="sponsored"]').first()[0];
      ok(!!ad&&page('main *').toArray().indexOf(summary[0])<page('main *').toArray().indexOf(ad),'要約が最初の広告リンクより前');
      ok(readFileSync(out+detail,'utf8').includes('庄内神楽祭り'),'詳細リンク先存在');
    }
    const other=cheerio.load(readFileSync(out+'/kagura/広島神楽.html','utf8'));
    ok(other('.upcoming-summary').length===0,'他種類へ一括展開しない');
  }
}
