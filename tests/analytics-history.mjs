// 中長期の分析(scripts/lib/analytics-history.mjs)のテスト。実データは使わない(数字は架空)。
import { snapshotsFromRows, mergeSnapshots, monthlyTotals, monthlyChanges, rolling28, compareSnapshots, buildTrends } from "../scripts/lib/analytics-history.mjs";

const row = (source, breakdown, to, dimension, metrics, fetched = "2026-11-10 07:31:00") => ({
  ID: `${source}-${breakdown}-${to}-${dimension}`, source, breakdown, from: "x", to, dimension, metrics_json: JSON.stringify(metrics), quality: "q", fetched_at_JST: fetched,
});

export function analyticsHistoryTests({ ok, section }) {
  section("中長期の分析: 計測の内訳を履歴に残す");
  const rows = [row("GSC", "query", "2026-11-08", "神楽", [10, 100, 0.1, 5]), row("GSC", "query", "2026-11-08", "夜神楽", [2, 50, 0.04, 9]),
    row("GA4", "page", "2026-11-09", "/", [40]), { source: "GA4", breakdown: "page", to: "2026-11-09", dimension: "/bad", metrics_json: "壊れた" }];
  const snaps = snapshotsFromRows(rows);
  ok(snaps.length === 2 && snaps.find((s) => s.key === "GSC/query").rows["夜神楽"][1] === 50 && !snaps.find((s) => s.key === "GA4/page").rows["/bad"],
    "13_計測内訳 の行を、内訳と期間の末日ごとにまとめる(読めない行は捨てる)", JSON.stringify(snaps.map((s) => s.key)));
  const m1 = mergeSnapshots({}, snaps);
  ok(m1.changed.join() === "2026-11-08,2026-11-09" && m1.history["2026-11-08"].snapshots["GSC/query"], "新しい末日の内訳を残す");
  const again = mergeSnapshots(m1.history, snaps);
  ok(again.changed.length === 0, "同じ期間・同じ取得日時の内訳は、書き直さない");
  const newer = mergeSnapshots(m1.history, snapshotsFromRows([row("GA4", "page", "2026-11-09", "/", [42], "2026-11-11 07:31:00")]));
  ok(newer.changed.join() === "2026-11-09" && newer.history["2026-11-09"].snapshots["GA4/page"].rows["/"][0] === 42 && newer.history["2026-11-08"].snapshots["GSC/query"],
    "同じ期間でも、あとから取り直した内訳(GA4 は数字が直ることがある)で置き換え、ほかの内訳は消さない");
  const older = mergeSnapshots(newer.history, snapshotsFromRows([row("GA4", "page", "2026-11-09", "/", [1], "2026-11-09 07:31:00")]));
  ok(older.changed.length === 0, "古い取得日時の内訳では、上書きしない");

  section("中長期の分析: 月ごとの合計と比較");
  const days = {};
  for (let d = 1; d <= 30; d++) days[`2026-09-${String(d).padStart(2, "0")}`] = { sessions: 10, pv: 20, gscClicks: 2, gscImpr: 100, gscPos: 8 };
  for (let d = 1; d <= 10; d++) days[`2026-10-${String(d).padStart(2, "0")}`] = { sessions: 20, pv: 30, gscClicks: 4, gscImpr: 100, gscPos: 6 };
  days["2026-10-11"] = { gscClicks: 4, gscImpr: 300, gscPos: 2 }; // GA4 が返ってこなかった日
  const mt = monthlyTotals(days, "2026-10-11");
  ok(mt.length === 2 && mt[0].partial === false && mt[0].ga.sessions === 300 && mt[0].ga.days === 30 && mt[1].partial === true && mt[1].ga.days === 10 && mt[1].gsc.days === 11,
    "月ごとに足し、値が返ってきた日数を残す(返ってこなかった日は 0 にしない。今月・欠けた月は「途中」)", JSON.stringify(mt[1]));
  ok(mt[1].gsc.position === 5.1, "掲載順位は表示回数で重み付けする(単純平均にしない)", String(mt[1].gsc.position));
  const ch = monthlyChanges(mt);
  ok(ch[1].vsPrevMonth.sessionsPerDay === 100 && ch[0].vsPrevMonth === null && ch[1].vsLastYear === null, "前月比は1日あたりで比べる(前年の同じ月がなければ比べない)", JSON.stringify(ch[1].vsPrevMonth));
  const onlyGsc = monthlyChanges(monthlyTotals({ "2026-08-01": { gscClicks: 1, gscImpr: 10 }, "2026-09-01": { sessions: 5, gscClicks: 1, gscImpr: 10 } }));
  ok(onlyGsc[1].vsPrevMonth.sessionsPerDay === null, "前の月に GA4 の値がなければ、セッションの増減は出さない(-100% にしない)");
  const r = rolling28(days);
  ok(r.at(-1).to === "2026-10-11" && r.at(-1).from === "2026-09-14" && r.at(-1).sessions === 370 && r.at(-1).gaDays === 27 && r.at(-1).gscClicks === 78,
    "28日の合計を、直近の日から7日ずつさかのぼって出す", JSON.stringify(r.at(-1)));
  const gappy = {};
  for (let d = 1; d <= 28; d++) gappy["2026-11-" + String(d).padStart(2, "0")] = d <= 20 ? { sessions: 5, gscClicks: 1, gscImpr: 9 } : { gscClicks: 1, gscImpr: 9 };
  const rg = rolling28(gappy);
  ok(rg.length === 1 && rg[0].sessions === null && rg[0].gaDays === 20 && rg[0].gscClicks === 28,
    "28日の合計は、返ってきた日が24日に満たない指標を出さない(0 にもしない)", JSON.stringify(rg));

  section("中長期の分析: 内訳を重ならない28日ずつ比べる");
  const snap = (to, rows) => ({ key: "GSC/query", from: "x", to, rows });
  const now = snap("2026-12-06", { 神楽: [30, 300, 0.1, 3], 夜神楽: [1, 80, 0.01, 12], 新しい語: [5, 60, 0.08, 4] });
  const before = snap("2026-11-08", { 神楽: [10, 200, 0.05, 6], 夜神楽: [8, 90, 0.09, 7], 消えた語: [3, 40, 0.07, 5], 小さい語: [0, 3, 0, 20] });
  const c = compareSnapshots(now, before, { gsc: true });
  ok(c.risers[0].key === "神楽" && c.fallers[0].key === "夜神楽" && c.added[0].key === "新しい語" && c.dropped[0].key === "消えた語",
    "伸びた・落ちた・上位に出てきた・上位から外れた検索語を分ける", JSON.stringify(c));
  ok(c.positionUp.some((x) => x.key === "神楽") && c.positionDown.some((x) => x.key === "夜神楽") && !JSON.stringify(c).includes("小さい語"),
    "掲載順位の上下も出し、表示回数が小さすぎる語は比べない");
  const history = {
    "2026-11-08": { to: "2026-11-08", snapshots: { "GSC/query": before } },
    "2026-12-06": { to: "2026-12-06", snapshots: { "GSC/query": now } },
  };
  const t = buildTrends({ series: { days }, history, today: "2026-12-07" });
  ok(t.breakdowns["GSC/query"].vsPrev28 && t.breakdowns["GSC/query"].vs3MonthsAgo === null && t.history.snapshots === 2 && t.monthly.length === 2,
    "28日前に近い内訳があれば比べ、3か月前の内訳がなければ比べない");
  const t1 = buildTrends({ series: null, history: { "2026-11-08": history["2026-11-08"] }, today: "2026-11-13" });
  ok(t1.breakdowns["GSC/query"].vsPrev28 === null && t1.breakdowns["GSC/query"].prev28AvailableFrom === "2026-12-01" && t1.monthly.length === 0,
    "比べる過去がまだなければ、いつから比べられるかを返す(日ごとの記録がなくても止まらない)", JSON.stringify(t1.breakdowns["GSC/query"]));
}
