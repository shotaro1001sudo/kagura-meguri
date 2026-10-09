// 「主催者・関係者の方へ」のテスト: 書いてある「載る場所・機能」が実在するか、フォームの説明と実物が一致しているか
import { readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";

const read = (p) => readFileSync(p, "utf8");

export function organizersTests({ ok, section, OUT, build }) {
  section("主催者・関係者の方へ");
  const $ = cheerio.load(read(join(OUT, "organizers.html")));
  const text = $("main").text();
  ok($("title").text() === "主催者・関係者の方へ | 神楽めぐり" && $("h1").text() === "主催者・関係者の方へ" && !/noindex/.test($('meta[name="robots"]').attr("content")) && read(join(OUT, "sitemap.xml")).includes("/organizers.html</loc>"), "タイトル・見出し、検索に載せる(サイトマップ・noindex なし)");
  ok($('script[type="application/ld+json"]').map((_, s) => JSON.parse($(s).text())).get().flat().some((x) => x["@type"] === "BreadcrumbList"), "パンくずの構造化データ");
  const internal = $("main a[href^='/']").map((_, a) => $(a).attr("href").split("#")[0]).get();
  const fileOf = (h) => join(OUT, decodeURIComponent(h.endsWith("/") ? h + "index.html" : h));
  ok(internal.length >= 10 && internal.every((h) => existsSync(fileOf(h))), "サイト内のリンクが、すべて実在するページにつながる", internal.filter((h) => !existsSync(fileOf(h))).join(", "));

  // 「掲載すると、ここに載ります」に書いたことが、実際にある
  const ev = cheerio.load(read(join(OUT, "events/t-full.html")));
  const evLd = ev('script[type="application/ld+json"]').map((_, s) => JSON.parse(ev(s).text())).get().flat();
  ok(text.includes("カレンダーへの登録") && ev('main a[href^="https://calendar.google.com/calendar/render?action=TEMPLATE"]').length === 1, "「カレンダーへの登録」: 開催ページに、Googleカレンダーに追加するボタンがある");
  ok(text.includes("経路の検索") && ev('a[href*="google.com/maps"]').length > 0 && ev("#map").length > 0, "「地図・経路の検索」: 開催ページに、地図と経路のリンクがある");
  ok(text.includes("構造化データ") && evLd.some((x) => x["@type"] === "Event" && x.startDate && x.location), "「構造化データ」: 開催ページに、Event の構造化データ(日時・会場)がある");
  ok(text.includes("フィード") && existsSync(join(OUT, "feed.xml")) && existsSync(join(OUT, "events.ics")), "「新着の配信」: フィードと、購読用の日程ファイルがある");
  ok(["/map.html", "/calendar.html", "/weekend.html", "/this-month.html", "/kagura/"].every((h) => internal.includes(h)), "地図・カレンダー・今週末・今月・神楽の種類へ、リンクしている");

  // フォームの説明(必須・任意の項目)が、実物のフォームと一致している
  const sf = cheerio.load(read(join(OUT, "submit.html")));
  const labelOf = (el) => sf(`label[for="${sf(el).attr("id")}"]`).clone().children().remove().end().text().trim();
  const first = sf("fieldset").first();
  const req = first.find("input[required],select[required],textarea[required]").map((_, el) => labelOf(el)).get();
  const opt = first.find("input:not([required]),textarea:not([required])").map((_, el) => labelOf(el)).get();
  const row = (th) => $("table.info tr").filter((_, tr) => $(tr).find("th").text() === th).find("td").text();
  ok(req.length === 6 && req.every((l) => row("必須").includes(l)), `必須の項目(${req.join("・")})が、説明と一致している`, row("必須"));
  ok(opt.length >= 5 && ["番地までの住所", "料金", "公式情報のURL", "ひとこと説明"].every((l) => opt.includes(l) && row("任意").includes(l)) && opt.every((l) => !row("必須").includes(l)), "任意の項目が、「任意」に入り、「必須」には入っていない", opt.join("・"));
  ok(!text.includes("メールの作成画面"), "本番の設定(送信先あり): 「メールの作成画面が開く」とは案内しない");
  const D = "dist-test-organizers";
  const r = build("tests/fixtures/events.test.json", D, { TEST_FORM_OFF: "1" });
  ok(r.status === 0 && cheerio.load(read(join(D, "organizers.html")))("main").text().includes("メールの作成画面が開きます"), "送信先が未設定の間は、「メールの作成画面が開く」と案内する");
  rmSync(D, { recursive: true, force: true });

  // 方針が、免責事項・プライバシーポリシーと食い違わない
  ok(text.includes("無料") && text.includes("転載しません") && text.includes("サイトに表示しません") && read(join(OUT, "privacy.html")).includes("ご連絡先は、サイトには掲載しません") && read(join(OUT, "disclaimer.html")).includes("転載しません"), "方針(無料・転載しない・連絡先を表示しない)が、ポリシーの記載と一致している");
  // 入口
  const home = cheerio.load(read(join(OUT, "index.html")));
  ok(home('footer a[href="/organizers.html"]').length === 1 && sf('main a[href="/organizers.html"]').length === 1, "フッターと、投稿フォームのページから、リンクしている");
}
