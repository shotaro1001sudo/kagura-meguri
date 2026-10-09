// 追加テスト: 定期公演 / セキュリティ(CSP・XSS・メールの隠し方) / フォームの動作 / 本番データの検査
import { createHash } from "node:crypto";
import vm from "node:vm";
import { readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { JSDOM, VirtualConsole } from "jsdom";
import { PREFECTURES } from "../scripts/lib/util.mjs";

const sha = (s) => `'sha256-${createHash("sha256").update(s, "utf8").digest("base64")}'`;
const cspOf = (html) => cheerio.load(html)('meta[http-equiv="Content-Security-Policy"]').attr("content") ?? "";
const dir = (csp, name) => (csp.split(";").map((x) => x.trim()).find((x) => x.startsWith(name + " ")) ?? "").split(/\s+/).slice(1);

export async function extraTests({ ok, section, read, htmls, rel, OUT, build, hasFile, files, NOW }) {
  const cfg = JSON.parse(read("config.json").replace(/^﻿/, ""));
  const rd = (f) => read(join(OUT, f));

  // ---------- 定期公演 ----------
  section("定期公演");
  for (const id of ["r-nightly", "r-weekly", "r-xss"]) ok(existsSync(join(OUT, `regular/${id}.html`)), `定期公演ページ ${id} がある`);
  for (const id of ["r-expired", "r-pending"]) ok(!existsSync(join(OUT, `regular/${id}.html`)), `${id}(期間終了・承認前)のページは作られない`);
  const home = cheerio.load(rd("index.html"));
  ok(home(".reglist .card").length === 3, "トップの定期公演に3件並ぶ", `${home(".reglist .card").length}件`);
  ok(!home(".reglist").text().includes("出てはいけない"), "期間終了・承認前の定期公演はトップに出ない");
  const reg = JSON.parse(rd("regular.json"));
  ok(reg.length === 3 && reg.every((x) => x.id && x.name), "regular.json(地図用)に有効な3件だけが入る");
  ok(rd("sitemap.xml").includes("/regular/r-nightly.html"), "サイトマップに定期公演が入る");
  ok(cheerio.load(rd("kagura/高千穂神楽.html"))("body").text().includes("毎晩の神楽"), "神楽の種類ページに定期公演が出る");
  const rn = cheerio.load(rd("regular/r-nightly.html"));
  const th = rn("table.info th").map((_, e) => rn(e).text()).get();
  ok(["開催", "休演日", "会場", "料金", "予約"].every((x) => th.includes(x)), "定期公演の詳細に 開催・休演日・会場・料金・予約 が出る", th.join(","));
  ok(rn("body").text().includes("おおよその位置"), "定期公演の詳細にも、おおよその位置の注意書きが出る");
  ok(rn("body").text().includes("情報の出典: テスト協会") && rn("body").text().includes("確認日 2026年10月9日"), "出典と確認日が出る");
  const rx = rd("regular/r-xss.html");
  ok(!/<img src=x/i.test(rx) && !rx.includes("<script>alert(3)") && !/会場 <\/script>/.test(rx), "定期公演の名称・説明の悪意ある文字がそのまま出力されない");

  // ---------- セキュリティ ----------
  section("セキュリティ(CSP・インラインのコード・外部リソース・連絡先の隠蔽)");
  for (const f of htmls) {
    const html = read(f), name = rel(f), $ = cheerio.load(html), csp = cspOf(html);
    ok($('meta[http-equiv="Content-Security-Policy"]').length === 1, `${name}: CSP が1つ`);
    ok(dir(csp, "default-src").join() === "'self'", `${name}: default-src 'self'`);
    ok(dir(csp, "object-src").join() === "'none'" && dir(csp, "base-uri").join() === "'none'", `${name}: object-src / base-uri を禁止`);
    ok(dir(csp, "frame-src").join() === "'none'", `${name}: 他サイトの埋め込みを読まない(frame-src none)`);
    ok(/upgrade-insecure-requests/.test(csp), `${name}: HTTPをHTTPSに引き上げる`);
    const sc = dir(csp, "script-src");
    ok(!sc.includes("'unsafe-inline'") && !sc.includes("'unsafe-eval'"), `${name}: script-src に unsafe-inline / unsafe-eval がない`);
    // インラインの script / style は、すべてハッシュで許可されている
    $("script:not([src]):not([type='application/ld+json'])").each((_, el) => ok(sc.includes(sha($(el).html())), `${name}: インラインscriptがCSPで許可されている`));
    $("style").each((_, el) => ok(dir(csp, "style-src").includes(sha($(el).html())), `${name}: インラインstyleがCSPで許可されている`));
    // インラインのイベント属性(onclick など)と javascript: URL がない
    let handlers = 0, jsUrls = 0;
    $("*").each((_, el) => { for (const [k, v] of Object.entries(el.attribs ?? {})) { if (/^on/i.test(k)) handlers++; if (/^(href|src|action|formaction)$/i.test(k) && /^\s*javascript:/i.test(v)) jsUrls++; } });
    ok(handlers === 0, `${name}: onclick 等のインラインのイベント属性がない`, `${handlers}個`);
    ok(jsUrls === 0, `${name}: javascript: のURLがない`);
    // 外部リソースは、CSPで許可した出どころだけ
    $("script[src]").each((_, el) => { const u = $(el).attr("src"); ok(u.startsWith("/") || sc.some((t) => t !== "'self'" && u.startsWith(t)), `${name}: 外部script が許可リスト内`, u); });
    $("link[rel=stylesheet]").each((_, el) => { const u = $(el).attr("href"); ok(u.startsWith("/") || dir(csp, "style-src").some((t) => u.startsWith(t)), `${name}: 外部CSS が許可リスト内`, u); });
    ok($("script").first().html().includes("window.top!==window.self"), `${name}: 最初のscriptが、埋め込み(クリックジャッキング)対策`);
    ok(!/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/.test(html) && !/<a\b[^>]*href=["']mailto:/.test(html) && !html.includes(cfg.operator.contact), `${name}: メールアドレスがHTMLに直接書かれていない`);
  }
  for (const f of htmls) for (const m of read(f).matchAll(/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g)) {
    let err = ""; try { new vm.Script(m[1]); } catch (e) { err = e.message; }
    ok(!err, `${rel(f)}: インラインscriptに文法エラーがない`, err);
  }
  const st = read(join(OUT, ".well-known/security.txt"));
  ok(/^Contact: https:\/\//m.test(st) && read(join(OUT, "security.txt")) === st, "security.txt(/.well-known/ と /)がある");
  const exp = st.match(/^Expires: (.+)$/m)?.[1];
  ok(exp && Date.parse(exp) > Date.parse(NOW + ":00+09:00"), "security.txt の有効期限が未来", exp);
  const hd = rd("_headers");
  ok(/Strict-Transport-Security/.test(hd) && /X-Content-Type-Options: nosniff/.test(hd) && /Permissions-Policy/.test(hd) && /X-Frame-Options: DENY/.test(hd), "_headers(移行先用の本物のHTTPヘッダ)がある");

  let r = build("tests/fixtures/events.test.json", "dist-test-ads", { TEST_ADSENSE: "ca-pub-0000000000000000" });
  const adHtml = read("dist-test-ads/index.html"), adCsp = cspOf(adHtml);
  ok(r.status === 0 && adCsp.includes("googlesyndication") && adHtml.includes("pagead2.googlesyndication.com"), "広告を設定したときだけ、AdSense用の許可が増える", r.stderr);
  ok(!cspOf(rd("index.html")).includes("googlesyndication"), "広告を設定しない間は、Google広告用の許可がない");
  r = build("tests/fixtures/events.test.json", "dist-test-form", { TEST_FORM_ENDPOINT: "https://forms.example.test/submit" });
  ok(r.status === 0 && dir(cspOf(read("dist-test-form/submit.html")), "connect-src").includes("https://forms.example.test"), "フォーム送信先を設定すると、その送信先だけ connect-src に追加される", r.stderr);
  r = build("tests/fixtures/events.test.json", "dist-test-key", { TEST_FORM_ENDPOINT: "https://api.web3forms.com/submit" });
  ok(r.status === 0 && read("dist-test-key/submit.html").includes('"endpoint":""'), "Web3Forms はアクセスキーがないと有効にならず、メール作成の方式のままになる", r.stderr);
  ok(dir(cspOf(rd("submit.html")), "connect-src").join() === "'self'", "送信先を設定しない間は、自サイト以外へ通信できない");
  for (const [file, label] of [["tests/fixtures/events.badurl.json", "events の javascript: URL"]]) {
    r = build(file, "dist-test-bad");
    ok(r.status !== 0 && /url は http\(s\):\/\//.test(r.stderr), `${label}を拒否する`);
  }
  r = build("tests/fixtures/events.empty.json", "dist-test-bad", { REGULAR_FILE: "tests/fixtures/regular.invalid.json" });
  ok(r.status !== 0 && /\[r1\]/.test(r.stderr), "定期公演の data: URL を拒否する");

  // ---------- フォーム(構造) ----------
  section("フォーム(構造・入力欄の注意・ラベル)");
  const sub = cheerio.load(rd("submit.html"));
  ok(sub('meta[name="robots"]').attr("content") === "noindex,follow", "投稿フォームは noindex");
  ok(sub("form[data-form=submit]").length === 1 && sub("form").attr("novalidate") !== undefined, "投稿フォームが1つある");
  for (const id of ["name", "kagura", "prefecture", "city", "venue", "date", "role", "sender", "email", "agree"]) ok(sub(`#${id}[required]`).length === 1, `投稿フォーム: ${id} が必須`);
  ok(sub("#prefecture option").length === PREFECTURES.length + 1, "都道府県の選択肢が47+1");
  ok(sub(".hp").attr("aria-hidden") === "true" && sub(".hp input").attr("tabindex") === "-1" && sub("input[name=_t]").length === 1, "迷惑投稿対策(ハニーポット・時刻)がある");
  ok(sub("a[href='/privacy.html']").length >= 1, "プライバシーポリシーへのリンクがある");
  sub("input:not([type=hidden]):not([type=checkbox]), select, textarea").each((_, el) => {
    const id = sub(el).attr("id");
    if (sub(el).closest(".hp").length) return;
    ok(id && sub(`label[for='${id}']`).length === 1, `投稿フォーム: ${id} にラベルがある`);
    if (sub(el).is("input[type=text],input[type=url],input[type=email],textarea")) ok(Number(sub(el).attr("maxlength")) > 0, `投稿フォーム: ${id} に文字数の上限`);
  });
  const con = cheerio.load(rd("contact.html"));
  ok(con("form[data-form=contact]").length === 1, "お問い合わせフォームが1つある");
  for (const id of ["topic", "sender", "email", "message", "agree"]) ok(con(`#${id}[required]`).length === 1, `お問い合わせ: ${id} が必須`);
  ok(con("a.mail").length === 0 && con("main a[href='/contact.html'], main form").length >= 1 && !con("main").text().includes("@"), "お問い合わせページに、メールアドレス(メールのリンク)を載せない。連絡はフォームで受ける");
  const pv = cheerio.load(rd("privacy.html"))("body").text();
  ok(pv.includes("投稿フォーム・お問い合わせフォームについて") && pv.includes("迷惑投稿"), "プライバシーポリシーにフォームの項目がある");

  // ---------- フォーム(動作: jsdom で実際に操作する) ----------
  section("フォームの動作(入力検査・迷惑投稿対策・送信・失敗)");
  const run = async (page, { endpointDir = "dist-test-form", fetchImpl, setup }) => {
    const html = read(join(endpointDir, page));
    const calls = [], logs = [];
    let nowMs = Date.parse("2026-10-09T12:00:00+09:00");
    const vc = new VirtualConsole(); vc.on("jsdomError", (e) => logs.push(String(e.message)));
    const dom = new JSDOM(html, {
      runScripts: "dangerously", url: `https://kagurameguri.jp/${page}`, pretendToBeVisual: true, virtualConsole: vc,
      beforeParse(w) {
        const RealDate = w.Date; w.Date = class extends RealDate { static now() { return nowMs; } };
        w.fetch = async (url, init) => { calls.push({ url, init }); return fetchImpl ? fetchImpl(url, init) : { ok: true, json: async () => ({ success: true }) }; };
      },
    });
    const d = dom.window.document;
    const api = {
      d, calls, logs, w: dom.window,
      set: (id, v) => { const el = d.getElementById(id); if (el.type === "checkbox") el.checked = !!v; else el.value = v; },
      advance: (ms) => { nowMs += ms; },
      submit: async () => { d.querySelector("form").dispatchEvent(new dom.window.Event("submit", { cancelable: true, bubbles: true })); await new Promise((r) => setTimeout(r, 30)); },
      status: () => d.getElementById("status").textContent,
      err: (id) => d.getElementById(id + "-e")?.textContent ?? "",
    };
    if (setup) setup(api);
    return api;
  };
  const fillSubmit = (t) => {
    const v = { name: "テスト神楽", kagura: "石見神楽", prefecture: "島根県", city: "益田市", venue: "テスト神社", date: "2026-12-01", time_start: "19:00", time_end: "20:30", fee: "無料", url: "https://example.com/a", description: "説明", role: "主催者・出演者", sender: "テスト太郎", email: "taro@example.com" };
    for (const [k, x] of Object.entries(v)) t.set(k, x);
    t.set("agree", true);
  };
  { // 1. 空のまま送信
    const t = await run("submit.html", {}); t.advance(5000); await t.submit();
    ok(t.calls.length === 0 && t.status().includes("入力内容をご確認"), "空のまま送信 → 送られず、確認を促す");
    ok(t.err("name").includes("入力してください") && t.err("agree").includes("同意"), "必須の欄に、エラーが出る");
    ok(t.d.getElementById("name").getAttribute("aria-invalid") === "true", "エラーの欄に aria-invalid が付く");
  }
  { // 2. 速すぎる送信
    const t = await run("submit.html", {}); fillSubmit(t); t.advance(1000); await t.submit();
    ok(t.calls.length === 0 && t.status().includes("時間をおいて"), "ページを開いてすぐの送信(ボット)は、送られない");
  }
  { // 3. ハニーポット
    const t = await run("submit.html", {}); fillSubmit(t); t.d.querySelector("input[name=website]").value = "http://spam.example"; t.advance(5000); await t.submit();
    ok(t.calls.length === 0, "ハニーポットが埋まっていたら、送られない");
  }
  { // 4. 形式のエラー
    const t = await run("submit.html", {}); fillSubmit(t); t.set("email", "abc"); t.set("url", "http://example.com"); t.set("time_end", "18:00"); t.advance(5000); await t.submit();
    ok(t.calls.length === 0 && t.err("email").includes("形式") && t.err("url").includes("https://") && t.err("time_end").includes("開始時刻"), "メール・http URL・時刻の逆転を、エラーにする");
  }
  { // 5. 正常な送信
    const t = await run("submit.html", {}); fillSubmit(t); t.advance(5000); await t.submit();
    ok(t.calls.length === 1 && t.calls[0].url === "https://forms.example.test/submit", "正常に入力すると、設定した送信先へ1回だけ送信される", t.calls[0]?.url);
    const body = JSON.parse(t.calls[0].init.body);
    ok(t.calls[0].init.credentials === "omit" && t.calls[0].init.referrerPolicy === "no-referrer", "送信にCookieとリファラを付けない");
    ok(body.subject.includes("開催情報の掲載依頼") && body.email === "taro@example.com" && body.from_name === "テスト太郎", "件名・送信者・メールが入る");
    ok(body.message.includes("■神楽・イベントの名称: テスト神楽") && body.message.includes("【events.json 用】"), "本文に入力内容と、events.json 用の下書きが入る");
    const draft = JSON.parse(body.message.split("【events.json 用】\n")[1]);
    ok(draft.start === "2026-12-01T19:00" && draft.end === "2026-12-01T20:30" && draft.status === "pending" && draft.prefecture === "島根県", "events.json 用の下書きが、データ形式どおりになる", JSON.stringify(draft));
    ok(!("website" in body) && !("_t" in body) && !body.message.includes("spam"), "ハニーポット等の内部の値は送らない");
    ok(t.status().includes("送信しました") && t.d.getElementById("name").value === "", "成功を表示し、入力欄を空にする");
    // 6. 連続送信
    fillSubmit(t); t.advance(5000); await t.submit();
    ok(t.calls.length === 1 && t.status().includes("30秒"), "30秒以内の連続送信は、送られない");
    t.advance(31000); await t.submit();
    ok(t.calls.length === 2, "30秒たてば、また送れる");
  }
  { // 7. 送信の失敗
    const t = await run("submit.html", { fetchImpl: async () => ({ ok: false, json: async () => ({}) }) }); fillSubmit(t); t.advance(5000); await t.submit();
    ok(t.status().includes("送信できませんでした") && t.status().includes("もう一度") && !t.d.querySelector("#status button"), "送信に失敗したら、もう一度試す案内を出す(運営者のアドレスは載せないので、メールで送るボタンは出さない)");
    ok(t.d.getElementById("name").value === "テスト神楽" && !t.d.getElementById("send").disabled, "失敗しても入力内容は残り、もう一度押せる");
  }
  { // 8. 送信先がエラーを返す(success:false)
    const t = await run("submit.html", { fetchImpl: async () => ({ ok: true, json: async () => ({ success: false }) }) }); fillSubmit(t); t.advance(5000); await t.submit();
    ok(t.status().includes("送信できませんでした"), "送信先が success:false を返したら、失敗として扱う");
  }
  { // 9. お問い合わせフォーム
    const t = await run("contact.html", {});
    t.set("topic", "掲載内容の訂正"); t.set("sender", "太郎"); t.set("email", "t@example.com"); t.set("target", "https://kagurameguri.jp/events/x.html"); t.set("message", "訂正のお願いです"); t.set("agree", true);
    t.advance(5000); await t.submit();
    ok(t.calls.length === 1 && JSON.parse(t.calls[0].init.body).subject.includes("お問い合わせ: 掲載内容の訂正") && !JSON.parse(t.calls[0].init.body).message.includes("events.json"), "お問い合わせが送れる(events.json の下書きは付かない)");
  }
  { // 10. スクリプトが動いても、メールアドレスは、ページに現れない
    const t = await run("contact.html", {});
    ok(!t.d.querySelector("a[href^='mailto:']") && !t.d.querySelector("main").textContent.includes("@"), "スクリプトが動いても、メールのリンク・アドレスは現れない");
  }
  { // 11. 送信先が未設定なら、メール作成にフォールバックする(送信先なしのビルド)
    const t = await run("submit.html", { endpointDir: OUT }); fillSubmit(t); t.advance(5000); await t.submit();
    ok(t.calls.length === 0 && t.status().includes("メールの作成画面を開きます"), "送信先が未設定でも、メール作成の案内が出る(通信はしない)");
  }

  // ---------- 本番データ ----------
  section("本番データ(data/events.json・data/regular.json)");
  r = spawnReal(build);
  ok(r.status === 0, "本番データでビルドできる", r.stderr);
  const events = JSON.parse(read("data/events.json").replace(/^﻿/, "")), regular = JSON.parse(read("data/regular.json").replace(/^﻿/, ""));
  for (const [kind, rows] of [["events", events], ["regular", regular]]) {
    for (const e of rows.filter((x) => x.status === "published")) {
      const w = `${kind}/${e.id}`;
      ok(PREFECTURES.includes(e.prefecture), `${w}: 都道府県が正しい`, e.prefecture);
      ok(!!e.kagura, `${w}: 神楽の種類がある`);
      ok(!!e.source && /^\d{4}-\d{2}-\d{2}$/.test(e.checked ?? ""), `${w}: 出典と確認日がある`);
      ok(/^https:\/\//.test(e.url ?? ""), `${w}: 公式情報のURL(https)がある`);
      ok(e.lat != null && e.lng != null, `${w}: 緯度経度がある(地図に出る)`);
      ok(!e.geoPrecision || ["city", "area"].includes(e.geoPrecision), `${w}: 位置の精度の値が正しい`);
      if (kind === "events") ok(!!e.description, `${w}: 説明がある`);
    }
  }
  for (const d of ["dist-test-ads", "dist-test-form", "dist-test-key", "dist-test-bad", "dist-test-real"]) rmSync(d, { recursive: true, force: true });
}

// 本番データは、テスト用のデータ指定(EVENTS_FILE など)を外してビルドする
import { spawnSync } from "node:child_process";
function spawnReal() {
  const env = { ...process.env, OUT_DIR: "dist-test-real", BUILD_NOW: "2026-10-09T12:00" };
  delete env.EVENTS_FILE; delete env.REGULAR_FILE;
  return spawnSync("node", ["scripts/build.mjs"], { env, encoding: "utf8" });
}
