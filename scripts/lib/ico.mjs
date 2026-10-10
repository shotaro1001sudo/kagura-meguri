// ICO(Windows のアイコン形式)を、PNG から作る。サイトの /favicon.ico と、管理者用ページのショートカットで使う
/** PNG をそのまま包んだ ICO(Windows Vista 以降で表示できる) */
export function pngToIco(png) {
  const head = Buffer.alloc(22);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4); // 予約・種類(アイコン)・枚数
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  head.writeUInt8(w >= 256 ? 0 : w, 6); head.writeUInt8(h >= 256 ? 0 : h, 7);
  head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12); head.writeUInt32LE(png.length, 14); head.writeUInt32LE(22, 18);
  return Buffer.concat([head, png]);
}
