// 写真・動画のテスト: 神楽の種類のページへの掲載 / 再生ボタン(押すまで YouTube に接続しない) / CSP とポリシーの一致 /
// 掲載を始める日と利用規約の予告 / 不正なデータの検査 / 管理者用ページの追加・掲載をやめる・公開
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync, readdirSync, statSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import { youtubeId, webpSize, creditLabel, takenLabel, checkMediaItem, mediaState, checkMediaConfig, pickMediaFields } from "../scripts/lib/media.mjs";
import { startAdmin } from "../scripts/admin/server.mjs";
import { publish, findGit, MEDIA } from "../scripts/admin/publish.mjs";

const read = (p) => readFileSync(p, "utf8");
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const cspOf = (html) => cheerio.load(html)('meta[http-equiv="Content-Security-Policy"]').attr("content") ?? "";
const dir = (csp, name) => (csp.split(";").map((x) => x.trim()).find((x) => x.startsWith(name + " ")) ?? "").split(/\s+/).slice(1);
const sha = (s) => `'sha256-${createHash("sha256").update(s, "utf8").digest("base64")}'`;
const text = (html) => { const $ = cheerio.load(html); $("script,style").remove(); return $("main").text().replace(/\s+/g, " "); };
const FIX = "tests/fixtures/media";
const FORM = "https://forms.gle/testForm123";

