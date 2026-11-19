// 開催ページの、検索語に合わせたタイトル・説明文(SEO-20261110-2)
// - titleName があれば、タイトルの名称の部分をそれにする(日付・県・サイト名は、ふだんどおり付く)。ページの見出し(h1)は、名称のまま
// - seoDesc があれば、説明文をそれにする
// - 宿の検索: 東栄町(花祭)の開催は、近くの宿が出る「奥三河」で探す(東栄町だと遠い宿ばかり出る。2026-11-11 確認)
// - 特集ページ(/feature/)は作らない(2026-11-11 運営者の判断で削除)
// - 実際のデータ: 「あさひが丘神楽団」で探す人向けに、あさきた神楽公演のタイトルの先頭に団体名、説明文に開演時刻と会場を入れる
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as cheerio from "cheerio";

const read = (p) => readFileSync(p, "utf8");

export function eventSeoTests({ ok, section, build }) {
  section("開催ページ: 検索語に合わせたタイトル・説明文(SEO-20261110-2)・宿の検索の地名");
  const dir = mkdtempSync(join(tmpdir(), "event-seo-")), out = "dist-test-event-seo";
  try {
    const base = JSON.parse(read("tests/fixtures/events.test.json").replace(/^﻿/, ""));
    const ev = { id: "t-seo", name: "テスト神楽公演 テスト神楽団", titleName: "テスト神楽団 第1回テスト神楽公演", seoDesc: "テスト神楽団が出演する第1回テスト神楽公演。開演14:00、会場はテストホール。", kagura: "広島神楽", prefecture: "広島県", city: "広島市", venue: "テストホール", start: "2026-11-15T14:00", url: "https://example.com/", description: "テスト用", lat: 34.4, lng: 132.4, status: "published", checked: "2026-10-28" };
    const evFile = join(dir, "events.json");
    const hana = { id: "t-hana", name: "花祭(テスト)", kagura: "花祭", prefecture: "愛知県", city: "北設楽郡東栄町", venue: "会所", start: "2026-12-13T08:00", end: "2026-12-13T23:00", url: "https://www.toeinavi.jp/spots/hanamatsuri/", description: "テスト用", lat: 35.07, lng: 137.69, status: "published", checked: "2026-10-06" };
    writeFileSync(evFile, JSON.stringify([...base, ev, hana]));
    const r = build(evFile, out, { TEST_AFF_TRAVEL: "1" });
    ok(r.status === 0, "ビルドが通る", (r.stderr ?? "").slice(0, 300));
    const $ = cheerio.load(read(join(out, "events", "t-seo.html")));
    ok($("title").text() === "テスト神楽団 第1回テスト神楽公演(2026年11月15日) | 広島県 | 神楽めぐり", "titleName があれば、タイトルの名称の部分をそれにする(日付・県・サイト名は付く)", $("title").text());
    ok($('meta[name="description"]').attr("content") === ev.seoDesc, "seoDesc があれば、説明文をそれにする");
    ok($("h1").text().trim() === ev.name, "ページの見出しは、名称のまま");
    const plain = cheerio.load(read(join(out, "events", `${base[0].id}.html`)));
    const $h = cheerio.load(read(join(out, "events", "t-hana.html"))), hanaNote = $h(".page-notes").text();
    ok(hanaNote.includes("奥三河周辺") && !hanaNote.includes("東栄町周辺"), "花祭(東栄町)の開催ページの宿は、東栄町ではなく奥三河で探すよう案内する", hanaNote);
    ok(!existsSync(join(out, "feature")) && !read(join(out, "sitemap.xml")).includes("/feature/") && !$h("a[href^='/feature/']").length, "特集ページ(/feature/)は作らず、どこからも案内しない");
    ok(plain("title").text().startsWith(base[0].name.slice(0, 10)), "titleName のない開催は、これまでどおり名称から作る");
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
  // SEO-20261110-3: 神楽会館の毎月の一般公演は、毎回同じ形のタイトル・説明文(実際のデータでビルドしたページを見る)
  section("開催ページ: 神楽会館の毎月の一般公演のタイトル・説明文(SEO-20261110-3)");
  {
    const out2 = "dist-test-kaikan-seo", dir2 = mkdtempSync(join(tmpdir(), "kaikan-seo-"));
    try {
      const nov = { id: "t-kaikan-11", name: "神楽会館 11月一般公演(御嶽神楽)", kagura: "御嶽神楽", prefecture: "大分県", city: "豊後大野市", venue: "神楽会館", start: "2027-11-14T12:30", end: "2027-11-14T15:30", fee: "一般1,200円、中学生以下500円(当日券は、それぞれ500円増し)", url: "https://www.kagura-kaikan.jp/", description: "出演は御嶽神楽。", lat: 32.97, lng: 131.51, status: "published", checked: "2026-11-11" };
      const dec = { ...nov, id: "t-kaikan-12", name: "神楽会館 令和9年12月一般公演(第223回)", kagura: "豊後神楽", start: "2027-12-19T12:30", end: "2027-12-19T15:30", fee: "一般1,200円、中学生以下500円（当日券は500円増）", description: "" };
      const other = { ...nov, id: "t-kaikan-sp", name: "神楽会館 新年特別公演", start: "2027-01-10T12:30", end: "2027-01-10T15:30" };
      const f = join(dir2, "events.json");
      writeFileSync(f, JSON.stringify([nov, dec, other]));
      const r = build(f, out2, {});
      ok(r.status === 0, "ビルドが通る", (r.stderr ?? "").slice(0, 300));
      const pg = (id) => cheerio.load(read(join(out2, "events", `${id}.html`)));
      const n = pg("t-kaikan-11"), d = pg("t-kaikan-12");
      ok(n("title").text() === "神楽会館 御嶽神楽 一般公演 11月14日 | 豊後大野市清川町 | 神楽めぐり", "御嶽神楽の回: 「神楽会館 御嶽神楽 一般公演 ○月○日 | 豊後大野市清川町」", n("title").text());
      ok(d("title").text() === "神楽会館 豊後神楽 一般公演 12月19日 | 豊後大野市清川町 | 神楽めぐり", "ほかの団体の回は、その回の神楽の種類で同じ形(御嶽神楽と書かない)", d("title").text());
      const nd = n('meta[name="description"]').attr("content"), dd = d('meta[name="description"]').attr("content");
      ok(nd.startsWith("開演12:30(〜15:30)。前売り 一般1,200円・中学生以下500円、当日券は各500円増し。11月14日(日)、神楽会館(豊後大野市清川町)の御嶽神楽の一般公演。") && nd.includes("出演は御嶽神楽。"), "説明文の先頭に、開演時刻と前売り・当日券", nd);
      ok(dd.startsWith("開演12:30(〜15:30)。前売り 一般1,200円・中学生以下500円、当日券は各500円増し。"), "全角のかっこ・「当日券は500円増」の表記でも、同じ形になる", dd);
      ok(n("h1").text().trim() === nov.name, "ページの見出しは、名称のまま");
      ok(!pg("t-kaikan-sp")("title").text().startsWith("神楽会館 御嶽神楽 一般公演"), "一般公演でない回(特別公演)は、ふだんの形のまま");
    } finally {
      rmSync(dir2, { recursive: true, force: true });
      rmSync(out2, { recursive: true, force: true });
    }
  }
  // SEO-20261117-1: 定期公演の「予約」の語に、タイトル・説明文と「予約と当日の流れ」の段で答える(高千穂神社の神楽殿の毎晩の神楽から)
  section("定期公演: 予約の語に合わせたタイトル・説明文と「予約と当日の流れ」(SEO-20261117-1)");
  {
    const out3 = "dist-test-regular-seo", dir3 = mkdtempSync(join(tmpdir(), "regular-seo-"));
    try {
      const base = JSON.parse(read("tests/fixtures/regular.test.json").replace(/^﻿/, "")).find((x) => x.id === "r-weekly");
      const plain = { ...base, id: "t-reg-plain" };
      const flowed = { ...base, id: "t-reg-flow", seoTitle: "テスト神楽の予約と当日券｜当日18:30から受付・1,000円",
        seoDesc: "テスト文化センターで毎週水曜19時から。予約しなくても、当日18時30分から受付で当日券を買えます。料金は1人1,000円。ネット予約は30日前から前日まで。予約した人の受付は18時から。",
        bookingFlow: { lead: "予約しなくても、当日券で観られます。", steps: [{ t: "予約(しなくても観られます)", d: "ネット予約は30日前から。<b>電話</b>では予約できません。" }, { t: "18:30 当日券の販売", d: "受付で料金を払って入ります。" }, { t: "19:00 上演" }] } };
      const f = join(dir3, "regular.json");
      writeFileSync(f, JSON.stringify([flowed, plain]));
      const r = build("tests/fixtures/events.test.json", out3, { REGULAR_FILE: f, TEST_AFF_TRAVEL: "1" });
      ok(r.status === 0, "ビルドが通る", (r.stderr ?? "").slice(0, 300));
      const pg = (id) => cheerio.load(read(join(out3, "regular", `${id}.html`)));
      const $ = pg("t-reg-flow"), p = pg("t-reg-plain");
      ok($("title").text() === `${flowed.seoTitle} | 神楽めぐり` && $('meta[name="description"]').attr("content") === flowed.seoDesc, "seoTitle・seoDesc があれば、タイトル・説明文をそれにする", $('meta[name="description"]').attr("content"));
      ok(p('meta[name="description"]').attr("content").startsWith("広島県広島市中区のテスト文化センターで観られる、広島神楽の定期公演です。"), "seoDesc のない定期公演は、これまでどおりの説明文");
      const sec = $(".booking-flow");
      ok(sec.length === 1 && $(".d-top").children().first().is(".booking-flow") && sec.next().is(".keyinfo") && $(".d-lead .booking-flow").length === 0, "「予約と当日の流れ」は、説明と公式のボタンのすぐ下・要点の表の上(左の列の先頭)に置く");
      ok(sec.find("h2").text() === "予約と当日の流れ" && sec.find(".bf-lead").text() === flowed.bookingFlow.lead && sec.find("ol.flow > li").length === 3 && sec.find("ol.flow > li").first().find("b").text() === "予約(しなくても観られます)" && sec.find("ol.flow > li").last().find(".d").length === 0, "見出し・答えの一文・手順を、データのとおりに出す(説明のない手順は見出しだけ)");
      ok(sec.find("ol.flow > li").first().find(".d").text().includes("<b>電話</b>") && sec.find("ol.flow b b").length === 0, "手順の文は、HTMLとして解釈しない(エスケープする)");
      const sideOf = (x) => x(".d-side").children().map((_, c) => x(c).attr("class")).get().join(" ");
      ok(sideOf($) === sideOf(p) && sideOf($).length > 0, "右の列(宿の枠など)は、流れの段があってもなくても同じ", `${sideOf($)} / ${sideOf(p)}`);
      ok(p(".booking-flow").length === 0 && p(".d-top").children().first().is(".keyinfo"), "bookingFlow のない定期公演には、流れの段を出さない(要点の表から)");
    } finally {
      rmSync(dir3, { recursive: true, force: true });
      rmSync(out3, { recursive: true, force: true });
    }
  }
  // 実際のデータ: 検索語「あさひが丘神楽団」
  const L = JSON.parse(read("data/events.json").replace(/^﻿/, ""));
  const asa = (Array.isArray(L) ? L : L.events).find((e) => e.id === "npo-hiroshima-0cf097bb64");
  ok(asa && asa.titleName?.startsWith("あさひが丘神楽団") && asa.seoDesc?.includes("開演14:00") && asa.seoDesc.includes(asa.venue) && asa.start === "2026-11-15T14:00" && asa.description.includes("開演14:00"),
    "あさきた神楽公演: タイトルの先頭に「あさひが丘神楽団」、説明文に開演14:00と会場(開催データの時刻・公式の説明と一致)");
}
