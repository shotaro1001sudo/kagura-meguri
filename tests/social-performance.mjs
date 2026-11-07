// SNSの反応の評価: テーマ別の相対値・投稿順への反映・振り返りへの表示(外部へは送らない)
import { themeOf, readMetrics, summarizePerformance, themeWeights, MIN_SAMPLES } from "../scripts/lib/social-performance.mjs";
import { pickReadings, readingCandidates } from "../scripts/lib/x-post.mjs";
import { reviewMetrics, decideActions, renderReview } from "../scripts/lib/weekly-review.mjs";
import { sentPostsQuery } from "../scripts/social-metrics.mjs";

export function socialPerformanceTests({ ok, section }) {
  section("SNSの反応の評価(PDCA): テーマ別の相対値");
  ok(themeOf("r:program:石見神楽:0") === "program" && themeOf("r:page:weekend:2026-11-13") === "page" && themeOf("akitakata-123") === "event", "投稿IDからテーマを決める(開催 / 読み物のテーマ)");
  ok(JSON.stringify(readMetrics([{ type: "impressions", value: 100 }, { type: "reactions", value: 3 }, { type: "reposts", value: 1 }, { type: "comments", value: 0 }])) === '{"views":100,"engagements":4}', "表示回数と、反応(いいね・リポスト・返信)の合計を取り出す");
  ok(readMetrics([{ type: "reactions", value: 3 }]).views === null && readMetrics([]).engagements === null, "表示回数・反応がない投稿は 0 ではなく「なし」と扱う");

  const today = "2026-11-20";
  const posted = [], buffer = [];
  const add = (id, day, views, eng) => {
    const b = `b-${posted.length}`;
    posted.push({ id, bufferId: b, type: id.startsWith("r:") ? "reading" : "event", date: day });
    buffer.push({ id: b, dueAt: `${day}T07:00:00+09:00`, metrics: [{ type: "impressions", value: views }, { type: "reactions", value: eng }] });
  };
  for (let i = 0; i < 4; i++) add(`r:program:k:${i}`, `2026-11-0${i + 2}`, 100, 10); // 反応率 10%
  for (let i = 0; i < 4; i++) add(`r:history:k:${i}`, `2026-11-0${i + 2}`, 100, 2);  // 反応率 2%
  for (let i = 0; i < 4; i++) add(`ev-${i}`, `2026-11-0${i + 2}`, 300, 15);          // 反応率 5%、よく届く
  add("r:viewing:k:0", "2026-11-05", 100, 5);                                          // 1件だけ(様子見)
  add("r:program:k:9", "2026-11-19", 100, 50);                                         // 直近(集計待ち)なので除く
  buffer.push({ id: "other", dueAt: "2026-11-05T07:00:00+09:00", metrics: [{ type: "impressions", value: 1 }, { type: "reactions", value: 1 }] }); // 別経路の投稿
  const perf = summarizePerformance(buffer, posted, today);
  ok(perf.status === "ok" && perf.samples === 13, "このサイトの予約で入れた投稿のうち、集計の済んだものだけを使う", JSON.stringify(perf));
  ok(perf.themes.program.index === 2 && perf.themes.history.index === 0.4 && perf.themes.event.index === 1, "反応率を、全体の中央値に対する倍率にする", JSON.stringify(perf.themes));
  ok(perf.themes.event.reach === 3 && perf.themes.program.reach === 1, "届きやすさ(表示回数)も、全体に対する倍率にする");
  ok(perf.themes.viewing.n === 1 && perf.themes.viewing.index === null, `投稿が ${MIN_SAMPLES} 件未満のテーマは、評価しない(様子見)`);
  ok(!JSON.stringify(perf).includes("300") && !/"views"|"engagements"/.test(JSON.stringify(perf)), "結果には、表示回数などの実数を残さない(公開リポジトリのため)");
  ok(summarizePerformance([], posted, today).status === "no_data", "評価できる投稿がなければ no_data");

  section("SNSの反応の評価(PDCA): 投稿の順番に反映");
  const w = themeWeights(perf);
  ok(w.program === 1.5 && w.history === 0.7 && w.event === 2 && !("viewing" in w), "重みは、反応率と届きやすさの平均。様子見のテーマは重みなし", JSON.stringify(w));
  const info = {
    石見神楽: { source: "出典", intro: "紹介。", programs: [{ name: "塩祓", text: "舞。" }], history: ["歴史。"], features: ["特徴。"], viewing: ["コツ。"] },
  };
  const cands = readingCandidates(info, "https://kagurameguri.jp", "2026-11-17"); // 火曜(先頭は「神楽を知る」)
  const themes = (weights) => pickReadings(cands, [], "2026-11-17", 3, weights).map((c) => c.theme).join();
  ok(themes({}) === "kind,program,history", "重みがなければ、これまでの順", themes({}));
  ok(themes({ history: 0.4, feature: 1.8 }) === "kind,feature,program", "曜日のテーマは先頭のまま、残りは反応のよい順。反応の弱いテーマは後ろに回る", themes({ history: 0.4, feature: 1.8 }));

  section("SNSの反応の評価(PDCA): 振り返りへの表示と、やること");
  const m = reviewMetrics({ todayJst: today, performance: perf });
  const acts = decideActions(m, null);
  ok(acts.some((a) => a.key === "social-weak-history" && a.owner === "Claude") && !acts.some((a) => a.key === "social-weak-program"), "反応率の弱いテーマだけを、文面の見直しとして「やること」にする");
  const md = renderReview(m, null, acts, []);
  ok(md.includes("| 神楽の演目 ★ | 4 | 2 | 1 |") && md.includes("| 神楽の見学のコツ | 1 | 様子見 | 様子見 |"), "テーマ別の倍率を表にし、よいテーマに印を付ける");
  const un = reviewMetrics({ todayJst: today, performance: { status: "unavailable", reason: "権限なし", samples: 0, themes: {} } });
  ok(decideActions(un, null).some((a) => a.key === "social-metrics-unavailable" && a.owner === "人") && renderReview(un, null, [], []).includes("Buffer から反応を読めませんでした"), "反応を読めなかったときは、人に確認を頼む");

  section("SNSの反応の評価(PDCA): Buffer への問い合わせ");
  const q = sentPostsQuery({ organizationId: "org1", channelId: "ch1", after: "c1" });
  ok(/posts\(first: 50, after: "c1", input:/.test(q) && /status: \[sent\], channelIds: \["ch1"\]/.test(q) && /metrics \{ type value \}/.test(q) && /pageInfo \{ endCursor hasNextPage \}/.test(q), "送信済みの投稿を、反応つきで、ページごとに読む");
  ok(!/after/.test(sentPostsQuery({ organizationId: "o", channelId: "c" })), "最初のページには、続きの印(after)を付けない");
}
