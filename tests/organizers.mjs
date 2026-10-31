// 「主催者の方へ」のテスト: 書いてある「載る場所・機能」が実在するか、フォームの説明と実物が一致しているか
import { readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";

const read = (p) => readFileSync(p, "utf8");

export async function organizersTests({ ok, section, OUT, build }) {
  section("主催者の方へ");
  const $ = cheerio.load(read(join(OUT, "organizers.html")));
  const text = $("main").text();
  ok($("title").text() === "主催者の方へ | 神楽めぐり" && $("h1").text() === "主催者の方へ" && !/noindex/.test($('meta[name="robots"]').attr("content")) && read(join(OUT, "sitemap.xml")).includes("/organizers.html</loc>"), "タイトル・見出し、検索に載せる(サイトマップ・noindex なし)");
  ok($('script[type="application/ld+json"]').map((_, s) => JSON.parse($(s).text())).get().flat().some((x) => x["@type"] === "BreadcrumbList"), "パンくずの構造化データ");
  const internal = $("main a[href^='/']").map((_, a) => $(a).attr("href").split("#")[0]).get();
  const fileOf = (h) => join(OUT, decodeURIComponent(h.endsWith("/") ? h + "index.html" : h));
  ok(internal.length >= 10 && internal.every((h) => existsSync(fileOf(h))), "サイト内のリンクが、すべて実在するページにつながる", internal.filter((h) => !existsSync(fileOf(h))).join(", "));

  // 「掲載すると、ここに載ります」に書いたことが、実際にある
  const ev = cheerio.load(read(join(OUT, "events/t-full.html")));
  const evLd = ev('script[type="application/ld+json"]').map((_, s) => JSON.parse(ev(s).text())).get().flat();
  ok(text.includes("カレンダーへの登録") && ev('main a[href^="https://calendar.google.com/calendar/render?action=TEMPLATE"]').length === 1, "「カレンダーへの登録」: 開催ページに、Googleカレンダーに追加するボタンがある");
  ok(text.includes("経路の検索") && ev('.keyinfo a[href*="google.com/maps"]').length === 1, "「地図・経路の検索」: 開催ページの会場の欄に、Googleマップへのリンクがある");
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
  // 見せ方(2026-10-31 運営者の判断): 送り方ごとのボタン・アイコン・スマホの固定の申し込みボタン
  section("主催者の方へ: 送り方ごとのボタンと、スマホの固定の申し込みボタン");
  ok($(".oway").map((_, w) => $(w).find(".oway-go a.btn").attr("href")).get().join() === "/submit.html,/contact.html,/contact.html" && $(".ofix .oway-go a.btn[href='/contact.html']").length === 1, "送り方ごとに行き先のボタン(フォーム・お問い合わせ)を置き、訂正・削除にも依頼のボタンを置く");
  ok($(".opoints li").get().every((li) => $(li).find("svg.ic[aria-hidden=true]").length === 1) && $(".ocards li").get().every((li) => $(li).find("svg.ic[aria-hidden=true]").length === 1), "要点と載る場所のカードに、読み上げない飾りのアイコンを付ける");
  const css = read("scripts/style.css");
  ok($(".octa-bar[hidden] a.btn[href='/submit.html']").length === 1 && $("script").filter((_, x) => $(x).html().includes(".octa-bar")).length === 1 && /@media\(min-width:641px\)\{\.octa-bar\{display:none!important\}\}/.test(css), "固定の申し込みボタンは、最初は隠し、スクリプトが出し入れする(PCでは出さない)");
  {
    const dom = new JSDOM(read(join(OUT, "organizers.html")).replace(/<script[\s\S]*?<\/script>/g, ""), { runScripts: "outside-only", pretendToBeVisual: true });
    const w = dom.window, d = w.document, bar = d.querySelector(".octa-bar");
    if (!bar) { ok(false, "固定の申し込みボタン: 冒頭のボタンが見える間は出さず、読み進めると出し、最後のボタンが見えたら(フッターでも)隠す"); w.close(); } else {
    const pos = { top: 600, end: 4000 };
    d.querySelector(".octa").getBoundingClientRect = () => ({ top: pos.top, bottom: pos.top + 50 });
    d.querySelector(".cta-end").getBoundingClientRect = () => ({ top: pos.end, bottom: pos.end + 50 });
    w.eval(read("scripts/client/organizers.js"));
    const at = async (top, end) => { pos.top = top; pos.end = end; w.dispatchEvent(new w.Event("scroll")); await new Promise((r) => w.requestAnimationFrame(r)); return bar.hidden; };
    const states = [await at(600, 4000), await at(-800, 2600), await at(-3000, 300), await at(-3600, -200)];
    ok(states.join() === "true,false,true,true", "固定の申し込みボタン: 冒頭のボタンが見える間は出さず、読み進めると出し、最後のボタンが見えたら(フッターでも)隠す", states.join());
    w.close();
    }
  }

  // 掲載の依頼フォーム: 短い欄を2列に。入力中は、欄を離れたときに誤りを知らせ、直すとすぐ消す(お問い合わせと共通)
  section("掲載の依頼フォーム: 2列の欄と、入力中のチェック");
  ok(sf(".f-row").map((_, r) => sf(r).find("input,select").map((_, x) => sf(x).attr("id")).get().join("+")).get().join() === "prefecture+city,date+time_start" && /@media\(min-width:561px\)\{\.f-row\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/.test(css), "PCでは、都道府県と市区町村、開催日と開始時刻を2列に並べる(スマホは1列)");
  {
    const html = read(join(OUT, "submit.html"));
    const script = cheerio.load(html)("script").filter((_, x) => cheerio.load(html)(x).html().includes("form[data-form]")).html();
    const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/g, ""), { runScripts: "outside-only", pretendToBeVisual: true });
    const w = dom.window, d = w.document, $f = (id) => d.getElementById(id), msg = (id) => $f(id + "-e").textContent;
    w.eval(script);
    const leave = (id) => $f(id).dispatchEvent(new w.FocusEvent("focusout", { bubbles: true }));
    leave("name");
    ok(msg("name") === "入力してください" && $f("name").getAttribute("aria-invalid") === "true", "必須の欄を空のまま離れると、その場で「入力してください」と出す");
    $f("name").value = "〇〇神楽まつり"; $f("name").dispatchEvent(new w.Event("input", { bubbles: true }));
    ok(msg("name") === "" && $f("name").getAttribute("aria-invalid") === "false", "入力して直すと、すぐに誤りの表示を消す");
    $f("url").value = "http://example.com"; leave("url"); $f("email").value = "abc"; leave("email");
    ok(msg("url") === "https:// で始まるURLを入力してください" && msg("email") === "メールアドレスの形式を確認してください", "URL・メールアドレスの形式の誤りも、欄を離れたときに知らせる(文言は送信時と同じ)");
    leave("time_start");
    ok(msg("time_start") === "", "任意の欄は、空のまま離れても誤りにしない");
    $f("time_start").value = "18:00"; $f("time_end").value = "17:00"; leave("time_end");
    ok(msg("time_end") === "終了時刻は、開始時刻より後にしてください", "終了時刻が開始時刻より前なら知らせる");
    $f("time_start").value = "16:00"; $f("time_start").dispatchEvent(new w.Event("change", { bubbles: true }));
    ok(msg("time_end") === "", "開始時刻を直すと、終了時刻の誤りも消える");
    const later = Date.now() + 10000; w.Date.now = () => later; // 3秒未満の送信はボットとみなすため、時計を進める
    d.getElementById("submit-form").dispatchEvent(new w.Event("submit", { cancelable: true }));
    ok(d.activeElement?.id === "kagura" && msg("agree") === "同意が必要です" && d.getElementById("status").textContent === "入力内容をご確認ください。", "送信時は、すべての欄を確かめ、最初の誤りの欄へ移る");
    w.close();
  }

  // 入口
  const home = cheerio.load(read(join(OUT, "index.html")));
  ok(home('footer a[href="/organizers.html"]').length === 1 && sf('main .prose a[href="/organizers.html"]').length === 1 && sf('main .crumbs a[href="/organizers.html"]').length === 1, "フッターと、投稿フォームのページから、リンクしている");
}
