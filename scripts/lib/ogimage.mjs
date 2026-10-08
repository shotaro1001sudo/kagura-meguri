// 共有用の画像(OG画像 1200x630)を、外部ライブラリなしで作る。和紙の地色に、朱の円相(筆で描いた円)だけの意匠。
// 文字は描かない(日本語フォントを持たない環境でも、同じ画像が作れるようにするため)。同じ入力からは、同じバイト列になる。
import { deflateSync } from "node:zlib";

const W = 1200, H = 630;
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));

export function ogImagePng() {
  const paper = hex("#f3eee4"), ink = hex("#2b2622"), red = hex("#9a3d2f"), line = hex("#d8cfbf");
  const raw = Buffer.alloc((W * 3 + 1) * H);
  const cx = 840, cy = 315, R = 205, thick = 30; // 円相の中心・半径・太さ
  const gapA = (-0.35) * Math.PI, gapB = 0.1 * Math.PI; // 円の切れ目(筆の終わり)
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      let col = paper;
      // 左側の縦の細い罫線(和紙の上の飾り罫)
      if (x >= 96 && x < 98 && y > 90 && y < H - 90) col = mix(col, line, 1);
      // 円相: 筆の太さが少し変わる円環
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
      const t = thick * (0.65 + 0.35 * Math.cos(ang + 0.8));
      const inGap = ang > gapA && ang < gapB;
      const edge = Math.abs(d - R) - t / 2; // 負なら円環の内側
      if (!inGap) { const cov = Math.max(0, Math.min(1, 0.5 - edge)); if (cov > 0) col = mix(col, red, cov * 0.92); }
      // ロゴと同じ、朱の小さな丸
      const ld = Math.hypot(x + 0.5 - 150, y + 0.5 - 150);
      const lc = Math.max(0, Math.min(1, 0.5 - (ld - 16))); if (lc > 0) col = mix(col, red, lc);
      // 下の墨の細い線
      if (y >= H - 100 && y < H - 98 && x > 150 && x < 560) col = mix(col, ink, 0.85);
      const o = y * (W * 3 + 1) + 1 + x * 3; raw[o] = col[0]; raw[o + 1] = col[1]; raw[o + 2] = col[2];
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
export const OG_SIZE = { width: W, height: H };
