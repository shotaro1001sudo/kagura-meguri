// 団体ページ(有料のプラン)・PR枠・申し込みフォーム・特定商取引法に基づく表記のテスト(MON-1)
// いちばん大事なこと: 団体ページの有無で、開催情報の掲載・並び順が変わらない。PR枠には「PR」と表示する
import { readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { validatePartners, plansOf } from "../scripts/lib/partners.mjs";

const read = (p) => readFileSync(p, "utf8");

export function partnersTests({ ok, section, OUT, build }) {
  section("団体ページ・PR枠(有料のプラン)");
  const cfg = JSON.parse(read("config.json"));
  const plans = plansOf(cfg);
  ok(plans.map((p) => `${p.id}:${p.monthly}`).join(",") === "page:3000,page_pr:8000" && plans.filter((p) => p.prSlot).map((p) => p.id).join() === "page_pr", "プランは 団体ページ 月3,000円 / 団体ページ+PR枠 月8,000円(PR枠は後者だけ)");

  const P = "dist-test-partners";
  const r = build("tests/fixtures/events.test.json", P, { PARTNERS_FILE: "tests/fixtures/partners.test.json" });
  ok(r.status === 0, "団体のデータがあってもビルドできる", r.stderr);
  if (r.status !== 0) return;

  // 中立: 開催情報の並び(カードのリンクの順)が、団体のデータの有無で変わらない
  const cardOrder = (dir, f) => { const $ = cheerio.load(read(join(dir, f))); return $("main a[href^='/events/'], main a[href^='/regular/']").map((_, a) => $(a).attr("href")).get().join(","); };
  for (const f of ["pref/島根県.html", "kagura/石見神楽.html", "index.html"]) ok(cardOrder(OUT, f) && cardOrder(OUT, f) === cardOrder(P, f), `団体のデータの有無で、開催情報の並びが変わらない(${f})`);

  // PR枠: 「PR」の表示、PR枠つきのプランで、掲載期間の中の団体だけ。開催情報の一覧より後ろ
  for (const f of ["pref/島根県.html", "kagura/石見神楽.html"]) {
    const html = read(join(P, f)), $ = cheerio.load(html), slot = $(".pr-slot");
    const names = slot.find("li a").map((_, a) => $(a).text()).get();
    ok(slot.length === 1 && slot.find(".pr").text() === "PR" && slot.attr("aria-label").startsWith("PR"), `PR枠に「PR」と表示する(${f})`);
    ok(names.join() === "テスト神楽社中A", `PR枠は、PR枠つきのプランで掲載期間の中の団体だけ(${f})`, names.join());
    const lastCard = Math.max(html.lastIndexOf('href="/events/'), html.lastIndexOf('href="/regular/'));
    ok(html.indexOf('class="pr-slot"') > lastCard, `PR枠は、開催情報の一覧より後ろに出す(${f})`);
  }
  ok(cheerio.load(read(join(P, "pref/広島県.html")))(".pr-slot").length === 0, "ほかの県のページには、PR枠を出さない");

  // 団体ページ
  ok(existsSync(join(P, "partner/iwami-a.html")) && existsSync(join(P, "partner/iwami-b.html")) && !existsSync(join(P, "partner/expired.html")) && !existsSync(join(P, "partner/future.html")), "団体ページは、掲載期間の中の団体だけ作る");
  const a = cheerio.load(read(join(P, "partner/iwami-a.html")));
  ok(a("title").text().includes("【PR】") && a(".pr-note .pr").text() === "PR" && a(".pr-note").text().includes("掲載料をいただいて"), "団体ページの題と冒頭に、PR であることを書く");
  const ext = a("main a[href^='http']");
  ok(ext.length === 2 && ext.toArray().every((x) => /\bsponsored\b/.test(a(x).attr("rel"))), "団体ページから外へのリンクには、rel=sponsored を付ける", String(ext.length));
  ok(a(".partner-reps dt").text() === "大蛇" && a("main a").filter((_, x) => decodeURIComponent(a(x).attr("href")) === "/pref/島根県.html").length >= 1, "演目の紹介と、県のページへのリンクがある");
  const sm = read(join(P, "sitemap.xml"));
  ok(sm.includes("/partner/iwami-a.html</loc>") && !sm.includes("/partner/expired.html") && !sm.includes("/partner/sample.html"), "サイトマップ: 掲載中の団体ページは入れ、見本・期限切れは入れない");
  rmSync(P, { recursive: true, force: true });

  // 見本・申し込み・特商法(通常のビルド)
  const s = cheerio.load(read(join(OUT, "partner/sample.html")));
  ok(/noindex/.test(s('meta[name="robots"]').attr("content") ?? "") && s(".pr-note").text().includes("見本") && s("main a[href^='http']").length === 0, "見本のページは noindex・見本と明記・外へのリンクなし");
  const ap = cheerio.load(read(join(OUT, "apply.html")));
  const opts = ap("#plan option").map((_, o) => ap(o).text()).get().slice(1);
  ok(opts.join("|") === "団体ページ(月額3,000円(税込))|団体ページ+PR枠(月額8,000円(税込))", "申し込みフォームのプランの選択肢が、設定の料金と一致する", opts.join("|"));
  ok(ap("form[data-form=apply]").length === 1 && ["group", "prefecture", "kagura", "sender", "email", "rights", "agree"].every((id) => ap(`#${id}[required]`).length === 1) && ap("#tel[required]").length === 0, "申し込みフォーム: 必須の欄(団体名・県・種類・お名前・メール・権利の確認・同意)。電話は任意");
  ok(ap("main").text().includes("並び順") && ap("main").text().includes("銀行振込") && ap('main a[href="/tokushoho.html"]').length === 1 && ap('main a[href="/partner/sample.html"]').length === 1, "申し込みのページに、中立の方針・支払い方法・特商法の表記・見本へのリンク");
  ok(ap("script").text().includes("団体ページの申し込み: "), "申し込みの送信の件名が「団体ページの申し込み」になる");
  const tt = cheerio.load(read(join(OUT, "tokushoho.html")))("main").text();
  ok(tt.includes(cfg.operator.name) && tt.includes("請求があった場合には、遅滞なく開示します") && tt.includes("月額3,000円(税込)") && tt.includes("月額8,000円(税込)") && tt.includes("銀行振込"), "特定商取引法に基づく表記: 販売事業者・開示の方法・価格・支払い方法");
  ok(cheerio.load(read(join(OUT, "index.html")))('footer a[href="/tokushoho.html"]').length === 1, "フッターから、特定商取引法に基づく表記へリンクする");
  const sp = cheerio.load(read(join(OUT, "sponsor.html")));
  ok(sp('main a[href="/apply.html"]').length === 1 && sp("main").text().includes("月額3,000円(税込)"), "広告・協賛についてのページから、団体ページの申し込みへ案内する");
  ok(read(join(OUT, "privacy.html")).includes("団体ページのお申し込みフォーム"), "プライバシーポリシーに、申し込みで預かる情報を書く");

  // データの確かめ: 了解のない団体・形の崩れた URL・ない写真は、ビルドを止める
  const base = { id: "x-dan", name: "X", plan: "page", prefecture: "島根県", kagura: "石見神楽", start: "2026-10-01", end: "2026-10-31", consent: true, intro: "紹介" };
  ok(validatePartners([base], { plans }).length === 0, "正しいデータは通る");
  ok(validatePartners([{ ...base, consent: false }], { plans }).length === 1, "団体の了解(consent)がないと止める");
  ok(validatePartners([{ ...base, plan: "gold" }], { plans }).length === 1, "ないプランは止める");
  ok(validatePartners([{ ...base, links: [{ url: "javascript:alert(1)", label: "x" }] }], { plans }).length === 1, "https 以外のリンクは止める");
  ok(validatePartners([{ ...base, photos: [{ src: "/partners/x-dan/none.jpg", alt: "a", credit: "b" }] }], { plans }).length === 1, "写真のファイルがないと止める");
  ok(validatePartners([{ ...base, end: "2026-09-01" }], { plans }).length === 1, "終わりが始まりより前なら止める");
}
