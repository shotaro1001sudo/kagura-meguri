import { socialPlatform } from './social-evidence.mjs';
// Check each redirect before sending a request. Never follow a redirect into SNS.
export async function fetchCollectionPage(url, options, { checkRobots, delay, sameOrigin = false, fetchImpl = fetch }) {
  let current = url;
  for (let hop = 0; hop <= 5; hop++) {
    if (socialPlatform(current)) throw Error('SNSの自動取得は無効です');
    const response = await fetchImpl(current, { ...options, redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location || hop === 5) throw Error('転送先が不明、または転送回数が多すぎます');
    const next = new URL(location, current);
    if (!['https:', 'http:'].includes(next.protocol) || next.username || next.password) throw Error('安全でない転送先');
    if (socialPlatform(next.href)) throw Error('SNSへの転送は取得しません');
    if (sameOrigin && next.origin !== new URL(url).origin) throw Error('別サイトへの転送は確認が必要です');
    const allowed = await checkRobots(next.href);
    if (!allowed.ok) throw Error(allowed.reason);
    await delay();
    current = next.href;
  }
}
