// Local, manually transcribed facts only. Never fetches a social network.
// node scripts/import-social.mjs path/to/candidate.json
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { socialPlatform, isSocialPost, socialDuplicate } from './lib/social-evidence.mjs';
import { sameEvent } from './lib/collect-core.mjs';
const file = process.argv[2];
if (!file) { console.error('使い方: node scripts/import-social.mjs <候補.json>'); process.exit(1); }
const input = JSON.parse(readFileSync(file, 'utf8'));
const path = process.env.EVENTS_FILE ?? 'data/events.json';
const events = JSON.parse(readFileSync(path, 'utf8'));
const keys = ['id', 'name', 'kagura', 'prefecture', 'city', 'venue', 'address', 'start', 'end', 'timeUnknown', 'fee', 'url'];
const event = Object.fromEntries(keys.filter(k => k in input).map(k => [k, input[k]]));
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(event.id ?? '') || !isSocialPost(event.url)) throw Error('IDとSNSの個別投稿URLを確認してください');
const duplicate = events.find(e => e.id === event.id || sameEvent(e, event) || socialDuplicate(e, event));
if (duplicate) throw Error(`同一公演の候補があります。既存の ${duplicate.id} を確認してください`);
event.source = `${socialPlatform(event.url)} 公開投稿（未確認）`;
event.status = 'pending';
event.holdReasons = ['SNSの投稿元・公開アクセス・開催事実・確認日を管理画面またはreviewで確認してください'];
// No descriptions, images, credentials, status or verification flags from a submission.
writeFileSync(path + '.tmp', JSON.stringify([...events, event], null, 2) + '\n');
renameSync(path + '.tmp', path);
console.log(`${event.id} を保留として受け付けました。公開はしていません。`);
