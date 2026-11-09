// SNS投稿: 選び方・文面・時刻の割り当て・Buffer への送信文のテスト(外部へは送らない)
import { pickEvents, composeText, composeReading, weightedLength, readingCandidates, pickReadings, daySlots, planDay, planDays, validHook, RERUN_GAP_DAYS } from "../scripts/lib/x-post.mjs";
import { mergeHooks } from "../scripts/social-hooks.mjs";
import { createPostQuery, keyExpiryNotice } from "../scripts/post-social.mjs";

export function xpostTests({ ok, section }) {
  section("SNS投稿: 選び方・文面・時刻");
  const base = "https://kagurameguri.jp";
  const ev = (id, start, extra = {}) => ({ id, name: id, start, prefecture: "島根県", city: "益田市", kagura: "石見神楽", status: "published", ...extra });
  const events = [ev("a", "2026-11-05T10:00"), ev("b", "2026-11-20T10:00"), ev("c", "2026-11-03T10:00"), ev("d", "2026-11-08T10:00", { status: "pending" }), ev("e", "2026-11-09T10:00"), ev("f", "2026-11-10T10:00"), ev("g", "2026-11-12T10:00")];
  const got = pickEvents(events, [{ id: "e" }], "2026-11-01", 5).map((x) => x.id);
  ok(got.join() === "a,f,g", "開催の3〜14日前だけ・掲載中だけ・投稿済みを除き、近い順に選ぶ", got.join());
  ok(pickEvents(events, [], "2026-11-01").length === 2, "開催のお知らせは、1日に最大2件");
  const t = composeText(ev("x", "2026-11-15T13:30", { name: "長".repeat(200) }), base);
  ok(weightedLength(t) <= 280 && t.includes("11/15(日) 13:30〜") && t.includes(`${base}/events/x.html?utm_source=x`), "開催の文面は280字(全角2・URL23)に収まり、日時とURLを含む", String(weightedLength(t)));

  const r = composeReading({ label: "神楽の歴史", title: "石見神楽", body: "一文目です。" + "二文目はとても長い文です。".repeat(30), url: `${base}/kagura/x.html`, tags: "#神楽" });
  ok(weightedLength(r) <= 280 && r.includes("一文目です。") && !r.includes("…"), "長い読み物は、文の切れ目で280字に収める", String(weightedLength(r)));

  const info = {
    石見神楽: { source: "出典", intro: "紹介文。", programs: [{ name: "塩祓", text: "清めの舞。" }], history: ["歴史1。", "歴史2。"], features: ["特徴。"], viewing: ["コツ。"] },
    高千穂神楽: { source: "出典", intro: "紹介文。", programs: [{ name: "鈿女", text: "女性の舞。" }], features: ["特徴。"] },
    出典なし神楽: { intro: "出典のない紹介文。" },
  };
  const cands = readingCandidates(info, base, "2026-11-13"); // 金曜
  ok(!cands.some((c) => c.id.includes("出典なし")), "出典のない神楽は、読み物にしない");
  ok(cands.some((c) => c.url === `${base}/kagura/%E7%9F%B3%E8%A6%8B%E7%A5%9E%E6%A5%BD.html?utm_source=x&utm_medium=social`), "神楽の種類ページのURLは、エンコードして計測用の印を付ける");
  ok(cands.some((c) => c.id === "r:page:weekend:2026-11-13") && !readingCandidates(info, base, "2026-11-12").some((c) => c.id.startsWith("r:page:weekend")), "「今週末の神楽」は金曜だけ候補になる");
  ok(pickReadings(cands, [], "2026-11-13", 1)[0]?.id === "r:page:weekend:2026-11-13", "金曜は「今週末の神楽」をいちばん先に出す");
  ok(pickReadings(cands, [], "2026-11-09", 1)[0]?.theme === "program", "月曜は演目の紹介から出す");
  const four = pickReadings(cands, [], "2026-11-10", 4);
  ok(new Set(four.map((c) => c.id)).size === 4 && new Set(four.map((c) => c.theme)).size === 4, "1日の読み物は、テーマを散らす", four.map((c) => c.id).join());
  const all = cands.map((c) => ({ id: c.id, date: "2026-11-01" }));
  ok(pickReadings(cands, all, "2026-11-20", 3).length === 0, `出し切ったあと、${RERUN_GAP_DAYS}日たつまでは同じ読み物を出さない`);
  ok(pickReadings(cands, all, "2026-12-05", 3).length === 3, `${RERUN_GAP_DAYS}日たったら、古いものから再投稿する`);

  const slots = daySlots("2026-11-08");
  ok(slots.join() === ["2026-11-07T22:00:00.000Z", "2026-11-08T02:00:00.000Z", "2026-11-08T06:00:00.000Z", "2026-11-08T10:00:00.000Z", "2026-11-08T14:00:00.000Z", "2026-11-08T18:00:00.000Z"].join(), "投稿枠は日本時間7時から4時間ごとに6本", slots.join());
  const plan = planDay({ events, info, posted: [], todayJst: "2026-11-01", baseUrl: base, now: Date.parse("2026-11-01T00:00:00+09:00") });
  ok(plan.length === 6 && plan.filter((p) => p.type === "event").map((p) => p.dueAt).join() === [daySlots("2026-11-01")[0], daySlots("2026-11-01")[3]].join(), "開催のお知らせは7時と19時、残りの枠は読み物", plan.map((p) => `${p.type}@${p.dueAt}`).join());
  ok(plan.every((p) => weightedLength(p.text) <= 280), "どの投稿も280字に収まる");
  const again = planDay({ events, info, posted: plan.map((p) => ({ ...p, date: "2026-11-01" })), todayJst: "2026-11-01", baseUrl: base, now: Date.parse("2026-11-01T00:00:00+09:00") });
  ok(again.length === 0, "同じ日に2回動いても、予約済みの枠には入れない");
  const late = planDay({ events, info, posted: [], todayJst: "2026-11-08", baseUrl: base, now: Date.parse("2026-11-08T12:00:00+09:00") });
  ok(late.length === 4 && late.every((p) => Date.parse(p.dueAt) > Date.parse("2026-11-08T12:00:00+09:00")), "過ぎた枠には入れない", String(late.length));
  const night = planDay({ events, info, posted: [], todayJst: "2026-11-01", baseUrl: base, now: Date.parse("2026-11-01T21:00:00+09:00") });
  ok(night.length === 2 && night.every((p) => p.type === "reading"), "7時・19時が過ぎてから動いたときは、開催のお知らせを夜中に入れず、翌日に回す", night.map((p) => p.type).join());

  // 前の晩(21:15)に、今日の残りと翌日の枠をまとめて決める
  const eve = planDays({ events, info, posted: [], todayJst: "2026-11-01", baseUrl: base, now: Date.parse("2026-11-01T21:15:00+09:00") });
  const tomorrow = eve.filter((p) => p.date === "2026-11-02");
  ok(eve.length === 8 && tomorrow.length === 6 && tomorrow[0].dueAt === daySlots("2026-11-02")[0], "前の晩に、今日の残り2枠と翌日の6枠(朝7時を含む)を予約する", eve.map((p) => `${p.date}@${p.dueAt}`).join());
  ok(new Set(eve.map((p) => p.id)).size === eve.length && new Set(eve.map((p) => p.dueAt)).size === eve.length, "2日分で、同じ投稿・同じ枠を重ねない");
  ok(eve.length <= 10, "Buffer の無料プランの予約上限(10件)を超えない");
  const morning = planDays({ days: 1, events, info, posted: eve, todayJst: "2026-11-02", baseUrl: base, now: Date.parse("2026-11-02T08:41:00+09:00") });
  ok(morning.length === 0, "朝の起動は、前の晩に予約済みなら何も入れない");
  const recover = planDays({ days: 1, events, info, posted: [], todayJst: "2026-11-02", baseUrl: base, now: Date.parse("2026-11-02T05:15:00+09:00") });
  ok(recover.length === 6 && recover.every((p) => p.date === "2026-11-02"), "前の晩が失敗していたら、朝の起動が今日の枠だけを埋める", String(recover.length));

  section("X投稿の書き出しの1行(反応を見ながら改善)");
  const hc = readingCandidates(info, base, "2026-11-01", { [readingCandidates(info, base, "2026-11-01")[0].id]: "夜通し、舞が続く。" });
  ok(hc[0].style === "hook" && hc[0].text.startsWith("夜通し、舞が続く。\n\n【") && hc.slice(1).every((c) => c.style === "label"), "書き出しがあれば1行目に置き、なければこれまでの【見出し】から", hc[0].text.split("\n").slice(0, 3).join("|"));
  ok(hc.every((c) => weightedLength(c.text) <= 280), "書き出しをつけても、280字に収まる(本文を文の切れ目で削る)");
  ok(!validHook("#神楽 よかった") && !validHook("https://x.jp") && !validHook("a\nb") && !validHook("あ".repeat(41)) && validHook("素手で湯を打ち、しぶきを広げる。"), "書き出しは4〜40字で、URL・ハッシュタグ・改行を含めない");
  const bad = readingCandidates(info, base, "2026-11-01", { [hc[0].id]: "#だめ" });
  ok(bad[0].style === "label", "使えない書き出しは無視して、これまでの書き方で出す");
  const mh = mergeHooks({ a: "古い" }, { "r:ok": "新しい書き出し", "r:no": "知らないID", "r:bad": "x" }, new Set(["r:ok", "r:bad"]));
  ok(mh.added.join() === "r:ok" && mh.skipped.length === 2 && mh.hooks.a === "古い" && mh.hooks["r:ok"] === "新しい書き出し", "書き出しを足す: 知らないID・使えない行は理由つきで外し、前の書き出しは残す", JSON.stringify(mh.skipped));
  const hp = planDay({ events, info, posted: [], todayJst: "2026-11-01", baseUrl: base, now: Date.parse("2026-11-01T00:00:00+09:00"), hooks: { [hc[0].id]: "夜通し、舞が続く。" } });
  ok(hp.every((p) => ["event", "label", "hook"].includes(p.style)), "予約する投稿に、書き方(style)を記録する(週次の振り返りが書き方ごとの反応を比べる)", hp.map((p) => p.style).join());

  const q = createPostQuery({ text: '改行\nと"引用"', channelId: "ch1", dueAt: slots[0] });
  ok(q.includes('text: "改行\\nと\\"引用\\""') && q.includes("mode: customScheduled") && q.includes(`dueAt: "${slots[0]}"`), "Buffer への予約は、文字列を正しくエスケープして customScheduled で送る");
  ok(keyExpiryNotice("", "2026-11-08") === "" && keyExpiryNotice("2026-12-31", "2026-11-08") === "", "APIキーの期限が未設定・まだ先なら、知らせない");
  ok(keyExpiryNotice("2026-11-22", "2026-11-08").includes("あと14日") && keyExpiryNotice("2026-11-07", "2026-11-08").includes("過ぎています"), "期限の14日前から・過ぎたあとは、知らせる");
}
