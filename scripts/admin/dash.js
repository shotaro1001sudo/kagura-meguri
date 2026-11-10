// 運営の状況(売上・集客・信号・掲載)の読み込みと、グラフ・数字の札の部品。データはサーバーの /api/overview(overview.mjs)
import { h, sv, view, render, call, typing, yen, fmtN, goLink, more } from "./ui.js";

// 状況を使うメニュー(読み込みが終わったら、描き直す)
const USES = ["todo", "goal", "numbers", "status"];
export async function loadOverview(fresh) {
  view.ovState = "loading";
  if (fresh && USES.includes(view.tab)) render();
  try { view.ov = await call("/api/overview" + (fresh ? "?fresh=1" : "")); view.ovError = ""; }
  catch (err) { view.ovError = err.message; }
  view.ovState = "done";
  if (USES.includes(view.tab) && !typing()) render();
}
/** 状況(なければ読み込みを始めて null を返す) */
export function overview() {
  if (!view.ov && view.ovState !== "loading" && !view.ovError) loadOverview();
  return view.ov || null;
}

export const valueOf = (v, unit) => (unit === "円" ? yen(v) : unit === "回" || !unit ? fmtN(v) : v == null ? "—" : fmtN(v) + unit);
function niceMax(v) {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v)), f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}
const tickText = (v, unit) => (unit === "円" ? (v >= 10000 ? `${v / 10000}万` : fmtN(v)) : v >= 10000 ? `${Math.round(v / 1000)}K` : fmtN(v));

// 値の説明(マウスとキーボードの両方。値は表でも見られるので、ここだけに頼らない)
const tip = h("div", { class: "tip", role: "tooltip" });
document.body.append(tip);
function showTip(el, lines) {
  tip.replaceChildren(...lines.map((l, i) => h(i ? "span" : "b", null, l)));
  tip.classList.add("on");
  const anchor = el.parentNode?.querySelector?.(".col") || el; // 棒があれば、棒の上に出す
  const r = anchor.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
  const x = Math.max(8, Math.min(r.left + r.width / 2 - tw / 2, innerWidth - tw - 8));
  const y = r.top - th - 8 < 8 ? r.bottom + 8 : r.top - th - 8;
  tip.style.left = x + "px"; tip.style.top = y + "px";
}
const hideTip = () => tip.classList.remove("on");
const tipAttrs = (lines) => ({ tabindex: "0", role: "img", "aria-label": lines.join("、"),
  onmouseenter: (e) => showTip(e.currentTarget, lines), onfocus: (e) => showTip(e.currentTarget, lines), onmouseleave: hideTip, onblur: hideTip });
addEventListener("scroll", hideTip, { passive: true });

