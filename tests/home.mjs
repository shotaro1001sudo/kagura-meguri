// トップの「これからの神楽」のテスト: 直近2か月だけをカードで出し、その先は月のボタン。地方のボタンで絞り込む
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";

const read = (p) => readFileSync(p, "utf8");

export async function homeTests({ ok, section, OUT, build }) {
  section("トップ: これからの神楽(月ごと・地方の絞り込み)");
  const html = read(join(OUT, "index.html"));
  const $ = cheerio.load(html);
  // テストの基準日(2026-10-09): 開催のある月は 10月・11月・12月
  ok($("#list .mgroup").length === 2 && $("#list .mhead").map((_, h) => $(h).text()).get().join() === "10月,11月", "直近2か月(開催のある月)だけを、月の見出しつきで出す");
  const later = $(".later a").map((_, a) => ({ href: $(a).attr("href"), n: $(a).attr("data-n"), c: JSON.parse($(a).attr("data-c")), text: $(a).text() })).get();
  ok(later.length === 1 && later[0].href === "/month/2026-12.html" && later[0].text === "12月 2件" && later[0].c["中国"] === 2 && later[0].c["九州・沖縄"] === 0, "その先の月は、件数つきのボタンで、月のページへ", JSON.stringify(later));
  ok($("#list .card").length === 4 && !$("#list").text().includes("12月5日"), "一覧のカードは、直近2か月の分だけ");
  ok($(".regions:not(.prefs)").attr("hidden") !== undefined && $(".regions:not(.prefs) button").map((_, b) => $(b).text()).get().join() === "全国,中国,九州・沖縄", "地方のボタン(開催のある地方だけ)。JS が動くときだけ表示する");
  ok(!$('main a[href="/submit.html"]').length, "トップの一覧の途中に、投稿のボタンを置かない(入口は、メニューの「主催者の方へ」)");
  ok(!$("main select#f").length && !$("main").text().includes("月ごとに探す"), "都道府県の選択欄と、重複する「月ごとに探す」はなくした");

  // 地方のボタンの動き(ブラウザと同じように、ページのスクリプトを動かす)
  const dom = new JSDOM(html, { runScripts: "dangerously" });
  const d = dom.window.document;
  const visible = () => [...d.querySelectorAll("#list [data-r]")].filter((x) => !x.hidden && !x.closest(".mgroup").hidden).map((x) => x.dataset.r);
  const press = (r) => [...d.querySelectorAll(".regions:not(.prefs) button")].find((b) => b.textContent === r).click();
  ok(!d.querySelector(".regions:not(.prefs)").hidden, "JS が動くと、地方のボタンが出る");
  press("九州・沖縄");
  ok(visible().length > 0 && visible().every((r) => r === "九州・沖縄") && d.querySelector(".later a").hidden && d.querySelector(".laterwrap").hidden, "九州・沖縄: 九州の開催だけになり、該当のない先の月は隠れる", visible().join());
  ok([...d.querySelectorAll(".mgroup")].filter((m) => m.hidden).length === 1, "該当のない月は、見出しごと隠れる");
  press("中国");
  ok(visible().every((r) => r === "中国") && !d.querySelector(".later a").hidden && d.querySelector(".later a span").textContent === "2件", "中国: 先の月の件数も、その地方の数になる");
  press("全国");
  ok(visible().length === 4 && d.querySelector(".later a span").textContent === "2件" && d.querySelector(".regions:not(.prefs) button[aria-pressed=true]").textContent === "全国", "全国に戻すと、元の表示になる");
  dom.window.close();

  section("メインメニュー(探し方で並べる)");
  const navOf = (p) => { const q = cheerio.load(read(join(OUT, p))); return q(".top nav a").map((_, a) => ({ t: q(a).text(), h: q(a).attr("href"), c: q(a).attr("aria-current") })).get(); };
  ok(navOf("index.html").map((x) => x.t).join() === "開催予定,日付・場所で探す,地図で探す,種類で探す,神楽を初めて見る方へ,主催者の方へ", "メニューは「開催予定・日付・場所で探す・地図で探す・種類で探す・神楽を初めて見る方へ・主催者の方へ」");
  ok(!/data-guide/.test(read(join(OUT, "index.html"))) && !/a\[data-guide\]/.test(read("scripts/style.css")), "「神楽を初めて見る方へ」のタブは、ほかのタブと同じ見た目(枠で目立たせない)");
  const cur = (p) => navOf(p).filter((x) => x.c).map((x) => `${x.t}:${x.c}`).join();
  ok(cur("index.html") === "開催予定:page" && cur("organizers.html") === "主催者の方へ:page" && cur("submit.html") === "主催者の方へ:true" && cur("calendar.html") === "日付・場所で探す:page" && cur("weekend.html") === "日付・場所で探す:true" && cur("this-month.html") === "日付・場所で探す:true" && cur("month/2026-11.html") === "日付・場所で探す:true" && cur("kagura/index.html") === "種類で探す:page" && cur("guide.html") === "神楽を初めて見る方へ:page", "今いる場所: そのページなら page、日付の各ページでは「日付・場所で探す」を true で示す", ["weekend.html", "this-month.html", "month/2026-11.html"].map(cur).join(" / "));
  const cal = cheerio.load(read(join(OUT, "calendar.html")));
  ok(cal("#finder").attr("hidden") !== undefined && cal('#finder [data-w]').map((_, b) => cal(b).text()).get().join() === "すべて,今週末,今月,来月,日付を指定" && cal("#region option").first().text() === "全国" && cal("#pref option[data-r]").length > 0 && cal("#cal").length === 0, "「日付・場所で探す」: いつ(すべて・今週末・今月・来月・日付を指定)と、どこ(地方・都道府県)で探す。JS が動くときだけ出す");
  {
    const evJson = read(join(OUT, "events.json"));
    const fd = new JSDOM(read(join(OUT, "calendar.html")), { runScripts: "dangerously", url: "https://kagurameguri.jp/calendar.html?when=range&from=2026-10-01&to=2026-11-30&pref=%E5%BA%83%E5%B3%B6%E7%9C%8C", beforeParse(w) { w.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(evJson)) }); } });
    await new Promise((r) => setTimeout(r, 30));
    const D = fd.window.document, items = () => [...D.querySelectorAll("#results li")].map((li) => li.querySelector(".meta").textContent);
    const all = JSON.parse(evJson).filter((x) => x.up);
    const exp = all.filter((x) => x.prefecture === "広島県" && (x.end || x.start).slice(0, 10) >= "2026-10-01" && x.start.slice(0, 10) <= "2026-11-30").length;
    ok(!D.getElementById("finder").hidden && D.getElementById("range").hidden === false && D.getElementById("region").value === "中国" && items().length === exp && exp > 0 && items().every((t) => t.includes("広島県")) && D.getElementById("count").textContent === `当てはまる開催 ${exp}件`, "URL の条件(期間・県)を戻し、当てはまる開催と件数を出す。県を選ぶと地方も合わせる", `${items().length}/${exp}`);
    const rg = D.getElementById("region"); rg.value = "九州・沖縄"; rg.dispatchEvent(new fd.window.Event("change"));
    ok(D.getElementById("pref").value === "" && [...D.querySelectorAll("#pref option[data-r]")].every((o) => o.hidden === (o.dataset.r !== "九州・沖縄")) && items().every((t) => !t.includes("広島県")) && /region=/.test(fd.window.location.search) && !/pref=/.test(fd.window.location.search), "地方を変えると、都道府県の選択肢をその地方だけにし、条件を URL に残す", fd.window.location.search);
    [...D.querySelectorAll("[data-w]")].find((b) => b.dataset.w === "all").click(); rg.value = ""; rg.dispatchEvent(new fd.window.Event("change"));
    ok(items().length === all.length && D.getElementById("range").hidden && fd.window.location.search === "", "「すべて」「全国」に戻すと、開催予定がすべて出る");
    fd.window.close();
  }
  ok($("#menubtn").attr("hidden") !== undefined && $("#menubtn").attr("aria-controls") === "gnav" && $("#gnav").length === 1, "スマホのメニューのボタン: JS が動くときだけ出す(JS がなければ、メニューは常に見える)");
  const dm = new JSDOM(html, { runScripts: "dangerously" });
  const dd = dm.window.document, btn = dd.getElementById("menubtn"), nav = dd.getElementById("gnav");
  btn.click();
  const opened = btn.getAttribute("aria-expanded") === "true" && nav.classList.contains("open");
  dd.dispatchEvent(new dm.window.KeyboardEvent("keydown", { key: "Escape" }));
  ok(!btn.hidden && dd.documentElement.classList.contains("navjs") && opened && btn.getAttribute("aria-expanded") === "false" && !nav.classList.contains("open"), "ボタンでメニューが開き、Esc キーで閉じる(読み上げにも開閉の状態を伝える)");
  dm.window.close();

  section("開催ページ: 経路のボタン・あわせて観たい神楽");
  const evs = JSON.parse(read("tests/fixtures/events.test.json")).filter((e) => e.status === "published");
  const withMap = evs.find((e) => e.lat != null), noMap = evs.find((e) => e.lat == null);
  const pg = (e) => cheerio.load(read(join(OUT, `events/${e.id}.html`)));
  const wm = pg(withMap), route = wm('a[href*="google.com/maps"]');
  ok(route.length === 1 && route.text() === "経路を調べる" && route.closest(".routebtn").prevAll(".mapbox").find("#map").length === 1, "「経路を調べる」は、地図の下に1つだけ");
  ok(!noMap || pg(noMap)('a[href*="google.com/maps"]').length === 0, "地図のない開催では、経路のボタンを出さない", noMap?.id);
  const rel = wm("h2").filter((_, h) => wm(h).text() === "あわせて観たい神楽");
  ok(!wm("h2").text().includes("ほかの") && (rel.length === 0 || /・/.test(rel.next(".monthlist").find(".meta").first().text())), "関連の開催は「あわせて観たい神楽」の1つの一覧(各行に種類・県)", rel.next().text().slice(0, 80));
  ok(/.crumbs li{display:flex;align-items:center}/.test(read("scripts/style.css")), "パンくずの、リンクと今のページ名の高さをそろえる");

  section("検索向け: タイトルの年・開催の構造化データ");
  const titleOf = (p) => cheerio.load(read(join(OUT, p)))("title").text();
  ok(titleOf("kagura/石見神楽.html") === "石見神楽の日程【2026年】公演・開催情報 | 神楽めぐり" && titleOf("pref/広島県.html").startsWith("広島県の神楽 日程【2026年】"), "神楽の種類・都道府県のページの題に、開催の年を入れる(「◯◯神楽 2026」で探す人に合わせる)", titleOf("kagura/石見神楽.html"));
  const ldOf = (id) => { const $e = cheerio.load(read(join(OUT, `events/${id}.html`))); return $e('script[type="application/ld+json"]').map((_, s) => JSON.parse($e(s).text())).get().flat().find((x) => x["@type"] === "Event"); };
  const full = ldOf("t-full"), xss = ldOf("t-xss");
  ok(full.offers?.price === "1000" && full.offers.priceCurrency === "JPY" && xss.offers?.price === "500", "料金に金額があれば、構造化データの価格にする(最初の金額)", JSON.stringify([full.offers, xss.offers]));

  // 開催が多いとき: 最初は8件まで出し、残りは「すべて見る」・地方・県で出す(JS がなければ、日付・場所で探すへ)
  const base = JSON.parse(read("tests/fixtures/events.test.json")).find((e) => e.status === "published" && e.prefecture === "広島県");
  const many = Array.from({ length: 13 }, (_, i) => ({ ...base, id: `t-many-${i}`, name: `多い月の神楽${i}`, start: `2026-10-${String(12 + i).padStart(2, "0")}T18:00`, end: undefined, prefecture: i < 10 ? "広島県" : i < 12 ? "岡山県" : "宮崎県", lat: undefined, lng: undefined }));
  const F = "tests/.tmp-home.json", D = "dist-test-home";
  writeFileSync(F, JSON.stringify(many));
  const r = build(F, D);
  const m = cheerio.load(read(join(D, "index.html")));
  ok(r.status === 0 && m("#list [data-r]").length === 13 && m("#list .ov").length === 5 && m("#showall").attr("href") === "/calendar.html" && m("#showall").text().includes("13件"), "最初は8件まで。残りは隠し、「すべて見る」(JS がなければ、日付・場所で探すへ)", r.stderr);
  const dom2 = new JSDOM(read(join(D, "index.html")), { runScripts: "dangerously" });
  const d2 = dom2.window.document, vis2 = () => [...d2.querySelectorAll("#list [data-r]")].filter((x) => !x.hidden);
  d2.getElementById("showall").click();
  ok(vis2().length === 13 && d2.getElementById("showall").parentNode.hidden, "「すべて見る」を押すと、残りも出て、ボタンは消える");
  [...d2.querySelectorAll(".regions:not(.prefs) button")].find((b) => b.textContent === "中国").click();
  const pfb = [...d2.querySelectorAll(".regions.prefs button")].filter((b) => !b.hidden).map((b) => b.textContent);
  ok(vis2().length === 12 && !d2.querySelector(".regions.prefs").hidden && pfb.join() === "すべての県,岡山県,広島県", "地方で絞ると、その地方の開催をすべて出し、県のボタンが出る(北から南の順)", pfb.join());
  [...d2.querySelectorAll(".regions.prefs button")].find((b) => b.textContent === "岡山県").click();
  ok(vis2().length === 2 && vis2().every((x) => x.dataset.p === "岡山県"), "県で絞り込める");
  [...d2.querySelectorAll(".regions:not(.prefs) button")].find((b) => b.textContent === "九州・沖縄").click();
  ok(d2.querySelector(".regions.prefs").hidden && vis2().length === 1, "開催のある県が1つだけの地方では、県のボタンを出さない");
  dom2.window.close();
  rmSync(F, { force: true }); rmSync(D, { recursive: true, force: true });
}
