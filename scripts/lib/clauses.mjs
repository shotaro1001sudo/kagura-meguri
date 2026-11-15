// 句読点(、。)のあとで改行されやすくする(2026-11-15 運営者の依頼「改行は、読みやすいように句読点で可能な限り改行する」)。
// 句読点までのまとまりを、行の途中で割れにくい組(<span class="cl"> = inline-block)にする。
// 次のまとまりが行の残りに入らなければ、句読点のあとで改行される。まとまりが1行より長いときは、その中で折り返す(見た目は style.css の .cl)。
// 文字もタグも変えない(足すのは <span class="cl"> と </span> だけ)。

export const CLAUSE_END = "、。！？";
export const CLAUSE_CLOSE = ")）」』";

/**
 * 文を、句読点までのまとまりに分ける。つなぐと、元の文になる。「。)」「、」」のような続きは、前のまとまりに付ける。
 * かっこ「(…)」の中の句読点では分けない(「天鈿女命(『日本書紀』の表記。『古事記』では…)が」のような補足を、途中で切らない)。
 * paren: 文の始まりで、すでに開いているかっこの数(タグをまたいで続くとき)。返り値の depth は、文の終わりで開いたままの数
 */
export const splitClauses = (s, paren = 0) => {
  const t = String(s ?? ""), parts = []; let cur = "", depth = paren;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    cur += ch;
    if (ch === "(" || ch === "（") depth++;
    else if (ch === ")" || ch === "）") depth = Math.max(0, depth - 1);
    else if (depth === 0 && CLAUSE_END.includes(ch)) {
      while (i + 1 < t.length && (CLAUSE_END + CLAUSE_CLOSE).includes(t[i + 1])) cur += t[++i];
      parts.push(cur); cur = "";
    }
  }
  if (cur) parts.push(cur);
  return { parts, depth };
};
export const clauseParts = (s) => splitClauses(s).parts;

// ---- タグの入った文(ガイド・歴史のページ)向け ----
const VOID = new Set(["br", "wbr", "img", "input", "hr"]);
/** 文の中に置かれるタグ。これだけでできた段落を、まとまりに分ける */
const INLINE = new Set(["a", "b", "strong", "em", "i", "span", "sup", "sub", "small", "abbr", "cite", "ruby", "rt", "rp", "rb", "mark", "time", "q", "u", "s", "br", "wbr"]);
/** まとまりに分ける入れ物(段落・箇条書き・表のマス・図の説明) */
const PROSE = new Set(["p", "li", "dd", "figcaption", "td"]);
/** 中を触らない入れ物(スクリプト・図・同意の前は動かさない広告の発行コードなど) */
const SKIP = new Set(["script", "style", "svg", "template", "textarea", "pre", "code", "button", "label", "nav", "summary"]);
const ENDS_CLAUSE = new RegExp(`[${CLAUSE_END}][${CLAUSE_END}${CLAUSE_CLOSE}]*\\s*$`);

// HTML を、コメント・タグ・文字に分ける。属性の値(引用符の中)に「>」があっても、タグの終わりと見まちがえない
const TOKENS = /<!--[\s\S]*?-->|<\/?[a-zA-Z](?:[^>"']|"[^"]*"|'[^']*')*>|<[^>]*>|[^<]+/g;
const tagOf = (tok) => {
  if (tok[0] !== "<" || tok.startsWith("<!--")) return null;
  const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)/.exec(tok);
  return m ? { end: m[1] === "/", name: m[2].toLowerCase(), selfClosing: /\/>$/.test(tok) } : null;
};
// 注釈(.meta・.annotation。ページ下の注記へまとめ直す仕組みが、文の始まりを見ている)と、出典の一覧の行は分けない
const skipByAttrs = (tok) => /\sclass="[^"]*\b(meta|annotation|gnav-h)\b/.test(tok) || /\sid="src-/.test(tok);

