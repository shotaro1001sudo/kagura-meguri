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
  ok(summarizePerformance([], [], today).status === "no_data" && summarizePerformance([], posted.slice(-1), today).status === "no_data", "予約がまだない(集計待ちの直近だけ)なら no_data");
  const gone = summarizePerformance([], posted, today);
  ok(gone.status === "no_metrics" && /Buffer の送信済みに見つからない/.test(gone.reason), "予約の記録があるのに送信済みに見つからなければ、no_data と分けて no_metrics にする", JSON.stringify(gone));
  const bare = summarizePerformance(buffer.map((b) => ({ ...b, metrics: [] })), posted, today);
  ok(bare.status === "no_metrics" && /13 件に、表示回数・反応の数字が付いていない/.test(bare.reason) && bare.samples === 0, "送信済みなのに反応の数字が付いていなければ、no_metrics にする(読み取りの不調に気づける)", JSON.stringify(bare));

  section("SNSの反応の評価(PDCA): 時間帯・書き方・上位と下位");
  ok(perf.slots["07"]?.n === 13 && perf.slots["07"].index === 1, "時間帯(日本時間の時)ごとに、件数と相対値を出す", JSON.stringify(perf.slots));
  ok(perf.styles.label?.n === 9 && perf.styles.event?.n === 4 && perf.styles.manual?.n === 1 && perf.styles.manual.index === null, "書き方ごと(見出しから / 開催 / 手で入れた投稿)に比べる。手で入れた投稿も、書き方の比べ合わせには使う", JSON.stringify(perf.styles));
  ok(perf.top.length === 5 && perf.top.slice(0, 4).every((id) => id.startsWith("r:program:")) && perf.bottom.length === 5 && perf.bottom.slice(0, 4).every((id) => id.startsWith("r:history:")), "反応率の上位・下位の投稿を、IDだけで5件ずつ出す", JSON.stringify({ top: perf.top, bottom: perf.bottom }));
  const few = summarizePerformance(buffer.slice(0, 4), posted, today);
  ok(few.top.length === 0 && few.bottom.length === 0, "投稿が少ないうちは、上位・下位を出さない");
  const hp = posted.map((p, i) => (i < 4 ? { ...p, style: "hook" } : p));
  ok(summarizePerformance(buffer, hp, today).styles.hook?.n === 4, "書き出しの1行をつけた投稿(style: hook)を、別に数える");
  // URLあり・なし: 記録に link がない以前の予約はURLあり。開催のお知らせ(常にURLあり)は比べ合わせに入れない
  ok(perf.links.url?.n === 9 && !perf.links.nourl, "link の記録がない以前の読み物は、URLありとして数える(開催は除く)", JSON.stringify(perf.links));
  const lp = posted.map((p) => (p.id.startsWith("r:program:") ? { ...p, link: false } : p));
  const lperf = summarizePerformance(buffer, lp, today);
  ok(lperf.links.nourl?.n === 4 && lperf.links.url?.n === 5 && lperf.links.nourl.index > lperf.links.url.index, "URLなしの読み物を別に数え、反応率を比べられる", JSON.stringify(lperf.links));

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
