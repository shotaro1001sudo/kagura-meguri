// 週次の振り返り(PDCA の Check と Act): 数字を集め、先週と比べ、次にやることを決める(外部へは送らない部分)
// 実行は scripts/weekly-review.mjs。仕組みの全体は AUTOMATION.md の「PDCA」。
import { REGIONS, regionOf } from "./util.mjs";
import { readingCandidates, WINDOW_MIN } from "./x-post.mjs";

export const HISTORY_WEEKS = 26;     // 推移として残す週数(約半年)
export const TARGETS = {
  upcoming30: 30,     // 今後30日の掲載が、これより少ないと「開催情報を増やす」
  heldMax: 10,        // 保留がこれより多いと「保留を片付ける」
  readingDaysMin: 14, // 読み物の未投稿が、この日数分を切ると「読み物を足す」
  collectStaleDays: 8 // 週次収集がこの日数より前なら「収集が止まっている」
};
const READING_SLOTS_PER_DAY = 4; // 6枠のうち、開催のお知らせ(2枠)以外

const dayNum = (ymd) => Math.floor(Date.parse(`${ymd}T00:00:00Z`) / 86400e3);
const addDays = (ymd, n) => new Date((dayNum(ymd) + n) * 86400e3).toISOString().slice(0, 10);

/** 今週の数字。入力はすべてリポジトリのデータ(公開情報だけ) */
export function reviewMetrics({ events = [], summary = {}, posted = [], info = {}, sources = [], todayJst, baseUrl = "" }) {
  const live = events.filter((e) => e.status === "published");
  const within = (e, from, to) => { const d = e.start.slice(0, 10); return d >= from && d <= to; };
  const up = (n) => live.filter((e) => within(e, todayJst, addDays(todayJst, n)));
  const up30 = up(30);
  const byRegion30 = Object.fromEntries(REGIONS.map(([r]) => [r, up30.filter((e) => regionOf(e.prefecture) === r).length]));

  // SNS: 過去7日に予約した数と、紹介できずに開催日を迎えた開催(先週の取りこぼし)
  const weekAgo = addDays(todayJst, -7);
  const recent = posted.filter((p) => p.date >= weekAgo && p.date < todayJst);
  const postedIds = new Set(posted.map((p) => p.id));
  // SNS の予約を始めた日(記録の最初の日)より前の開催は、数えない
  const firstPost = posted.map((p) => p.date).filter(Boolean).sort()[0];
  const missed = firstPost ? live.filter((e) => within(e, weekAgo, addDays(todayJst, -1)) && !postedIds.has(e.id) && dayNum(e.start.slice(0, 10)) - dayNum(firstPost) >= WINDOW_MIN) : [];
  const cands = readingCandidates(info, baseUrl, todayJst).filter((c) => c.theme !== "page");
  const unposted = cands.filter((c) => !postedIds.has(c.id)).length;

  const heldReasons = {};
  for (const h of summary.items?.held ?? []) heldReasons[h.reason] = (heldReasons[h.reason] ?? 0) + 1;

  return {
    date: todayJst,
    listing: {
      upcoming14: up(14).length,
      upcoming30: up30.length,
      upcoming60: up(60).length,
      byRegion30,
      emptyRegions30: Object.entries(byRegion30).filter(([, n]) => n === 0).map(([r]) => r),
      timeUnknown14: up(14).filter((e) => e.start.endsWith("T00:00")).sort((a, b) => a.start.localeCompare(b.start)).map((e) => `${e.start.slice(0, 10)} ${e.name}`),
    },
    collect: {
      date: summary.date ?? "",
      daysAgo: summary.date ? dayNum(todayJst) - dayNum(summary.date) : null,
      published: summary.published ?? 0,
      held: summary.held ?? 0,
      withdrawn: summary.withdrawn ?? 0,
      errors: summary.errors ?? 0,
      heldReasons,
      sourceReviews: (summary.sourceReviews ?? []).length,
      sourcesEnabled: sources.filter((s) => s.enabled !== false).length,
      sourcesDisabled: sources.filter((s) => s.enabled === false).length,
    },
    social: {
      last7: { event: recent.filter((p) => p.type === "event").length, reading: recent.filter((p) => p.type === "reading").length },
      missedEvents: missed.map((e) => `${e.start.slice(0, 10)} ${e.name}`),
      readingsUnposted: unposted,
      readingDaysLeft: Math.floor(unposted / READING_SLOTS_PER_DAY),
    },
  };
}

