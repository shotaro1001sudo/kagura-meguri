// セキュリティヘッダ相当の設定を、<meta> で配る(GitHub Pages は任意のHTTPヘッダを付けられないため)。
// - インラインの <script>/<style> は、中身のハッシュで許可する(= 'unsafe-inline' を使わない)
// - 許可する外部は、地図(unpkg: SRI付き)・地図タイル(OpenStreetMap)・Webフォント・フォーム送信先だけ
// - AdSense / アナリティクス / 同意管理を設定したときだけ、必要な許可を追加する(AdSense は HTTPS なら許可。理由は SECURITY.md)
import { createHash } from "node:crypto";
import { BANNER_IMG_HOSTS } from "./stay-banners.mjs";

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
  // 本人提供の楽天画像バナーが存在するページだけ画像配信元を許可。
  if (/<img\b[^>]*\bsrc="https:\/\/hbb\.afl\.rakuten\.co\.jp\/hsb\//.test(html)) d["img-src"].push("https://hbb.afl.rakuten.co.jp");
  // 宿の画像バナー(楽天トラベル・じゃらんnet)があるページだけ、その画像の配信元を許可する
  for (const h of BANNER_IMG_HOSTS) if (html.includes(`src="${h}/`)) d["img-src"].push(h);
  if (html.includes('src="https://hbb.afl.rakuten.co.jp/')) d["img-src"].push("https://ba.afl.rakuten.co.jp"); // 画像の転送先(バナー)
  if (html.includes('src="https://hbb.afl.rakuten.co.jp/hgb/')) d["img-src"].push("https://thumbnail.image.rakuten.co.jp"); // 画像の転送先(商品画像)
  if (ads) {
    // AdSense は動的にスクリプト・iframe を読み込むため、ここだけ緩める(広告を入れる場合のみ)
    d["script-src"].push("'unsafe-inline'", "'unsafe-eval'", "https://pagead2.googlesyndication.com", "https://*.googlesyndication.com", "https://*.google.com", "https://*.doubleclick.net", "https://www.googletagservices.com", "https://partner.googleadservices.com", "https://adservice.google.com");
    d["frame-src"] = ["https://*.googlesyndication.com", "https://*.google.com", "https://*.doubleclick.net"];
    d["img-src"].push("https:");
    d["connect-src"].push("https://*.google.com", "https://*.googlesyndication.com", "https://*.doubleclick.net", "https://*.google-analytics.com");
    // AdSense は使う通信先が随時変わり、Google はドメインを並べる許可リストに対応していない(公式の案内)。
    // 広告の品質チェック(adtrafficquality.google)や表示速度の計測(csi.gstatic.com)などが止まらないよう、
    // 広告を使うときだけ、スクリプト・埋め込み・通信は HTTPS なら許可する
    for (const k of ["script-src", "frame-src", "connect-src"]) d[k].push("https:");
  }
  if (cfg.goatcounter) {
    // アクセス解析 GoatCounter: スクリプト(SRI付き)の配信元と、計測の送り先だけを許可する
    const gc = `https://${cfg.goatcounter}.goatcounter.com`;
    d["script-src"].push("https://gc.zgo.at");
    d["connect-src"].push(gc);
    d["img-src"].push(gc);
  }
  if (ga) {
    d["script-src"].push("https://www.googletagmanager.com", "https://*.google-analytics.com");
    d["img-src"].push("https://*.google-analytics.com", "https://*.googletagmanager.com");
    d["connect-src"].push("https://*.google-analytics.com", "https://*.analytics.google.com", "https://*.googletagmanager.com");
  }
  if (cfg.cookiebotId) {
    // 同意管理 Cookiebot: 配信元と通信先だけを許可する
    d["script-src"].push("https://consent.cookiebot.com", "https://consentcdn.cookiebot.com");
    d["connect-src"].push("https://consent.cookiebot.com", "https://consentcdn.cookiebot.com");
    d["img-src"].push("https://imgsct.cookiebot.com", "https://consent.cookiebot.com");
    d["frame-src"] = d["frame-src"][0] === "'none'" ? ["https://consentcdn.cookiebot.com"] : [...d["frame-src"], "https://consentcdn.cookiebot.com"];
    // 同意バナーは、見た目(CSS)を <style> でページに書き込む。<style> だけは中身を問わず許可する
    // (style-src にハッシュがあると 'unsafe-inline' は無視されるため、<style> 専用の style-src-elem を分ける。
    //  スクリプトの許可は、これまでどおりハッシュのまま。CSS の書き込みは、スクリプトの実行より危険が小さい)
    d["style-src-elem"] = ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"];
  }
  return Object.entries(d).map(([k, v]) => `${k} ${[...new Set(v)].join(" ")}`).join("; ") + "; upgrade-insecure-requests";
}

// 他サイトの <iframe> に埋め込まれたら、ページを隠して最上位へ移動する(クリックジャッキング対策。
// 本来は X-Frame-Options / frame-ancestors で防ぐが、静的ホスティングではヘッダを付けられないため)
export const FRAME_BUSTER = `if(window.top!==window.self){document.documentElement.style.display='none';try{window.top.location=window.self.location}catch(e){}}`;
