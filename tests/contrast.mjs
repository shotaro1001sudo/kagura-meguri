// 配色のコントラスト比(WCAG): style.css の変数を読み取って計算する。node tests/contrast.mjs で一覧表示
import { readFileSync } from "node:fs";
const lum = (h) => { const c = h.replace("#", "").match(/../g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
export function palettes(css = readFileSync("scripts/style.css", "utf8")) {
  const vars = (block) => Object.fromEntries([...block.matchAll(/--([a-z0-9]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
  const light = vars(css.match(/:root\{([^}]*)\}/)[1]);
  const dark = { ...light, ...vars(css.match(/prefers-color-scheme:dark\)\{:root\{([^}]*)\}/)[1]) };
  return { light, dark };
}
export const PAIRS = [["fg", "bg"], ["fg", "card"], ["mut", "bg"], ["mut", "card"], ["ac", "bg"], ["ac", "card"], ["ac2", "bg"], ["ac2", "card"], ["onac", "ac"]];
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  for (const [n, t] of Object.entries(palettes())) {
    console.log(`[${n}]`);
    for (const [a, b] of PAIRS) { const r = ratio(t[a], t[b]); console.log(`  ${a.padEnd(4)} on ${b.padEnd(4)} ${r.toFixed(2)}${r < 4.5 ? "  ← 4.5未満" : ""}`); }
  }
}