/** 文の中のタグだけでできた中身を、句読点までのまとまりに分ける。まとまりが1つなら、そのまま返す */
function wrapInline(toks) {
  const out = []; let cur = "", depth = 0, pending = false, endsClause = false, count = 0, paren = 0;
  const flush = () => { if (cur !== "") { out.push({ html: cur }); if (cur.trim() !== "") count++; } cur = ""; pending = false; };
  for (const t of toks) {
    const tag = tagOf(t);
    if (!tag) {
      if (t[0] === "<") { cur += t; continue; } // コメント
      if (depth > 0) { // リンクや強調の中では分けない(かっこの開き閉じだけ数える)
        cur += t; paren = splitClauses(t, paren).depth;
        if (t.trim() !== "") endsClause = paren === 0 && ENDS_CLAUSE.test(t);
        continue;
      }
      let rest = t;
      if (pending) {
        // 句読点のすぐあとに続く「」」「)」は、前のまとまりに付ける
        let n = 0; while (n < rest.length && (CLAUSE_END + CLAUSE_CLOSE).includes(rest[n])) n++;
        cur += rest.slice(0, n); rest = rest.slice(n);
        if (rest.trim() === "") { cur += rest; continue; }
        flush();
      }
      const split = splitClauses(rest, paren);
      split.parts.forEach((p, i) => {
        cur += p;
        const last = i === split.parts.length - 1;
        if (last && (split.depth > 0 || !ENDS_CLAUSE.test(p))) return; // 文の途中(かっこが開いたまま・句読点で終わっていない)
        if (!last) flush(); else pending = true; // 最後のまとまりは、あとに続く出典の印([1] など)を待つ
      });
      paren = split.depth;
      continue;
    }
    if (!tag.end) {
      if (tag.name === "br" && depth === 0) { flush(); out.push({ raw: t }); continue; } // 改行のタグは、まとまりの外に置く
      if (depth === 0 && pending && tag.name !== "sup") flush(); // 句読点のすぐあとの出典の印は、前の文に付ける。ほかのタグは、次のまとまりの始まり
      cur += t;
      if (!VOID.has(tag.name) && !tag.selfClosing) depth++;
    } else {
      cur += t; depth = Math.max(0, depth - 1);
      if (depth === 0 && endsClause) { pending = true; endsClause = false; } // 「<b>…。</b>」のように、タグの中で文が終わったとき
    }
  }
  flush();
  if (count < 2) return toks.join("");
  return out.map((x) => (x.raw !== undefined ? x.raw : x.html.trim() === "" ? x.html : `<span class="cl">${x.html}</span>`)).join("");
}

/**
 * HTML の中の段落・箇条書き・表のマス・図の説明を、句読点までのまとまりに分ける。
 * 中に見出し・リスト・図・入力欄などがある入れ物は、その入れ物では分けず、内側の段落を見る。
 */
export function clausesHtml(html) {
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
    if (PROSE.has(tag.name) && !skipByAttrs(tok)) {
      const j = closeOf(i, tag.name);
      const inner = j < 0 ? null : toks.slice(i + 1, j);
      if (inner && inner.every((x) => { const t = tagOf(x); return !t || INLINE.has(t.name); })) {
        out.push(tok, wrapInline(inner), toks[j]); i = j; continue;
      }
    } else if (PROSE.has(tag.name)) {
      // 分けない入れ物(注釈など)は、中もそのまま
      const j = closeOf(i, tag.name);
      if (j >= 0) { out.push(toks.slice(i, j + 1).join("")); i = j; continue; }
    }
    out.push(tok);
  }
  return out.join("");
}

/** clausesHtml が足した <span class="cl"> と、その閉じタグだけを取り除く(テスト用。元の HTML に戻る) */
export function unclause(html) {
  const toks = String(html ?? "").match(TOKENS) ?? [];
  const out = [], stack = [];
  for (const tok of toks) {
    const tag = tagOf(tok);
    if (tag && tag.name === "span" && !tag.selfClosing) {
      if (!tag.end) { const mine = tok === '<span class="cl">'; stack.push(mine); if (mine) continue; }
      else if (stack.pop()) continue;
    }
    out.push(tok);
  }
  return out.join("");
}
