// 改行の位置を読みやすくする(2026-11-15 運営者の依頼。同日に言い直しがあり、いまの決まりは次の3つ)。
// 1. 行の右端で折り返すとき、言葉の途中では切らない。その手前の、句読点か「てにをは」の切れ目(文節の切れ目)で折り返す。
// 2. 句読点のたびに、かならず改行するわけではない(行は、入るところまで詰める)。
// 3. 話題が変わるところでは、改行する。
//
// 1・2 のやり方: 文を文節に分けて、切れ目に <wbr>(ここでなら折り返してよい、の印)を入れ、まわりを <span class="bw"> で包む。
// .bw は word-break:keep-all(字と字のあいだでは折り返さない)なので、折り返すのは <wbr> と句読点のあとだけになる。
// 文節の切れ目は、BudouX(Google の、日本語の文節を見分ける小さな辞書。Apache-2.0)で見分ける。ビルドのときに使うだけで、ページには載らない。
// CSS の word-break:auto-phrase(Chrome・Edge だけ)とちがい、iPhone の Safari でも同じように折り返す。
// 文字もタグも変えない(足すのは <wbr> と <span class="bw">・<span class="nb"> だけ)。
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// 辞書は、日本語のものだけを読み込む(パッケージの入口から読むと、使わない HTML の部品まで読み込んで、ビルドのたびに 0.4 秒ほど余計にかかる)。
// パッケージの中の置き場所が変わって読めなかったときは、入口から読む(版は package.json で固定してある)
const require = createRequire(import.meta.url);
const loadParser = () => {
  try {
    const dir = dirname(require.resolve("budoux"));
    const { Parser } = require(join(dir, "parser.js")), { model } = require(join(dir, "data", "models", "ja.js"));
    return new Parser(model);
  } catch {
    return require("budoux").loadDefaultJapaneseParser();
  }
};
const parser = loadParser();
export const SENT_END = "。！？";
const CLOSE = ")）」』";
const OPEN = "(（「『";

/** 文に分ける。つなぐと、元の文になる。かっこ「(…)」の中の「。」では分けない(補足を途中で切らない) */
export const sentenceParts = (s) => {
  const t = String(s ?? ""), out = []; let cur = "", depth = 0;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    cur += ch;
    if (ch === "(" || ch === "（") depth++;
    else if (ch === ")" || ch === "）") depth = Math.max(0, depth - 1);
    else if (depth === 0 && SENT_END.includes(ch)) {
      while (i + 1 < t.length && (SENT_END + CLOSE).includes(t[i + 1])) cur += t[++i];
      out.push(cur); cur = "";
    }
  }
  if (cur) out.push(cur);
  return out;
};

