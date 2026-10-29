// Deliberately narrow parsers for dated official notices. Unknown layouts fail closed.
import { visibleText } from '../lib/source-watch.mjs';
const pad = n => String(n).padStart(2,'0');
function date(y,m,d,time='00:00') {
  const day = `${y}-${pad(+m)}-${pad(+d)}`;
  const stamp = `${day}T${time}`;
  const parsed = new Date(stamp+':00Z');
  if (Number.isNaN(+parsed) || parsed.toISOString().slice(0,16)!==stamp) throw Error('不正な公演日時');
  return stamp;
}
const compact = t => t.replace(/\s/g,'');
export function parse(html, source, pageUrl=source.url) {
  const text = visibleText(html), t=compact(text);
  if (source.id==='hamamatsu-kawai-hanamai') {
    if (!t.includes('川合花の舞')) throw Error('川合花の舞の本文がありません');
    const m=t.match(/日程[:：](\d{4})年(\d{1,2})月(\d{1,2})日([^\n]*?)(?=場所[:：])/);
    if (!m) throw Error('明示された年付き日程・場所を検出できません');
    if (/中止|延期/.test(m[4])) return [];
    if (!t.includes('八坂神社') || !t.includes('佐久間町川合')) throw Error('会場変更のため確認が必要');
    // 「午後2時頃」は確定時刻とせず、日付のみ公開。説明に概時刻を手動確認して補う。
    return [{name:'川合花の舞', kagura:'湯立神楽', prefecture:'静岡県',city:'浜松市天竜区',venue:'八坂神社',
      start:date(+m[1],m[2],m[3]),timeUnknown:true,url:pageUrl}];
  }
  if(source.id==='iinan-kaguradan') {
    // The year must be in a schedule heading, never inferred from today's date/footer.
    const heads=[...String(html).normalize('NFKC').matchAll(/<h[1-6]\b[^>]*>\s*(\d{4})年\s*<\/h[1-6]>/gi)];
    if(heads.length!==1) throw Error('公演予定の年見出しが一意ではありません');
    const y=+heads[0][1];
    const upcoming=visibleText(String(html).slice(heads[0].index)).split('以下公演済み')[0];
    const starts=[...upcoming.matchAll(/(?:^|\n)\s*(\d{1,2})月(\d{1,2})日\s*\([^)]*\)\s*([^\n]+)/g)];
    if(!starts.length) throw Error('公演予定の日時行がありません');
    const items=[];
    for(let i=0;i<starts.length;i++) {
      const m=starts[i], block=upcoming.slice(m.index,starts[i+1]?.index ?? upcoming.length);
      if(/一般観覧不可|非公開|中止|延期/.test(block)) continue;
      const place=block.match(/場所[:：]\s*([^\n]+)/)?.[1]?.trim();
      const rawTime=block.match(/時間[:：]\s*([^\n]+)/)?.[1]?.trim();
      // A troupe appearance inside a festival is not the festival's opening time.
      if(!place || /未定/.test(place) || !rawTime || /飯南は|頃|ごろ|未定|、/.test(rawTime)) continue;
      const tm=rawTime.match(/(?:開演\s*)?(\d{1,2}):(\d{2})(?:\s*開演|\s*[～〜~]|$)/);
      if(!tm) continue;
      let city='', prefecture='', venue=place, address='';
      const mappings=[
        [/飯南町|赤名農村環境改善センター/,'島根県','飯南町'],
        [/雲南市/,'島根県','雲南市'],
        [/浜田市/,'島根県','浜田市'],
        [/三次市/,'広島県','三次市'],
        [/安来市/,'島根県','安来市'],
        [/奥出雲町/,'島根県','奥出雲町']
      ];
      const loc=mappings.find(([re])=>re.test(place));
      if(!loc) continue; // Do not guess the prefecture from the troupe's home town.
      [,prefecture,city]=loc;
      const parts=place.split(/\s+/); if(parts.length>1){venue=parts.at(-1);address=parts.slice(0,-1).join(' ');}
      let name=m[3].trim(); if(!/神楽/.test(name)) name+='（飯南神楽団）';
      items.push({name,kagura:'飯南神楽',prefecture,city,venue,...(address?{address}:{}),
        start:date(y,m[1],m[2],`${pad(+tm[1])}:${tm[2]}`),url:pageUrl});
    }
    return items;
  }
  throw Error('未対応の全国収集元');
}
