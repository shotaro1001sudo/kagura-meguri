// スマホから管理者用ページを開くための設定(Tailscale 経由)
// - Tailscale の「Serve」が、自分の端末だけに見える https://<このPCの名前>.<tailnet>.ts.net を、このPCの 127.0.0.1:4300 につなぐ
// - それに加えて、スマホごとに「鍵」が必要。PC の画面の QR コードを読むと、スマホに鍵(Cookie)が入る
// - 鍵は .admin/phone.json(Git に入らない)。作り直すと、それまでのスマホからは開けなくなる
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { execFile } from "node:child_process";

const file = (root) => join(root, ".admin/phone.json");
const HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

/** スマホ用の鍵を読む(なければ作る) */
export function phoneKey(root) {
  const p = file(root);
  if (existsSync(p)) { const v = JSON.parse(readFileSync(p, "utf8")); if (v.key) return v.key; }
  return resetPhoneKey(root);
}
/** 鍵を作り直す(それまでのスマホは、QR コードを読み直すまで開けない) */
export function resetPhoneKey(root) {
  const dir = join(root, ".admin");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const key = randomBytes(24).toString("base64url");
  writeFileSync(file(root), JSON.stringify({ key, createdAt: new Date().toISOString() }, null, 2));
  return key;
}
/** 鍵が合っているか(時間の差で推測されないように比べる) */
export function sameKey(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function cookieValue(header, name) {
  for (const part of String(header || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

/**
 * スマホから使うアドレス(Tailscale の名前)を調べる。
 * admin.local.json の phone.host があれば、それを使う。なければ `tailscale status --json` の自分の名前。
 * 見つからなければ ""(スマホからは開けない。PC だけで使う)
 */
export function detectPhoneHost(root) {
  let local = {};
  try { local = JSON.parse(readFileSync(join(root, "admin.local.json"), "utf8")); } catch {}
  const fixed = local.phone?.host;
  if (fixed) return Promise.resolve(HOST.test(fixed) ? fixed.toLowerCase() : "");
  const tries = ["tailscale", "C:\\Program Files\\Tailscale\\tailscale.exe", "/Applications/Tailscale.app/Contents/MacOS/Tailscale"];
  const run = (i) => new Promise((resolve) => {
    if (i >= tries.length) return resolve("");
    execFile(tries[i], ["status", "--json"], { timeout: 4000, windowsHide: true }, (err, out) => {
      if (err) return resolve(run(i + 1));
      try {
        const s = JSON.parse(out);
        const name = String(s.Self?.DNSName || "").replace(/\.$/, "").toLowerCase();
        resolve(s.BackendState === "Running" && HOST.test(name) ? name : "");
      } catch { resolve(""); }
    });
  });
  return run(0);
}

/** QR コード(SVG の文字列) */
export async function qrSvg(text) {
  const { default: QR } = await import("qrcode");
  return QR.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
}
