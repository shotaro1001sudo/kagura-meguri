// 週次の振り返り(PDCA の Check と Act): 数字を集め、先週と比べ、次にやることを決める(外部へは送らない部分)
// 実行は scripts/weekly-review.mjs。仕組みの全体は AUTOMATION.md の「PDCA」。
import { REGIONS, regionOf } from "./util.mjs";
import { readingCandidates, WINDOW_MIN, THEMES } from "./x-post.mjs";
import { QUIZ_STALE_DAYS } from "./quiz-health.mjs";

export const HISTORY_WEEKS = 26;     // 推移として残す週数(約半年)
export const TARGETS = {
  upcoming30: 30,     // 今後30日の掲載が、これより少ないと「開催情報を増やす」
  heldMax: 10,        // 保留がこれより多いと「保留を片付ける」
  readingDaysMin: 14, // 読み物の未投稿が、この日数分を切ると「読み物を足す」
  collectStaleDays: 8, // 週次収集がこの日数より前なら「収集が止まっている」
  analysisStaleDays: 6, // このPCの分析(3日に1回)が、この日数より前なら「分析が止まっている」(1回飛んだら知らせる)
  noteStaleDays: 5,     // note(2日に1回)の最後の投稿が、この日数より前なら「note が止まっている」
  socialMinRatio: 0.7,  // 過去7日のSNS予約が、予定の本数のこの割合を切ると「予約が足りない」
  staleWeeks: 3         // 同じ「やること」がこの週数つづいたら、目立たせる
};
const READING_SLOTS_PER_DAY = 4; // 6枠のうち、開催のお知らせ(2枠)以外

const dayNum = (ymd) => Math.floor(Date.parse(`${ymd}T00:00:00Z`) / 86400e3);
const addDays = (ymd, n) => new Date((dayNum(ymd) + n) * 86400e3).toISOString().slice(0, 10);

/** 今週の数字。入力はすべてリポジトリのデータ(公開情報だけ) */
export function reviewMetrics({ events = [], summary = {}, posted = [], info = {}, sources = [], todayJst, baseUrl = "", performance = null, quiz = null, mediaStats = null, note = null, perDay = null, eventsPerDay = null }) {
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

  // このPCで動く仕組みの脈(GitHub からは中が見えないので、公開している跡で確かめる)
  //   週次の分析: 毎週、協賛のページの概数(data/media-stats.json)を公開する → その日付
  //   note: 公開の RSS の最後の投稿日(scripts/note-pulse.mjs。読めなければ null)
  const ago = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d ?? "") ? dayNum(todayJst) - dayNum(d) : null);
  const postedDays = firstPost ? dayNum(todayJst) - dayNum(firstPost) : 0;

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
      // 予定の本数(1日の枠 × 7日)。予約を始めて7日たつまでは、比べない(null)
      expected7: perDay && postedDays >= 7 ? perDay * 7 : null,
      // 開催のお知らせの枠(1日の本数 × 7日)。紹介できなかった開催が「予約の失敗」か「枠が足りない」かを分ける
      eventCapacity7: eventsPerDay ? eventsPerDay * 7 : null,
      missedEvents: missed.map((e) => `${e.start.slice(0, 10)} ${e.name}`),
      readingsUnposted: unposted,
      readingDaysLeft: Math.floor(unposted / READING_SLOTS_PER_DAY),
      // 反応の評価(scripts/social-metrics.mjs)。実数はなく、テーマ別の相対値だけ
      performance: { status: performance?.status ?? "none", reason: performance?.reason ?? "", samples: performance?.samples ?? 0, themes: performance?.themes ?? {} },
    },
    // このPCで動く仕組み(週次の分析・note)が動いているか
    pc: {
      analysisDate: ago(mediaStats?.updated) == null ? null : mediaStats.updated,
      analysisDaysAgo: ago(mediaStats?.updated),
      noteStatus: note?.status ?? "none",
      noteLastPost: note?.status === "ok" && ago(note?.lastPost) != null ? note.lastPost : null,
      noteDaysAgo: note?.status === "ok" ? ago(note?.lastPost) : null,
    },
    // 好み診断の点検(scripts/lib/quiz-health.mjs)。なければ null
    quiz,
  };
}

