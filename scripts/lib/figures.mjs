// 「はじめての神楽ガイド」と「神楽の歴史」に載せる、図と表の部品。
// 流れ図・ツリー・表は HTML+CSS(画面の幅で、横並びと縦並びが変わる)、絵の部分は SVG(色は、サイトの配色に追従する)。
// 図の中に、出典の番号は入れない。図は、近くの本文(出典つき)の内容を、見やすく整理したもの。

const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** 図の枠。caption は図の下の説明(図の要点を、文章でも書く) */
export const figure = (inner, caption, cls = "") => `<figure class="fig${cls ? " " + cls : ""}">${inner}<figcaption>${caption}</figcaption></figure>`;

/** 流れ図: 画面が広ければ横、狭ければ縦に並ぶ。steps: [{ t: 見出し, d: 説明 }] */
export const flow = (steps, label, cls = "") => `<ol class="flow${cls ? " " + cls : ""}" aria-label="${esc(label)}">${steps.map((s, i) => `<li><span class="n">${i + 1}</span><b>${s.t}</b>${s.d ? `<span class="d">${s.d}</span>` : ""}</li>`).join("")}</ol>`;

/** 分類のツリー: root の下に、枝(children)が並ぶ。branch: { t, d, children?: [{ t, d }] } */
export const tree = (root, branches, label) => `<div class="tree" role="group" aria-label="${esc(label)}"><div class="tr-root"><b>${root}</b></div><ul class="tr-l1">${branches.map((b) => `<li><div class="tr-n"><b>${b.t}</b>${b.d ? `<span class="d">${b.d}</span>` : ""}</div>${b.children ? `<ul class="tr-l2">${b.children.map((c) => `<li><div class="tr-n"><b>${c.t}</b>${c.d ? `<span class="d">${c.d}</span>` : ""}</div></li>`).join("")}</ul>` : ""}</li>`).join("")}</ul></div>`;

