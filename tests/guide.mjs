// 「はじめての神楽ガイド」のテスト: 出典の明示・目次・内部リンク・検索向けの情報
import { readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import { SOURCES, CHECKED } from "../scripts/lib/guide.mjs";
import { clausesHtml, unclause, clauseParts } from "../scripts/lib/clauses.mjs";

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
  const layout = $(".guide .read-layout");
  ok(layout.length === 1 && layout.children().first().is("nav.toc.gnav#toc") && layout.children().eq(1).is(".read-body") && $(".gnav a .no").map((_, n) => $(n).text()).get().join() === "01,02,03,04,05", "章ナビ(番号つきの5章)を本文の前に置く");
  ok($(".totoc,.guide .planning-links,table.chk").length === 0, "「目次へ戻る」、冒頭の3つの入口のカード、持ち物の表は置かない(章ナビ・チェックリストと重なるため)");
  const boxes = $("#packing .checklist li");
  ok(boxes.length === 7 && boxes.get().every((li) => $(li).find("label > input[type=checkbox][name=packing]").length === 1 && $(li).find("label b").text() && $(li).find("label small").text()), "持ち物は、1行に1つのチェックボックスと、場面の添え書き");
  const names = boxes.find("label b").map((_, b) => $(b).text()).get().join("/");
  ok(["羽織りもの", "毛布・カイロ", "虫よけ・タオル", "携帯クッション", "飲み物・軽食", "モバイルバッテリー", "入門書"].every((w) => names.includes(w)), "これまでのカードと表の持ち物を、すべて残す", names);
  ok($("#packing .checklist-foot[hidden] .checklist-count[aria-live=polite]").length === 1, "数の表示は、スクリプトが動くときだけ出す(読み上げにも伝える)");
  const script = existsSync("scripts/client/reader.js") ? read("scripts/client/reader.js") : "";
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

  // 2026-11-15 運営者の依頼: ガイド・歴史のページも、句読点で改行する。タグの入った文を、文字もタグも変えずに、句読点までのまとまり(.cl)に分ける
  section("句読点での改行(ガイド・歴史のページ)");
  {
    const cite = '<sup class="cite"><a href="#src-1" id="ref-1" aria-label="出典1">[1]</a></sup>';
    const a = `<p>神楽は、歌と舞です。${cite}古くは「神遊び」とも呼ばれました。</p>`;
    ok(clausesHtml(a) === `<p><span class="cl">神楽は、</span><span class="cl">歌と舞です。${cite}</span><span class="cl">古くは「神遊び」とも呼ばれました。</span></p>`, "句読点までのまとまりに分け、出典の印([1])は前の文に付ける", clausesHtml(a));
    const b = '<p>詳しくは<a href="/x">日程、会場の案内</a>を見ます。次の文です。</p>';
    ok(clausesHtml(b) === '<p><span class="cl">詳しくは<a href="/x">日程、会場の案内</a>を見ます。</span><span class="cl">次の文です。</span></p>', "リンクの中の句読点では分けない(リンクを途中で切らない)", clausesHtml(b));
    const c = "<p>天鈿女命(『日本書紀』の表記。『古事記』では天宇受売命)が踊り、神々が笑いました。</p>";
    ok(clausesHtml(c) === '<p><span class="cl">天鈿女命(『日本書紀』の表記。『古事記』では天宇受売命)が踊り、</span><span class="cl">神々が笑いました。</span></p>' && clauseParts("料金は無料(奉納金を持参すると、お返しがあります)。会場は会所です。").length === 2, "かっこの中の句読点では分けない(補足を途中で切らない)", clausesHtml(c));
    const d = "<li><b>撮影は許可を得てから。</b>フラッシュは避け、三脚は使いません。</li>";
    ok(clausesHtml(d) === '<li><span class="cl"><b>撮影は許可を得てから。</b></span><span class="cl">フラッシュは避け、</span><span class="cl">三脚は使いません。</span></li>', "強調の中で文が終わったら、その閉じタグのあとで分ける", clausesHtml(d));
    const keep = ['<p class="meta annotation">注記は、分けません。そのままです。</p>', "<template><p>広告の発行コードは、触りません。そのままです。</p></template>", '<script>var s="、。、。";</script>', '<nav><p>目次は、分けません。そのまま。</p></nav>', "<p>一文だけの段落です。</p>", '<li id="src-1"><a href="https://example.com/">出典、名前。</a>(発行元) <a class="back" href="#ref-1">↩</a></li>', '<li><label><input type="checkbox"> 毛布、カイロ。持ち物です。</label></li>'];
    ok(keep.every((x) => clausesHtml(x) === x), "注釈・広告の発行コード・スクリプト・目次・出典の一覧・入力欄と、一文だけの段落は、そのまま", keep.filter((x) => clausesHtml(x) !== x).join(" "));
    const nested = "<li><p>中身は、段落です。分けます。</p><ul><li>子の行も、分けます。</li><li>句読点なし</li></ul></li>";
    ok(clausesHtml(nested) === '<li><p><span class="cl">中身は、</span><span class="cl">段落です。</span><span class="cl">分けます。</span></p><ul><li><span class="cl">子の行も、</span><span class="cl">分けます。</span></li><li>句読点なし</li></ul></li>', "中に段落やリストがある行は、内側の段落・行を分ける", clausesHtml(nested));
    ok([a, b, c, d, nested, ...keep].every((x) => unclause(clausesHtml(x)) === x) && clausesHtml('<p title="a > b、c。">属性の中の「>」も、見まちがえません。次の文。</p>').startsWith('<p title="a > b、c。"><span class="cl">属性の中の「>」も、</span>'), "足すのは <span class=\"cl\"> だけ(取り除くと、元の HTML に戻る)");
    if (r.status === 0) {
      const files = ["guide.html", "history/index.html", "history/kodai.html", "history/chusei.html", "history/kinsei.html", "history/kindai.html"];
      const pages = files.map((f) => [f, cheerio.load(read(join(D, f)))]);
      ok(pages.every(([, p]) => p(".prose .cl").length >= 20), "ガイド・歴史のページの本文は、句読点までのまとまり(.cl)に分かれている", pages.map(([f, p]) => `${f}:${p(".prose .cl").length}`).join(" "));
      ok(pages.every(([, p]) => p(".page-notes .cl, template .cl, nav .cl, .meta .cl, button .cl, label .cl, h1 .cl, h2 .cl, h3 .cl").length === 0 && p(".prose .cl + sup.cite").length === 0 && p(".prose sup.cite").toArray().every((s) => !p(s).parent().children(".cl").length || p(s).parent().is(".cl"))), "注記・目次・見出し・ボタンは分けず、出典の印は文のまとまりの中に入る(まとまりの外に取り残さない)");
      const main = (h) => h.match(/<main id="main">([\s\S]*?)<\/main>/)[1];
      ok(pages.every(([f]) => { const m = main(read(join(D, f))); const back = unclause(m); return !back.includes('class="cl"') && cheerio.load(m)("main, body").text() === cheerio.load(back)("main, body").text(); }), "ガイド・歴史のページ: まとまりを取り除いても、文は1字も変わらない");
    }
    ok(/^\.cl\{display:inline-block;max-width:100%;word-break:auto-phrase;text-wrap:balance\}/m.test(read("scripts/style.css")) && read("scripts/build.mjs").includes('<div class="prose guide">${clausesHtml(guideHtml({') && read("scripts/build.mjs").includes('<div class="prose history">${clausesHtml(historyReader(key, pg.body()))}</div>'), "ガイド・歴史の本文を、まとまりに分ける仕組み(clausesHtml)に通している");
  }
  rmSync(D, { recursive: true, force: true });
}
