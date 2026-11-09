import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import * as cheerio from 'cheerio';
const read = p => readFileSync(p, 'utf8');
const rows = JSON.parse(read('data/events.json'));
// このテストが確かめるのは、最初に登録した東京都の3件(時間帯が複数ある回と、終了時刻のある回)。後から足した東京都の開催は対象外
const ORIGINAL = ['ookunitama-torinoichi-20261107', 'ookunitama-torinoichi-20261119', 'okachimachi-furusato-nanbu-20261129'];
const allTokyo = rows.filter(e => e.prefecture === '東京都');
const tokyo = allTokyo.filter(e => ORIGINAL.includes(e.id));
assert.equal(tokyo.length, 3);
assert.equal(new Set(tokyo.map(e => e.id)).size, 3);
assert.deepEqual(tokyo.map(e => e.start), ['2026-11-07T15:00', '2026-11-19T15:00', '2026-11-29T17:30']);
const dir = mkdtempSync(join(tmpdir(), 'kagura-tokyo-'));
const build = now => {
  const r = spawnSync(process.execPath, ['scripts/build.mjs'], {encoding:'utf8', env:{...process.env, OUT_DIR:dir, BUILD_NOW:now}});
  assert.equal(r.status, 0, r.stderr);
};
try {
  build('2026-11-02T09:00');
  const lite = JSON.parse(read(join(dir,'events.json')));
  for (const e of tokyo) {
    const html = read(join(dir,`events/${e.id}.html`)), $ = cheerio.load(html);
    const ld = JSON.parse($('script[type="application/ld+json"]').first().text());
    const event = (Array.isArray(ld) ? ld : [ld]).find(x => x['@type'] === 'Event');
    assert(event);
    assert.equal(event.location.address.addressRegion, '東京都');
    assert.equal(event.startDate, e.start+'+09:00');
    assert.equal(event.location.geo.latitude, e.lat);
    assert.equal($('table.info').text().includes('予約要否未確認'), true);
    assert(!html.includes('adsbygoogle.js'));
    assert.equal($('.stay').length, 0, 'Do not generate new lodging affiliate destinations for these listings');
    if (e.sessions) {
      assert.equal(e.end, undefined);
      assert.equal(event.endDate, undefined);
      assert.equal(event.isAccessibleForFree, undefined);
      assert.deepEqual(lite.find(x=>x.id===e.id).sessions, ['15:00','17:00','19:00']);
      for (const time of e.sessions) assert($('table.info').text().includes(time));
      assert($('main').text().includes('終了時刻は未確認'));
      assert(!e.venue.includes('神楽殿'));
    } else {
      assert.equal(event.endDate, '2026-11-29T18:00+09:00');
      assert.equal(event.isAccessibleForFree, true);
      assert.equal(e.reservationStatus, 'unknown');
    }
  }
  const pref = cheerio.load(read(join(dir,'pref/東京都.html')));
  for (const e of tokyo) assert.equal(pref(`.card a[href="/events/${e.id}.html"]`).length, 1);
  // Exercise the actual search script: Tokyo filter, all sessions, and one day only.
  const dom = new JSDOM(read(join(dir,'calendar.html')), {url:'https://kagurameguri.jp/calendar.html?pref='+encodeURIComponent('東京都'),runScripts:'outside-only'});
  dom.window.fetch = async () => ({ok:true,json:async()=>lite});
  const script = [...dom.window.document.scripts].find(s=>s.textContent.includes("var f=document.getElementById('finder')"));
  dom.window.eval(script.textContent);
  await new Promise(r=>setTimeout(r,0));
  const d=dom.window.document;
  assert.equal(d.querySelectorAll('#results li').length,allTokyo.length);
  assert(d.querySelector('#results').textContent.includes('15:00・17:00・19:00'));
  assert(d.querySelector('#results').textContent.includes('17:30〜18:00'));
  d.querySelector('[data-w="range"]').click();
  for (const id of ['from','to']) {d.getElementById(id).value='2026-11-19'; d.getElementById(id).dispatchEvent(new dom.window.Event('change'));}
  assert.equal(d.querySelectorAll('#results li').length,1);
  assert(d.querySelector('#results a').href.endsWith('/events/ookunitama-torinoichi-20261119.html'));
  dom.window.close();
  // Run the real map code against a Leaflet test double, capturing marker coordinates/popups.
  const mapDom = new JSDOM(read(join(dir,'map.html')), {url:'https://kagurameguri.jp/map.html',runScripts:'outside-only'});
  const w=mapDom.window, markers=[];
  const map={setView(){return this},on(){},fitBounds(){},scrollWheelZoom:{enable(){},disable(){}},dragging:{enable(){},disable(){}}};
  w.L={map:()=>map,tileLayer:()=>({addTo(){}}),divIcon:x=>x,marker:(coords)=>({addTo(){return this},bindPopup(html){markers.push({coords,html});return this}})};
  w.fetch=async url=>({ok:true,json:async()=>url.includes('regular')?[]:lite});
  w.eval(read('scripts/client/map.js'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  await new Promise(r=>setTimeout(r,0));
  for (const e of tokyo) {
    const marker=markers.find(m=>m.html.includes(e.id)); assert(marker);
    assert.equal(JSON.stringify(marker.coords), JSON.stringify([e.lat,e.lng]));
    for (const time of e.sessions || ['17:30','18:00']) assert(marker.html.includes(time));
  }
  mapDom.window.close();
  // The 19:00 session must remain listed after the first session's three-hour window.
  build('2026-11-07T18:30');
  assert(JSON.parse(read(join(dir,'events.json'))).find(x=>x.id===tokyo[0].id).up);
  build('2026-11-08T00:01');
  assert(!JSON.parse(read(join(dir,'events.json'))).find(x=>x.id===tokyo[0].id).up);
  console.log('Tokyo events: 3 dates, details/schema, search/date filter, map coordinates/sessions, late-session visibility passed.');
} finally {rmSync(dir,{recursive:true,force:true});}
