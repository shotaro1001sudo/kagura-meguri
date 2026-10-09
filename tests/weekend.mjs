// 「今週末の神楽」「今月の神楽」のテスト
//  1) 祝日・週末(連休)・定期公演の公演日の計算
//  2) 日付を変えてビルドし、ページの中身が、その日に合っているか
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { jpHolidays, weekendRange, rangeLabel, regularOn, isRestDay } from "../scripts/lib/dates.mjs";

const read = (p) => readFileSync(p, "utf8");

export function weekendTests({ ok, section, build }) {
  section("今週末・今月: 祝日と週末の計算");
  const list = (y) => [...jpHolidays(y)].sort().map(([d, n]) => `${d.slice(5)}${n}`).join(",");
  ok(list(2026) === "01-01元日,01-12成人の日,02-11建国記念の日,02-23天皇誕生日,03-20春分の日,04-29昭和の日,05-03憲法記念日,05-04みどりの日,05-05こどもの日,05-06振替休日,07-20海の日,08-11山の日,09-21敬老の日,09-22国民の休日,09-23秋分の日,10-12スポーツの日,11-03文化の日,11-23勤労感謝の日", "2026年の祝日(振替休日・国民の休日を含む)が、内閣府の発表と一致する", list(2026));
  const h27 = jpHolidays(2027);
  ok(h27.get("2027-03-21") === "春分の日" && h27.get("2027-03-22") === "振替休日" && h27.get("2027-09-20") === "敬老の日" && h27.get("2027-09-23") === "秋分の日" && !h27.has("2027-09-21") && !h27.has("2027-09-22"), "2027年: 春分の日が日曜なら翌日が振替休日。祝日の間が2日あれば、国民の休日にならない");
  ok(isRestDay("2026-10-10") && isRestDay("2026-10-12") && !isRestDay("2026-10-09") && !isRestDay("2026-10-13"), "土日・祝日の判定");
  const w = (t) => weekendRange(t).days.join(",");
  ok(w("2026-10-09") === "2026-10-10,2026-10-11,2026-10-12", "金曜: 次の土曜からの連休(月曜の祝日まで)");
  ok(w("2026-10-11") === "2026-10-11,2026-10-12", "日曜: 今日から、連休の終わりまで(過ぎた日は含めない)");
  ok(w("2026-10-12") === "2026-10-12" && w("2026-10-13") === "2026-10-17,2026-10-18", "連休の最終日は、その日だけ。翌日(火曜)からは、次の週末");
  ok(w("2026-09-17") === "2026-09-19,2026-09-20,2026-09-21,2026-09-22,2026-09-23", "シルバーウィーク(5連休)を、ひとつの週末として扱う");
  ok(w("2026-11-03") === "2026-11-07,2026-11-08", "週末につながらない平日の祝日(文化の日・火曜)は、今週末に含めない");
  ok(w("2026-12-31") === "2027-01-01,2027-01-02,2027-01-03" && weekendRange("2026-10-09").holiday && !weekendRange("2026-10-13").holiday, "年をまたぐ連休・祝日を含むかの印");
  ok(rangeLabel("2026-10-10", "2026-10-12") === "10月10日(土)〜12日(月・祝)" && rangeLabel("2026-10-31", "2026-11-01") === "10月31日(土)〜11月1日(日)" && rangeLabel("2026-10-12", "2026-10-12") === "10月12日(月・祝)", "期間の表記(祝日・月またぎ・1日だけ)");
  const sat = { weekdays: [6], months: [1, 2, 3, 4, 5, 6, 7, 8, 12] };
  ok(!regularOn(sat, "2026-10-10") && regularOn(sat, "2026-12-05") && !regularOn(sat, "2026-12-06"), "定期公演: 曜日と、公演する月で判定する(期間外の月は、出さない)");
  ok(!regularOn({ weekdays: [0, 1, 2, 3, 4, 5, 6], closedDates: ["11-23"] }, "2026-11-23") && regularOn({ weekdays: [0, 1, 2, 3, 4, 5, 6], closedDates: ["11-23"] }, "2026-11-22"), "定期公演: 休演日は、出さない");
  ok(!regularOn({ weekdays: [6], until: "2026-10-01" }, "2026-10-10") && !regularOn({ schedule: "毎週土曜" }, "2026-10-10"), "定期公演: 終了後と、曜日のデータがないものは、出さない(日付を推測しない)");

  section("今週末・今月: ページ(2026年10月9日 金曜 = 3連休の前日)");
  const D = "dist-test-weekend";
  const b = (out, now, extra = {}) => { const r = build("tests/fixtures/events.test.json", out, { BUILD_NOW: now, ...extra }); ok(r.status === 0, `ビルド(${now})`, r.stderr); return out; };
  const A = b(`${D}-a`, "2026-10-09T12:00");
  const $ = (f) => cheerio.load(read(join(A, f)));
  let wk = $("weekend.html"), tm = $("this-month.html");
  const hrefs = (q) => q("main a").map((_, a) => q(a).attr("href")).get();
  const ld = (q) => q('script[type="application/ld+json"]').map((_, s) => JSON.parse(q(s).text())).get().flat();
  ok(wk("title").text() === "今週末の神楽(10月10日(土)〜12日(月・祝)) | 神楽めぐり" && wk("h1").text() === "今週末の神楽" && wk(".hero p").text().includes("3連休・スポーツの日"), "今週末: 見出しに、期間・連休・祝日の名前が出る");
  ok(hrefs(wk).includes("/events/t-timeunknown.html") && !hrefs(wk).includes("/events/t-ongoing.html") && !hrefs(wk).includes("/events/t-past.html") && !hrefs(wk).includes("/events/t-pending.html"), "今週末: 週末の開催だけが載る(金曜・終了・保留は載らない)");
  ok(hrefs(wk).includes("/regular/r-nightly.html") && !hrefs(wk).includes("/regular/r-weekly.html") && !hrefs(wk).includes("/regular/r-expired.html") && !hrefs(wk).includes("/regular/r-xss.html"), "今週末: 毎晩の公演は載り、水曜の公演・終了した公演・曜日が不明な公演は載らない");
  ok(wk("main").text().includes("臨時の休演") && wk("main").text().includes("2026年10月9日時点") && wk("main").text().includes("毎日、自動で更新"), "今週末: 時点・自動更新・休演の注意書き");
  ok(ld(wk).some((x) => x["@type"] === "ItemList" && x.itemListElement.some((i) => i.url.endsWith("/events/t-timeunknown.html"))) && ld(wk).some((x) => x["@type"] === "BreadcrumbList"), "今週末: 構造化データ(一覧・パンくず)");
  ok(wk('.top nav a[href="/weekend.html"]').attr("aria-current") === "page", "メニューに「今週末」があり、今いるページが分かる");
  ok(tm("title").text() === "今月の神楽 2026年10月の開催日程 | 神楽めぐり" && hrefs(tm).includes("/events/t-timeunknown.html") && hrefs(tm).includes("/events/t-ongoing.html") && !hrefs(tm).includes("/events/t-full.html"), "今月: 今日から月末までの開催が載る(開催中を含み、来月は含まない)");
  ok(tm("main").text().includes("今月の公演日: 14日・21日・28日") && !tm("main").text().includes("来月("), "今月: 毎週の公演の、今月の公演日が出る。月末が遠いときは、来月を出さない");
  const home = $("index.html");
  ok(home('.quick a[href="/weekend.html"]').text().includes("10月10日(土)〜12日(月・祝)(3連休)") && home('.quick a[href="/this-month.html"]').text().includes("開催 2件"), "トップに、今週末・今月への入口がある(期間と件数つき)");
  const sm = read(join(A, "sitemap.xml"));
  ok(/weekend\.html<\/loc><lastmod>2026-10-0\d</.test(sm) && /this-month\.html<\/loc><lastmod>2026-10-0\d</.test(sm) && !/name="robots" content="noindex/.test(read(join(A, "weekend.html"))) && wk('link[rel="canonical"]').attr("href").endsWith("/weekend.html"), "検索に載せる(サイトマップ・canonical・noindex なし)");

  section("今週末・今月: ページ(2026年11月21日 土曜 = 月末が近い3連休)");
  const B = b(`${D}-b`, "2026-11-21T12:00");
  wk = cheerio.load(read(join(B, "weekend.html"))); tm = cheerio.load(read(join(B, "this-month.html")));
  ok(wk("main").text().includes("見つかっていません") && wk("main").text().includes("11月22日(日)・11月23日(月)は、休演です") === false && wk("main").text().includes("11月23日(月)は、休演です"), "開催がない週末は、その旨と、休演日を示す");
  ok(wk("main h2").text().includes("このあとの神楽") && hrefs(wk).includes("/events/t-xss.html"), "開催がない週末も、このあとの開催を案内する");
  ok(tm("main").text().includes("これからの開催情報は、いまのところ見つかっていません") && tm("main").text().includes("今月の公演日: 25日") && !tm('meta[name="description"]').attr("content").includes("0件"), "今月: 開催がないとき(説明文に「0件」と書かない)");
  ok(tm("main h2").text().includes("来月(2026年12月)の神楽") && hrefs(tm).includes("/events/t-xss.html") && hrefs(tm).includes("/events/t-long.html"), "月末まで10日以内なら、来月の開催も載せる");

  section("今週末・今月: データの検査");
  const T = "tests/.tmp-weekend";
  mkdirSync(T, { recursive: true });
  const reg = JSON.parse(read("tests/fixtures/regular.test.json").replace(/^﻿/, ""));
  for (const [field, val, msg] of [["weekdays", [7], "weekdays"], ["months", [13], "months"], ["closedDates", ["11/23"], "closedDates"]]) {
    writeFileSync(`${T}/r.json`, JSON.stringify(reg.map((r) => (r.id === "r-nightly" ? { ...r, [field]: val } : r))));
    const r = build("tests/fixtures/events.test.json", `${D}-bad`, { REGULAR_FILE: `${T}/r.json` });
    ok(r.status !== 0 && r.stderr.includes(msg), `定期公演の ${field} が不正なら、ビルドを止める`, r.stderr);
  }
  const real = JSON.parse(read("data/regular.json").replace(/^﻿/, ""));
  ok(real.every((r) => Array.isArray(r.weekdays)) && real.every((r) => !/毎週(月|火|水|木|金|土|日)曜/.test(r.schedule) || r.weekdays.length === 1 && "日月火水木金土"[r.weekdays[0]] === r.schedule.match(/毎週(.)曜/)[1]) && real.filter((r) => /毎晩|毎日/.test(r.schedule)).every((r) => r.weekdays.length === 7), "本番の定期公演: 曜日のデータが、schedule の文章(毎週○曜・毎晩)と一致している");
  for (const d of [`${D}-a`, `${D}-b`, `${D}-bad`, T]) rmSync(d, { recursive: true, force: true });
}
