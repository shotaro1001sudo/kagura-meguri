// Revenue UX regression: keep editorial navigation helpful and sponsored links intact.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";

const read = (p) => readFileSync(p, "utf8");

export function monetizationUxTests({ ok, section, OUT, build }) {
  section("収益化UX: スマホトップ・広島県の月別導線");
  const home = cheerio.load(read(join(OUT, "index.html")));
  const css = read("scripts/style.css");
  ok(home(".home-find a[href='/calendar.html']").length === 1,
    "トップのビジュアル直後に日付・地域検索へのリンクがある");
  ok(home(".home-hero").next().hasClass("home-find") &&
     home(".home-find").next().hasClass("quick"),
    "ヒーロー→日付と地域の検索→今週末・今月の順");
  ok(home(".quick a").length === 2 &&
     home(".quick a[href='/weekend.html']").length === 1 &&
     home(".quick a[href='/this-month.html']").length === 1,
    "既存の今週末・今月のリンクは残す");
  ok(/main \.home-hero\{min-height:clamp\(370px,94vw,450px\)\}/.test(css),
    "スマホ時のヒーロー高さを縮めながら下限・上限を設ける");
  ok(/\.home-find \.btn\{display:flex;width:100%/.test(css),
    "スマホでは日付・地域CTAをタップしやすい幅にする");

  const h = cheerio.load(read(join(OUT, "pref/広島県.html")));
  ok(h("title").text().includes("月別公演") &&
    h("h1").text().includes("公演日程") &&
    (h('meta[name="description"]').attr("content") || "").includes("月ごとの公演予定"),
    "広島のタイトル・H1・説明文を公演探しのニーズに合わせる");
  const months = h(".pref-month");
  const nav = h(".pref-month-nav a[href^='#hiroshima-2']");
  ok(months.length > 0 && months.length === nav.length,
    "開催月の目次リンク数と月別セクション数が一致する");
  const hrefs = nav.map((_, a) => h(a).attr("href").slice(1)).get();
  const ids = months.map((_, s) => h(s).find("h2").first().attr("id")).get();
  ok(hrefs.join() === ids.join() && new Set(ids).size === ids.length,
    "各月のリンク先が存在し、重複しない");
  ok(months.toArray().every((node) => {
    const section = h(node);
    const id = section.find("h2").attr("id");
    const count = section.find(".card").length;
    const linkText = h(".pref-month-nav a[href='#" + id + "']").text();
    return count > 0 && linkText.includes(count + "件");
  }), "各月の表示件数と、実際の公演カード数が一致する");
  ok(h(".pref-month .card").length > 0 &&
    h(".pref-month .card").length === h(".pref-month .card a").closest(".card").length,
    "公演カードへのリンクと月別一覧を保持する");
  ok(h(".pref-month-nav a[href='#hiroshima-stay']").length === 0 &&
    h("#hiroshima-stay .aff").length === 1,
    "広告設定がない場合は宿探しの目次だけを表示しない");

  const other = cheerio.load(read(join(OUT, "pref/宮崎県.html")));
  ok(other(".pref-month-nav,.pref-month").length === 0 &&
    other("h2").filter((_, n) => other(n).text() === "開催予定").length === 1,
    "広島以外の県の一覧は変更しない");

  const built = build("tests/fixtures/events.test.json", "dist-test-revenue-ux", {
    TEST_AFF_TRAVEL: "1", TEST_GA: "G-TEST123456", TEST_CB: "test-consent-id"
  });
  ok(built.status === 0, "実際のアフィリエイト設定を模したビルドが成功", built.stderr);
  if (built.status === 0) {
    const a = cheerio.load(read("dist-test-revenue-ux/pref/広島県.html"));
    const links = a("#hiroshima-stay .afflist a");
    ok(a(".pref-month-nav a[href='#hiroshima-stay']").length === 1 &&
       a("#hiroshima-stay").length === 1,
       "広告を設定すると月の目次から宿探しへ移動できる");
    ok(links.length === 2 &&
       links.toArray().every((x) => a(x).attr("rel")?.includes("sponsored")),
       "じゃらん・楽天トラベルの広告リンクとPR属性を維持する");
    ok(links.map((_, x) => a(x).attr("data-goatcounter-click")).get().sort().join() ===
       "aff-jalan/広島県,aff-rakuten/広島県",
       "GoatCounterの既存クリックラベルは維持する");
    ok(a("#hiroshima-stay .pr").length === 1 &&
       a('script[data-require-statistics-consent]').length === 1,
       "広告のPR表記とGA4の同意制御を維持する");
  }
}
