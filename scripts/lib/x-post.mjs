// SNS(X)への投稿: 選ぶ・文面を作る・時刻を割り当てる(外部へは送らない部分)
// 送信は scripts/post-social.mjs が Buffer の予約投稿として行う。

export const WINDOW_MIN = 3;   // 開催の3日前までに
export const WINDOW_MAX = 14;  // 開催の2週間前から、紹介する(SEO.md の方針)
export const MAX_PER_RUN = 2;  // 1日に紹介する開催の最大件数(連投を避ける)
export const RERUN_GAP_DAYS = 30; // 読み物を出し切ったあと、同じものを再投稿するまでの最短の日数
export const LIMIT = 280;      // Xの上限(全角2・半角1・URL23で数える)。Premium のときは、タイムラインに見える部分
export const LONG_LIMIT = 25000; // X Premium の長い投稿の上限(Buffer の無料プランも対応)
const WD = "日月火水木金土";

/**
 * X Premium の長い投稿を使うか。config.json の social.xPremiumUntil(YYYY-MM-DD)の前日までに出る投稿だけ。
 * 期限の日とそのあとは、自動で280字に戻る(Premium が切れたあとに長い投稿が出ると、送信に失敗するため)。
 */
export const premiumOn = (social, ymd) => /^\d{4}-\d{2}-\d{2}$/.test(social?.xPremiumUntil ?? "") && !!ymd && ymd < social.xPremiumUntil;

const mdw = (ymd) => { const [y, m, d] = ymd.split("-").map(Number); return `${m}/${d}(${WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`; };

/** その神楽の、出る日より後の開催(近い順に n 件)。長い投稿の「次に観られる日」に使う */
export function upcomingOf(events, kagura, afterYmd, n = 3) {
  return (events ?? [])
    .filter((e) => e?.status === "published" && e.kagura === kagura && e.start && e.start.slice(0, 10) > afterYmd)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, n);
}
const eventLine = (e) => `・${mdw(e.start.slice(0, 10))}${e.timeUnknown ? "" : ` ${e.start.slice(11, 16)}〜`} ${e.prefecture}${e.city ?? ""}${e.venue ? ` ${e.venue}` : ""}`;
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

/**
 * 開催のお知らせ。long(X Premium)のときは、見える部分(280)に名前・日時・場所・URL(リンクのカードが出る)を収め、
 * 「もっと見る」の先に、公式の説明・会場・料金と、その神楽の紹介(data/kagura-info.json、出典つき)を足す
 */
export function composeText(e, baseUrl, { long = false, info = {} } = {}) {
  const time = e.timeUnknown ? "" : ` ${e.start.slice(11, 16)}〜`;
  const place = `${e.prefecture}${e.city ?? ""}`;
  const tags = ["#神楽", e.kagura ? tag(e.kagura) : ""].filter(Boolean).join(" ");
  const url = `${baseUrl}/events/${e.id}.html?${UTM}`;
  const head = (name) => [`【神楽】${name}`, `${mdw(e.start.slice(0, 10))}${time}`, `${place}${e.kagura ? ` ・ ${e.kagura}` : ""}`];
  const build = (name) => [...head(name), "", url, tags].join("\n");
  let name = e.name;
  while (weightedLength(build(name)) > LIMIT && name.length > 4) name = `${name.slice(0, -2)}…`;
  if (!long) return build(name);
  const about = e.kagura && info?.[e.kagura]?.source && info[e.kagura].intro ? info[e.kagura].intro : "";
  const more = [
    e.description ?? "",
    [e.venue ? `会場: ${e.venue}` : "", e.fee ? `料金: ${e.fee}` : ""].filter(Boolean).join("\n"),
    about ? `▼${e.kagura}とは\n${about}` : "",
    // 説明に、すでに公式の確認のお願いがあれば重ねない
    /公式(の)?情報.{0,6}確認/.test(e.description ?? "") ? "" : "※日時や内容は変わることがあります。お出かけ前に、公式の情報をご確認ください。",
  ].filter(Boolean);
  const text = [...head(name), url, "", more.join("\n\n"), "", tags].join("\n");
  return weightedLength(text) <= LONG_LIMIT ? text : build(name);
}

