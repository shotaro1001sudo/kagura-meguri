import { readFileSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';

// Editorial manifest is separate from collected/submitted event data.
// No external image requests and no implicit permission from an event's source URL.
export function loadPerformancePhotos(manifest, records, today, root = 'assets/performance-photos') {
  if (!manifest || typeof manifest.publicationEnabled !== 'boolean' || !Array.isArray(manifest.photos)) throw Error('写真台帳の形式が不正です');
  if (!manifest.publicationEnabled && manifest.photos.length) throw Error('写真公開は停止中です。掲載方針の承認・見直しが必要です');
  const result = new Map();
  const text = v => typeof v === 'string' && v.trim().length > 0;
  const url = v => typeof v === 'string' && /^https:\/\/[^\s"'<>]+$/.test(v);
  for (const p of manifest.photos) {
    const key = `${p.kind}/${p.id}`;
    if (!['events', 'regular'].includes(p.kind) || !records[p.kind].some(r => r.id === p.id) || result.has(key)) throw Error(`写真の公演指定が不正: ${key}`);
    if (!/^[a-z0-9][a-z0-9-]*\.webp$/.test(p.file || '')) throw Error(`写真はローカルの WebP のみ: ${key}`);
    if (![p.alt, p.caption, p.credit, p.permission].every(text) || !url(p.sourceUrl) || !url(p.permissionUrl) || p.rightsConfirmed !== true) throw Error(`写真の出典・許諾確認が不足: ${key}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.checkedAt || '') || !Number.isFinite(Date.parse(p.checkedAt)) || new Date(p.checkedAt).toISOString().slice(0,10) !== p.checkedAt || p.checkedAt > today) throw Error(`写真の確認日が不正: ${key}`);
    if (!Number.isInteger(p.width) || !Number.isInteger(p.height) || p.width < 320 || p.width > 1200 || p.height < 200 || p.height > 1200) throw Error(`写真の寸法が不正: ${key}`);
    const path = realpathSync(resolve(root, p.file));
    if (!path.startsWith(realpathSync(root) + sep)) throw Error(`写真が素材ディレクトリ外です: ${key}`);
    const bytes = readFileSync(path);
    if (bytes.length > 100 * 1024 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw Error(`写真は100KB以下のWebPにしてください: ${key}`);
    result.set(key, { src: `/performance-photos/${p.file}`, width:p.width, height:p.height, alt:p.alt, caption:p.caption, credit:p.credit, sourceUrl:p.sourceUrl, permission:p.permission, permissionUrl:p.permissionUrl });
  }
  return result;
}

// Also serialized into the finder so static and filtered cards use identical media.
export function performancePhoto(photo) {
  if (!photo) return '';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return `<figure class="performance-photo"><img src="${esc(photo.src)}" width="${photo.width}" height="${photo.height}" alt="${esc(photo.alt)}" loading="lazy" decoding="async"><figcaption>${esc(photo.caption)}<span>写真: ${esc(photo.credit)} · <a href="${esc(photo.sourceUrl)}">出典</a> · <a href="${esc(photo.permissionUrl)}">${esc(photo.permission)}</a></span></figcaption></figure>`;
}
