// 地元のファン向けの機能のテスト: 出演・演目(神楽団ページ・演目ページ) / 県ごとのカレンダー購読 / 県ごとの今週末と SNS 用の画像
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import vm from "node:vm";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import { checkLineup, parseLineupText, lineupText, programKey, programNames, lineupShort } from "../scripts/lib/lineup.mjs";
import { upsertEvent, validateEvent } from "../scripts/admin/store.mjs";
import { draftFrom } from "../scripts/admin/mail.mjs";
import { submitForm } from "../scripts/lib/form.mjs";

const read = (p) => readFileSync(p, "utf8");
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const sha = (s) => `'sha256-${createHash("sha256").update(s, "utf8").digest("base64")}'`;
const cspOf = (html) => cheerio.load(html)('meta[http-equiv="Content-Security-Policy"]').attr("content") ?? "";
// X の文字数(全角は2、URL は23)。ビルドの数え方とは別に書いて、照らし合わせる
const xLength = (s) => s.split(/(https?:\/\/\S+)/).reduce((n, part, i) => n + (i % 2 ? 23 : [...part].reduce((m, ch) => m + (ch.codePointAt(0) <= 0x10ff ? 1 : 2), 0)), 0);

export async function localFansTests({ ok, section, build }) {
  section("出演・演目: データの検査と、入力の読み取り");
  ok(checkLineup({}).length === 0 && checkLineup({ lineup: [{ troupe: "津浪神楽団", programs: ["八岐大蛇"] }, { troupe: "横田神楽団", programs: [] }], lineupMore: true }).length === 0, "正しい出演・演目は通る(演目が未発表の団体もよい)");
  for (const [name, e, re] of [
    ["URL に使えない記号", { lineup: [{ troupe: "悪い/名前", programs: [] }] }, /正しくありません/],
    ["HTML の記号", { lineup: [{ troupe: "<img src=x>", programs: [] }] }, /正しくありません/],
    ["前後の空白", { lineup: [{ troupe: " 津浪神楽団", programs: [] }] }, /正しくありません/],
    ["団体の重複", { lineup: [{ troupe: "A神楽団", programs: [] }, { troupe: "A神楽団", programs: ["x"] }] }, /重複/],
    ["演目が配列でない", { lineup: [{ troupe: "A神楽団", programs: "八岐大蛇" }] }, /配列/],
    ["演目のかぎかっこ", { lineup: [{ troupe: "A神楽団", programs: ["「八岐大蛇」"] }] }, /演目の名前が正しくありません/],
    ["不明な項目", { lineup: [{ troupe: "A神楽団", programs: [], url: "x" }] }, /不明な項目/],
    ["lineup なしの lineupMore", { lineupMore: true }, /lineup と一緒/],
  ]) ok(checkLineup(e).some((m) => re.test(m)), `出演・演目の誤りを見つける: ${name}`, JSON.stringify(checkLineup(e)));
  const parsed = parseLineupText("津浪神楽団: 「八岐大蛇」、紅葉狩\n諸木郷土芸能保存会：大鬼・小鬼\n\n横田神楽団\n津浪神楽団: 紅葉狩, 塵輪");
  ok(JSON.stringify(parsed) === JSON.stringify([{ troupe: "津浪神楽団", programs: ["八岐大蛇", "紅葉狩", "塵輪"] }, { troupe: "諸木郷土芸能保存会", programs: ["大鬼・小鬼"] }, { troupe: "横田神楽団", programs: [] }]), "入力の読み取り: 全角・半角のコロン、「」を外す、「・」を含む演目は分けない、同じ団体はまとめる", JSON.stringify(parsed));
  ok(JSON.stringify(parseLineupText(lineupText(parsed))) === JSON.stringify(parsed), "入力の形に戻して、また読んでも同じになる");
  ok(programKey("瀧夜叉姫") === "滝夜叉姫" && programKey("大蛇") === "八岐大蛇" && programKey("塵輪") === "塵輪" && programNames("滝夜叉姫").includes("瀧夜叉姫"), "同じ演目の表記の違いは、1つのページにまとめる(ほかの演目は、そのまま)");
  ok(lineupShort({ lineup: [{ troupe: "A", programs: [] }, { troupe: "B", programs: [] }, { troupe: "C", programs: [] }, { troupe: "D", programs: [] }] }) === "A・B・C ほか" && lineupShort({ lineup: [{ troupe: "A", programs: [] }], lineupMore: true }) === "A ほか", "一覧の出演は3団体までと「ほか」");

  section("出演・演目: 管理者用ページと、掲載の依頼フォーム");
  const base = { id: "x-1", name: "A", kagura: "広島神楽", prefecture: "広島県", city: "c", venue: "v", start: "2026-11-20T10:00", source: "s", checked: "2026-11-06" };
  const evs = [];
  const r1 = upsertEvent(evs, { ...base, lineupText: "津浪神楽団: 八岐大蛇\n横田神楽団", lineupMore: true }, null, "published");
  ok(JSON.stringify(r1.event.lineup) === '[{"troupe":"津浪神楽団","programs":["八岐大蛇"]},{"troupe":"横田神楽団","programs":[]}]' && r1.event.lineupMore === true && Object.keys(r1.event).indexOf("lineup") < Object.keys(r1.event).indexOf("source"), "編集画面の入力(1行に1団体)から、出演・演目を保存する(項目の並びは、説明のあと)", JSON.stringify(r1.event));
  upsertEvent(evs, { ...base, lineupText: "", lineupMore: true }, "x-1");
  ok(!("lineup" in evs[0]) && !("lineupMore" in evs[0]), "入力を空にすると、出演・演目を消す(「ほか」だけは残さない)");
  ok(validateEvent({ ...base, lineup: [{ troupe: "悪い/名前", programs: [] }] }, []).lineup, "保存の前に、出演・演目の誤りを知らせる");
  const draft = draftFrom({ "神楽・イベントの名称": "A", "開催日": "2026-11-20", "出演する神楽団と演目": "津浪神楽団: 八岐大蛇、紅葉狩\n横田神楽団" }, null);
  ok(JSON.stringify(draft.lineup) === '[{"troupe":"津浪神楽団","programs":["八岐大蛇","紅葉狩"]},{"troupe":"横田神楽団","programs":[]}]', "掲載の依頼のメールから、出演・演目の下書きを作る", JSON.stringify(draft.lineup));
  const sf = cheerio.load(submitForm({ form: { endpoint: "https://api.web3forms.com/submit", accessKey: "k" }, operator: {} }));
  ok(sf('label[for="lineup"]').contents().first().text() === "出演する神楽団と演目" && sf("textarea#lineup").attr("maxlength") === "400" && sf("details.more-fields textarea#lineup").length === 1, "掲載の依頼フォームに「出演する神楽団と演目」(任意・くわしく書くの中)がある");
  const app = read("scripts/admin/app.js");
  ok(app.includes('id: "e-lineup"') && app.includes("lineupText:") && app.includes('id: "e-lineupMore"'), "管理者用ページの編集画面に、出演・演目の欄がある");

  // ---------- テスト用データでビルド ----------
  const T = mkdtempSync(join(tmpdir(), "kagura-local-"));
  const fx = JSON.parse(read("tests/fixtures/events.test.json"));
  const add = (id, lineup, more) => { const e = fx.find((x) => x.id === id); e.lineup = lineup; if (more) e.lineupMore = true; };
  add("t-full", [{ troupe: "テスト神楽団", programs: ["瀧夜叉姫", "大蛇"] }, { troupe: "別の社中", programs: [] }], true);
  add("t-xss", [{ troupe: "テスト神楽団", programs: ["滝夜叉姫"] }]);
  add("t-past", [{ troupe: "過去だけの神楽団", programs: ["過去だけの演目"] }]);
  add("t-timeunknown", [{ troupe: "広島の神楽団", programs: ["八岐大蛇"] }]);
  const EV = join(T, "events.json"); writeFileSync(EV, JSON.stringify(fx));
  const OUT = "dist-test-local";
  try {
    let r = build(EV, OUT, { TEST_WEEKEND_PREFS: "広島県" });
    ok(r.status === 0, "出演・演目のあるデータでビルドできる", r.stderr);
    const rd = (f) => read(join(OUT, f)), has = (f) => existsSync(join(OUT, f));

    section("出演・演目: 神楽団ページ・演目ページ");
    const tp = cheerio.load(rd("troupe/テスト神楽団.html"));
    ok(tp("h1").text() === "テスト神楽団" && tp(".card").length === 2 && tp("title").text().startsWith("テスト神楽団の公演予定") && /index,follow/.test(tp('meta[name="robots"]').attr("content")), "神楽団ページ: その団体の出演予定が並び、検索に出す");
    ok(tp(".card").first().find(".lp-line").text().includes("共演: 別の社中 ほか") && !tp(".event-facts").text().includes("出演:"), "神楽団ページ: その団体の名前はくり返さず、ほかに出演する団体を「共演」として出す");
    ok(tp(".lp-line").first().text().includes("「瀧夜叉姫」") && tp('.lp-line a[href="/program/%E6%BB%9D%E5%A4%9C%E5%8F%89%E5%A7%AB.html"]').length === 2, "神楽団ページ: 公演ごとに、その団体が舞う演目(演目ページへのリンク)");
    const past = cheerio.load(rd("troupe/過去だけの神楽団.html"));
    ok(/noindex/.test(past('meta[name="robots"]').attr("content")) && past(".monthlist li").length === 1 && !rd("sitemap.xml").includes(encodeURIComponent("過去だけの神楽団")) && !rd("sitemap.xml").includes(encodeURIComponent("過去だけの演目")), "これまでの出演だけのページは noindex で、サイトマップに入れない(ページは残す)");
    const pg = cheerio.load(rd("program/滝夜叉姫.html"));
    ok(pg("h1").text().includes("滝夜叉姫(瀧夜叉姫)") && pg(".card").length === 2 && pg(".lp-line").text().includes("(「瀧夜叉姫」と表記)") && !has("program/瀧夜叉姫.html"), "演目ページ: 表記の違う公演を1ページにまとめ、元の表記も示す");
    ok(pg(".card").toArray().every((c) => !pg(c).find(".event-facts").text().includes("出演:")), "演目ページのカードには、出演を二重に出さない(その演目の出演団体だけを出す)");
    const orochi = cheerio.load(rd("program/八岐大蛇.html"));
    ok(orochi(".about").text().includes("スサノオ") && orochi('.about a[href*="#programs"]').length >= 1 && orochi("h1").text().includes("八岐大蛇(大蛇)"), "演目ページ: 神楽の種類ページの「主な演目」の解説を、そのページへの案内とともに出す");
    ok(cheerio.load(rd("kagura/石見神楽.html"))("h2#programs").length === 1, "神楽の種類ページの「主な演目」に、案内のための目印(id)がある");
    const ti = cheerio.load(rd("troupe/index.html")), pi = cheerio.load(rd("program/index.html"));
    ok(ti(".troupe-list li").length === 4 && pi(".troupe-list li").length === 3 && rd("sitemap.xml").includes("/troupe/</loc>") && rd("sitemap.xml").includes("/program/</loc>"), "神楽団・演目の一覧のページがあり、サイトマップに入る");
    ok(cheerio.load(rd("kagura/index.html"))('a[href="/troupe/"]').length === 1, "種類の一覧から、神楽団・演目の一覧へたどれる");

    section("出演・演目: 開催ページ・一覧・検索");
    const ep = cheerio.load(rd("events/t-full.html"));
    const lineupRow = ep("table.info tr").filter((_, t) => ep(t).find("th").text() === "出演");
    ok(lineupRow.find(".lineup li").length === 3 && lineupRow.find(".lp-more").text() === "ほか" && lineupRow.find('a[href="/troupe/%E3%83%86%E3%82%B9%E3%83%88%E7%A5%9E%E6%A5%BD%E5%9B%A3.html"]').length === 1 && lineupRow.text().includes("予定です"), "開催ページの要点の表に「出演」の行(神楽団・演目へのリンクと「ほか」、予定である旨)");
    const ld = JSON.parse(ep('script[type="application/ld+json"]').first().html());
    const event = Array.isArray(ld) ? ld.find((x) => x["@type"] === "Event") : ld;
    ok(event.performer?.length === 2 && event.performer[0]["@type"] === "PerformingGroup" && event.performer[0].url.endsWith(".html"), "構造化データの performer(出演する団体)", JSON.stringify(event.performer));
    ok(!cheerio.load(rd("events/t-ongoing.html"))("table.info th").toArray().some((t) => cheerio.load(t).text() === "出演"), "出演の分からない公演には、行を出さない");
    const pref = cheerio.load(rd("pref/宮崎県.html"));
    ok(pref(".event-facts").text().includes("出演:テスト神楽団・別の社中 ほか") && pref(".pref-troupes a.tag").length === 2, "県のページ: カードに出演、下に「出演する神楽団」");
    const lite = JSON.parse(rd("events.json"));
    ok(lite.find((x) => x.id === "t-full").troupes.join() === "テスト神楽団,別の社中" && !("troupes" in lite.find((x) => x.id === "t-ongoing")) && rd("calendar.html").includes("concat(x.troupes||[])"), "日付・場所の検索のキーワードで、神楽団の名前でも探せる");
    let bad = 0;
    for (const f of walk(OUT).filter((x) => /\/(troupe|program)\//.test(x) && x.endsWith(".html"))) cheerio.load(read(f))("a[href^='/']").each((_, a) => { const h = decodeURIComponent(cheerio.load(a)("a").attr("href").split("#")[0]); if (!existsSync(join(OUT, h.endsWith("/") ? h + "index.html" : h))) bad++; });
    ok(bad === 0, "神楽団・演目のページの内部リンクは、すべて実在する", `${bad}件`);

    section("出演・演目: 不正なデータは、ビルドを止める");
    for (const [name, lineup, re] of [["記号を含む団体名", [{ troupe: "<b>悪い</b>", programs: [] }], /出演団体の名前/], ["団体の重複", [{ troupe: "A", programs: [] }, { troupe: "A", programs: [] }], /重複/]]) {
      const f = join(T, "bad.json"); const copy = structuredClone(fx); copy.find((x) => x.id === "t-full").lineup = lineup; writeFileSync(f, JSON.stringify(copy));
      const x = build(f, "dist-test-local-bad", {});
      ok(x.status !== 0 && re.test(x.stderr), `止める: ${name}`, x.stderr.slice(0, 200));
    }

    section("県ごとのカレンダー購読");
    const ics = rd("ics/hiroshima.ics");
    ok(ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.endsWith("END:VCALENDAR\r\n") && !/[^\r]\n/.test(ics) && ics.includes("X-WR-CALNAME:神楽めぐり 広島県の神楽"), "県のカレンダー: iCalendar の形(CRLF)と、カレンダーの名前");
    ok(ics.includes("UID:t-timeunknown@") && ics.includes("UID:t-minimal@") && !ics.includes("UID:t-full@") && !ics.includes("UID:t-past@"), "その県の開催予定だけが入る(ほかの県・終わった公演は入らない)");
    const weekly = ics.match(/UID:r-weekly-\d{8}@/g) ?? [];
    ok(weekly.length === 12 && ics.includes("UID:r-weekly-20261014@") && ics.includes("UID:r-weekly-20261230@") && !ics.includes("UID:r-weekly-20270106@"), "毎週の定期公演は、90日先までの公演日を入れる(期間の終わりより後は入れない)", String(weekly.length));
    const weeklyName = JSON.parse(read("tests/fixtures/regular.test.json")).find((x) => x.id === "r-weekly").name;
    ok(/UID:r-weekly-20261014@[\s\S]*?DTSTART;TZID=Asia\/Tokyo:20261014T190000\r\nDTEND;TZID=Asia\/Tokyo:20261014T210000/.test(ics) && ics.includes(`SUMMARY:${weeklyName}(定期公演)`), "定期公演の時刻は「19:00開演」から読み、終演が分からなければ2時間。名前に(定期公演)を付ける");
    ok(!read(join(OUT, "ics/miyazaki.ics")).includes("UID:r-nightly"), "毎晩の定期公演は、カレンダーが埋まるため入れない");
    const icsFiles = walk(join(OUT, "ics")).map((f) => f.split("/").pop()).sort().join(",");
    ok(icsFiles === "hiroshima.ics,miyazaki.ics,okayama.ics,shimane.ics", "開催予定・定期公演のある県ごとに、カレンダーを作る(終わった公演だけの県は作らない)", icsFiles);
    const hp = cheerio.load(rd("pref/広島県.html"));
    const sub = hp(".cal-sub");
    ok(sub.find('a[href="webcal://kagurameguri.jp/ics/hiroshima.ics"]').length === 1 && sub.find('a[href^="https://calendar.google.com/calendar/render?cid=webcal%3A%2F%2Fkagurameguri.jp%2Fics%2Fhiroshima.ics"]').attr("rel") === "noopener" && sub.find('[data-copy="https://kagurameguri.jp/ics/hiroshima.ics"]').length === 1, "県のページに、Google カレンダー・iPhone と Mac・URL のコピーの3つの登録方法");

    section("県ごとの今週末の神楽(SNS 用の画像)");
    const wp = rd("weekend/hiroshima.html"), w$ = cheerio.load(wp);
    ok(w$("h1").text() === "今週末の広島の神楽" && w$("title").text() === "今週末の広島の神楽(10月10日(土)〜12日(月・祝)) | 神楽めぐり" && w$(".card").first().find("a").attr("href") === "/events/t-timeunknown.html", "広島の今週末: その県の、この週末の公演を並べる");
    const sns = JSON.parse(w$("#sns-data").html());
    ok(sns.items.length === 1 && sns.items[0].troupes === "広島の神楽団" && sns.items[0].md === "10/10" && sns.file === "kagura-hiroshima-weekend-20261010.png" && sns.url === "kagurameguri.jp/weekend/hiroshima" && sns.range.includes("3連休"), "画像のデータ: 公演・出演・ファイル名・URL・連休", JSON.stringify(sns));
    const xText = w$(".sns-text").first().text(), igText = w$(".sns-text").eq(1).text();
    ok(xLength(xText) <= 280 && xText.includes("utm_source=x&utm_medium=social&utm_campaign=weekend_hiroshima&utm_content=post_20261010") && xText.includes("#広島神楽"), "X の投稿の文: 文字数に収まり、どの投稿から来たかの印(utm)が付く", `${xLength(xText)}字`);
    ok(igText.includes("プロフィールのリンク") && !igText.includes("utm_"), "Instagram の投稿の文: 本文のリンクは押せないので、プロフィールのリンクへ案内する");
    const scripts = w$("script:not([src]):not([type])").map((_, s) => w$(s).html()).get();
    const imgJs = scripts.find((s) => s.includes("sns-preview"));
    ok(!!imgJs && cspOf(wp).includes(sha(imgJs)) && w$("#sns-save").attr("disabled") !== undefined, "画像を描くスクリプトは CSP のハッシュで許可され、描けるまで保存ボタンは押せない");
    ok(cheerio.load(rd("weekend.html"))('.weekend-local a[href="/weekend/hiroshima.html"]').length === 1 && hp('.pref-weekend a[href="/weekend/hiroshima.html"]').length === 1 && rd("sitemap.xml").includes("/weekend/hiroshima.html</loc>"), "全国の今週末・広島県のページ・サイトマップから、広島の今週末へたどれる");
    ok(w$(".cal-sub").length === 1, "広島の今週末からも、広島のカレンダーを登録できる");

    // 画像を描く処理: キャンバスを記録するだけの偽物で動かす(描く文字・折り返し・保存)
    const drawRun = (data) => {
      const texts = [], els = {};
      const ctx = { font: "", fillStyle: "", textBaseline: "", measureText(t) { const size = +(this.font.match(/(\d+)px/)?.[1] ?? 10); return { width: [...t].length * size }; }, fillText(t, x, y) { texts.push({ t, x, y, font: this.font }); }, fillRect() {} };
      const canvas = { width: 0, height: 0, className: "", setAttribute() {}, getContext: () => ctx, toBlob: (cb) => cb({ size: 1 }), toDataURL: () => "data:," };
      const el = (id) => (els[id] ??= { id, disabled: true, hidden: true, textContent: id === "sns-data" ? JSON.stringify(data) : "", listeners: {}, addEventListener(k, f) { this.listeners[k] = f; }, appendChild() {}, querySelector: () => ({ appendChild() {} }), click() { this.clicked = true; }, remove() {} });
      const document = { getElementById: el, querySelector: () => ({ appendChild() {} }), createElement: (t) => (t === "canvas" ? canvas : el("a-" + Math.random())), body: { appendChild(a) { els.lastA = a; } } };
      const ctxVm = { document, navigator: {}, URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} }, File: class {}, setTimeout, Promise, JSON };
      vm.runInNewContext(imgJs, ctxVm);
      return new Promise((res) => setTimeout(() => res({ texts, els }), 20));
    };
    const item = (n, extra = {}) => ({ md: "10/10", wd: "(土)", name: `公演${n}`, meta: "13:00〜・安芸高田市 会場", troupes: "", ...extra });
    let run = await drawRun({ ...sns, items: [item(1, { name: "とても長い名前の神楽の公演".repeat(6), troupes: "広島の神楽団" })], next: [] });
    const nameLines = run.texts.filter((x) => x.font.includes("42px"));
    ok(nameLines.length === 2 && nameLines[1].t.endsWith("…") && run.texts.some((x) => x.t === "出演: 広島の神楽団") && run.texts.some((x) => x.t === "今週末の広島の神楽") && run.els["sns-save"].disabled === false, "画像: 長い名称は2行で「…」で切り、出演も描き、描けたら保存できる");
    run = await drawRun({ ...sns, items: Array.from({ length: 12 }, (_, i) => item(i + 1)), next: [] });
    ok(run.texts.some((x) => /^ほか \d+件は、サイトでご覧ください$/.test(x.t)) && run.texts.every((x) => x.y <= 1350), "画像: 入りきらない分は「ほか N件」にし、はみ出して描かない");
    run = await drawRun({ ...sns, items: [], next: [item(1, { md: "10/18", name: "このあとの公演" })] });
    ok(run.texts.some((x) => x.t === "今週末の掲載は、いまのところありません") && run.texts.some((x) => x.t === "このあとの広島の神楽") && run.texts.some((x) => x.t === "このあとの公演"), "画像: 今週末の掲載がなければ、そう書き、このあとの公演を描く");
    run = await drawRun({ ...sns, note: "あ".repeat(36) + "2026年10月9日", items: [item(1)], next: [] });
    const noteLine = run.texts.find((x) => x.font.includes("24px"));
    ok(noteLine && !/\d$/.test(noteLine.t.replace(/…$/, "")) , "画像: 日付などの英数字の並びの途中では、改行しない", noteLine?.t);
    run.els["sns-save"].listeners.click();
    ok(run.els.lastA?.download === sns.file && run.els.lastA.clicked && /保存しました/.test(run.els["sns-status"].textContent), "「画像を保存」で、決まったファイル名の PNG を保存する");
    ok(run.els["sns-share"].hidden === true, "共有の画面が使えない端末では、「共有する」ボタンを出さない");

    r = build(EV, "dist-test-local-off", { TEST_WEEKEND_PREFS: "" });
    ok(r.status === 0 && !existsSync("dist-test-local-off/weekend") && !read("dist-test-local-off/weekend.html").includes('class="weekend-local"') && !read("dist-test-local-off/pref/広島県.html").includes('class="pref-weekend"'), "設定(weekendPrefectures)が空なら、県ごとの今週末は作らない", r.stderr);
    r = build(EV, "dist-test-local-bad", { TEST_WEEKEND_PREFS: "ひろしま" });
    ok(r.status !== 0 && /weekendPrefectures/.test(r.stderr), "都道府県ではない名前の設定は、ビルドを止める");

    section("コピーのボタン(共有)");
    const share = read("scripts/client/share.js");
    const dom = new JSDOM(`<button data-copy="https://example.jp/a">URLをコピー</button>`, { runScripts: "outside-only" });
    let copied = 0;
    Object.defineProperty(dom.window.navigator, "clipboard", { value: { writeText: () => { copied++; return Promise.resolve(); } } });
    dom.window.eval(share); dom.window.eval(share);
    dom.window.document.querySelector("button").click();
    await new Promise((res) => setTimeout(res, 10));
    ok(copied === 1 && dom.window.document.querySelector("button").textContent === "コピーしました" && dom.window.document.querySelector("button").getAttribute("data-label") === "URLをコピー", "2回読み込まれても1回だけコピーし、あとでボタンの元の文言に戻す");
  } finally {
    rmSync(T, { recursive: true, force: true });
    for (const d of [OUT, "dist-test-local-bad", "dist-test-local-off"]) rmSync(d, { recursive: true, force: true });
  }
}
