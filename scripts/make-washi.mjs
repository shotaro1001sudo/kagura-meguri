// 背景の和紙の質感(繰り返して敷く 400×400 の SVG)を作る: node scripts/make-washi.mjs
// 楮(こうぞ)の繊維の筋 + ゆるやかなムラ + 細かい砂目。色は下地に重ねる半透明だけで、地色は CSS の --bg のまま。
// 乱数は種を固定しているので、何度実行しても同じファイルになる。できたファイルは assets/ に置き、ビルドがコピーする
import { writeFileSync } from "node:fs";

const T = 400; // 1枚の大きさ(px)。端をまたぐ繊維は、反対側にも描いて、つなぎ目を見せない
let seed = 20261020;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const r1 = (n) => Math.round(n * 10) / 10;

/** 繊維: ゆるく曲がった細い線。{ d, w(太さ), o(濃さ) } */
function fibers(count, [minLen, maxLen]) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const x = rnd() * T, y = rnd() * T, a = rnd() * Math.PI * 2, len = minLen + rnd() * (maxLen - minLen);
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
    const bend = (rnd() - 0.5) * len * 0.6, nx = -Math.sin(a), ny = Math.cos(a);
    const c1x = x + Math.cos(a) * len * 0.33 + nx * bend, c1y = y + Math.sin(a) * len * 0.33 + ny * bend;
    const c2x = x + Math.cos(a) * len * 0.66 - nx * bend * 0.7, c2y = y + Math.sin(a) * len * 0.66 - ny * bend * 0.7;
    const d = `M${r1(x)} ${r1(y)}C${r1(c1x)} ${r1(c1y)} ${r1(c2x)} ${r1(c2y)} ${r1(ex)} ${r1(ey)}`;
    out.push({ d, w: r1(0.4 + rnd() * 0.8), o: Math.round((0.35 + rnd() * 0.65) * 100) / 100, box: [Math.min(x, ex, c1x, c2x), Math.min(y, ey, c1y, c2y), Math.max(x, ex, c1x, c2x), Math.max(y, ey, c1y, c2y)] });
  }
  return out;
}
// 端をまたぐ繊維を、上下左右(と角)にずらして、もう一度描く
const wrapped = (fs) => fs.flatMap((f) => {
  const [x0, y0, x1, y1] = f.box, sx = [0], sy = [0];
  if (x0 < 0) sx.push(T); if (x1 > T) sx.push(-T); if (y0 < 0) sy.push(T); if (y1 > T) sy.push(-T);
  return sx.flatMap((dx) => sy.map((dy) => (dx || dy ? { ...f, t: `translate(${dx} ${dy})` } : f)));
});
const paths = (fs) => wrapped(fs).map((f) => `<path d="${f.d}" stroke-width="${f.w}" stroke-opacity="${f.o}"${f.t ? ` transform="${f.t}"` : ""}/>`).join("");

const long = fibers(34, [60, 160]), short = fibers(70, [12, 50]);
// 明るい配色: 白っぽい繊維(紙より明るい)と、ごく薄い茶の繊維。暗い配色: 明るい繊維を、ごく薄く
const svg = ({ light, dark, mottle, grain }) => `<svg xmlns="http://www.w3.org/2000/svg" width="${T}" height="${T}" viewBox="0 0 ${T} ${T}">
<filter id="m" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".007" numOctaves="3" seed="7" stitchTiles="stitch"/><feColorMatrix values="${mottle}"/></filter>
<filter id="g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="${grain}"/></filter>
<rect width="${T}" height="${T}" filter="url(#m)"/><rect width="${T}" height="${T}" filter="url(#g)"/>
<g fill="none" stroke-linecap="round" stroke="${light.c}" opacity="${light.o}">${paths(long)}${paths(short.slice(0, 44))}</g>
<g fill="none" stroke-linecap="round" stroke="${dark.c}" opacity="${dark.o}">${paths(short.slice(44))}${paths(long.slice(0, 8))}</g>
</svg>
`;

writeFileSync("assets/washi.svg", svg({
  light: { c: "#fffdf7", o: 0.9 }, dark: { c: "#8a7650", o: 0.16 },
  mottle: "0 0 0 0 .55 0 0 0 0 .47 0 0 0 0 .34 0 0 0 .22 -.08", grain: "0 0 0 0 .4 0 0 0 0 .35 0 0 0 0 .3 0 0 0 .07 0",
}));
writeFileSync("assets/washi-dark.svg", svg({
  light: { c: "#e4ddd0", o: 0.09 }, dark: { c: "#000000", o: 0.25 },
  mottle: "0 0 0 0 .9 0 0 0 0 .85 0 0 0 0 .75 0 0 0 .07 -.025", grain: "0 0 0 0 .9 0 0 0 0 .85 0 0 0 0 .8 0 0 0 .05 0",
}));
console.log("作成: assets/washi.svg / assets/washi-dark.svg");
