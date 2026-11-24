// SNS投稿: 選び方・文面・時刻の割り当て・Buffer への送信文のテスト(外部へは送らない)
import { pickEvents, composeText, composeReading, weightedLength, readingCandidates, pickReadings, daySlots, planDay, planDays, validHook, RERUN_GAP_DAYS, justOverKagura, premiumOn, composeById, LONG_LIMIT, chooseFormat } from "../scripts/lib/x-post.mjs";
import { mergeHooks } from "../scripts/social-hooks.mjs";
import { createPostQuery, keyExpiryNotice, isScheduleLimit, isLengthError, refreshPlan, textHash, editPostQuery, scheduledPostsQuery, notPremium, channelSubscriptionQuery } from "../scripts/post-social.mjs";

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
  ok(cands.some((c) => c.pageUrl === `${base}/kagura/%E7%9F%B3%E8%A6%8B%E7%A5%9E%E6%A5%BD.html?utm_source=x&utm_medium=social`), "神楽の種類ページのURLは、エンコードして計測用の印を付ける");
  // URLは、サイトのページ紹介にだけ付ける(全部の投稿にURLが付くと、タイムラインでうるさいため)
  const kindC = cands.filter((c) => c.theme !== "page"), pageC = cands.filter((c) => c.theme === "page");
  ok(kindC.length && kindC.every((c) => !c.link && !/https?:\/\//.test(c.text) && c.text.endsWith("#神楽 #石見神楽") === (c.kagura === "石見神楽")), "演目・歴史などの読み物にはURLを付けない(本文とハッシュタグだけ)", kindC.map((c) => c.text).join(" / "));
  ok(pageC.length && pageC.every((c) => c.link && /\nhttps:\/\/\S+\?utm_source=x&utm_medium=social\n#神楽$/.test(c.text)), "サイトのページ紹介(ガイド・今週末の神楽など)にはURLを付ける");
  const long = "あ".repeat(60) + "。" + "い".repeat(60) + "。";
  ok(weightedLength(composeReading({ label: "神楽の歴史", title: "x", body: long, url: "", tags: "#神楽" })) <= 280 && composeReading({ label: "神楽の歴史", title: "x", body: long, url: "", tags: "#神楽" }).includes("い".repeat(60)) && !composeReading({ label: "神楽の歴史", title: "x", body: long, url: "https://kagurameguri.jp/history/", tags: "#神楽" }).includes("い".repeat(60)), "URLがない分、本文を長く出せる");
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
  // 2026-11-24 運営者の判断: 開催のお知らせの枠を 7時・11時・19時 の3本に(config.json の social.eventSlots)
  { const three = { eventSlots: [0, 1, 3] }, d = daySlots("2026-11-01"), at = Date.parse("2026-11-01T00:00:00+09:00");
    const p3 = planDay({ events, info, posted: [], todayJst: "2026-11-01", baseUrl: base, now: at, social: three });
    ok(p3.length === 6 && p3.filter((p) => p.type === "event").map((p) => p.dueAt).join() === [d[0], d[1], d[3]].join(), "枠を3本にすると、開催のお知らせは7時・11時・19時(1日の投稿は6本のまま)", p3.map((p) => `${p.type}@${p.dueAt}`).join());
    const p1 = planDay({ events: events.filter((e) => e.id === "a"), info, posted: [], todayJst: "2026-11-01", baseUrl: base, now: at, social: three });
    ok(p1.length === 6 && p1.filter((p) => p.type === "event").map((p) => p.dueAt).join() === d[0] && p1.find((p) => p.dueAt === d[1])?.type === "reading", "紹介する開催が少ない日は、空いた11時の枠に読み物が入る", p1.map((p) => `${p.type}@${p.dueAt}`).join());
    ok(planDay({ events, info, posted: [], todayJst: "2026-11-01", baseUrl: base, now: at, social: { eventSlots: [0, 1, 2, 3, 4] } }).filter((p) => p.type === "event").length === 3, "枠をいくつ指定しても、開催のお知らせは1日3件まで(連投を避ける)"); }

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
  ok(isScheduleLimit("Scheduled posts limit reached. You have 10 scheduled posts out of 10 allowed.") && !isScheduleLimit("Invalid channel") && !isScheduleLimit(undefined), "Buffer の予約上限の返事だけを、上限として扱う");

  // 終わったばかりの神楽は、出る時刻で判断して、読み物に使わない(作った時ではなく)
  const hx = { kagura: "保呂羽山の霜月神楽", status: "published" };
  const evs2 = [{ id: "h", start: "2026-11-07T00:00", end: "2026-11-08T00:00", ...hx }, { id: "z", start: "2026-12-20T10:00", kagura: "次あり神楽", status: "published" }, { id: "z0", start: "2026-11-01T10:00", kagura: "次あり神楽", status: "published" }];
  const t9 = Date.parse("2026-11-09T03:00:00+09:00");
  ok(justOverKagura(evs2, t9).has("保呂羽山の霜月神楽") && !justOverKagura(evs2, t9).has("次あり神楽"), "開催が終わり、次の開催がない神楽を「終わったばかり」とする(次があれば除かない)");
  ok(!justOverKagura(evs2, Date.parse("2026-11-07T12:00:00+09:00")).has("保呂羽山の霜月神楽") && !justOverKagura(evs2, Date.parse("2026-12-15T00:00:00+09:00")).has("保呂羽山の霜月神楽"), "開催中・終わって30日を過ぎたら、除かない");
  const info2 = { "保呂羽山の霜月神楽": { source: "s", intro: "毎年11月7日から8日にかけて奉納される。" }, "石見神楽": { source: "s", intro: "石見の神楽。" } };
  const ids = (pl) => pl.filter((p) => p.type === "reading").map((p) => p.id).join();
  const before = planDays({ days: 1, events: evs2, info: info2, posted: [], todayJst: "2026-11-06", baseUrl: base, now: Date.parse("2026-11-05T21:15:00+09:00") });
  const after = planDays({ days: 2, events: evs2, info: info2, posted: [], todayJst: "2026-11-08", baseUrl: base, now: Date.parse("2026-11-08T21:15:00+09:00") });
  ok(ids(before).includes("r:kind:保呂羽山の霜月神楽"), "開催の前は、その神楽を紹介する", ids(before));
  ok(!ids(after).includes("保呂羽山") && ids(after).includes("r:kind:石見神楽"), "前の晩に作る翌日分(11/9)にも、11/8 に終わった神楽の紹介を入れない", ids(after));

  section("X Premium の長い投稿(期限まで)と、予約済みの見直し");
  const premium = { xPremiumUntil: "2026-12-17" };
  ok(premiumOn(premium, "2026-12-16") && !premiumOn(premium, "2026-12-17") && !premiumOn(premium, "2027-01-05") && !premiumOn({}, "2026-11-20") && !premiumOn({ xPremiumUntil: "12月17日" }, "2026-11-20"), "長い投稿は、期限の前日に出る投稿まで。期限の日・未設定・書式の誤りなら280字");
  const longBody = "あ".repeat(60) + "。" + "い".repeat(90) + "。";
  const infoL = { 石見神楽: { source: "出典", intro: "石見地方の神楽。", programs: [{ name: "塩祓", text: longBody }, { name: "大蛇", text: "大蛇の舞。" }], history: ["歴史。"], features: ["特徴。"], viewing: ["座布団があると安心。", "夜は冷える。"] } };
  const evL = [ev("iw1", "2026-11-28T19:00", { venue: "神社", description: "公式の説明。", fee: "無料" }), ev("iw0", "2026-11-19T19:00"), ev("iw2", "2026-12-05T19:00", { status: "pending" })];
  const lc = readingCandidates(infoL, base, "2026-11-20", {}, { long: true, events: evL });
  const prog = lc.find((c) => c.id === "r:program:石見神楽:0");
  ok(prog.long && prog.text.includes(longBody) && !prog.shortText.includes("い".repeat(90)) && weightedLength(prog.shortText) <= 280, "長い投稿では本文を削らない(280字の文面も、断られたとき用に持つ)");
  ok(prog.text.includes("▼石見神楽とは\n石見地方の神楽。") && prog.text.includes("▼次に観られる日\n・11/28(土) 19:00〜 島根県益田市 神社") && !prog.text.includes("11/19") && !prog.text.includes("12/5"), "同じ神楽の紹介と、出る日より後の掲載中の開催を足す(過ぎた・掲載前の開催は入れない)");
  ok(/▼(ほかの演目\n大蛇|見に行くなら\n)/.test(prog.text) && !/▼ほかの演目\n[^\n]*塩祓/.test(prog.text), "演目か見学のコツを足す(その投稿の演目は「ほかの演目」に入れない)");
  const kindL = lc.find((c) => c.id === "r:kind:石見神楽");
  ok(!kindL.text.includes("▼石見神楽とは") && kindL.text.includes("▼主な演目\n塩祓・大蛇") && kindL.text.includes("▼見に行くなら"), "紹介文の投稿には「とは」を重ねず、演目と見学のコツを足す");
  const head280 = (s) => { let v = ""; for (const ch of s) { if (weightedLength(v + ch) > 280) break; v += ch; } return v; };
  const longs = lc.filter((c) => c.long);
  ok(longs.length && longs.every((c) => head280(c.text).startsWith(`【${c.label}】`) && !/https?:/.test(head280(c.text)) && (c.link === "tail") === c.text.endsWith(`${c.pageUrl}\n${c.tags}`)), "読み物のURLは最後だけで、見える部分には出さない(全体が短ければ付けない)。付けたものは link: tail");
  ok(longs.some((c) => c.link === "tail") && longs.some((c) => c.link === false), "長い読み物の、URLあり(最後)・なしの両方を作れる", longs.map((c) => `${c.id}:${c.link}`).join());
  ok(lc.filter((c) => c.theme === "page").every((c) => !c.long && c.text === c.shortText), "案内ページの紹介は、短いまま");
  const evPost = composeText({ ...evL[0], name: "長".repeat(200) }, base, { long: true, info: infoL });
  ok(head280(evPost).includes(`${base}/events/iw1.html?utm_source=x`) && evPost.includes("公式の説明。") && evPost.includes("会場: 神社\n料金: 無料") && evPost.includes("▼石見神楽とは") && evPost.includes("公式の情報をご確認ください"), "開催のお知らせ: 見える部分にURL(カードが出る)、続きに公式の説明・会場・料金・神楽の紹介");
  ok(["出発前に公式情報をご確認ください。", "出発前に公式案内をご確認ください。"].every((d) => !/確認ください。[\s\S]*確認ください/.test(composeText({ ...evL[0], description: d }, base, { long: true, info: infoL }))), "説明に公式の確認のお願いがあれば、注意書きを重ねない");
  const pl = planDays({ days: 1, events: evL, info: infoL, posted: [], todayJst: "2026-11-20", baseUrl: base, social: premium, now: Date.parse("2026-11-20T00:00:00+09:00") });
  ok(pl.length && pl.every((p) => p.shortText && weightedLength(p.shortText) <= 280 && weightedLength(p.text) <= LONG_LIMIT) && pl.some((p) => p.long), "Premium の期間の予約は長い投稿。どれも280字の文面を持つ");
  const after17 = planDays({ days: 1, events: evL, info: infoL, posted: [], todayJst: "2026-12-17", baseUrl: base, social: premium, now: Date.parse("2026-12-17T00:00:00+09:00") });
  ok(after17.length && after17.every((p) => !p.long && weightedLength(p.text) <= 280), "期限の日からは、自動で280字に戻る");
  // 長さを混ぜる: 1日の読み物の枠(2〜3・5〜6本目)に3種類がそろい、日ごとにずれる。開催のお知らせは短くしない
  const s20 = daySlots("2026-11-20");
  for (const d of ["2026-11-20", "2026-11-21", "2026-11-22"]) {
    const fs = [1, 2, 4, 5].map((i) => chooseFormat(premium, d, daySlots(d)[i]));
    ok(["long", "medium", "short"].every((f) => fs.includes(f)), `${d}: 読み物の4枠に、長い・中くらい・短いが混ざる`, fs.join());
  }
  ok(chooseFormat(premium, "2026-11-20", s20[1]) !== chooseFormat(premium, "2026-11-21", daySlots("2026-11-21")[1]), "同じ時間帯でも、日によって長さが変わる");
  ok(chooseFormat(premium, "2026-12-17", daySlots("2026-12-17")[1]) === "short" && chooseFormat({}, "2026-11-20", s20[1]) === "short", "Premium の期間外は、いつも280字");
  const mix = planDays({ days: 3, events: evL, info: infoL, posted: [], todayJst: "2026-11-20", baseUrl: base, social: premium, now: Date.parse("2026-11-20T00:00:00+09:00") });
  ok(new Set(mix.filter((p) => p.type === "reading").map((p) => p.format)).size === 3 && mix.every((p) => p.type !== "event" || p.format !== "short"), "予約には長さ(format)を記録し、開催のお知らせは Premium の間は短くしない", mix.map((p) => `${p.type}:${p.format}`).join());
  const medium = readingCandidates(infoL, base, "2026-11-20", {}, { long: true, events: evL }).find((c) => c.id === "r:program:石見神楽:0").formats.medium;
  ok(medium.text.includes("▼次に観られる日") && !medium.text.includes("▼石見神楽とは") && medium.text.includes(longBody), "中くらいは、本文を削らずに1節だけ(観に行ける日があればそれ)");
  const evMedium = composeText(evL[0], base, { long: true, info: infoL, format: "medium" });
  ok(evMedium.includes("公式の説明。") && !evMedium.includes("▼石見神楽とは"), "開催のお知らせの中くらいは、神楽の紹介を足さない");
  const longSlot = s20.find((s, i) => [1, 2, 4, 5].includes(i) && chooseFormat(premium, "2026-11-20", s) === "long");
  const byId = composeById({ id: "r:program:石見神楽:0", date: "2026-11-20", dueAt: longSlot, events: evL, info: infoL, baseUrl: base, social: premium });
  ok(byId?.text === prog.text && byId.format === "long" && composeById({ id: "iw2", date: "2026-11-20", events: evL, info: infoL, baseUrl: base, social: premium }) === null, "予約済みの投稿を、IDから作り直せる(掲載前・取り下げの開催は作り直さない)");

  const now = Date.parse("2026-11-20T00:00:00+09:00");
  const rec = (id, bufferId, extra = {}) => ({ id, bufferId, dueAt: "2026-11-20T10:00:00.000Z", date: "2026-11-20", ...extra });
  const queue = [
    { id: "b1", text: "旧い文面", dueAt: "2026-11-20T10:00:00.000Z" },
    { id: "b2", text: "手で直した文面", dueAt: "2026-11-20T10:00:00.000Z" },
    { id: "b3", text: "旧い文面", dueAt: "2026-11-19T15:10:00.000Z" },
    { id: "b4", text: "手で入れた投稿", dueAt: "2026-11-20T10:00:00.000Z" },
    { id: "b5", text: "送ったまま", dueAt: "2026-11-20T10:00:00.000Z" },
    { id: "b6", text: "新しい文面", dueAt: "2026-11-20T10:00:00.000Z" },
  ];
  const posted2 = [rec("p1", "b1"), rec("p2", "b2", { hash: textHash("送ったときの文面") }), rec("p3", "b3"), rec("p5", "b5", { hash: textHash("送ったまま") }), rec("p6", "b6")];
  const rp = refreshPlan({ queue, posted: posted2, now, compose: () => ({ text: "新しい文面", shortText: "短い文面" }), legacy: () => ["旧い文面"] });
  ok(rp.edits.map((e) => e.q.id).join() === "b1,b5", "送ったときのまま(指紋が同じ・以前の作り方と同じ)の予約だけを書き換える", rp.edits.map((e) => e.q.id).join());
  ok(rp.skipped.find((s) => s.q.id === "b2")?.why.includes("手で直され") && rp.skipped.find((s) => s.q.id === "b3")?.why.includes("まもなく") && rp.manual.map((q) => q.id).join() === "b4", "手で直された予約・まもなく出る予約・手で入れた予約は変えない");
  ok(refreshPlan({ queue: [queue[0]], posted: posted2, now, compose: () => null, legacy: () => ["旧い文面"] }).edits.length === 0, "作り直せない(開催の取り下げなど)ときは変えない");
  const eq = editPostQuery({ id: "b1", text: '改行\nと"引用"' });
  ok(eq.includes('editPost(input: { id: "b1", text: "改行\\nと\\"引用\\"" })') && !/dueAt|mode/.test(eq.split(")")[0]), "書き換えは文面だけ(予約の時刻は変えない)");
  ok(scheduledPostsQuery({ organizationId: "o", channelId: "c" }).includes("status: [scheduled]"), "見直すのは、まだ出ていない予約だけ");
  ok(notPremium("") && notPremium(null) && notPremium("None") && notPremium("free") && !notPremium("premium") && !notPremium("basic") && channelSubscriptionQuery("c1").includes('channel(input: { id: "c1" })') && channelSubscriptionQuery("c1").includes("subscriptionType"), "Buffer が X の有料プランを認識していないときだけ、最初から280字にする(分からない値なら長い投稿を試す)");
  ok(isLengthError("Invalid post: Twitter / X posts cannot exceed 280 characters.") && isLengthError("Text exceeds the character limit of 280") && !isLengthError("Scheduled posts limit reached. You have 10 scheduled posts out of 10 allowed.") && !isLengthError("Invalid channel"), "文字数で断られたときだけ、280字の文面で送り直す");
}
