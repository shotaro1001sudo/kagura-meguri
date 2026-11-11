// 特集「夜通しの神楽の見方・泊まり方」のテスト(ADV-20261110-5)
// - 遠山の霜月祭と花祭は、別の祭りとして、祭りごとに別のページにする(ほかの祭りの日程・案内・宿を混ぜない)
// - 日程は開催データの「これからの開催」から並ぶ(終わった開催・ほかの種類は載らない)
// - 見方・泊まり方は、その祭りの公式の案内へのリンク(出典)つき。宿の広告は PR と sponsored つき、協賛枠は承認された協賛だけ
// - 載せる開催が0件のときは、検索に載せない(noindex・サイトマップに入れない)
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as cheerio from "cheerio";
import { FEATURES, featureEvents, overnightFeatureHtml } from "../scripts/lib/overnight-feature.mjs";
import { sponsorErrors, activeSponsors, sponsorSlot } from "../scripts/lib/sponsor-slots.mjs";

const read = (p) => readFileSync(p, "utf8");
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const shimo = (id, start, end) => ({ id, name: `遠山の霜月祭(${id})`, kagura: "遠山の霜月祭", prefecture: "長野県", city: "飯田市", venue: "正八幡宮", start, end, url: "https://shimotsukimatsuri.com/", description: "テスト用", lat: 35.33, lng: 137.92, status: "published", checked: "2026-10-05" });
const hana = (id, start, end) => ({ id, name: `花祭(${id})`, kagura: "花祭", prefecture: "愛知県", city: "北設楽郡東栄町", venue: "会所", start, end, url: "https://www.toeinavi.jp/spots/hanamatsuri/", description: "テスト用", lat: 35.07, lng: 137.69, status: "published", checked: "2026-10-06" });
const F = Object.fromEntries(FEATURES.map((f) => [f.kagura, f]));
const SHIMO = F["遠山の霜月祭"], HANA = F["花祭"];
const OTHER = { [SHIMO.kagura]: /花祭|東栄|奥三河|お見舞い|Aichi/, [HANA.kagura]: /霜月祭|遠山|飯田|お賽銭/ };

