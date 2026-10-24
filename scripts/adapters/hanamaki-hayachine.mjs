// 無効状態の情報源を検証するための候補アダプタ。実HTML/robots/利用条件の検証前に有効化しない。
import * as cheerio from 'cheerio';
import { clean, parseJaDate } from '../lib/util.mjs';

const norm = (s) => clean(String(s ?? '').normalize('NFKC'));
const titleOK = (s) => /^おおはさま神楽の日/.test(s) && !/企画展|展示|中止/.test(s);
function canonical(raw, source) {
  const u = new URL(raw, source.url), base = new URL(source.url);
  if (u.origin !== base.origin || u.username || u.password || u.pathname !== '/event/event_detail.php' || !/^\d+$/.test(u.searchParams.get('id') ?? '')) return null;
  return `${u.origin}${u.pathname}?id=${u.searchParams.get('id')}`;
}
export function monthUrls(source, now = new Date()) {
  const d = new Date(now.getTime() + 9 * 3600e3);
  return Array.from({ length: 3 }, (_, i) => {
    const u = new URL('/event/', source.url);
    u.searchParams.set('m', String((d.getUTCMonth() + i) % 12 + 1));
    return u.href;
  });
}
export function discover(html, source) {
  const $ = cheerio.load(html), links = new Set();
  $('a[href]').each((_, a) => {
    if (!titleOK(norm($(a).text()))) return;
    const url = canonical($(a).attr('href'), source);
    if (url) links.add(url);
  });
  if (!links.size || links.size > 12) throw new Error('花巻: 対象記事リンクが0件または上限超過。構造の再確認が必要');
  return [...links];
}
function field($, label) {
  const values = [];
  $('dt').each((_, el) => { if (norm($(el).text()) === label) values.push(norm($(el).next('dd').text())); });
  $('tr').each((_, el) => {
    const cells = $(el).children('th,td');
    if (cells.length === 2 && norm(cells.first().text()) === label) values.push(norm(cells.last().text()));
  });
  const unique = [...new Set(values.filter(Boolean))];
  if (unique.length > 1) throw new Error(`花巻: ${label}が複数あります`);
  return unique[0] || '';
}
function times(raw) {
  // 開場・休憩を開演/終演と取り違えない。時刻欄の括弧の前だけを採用。
  const s = norm(raw).split(/[（(]/)[0];
  const found = [...s.matchAll(/(午前|午後)?\s*(\d{1,2})(?:時\s*(?:(\d{1,2})分)?|:(\d{2}))/g)];
  if (!s) return [];
  if (!found.length || found.length > 2) throw new Error('花巻: 時刻が不明確');
  return found.map((m) => {
    let h = +m[2], min = +(m[3] || m[4] || 0);
    if (m[1] && (h < 1 || h > 12)) throw new Error('花巻: 午前午後の時刻が不正');
    if (m[1]) h = h % 12 + (m[1] === '午後' ? 12 : 0);
    if (h > 23 || min > 59) throw new Error('花巻: 時刻が不正');
    return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
  });
}
export function parse(html, source, pageUrl) {
  if (!canonical(pageUrl, source)) return [];
  const $ = cheerio.load(html);
  const titles = [...new Set($('h1,h2,h3').map((_, el) => norm($(el).text())).get().filter(titleOK))];
  if (titles.length !== 1) throw new Error('花巻: 対象公演の見出しが一意ではありません');
  const day = field($, '開催日');
  // 年は詳細の開催日欄で明示されたものだけ。月別ページや現在年から補わない。
  if (!/^(?:\d{4}年|令和(?:元|\d{1,2})年)\s*\d{1,2}月\s*\d{1,2}日[^\d]*$/.test(day)) throw new Error('花巻: 年付き単一開催日ではありません');
  const date = parseJaDate(day);
  if (!date || new Date(date.start + ':00Z').toISOString().slice(0,10) !== date.start.slice(0,10)) throw new Error('花巻: 存在しない開催日');
  const ts = times(field($, '開催時間')), address = field($, '住所');
  if (!address) throw new Error('花巻: 会場住所がありません');
  const start = date.start.slice(0,10) + 'T' + (ts[0] || '00:00');
  const end = ts[1] ? date.start.slice(0,10) + 'T' + ts[1] : undefined;
  if (end && end < start) throw new Error('花巻: 終演が開演より前です');
  return [{ name: titles[0], prefecture: '岩手県', city: '花巻市', venue: address.split(/[（(]/)[0], address,
    kagura: titles[0].match(/(?:岳|大償|八木巻)神楽/)?.[0] || source.kagura,
    start, ...(end ? {end} : {}), ...(!ts.length ? {timeUnknown:true} : {}), fee:field($,'料金').slice(0,80), url:canonical(pageUrl,source) }];
}
