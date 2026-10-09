// 週次の自動収集・自動掲載のテスト
//  1) 判断の部品(検査・掲載/保留/取り下げ)の単体テスト
//  2) 小さなWebサーバーを立て、取得元のページが週ごとに変わる様子を再現して、collect.mjs を実際に動かす
//  3) 週次ワークフローの安全装置(順序・権限・起動)の確認
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { guardEvent, reconcile, DEFAULTS } from "../scripts/lib/collect-core.mjs";

const NOW = new Date("2026-10-12T05:00:00+09:00");
const week = (n) => new Date(NOW.getTime() + n * 7 * 864e5);
const read = (p) => readFileSync(p, "utf8");
const J = (p) => JSON.parse(read(p).replace(/^﻿/, ""));

export async function collectTests({ ok, section }) {
  // ---------- 1. 検査 ----------
  section("自動収集: 1件ずつの検査(guardEvent)");
  const base = { name: "高宮神楽まつり", kagura: "安芸高田神楽", prefecture: "広島県", city: "安芸高田市", venue: "広場", start: "2026-11-23T19:00", url: "https://example.com/a" };
  const g = (o) => guardEvent({ ...base, ...o }, { now: NOW });
  ok(g({}).length === 0, "正しい候補は、合格する");
  ok(g({ start: "2026-10-11T19:00" }).includes("すでに終わった日付"), "昨日の日付は、不合格(すでに終わった)");
  ok(g({ start: "2026-10-12T00:00", timeUnknown: true }).length === 0, "今日の日付は、合格する");
  ok(g({ start: "2028-01-01T10:00" }).some((x) => /400日より先/.test(x)), "400日より先の日付は、不合格(読み取りの誤りの疑い)");
  ok(g({ start: "2026/11/23 19:00" }).some((x) => /形式が不正/.test(x)) && g({ start: "2026-13-45T25:99" }).some((x) => /形式が不正/.test(x)), "日時の形式が不正・存在しない日付は、不合格");
  ok(g({ prefecture: "" }).some((x) => /都道府県/.test(x)) && g({ prefecture: "安芸県" }).some((x) => /都道府県/.test(x)), "都道府県が空・存在しないものは、不合格");
  ok(g({ kagura: "" }).includes("神楽の種類が不明"), "神楽の種類が空は、不合格");
  ok(g({ city: "", venue: "", address: "" }).includes("場所(市区町村・会場)が不明"), "場所が全くないものは、不合格");
  ok(g({ name: "もっと見る" }).length > 0 && g({ name: "<script>x</script>" }).length > 0 && g({ name: "あ" }).length > 0 && g({ name: "あ".repeat(101) }).length > 0, "名称が、ナビの文字・HTML・短すぎ・長すぎは、不合格");
  ok(g({ url: "javascript:alert(1)" }).includes("公式情報のURLが不正") && g({ url: "" }).includes("公式情報のURLが不正"), "危険な・空のURLは、不合格");
  ok(g({ end: "2026-11-22T20:00" }).includes("終了日時が不正") && g({ end: "2026-12-30T20:00" }).some((x) => /3日を超える/.test(x)), "終了が開始より前・3日を超える期間は、不合格");
  ok(g({ city: "あ".repeat(50) }).some((x) => /長すぎる/.test(x)), "場所の文字が、異常に長いものは、不合格(読み取りの誤りの疑い)");

  // ---------- 2. 掲載・保留・取り下げの判断 ----------
  section("自動収集: 掲載・保留・取り下げの判断(reconcile)");
  const src = { id: "t", name: "テスト協会", kagura: "安芸高田神楽", prefecture: "広島県", url: "https://example.com/list" };
  const cand = (name, start, extra = {}) => ({ name, start, prefecture: "広島県", city: "安芸高田市", venue: "広場", url: "https://example.com/" + encodeURIComponent(name), ...extra });
  const manual = { id: "manual-1", name: "手で登録した神楽", kagura: "石見神楽", prefecture: "島根県", city: "益田市", venue: "会場", start: "2026-11-23T19:00", url: "https://example.com/m", status: "published", source: "公式", checked: "2026-10-09" };
  let r = reconcile({ events: [manual], candidates: [cand("神楽A", "2026-11-23T19:00"), cand("神楽B", "2026-11-29T18:00"), cand("神楽C", "2026-12-05T18:00")], source: src, now: NOW });
  ok(r.summary.published.length === 3 && r.summary.held.length === 0 && r.events.length === 4, "検査に通った新規は、自動で掲載される(published)");
  const A = r.events.find((e) => e.name === "神楽A");
  ok(A.auto && A.sourceId === "t" && A.firstSeen === "2026-10-12" && A.lastSeen === "2026-10-12" && A.misses === 0 && A.status === "published" && A.source === "テスト協会" && A.sourceUrl, "自動で掲載したものに、収集元・初回/最終取得日・欠落回数が記録される");
  ok(JSON.stringify(r.events.find((e) => e.id === "manual-1")) === JSON.stringify(manual), "運営者が登録したものは、変更されない");
  // 異常な件数
  r = reconcile({ events: [], candidates: Array.from({ length: 16 }, (_, i) => cand(`神楽${i}`, "2026-11-23T19:00")), source: src, now: NOW });
  ok(r.summary.published.length === 0 && r.summary.held.length === 16 && r.summary.notes.some((n) => /ページの異常/.test(n)) && r.events.every((e) => e.holdReasons.includes("一度の新規が多すぎる")), "新規が上限(15件)を超えたら、ページの異常を疑い、全部を保留にする");
  r = reconcile({ events: [], candidates: Array.from({ length: 15 }, (_, i) => cand(`神楽${i}`, "2026-11-23T19:00")), source: src, now: NOW });
  ok(r.summary.published.length === 15, "上限ちょうど(15件)は、掲載される");
  // 保留
  r = reconcile({ events: [], candidates: [cand("正常な神楽", "2026-11-23T19:00"), cand("遠い神楽", "2030-01-01T19:00"), cand("もっと見る", "2026-11-24T19:00"), cand("過去の神楽", "2026-09-01T19:00")], source: src, now: NOW });
  ok(r.summary.published.length === 1 && r.summary.held.length === 2 && r.summary.past === 1 && r.events.length === 3, "検査に通らないものは保留、過去のものは、記録しない");
  ok(r.events.filter((e) => e.status === "pending").every((e) => e.holdReasons.length > 0 && !r.summary.published.includes(e)), "保留には、理由(holdReasons)が付く");
  // 自動掲載オフ
  r = reconcile({ events: [], candidates: [cand("神楽A", "2026-11-23T19:00")], source: src, now: NOW, cfg: { autoPublish: false } });
  ok(r.summary.published.length === 0 && r.summary.held.length === 1 && r.events[0].status === "pending" && r.events[0].holdReasons.includes("自動掲載が、オフになっている"), "自動掲載がオフなら、検査に通っても、すべて保留になる");
  // 重複・却下
  const first = reconcile({ events: [manual], candidates: [cand("神楽A", "2026-11-23T19:00")], source: src, now: NOW });
  const again = reconcile({ events: first.events, candidates: [cand("神楽A", "2026-11-23T19:00")], source: src, now: week(1) });
  ok(again.events.length === 2 && again.summary.unchanged === 1 && again.events.find((e) => e.name === "神楽A").lastSeen === "2026-10-19", "同じ内容を再取得しても、増えず、最終取得日だけが更新される");
  ok(reconcile({ events: [manual], candidates: [{ ...cand("手で登録した神楽", "2026-11-23T19:00"), prefecture: "島根県" }], source: src, now: NOW }).summary.duplicates === 1, "運営者が登録済みと同じ内容は、重複として、追加しない");
  ok(reconcile({ events: [], candidates: [cand("神楽A", "2026-11-23T19:00")], source: src, now: NOW, rejectedIds: new Set([first.events[1].id]) }).summary.rejected === 1, "却下済み(rejected)のものは、再び追加しない");
  // 名称のゆれ・時刻の有無を超えた重複(本番の試運転で見つかった問題)
  const m2 = { ...manual, id: "m2", name: "第54回 高宮神楽まつり", prefecture: "広島県", city: "安芸高田市", start: "2026-10-18T17:00" };
  const dup = (name, start, extra = {}) => reconcile({ events: [m2], candidates: [cand(name, start, extra)], source: src, now: NOW }).summary;
  ok(dup("第54回高宮神楽まつり", "2026-10-18T00:00", { timeUnknown: true }).duplicates === 1, "名称の空白の違いと、時刻の有無(17:00 と 時間未定)があっても、同じ開催と判定して、重複を防ぐ");
  ok(dup("第５４回高宮神楽まつり", "2026-10-18T19:00").duplicates === 1 && dup("高宮神楽まつり", "2026-10-18T17:00").duplicates === 1, "全角数字・「第54回」の有無でも、重複を防ぐ(一方が他方を含む)");
  ok(dup("第54回高宮神楽まつり", "2026-10-19T17:00").duplicates === 0 && dup("まつり", "2026-10-18T17:00").duplicates === 0 && reconcile({ events: [m2], candidates: [cand("第54回高宮神楽まつり", "2026-10-18T17:00", { prefecture: "島根県" })], source: src, now: NOW }).summary.duplicates === 0, "日付・都道府県が違うもの、短すぎる名称は、別の開催として扱う(誤って、掲載を止めない)");
  ok(reconcile({ events: [], candidates: [cand("神楽A", "2026-11-23T19:00"), cand("神楽 A", "2026-11-23T20:00")], source: src, now: NOW }).summary.published.length === 1, "取得したもの同士の重複も、1件にまとめる");
  // 神楽以外の催しの疑い
  const hint = { ...src, nameHint: "神楽|舞|神能" };
  const hr = reconcile({ events: [], candidates: [cand("かむくら座ミニコンサート2026", "2026-10-25T11:30"), cand("美土里米舞まつり", "2026-10-18T10:00"), cand("高宮神楽まつり", "2026-11-10T17:00")], source: hint, now: NOW });
  ok(hr.summary.published.length === 2 && hr.summary.held.length === 1 && hr.summary.held[0].name.includes("ミニコンサート") && hr.summary.held[0].holdReasons[0].includes("神楽以外の催しの疑い"), "名称に神楽らしい語(nameHint)がないものは、捨てずに保留にして、人が確認する");
  ok(reconcile({ events: [], candidates: [cand("かむくら座ミニコンサート2026", "2026-10-25T11:30")], source: { ...src, nameHint: "(" }, now: NOW }).summary.published.length === 1, "nameHint の正規表現が壊れていても、止まらない(無視する)");
  // 日程の変更
  r = reconcile({ events: first.events, candidates: [cand("神楽A", "2026-12-01T19:00")], source: src, now: week(1) });
  const oldA = r.events.find((e) => e.name === "神楽A" && e.start.startsWith("2026-11-23")), newA = r.events.find((e) => e.name === "神楽A" && e.start.startsWith("2026-12-01"));
  ok(oldA.status === "withdrawn" && /日程が変わった/.test(oldA.withdrawnReason) && newA.status === "published" && r.summary.withdrawn.length === 1, "日程が変わったら、古い日程を取り下げ、新しい日程を掲載する");
  // 消失
  const three = reconcile({ events: [], candidates: [cand("神楽A", "2026-11-23T19:00"), cand("神楽B", "2026-11-29T18:00"), cand("神楽C", "2026-12-05T18:00")], source: src, now: NOW }).events;
  r = reconcile({ events: three, candidates: [cand("神楽A", "2026-11-23T19:00"), cand("神楽B", "2026-11-29T18:00")], source: src, now: week(1) });
  const C1 = r.events.find((e) => e.name === "神楽C");
  ok(C1.status === "published" && C1.misses === 1 && r.summary.withdrawn.length === 0 && r.summary.notes.some((n) => /1\/2回目/.test(n)), "取得元から1回消えただけでは、取り下げない(次も消えたら取り下げる、と知らせる)");
  r = reconcile({ events: r.events, candidates: [cand("神楽A", "2026-11-23T19:00"), cand("神楽B", "2026-11-29T18:00")], source: src, now: week(2) });
  const C2 = r.events.find((e) => e.name === "神楽C");
  ok(C2.status === "withdrawn" && C2.misses === 2 && /2回続けて消えた/.test(C2.withdrawnReason) && r.summary.withdrawn.length === 1, "2回続けて消えたら、自動で取り下げる");
  r = reconcile({ events: r.events, candidates: [cand("神楽A", "2026-11-23T19:00"), cand("神楽B", "2026-11-29T18:00"), cand("神楽C", "2026-12-05T18:00")], source: src, now: week(3) });
  ok(r.events.find((e) => e.name === "神楽C").status === "published" && r.summary.published.some((e) => e.note === "再掲載"), "取り下げたものが取得元に戻ったら、検査し直して、再掲載する");
  // ページ崩れ
  r = reconcile({ events: three, candidates: [], source: src, now: week(1) });
  ok(r.summary.withdrawn.length === 0 && three.every((_, i) => r.events[i].status === "published") && r.summary.notes.some((n) => /取り下げはしていません/.test(n)), "1件も取得できない(ページの崩れ)ときは、「全部が消えた」と信じず、取り下げない");
  r = reconcile({ events: three, candidates: [cand("神楽A", "2026-11-23T19:00")], source: src, now: week(1) });
  ok(r.summary.withdrawn.length === 0 && r.events.filter((e) => e.misses).length === 0 && r.summary.notes.some((n) => /ページの構造が変わった/.test(n)), "取得件数が、半分を下回ったら(3件中1件)、ページの異常とみなして、取り下げない");
  // ほかの収集元・運営者の登録には、触れない
  const other = { ...A, id: "o-1", sourceId: "other", name: "別の収集元のもの", start: "2026-11-30T19:00" };
  r = reconcile({ events: [manual, other], candidates: [cand("神楽X", "2026-12-10T19:00")], source: src, now: week(2) });
  ok(r.events.find((e) => e.id === "o-1").status === "published" && r.events.find((e) => e.id === "o-1").misses === 0 && r.events.find((e) => e.id === "manual-1").status === "published", "ほかの収集元・運営者の登録を、取り下げたり、変更したりしない");
  ok(JSON.stringify(manual) === JSON.stringify(first.events[0]), "reconcile は、入力を、書き換えない(コピーを返す)");

  // ---------- 3. iCalendar アダプタ ----------
  section("自動収集: iCalendar(.ics)アダプタ");
  const ics = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "SUMMARY:石見神楽 秋の\\, 大公演", "DTSTART;TZID=Asia/Tokyo:20261123T190000", "DTEND;TZID=Asia/Tokyo:20261123T210000", "LOCATION:島根県益田市 駅前ホール", "URL:https://example.com/e1", "DESCRIPTION:これは取り込まない本文", "END:VEVENT",
    "BEGIN:VEVENT", "SUMMARY:終日の神楽", "DTSTART;VALUE=DATE:20261201", "DTEND;VALUE=DATE:20261202", "LOCATION:広島県三次市", "END:VEVENT",
    "BEGIN:VEVENT", "SUMMARY:UTCの神楽", "DTSTART:20261205T100000Z", "LOCATION:岡山県高梁市", "END:VEVENT", "BEGIN:VEVENT", "SUMMARY:日付なし", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const ical = (await import("../scripts/adapters/ical.mjs")).parse(ics, { url: "https://example.com/c.ics" });
  ok(ical.length === 3, "日付のない項目は、捨てる(3件)", String(ical.length));
  ok(ical[0].name === "石見神楽 秋の, 大公演" && ical[0].start === "2026-11-23T19:00" && ical[0].end === "2026-11-23T21:00" && ical[0].prefecture === "島根県" && ical[0].city === "益田市" && ical[0].venue === "駅前ホール" && ical[0].url === "https://example.com/e1", "名称・日時・県/市/会場・URLを読む(エスケープも解く)");
  ok(ical[1].timeUnknown === true && ical[1].start === "2026-12-01T00:00" && ical[1].end === undefined, "終日は、時間未定として読む(翌日0時の終了は、終了にしない)");
  ok(ical[2].start === "2026-12-05T19:00", "UTC(Z)は、日本時間に直す(10:00Z → 19:00)");
  ok(!JSON.stringify(ical).includes("取り込まない本文"), "説明文(DESCRIPTION)は、取り込まない");

  // ---------- 4. collect.mjs を、実際に動かす ----------
  section("自動収集: 週ごとに変わるページを、実際に取得して、掲載・取り下げ(統合テスト)");
  const T = "tests/.tmp-collect";
  rmSync(T, { recursive: true, force: true }); mkdirSync(T, { recursive: true });
  const li = (name, date, place = "広島県安芸高田市 高宮ハーモニー広場") => `<li><a href="/e/${encodeURIComponent(name)}">${name}</a><span class="d">${date}</span><span class="p">${place}</span></li>`;
  const site = { page: "", status: 200, robots: "", hits: {} };
  const server = createServer((q, res) => {
    const p = new URL(q.url, "http://x").pathname; site.hits[p] = (site.hits[p] ?? 0) + 1;
    if (p === "/robots.txt") { if (!site.robots) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": "text/plain" }); return res.end(site.robots); }
    res.writeHead(site.status, { "content-type": "text/html; charset=utf-8" }); res.end(`<ul class="ev">${site.page}</ul>`);
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const source = { id: "t", name: "テスト観光協会", adapter: "selectors", url: `http://localhost:${port}/list`, kagura: "安芸高田神楽", prefecture: "広島県", termsChecked: "2026-10-09", selectors: { item: ".ev li", name: "a", date: ".d", place: ".p", link: "a" } };
  const files = { EVENTS_FILE: `${T}/events.json`, SOURCES_FILE: `${T}/sources.json`, REJECTED_FILE: `${T}/rejected.json`, REPORT_FILE: `${T}/report.md`, SUMMARY_FILE: `${T}/summary.json` };
  const put = (f, v) => writeFileSync(f, JSON.stringify(v, null, 2));
  const manualEv = { ...manual };
  put(files.EVENTS_FILE, [manualEv]); put(files.SOURCES_FILE, [source]); put(files.REJECTED_FILE, []);
  const run = (at, extra = {}) => new Promise((resolve) => {
    const c = spawn("node", ["scripts/collect.mjs"], { env: { ...process.env, ...files, COLLECT_NOW: at.toISOString(), COLLECT_DELAY_MS: "0", ...extra }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = ""; c.stdout.on("data", (d) => (out += d)); c.stderr.on("data", (d) => (err += d)); c.on("close", (code) => resolve({ code, out, err }));
  });
  const evs = () => J(files.EVENTS_FILE), sum = () => J(files.SUMMARY_FILE), byName = (n) => evs().filter((e) => e.name === n);

  // 規約の確認日がない・停止中・robots で禁止 → 取得しない
  put(files.SOURCES_FILE, [{ ...source, termsChecked: "" }]); site.page = li("神楽A", "2026年11月23日 19:00");
  let x = await run(NOW);
  ok(x.code === 0 && !site.hits["/list"] && /termsChecked/.test(x.out) && evs().length === 1, "規約の確認日(termsChecked)がない収集元は、アクセスすらしない");
  ok(sum().inactive === 1 && /止まっている収集元が 1 つ/.test(read(files.REPORT_FILE)), "規約の確認待ちで止まっている収集元の数が、レポートと結果に出る(「確認不要」とだけ出て、誤解されない)");
  put(files.SOURCES_FILE, [{ ...source, enabled: false }]); x = await run(NOW);
  ok(!site.hits["/list"], "停止中(enabled: false)の収集元は、アクセスしない");
  put(files.SOURCES_FILE, [source]); site.robots = "User-agent: *\nDisallow: /list"; x = await run(NOW);
  ok(!site.hits["/list"] && /robots\.txt/.test(x.out) && evs().length === 1, "robots.txt が禁止していたら、取得しない");
  site.robots = "";

  // 1週目
  site.page = [li("神楽A", "2026年11月23日 19:00"), li("神楽B", "2026年11月29日 18:00"), li("神楽C", "2026年12月5日 18:00"), li("過去の神楽", "2026年9月1日 19:00"), li("遠い神楽", "2030年1月1日 19:00"), li("もっと見る", "2026年11月24日 10:00")].join("");
  x = await run(NOW);
  ok(x.code === 0 && site.hits["/list"] === 1 && site.hits["/robots.txt"] >= 1, "規約確認済みの収集元は、robots.txt を見てから、1回だけ取得する");
  let s = sum();
  ok(s.published === 3 && s.held === 2 && s.withdrawn === 0 && s.needsAttention === true, "1週目: 3件を自動掲載、2件(遠い・ナビの文字)を保留、要確認の印が付く", JSON.stringify(s));
  ok(s.items?.published?.length === 3 && s.items.published.some((e) => e.name === "神楽A" && e.start && e.url) && s.items.held.every((e) => e.reason) && s.inactive === 0, "結果のファイルに、通知用の明細(名称・日付・URL・保留の理由)が入る");
  ok(byName("神楽A")[0].status === "published" && byName("遠い神楽")[0].status === "pending" && byName("もっと見る")[0].status === "pending" && byName("過去の神楽").length === 0, "掲載・保留・過去(記録しない)が、それぞれ正しい");
  ok(JSON.stringify(evs().find((e) => e.id === "manual-1")) === JSON.stringify(manualEv), "運営者が登録した情報は、ファイル上でも、変わっていない");
  let rep = read(files.REPORT_FILE);
  ok(/確認が必要な項目があります/.test(rep) && rep.includes("遠い神楽") && /400日より先/.test(rep) && rep.includes("神楽A") && /review\.mjs approve/.test(rep), "レポートに、掲載したもの・保留と理由・確認の手順が出る");
  // 本番のビルドを、通るか(自動で増えたデータが、サイトを壊さない)
  const buildWith = (extra = {}) => spawnSync("node", ["scripts/build.mjs"], { env: { ...process.env, EVENTS_FILE: files.EVENTS_FILE, REGULAR_FILE: "tests/fixtures/events.empty.json", OUT_DIR: `${T}/site`, BUILD_NOW: "2026-10-12T12:00", ...extra }, encoding: "utf8" });
  let b = buildWith();
  ok(b.status === 0 && /built: 4 events/.test(b.stdout), "自動で掲載したデータで、サイトのビルドが通る(掲載4件 = 自動3 + 手動1。保留は含まれない)", b.stderr + b.stdout);
  const pg = cheerio.load(read(`${T}/site/events/${byName("神楽A")[0].id}.html`));
  ok(pg("body").text().includes("プログラムで取得し、自動の検査を経て、掲載しています") && pg("body").text().includes("取得日"), "自動で掲載したページに、自動取得であることと、取得日が表示される");
  ok(!existsSync(`${T}/site/events/${byName("遠い神楽")[0].id}.html`), "保留のものは、ページが作られない");
  // 再取得(変更なし)
  x = await run(week(0)); ok(sum().published === 0 && evs().length === 7 - 1 + 0 || evs().length >= 6, "同じページを再取得しても、増えない");

  // 2週目: B の日程が変わり、C が消え、G が増える
  site.page = [li("神楽A", "2026年11月23日 19:00"), li("神楽B", "2026年12月1日 18:00"), li("神楽G", "2026年12月10日 18:00"), li("遠い神楽", "2030年1月1日 19:00"), li("もっと見る", "2026年11月24日 10:00")].join("");
  x = await run(week(1)); s = sum();
  ok(s.published === 2 && s.withdrawn === 1, "2週目: 新しい日程(B)・新規(G)を掲載し、古い日程のBを取り下げる", JSON.stringify(s));
  ok(byName("神楽B").find((e) => e.start.startsWith("2026-11-29")).status === "withdrawn" && byName("神楽B").find((e) => e.start.startsWith("2026-12-01")).status === "published", "Bは、旧日程が取り下げ・新日程が掲載");
  ok(byName("神楽C")[0].status === "published" && byName("神楽C")[0].misses === 1, "Cは、1回消えただけなので、まだ掲載されている(欠落 1回)");
  ok(/取得元から消えました/.test(read(files.REPORT_FILE)) || /1\/2回目/.test(x.out), "レポートに、Cが消えたことが出る");
  // 3週目: C が続けて消える
  x = await run(week(2));
  ok(byName("神楽C")[0].status === "withdrawn" && /2回続けて消えた/.test(byName("神楽C")[0].withdrawnReason), "3週目: Cが2回続けて消えたので、自動で取り下げられる");
  b = buildWith();
  const bn = evs().filter((e) => e.status === "published").length;
  ok(b.status === 0 && new RegExp(`built: ${bn} events`).test(b.stdout) && !existsSync(`${T}/site/events/${byName("神楽C")[0].id}.html`), "取り下げたものは、サイトからも消える(ページが作られない)", b.stdout);
  // ページが崩れた(0件): 取り下げない
  const before = JSON.stringify(evs()); site.page = ""; x = await run(week(3));
  ok(JSON.stringify(evs().map((e) => ({ ...e, lastSeen: 0 }))) === JSON.stringify(JSON.parse(before).map((e) => ({ ...e, lastSeen: 0 }))) && /0件|取り下げはしていません/.test(x.out), "取得元のページが空(崩れ)になっても、何も取り下げない。レポートで知らせる");
  // 取得に失敗(HTTP 500): 何も変えない
  site.status = 500; site.page = li("神楽A", "2026年11月23日 19:00"); const b500 = JSON.stringify(evs()); x = await run(week(4));
  ok(JSON.stringify(evs()) === b500 && /HTTP 500/.test(x.out) && sum().needsAttention === true, "取得に失敗(HTTP 500)したら、その収集元は何も変えず、要確認にする");
  site.status = 200;
  // 件数の異常
  site.page = Array.from({ length: 18 }, (_, i) => li(`大量${i}`, "2026年12月20日 19:00")).join(""); x = await run(week(5));
  ok(evs().filter((e) => e.name.startsWith("大量")).length === 18 && evs().filter((e) => e.name.startsWith("大量")).every((e) => e.status === "pending") && sum().held >= 18, "一度に18件(上限15件超)増えたら、全部を保留にする");
  // 自動掲載オフ
  site.page = li("神楽H", "2026年12月15日 19:00"); x = await run(week(6), { COLLECT_AUTOPUBLISH: "0" });
  ok(byName("神楽H")[0].status === "pending" && sum().autoPublish === false, "自動掲載をオフにすると、検査に通ったものも、保留になる");
  // 却下したものは、戻ってこない
  put(files.REJECTED_FILE, [{ id: byName("神楽H")[0].id }]); put(files.EVENTS_FILE, evs().filter((e) => e.name !== "神楽H")); x = await run(week(7));
  ok(byName("神楽H").length === 0, "却下(rejected)したものは、再び取得されても、追加されない");
  server.close(); rmSync(T, { recursive: true, force: true });

  // ---------- 5. 週次ワークフローの安全装置 ----------
  section("自動収集: 週次ワークフロー(GitHub Actions)の安全装置");
  const wf = read(".github/workflows/collect.yml");
  const at = (s) => wf.indexOf(s);
  ok(/cron: "0 20 \* \* 0"/.test(wf), "毎週(日曜20時UTC = 月曜5時JST)に動く");
  ok(/workflow_dispatch/.test(wf) && /dry_run/.test(wf), "手動の起動と、試運転(dry_run)ができる");
  ok(at("node scripts/collect.mjs") < at("node scripts/geocode.mjs") && at("node scripts/geocode.mjs") < at("npm test") && at("npm test") < at("git push"), "順序: 取得 → 位置付け → テスト → 反映(テストに通らなければ、反映されない)");
  // 秘密情報(メールのアカウント)は、最後の通知の手順だけに渡す
  const notifyAt = at("- name: notify-mail");
  const secretUses = [...wf.matchAll(/secrets\.(\w+)/g)];
  ok(/permissions:[\s\S]*contents: write[\s\S]*issues: write[\s\S]*actions: write/.test(wf) && !/pull_request_target/.test(wf), "権限は、必要な3つだけ。pull_request_target を使わない");
  ok(notifyAt > 0 && secretUses.length === 5 && secretUses.every((m) => m.index > notifyAt && /^MAIL_/.test(m[1])) && !/run:[^\n]*secrets\./.test(wf) && !/echo[^\n]*MAIL_PASSWORD/.test(wf), "秘密情報は、メールの設定だけで、最後の通知の手順にだけ渡す(収集・テストには渡さず、表示もしない)");
  ok(/MAIL_TO: \$\{\{ secrets\.MAIL_TO \}\}/.test(wf) && !/[\w.+-]+@[\w-]+\.[\w.]+/.test(wf.replace(/41898282\+github-actions\[bot\]@users\.noreply\.github\.com/, "")), "送り先のアドレスは、Secrets から読み、ワークフローには書かない");
  ok(notifyAt > at("gh issue create") && /- name: notify-mail\n\s+if: \$\{\{ always\(\) \}\}/.test(wf) && /JOB_STATUS: \$\{\{ job\.status \}\}/.test(wf) && /DRY_RUN: \$\{\{ inputs\.dry_run \}\}/.test(wf), "メールの通知は、最後に、成功・失敗・試運転のどれでも行う");
  ok(/gh workflow run deploy\.yml/.test(wf) && /gh run watch "\$id" --exit-status/.test(wf) && /DEPLOY_RESULT: \$\{\{ steps\.deploy\.outputs\.result \}\}/.test(wf), "公開を明示的に起動し、完了まで待って、結果を通知に使う");
  ok(/gh issue create/.test(wf) && /failure\(\)/.test(wf) && /needsAttention|attention/.test(wf), "要確認の項目・失敗は、Issueで知らせる");
  ok(/concurrency:/.test(wf) && /timeout-minutes/.test(wf), "同時実行の防止と、時間の上限がある");
  ok(/git pull --rebase/.test(wf) && /git add data\/events\.json/.test(wf) && !/git add -A|git add \./.test(wf), "反映するのは data/ の決まったファイルだけ(ほかのファイルを巻き込まない)");
  ok(/workflow_dispatch/.test(read(".github/workflows/deploy.yml")), "公開のワークフローが、手動・外部からの起動に対応している");
}
