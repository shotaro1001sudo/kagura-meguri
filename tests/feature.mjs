// 特集「遠山の霜月祭と花祭 夜通しの神楽の見方・泊まり方」のテスト(ADV-20261110-5)
// - 日程は開催データの「これからの開催」から並ぶ(終わった開催・ほかの種類は載らない)
// - 見方・泊まり方は、公式の案内へのリンク(出典)つき。宿の広告は PR と sponsored つき、協賛枠は承認された協賛だけ
// - 載せる開催が0件のときは、検索に載せない(noindex・サイトマップに入れない)
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as cheerio from "cheerio";
import { FEATURE_PATH, FEATURE_ID, FEATURE_SOURCES, featureEvents, overnightFeatureHtml } from "../scripts/lib/overnight-feature.mjs";
import { sponsorErrors, activeSponsors, sponsorSlot } from "../scripts/lib/sponsor-slots.mjs";

const read = (p) => readFileSync(p, "utf8");
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const shimo = (id, start, end) => ({ id, name: `遠山の霜月祭(${id})`, kagura: "遠山の霜月祭", prefecture: "長野県", city: "飯田市", venue: "正八幡宮", start, end, url: "https://shimotsukimatsuri.com/", description: "テスト用", lat: 35.33, lng: 137.92, status: "published", checked: "2026-10-05" });
const hana = (id, start, end) => ({ id, name: `花祭(${id})`, kagura: "花祭", prefecture: "愛知県", city: "北設楽郡東栄町", venue: "会所", start, end, url: "https://www.toeinavi.jp/spots/hanamatsuri/", description: "テスト用", lat: 35.07, lng: 137.69, status: "published", checked: "2026-10-06" });