/** 数字から、次にやること(Act)を決める。key は週をまたいで同じ課題を見分けるため */
export function decideActions(m, prev) {
  const a = [];
  const add = (key, owner, text) => a.push({ key, owner, text });
  const c = m.collect, l = m.listing, s = m.social;
  if (c.daysAgo == null || c.daysAgo > TARGETS.collectStaleDays) add("collect-stale", "人", `週次の自動収集が ${c.date || "未実行"} から動いていません。Actions の weekly-collect を確認する`);
  if (c.errors > 0) add("collect-errors", "人", `収集元で ${c.errors} 件のエラー。週次収集の Issue のログを確認し、壊れた収集元を直すか止める`);
  if (c.held > TARGETS.heldMax) add("held", "人", `保留が ${c.held} 件(目安 ${TARGETS.heldMax} 件以下)。管理ページ(npm run admin)で、掲載か却下を決める`);
  const bulk = Object.entries(c.heldReasons).find(([r, n]) => /多すぎる/.test(r) && n > 0);
  if (bulk) add("held-bulk", "Claude", `「${bulk[0]}」で ${bulk[1]} 件が保留。年度の切り替えなら、公式日程と照らして一括で掲載する`);
  if (c.sourceReviews > 0) add("source-reviews", "Claude", `確認待ちの収集元が ${c.sourceReviews} 件。公式ページを確かめ、自動掲載に回せるものは収集元に加える`);
  if (l.upcoming30 < TARGETS.upcoming30) add("listing-thin", "Claude", `今後30日の掲載が ${l.upcoming30} 件(目安 ${TARGETS.upcoming30} 件)。月次の調査で候補を探す`);
  if (l.emptyRegions30.length) add("regions-empty", "Claude", `今後30日の掲載が0件の地方: ${l.emptyRegions30.join("・")}。月次の調査でこの地方を優先する`);
  if (l.timeUnknown14.length) add("time-unknown", "Claude", `2週間以内で開始時刻が未定の開催が ${l.timeUnknown14.length} 件。公式の最新情報で時刻を確かめる`);
  if (s.missedEvents.length) add("social-missed", "人", `SNSで紹介できないまま開催日を迎えたものが ${s.missedEvents.length} 件。Buffer の予約と post-social の実行を確認する`);
  if (s.readingDaysLeft < TARGETS.readingDaysMin) add("readings-low", "Claude", `SNSの読み物の未投稿が、あと約 ${s.readingDaysLeft} 日分。data/kagura-info.json に出典つきの演目・見どころを足す`);
  if (prev && prev.listing && m.listing.upcoming30 < prev.listing.upcoming30 * 0.7) add("listing-drop", "Claude", `今後30日の掲載が先週の ${prev.listing.upcoming30} 件から ${m.listing.upcoming30} 件へ大きく減少。収集元の取りこぼしを確認する`);
  return a;
}

/** 先週の Issue 本文から、チェックの付いていない項目を拾う(持ち越し)。
 *  自動の点検で出た項目(key あり)は持ち越さない: 今週もまだ当てはまれば、今週の点検で同じ項目がまた出る。
 *  持ち越すのは、人が Issue に書き足した項目(key なし)と、すでに持ち越し中の項目(carry-)だけ */
export function carryOver(body = "") {
  const out = [];
  for (const line of String(body).split(/\r?\n/)) {
    const m = line.match(/^\s*[-*] \[ \] (.+?)\s*(?:<!--\s*([\w-]+)\s*-->)?\s*$/);
    if (!m) continue;
    const key = m[2] ?? "";
    if (key && !key.startsWith("carry-")) continue;
    out.push(m[1].replace(/^\(先週から\)\s*/, ""));
  }
  return out.map((text, i) => ({ key: `carry-${i + 1}`, text }));
}

const diff = (now, before) => (before == null ? "" : now === before ? "(先週と同じ)" : `(先週 ${before})`);

