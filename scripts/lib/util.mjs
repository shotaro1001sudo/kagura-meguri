// 収集処理の共通部品
import { createHash } from "node:crypto";

export const PREFECTURES = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"];

// 地方区分(トップの絞り込み用)。都道府県の並び順のまま、地方ごとにまとめる
export const REGIONS = [
  ["北海道・東北", ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"]],
  ["関東", ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県"]],
  ["中部", ["新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県"]],
  ["近畿", ["三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"]],
  ["中国", ["鳥取県", "島根県", "岡山県", "広島県", "山口県"]],
  ["四国", ["徳島県", "香川県", "愛媛県", "高知県"]],
  ["九州・沖縄", ["福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"]],
];
export const regionOf = (pref) => REGIONS.find(([, ps]) => ps.includes(pref))?.[0] ?? "";

const z2h =(s) => s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[:：]/g, ":");
const pad = (n) => String(n).padStart(2, "0");

/** 全角数字・「令和」を含む日本語の日付文字列から { start, end } (ISO風 "YYYY-MM-DDTHH:mm") を取り出す。
 *  年が無い場合は baseYear を使い、基準日より90日以上前になるなら翌年とみなす。取り出せなければ null。 */
export function parseJaDate(text, now = new Date()) {
  const s = z2h(text.replace(/\s+/g, " "));
  let y, m, d;
  let mt = s.match(/(\d{4})\s*[年\/.-]\s*(\d{1,2})\s*[月\/.-]\s*(\d{1,2})/);
  if (mt) [y, m, d] = [+mt[1], +mt[2], +mt[3]];
  else if ((mt = s.match(/令和\s*(\d{1,2}|元)\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})/))) [y, m, d] = [2018 + (mt[1] === "元" ? 1 : +mt[1]), +mt[2], +mt[3]];
  else if ((mt = s.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/))) {
    [m, d] = [+mt[1], +mt[2]];
    y = now.getFullYear();
    if (new Date(y, m - 1, d) < new Date(now.getTime() - 90 * 864e5)) y += 1;
  } else return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const times = [...s.matchAll(/(\d{1,2}):(\d{2})/g)].map((t) => `${pad(+t[1])}:${pad(+t[2])}`);
  const time = (i) => times[i] ?? (i === 0 ? "00:00" : null);
  const date = `${y}-${pad(m)}-${pad(d)}`;
  return { start: `${date}T${time(0)}`, end: times[1] ? `${date}T${times[1]}` : null, hasTime: times.length > 0 };
}

export function findPrefecture(text) {
  return PREFECTURES.find((p) => text.includes(p)) ?? PREFECTURES.find((p) => text.includes(p.replace(/[都道府県]$/, ""))) ?? "";
}

export const clean = (s = "") => String(s).replace(/\s+/g, " ").trim();

export const hash = (...parts) => createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 10);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** robots.txt を取得し、指定UAがパスにアクセスしてよいか判定する(最長一致、Allow優先)。取得できなければ許可。 */
export async function robotsAllows(url, ua, fetchImpl = fetch) {
  const u = new URL(url);
  let txt = "";
  try {
    const r = await fetchImpl(`${u.origin}/robots.txt`, { headers: { "user-agent": ua } });
    if (r.ok) txt = await r.text();
  } catch { return { ok: true, reason: "robots.txt unreachable" }; }
  const token = ua.split(/[\/\s]/)[0].toLowerCase();
  const groups = [];
  let cur = null, lastWasUA = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const mt = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!mt) continue;
    const k = mt[1].toLowerCase(), v = mt[2].trim();
    if (k === "user-agent") { if (!lastWasUA) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v.toLowerCase()); lastWasUA = true; continue; }
    lastWasUA = false;
    if (cur && (k === "allow" || k === "disallow")) cur.rules.push([k, v]);
  }
  const mine = groups.filter((g) => g.agents.includes(token));
  const use = mine.length ? mine : groups.filter((g) => g.agents.includes("*"));
  const path = u.pathname + u.search;
  let best = null;
  for (const g of use) for (const [k, v] of g.rules) {
    if (!v) continue;
    const re = new RegExp("^" + v.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
    if (re.test(path) && (!best || v.length > best.v.length || (v.length === best.v.length && k === "allow"))) best = { k, v };
  }
  return best && best.k === "disallow" ? { ok: false, reason: `robots.txt が ${best.v} を禁止` } : { ok: true };
}
