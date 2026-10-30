// 「神楽の歴史」(/history/)のテスト: 出典の番号が一覧につながる・年表のリンク先が実在する・横スクロールの年表が操作できる
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { SOURCES, ERAS, TIMELINE, CHECKED } from "../scripts/lib/history.mjs";

const read = (p) => readFileSync(p, "utf8");

export function historyTests({ ok, section, OUT }) {
  section("神楽の歴史");
  const files = ["history/index.html", ...ERAS.map((e) => `history/${e.slug}.html`)];
  ok(files.every((f) => existsSync(join(OUT, f))), `総論と${ERAS.length}つの時代のページが、すべてある`);
  const pages = Object.fromEntries(files.map((f) => [f, cheerio.load(read(join(OUT, f)))]));

  const idx = pages["history/index.html"];
  const headline = "神楽の歴史・起源とは？神話から現代までを年表で解説";
  const title = `${headline} | 神楽めぐり`;
  const description = idx('meta[name="description"]').attr("content");
  ok(idx("title").length === 1 && idx("title").text() === title &&
    ['meta[property="og:title"]', 'meta[name="twitter:title"]'].every((selector) => idx(selector).length === 1 && idx(selector).attr("content") === title), "歴史総論: title・OG・Twitterの題名が一意で一致する");
  ok(['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]'].every((selector) => idx(selector).length === 1 && idx(selector).attr("content") === description) && description.includes("起源や年代の諸説"), "歴史総論: 説明文が重複せず共有メタと一致し、諸説を明示する");
  const indexLd = idx('script[type="application/ld+json"]').map((_, s) => JSON.parse(idx(s).text())).get().flat();
  ok(indexLd.find((x) => x["@type"] === "Article")?.headline === headline, "歴史総論: Article headlineとページ題名が一致する");
  ok(idx('link[rel="canonical"]').length === 1 && idx('link[rel="canonical"]').attr("href") === "https://kagurameguri.jp/history/" && /(?:^|,)\s*index(?:,|$)/.test(idx('meta[name="robots"]').attr("content") ?? ""), "歴史総論: 正規URLが一意でインデックス対象を維持する");
  ok(new Set(files.map((f) => pages[f]("title").text())).size === files.length && new Set(files.map((f) => pages[f]('meta[name="description"]').attr("content"))).size === files.length, "歴史: 総論と各時代で題名・説明文が重複しない");
  const tl = idx(".tl");
  ok(tl.length === 1 && tl.attr("tabindex") === "0" && tl.attr("role") === "region" && !!tl.attr("aria-label") && idx(".tl-item").length === TIMELINE.length, "年表は、キーボードでも横にスクロールでき、名前(aria-label)があり、全件が載る", `${idx(".tl-item").length}件`);
  ok(/overflow-x:auto/.test(read("scripts/style.css")) && /scroll-snap-type:x/.test(read("scripts/style.css")), "年表は、横にスクロールし、止まる位置がそろう(CSS)");
  const links = idx(".tl-item a").map((_, a) => idx(a).attr("href")).get();
  ok(links.every((h) => { const [path, id] = h.split("#"); const f = path.replace(/^\//, ""); return existsSync(join(OUT, f)) && cheerio.load(read(join(OUT, f)))(`#${id}`).length === 1; }), "年表の「くわしく」は、実在するページの、実在する見出しにつながる");
  const years = idx(".tl-year").map((_, e) => idx(e).text()).get();
  ok(years.length === TIMELINE.length && years[0] === "神話" && years.at(-1) === "2025年", "年表は、神話の時代から、現代の順に並ぶ", years.join(","));

  for (const f of files) {
    const $ = pages[f];
    const path = "/" + f.replace(/index\.html$/, "");
    ok($('link[rel="canonical"]').attr("href") === `https://kagurameguri.jp${path}` && $("h1").length === 1 && ($('meta[name="description"]').attr("content") ?? "").length >= 70, `${f}: 正規URL・h1が1つ・説明文が70字以上`);
    const ld = $('script[type="application/ld+json"]').map((_, s) => JSON.parse($(s).text())).get().flat();
    const art = ld.find((x) => x["@type"] === "Article");
    ok(art?.dateModified === CHECKED && art.author?.name && ld.some((x) => x["@type"] === "BreadcrumbList"), `${f}: 構造化データ(記事・更新日・著者・パンくず)`);
    const refs = $("sup.cite a").map((_, a) => ({ href: $(a).attr("href"), text: $(a).text() })).get();
    const items = $("ol.sources > li").map((_, li) => ({ id: $(li).attr("id"), back: $(li).find("a.back").attr("href"), url: $(li).find("a").first().attr("href") })).get();
    ok(refs.length >= 5 && refs.every((r) => $(r.href).is("ol.sources > li") && r.text === `[${r.href.replace("#src-", "")}]`), `${f}: 本文の出典の番号が、すべて一覧の該当行に飛ぶ`, `${refs.length}件`);
    ok(items.every((it, i) => it.id === `src-${i + 1}` && $(it.back).is("sup.cite a") && SOURCES.some((s) => s.url === it.url)), `${f}: 出典の一覧は番号順で、各行から本文へ戻れ、出典の登録にある`);
    const firstSeen = [...new Set(refs.map((r) => r.href))];
    ok(firstSeen.every((h, i) => h === `#src-${i + 1}`), `${f}: 出典の番号は、本文に初めて出てくる順`);
    ok($("main a[href^='http']").get().every((a) => $(a).attr("rel")?.includes("noopener") && $(a).attr("target") === "_blank"), `${f}: 外部リンクは、新しいタブで開き、noopener が付く`);
  }
  ok(SOURCES.every((s) => /^https:\/\//.test(s.url)) && new Set(SOURCES.map((s) => s.id)).size === SOURCES.length, "出典のURLは https で、IDが重ならない");
  const text = (f) => pages[f]("main").text();
  ok(/1002年/.test(text("history/kodai.html")) && /1608年/.test(text("history/kinsei.html")) && /2025年/.test(text("history/kindai.html")), "主な年代(1002年・1608年・2025年)が、それぞれの時代のページにある");
  // 前後のページへの案内が、順番どおり
  const order = ["kodai", "chusei", "kinsei", "kindai"];
  ok(order.every((s, i) => { const $ = pages[`history/${s}.html`]; return (i === 0 || $(".hnav .prev").attr("href") === `/history/${order[i - 1]}.html`) && (i === order.length - 1 ? $(".hnav .next").attr("href") === "/history/" : $(".hnav .next").attr("href") === `/history/${order[i + 1]}.html`); }), "時代のページに、前後(古代→中世→近世→近代)への案内がある");
  ok(cheerio.load(read(join(OUT, "index.html")))('footer a[href="/history/"]').length === 1, "フッターから、神楽の歴史へ行ける");

  section("図と表(ガイド・歴史)");
  const guide = cheerio.load(read(join(OUT, "guide.html")));
  const all = [["guide.html", guide], ...files.map((f) => [f, pages[f]])];
  ok(all.every(([, $]) => $("svg title").length === 0 && $("svg.dg").get().every((v) => !!$(v).attr("aria-label") && $(v).attr("role") === "img" && !!$(v).attr("viewBox"))), "絵(SVG)は、代替の説明(aria-label)と viewBox があり、<title> でページの題と取り違えない");
  ok(all.every(([, $]) => $("figure.fig").get().every((f) => $(f).find("figcaption").text().trim().length >= 20)), "図には、文章の説明(figcaption)が付く");
  ok(all.every(([, $]) => $("ol.flow").get().every((o) => !!$(o).attr("aria-label") && $(o).find("li").length >= 3)) && all.every(([, $]) => $(".tblwrap").get().every((w) => $(w).attr("tabindex") === "0" && $(w).attr("role") === "region" && !!$(w).attr("aria-label"))), "流れ図と表には名前があり、表は、キーボードで横にスクロールできる");
  ok(guide("figure.fig").length >= 2 && guide(".checklist input[type=checkbox]").length === 7 && guide("ol.flow.h li").length === 5, "ガイド: 舞台の見方の図・観に行くまでの流れ(5段階)・持ち物チェックリストがある", `${guide("figure.fig").length}`);
  ok(pages["history/index.html"](".tree .tr-l2 > li").length === 4 && pages["history/kodai.html"]("ol.flow.v li").length === 6 && pages["history/chusei.html"]("svg.dg").length === 1 && pages["history/kindai.html"]("ol.flow.h li").length === 4, "歴史: 分類のツリー(里神楽の4系統)・天岩戸の流れ(6段階)・湯立の図・担い手の変化の流れ図がある");
  // 公正さのため、個別の神楽は取り上げない(分類・転換点の説明に欠かせない佐太神社=出雲流の典型だけは残す)
  const hb = files.map((f) => { const $h = pages[f]; $h("ol.sources").remove(); return $h("main .prose").text(); }).join("");
  const named = hb.match(/.{0,10}(石見|高千穂|備中|遠山|花祭|庄内|広島|伊勢大神楽|銀鏡|土佐|御嶽|安芸高田).{0,10}/g) ?? [];
  ok(named.length === 0, "歴史: 本文で、個別の神楽を取り上げない(出雲流の典型の佐太神社を除く)", named.join(" / "));
  ok(pages["history/index.html"]("main .prose a[href^='/kagura/']").filter((_, a) => pages["history/index.html"](a).attr("href") !== "/kagura/").length === 0, "歴史: 個別の神楽の種類のページへはリンクしない");
}
