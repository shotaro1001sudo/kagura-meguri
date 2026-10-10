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
  // 出典: 本文には小さな番号だけを付け、最後の一覧にまとめる
  ok($("main p.meta").filter((_, p) => $(p).text().startsWith("出典:")).length === 0, "本文の途中に「出典:」の行を置かない(最後にまとめる)");
  const refs = $("sup.cite a").map((_, a) => ({ href: $(a).attr("href"), text: $(a).text() })).get();
  const items = $("ol.sources > li").map((_, li) => ({ id: $(li).attr("id"), back: $(li).find("a.back").attr("href"), url: $(li).find("a").first().attr("href") })).get();
  ok(refs.length >= 30 && refs.every((r) => $(r.href).is("ol.sources > li") && r.text === `[${r.href.replace("#src-", "")}]`), "本文の番号が、すべて出典の一覧の該当行に飛ぶ", `${refs.length}件`);
  ok(items.length === SOURCES.length && items.every((it, i) => it.id === `src-${i + 1}` && $(it.back).is("sup.cite a")), "出典の一覧は番号順で、各行から本文へ戻れる");
  const firstSeen = [...new Set(refs.map((r) => r.href))];
  ok(firstSeen.every((h, i) => h === `#src-${i + 1}`), "番号は、本文に初めて出てくる順");
  ok($("main").text().includes(`確認日: ${CHECKED.replace(/^(\d{4})-0?(\d+)-0?(\d+)$/, "$1年$2月$3日")}`) && $("main").text().includes("現地の案内を優先"), "確認日と、現地の案内を優先する旨");
  const toc = $(".toc a").map((_, a) => $(a).attr("href")).get();
  ok(toc.length === 6 && toc.every((h) => $(h).is("h2.gsec")) && $("h2.gsec .no").map((_, n) => $(n).text()).get().join() === "01,02,03,04,05,06", "目次の6章が、番号つきの章の見出しに飛ぶ");
  // 項目ごとのまとまり: 章の中は、見出しつきのカード
  ok($(".gcard").length >= 20 && $(".gcard").get().every((c) => $(c).children("h3").length === 1), "項目は、見出しつきのカードにまとまっている", String($(".gcard").length));
  const local = $("#highlights").nextUntil("h2").find(".gcard h3").map((_, h) => $(h).text()).get().join(" ");
  ok(["石見神楽", "広島神楽", "備中神楽", "高千穂神楽", "御嶽神楽"].every((k) => local.includes(k)), "各地の見どころ: 石見・広島・備中・高千穂・御嶽", local);
  const cmp = $("table.cmp thead th").map((_, th) => $(th).text()).get();
  ok(cmp.join() === ",神楽,能,歌舞伎" && $("table.cmp tbody tr").length >= 3, "能・歌舞伎との比較表がある");
  ok($("table.cmp tbody td").get().every((td, i) => $(td).attr("data-k") === ["神楽", "能", "歌舞伎"][i % 3]), "比較表の各欄に列名がある(スマホで縦に積んだときに表示する)");
  ok(!$("main").text().includes("定期公演"), "定期公演には触れない(ガイドは、観方の読み物)");
  const internal = $("main a[href^='/']").map((_, a) => $(a).attr("href").split("#")[0]).get();
  const fileOf = (h) => join(D, decodeURIComponent(h.endsWith("/") ? h + "index.html" : h));
  ok(internal.length > 0 && internal.every((h) => existsSync(fileOf(h))), "サイト内のリンクが、すべて実在するページにつながる", internal.filter((h) => !existsSync(fileOf(h))).join(", "));
  ok(internal.filter((h) => h.startsWith("/regular/")).length === 0 && internal.filter((h) => h.startsWith("/kagura/") && h !== "/kagura/").length >= 5, "神楽の種類(5件)のページへリンクし、定期公演のページへはリンクしない");
  ok(/guide\.html<\/loc><lastmod>/.test(read(join(D, "sitemap.xml"))) && read(join(D, "sitemap.xml")).includes(`guide.html</loc><lastmod>${CHECKED}<`), "サイトマップに載り、lastmod は確認日");
  // 入口(トップ・フッター・各開催ページ)
  const home = cheerio.load(read(join(OUT, "index.html")));
  ok(home('.quick a[href="/guide.html"]').length === 1 && home('footer a[href="/guide.html"]').length === 1, "トップの入口と、フッターに、ガイドへのリンクがある");
  const ev = cheerio.load(read(join(OUT, "events/t-full.html"))), rg = cheerio.load(read(join(OUT, "regular/r-nightly.html")));
  ok(ev('main a[href="/guide.html"]').length === 1 && rg('main a[href="/guide.html"]').length === 1, "開催・定期公演のページから、ガイドへリンクしている");
  rmSync(D, { recursive: true, force: true });
}
