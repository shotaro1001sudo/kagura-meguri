// SEOテスト: 検索エンジンが「読める・たどれる・理解できる」条件を、機械的に検査する
//  - インデックスの指示(index / noindex)とサイトマップの整合
//  - タイトル・説明文・canonical・OGP・構造化データ
//  - 内部リンクの到達性(トップから、全ページに、たどり着けるか)
//  - 見出しの階層・パンくず・本文量
//  - フィード(Atom)・カレンダー購読(ICS)・共有画像
import { readFileSync, existsSync, readdirSync, statSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import * as cheerio from "cheerio";

const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const read = (p) => readFileSync(p, "utf8");

function checkSite({ ok, section, dir, label, base, strictText }) {
  section(`SEO: ${label}`);
  const htmls = walk(dir).filter((f) => f.endsWith(".html"));
  const rel = (f) => "/" + relative(dir, f).replace(/\\/g, "/");
  const toFile = (u) => { let p = decodeURIComponent(u.split("#")[0].split("?")[0]); if (p.endsWith("/")) p += "index.html"; return join(dir, p); };
  const pages = new Map(htmls.map((f) => [rel(f), cheerio.load(read(f))]));
  const isNoindex = ($) => /noindex/.test($('meta[name="robots"]').attr("content") ?? "");

  // --- サイトマップ ---
  const sm = cheerio.load(read(join(dir, "sitemap.xml")), { xmlMode: true });
  const entries = sm("url").map((_, e) => ({ loc: sm(e).find("loc").text(), lastmod: sm(e).find("lastmod").text() })).get();
  const smPaths = new Set();
  for (const { loc, lastmod } of entries) {
    const u = new URL(loc); smPaths.add(decodeURIComponent(u.pathname));
    ok(loc.startsWith(base), `サイトマップ: ${loc} が自サイトのURL`);
    ok(/^\d{4}-\d{2}-\d{2}$/.test(lastmod) && !Number.isNaN(Date.parse(lastmod)), `サイトマップ: ${u.pathname} の lastmod が日付`, lastmod);
    const f = toFile(u.pathname);
    ok(existsSync(f), `サイトマップ: ${u.pathname} に実体がある`);
    const $ = pages.get(rel(f.endsWith("index.html") ? f : f));
    if ($) {
      ok(!isNoindex($), `サイトマップ: ${u.pathname} は noindex ではない(載せるなら index)`);
      ok($('link[rel="canonical"]').attr("href") === loc && $('meta[property="og:url"]').attr("content") === loc, `${u.pathname}: canonical と og:url が、サイトマップのURLと一致`);
    }
  }
  ok(new Set(entries.map((e) => e.loc)).size === entries.length, "サイトマップ: URLが重複していない");
  for (const [p, $] of pages) if (!isNoindex($) && p !== "/404.html") ok(smPaths.has(p === "/index.html" ? "/" : p === "/kagura/index.html" ? "/kagura/" : p), `${p}: index されるページは、サイトマップに載っている`);

  // --- 各ページのメタ情報 ---
  const descs = new Map();
  for (const [p, $] of pages) {
    const idx = !isNoindex($);
    if (!idx) { ok(/noindex,follow/.test($('meta[name="robots"]').attr("content")), `${p}: noindex でもリンクはたどらせる(follow)`); continue; }
    ok(/index,follow/.test($('meta[name="robots"]').attr("content") ?? ""), `${p}: index,follow と明示`);
    const title = $("title").text(), desc = $('meta[name="description"]').attr("content") ?? "";
    const key = p.startsWith("/events/") || p.startsWith("/regular/") ? "detail" : /^\/(kagura|pref|month)\//.test(p) || ["/index.html", "/map.html", "/calendar.html"].includes(p) ? "list" : "static";
    if (key !== "static") {
      ok(desc.length >= 55 && desc.length <= 125, `${p}: 説明文が、検索結果で読みやすい長さ(55〜125字)`, `${desc.length}字`);
      ok(!descs.has(desc), `${p}: 説明文が他ページと重複しない`, desc);
      descs.set(desc, p);
    }
    ok(title.length <= (key === "detail" ? 75 : 55), `${p}: タイトルが長すぎない`, `${title.length}字: ${title}`);
    ok(title.endsWith(base.includes("example") ? "" : $('meta[property="og:site_name"]').attr("content")), `${p}: タイトルの末尾にサイト名`);
    if (/^\/pref\//.test(p)) ok(title.includes($("h1").text().replace("の神楽", "")), `${p}: タイトルに都道府県名`);
    if (/^\/kagura\/./.test(p) && p !== "/kagura/index.html") ok(title.includes($("h1").text()), `${p}: タイトルに神楽の種類名`);
    if (/^\/month\//.test(p)) ok(title.includes($("h1").text().replace("の神楽", "")), `${p}: タイトルに年月`);
    // OGP・共有
    ok(/^https:\/\/.+\/og\.png$/.test($('meta[property="og:image"]').attr("content") ?? "") && $('meta[name="twitter:card"]').attr("content") === "summary_large_image", `${p}: 共有画像(og:image / twitter:card)`);
    ok($('meta[property="og:title"]').attr("content") === title && $('meta[property="og:description"]').attr("content") === desc, `${p}: OGPのタイトル・説明が、ページと一致`);
    // 本文量
    const main = $("main").clone(); main.find("script,style").remove();
    const chars = main.text().replace(/\s+/g, "").length;
    if (strictText && key !== "static") ok(chars >= (key === "detail" ? 250 : 150), `${p}: 本文が薄すぎない`, `${chars}字`);
    // 見出しの階層(h1の次に h3 が来る、のような飛びがない)
    const hs = $("main h1,main h2,main h3,main h4").map((_, e) => +e.tagName[1]).get();
    let skip = false; for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i - 1] > 1) skip = true;
    ok(hs[0] === 1 && !skip, `${p}: 見出しの階層に飛びがない`, hs.join(""));
    // 構造化データ
    const lds = $('script[type="application/ld+json"]').map((_, e) => JSON.parse($(e).text())).get().flat();
    const types = lds.map((x) => x["@type"]);
    if (key === "detail" || /^\/(kagura|pref|month)\/./.test(p) || ["/kagura/index.html"].includes(p)) {
      ok(types.includes("BreadcrumbList"), `${p}: パンくずの構造化データ`);
      const bc = lds.find((x) => x["@type"] === "BreadcrumbList");
      const crumbItems = $("nav.crumbs li").map((_, e) => $(e).text().trim()).get();
      ok(crumbItems.length === bc.itemListElement.length && crumbItems.every((t, i) => t === bc.itemListElement[i].name), `${p}: 見えるパンくずと、構造化データのパンくずが一致`, crumbItems.join(">"));
      ok($("nav.crumbs li[aria-current=page]").length === 1, `${p}: 現在のページが aria-current`);
      for (const it of bc.itemListElement) if (it.item) ok(existsSync(toFile(new URL(it.item).pathname)), `${p}: パンくずのリンク先が存在する`, it.item);
    }
    if (p.startsWith("/events/")) {
      const ev = lds.find((x) => x["@type"] === "Event");
      ok(ev && ev.name && ev.startDate && ev.location?.name && ev.image?.length && ev.eventStatus, `${p}: Event に name / startDate / location / image / eventStatus`);
      ok(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}\+09:00)?$/.test(ev.startDate), `${p}: startDate の形式`, ev.startDate);
    }
    if (["/index.html", "/map.html"].includes(p) || /^\/(kagura|pref|month)\/./.test(p)) {
      const il = lds.find((x) => x["@type"] === "ItemList");
      if (il) for (const it of il.itemListElement) ok(existsSync(toFile(new URL(it.url).pathname)), `${p}: ItemList のリンク先が存在する`, it.url);
      ok(!il || il.itemListElement.every((x, i) => x.position === i + 1), `${p}: ItemList の順番`);
    }
  }
  // --- 内部リンクの到達性(トップから、何クリックで、全ページにたどり着けるか) ---
  const seen = new Map([["/index.html", 0]]); const queue = ["/index.html"];
  while (queue.length) {
    const cur = queue.shift(); const $ = pages.get(cur); if (!$) continue;
    $("a[href]").each((_, a) => {
      const h = $(a).attr("href"); if (!h.startsWith("/") || h.startsWith("//")) return;
      let t = decodeURIComponent(h.split("#")[0].split("?")[0]); if (t.endsWith("/")) t += "index.html"; if (!t.endsWith(".html")) return;
      if (!seen.has(t) && pages.has(t)) { seen.set(t, seen.get(cur) + 1); queue.push(t); }
    });
  }
  for (const [p, $] of pages) if (!isNoindex($)) ok(seen.has(p), `${p}: トップからリンクでたどり着ける(孤立していない)`);
  const deepest = Math.max(...[...seen.entries()].filter(([p]) => !isNoindex(pages.get(p))).map(([, d]) => d));
  ok(deepest <= 3, "どのページも、トップから3クリック以内", `最大 ${deepest} クリック`);

  // --- フィード・ICS・画像 ---
  const feed = cheerio.load(read(join(dir, "feed.xml")), { xmlMode: true });
  ok(feed("feed > title").length === 1 && feed("feed > updated").length === 1 && feed("entry").length >= 1 && feed("entry").length <= 30, "Atomフィードの形式(title / updated / entry)");
  feed("entry").each((_, e) => { const u = new URL(feed(e).find("link").attr("href")); ok(existsSync(toFile(u.pathname)) && /^\d{4}-\d{2}-\d{2}T/.test(feed(e).find("updated").text()), `フィード: ${u.pathname} が存在し、日付が正しい`); });
  ok(pages.get("/index.html")('link[rel="alternate"][type="application/atom+xml"]').attr("href") === "/feed.xml", "フィードを、各ページの <head> で知らせる");
  const ics = read(join(dir, "events.ics"));
  ok(ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.endsWith("END:VCALENDAR\r\n") && !/[^\r]\n/.test(ics), "events.ics の形式(CRLF)");
  const evCount = (ics.match(/BEGIN:VEVENT/g) ?? []).length; ok(evCount === (ics.match(/END:VEVENT/g) ?? []).length && (ics.match(/^UID:/gm) ?? []).length === evCount, `events.ics: VEVENT が対になり、UID がある(${evCount}件)`);
  const png = readFileSync(join(dir, "og.png"));
  ok(png.slice(0, 8).toString("hex") === "89504e470d0a1a0a" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630 && png.length < 100_000, "og.png: PNG・1200x630・100KB未満");
  ok(/^Sitemap: https:\/\/.+\/sitemap\.xml$/m.test(read(join(dir, "robots.txt"))) && !/Disallow: \/\s*$/m.test(read(join(dir, "robots.txt"))), "robots.txt: サイトマップを知らせ、全面禁止していない");
  return { pages, seen };
}

