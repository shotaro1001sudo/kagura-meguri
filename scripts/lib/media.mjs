// 写真・動画(data/media.json)。神楽の種類のページに、提供いただいた写真と YouTube の動画を載せる。
// - 写真は、管理者用ページで WebP に変換・縮小したものを assets/media/<id>.webp(大)と <id>-s.webp(小)に置く
//   (ブラウザで描き直すので、撮影位置などの Exif は残らない)
// - 動画は YouTube の ID だけを持つ。ページには再生ボタンだけを置き、押すまで YouTube に接続しない
// - 掲載を始める日(config.json の media.start)より前は、何も表示しない。利用規約の変更を、前もって知らせるため
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const MEDIA_SIZES = { large: 1600, small: 640 }; // 長い辺の画素数
export const MEDIA_LIMITS = { large: 1_500_000, small: 400_000 }; // ファイルの大きさの上限(バイト)
export const PROVIDERS = { reader: "観覧した方", official: "神楽団・保存会・主催者" };
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
// Google フォームの URL だけを受け付ける(ほかのサイトへ、投稿者を誘導しない)
export const FORM_URL = /^https:\/\/(docs\.google\.com\/forms\/|forms\.gle\/)[A-Za-z0-9_\-/.?=&]+$/;

/** 写真の大小のファイル名 */
export const photoFiles = (id) => [`${id}.webp`, `${id}-s.webp`];

/** YouTube の URL(または ID)から、動画の ID を取り出す。読めなければ "" */
export function youtubeId(input = "") {
  const s = String(input).trim();
  if (YT_ID.test(s)) return s;
  let u;
  try { u = new URL(s); } catch { return ""; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "";
  const host = u.hostname.replace(/^(www|m|music)\./, "");
  let id = "";
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v") ?? "";
    else { const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/]+)/); id = m ? m[1] : ""; }
  }
  return YT_ID.test(id) ? id : "";
}

/** 掲載する名前の表示: 一般の方は「撮影: 名前」か「読者提供」、団体は「提供: 団体名」 */
export function creditLabel(m) {
  if (m.provider === "official") return `提供: ${m.credit}`;
  return m.credit ? `撮影: ${m.credit}` : "読者提供";
}

/** 撮影の時期の表示(「2026年11月」「2026年11月3日」) */
export function takenLabel(t = "") {
  const m = String(t).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  return m ? `${m[1]}年${+m[2]}月${m[3] ? `${+m[3]}日` : ""}` : "";
}

const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** 1件の内容を確かめる。問題があれば { 項目: 理由 } を返す(問題がなければ空のオブジェクト) */
export function checkMediaItem(m) {
  const e = {};
  if (!ID.test(m.id ?? "")) e.id = "ID は英小文字・数字・ハイフン(64文字まで)にしてください";
  if (!["photo", "youtube"].includes(m.kind)) e.kind = "種類は photo(写真)か youtube(動画)にしてください";
  if (!m.kagura || String(m.kagura).length > 40) e.kagura = "神楽の種類を選んでください";
  if (String(m.caption ?? "").length > 60) e.caption = "説明は60字までにしてください";
  if (!PROVIDERS[m.provider]) e.provider = "提供者の区分を選んでください";
  if (String(m.credit ?? "").length > 40) e.credit = "掲載する名前は40字までにしてください";
  if (m.provider === "official" && !m.credit) e.credit = "団体からの提供は、団体名を入れてください";
  if (m.taken && !/^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/.test(m.taken)) e.taken = "撮影の時期は YYYY-MM か YYYY-MM-DD にしてください";
  if (String(m.place ?? "").length > 60) e.place = "撮影した場所は60字までにしてください";
  if (!DAY.test(m.received ?? "")) e.received = "受付日を入れてください";
  if (!["published", "withdrawn"].includes(m.status)) e.status = "状態が不明です";
  if (m.kind === "photo") {
    if (!m.alt || String(m.alt).length > 120) e.alt = "写真の内容の説明(読み上げ用、120字まで)を入れてください";
    for (const k of ["width", "height"]) if (!(Number.isInteger(m[k]) && m[k] >= 1 && m[k] <= 10000)) e[k] = "写真の大きさが不明です";
  }
  if (m.kind === "youtube") {
    if (!YT_ID.test(m.youtube ?? "")) e.youtube = "YouTube の動画の URL を確かめてください";
    if (!m.title || String(m.title).length > 80) e.title = "動画の題名(80字まで)を入れてください";
  }
  return e;
}

/** 管理者用ページからの入力のうち、決まった項目だけを、整えて取り出す(ほかの項目は持ち込ませない) */
export function pickMediaFields(input = {}) {
  const kind = input.kind === "youtube" ? "youtube" : "photo";
  const m = {
    id: clean(input.id, 64), kind, kagura: clean(input.kagura, 40), caption: clean(input.caption, 60),
    provider: input.provider === "official" ? "official" : "reader", credit: clean(input.credit, 40),
    taken: clean(input.taken, 10), place: clean(input.place, 60), received: clean(input.received, 10),
  };
  if (kind === "photo") m.alt = clean(input.alt, 120);
  else { m.youtube = youtubeId(input.youtube); m.title = clean(input.title, 80); }
  for (const k of ["caption", "credit", "taken", "place"]) if (!m[k]) delete m[k];
  return m;
}

