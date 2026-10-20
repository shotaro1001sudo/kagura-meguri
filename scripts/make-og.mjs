// 共有用の画像(OG画像 1200x630)を、トップの絵(assets/hero-pc.webp)とサイト名から作る。
// できた画像は assets/og.jpg(日本語)と assets/og-en.jpg(英語)に置き、ビルドはそれをコピーするだけ。
// 絵や文言を変えたときだけ、手元で実行する: node scripts/make-og.mjs
// 文字の描画にブラウザ(Playwright)を使う。ビルドの環境には入れないため、ここだけで使う。
//   PLAYWRIGHT_MODULE: playwright の場所(既定 "playwright")、CHROMIUM: ブラウザの実行ファイル(任意)
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
const dataUrl = (f, type) => `data:${type};base64,${readFileSync(f).toString("base64")}`;
const HERO = dataUrl("assets/hero-pc.webp", "image/webp"), SYMBOL = dataUrl("assets/symbol.png", "image/png");
const FONTS = "https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;600&family=Zen+Kaku+Gothic+New:wght@500&display=block";

const VARIANTS = [
  { out: "assets/og.jpg", lang: "ja", brand: "神楽めぐり", catch: "神話を受け継ぐ舞を、<br>この目で。", sub: "全国の神楽の日程と会場を探せるサイト", brandSpacing: ".14em", brandSize: 72 },
  { out: "assets/og-en.jpg", lang: "en", brand: "Kagura Meguri", catch: "Sacred dance and myth,<br>seen with your own eyes.", sub: "Find kagura performances across Japan", brandSpacing: ".04em", brandSize: 62 },
];

const html = (v) => `<!doctype html><html lang="${v.lang}"><head><meta charset="utf-8"><link href="${FONTS}" rel="stylesheet"><style>
html,body{margin:0}
.c{position:relative;width:1200px;height:630px;overflow:hidden;background:#f3eee4}
.bg{position:absolute;right:-70px;top:0;width:1260px;height:630px;object-fit:cover}
.c::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(243,238,228,.97) 0,rgba(243,238,228,.9) 40%,rgba(243,238,228,0) 58%)}
.t,.url{position:absolute;z-index:1}
.t{left:84px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;color:#2b2622;font-family:"Shippori Mincho",serif}
.brand{display:flex;align-items:center;gap:18px;font-size:${v.brandSize}px;font-weight:600;letter-spacing:${v.brandSpacing}}
.brand img{width:72px;height:72px}
.rule{width:96px;height:3px;background:#9a3d2f;margin:30px 0 30px 4px}
.catch{font-size:${v.lang === "ja" ? 40 : 36}px;font-weight:500;letter-spacing:${v.lang === "ja" ? ".12em" : ".01em"};line-height:1.6}
.sub{margin-top:22px;font-family:"Zen Kaku Gothic New",sans-serif;font-size:22px;letter-spacing:.08em;color:#5a4f46}
.url{left:88px;bottom:40px;font-family:"Zen Kaku Gothic New",sans-serif;font-size:20px;letter-spacing:.12em;color:#9a3d2f}
</style></head><body><div class="c"><img class="bg" src="${HERO}" alt="">
<div class="t"><div class="brand"><img src="${SYMBOL}" alt="">${v.brand}</div><div class="rule"></div><div class="catch">${v.catch}</div><div class="sub">${v.sub}</div></div>
<div class="url">kagurameguri.jp</div></div></body></html>`;

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const v of VARIANTS) {
  await page.setContent(html(v), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(v.out, await page.screenshot({ type: "jpeg", quality: 85 }));
  console.log(`作成: ${v.out}`);
}
await browser.close();