/** Issue の本文(Markdown) */
export function renderReview(m, prev, actions, carried = []) {
  const p = prev ?? {};
  const l = m.listing, c = m.collect, s = m.social;
  const lines = [
    `# 週次の振り返り ${m.date}`,
    "",
    "毎週月曜、週次の自動収集のあとに自動で作ります。前の週の振り返りは、自動で閉じます(チェックの付いていない項目は、この Issue に持ち越します)。",
    "",
    "## Check: 今週の数字",
    "",
    "| 項目 | 今週 |",
    "|---|---|",
    `| 今後14日の掲載 | ${l.upcoming14} 件${diff(l.upcoming14, p.listing?.upcoming14)} |`,
    `| 今後30日の掲載 | ${l.upcoming30} 件${diff(l.upcoming30, p.listing?.upcoming30)}(目安 ${TARGETS.upcoming30} 件) |`,
    `| 今後60日の掲載 | ${l.upcoming60} 件${diff(l.upcoming60, p.listing?.upcoming60)} |`,
    `| 週次収集(${c.date || "未実行"}) | 掲載 ${c.published} / 保留 ${c.held} / 取り下げ ${c.withdrawn} / エラー ${c.errors} |`,
    `| 収集元 | 動いている ${c.sourcesEnabled} / 停止中 ${c.sourcesDisabled} / 確認待ち ${c.sourceReviews} |`,
    `| SNS予約(過去7日) | 開催 ${s.last7.event} / 読み物 ${s.last7.reading} |`,
    `| SNSで紹介できなかった開催(過去7日) | ${s.missedEvents.length} 件 |`,
    `| SNSの読み物の残り | 未投稿 ${s.readingsUnposted} 本(約 ${s.readingDaysLeft} 日分) |`,
    "",
    "### 今後30日の掲載(地方別)",
    "",
    Object.entries(l.byRegion30).map(([r, n]) => `${r} ${n}${p.listing?.byRegion30?.[r] != null && p.listing.byRegion30[r] !== n ? `(先週 ${p.listing.byRegion30[r]})` : ""}`).join(" / "),
    "",
  ];
  if (l.timeUnknown14.length) lines.push("<details><summary>2週間以内で開始時刻が未定</summary>", "", ...l.timeUnknown14.map((x) => `- ${x}`), "", "</details>", "");
  if (s.missedEvents.length) lines.push("<details><summary>SNSで紹介できなかった開催</summary>", "", ...s.missedEvents.map((x) => `- ${x}`), "", "</details>", "");
  lines.push(
    "## Act: 今週やること",
    "",
    "「人」は運営者が、「Claude」は Claude に「週次の振り返りの Claude の項目をやって」と頼むと進みます。終わったらチェックを付けてください。",
    "",
  );
  if (!actions.length && !carried.length) lines.push("- 自動の点検では、気になる点はありませんでした");
  for (const x of actions) lines.push(`- [ ] 【${x.owner}】${x.text} <!-- ${x.key} -->`);
  for (const x of carried) lines.push(`- [ ] (先週から) ${x.text} <!-- ${x.key} -->`);
  lines.push(
    "",
    "## 手で見る数字(自動では取れないもの)",
    "",
    "- [ ] Search Console: 検索の表示回数・クリック(前週比) <!-- manual-gsc -->",
    "- [ ] GA4 または GoatCounter: よく見られたページ・X からの訪問(utm_source=x) <!-- manual-ga -->",
    "- [ ] Buffer: 先週の投稿の反応(よかった投稿の種類をメモ) <!-- manual-buffer -->",
    "- [ ] note: NOTE-LOG.md(このPC)の「データとの食い違い」メモがあれば、データを直す <!-- manual-note -->",
    "",
    "気づいたことは、この Issue にコメントで残してください。次の週の振り返りで、チェックの付いていない項目は持ち越されます。",
    "",
    `<!-- weekly-review ${m.date} -->`,
  );
  return lines.join("\n");
}

/** data/weekly-review.json: 最新の数字・やること・推移(Claude の定期タスクも、これを読んで次の計画に使う) */
export function nextState(state, m, actions) {
  const history = [...(state?.history ?? []).filter((h) => h.date !== m.date), {
    date: m.date, upcoming14: m.listing.upcoming14, upcoming30: m.listing.upcoming30, upcoming60: m.listing.upcoming60,
    held: m.collect.held, published: m.collect.published, socialEvents: m.social.last7.event, socialReadings: m.social.last7.reading,
  }].slice(-HISTORY_WEEKS);
  return {
    updated: m.date,
    metrics: m,
    actions,
    // 次の計画(Plan)への申し送り: 定期タスクがここを読む
    focus: {
      regions: m.listing.emptyRegions30.length ? m.listing.emptyRegions30 : Object.entries(m.listing.byRegion30).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([r]) => r),
      timeUnknown: m.listing.timeUnknown14,
      needReadings: m.social.readingDaysLeft < TARGETS.readingDaysMin,
    },
    history,
  };
}
