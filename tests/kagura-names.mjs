// 神楽の呼び名の扱い(2026-11-26 神楽の関係者からの指摘を受けて決めたこと)
//  - 「広島神楽」「安芸高田神楽」を種類として扱わない。古い URL は、新しいページへ案内する(検索には載せない)
//  - 系統を確かめられていない開催は「広島県の神楽」。種類のページは作らず、リンクは県のページへ。開催のページでは「(系統は未確認)」と書く
//  - 種類のページの冒頭に、呼び名が何を指すか(naming)。追加の欄(sections)。解説の確認日と、指摘の窓口
//  - 県のページに、県内の神楽の分け方(誰の分け方かを書く)。解説の編集方針と訂正の記録のページ
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as cheerio from "cheerio";

const read = (p) => readFileSync(p, "utf8");
const json = (p) => JSON.parse(read(p).replace(/^﻿/, ""));

export function kaguraNamesTests({ ok, section, build }) {
  section("神楽の呼び名: データ");
  const names = json("data/kagura-names.json"), info = json("data/kagura-info.json"), infoEn = json("data/kagura-info-en.json"), prefInfo = json("data/pref-info.json");
  const all = [...json("data/events.json"), ...json("data/regular.json")];
  const gone = names.moved.map((m) => m.from);
  ok(gone.length >= 2 && gone.every((k) => !(k in info) && !(k in infoEn) && !all.some((x) => x.kagura === k)), "やめた種類の名前(moved)は、解説にも開催にも残っていない", gone.filter((k) => k in info || all.some((x) => x.kagura === k)).join());
  ok(Object.entries(names.prefOnly).every(([k, v]) => !(k in info) && /[都道府県]$/.test(v.prefecture) && v.note && all.filter((x) => x.kagura === k).every((x) => x.prefecture === v.prefecture)), "県単位の呼び名(prefOnly)は、解説を持たず、その県の開催にだけ使う");
  ok(json("data/sources.json").every((s) => !gone.includes(s.kagura)) && !(json("config.json").social?.pauseKinds ?? []).some((k) => gone.includes(k)), "収集元の既定の種類と、X の一時停止の設定にも、やめた名前を残さない");
  const hiroshimaKinds = Object.entries(info).filter(([, v]) => (v.tagline ?? "").startsWith("広島県"));
  ok(hiroshimaKinds.length >= 2 && hiroshimaKinds.every(([k, v]) => v.naming?.includes(`「${k}」`) && /^\d{4}-\d{2}-\d{2}$/.test(v.checked ?? "") && v.refs?.every((r) => !/wikipedia/.test(r.url) && new URL(r.url).pathname.length > 1)), "広島県の種類の解説: 呼び名の説明と確認日があり、参考は個別のページ(Wikipedia・トップページだけのリンクは使わない)");
  const groups = prefInfo["広島県"]?.groups ?? [];
  ok(groups.length === 5 && prefInfo["広島県"].groupsLead.includes("観光連盟") && groups.filter((g) => g.kind).every((g) => g.kind in info) && prefInfo["広島県"].en?.groups?.length === 5, "広島県の神楽の分け方: 5つの分け方と、誰の分け方か(観光連盟)を書く。英語の訳もそろえる");
  ok(!/「八調子」とも呼ばれ、速い囃子/.test(JSON.stringify(info)) && !JSON.stringify(info["芸北神楽"]).includes("鍾馗"), "「旧舞は八調子」の記述を残さない。県の指定名は「鐘馗」と書く");

  section("神楽の呼び名: ページ");
  const dir = mkdtempSync(join(tmpdir(), "kagura-names-")), out = "dist-test-kagura-names";
  try {
    const base = json("tests/fixtures/events.test.json");
    const mk = (id, kagura, extra = {}) => ({ id, name: `テスト公演 ${id}`, kagura, prefecture: "広島県", city: "広島市中区", venue: "テストホール", start: "2026-11-21T13:00", url: "https://example.com/", description: "テストの公演です。", source: "テスト", checked: "2026-10-01", status: "published", ...extra });
    const evFile = join(dir, "events.json");
    writeFileSync(evFile, JSON.stringify([...base, mk("t-unk", "広島県の神楽"), mk("t-mixed", "広島県の神楽", { kaguraNote: "複数の系統の団体が出演", start: "2026-11-22T13:00" }), mk("t-juni", "十二神祇神楽", { start: "2026-11-23T13:00" })]));
    const r = build(evFile, out);
    ok(r.status === 0, "ビルドが通る", (r.stderr ?? "").slice(0, 300));
    const page = (p) => cheerio.load(read(join(out, p)));
    const prefPath = `/pref/${encodeURIComponent("広島県")}.html`;

    // 県単位の呼び名
    ok(!existsSync(join(out, "kagura", "広島県の神楽.html")) && !page("kagura/index.html")("main").text().includes("広島県の神楽"), "「広島県の神楽」の種類のページは作らず、種類の一覧にも並べない");
    const $u = page("events/t-unk.html"), $m = page("events/t-mixed.html");
    ok($u(".hero a.tag.gold").text() === "広島県の神楽(系統は未確認)" && $u(".hero a.tag.gold").attr("href") === prefPath, "系統を確かめられていない開催のページ: 札は「広島県の神楽(系統は未確認)」、リンクは県のページ", $u(".hero a.tag.gold").text());
    ok($m(".hero a.tag.gold").text() === "広島県の神楽(複数の系統の団体が出演)", "複数の系統が出る公演は、kaguraNote の言い方にする", $m(".hero a.tag.gold").text());
    const $p = page("pref/広島県.html");
    ok($p(".card a.tag.gold").filter((_, a) => $p(a).text() === "広島県の神楽").length >= 2 && !$p(`a[href="/kagura/${encodeURIComponent("広島県の神楽")}.html"]`).length, "一覧のカードの札は短く「広島県の神楽」(存在しない種類のページへはリンクしない)");

    // やめた種類のページ
    const sitemap = read(join(out, "sitemap.xml"));
    for (const m of names.moved) {
      const $s = page(`kagura/${m.from}.html`), refresh = $s('meta[http-equiv="refresh"]').attr("content") ?? "";
      const want = m.to.kagura ? `/kagura/${encodeURIComponent(m.to.kagura)}.html` : `/pref/${encodeURIComponent(m.to.prefecture)}.html`;
      ok(refresh === `0;url=${want}${m.to.hash ? `#${m.to.hash}` : ""}` && /noindex/.test($s('meta[name="robots"]').attr("content")) && $s(`main a.btn[href^="${want}"]`).length === 1 && !sitemap.includes(encodeURIComponent(m.from)), `「${m.from}」の古い URL: 新しいページへ案内し、検索とサイトマップには載せない`, refresh);
      const target = page(want.slice(1).split("/").map(decodeURIComponent).join("/"));
      ok(!m.to.hash || target(`#${m.to.hash}`).length === 1, `「${m.from}」の移り先に、案内先の見出し(#${m.to.hash})がある`);
      const $e = page(`en/kagura/${m.en.slug}.html`), er = ($e('meta[http-equiv="refresh"]').attr("content") ?? "").replace("0;url=", "");
      ok(er === m.en.to && /noindex/.test($e('meta[name="robots"]').attr("content")) && $e("html").attr("lang") === "en" && page(er.split("#")[0].slice(1))(`#${er.split("#")[1]}`).length === 1, `英語版の「${m.en.name}」の古い URL も、新しいページの該当の見出しへ案内する`, er);
    }

    // 種類のページ
    const $g = page("kagura/芸北神楽.html"), about = $g("#k-about").parent();
    ok(about.children("p.naming").length === 1 && about.children("p.naming").next("p").text().startsWith(info["芸北神楽"].intro.slice(0, 12)), "種類のページの冒頭: 「〇〇とは」のすぐ下に、呼び名が何を指すか。その次に概要");
    const folds = $g(".kagura-folds > details").map((_, d) => $g(d).attr("id")).get();
    ok(folds.join() === `k-history,k-features,k-programs,k-viewing,${info["芸北神楽"].sections.map((x) => `k-${x.id}`).join()},k-schedule` && $g("#k-akitakata summary h2").text() === "安芸高田市の神楽" && !$g("#k-akitakata").attr("open"), "追加の欄(安芸高田市の神楽)は、観賞のコツの後、開催予定の前に、同じ折り畳みで並べる", folds.join());
    const note = $g("p.info-note");
    ok(note.text().includes("解説の確認日: 2026年11月26日") && note.find('a[href="/editorial-policy.html"]').length === 1 && note.find('a[href="/contact.html"]').length === 1, "解説のある種類のページ: 確認日と、編集方針・指摘の窓口へのリンク", note.text());
    ok($g("title").text().startsWith("芸北神楽とは｜") && page("kagura/十二神祇神楽.html")("p.naming").text().includes("安芸十二神祇"), "十二神祇神楽のページ: 県の資料での別の書き方(安芸十二神祇)を、冒頭で断る");
    const idx = page("kagura/index.html");
    ok(!/流派|系統ごと/.test(idx("title").text() + idx("main").text()) && idx(".kind-index-note").length === 1 && !page("index.html")("main").text().includes("流派・系統"), "種類の一覧: 「流派・系統」と呼ばず、名前の性格がそろっていないことを冒頭で断る");

    // 県のページの分け方
    const g = $p("#pref-groups");
    ok(g.find("dl > div").length === 5 && g.find(`dt a[href="/kagura/${encodeURIComponent("芸北神楽")}.html"]`).length === 1 && g.find("dt").filter((_, d) => $p(d).text().startsWith("比婆荒神神楽")).find("a").length === 0, "広島県のページ: 5つの分け方を並べ、種類のページがあるものだけリンクにする");
    ok(g.text().includes("広島県観光連盟") && g.text().includes("系統は未確認") && g.find("small.alias").text().includes("安芸十二神祇") && g.find('a[href="/editorial-policy.html"]').length === 1 && $p(`a.textlink[href="#pref-groups"]`).length === 1, "広島県のページ: 誰の分け方か、未確認の扱い、別の書き方を書き、冒頭から分け方の欄へたどれる");
    ok(!$p("title").text().includes("広島神楽") && $p("h1").text().trim() === "広島県の神楽", "広島県のページの題に「広島神楽」と書かない", $p("title").text());

    // 編集方針と訂正の記録
    const $e = page("editorial-policy.html");
    const corr = json("data/corrections.json");
    ok($e("h1").text().trim() === "解説の編集方針" && $e("#corrections").length === 1 && $e(".corrections > div").length === corr.length && corr.every((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.date) && c.text) && $e('a[href="/contact.html"]').length >= 1, "解説の編集方針のページ: 資料の基準・指摘の窓口と、訂正の記録");
    ok(page("about.html")('a[href="/editorial-policy.html"]').length === 1 && sitemap.includes("/editorial-policy.html"), "運営者情報から編集方針へたどれ、サイトマップに載せる");

    // 英語版
    const $ek = page("en/kagura.html"), $eg = page("en/kagura/geihoku-kagura.html");
    ok($ek("#hiroshima").length === 1 && $ek("#hiroshima").nextAll("div,table").first().find("tbody tr").length === 5 && $ek(`a[href="/en/kagura/geihoku-kagura.html"]`).length >= 1, "英語版の種類の一覧: 広島県の神楽の5つの分け方を載せる");
    ok($eg("#akitakata").length === 1 && $eg("#about").next("p").text().startsWith("'Geihoku Kagura' is a name"), "英語版の芸北神楽のページ: 呼び名の説明と、安芸高田市の神楽の欄");
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
}