// 辞書の切れ目のうち、読みにくくなるものは、前後をつなぐ
const mergeWithPrev = (prev, next) =>
  [...prev].length === 1 || [...next].length === 1 // 1字だけのまとまりを作らない
  || new RegExp(`[${OPEN}][^${CLOSE}]{0,2}$`).test(prev) // 開きかっこのすぐあとでは切らない(「公演(あ」「おもり…」)
  || /^[)）」』、。！？・ー〜…]/.test(next) // 行の頭に置けない字の前では切らない
  || (/と$/.test(prev) && /^(して|いう|いった|いえ|いわれ|する|なる|なり|なっ)/.test(next)) // として・という・となる
  || (/に$/.test(prev) && /^(ついて|よる|よって|より|対して|おいて|とって|関して|なる|なり|なっ)/.test(next)) // について・による・になる
  || (/[A-Za-z0-9]$/.test(prev) && /^[A-Za-z0-9]/.test(next)) // 英数字の途中では切らない
  || (/&[A-Za-z0-9#]*$/.test(prev) && /^[A-Za-z0-9#]*;/.test(next)); // 「&amp;」のような書き方の途中では切らない

const cache = new Map();
/** 文節(折り返してよいまとまり)に分ける。つなぐと、元の文になる */
export const phraseParts = (s) => {
  const t = String(s ?? "");
  if (cache.has(t)) return cache.get(t);
  const out = [];
  for (const p of t.trim() ? parser.parse(t) : [t]) {
    if (out.length && mergeWithPrev(out[out.length - 1], p)) out[out.length - 1] += p; else out.push(p);
  }
  const parts = out.join("") === t ? out : [t]; // 念のため: 辞書が字を落としたら、分けない
  cache.set(t, parts);
  return parts;
};

// ---- 話題の切れ目(公演の説明・この開催のポイント) ----
// 文ごとに、何の話かを言葉で見分ける(日時・料金・行き方・予約と問い合わせ・気をつけること。どれでもなければ、公演の中身)。
// 機械で見分けるので、完全ではない。となりの文と話が変わったところで、行を分ける。
const TOPICS = [
  ["time", /(\d{1,2}時|\d{1,2}[:：]\d{2}|開場|開演|開始|終演|上演時間|所要時間|雨天|荒天|順延|中止|延期)/],
  ["fee", /(料金|無料|有料|\d円|入場料|観覧料|拝観料|チケット|前売|当日券|奉納金|初穂料|入場は|観覧は)/],
  ["access", /(駐車場|アクセス|車なら|車で|最寄り|駅から|バス|IC|インター|徒歩|シャトル|送迎|交通)/],
  ["contact", /(予約|申し込|申込|問い合わせ|問合せ|電話|定員|先着|抽選|受付)/],
  ["tips", /(防寒|冷え|寒さ|暑さ|持ち物|服装|雨具|マナー|撮影|ご確認|確認し|変更され|場合があ|注意)/],
];
export const topicOf = (sentence) => (TOPICS.find(([, re]) => re.test(sentence)) ?? ["about"])[0];
/** 文の頭が、話を変える言葉か */
const SHIFT = /^(また、|なお、|ただし、|一方、|そのほか|このほか|ちなみに)/;
/** まとまりが長いとき(4文以上)は、2文ずつに分ける(スマホで、ひとかたまりの長い文にしない) */
const CHUNK = 2;
/** 話題ごとのまとまり(それぞれ、文をつないだもの)に分ける。つなぐと、元の文になる */
export const topicGroups = (s) => {
  const groups = [];
  let last = null;
  for (const sent of sentenceParts(s)) {
    const topic = topicOf(sent);
    if (groups.length && topic === last && !SHIFT.test(sent.trim())) groups[groups.length - 1].push(sent);
    else groups.push([sent]);
    last = topic;
  }
  return groups.flatMap((g) => {
    if (g.length <= 3) return [g.join("")];
    const out = [];
    for (let i = 0; i < g.length; i += CHUNK) out.push(g.slice(i, i + CHUNK).join(""));
    return out;
  });
};

// ---- タグの入った文(ガイド・歴史のページ)向け ----
const VOID = new Set(["br", "wbr", "img", "input", "hr"]);
/** 文の中に置かれるタグ。これだけでできた段落を、文節に分ける */
const INLINE = new Set(["a", "b", "strong", "em", "i", "span", "sup", "sub", "small", "abbr", "cite", "ruby", "rt", "rp", "rb", "mark", "time", "q", "u", "s", "br", "wbr"]);
/** 文節に分ける入れ物(段落・箇条書き・表のマス・図の説明) */
const PROSE = new Set(["p", "li", "dd", "figcaption", "td"]);
/** 中を触らない入れ物(スクリプト・図・同意の前は動かさない広告の発行コードなど) */
const SKIP = new Set(["script", "style", "svg", "template", "textarea", "pre", "code", "button", "label", "nav", "summary"]);
// HTML を、コメント・タグ・文字に分ける。属性の値(引用符の中)に「>」があっても、タグの終わりと見まちがえない
const TOKENS = /<!--[\s\S]*?-->|<\/?[a-zA-Z](?:[^>"']|"[^"]*"|'[^']*')*>|<[^>]*>|[^<]+/g;
const tagOf = (tok) => {
  if (tok[0] !== "<" || tok.startsWith("<!--")) return null;
  const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)/.exec(tok);
  return m ? { end: m[1] === "/", name: m[2].toLowerCase(), selfClosing: /\/>$/.test(tok) } : null;
};
// 注釈(.meta・.annotation。ページ下の注記へまとめ直す仕組みが、文の始まりを見ている)と、出典の一覧の行は触らない
const skipByAttrs = (tok) => /\sclass="[^"]*\b(meta|annotation|gnav-h)\b/.test(tok) || /\sid="src-/.test(tok);
// 文の中でも、中の文字を触らないタグ(出典の印・すでに「ここは割らない」としてあるところ)
const keepWhole = (tok, tag) => tag.name === "sup" || tag.name === "rt" || /\sclass="[^"]*\b(nw|ph|nb)\b/.test(tok);
/** 出典の印([1] など)を、前の言葉に付けておく長さの上限(これより長い言葉には付けない。1行に入らなくなるため) */
const CITE_ATTACH_MAX = 14;

/** 文の中のタグだけでできた中身に、折り返してよい印を入れる。印が1つも入らなければ、そのまま返す */
function wrapInline(toks) {
  const out = []; const stack = []; let keep = 0, marks = 0, closeNbAt = -1;
  const closeOf = (i, name) => { let d = 0; for (let j = i + 1; j < toks.length; j++) { const t = tagOf(toks[j]); if (!t || t.name !== name || t.selfClosing) continue; if (!t.end) d++; else if (d === 0) return j; else d--; } return -1; };
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i], tag = tagOf(t);
    if (!tag) {
      if (t[0] === "<" || keep > 0 || !t.trim()) { out.push(t); continue; } // コメント・触らないタグの中・空白だけ
      const parts = phraseParts(t);
      marks += parts.length - 1;
      // すぐあとに出典の印が続くときは、最後の言葉と印を、ひと組にして離さない(印だけが次の行に落ちないように)
      const next = tagOf(toks[i + 1] ?? "");
      const end = next && !next.end && next.name === "sup" && stack.length === 0 ? closeOf(i + 1, "sup") : -1;
      const lastPart = parts[parts.length - 1];
      if (end > 0 && [...lastPart.trim()].length <= CITE_ATTACH_MAX && closeNbAt < 0) {
        out.push(parts.slice(0, -1).join("<wbr>") + (parts.length > 1 ? "<wbr>" : "") + '<span class="nb">' + lastPart);
        closeNbAt = end; marks++;
      } else out.push(parts.join("<wbr>"));
      continue;
    }
    out.push(t);
    if (!tag.end && !VOID.has(tag.name) && !tag.selfClosing) { const k = keepWhole(t, tag); stack.push(k); if (k) keep++; }
    else if (tag.end) { if (stack.pop()) keep--; }
    if (i === closeNbAt) { out.push("</span>"); closeNbAt = -1; }
  }
  if (closeNbAt >= 0) return toks.join(""); // 念のため: 閉じられなかったら、何もしない
  return marks ? `<span class="bw">${out.join("")}</span>` : toks.join("");
}