export function featureTests({ ok, section, OUT, build }) {
  section("特集: 祭りごとの見方・泊まり方(部品)");
  {
    ok(FEATURES.length === 2 && SHIMO && HANA && SHIMO.path !== HANA.path && SHIMO.id !== HANA.id, "遠山の霜月祭と花祭は、別々の特集(ページ・ID)にする");
    const up = [hana("h-jan", "2027-01-02T10:00", "2027-01-03T17:00"), shimo("s-b", "2026-12-12T13:00", "2026-12-13T02:00"), shimo("s-a", "2026-12-05T11:00", "2026-12-06T06:30"), hana("h-dec", "2026-12-05T13:00", "2026-12-06T15:00"), { ...shimo("x", "2026-12-01T10:00"), kagura: "石見神楽" }];
    ok(featureEvents(SHIMO, up).map((e) => e.id).join() === "s-a,s-b" && featureEvents(HANA, up).map((e) => e.id).join() === "h-dec,h-jan", "その祭りの開催だけを、日付の順に選ぶ");
    const card = (e, h = "h3") => `<div class="card"><${h}><a href="/events/${e.id}.html">${esc(e.name)}</a></${h}></div>`;
    for (const f of FEATURES) {
      const list = featureEvents(f, up);
      const html = overnightFeatureHtml(f, { esc, list, card, kaguraLink: (k) => `<a href="/kagura/${k}.html">${k}</a>`, stayHtml: `<p class="staylinks"><a class="stay-btn" href="https://example.com/${f.stay.key}" rel="sponsored noopener">${f.stay.area}の宿</a></p>`, prNote: '<span class="pr">PR</span>' });
      const $ = cheerio.load(html);
      ok($(".card a").map((_, a) => $(a).attr("href")).get().join() === list.map((e) => `/events/${e.id}.html`).join(), `${f.kagura}: 日程のカードは、その祭りの開催だけ`);
      ok(!OTHER[f.kagura].test($.root().text()), `${f.kagura}: ほかの祭りの名前・土地・案内を書かない`, ($.root().text().match(new RegExp(`.{0,15}(${OTHER[f.kagura].source}).{0,15}`)) ?? [""])[0]);
      const ext = $("a[href^='http']").map((_, a) => $(a).attr("href")).get();
      ok(Object.values(f.sources).every((s) => ext.includes(s.url)), `${f.kagura}: その祭りの公式の案内へのリンクを、出典として載せる`);
      ok($(".feature-stay .stay-btn[rel~='sponsored']").length === 1 && $(".feature-stay .pr").length === 1 && $(".feature-stay").text().includes(f.stay.list.name), `${f.kagura}: 宿の広告は PR の表示と sponsored つきで、地元の宿の一覧(公式)へのリンクも置く`);
      ok(!/\d{1,2}:\d{2}/.test($.root().text()) && !/(旅館|ホテル|民宿)/.test($.root().text()), `${f.kagura}: 時刻と宿の名前は本文に書かない(日程は開催データ、宿は公式の一覧へ)`);
      ok(!$(".sponsor-slot").length, `${f.kagura}: 協賛がなければ、協賛枠は出さない(見本の枠を出さない)`);
    }
    const $s = cheerio.load(overnightFeatureHtml(SHIMO, { esc, list: featureEvents(SHIMO, up), card, kaguraLink: (k) => k }));
    const $h = cheerio.load(overnightFeatureHtml(HANA, { esc, list: featureEvents(HANA, up), card, kaguraLink: (k) => k }));
    ok($s("#f-schedule").text().includes("2026年12月") && !$s("h3.feature-month").length && $h("h3.feature-month").map((_, h) => $h(h).text()).get().join() === "2026年12月,2027年1月", "1か月だけなら見出しに年月、月をまたぐときは月ごとの見出し");
    const none = cheerio.load(overnightFeatureHtml(HANA, { esc, list: [], card, kaguraLink: (k) => k }));
    ok(none(".empty").length === 1 && !none(".feature-stay").length && !none(".pr").length && !none("a[href='#feature-stay-h']").length, "開催も広告もないときは、空の案内だけを出し、宿の枠と PR を出さない");
  }

  section("特集: 協賛枠の置き場所(feature)");
  {
    const s = { id: "tohyama-2026-12", kind: "monthly", sponsor: "◯◯観光協会", title: "遠山郷の宿", text: "", url: "https://example.com/", start: "2026-12-01", end: "2026-12-31", approved: true, contractRef: "テスト", placements: [{ page: "feature", id: SHIMO.id }] };
    ok(!sponsorErrors([s]).length, "placements の page に feature を使える", sponsorErrors([s]).join(" / "));
    ok(sponsorErrors([{ ...s, placements: [{ page: "feature" }] }]).some((x) => x.includes("条件")), "feature にも条件(id)が必要");
    const act = activeSponsors([s], "2026-12-10");
    ok(sponsorSlot(act, "feature", { id: SHIMO.id }, { esc }).includes('data-sponsor="tohyama-2026-12"') && sponsorSlot(act, "feature", { id: HANA.id }, { esc }) === "" && sponsorSlot(act, "kagura", { id: SHIMO.id }, { esc }) === "", "特集の ID が一致するページにだけ出る(霜月祭の協賛は、花祭の特集に出ない)");
  }

  section("特集: 載せる開催がないとき(テスト用データ)");
  {
    const sm = read(join(OUT, "sitemap.xml")), sp = cheerio.load(read(join(OUT, "sponsor.html")));
    for (const f of FEATURES) {
      const $ = cheerio.load(read(join(OUT, f.path)));
      ok(/noindex/.test($('meta[name="robots"]').attr("content") ?? "") && !sm.includes(f.path) && !sp(`a[href='${f.path}']`).length, `${f.kagura}: 検索に載せない(noindex・サイトマップに入れない)、協賛のご案内にも出さない`);
    }
    ok(!existsSync(join(OUT, "feature", "shimotsuki-hanamatsuri.html")), "2つの祭りをまとめたページは作らない");
  }

  section("特集: 載せる開催があるとき");
  {
    const dir = mkdtempSync(join(tmpdir(), "feature-"));
    const out = "dist-test-feature";
    try {
      const base = JSON.parse(read("tests/fixtures/events.test.json").replace(/^﻿/, ""));
      const evFile = join(dir, "events.json"), spFile = join(dir, "sponsors.json");
      writeFileSync(evFile, JSON.stringify([...base, shimo("t-shimo", "2026-12-05T11:00", "2026-12-06T06:30"), hana("t-hana", "2026-12-13T08:00", "2026-12-13T23:00"), hana("t-hana-past", "2026-10-01T13:00", "2026-10-02T07:00")]));
      writeFileSync(spFile, JSON.stringify([{ id: "feature-test", kind: "monthly", sponsor: "テスト観光協会", title: "遠山郷で泊まる", text: "", url: "https://example.com/", start: "2026-10-01", end: "2026-12-31", approved: true, contractRef: "テスト", placements: [{ page: "feature", id: SHIMO.id }] }]));
      const r = build(evFile, out, { SPONSORS_FILE: spFile, TEST_AFF_TRAVEL: "1" });
      ok(r.status === 0, "ビルドが通る", (r.stderr ?? "").slice(0, 300));
      const sm = read(join(out, "sitemap.xml"));
      const page = (f) => cheerio.load(read(join(out, f.path)));
      for (const [f, ids, area] of [[SHIMO, ["t-shimo"], "遠山郷"], [HANA, ["t-hana"], "奥三河"]]) {
        const $ = page(f);
        ok($("h1").text() === f.h1 && $("title").text().startsWith(f.title) && !/noindex/.test($('meta[name="robots"]').attr("content") ?? "") && sm.includes(`${f.path}</loc><lastmod>2026-11-11</lastmod>`), `${f.kagura}: 見出し・タイトル・検索に載せる(サイトマップの更新日は、文章の確認日と開催の確認日の新しいほう)`);
        const lds = $('script[type="application/ld+json"]').map((_, s) => JSON.parse($(s).text())).get().flat();
        const crumb = lds.find((x) => x["@type"] === "BreadcrumbList");
        ok(crumb && crumb.itemListElement.some((i) => i.name === f.kagura) && lds.some((x) => x["@type"] === "Article" && x.headline === f.title), `${f.kagura}: パンくず(種類のページの下)と記事の構造化データ`);
        const evLinks = $(".card a[href^='/events/']").map((_, a) => $(a).attr("href")).get();
        ok(evLinks.join() === ids.map((id) => `/events/${id}.html`).join() && evLinks.every((h) => existsSync(join(out, h))), `${f.kagura}: その祭りのこれからの開催だけを並べる(ほかの祭り・終わった開催は載らない)`, evLinks.join());
        const stay = $(".feature-stay");
        ok(stay.find('a.stay-btn[rel~="sponsored"]').length === 1 && stay.find("[data-vc-ad]").length === 1 && stay.find(".pr").length === 1 && stay.find("a.stay-btn").get().every((a) => decodeURIComponent(decodeURIComponent($(a).attr("href"))).includes(area)), `${f.kagura}: 宿の広告(楽天トラベル・じゃらん)を PR つきで置き、近くの宿が出る地名(${area})で探す`);
        const kg = cheerio.load(read(join(out, "kagura", `${f.kagura}.html`)));
        ok(kg(`a[href='${f.path}']`).length === 1 && kg("a[href^='/feature/']").length === 1, `${f.kagura}: 種類のページから、その祭りの特集にだけ案内する`);
      }
      ok(page(SHIMO)(".sponsor-slot [data-sponsor='feature-test']").length === 1 && !page(HANA)(".sponsor-slot").length, "承認された協賛は、指定した特集のページにだけ出る");
      ok(!cheerio.load(read(join(out, "kagura", "高千穂神楽.html")))("a[href^='/feature/']").length, "ほかの種類のページからは、特集に案内しない");
      ok(cheerio.load(read(join(out, "sponsor.html")))("a[href^='/feature/']").length === 1, "協賛のご案内の「載る場所」に、特集のページを例として載せる");
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  }
}