/**
 * WebP の画像の大きさ(幅・高さ)を、ファイルの頭から読む。WebP でなければ null。
 * 管理者用ページに届いたファイルを、画面の申告ではなく、中身で確かめるために使う。
 */
export function webpSize(buf) {
  if (!buf || buf.length < 30) return null;
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  if (buf.readUInt32LE(4) + 8 !== buf.length) return null; // 途中で切れた・後ろに何か付いたファイルは受け付けない
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8X") return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
  if (chunk === "VP8 ") {
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    if (buf[20] !== 0x2f) return null;
    const b = buf.readUInt32LE(21);
    return { width: (b & 0x3fff) + 1, height: ((b >>> 14) & 0x3fff) + 1 };
  }
  return null;
}

/** 写真・動画の掲載・受付の状態(config.json の media と、日本時間の今日) */
export function mediaState(cfg, today) {
  const start = cfg.media?.start ?? "";
  const formUrl = cfg.media?.formUrl ?? "";
  const on = DAY.test(start);
  const live = on && today >= start;
  return { on, live, start, formUrl, formOpen: live && FORM_URL.test(formUrl) };
}

/** 設定の検査(ビルドを止める理由の一覧) */
export function checkMediaConfig(cfg) {
  const errs = [], m = cfg.media ?? {};
  if (m.start && !DAY.test(m.start)) errs.push(`config.json の media.start は YYYY-MM-DD にしてください(現在: ${m.start})`);
  if (m.formUrl && !FORM_URL.test(m.formUrl)) errs.push(`config.json の media.formUrl は Google フォームの URL(https://docs.google.com/forms/… か https://forms.gle/…)にしてください(現在: ${m.formUrl})`);
  if (m.formUrl && !m.start) errs.push("config.json の media.formUrl を使うには、media.start(掲載・受付を始める日)も入れてください");
  return errs;
}

const figcaption = (m, label) => {
  const bits = [m.caption ? `<span class="m-cap">${esc(m.caption)}</span>` : "",
    [m.place, takenLabel(m.taken)].filter(Boolean).length ? `<span>${esc([m.place, takenLabel(m.taken)].filter(Boolean).join("・"))}</span>` : "",
    `<span class="m-credit">${esc(creditLabel(m))}</span>`, label].filter(Boolean);
  return `<figcaption>${bits.join("")}</figcaption>`;
};

function photoFigure(m) {
  const [large, small] = photoFiles(m.id);
  return `<li><figure class="m-photo"><a href="/media/${large}"><img src="/media/${small}" srcset="/media/${small} ${MEDIA_SIZES.small}w, /media/${large} ${MEDIA_SIZES.large}w" sizes="(max-width: 640px) 92vw, 400px" width="${m.width}" height="${m.height}" alt="${esc(m.alt)}" loading="lazy" decoding="async"></a>${figcaption(m)}</figure></li>`;
}

function videoFigure(m) {
  const watch = `https://www.youtube.com/watch?v=${m.youtube}`;
  return `<li><figure class="m-video"><div class="yt-box"><button type="button" class="yt-play" data-yt="${m.youtube}" data-title="${esc(m.title)}"><span class="yt-icon" aria-hidden="true"></span><span class="yt-t">${esc(m.title)}</span><small>押すと再生します(YouTube に接続します)</small></button></div>${figcaption(m, `<a href="${watch}" target="_blank" rel="noopener">YouTube で見る</a>`)}</figure></li>`;
}

/**
 * 神楽の種類のページの「写真・動画」。items はその種類の掲載中のものだけ(新しく受け付けたものから)。
 * formOpen: 受付中なら、送り方のページへの案内を付ける
 */
export function mediaSection(kagura, items, { formOpen = false } = {}) {
  const call = formOpen ? `<p class="meta media-call"><a href="/photos.html">${esc(kagura)}の写真・動画を送る</a></p>` : "";
  if (!items.length) return call;
  return `<section class="media" aria-labelledby="media-h"><h2 id="media-h">写真・動画</h2>
<p class="meta media-note">観覧した方や、神楽団・主催者から提供いただいたものです。写真を押すと、大きく表示します。${items.some((m) => m.kind === "youtube") ? "動画は、再生ボタンを押すまで YouTube に接続しません。" : ""}</p>
<ul class="media-grid">${items.map((m) => (m.kind === "photo" ? photoFigure(m) : videoFigure(m))).join("")}</ul>${call}</section>`;
}

/** 構造化データ(写真の提供者の表示を、画像検索にも伝える) */
export const mediaLd = (items, baseUrl) => items.filter((m) => m.kind === "photo").map((m) => ({
  "@context": "https://schema.org", "@type": "ImageObject", contentUrl: `${baseUrl}/media/${photoFiles(m.id)[0]}`,
  ...(m.caption ? { caption: m.caption } : {}), creditText: creditLabel(m),
  ...(m.credit ? { creator: { "@type": m.provider === "official" ? "Organization" : "Person", name: m.credit } } : {}),
}));
