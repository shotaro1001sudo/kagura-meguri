// Shift_JIS で、URL の文字列をエンコードする(じゃらんの検索は、キーワードを Shift_JIS で受け取るため)。
// 外部ライブラリを使わず、標準の TextDecoder("shift_jis") から、文字 → バイトの対応表を作る。
let table = null;
function build() {
  const td = new TextDecoder("shift_jis");
  table = new Map();
  for (let a = 0xa1; a <= 0xdf; a++) table.set(td.decode(Uint8Array.of(a)), [a]); // 半角カナ
  for (let a = 0x81; a <= 0xfc; a++) {
    if (a > 0x9f && a < 0xe0) continue;
    for (let b = 0x40; b <= 0xfc; b++) {
      if (b === 0x7f) continue;
      const c = td.decode(Uint8Array.of(a, b));
      if (c.length === 1 && c !== "�" && !table.has(c)) table.set(c, [a, b]);
    }
  }
}

/** Shift_JIS のバイト列を、%XX の形にする。Shift_JIS にない文字は、落とす */
export function encodeSjisURI(s) {
  if (!table) build();
  return [...String(s)].map((ch) => {
    if (ch.codePointAt(0) < 0x80) return encodeURIComponent(ch);
    const b = table.get(ch);
    return b ? b.map((x) => `%${x.toString(16).toUpperCase().padStart(2, "0")}`).join("") : "";
  }).join("");
}