/** 比べる表。head: 列の見出し(先頭は空)、rows: [見出し, セル, セル...](セルは HTML) */
export const table = (head, rows, label, cls = "") => `<div class="tblwrap" role="region" aria-label="${esc(label)}" tabindex="0"><table class="tbl cmp${cls ? " " + cls : ""}"><thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.map(([h, ...cells]) => `<tr><th scope="row">${h}</th>${cells.map((c, i) => `<td data-k="${esc(head[i + 1].replace(/<[^>]+>/g, ""))}">${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

// ---- アイコン(24×24の線画。色は、文字の色に追従する) ----
const ICONS = {
  camera: '<rect x="3" y="7" width="18" height="12" rx="2"/><circle cx="12" cy="13" r="3.4"/><path d="M8.5 7l1.3-2.2h4.4L15.5 7"/>',
  flash: '<path d="M13 3L6 13h5l-1 8 8-11h-5z"/><path d="M4 4l16 16"/>',
  voice: '<path d="M4 5h16v10H10l-4 4v-4H4z"/><path d="M8 9h8M8 12h5"/>',
  bin: '<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"/><path d="M10 11v5M14 11v5"/>',
  flower: '<circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="6" r="2.6"/><circle cx="12" cy="18" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="12" r="2.6"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/><path d="M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5"/>',
  chair: '<path d="M7 4v9h10V4M5 13h14M7 13l-1 7M17 13l1 7M7 17h10"/>',
  bottle: '<path d="M10 3h4v3l2 3v11H8V9l2-3z"/><path d="M8 13h8"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  phone: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  car: '<path d="M4 15l1.6-5.2A2 2 0 0 1 7.5 8h9a2 2 0 0 1 1.9 1.8L20 15v3h-2.5v-1.5h-11V18H4z"/><circle cx="8" cy="13.2" r=".6"/><circle cx="16" cy="13.2" r=".6"/>',
  eye: '<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
};
export const icon = (name) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;

/** 神楽殿の見方(一例): 上から、神前・舞台・囃子方・客席 */
export const stageDiagram = () => `<svg class="dg" viewBox="0 0 360 270" role="img" aria-label="神楽の舞台の見方(一例)。上に神前、その手前に舞台(舞い手)、舞台の脇に囃子方(太鼓・笛・鉦)、いちばん手前に客席が並ぶ図。">
<rect class="dg-box" x="10" y="8" width="340" height="44" rx="6"/><text class="dg-t" x="180" y="36" text-anchor="middle" font-size="16">神前(神様をお迎えする場所)</text>
<rect class="dg-stage" x="10" y="64" width="340" height="124" rx="6"/>
<text class="dg-m" x="22" y="86" font-size="13">舞台(神楽殿・舞庭)</text>
<circle class="dg-ac" cx="120" cy="112" r="12"/><path class="dg-aclin" d="M120 124v24M106 134l14-6 14 6M120 148l-9 14M120 148l9 14"/><text class="dg-t" x="120" y="180" text-anchor="middle" font-size="13">舞い手(面・衣装)</text>
<rect class="dg-box" x="228" y="98" width="112" height="76" rx="6"/><text class="dg-t" x="284" y="120" text-anchor="middle" font-size="15">囃子方</text><text class="dg-m" x="284" y="142" text-anchor="middle" font-size="12">大太鼓・小太鼓</text><text class="dg-m" x="284" y="158" text-anchor="middle" font-size="12">手打鉦・笛</text>
<rect class="dg-box dg-seat" x="10" y="204" width="340" height="56" rx="6"/><text class="dg-t" x="180" y="228" text-anchor="middle" font-size="16">客席(あなたの場所)</text><text class="dg-m" x="180" y="248" text-anchor="middle" font-size="12">舞い手の動きと、囃子の呼吸をあわせて見る</text></svg>`;

/** 湯立のしくみ(一例): 釜の湯を、巫女が笹で振りかける */
export const yudateDiagram = () => `<svg class="dg" viewBox="0 0 360 300" role="img" aria-label="湯立のしくみ。神前の釜で湯を沸かし、神がかりした巫女が笹を湯に浸して、自分や参詣者に振りかける様子を示した図。">
<rect class="dg-box" x="10" y="8" width="340" height="36" rx="6"/><text class="dg-t" x="180" y="32" text-anchor="middle" font-size="15">神前(勧請した神々に、湯を献上する)</text>
<path class="dg-steam" d="M72 118c-7-9 7-13 0-22M100 118c-7-9 7-13 0-22M128 118c-7-9 7-13 0-22"/>
<path class="dg-pot" d="M48 128h104v46q0 22-22 22H70q-22 0-22-22z"/><text class="dg-t" x="100" y="168" text-anchor="middle" font-size="16">釜</text>
<path class="dg-fire" d="M70 206c4-8 8-3 10-12 4 6 9 5 6 12M104 206c4-8 8-3 10-12 4 6 9 5 6 12"/>
<circle class="dg-ac" cx="232" cy="110" r="12"/><path class="dg-aclin" d="M232 122v36M232 158l-10 24M232 158l10 24M232 134l-36-14M232 134l34 6"/>
<path class="dg-leaf" d="M196 120l-12-10M196 120l-14 2M196 120l-10 12"/>
<circle class="dg-drop" cx="276" cy="134" r="3"/><circle class="dg-drop" cx="284" cy="142" r="3"/><circle class="dg-drop" cx="280" cy="126" r="3"/>
<circle class="dg-dot" cx="320" cy="124" r="9"/><path class="dg-line" d="M320 133v28M320 161l-7 18M320 161l7 18M320 142l-10 8M320 142l10 8"/>
<text class="dg-t" x="232" y="202" text-anchor="middle" font-size="13">神がかりの巫女</text><text class="dg-t" x="320" y="198" text-anchor="middle" font-size="13">参詣者</text>
<circle class="dg-ac" cx="40" cy="132" r="9"/><text class="dg-num" x="40" y="136" text-anchor="middle" font-size="11">1</text>
<circle class="dg-ac" cx="190" cy="98" r="9"/><text class="dg-num" x="190" y="102" text-anchor="middle" font-size="11">2</text>
<circle class="dg-ac" cx="268" cy="106" r="9"/><text class="dg-num" x="268" y="110" text-anchor="middle" font-size="11">3</text>
<rect class="dg-box" x="10" y="226" width="340" height="66" rx="6"/>
<text class="dg-t" x="24" y="248" font-size="13">1  神前の釜で、湯を沸かす</text><text class="dg-t" x="24" y="266" font-size="13">2  巫女が、笹を湯に浸す</text><text class="dg-t" x="24" y="284" font-size="13">3  自分や周りの人に、湯を振りかける</text></svg>`;
