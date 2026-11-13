// 週次の振り返り(PDCA): 数字・やること・持ち越し・ワークフローのつながりのテスト(外部へは送らない)
import { readFileSync } from "node:fs";
import YAML from "yaml";
import { reviewMetrics, decideActions, ageActions, carryOver, renderReview, nextState, TARGETS, HISTORY_WEEKS } from "../scripts/lib/weekly-review.mjs";
import { lastPostDay } from "../scripts/note-pulse.mjs";

export function weeklyReviewTests({ ok, section }) {
  section("週次の振り返り(PDCA): 数字とやること");
  const ev = (id, start, pref = "島根県", extra = {}) => ({ id, name: id, start, prefecture: pref, status: "published", ...extra });
  const events = [
    ev("a", "2026-11-10T13:00"), ev("b", "2026-11-20T00:00", "宮崎県"), ev("c", "2026-12-20T10:00", "高知県"),
    ev("old", "2026-11-05T10:00"), ev("missed", "2026-11-06T10:00"), ev("pend", "2026-11-12T10:00", "島根県", { status: "pending" }),
  ];
  const summary = { date: "2026-11-09", published: 1, held: 12, withdrawn: 0, errors: 0, items: { held: [{ reason: "一度の新規が多すぎる" }, { reason: "場所が不明" }] }, sourceReviews: [{}] };
  const posted = [{ id: "old", type: "event", date: "2026-10-30" }, { id: "r:kind:石見神楽", type: "reading", date: "2026-11-08" }];
  const info = { 石見神楽: { source: "出典", intro: "紹介。", programs: [{ name: "塩祓", text: "舞。" }] } };
  const m = reviewMetrics({ events, summary, posted, info, sources: [{ enabled: true }, { enabled: false }], todayJst: "2026-11-09", baseUrl: "https://kagurameguri.jp" });
  ok(m.listing.upcoming14 === 2 && m.listing.upcoming30 === 2 && m.listing.upcoming60 === 3, "掲載中の今後14/30/60日を数え、保留中・終わった開催は数えない", JSON.stringify(m.listing));
  ok(m.listing.byRegion30["中国"] === 1 && m.listing.byRegion30["九州・沖縄"] === 1 && m.listing.emptyRegions30.includes("四国"), "地方別に数え、0件の地方を挙げる");
  ok(m.listing.timeUnknown14.join() === "2026-11-20 b", "2週間以内で開始時刻が未定(00:00)のものを挙げる");
  ok(m.social.last7.reading === 1 && m.social.missedEvents.join() === "2026-11-06 missed", "過去7日のSNS予約と、紹介できずに開催日を迎えた開催を数える(予約を始める前の開催は除く)", JSON.stringify(m.social));
  ok(m.social.readingsUnposted === 1 && m.collect.sourcesEnabled === 1 && m.collect.sourcesDisabled === 1, "読み物の残り(案内ページを除く)と、収集元の稼働数を数える");
  ok(reviewMetrics({ events, posted: [], todayJst: "2026-11-09" }).social.missedEvents.length === 0, "SNSの記録が空なら、取りこぼしを数えない");

  const acts = decideActions(m, { listing: { upcoming30: 10 } });
  const keys = acts.map((a) => a.key);
  for (const k of ["held", "held-bulk", "source-reviews", "listing-thin", "regions-empty", "time-unknown", "social-missed", "readings-low", "listing-drop"]) ok(keys.includes(k), `目安から外れたら「${k}」をやることにする`);
  ok(!keys.includes("collect-stale") && !keys.includes("collect-errors"), "収集が動いていて、エラーがなければ、収集の項目は出さない");
  ok(decideActions({ ...m, collect: { ...m.collect, date: "2026-10-26", daysAgo: 14 } }, null).some((a) => a.key === "collect-stale"), `収集が ${TARGETS.collectStaleDays} 日より前なら、止まっていると知らせる`);
  ok(acts.every((a) => ["人", "Claude"].includes(a.owner)), "やることには、担当(人 / Claude)を付ける");

  section("週次の振り返り(PDCA): 持ち越しと記録");
  const body = [
    "- [ ] 【人】保留が 25 件 <!-- held -->",
    "- [x] 【Claude】終わった項目 <!-- carry-1 -->",
    "- [ ] (先週から) 高千穂の写真を差し替える <!-- carry-2 -->",
    "- [ ] Search Console を見る <!-- manual-gsc -->",
    "- [ ] 人が書き足した項目",
  ].join("\r\n");
  const carried = carryOver(body);
  ok(carried.map((c) => c.text).join("|") === "高千穂の写真を差し替える|人が書き足した項目", "持ち越すのは、未完了の手書きの項目と持ち越し中の項目だけ(自動の点検・手で見る数字・完了済みは持ち越さない)", JSON.stringify(carried));
  ok(carried.every((c, i) => c.key === `carry-${i + 1}`), "持ち越しの項目に、次の週も見分けられる印を付ける");

  const md = renderReview(m, { listing: { upcoming14: 2, upcoming30: 5, byRegion30: { 中国: 3 } } }, acts, carried);
  ok(md.includes("今後14日の掲載 | 2 件(先週と同じ)") && md.includes("今後30日の掲載 | 2 件(先週 5)") && md.includes("中国 1(先週 3)"), "先週の数字と並べて見せる");
  ok(acts.every((a) => md.includes(`<!-- ${a.key} -->`)) && md.includes("(先週から) 高千穂の写真を差し替える <!-- carry-1 -->"), "やることと持ち越しを、印つきのチェックリストにする");
  ok(carryOver(md).map((c) => c.text).join("|") === "高千穂の写真を差し替える|人が書き足した項目", "作った本文を翌週に読み直しても、同じ項目だけが持ち越される(増えない)");

  const st = nextState({ history: Array.from({ length: HISTORY_WEEKS }, (_, i) => ({ date: `2026-0${(i % 9) + 1}-01` })) }, m, acts);
  ok(st.history.length === HISTORY_WEEKS && st.history.at(-1).date === "2026-11-09" && st.history.at(-1).upcoming30 === 2, `推移は直近 ${HISTORY_WEEKS} 週を残す`);
  ok(st.focus.regions.includes("四国") && st.focus.timeUnknown.length === 1 && st.focus.needReadings === true, "次の計画への申し送り(力を入れる地方・時刻の確認・読み物の補充)を残す");
  ok(nextState(st, m, acts).history.filter((h) => h.date === "2026-11-09").length === 1, "同じ日に作り直しても、推移は重複しない");

  section("週次の振り返り(PDCA): このPCの仕組みの見張り(分析・note)");
  const base = { events, summary, posted, info, todayJst: "2026-11-23" };
  const alive = reviewMetrics({ ...base, mediaStats: { updated: "2026-11-20" }, note: { status: "ok", lastPost: "2026-11-21" } });
  ok(alive.pc.analysisDaysAgo === 3 && alive.pc.noteDaysAgo === 2 && !decideActions(alive, null).some((a) => /^(analysis|note)-stale$/.test(a.key)), "分析(3日に1回)が3日前に動き、note が2日前に出ていれば、何も出さない", JSON.stringify(alive.pc));
  const dead = reviewMetrics({ ...base, mediaStats: { updated: "2026-11-09" }, note: { status: "ok", lastPost: "2026-11-08" } });
  const deadActs = decideActions(dead, null);
  ok(deadActs.some((a) => a.key === "analysis-stale" && a.owner === "人" && a.text.includes("2026-11-09") && a.text.includes("14 日")), `分析の公開の跡が ${TARGETS.analysisStaleDays} 日より前なら、止まっていると知らせる`);
  ok(deadActs.some((a) => a.key === "note-stale" && a.owner === "人" && a.text.includes("2026-11-08")), `note の最後の投稿が ${TARGETS.noteStaleDays} 日より前なら、止まっていると知らせる`);
  const blind = reviewMetrics({ ...base, mediaStats: null, note: { status: "unavailable", lastPost: null } });
  ok(blind.pc.analysisDaysAgo === null && blind.pc.noteDaysAgo === null && !decideActions(blind, null).some((a) => /^(analysis|note)-stale$/.test(a.key)), "跡を読めないときは、止まっているとは決めつけない(0日とも扱わない)");
  const pulseMd = renderReview(dead, null, deadActs, []);
  ok(pulseMd.includes("| このPCの週次の分析(検索・売上) | 前回 2026-11-09(14 日前) |") && pulseMd.includes("| note の投稿 | 前回 2026-11-08(15 日前) |") && renderReview(blind, null, [], []).includes("確認できませんでした(note の RSS を読めない)"), "分析と note の前回の日付を、数字の表に出す(読めなければ、そう書く)");
  const rss = '<rss version="2.0"><channel><item><title>a</title><pubDate>Mon, 19 Oct 2026 13:53:19 +0900</pubDate></item><item><title>b</title><pubDate>Sat, 07 Nov 2026 23:30:00 +0000</pubDate></item></channel></rss>';
  ok(lastPostDay(rss) === "2026-11-08" && lastPostDay('<rss version="2.0"><channel></channel></rss>') === null, "note の RSS から、いちばん新しい投稿の日を日本時間で読む(投稿がなければ「なし」)");
  let threw = false; try { lastPostDay("<html>ログイン</html>"); } catch { threw = true; }
  ok(threw, "RSS でない応答は、投稿なしと取り違えない(読めなかったとして扱う)");

  section("週次の振り返り(PDCA): SNSの予約の本数");
  const many = Array.from({ length: 20 }, (_, i) => ({ id: `r:kind:x${i}`, type: "reading", date: i < 10 ? "2026-11-01" : "2026-11-18" }));
  const short = reviewMetrics({ ...base, posted: many, perDay: 6 });
  ok(short.social.expected7 === 42 && decideActions(short, null).some((a) => a.key === "social-short" && a.text.includes("10 本") && a.text.includes("42 本")), `過去7日の予約が、予定(1日の枠×7)の ${TARGETS.socialMinRatio * 100}% を切ったら知らせる`, JSON.stringify(short.social));
  ok(reviewMetrics({ ...base, posted: many.map((p) => ({ ...p, date: "2026-11-20" })), perDay: 6 }).social.expected7 === null, "予約を始めて7日たつまでは、本数を比べない");
  const evPosts = Array.from({ length: 13 }, (_, i) => ({ id: `e${i}`, type: "event", date: i ? "2026-11-18" : "2026-10-20" }));
  const lateEv = [ev("late", "2026-11-20T10:00")];
  const capActs = decideActions(reviewMetrics({ ...base, events: lateEv, posted: evPosts, eventsPerDay: 2 }), null);
  ok(capActs.some((a) => a.key === "social-capacity" && a.text.includes("週 14 本") && a.text.includes("予約の失敗ではありません")) && !capActs.some((a) => a.key === "social-missed"), "枠をほぼ使い切っていて紹介できなかった開催は、予約の失敗ではなく「枠より開催が多い」と知らせる", JSON.stringify(capActs.map((a) => a.key)));
  const failActs = decideActions(reviewMetrics({ ...base, events: lateEv, posted: evPosts.slice(0, 3), eventsPerDay: 2 }), null);
  ok(failActs.some((a) => a.key === "social-missed") && !failActs.some((a) => a.key === "social-capacity"), "枠が余っているのに紹介できなかった開催は、予約の失敗として確認を頼む");
  const noMet = reviewMetrics({ ...base, performance: { status: "no_metrics", reason: "送信済みの 9 件に、表示回数・反応の数字が付いていない", samples: 0, themes: {} } });
  ok(decideActions(noMet, null).some((a) => a.key === "social-no-metrics" && a.owner === "人") && renderReview(noMet, null, [], []).includes("投稿はあるのに、反応の数字を評価できませんでした"), "投稿はあるのに反応を評価できないときは、「まだ投稿がない」と分けて、人に確認を頼む");

  section("週次の振り返り(PDCA): やることが進んでいるか");
  const w1 = ageActions([{ key: "time-unknown", owner: "Claude", text: "t" }, { key: "held", owner: "人", text: "h" }], null, "2026-11-09");
  ok(w1.actions.every((a) => a.weeks === 1 && a.since === "2026-11-09") && w1.prevCount === null && w1.resolved.length === 0, "初回は、どの項目も1週めで、先週との比べ合わせはしない");
  const s1 = { updated: "2026-11-09", actions: w1.actions };
  const w2 = ageActions([{ key: "time-unknown", owner: "Claude", text: "t" }, { key: "regions-empty", owner: "Claude", text: "r" }], s1, "2026-11-16");
  ok(w2.actions[0].weeks === 2 && w2.actions[0].since === "2026-11-09" && w2.actions[1].weeks === 1 && w2.resolved.join() === "held" && w2.prevCount === 2, "先週もあった項目は週数を足し、消えた項目は「解消」と数える", JSON.stringify(w2));
  const s2 = nextState(s1, m, w2.actions, w2);
  const again = ageActions([{ key: "time-unknown", owner: "Claude", text: "t" }], { ...s2, updated: "2026-11-16" }, "2026-11-16");
  ok(again.actions[0].weeks === 2 && again.resolved.join() === "held" && again.prevCount === 2, "同じ日に作り直しても、週数は増えず、解消の数も変わらない");
  const w3 = ageActions([{ key: "time-unknown", owner: "Claude", text: "時刻を確かめる" }], { updated: "2026-11-16", actions: w2.actions }, "2026-11-23");
  const md3 = renderReview(m, null, w3.actions, [], w3);
  ok(md3.includes("- [ ] ⚠ 【Claude】時刻を確かめる(3 週つづいています) <!-- time-unknown -->") && md3.includes("先週の自動の「やること」2 件のうち、解消 1 件 / 今週も続いている 1 件。"), `${TARGETS.staleWeeks} 週つづいた項目は目立たせ、先週から何件片付いたかを出す`, md3.split("\n").filter((l) => /やること|time-unknown/.test(l)).join(" / "));
  ok(carryOver(md3).length === 0, "週数の印が付いても、自動の項目は持ち越しに入らない(二重にならない)");
  ok(s2.history.at(-1).actions === 2 && s2.history.at(-1).resolved === 1 && s2.resolved.join() === "held", "やることの数と解消の数を、推移に残す", JSON.stringify(s2.history.at(-1)));

  section("週次の振り返り(PDCA): 自動化のつながり");
  const read = (f) => readFileSync(f, "utf8").replace(/\r\n?/g, "\n");
  const wr = YAML.parse(read(".github/workflows/weekly-review.yml"));
  ok(wr.on?.workflow_run?.workflows?.includes("weekly-collect") && wr.on.workflow_run.types?.includes("completed") && "workflow_dispatch" in wr.on, "振り返りは、週次の自動収集が終わったら動く(手動でも動かせる)");
  ok(/workflow_run\.event == 'schedule'/.test(wr.jobs.review.if) && /head_branch == 'main'/.test(wr.jobs.review.if), "収集の手動の試運転のあとでは、振り返りを作らない");
  const steps = wr.jobs.review.steps;
  ok(steps.filter((s) => s.uses).every((s) => /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/.test(s.uses)) && /# v\d+\.\d+\.\d+/.test(read(".github/workflows/weekly-review.yml")), "外部のアクションは、コミットSHAで固定する");
  const wrText = read(".github/workflows/weekly-review.yml");
  ok(/git add data\/weekly-review\.json data\/social-performance\.json\n/.test(wrText) && !/git add -A|git add \./.test(wrText), "コミットするのは、振り返りと SNS の相対値のファイルだけ");
  const secretSteps = steps.filter((s) => JSON.stringify(s).includes("secrets."));
  ok(secretSteps.length === 1 && secretSteps[0].name === "social-metrics" && Object.keys(secretSteps[0].env).join() === "BUFFER_API_KEY" && [...wrText.matchAll(/secrets\.(\w+)/g)].every((m) => m[1] === "BUFFER_API_KEY"), "秘密情報は BUFFER_API_KEY だけで、反応を集める手順にだけ渡す");
  ok(steps.findIndex((s) => s.name === "social-metrics") < steps.findIndex((s) => s.run === "node scripts/weekly-review.mjs"), "反応を集めてから、振り返りを作る");
  const pulseStep = steps.find((s) => s.name === "note-pulse"), reviewStep = steps.find((s) => s.run === "node scripts/weekly-review.mjs");
  ok(pulseStep?.run === "node scripts/note-pulse.mjs" && steps.indexOf(pulseStep) < steps.indexOf(reviewStep) && pulseStep.env.NOTE_PULSE_FILE === reviewStep.env.NOTE_PULSE_FILE && /runner\.temp/.test(pulseStep.env.NOTE_PULSE_FILE), "note の最後の投稿日を読んでから、振り返りを作る(読んだ結果はコミットしない)");
  ok(/^[\w-]+$/.test(JSON.parse(read("config.json").replace(/^﻿/, "")).note?.urlname ?? ""), "note のアカウント名(公開の RSS を読む先)が、設定にある");
  ok(/gh issue close "\$n"/.test(wrText) && /startswith\("週次の振り返り\("\)/.test(wrText), "先週の振り返り(失敗の知らせは除く)を閉じて、次に引き継ぐ");
  const collect = read(".github/workflows/collect.yml");
  ok(/gh issue close "\$n"/.test(collect) && /startswith\("週次の自動収集: 確認が必要な項目があります"\)/.test(collect), "週次収集の確認依頼は、新しいものを立てたら古いものを閉じる");
  const social = YAML.parse(read(".github/workflows/post-social.yml"));
  const [ch, cm] = YAML.parse(collect).on.schedule[0].cron.split(" ").slice(0, 2).reverse().map(Number);
  const crons = social.on.schedule.map((s) => s.cron.split(" ").slice(0, 2).reverse().map(Number));
  // 月曜の朝の起動(空き枠の埋め直し)は、週次収集の1時間以上あと。晩の起動(翌日分)は、朝の枠に間に合うよう前の晩
  ok(crons.some(([h, m]) => (h * 60 + m) - (ch * 60 + cm) >= 60 && h < 22), "SNSの朝の予約は、週次収集の1時間以上あと(収集で増えた開催を使える)", `${ch}:${cm} → ${crons.map((c) => c.join(":")).join(",")}`);
  ok(crons.some(([h]) => h >= 9 && h <= 14), "SNSの翌日分は、前の晩(日本時間18〜23時)に予約する(起動が遅れても朝7時の枠に間に合う)", crons.map((c) => c.join(":")).join(","));
  ok(/gh issue comment "\$n"/.test(read(".github/workflows/post-social.yml")), "SNSの失敗が続いても、Issue を増やさず追記する");
}
