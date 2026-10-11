// 編集・言葉づかいの決まりのテスト(編集者・UXライターの目線の点検で決めたこと)
//  - 言葉の統一: 主催者向けは「主催者の方へ」「掲載の依頼」、探し方は「〜で探す」、定期公演は「毎週・毎晩の定期公演」
//  - 開催ページ: 曜日つきの日時、所在地、1日複数回、同じ公演のほかの日程、あわせて観たい神楽(日付順・重複なし)
//  - 検索結果に出る文の文法、データの正確さ(季節だけの公演日)
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { regularOn } from "../scripts/lib/dates.mjs";
import { REGIONS } from "../scripts/lib/util.mjs";

const read = (p) => readFileSync(p, "utf8");

export function editorialTests({ ok, section, OUT, build }) {
  const page = (p, dir = OUT) => cheerio.load(read(join(dir, p)));
  const h2s = ($) => $("main h2:not(.sr)").map((_, h) => $(h).text().trim()).get();

  section("編集: 言葉の統一");
  const home = page("index.html");
  ok(h2s(home).includes("毎週・毎晩の定期公演") && h2s(home).includes("都道府県で探す") && h2s(home).includes("種類で探す") && !home("main").text().includes("いつでも観られる"), "トップ: 「毎週・毎晩の定期公演」「都道府県で探す」「種類で探す」(「いつでも観られる」は言い過ぎなので使わない)", h2s(home).join(","));
  ok(!/カレンダーで探せます/.test(home('meta[name="description"]').attr("content")) && /日付・場所・地図で探せます/.test(home('meta[name="description"]').attr("content")), "トップの説明文に、なくなった「カレンダー」を書かない");
  ok(home(".copy .sub").length === 0 && home(".copy p").length === 1, "トップの見出しの下は「各地で催される神楽の、日取りと舞台を。」の1行だけ(副題は外した)");
  ok(home("footer a").first().text() === "主催者の方へ(掲載は無料)", "フッターの主催者向けの入口は「主催者の方へ(掲載は無料)」");
  const org = page("organizers.html"), sub = page("submit.html");
  ok(org("h1").text() === "主催者の方へ" && org('main a[href="/submit.html"].btn').first().text() === "掲載を依頼する(無料)" && sub("h1").text() === "掲載の依頼" && sub("legend").last().text() === "2. ご依頼者について", "主催者向けの言葉: 「主催者の方へ」「掲載を依頼する」「掲載の依頼」にそろえる");
  const allText = ["index.html", "organizers.html", "submit.html", "contact.html", "guide.html"].map((p) => page(p)("main").text() + page(p)("footer").text()).join("");
  ok(!/開催情報を送る|開催情報を投稿する|開催情報を掲載する\(無料\)|投稿フォーム|投稿された方/.test(allText), "古い言い方(開催情報を送る・投稿する・投稿フォームなど)が残っていない");
  ok(page("map.html")("h1").text() === "地図で探す" && page("kagura/index.html")("h1").text() === "種類で探す" && page("kagura/石見神楽.html")(".crumbs li").eq(1).text() === "種類で探す", "地図・種類のページの名前は、メニューと同じ「地図で探す」「種類で探す」");
  ok(page("weekend.html")("main").text().includes("地図で探す") && !page("weekend.html")("main").text().includes("地図から探す"), "ほかの探し方も「地図で探す」");
  ok(/^開催予定 \d+件$/.test(page("month/2026-11.html")(".hero p").text()) && !page("month/2026-11.html")("main").text().includes("‹"), "月別: 件数は「開催予定 N件」の形。前後の月は「ほかの月」にまとめる", page("month/2026-11.html")(".hero p").text());
  const cardDate = home(".card .date").first().find("small").map((_, x) => home(x).text()).get();
  ok(cardDate.length === 2 && /^\d+月$/.test(cardDate[0]) && /^[日月火水木金土]曜$/.test(cardDate[1]), "一覧の日付: 「10月 / 18 / 日曜」(曜日を日付と紛れない形で)", cardDate.join("/"));

  const rg = page("calendar.html")("#range").text().replace(/\s+/g, "");
  ok(rg === "からまで" && page("calendar.html")("#range label").first().children().first().is("input#from"), "日付の指定は「[日付] から [日付] まで」の並び", rg);

  section("編集: 開催ページ・定期公演ページ");
  const full = page("events/t-full.html");
  ok(full("table.info th").map((_, x) => full(x).text()).get().join() === "日時,会場,所在地,料金", "開催ページの欄名は「日時・会場・所在地・料金」(「場所」と「会場」の紛れをなくす)");
  ok(!full("main").text().includes("移動先") && full(".stay").text().includes("予約サイトで変えられます"), "宿の案内: 「移動先」ではなく「予約サイトで変えられます」");
  ok(full(".stay").text().includes("夜の公演です。"), "夜(17時以降)の公演では、夜の公演であることを書く");
  const src = full("main").text();
  ok(!src.includes("情報の出典:"), "出典の文を短くする(「出典: 〇〇(日付確認)」)");
  const reg = page("regular/r-weekly.html");
  ok(reg(".aff h2").text() === "会場近くの宿" && !reg("main").text().includes("旅支度") && !/🏨|📚/.test(read(join(OUT, "regular/r-weekly.html"))), "定期公演ページの宿の案内も「会場近くの宿」。絵文字は使わない");
  const pf = page("pref/広島県.html");
  ok(/^広島県の宿$/.test(pf(".aff h2").text()), "県のページの宿の案内は「◯◯県の宿」", pf(".aff h2").text());
  const rdesc = reg('meta[name="description"]').attr("content");
  ok(/の定期公演です。公演日時: /.test(rdesc) && !/上演に観られる|に観られる/.test(rdesc), "定期公演の説明文: 文として成り立つ形(「…の定期公演です。公演日時: …」)", rdesc);

  section("編集: 検索結果に出る文");
  const wdesc = page("weekend.html")('meta[name="description"]').attr("content");
  ok(/が観られます。毎日/.test(wdesc), "今週末の説明文: 名前だけの文にしない(「〇〇が観られます。」)", wdesc);
  const tdesc = page("this-month.html")('meta[name="description"]').attr("content");
  ok(/を載せています。|開催情報がないときは/.test(tdesc) && !/公演日。/.test(tdesc), "今月の説明文: 「…の公演日を載せています。」", tdesc);
  ok(!page("pref/広島県.html")('meta[name="description"]').attr("content").includes("これからの開催"), "県の説明文に、古い言い方「これからの開催」を使わない");

  section("編集: 並び・一覧");
  const PREF_ORDER = REGIONS.flatMap(([, ps]) => ps);
  const homePrefs = home("main h2").filter((_, h) => home(h).text() === "都道府県で探す").next(".taglist").find("a").map((_, a) => home(a).text()).get();
  ok(homePrefs.length > 1 && homePrefs.every((p, i) => i === 0 || PREF_ORDER.indexOf(homePrefs[i - 1]) < PREF_ORDER.indexOf(p)), "都道府県は北から南の順", homePrefs.join(","));
  const kq = page("kagura/index.html"), kTag = kq(".card .tagline").map((_, p) => kq(p).text()).get();
  ok(kTag.length > 0 && kTag.length === kq(".card").length && kTag.every((t) => /^[^・]+ ・ .+$/.test(t)) && !kq(".card p.meta").length, "種類の一覧: 地域と特徴を1行で(長い紹介文の切れ端は出さない)", kTag.join(" | "));
  const map = page("map.html");
  const venues = map(".venuelist > li > .vjump").map((_, b) => map(b).text()).get();
  ok(venues.length > 0 && new Set(venues).size === venues.length && map(".venuelist .vitems li").length >= venues.length, "地図の会場の一覧は、会場ごとにまとめる(同じ会場をくり返さない)", venues.join(","));
  const g = page("guide.html");
  ok(g(".gcard p").filter((_, p) => g(p).text().includes("ぶっ返り")).find("a[href^='#src']").length >= 1 || /ぶっ返り[^<]*<sup/.test(read(join(OUT, "guide.html"))), "ガイド: 「ぶっ返り」の一文にも出典を付ける");
  ok(['/calendar.html', '/map.html', '/kagura/'].every((h) => g(`main a.btn[href="${h}"]`).length === 1), "ガイドの最後の「神楽を探す」に、メニューと同じ探し方を並べる");
  const c = page("contact.html");
  ok(c(".prose > p").filter((_, p) => c(p).text().includes("お返事できない") && c(p).find('a[href="/submit.html"]').length).length === 0, "お問い合わせ: お返事の注意と、掲載の依頼の案内は、別の段落");
  ok(org("details.tech summary").text().includes("Web担当の方へ") && org("details.tech").text().includes("schema.org") && !org("main").clone().find("details").remove().end().text().includes("schema.org"), "主催者の方へ: 専門用語は「Web担当の方へ」にまとめる");

  section("編集: 1日2回・くり返しの公演・季節だけの公演日");
  const base = JSON.parse(read("tests/fixtures/events.test.json")).find((e) => e.id === "t-full");
  const mk = (id, start, extra = {}) => ({ ...base, id, start, end: undefined, lat: undefined, lng: undefined, ...extra });
  const evs = [
    mk("s-1", "2026-11-08T11:00", { name: "後楽園 定期公演", venue: "鶴鳴館", kagura: "備中神楽", prefecture: "岡山県", city: "岡山市北区", sessions: ["11:00〜12:00", "13:00〜14:00"] }),
    mk("s-2", "2026-12-13T11:00", { name: "後楽園 定期公演", venue: "鶴鳴館", kagura: "備中神楽", prefecture: "岡山県", city: "岡山市北区" }),
    mk("s-3", "2027-01-10T11:00", { name: "後楽園 定期公演", venue: "鶴鳴館", kagura: "備中神楽", prefecture: "岡山県", city: "岡山市北区" }),
    mk("o-1", "2026-12-20T19:00", { name: "高梁の神楽", venue: "紺屋川", kagura: "備中神楽", prefecture: "岡山県", city: "高梁市", end: "2026-12-21T08:00" }),
    mk("o-2", "2026-11-01T13:00", { name: "倉敷の神楽", venue: "公民館", kagura: "備中神楽", prefecture: "岡山県", city: "倉敷市" }),
  ];
  const F = "tests/.tmp-editorial.json", D = "dist-test-editorial";
  writeFileSync(F, JSON.stringify(evs));
  const r = build(F, D);
  ok(r.status === 0, "くり返しの公演を含むデータで、ビルドできる", r.stderr);
  if (r.status === 0) {
    const s1 = page("events/s-1.html", D), o1 = page("events/o-1.html", D), idx = page("index.html", D), o2 = page("events/o-2.html", D);
    ok(s1("table.info td").first().text() === "2026年11月8日(日) 11:00〜12:00、13:00〜14:00(1日2回)", "1日2回の公演は、2つの時間を書く", s1("table.info td").first().text());
    ok(idx(".card").filter((_, c) => idx(c).text().includes("後楽園")).first().find(".meta").text().includes("11:00〜・13:00〜"), "一覧でも、2つの開始時刻を出す");
    ok(o1("table.info td").first().text() === "2026年12月20日(日) 19:00〜12月21日(月) 08:00", "日をまたぐ公演は、終わりの日付も曜日つきで(同じ年なら年は省く)", o1("table.info td").first().text());
    ok(s1(".dates .chip").map((_, a) => s1(a).text()).get().join() === "12月13日(日),1月10日(日)", "くり返しの公演は、開催ページに、ほかの日程を丸いボタンで出す", s1(".dates").text());
    const kr2 = idx(".card").filter((_, c) => idx(c).text().includes("後楽園"));
    ok(kr2.length >= 2 && kr2.find(".rep").length === kr2.length && idx(".card").filter((_, c) => idx(c).text().includes("倉敷")).find(".rep").length === 0, "くり返しの公演には「定例開催」の印。1回だけの開催には付けない");
    const rel = o2("h2").filter((_, h) => o2(h).text() === "あわせて観たい神楽").next("ol").find("li > span > a").map((_, a) => o2(a).text()).get();
    ok(rel.filter((t) => t === "後楽園 定期公演").length === 1 && rel.length === 2, "あわせて観たい神楽: 同じ公演は1件だけ", rel.join(","));
    const relDates = o2("h2").filter((_, h) => o2(h).text() === "あわせて観たい神楽").next("ol").find(".md").map((_, m) => o2(m).text()).get();
    ok(relDates[0]?.includes("11月8日") && relDates[1]?.includes("12月20日"), "あわせて観たい神楽: 日付順", relDates.join(" | "));
    ok(!s1("h2").filter((_, h) => s1(h).text() === "あわせて観たい神楽").next("ol").text().includes("後楽園 定期公演"), "あわせて観たい神楽に、この公演自身のくり返しは入れない(「ほかの日程」に出す)");
    ok(!page("events/o-2.html", D)(".stay").text().includes("夜の公演") , "昼の公演では、夜の一文を出さない");
  }
  rmSync(F, { force: true }); rmSync(D, { recursive: true, force: true });

  const hamada = { weekdays: [6], extra: [{ weekdays: [5], months: [9, 10, 11] }, { dates: ["05-03", "05-04", "05-05"] }], closedDates: ["10-30"] };
  ok(regularOn(hamada, "2026-10-16") && !regularOn(hamada, "2026-12-18") && regularOn(hamada, "2026-12-19") && regularOn(hamada, "2027-05-04") && !regularOn(hamada, "2026-10-30"), "季節だけの公演日(9〜11月の金曜・5月3〜5日)を数える。休演日は除く");
  const real = JSON.parse(read("data/regular.json")).find((x) => x.id === "hamada-yokagura-shusai");
  ok(real?.extra?.some((x) => x.weekdays?.includes(5) && x.months?.join() === "9,10,11"), "本番データ: 浜田の夜神楽は、9〜11月の金曜日も公演日に入る");
  const kr = JSON.parse(read("data/events.json")).filter((x) => /^korakuen-bicchu-/.test(x.id));
  ok(kr.length > 0 && kr.every((x) => x.sessions?.join() === "11:00〜12:00,13:00〜14:00"), "本番データ: 岡山後楽園は1日2回公演");
  ok(/石見神楽公式サイト/.test(JSON.parse(read("data/kagura-info.json"))["石見神楽"].source), "本番データ: 石見神楽の説明の出典は、石見神楽公式サイト");
}
