// 動き(出現・視差・火の粉・導入演出)のテスト
//  - CSS: 動きを減らす設定で止まる / JSなしでは隠さない / 動的な要素を隠さない
//  - JS : jsdom で、観察・出現・視差・保険・印刷を、実際に動かして確認する
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { JSDOM, VirtualConsole } from "jsdom";

const read = (p) => readFileSync(p, "utf8");

export async function motionTests({ ok, section, OUT }) {
  const SEL_ALL = readFileSync("scripts/build.mjs", "utf8").match(/const REVEAL_SEL = "([^"]+)"/)?.[1] ?? "";
  section("動き: CSS(JSなしの表示・動きを減らす設定・動的な要素)");
  const home = read(join(OUT, "index.html"));
  const $ = cheerio.load(home);
  const css = $("style").first().html();
  const noKeyframes = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
  // opacity:0 で隠すルールは、すべて「.js」つき(= JavaScriptが動き、動きを減らす設定でないときだけ)
  const hiding = [...noKeyframes.matchAll(/([^{}]+)\{[^{}]*opacity:0[;}][^{}]*\}/g)].map((m) => m[1].trim()).filter((s) => !s.includes("%"));
  ok(hiding.length >= 1 && hiding.every((s) => /^\.js\s/.test(s) || /^\.js[ :]/.test(s) || /^\.sparks i$/.test(s)), "opacity:0 で隠す規則は、すべて .js つき(JSなしでは、隠れない)", hiding.map((s) => s.slice(0, 40)).join(" | "));
  const rm = css.slice(css.lastIndexOf("@media(prefers-reduced-motion:reduce){"));
  ok(/animation:none!important/.test(rm) && /transition:none!important/.test(rm) && /\.sparks\{display:none!important\}/.test(rm), "「動きを減らす」設定で、アニメーション・遷移・火の粉が、止まる");
  ok(/\.js :is\(.+\)\{opacity:1!important;translate:none!important\}/.test(rm), "「動きを減らす」設定では、隠した要素も、すべて見える");
  ok(/@media\(hover:hover\) and \(prefers-reduced-motion:no-preference\)/.test(css), "拡大・浮き上がりは、ホバーできる端末で、動きを減らさない設定のときだけ");
  ok(/@media print\{\.js :is\(/.test(css), "印刷では、隠した要素も、すべて出す");
  ok(!/main>\*\{animation/.test(css), "画面全体を一律に隠す古い動きが、残っていない");
  const h1Rule = css.match(/\.intro \.home-hero h1\{([^}]*)\}/)?.[1] ?? "";
  const slide = css.match(/@keyframes slide\{([^]*?)\}\s*\./)?.[1] ?? css.match(/@keyframes slide\{[^}]*\}[^}]*\}/)?.[0] ?? "";
  ok(/animation:slide/.test(h1Rule) && !/opacity/.test(slide), "見出し(最大のコンテンツ)は、透明から現さず、位置の動きだけ(表示を遅らせない)", h1Rule);
  // 統一性: 加速の付け方は1種類、遷移の速さは3段階の基準だけ、ホバーで浮き上がり・拡大しない
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, "");
  ok([...new Set(plain.match(/cubic-bezier\([^)]*\)/g) ?? [])].length === 1 && /--ease:cubic-bezier/.test(plain), "加速の付け方(cubic-bezier)は、基準の1種類だけ", [...new Set(plain.match(/cubic-bezier\([^)]*\)/g) ?? [])].join(" "));
  const trans = [...plain.matchAll(/transition:([^;}]+)/g)].map((m) => m[1]).filter((v) => !/^none/.test(v));
  ok(trans.length > 5 && trans.every((v) => !/\d(\.\d+)?m?s\b/.test(v) && /var\(--t-[sml]\)/.test(v)), "遷移の速さは、すべて基準(--t-s / --t-m / --t-l)を使う", trans.filter((v) => /\d(\.\d+)?m?s\b/.test(v)).join(" | "));
  const hoverMoves = [...plain.matchAll(/([^{}]*:hover[^{}]*)\{([^{}]*)\}/g)].filter(([, sel, body]) => /translate|scale\(|scale:|transform/.test(body) && !/\.card:hover:before/.test(sel)).map(([, s]) => s.trim());
  ok(hoverMoves.length === 0, "ホバーでは、浮き上がり・拡大をしない(色と朱の線だけ。カードの線は伸びる)", hoverMoves.join(" | "));
  ok(!/@keyframes drop/.test(plain) && !/animation:drop/.test(plain), "弾む動き(ロゴの drop)は使わない");
  ok(["main .gcard", "main .mhead", "main .toc", "main .tblwrap"].every((s) => SEL_ALL.includes(s)), "新しい部品(ガイドのカード・月の見出し・目次・表)も、同じルールで現れる");
  ok(Number(statSync("scripts/motion.css").size) < 9000 && Number(statSync("scripts/motion.js").size) < 4000, "動きの CSS / JS が軽い(9KB / 4KB 未満)");

  // 隠す対象に、JSで後から作る要素・フォーム・ヒーローが入っていない
  const selMatch = css.match(/\.js :is\((.+?)\)\{opacity:0;/);
  const SEL = selMatch?.[1] ?? "";
  ok(!!SEL && !/hero|form|\.cal|monthlist|empty|calhead/.test(SEL), "隠す対象に、ヒーロー・フォーム・カレンダー・空表示を含まない", SEL);
  const cal = cheerio.load(read(join(OUT, "calendar.html")));
  ok(cal(SEL).filter((_, e) => cal(e).closest("#cal,#mlist,.calhead,#calmsg").length).length === 0, "カレンダーのJS描画部分は、隠す対象にならない");
  const sub = cheerio.load(read(join(OUT, "submit.html")));
  ok(sub(SEL).filter((_, e) => sub(e).closest("form").length).length === 0, "入力フォームは、隠す対象にならない(すぐに入力できる)");
  ok($(".home-hero h1").length === 1 && $(".home-hero").closest("main").length === 1 && !$(".home-hero")[0].attribs.class.includes("in"), "ヒーローの見出しは、隠す対象ではない(最大のコンテンツの表示を遅らせない)");
  const sp = $(".sparks");
  ok(sp.length === 1 && sp.attr("aria-hidden") === "true" && sp.find("i").length === 12 && sp.find("a,button,input").length === 0, "火の粉: 装飾(aria-hidden)・12個・操作できる要素を含まない");
  ok((css.match(/\.sparks i:nth-child\(\d+\)\{/g) ?? []).length === 12, "火の粉の位置・速さの設定が、12個ぶんある");
  ok(read(join(OUT, "index.html")) === home && !/class="js/.test(home.slice(0, 200)), "HTMLの時点では、js / intro クラスが付いていない(スクリプトが付ける)");

  section("動き: JS(出現・視差・導入・保険)を jsdom で動かす");
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
        // 実際には待たない(テストが終われなくなるため)。呼ぶ側の関数だけ記録し、テストから手動で呼ぶ
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
    const revealIO = t.ios.find((io) => io.els.length > 5), heroIO = t.ios.find((io) => io.els.length === 1);
    ok(!!revealIO && revealIO.els.every((e) => !e.classList.contains("in")), "出現の対象は、最初は未表示(in がない)", `${revealIO?.els.length}個`);
    const first = revealIO.els.slice(0, 3);
    t.hit(revealIO, first);
    ok(first.every((e) => e.classList.contains("in")) && revealIO.un.length === 3, "画面に入ると in が付き、観察をやめる");
    ok(first.map((e) => e.style.transitionDelay).join() === "0ms,70ms,140ms", "同時に入ったものは、70msずつ、ずらして出る", first.map((e) => e.style.transitionDelay).join());
    t.hit(revealIO, [revealIO.els[5]], false);
    ok(!revealIO.els[5].classList.contains("in"), "画面に入っていないものは、出さない");
    // 保険
    const failsafe = t.timers.find((x) => x.ms === 4000);
    ok(!!failsafe, "保険のタイマー(4秒)がある");
    failsafe.fn();
    ok(revealIO.els.slice(3).every((e) => !e.classList.contains("in")), "観察が動いている環境では、保険は、まだ出していないものを出さない(スクロールの演出を壊さない)");
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
    // 一気に先頭へ戻った(見えない間にスクロールが進み、見えた通知があとから届く)場合でも、最新の値になる
    Object.defineProperty(t.w, "pageYOffset", { value: 0, configurable: true });
    t.hit(heroIO, [t.d.querySelector(".home-hero")], true);
    ok(!t.d.querySelector(".sparks").classList.contains("off"), "ヒーローが見えたら、火の粉を再開する");
    ok(t.h.style.getPropertyValue("--py") === "0px", "先頭へ戻ってヒーローが見えた瞬間に、視差の値が最新(0px)になる(ずれたまま残らない)", t.h.style.getPropertyValue("--py"));
    Object.defineProperty(t.w, "pageYOffset", { value: 250, configurable: true });
    t.w.dispatchEvent(new t.w.Event("pageshow"));
    ok(t.h.style.getPropertyValue("--py") === "250px", "ページの復元(pageshow)でも、いまの位置にそろえる");
    // 印刷
    t.w.dispatchEvent(new t.w.Event("beforeprint"));
    ok(revealIO.els.every((e) => e.classList.contains("in")), "印刷の前に、すべて出す");
  }
  { // B. 2回目の訪問(同じセッション)
    const t = await run("index.html", { introSeen: true });
    ok(t.h.classList.contains("js") && !t.h.classList.contains("intro"), "同じセッションの2回目は、導入演出を出さない(js だけ)");
  }
  { // C. トップ以外
    const t = await run("map.html", { path: "/map.html" });
    ok(t.h.classList.contains("js") && !t.h.classList.contains("intro"), "トップ以外のページでは、導入演出を出さない");
    ok(t.ios.every((io) => io.els.length !== 1 || !io.els[0].classList.contains("home-hero")), "ヒーローがないページでは、視差の観察をしない");
  }
  for (const [p, path] of [["about.html", "/about.html"], ["about.html", "/about"], ["contact.html", "/contact.html"], ["privacy.html", "/privacy.html"], ["privacy.html", "/privacy"], ["terms.html", "/terms.html"], ["disclaimer.html", "/disclaimer.html"]]) { // 読むための文書(プライバシーポリシー・運営者情報)は、動かさない(.html なしの URL でも)
    const t = await run(p, { path });
    ok(!t.h.classList.contains("js") && t.ios.length === 0, `${path}: 動き(出現・視差)を付けない`);
  }
  { // D. 動きを減らす設定
    const t = await run("index.html", { reduced: true });
    ok(!t.h.classList.contains("js") && !t.h.classList.contains("intro"), "「動きを減らす」設定: js も intro も付かない");
    ok(t.ios.length === 0, "「動きを減らす」設定: 観察も視差も、始めない");
    ok(t.d.querySelectorAll(".card").length >= 6 && [...t.d.querySelectorAll(".card")].every((e) => !e.classList.contains("in")), "「動きを減らす」設定: 要素は、最初から全部ある(隠す規則が効かない)");
  }
  { // E. IntersectionObserver がない環境
    const t = await run("index.html", { noIO: true });
    ok(!t.h.classList.contains("js"), "IntersectionObserver がない環境: js が付かず、すべて普通に表示される");
  }
  { // F. 狭い画面: 視差はしない
    const t = await run("index.html", { wide: false });
    ok(t.ios.length === 1 && t.ios[0].els.length > 5, "狭い画面: 出現の観察だけ。視差の観察はしない");
    Object.defineProperty(t.w, "pageYOffset", { value: 300, configurable: true });
    t.w.dispatchEvent(new t.w.Event("scroll"));
    ok(t.h.style.getPropertyValue("--py") === "", "狭い画面: スクロール量を渡さない(動かさない)");
  }
}
