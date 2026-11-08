// 「広告・協賛のご案内」のテスト: 書いてある「載せる場所」が実在するか、数字を書いていないか、中立の方針が他のページと食い違わないか
// 協賛枠(PR)のテスト: データの検査、期間・承認・置き場所の判定、PR の表示・sponsored、開催情報と分かれていること(MON-2)
import { readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import * as cheerio from "cheerio";
import { sponsorErrors, activeSponsors, sponsorSlot, SPONSOR_MAX_PER_PAGE } from "../scripts/lib/sponsor-slots.mjs";

const read = (p) => readFileSync(p, "utf8");

export function sponsorTests({ ok, section, OUT }) {
  section("広告・協賛のご案内");
  const $ = cheerio.load(read(join(OUT, "sponsor.html")));
  const text = $("main").text();
  ok($("title").text() === "広告・協賛のご案内 | 神楽めぐり" && $("h1").text() === "広告・協賛のご案内" && !/noindex/.test($('meta[name="robots"]').attr("content")) && read(join(OUT, "sitemap.xml")).includes("/sponsor.html</loc>"), "タイトル・見出し、検索に載せる(サイトマップ・noindex なし)");
  ok($('script[type="application/ld+json"]').map((_, s) => JSON.parse($(s).text())).get().flat().some((x) => x["@type"] === "BreadcrumbList"), "パンくずの構造化データ");
  const internal = $("main a[href^='/']").map((_, a) => $(a).attr("href").split("#")[0]).get();
  const fileOf = (h) => join(OUT, decodeURIComponent(h.endsWith("/") ? h + "index.html" : h));
  ok(internal.length >= 5 && internal.every((h) => existsSync(fileOf(h))), "サイト内のリンクが、すべて実在するページにつながる", internal.filter((h) => !existsSync(fileOf(h))).join(", "));

  // 「載せられる場所」の例が、実在する県・種類・開催・定期公演のページを指す
  const egs = $("main a").filter((_, a) => /^\/(pref|kagura|events|regular)\/.+\.html$/.test($(a).attr("href"))).map((_, a) => [[$(a).attr("href"), $(a).text()]]).get();
  const titleOf = (h) => cheerio.load(read(fileOf(h)))("h1").text();
  ok(["/pref/", "/kagura/", "/events/", "/regular/"].every((d) => egs.some(([h]) => h.startsWith(d))) && egs.every(([h, t]) => t && titleOf(h).includes(t)), "載せられる場所の例が、県・種類・開催・定期公演のページにつながり、リンクの文字が行き先の名前になっている", egs.map(([h, t]) => `${t}→${titleOf(h)}`).join(", "));
  // 数字(閲覧数・件数など)を、ページに書かない。例のリンクの名前(公演名)は除いて調べる
  const $m = cheerio.load($("main").html());
  $m("a").filter((_, a) => /^\/(pref|kagura|events|regular)\//.test($m(a).attr("href"))).remove();
  ok(!/[0-9０-９]/.test($m.root().text()), "数字を書いていない(閲覧数などは、問い合わせた方にだけ伝える)", ($m.root().text().match(/.{0,10}[0-9０-９].{0,10}/) ?? [""])[0]);
  ok(!/\d[\d,]*\s*(PV|ページビュー|人|回|万)/.test(text) && !/読者の(多く|大半|ほとんど)/.test(text), "閲覧数などの数字や、確かめていない読者の傾向を書いていない");
  ok(text.includes("神楽に特化") && text.includes("ご相談の際に") && text.includes("お伝えします"), "売りは「神楽に特化した読者」。数字は相談の際に伝えると書いてある");
  ok(text.includes("協賛枠(月ごと)") && text.includes("記事広告(お申し込みごと)") && text.includes("取材") && text.includes("道の駅"), "メニュー: 月ごとの協賛枠と、1回ごとの記事広告(取材記事)。道の駅にも案内");
  ok(text.includes("毎週・毎晩の定期公演") && text.includes("編集部が取材して書き"), "言葉の統一: 「毎週・毎晩の定期公演」、書き手は「編集部」");

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
  ok(home('footer a[href="/sponsor.html"]').length === 1 && home('footer a[href="/sponsor.html"]').text() === "広告・協賛のご案内" && about('main a[href="/sponsor.html"]').length === 1, "フッターと運営者情報から、「広告・協賛のご案内」の名前でリンクしている");
  ok(home('.top nav a[href="/sponsor.html"]').length === 0, "メインメニューには入れない(読者向けの探し方と分ける)");

  sponsorSlotTests({ ok, section, OUT });
}

function sponsorSlotTests({ ok, section, OUT }) {
  section("協賛枠(PR)");
  const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const base = { id: "a", kind: "monthly", sponsor: "例の観光協会", title: "見出し", text: "ひとこと", url: "https://example.jp/", start: "2026-10-01", end: "2026-10-31", approved: true, contractRef: "見積書 例", placements: [{ page: "pref", prefecture: "島根県" }] };

  // 本番のデータ: 正しい形で、契約のない協賛を載せていない(最初は空)
  const live = JSON.parse(read("data/sponsors.json"));
  ok(Array.isArray(live) && sponsorErrors(live).length === 0, "data/sponsors.json が正しい形", sponsorErrors(live).join(" / "));

  // データの検査
  ok(sponsorErrors([base]).length === 0, "正しい1件は通る");
  const bad = (patch) => sponsorErrors([{ ...base, ...patch }]).length > 0;
  ok(bad({ url: "javascript:alert(1)" }) && bad({ url: "http://example.jp/" }) && bad({ url: "//evil.example/" }), "url は https:// かサイト内のパスだけ");
  ok(bad({ approved: true, contractRef: "" }) && bad({ placements: [] }) && bad({ placements: [{ page: "pref" }] }) && bad({ placements: [{ page: "top", prefecture: "島根県" }] }), "契約の控えのない承認・条件のない置き場所・知らないページは誤り");
  ok(bad({ start: "2026-11-01", end: "2026-10-01" }) && bad({ kind: "banner" }) && bad({ title: "あ".repeat(41) }) && sponsorErrors([base, base]).length > 0, "期間の前後・種類・長さ・id の重複を調べる");

  // 期間と承認
  ok(activeSponsors([base], "2026-10-15").length === 1 && activeSponsors([base], "2026-11-01").length === 0 && activeSponsors([base], "2026-09-30").length === 0, "期間の外は出さない");
  ok(activeSponsors([{ ...base, approved: false }], "2026-10-15").length === 0, "approved:false は出さない");

  // 置き場所の判定と表示
  const many = ["c", "b", "d"].map((id) => ({ ...base, id }));
  const act = activeSponsors(many, "2026-10-15");
  const html = sponsorSlot(act, "pref", { prefecture: "島根県" }, { esc });
  const $ = cheerio.load(html);
  ok($(".sp-item").length === SPONSOR_MAX_PER_PAGE && $(".sp-item").map((_, x) => $(x).attr("data-sponsor")).get().join() === "b,c", "1ページに最大2件、並びは開始日・ID の順(料金で順を変えない)");
  ok($(".sp-item").get().every((x) => $(x).find(".pr").text() === "PR" && $(x).find(".sp-by").text().includes("例の観光協会")) && $("a[href^='https']").get().every((a) => /\bsponsored\b/.test($(a).attr("rel"))), "各件に「PR」と提供者の名前、リンクは sponsored");
  ok(sponsorSlot(act, "pref", { prefecture: "広島県" }, { esc }) === "" && sponsorSlot(act, "kagura", { prefecture: "島根県" }, { esc }) === "", "県・ページの種類が違えば出さない");
  const ev = { ...base, id: "e", kind: "article", url: "/sponsor.html", placements: [{ page: "event", prefecture: "島根県", kagura: "石見神楽" }] };
  const evAct = activeSponsors([ev], "2026-10-15");
  const evHtml = sponsorSlot(evAct, "event", { prefecture: "島根県", kagura: "石見神楽", id: "x" }, { esc });
  ok(cheerio.load(evHtml)(".pr").text() === "PR記事" && !/target=/.test(evHtml) && sponsorSlot(evAct, "event", { prefecture: "島根県", kagura: "出雲神楽" }, { esc }) === "", "記事広告は「PR記事」。条件はすべて一致したときだけ。サイト内のリンクは同じタブ");
  ok(!/<script/i.test(sponsorSlot(activeSponsors([{ ...base, title: "<script>x</script>" }], "2026-10-15"), "pref", { prefecture: "島根県" }, { esc })), "文字はエスケープする");

  // 本番のビルド(協賛なし): 枠を出さない
  const pages = ["pref/島根県.html", "kagura/石見神楽.html", "events/t-xss.html", "regular/r-weekly.html"];
  ok(pages.every((p) => !existsSync(join(OUT, p)) || !read(join(OUT, p)).includes('class="sponsor-slot')), "協賛が登録されていなければ、枠は出ない");

  // テスト用の協賛を入れたビルド: 県・種類・開催・定期公演に出る。開催情報(カード)の中には入らない
  const out = "dist-test-sponsor";
  rmSync(out, { recursive: true, force: true });
  const r = spawnSync("node", ["scripts/build.mjs"], { encoding: "utf8", env: { ...process.env, EVENTS_FILE: "tests/fixtures/events.test.json", REGULAR_FILE: "tests/fixtures/regular.test.json", SPONSORS_FILE: "tests/fixtures/sponsors.test.json", OUT_DIR: out, BUILD_NOW: "2026-10-09T12:00", TEST_AFF_OFF: "1", TEST_PLANNING_OFF: "1", TEST_ADS_OFF: "1", TEST_GOATCOUNTER: "", TEST_GA: "", TEST_CB: "" } });
  ok(r.status === 0, "協賛ありでビルドできる", r.stderr?.slice(0, 300));
  if (r.status === 0) {
    const at = (p) => cheerio.load(read(join(out, p)));
    const slotIds = (p) => at(p)(".sponsor-slot .sp-item").map((_, x) => at(p)(x).attr("data-sponsor")).get();
    ok(slotIds("pref/島根県.html").join() === "t-pref" && slotIds("pref/広島県.html").length === 0, "県のページ: その県の協賛だけ");
    ok(slotIds("kagura/石見神楽.html").join() === "t-kagura", "神楽の種類のページ");
    ok(slotIds("events/t-xss.html").join() === "t-event" && slotIds("events/t-full.html").length === 0 && slotIds("events/t-past.html").length === 0, "開催のページ: 条件に合う、これからの開催だけ(終わった開催には出さない)");
    ok(slotIds("regular/r-weekly.html").join() === "t-regular", "定期公演のページ");
    ok(!read(join(out, "pref/島根県.html")).includes("t-expired") && !read(join(out, "pref/島根県.html")).includes("t-unapproved"), "期間切れ・未承認は出さない");
    const $p = at("pref/島根県.html");
    ok($p(".card .sponsor-slot, .sponsor-slot .card").length === 0 && $p(".sponsor-slot").attr("aria-label").includes("PR"), "協賛枠は開催情報のカードと分かれ、PR と分かる");
    // 協賛で、開催情報の並び順は変わらない
    const order = (dir) => cheerio.load(read(join(dir, "pref/島根県.html")))(".card h3 a, .card h2 a").map((_, a) => cheerio.load(read(join(dir, "pref/島根県.html")))(a).attr("href")).get().join();
    ok(order(out) === order(OUT), "協賛があっても、開催情報の並び順は同じ");
  }
  rmSync(out, { recursive: true, force: true });
}
