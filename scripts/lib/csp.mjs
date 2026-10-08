// セキュリティヘッダ相当の設定を、<meta> で配る(GitHub Pages は任意のHTTPヘッダを付けられないため)。
// - インラインの <script>/<style> は、中身のハッシュで許可する(= 'unsafe-inline' を使わない)
// - 許可する外部は、地図(unpkg: SRI付き)・地図タイル(OpenStreetMap)・Webフォント・フォーム送信先だけ
// - AdSense / アナリティクスを設定したときだけ、必要な Google ドメインを追加で許可する
import { createHash } from "node:crypto";

// ブラウザは、HTMLを読むときに改行を LF にそろえてからハッシュを計算する。こちらも同じにしないと、CSPが一致しない
const sha = (s) => `'sha256-${createHash("sha256").update(s.replace(/\r\n?/g, "\n"), "utf8").digest("base64")}'`;
const originOf = (u) => { try { return new URL(u).origin; } catch { return ""; } };

export function cspFor(html, cfg) {
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)].map((m) => sha(m[1]));
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => sha(m[1]));
  const form = originOf(cfg.form?.endpoint);
  const ads = !!cfg.adsense?.client, ga = !!cfg.analyticsId;

  const d = {
    "default-src": ["'self'"],
    "script-src": ["'self'", ...scripts, "https://unpkg.com"],
    "style-src": ["'self'", ...styles, "https://fonts.googleapis.com", "https://unpkg.com"],
    "style-src-attr": ["'unsafe-inline'"], // style="" 属性(地図の高さなど)。スクリプトの実行には影響しない
    "img-src": ["'self'", "data:", "https://tile.openstreetmap.org", "https://unpkg.com"],
    "font-src": ["https://fonts.gstatic.com"],
    "connect-src": ["'self'", ...(form ? [form] : [])],
    "frame-src": ["'none'"],
    "form-action": ["'self'"],
    "base-uri": ["'none'"],
    "object-src": ["'none'"],
  };
  if (ads) {
    // AdSense は動的にスクリプト・iframe を読み込むため、ここだけ緩める(広告を入れる場合のみ)
    d["script-src"].push("'unsafe-inline'", "'unsafe-eval'", "https://pagead2.googlesyndication.com", "https://*.googlesyndication.com", "https://*.google.com", "https://*.doubleclick.net", "https://www.googletagservices.com", "https://partner.googleadservices.com", "https://adservice.google.com");
    d["frame-src"] = ["https://*.googlesyndication.com", "https://*.google.com", "https://*.doubleclick.net"];
    d["img-src"].push("https:");
    d["connect-src"].push("https://*.google.com", "https://*.googlesyndication.com", "https://*.doubleclick.net", "https://*.google-analytics.com");
  }
  if (ga) {
    d["script-src"].push("https://www.googletagmanager.com", "https://*.google-analytics.com");
    d["img-src"].push("https://*.google-analytics.com", "https://*.googletagmanager.com");
    d["connect-src"].push("https://*.google-analytics.com", "https://*.analytics.google.com", "https://*.googletagmanager.com");
  }
  return Object.entries(d).map(([k, v]) => `${k} ${[...new Set(v)].join(" ")}`).join("; ") + "; upgrade-insecure-requests";
}

// 他サイトの <iframe> に埋め込まれたら、ページを隠して最上位へ移動する(クリックジャッキング対策。
// 本来は X-Frame-Options / frame-ancestors で防ぐが、静的ホスティングではヘッダを付けられないため)
export const FRAME_BUSTER = `if(window.top!==window.self){document.documentElement.style.display='none';try{window.top.location=window.self.location}catch(e){}}`;
