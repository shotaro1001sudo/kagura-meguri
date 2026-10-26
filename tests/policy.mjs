// プライバシーポリシー・免責事項のテスト
//  「文面」と「実際の動作」が、食い違っていないことを、機械的に確かめる。
//   - サイトが実際に通信できる外部(CSPの許可リスト)は、すべて、ポリシーに載っているか
//   - ブラウザに保存するもの(Cookie / localStorage / sessionStorage)は、ポリシーの記載と同じか
//   - 広告・解析・アフィリエイト・フォーム送信先・自動取得を、有効にしたときだけ、その項目が現れるか
import { STAY_BANNERS } from "../scripts/lib/stay-banners.mjs";
import { readFileSync, existsSync, readdirSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";
import { renderedCheerio as cheerio } from "./rendered-vc.mjs";
import { cspFor } from "../scripts/lib/csp.mjs";

const read = (p) => readFileSync(p, "utf8");
const text = (f) => { const $ = cheerio.load(read(f)); $("script,style").remove(); return $("main").text().replace(/\s+/g, " "); };
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const cspOf = (f) => cheerio.load(read(f))('meta[http-equiv="Content-Security-Policy"]').attr("content") ?? "";

export async function policyTests({ ok, section, OUT, build }) {
  const cfg = JSON.parse(read("config.json").replace(/^﻿/, ""));
  const D = "dist-test-policy";
  const sub = (name, env) => { const r = build("tests/fixtures/events.test.json", `${D}-${name}`, { SOURCES_FILE: "tests/fixtures/sources.empty.json", ...env }); ok(r.status === 0, `ポリシー検査用ビルド(${name})`, r.stderr); return `${D}-${name}`; };

  section("ポリシー: 基本の項目");
  const pv = text(join(OUT, "privacy.html")), ds = text(join(OUT, "disclaimer.html"));
  for (const h of ["運営者", "取得する情報", "利用目的", "外部サービスの利用と、情報の送信", "投稿フォーム・お問い合わせフォームについて", "第三者への提供", "保存期間", "開示・訂正・削除", "この方針の改定"]) ok(pv.includes(h), `プライバシーポリシーに「${h}」の項目がある`);
  ok(pv.includes("迷惑投稿") && pv.includes("個人情報の保護に関する法律"), "迷惑投稿対策と、関係する法令への言及がある");
  ok(pv.includes('最終更新: 2026年10月26日') && pv.includes('外部広告画像の読み込みと広告リンク利用時の通信の違いを追記') && pv.includes('案内の表示済み情報の一時保存を追記') && (cfg.privacy.history ?? []).length >= 1 && (cfg.privacy.history ?? []).every((x) => pv.includes(x.slice(0, 12))), "診断の改定日と従来の改定履歴が出る");
  section("利用規約・法令に沿った記載");
  const tm = text(join(OUT, "terms.html"));
  ok(["適用", "開催情報の投稿", "禁止事項", "違反への対応", "知的財産権", "免責", "規約の変更", "分離可能性", "準拠法・管轄裁判所"].every((t) => tm.includes(`(${t})`)), "利用規約に、適用・投稿・禁止事項・知的財産・免責・変更・準拠法と管轄の各条がある");
  ok(tm.includes("運営者の住所地を管轄する裁判所を、第一審の専属的合意管轄裁判所とします") && tm.includes("無償で、掲載・編集・要約・削除できる権利を許諾") && tm.includes("故意または重大な過失がある場合を除き"), "利用規約: 合意管轄(住所地を出さない書き方)・投稿の利用許諾・責任の範囲(消費者契約法に沿った例外つき)");
  ok(read(join(OUT, "sitemap.xml")).includes("/terms.html</loc>") && cheerio.load(read(join(OUT, "index.html")))('footer a[href="/terms.html"]').length === 1, "利用規約が、サイトマップとフッターにある");
  const sform = cheerio.load(read(join(OUT, "submit.html")));
  ok(sform('.consent a[href="/terms.html"]').length === 1 && sform('.consent a[href="/privacy.html"]').length === 1 && sform(".consent").text().includes("外国にある事業者への提供を含みます"), "投稿フォームの同意: 利用規約とプライバシーポリシー(外国の事業者への提供を含む)");
  ok(pv.includes("安全管理のために講じている措置") && ["組織的・人的な措置", "物理的な措置", "技術的な措置", "外的環境の把握"].every((t) => pv.includes(t)), "プライバシーポリシー: 安全管理措置(個人情報保護法で公表が求められる項目)");
  ok(pv.includes("外国にある事業者への提供について") && pv.includes("インド") && pv.includes("アメリカ合衆国") && read(join(OUT, "privacy.html")).includes("https://www.ppc.go.jp/"), "プライバシーポリシー: 外国にある事業者への提供(所在国・制度の情報・措置)");
  ok(ds.includes("利用規約に定めています") && !ds.includes("文章・デザイン・プログラムの著作権は"), "免責事項: 著作権・準拠法は利用規約に寄せ、重複させない");
  ok(/12か月/.test(pv) || pv.includes(cfg.privacy.retention.slice(0, 8)), "保存期間が書かれている");
  ok(pv.includes(cfg.operator.name), "運営者の名前が出る");
  for (const h of ["掲載情報は、変更されることがあります", "情報の集め方と、自動処理について", "掲載の権利と、掲載の停止", "お出かけの際の注意", "外部のサイト・広告・リンクについて", "損害についての責任", "準拠法"]) ok(ds.includes(h), `免責事項に「${h}」の項目がある`);
  ok(ds.includes("国土地理院") && ds.includes("おおよその位置") && ds.includes("開始から3時間"), "免責事項に、位置情報の自動付与・日時の自動処理の説明がある");
  ok(ds.includes("故意または重大な過失がある場合を除き"), "免責の範囲に、法令上の例外(故意・重過失)を明記している");
  // 本番の設定(規約確認済みの収集元・自動掲載のオンオフ)に応じて、文面が実態と一致しているか
  const real = existsSync("data/sources.json") ? JSON.parse(read("data/sources.json").replace(/^﻿/, "")) : [];
  const active = real.filter((x) => x.enabled !== false && x.termsChecked);
  const autoPub = cfg.collect?.autoPublish !== false;
  ok(ds.includes("事実の情報") && (active.length && autoPub ? ds.includes("運営者の確認を待たずに自動で掲載します") : ds.includes("確認してから掲載")), "事実の情報だけを載せること、掲載の前の確認の有無(自動掲載か、確認してから掲載か)が、実態どおりに書かれている");
  ok(/掲載を望まない場合/.test(ds) && /速やかに/.test(ds), "掲載停止・訂正の請求の窓口と、対応の約束がある");
  for (const f of ["index.html", "events/t-full.html", "regular/r-nightly.html", "about.html", "disclaimer.html", "privacy.html"]) {
    const $ = cheerio.load(read(join(OUT, f)));
    ok($("footer a[href='/disclaimer.html']").length === 1 && $("footer a[href='/privacy.html']").length === 1, `${f}: フッターに、免責事項とプライバシーポリシーのリンク`);
  }
  ok(cheerio.load(read(join(OUT, "events/t-full.html")))("footer a[href='/disclaimer.html']").length === 1, "開催の詳細から、免責事項へたどれる(フッター)");
  ok(read(join(OUT, "sitemap.xml")).includes("/disclaimer.html"), "サイトマップに免責事項が入る");
  ok(cheerio.load(read(join(OUT, "privacy.html")))("table.tbl").closest(".tblwrap").length === 1, "表は、横にスクロールできる枠に入る(スマホではみ出さない)");

  section("ポリシー: 実際の動作との一致");
  // (1) 通信できる外部は、すべてポリシーに載っている
  const names = { "unpkg.com": "unpkg", "tile.openstreetmap.org": "OpenStreetMap", "fonts.googleapis.com": "Google Fonts", "fonts.gstatic.com": "Google Fonts", "api.web3forms.com": "Web3Forms", "gc.zgo.at": "GoatCounter", "consent.cookiebot.com": "Cookiebot", "consentcdn.cookiebot.com": "Cookiebot", "imgsct.cookiebot.com": "Cookiebot" };
  const origins = new Set();
  for (const f of walk(OUT).filter((x) => x.endsWith(".html"))) for (const d of ["script-src", "style-src", "img-src", "font-src", "connect-src", "frame-src"]) for (const tok of (cspOf(f).split(";").map((s) => s.trim()).find((s) => s.startsWith(d + " ")) ?? "").split(/\s+/).slice(1)) if (/^https:\/\//.test(tok)) origins.add(new URL(tok).hostname);
  ok(origins.size >= 3, "通信できる外部が、CSPから読み取れる", [...origins].join(","));
  for (const host of origins) ok(!!(names[host] ??= host.endsWith(".goatcounter.com") ? "GoatCounter" : undefined) && pv.includes(names[host]), `通信できる外部 ${host} が、ポリシーの外部送信の表に載っている`);
  ok(pv.includes("当サイトの配信サーバー") && !pv.includes("GitHub"), "配信サーバーを載せる(自サイトの配信なので、事業者名は出さない)");
  // (2) ブラウザに保存するものは、ポリシーの記載と同じ
  const pages = walk(OUT).filter((x) => x.endsWith(".html"));
  const keys = new Set(), bad = [];
  for (const f of pages) for (const m of read(f).matchAll(/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g)) {
    const s = m[1];
    if (/document\.cookie|localStorage|indexedDB/.test(s)) bad.push(f);
    for (const k of s.matchAll(/sessionStorage\.(?:get|set)Item\('([^']+)'/g)) keys.add(k[1]);
  }
  ok(bad.length === 0, "Cookie・localStorage・IndexedDB を使っていない(使うなら、ポリシーの更新が必要)", bad.join(","));
  ok([...keys].sort().join() === "intro,km-quiz-offer,lastSend", "保存するのは sessionStorage の intro・km-quiz-offer・lastSend だけ", [...keys].join(","));
  ok(pv.includes("Cookie(クッキー)を設定しません") && pv.includes("セッションストレージ") && pv.includes("外部には送られません") && pv.includes("診断の案内") && pv.includes("回答は保存"), "ポリシーに保存する3項目と、診断回答を保存・送信しないことが書かれている");
  // (3) 画面に出す「広告・アフィリエイト」の表示は、実態に合っている
  const ev = cheerio.load(read(join(OUT, "events/t-full.html")));
  ok(ev(".stay,.staylinks,.stay-banner").length===0,"未設定の宿おすすめ枠を省略");
  ok(cheerio.load(read(join(OUT, "events/t-past.html")))(".stay").length === 0, "終わった開催には、宿のリンクを出さない");
  const { encodeSjisURI } = await import("../scripts/lib/sjis.mjs");
  ok(encodeSjisURI("安芸高田市") === "%88%C0%8C%7C%8D%82%93%63%8E%73" && encodeSjisURI("ｶｸﾞﾗ a") === "%B6%B8%DE%D7%20a", "Shift_JIS のエンコード(漢字・半角カナ・英数字)");
  const pf = cheerio.load(read(join(OUT, "pref", "広島県.html")));
  ok(pf(".aff").length===0,"未設定の県別おすすめ枠を省略");
  ok(pv.includes("現在、当サイトの閲覧に関するアクセスログ") && !["広告の配信について", "Google AdSense(", "Googleアナリティクス", "アフィリエイトプログラムに参加"].some((w) => pv.split("改定の履歴")[0].includes(w)), "広告・解析・アフィリエイト未設定の間は、それらを「使っている」と書かない");
  ok(!pv.includes("専門家") && !ds.includes("専門家"), "プライバシーポリシー・免責事項に、運営者向けの注意書き(専門家の確認のすすめ)を載せない");
  ok(!pv.includes("画像配信先:"), "広告未設定時は広告画像の利用を記載しない");
  ok(ds.includes("アフィリエイト(成果報酬)の契約を結んでおらず"), "免責事項に、現在、成果報酬を得ていないことが書かれている");
  ok(text(join(OUT, "about.html")).includes("収益を得ていません"), "運営者情報にも、現在は収益を得ていないことが書かれている");

  section("ポリシー: 設定を有効にしたときだけ、項目が現れる");
  { // 広告
    const d = sub("ads", { TEST_ADSENSE: "ca-pub-0000000000000000" }); const p = text(join(d, "privacy.html")), s = text(join(d, "disclaimer.html")), a = text(join(d, "about.html"));
    ok(p.includes("Google AdSense") && p.includes("myadcenter.google.com") || read(join(d, "privacy.html")).includes("myadcenter.google.com"), "広告を設定すると、AdSenseの項目(広告設定へのリンクつき)が現れる");
    ok(p.includes("Google AdSense(Google LLC)") && /広告を表示するページ/.test(p), "広告を設定すると、外部送信の表に AdSense が加わる");
    ok(s.includes("第三者が配信する広告") && a.includes("広告およびアフィリエイトプログラムによる収益") || a.includes("広告による収益"), "広告を設定すると、免責事項と運営者情報も、変わる");
    ok(!p.includes("Googleアナリティクス"), "広告だけを設定したとき、アクセス解析の項目は出ない");
    const ads = cspOf(join(d, "privacy.html")); ok(/googlesyndication/.test(ads), "(参考)広告を設定すると、CSPにも、広告の許可が入る");
  }
  { // アクセス解析
    const d = sub("ga", { TEST_GA: "G-TEST123456" }); const p = text(join(d, "privacy.html"));
    ok(p.includes("Googleアナリティクス(Google LLC)") && /アクセス解析について/.test(p), "アクセス解析を設定すると、その項目と、外部送信の表の行が現れる");
    ok(!p.includes("取得も保存もしていません"), "アクセス解析を設定すると、「取得していない」という記載が消える");
  }
  { // アフィリエイト
    const d = sub("aff", { TEST_AFFILIATE: "test-22" }); const p = text(join(d, "privacy.html")), s = text(join(d, "disclaimer.html"));
    const $ = cheerio.load(read(join(d, "events/t-full.html")));
    ok(p.includes("アフィリエイトプログラムについて") && p.includes("適格販売により収入を得ています"), "アフィリエイトを設定すると、その項目と、Amazonの表記が現れる");
    ok(s.includes("一部のリンクは、広告・アフィリエイトのリンクです") && !s.includes("契約を結んでおらず"), "アフィリエイトを設定すると、免責事項が変わる");
    const pa = cheerio.load(read(join(d, "pref", "広島県.html")));
    ok(pa(".afflist a[rel~=sponsored]").length === 1 && pa(".afflist a[rel~=sponsored]").attr("href").includes("tag=test-22") && pa(".aff .pr").length === 1, "Amazon を設定すると、通販のリンクが加わり、sponsored と「PR」が付く");
    ok($(".staylinks a[rel~=sponsored]").length === 0, "宿の ID が未設定なら、宿のリンクには sponsored を付けない(Amazon だけ設定したとき)");
  }
  { // 本番の設定: 楽天アフィリエイトとバリューコマース(じゃらんnet)が有効。宿の2つのリンクが、どちらも報酬つき
    const prodCfg = JSON.parse(read("config.json").replace(/^﻿/, ""));
    const d = sub("prod-aff", { TEST_AFF_OFF: "", TEST_ADS_OFF: "", TEST_GOATCOUNTER: prodCfg.goatcounter, TEST_CB:prodCfg.cookiebotId }); const p = text(join(d, "privacy.html"));
    const $ = cheerio.load(read(join(d, "events/t-full.html")));
    const stays = $(".d-side .staylinks a").map((_, x) => $(x).attr("href")).get();
    ok(stays.length === 2 && stays[0].startsWith(`//ck.jp.ap.valuecommerce.com/servlet/referral?sid=${prodCfg.affiliate.valueCommerceSid}&pid=${prodCfg.affiliate.jalanPid}&vc_url=${encodeURIComponent("https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=")}`) && stays[1].startsWith(`https://hb.afl.rakuten.co.jp/hgc/${prodCfg.affiliate.rakutenAffiliateId}/?pc=${encodeURIComponent("https://kw.travel.rakuten.co.jp/keyword/Search.do?")}`) && $(".d-side .staylinks a").toArray().every((x) => /sponsored/.test($(x).attr("rel"))) && $(".stay .pr").length === 1, "本番: 宿は、じゃらん(バリューコマース)・楽天トラベル(楽天アフィリエイト)経由で、会場の市区町村・開催日の検索へ直接つなぐ(sponsored・PR表記つき)");
    ok($(".d-side .stay-banner").length === 0, "本番: 開催ページの宿は、宿のトップへ飛ぶだけのバナーを使わない");
    ok(p.includes("アフィリエイトプログラムについて"), "本番: ポリシーに、アフィリエイトの項目がある");
    ok(['楽天グループ株式会社','バリューコマース株式会社','hbb.afl.rakuten.co.jp','ba.afl.rakuten.co.jp','ad.jp.ap.valuecommerce.com'].every(v=>p.includes(v)), '本番: 広告サービス提供会社と画像ホストを開示');
    ok(p.includes('サービス提供会社と画像配信先のホスト名を区別') && !p.includes('これらの事業者へ次の情報が直接送られます'), '外部送信: 提供会社を画像ホストの運営主体と同一視しない');
    ok(p.includes('異なるタイミングで発生します') && !p.includes('成果計測は別の処理です'), '外部送信: 通信のタイミングを説明し内部処理を断定しない');
    ok(p.includes('当サイト側：広告画像の取得・表示') && p.includes('サービス提供会社が公表する利用目的') && p.includes('個々の画像要求でどの情報が何に利用されるかを確認したものでもありません'), '外部送信: 当サイトの目的と提供会社の一般方針・未確認事項を区別');
    ok(p.includes('リンクを押す前にも発生') && p.includes('広告画像の取得・表示') && p.includes('接続元IPアドレス'), '本番: 画像通信の時機・目的・通信情報を説明');
    ok(p.includes('Cookie等を利用する場合') && p.includes('すべての画像要求でCookieや閲覧ページの完全なURLが送られるという意味ではありません'), '本番: Cookieや完全URLを全要求の確定動作としない');

    ok(prodCfg.goatcounter === "kagurameguri" && read(join(d, "index.html")).includes("https://kagurameguri.goatcounter.com/count") && p.includes("GoatCounter(アクセス解析)"), "本番: GoatCounter で計測し、ポリシーにも載る");
    const pub = prodCfg.adsense.client;
    ok(/^ca-pub-\d{16}$/.test(pub) && read(join(d, "index.html")).includes(`adsbygoogle.js?client=${pub}`) && read(join(d, "ads.txt")) === `google.com, ${pub.replace("ca-", "")}, DIRECT, f08c47fec0942fa0\n` && p.includes("Google AdSense(Google LLC)"), "本番: AdSense のコード・ads.txt・ポリシーの広告の項目がそろう(審査の準備)");
  }
  { // 宿のアフィリエイト(楽天・バリューコマース)
    const d = sub("travel", { TEST_AFF_TRAVEL: "1" }); const p = text(join(d, "privacy.html"));
    const $ = cheerio.load(read(join(d, "events/t-full.html")));
    const bn = $(".d-side .staylinks a");
  // 会場近くの宿: 開催日の1泊・大人2名、会場の市区町村(郡は除く)で探す。じゃらんは Shift_JIS、楽天は charset=utf-8
  const [jlRaw, rkRaw] = $(".staylinks a").map((_, x) => $(x).attr("href")).get();
  const jl0=new URL(jlRaw,"https://kagurameguri.jp").searchParams.get("vc_url"),rk0=new URL(rkRaw).searchParams.get("pc");
  ok(jl0 === "https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=%8D%82%90%E7%95%E4%92%AC&stayYear=2026&stayMonth=11&stayDay=20&stayCount=1&roomCount=1&adultNum=2", "じゃらん: 「高千穂町」(Shift_JIS)・開催日の1泊・大人2名で検索する", jl0);
  ok(rk0 === "https://kw.travel.rakuten.co.jp/keyword/Search.do?charset=utf-8&f_query=%E9%AB%98%E5%8D%83%E7%A9%82%E7%94%BA&f_nen1=2026&f_tuki1=11&f_hi1=20&f_nen2=2026&f_tuki2=11&f_hi2=21&f_otona_su=2&f_heya_su=1", "楽天トラベル: 「高千穂町」・開催日から翌日まで・大人2名で検索する", rk0);
  ok($("main").text().includes("2026年11月20日泊") && $(".staylinks a").get().every((x) => /^stay-(jalan|rakuten)\/t-full$/.test(($(x).attr("data-goatcounter-click") || $(x).closest("[data-vc-ad]").attr("data-goatcounter-click")))), "日付を示し、リンクの押された数を、開催ごとに数えられる");
    ok(bn.length === 2 && bn.toArray().every((x) => /sponsored/.test($(x).attr("rel"))) && $(".stay .pr").text() === "PR" && $(".page-notes").text().includes("広告(アフィリエイトリンク)を含みます"), "宿の ID を設定すると、宿のリンクに sponsored と「PR」の表示が付く(ステルスマーケティング規制への対応)");
    { // IDが未設定のとき: 文字のボタン(報酬なしの、ふつうの検索リンク)で案内する
      const q = cheerio.load(read(join(sub("plainstay", {}), "events/t-full.html")));
      const [jl, rk] = q(".staylinks a").map((_, x) => q(x).attr("href")).get();
      ok(q(".stay,.staylinks,.stay-banner").length===0,"未設定の宿は通常リンクで代替しない");
    }
    ok(p.includes("アフィリエイトプログラムについて") && p.includes("成果報酬型の広告") && p.includes("hbb.afl.rakuten.co.jp") && p.includes("ad.jp.ap.valuecommerce.com"), "宿のアフィリエイトを設定すると、ポリシーにも、その項目と画像配信先が現れる");
  }
  { // アクセス解析(GoatCounter)
    const d = sub("gc", { TEST_GOATCOUNTER: "kagura-test" }); const p = text(join(d, "privacy.html"));
    const h = read(join(d, "index.html")), $ = cheerio.load(h);
    const s = $('script[src="https://gc.zgo.at/count.v5.js"]');
    ok(s.attr("data-goatcounter") === "https://kagura-test.goatcounter.com/count" && /^sha384-/.test(s.attr("integrity")) && s.attr("crossorigin") === "anonymous", "GoatCounter: 改ざん検知(SRI)つきで読み込み、送り先は設定したコード");
    const csp = cspOf(join(d, "index.html"));
    ok(/script-src[^;]*https:\/\/gc\.zgo\.at/.test(csp) && /connect-src[^;]*https:\/\/kagura-test\.goatcounter\.com/.test(csp), "GoatCounter: CSP で、配信元と送り先だけを許可する");
    ok(p.includes("GoatCounter(アクセス解析)") && p.includes("Cookieもブラウザに保存する識別子も使いません") && !p.includes("取得も保存もしていません(アクセス解析を導入する場合"), "GoatCounter: ポリシーに、外部送信の行・Cookie を使わないこと・集計だけであることが書かれる");
    ok(!p.includes("Googleアナリティクス"), "GoatCounter だけのとき、Googleアナリティクスの項目は出ない");
    const off = read(join(OUT, "index.html"));
    ok(!off.includes("gc.zgo.at"), "コードが未設定の間は、GoatCounter を読み込まない");
  }
  { // フォーム送信先
    const d = sub("form", { TEST_FORM_ENDPOINT: "https://forms.example.test/submit", TEST_FORM_PROVIDER: "テスト送信サービス" }); const p = text(join(d, "privacy.html"));
    ok(p.includes("テスト送信サービス") && /フォームを送信したとき/.test(p) && p.includes("委託しています"), "フォームの送信先を設定すると、サービス名・外部送信の行・委託の記載が現れる");
    ok(!p.includes("メールの作成画面が開きます"), "フォームの送信先を設定すると、「メール作成画面が開く」という記載は消える");
    const off = text(join(sub("noform", { TEST_FORM_OFF: "1" }), "privacy.html"));
    ok(off.includes("メールの作成画面が開きます") && !off.includes("委託しています"), "送信先が未設定の間は、「メールの作成画面が開く」と書き、委託とは書かない");
    ok(pv.includes("Web3Forms") && pv.includes("委託しています") && !pv.includes("メールの作成画面が開きます"), "本番の設定: 送信先(Web3Forms)と委託が書かれ、「メール作成画面が開く」とは書かない");
  }
  { // 自動取得
    const d = sub("auto", { SOURCES_FILE: "tests/fixtures/sources.auto.json" }); const s = text(join(d, "disclaimer.html"));
    ok(s.includes("プログラムによる自動取得と、自動掲載") && s.includes("テスト観光協会") && !s.includes("停止中の収集元") && !s.includes("規約未確認の収集元"), "自動取得が有効な収集元(規約確認済み・有効)だけが、免責事項に載る");
    ok(s.includes("自動の検査") && s.includes("運営者の確認を待たずに自動で掲載します") && s.includes("自動で取り下げます") && s.includes("robots.txt") && s.includes("すべての誤りを防げるわけではありません"), "自動掲載の内容(検査・確認を待たない・自動の取り下げ)と、検査の限界・robots.txt の遵守が、書かれている");
    ok(!s.includes("自動で取得して掲載することはしていません") && !s.includes("自動では公開せず"), "自動取得が有効なときは、「行っていません」「自動では公開せず」の記載が消える");
  }
  { // 自動取得は有効だが、自動掲載はオフ(確認してから掲載)
    const d = sub("autooff", { SOURCES_FILE: "tests/fixtures/sources.auto.json", TEST_AUTOPUBLISH: "0" }); const s = text(join(d, "disclaimer.html"));
    ok(s.includes("プログラムによる自動取得") && !s.includes("と、自動掲載") && s.includes("自動では公開せず、運営者が確認してから掲載します") && !s.includes("運営者の確認を待たずに"), "自動掲載をオフにすると、「自動では公開せず、確認してから掲載」の文面になる");
  }
  { // 自動取得の収集元が、1つもないとき
    const s = text(join(sub("none", {}), "disclaimer.html"));
    ok(s.includes("自動で取得して掲載することはしていません") && !s.includes("運営者の確認を待たずに"), "自動取得の収集元が、1つも有効でない間は、「行っていません」と書く");
  }
  ok(active.length
    ? ds.includes("プログラムによる自動取得") && active.every((x) => ds.includes(x.name)) && real.filter((x) => !active.includes(x)).every((x) => !ds.includes(x.name)) && !ds.includes("行っていません")
    : ds.includes("自動で取得して掲載することはしていません"),
  `本番の収集元の設定と、免責事項の記載が、一致している(有効な収集元 ${active.length} 件が、すべて載り、無効なものは載らない)`);
  for (const n of ["ads", "ga", "aff", "form", "auto", "autooff", "none", "noform"]) rmSync(`${D}-${n}`, { recursive: true, force: true });

  section("CSP: 外部サービスが必要とする許可");
  const dirOf = (csp, k) => (csp.split(";").map((x) => x.trim()).find((x) => x.startsWith(k + " ")) ?? "").split(/\s+/).slice(1);
  const page = '<html><head><style>body{}</style><script>var a</script></head></html>';
  const base = { form: {}, adsense: {} };
  const plain = cspFor(page, base), cb = cspFor(page, { ...base, cookiebotId: "x" }), ad = cspFor(page, { ...base, adsense: { client: "ca-pub-1" } });
  ok(dirOf(plain, "style-src-elem").length === 0 && !dirOf(plain, "style-src").includes("'unsafe-inline'"), "同意管理を使わない間は、<style> もハッシュだけで許可する");
  ok(dirOf(cb, "style-src-elem").includes("'unsafe-inline'") && !dirOf(cb, "style-src-elem").some((x) => x.startsWith("'sha256-")), "Cookiebot を使うときは、同意バナーの <style> を許可する(ハッシュがあると unsafe-inline が無視されるので、<style> 用の指定にハッシュを入れない)");
  ok(!dirOf(cb, "script-src").includes("'unsafe-inline'") && dirOf(cb, "script-src").some((x) => x.startsWith("'sha256-")), "Cookiebot を使っても、スクリプトはハッシュで許可したまま(緩めない)");
  ok(["script-src", "frame-src", "connect-src"].every((k) => dirOf(ad, k).includes("https:")) && ["script-src", "frame-src", "connect-src"].every((k) => !dirOf(plain, k).includes("https:")), "AdSense を使うときだけ、スクリプト・埋め込み・通信を HTTPS なら許可する(Google はドメインの許可リストに対応していないため)");
}
