// UI/UX の決まりのテスト(UI/UX の目線の点検で決めたこと)
//  - 固定ヘッダー・文字の大きさの基準・補足の文字の大きさ
//  - トップの最初の画面(次の開催・入口の横並び)、定期公演は3件まで
//  - 地図: 同じ場所のピンをまとめる・凡例・操作の切り替え・会場名から地図へ
//  - 開催ページ: 要点の帯・ボタンの強弱・共有・ほかの日程・小さな地図
//  - 検索のリセット、ガイドの目次へ戻る、フォームの「くわしく書く」と同意の欄
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";

const read = (p) => readFileSync(p, "utf8");

export async function uxTests({ ok, section, OUT }) {
  const page = (p) => cheerio.load(read(join(OUT, p)));
  const home = page("index.html");
  const css = home("style").first().html();

  section("UI: 全ページ共通(ヘッダー・文字)");
  ok(/\.top\{position:sticky;top:0;/.test(css) && /\.top\{[^}]*background:transparent/.test(css) && /\.scrolled \.top\{[^}]*background:[^}]*box-shadow/.test(css) && /scroll-padding-top:\d+px/.test(css), "ヘッダーは画面の上に固定。一番上では背景を透明にし、スクロールすると背景と影。ページ内リンクの位置はヘッダーの分ずらす");
  const nav = new JSDOM(read(join(OUT, "about.html")), { runScripts: "dangerously", pretendToBeVisual: true });
  Object.defineProperty(nav.window, "pageYOffset", { value: 200, configurable: true });
  nav.window.dispatchEvent(new nav.window.Event("scroll"));
  await new Promise((r) => setTimeout(r, 40));
  ok(nav.window.document.documentElement.classList.contains("scrolled"), "スクロールすると、scrolled クラスが付く(動きのないページでも)");
  nav.window.close();
  const sizes = [...new Set([...css.matchAll(/font-size:([^;}!]+)/g)].map((m) => m[1]))].filter((v) => !v.startsWith("var(--fs-") && v !== ".68em" && !/^\d+px$/.test(v));
  ok(sizes.length === 0, "文字の大きさは、すべて基準の変数(--fs-…)で指定する", sizes.join(" "));
  const fs = Object.fromEntries([...css.matchAll(/--fs-([a-z0-9]+):([^;}]+)/g)].map((m) => [m[1], m[2]]));
  ok(Object.keys(fs).length === 8 && /\.meta\{color:var\(--mut\);font-size:var\(--fs-s\)\}/.test(css) && parseFloat(fs.s) >= 0.9, "補足の文字(一覧の時刻・場所など)は s(14.5px 以上)", JSON.stringify(fs));
  ok(/\.finder legend\{[^}]*letter-spacing:\.08em/.test(css) && /\.mhead\{[^}]*letter-spacing:\.1em/.test(css), "小さな見出しの文字の間隔を詰める");
  ok(/body:before,body:after\{[^}]*opacity:\.4\}/.test(css), "広い画面の左右の模様は薄く");

  section("UI: トップの最初の画面");
  ok(home(".home-hero .next").length === 0, "見出しの中に「次の開催」は出さない(運営者の判断で外した)");
  ok(home(".home-discovery .quick a").length === 3 && home(".home-discovery a[href='/calendar.html']").length === 1, "トップ上部から今週末・今月・日付地域検索へ進める");
  const regN = home(".reglist .card").length;
  ok(regN <= 3 ? home("#regmore").length === 0 : home("#regmore").length === 1 && home("#regmore").parent().attr("hidden") !== undefined, "定期公演が4件以上なら「すべて表示」のボタンを用意する(JS が動くときだけ出す)", String(regN));
  const hd = new JSDOM(read(join(OUT, "index.html")), { runScripts: "dangerously" });
  const regs = [...hd.window.document.querySelectorAll(".reglist .card")];
  ok(regs.filter((c) => !c.hidden).length === Math.min(3, regs.length) && (regs.length <= 3 || !hd.window.document.getElementById("regmore").parentNode.hidden), "定期公演: 最初は3件", String(regs.length));
  hd.window.document.getElementById("regmore")?.click();
  ok(regs.every((c) => !c.hidden), "「すべて表示」で、定期公演がすべて出る");
  hd.window.close();
  const hh = read(join(OUT, "index.html"));
  ok(hh.indexOf('class="reglist"') < hh.lastIndexOf("トップの「開催予定」"), "トップのスクリプトは、定期公演の一覧より後ろに置く(読み込んだ時点で、一覧がある)");
  ok(/\.card\.reg\{background:/.test(css), "定期公演のカードは、地色で、日付のある開催と見分けられる");

  section("UI: 地図で探す");
  const mp = page("map.html");
  ok(mp(".legend .pin.ev").length === 1 && mp(".legend .pin.reg").length === 1 && mp(".legend .pin.mix").length === 1, "凡例: 日付のある開催・定期公演・両方");
  ok(mp("#maplock").length === 1 && mp("#maplock").attr("hidden") !== undefined, "指で触る端末だけ「地図を動かす」を出す(最初は隠す)");
  ok(mp(".venuelist .vjump[data-k]").length > 0 && mp(".venuelist .vjump").first().attr("disabled") !== undefined, "会場名は、地図へ移るボタン(地図が読めたら押せる)");
  ok(/#map \.leaflet-tile-pane\{filter:/.test(css) && !/#map\{[^}]*filter:/.test(css), "色の加工は、地図の画像だけ(ピン・吹き出しには、かけない)");
  // ピンのまとめ方を、Leaflet の代わりの小さな部品で確かめる
  const markers = [];
  const evs = [
    { id: "a", name: "A", up: true, start: "2026-11-01T10:00", prefecture: "広島県", city: "北広島町", venue: "道の駅", lat: 34.6, lng: 132.5 },
    { id: "b", name: "B", up: true, start: "2026-12-01T10:00", prefecture: "広島県", city: "北広島町", venue: "道の駅", lat: 34.6, lng: 132.5 },
    { id: "c", name: "C", up: true, start: "2026-11-05T10:00", prefecture: "岡山県", city: "高梁市", venue: "紺屋川", lat: 34.79, lng: 133.61 },
  ];
  const regsJ = [{ id: "r", name: "R", schedule: "毎週土曜 20:00", prefecture: "岡山県", city: "高梁市", venue: "紺屋川", lat: 34.79, lng: 133.61 }];
  const mdom = new JSDOM(read(join(OUT, "map.html")), {
    runScripts: "dangerously",
    beforeParse(w) {
      w.matchMedia = () => ({ matches: false, addEventListener() {} });
      w.fetch = (u) => Promise.resolve({ ok: true, json: () => Promise.resolve(u.includes("events") ? evs : regsJ) });
      const mapObj = { setView() { return mapObj; }, fitBounds() {}, on() {}, getZoom() { return 6; }, scrollWheelZoom: { enable() {}, disable() {} }, dragging: { enable() {}, disable() {} } };
      w.L = {
        map: () => mapObj, tileLayer: () => ({ addTo() {} }),
        divIcon: (o) => o,
        marker: (ll, o) => { const m = { ll, o, popup: "", addTo() { markers.push(m); return m; }, bindPopup(h) { m.popup = h; return m; }, getLatLng() { return ll; }, openPopup() { m.opened = true; } }; return m; },
      };
    },
  });
  await new Promise((r) => setTimeout(r, 40));
  ok(markers.length === 2, "同じ場所の開催は、1本のピンにまとめる", String(markers.length));
  const road = markers.find((m) => m.ll[0] === 34.6), takahashi = markers.find((m) => m.ll[0] === 34.79);
  ok(road?.o.icon.className === "pin ev" && road.o.icon.html === "2" && /11月1日.*12月1日/s.test(road.popup), "まとめたピン: 件数を数字で出し、吹き出しに日付順の一覧");
  ok(takahashi?.o.icon.className === "pin mix", "日付のある開催と定期公演が同じ場所なら、両方の色");
  mdom.window.close();

  section("UI: 開催ページ・定期公演ページ");
  const full = page("events/t-full.html");
  ok(full(".keyinfo table.info").length === 1 && full(".keyinfo").next(".desc-lead").next(".actions").length === 1 && page("regular/r-weekly.html")(".keyinfo").next(".desc-lead").next(".actions").length === 1, "要点(日時・会場・料金)の帯 → 説明 → 「公式情報を見る」のボタンの順(開催・定期公演とも)");
  // 違和感の点検(PR 1): 右の列の固定・区切りの「・」・日付と時刻の割れ・終了済みのカレンダー・カッコと時刻の書き方
  ok(!/\.d-side\{[^}]*(position:sticky|max-height|overflow-y)/.test(css), "PCの右の列は固定せず、高さの上限も付けない(画面より長いと下が切れて中だけスクロールするため)");
  const textSep = ($, sel) => $(sel).toArray().some((x) => /・/.test($(x).clone().children(".sl").remove().end().text()));
  ok(home("main .card .meta .sl-in>span").length > 0 && !textSep(home, "main .card .meta") && !/・/.test(home("footer").text()) && home("footer .flinks a").length >= 10 && page("events/t-long.html")(".monthlist .meta .sl-in>span").length > 0 && !textSep(page("events/t-long.html"), ".monthlist .meta"), "一覧・関連公演・フッターの区切りは文字の「・」を使わない(行頭・行末に「・」だけが残らない)");
  ok(/^\d{4}年\d+月\d+日\(.\)$/.test(full(".when .nw").first().text()) && page("regular/r-nightly.html")(".info .sched-main .nw").text() === "20:00〜21:00", "日付と曜日・時刻の範囲は、途中で改行しない組にする");
  ok(full(".tocal").length === 1 && page("events/t-past.html")(".tocal, .calendar-notice").length === 0, "終了した公演には、カレンダー登録のリンクと注意書きを出さない");
  ok(!/（|）/.test(full(".tocal").text()) && !home("main .card .meta").toArray().some((x) => /(^|[^\d])0\d:\d\d/.test(home(x).text())), "サイトの文言のカッコは半角、時刻は先頭の0を付けない(8:45〜)");
  // 違和感の点検(PR 2): 確認のお願いは表の下に1回だけ・運営側の事情を見せない・導入文で日付をくり返さない
  const tu = page("events/t-timeunknown.html");
  ok(!/公式情報をご確認ください/.test(tu(".keyinfo table").text()) && /時刻未確認/.test(tu(".keyinfo .when").text()) && tu(".keyinfo .unknown-note").length === 1 && /未確認の項目は/.test(tu(".keyinfo .unknown-note").text()), "要点の表の不明な欄は「未確認」と短く書き、確認のお願いは表の下に1回だけ");
  ok(!/内容の確認日は未登録/.test(home("main").text()), "一覧に運営側の事情(内容の確認日は未登録)を出さない");
  ok(!/\d+月\d+日\(.\)〜/.test(page("weekend.html")(".lead").text()) && !/今日\(/.test(page("this-month.html")(".lead").text()), "今週末・今月の導入文で、見出しの下と同じ日付をくり返さない");
  // 違和感の点検(PR 3): 日付のある定期公演のカードも、開催のカードと同じ日付の形(月・日・曜日)
  const occSrc = read("scripts/build.mjs").match(/const occCard = [\s\S]*?\n\};/)?.[0] ?? "";
  ok(occSrc.includes('<div class="card reg occ"><div class="date"><small>${p.mo}月</small><b>${p.d}</b><small>${WD[p.wd]}曜</small></div>') && /\.reg\.occ \.date b\{font-size:var\(--fs-2xl\)/.test(css), "日付のある定期公演のカードも、開催と同じ「月・日・曜日」の形にそろえる");
  // 違和感の点検(PR 4): 押せない宿の条件は丸い枠にしない・バナー画像が出ないときは空の枠を残さない
  ok(!/\.stay-cond span\{[^}]*border-radius/.test(css) && /\.stay-cond span\+span::before\{content:"・"/.test(css), "宿の検索条件(泊まる日・人数・場所)は、押せるボタンと同じ丸い枠にしない");
  {
    const dom = new JSDOM(`<aside class="aff trip-band"><h2>今月の旅の宿を探す</h2><div class="stay-banners"><a class="stay-banner" href="#"><img src="x.png"></a><span class="vc-ad stay-banner" hidden></span></div><span class="pr">PR</span></aside><aside class="aff other"><a class="stay-banner" href="#"><img src="y.png"></a><a class="stay-banner" href="#"><img src="z.png"></a></aside>`, { runScripts: "outside-only" });
    const w = dom.window, d = w.document;
    w.eval(read("scripts/client/ad-fallback.js"));
    d.querySelector(".trip-band img").dispatchEvent(new w.Event("error"));
    d.querySelector(".other img").dispatchEvent(new w.Event("error"));
    ok(d.querySelector(".trip-band").hidden === true && d.querySelector(".other").hidden === false && d.querySelectorAll(".other .stay-banner[hidden]").length === 1, "宿のバナー画像が出ないときはそのバナーを隠し、見えるバナーが残らなければ枠ごと隠す");
    dom.window.close();
  }
  // 読みやすさ: 説明は段落(p)で組み、ページ下の注記は同じ注意をくり返さず、広告の注記は1行にまとめる
  { const pages = ["events/t-full.html", "events/t-long.html", "regular/r-weekly.html", "weekend.html"].map(page);
    ok(pages.slice(0, 3).every((p) => p(".desc-lead > p").length >= 1), "公演の説明は段落(p)で組む(長い説明は2文ずつに分ける)");
    ok(pages.every((p) => { const t = p(".page-notes").text(); return !/リアルタイム表示ではありません|会場の公式アクセスと公共交通を先に|泊・大人2名で検索します|掲載情報確認:/.test(t) && (t.match(/アフィリエイトリンク/g) || []).length <= 1; }), "ページ下の注記は、ほかで伝わる注意をくり返さず、広告の注記は1行にまとめる"); }
  ok(full(".actions .btn:not(.ghost)").length <= 1 && full(".keyinfo tr").first().find("a.tocal[href*='calendar.google.com']").length === 1 && full(".actions a[href*='calendar.google.com']").length === 0 && full(".stay .btn").toArray().every((b) => full(b).hasClass("stay-btn") && !full(b).hasClass("ghost")) && full(".dpage .d-side .stay").length === 0 && full(".d-top .actions").length === 1, "主役のボタンは「公式情報を見る」だけ(カレンダーは控えめ)。未設定の宿枠は省略する");
  const sh = full(".share");
  ok(sh.find("a[href^='https://social-plugins.line.me/lineit/share?url=']").attr("rel")?.includes("noopener") && sh.find("button[data-copy]").attr("data-copy") === "https://kagurameguri.jp/events/t-full.html" || /\/events\/t-full\.html$/.test(sh.find("button[data-copy]").attr("data-copy") ?? ""), "共有: LINE で送る・リンクをコピー", sh.text());
  ok(full("#map,#mapbig").length === 0 && full(".keyinfo a.tomap").attr("href")?.startsWith("https://www.google.com/maps/search/"), "開催ページは地図を置かず、会場の欄から Google マップへ");
  ok(/#map\.dmap\{height:200px\}/.test(css) && /@media\(max-width:560px\)\{#map\.dmap\{height:160px\}\}/.test(css), "開催ページの地図の高さは、地図ページの指定(#map)に負けない");
  const reg = page("regular/r-weekly.html");
  ok(reg(".keyinfo").length === 1 && reg(".share").length === 1, "定期公演ページも、要点の帯と共有");
  // スマホでは、右の列(宿・本などの広告)が、要点と本文のあいだに入る。説明文は要点の帯の中に置き、広告より先に読めるようにする
  const descFirst = (p) => { const h = p("main").html(); return p(".d-top .desc-lead").length === 1 && p(".d-rest .desc-lead").length === 0 && h.indexOf("desc-lead") < h.indexOf('class="d-side"'); };
  ok(full(".d-side").length === 1 && reg(".d-side").length === 1 && descFirst(full) && descFirst(reg), "開催・定期公演ページの説明文は、要点のすぐあと(スマホでは広告の列より前)に出る");
  { const h = reg("main").html(); ok(reg(".d-rest .share").length === 1 && h.indexOf('class="share"') > h.indexOf("desc-lead") && h.indexOf('class="share"') > h.indexOf("planning-links"), "定期公演ページも、共有のボタンは、説明・周辺体験などの本文のあと"); }
  { // 見出しの下の「明日開催」などは、並ぶタグと文字の大きさ・そろえ方が違うと、スマホで高さと位置がずれる
    const rule = (sel) => (css.match(new RegExp(`(?:^|[}\\s/])${sel.replace(/\./g, "\\.")}\\{([^}]*)\\}`)) ?? [])[1] ?? "";
    const fs = (r) => (r.match(/font-size:([^;}]+)/) ?? [])[1];
    ok(full(".hero .until").length === 1 && !!fs(rule(".until")) && fs(rule(".until")) === fs(rule(".hero .tag")) && !/vertical-align:(?!baseline)/.test(rule(".until")),
      "見出しの下の開催までの日数は、並ぶタグと同じ文字の大きさ・そろえ方(高さと位置がずれない)", `${rule(".until")} / ${rule(".hero .tag")}`);
    ok([full, reg].every((p) => p(".guide-link").length === 0 && !p("main").text().includes("ガイドもどうぞ")) && !rule(".guide-link a"), "開催・定期公演のページには、ガイドへの案内の一文を置かない(2026-10-30 運営者の判断)"); }

  section("UI: 検索・ガイド・フォーム・主催者の方へ");
  const cal = page("calendar.html");
  ok(cal("#reset").length === 1 && cal("#reset").parent().attr("hidden") !== undefined, "検索: 「条件をリセット」(条件を変えたときだけ出す)");
  ok(/\.finder \.where\{display:grid;grid-template-columns:1fr 1fr/.test(css), "検索: 地方と県の選択欄を横に並べる");
  const g = page("guide.html");
  // 章の移動: 固定した章ナビで行う(「目次へ戻る」は置かない。2026-10-30 運営者の判断)
  ok(g("#toc.gnav").length === 1 && g(".totoc").length === 0 && /:is\(\.guide,\.history\) \.gnav\{position:sticky;top:var\(--read-top/.test(css), "ガイド: 章ナビはヘッダーのすぐ下に固定し、「目次へ戻る」は置かない");
  ok(/@media\(min-width:1100px\)\{\s*:is\(\.guide,\.history\) \.read-layout\{display:grid;grid-template-columns:212px/.test(css), "ガイド: 広い画面では、章ナビを本文の左に置く");
  const sub = page("submit.html");
  ok(sub("details.more-fields #address").length === 1 && sub("details.more-fields #description").length === 1 && sub("details.more-fields #date").length === 0 && sub("legend").first().text() === "1. 開催の情報", "掲載の依頼: 任意の項目は「くわしく書く」で開く。段階に番号");
  const ph = sub("[placeholder^='例']").map((_, x) => sub(x).attr("placeholder")).get();
  ok(ph.length >= 4 && ph.every((t) => !/石見|高千穂|備中|広島|高宮|益田|安芸高田/.test(t)), "入力例は、特定の神楽・地名によらない(〇〇の形)", ph.join(" / "));
  ok(sub(".consent label a").length === 0 && sub(".consent .links a").length === 2, "同意の欄: リンクは文の後ろ(チェックボックスと離す)");
  const org = page("organizers.html");
  ok(org(".cta-end a[href='/submit.html']").length === 1, "主催者の方へ: ページの最後にも「掲載を依頼する」");
  ok(org(".opoints li").length === 3 && org(".ocards li").length === 5 && org(".oways .oway").length === 3 && org("ol.steps li").length === 3 && org(".faq details summary").length === 3, "主催者の方へ: 要点のカード3つ・載る場所5つ・送り方3つ・番号つきの手順・開閉式のよくあるご質問");
  ok(page("kagura/石見神楽.html")("main h2").first().text() !== "石見神楽とは", "種類のページ: 開催予定を先に、説明は後ろに");
  { const iw = page("kagura/石見神楽.html"), html = iw("main").html();
    ok(iw("main .kagura-lead").length === 1 && html.indexOf("kagura-lead") < html.indexOf("<h2>開催予定</h2>") && (!iw("main .aff").length || html.indexOf("<h2>開催予定</h2>") < html.indexOf('class="aff')), "種類のページ: 見出しのすぐ下に一言の紹介、宿の枠は開催予定のあと"); }
}
