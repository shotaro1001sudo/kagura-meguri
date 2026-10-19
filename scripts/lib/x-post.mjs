// X(旧Twitter)への自動投稿: 選ぶ・文面を作る・署名する(外部へは送らない部分)
import { createHmac, randomBytes } from "node:crypto";

export const WINDOW_MIN = 3;   // 開催の3日前までに
export const WINDOW_MAX = 14;  // 開催の2週間前から、紹介する(SEO.md の方針)
export const MAX_PER_RUN = 2;  // 1回に投稿する最大件数(連投を避ける)
const WD = "日月火水木金土";

const dayNum = (ymd) => Math.floor(Date.parse(`${ymd}T00:00:00Z`) / 86400e3);

/** 投稿する開催を選ぶ: 掲載中・未投稿・開催まで 3〜14日。開催が近い順 */
export function pickEvents(events, posted, todayJst, max = MAX_PER_RUN) {
  const done = new Set(posted.map((p) => p.id));
  return events
    .filter((e) => e.status === "published" && !done.has(e.id))
    .map((e) => ({ e, days: dayNum(e.start.slice(0, 10)) - dayNum(todayJst) }))
    .filter(({ days }) => days >= WINDOW_MIN && days <= WINDOW_MAX)
    .sort((a, b) => a.days - b.days || a.e.start.localeCompare(b.e.start))
    .slice(0, max)
    .map(({ e }) => e);
}

/** Xの文字数: 全角(日本語)は2、半角は1、URLは常に23 */
export function weightedLength(text) {
  const noUrl = text.replace(/https?:\/\/\S+/g, "");
  const urls = (text.match(/https?:\/\/\S+/g) ?? []).length;
  let n = urls * 23;
  for (const ch of noUrl) n += ch.codePointAt(0) <= 0x10ff || (ch.codePointAt(0) >= 0x2000 && ch.codePointAt(0) <= 0x200d) ? 1 : 2;
  return n;
}

export function composeText(e, baseUrl) {
  const [y, m, d] = e.start.slice(0, 10).split("-").map(Number);
  const wd = WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const time = e.timeUnknown ? "" : ` ${e.start.slice(11, 16)}〜`;
  const place = `${e.prefecture}${e.city ?? ""}`;
  const tags = ["#神楽", e.kagura ? `#${e.kagura.replace(/[\s・]/g, "")}` : ""].filter(Boolean).join(" ");
  const url = `${baseUrl}/events/${e.id}.html`;
  const build = (name) => [`【神楽】${name}`, `${m}/${d}(${wd})${time}`, `${place}${e.kagura ? ` ・ ${e.kagura}` : ""}`, "", url, tags].join("\n");
  let name = e.name;
  while (weightedLength(build(name)) > 280 && name.length > 4) name = `${name.slice(0, -2)}…`;
  return build(name);
}

const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** OAuth 1.0a の Authorization ヘッダー(JSONの本文は、署名の対象に含めない) */
export function oauthHeader({ method, url, keys, nonce = randomBytes(16).toString("hex"), timestamp = Math.floor(Date.now() / 1000) }) {
  const p = {
    oauth_consumer_key: keys.apiKey, oauth_nonce: nonce, oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(timestamp), oauth_token: keys.accessToken, oauth_version: "1.0",
  };
  const base = [method.toUpperCase(), enc(url), enc(Object.keys(p).sort().map((k) => `${enc(k)}=${enc(p[k])}`).join("&"))].join("&");
  p.oauth_signature = createHmac("sha1", `${enc(keys.apiSecret)}&${enc(keys.accessSecret)}`).update(base).digest("base64");
  return "OAuth " + Object.keys(p).sort().map((k) => `${enc(k)}="${enc(p[k])}"`).join(", ");
}
