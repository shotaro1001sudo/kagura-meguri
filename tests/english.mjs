// 英語のページ(/en/)のテスト: 言語の指定・日本語ページとの相互の対応(hreflang)・リンク先・翻訳されたくない語の保護、
// 日程・定期公演・種類ごとのページの中身、訳のデータ(data/kagura-info-en.json・data/regular-en.json)の形と、古くなった訳の点検
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { KAGURA_EN, PREF_EN, enText } from "../scripts/lib/english.mjs";
import { englishHealth, basisOf, INFO_FIELDS, REGULAR_FIELDS, infoFresh, regularFresh } from "../scripts/lib/english-data.mjs";
import { reviewMetrics, decideActions } from "../scripts/lib/weekly-review.mjs";

const read = (p) => readFileSync(p, "utf8");
const readJson = (p) => JSON.parse(read(p).replace(/^﻿/, ""));
const toFile = (OUT, path) => { const p = decodeURIComponent(path.split("#")[0]); return join(OUT, p.endsWith("/") ? p + "index.html" : p); };
const CJK = /[぀-ヿ㐀-鿿！-｠]/;

export function englishTests({ ok, section, OUT }) {
  section("英語のページ(/en/)");
  const load = (path) => cheerio.load(read(toFile(OUT, path)));
  const base = "https://kagurameguri.jp";
  const alt = ($) => Object.fromEntries($('link[rel="alternate"][hreflang]').get().map((l) => [$(l).attr("hreflang"), $(l).attr("href")]));
  const styleFiles = existsSync(join(OUT, "en/kagura")) ? readdirSync(join(OUT, "en/kagura")).filter((f) => f.endsWith(".html") && !readFileSync(join(OUT, "en/kagura", f), "utf8").includes('http-equiv="refresh"')).map((f) => `/en/kagura/${f}`) : []; // やめた種類の、案内だけのページは除く
  ok(styleFiles.length > 0, "種類ごとの英語のページがある", `${styleFiles.length}件`);
  // 日本語のページと対になる英語のページ(種類ごとのページは、そのページの hreflang の日本語版と対にする)
  const PAIRS = [["/en/", "/"], ["/en/guide.html", "/guide.html"], ["/en/kagura.html", "/kagura/"], ["/en/history.html", "/history/"], ["/en/calendar.html", "/calendar.html"],
    ...styleFiles.map((p) => [p, (alt(load(p)).ja ?? "").replace(base, "")])];
  ok(PAIRS.every(([en]) => existsSync(toFile(OUT, en))) && existsSync(toFile(OUT, "/en/regular-shows.html")), "英語のページ: トップ・ガイド・神楽の種類・歴史・日程・定期公演");
  for (const [en, jp] of PAIRS) {
    const E = load(en);
    ok(!!jp && existsSync(toFile(OUT, jp)), `${en}: 対になる日本語のページがある`, jp);
    if (!jp || !existsSync(toFile(OUT, jp))) continue;
    const J = load(jp);
    const ea = alt(E), ja = alt(J);
    ok(E("html").attr("lang") === "en" && J("html").attr("lang") === "ja", `${en}: 英語ページは lang=en、対応する日本語ページは lang=ja`);
    ok(ea.en === base + en && ea.ja === base + jp && ea["x-default"] === base + en, `${en}: hreflang(en・ja・x-default)が、日本語ページと対応している`, JSON.stringify(ea));
    ok(ja.en === base + en && ja.ja === base + jp && ja["x-default"] === base + en, `${jp}: 日本語ページからも、英語ページへ hreflang が張られている(相互)`, JSON.stringify(ja));
    ok(E('link[rel="canonical"]').attr("href") === base + en && E('meta[property="og:locale"]').attr("content") === "en_US", `${en}: 正規URLと og:locale(en_US)`);
    ok(/^[\x20-\x7E]+$/.test(E("title").text()) && E("h1").length === 1 && /^[\x20-\x7E]+$/.test(E("h1").text()), `${en}: タイトルと見出しは、英語(ASCII)`);
    const jaNav = E("header nav a").filter((_, a) => E(a).text().trim() === "日本語");
    ok(jaNav.length === 1 && jaNav.attr("href") === jp, `${en}: メニューの「日本語」は、そのページの日本語版へ`, jaNav.attr("href"));
  }
  // すべての英語ページ(定期公演のページも)
  const allEn = [...PAIRS.map(([en]) => en), "/en/regular-shows.html"];
  for (const en of allEn) {
    const E = load(en);
    ok(E("main a").get().every((a) => { const h = E(a).attr("href"); if (!h || /^(https?:|#|mailto:)/.test(h)) return true; return existsSync(toFile(OUT, h)); }), `${en}: ページ内のリンク先が、すべて実在する`);
    ok(E("main a[href^='#']").get().every((a) => E(`[id="${E(a).attr("href").slice(1)}"]`).length === 1), `${en}: ページ内の移動先(#…)が、すべてある`);
    const main = E("main").clone(); main.find("[lang=ja]").remove(); main.find("script,style").remove();
    const left = main.text().match(new RegExp(`.{0,10}${CJK.source}+.{0,10}`, "g")) ?? [];
    ok(left.length === 0, `${en}: 本文の日本語は、すべて lang=ja の中(読み上げ・自動翻訳で崩れない)`, left.slice(0, 3).join(" / "));
    ok(!/\[\[|\]\]/.test(E("main").text()), `${en}: 訳の印 [[…]] が、そのまま出ていない`);
  }
  const home = load("/index.html");
  ok(home('footer a[href="/en/"][hreflang="en"]').length === 1, "日本語ページのフッターから、英語版へ行ける");
  const idx = load("/en/");
  const rows = idx("table").first().find("tbody tr");
  ok(rows.length >= 3 && rows.get().every((r) => idx(r).find("a[lang='ja'][translate='no'][hreflang='ja']").length === 1), "英語トップの開催の表: 日本語のイベント名は、lang=ja・translate=no で、翻訳で崩さず、日本語ページへつなぐ", `${rows.length}件`);
  ok(rows.get().every((r) => /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/.test(idx(r).find("th").text().trim())) && rows.get().every((r) => Object.values(PREF_EN).some((p) => idx(r).find("td").last().text().startsWith(p))), "開催の表: 日付は英語の書式、場所は英語の都道府県名から始まる");
  ok(idx('main a[href="/en/calendar.html"]').length > 0 && idx('main a[href="/en/regular-shows.html"]').length > 0, "英語トップから、英語の日程と定期公演へ行ける");
  ok(idx('td[data-k="Where"]').length > 0 && idx('td[data-k="Where"]').toArray().every((td) => /^[A-Za-z -]+$/.test(idx(td).text())), "英語トップの一覧の Where は県名の英語だけ(日本語の市町村名を混ぜない)");
  const where = idx("h2").filter((_, h) => idx(h).text() === "Where to see kagura").nextUntil("h2").text();
  ok(where.length > 0 && !/(Iwami|Takachiho|Bitchu|Hiroshima|Hanamatsuri|Ontake|Korakuen|Kiyokawa|Shimane|Okayama|Oita|Aichi|Miyazaki)/.test(where), "英語トップの「Where to see kagura」は、特定の神楽・会場を挙げない");

  // 種類の一覧: 紹介カードを載せず、日本語の「種類で探す」に載る全種類を、同じ順番・同じ扱い(名前・一言・県・リンク)で並べる(特定の神楽を取り上げない)
  const kag = load("/en/kagura.html");
  const jaIdx = load("/kagura/");
  const jaKinds = jaIdx("main .card h3 a").map((_, a) => decodeURIComponent(jaIdx(a).attr("href"))).get();
  const rowsK = kag("table.styles tbody tr");
  const enKinds = rowsK.map((_, r) => decodeURIComponent(kag(r).find("a[hreflang='ja']").attr("href"))).get();
  ok(kag("section.gcard").length === 0 && rowsK.length > 0 && JSON.stringify(enKinds) === JSON.stringify(jaKinds), "神楽の種類のページ: 紹介カードなしで、日本語の「種類で探す」と同じ順番に、すべての種類を並べる", `${rowsK.length}件`);
  ok(rowsK.get().every((r) => kag(r).find("th").text().trim().length > 0 && kag(r).find("a[hreflang='ja']").length === 1), "神楽の種類のページ: 各行に、名前と日本語ページへのリンクがある");
  const kindsWithPage = rowsK.get().filter((r) => kag(r).find("th a[href^='/en/kagura/']").length === 1);
  ok(kindsWithPage.length === styleFiles.length && styleFiles.every((p) => kag(`table.styles th a[href="${p}"]`).length === 1), "神楽の種類のページ: 種類ごとの英語ページへ、すべてリンクする(孤立したページがない)", `${kindsWithPage.length}/${styleFiles.length}`);
  ok(kindsWithPage.every((r) => kag(r).find("td").first().text().trim().length > 0), "神楽の種類のページ: 英語ページのある種類は、どれも同じく一言の紹介を添える");

  // 日程: これからの開催を月ごとに。明日以降に始まる開催は、すべて載る
  const cal = load("/en/calendar.html");
  const calRows = cal("table.en-cal tbody tr");
  const calIds = calRows.map((_, r) => cal(r).find("a[hreflang='ja'][lang='ja']").attr("href")).get();
  const today = (cal("main p.meta").text().match(/Updated: (\d{4}-\d{2}-\d{2})/) ?? [])[1];
  const evs = readJson(join(OUT, "events.json"));
  const later = evs.filter((e) => today && e.start.slice(0, 10) > today).map((e) => `/events/${e.id}.html`);
  ok(!!today && calRows.length > 0 && later.every((h) => calIds.includes(h)) && new Set(calIds).size === calIds.length, "英語の日程: 明日以降に始まる開催が、すべて1回ずつ載る", `${calRows.length}件 / 明日以降 ${later.length}件`);
  ok(calRows.get().every((r) => /^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}( - [A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2})?$/.test(cal(r).find("th").text().trim())), "英語の日程: 日付は「Sat, Dec 5」の書式(複数日は範囲)");
  ok(calRows.get().every((r) => /^(\d{2}:\d{2}(-\d{2}:\d{2})?|From \d{2}:\d{2}|TBA|See details)$/.test(cal(r).find("td").eq(0).text().trim())), "英語の日程: 時刻は「19:00」「19:00-21:00」「From 19:00」、分からなければ TBA");
  ok(calRows.get().every((r) => /^[A-Za-z]*$/.test(cal(r).find("td").last().text().trim())), "英語の日程: 場所は英語の県名だけ");
  const monthIds = cal("main h2[id^='m-']").map((_, h) => cal(h).attr("id")).get();
  ok(monthIds.length > 0 && JSON.stringify(monthIds) === JSON.stringify([...monthIds].sort()), "英語の日程: 月の見出しは古い順", monthIds.join(","));

  // 定期公演: 続いている定期公演ごとに1つの欄。訳が今の日本語と合っていなければ、料金などの古い訳は出さない
  const reg = load("/en/regular-shows.html");
  const regs = readJson(join(OUT, "regular.json"));
  ok(regs.length > 0 && regs.every((r) => reg(`section.en-show[id="${r.id}"]`).length === 1) && reg("section.en-show").length === regs.length, "定期公演の英語ページ: 続いている定期公演ごとに1つの欄", `${reg("section.en-show").length}/${regs.length}`);
  ok(reg("section.en-show").get().every((s) => reg(s).find("th").filter((_, th) => reg(th).text() === "Next show").length === 1 && reg(s).find(`a[href^="/regular/"][hreflang="ja"]`).length === 1), "定期公演の英語ページ: どの欄にも、次の公演日と日本語ページへのリンク");
  ok(reg("section.en-show").get().every((s) => (reg(s).find("th").filter((_, th) => reg(th).text() === "Admission").length === 1) === reg(s).text().includes("Japanese name:")), "定期公演の英語ページ: 料金は、訳がある欄にだけ出す(訳がなければ日本語ページへ)");

  // 種類ごとのページ
  for (const p of styleFiles) {
    const $ = load(p);
    const crumbs = $("nav.crumbs li").map((_, li) => $(li).text().trim()).get();
    ok(crumbs.length === 3 && crumbs[1] === "Kagura styles" && crumbs[2] === $("h1").text(), `${p}: パンくず Home > Kagura styles > 名前`, crumbs.join(">"));
    ok($("main h2#dates").length === 1 && $("main h2#sources").length === 1 && $("main ul.sources li").length > 0, `${p}: 日程と出典の欄がある`);
    ok($("main .en-jump a").length > 1 && $("main .en-jump a").get().every((a) => $(`main h2[id="${$(a).attr("href").slice(1)}"]`).length === 1), `${p}: ページ内の目次が、各欄の見出しへつながる`);
    ok($("table.en-cal tbody tr").get().every((r) => $(r).find("a[href^='/events/'][lang='ja'][hreflang='ja']").length === 1), `${p}: 開催の名前は日本語のまま、日本語の開催ページへ`);
    const jp = (alt($).ja ?? "").replace(base, "");
    ok(jp && load(jp)(`.en-link a[href="${p}"][hreflang="en"]`).length === 1, `${p}: 日本語の種類のページから、英語ページへの案内がある`);
  }

  // 出典の番号(トップ・ガイド・種類の一覧・歴史)
  for (const p of ["/en/guide.html", "/en/kagura.html", "/en/history.html", "/en/"]) {
    const $ = load(p);
    ok($("sup.cite a").get().every((a) => $($(a).attr("href")).is("ol.sources > li")), `${p}: 出典の番号が、すべて出典の一覧につながる`);
  }
  // 公正さのため、ガイドと歴史では、個別の神楽を取り上げない(歴史の、出雲流の典型の佐太神社を除く)
  for (const f of ["/en/guide.html", "/en/history.html"]) {
    const $ = load(f); $("ol.sources").remove();
    const named = $("main .prose").text().match(/.{0,12}(Iwami|Takachiho|Bitchu|Tohyama|Hanamatsuri|Hiroshima|Tosa|Ontake|Shonai|Shiromi|Daikagura|Horowasan|Kasuga).{0,12}/g) ?? [];
    ok(named.length === 0, `${f}: 本文で、個別の神楽を取り上げない`, named.join(" / "));
  }

  section("英語ページの訳のデータ");
  const info = readJson("data/kagura-info.json"), infoEn = readJson("data/kagura-info-en.json");
  const regular = readJson("data/regular.json"), regularEn = readJson("data/regular-en.json");
  const ascii = (v) => !/[^\x20-\x7e]/.test(JSON.stringify(v).replace(/\[\[[^\]]+\]\]/g, ""));
  ok(new Set(KAGURA_EN.map((k) => k.slug)).size === KAGURA_EN.length && KAGURA_EN.every((k) => /^[a-z0-9-]+$/.test(k.slug) && /^[\x20-\x7e]+$/.test(k.name)), "種類の英語名と URL の名前(slug)は、重ならず、英数字だけ");
  for (const [k, v] of Object.entries(infoEn)) {
    ok(KAGURA_EN.some((x) => x.key === k) && !!info[k], `訳 ${k}: 英語名があり、日本語の解説がある種類`);
    ok(["area", "tagline", "intro", "checked", "basis"].every((f) => typeof v[f] === "string" && v[f]) && /^\d{4}-\d{2}-\d{2}$/.test(v.checked), `訳 ${k}: 地域・一言・概要・確認日・指紋がある`);
    ok(ascii(v) && !/\[\[/.test(v.area + v.tagline), `訳 ${k}: 英語(ASCII)だけ。日本語は、読みを確かめられない固有名の [[…]] の中だけ(地域・一言には使わない)`);
    ok((JSON.stringify(v).match(/\[\[[^\]]+\]\]/g) ?? []).every((x) => CJK.test(x)), `訳 ${k}: [[…]] の中は日本語の表記`);
    ok((v.programs ?? []).every((p) => p.name && p.text), `訳 ${k}: 演目には名前と説明`);
  }
  for (const [id, v] of Object.entries(regularEn)) {
    ok(regular.some((r) => r.id === id), `定期公演の訳 ${id}: 日本語の定期公演がある`);
    ok(["name", "venue", "place", "schedule", "fee", "description", "checked", "basis"].every((f) => typeof v[f] === "string" && v[f]) && ascii({ ...v, halls: Object.values(v.halls ?? {}) }), `定期公演の訳 ${id}: 名前・会場・場所・日時・料金・説明があり、英語(ASCII)だけ`);
  }
  ok(enText("a [[西林国橋]] b <x>", (s) => s.replace(/</g, "&lt;")) === 'a <span lang="ja" translate="no">西林国橋</span> b &lt;x>', "訳の [[日本語]] は、lang=ja の表記として見せる");

  // 古くなった訳の点検(週次の振り返り)。日本語の本文が変わったら、指紋が合わなくなる
  const jaA = { intro: "概要", features: ["特徴"] }, jaR = { id: "r1", kagura: "A", name: "公演", fee: "1,000円", status: "published" };
  const enA = { basis: basisOf(jaA, INFO_FIELDS) }, enR = { basis: basisOf(jaR, REGULAR_FIELDS) };
  ok(infoFresh(jaA, enA) && !infoFresh({ ...jaA, intro: "書き換えた概要" }, enA) && regularFresh(jaR, enR) && !regularFresh({ ...jaR, fee: "1,200円" }, enR), "訳の指紋: 日本語の本文・料金が変われば、古い訳と分かる");
  const h = englishHealth({
    info: { A: { ...jaA, intro: "書き換えた概要" }, B: { intro: "新しい解説" }, C: { intro: "掲載のない種類" } }, infoEn: { A: enA }, kinds: ["A", "B"],
    regular: [{ ...jaR, fee: "1,200円" }, { id: "r2", kagura: "B", status: "published" }, { id: "r3", kagura: "B", status: "published", until: "2026-01-01" }], regularEn: { r1: enR }, todayJst: "2026-11-24",
  });
  ok(h.stale.join() === "A" && h.missing.join() === "B" && h.regularStale.join() === "r1" && h.regularMissing.join() === "r2", "訳の点検: 書き換わった種類・訳のない種類・料金の変わった定期公演・訳のない定期公演を挙げる(掲載のない種類・終わった定期公演は除く)", JSON.stringify(h));
  const keys = (english) => decideActions(reviewMetrics({ todayJst: "2026-11-24", english }), null).map((a) => a.key);
  ok(keys(h).includes("en-translation") && keys(h).includes("en-regular") && !keys({ missing: [], stale: [], regularMissing: [], regularStale: [] }).some((k) => k.startsWith("en-")), "週次の振り返り: 訳が追いついていないときだけ、Claude の「やること」に英訳の見直しを出す");
}