export const THEME_LABELS = { event: "開催のお知らせ", ...THEMES };
export const WEAK_INDEX = 0.6;   // 反応率がこれ以下のテーマは、書き方を見直す
export const STRONG_INDEX = 1.5; // 反応率がこれ以上のテーマは、増やす候補

/** 数字から、次にやること(Act)を決める。key は週をまたいで同じ課題を見分けるため */
export function decideActions(m, prev) {
  const a = [];
  const add = (key, owner, text) => a.push({ key, owner, text });
  const c = m.collect, l = m.listing, s = m.social, pc = m.pc ?? {};
  if (c.daysAgo == null || c.daysAgo > TARGETS.collectStaleDays) add("collect-stale", "人", `週次の自動収集が ${c.date || "未実行"} から動いていません。Actions の weekly-collect を確認する`);
  if (c.errors > 0) add("collect-errors", "人", `収集元で ${c.errors} 件のエラー。週次収集の Issue のログを確認し、壊れた収集元を直すか止める`);
  if (c.held > TARGETS.heldMax) add("held", "人", `保留が ${c.held} 件(目安 ${TARGETS.heldMax} 件以下)。管理者用ページ(npm run admin)の「やること」で、掲載か却下を決める`);
  const bulk = Object.entries(c.heldReasons).find(([r, n]) => /多すぎる/.test(r) && n > 0);
  if (bulk) add("held-bulk", "Claude", `「${bulk[0]}」で ${bulk[1]} 件が保留。年度の切り替えなら、公式日程と照らして一括で掲載する`);
  if (c.sourceReviews > 0) add("source-reviews", "Claude", `確認待ちの収集元が ${c.sourceReviews} 件。公式ページを確かめ、自動掲載に回せるものは収集元に加える`);
  if (l.upcoming30 < TARGETS.upcoming30) add("listing-thin", "Claude", `今後30日の掲載が ${l.upcoming30} 件(目安 ${TARGETS.upcoming30} 件)。月次の調査で候補を探す`);
  if (l.emptyRegions30.length) add("regions-empty", "Claude", `今後30日の掲載が0件の地方: ${l.emptyRegions30.join("・")}。この地方の開催を、公式情報で今週調べる(月次の調査を待たない)`);
  if (l.timeUnknown14.length) add("time-unknown", "Claude", `2週間以内で開始時刻が未定の開催が ${l.timeUnknown14.length} 件(いちばん近いのは ${l.timeUnknown14[0].slice(0, 10)})。開催日の前に、公式の最新情報で時刻を確かめる`);
  // 枠をほぼ使い切っているのに紹介できなかった開催があるなら、失敗ではなく、枠より開催が多い(決めるのは運営者)
  const full = s.eventCapacity7 != null && s.last7.event >= s.eventCapacity7 * 0.8;
  if (s.missedEvents.length && full) add("social-capacity", "人", `開催のお知らせの枠(週 ${s.eventCapacity7} 本)より、紹介の時期に入る開催が多く、${s.missedEvents.length} 件を紹介できませんでした(予約の失敗ではありません)。枠を増やす(config.json の social.eventSlots)か、金曜の「今週末の神楽」のまとめ投稿に任せるかを決める`);
  else if (s.missedEvents.length) add("social-missed", "人", `SNSで紹介できないまま開催日を迎えたものが ${s.missedEvents.length} 件(過去7日の開催のお知らせは ${s.last7.event} 本)。Buffer の予約と post-social の実行を確認する`);
  if (s.expected7 != null && s.last7.event + s.last7.reading < s.expected7 * TARGETS.socialMinRatio) add("social-short", "人", `過去7日のSNS予約が ${s.last7.event + s.last7.reading} 本(予定は約 ${s.expected7} 本)。Buffer の予約の上限と、post-social の実行記録を確認する`);
  if (s.readingDaysLeft < TARGETS.readingDaysMin) add("readings-low", "Claude", `SNSの読み物の未投稿が、あと約 ${s.readingDaysLeft} 日分。data/kagura-info.json に出典つきの演目・見どころを足す`);
  const perf = s.performance ?? {};
  if (perf.status === "unavailable") add("social-metrics-unavailable", "人", `Buffer から投稿の反応を読めませんでした(${perf.reason || "理由不明"})。APIキーの期限と、反応の読み取り(insightsRead)が使えるかを確認する`);
  if (perf.status === "no_metrics") add("social-no-metrics", "人", `SNSの投稿はあるのに、反応の数字を評価できませんでした(${perf.reason || "理由不明"})。Buffer の画面で、投稿ごとの反応が出ているかを確認する。出ていなければ、反応による投稿の並べ替えと書き出しの改善は止まったままです`);
  // このPCで動く仕組みの脈。止まると、検索・売上の点検と改善(Check・Act)がまるごと抜ける
  if (pc.analysisDaysAgo != null && pc.analysisDaysAgo > TARGETS.analysisStaleDays) add("analysis-stale", "人", `このPCの分析が ${pc.analysisDate} から動いていません(${pc.analysisDaysAgo} 日)。3日に1回の 9:00 に PC と Claude アプリが開いているか、管理者用ページの「予定タスク」で止まった理由を確認し、「Run now」で動かす`);
  if (pc.noteDaysAgo != null && pc.noteDaysAgo > TARGETS.noteStaleDays) add("note-stale", "人", `note の投稿が ${pc.noteLastPost} から止まっています(${pc.noteDaysAgo} 日)。note のログイン切れか、予定の時刻に PC が閉じていた可能性。管理者用ページの「予定タスク」と NOTE-LOG.md を確認する`);
  for (const [t, v] of Object.entries(perf.themes ?? {})) {
    if (v.index != null && v.index <= WEAK_INDEX) add(`social-weak-${t}`, "Claude", `SNSの「${THEME_LABELS[t] ?? t}」は、反応率が全体の ${v.index} 倍。投稿の順番は自動で後ろに回しました。文面(最初の一文・切り口)を見直す`);
  }
  // 好み診断の定期メンテ(推薦の根拠が解説の本文なので、本文の書き換えや解説の追加に合わせて見直す)
  const q = m.quiz;
  if (q) {
    const few = (xs) => xs.slice(0, 5).join("、") + (xs.length > 5 ? ` ほか ${xs.length - 5} 件` : "");
    if (q.missing.length) add("quiz-evidence-missing", "Claude", `好み診断の根拠が解説に見つかりません(${few(q.missing)})。このままではサイトの組み立てが止まります。scripts/lib/quiz.mjs の根拠の場所を直す`);
    if (q.changed.length) add("quiz-evidence-changed", "Claude", `好み診断の根拠にしている解説の本文が変わりました(${few(q.changed)})。特徴の当てはめがまだ正しいか見直し、node scripts/quiz-review.mjs --accept で確認済みにする`);
    if (q.newKinds.length) add("quiz-new-kinds", "Claude", `解説がそろったのに、好み診断の対象外の神楽があります(${few(q.newKinds)})。根拠を付けて scripts/lib/quiz.mjs に加えるか、対象外の理由を QUIZ_EXCLUDED に書く`);
    if (q.uncovered.length) add("quiz-uncovered", "Claude", `掲載が多いのに解説がなく、好み診断に入れられない神楽: ${q.uncovered.slice(0, 5).map((u) => `${u.kind}(${u.n}件)`).join("、")}。出典つきの解説を data/kagura-info.json に足すと、診断と SNS の読み物に使える`);
    if (q.checkedDaysAgo > QUIZ_STALE_DAYS) add("quiz-stale", "Claude", `好み診断の全体の見直しから ${q.checkedDaysAgo} 日(目安 ${QUIZ_STALE_DAYS} 日)。質問の分かりやすさ、完了率・シェア(PCの分析で GA4 の quiz_start→quiz_complete)、対象の広げ方を見直し、QUIZ_CHECKED を更新する`);
  }
  if (prev && prev.listing && m.listing.upcoming30 < prev.listing.upcoming30 * 0.7) add("listing-drop", "Claude", `今後30日の掲載が先週の ${prev.listing.upcoming30} 件から ${m.listing.upcoming30} 件へ大きく減少。収集元の取りこぼしを確認する`);
  return a;
}

