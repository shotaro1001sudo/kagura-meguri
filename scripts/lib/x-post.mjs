// SNS(X)への投稿: 選ぶ・文面を作る・時刻を割り当てる(外部へは送らない部分)
// 送信は scripts/post-social.mjs が Buffer の予約投稿として行う。

export const WINDOW_MIN = 3;   // 開催の3日前までに
export const WINDOW_MAX = 14;  // 開催の2週間前から、紹介する(SEO.md の方針)
export const MAX_PER_RUN = 2;  // 1日に紹介する開催の最大件数(連投を避ける)
export const RERUN_GAP_DAYS = 30; // 読み物を出し切ったあと、同じものを再投稿するまでの最短の日数
export const LIMIT = 280;      // Xの上限(全角2・半角1・URL23で数える)
const WD = "日月火水木金土";
const UTM = "utm_source=x&utm_medium=social";

const dayNum = (ymd) => Math.floor(Date.parse(`${ymd}T00:00:00Z`) / 86400e3);
const weekday = (ymd) => new Date(`${ymd}T00:00:00Z`).getUTCDay();
const tag = (s) => `#${String(s).replace(/[\s・()()]/g, "")}`;

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
  const tags = ["#神楽", e.kagura ? tag(e.kagura) : ""].filter(Boolean).join(" ");
  const url = `${baseUrl}/events/${e.id}.html?${UTM}`;
  const build = (name) => [`【神楽】${name}`, `${m}/${d}(${wd})${time}`, `${place}${e.kagura ? ` ・ ${e.kagura}` : ""}`, "", url, tags].join("\n");
  let name = e.name;
  while (weightedLength(build(name)) > LIMIT && name.length > 4) name = `${name.slice(0, -2)}…`;
  return build(name);
}

/** 読み物の文面。本文が長いときは、文の切れ目(。)で収まるところまでにする */
export function composeReading({ label, title, body, url, tags }) {
  const build = (b) => [`【${label}】${title}`, b, "", url, tags].join("\n");
  if (weightedLength(build(body)) <= LIMIT) return build(body);
  const sentences = body.match(/[^。]+。?/g) ?? [body];
  let b = "";
  for (const s of sentences) {
    if (weightedLength(build(b + s)) > LIMIT) break;
    b += s;
  }
  if (!b) { b = body; while (weightedLength(build(`${b}…`)) > LIMIT && b.length > 10) b = b.slice(0, -1); b += "…"; }
  return build(b);
}

// テーマ: 曜日ごとに、その日いちばん先に出すものを決める(残りの枠は、ほかのテーマから順に)
export const THEMES = {
  program: "神楽の演目",
  kind: "神楽を知る",
  history: "神楽の歴史",
  feature: "神楽の見どころ",
  viewing: "神楽の見学のコツ",
  page: "神楽めぐり",
};
const DAY_THEME = ["page", "program", "kind", "history", "feature", "page", "viewing"]; // 日〜土(金曜は「今週末の神楽」から)

/** 読み物の候補。data/kagura-info.json(出典つきの紹介文)と、サイトの案内ページから作る */
export function readingCandidates(info, baseUrl, todayJst) {
  const out = [];
  const kindUrl = (k) => `${baseUrl}${encodeURI(`/kagura/${k}.html`)}?${UTM}`;
  for (const [k, x] of Object.entries(info)) {
    if (!x?.source) continue; // 出典のないものは出さない
    const base = { title: k, url: kindUrl(k), tags: `#神楽 ${tag(k)}`, kagura: k };
    if (x.intro) out.push({ ...base, id: `r:kind:${k}`, theme: "kind", body: x.intro });
    (x.programs ?? []).forEach((p, i) => out.push({ ...base, id: `r:program:${k}:${i}`, theme: "program", title: `${p.name}(${k})`, body: p.text }));
    (x.history ?? []).forEach((t, i) => out.push({ ...base, id: `r:history:${k}:${i}`, theme: "history", body: t }));
    (x.features ?? []).forEach((t, i) => out.push({ ...base, id: `r:feature:${k}:${i}`, theme: "feature", body: t }));
    (x.viewing ?? []).forEach((t, i) => out.push({ ...base, id: `r:viewing:${k}:${i}`, theme: "viewing", body: t }));
  }
  const page = (id, title, body, path, timely = false) => out.push({ id: `r:page:${id}`, theme: "page", title, body, url: `${baseUrl}${path}?${UTM}`, tags: "#神楽", timely });
  page("guide", "はじめての神楽ガイド", "どこで観られる?服装や持ち物は?マナーは?各地の公式・公的な情報をもとに、初めて神楽を観る人向けにまとめました。", "/guide.html");
  page("history", "神楽の歴史", "古代から近代まで、神楽がどのように伝わってきたのかを、時代ごとにまとめています。", "/history/");
  page("quiz", "神楽の好み診断", "いくつかの質問に答えると、好きな舞の雰囲気から、あなたに合いそうな神楽を探せます。", "/quiz.html");
  page("map", "地図で探す", "全国の神楽の開催予定を、地図から探せます。旅先の近くで観られる神楽を見つけてください。", "/map.html");
  // 日付で中身が変わるページは、IDに日付を入れて、週・月ごとに出し直す
  if (todayJst) {
    if (weekday(todayJst) === 5) page(`weekend:${todayJst}`, "今週末の神楽", "今週末に各地で観られる神楽を、日付順にまとめました。お出かけ前に、公式情報もご確認ください。", "/weekend.html", true);
    if (Number(todayJst.slice(8, 10)) <= 7 && weekday(todayJst) === 0) page(`month:${todayJst.slice(0, 7)}`, "今月の神楽", "今月、各地で観られる神楽の開催予定をまとめています。", "/this-month.html", true);
  }
  return out.map((c) => ({ ...c, label: THEMES[c.theme], text: composeReading({ label: THEMES[c.theme], ...c }) }));
}

