import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRakutenStayResolver} from '../scripts/lib/rakuten-stay-issued.mjs';

export function rakutenStayIssuedTests({ok,section}) {
  section('楽天宿: 正式発行された宛先だけ完全一致で使用');
  const raw=readFileSync('data/rakuten-stay-issued.json'),rows=JSON.parse(raw);
  ok(createHash('sha256').update(raw).digest('hex')==='c5fcc3ec1d502f46c47f7ac6f553e9861a04df2d938fc564c911f73ea3ea8be4','本人管理画面の73件原本をバイト変更なしで保持');
  ok(rows.length===73&&rows.filter(r=>r.hasDate).length===67&&new Set(rows.map(r=>r.destination)).size===73,'67日付付き・6日付なしの73宛先が一意');
  const resolver=createRakutenStayResolver(rows);let fallbackCalls=0;
  for(const row of rows) {
    const actual=resolver.resolve(row.destination,()=>{fallbackCalls++;return 'unexpected';});
    ok(actual===row.href&&new URL(actual).searchParams.get('pc')===row.destination,'原本hrefと地域・宿泊日・人数・部屋数を保持: '+row.representativePage);
  }
  ok(fallbackCalls===0&&resolver.audit().verified.length===73&&resolver.audit().unverified.length===0,'73件全て発行URLを使い汎用IDに戻さない');
  const first=rows[0], changed=new URL(first.destination);changed.searchParams.set('f_hi1','30');
  const unknown=changed.href, legacy=d=>'https://example.invalid/?destination='+encodeURIComponent(d);
  ok(resolver.resolve(unknown,legacy)===legacy(unknown),'日付違いは元URLを再利用せず従来の未照合処理を維持');
  resolver.resolve(unknown,legacy);
  ok(resolver.audit().unverified.length===1&&resolver.audit().unverified[0]===unknown&&resolver.audit().verified.length===73,'未照合を照合済みにせず重複警告を集約');
  const reordered=first.destination.replace('charset=utf-8&','')+'&charset=utf-8';
  ok(resolver.resolve(reordered,legacy)===legacy(reordered),'パラメータ順を勝手に正規化せず完全一致以外は未照合');
  for(const mutation of [r=>({...r,href:r.href.replace('pc=','wrong=')}),r=>({...r,destination:unknown}),r=>({...r,hasDate:!r.hasDate}),r=>({...r,issuedAt:'unconfirmed'}),r=>({...r,href:r.href.replace('hb.afl.rakuten.co.jp','example.invalid')})]) {
    let rejected=false;try{createRakutenStayResolver([mutation(first)]);}catch{rejected=true;}
    ok(rejected,'宛先・発行証跡・配信元の不整合を拒否');
  }
  let duplicate=false;try{createRakutenStayResolver([first,first]);}catch{duplicate=true;}
  ok(duplicate,'重複する宛先を曖昧に上書きしない');
}
