// 「広告・協賛について」のテスト: 書いてある「載せる場所」が実在するか、中立の方針が他のページと食い違わないか
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";

const read = (p) => readFileSync(p, "utf8");

export function sponsorTests({ ok, section, OUT }) {
  section("広告・協賛について");
  const $ = cheerio.load(read(join(OUT, "sponsor.html")));
  const text = $("main").text();
  ok($("title").text() === "広告・協賛について | 神楽めぐり" && $("h1").text() === "広告・協賛について" && !/noindex/.test($('meta[name="robots"]').attr("content")) && read(join(OUT, "sitemap.xml")).includes("/sponsor.html</loc>"), "タイトル・見出し、検索に載せる(サイトマップ・noindex なし)");
  ok($('script[type="application/ld+json"]').map((_, s) => JSON.parse($(s).text())).get().flat().some((x) => x["@type"] === "BreadcrumbList"), "パンくずの構造化データ");
  const internal = $("main a[href^='/']").map((_, a) => $(a).attr("href").split("#")[0]).get();
  const fileOf = (h) => join(OUT, decodeURIComponent(h.endsWith("/") ? h + "index.html" : h));
  ok(internal.length >= 5 && internal.every((h) => existsSync(fileOf(h))), "サイト内のリンクが、すべて実在するページにつながる", internal.filter((h) => !existsSync(fileOf(h))).join(", "));

  // 「載せられる場所」の例が、実在する県・定期公演のページを指す
  ok(internal.some((h) => /^\/pref\/.+\.html$/.test(h)) && internal.some((h) => /^\/regular\/.+\.html$/.test(h)), "載せられる場所の例が、県のページと定期公演のページにつながる");
  // 確かめていない数字(閲覧数など)を、ページに書かない
  ok(!/\d[\d,]*\s*(PV|ページビュー|人|回|万)/.test(text), "閲覧数などの数字を書いていない");

  // 問い合わせの案内が、実物のフォームの選択肢と一致している
  const topic = "広告・取材などのご相談";
  const cf = cheerio.load(read(join(OUT, "contact.html")));
  ok(text.includes(`「${topic}」`) && cf("#topic option").map((_, o) => cf(o).text()).get().includes(topic), `お問い合わせの「ご用件」に「${topic}」があり、その名前で案内している`);

  // 中立の方針が、「主催者の方へ」・運営者情報と食い違わない
  const org = cheerio.load(read(join(OUT, "organizers.html")))("main").text();
  const about = cheerio.load(read(join(OUT, "about.html")));
  ok(text.includes("無料") && text.includes("「PR」と表示") && text.includes("sponsored") && /協賛の有無で、掲載するかどうか・並び順・本文は変えません/.test(text), "方針: 掲載は無料・PRの表示・sponsored・協賛で掲載や並び順を変えない");
  ok(org.includes("掲載は無料") && org.includes("並び順や内容は変わりません") && about("main").text().includes("並び順は変わりません"), "「主催者の方へ」と運営者情報にも、協賛で並び順が変わらないと書いてある");

  // 入口
  const home = cheerio.load(read(join(OUT, "index.html")));
  ok(home('footer a[href="/sponsor.html"]').length === 1 && about('main a[href="/sponsor.html"]').length === 1, "フッターと運営者情報から、リンクしている");
  ok(home('.top nav a[href="/sponsor.html"]').length === 0, "メインメニューには入れない(読者向けの探し方と分ける)");
}