// 決まった順で混ぜる(同じ神楽ばかり続かないように)
const hash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/** 読み物を n 件選ぶ。未投稿を優先し、出し切ったら、最後に出してから RERUN_GAP_DAYS 日以上たったものを古い順に */
export function pickReadings(candidates, posted, todayJst, n) {
  const last = new Map();
  for (const p of posted) if (p.id?.startsWith("r:")) last.set(p.id, p.date > (last.get(p.id) ?? "") ? p.date : last.get(p.id));
  const fresh = candidates.filter((c) => !last.has(c.id)).sort((a, b) => (b.timely ? 1 : 0) - (a.timely ? 1 : 0) || hash(a.id) - hash(b.id));
  const reruns = candidates
    .filter((c) => last.has(c.id) && dayNum(todayJst) - dayNum(last.get(c.id)) >= RERUN_GAP_DAYS)
    .sort((a, b) => last.get(a.id).localeCompare(last.get(b.id)) || hash(a.id) - hash(b.id));
  const first = DAY_THEME[weekday(todayJst)];
  const order = [first, ...Object.keys(THEMES).filter((t) => t !== first)];
  const picked = [];
  const usedKinds = new Set();
  for (const pool of [fresh, reruns]) {
    let progress = true;
    while (picked.length < n && progress) {
      progress = false;
      for (const theme of order) {
        if (picked.length >= n) break;
        const c = pool.find((x) => x.theme === theme && !picked.includes(x) && !(x.kagura && usedKinds.has(x.kagura)))
          ?? pool.find((x) => x.theme === theme && !picked.includes(x));
        if (!c) continue;
        picked.push(c); if (c.kagura) usedKinds.add(c.kagura); progress = true;
      }
    }
  }
  return picked;
}

/** その日の投稿枠(UTCのISO文字列)。firstSlot(日本時間)から intervalHours ごとに perDay 件 */
export function daySlots(todayJst, { firstSlot = "07:00", intervalHours = 4, perDay = 6 } = {}) {
  const start = Date.parse(`${todayJst}T${firstSlot}:00+09:00`);
  return Array.from({ length: perDay }, (_, i) => new Date(start + i * intervalHours * 3600e3).toISOString());
}

/** 枠に投稿を割り当てる。開催のお知らせは eventSlots の枠(朝・夕方)へ、残りは読み物 */
export function planDay({ events, info, posted, todayJst, baseUrl, social = {}, now = Date.now() }) {
  const slots = daySlots(todayJst, social);
  const taken = new Set(posted.map((p) => p.dueAt).filter(Boolean));
  const open = slots.filter((s) => !taken.has(s) && Date.parse(s) > now + 10 * 60e3); // 予約済み・過ぎた枠は使わない
  const evs = pickEvents(events, posted, todayJst, Math.min(MAX_PER_RUN, open.length));
  const prefer = (social.eventSlots ?? [0, 3]).map((i) => slots[i]).filter((s) => open.includes(s));
  const evSlots = [...prefer, ...open.filter((s) => !prefer.includes(s))].slice(0, evs.length);
  const readSlots = open.filter((s) => !evSlots.includes(s));
  const reads = pickReadings(readingCandidates(info, baseUrl, todayJst), posted, todayJst, readSlots.length);
  const plan = [
    ...evs.map((e, i) => ({ id: e.id, type: "event", dueAt: evSlots[i], text: composeText(e, baseUrl) })),
    ...reads.map((r, i) => ({ id: r.id, type: "reading", dueAt: readSlots[i], text: r.text })),
  ];
  return plan.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}