/** 読み物の文面。本文が長いときは、文の切れ目(。)で収まるところまでにする */
export function composeReading({ label, title, body, url, tags, hook, extra = null, tailUrl = "" }) {
  // hook: 週次の分析(Claude)が、反応を見ながら書く1行目(data/social-hooks.json)。あれば先頭に置く
  const head = hook ? [hook, "", `【${label}】${title}`] : [`【${label}】${title}`];
  // X Premium の長い投稿(extra あり): 本文を削らず、同じ神楽の紹介・演目・見学・次の開催を「もっと見る」の先に足す。
  // URL は最後に置く(見える部分の外なので、リンクのカードが出ず、タイムラインはうるさくならない)
  if (extra) {
    const main = [...head, body, ...extra.flatMap((s) => ["", s]), ""].join("\n");
    // 全体が短く、最後のURLまで見える部分に入ってしまうときは、URLを付けない(カードが出てうるさくならないように)
    const tail = url || (tailUrl && weightedLength(`${main}\n${tailUrl}`) > LIMIT ? tailUrl : "");
    const text = [main, ...(tail ? [tail] : []), tags].join("\n");
    if (weightedLength(text) <= LONG_LIMIT) return text;
  }
  // url がなければ、URLの行を入れない(全部の投稿にURLが付くと、タイムラインでうるさく見えるため。
  // 読み物は本文だけで読み切れる形にし、URLはサイトのページ紹介と開催のお知らせにだけ付ける)
  const build = (b) => [...head, b, "", ...(url ? [url] : []), tags].join("\n");
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
/**
 * 長い投稿(X Premium)で、読み物の本文のあとに足す節。どれも data/kagura-info.json(出典つき)と data/events.json から作り、
 * 本文と同じ話は重ねない(紹介文の投稿に「とは」を足さない、など)
 */
export function readingExtras(k, x, { id = "", theme, current = "", events = [], afterYmd = "" }) {
  const about = theme !== "kind" && x.intro ? `▼${k}とは\n${x.intro}` : "";
  const names = (x.programs ?? []).map((p) => p.name).filter((n) => n && n !== current);
  const programs = names.length ? `${theme === "program" ? "▼ほかの演目" : "▼主な演目"}\n${names.slice(0, 6).join("・")}` : "";
  // 見学の話は、投稿ごとに違うものを選ぶ(同じ神楽の投稿が続いても、後半が同じにならないように)
  const tips = theme === "viewing" ? [] : x.viewing ?? [];
  const viewing = tips.length ? `▼見に行くなら\n${tips[hash(id) % tips.length]}` : "";
  // 紹介文の投稿は演目と見学の両方、ほかは投稿ごとに片方(紹介の節が入る分、長くなりすぎないように)
  const middle = theme === "kind" ? [programs, viewing] : [hash(`${id}:pick`) % 2 ? programs || viewing : viewing || programs];
  const next = afterYmd ? upcomingOf(events, k, afterYmd) : [];
  const upcoming = next.length ? `▼次に観られる日\n${next.map(eventLine).join("\n")}` : "";
  return [about, ...middle, upcoming].filter(Boolean);
}

export function readingCandidates(info, baseUrl, todayJst, hooks = {}, { long = false, events = [] } = {}) {
  const out = [];
  const kindUrl = (k) => `${baseUrl}${encodeURI(`/kagura/${k}.html`)}?${UTM}`;
  for (const [k, x] of Object.entries(info)) {
    if (!x?.source) continue; // 出典のないものは出さない
    // 演目・歴史などの読み物にはURLを付けない(本文だけで読み切る)。種類のページは pageUrl に残す(手で使うとき用。長い投稿では最後に付ける)
    const base = { title: k, url: "", pageUrl: kindUrl(k), tags: `#神楽 ${tag(k)}`, kagura: k, info: x };
    if (x.intro) out.push({ ...base, id: `r:kind:${k}`, theme: "kind", body: x.intro });
    (x.programs ?? []).forEach((p, i) => out.push({ ...base, id: `r:program:${k}:${i}`, theme: "program", title: `${p.name}(${k})`, program: p.name, body: p.text }));
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
  return out.map(({ info: x, program, ...c }) => {
    const hook = validHook(hooks?.[c.id]) ? hooks[c.id].trim() : "";
    const shortText = composeReading({ label: THEMES[c.theme], ...c, hook });
    // 長い投稿は、神楽の種類ごとの読み物だけ(案内ページの紹介は、短いままで足りる)
    const extra = long && x ? readingExtras(c.kagura, x, { id: c.id, theme: c.theme, current: program, events, afterYmd: todayJst }) : null;
    const text = extra ? composeReading({ label: THEMES[c.theme], ...c, hook, extra, tailUrl: c.pageUrl }) : shortText;
    const isLong = text !== shortText;
    // link: "tail" = 長い投稿の最後(見える部分の外)にだけURLがある。反応の比べ合わせで、URLあり・なしと分ける
    return { ...c, label: THEMES[c.theme], style: hook ? "hook" : "label", link: c.url ? true : isLong && text.includes(c.pageUrl) ? "tail" : false, long: isLong, text, shortText };
  });
}

export const HOOK_MAX = 40; // 書き出しの1行の長さの上限(文字数。本文を削りすぎないように)
/** 書き出しの1行として使えるか(URL・ハッシュタグ・メンション・改行・長すぎるものは使わない) */
export function validHook(h) {
  if (typeof h !== "string") return false;
  const t = h.trim();
  return t.length >= 4 && t.length <= HOOK_MAX && !/[\n\r#＃@＠]|https?:/.test(t);
}

// 決まった順で混ぜる(同じ神楽ばかり続かないように)
const hash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/** 読み物を n 件選ぶ。未投稿を優先し、出し切ったら、最後に出してから RERUN_GAP_DAYS 日以上たったものを古い順に */
export function pickReadings(candidates, posted, todayJst, n, weights = {}) {
  const last = new Map();
  for (const p of posted) if (p.id?.startsWith("r:")) last.set(p.id, p.date > (last.get(p.id) ?? "") ? p.date : last.get(p.id));
  const fresh = candidates.filter((c) => !last.has(c.id)).sort((a, b) => (b.timely ? 1 : 0) - (a.timely ? 1 : 0) || hash(a.id) - hash(b.id));
  const reruns = candidates
    .filter((c) => last.has(c.id) && dayNum(todayJst) - dayNum(last.get(c.id)) >= RERUN_GAP_DAYS)
    .sort((a, b) => last.get(a.id).localeCompare(last.get(b.id)) || hash(a.id) - hash(b.id));
  const first = DAY_THEME[weekday(todayJst)];
  // 曜日のテーマを先頭に、残りは反応のよい順(週次の振り返りが data/social-performance.json から渡す。評価がなければ 1 = 元の順)
  const w = (t) => weights[t] ?? 1;
  const order = [first, ...Object.keys(THEMES).filter((t) => t !== first).sort((a, b) => w(b) - w(a))];
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

export const JUST_OVER_DAYS = 30; // 開催が終わってこの日数のあいだは、その神楽の読み物を出さない(次の開催があれば出す)

/** 開催の終わる時刻(ms)。終わりがなければ、始まりの日の終わり(24時) */
const endMs = (e) => (e.end ? Date.parse(`${e.end}+09:00`) : Date.parse(`${e.start.slice(0, 10)}T00:00:00+09:00`) + 86400e3);

/**
 * 「終わったばかり」の神楽: 投稿が出る時刻(untilMs)までに開催が終わり(この JUST_OVER_DAYS 日のうち)、
 * そのあとの開催がない神楽。予約は前の晩・数日前に作るので、作った時ではなく、出る時で判断する
 * (例: 11/7〜8 の神楽の紹介を、11/9 に「毎年11月7日から…」と出さない)。
 */
export function justOverKagura(events, untilMs) {
  const over = new Set();
  const ahead = new Set();
  for (const e of events ?? []) {
    if (!e?.kagura || !e.start || e.status !== "published") continue;
    const end = endMs(e);
    if (!Number.isFinite(end)) continue;
    if (end > untilMs) ahead.add(e.kagura);
    else if (end > untilMs - JUST_OVER_DAYS * 86400e3) over.add(e.kagura);
  }
  return new Set([...over].filter((k) => !ahead.has(k)));
}

/** 枠に投稿を割り当てる。開催のお知らせは eventSlots の枠(朝・夕方)へ、残りは読み物 */
export function planDay({ events, info, posted, todayJst, baseUrl, social = {}, now = Date.now(), weights = {}, hooks = {} }) {
  const slots = daySlots(todayJst, social);
  const taken = new Set(posted.map((p) => p.dueAt).filter(Boolean));
  const open = slots.filter((s) => !taken.has(s) && Date.parse(s) > now + 10 * 60e3); // 予約済み・過ぎた枠は使わない
  // 開催のお知らせは、決めた枠(朝・夕方)だけに入れる。その枠が過ぎていたら、翌日に回す(夜中に出さない)
  const prefer = (social.eventSlots ?? [0, 3]).map((i) => slots[i]).filter((s) => open.includes(s));
  const evs = pickEvents(events, posted, todayJst, Math.min(MAX_PER_RUN, prefer.length));
  const evSlots = prefer.slice(0, evs.length);
  const readSlots = open.filter((s) => !evSlots.includes(s));
  // その日のいちばん遅い枠の時刻で判断する(どの枠に入っても、終わった直後の神楽を紹介しない)
  const over = justOverKagura(events, Date.parse(slots[slots.length - 1]));
  const long = premiumOn(social, todayJst);
  const cands = readingCandidates(info, baseUrl, todayJst, hooks, { long, events }).filter((c) => !(c.kagura && over.has(c.kagura)));
  const reads = pickReadings(cands, posted, todayJst, readSlots.length, weights);
  const plan = [
    ...evs.map((e, i) => eventPost(e, { baseUrl, info, long, dueAt: evSlots[i] })),
    // shortText: Buffer が長い投稿を受け付けなかったとき(X の Premium を認識していない等)に、代わりに送る280字の文面
    ...reads.map((r, i) => ({ id: r.id, type: "reading", style: r.style, link: r.link, long: r.long, dueAt: readSlots[i], text: r.text, shortText: r.shortText })),
  ];
  return plan.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

function eventPost(e, { baseUrl, info, long, dueAt }) {
  const shortText = composeText(e, baseUrl);
  const text = long ? composeText(e, baseUrl, { long: true, info }) : shortText;
  return { id: e.id, type: "event", style: "event", link: true, long: text !== shortText, dueAt, text, shortText };
}

/**
 * 予約済みの投稿を、今の作り方で作り直す(Premium の切り替え・書き出しの追加・開催の情報の更新を、予約済みの分にも反映するため)。
 * 見つからない(開催が取り下げられた・読み物が消えた)ときは null
 */
export function composeById({ id, date, events, info, baseUrl, social = {}, hooks = {} }) {
  const long = premiumOn(social, date);
  if (id.startsWith("r:")) {
    const c = readingCandidates(info, baseUrl, date, hooks, { long, events }).find((x) => x.id === id);
    return c ? { id, type: "reading", style: c.style, link: c.link, long: c.long, text: c.text, shortText: c.shortText } : null;
  }
  const e = (events ?? []).find((x) => x.id === id && x.status === "published");
  return e ? eventPost(e, { baseUrl, info, long }) : null;
}

/** 日本時間の日付に n 日足す(YYYY-MM-DD) */
export const addDaysJst = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);

/**
 * 今日の残りの枠と、翌日の枠をまとめて決める(前の晩に翌日分を予約しておけば、
 * GitHub の決まった時刻の起動が数時間遅れても、朝の枠が飛ばない)。
 * 1日目に選んだ投稿は、2日目を選ぶときに「予約済み」として扱う(同じ読み物・開催を重ねない)。
 * 各投稿の date は、出る日(日本時間)。
 */
export function planDays({ days = 2, todayJst, posted, ...rest }) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const day = addDaysJst(todayJst, i);
    const plan = planDay({ ...rest, todayJst: day, posted: [...posted, ...out] }).map((p) => ({ ...p, date: day }));
    out.push(...plan);
  }
  return out;
}