// 縦の棒(1系列)と、目標の横線。値のそろっていない期間(今月・今週・計測の欠け)は薄い色。最後の値だけ数字を出す
const colPath = (x, y, w, hgt, r) => `M${x},${y + hgt}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + hgt}Z`;
export function columnChart({ label, items, unit, height = 190, table }) {
  const subs = items.some((x) => x.sub);
  const W = 640, L = 48, R = 8, T = 22, B = subs ? 40 : 28, H = height + (subs ? 12 : 0);
  const vals = items.flatMap((x) => [x.value, x.target]).filter((v) => v != null);
  const max = niceMax(Math.max(0, ...vals));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const band = (W - L - R) / Math.max(1, items.length), bw = Math.min(24, band * 0.56);
  const lastIdx = items.reduce((a, x, i) => (x.value != null ? i : a), -1);
  const grid = [0, max / 2, max].map((v) => [
    v ? sv("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), class: "grid" }) : "",
    sv("text", { x: L - 6, y: y(v) + 4, class: "tick", "text-anchor": "end" }, tickText(v, unit))]);
  const marks = items.map((x, i) => {
    const cx = L + band * i + band / 2, g = [];
    if (x.value > 0) { const top = y(x.value), base = y(0); g.push(sv("path", { d: colPath(cx - bw / 2, top, bw, base - top, Math.min(4, base - top)), class: "col" + (x.partial ? " partial" : "") })); }
    if (x.target != null) g.push(sv("line", { x1: cx - band * 0.38, x2: cx + band * 0.38, y1: y(x.target), y2: y(x.target), class: "tgt" }));
    if (i === lastIdx) g.push(sv("text", { x: cx, y: y(Math.max(x.value, 0)) - 7, class: "vlab", "text-anchor": "middle" }, valueOf(x.value, unit)));
    g.push(sv("text", { x: cx, y: H - B + 16, class: "tick", "text-anchor": "middle" }, x.label));
    if (x.sub) g.push(sv("text", { x: cx, y: H - B + 30, class: "tick", "text-anchor": "middle" }, x.sub));
    g.push(sv("rect", { x: L + band * i, y: T - 8, width: band, height: H - T - B + 8, class: "hit", ...tipAttrs(x.tip) }));
    return sv("g", { class: "m" }, g);
  });
  const hasT = items.some((x) => x.target != null), hasP = items.some((x) => x.partial);
  return h("figure", { class: "chart" },
    h("figcaption", null, label),
    sv("svg", { viewBox: `0 0 ${W} ${H}`, class: "viz", role: "group", "aria-label": label }, grid, sv("line", { x1: L, x2: W - R, y1: y(0), y2: y(0), class: "axis" }), marks),
    hasT || hasP ? h("p", { class: "legend" },
      hasT ? [h("span", { class: "key k-col", "aria-hidden": "true" }), "実績", h("span", { class: "key k-tgt", "aria-hidden": "true" }), "目標"] : "",
      hasP ? [h("span", { class: "key k-part", "aria-hidden": "true" }), "途中・値のそろっていない期間"] : "") : "",
    table ? more("表で見る", h("div", { class: "scroll" }, h("table", { class: "num" },
      h("thead", null, h("tr", null, table.head.map((c) => h("th", { scope: "col" }, c)))), h("tbody", null, table.rows.map((r) => h("tr", null, r.map((c) => h("td", null, c)))))))) : "");
}
// 横の棒(数字はすべて棒の横に出す)
export function hbars(items, fmt = fmtN) {
  const max = Math.max(1, ...items.map((x) => x.value || 0));
  return h("div", { class: "hbars" }, items.map((x) => {
    const bar = h("span", { class: "hb" });
    bar.style.width = `${Math.max(x.value ? 1.5 : 0, (x.value / max) * 100)}%`;
    return h("div", { class: "hrow" }, h("span", { class: "hl", title: x.label }, x.label, x.note ? h("small", null, x.note) : ""), h("span", { class: "ht" }, bar), h("span", { class: "hv" }, fmt(x.value)));
  }));
}
// 前の期間との比べ(上がるのが良いか、下がるのが良いか)
export function deltaOf(cur, prev, { lowerBetter = false, abs = false, enough = true, rank = false } = {}) {
  if (cur == null || prev == null || !enough) return h("small", { class: "mut" }, "比べられる前の期間がありません");
  const d = abs ? cur - prev : prev ? ((cur - prev) / prev) * 100 : null;
  if (d == null) return h("small", { class: "mut" }, "前の期間が 0");
  const up = d > 0, good = d === 0 ? null : up !== lowerBetter;
  // 順位は、数が小さくなるのが「上がる」。矢印は良し悪しの向きに合わせる
  if (rank) return h("small", { class: "delta " + (good == null ? "" : good ? "good" : "bad") }, d === 0 ? "→ 前の7日と同じ" : `${good ? "▲" : "▼"} ${Math.abs(d).toFixed(1)} ${good ? "上がった" : "下がった"}(前の7日より)`);
  const txt = abs ? `${up ? "+" : ""}${d.toFixed(1)}` : `${up ? "+" : ""}${Math.round(d)}%`;
  return h("small", { class: "delta " + (good == null ? "" : good ? "good" : "bad") }, d === 0 ? "→ " : up ? "▲ " : "▼ ", txt, " 前の7日より");
}
export const tile = (label, value, ...notes) => h("div", { class: "stat" }, h("span", { class: "stat-l" }, label), h("b", null, value), notes);
export const tileLink = (label, value, go, ...notes) => h("a", { href: "#/" + go[0], class: "stat", onclick: goLink(...go) }, h("span", { class: "stat-l" }, label), h("b", null, value), notes);
export const PACE = { ahead: ["good", "先行"], on: ["good", "予定どおり"], behind: ["bad", "遅れ"] };
// 進み具合のメーター: 実績 / 目標(線は、今日までに来ていたい位置)
export function paceMeter(value, target, p) {
  if (value == null || !target) return h("span", { class: "mut small" }, "—");
  const fill = h("span", { class: "pm-fill" + (p?.state === "behind" ? " bad" : "") });
  fill.style.width = `${Math.min(100, (value / target) * 100)}%`;
  const mark = h("span", { class: "pm-mark", title: "今日までの目安" });
  mark.style.left = `${Math.min(100, (p?.frac ?? 1) * 100)}%`;
  return h("span", { class: "pm" }, h("span", { class: "pm-track", role: "img", "aria-label": `目標の ${Math.round((value / target) * 100)}%。今日までの目安は ${Math.round((p?.frac ?? 1) * 100)}%` }, fill, mark),
    p ? h("small", { class: "delta " + PACE[p.state][0] }, PACE[p.state][1]) : "");
}
// 信号: 色に加えて、形と文字で示す
export const SIG = { stop: ["■", "停止"], warn: ["▲", "注意"], unknown: ["?", "不明"], ok: ["●", "正常"] };
export const sigMark = (state) => h("span", { class: "si s-" + state }, h("i", { "aria-hidden": "true" }, SIG[state][0]), " ", SIG[state][1]);
