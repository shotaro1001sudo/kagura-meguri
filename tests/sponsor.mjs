// 「広告・協賛のご案内」のテスト: 書いてある「載せる場所」が実在するか、数字は「数字で見る」の概数と料金だけか、中立の方針が他のページと食い違わないか
// 協賛枠(PR)のテスト: データの検査、期間・承認・置き場所の判定、PR の表示・sponsored、開催情報と分かれていること(MON-2)
import { readFileSync, existsSync, rmSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import * as cheerio from "cheerio";
import { sponsorErrors, activeSponsors, sponsorSlot, sponsorCoverage, SPONSOR_MAX_PER_PAGE } from "../scripts/lib/sponsor-slots.mjs";
import { roundDown2, approx, computeMediaStats, mediaStatsErrors, statsFresh } from "../scripts/lib/media-stats.mjs";
import { sponsorHtml } from "../scripts/lib/sponsor.mjs";

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
  // 数字は「数字で見る」(.sp-stats)と、メニューの料金(.sp-menu)だけに置く。例のリンクの名前(公演名)は除いて調べる
  const $m = cheerio.load($("main").html());
  $m("a").filter((_, a) => /^\/(pref|kagura|events|regular)\//.test($m(a).attr("href"))).remove();
  $m(".sp-stats, .sp-menu").remove();
  ok(!/[0-9０-９]/.test($m.root().text()), "数字は「数字で見る」とメニューの料金の中だけ", ($m.root().text().match(/.{0,10}[0-9０-９].{0,10}/) ?? [""])[0]);
  ok(!/読者の(多く|大半|ほとんど)/.test(text), "確かめていない読者の傾向を書いていない");
  // 数字で見る: 掲載の件数は実数、アクセスは概数(約)と期間・出典つき。丸めていない数字を出さない
  const st = $(".sp-stats");
  const tiles = st.find(".sp-tiles li").map((_, li) => [[$(li).find(".k").text(), $(li).find(".v").text()]]).get();
  const tv = (k) => (tiles.find(([x]) => x.includes(k)) ?? [, ""])[1];
  ok(/^\d+件$/.test(tv("これからの開催")) && /^\d+都道府県$/.test(tv("都道府県")) && /^\d+種類$/.test(tv("神楽の種類")) && /^\d+か所$/.test(tv("定期公演")), "掲載している情報: 開催・都道府県・神楽の種類・定期公演の件数", JSON.stringify(tiles));
  ok(tv("検索結果に表示") === "約2.3万回" && tv("検索から訪れた") === "約1,900回" && tv("閲覧数") === "約5,200回" && st.text().includes("うち直近1週間で約8,100回"), "アクセス: 概数(約)で、直近1週間も添える", JSON.stringify(tiles));
  ok(st.find(".sp-tiles .v").get().every((v) => /^約/.test($(v).text()) || /^\d+\D+$/.test($(v).text())) && !/23000|1900|5200/.test(st.text()), "アクセスの数字は、すべて「約」つきの概数");
  ok(st.text().includes("Google Search Console(9月8日〜10月5日)") && st.text().includes("Googleアナリティクス(9月10日〜10月7日)") && st.text().includes("2026年10月8日更新") && st.text().includes("計測に同意した方の分だけ"), "出典・集計期間・更新日・閲覧数の計り方を書く");
  const tops = st.find(".sp-top a").map((_, a) => [[$(a).attr("href"), $(a).text()]]).get();
  ok(tops.map(([h]) => h).join() === "/pref/島根県.html,/kagura/石見神楽.html" && tops.every(([h, t]) => t && titleOf(h) === t), "よく読まれているページ: 名前は行き先の見出し。無いページは出さない", JSON.stringify(tops));
  ok(st.text().includes("ご相談の際にお伝えします"), "ページごとの数字は、相談の際に伝えると書く");
  ok(text.includes("神楽に特化") && text.includes("ご相談の際に") && text.includes("お伝えします"), "売りは「神楽に特化した読者」。ページごとの数字は相談の際に伝えると書いてある");
  ok($("#menu").length === 1 && $('a[href="#menu"]').length === 1 && $(".sp-menu .sp-plan").length >= 2 && $(".sp-menu .sp-plan").get().every((x) => $(x).find("h3").text() && $(x).find(".price").text() && $(x).find("dt").text().includes("載る場所")), "メニューは、名前・料金・載る場所を並べて比べられる。冒頭からメニューへ飛べる");
  ok($(".sp-sample .sponsor-slot").length === 1 && $(".sp-sample a").length === 0 && $(".sp-sample .sponsor-slot .pr").first().text() === "PR" && $(".sp-sample .sponsor-slot .pr").map((_, x) => $(x).text()).get().includes("PR記事") && $(".sp-sample figcaption").get().every((f) => $(f).text().includes("見本")), "協賛枠の見え方の見本(リンクなし・「見本」と書く・PR と PR記事の両方)");
  ok($(".sp-sample-article .sp-article").length === 1 && $(".sp-sample-article .pr").text() === "PR記事" && $('main a[href="/pr/sample.html"]').length >= 1 && $(".sp-ready li").length === 2 && $(".sp-ready dt").length >= 6 && $(".sp-who .eg").length === 3, "記事広告の冒頭の見本と見本ページへのリンク、ご用意いただくもの(協賛枠・記事広告)、このような方へ の載せ方の例");
  // 見本と載せ方の例には、特定の神楽の名前・団体の名前を使わない(架空の「◯◯温泉旅館」などにする)
  const prPage = cheerio.load(read(join(OUT, "pr/sample.html")));
  {
    const rows = [...JSON.parse(read("data/events.json")), ...JSON.parse(read("data/regular.json"))];
    const names = [...new Set(rows.flatMap((e) => [e.kagura, e.organizer, e.performer, ...(Array.isArray(e.performers) ? e.performers : [])]).filter((x) => typeof x === "string" && x.length >= 3))];
    const partnerNames = (existsSync("data/partners.json") ? JSON.parse(read("data/partners.json")) : []).map((p) => p.name);
    const sampleText = $(".sp-sample, .sp-ready, .sp-who").text() + prPage("main").text();
    const found = [...names, ...partnerNames].filter((n) => sampleText.includes(n));
    ok(sampleText.includes("◯◯") && found.length === 0, "見本と載せ方の例に、特定の神楽の名前・団体の名前を使っていない", found.join(", "));
  }
  ok(/noindex/.test(prPage('meta[name="robots"]').attr("content")) && !read(join(OUT, "sitemap.xml")).includes("/pr/sample.html") && prPage("title").text() === "記事広告の見本 | 神楽めぐり", "記事広告の見本ページは、検索に載せない(noindex・サイトマップに入れない)");
  ok(prPage("main .pr").first().text() === "PR記事" && prPage("main").text().includes("見本") && prPage("main").text().includes("架空") && prPage("main").text().includes("編集部が取材して書き") && prPage("main").text().includes("並び順は変わりません") && prPage('main a[href="/sponsor.html"]').length >= 1 && prPage('main a[href="/contact.html"]').length >= 1, "見本ページ: PR記事の表示、架空である旨、取材して書くこと、中立の方針、案内と問い合わせへのリンク");
  ok(prPage('main a[href^="http"]').length === 0 && prPage(".crumbs a[href='/sponsor.html']").length === 1 && prPage("main h2").length >= 5, "見本ページに外へのリンクはなく、パンくずは広告・協賛のご案内から。見出しごとの本文がある");
  // 協賛のページだけの CSS は、その2ページの head にだけ入れる(全ページの CSS には入れない。ページの重さの上限のため)
  const hasCss = (p) => /\.sp-stats\{/.test(read(join(OUT, p))) && /\.sp-article\{/.test(read(join(OUT, p)));
  ok(hasCss("sponsor.html") && hasCss("pr/sample.html") && !hasCss("index.html") && !hasCss("organizers.html") && !/\.sp-stats\{/.test(read("scripts/style.css")), "協賛のページ専用の CSS は、協賛のページと見本ページにだけ入り、style.css には無い");
  {
    const cfgP = JSON.parse(read("config.json")).sponsorPrices ?? {};
    const prices = $(".sp-menu .sp-plan").map((_, x) => [[$(x).find("h3").text(), $(x).find(".price").text()]]).get();
    const priceOf = (h) => (prices.find(([t]) => t.startsWith(h)) ?? [, ""])[1];
    const yen = (n) => n.toLocaleString("ja-JP") + "円";
    ok(priceOf("協賛枠") === `月額${yen(cfgP.monthly)}(税込)` && priceOf("記事広告") === `1本${yen(cfgP.article)}(税込)` && text.includes("銀行振込の前払い") && !text.includes("お見積もりします"),
      "協賛枠と記事広告の料金は、config.json の sponsorPrices のとおりに出し、支払いは前払いと書く(お見積もりにしない)", JSON.stringify(prices));
    const est = cheerio.load(`<main>${sponsorHtml({ esc: (s) => s, siteName: "神楽めぐり", prices: {} })}</main>`);
    ok(est(".sp-menu .price").map((_, x) => est(x).text()).get().slice(0, 2).join() === "お見積もり,お見積もり" && est("main").text().includes("お見積もりします"), "料金を決めていないときは、「お見積もり」と書く");
  }
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
  mediaStatsTests({ ok, section });
}

function mediaStatsTests({ ok, section }) {
  section("協賛のページのアクセス数(概数)");
  ok(roundDown2(4876) === 4800 && roundDown2(19234) === 19000 && roundDown2(87) === 87 && roundDown2(0) === 0 && roundDown2(105) === 100, "上から2桁で切り捨てる(多く見せない)");
  ok(approx(23000) === "約2.3万" && approx(20000) === "約2万" && approx(4800) === "約4,800", "「約2.3万」「約4,800」の形");
  // 28日のうち24日以上の値があるときだけ載せる
  const day = (i) => new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10);
  const days = {};
  for (let i = 0; i < 28; i++) days[day(i)] = { gscImpr: 1000 + i, gscClicks: 101 };
  for (let i = 0; i < 20; i++) Object.assign(days[day(i + 8)], { pv: 333, users: 100 });
  const s = computeMediaStats({ days }, { snapshot: { gscPages28: { "/": [99, 1], "/a.html": [5, 9], "/b.html": [7, 1] } } }, "2026-10-30");
  ok(s.search?.impressions === 28000 && s.search.clicks === 2800 && s.search.from === "2026-10-01" && s.search.to === "2026-10-28" && s.search.impressions7 === 7100, "検索: 直近28日と直近7日を、丸めて出す", JSON.stringify(s.search));
  ok(!s.analytics, "閲覧数: 値のある日が24日に満たなければ載せない(欠けた期間で見せない)");
  ok(s.topPages.join() === "/b.html,/a.html", "よく読まれているページ: 検索から訪れた数の順。トップページは除く。数字は持たない");
  ok(mediaStatsErrors(s).length === 0 && mediaStatsErrors({ ...s, search: { ...s.search, impressions: 28378 } }).length > 0 && mediaStatsErrors({ ...s, raw: 1 }).length > 0, "丸めていない数字・知らない項目があれば、ビルドを止める");
  const live = existsSync("data/media-stats.json") ? JSON.parse(read("data/media-stats.json")) : null;
  ok(mediaStatsErrors(live).length === 0, "data/media-stats.json が正しい形(丸めた概数だけ)", mediaStatsErrors(live).join(" / "));
  ok(statsFresh(s, "2026-12-20") && !statsFresh(s, "2027-01-10") && !statsFresh(null, "2026-10-30"), "集計が60日より古ければ、ページに出さない");
  const html = sponsorHtml({ esc: String, siteName: "神楽めぐり", stats: null, facts: { events: 3, prefs: 2, kaguras: 2, regular: 1 } });
  const $ = cheerio.load(html);
  ok($(".sp-stats .sp-tiles").length === 1 && !$(".sp-stats").text().includes("約") && $(".sp-stats").text().includes("ご相談の際に"), "アクセスの集計が無いときは、件数だけ出して、数字は相談の際に伝えると書く");
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

  // 地域の枠(area): 地域の県・開催・定期公演・神楽の種類のページにまとめて出す(1年を通して載せられる)
  const area = { ...base, id: "area", end: "2027-03-31", placements: [{ page: "area", prefecture: "島根県", cities: ["益田市", "邑智郡邑南町"] }] };
  ok(sponsorErrors([area]).length === 0 && bad({ placements: [{ page: "area" }] }) && bad({ placements: [{ page: "area", prefecture: "島根県", cities: [] }] }) && bad({ placements: [{ page: "area", prefecture: "島根県", kagura: "石見神楽" }] }), "地域の枠: 県が必須。cities は市町村名の配列。ほかの条件は書けない");
  const aAct = activeSponsors([area], "2026-10-15");
  const has = (page, ctx) => sponsorSlot(aAct, page, ctx, { esc }).includes('data-sponsor="area"');
  ok(has("pref", { prefecture: "島根県" }) && has("event", { prefecture: "島根県", city: "益田市", kagura: "石見神楽", id: "x" }) && has("regular", { prefecture: "島根県", city: "邑南町", id: "y" })
    && has("kagura", { kagura: "石見神楽", places: [{ prefecture: "島根県", city: "浜田市" }, { prefecture: "島根県", city: "益田市" }] }), "地域の枠は、県・開催・定期公演・神楽の種類のページに出る(郡は書いても書かなくても同じ)");
  ok(!has("event", { prefecture: "島根県", city: "浜田市" }) && !has("pref", { prefecture: "広島県" }) && !has("kagura", { kagura: "石見神楽", places: [{ prefecture: "島根県", city: "浜田市" }] }), "地域の外(ほかの市町村・県・地域の開催がない種類)には出ない");
  const hiro = activeSponsors([{ ...area, placements: [{ page: "area", prefecture: "広島県", cities: ["広島市"] }] }], "2026-10-15");
  ok(sponsorSlot(hiro, "event", { prefecture: "広島県", city: "広島市安佐北区" }, { esc }) !== "" && sponsorSlot(hiro, "event", { prefecture: "広島県", city: "東広島市" }, { esc }) === "", "政令市は区も含む。名前の一部が同じ別の市(東広島市)は含まない");

  // 載り続けるかの見込み: 祭りの開催ページだけの契約は、祭りが終わると載る場所がなくなる。地域の枠で定期公演があれば続く
  const cEv = [{ id: "fest", prefecture: "長野県", city: "飯田市", kagura: "霜月祭", start: "2026-12-05T11:00", status: "published" }, { id: "old", prefecture: "島根県", city: "益田市", kagura: "石見神楽", start: "2026-09-01T19:00" }];
  const cReg = [{ id: "night", prefecture: "島根県", city: "益田市", kagura: "石見神楽" }, { id: "gone", prefecture: "島根県", city: "益田市", kagura: "石見神楽", until: "2026-09-30" }];
  const cov = sponsorCoverage([
    { ...base, id: "fest-only", end: "2027-03-31", placements: [{ page: "event", kagura: "霜月祭" }, { page: "kagura", kagura: "霜月祭" }] },
    { ...area, id: "area" },
    { ...base, id: "nowhere", end: "2027-03-31", placements: [{ page: "pref", prefecture: "北海道" }] },
    { ...base, id: "ended", end: "2026-10-01" }, { ...area, id: "draft", approved: false },
  ], { events: cEv, regular: cReg, today: "2026-11-11" });
  const byId = Object.fromEntries(cov.map((c) => [c.id, c]));
  ok(cov.map((c) => c.id).sort().join() === "area,fest-only,nowhere", "見込みは、承認済みで、契約が今日以降まであるものだけ");
  ok(byId["fest-only"].short && byId["fest-only"].last === "2026-12-05" && byId["fest-only"].count.event === 1 && byId["fest-only"].count.kagura === 1, "祭りのページだけの契約は、祭りの日の後に載る場所がなくなる(short)");
  ok(!byId.area.short && byId.area.last === null && byId.area.count.pref === 1 && byId.area.count.regular === 1 && byId.area.count.kagura === 1 && byId.area.count.event === 0, "地域の枠は、定期公演があれば契約の終わりまで続く(終わった開催・定期公演は数えない)");
  ok(byId.nowhere.pages === 0 && byId.nowhere.last === "", "載るページがない契約も分かる");
  const withDrafts = sponsorCoverage([{ ...area, id: "draft", approved: false }], { events: cEv, regular: cReg, today: "2026-11-11", drafts: true });
  ok(withDrafts.length === 1 && withDrafts[0].approved === false && withDrafts[0].last === null, "管理者用ページでは、未承認の下書きも、契約の前に載る場所を確かめられる");

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
    // 置き場所: あればページの上のほう。県・種類のページは開催の一覧より前、開催・定期公演のページは右の列の先頭
    const before = (p) => { const h = read(join(out, p)); return h.indexOf('class="sponsor-slot') > 0 && h.indexOf('class="sponsor-slot') < h.indexOf('class="card'); };
    const sideFirst = (p) => at(p)(".d-side > :first-child").is(".sponsor-slot.side");
    ok(before("pref/島根県.html") && before("kagura/石見神楽.html"), "県・種類のページ: 協賛枠は、開催の一覧より前(上のほう)に出す");
    ok(sideFirst("events/t-xss.html") && sideFirst("regular/r-weekly.html"), "開催・定期公演のページ: 協賛枠は、右の列の先頭に出す");
    ok(!at("events/t-full.html")(".sponsor-slot").length && !at("pref/広島県.html")(".sponsor-slot").length, "当てはまる協賛がなければ、枠ごと出さない");
    ok(!read(join(out, "pref/島根県.html")).includes("t-expired") && !read(join(out, "pref/島根県.html")).includes("t-unapproved"), "期間切れ・未承認は出さない");
    const $p = at("pref/島根県.html");
    ok($p(".card .sponsor-slot, .sponsor-slot .card").length === 0 && $p(".sponsor-slot").attr("aria-label").includes("PR"), "協賛枠は開催情報のカードと分かれ、PR と分かる");
    // 協賛で、開催情報の並び順は変わらない
    const order = (dir) => cheerio.load(read(join(dir, "pref/島根県.html")))(".card h3 a, .card h2 a").map((_, a) => cheerio.load(read(join(dir, "pref/島根県.html")))(a).attr("href")).get().join();
    ok(order(out) === order(OUT), "協賛があっても、開催情報の並び順は同じ");
  }
  rmSync(out, { recursive: true, force: true });

  // 地域の枠を入れたビルド: 地域のページに出る。契約の終わりより前に載る場所がなくなる契約は、ビルドが知らせる(公開は止めない)
  const out2 = "dist-test-sponsor-area", dir = mkdtempSync(join(tmpdir(), "sponsor-area-")), spFile = join(dir, "sponsors.json");
  writeFileSync(spFile, JSON.stringify([
    { ...area, id: "t-area", start: "2026-10-01", end: "2026-11-30" },
    { ...base, id: "t-short", start: "2026-10-01", end: "2027-03-31", placements: [{ page: "event", prefecture: "島根県", kagura: "石見神楽", city: "大田市" }] },
  ]));
  const r2 = spawnSync("node", ["scripts/build.mjs"], { encoding: "utf8", env: { ...process.env, EVENTS_FILE: "tests/fixtures/events.test.json", REGULAR_FILE: "tests/fixtures/regular.test.json", SPONSORS_FILE: spFile, OUT_DIR: out2, BUILD_NOW: "2026-10-09T12:00", TEST_AFF_OFF: "1", TEST_PLANNING_OFF: "1", TEST_ADS_OFF: "1", TEST_GOATCOUNTER: "", TEST_GA: "", TEST_CB: "" } });
  ok(r2.status === 0, "地域の枠ありでビルドできる", r2.stderr?.slice(0, 300));
  if (r2.status === 0) {
    const ids = (p) => { const $a = cheerio.load(read(join(out2, p))); return $a(".sponsor-slot .sp-item").map((_, x) => $a(x).attr("data-sponsor")).get(); };
    ok(ids("pref/島根県.html").includes("t-area") && ids("kagura/石見神楽.html").includes("t-area") && ids("events/t-xss.html").includes("t-area") && !ids("events/t-long.html").includes("t-area"), "地域の枠: 県・神楽の種類・地域の開催のページに出て、地域の外の開催(大田市)には出ない");
    ok(/SPONSOR_ENDS_EARLY: t-short/.test(r2.stderr) && !/SPONSOR_(ENDS_EARLY|NO_PAGE): t-area/.test(r2.stderr), "開催のページだけの契約は「契約の終わりより前に載る場所がなくなる」とビルドが知らせる", r2.stderr.slice(-300));
  }
  rmSync(out2, { recursive: true, force: true });
  rmSync(dir, { recursive: true, force: true });
}