export async function mediaTests({ ok, section, build }) {
  // 写真のファイル(本物の WebP。Chromium の canvas で作ったもの)を、テスト用の置き場所に用意する
  const T = mkdtempSync(join(tmpdir(), "kagura-media-"));
  const ASSETS = join(T, "assets");
  mkdirSync(ASSETS);
  for (const id of ["p-orochi", "p-official", "p-anon"]) { copyFileSync(join(FIX, "large.webp"), join(ASSETS, `${id}.webp`)); copyFileSync(join(FIX, "small.webp"), join(ASSETS, `${id}-s.webp`)); }
  // 掲載をやめた写真のファイルは、置き場所に残っていても、サイトには出さない
  copyFileSync(join(FIX, "large.webp"), join(ASSETS, "p-gone.webp")); copyFileSync(join(FIX, "small.webp"), join(ASSETS, "p-gone-s.webp"));
  const env = (start, extra = {}) => ({ MEDIA_FILE: "tests/fixtures/media.test.json", MEDIA_DIR: ASSETS, TEST_MEDIA_START: start, TEST_MEDIA_FORM: FORM, SOURCES_FILE: "tests/fixtures/sources.empty.json", ...extra });
  try {
    section("写真・動画: 神楽の種類のページに掲載する");
    const OUT = "dist-test-media";
    let r = build("tests/fixtures/events.test.json", OUT, env("2026-10-01"));
    ok(r.status === 0, "写真・動画のあるデータでビルドできる", r.stderr);
    ok(/v-unknown.*ページがないため/.test(r.stderr), "種類のページがない神楽の写真・動画は、表示せずに知らせる", r.stderr);
    const rd = (f) => read(join(OUT, f));
    const iwami = rd("kagura/石見神楽.html"), $ = cheerio.load(iwami);
    const items = $(".media .media-grid > li");
    ok(items.length === 3, "掲載中の写真・動画だけが並ぶ(掲載をやめたもの・ほかの種類のものは出ない)", `${items.length}件`);
    ok(items.eq(0).find("button.yt-play").attr("data-yt") === "AbCdEfGhIj0" && items.eq(1).find("img").attr("src") === "/media/p-orochi-s.webp" && items.eq(2).find("img").attr("src") === "/media/p-official-s.webp", "新しく受け付けたものから並ぶ");
    ok($(".media").prevAll("section.about").length === 1, "「〇〇とは」の解説のあとに置く");
    ok(!iwami.includes("出てはいけない") && !existsSync(join(OUT, "media/p-gone.webp")) && !existsSync(join(OUT, "media/p-gone-s.webp")), "掲載をやめた写真は、ページにもファイルにも出さない");
    ok(!walk(OUT).some((f) => f.endsWith(".html") && read(f).includes("ページのない種類")), "種類のページがない神楽の動画は、どのページにも出ない");
    const img = items.eq(1).find("img");
    ok(img.attr("loading") === "lazy" && img.attr("width") === "64" && img.attr("height") === "48" && img.attr("alt") === "大蛇が火を噴く場面" && img.attr("srcset").includes("/media/p-orochi.webp 1600w"), "写真: 遅れて読み込む・大きさを指定・読み上げ用の説明・大小の画像", img.toString());
    ok(items.eq(1).find("a").attr("href") === "/media/p-orochi.webp" && ["p-orochi", "p-official"].every((id) => existsSync(join(OUT, `media/${id}.webp`)) && existsSync(join(OUT, `media/${id}-s.webp`))), "写真を押すと大きい画像を開き、掲載中の写真のファイルは出力される");
    ok(items.eq(1).find(".m-credit").text() === "撮影: 山田" && items.eq(2).find(".m-credit").text() === "提供: テスト社中" && items.eq(0).find(".m-credit").text() === "提供: テスト社中", "表示する名前: 一般の方は「撮影: 名前」、団体は「提供: 団体名」");
    ok(cheerio.load(rd("kagura/高千穂神楽.html"))(".m-credit").text() === "読者提供", "名前を載せない一般の方は「読者提供」");
    ok(items.eq(1).find("figcaption").text().includes("浜田市・テスト神社・2026年10月"), "撮影した場所と時期を添える");
    ok(!iwami.includes("<script>alert(1)") && iwami.includes("&lt;script&gt;alert(1)"), "説明の悪意ある文字は、そのまま出力しない");

    section("写真・動画: 再生ボタン(押すまで YouTube に接続しない)");
    ok($("iframe").length === 0 && !/youtube(-nocookie)?\.com\/embed/.test(iwami.replace(/<script>[\s\S]*?<\/script>/g, "")) && !/i\.ytimg\.com|img\.youtube\.com/.test(iwami), "ページを開いただけでは、YouTube の再生画面も、見本の画像も読み込まない");
    const yt = items.eq(0);
    ok(yt.find("button.yt-play").attr("type") === "button" && yt.find(".yt-t").text() === "大蛇の舞(テスト)" && yt.find("small").text().includes("YouTube に接続"), "再生ボタンには、題名と、押すと YouTube に接続することを書く");
    ok(yt.find('a[href="https://www.youtube.com/watch?v=AbCdEfGhIj0"]').attr("rel") === "noopener" && yt.find("a").attr("target") === "_blank", "スクリプトが動かなくても、YouTube で見るリンクがある");
    const scripts = $("script:not([src]):not([type='application/ld+json'])").map((_, el) => $(el).html()).get();
    const mediaJs = scripts.find((s) => s.includes("youtube-nocookie.com/embed/"));
    ok(!!mediaJs && dir(cspOf(iwami), "script-src").includes(sha(mediaJs)), "再生ボタンのスクリプトは、CSP のハッシュで許可されている");
    ok(!cheerio.load(rd("kagura/高千穂神楽.html"))("script").toArray().some((el) => cheerio.load(el).text().includes("youtube-nocookie")), "動画のないページには、再生ボタンのスクリプトを入れない");
    {
      const dom = new JSDOM(`<!doctype html><body>${$(".media").toString()}<button class="yt-play" data-yt="bad&quot;id" id="bad">x</button></body>`, { runScripts: "outside-only" });
      dom.window.eval(mediaJs);
      dom.window.document.getElementById("bad").click();
      ok(dom.window.document.querySelectorAll("iframe").length === 0, "形の正しくない動画の ID では、何も読み込まない");
      dom.window.document.querySelector("button.yt-play[data-yt]").click();
      const f = dom.window.document.querySelector(".yt-box iframe");
      ok(f && f.src === "https://www.youtube-nocookie.com/embed/AbCdEfGhIj0?autoplay=1&rel=0&playsinline=1" && f.title === "大蛇の舞(テスト)(YouTube)" && f.getAttribute("referrerpolicy") === "strict-origin-when-cross-origin" && !dom.window.document.querySelector("button.yt-play[data-yt='AbCdEfGhIj0']"), "押すと、プライバシー強化モード(youtube-nocookie.com)の再生画面に置き換わる", f?.outerHTML);
    }

    section("写真・動画: CSP と、ポリシーの外部送信の表");
    ok(dir(cspOf(iwami), "frame-src").join() === "https://www.youtube-nocookie.com", "動画のあるページだけ、YouTube(プライバシー強化モード)の埋め込みを許可する", dir(cspOf(iwami), "frame-src").join());
    for (const f of ["kagura/高千穂神楽.html", "index.html", "photos.html", "privacy.html"]) ok(dir(cspOf(rd(f)), "frame-src").join() === "'none'", `${f}: 動画のないページは、埋め込みを許可しない`);
    ok(dir(cspOf(iwami), "img-src").filter((x) => /^https:/.test(x)).every((x) => !/youtube|ytimg/.test(x)), "画像の許可に、YouTube を足さない");
    const pv = text(rd("privacy.html"));
    const hosts = new Set(walk(OUT).filter((f) => f.endsWith(".html")).flatMap((f) => dir(cspOf(read(f)), "frame-src")).filter((x) => /^https:/.test(x)).map((x) => new URL(x).hostname));
    ok(hosts.has("www.youtube-nocookie.com") && pv.includes("YouTube(Google LLC。埋め込みの配信先: www.youtube-nocookie.com)") && pv.includes("動画の再生ボタンを押したとき(押すまでは接続しません)"), "埋め込みを許可した YouTube が、外部送信の表に、送られるときとともに載っている");

    section("写真・動画: 送り方のページと、ポリシー");
    const ph = cheerio.load(rd("photos.html"));
    const formLink = ph(`a[href="${FORM}"]`);
    ok(formLink.length === 1 && formLink.attr("target") === "_blank" && formLink.attr("rel") === "noopener" && ph("main").text().includes("Google アカウントへのログインが必要"), "送り方のページ: Google フォームへのリンク(新しいタブ)と、ログインが必要なこと");
    ok(["ご自身で撮影したもの", "撮影や公開が禁止・制限されている", "舞い手以外の人の顔", "動画のファイルは受け付けていません", "Exif", "読者提供"].every((t) => ph("main").text().includes(t)), "送り方のページ: 送る前の3つの確認・動画は URL だけ・Exif の削除・名前の表示");
    ok(rd("sitemap.xml").includes("/photos.html</loc><lastmod>2026-10-01</lastmod>") && $('a[href="/photos.html"]').length === 1 && rd("submit.html").includes('href="/photos.html"'), "送り方のページは、サイトマップ・種類のページ・掲載の依頼のページからたどれる");
    ok(cheerio.load(rd("kagura/備中神楽.html"))('a[href="/photos.html"]').length === 1 && cheerio.load(rd("kagura/備中神楽.html"))(".media").length === 0, "写真のない種類のページにも、募集の案内だけを出す");
    ok(["Google フォーム", "Google アカウントの名前", "Exif", "アメリカ合衆国", "個人情報保護法28条", "Google ドライブから削除します", "掲載した写真・動画の掲載をやめるご希望"].every((t) => pv.includes(t)), "プライバシーポリシー: 受け付けのサービス・外国の事業者・Exif の削除・元のファイルの削除・掲載をやめる窓口");
    ok(pv.includes("2026年10月1日 写真・動画の提供の受け付け") && pv.includes("最終更新: 2026年11月2日"), "改定の履歴に、始めた日を載せる(最終更新は、新しいほうの日)");
    const tm = text(rd("terms.html"));
    ok(tm.includes("(写真・動画の提供)") && !tm.includes("から適用します") && ["著作権は、提供者", "著作者人格権を行使しない", "舞い手以外の人の顔", "速やかに掲載をやめます", "読者提供"].every((t) => tm.includes(t)), "利用規約: 写真・動画の提供の条(保証・許諾の範囲・名前の表示・掲載をやめる申し出)");
    const ds = text(rd("disclaimer.html"));
    ok(ds.includes("許可なく転載しません") && ds.includes("提供と掲載の許諾を受けたものだけ"), "免責事項: 写真は、許諾を受けたものだけを、提供者の表示とともに載せる");
    const ld = $('script[type="application/ld+json"]').map((_, el) => $(el).html()).get().join("");
    ok(ld.includes('"@type":"ImageObject"') && ld.includes('"creditText":"撮影: 山田"') && ld.includes("/media/p-orochi.webp"), "構造化データで、写真の提供者の表示を伝える");

    section("写真・動画: 始める日より前は、利用規約の予告だけ");
    const PRE = "dist-test-media-pre";
    r = build("tests/fixtures/events.test.json", PRE, env("2026-12-01"));
    ok(r.status === 0, "始める日より前の設定でビルドできる", r.stderr);
    const pre = (f) => read(join(PRE, f));
    ok(!pre("kagura/石見神楽.html").includes('class="media') && !existsSync(join(PRE, "media")) && !existsSync(join(PRE, "photos.html")) && !pre("sitemap.xml").includes("photos.html") && !pre("submit.html").includes("/photos.html"), "始める日より前は、写真・動画も、送り方のページも出さない");
    ok(text(pre("terms.html")).includes("(写真・動画の提供)") && text(pre("terms.html")).includes("本条は、2026年12月1日から適用します。"), "利用規約には、効力が生じる日より前から、新しい条と適用する日を載せる(規約の変更の条のとおり)");
    ok(!text(pre("privacy.html")).includes("YouTube") && !text(pre("privacy.html")).includes("Google フォーム") && !text(pre("disclaimer.html")).includes("許可なく転載"), "プライバシーポリシー・免責事項は、始めた日から変わる(動いていないものを書かない)");
    ok(walk(PRE).filter((f) => f.endsWith(".html")).every((f) => dir(cspOf(read(f)), "frame-src").join() === "'none'"), "始める日より前は、どのページも埋め込みを許可しない");

    section("写真・動画: 設定がないときは、何も変えない");
    const OFF = "dist-test-media-off";
    r = build("tests/fixtures/events.test.json", OFF, env("", { TEST_MEDIA_FORM: "" }));
    ok(r.status === 0 && !text(read(join(OFF, "terms.html"))).includes("写真・動画の提供") && !read(join(OFF, "kagura/石見神楽.html")).includes('class="media') && !existsSync(join(OFF, "photos.html")), "media.start が空の間は、規約・ページとも、これまでどおり", r.stderr);
    r = build("tests/fixtures/events.test.json", OFF, env("2026-10-01", { TEST_MEDIA_FORM: "" }));
    ok(r.status === 0 && read(join(OFF, "kagura/石見神楽.html")).includes('class="media') && !existsSync(join(OFF, "photos.html")) && !read(join(OFF, "kagura/石見神楽.html")).includes("/photos.html"), "受付のフォームがなくても、写真・動画は載せられる(送り方のページは出さない)", r.stderr);

    section("写真・動画: 不正なデータ・設定は、ビルドを止める");
    const base = JSON.parse(read("tests/fixtures/media.test.json"));
    const bad = (name, list, extra = {}, expect) => {
      const f = join(T, `bad-${name}.json`); writeFileSync(f, JSON.stringify(list));
      const x = build("tests/fixtures/events.test.json", "dist-test-media-bad", { ...env("2026-10-01"), MEDIA_FILE: f, ...extra });
      ok(x.status !== 0 && expect.test(x.stderr), `止める: ${name}`, x.stderr.slice(0, 300));
    };
    bad("動画の ID の形", [{ ...base[4], youtube: "x\"><script>" }], {}, /YouTube の動画の URL/);
    bad("写真のファイルがない", [{ ...base[0], id: "p-missing" }], {}, /p-missing\.webp がありません/);
    bad("ID の重複", [base[0], base[0]], {}, /id が重複/);
    bad("ID の形(ファイル名に使えない)", [{ ...base[0], id: "../x" }], {}, /ID は英小文字/);
    bad("団体なのに団体名がない", [{ ...base[1], credit: "" }], {}, /団体名を入れて/);
    bad("写真の説明がない", [{ ...base[0], alt: "" }], {}, /読み上げ用/);
    bad("Google フォーム以外の受付先", [], { TEST_MEDIA_FORM: "https://evil.example/forms/x" }, /Google フォームの URL/);
    bad("javascript: の受付先", [], { TEST_MEDIA_FORM: "javascript:alert(1)" }, /Google フォームの URL/);
    bad("始める日の形", [], { TEST_MEDIA_START: "12月1日" }, /media\.start は YYYY-MM-DD/);
    bad("受付先だけで、始める日がない", [], { TEST_MEDIA_START: "" }, /media\.start\(掲載・受付を始める日\)も/);

    section("写真・動画: 部品");
    const yid = "AbCdEfGhIj0";
    ok([`https://www.youtube.com/watch?v=${yid}&t=30s`, `https://youtu.be/${yid}?si=x`, `https://www.youtube.com/shorts/${yid}`, `https://www.youtube.com/embed/${yid}`, `https://www.youtube-nocookie.com/embed/${yid}`, `https://m.youtube.com/watch?v=${yid}`, `https://www.youtube.com/live/${yid}`, yid].every((u) => youtubeId(u) === yid), "YouTube の いろいろな形の URL から、動画の ID を取り出す");
    ok(["https://evil.example/watch?v=AbCdEfGhIj0", "https://www.youtube.com/watch?v=short", "javascript:alert(1)", "https://youtube.com.evil.example/watch?v=AbCdEfGhIj0", ""].every((u) => youtubeId(u) === ""), "YouTube 以外・形の違う ID は、受け付けない");
    const riff = (chunk, body) => { const b = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.from(chunk), body]); b.writeUInt32LE(b.length - 8, 4); return b; };
    const vp8 = Buffer.alloc(20); vp8.set([0x9d, 0x01, 0x2a], 7); vp8.writeUInt16LE(640, 10); vp8.writeUInt16LE(480, 12);
    const vp8l = Buffer.alloc(20); vp8l[4] = 0x2f; vp8l.writeUInt32LE((1599) | (899 << 14), 5);
    ok(JSON.stringify(webpSize(riff("VP8 ", vp8))) === '{"width":640,"height":480}' && JSON.stringify(webpSize(riff("VP8L", vp8l))) === '{"width":1600,"height":900}' && JSON.stringify(webpSize(readFileSync(join(FIX, "large.webp")))) === '{"width":64,"height":48}', "WebP の大きさを、ファイルの中身から読む(VP8 / VP8L / VP8X)");
    const png = readFileSync("assets/favicon-48.png"), real = readFileSync(join(FIX, "large.webp"));
    ok(webpSize(png) === null && webpSize(real.subarray(0, real.length - 10)) === null && webpSize(Buffer.concat([real, Buffer.from("<script>")])) === null, "WebP でないもの・途中で切れたもの・後ろに何か付いたものは、受け付けない");
    ok(creditLabel({ provider: "reader" }) === "読者提供" && creditLabel({ provider: "reader", credit: "A" }) === "撮影: A" && creditLabel({ provider: "official", credit: "B社中" }) === "提供: B社中" && takenLabel("2026-11") === "2026年11月" && takenLabel("2026-11-03") === "2026年11月3日" && takenLabel("x") === "", "表示する名前と、撮影の時期の表示");
    ok(Object.keys(checkMediaItem(base[0])).length === 0 && Object.keys(checkMediaItem(base[4])).length === 0, "正しいデータは、そのまま通る");
    ok(mediaState({ media: { start: "2026-11-10", formUrl: FORM } }, "2026-11-09").live === false && mediaState({ media: { start: "2026-11-10", formUrl: FORM } }, "2026-11-10").formOpen === true && mediaState({}, "2026-11-10").on === false, "始める日の当日から表示し、受け付ける(日本時間)");
    ok(checkMediaConfig({ media: { start: "", formUrl: "" } }).length === 0 && checkMediaConfig({ media: { start: "2026-11-10", formUrl: "https://docs.google.com/forms/d/e/abc/viewform" } }).length === 0, "空の設定と、Google フォームの URL は通る");
    const picked = pickMediaFields({ kind: "photo", id: "m-1", kagura: "石見神楽", alt: "a\u0000b", provider: "x", status: "withdrawn", width: 99999, file: "../../etc", youtube: yid });
    ok(picked.provider === "reader" && !("status" in picked) && !("width" in picked) && !("file" in picked) && !("youtube" in picked) && picked.alt === "a b", "画面からの入力は、決まった項目だけを、整えて取り込む");
  } finally {
    rmSync(T, { recursive: true, force: true });
    for (const d of ["dist-test-media", "dist-test-media-pre", "dist-test-media-off", "dist-test-media-bad"]) rmSync(d, { recursive: true, force: true });
  }

  await adminMediaTests({ ok, section });
}