export function seoTests({ ok, section, OUT, build }) {
  checkSite({ ok, section, dir: OUT, label: "テスト用データのサイト", base: "https://", strictText: false });
  // 本番データ: テスト用の指定を外してビルドし、実際のサイトの状態を検査する
  const env = { ...process.env, OUT_DIR: "dist-test-seo", BUILD_NOW: "2026-10-09T12:00" }; delete env.EVENTS_FILE; delete env.REGULAR_FILE;
  const r = spawnSync("node", ["scripts/build.mjs"], { env, encoding: "utf8" });
  ok(r.status === 0, "SEO検査用に、本番データでビルドできる", r.stderr);
  const cfg = JSON.parse(read("config.json").replace(/^﻿/, ""));
  checkSite({ ok, section, dir: "dist-test-seo", label: "本番データのサイト", base: cfg.baseUrl, strictText: true });
  // 月別ページ: 本番データで、開催のある月だけが作られる
  section("SEO: 月別ページ・種類別の紹介文");
  const months = walk("dist-test-seo/month").map((f) => f.replace(/.*month[\\/]/, "").replace(".html", ""));
  ok(months.length >= 3 && months.every((m) => /^\d{4}-\d{2}$/.test(m)), "月別ページが作られる", months.join(","));
  for (const m of months) {
    const $ = cheerio.load(read(`dist-test-seo/month/${m}.html`));
    ok($("main .card").length >= 1 && $("main h1").text().includes(`${+m.slice(5)}月`), `月別ページ ${m}: 開催が1件以上あり、見出しに月がある`);
  }
  const info = JSON.parse(read("data/kagura-info.json").replace(/^﻿/, ""));
  for (const [k, v] of Object.entries(info)) {
    ok(v.intro.length >= 60 && !!v.source, `紹介文 ${k}: 60字以上で、出典がある`);
    const f = `dist-test-seo/kagura/${k}.html`;
    if (existsSync(f)) { const $ = cheerio.load(read(f)); ok($(".about p").first().text() === v.intro && $(".about h2").text() === `${k}とは`, `神楽ページ ${k}: 「とは」の紹介文が出る`); }
  }
  rmSync("dist-test-seo", { recursive: true, force: true });
}