/**
 * 「やること」が何週つづいているかを付ける(Act が実際に進んでいるかの点検)。
 * 先週の記録(data/weekly-review.json)に同じ key があれば、始まった日(since)を引き継ぎ、週数を1つ足す。
 * 同じ日に作り直したときは、週数を足さない。
 * 返り値: { actions(since・weeks つき), resolved(先週あって、今週は消えた key), prevCount(先週の件数。初回は null) }
 */
export function ageActions(actions, prevState, todayJst) {
  const before = new Map((prevState?.actions ?? []).map((a) => [a.key, a]));
  const same = prevState?.updated === todayJst;
  const aged = actions.map((a) => {
    const b = before.get(a.key);
    if (!b) return { ...a, since: todayJst, weeks: 1 };
    return { ...a, since: b.since ?? prevState.updated ?? todayJst, weeks: (b.weeks ?? 1) + (same ? 0 : 1) };
  });
  const now = new Set(actions.map((a) => a.key));
  // 同じ日の作り直しでは、先週との比べ合わせ(解消の数)は前回の記録をそのまま使う
  const resolved = same ? prevState?.resolved ?? [] : [...before.keys()].filter((k) => !now.has(k));
  const prevCount = same ? prevState?.prevCount ?? null : prevState?.actions ? before.size : null;
  return { actions: aged, resolved, prevCount };
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

/** SNSの反応(テーマ別の相対値)の節。実数は出さない */
function renderPerformance(perf = {}) {
  const head = ["### SNSの反応(テーマ別。全体を 1 とした倍率)", ""];
  if (perf.status === "ok") {
    const rows = Object.entries(perf.themes ?? {}).sort((a, b) => (b[1].index ?? -1) - (a[1].index ?? -1));
    return [...head,
      `直近の投稿 ${perf.samples} 件から(反応率 = いいね・リポスト・返信 ÷ 表示回数)。反応のよいテーマは、翌日から自動で先に投稿します。`, "",
      "| テーマ | 投稿数 | 反応率 | 届きやすさ |", "|---|---|---|---|",
      ...rows.map(([t, v]) => `| ${THEME_LABELS[t] ?? t}${v.index != null && v.index >= STRONG_INDEX ? " ★" : ""} | ${v.n} | ${v.index ?? "様子見"} | ${v.reach ?? "様子見"} |`), ""];
  }
  const why = { no_data: "評価できる投稿がまだありません(反応の集計は投稿の約1日後)", no_metrics: `投稿はあるのに、反応の数字を評価できませんでした(${perf.reason || "理由不明"})`, no_key: "BUFFER_API_KEY が未設定です", unavailable: "Buffer から反応を読めませんでした", none: "まだ集めていません" }[perf.status] ?? perf.status;
  return [...head, why, ""];
}

const diff = (now, before) => (before == null ? "" : now === before ? "(先週と同じ)" : `(先週 ${before})`);

/** Issue の本文(Markdown) */
export function renderReview(m, prev, actions, carried = [], progress = null) {
  const p = prev ?? {};
  const l = m.listing, c = m.collect, s = m.social, pc = m.pc ?? {};
  const pulse = (date, days, none) => (date ? `前回 ${date}(${days === 0 ? "今日" : `${days} 日前`})` : none);
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
    `| SNS予約(過去7日) | 開催 ${s.last7.event} / 読み物 ${s.last7.reading}${s.expected7 != null ? `(予定は約 ${s.expected7} 本)` : ""} |`,
    `| SNSで紹介できなかった開催(過去7日) | ${s.missedEvents.length} 件 |`,
    `| SNSの読み物の残り | 未投稿 ${s.readingsUnposted} 本(約 ${s.readingDaysLeft} 日分) |`,
    `| このPCの週次の分析(検索・売上) | ${pulse(pc.analysisDate, pc.analysisDaysAgo, "公開の記録(data/media-stats.json)がありません")} |`,
    `| note の投稿 | ${pc.noteStatus === "ok" ? pulse(pc.noteLastPost, pc.noteDaysAgo, "投稿がありません") : "確認できませんでした(note の RSS を読めない)"} |`,
    "",
    "### 今後30日の掲載(地方別)",
    "",
    Object.entries(l.byRegion30).map(([r, n]) => `${r} ${n}${p.listing?.byRegion30?.[r] != null && p.listing.byRegion30[r] !== n ? `(先週 ${p.listing.byRegion30[r]})` : ""}`).join(" / "),
    "",
  ];
  if (l.timeUnknown14.length) lines.push("<details><summary>2週間以内で開始時刻が未定</summary>", "", ...l.timeUnknown14.map((x) => `- ${x}`), "", "</details>", "");
  if (s.missedEvents.length) lines.push("<details><summary>SNSで紹介できなかった開催</summary>", "", ...s.missedEvents.map((x) => `- ${x}`), "", "</details>", "");
  if (m.quiz) {
    const q = m.quiz;
    lines.push("### 好み診断", "", `対象 ${q.kinds} 種類 / 根拠の本文の変更 ${q.changed.length} 件 / 解説があるのに対象外 ${q.newKinds.length} 件 / 全体の見直し ${q.checked}(${q.checkedDaysAgo} 日前)`, "");
    if (q.noShows.length) lines.push(`いま掲載中の公演がない対象: ${q.noShows.join("、")}(結果の画面では、条件で観られる別の神楽を案内します)`, "");
  }
  lines.push(...renderPerformance(s.performance));
  lines.push(
    "## Act: 今週やること",
    "",
    "「人」は運営者が、「Claude」は Claude に「週次の振り返りの Claude の項目をやって」と頼むと進みます。終わったらチェックを付けてください。",
    "",
  );
  // 先週の「やること」が片付いたか(Act の点検)
  if (progress?.prevCount != null) lines.push(`先週の自動の「やること」${progress.prevCount} 件のうち、解消 ${progress.resolved.length} 件 / 今週も続いている ${progress.prevCount - progress.resolved.length} 件。`, "");
  if (!actions.length && !carried.length) lines.push("- 自動の点検では、気になる点はありませんでした");
  for (const x of actions) lines.push(`- [ ] ${x.weeks >= TARGETS.staleWeeks ? "⚠ " : ""}【${x.owner}】${x.text}${x.weeks > 1 ? `(${x.weeks} 週つづいています)` : ""} <!-- ${x.key} -->`);
  for (const x of carried) lines.push(`- [ ] (先週から) ${x.text} <!-- ${x.key} -->`);
  lines.push(
    "",
    "## このPCで見るもの(数字は公開しない)",
    "",
    "- [ ] 検索・アクセスの分析レポート(3日に1回 9:00 の定期タスク「検索・アクセス分析」が作る `analytics/` の最新ファイル)の改善案を、管理者用ページの「やること」で、Claude に頼むか見送るか決める <!-- manual-analytics -->",
    "- [ ] note: NOTE-LOG.md(このPC)の「時刻判明」「食い違い」メモがあれば、データを直す <!-- manual-note -->",
    "",
    "気づいたことは、この Issue にコメントで残してください。次の週の振り返りで、チェックの付いていない項目は持ち越されます。",
    "",
    `<!-- weekly-review ${m.date} -->`,
  );
  return lines.join("\n");
}

