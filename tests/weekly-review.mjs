// 週次の振り返り(PDCA): 数字・やること・持ち越し・ワークフローのつながりのテスト(外部へは送らない)
import { readFileSync } from "node:fs";
import YAML from "yaml";
import { reviewMetrics, decideActions, carryOver, renderReview, nextState, TARGETS, HISTORY_WEEKS } from "../scripts/lib/weekly-review.mjs";

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
  ok(/gh issue close "\$n"/.test(wrText) && /startswith\("週次の振り返り\("\)/.test(wrText), "先週の振り返り(失敗の知らせは除く)を閉じて、次に引き継ぐ");
  const collect = read(".github/workflows/collect.yml");
  ok(/gh issue close "\$n"/.test(collect) && /startswith\("週次の自動収集: 確認が必要な項目があります"\)/.test(collect), "週次収集の確認依頼は、新しいものを立てたら古いものを閉じる");
  const social = YAML.parse(read(".github/workflows/post-social.yml"));
  const [ch, cm] = YAML.parse(collect).on.schedule[0].cron.split(" ").slice(0, 2).reverse().map(Number);
  const [sh, sm] = social.on.schedule[0].cron.split(" ").slice(0, 2).reverse().map(Number);
  ok((sh * 60 + sm) - (ch * 60 + cm) >= 60, "SNSの予約は、週次収集の1時間以上あと(収集で増えた開催を使える)", `${ch}:${cm} → ${sh}:${sm}`);
  ok(/gh issue comment "\$n"/.test(read(".github/workflows/post-social.yml")), "SNSの失敗が続いても、Issue を増やさず追記する");
}
