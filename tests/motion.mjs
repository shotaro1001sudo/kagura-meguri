// 動き(ページの出現・視差・火の粉・導入演出)のテスト
//  - CSS: 動きを減らす設定で止まる / JSなしでは隠さない / 本文の一部だけを動かさない
//  - JS : jsdom で、視差・導入演出・動かさないページを、実際に動かして確認する
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { JSDOM, VirtualConsole } from "jsdom";

const read = (p) => readFileSync(p, "utf8");

export async function motionTests({ ok, section, OUT }) {
  section("動き: CSS(JSなしの表示・動きを減らす設定・全ページ共通の出現)");
  const home = read(join(OUT, "index.html"));
  const $ = cheerio.load(home);
  const css = $("style").first().html();
  const noKeyframes = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
  // opacity:0 で隠すルールは、すべて「.js」つき(= JavaScriptが動き、動きを減らす設定でないときだけ)
  const hiding = [...noKeyframes.matchAll(/([^{}]+)\{[^{}]*opacity:0[;}][^{}]*\}/g)].map((m) => m[1].trim()).filter((s) => !s.includes("%"));
  ok(hiding.every((s) => /^\.js[ :]/.test(s) || /^\.sparks i$/.test(s)), "opacity:0 で隠す規則は、すべて .js つき(JSなしでは、隠れない)", hiding.join(" | "));
  ok(/\.js main\{animation:pagein var\(--t-m\) var\(--ease\) backwards\}/.test(noKeyframes) && /@keyframes pagein\{from\{opacity:0;translate:0 8px\}to\{opacity:1;translate:none\}\}/.test(css), "全ページ共通: ページを開いたとき、本文全体(main)が1回だけ、静かに現れる");
  ok(!/\.js main\{animation:[^}]*\b(both|forwards)\b/.test(noKeyframes), "本文の出現の動きは、終わりの値を残さない(残すと、ガイドの固定の目次がスクロールについてこない)");
  const rm = css.slice(css.lastIndexOf("@media(prefers-reduced-motion:reduce){"));
  ok(/animation:none!important/.test(rm) && /transition:none!important/.test(rm) && /\.sparks\{display:none!important\}/.test(rm), "「動きを減らす」設定で、アニメーション・遷移・火の粉が、止まる");
  ok(/@media\(hover:hover\) and \(prefers-reduced-motion:no-preference\)/.test(css), "ホバーの演出は、ホバーできる端末で、動きを減らさない設定のときだけ");
  ok(/@media print\{\.js main\{animation:none\}\}/.test(css), "印刷では、本文の動きを止める");
  // 本文の一部だけを動かさない: スクロールで一部だけ現れる動き・トップの一覧だけの導入を、使わない
  ok(!/\.js :is\(/.test(noKeyframes) && !/\.in\{/.test(noKeyframes) && !/\.intro (\.home-hero h1|\.home-hero \.copy|\.quick|\.regions|#list)/.test(noKeyframes), "本文の一部だけが動く規則(スクロールでの出現・一覧だけの導入)がない");
  const animated = [...noKeyframes.matchAll(/([^{}]+)\{[^{}]*animation:(?!none)[^{}]*\}/g)].map((m) => m[1].trim().replace(/^.*\}/, "")).filter((x) => !/^@/.test(x));
  ok(animated.length > 0 && animated.every((x) => /^\.js main$|\.ms|\.sparks|\.vert|\.top |\.splash|^::view-transition-(old|new)\(root\)$/.test(x)), "アニメーションは、本文全体・トップの情景・火の粉・縦書き・ヘッダー・オープニングだけ", animated.join(" | "));
  // 統一性: 加速の付け方は1種類、遷移の速さは3段階の基準だけ、ホバーで浮き上がり・拡大しない
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, "");
  ok([...new Set(plain.match(/cubic-bezier\([^)]*\)/g) ?? [])].length === 1 && /--ease:cubic-bezier/.test(plain), "加速の付け方(cubic-bezier)は、基準の1種類だけ", [...new Set(plain.match(/cubic-bezier\([^)]*\)/g) ?? [])].join(" "));
  const trans = [...plain.matchAll(/transition:([^;}]+)/g)].map((m) => m[1]).filter((v) => !/^none/.test(v));
  ok(trans.length > 5 && trans.every((v) => !/\d(\.\d+)?m?s\b/.test(v) && /var\(--t-[sml]\)/.test(v)), "遷移の速さは、すべて基準(--t-s / --t-m / --t-l)を使う", trans.filter((v) => /\d(\.\d+)?m?s\b/.test(v)).join(" | "));
  const hoverMoves = [...plain.matchAll(/([^{}]*:hover[^{}]*)\{([^{}]*)\}/g)].filter(([, sel, body]) => /translate|scale\(|scale:|transform/.test(body) && !/\.card:hover:before/.test(sel)).map(([, s]) => s.trim());
  ok(hoverMoves.length === 0, "ホバーでは、浮き上がり・拡大をしない(色と朱の線だけ。カードの線は伸びる)", hoverMoves.join(" | "));
  ok(!/@keyframes drop/.test(plain) && !/animation:drop/.test(plain), "弾む動き(ロゴの drop)は使わない");
  ok(Number(statSync("scripts/motion.css").size) < 9000 && Number(statSync("scripts/motion.js").size) < 4000, "動きの CSS / JS が軽い(9KB / 4KB 未満)");
  const sp = $(".sparks");
  ok(sp.length === 1 && sp.attr("aria-hidden") === "true" && sp.find("i").length === 12 && sp.find("a,button,input").length === 0, "火の粉: 装飾(aria-hidden)・12個・操作できる要素を含まない");
  ok((css.match(/\.sparks i:nth-child\(\d+\)\{/g) ?? []).length === 12, "火の粉の位置・速さの設定が、12個ぶんある");
  const spl = $(".splash");
  ok(spl.length === 1 && spl.attr("aria-hidden") === "true" && spl.parents("main").length === 0 && spl.find("a,button,input").length === 0 && spl.text().trim() === "神楽めぐり", "オープニング: トップに1つ・装飾(aria-hidden)・main の外(fixed の基準を画面にする)・操作できる要素を含まない");
  ok(/\.splash\{display:none\}/.test(css) && /\.intro \.splash\{display:flex/.test(css) && /\.intro\.unsplash \.splash\{/.test(css), "オープニング: intro のときだけ出し、押すとすぐ消える(普段・2回目・動きを減らす設定では出さない)");
  ok(!/class="splash"/.test(read(join(OUT, "calendar.html"))), "オープニング: トップ以外のページには置かない");
  ok(read(join(OUT, "index.html")) === home && !/class="js/.test(home.slice(0, 200)), "HTMLの時点では、js / intro クラスが付いていない(スクリプトが付ける)");

  section("動き: JS(視差・導入・動かさないページ)を jsdom で動かす");
  const run = async (page, opts = {}) => {
    const { reduced = false, noIO = false, wide = true, introSeen = false, path = "/" } = opts;
    const html = read(join(OUT, page));
    const ios = [], timers = [], vc = new VirtualConsole(), errs = [];
    vc.on("jsdomError", (e) => errs.push(String(e.message)));
    const dom = new JSDOM(html, {
      runScripts: "dangerously", url: `https://kagurameguri.jp${path}`, pretendToBeVisual: true, virtualConsole: vc,
      beforeParse(w) {
        if (!noIO) w.IntersectionObserver = class { constructor(cb, o) { this.cb = cb; this.o = o; this.els = []; this.un = []; ios.push(this); } observe(e) { this.els.push(e); } unobserve(e) { this.un.push(e); } disconnect() {} };
        w.matchMedia = (q) => ({ matches: /reduce/.test(q) ? reduced : /min-width:561px/.test(q) ? wide : false, media: q, addEventListener() {}, removeEventListener() {} });
        w.requestAnimationFrame = (fn) => { fn(); return 1; };
        const st = w.setTimeout.bind(w); w.setTimeout = (fn, ms, ...a) => { timers.push({ fn, ms }); return ms > 3000 ? 0 : st(fn, ms, ...a); };
        if (introSeen) w.sessionStorage.setItem("intro", "1");
      },
    });
    const w = dom.window, d = w.document;
    return { w, d, ios, timers, errs, h: d.documentElement, hit: (io, els, v = true) => io.cb(els.map((e) => ({ target: e, isIntersecting: v }))) };
  };

  { // A. ふつうの環境
    const t = await run("index.html");
    ok(t.h.classList.contains("js") && t.h.classList.contains("intro"), "ふつうの環境: トップの最初の訪問で、js と intro が付く");
    ok(t.errs.length === 0, "スクリプトのエラーがない", t.errs.join(";"));
    t.d.querySelector(".splash").dispatchEvent(new t.w.MouseEvent("click", { bubbles: true }));
    ok(t.h.classList.contains("unsplash"), "オープニング: 押すと、すぐ消す(unsplash が付く)");
    const heroIO = t.ios.find((io) => io.els.length === 1);
    ok(t.ios.length === 1 && !t.d.querySelector(".in"), "スクロールで一部だけを出す観察はしない(視差の観察だけ)", String(t.ios.length));
    // 視差
    ok(!!heroIO && heroIO.o.rootMargin === "120px", "視差: ヒーローを観察する");
    Object.defineProperty(t.w, "pageYOffset", { value: 300, configurable: true });
    t.w.dispatchEvent(new t.w.Event("scroll"));
    ok(t.h.style.getPropertyValue("--py") === "300px", "視差: スクロール量が --py に入る", t.h.style.getPropertyValue("--py"));
    Object.defineProperty(t.w, "pageYOffset", { value: 5000, configurable: true });
    t.w.dispatchEvent(new t.w.Event("scroll"));
    ok(t.h.style.getPropertyValue("--py") === "900px", "視差: 動く量に、上限(900px)がある");
    t.hit(heroIO, [t.d.querySelector(".home-hero")], false);
    ok(t.d.querySelector(".sparks").classList.contains("off"), "ヒーローが見えない間は、火の粉を止める");
    Object.defineProperty(t.w, "pageYOffset", { value: 100, configurable: true });
    t.w.dispatchEvent(new t.w.Event("scroll"));
    ok(t.h.style.getPropertyValue("--py") === "900px", "ヒーローが見えない間は、視差の計算をしない");
    Object.defineProperty(t.w, "pageYOffset", { value: 0, configurable: true });
    t.hit(heroIO, [t.d.querySelector(".home-hero")], true);
    ok(!t.d.querySelector(".sparks").classList.contains("off"), "ヒーローが見えたら、火の粉を再開する");
    ok(t.h.style.getPropertyValue("--py") === "0px", "先頭へ戻ってヒーローが見えた瞬間に、視差の値が最新(0px)になる(ずれたまま残らない)", t.h.style.getPropertyValue("--py"));
    Object.defineProperty(t.w, "pageYOffset", { value: 250, configurable: true });
    t.w.dispatchEvent(new t.w.Event("pageshow"));
    ok(t.h.style.getPropertyValue("--py") === "250px", "ページの復元(pageshow)でも、いまの位置にそろえる");
  }
  { // B. 2回目の訪問(同じセッション)
    const t = await run("index.html", { introSeen: true });
    ok(t.h.classList.contains("js") && !t.h.classList.contains("intro"), "同じセッションの2回目は、導入演出を出さない(js だけ。本文の出現は、ほかのページと同じ)");
  }
  { // C. トップ以外
    const t = await run("map.html", { path: "/map.html" });
    ok(t.h.classList.contains("js") && !t.h.classList.contains("intro"), "トップ以外のページでも、同じ出現(js)。導入演出は出さない");
    ok(t.ios.length === 0, "ヒーローがないページでは、視差の観察をしない");
  }
  for (const [p, path] of [["about.html", "/about.html"], ["about.html", "/about"], ["contact.html", "/contact.html"], ["privacy.html", "/privacy.html"], ["privacy.html", "/privacy"], ["terms.html", "/terms.html"], ["disclaimer.html", "/disclaimer.html"]]) { // 読むための文書(プライバシーポリシー・運営者情報)は、動かさない(.html なしの URL でも)
    const t = await run(p, { path });
    ok(!t.h.classList.contains("js") && t.ios.length === 0, `${path}: 動きを付けない`);
  }
  { // D. 動きを減らす設定
    const t = await run("index.html", { reduced: true });
    ok(!t.h.classList.contains("js") && !t.h.classList.contains("intro"), "「動きを減らす」設定: js も intro も付かない");
    ok(t.ios.length === 0, "「動きを減らす」設定: 視差も、始めない");
    ok(t.d.querySelectorAll(".card").length >= 6, "「動きを減らす」設定: 要素は、最初から全部ある(js がないので、隠す規則が効かない)");
  }
  { // E. IntersectionObserver がない環境
    const t = await run("index.html", { noIO: true });
    ok(!t.h.classList.contains("js"), "IntersectionObserver がない環境: js が付かず、すべて普通に表示される");
  }
  { // F. 狭い画面: 視差はしない
    const t = await run("index.html", { wide: false });
    ok(t.ios.length === 0, "狭い画面: 視差の観察はしない");
    Object.defineProperty(t.w, "pageYOffset", { value: 300, configurable: true });
    t.w.dispatchEvent(new t.w.Event("scroll"));
    ok(t.h.style.getPropertyValue("--py") === "", "狭い画面: スクロール量を渡さない(動かさない)");
  }

  section("動き: ページの移動(View Transitions)");
  const vtHtml = readFileSync(join(OUT, "index.html"), "utf8");
  const head = vtHtml.slice(0, vtHtml.indexOf("</head>"));
  ok(head.includes("pagereveal") && head.includes("pageswap") && /<link rel="expect" href="#main" blocking="render">/.test(head), "切り替えのスクリプトは <head> にあり、本文が読み込まれるまで最初の描画を待つ(移動の瞬間に、題名と見出しをつなぐため)");
  const mcss = readFileSync("scripts/motion.css", "utf8");
  ok(/@media \(prefers-reduced-motion:no-preference\)\{\s*@view-transition\{navigation:auto\}/.test(mcss), "切り替えは、動きを減らす設定の人には行わない");
  ok(/\.top\{view-transition-name:site-header\}/.test(mcss) && /\.vt main\{animation:none\}/.test(mcss), "ヘッダーは移動中も動かさず、切り替えたページでは本文の出現の動きを重ねない");
  ok(!/view-transition-name:ev-title/.test(vtHtml), "題名と見出しの名前は、前もってページに書かない(同じ開催が2回並ぶと、名前が重なって切り替えが失敗するため)");
  // 一覧のカードの題名は、ページによって h3 / h4 と違う。切り替えのスクリプトが、どの見出しの高さでも拾えること
  const vtJs = readFileSync("scripts/vt.js", "utf8");
  const levels = new Set();
  for (const f of ["index.html", "weekend.html", "this-month.html", "kagura/index.html"]) {
    const $c = cheerio.load(readFileSync(join(OUT, f), "utf8"));
    $c("main .card").each((_, c) => { const h = $c(c).find("h2,h3,h4,h5,h6").first(); if (h.length) levels.add(h[0].tagName); });
  }
  ok(levels.size > 0 && [...levels].every((t) => /querySelector\('h2,h3,h4'\)/.test(vtJs) && ["h2", "h3", "h4"].includes(t)), "カードの題名の見出し(h2〜h4)を、切り替えのスクリプトがすべて拾える", [...levels].join(","));
  ok(/addEventListener\('click'/.test(vtJs) && /document\.referrer/.test(vtJs), "押したカードを優先し、移動元を知る仕組みがないブラウザでは、リファラーで移動元を知る");
}
