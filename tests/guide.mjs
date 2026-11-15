// 「はじめての神楽ガイド」のテスト: 出典の明示・目次・内部リンク・検索向けの情報
import { readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import { SOURCES, CHECKED } from "../scripts/lib/guide.mjs";
import { phrasesHtml, unphrase, phraseParts, sentenceParts, topicGroups } from "../scripts/lib/phrases.mjs";

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

  // 2026-11-15 運営者の依頼(同日に言い直し): 行の右端で折り返すとき、言葉の途中では切らず、その手前の句読点か「てにをは」の切れ目で折り返す。
  // 句読点のたびに改行はしない。話題が変わるところでは改行する。文字もタグも変えずに、文節の切れ目に <wbr> を入れ、.bw で包む
  section("改行の位置(言葉の途中で切らない・話題が変わるところで改行)");
  {
    const samples = ["青森県教育委員会が主催する民俗芸能の公演(あおもり民俗芸能活性化大会)。", "神楽は泊神楽会・平沼神楽保存会(六ケ所村)と岡三沢神楽保存会(三沢市)が出演し、ササ踊りや獅子舞もあわせて上演されます。", "問い合わせ先は東栄町役場教育課(0536-76-0509)です。", "受け継がれてきた神事として、地域の人たちが守ってきた場にお邪魔する、という気持ちで観ましょう。", "Tom &amp; Jerry の公演は2026年11月22日です。"];
    const parts = samples.map(phraseParts);
    ok(parts.every((p, i) => p.join("") === samples[i]) && parts[0].length >= 3 && parts[1].length >= 5, "文を文節に分ける。つなぐと、元の文になる(1字も変えない)", parts.map((p) => p.join("|")).join(" / "));
    ok(parts.flat().every((p) => [...p].length >= 2 && !/[(（「『][^)）」』]{0,2}$/.test(p) && !/^[)）」』、。！？・ー〜]/.test(p)) && !parts.flat().some((p, i, all) => i > 0 && ((/[A-Za-z0-9]$/.test(all[i - 1]) && /^[A-Za-z0-9]/.test(p)) || (/&[A-Za-z0-9#]*$/.test(all[i - 1]) && /^[A-Za-z0-9#]*;/.test(p)) || (/と$/.test(all[i - 1]) && /^(して|いう)/.test(p)))) && parts[2].some((p) => p.includes("0536-76-0509")), "読みにくい切れ目は作らない(1字だけ・開きかっこの直後・行頭に置けない字の前・英数字や電話番号の途中・「として」「という」の途中)", parts.map((p) => p.join("|")).join(" / "));
    ok(sentenceParts("料金は無料(奉納金を持参すると、お返しがあります。目安です)。会場は会所です。").length === 2 && sentenceParts("一文だけ").join("") === "一文だけ", "文に分けるとき、かっこの中の「。」では分けない(補足を途中で切らない)");
    // 話題が変わるところで行を分ける(日時・料金・行き方・予約と問い合わせ・気をつけること・公演の中身)
    const g1 = topicGroups("飾りの多い花祭です。見どころは早朝です。13時開始。観覧は無料です。駐車場があります。車なら鳳来峡ICから約40分です。");
    ok(g1.join("|") === "飾りの多い花祭です。見どころは早朝です。|13時開始。|観覧は無料です。|駐車場があります。車なら鳳来峡ICから約40分です。", "話題が変わるところで分ける(同じ話題の文は、続けて1つの行に)", g1.join("|"));
    const g2 = topicGroups("神楽は七座です。また、獅子舞もあります。"), g3 = topicGroups("一つめの話です。二つめの話です。三つめの話です。四つめの話です。五つめの話です。");
    ok(g2.length === 2 && g3.join("|") === "一つめの話です。二つめの話です。|三つめの話です。四つめの話です。|五つめの話です。" && [g1, g2, g3].every((g) => g.every((x) => x.length > 0)) && topicGroups("一文だけです。").length === 1 && topicGroups("").length === 0, "「また、」などで話が変わるときも分ける。同じ話題が4文以上続くときは、2文ずつに分ける", g2.join("|") + " / " + g3.join("|"));

    const cite = '<sup class="cite"><a href="#src-1" id="ref-1" aria-label="出典1">[1]</a></sup>';
    const a = "<p>神楽は、神様を迎えるために神前で奉納される歌と舞です。" + cite + "古くは「神遊び」とも呼ばれました。</p>";
    const outA = phrasesHtml(a);
    ok(outA.startsWith('<p><span class="bw">') && outA.endsWith("</span></p>") && outA.includes("<wbr>") && outA.includes('<span class="nb">') && outA.includes(cite + "</span>") && !outA.includes('class="cl"') && unphrase(outA) === a, "段落に、折り返してよい印(<wbr>)を入れて .bw で包む。出典の印([1])は、前の言葉と組にして離さない", outA);
    const b = '<p>詳しくは<a href="/x">日程と会場の案内</a>を見てから、出かける前に公式情報を確かめます。</p>';
    const outB = phrasesHtml(b);
    ok(unphrase(outB) === b && outB.includes('<a href="/x">') && !/<\/a><wbr>/.test(outB) && !/<wbr><\/a>/.test(outB) && outB.includes("<wbr>"), "リンクのタグは変えない。リンクのすぐあとの「を」「の」は、リンクから離さない", outB);
    const keep = ['<p class="meta annotation">注記は、ページの下へまとめ直す仕組みがあるので、触りません。</p>', "<template><p>広告の発行コードは、同意の前は動かさないので、触りません。</p></template>", '<script>var s="目次は、触りません。そのままです。";</script>', '<nav><p>目次は、触りません。そのままにしておきます。</p></nav>', "<p>神楽</p>", '<li id="src-1"><a href="https://example.com/">出典の名前と、発行元の名前</a>(発行元) <a class="back" href="#ref-1">↩</a></li>', '<li><label><input type="checkbox"> 毛布やカイロなどの、冬の夜の持ち物です。</label></li>'];
    ok(keep.every((x) => phrasesHtml(x) === x), "注釈・広告の発行コード・スクリプト・目次・出典の一覧・入力欄と、切れ目のない短い文は、そのまま", keep.filter((x) => phrasesHtml(x) !== x).join(" "));
    const nested = "<li><p>中身は、段落として書いた文です。</p><ul><li>子の行にも、折り返しの印を入れます。</li><li>句読点なし</li></ul></li>";
    const outN = phrasesHtml(nested);
    ok(unphrase(outN) === nested && (outN.match(/<span class="bw">/g) || []).length >= 2 && outN.startsWith("<li><p><span") && outN.includes("<ul><li><span"), "中に段落やリストがある行は、内側の段落・行に印を入れる", outN);
    const attr = '<p title="a > b、c。">属性の中の「>」も、タグの終わりと見まちがえずに、そのまま残します。</p>';
    ok([a, b, nested, attr, ...keep].every((x) => unphrase(phrasesHtml(x)) === x) && phrasesHtml(attr).startsWith('<p title="a > b、c。"><span class="bw">'), "足すのは <wbr> と <span class=\"bw\">・<span class=\"nb\"> だけ(取り除くと、元の HTML に戻る)");
    if (r.status === 0) {
      const files = ["guide.html", "history/index.html", "history/kodai.html", "history/chusei.html", "history/kinsei.html", "history/kindai.html"];
      const pages = files.map((f) => [f, cheerio.load(read(join(D, f)))]);
      ok(pages.every(([, p]) => p(".prose .bw").length >= 5 && p(".prose .bw wbr").length >= 30 && p(".cl").length === 0), "ガイド・歴史のページの本文に、折り返してよい印が入っている", pages.map(([f, p]) => f + ":" + p(".prose .bw").length + "/" + p(".prose .bw wbr").length).join(" "));
      ok(pages.every(([, p]) => p(".page-notes .bw, template .bw, nav .bw, .meta .bw, button .bw, label .bw, h1 .bw, h2 .bw, h3 .bw, sup wbr").length === 0 && p(".prose .nb > sup.cite").length >= 1), "注記・目次・見出し・ボタン・出典の印の中には入れない。出典の印は、前の言葉と組になっている");
      const main = (h) => h.match(/<main id="main">([\s\S]*?)<\/main>/)[1];
      ok(pages.every(([f]) => { const m = main(read(join(D, f))); const back = unphrase(m); return !back.includes('class="bw"') && !back.includes("<wbr>") && cheerio.load(m)("body").text() === cheerio.load(back)("body").text(); }), "ガイド・歴史のページ: 印を取り除いても、文は1字も変わらない");
    }
    const sheet = read("scripts/style.css"), built = read("scripts/build.mjs");
    ok(/^\.bw\{word-break:keep-all;overflow-wrap:anywhere\}/m.test(sheet) && /^\.nb\{white-space:nowrap\}/m.test(sheet) && /^\.tline\{display:block\}/m.test(sheet) && !/^\.cl\{/m.test(sheet) && built.includes('<div class="prose guide">${phrasesHtml(guideHtml({') && built.includes('<div class="prose history">${phrasesHtml(historyReader(key, pg.body()))}</div>'), ".bw の中は、字と字のあいだでは折り返さず、印と句読点のあとでだけ折り返す(どのブラウザでも)。ガイド・歴史の本文を、その仕組みに通している");
  }
  rmSync(D, { recursive: true, force: true });
}
