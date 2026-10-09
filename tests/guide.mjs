// 「はじめての神楽ガイド」のテスト: 出典の明示・目次・内部リンク・検索向けの情報
import { readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { SOURCES, CHECKED } from "../scripts/lib/guide.mjs";

const read = (p) => readFileSync(p, "utf8");

export function guideTests({ ok, section, OUT, build }) {
  section("はじめての神楽ガイド");
  const D = "dist-test-guide";
  // 本番のデータで作る(定期公演・神楽の種類へのリンクが、実在するページにつながるか)
  const r = build("data/events.json", D, { REGULAR_FILE: "data/regular.json" });
  ok(r.status === 0, "本番のデータで、ビルドが通る", r.stderr);
  const $ = cheerio.load(read(join(D, "guide.html")));
  const desc = $('meta[name="description"]').attr("content") ?? "";
  ok($("title").text() === "はじめての神楽ガイド 見どころ・マナー・服装 | 神楽めぐり" && $("h1").text() === "はじめての神楽ガイド" && desc.length >= 70 && desc.length <= 120, "タイトル・見出し・説明文(70〜120字)", String(desc.length));
  const ld = $('script[type="application/ld+json"]').map((_, s) => JSON.parse($(s).text())).get().flat();
  const art = ld.find((x) => x["@type"] === "Article");
  ok(art?.dateModified === CHECKED && art.author?.name && art.publisher?.name && ld.some((x) => x["@type"] === "BreadcrumbList"), "構造化データ(記事・更新日・著者・パンくず)");
  const ext = $("main a[href^='http']").map((_, a) => $(a).attr("href")).get();
  ok(SOURCES.every((s) => ext.includes(s.url) && /^https:\/\//.test(s.url)), `出典(${SOURCES.length}件)が、すべてリンクで載っている`);
  ok($("main a[href^='http']").get().every((a) => $(a).attr("rel")?.includes("noopener") && $(a).attr("target") === "_blank"), "外部リンクは、新しいタブで開き、noopener が付く");
  const cites = $("main p.meta").filter((_, p) => $(p).text().startsWith("出典:")).length;
  ok(cites >= 10, "各節に、出典が示されている", String(cites));
  ok($("main").text().includes(`確認日: ${CHECKED.replace(/^(\d{4})-0?(\d+)-0?(\d+)$/, "$1年$2月$3日")}`) && $("main").text().includes("現地の案内を優先"), "確認日と、現地の案内を優先する旨");
  const toc = $(".toc a").map((_, a) => $(a).attr("href")).get();
  ok(toc.length === 5 && toc.every((h) => $(h).length === 1), "目次のリンクが、すべて本文の見出しに飛ぶ");
  const internal = $("main a[href^='/']").map((_, a) => $(a).attr("href").split("#")[0]).get();
  const fileOf = (h) => join(D, decodeURIComponent(h.endsWith("/") ? h + "index.html" : h));
  ok(internal.length > 0 && internal.every((h) => existsSync(fileOf(h))), "サイト内のリンクが、すべて実在するページにつながる", internal.filter((h) => !existsSync(fileOf(h))).join(", "));
  ok(internal.filter((h) => h.startsWith("/regular/")).length === 3 && internal.filter((h) => h.startsWith("/kagura/") && h !== "/kagura/").length >= 5, "定期公演(3件)と、神楽の種類(5件)のページへ、リンクしている");
  ok(/guide\.html<\/loc><lastmod>/.test(read(join(D, "sitemap.xml"))) && read(join(D, "sitemap.xml")).includes(`guide.html</loc><lastmod>${CHECKED}<`), "サイトマップに載り、lastmod は確認日");
  // 入口(トップ・フッター・各開催ページ)
  const home = cheerio.load(read(join(OUT, "index.html")));
  ok(home('.quick a[href="/guide.html"]').length === 1 && home('footer a[href="/guide.html"]').length === 1, "トップの入口と、フッターに、ガイドへのリンクがある");
  const ev = cheerio.load(read(join(OUT, "events/t-full.html"))), rg = cheerio.load(read(join(OUT, "regular/r-nightly.html")));
  ok(ev('main a[href="/guide.html"]').length === 1 && rg('main a[href="/guide.html"]').length === 1, "開催・定期公演のページから、ガイドへリンクしている");
  rmSync(D, { recursive: true, force: true });
}
