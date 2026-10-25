// 本・グッズ(learn)とふるさと納税(furusato)の紹介: 承認・期限・リンク形式の検査と、表示(外部へは送らない)
import * as cheerio from "cheerio";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { reconcile } from "../scripts/lib/collect-core.mjs";
import { createMoreOfferIndex, validMoreOffer, moreOffersFor, learnBlock, furusatoBlock } from "../scripts/lib/more-offers.mjs";

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
  ok(moreOffersFor(settings, "furusato", { prefecture: "広島県", city: "安芸高田市" }, today).length === 0, "同じ県でも別の開催市町村の返礼品は出さない");
  ok(moreOffersFor(settings, "furusato", { prefecture: "広島県", city: "北広島町" }, today).length === 1, "郡名の有無を正規化して開催市町村を照合する");
  ok(moreOffersFor(settings, "furusato", { prefecture: "広島県", city: "" }, today).length === 0, "個別公演の市町村不明時は県だけで返礼品を選ばない");
  const mismatch = cheerio.load(furusatoBlock(settings, { prefecture: "広島県", city: "安芸高田市", towns: ["安芸高田市"] }, today, "event_furusato"));
  ok(mismatch("a").length === 0 && mismatch("section,aside").length === 0, "不一致の返礼品は枠ごと省略し、通常検索へ代替しない");
  const off = cheerio.load(learnBlock({ ...settings, categories: { learn: { enabled: false } } }, { kagura: "石見神楽" }, today, "kagura_learn"));
  ok(off("a,aside,section").length === 0, "未発行の本の枠を省略する");
  const ff = cheerio.load(furusatoBlock({ categories: {}, offers: [] }, { prefecture: "広島県", towns: ["山県郡北広島町", "安芸高田市", "山県郡北広島町"] }, today, "pref_furusato"));
  ok(ff("a,aside,section").length === 0, "未発行のふるさと納税は通常検索を出さない");
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
  const img = "https://hbb.afl.rakuten.co.jp/hgb/test.books/?me_id=1&item_id=2&pc=https%3A%2F%2Fthumbnail.image.rakuten.co.jp%2Fx.jpg";
  ok(validMoreOffer({ ...book, imageUrl: img }, today) && !validMoreOffer({ ...book, imageUrl: img.replace("test.books", "other.id") }, today) && !validMoreOffer({ ...book, imageUrl: "https://example.com/x.jpg" }, today), "商品画像は、同じ発行コードの画像URLだけを認める");
  const withImg = cheerio.load(learnBlock({ ...settings, offers: [{ ...book, imageUrl: img }] }, { kagura: "石見神楽" }, today, "kagura_learn"));
  ok(withImg(".pick.has-img a img").attr("src") === img && withImg(".pick.has-img a img").attr("alt") === "" && withImg(".pick.has-img a span").text() === book.title, "画像つきの紹介: 画像と題名が1つのリンク(画像は飾りとして代替テキストなし)");
  const data = JSON.parse(readFileSync("data/more-offers.json", "utf8"));
  ok(data.offers.every((o) => validMoreOffer(o, today) || o.enabled !== true), "本番データ: 有効にしたものは、検査に通る");
  for (const kagura of ["高千穂神楽", "広島神楽", "*", ""]) {
    ok(!moreOffersFor(data, "learn", { kagura }, today).some(o => o.id === "sanin-kagura-photobook"), `山陰写真集を対象外の種類に出さない: ${kagura}`);
  }
  for (const kagura of ["石見神楽", "出雲神楽", "隠岐神楽", "伯耆神楽"]) {
    ok(moreOffersFor(data, "learn", { kagura }, today).some(o => o.id === "sanin-kagura-photobook"), `山陰写真集を掲載対象の種類に出す: ${kagura}`);
  }
  ok(!validMoreOffer({ ...book, kaguras: [] }, today) && !validMoreOffer({ ...book, kaguras: ["*"] }, today), "種類リストの空欄や全般への拡大を認めない");
  const idx=createMoreOfferIndex(settings,today);
  ok(idx.select("furusato",{prefecture:" 広島県　",city:"山県郡 北広島町"})[0]?.url===furusato.url,"表記差を正規化し発行URLを保持");
  ok(!idx.select("furusato",{prefecture:"北海道",city:"北広島町"}).length && !idx.select("furusato",{prefecture:"不明",city:"北広島町"}).length,"同名市町村の県違い・未知地域は非表示");
  ok(!idx.select("learn",{kagura:"未確認神楽"}).length && !idx.select("learn",{kagura:"石見神楽",prefecture:"不明"}).length,"未知種類・地域に全般商品を当てない");
  const ambiguous=createMoreOfferIndex({...settings,offers:[furusato,{...furusato,id:"other-town",city:"別郡北広島町",url:furusato.url+"&x=2"}]},today);
  ok(!ambiguous.select("furusato",{prefecture:"広島県",city:"北広島町"}).length,"同一県で郡が曖昧な省略名は停止");
  for(const override of [{revoked:true},{approvalStatus:"revoked"},{approvalReference:""},{url:""},{expiresAt:"2026-02-30"}]) ok(!validMoreOffer({...book,...override},today),"失効・証跡なし・URLなし・不正日付は停止");
  const dup=createMoreOfferIndex({...settings,offers:[book,book,{...book,id:"duplicate-url"},general]},today);
  ok(dup.select("learn",{kagura:"石見神楽"}).length===2,"ID/URL重複を除く");
  const start=performance.now();let deterministic=true;
  for(let i=0;i<10000;i++) {
    const e={prefecture:i%2?"広島県":"島根県",city:"北広島町",kagura:"石見神楽"};
    deterministic &&= idx.select("furusato",e).length===(i%2?1:0) && idx.select("learn",e).map(o=>o.id).join()==="iwami-book,kagura-dvd";
  }
  ok(deterministic,"1万公演の照合結果が決定的（各カテゴリ最大3件）");
  console.log(`  indexed 10000 events: ${(performance.now()-start).toFixed(1)}ms`);
  const source={id:"synthetic",name:"合成の承認済み収集元",url:"https://example.org/",kagura:"石見神楽",prefecture:"島根県"};
  const candidate={name:"合成神楽公演",prefecture:"島根県",city:"浜田市",venue:"合成会場",kagura:"石見神楽",start:"2026-11-01T18:00",url:"https://example.org/event"};
  const auto=reconcile({events:[],candidates:[candidate,candidate],source,now:new Date("2026-10-25T00:00:00Z")});
  ok(auto.summary.published.length===1,"合成の取得候補は承認検査・重複抑止後に1公演掲載");
  const held=reconcile({events:[],candidates:[candidate],source,now:new Date("2026-10-25T00:00:00Z"),cfg:{autoPublish:false}});
  ok(held.summary.published.length===0,"承認保留の公演を広告追加目的で公開しない");
  const temp=mkdtempSync(join(tmpdir(),"kagura-more-"));
  try {
    writeFileSync(join(temp,"events.json"),JSON.stringify(auto.events));
    writeFileSync(join(temp,"regular.json"),"[]");
    const build=spawnSync("node",["scripts/build.mjs"],{encoding:"utf8",env:{...process.env,EVENTS_FILE:join(temp,"events.json"),REGULAR_FILE:join(temp,"regular.json"),OUT_DIR:join(temp,"out"),BUILD_NOW:"2026-10-25T12:00",TEST_AFF_OFF:"1",TEST_ADS_OFF:"1"}});
    ok(build.status===0,"合成自動公演で実build成功",build.stderr);
    if(build.status===0) {
      const page=cheerio.load(readFileSync(join(temp,"out/events",auto.events[0].id+".html"),"utf8"));
      const indexed=createMoreOfferIndex(data,today);
      for(const category of ["learn","furusato"]) {
        const expected=indexed.select(category,auto.events[0]).map(o=>o.url);
        ok(expected.length>0 && page(`a[data-affiliate-category="${category}"]`).toArray().map(a=>page(a).attr("href")).join()===expected.join(),"自動取得→掲載→buildは同じ"+category+"照合と発行URLを使用");
      }
      ok(page("[data-official-link]").length>0 && page("a.search-link").length===0,"公式公演導線は残し通常検索fallbackは出さない");
    }
  } finally { rmSync(temp,{recursive:true,force:true}); }
  const js = readFileSync("scripts/client/affiliate.js", "utf8");
  ok(["'learn'", "'furusato'", "'rakuten-books'", "'rakuten-furusato'", "'kagura_learn'", "'history_learn'", "'pref_furusato'", "'event_learn'", "'event_furusato'", "'regular_learn'", "'regular_furusato'", "'kagura_furusato'"].every((x) => js.split(x).length === 3), "GA4: クリックと表示の両方で、新しい広告を数える");
}