/**
 * HTML の中の段落・箇条書き・表のマス・図の説明に、折り返してよい印(文節の切れ目)を入れる。
 * 中に見出し・リスト・図・入力欄などがある入れ物は、その入れ物では触らず、内側の段落を見る。
 */
export function phrasesHtml(html) {
  const toks = String(html ?? "").match(TOKENS) ?? [];
  const out = [];
  // i 番目の開始タグに対応する終了タグの位置(見つからなければ -1)
  const closeOf = (i, name) => {
    let d = 0;
    for (let j = i + 1; j < toks.length; j++) {
      const t = tagOf(toks[j]);
      if (!t || t.name !== name || t.selfClosing) continue;
      if (!t.end) d++; else if (d === 0) return j; else d--;
    }
    return -1;
  };
  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i], tag = tagOf(tok);
    if (!tag || tag.end || tag.selfClosing || VOID.has(tag.name)) { out.push(tok); continue; }
    if (SKIP.has(tag.name)) {
      const j = closeOf(i, tag.name);
      if (j < 0) { out.push(tok); continue; }
      out.push(toks.slice(i, j + 1).join("")); i = j; continue;
    }
    if (PROSE.has(tag.name)) {
      const j = closeOf(i, tag.name);
      if (j >= 0 && skipByAttrs(tok)) { out.push(toks.slice(i, j + 1).join("")); i = j; continue; } // 注釈などは、中もそのまま
      const inner = j < 0 ? null : toks.slice(i + 1, j);
      if (inner && inner.every((x) => { const t = tagOf(x); return !t || INLINE.has(t.name); })) {
        out.push(tok, wrapInline(inner), toks[j]); i = j; continue;
      }
    }
    out.push(tok);
  }
  return out.join("");
}

/** phrasesHtml が足した <wbr>・<span class="bw">・<span class="nb"> と、その閉じタグだけを取り除く(テスト用。元の HTML に戻る) */
export function unphrase(html) {
  const toks = String(html ?? "").match(TOKENS) ?? [];
  const out = [], stack = [];
  for (const tok of toks) {
    if (tok === "<wbr>") continue;
    const tag = tagOf(tok);
    if (tag && tag.name === "span" && !tag.selfClosing) {
      if (!tag.end) { const mine = tok === '<span class="bw">' || tok === '<span class="nb">'; stack.push(mine); if (mine) continue; }
      else if (stack.pop()) continue;
    }
    out.push(tok);
  }
  return out.join("");
}
