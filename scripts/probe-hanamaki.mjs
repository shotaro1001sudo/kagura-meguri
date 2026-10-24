// read-only: robots検査後に最大3月/12記事を取得。公開データ・設定・レポートを一切書き換えない。
import { readFileSync } from 'node:fs';
import { discover, parse, monthUrls } from './adapters/hanamaki-hayachine.mjs';
import { robotsAllows, sleep } from './lib/util.mjs';
import { guardEvent, sameEvent } from './lib/collect-core.mjs';

const source = JSON.parse(readFileSync('data/sources.json','utf8')).find(s=>s.id==='hanamaki-hayachine');
const cfg = JSON.parse(readFileSync('config.json','utf8'));
const known = [...JSON.parse(readFileSync('data/events.json','utf8')), ...JSON.parse(readFileSync('data/regular.json','utf8'))];
const ua = `KaguraMeguriBot/1.0 (+${cfg.baseUrl}/contact.html)`, now = new Date();
async function get(url) {
  const allow = await robotsAllows(url,ua);
  if (!allow.ok) throw new Error('花巻: robots確認不可/禁止。取得を停止');
  await sleep(3000);
  const r = await fetch(url,{headers:{'user-agent':ua},signal:AbortSignal.timeout(15000),redirect:'error'});
  if (!r.ok) throw new Error(`花巻: HTTP ${r.status}`);
  return r.text();
}
try {
  const links = new Set();
  for (const url of monthUrls(source,now)) for (const link of discover(await get(url),source)) links.add(link);
  if (links.size>12) throw new Error('花巻: 合計記事数が上限を超過');
  const candidates = [];
  for (const link of links) candidates.push(...parse(await get(link),source,link));
  console.log(JSON.stringify({readOnly:true,enabled:source.enabled,termsChecked:source.termsChecked,
    candidates:candidates.map(e=>({ ...e, guard:guardEvent(e,{now}),duplicate:known.some(k=>k.url===e.url||k.start&&sameEvent(k,e)) }))},null,2));
} catch { console.error('花巻dry-run失敗: 通信・robots・HTMLを確認してください。公開データ変更なし。'); process.exitCode=1; }