async function adminMediaTests({ ok, section }) {
  section("管理者用ページ: 写真・動画の追加と、掲載をやめる");
  const ROOT = "tests/.tmp-admin-media";
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(join(ROOT, "data"), { recursive: true });
  copyFileSync("config.json", join(ROOT, "config.json"));
  writeFileSync(join(ROOT, "data/events.json"), JSON.stringify([{ id: "a-1", name: "A", kagura: "石見神楽", prefecture: "島根県", start: "2026-11-01T18:00", status: "published" }, { id: "a-2", name: "B", kagura: "取り下げた種類", prefecture: "島根県", start: "2026-11-01T18:00", status: "withdrawn" }]));
  writeFileSync(join(ROOT, "data/regular.json"), JSON.stringify([{ id: "r-1", name: "R", kagura: "高千穂神楽", status: "published" }]));
  const published = [];
  const { server, token, url } = await startAdmin({ root: ROOT, port: 0, today: () => "2026-11-05", geocode: async () => "",
    publisher: async (root, msg, opts) => { published.push({ msg, paths: opts?.paths }); return { ok: true, commit: "abc1234" }; }, pending: async () => ({ uncommitted: false, unpushed: 0 }), fetchMails: async () => [] });
  const port = new URL(url).port;
  const req = async (path, { body, headers = {}, raw } = {}) => {
    const r = await fetch(`http://127.0.0.1:${port}${path}`, { method: body || raw ? "POST" : "GET", headers: { "x-admin-token": token, ...(body || raw ? { "content-type": "application/json" } : {}), ...headers }, body: raw ?? (body ? JSON.stringify(body) : undefined) });
    const buf = Buffer.from(await r.arrayBuffer());
    let json = null; try { json = JSON.parse(buf.toString("utf8")); } catch {}
    return { status: r.status, type: r.headers.get("content-type"), buf, json };
  };
  const b64 = (f) => readFileSync(join(FIX, f)).toString("base64");
  const photos = { large: b64("large.webp"), small: b64("small.webp") };
  const media = () => JSON.parse(read(join(ROOT, "data/media.json")));
  try {
    let r = await req("/api/state");
    ok([...r.json.mediaKaguras].sort().join() === ["石見神楽", "高千穂神楽"].sort().join() && r.json.mediaId === "m-20261105-1" && r.json.mediaCfg.sizes.large === 1600, "選べる神楽の種類は、サイトに種類のページがあるものだけ。ID の候補は受付日から", JSON.stringify(r.json.mediaKaguras));
    const item = { kind: "photo", kagura: "石見神楽", alt: "大蛇の舞", caption: "演目「大蛇」", provider: "reader", credit: "山田", taken: "2026-10", status: "withdrawn", width: 5000, height: 1, extra: "x" };
    r = await req("/api/media/save", { body: { item, photos } });
    const saved = media()[0];
    ok(r.status === 200 && saved?.id === "m-20261105-1" && saved.status === "published" && saved.width === 64 && saved.height === 48 && !("extra" in saved) && saved.received === "2026-11-05", "写真の追加: 大きさは届いたファイルの中身から読み、画面にない項目(状態など)は持ち込ませない", JSON.stringify(saved));
    ok(readFileSync(join(ROOT, "assets/media/m-20261105-1.webp")).equals(readFileSync(join(FIX, "large.webp"))) && existsSync(join(ROOT, "assets/media/m-20261105-1-s.webp")), "写真の大小のファイルを、assets/media に置く");
    ok(published.length === 1 && published[0].msg === "data(admin): 写真・動画 追加: 石見神楽 m-20261105-1" && published[0].paths.join() === MEDIA.join(), "追加すると、写真のファイルとデータを、いっしょにコミットして push する", JSON.stringify(published));
    r = await req("/media/m-20261105-1-s.webp");
    ok(r.status === 200 && r.type === "image/webp" && r.buf.equals(readFileSync(join(FIX, "small.webp"))), "一覧の見本として、写真を表示できる");
    for (const p of ["/media/..%2Fconfig.json", "/media/../config.json", "/media/m-20261105-1.png", "/media/M.webp"]) ok((await req(p)).status === 404, `決まった形の写真のファイルだけを読む(${p})`);
    r = await req("/api/media/save", { body: { item: { ...item, id: "m-png" }, photos: { large: readFileSync("assets/favicon-48.png").toString("base64"), small: photos.small } } });
    ok(r.status === 400 && /WebP/.test(r.json.fields.file) && !existsSync(join(ROOT, "assets/media/m-png.webp")), "WebP でないファイルは、置かない");
    r = await req("/api/media/save", { body: { item: { ...item, id: "m-x" }, photos: { large: "not base64!", small: photos.small } } });
    ok(r.status === 400 && r.json.fields.file, "読めないデータは、受け付けない");
    r = await req("/api/media/save", { body: { item: { ...item, id: "../../evil" }, photos } });
    ok(r.status === 400 && r.json.fields.id && !existsSync(join(ROOT, "evil.webp")) && !existsSync("evil.webp"), "ファイル名に使えない ID は、受け付けない(置き場所の外に書かない)");
    r = await req("/api/media/save", { body: { item: { ...item, id: "m-y", kagura: "取り下げた種類" }, photos } });
    ok(r.status === 400 && r.json.fields.kagura, "種類のページがない神楽には、追加できない");
    r = await req("/api/media/save", { body: { item: { ...item, id: "m-20261105-1" }, photos } });
    ok(r.status === 400 && r.json.fields.id, "同じ ID は、追加できない");
    r = await req("/api/media/save", { raw: JSON.stringify({ item, photos: { large: "A".repeat(3_100_000), small: "" } }) });
    ok(r.status === 413, "大きすぎる送信は、断る");
    ok((await req("/api/media/save", { body: { item, photos }, headers: { "x-admin-token": "x" } })).status === 403, "合言葉(トークン)のない操作は、断る");

    r = await req("/api/media/save", { body: { item: { ...item, kind: "youtube", caption: "直した見出し", credit: "", width: 1 }, originalId: "m-20261105-1" } });
    const edited = media()[0];
    ok(r.status === 200 && edited.kind === "photo" && edited.width === 64 && edited.caption === "直した見出し" && !("credit" in edited) && media().length === 1, "編集: 種類と大きさは変えず、文字の項目だけを直す", JSON.stringify(edited));
    r = await req("/api/media/save", { body: { item: { kind: "youtube", kagura: "高千穂神楽", youtube: "https://youtu.be/AbCdEfGhIj0", title: "夜神楽", provider: "official", credit: "テスト保存会" } } });
    ok(r.status === 200 && media()[1].youtube === "AbCdEfGhIj0" && media()[1].id === "m-20261105-2" && !("alt" in media()[1]), "動画の追加: URL から動画の ID を取り出して保存する", JSON.stringify(media()[1]));
    r = await req("/api/media/save", { body: { item: { kind: "youtube", kagura: "高千穂神楽", youtube: "https://evil.example/v", title: "x", provider: "reader" } } });
    ok(r.status === 400 && r.json.fields.youtube, "YouTube 以外の URL は、受け付けない");

    r = await req("/api/media/status", { body: { id: "m-20261105-1", status: "withdrawn" } });
    ok(r.status === 200 && media()[0].status === "withdrawn" && !existsSync(join(ROOT, "assets/media/m-20261105-1.webp")) && !existsSync(join(ROOT, "assets/media/m-20261105-1-s.webp")), "写真の掲載をやめると、ファイルも消す");
    ok(published.at(-1).msg === "data(admin): 写真・動画 掲載をやめる: 石見神楽 m-20261105-1" && published.at(-1).paths.join() === MEDIA.join(), "掲載をやめたことも、そのまま公開する(消したファイルも送る)");
    r = await req("/api/media/status", { body: { id: "m-20261105-1", status: "published" } });
    ok(r.status === 400 && /選び直して/.test(r.json.error), "ファイルを消した写真は、掲載に戻せない(選び直して追加する)");
    r = await req("/api/media/status", { body: { id: "m-20261105-2", status: "withdrawn" } });
    const r2 = await req("/api/media/status", { body: { id: "m-20261105-2", status: "published" } });
    ok(r.status === 200 && r2.status === 200 && media()[1].status === "published", "動画は、掲載をやめたり、戻したりできる");
    ok((await req("/api/media/status", { body: { id: "m-20261105-2", status: "pending" } })).status === 400 && (await req("/api/media/status", { body: { id: "nothing", status: "withdrawn" } })).status === 404, "決まった状態以外・ない ID は、断る");
    ok(!read(join(ROOT, "data/media.json")).includes("@") , "写真・動画のデータに、メールアドレスなどの連絡先を入れない");
  } finally {
    server.close();
    rmSync(ROOT, { recursive: true, force: true });
  }

  section("管理者用ページ: 写真のファイルの公開(新しいファイル・消したファイル)");
  const T = mkdtempSync(join(tmpdir(), "kagura-media-pub-"));
  const git = findGit();
  const g = (cwd, ...a) => execFileSync(git, a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }).trim();
  try {
    g(T, "-c", "init.defaultBranch=main", "init", "-q", "--bare", "remote.git");
    g(T, "clone", "-q", "remote.git", "a");
    const A = join(T, "a");
    g(A, "config", "user.email", "t@example.invalid"); g(A, "config", "user.name", "t");
    mkdirSync(join(A, "data")); mkdirSync(join(A, "assets/media"), { recursive: true });
    writeFileSync(join(A, "data/media.json"), "[]"); writeFileSync(join(A, "assets/media/.gitkeep"), ""); writeFileSync(join(A, "data/events.json"), "[]");
    g(A, "add", "."); g(A, "commit", "-q", "-m", "init"); g(A, "push", "-q", "-u", "origin", "HEAD:main");
    copyFileSync(join(FIX, "large.webp"), join(A, "assets/media/m-1.webp")); copyFileSync(join(FIX, "small.webp"), join(A, "assets/media/m-1-s.webp"));
    writeFileSync(join(A, "data/media.json"), '[{"id":"m-1"}]'); writeFileSync(join(A, "notes.txt"), "作業中"); writeFileSync(join(A, "data/events.json"), "[1]");
    let p = await publish(A, "data(admin): 写真・動画 追加", { git, check: false, paths: MEDIA });
    const files = g(T, "--git-dir=remote.git", "show", "--name-only", "--format=", "main").split("\n");
    ok(p.ok && files.includes("assets/media/m-1.webp") && files.includes("assets/media/m-1-s.webp") && files.includes("data/media.json") && !files.includes("notes.txt") && !files.includes("data/events.json"), "新しい写真のファイルとデータだけを送る(開催データや、作業中のファイルは送らない)", files.join(","));
    rmSync(join(A, "assets/media/m-1.webp")); rmSync(join(A, "assets/media/m-1-s.webp"));
    p = await publish(A, "data(admin): 写真・動画 掲載をやめる", { git, check: false, paths: MEDIA });
    const tree = g(T, "--git-dir=remote.git", "ls-tree", "-r", "--name-only", "main");
    ok(p.ok && !tree.includes("m-1.webp") && !tree.includes("m-1-s.webp") && tree.includes("assets/media/.gitkeep"), "消した写真のファイルは、GitHub 側でも消える", tree);
  } finally { rmSync(T, { recursive: true, force: true }); }
}
