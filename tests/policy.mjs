// プライバシーポリシー・免責事項のテスト
//  「文面」と「実際の動作」が、食い違っていないことを、機械的に確かめる。
//   - サイトが実際に通信できる外部(CSPの許可リスト)は、すべて、ポリシーに載っているか
//   - ブラウザに保存するもの(Cookie / localStorage / sessionStorage)は、ポリシーの記載と同じか
//   - 広告・解析・アフィリエイト・フォーム送信先・自動取得を、有効にしたときだけ、その項目が現れるか
import { readFileSync, existsSync, readdirSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";

const read = (p) => readFileSync(p, "utf8");
const text = (f) => { const $ = cheerio.load(read(f)); $("script,style").remove(); return $("main").text().replace(/\s+/g, " "); };
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const cspOf = (f) => cheerio.load(read(f))('meta[http-equiv="Content-Security-Policy"]').attr("content") ?? "";

export function policyTests({ ok, section, OUT, build }) {
  const cfg = JSON.parse(read("config.json").replace(/^﻿/, ""));
  const D = "dist-test-policy";
  const sub = (name, env) => { const r = build("tests/fixtures/events.test.json", `${D}-${name}`, { SOURCES_FILE: "tests/fixtures/sources.empty.json", ...env }); ok(r.status === 0, `ポリシー検査用ビルド(${name})`, r.stderr); return `${D}-${name}`; };

  section("ポリシー: 基本の項目");
  const pv = text(join(OUT, "privacy.html")), ds = text(join(OUT, "disclaimer.html"));
  for (const h of ["運営者", "取得する情報", "利用目的", "外部サービスの利用と、情報の送信", "投稿フォーム・お問い合わせフォームについて", "第三者への提供", "保存期間", "開示・訂正・削除", "この方針の改定"]) ok(pv.includes(h), `プライバシーポリシーに「${h}」の項目がある`);
  ok(pv.includes("迷惑投稿") && pv.includes("個人情報の保護に関する法律"), "迷惑投稿対策と、関係する法令への言及がある");
  ok(pv.includes(`最終更新: ${cfg.operator.updated}`) && (cfg.privacy.history ?? []).length >= 2 && (cfg.privacy.history ?? []).every((x) => pv.includes(x.slice(0, 12))), "最終更新日と、改定の履歴が出る");
  ok(/12か月/.test(pv) || pv.includes(cfg.privacy.retention.slice(0, 8)), "保存期間が書かれている");
  ok(pv.includes(cfg.operator.name), "運営者の名前が出る");
  for (const h of ["掲載情報は、変更されることがあります", "情報の集め方と、自動処理について", "掲載の権利と、掲載の停止", "お出かけの際の注意", "外部のサイト・広告・リンクについて", "損害についての責任", "準拠法"]) ok(ds.includes(h), `免責事項に「${h}」の項目がある`);
  ok(ds.includes("国土地理院") && ds.includes("おおよその位置") && ds.includes("開始から3時間"), "免責事項に、位置情報の自動付与・日時の自動処理の説明がある");
  ok(ds.includes("故意または重大な過失がある場合を除き"), "免責の範囲に、法令上の例外(故意・重過失)を明記している");
  ok(ds.includes("確認してから掲載") && ds.includes("事実の情報"), "掲載前の確認と、事実の情報だけを載せることが書かれている");
  ok(/掲載を望まない場合/.test(ds) && /速やかに/.test(ds), "掲載停止・訂正の請求の窓口と、対応の約束がある");
  for (const f of ["index.html", "events/t-full.html", "regular/r-nightly.html", "about.html", "disclaimer.html", "privacy.html"]) {
    const $ = cheerio.load(read(join(OUT, f)));
    ok($("footer a[href='/disclaimer.html']").length === 1 && $("footer a[href='/privacy.html']").length === 1, `${f}: フッターに、免責事項とプライバシーポリシーのリンク`);
  }
  ok(cheerio.load(read(join(OUT, "events/t-full.html")))("a[href='/disclaimer.html']").length >= 2, "開催の詳細に、免責事項へのリンクがある(出典の注記と、旅の案内)");
  ok(read(join(OUT, "sitemap.xml")).includes("/disclaimer.html"), "サイトマップに免責事項が入る");
  ok(cheerio.load(read(join(OUT, "privacy.html")))("table.tbl").closest(".tblwrap").length === 1, "表は、横にスクロールできる枠に入る(スマホではみ出さない)");

  section("ポリシー: 実際の動作との一致");
  // (1) 通信できる外部は、すべてポリシーに載っている
  const names = { "unpkg.com": "unpkg", "tile.openstreetmap.org": "OpenStreetMap", "fonts.googleapis.com": "Google Fonts", "fonts.gstatic.com": "Google Fonts" };
  const origins = new Set();
  for (const f of walk(OUT).filter((x) => x.endsWith(".html"))) for (const d of ["script-src", "style-src", "img-src", "font-src", "connect-src", "frame-src"]) for (const tok of (cspOf(f).split(";").map((s) => s.trim()).find((s) => s.startsWith(d + " ")) ?? "").split(/\s+/).slice(1)) if (/^https:\/\//.test(tok)) origins.add(new URL(tok).hostname);
  ok(origins.size >= 3, "通信できる外部が、CSPから読み取れる", [...origins].join(","));
  for (const host of origins) ok(!!names[host] && pv.includes(names[host]), `通信できる外部 ${host} が、ポリシーの外部送信の表に載っている`);
  ok(pv.includes("GitHub Pages"), "配信元(GitHub Pages)が、ポリシーに載っている");
  // (2) ブラウザに保存するものは、ポリシーの記載と同じ
  const pages = walk(OUT).filter((x) => x.endsWith(".html"));
  const keys = new Set(), bad = [];
  for (const f of pages) for (const m of read(f).matchAll(/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g)) {
    const s = m[1];
    if (/document\.cookie|localStorage|indexedDB/.test(s)) bad.push(f);
    for (const k of s.matchAll(/sessionStorage\.(?:get|set)Item\('([^']+)'/g)) keys.add(k[1]);
  }
  ok(bad.length === 0, "Cookie・localStorage・IndexedDB を使っていない(使うなら、ポリシーの更新が必要)", bad.join(","));
  ok([...keys].sort().join() === "intro,lastSend", "保存するのは sessionStorage の intro と lastSend だけ(ポリシーの記載と同じ)", [...keys].join(","));
  ok(pv.includes("Cookie(クッキー)を設定しません") && pv.includes("セッションストレージ") && pv.includes("外部には送られません"), "ポリシーに、Cookieを設定しないこと・セッションストレージの2項目・外部に送らないことが書かれている");
  // (3) 画面に出す「広告・アフィリエイト」の表示は、実態に合っている
  const ev = cheerio.load(read(join(OUT, "events/t-full.html")));
  ok(ev(".afflist a[href]").length === 3 && ev(".afflist a[rel~=sponsored]").length === 0 && ev(".aff .meta").text().includes("外部のサービスへのリンク") && !ev(".aff .meta").text().includes("アフィリエイトリンクを含みます"), "アフィリエイト未設定の間は、「外部のサービスへのリンク」と表示し、sponsored を付けない");
  ok(pv.includes("現在、当サイトの閲覧に関するアクセスログ") && !pv.includes("Google AdSense") && !pv.includes("Googleアナリティクス") && !pv.includes("アフィリエイトプログラムに参加"), "広告・解析・アフィリエイト未設定の間は、それらを「使っている」と書かない");
  ok(ds.includes("アフィリエイト(成果報酬)の契約を結んでおらず"), "免責事項に、現在、成果報酬を得ていないことが書かれている");
  ok(text(join(OUT, "about.html")).includes("収益を、得ていません"), "運営者情報にも、現在は収益を得ていないことが書かれている");

  section("ポリシー: 設定を有効にしたときだけ、項目が現れる");
  { // 広告
    const d = sub("ads", { TEST_ADSENSE: "ca-pub-0000000000000000" }); const p = text(join(d, "privacy.html")), s = text(join(d, "disclaimer.html")), a = text(join(d, "about.html"));
    ok(p.includes("Google AdSense") && p.includes("myadcenter.google.com") || read(join(d, "privacy.html")).includes("myadcenter.google.com"), "広告を設定すると、AdSenseの項目(広告設定へのリンクつき)が現れる");
    ok(p.includes("Google AdSense(Google LLC)") && /広告を表示するページ/.test(p), "広告を設定すると、外部送信の表に AdSense が加わる");
    ok(s.includes("第三者が配信する広告") && a.includes("広告(Google AdSense)による収益"), "広告を設定すると、免責事項と運営者情報も、変わる");
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
    ok($(".afflist a[rel~=sponsored]").length === 3 && $(".aff .meta").text().includes("アフィリエイトリンクを含みます"), "アフィリエイトを設定すると、リンクに sponsored が付き、表示が「広告・アフィリエイトリンクを含みます」に変わる");
  }
  { // フォーム送信先
    const d = sub("form", { TEST_FORM_ENDPOINT: "https://forms.example.test/submit", TEST_FORM_PROVIDER: "テスト送信サービス" }); const p = text(join(d, "privacy.html"));
    ok(p.includes("テスト送信サービス") && /フォームを送信したとき/.test(p) && p.includes("委託しています"), "フォームの送信先を設定すると、サービス名・外部送信の行・委託の記載が現れる");
    ok(!p.includes("メールの作成画面が開きます"), "フォームの送信先を設定すると、「メール作成画面が開く」という記載は消える");
    ok(pv.includes("メールの作成画面が開きます") && !pv.includes("委託しています"), "送信先が未設定の間は、「メールの作成画面が開く」と書き、委託とは書かない");
  }
  { // 自動取得
    const d = sub("auto", { SOURCES_FILE: "tests/fixtures/sources.auto.json" }); const s = text(join(d, "disclaimer.html"));
    ok(s.includes("プログラムによる補助的な取得") && s.includes("テスト観光協会") && !s.includes("停止中の収集元") && !s.includes("規約未確認の収集元"), "自動取得が有効な収集元(規約確認済み・有効)だけが、免責事項に載る");
    ok(s.includes("自動では公開せず、運営者が確認してから掲載します") && s.includes("robots.txt"), "取得した情報は、自動では公開せず、確認してから掲載することと、robots.txt を守ることが書かれている");
    ok(!s.includes("自動で取得して掲載することは、行っていません"), "自動取得が有効なときは、「行っていません」の記載が消える");
  }
  ok(ds.includes("自動で取得して掲載することは、行っていません"), "自動取得の収集元が、1つも有効でない間は、「行っていません」と書く(現在の実態)");
  const real = existsSync("data/sources.json") ? JSON.parse(read("data/sources.json").replace(/^﻿/, "")) : [];
  ok(real.filter((x) => x.enabled !== false && x.termsChecked).length === 0 ? ds.includes("行っていません") : ds.includes("補助的な取得"), "本番の収集元の設定と、免責事項の記載が、一致している");
  for (const n of ["ads", "ga", "aff", "form", "auto"]) rmSync(`${D}-${n}`, { recursive: true, force: true });
}
