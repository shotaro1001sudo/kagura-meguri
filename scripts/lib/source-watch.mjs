// Store only fingerprints and source URLs, never copies of articles or photographs.
import { createHash } from 'node:crypto';

export function visibleText(html) {
  return String(html).replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|nav|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<br\b[^>]*>|<\/(?:p|div|h[1-6]|tr|li|section|article)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Math.min(parseInt(n,16),0x10ffff)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(+n,0x10ffff)))
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .normalize('NFKC').replace(/[\t \u200b]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();
}

export function fingerprint(html, url) {
  const text = visibleText(html);
  if (text.length < 30 || /^(Access Denied|Forbidden|Just a moment)/i.test(text)) throw Error('本文を検出できません');
  const links = [...String(html).matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)].flatMap(m => {
    try { const u = new URL(m[1].replace(/&amp;/g,'&'),url); u.hash='';
      // Ignore trackers/navigation. Retain linked schedules/media URLs (not their contents).
      return /^https?:$/.test(u.protocol) && !/facebook|twitter|google|doubleclick|cdn-cgi|login|share|mailto/i.test(u.href) ? [u.href] : [];
    } catch { return []; }
  });
  const unique = [...new Set(links)].sort();
  const digest = createHash('sha256').update(text+'\n'+unique.join('\n')).digest('hex');
  return { url, digest, linkCount: unique.length };
}

export function recordWatch(previous, snapshots, source, date) {
  const digest = createHash('sha256').update(JSON.stringify(snapshots)).digest('hex');
  return { sourceId: source.id, url: source.url, digest, checked: date,
    changed: previous?.digest === digest ? previous.changed : date,
    reviewedDigest: previous?.reviewedDigest ?? '',
    pending: previous?.reviewedDigest !== digest,
    pages: snapshots, reason: source.reviewReason || '掲載情報・日程・公開可否の確認待ち' };
}
