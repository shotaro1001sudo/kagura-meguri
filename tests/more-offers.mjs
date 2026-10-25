// 本・グッズ(learn)とふるさと納税(furusato)の紹介: 承認・期限・リンク形式の検査と、表示(外部へは送らない)
import * as cheerio from "cheerio";
import { readFileSync } from "node:fs";
import { validMoreOffer, moreOffersFor, learnBlock, furusatoBlock } from "../scripts/lib/more-offers.mjs";

export function moreOffersTests({ ok, section }) {
  section("本・グッズ・ふるさと納税の紹介(本人発行のリンクだけ)");
  const today = "2026-10-25";
  const base = { enabled: true, approved: true, verifiedAt: "2026-10-25", expiresAt: "2026-11-24", approvalReference: "テスト", note: "目次で演目を確認" };
  const book = { ...base, id: "iwami-book", category: "learn", provider: "rakuten-books", kagura: "石見神楽", title: "石見神楽の本", url: "https://hb.afl.rakuten.co.jp/hgc/test.books/?pc=https%3A%2F%2Fbooks.rakuten.co.jp%2Frb%2F1%2F" };
  const general = { ...base, id: "kagura-dvd", category: "learn", provider: "rakuten-ichiba", kagura: "*", title: "神楽のDVD", url: "https://hb.afl.rakuten.co.jp/ichiba/test.ichiba/?pc=https%3A%2F%2Fitem.rakuten.co.jp%2Fshop%2Fdvd%2F" };
  const furusato = { ...base, id: "kitahiroshima-mask", category: "furusato", provider: "rakuten-furusato", prefecture: "広島県", city: "山県郡北広島町", title: "神楽面の返礼品", url: "https://hb.afl.rakuten.co.jp/hgc/test.furusato/?pc=https%3A%2F%2Fitem.rakuten.co.jp%2Ff343692-kitahiroshima%2Fx%2F" };
  const settings = { categories: { learn: { enabled: true }, furusato: { enabled: true } }, offers: [general, book, furusato] };
  ok([book, general, furusato].every((o) => validMoreOffer(o, today)), "発行済みの形式・承認・期限がそろったものを認める");
  ok(!validMoreOffer({ ...book, approved: false }, today) && !validMoreOffer({ ...book, expiresAt: "2026-10-24" }, today) && !validMoreOffer({ ...book, verifiedAt: "2026-07-01", expiresAt: "2026-12-31" }, today), "未承認・期限切れ・確認から90日超は出さない");
  ok(!validMoreOffer({ ...book, url: book.url.replace("books.rakuten.co.jp", "example.com") }, today) && !validMoreOffer({ ...book, url: "https://example.com/hgc/x/?pc=https%3A%2F%2Fbooks.rakuten.co.jp%2F" }, today) && !validMoreOffer({ ...book, url: "http://hb.afl.rakuten.co.jp/hgc/x/?pc=https%3A%2F%2Fbooks.rakuten.co.jp%2F" }, today), "楽天の発行形式以外・行き先の不一致・HTTPのリンクは出さない");
  ok(!validMoreOffer({ ...book, provider: "rakuten-furusato" }, today) && !validMoreOffer({ ...furusato, city: "" }, today) && !validMoreOffer({ ...book, kagura: "" }, today), "提供元とカテゴリの取り違え・地域や種類の抜けは出さない");
  ok(moreOffersFor(settings, "learn", { kagura: "石見神楽" }, today).map((o) => o.id).join() === "iwami-book,kagura-dvd" && moreOffersFor(settings, "learn", { kagura: "広島神楽" }, today).map((o) => o.id).join() === "kagura-dvd", "種類に合うものを先に、全般向け(*)を後に出す");
  ok(moreOffersFor(settings, "furusato", { prefecture: "広島県" }, today).length === 1 && moreOffersFor(settings, "furusato", { prefecture: "島根県" }, today).length === 0, "ふるさと納税は、その県のページだけ");
  const off = cheerio.load(learnBlock({ ...settings, categories: { learn: { enabled: false } } }, { kagura: "石見神楽" }, today, "kagura_learn"));
  ok(off("a[rel~=sponsored]").length === 0 && off("a.search-link").attr("href") === "https://books.rakuten.co.jp/search?sitem=" + encodeURIComponent("石見神楽") && off(".annotation").text().includes("広告ではありません") && off(".pr").length === 0, "発行リンクがないときは、楽天ブックスの検索(広告ではない・PRなし)で案内する");
  const ff = cheerio.load(furusatoBlock({ categories: {}, offers: [] }, { prefecture: "広島県", towns: ["山県郡北広島町", "安芸高田市", "山県郡北広島町"] }, today, "pref_furusato"));
  ok(ff("a.search-link").length === 2 && ff("a.search-link").first().text() === "北広島町のふるさと納税を見る" && ff("a[rel~=sponsored]").length === 0, "ふるさと納税も、発行リンクがないときは町ごとの検索(重複なし・郡名なし)");
  ok(furusatoBlock({ categories: {}, offers: [] }, { prefecture: "広島県", towns: [] }, today, "pref_furusato") === "", "町が分からないときは、ふるさと納税の枠を出さない");
  const side = cheerio.load(learnBlock(settings, { kagura: "石見神楽" }, today, "event_learn", { side: true }));
  ok(side("aside.side-box h2").text() === "石見神楽をもっと楽しむ" && side("a[data-affiliate-placement=event_learn]").length === 2, "右の列用の小さな枠でも、同じ広告を出す");
  const $ = cheerio.load(learnBlock(settings, { kagura: "石見神楽" }, today, "kagura_learn"));
  const a = $("a");
  ok($("h2").text() === "石見神楽をもっと楽しむ" && a.length === 2 && a.first().attr("href") === book.url && a.toArray().every((x) => /sponsored/.test($(x).attr("rel")) && $(x).attr("data-affiliate-placement") === "kagura_learn") && $(".pr").length === 3, "本の紹介: 発行URLのまま、sponsored と PR 表示・計測の印つき");
  const f = cheerio.load(furusatoBlock(settings, { prefecture: "広島県", towns: ["山県郡北広島町"] }, today, "pref_furusato"));
  ok(f("h2").text() === "神楽の町を応援する" && f("a").attr("data-affiliate-category") === "furusato" && f("small").text().includes("北広島町") && f(".annotation").text().includes("寄付"), "ふるさと納税: 町の名前と、広告であることを示す");
  const esc = cheerio.load(learnBlock({ ...settings, offers: [{ ...book, title: "<img src=x onerror=alert(1)>" }] }, { kagura: "石見神楽" }, today, "kagura_learn"));
  ok(esc("img").length === 0, "タイトルなどは、エスケープする");
  const data = JSON.parse(readFileSync("data/more-offers.json", "utf8"));
  ok(data.offers.every((o) => validMoreOffer(o, today) || o.enabled !== true), "本番データ: 有効にしたものは、検査に通る");
  const js = readFileSync("scripts/client/affiliate.js", "utf8");
  ok(["'learn'", "'furusato'", "'rakuten-books'", "'rakuten-furusato'", "'kagura_learn'", "'history_learn'", "'pref_furusato'", "'event_learn'", "'event_furusato'", "'regular_learn'", "'regular_furusato'", "'kagura_furusato'"].every((x) => js.split(x).length === 3), "GA4: クリックと表示の両方で、新しい広告を数える");
}
