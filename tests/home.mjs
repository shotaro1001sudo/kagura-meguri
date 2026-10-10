// トップの「これからの神楽」のテスト: 直近2か月だけをカードで出し、その先は月のボタン。地方のボタンで絞り込む
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";

const read = (p) => readFileSync(p, "utf8");

export function homeTests({ ok, section, OUT, build }) {
  section("トップ: これからの神楽(月ごと・地方の絞り込み)");
  const html = read(join(OUT, "index.html"));
  const $ = cheerio.load(html);
  // テストの基準日(2026-10-09): 開催のある月は 10月・11月・12月
  ok($("#list .mgroup").length === 2 && $("#list .mhead").map((_, h) => $(h).text()).get().join() === "10月,11月", "直近2か月(開催のある月)だけを、月の見出しつきで出す");
  const later = $(".later a").map((_, a) => ({ href: $(a).attr("href"), n: $(a).attr("data-n"), c: JSON.parse($(a).attr("data-c")), text: $(a).text() })).get();
  ok(later.length === 1 && later[0].href === "/month/2026-12.html" && later[0].text === "12月 2件" && later[0].c["中国"] === 2 && later[0].c["九州・沖縄"] === 0, "その先の月は、件数つきのボタンで、月のページへ", JSON.stringify(later));
  ok($("#list .card").length === 4 && !$("#list").text().includes("12月5日"), "一覧のカードは、直近2か月の分だけ");
  ok($(".regions").attr("hidden") !== undefined && $(".regions button").map((_, b) => $(b).text()).get().join() === "全国,中国,九州・沖縄", "地方のボタン(開催のある地方だけ)。JS が動くときだけ表示する");
  ok(!$("main select#f").length && !$("main").text().includes("月ごとに探す"), "都道府県の選択欄と、重複する「月ごとに探す」はなくした");

  // 地方のボタンの動き(ブラウザと同じように、ページのスクリプトを動かす)
  const dom = new JSDOM(html, { runScripts: "dangerously" });
  const d = dom.window.document;
  const visible = () => [...d.querySelectorAll("#list [data-r]")].filter((x) => !x.hidden && !x.closest(".mgroup").hidden).map((x) => x.dataset.r);
  const press = (r) => [...d.querySelectorAll(".regions button")].find((b) => b.textContent === r).click();
  ok(!d.querySelector(".regions").hidden, "JS が動くと、地方のボタンが出る");
  press("九州・沖縄");
  ok(visible().length > 0 && visible().every((r) => r === "九州・沖縄") && d.querySelector(".later a").hidden && d.querySelector(".laterwrap").hidden, "九州・沖縄: 九州の開催だけになり、該当のない先の月は隠れる", visible().join());
  ok([...d.querySelectorAll(".mgroup")].filter((m) => m.hidden).length === 1, "該当のない月は、見出しごと隠れる");
  press("中国");
  ok(visible().every((r) => r === "中国") && !d.querySelector(".later a").hidden && d.querySelector(".later a span").textContent === "2件", "中国: 先の月の件数も、その地方の数になる");
  press("全国");
  ok(visible().length === 4 && d.querySelector(".later a span").textContent === "2件" && d.querySelector(".regions button[aria-pressed=true]").textContent === "全国", "全国に戻すと、元の表示になる");
  dom.window.close();

  section("メインメニュー(探し方で並べる)");
  const navOf = (p) => { const q = cheerio.load(read(join(OUT, p))); return q(".top nav a").map((_, a) => ({ t: q(a).text(), h: q(a).attr("href"), c: q(a).attr("aria-current") })).get(); };
  ok(navOf("index.html").map((x) => x.t).join() === "これからの神楽,日付で探す,地図で探す,種類で探す,はじめての神楽", "メニューは「これからの神楽・日付で探す・地図で探す・種類で探す・はじめての神楽」");
  const cur = (p) => navOf(p).filter((x) => x.c).map((x) => `${x.t}:${x.c}`).join();
  ok(cur("index.html") === "これからの神楽:page" && cur("calendar.html") === "日付で探す:page" && cur("weekend.html") === "日付で探す:true" && cur("this-month.html") === "日付で探す:true" && cur("month/2026-11.html") === "日付で探す:true" && cur("kagura/index.html") === "種類で探す:page" && cur("guide.html") === "はじめての神楽:page", "今いる場所: そのページなら page、日付の各ページでは「日付で探す」を true で示す", ["weekend.html", "this-month.html", "month/2026-11.html"].map(cur).join(" / "));
  const cal = cheerio.load(read(join(OUT, "calendar.html")));
  ok(cal('.datenav a[href="/weekend.html"]').length === 1 && cal('.datenav a[href="/this-month.html"]').length === 1, "「日付で探す」(カレンダー)のページの上に、今週末・今月への入口");
  ok($("#menubtn").attr("hidden") !== undefined && $("#menubtn").attr("aria-controls") === "gnav" && $("#gnav").length === 1, "スマホのメニューのボタン: JS が動くときだけ出す(JS がなければ、メニューは常に見える)");
  const dm = new JSDOM(html, { runScripts: "dangerously" });
  const dd = dm.window.document, btn = dd.getElementById("menubtn"), nav = dd.getElementById("gnav");
  btn.click();
  const opened = btn.getAttribute("aria-expanded") === "true" && nav.classList.contains("open");
  dd.dispatchEvent(new dm.window.KeyboardEvent("keydown", { key: "Escape" }));
  ok(!btn.hidden && dd.documentElement.classList.contains("navjs") && opened && btn.getAttribute("aria-expanded") === "false" && !nav.classList.contains("open"), "ボタンでメニューが開き、Esc キーで閉じる(読み上げにも開閉の状態を伝える)");
  dm.window.close();

  section("検索向け: タイトルの年・開催の構造化データ");
  const titleOf = (p) => cheerio.load(read(join(OUT, p)))("title").text();
  ok(titleOf("kagura/石見神楽.html") === "石見神楽の日程【2026年】公演・開催情報 | 神楽めぐり" && titleOf("pref/広島県.html").startsWith("広島県の神楽 日程【2026年】"), "神楽の種類・都道府県のページの題に、開催の年を入れる(「◯◯神楽 2026」で探す人に合わせる)", titleOf("kagura/石見神楽.html"));
  const ldOf = (id) => { const $e = cheerio.load(read(join(OUT, `events/${id}.html`))); return $e('script[type="application/ld+json"]').map((_, s) => JSON.parse($e(s).text())).get().flat().find((x) => x["@type"] === "Event"); };
  const full = ldOf("t-full"), xss = ldOf("t-xss");
  ok(full.offers?.price === "1000" && full.offers.priceCurrency === "JPY" && xss.offers?.price === "500", "料金に金額があれば、構造化データの価格にする(最初の金額)", JSON.stringify([full.offers, xss.offers]));

  // 1か月の開催が多いとき: 10件までを出し、残りは月のページへ(地方で絞ったときは全部)
  const base = JSON.parse(read("tests/fixtures/events.test.json")).find((e) => e.status === "published" && e.prefecture === "広島県");
  const many = Array.from({ length: 13 }, (_, i) => ({ ...base, id: `t-many-${i}`, name: `多い月の神楽${i}`, start: `2026-10-${String(12 + i).padStart(2, "0")}T18:00`, end: undefined, prefecture: i < 12 ? "広島県" : "宮崎県", lat: undefined, lng: undefined }));
  const F = "tests/.tmp-home.json", D = "dist-test-home";
  writeFileSync(F, JSON.stringify(many));
  const r = build(F, D);
  const m = cheerio.load(read(join(D, "index.html")));
  ok(r.status === 0 && m("#list .mgroup").first().find("[data-r]").length === 13 && m("#list .ov").length === 3 && m("#list .more a").attr("href") === "/month/2026-10.html" && m("#list .more").text().includes("13件"), "1か月が10件を超えると、残りは隠し、月のページへのリンクを出す", r.stderr);
  const dom2 = new JSDOM(read(join(D, "index.html")), { runScripts: "dangerously" });
  const d2 = dom2.window.document;
  [...d2.querySelectorAll(".regions button")].find((b) => b.textContent === "中国").click();
  ok([...d2.querySelectorAll("#list [data-r]")].filter((x) => !x.hidden).length === 12 && d2.querySelector("#list .more").hidden, "地方で絞ったときは、隠していた分も出す");
  dom2.window.close();
  rmSync(F, { force: true }); rmSync(D, { recursive: true, force: true });
}