export function featureTests({ ok, section, OUT, build }) {
  section("特集: 遠山の霜月祭と花祭(部品)");
  {
    const up = [hana("h-jan", "2027-01-02T10:00", "2027-01-03T17:00"), shimo("s-b", "2026-12-12T13:00", "2026-12-13T02:00"), shimo("s-a", "2026-12-05T11:00", "2026-12-06T06:30"), hana("h-dec", "2026-12-05T13:00", "2026-12-06T15:00"), { ...shimo("x", "2026-12-01T10:00"), kagura: "石見神楽" }];
    const list = featureEvents(up);
    ok(list.shimo.map((e) => e.id).join() === "s-a,s-b" && list.hana.map((e) => e.id).join() === "h-dec,h-jan", "2つの祭りの開催だけを、日付の順に選ぶ", JSON.stringify(list));
    const card = (e, h = "h3") => `<div class="card"><${h}><a href="/events/${e.id}.html">${esc(e.name)}</a></${h}></div>`;
    const html = overnightFeatureHtml({ esc, list, card, kaguraLink: (k) => `<a href="/kagura/${k}.html">${k}</a>`, stayHtml: (a) => `<p class="staylinks"><a class="stay-btn" href="https://example.com/${a.key}" rel="sponsored noopener">${a.area}の宿</a></p>`, prNote: '<span class="pr">PR</span>', sponsor: "" });
    const $ = cheerio.load(html);
    ok($("#f-shimotsuki").text().includes("2026年12月") && $("h3.feature-month").map((_, h) => $(h).text()).get().join() === "2026年12月,2027年1月", "霜月祭の見出しに年月、花祭は月ごとの見出し");
    ok($(".card a").map((_, a) => $(a).attr("href")).get().join() === "/events/s-a.html,/events/s-b.html,/events/h-dec.html,/events/h-jan.html", "日程のカードが開催のページにつながる");
    const ext = $("a[href^='http']").map((_, a) => $(a).attr("href")).get();
    ok(Object.values(FEATURE_SOURCES).every((s) => ext.includes(s.url)), "公式の案内(飯田市・霜月祭の公式サイト・遠山郷観光協会・東栄町)へのリンクを、出典として載せる");
    ok($(".feature-stay .stay-btn").length === 2 && $(".feature-stay .stay-btn").get().every((a) => /sponsored/.test($(a).attr("rel"))) && $(".feature-stay .pr").length === 1, "宿の広告は、地域ごと(遠山郷・奥三河)の枠に、PR の表示と sponsored つきで置く");
    ok($(".feature-stay").text().includes("遠山郷観光協会") && $(".feature-stay").text().includes("東栄町観光まちづくり協会"), "宿の枠に、地元の宿の一覧(公式)へのリンクも置く");
    ok(!/\d{1,2}:\d{2}/.test($.root().text()) && !/(旅館|ホテル|民宿)[^のを]/.test($.root().text()), "時刻と宿の名前は本文に書かない(日程は開催データ、宿は公式の一覧へ)");
    ok(!$(".sponsor-slot").length, "協賛がなければ、協賛枠は出さない(見本の枠を出さない)");
    const none = cheerio.load(overnightFeatureHtml({ esc, list: { shimo: [], hana: [] }, card, kaguraLink: (k) => k, stayHtml: () => "", prNote: "" }));
    ok(none(".empty").length === 2 && !none(".feature-stay").length && !none(".pr").length && !none("a[href='#feature-stay-h']").length, "開催も広告もないときは、空の案内だけを出し、宿の枠と PR を出さない");
  }

  section("特集: 協賛枠の置き場所(feature)");
  {
    const s = { id: "tohyama-2026-12", kind: "monthly", sponsor: "◯◯観光協会", title: "遠山郷の宿", text: "", url: "https://example.com/", start: "2026-12-01", end: "2026-12-31", approved: true, contractRef: "テスト", placements: [{ page: "feature", id: FEATURE_ID }] };
    ok(!sponsorErrors([s]).length, "placements の page に feature を使える", sponsorErrors([s]).join(" / "));
    ok(sponsorErrors([{ ...s, placements: [{ page: "feature" }] }]).some((x) => x.includes("条件")), "feature にも条件(id)が必要");
    const act = activeSponsors([s], "2026-12-10");
    ok(sponsorSlot(act, "feature", { id: FEATURE_ID }, { esc }).includes('data-sponsor="tohyama-2026-12"') && sponsorSlot(act, "feature", { id: "other" }, { esc }) === "" && sponsorSlot(act, "kagura", { id: FEATURE_ID }, { esc }) === "", "特集の ID が一致するときだけ、特集のページに出る");
  }

  section("特集: 載せる開催がないとき(テスト用データ)");
  {
    const f = join(OUT, FEATURE_PATH);
    const $ = cheerio.load(read(f));
    ok(/noindex/.test($('meta[name="robots"]').attr("content") ?? "") && !read(join(OUT, "sitemap.xml")).includes(FEATURE_PATH), "検索に載せない(noindex・サイトマップに入れない)");
    ok(!cheerio.load(read(join(OUT, "sponsor.html")))(`a[href='${FEATURE_PATH}']`).length, "協賛のご案内の「載る場所」にも出さない");
  }

  section("特集: 載せる開催があるとき");
  {
    const dir = mkdtempSync(join(tmpdir(), "feature-"));
    const out = "dist-test-feature";
    try {
      const base = JSON.parse(read("tests/fixtures/events.test.json").replace(/^﻿/, ""));
      const evFile = join(dir, "events.json"), spFile = join(dir, "sponsors.json");
      writeFileSync(evFile, JSON.stringify([...base, shimo("t-shimo", "2026-12-05T11:00", "2026-12-06T06:30"), hana("t-hana", "2026-12-13T08:00", "2026-12-13T23:00"), hana("t-hana-past", "2026-10-01T13:00", "2026-10-02T07:00")]));
      writeFileSync(spFile, JSON.stringify([{ id: "feature-test", kind: "monthly", sponsor: "テスト観光協会", title: "遠山郷で泊まる", text: "", url: "https://example.com/", start: "2026-10-01", end: "2026-12-31", approved: true, contractRef: "テスト", placements: [{ page: "feature", id: FEATURE_ID }] }]));
      const r = build(evFile, out, { SPONSORS_FILE: spFile, TEST_AFF_TRAVEL: "1" });
      ok(r.status === 0, "ビルドが通る", (r.stderr ?? "").slice(0, 300));
      const $ = cheerio.load(read(join(out, FEATURE_PATH)));
      ok($("h1").text() === "遠山の霜月祭と花祭" && !/noindex/.test($('meta[name="robots"]').attr("content") ?? "") && read(join(out, "sitemap.xml")).includes(`${FEATURE_PATH}</loc><lastmod>2026-11-11</lastmod>`), "見出し・検索に載せる(サイトマップの更新日は、文章の確認日と開催の確認日の新しいほう)");
      const lds = $('script[type="application/ld+json"]').map((_, s) => JSON.parse($(s).text())).get().flat();
      ok(lds.some((x) => x["@type"] === "BreadcrumbList") && lds.some((x) => x["@type"] === "Article"), "パンくずと記事の構造化データ");
      const evLinks = $(".card a[href^='/events/']").map((_, a) => $(a).attr("href")).get();
      ok(evLinks.join() === "/events/t-shimo.html,/events/t-hana.html" && evLinks.every((h) => existsSync(join(out, h))), "これからの開催だけを、開催のページへのリンクで並べる(終わった開催は載らない)", evLinks.join());
      const stay = $(".feature-stay");
      ok(stay.find('a.stay-btn[rel~="sponsored"]').length === 2 && stay.find("[data-vc-ad]").length === 2 && stay.find(".pr").length === 1, "宿の広告(楽天トラベル・じゃらん)を、遠山郷と奥三河の2か所に、PR の表示つきで置く");
      ok(stay.find('a.stay-btn').map((_, a) => decodeURIComponent($(a).attr("href"))).get().every((h) => /遠山郷|奥三河/.test(decodeURIComponent(h))), "宿の検索は、近くの宿が出る地名(遠山郷・奥三河)で行う");
      ok($(".sponsor-slot [data-sponsor='feature-test']").length === 1 && $(".sponsor-slot .pr").length === 1, "承認された協賛は、特集のページの協賛枠に出る");
      const kg = (k) => cheerio.load(read(join(out, "kagura", `${k}.html`)))(`a[href='${FEATURE_PATH}']`).length;
      ok(kg("遠山の霜月祭") === 1 && kg("花祭") === 1 && kg("高千穂神楽") === 0, "2つの祭りの種類のページから、特集へ案内する(ほかの種類からは案内しない)");
      ok(cheerio.load(read(join(out, "sponsor.html")))(`a[href='${FEATURE_PATH}']`).length === 1, "協賛のご案内の「載る場所」に、特集のページを例として載せる");
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  }
}
