// 「はじめての神楽ガイド」のテスト: 出典の明示・目次・内部リンク・検索向けの情報
import { readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
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
  ok($("title").text() === "はじめての神楽ガイド 持ち物・服装・交通の準備 | 神楽めぐり" && $("h1").text() === "はじめての神楽ガイド" && desc.length >= 70 && desc.length <= 120, "持ち物・服装・交通が分かるタイトルと説明文(70〜120字)", String(desc.length));
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
  ok(toc.length === 5 && toc.every((h) => $(h).is("h2.gsec")) && $("h2.gsec .no").map((_, n) => $(n).text()).get().join() === "01,02,03,04,05", "目次の5章が、番号つきの章の見出しに飛ぶ");
  // 項目ごとのまとまり: 章の中は、見出しつきのカード
  ok($(".gcard").length >= 15 && $(".gcard").get().every((c) => $(c).children("h3").length === 1), "項目は、見出しつきのカードにまとまっている", String($(".gcard").length));
  ok($("#highlights").length === 0, "特定の神楽を取り上げる章(各地の見どころ)は置かない(公正さのため)");
  const cmp = $("table.cmp:not(.chk) thead th").map((_, th) => $(th).text()).get();
  ok(cmp.join() === ",神楽,能,歌舞伎" && $("table.cmp:not(.chk) tbody tr").length >= 3, "能・歌舞伎との比較表がある");
  ok($("table.cmp:not(.chk) tbody td").get().every((td, i) => $(td).attr("data-k") === ["神楽", "能", "歌舞伎"][i % 3]), "比較表の各欄に列名がある(スマホで縦に積んだときに表示する)");
  ok(!$("main").text().includes("定期公演"), "定期公演には触れない(ガイドは、観方の読み物)");
  const internal = $("main a[href^='/']").map((_, a) => $(a).attr("href").split("#")[0]).get();
  const fileOf = (h) => join(D, decodeURIComponent(h.endsWith("/") ? h + "index.html" : h));
  ok(internal.length > 0 && internal.every((h) => existsSync(fileOf(h))), "サイト内のリンクが、すべて実在するページにつながる", internal.filter((h) => !existsSync(fileOf(h))).join(", "));
  ok(internal.filter((h) => h.startsWith("/regular/")).length === 0 && internal.filter((h) => h.startsWith("/kagura/") && h !== "/kagura/").length === 0, "個別の神楽の種類・定期公演のページへはリンクしない(特定の神楽を取り上げない)");
  ok(/guide\.html<\/loc><lastmod>/.test(read(join(D, "sitemap.xml"))) && read(join(D, "sitemap.xml")).includes(`guide.html</loc><lastmod>${CHECKED}<`), "サイトマップに載り、lastmod は確認日");
  // 入口(トップ・フッター・各開催ページ)
  const home = cheerio.load(read(join(OUT, "index.html")));
  ok(home('.quick a[href="/guide.html"]').length === 0 && home('.top nav a[href="/guide.html"]').length === 1 && home('footer a[href="/guide.html"]').length === 1, "ガイドへは、メニューとフッターから(トップの入口はメニューと重なるので置かない)");
  const ev = cheerio.load(read(join(OUT, "events/t-full.html"))), rg = cheerio.load(read(join(OUT, "regular/r-nightly.html")));
  ok([ev, rg].every((p) => p('main a[href^="/guide.html"]').length === 0 && p('footer a[href="/guide.html"]').length === 1), "開催・定期公演のページは、本文にガイドへの案内を置かず、フッターから入れる(2026-10-30 運営者の判断)");
  // ガイドは、特定の神楽・地域によらない、一般的な内容にする(出典の一覧は除く)
  const g = cheerio.load(read(join(D, "guide.html")));
  g("ol.sources").remove();
  const general = g("main .guide").text().match(/.{0,12}(石見|広島|高千穂|御嶽|備中|安芸高田|島根|宮崎|大分|岡山).{0,12}/g) ?? [];
  ok(general.length === 0, "本文に、特定の神楽・地域の名前を出さない(一般的な内容)", general.join(" / "));
  // 見せ方(2026-10-30 運営者の判断): 章ナビ(目次)を本文の横・上に固定し、持ち物は1つのチェックリストにまとめる
  section("はじめての神楽ガイド: 章ナビと持ち物チェックリスト");
  const layout = $(".guide .guide-layout");
  ok(layout.length === 1 && layout.children().first().is("nav.toc.gnav#toc") && layout.children().eq(1).is(".guide-body") && $(".gnav a .no").map((_, n) => $(n).text()).get().join() === "01,02,03,04,05", "章ナビ(番号つきの5章)を本文の前に置く");
  ok($(".totoc,.guide .planning-links,table.chk").length === 0, "「目次へ戻る」、冒頭の3つの入口のカード、持ち物の表は置かない(章ナビ・チェックリストと重なるため)");
  const boxes = $("#packing .checklist li");
  ok(boxes.length === 7 && boxes.get().every((li) => $(li).find("label > input[type=checkbox][name=packing]").length === 1 && $(li).find("label b").text() && $(li).find("label small").text()), "持ち物は、1行に1つのチェックボックスと、場面の添え書き");
  const names = boxes.find("label b").map((_, b) => $(b).text()).get().join("/");
  ok(["羽織りもの", "毛布・カイロ", "虫よけ・タオル", "携帯クッション", "飲み物・軽食", "モバイルバッテリー", "入門書"].every((w) => names.includes(w)), "これまでのカードと表の持ち物を、すべて残す", names);
  ok($("#packing .checklist-foot[hidden] .checklist-count[aria-live=polite]").length === 1, "数の表示は、スクリプトが動くときだけ出す(読み上げにも伝える)");
  const script = read("scripts/client/guide.js");
  ok(!/localStorage|sessionStorage|document\.cookie/.test(script) && $("script").filter((_, x) => $(x).html().includes("持ち物チェックリスト")).length === 1, "チェックは保存しない(端末に残さない。プライバシーポリシーを変えない)");
  {
    const dom = new JSDOM(read(join(D, "guide.html")).replace(/<script[\s\S]*?<\/script>/g, ""), { runScripts: "outside-only", pretendToBeVisual: true });
    const w = dom.window, d = w.document;
    if (!d.querySelector(".gnav") || !d.querySelector(".checklist") || !d.getElementById("where")) { ok(false, "章ナビと持ち物チェックリストが動く"); w.close(); }
    else {
    const tops = { where: -400, charm: 120, manners: 900, prepare: 1600, check: 2400 };
    for (const id of Object.keys(tops)) d.getElementById(id).getBoundingClientRect = () => ({ top: tops[id], bottom: tops[id] + 40, left: 0, right: 0, width: 0, height: 40 });
    w.eval(script);
    const current = () => [...d.querySelectorAll(".gnav a")].map((a) => a.hasAttribute("aria-current"));
    ok(current().join() === "false,true,false,false,false", "章ナビは、今読んでいる章(画面の上のほうを過ぎた最後の章)だけを示す", current().join());
    tops.manners = 100; tops.charm = -300;
    w.dispatchEvent(new w.Event("resize"));
    ok(current().join() === "false,false,true,false,false", "読み進めると、示す章が次へ移る", current().join());
    const inputs = [...d.querySelectorAll(".checklist input")], count = d.querySelector(".checklist-count"), reset = d.querySelector(".checklist-reset");
    ok(!d.querySelector(".checklist-foot").hidden && count.textContent === "0 / 7 用意した" && reset.hidden, "スクリプトが動くと、用意できた数を出す(はじめは0)");
    inputs[0].checked = true; inputs[3].checked = true; inputs[0].dispatchEvent(new w.Event("change", { bubbles: true }));
    ok(count.textContent === "2 / 7 用意した" && !reset.hidden, "チェックすると数が増え、まとめて外すボタンが出る");
    inputs.forEach((x) => { x.checked = true; }); inputs[0].dispatchEvent(new w.Event("change", { bubbles: true }));
    ok(count.textContent === "ぜんぶ用意できました" && d.querySelector(".checklist").classList.contains("done"), "すべてそろうと、そろったことを伝える");
    reset.click();
    ok(inputs.every((x) => !x.checked) && count.textContent === "0 / 7 用意した" && reset.hidden, "「チェックを外す」で、すべて外せる");
    w.close();
    }
  }
  rmSync(D, { recursive: true, force: true });
}