/** data/weekly-review.json: 最新の数字・やること・推移(Claude の定期タスクも、これを読んで次の計画に使う) */
export function nextState(state, m, actions, progress = null) {
  const history = [...(state?.history ?? []).filter((h) => h.date !== m.date), {
    date: m.date, upcoming14: m.listing.upcoming14, upcoming30: m.listing.upcoming30, upcoming60: m.listing.upcoming60,
    held: m.collect.held, published: m.collect.published, socialEvents: m.social.last7.event, socialReadings: m.social.last7.reading,
    // やることの数と、先週から解消した数(Act が進んでいるかの推移)
    actions: actions.length, ...(progress?.prevCount != null ? { resolved: progress.resolved.length } : {}),
  }].slice(-HISTORY_WEEKS);
  return {
    updated: m.date,
    metrics: m,
    actions,
    ...(progress ? { resolved: progress.resolved, prevCount: progress.prevCount } : {}),
    // 次の計画(Plan)への申し送り: 定期タスクがここを読む
    focus: {
      regions: m.listing.emptyRegions30.length ? m.listing.emptyRegions30 : Object.entries(m.listing.byRegion30).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([r]) => r),
      timeUnknown: m.listing.timeUnknown14,
      needReadings: m.social.readingDaysLeft < TARGETS.readingDaysMin,
    },
    history,
  };
}
