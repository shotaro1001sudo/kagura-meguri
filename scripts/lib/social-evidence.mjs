// No network access: a maintainer records facts after reading a public primary post.
export const SOCIAL_LABELS = { x: 'X（Twitter）', instagram: 'Instagram', facebook: 'Facebook' };
export function socialPlatform(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    for (const [platform, domains] of Object.entries({ x: ['x.com', 'twitter.com', 't.co'], instagram: ['instagram.com', 'instagr.am'], facebook: ['facebook.com', 'fb.com', 'fb.watch'] })) {
      if (domains.some(d => host === d || host.endsWith('.' + d))) return platform;
    }
  } catch { /* Not a URL. */ }
  return null;
}
export function safeHttps(value) {
  if (typeof value !== 'string' || !/^https:\/\/[^\s"'<>\\]+$/.test(value)) return false;
  try { const u = new URL(value); return !u.username && !u.password && !u.port; } catch { return false; }
}
export function isSocialPost(value) {
  if (!safeHttps(value)) return false;
  const u = new URL(value), host = u.hostname.replace(/^(www|m|mobile)\./, ''), path = u.pathname;
  if (['x.com', 'twitter.com'].includes(host)) return /^\/[A-Za-z0-9_]+\/status\/\d+\/?$/.test(path);
  if (host === 'instagram.com') return /^\/(p|reel)\/[A-Za-z0-9_-]+\/?$/.test(path);
  if (host === 'facebook.com') return /^\/[^/]+\/posts\/[A-Za-z0-9]+\/?$/.test(path) || /^\/events\/\d+\/?$/.test(path) ||
    (['/permalink.php', '/story.php'].includes(path) && /^[A-Za-z0-9]+$/.test(u.searchParams.get('story_fbid') ?? '') && /^\d+$/.test(u.searchParams.get('id') ?? ''));
  return false; // Profiles, shares, short URLs, stories and login redirects are not evidence.
}
export function socialPostKey(value) {
  if (!isSocialPost(value)) return null;
  const u = new URL(value), parts = u.pathname.split('/').filter(Boolean), platform = socialPlatform(value);
  if (platform === 'x') return `x:${parts.at(-1)}`;
  if (platform === 'instagram') return `instagram:${parts[1]}`;
  return `facebook:${u.searchParams.get('story_fbid') ?? parts.at(-1)}`;
}
export const isSocialEvent = e => !!(e.socialEvidence || socialPlatform(e.url) || socialPlatform(e.sourceUrl));
const FACTS = ['name', 'kagura', 'prefecture', 'city', 'venue', 'address', 'start', 'end', 'timeUnknown', 'fee'];
export const socialFacts = e => Object.fromEntries(FACTS.map(k => [k, e[k] ?? (k === 'timeUnknown' ? false : '')]));
const day = now => new Date(now.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
const realDay = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[<>\u0000-\u001f]/.test(v);
export function socialEvidenceErrors(e, now = new Date()) {
  if (!isSocialEvent(e)) return [];
  const errors = [], s = e.socialEvidence ?? {};
  if (!isSocialPost(s.postUrl) || e.url !== s.postUrl) errors.push('SNS: 公式情報のURLに公開投稿の個別URLを指定してください');
  if (!text(s.organizer, 100) || !safeHttps(s.authorityUrl) || !text(s.authorityNote, 300)) errors.push('SNS: 保存会・社中名と、公式アカウントだと確認できる根拠URL・確認内容が必要です');
  if (s.publicAccess !== true) errors.push('SNS: ログイン不要の公開一次情報を読んで確認してください（検索要約のみは不可）');
  if (!realDay(s.checked) || s.checked > day(now) || e.checked !== s.checked) errors.push('SNS: 有効な確認日が必要です（未来日は不可）');
  if (!text(e.source, 100) || !text(e.city, 40) || !text(e.venue, 100)) errors.push('SNS: 出典・市区町村・会場を確認してください');
  if (!realDay(e.start?.slice(0, 10)) || !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(e.start ?? '')) errors.push('SNS: 実在する開催日と正しい時刻が必要です');
  if (e.end && (!realDay(e.end.slice(0, 10)) || !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(e.end) || e.end < e.start)) errors.push('SNS: 終了日時が不正です');
  if (e.timeUnknown && !e.start?.endsWith('T00:00')) errors.push('SNS: 時刻不明の場合は00:00とtimeUnknownを指定してください');
  const facts = socialFacts(e);
  if (!s.facts || FACTS.some(k => s.facts[k] !== facts[k])) errors.push('SNS: 開催情報を変更したため、根拠を再確認してください');
  return errors;
}
// Different titles on different SNS can still describe the same performance.
export function socialDuplicate(a, b) {
  const aPost = socialPostKey(a.socialEvidence?.postUrl ?? a.url), bPost = socialPostKey(b.socialEvidence?.postUrl ?? b.url);
  if (aPost && aPost === bPost && a.start?.slice(0, 10) === b.start?.slice(0, 10)) return true;
  const norm = v => String(v ?? '').normalize('NFKC').replace(/[\s　]/g, '');
  return (isSocialEvent(a) || isSocialEvent(b)) && a.prefecture === b.prefecture &&
    a.start?.slice(0, 10) === b.start?.slice(0, 10) && !!a.city && norm(a.city) === norm(b.city) &&
    !!a.venue && norm(a.venue) === norm(b.venue) && (a.timeUnknown || b.timeUnknown || a.start === b.start);
}
