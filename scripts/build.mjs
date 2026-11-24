import { socialEvidenceErrors, isSocialEvent, socialDuplicate, SOCIAL_LABELS, socialPlatform } from './lib/social-evidence.mjs';
import { sameEvent } from './lib/collect-core.mjs';
import { cookieControls } from './lib/cookie-controls.mjs';
import { calendarNotice } from './lib/calendar-notice.mjs';
import { eventFeeSchema } from './lib/event-fee-schema.mjs';
import { upcomingSummary, upcomingSummaryDescription } from './lib/upcoming-summary.mjs';
import { reservationLabel } from './lib/reservation.mjs';
import { flow as flowFig } from './lib/figures.mjs';
import { glossHtml } from './lib/glossary.mjs';
import { isKaguraKaikanMonthly, kaguraKaikanTitle, kaguraKaikanDesc } from './lib/kagura-kaikan-seo.mjs';
import { nextEdition, keepPastIndexed, recentPast, editionKey } from './lib/past-events.mjs';
// 静的サイト生成: data/events.json + data/regular.json + config.json -> dist/
// 2026-10-21: event-handoff smoke marker (comment only; no functional or output change).
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { cspFor, FRAME_BUSTER } from "./lib/csp.mjs";
import { submitForm, contactForm, formScript, formReady } from "./lib/form.mjs";
import { privacyHtml, privacyUpdated, disclaimerHtml, termsHtml } from "./lib/policy.mjs";
import { guideHtml, CHECKED as GUIDE_CHECKED } from "./lib/guide.mjs";
import { englishPages, CHECKED as EN_CHECKED, UPDATED as EN_UPDATED, enStylePath, KAGURA_EN } from "./lib/english.mjs";
import { historyPages, historyReader, ERAS as HISTORY_ERAS, CHECKED as HISTORY_CHECKED } from "./lib/history.mjs";
import { organizersHtml } from "./lib/organizers.mjs";
import { sponsorHtml, sponsorArticleSampleHtml, SAMPLE_SPONSOR, SPONSOR_CSS } from "./lib/sponsor.mjs";
import { sponsorErrors, activeSponsors, sponsorSlot, sponsorCoverage, listSponsorTile } from "./lib/sponsor-slots.mjs";
import { mediaStatsErrors, statsFresh } from "./lib/media-stats.mjs";
import { REGIONS, regionOf } from "./lib/util.mjs";
import { validKey as validIndexNowKey } from "./lib/indexnow.mjs";
import { pngToIco } from "./lib/ico.mjs";
import { weekendRange, rangeLabel, mdLabel, regularOn, isDaily, addDays, holidayName, regularStatus, regularNextDates, regularNominalDate, PAUSE_DAYS } from "./lib/dates.mjs";
import { VC, vcEnabled } from "./lib/valuecommerce.mjs";
import { stayBannersHtml, expBannersHtml } from "./lib/stay-banners.mjs";
import { sideRailHtml, railPage, prStripHtml, stripIdsFor, STRIP_EVERY, RAIL_BANNERS, INLIST_THEMES, inlistTheme, selfBannerHtml } from "./lib/side-rail.mjs";
import { inlistLead, inlistCount } from "./lib/inlist-pr.mjs";
import { phraseParts, topicGroups, phrasesHtml } from "./lib/phrases.mjs";
import { overnightKagura } from "./lib/overnight.mjs";
import { loadHotels, hotelCardsHtml } from "./lib/nearby-hotels.mjs";
import { createMoreOfferIndex, learnBlock, furusatoBlock } from "./lib/more-offers.mjs";
import { questions, features, traditions, quizEngine, QUIZ_CHECKED, evidenceWeight, evidenceText } from './lib/quiz.mjs';
import { CHECKED as PLANNING_CHECKED, offersFor, offerCards, experienceDirectory, planningLinks, rentalSearch, transportSection, rentalStripItems } from './lib/visitor-planning.mjs';

// テスト用の切り替え: EVENTS_FILE / REGULAR_FILE(データ)/ OUT_DIR(出力先)/ BUILD_NOW(日本時間の現在 "YYYY-MM-DDTHH:mm")
const OUT = process.env.OUT_DIR ?? "dist";
const EVENTS_FILE = process.env.EVENTS_FILE ?? "data/events.json";
const REGULAR_FILE = process.env.REGULAR_FILE ?? "data/regular.json";
const readJson = (p) => JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
const cfg = readJson("config.json");
const visitorPlanning = readJson(process.env.VISITOR_PLANNING_FILE ?? 'data/visitor-planning.json');
const moreOffersData = readJson(process.env.MORE_OFFERS_FILE ?? 'data/more-offers.json'); // 本・グッズ・ふるさと納税(本人発行のリンクだけ)
if(process.env.TEST_PLANNING_OFF === '1') visitorPlanning.categories = {}; // テストの無広告基準は本番の広告設定から独立させる。
if (process.env.TEST_ADS_OFF) cfg.adsense = { client: "", slotList: "", slotDetail: "" }; // テスト用(広告未設定の状態から確かめる)
if (process.env.TEST_ADSENSE) cfg.adsense.client = process.env.TEST_ADSENSE;
if (process.env.TEST_FORM_OFF) cfg.form = { endpoint: "", accessKey: "", providerName: "" }, cfg.operator = { ...cfg.operator, contact: process.env.TEST_CONTACT ?? "" }; // テスト: 送信先が未設定の状態
if (process.env.TEST_FORM_ENDPOINT) cfg.form ={ ...cfg.form, endpoint: process.env.TEST_FORM_ENDPOINT, providerName: process.env.TEST_FORM_PROVIDER ?? cfg.form?.providerName };
if (process.env.TEST_AUTOPUBLISH) cfg.collect = { ...cfg.collect, autoPublish: process.env.TEST_AUTOPUBLISH === "1" };
if (process.env.TEST_GA != null) cfg.analyticsId = process.env.TEST_GA; // テスト用(空文字で無効)
if (process.env.TEST_CB != null) cfg.cookiebotId = process.env.TEST_CB; // テスト用(空文字で無効)
if (process.env.TEST_GOATCOUNTER != null) cfg.goatcounter = process.env.TEST_GOATCOUNTER; // テスト用(空文字で無効)
// アクセス解析 GoatCounter(Cookie を使わない)。コードは英小文字・数字・ハイフン(https://<コード>.goatcounter.com)
if (cfg.goatcounter && !/^[a-z0-9-]+$/.test(cfg.goatcounter)) { console.error("config.json の goatcounter は、英小文字・数字・ハイフンのコードにしてください"); process.exit(1); }
// Temporary pause: omit the loader even when Cookiebot is unavailable.
// Keep configuration/disclosures; resume only after consent handling is verified.
const GOATCOUNTER = "";
if (process.env.TEST_AFF_OFF) cfg.affiliate = { rakutenAffiliateId: "", valueCommerceSid: "", jalanPid: "", jalanActivityPid: "", amazonTag: "" }; // テスト用(アフィリエイト未設定の状態から確かめる)
if (process.env.TEST_AFFILIATE) cfg.affiliate = { ...cfg.affiliate, amazonTag: process.env.TEST_AFFILIATE };
if (process.env.TEST_AFF_TRAVEL) cfg.affiliate = { ...cfg.affiliate, rakutenAffiliateId: "test.rakuten", valueCommerceSid: VC.sid, jalanPid: VC.stay }; // テスト用(宿のアフィリエイト)
const SPONSORS_FILE = process.env.SPONSORS_FILE ?? "data/sponsors.json"; // 協賛枠(PR)。MON-2。契約が決まったものだけを登録する
const sponsorsData = existsSync(SPONSORS_FILE) ? readJson(SPONSORS_FILE) : [];
const MEDIA_STATS_FILE = process.env.MEDIA_STATS_FILE ?? "data/media-stats.json"; // 協賛のページに載せるアクセスの概数。node scripts/media-stats.mjs が作る
const mediaStats = existsSync(MEDIA_STATS_FILE) ? readJson(MEDIA_STATS_FILE) : null;
const rawEvents = readJson(EVENTS_FILE).filter((e) => e.status === "published");
const rawRegular = (existsSync(REGULAR_FILE) ? readJson(REGULAR_FILE) : []).filter((r) => r.status === "published");

// ---------- 入力データの検査: 壊れたデータは公開せず、ビルドを止める ----------
const DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const HTTP_URL = /^https?:\/\/[^\s"'<>]+$/; // javascript: などのURLを、リンクに載せない
const errs = [];
function validateCommon(rows, ids) {
  for (const e of rows) {
    const w = `[${e.id ?? "id なし"}]`;
    if (!/^[A-Za-z0-9_-]+$/.test(e.id ?? "")) errs.push(`${w} id は英数字・ハイフン・アンダースコアのみ`);
    if (ids.has(e.id)) errs.push(`${w} id が重複しています`);
    ids.add(e.id);
    errs.push(...socialEvidenceErrors(e).map(reason => `${w} ${reason}`));
    if (!e.name) errs.push(`${w} name が空です`);
    if (!e.prefecture) errs.push(`${w} prefecture が空です`);
    if (e.url && !HTTP_URL.test(e.url)) errs.push(`${w} url は http(s):// で始まる安全なURLにしてください(現在: ${e.url})`);
    if ((e.lat != null) !== (e.lng != null) || (e.lat != null && (!(e.lat >= 20 && e.lat <= 46) || !(e.lng >= 122 && e.lng <= 154)))) errs.push(`${w} lat/lng が不正、または日本の範囲外です`);
  }
}
{
  validateCommon(rawEvents, new Set());
  for (const e of rawEvents) {
    const w = `[${e.id}]`;
    if (!DT.test(e.start ?? "")) errs.push(`${w} start は YYYY-MM-DDTHH:mm 形式にしてください(現在: ${e.start})`);
    if (e.end && !DT.test(e.end)) errs.push(`${w} end の形式が不正です`);
    if (e.end && e.end < e.start) errs.push(`${w} end が start より前です`);
  }
  for (const [i, e] of rawEvents.entries()) {
    if (isSocialEvent(e) && rawEvents.some((other, j) => i !== j && (sameEvent(e, other) || socialDuplicate(e, other)))) errs.push(`[${e.id}] SNS: 同一公演の重複候補があります`);
  }
  validateCommon(rawRegular, new Set());
  for (const r of rawRegular) {
    if (!r.schedule) errs.push(`[${r.id}] schedule(いつ開催されるか)が空です`);
    if (r.until && !/^\d{4}-\d{2}-\d{2}$/.test(r.until)) errs.push(`[${r.id}] until は YYYY-MM-DD 形式にしてください`);
    // 公演日の計算に使う(今週末・今月のページ)。schedule の文章と、食い違わないように
    const ints = (v, lo, hi) => Array.isArray(v) && v.length > 0 && v.every((n) => Number.isInteger(n) && n >= lo && n <= hi);
    if (r.weekdays != null && !ints(r.weekdays, 0, 6)) errs.push(`[${r.id}] weekdays は、曜日の番号(0=日曜〜6=土曜)の配列にしてください`);
    if (r.months != null && !ints(r.months, 1, 12)) errs.push(`[${r.id}] months は、月(1〜12)の配列にしてください`);
    if (r.nth != null && !ints(r.nth, 1, 5)) errs.push(`[${r.id}] nth は、その月の何回目の曜日か(1〜5)の配列にしてください`);
    if (r.program != null && !(Array.isArray(r.program) && r.program.length && r.program.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p?.date ?? "") && typeof p.troupe === "string" && p.troupe))) errs.push(`[${r.id}] program は [{ date: "YYYY-MM-DD", time, troupe, hall }] の配列にしてください`);
    if (r.closedDates != null && !(Array.isArray(r.closedDates) && r.closedDates.every((d) => /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d)))) errs.push(`[${r.id}] closedDates は "MM-DD" の配列にしてください`);
  }
  errs.push(...sponsorErrors(sponsorsData));
  errs.push(...mediaStatsErrors(mediaStats));
  if (errs.length) { console.error("データエラー:\n" + errs.map((x) => "  " + x).join("\n")); process.exit(1); }
}

// ---------- 日付: すべて「日本時間の文字列」として扱う(ビルドを行うサーバーの時区に依存させない) ----------
const nowJst = process.env.BUILD_NOW ?? new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16);
const asMs = (s) => Date.parse(`${s}:00Z`);
const isUpcoming = (e) => {
  if (e.timeUnknown) return (e.end || e.start).slice(0, 10) >= nowJst.slice(0, 10);
  // 一覧の掲載期限だけの計算。最終回より前に消さず、推定終了を公演データには加えない。
  const lastStart = e.sessions?.length ? `${e.start.slice(0, 10)}T${e.sessions.map((s) => s.slice(0, 5)).sort().at(-1)}` : e.start;
  const endMs = e.end ? asMs(e.end) : asMs(lastStart) + 3 * 3600e3; // 終了時刻なしは最終開始から3時間を開催中とみなす
  return endMs >= asMs(nowJst);
};
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const WD = ["日", "月", "火", "水", "木", "金", "土"];
const parts = (s) => { const [y, mo, d, h, mi] = s.split(/[-T:]/).map(Number); return { y, mo, d, h, mi, wd: new Date(Date.UTC(y, mo - 1, d)).getUTCDay() }; };
// 画面に出す時刻は「8:45」(先頭の0を取る)。データ・カレンダー登録・構造化データの値は変えない
const hm = (t) => String(t).replace(/(^|[^\d])0(\d:\d\d)/g, "$1$2");
const fmt = (s) => { const p = parts(s); return `${p.y}年${p.mo}月${p.d}日 ${pad(p.h)}:${pad(p.mi)}`; };
// 「11月15日(日)」(年なし)。開催ページの日時は「2026年11月15日(日) 13:00〜15:00」
const mdw = (s) => { const p = parts(`${s}T00:00`); return `${p.mo}月${p.d}日(${WD[p.wd]})`; };
const dayLabel = (s, withYear = true) => { const p = parts(`${s}T00:00`); return `${withYear ? `${p.y}年` : ""}${p.mo}月${p.d}日(${WD[p.wd]})`; };
const whenOf = (e) => {
  const sd = e.start.slice(0, 10), ed = e.end?.slice(0, 10);
  const endDay = ed && ed !== sd ? dayLabel(ed, ed.slice(0, 4) !== sd.slice(0, 4)) : "";
  if (e.timeUnknown) return `${dayLabel(sd)}${endDay ? `〜${endDay}` : ""} ${TIME_UNKNOWN}`;
  if (e.sessions?.length) return `${dayLabel(sd)} ${hm(e.sessions.join("、"))}(1日${e.sessions.length}回)`;
  return `${dayLabel(sd)} ${hm(e.start.slice(11, 16))}〜${e.end ? (endDay ? `${endDay} ${hm(e.end.slice(11, 16))}` : hm(e.end.slice(11, 16))) : ""}`;
};
// 日付と曜日・時刻の範囲を、行の途中で割らない(文字は変えず、改行しない組にするだけ。エスケープ済みの文に使う)
const NOWRAP_RE = /\d{4}年\d{1,2}月\d{1,2}日(?:\([日月火水木金土]\))?|\d{1,2}月\d{1,2}日(?:\([日月火水木金土]\))?(?:〜\d{1,2}日)?|\d{1,2}:\d{2}(?:〜(?:\d{1,2}:\d{2})?)?/g;
const nobr = (html) => String(html).replace(NOWRAP_RE, (m) => `<span class="nw">${m}</span>`);
// 文の区切り(。)で分ける。かっこの中の「。」では分けない(「(約230名分。公演日の…)」のような補足を、途中で切らない)
const sentencesOf = (s) => {
  const out = []; let cur = "", depth = 0;
  for (const ch of String(s ?? "")) {
    if (ch === "(" || ch === "（") depth++;
    if (ch === ")" || ch === "）") depth = Math.max(0, depth - 1);
    cur += ch;
    if (ch === "。" && depth === 0) { out.push(cur); cur = ""; }
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
};
// 改行の位置(2026-11-15 運営者の依頼。同日に言い直しがあった): 行の右端で折り返すとき、言葉の途中では切らず、その手前の句読点か
// 「てにをは」の切れ目(文節の切れ目)で折り返す。句読点のたびに、かならず改行するわけではない。話題が変わるところでは、改行する。
// 文節の切れ目に <wbr>(折り返してよい印)を入れ、.bw(字と字のあいだでは折り返さない)で包む。文字は1字も変えない。
// 分け方は scripts/lib/phrases.mjs。データの文(公演の説明など)は下の cl()・topicLines()、タグの入った文(ガイド・歴史のページ)は phrasesHtml() を通す
// 電話番号は、番号の途中で改行しない(「0536-76-」「0509」のように割れると読みにくい)
const PHONE_RE = /0\d{1,4}-\d{1,4}-\d{3,4}/g;
const clText = (x) => esc(x).replace(PHONE_RE, (m) => `<span class="nw">${m}</span>`);
/** 文に、折り返してよい印(文節の切れ目)を入れて返す(エスケープ込み)。切れ目のない短い文は、そのまま */
const cl = (s) => { const parts = phraseParts(s); return parts.length < 2 ? clText(s) : `<span class="bw">${parts.map(clText).join("<wbr>")}</span>`; };
/** 話題が変わるところで行を分けて返す(公演の説明・この開催のポイント)。話題が1つなら、cl() と同じ */
const topicLines = (s) => { const groups = topicGroups(s); return groups.length < 2 ? cl(s) : groups.map((g) => `<span class="tline">${cl(g)}</span>`).join(""); };
// 要点の表の値: 2文以上あるときは、文ごとに行を分けて出す(料金の区分や受付の方法が、ひとかたまりの長文にならないように)。文言は変えない
const cellLines = (v) => { const xs = sentencesOf(v); return xs.length > 1 ? xs.map((t) => `<span class="line">${cl(t)}</span>`).join("") : cl(v); };
// 定期公演の「公演日時」: 主な上演を1行目に、かっこ内(開場・受付など)と2文目(ほかの上演日)は小さく別の行に
const scheduleCell = (s) => sentencesOf(s).map((x) => x.replace(/。$/, "")).map((part, i) => {
  const m = i ? null : part.match(/^(.+?)[(（](.+)[)）]$/);
  return i ? `<small class="sched-more">${nobr(esc(part))}</small>` : `<span class="sched-main">${nobr(esc(m ? m[1] : part))}</span>${m ? `<small class="sched-more">${nobr(esc(m[2]))}</small>` : ""}`;
}).join("");
const jpDate = (s) => { const [y, m, d] = s.split("-").map(Number); return `${y}年${m}月${d}日`; };
const events = rawEvents.sort((a, b) => a.start.localeCompare(b.start));
const upcoming = events.filter(isUpcoming);
const regular = rawRegular.filter((r) => !r.until || r.until >= nowJst.slice(0, 10));
const KAGURA_INFO_FILE = process.env.KAGURA_INFO_FILE ?? "data/kagura-info.json"; // テストで差し替えられる
const kaguraInfo = existsSync(KAGURA_INFO_FILE) ? readJson(KAGURA_INFO_FILE) : {};
// 英語ページの訳(種類の解説・定期公演)。日本語の本文が書き換わったら、週次の振り返りが「訳が古い」と知らせる(scripts/lib/english-data.mjs)
const KAGURA_INFO_EN_FILE = process.env.KAGURA_INFO_EN_FILE ?? "data/kagura-info-en.json";
const kaguraInfoEn = existsSync(KAGURA_INFO_EN_FILE) ? readJson(KAGURA_INFO_EN_FILE) : {};
const regularEn = existsSync("data/regular-en.json") ? readJson("data/regular-en.json") : {};
const prefInfo = existsSync("data/pref-info.json") ? readJson("data/pref-info.json") : {};
// 出典リンクの一覧(外部リンクは、新しいタブで開き、推薦しない旨の rel を付ける)
const refList = (refs = []) => refs.length ? `<p class="meta">参考: ${refs.map((r) => `<a href="${esc(r.url)}" rel="noopener noreferrer" target="_blank">${esc(r.name)}</a>`).join(" / ")}</p>` : "";
// 神楽の種類ページ(2026-11-15 運営者の依頼): 「〇〇とは」の概要(3行ほど)の下に、
// 歴史・特徴・主な演目・観賞のコツ・開催予定を、この順に折り畳みで並べる。開催予定だけ最初から開く。
// どの種類も(これから足す種類も)同じ並び。データのない欄は「情報がありません。」
const KAGURA_SECTIONS = [["history", "歴史"], ["features", "特徴"], ["programs", "主な演目"], ["viewing", "観賞のコツ"]];
const NO_INFO = `<p class="meta no-info">情報がありません。</p>`;
const kaguraBody = (f, info) => {
  const v = info?.[f];
  if (!v?.length) return NO_INFO;
  if (f === "history") return v.map((t) => `<p>${cl(t)}</p>`).join("");
  if (f === "programs") return `<dl>${v.map((x) => `<dt>${esc(x.name)}</dt><dd>${cl(x.text)}</dd>`).join("")}</dl>`;
  return `<ul>${v.map((t) => `<li>${cl(t)}</li>`).join("")}</ul>`;
};
const kfold = (f, label, body, open = false) => `<details class="kfold" id="k-${f}"${open ? " open" : ""}><summary><h2>${esc(label)}</h2></summary><div class="kfold-body${open ? "" : " detail"}">${body}</div></details>`;
const kaguraFolds = (k, info, schedule) => `<section class="kagura-folds" aria-label="${esc(k)}のくわしい情報">${KAGURA_SECTIONS.map(([f, t]) => kfold(f, t, kaguraBody(f, info))).join("")}${kfold("schedule", "開催予定", schedule || NO_INFO, true)}</section>${refList(info?.refs)}`;
// 開催ごとの編集部の解説(data/event-notes.json)。公式情報から調べた事実だけを、出典つきで載せる
const eventNotes = existsSync("data/event-notes.json") ? readJson("data/event-notes.json") : [];
const noteBlock = (e) => {
  const n = eventNotes.find((x) => x.ids.includes(e.id));
  if (!n) return "";
  const local = n.local?.[e.id];
  return `<section class="detail note"><h2>この開催のポイント</h2>${[...(n.paras ?? []), ...(local ? [local] : [])].map((t) => `<p>${topicLines(t)}</p>`).join("")}<ul>${n.points.map((t) => `<li>${topicLines(t)}</li>`).join("")}</ul>${refList(n.refs)}</section>`;
};
// 都道府県ページの解説
const SEO = cfg.seo ?? {};
// 検索結果の説明文は、全角で80〜120字くらいが、読まれやすい長さ。長すぎるものは、文の切れ目で切る
const clip = (s, n = 118) => { s = String(s).replace(/\s+/g, " ").trim(); if (s.length <= n) return s; const cut = s.slice(0, n); const i = cut.lastIndexOf("。"); return (i > n * 0.5 ? cut.slice(0, i + 1) : cut.slice(0, n - 1) + "…"); };
// 説明文が短い(80字未満)と、検索結果で中身が伝わりにくい(Bing も「短すぎる」と指摘する)。
// 足りないときは、ページの中身を表す文を順に足す。長くなりすぎる文は足さない(clip が文の切れ目で切る)
const DESC_MIN = 80;
const fillDesc = (s, extras = []) => {
  let out = clip(s);
  for (const x of extras) {
    if (out.length >= DESC_MIN) break;
    if (!x) continue;
    const next = clip(out + x);
    if (next.length > out.length) out = next;
  }
  return out;
};
// 情報の少ないイベント・定期公演には、サイトとしての補足を足す
const padDesc = (s, extras = []) => fillDesc(s, ["公式情報へのリンクや地図、カレンダー登録つき。出典と確認日も載せています。", ...extras]);
// 主な開催地(市町村)。説明文の補足に使う
const placesOf = (xs, withPref = false) => [...new Set(xs.map((x) => (withPref ? x.prefecture : "") + (x.city ?? "")).filter(Boolean))].slice(0, 3).join("・");
const ldJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c"); // </script> による構造崩れを防ぐ

// ---------- 収益化 ----------
const a = cfg.affiliate;
// 報酬の出るリンクか(ID が未設定の間は、報酬のない、ふつうのリンクとして動く)。バリューコマースは、サイトID(sid)と、提携先ごとのID(pid)の両方が要る
const vcAllowed = !!cfg.adsense.client; // Existing CSP only; no new hosts or consent bypass.
const rakutenOn = !!a.rakutenAffiliateId, jalanOn = vcEnabled({sid:a.valueCommerceSid,pid:a.jalanPid,allowed:vcAllowed},"stay"), amazonOn = !!a.amazonTag;
const vcRailOn = vcAllowed && a.valueCommerceSid === VC.sid; // PR枠の JTB・日本旅行(発行コードは valuecommerce.mjs に固定)
const experienceAff = { sid: a.valueCommerceSid, pid: a.jalanActivityPid, allowed:vcAllowed }; // 体験は宿と別案件のpid
const hasAffiliate = rakutenOn || jalanOn || amazonOn || !!(experienceAff.sid && experienceAff.pid) || ['supplies','experiences','rental'].some(category=>offersFor(visitorPlanning,category,{guide:true},nowJst.slice(0,10)).length);
const rakuten = (url) => (rakutenOn ? `https://hb.afl.rakuten.co.jp/hgc/${a.rakutenAffiliateId}/?pc=${encodeURIComponent(url)}&m=${encodeURIComponent(url)}` : url);
const amazon = (kw) => `https://www.amazon.co.jp/s?k=${encodeURIComponent(kw)}${amazonOn ? `&tag=${a.amazonTag}` : ""}`;
// 宿の案内に出す地名(会場の市区町村)。
// 市町村名で探すと遠い宿ばかり出る地域は、近くの宿が出ることを確かめた呼び名で探す(2026-11-11 確認。東栄町 → 奥三河の宿が出る)
const STAY_AREA = { "東栄町": "奥三河" };
const stayPlace = (x) => { const c = x.city ? x.city.replace(/^.*郡/, "") : x.prefecture; return STAY_AREA[c] ?? c; };
// 外部リンク(アフィリエイト)の属性。報酬の出るリンクは sponsored。クリック数は、アクセス解析(GoatCounter)で数える
// スマホなど、両サイドのPR枠が出ない画面向けの帯「旅の手配」(公演ページの、宿・体験の枠のすぐ下。2026-11-15 運営者の依頼)
const prStrip = (x, placement) => prStripHtml({ on: { rakuten: rakutenOn, jalan: jalanOn, jtb: vcRailOn, nta: vcRailOn }, attrs: affAttrs, esc, lead: rentalStripItems(visitorPlanning, x, today, placement, { card: true }), land: true });
// 探すページ(今週末・今月・日付と場所・地図・種類・都道府県)の帯。中身は、そのページの両サイドのPR枠と同じバナー。wide: 本文が広いページか。skip: すぐ上の枠と重なるバナー
const prStripFor = (path, { wide = false, skip = [] } = {}) => prStripHtml({ on: { rakuten: rakutenOn, jalan: jalanOn, jtb: vcRailOn, nta: vcRailOn }, attrs: affAttrs, esc, wide, ids: stripIdsFor(path, { skip }), land: true });
// 一覧の途中にはさむ帯(2026-11-15 運営者の依頼)。k: 何本目か(先頭のバナーをずらす)。広告のバナーは楽天のものだけ。
// 何本目かで中身を分ける(1本目 公演の掲載のご案内・2本目 宿・3本目 協賛のご案内・4本目 体験と行き方・5本目から そのページの帯のバナー。INLIST_THEMES)。
// 先頭(lead)に、直前の5件に当てはまる契約中の協賛を置く(inlist-pr.mjs)。毎日のビルドで、その日の一覧から作り直す
// land: 横長(今週末・今月。同日「公演カードと同じくらいの横長のバナーに」)
const inlistStrip = (path, k, { wide = false, lead = [], tag = `list${k + 1}`, land = false } = {}) => { const t = inlistTheme(path, k); return prStripHtml({ on: { rakuten: rakutenOn, jalan: jalanOn, jtb: vcRailOn, nta: vcRailOn }, attrs: affAttrs, esc, wide, ids: t.ids, inlist: true, rotate: t.rotate, lead, tag, heading: t.h, self: t.self || "", land }); };
// 一覧の1件の、帯の中身を決めるための値(協賛の当てはまり)。page: event か regular
const listItem = (x, day, page) => ({ prefecture: x.prefecture, city: x.city, day: day < today ? today : day, id: x.id, page, x });
const leadOpts = () => ({ sponsorTile: (it) => listSponsorTile(sponsorsNow, it.page, it.x, { esc }) });
// 一覧の並び(entries: [{ html, item }])に、5件ごとに帯をはさむ(あとに続く件があるときだけ。最後の件のあとには入れない)
// stripAfter: 一覧の i 件目(0 から)のあとに入れる帯を返す関数を作る(一覧が見出しで分かれるページ用。都道府県のページなど)。items: 一覧の全件の listItem(並びの順)
const stripAfter = (items, path, opts) => {
  const total = inlistCount(items.length, STRIP_EVERY), o = leadOpts();
  return (i) => {
    if ((i + 1) % STRIP_EVERY !== 0 || i + 1 >= items.length) return "";
    const k = Math.floor(i / STRIP_EVERY), lead = inlistLead(items.slice(i + 1 - STRIP_EVERY, i + 1), k, total, o);
    return inlistStrip(path, k, { ...opts, lead, land: true });
  };
};
const withStrips = (entries, path, opts) => { const after = stripAfter(entries.map((e) => e.item), path, opts); return entries.map(({ html }, i) => html + after(i)).join(""); };
// 今週末・今月の右の列(PCの画面)の、自分たちのバナー2つ(協賛のご案内・公演の掲載のご案内)。宿の枠の下に横並び(2026-11-15 運営者の依頼)。
// スマホなど右の列がない画面では出さない(一覧の途中の帯に出る)
const selfPair = (page) => `<aside class="self-pair" aria-label="神楽めぐりからのご案内">${["sponsor", "organizers"].map((k) => selfBannerHtml(k, "self-pair-b", `pr-self/${page}-${k}`, esc)).join("")}</aside>`;
const affAttrs = (on, name) => `rel="${on ? "sponsored " : ""}noopener" target="_blank" data-goatcounter-click="${esc(name)}" data-goatcounter-title="${esc(name)}"`;
const stayBanners = (id) => stayBannersHtml({ on: { rakuten: rakutenOn, jalan: jalanOn }, id, attrs: affAttrs, esc });
// 今週末・今月のページの宿: 開催がいくつかの県にまたがるため、日付・地域を絞らない宿のバナーだけを出す(提携IDがあるときだけ)
const tripBand = (id, heading) => { const b = stayBanners(id); return b ? `<aside class="aff trip-band" aria-labelledby="${id}-stay-h"><h2 id="${id}-stay-h">${heading}</h2><p class="stay-cond"><span>開催地の近くで探す</span></p>${b}${prNote(true)}</aside>` : ""; };
// 広告の印は、枠ごとに1つ、枠の下に「PR」だけを置く(2026-11-14 運営者の依頼。上の「広告」・リンクの「(広告)」とくり返さない)
const prNote = (on) => (on ? `<span class="pr pr-foot">PR</span><p class="meta annotation">PR: 宿の案内は広告(アフィリエイトリンク)を含みます。</p>` : "");

// 会場の近くの宿(楽天トラベルの施設検索 API。公開のたびに scripts/fetch-hotels.mjs が取る。無い・古いときは出さない)
const HOTELS_FILE = process.env.NEARBY_HOTELS_FILE ?? "data/nearby-hotels.json";
const nearbyHotels = rakutenOn && existsSync(HOTELS_FILE) ? loadHotels(readFileSync(HOTELS_FILE, "utf8"), nowJst) : null;
/** 開催ページの「会場近くの宿」: 開催日の1泊で、会場の市区町村の宿を探す(これからの開催だけ) */
function stayBlock(e) {
  if (e.stayLinks === false || (!rakutenOn && !jalanOn)) return "";
  const day = e.start.slice(0, 10), place = stayPlace(e);
  const on = rakutenOn || jalanOn;
  // 時刻や日またぎだけでは夜公演と断定できないため、宿の案内は時間帯に依存しない。
  // 枠の中は見出しと宿のボタンだけにする(公演・会場・検索の条件の説明は置かない。2026-10-30 運営者の判断)
  // 例外(MON-6、2026-11-08 運営者の依頼): 公式の名称・説明に「夜神楽」「夜通し」などがある公演だけ、泊まりが前提になることを一文で伝える
  // 2026-11-14 運営者の依頼: 文字のボタン(開催日・市町村つきの検索)をやめ、楽天トラベル・じゃらんの公式バナー(画像)にする
  const links = stayBanners(e.id), night = overnightKagura(e);
  // data-aff-box: 表示・クリックの置き場所の名前(GA4 の affiliate_placement。MEAS-20261117-2)
  return `<aside class="stay" data-aff-box="event_stay" aria-labelledby="stay-h"><h2 id="stay-h">${night ? "泊まりで観る・会場周辺の宿" : "会場周辺の宿"}</h2>
${night ? `<p class="stay-lead">${cl(`${night === "yokagura" ? "夜神楽" : "この神楽"}は、終わりが深夜や翌朝になることがあります。会場の近くに泊まる予定にしておくと安心です。`)}</p>\n` : ""}${night && nearbyHotels ? hotelCardsHtml(nearbyHotels.byEvent[e.id], { eventId: e.id, fetchedAt: nearbyHotels.fetchedAt, esc, attrs: (n) => affAttrs(true, n) }) : ""}${links}
<details class="stay-note"><summary>ご注意</summary><p class="meta annotation">宿泊日(${esc(jpDate(day))})・人数・地域は、リンク先で選んでください。${esc(place)}周辺で探すときは、会場からの距離と最終チェックインの時刻もご確認ください。</p></details>
${prNote(on)}</aside>`;
}

/** 種類・都道府県・定期公演のページの宿の案内(日付なし)。見出しは、会場が決まっていれば「会場周辺の宿」(開催ページと同じ言葉。2026-11-15 の監査で「会場近くの宿」からそろえた)、県・種類のページは「◯◯県の宿」 */
function affiliateBlock(e, { overnight = [] } = {}) {
  if (!rakutenOn && !jalanOn && !amazonOn) return "";
  // 宿は、楽天トラベル・じゃらんの公式バナー(画像)。定期公演のページも同じ(2026-11-14 運営者の依頼で、文字のボタンから置き換え)
  const bn = stayBanners(e.id ?? e.prefecture);
  const goods = amazonOn ? `<div class="afflist"><a href="${esc(amazon(e.kagura || "神楽"))}" ${affAttrs(true, `aff-amazon/${e.prefecture}`)}><b>神楽の本・グッズ</b><small>Amazon</small></a></div>` : "";
  return `<aside class="aff" data-aff-box="travel_block"><h2>${e.venue ? "会場周辺の宿" :`${esc(e.prefecture)}の宿`}</h2>${overnightPicks(overnight)}${goods}${bn}${prNote(!!bn || amazonOn)}</aside>`;
}
// 県・種類のページの宿の枠に、泊まりがけになる開催(夜神楽・夜通し。overnightKagura)を近い順に3つまで(ADV-20261124-1)。
// GA4(2026-10-27〜11-23): 宿のバナーは、開催ページの宿の枠(日付の決まった泊まり)ではよく押され、日付のない県・種類のページの枠ではほぼ押されない。
// 押されたのは夜神楽・花祭など泊まりが前提の開催のページ。県・種類のページから、その開催のページ(その日の会場周辺の宿)へ渡す
const overnightPicks = (list) => {
  const picks = list.filter((x) => isUpcoming(x) && x.stayLinks !== false && overnightKagura(x)).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 3);
  return picks.length ? `<p class="stay-cond"><span>泊まりがけになる開催</span></p><ul class="stay-events">${picks.map((x) => `<li><a href="/events/${x.id}.html"><span class="md">${esc(mdw(x.start.slice(0, 10)))}</span>${esc(x.name)}</a></li>`).join("")}</ul><p class="meta stay-events-note">開催のページで、その日の会場周辺の宿を探せます。</p>` : "";
};
/** 都道府県のページの「◯◯県の体験」。宿の枠のすぐ下に、宿の枠と同じ形で(2026-11-15 運営者の依頼) */
function expBlock(p) {
  const bn = expBannersHtml({ on: { rakuten: rakutenOn, vc: vcEnabled(experienceAff, "activity") }, id: p, attrs: affAttrs, esc });
  return bn ? `<aside class="aff aff-exp"><h2>${esc(p)}の体験</h2>${bn}<span class="pr pr-foot">PR</span></aside>` : "";
}
// 広告が未設定の間は何も出さない(「広告枠」という仮表示を公開サイトに出さない)。確認用に ADS_PLACEHOLDER=1 で枠を表示できる
const adSlot = (slot) =>
  cfg.adsense.client && slot
    ? `<div class="adwrap"><ins class="adsbygoogle" style="display:block" data-ad-client="${cfg.adsense.client}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>`
    : process.env.ADS_PLACEHOLDER ? `<div class="adph">広告枠</div>` : "";

// 地図ライブラリ(バージョン固定 + 改ざん検知 SRI)。defer なので、使う側は DOMContentLoaded で初期化する
const LEAFLET = `<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H" crossorigin="anonymous"><script defer src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH" crossorigin="anonymous"></script>`;

// ---------- 連絡先(メールアドレスは、HTMLにそのまま書かない: 収集ボット対策) ----------
const op = cfg.operator;
// 運営者のメールアドレスは、ページに載せない(分割して埋め込んでも、ページを実行する収集ボットには読まれる)。
// 連絡は、お問い合わせフォームに一本化する。フォームの送信先が未設定の間だけ、フォームが、メール作成の予備に使う(form.mjs)
// 運営者(構造化データ): シンボルを、ロゴとして示す
// sameAs: 運営者が同じ名前で発信している公式のアカウント(X と note。config.json の x.handle・note.urlname)。検索エンジンが「神楽めぐり」をひとつの運営者として結びつけやすくする(SEO-20261124-5)
const ORG_LD = { "@type": "Organization", name: op.name, url: `${cfg.baseUrl}/about.html`, logo: { "@type": "ImageObject", url: `${cfg.baseUrl}/symbol.png`, width: 330, height: 330 }, sameAs: [cfg.x?.handle && `https://x.com/${cfg.x.handle}`, cfg.note?.urlname && `https://note.com/${cfg.note.urlname}`].filter(Boolean) };
const mailLink = () => `<a href="/contact.html">お問い合わせフォーム</a>`;

// ---------- 共通レイアウト ----------
// ---------- 動き(出現・視差・ホバー・導入演出) ----------
// 本文の動きは、全ページ共通の1つだけ: ページを開いたとき、本文全体が1回、静かに現れる(部分ごと・スクロールごとには動かさない)
const SPARKS = 12; // 篝火の火の粉の数。位置・大きさ・速さは、決まった乱数で作る(毎回、同じ出力になる)
let seed = 20261009; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const sparkCss = Array.from({ length: SPARKS }, (_, i) => `.sparks i:nth-child(${i + 1}){--x:${(5 + rnd() * 90).toFixed(1)}%;--s:${(2 + rnd() * 2.2).toFixed(1)}px;--t:${(8 + rnd() * 6).toFixed(1)}s;--d:${(rnd() * 7).toFixed(1)}s;--dx:${Math.round(-40 + rnd() * 80)}px}`).join("\n");
// トップの見出しの背景の情景「月と社」: 満月と月暈、金の縁の霞、山の稜線と鳥居。
// 層(空・霞・地)ごとに、視差の速さを変える。色は CSS(--moon / --fg / --ac2 / --bg)で、昼・夜の配色に合わせる
const MOONSCAPE = `<svg class="ms" viewBox="0 0 300 240" aria-hidden="true" focusable="false">
<defs>
<radialGradient id="msHalo"><stop offset="0" class="ms-s0"/><stop offset=".42" class="ms-s1"/><stop offset="1" class="ms-s2"/></radialGradient>
<linearGradient id="msMist"><stop offset="0" class="ms-m0"/><stop offset=".3" class="ms-m1"/><stop offset=".7" class="ms-m1"/><stop offset="1" class="ms-m0"/></linearGradient>
<linearGradient id="msFar" x2="0" y2="1"><stop offset="0" class="ms-l0"/><stop offset="1" class="ms-l2"/></linearGradient>
<linearGradient id="msNear" x2="0" y2="1"><stop offset="0" class="ms-l1"/><stop offset=".8" class="ms-l2"/></linearGradient>
<radialGradient id="msEdge" cx=".6" cy=".42" r=".62"><stop offset=".55" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>
<mask id="msMask"><rect width="300" height="240" fill="url(#msEdge)"/></mask>
</defs>
<g mask="url(#msMask)">
<g class="ms-stars"><circle cx="64" cy="40" r="1"/><circle cx="104" cy="22" r=".8"/><circle cx="252" cy="28" r=".9"/><circle cx="276" cy="62" r=".7"/><circle cx="132" cy="58" r=".7"/><circle cx="40" cy="92" r=".8"/></g>
<g class="ms-sky"><circle class="ms-halo" cx="192" cy="84" r="112"/><circle class="ms-ring" cx="192" cy="84" r="62"/><circle class="ms-moon" cx="192" cy="84" r="42"/></g>
<g class="ms-kasumi"><path class="ms-k ms-k1" d="M110 106C150 99 250 99 300 106 250 112 150 112 110 106Z"/><path class="ms-k ms-k2" d="M0 150C40 144 120 144 176 150 120 155 40 155 0 150Z"/></g>
<g class="ms-land"><path fill="url(#msFar)" d="M0 192C40 180 72 172 106 178S166 156 202 162 256 182 300 170V240H0Z"/>
<path class="ms-torii" d="M88 158q38-6 76 0l-2 5q-36-4.6-72 0zM94 164h64v3H94zM98 175h56v3H98zM124 167h4v8h-4zM102 167h5l1.6 46h-8.2zM145 167h5l1.6 46h-8.2z"/>
<path fill="url(#msNear)" d="M0 214C44 202 92 204 138 210S226 198 300 210V240H0Z"/></g>
</g>
</svg>`;
const sparksHtml =`<div class="sparks" aria-hidden="true">${"<i></i>".repeat(SPARKS)}</div>`;
const lf = (s) => s.replace(/\r\n?/g, "\n");
const motionCss = lf(readFileSync("scripts/motion.css", "utf8")) + "\n" + sparkCss;
const MOTION_JS = lf(readFileSync("scripts/motion.js", "utf8"));
const VT_JS = lf(readFileSync("scripts/vt.js", "utf8"));
const clientJs = (name) => `<script>${lf(readFileSync(`scripts/client/${name}.js`, "utf8")).trim()}</script>`;
const GA4_CONSENT_JS = lf(readFileSync("scripts/client/ga4-consent.js", "utf8")).trim();
// 動きを減らす設定のとき(と、IntersectionObserver がない環境)は、何も付けない = 動きの CSS が、一切、効かない
// 動きを付けないページ(規約・運営者情報など、読むための文書)。js クラスを付けないので、出現・視差などの動きがすべて止まる
const STILL_PAGES = ["/about", "/contact", "/privacy", "/terms", "/disclaimer"]; // 拡張子なし(/about と /about.html の両方で開けるため、.html を外して比べる)
const HEAD_MOTION = `(function(d){var h=d.documentElement,w=window;try{if(!w.IntersectionObserver||(w.matchMedia&&w.matchMedia('(prefers-reduced-motion: reduce)').matches))return;if(${JSON.stringify(STILL_PAGES)}.indexOf(location.pathname.replace(/[.]html$/,""))>=0)return;h.classList.add('js');if(location.pathname==='/'||location.pathname==='/index.html'){if(!sessionStorage.getItem('intro')){h.classList.add('intro');sessionStorage.setItem('intro','1')}}else if(location.pathname==='/en/'||location.pathname==='/en/index.html'){if(!sessionStorage.getItem('intro')){h.classList.add('intro','unsplash');sessionStorage.setItem('intro','1')}}}catch(e){}})(document)`;

// ---------- デザイン ----------
const css = lf(readFileSync("scripts/style.css", "utf8")) + "\n" + motionCss;
// メインメニュー: 「探し方」で並べる。[行き先, 表示, このメニューが「今いる場所」になるページ(active の値), PC での置き場所, PC の帯での短い表示]
// PC(1024px〜)は2段: 下の段の帯に読者向けの7つ(絵と短い名前)、上の細い段に主催者・広告主向けの2つ("sub")。
// スマホ・タブレットの開くメニューは、9つ全部を絵と文字のカードで並べる
const NAV = [
  ["/", "開催予定", ["/"]],
  ["/calendar.html", "日付・会場・キーワードから探す", ["/calendar.html", "/weekend.html", "/this-month.html", "/month/"], "", "日付・会場・キーワード"],
  ["/map.html", "地図で探す", ["/map.html"], "", "地図"],
  ["/kagura/", "種類で探す", ["/kagura/"], "", "種類"],
  ["/quiz.html", "神楽の好み診断", ["/quiz.html"], "", "好み診断"],
  ["/guide.html", "神楽を初めて観る方へ", ["/guide.html"], "", "初めての方へ"],
  ["/history/", "神楽の歴史", ["/history/"], "", "歴史"],
  ["/organizers.html", "主催者の方へ", ["/organizers.html", "/submit.html"], "sub"],
  ["/sponsor.html", "広告・協賛", ["/sponsor.html", "/pr/sample.html"], "sub"],
];
// メニューの絵(ピクトグラム): スマホ・タブレットで開くメニューは、絵と文字のカード。PC の帯では、小さな絵を名前の前に添える。
// 線だけの絵(24×24、色は文字と同じ currentColor を CSS で朱に)。行き先ごとに1つ。英語版も同じ絵を使う
const NAV_ICON = {
  torii: '<path d="M2.5 4.5Q12 6.6 21.5 4.5"/><path d="M4.5 8.5h15M7 6v15M17 6v15M12 5.8v2.7"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h2M14 14h2M8 17h2"/>',
  pin: '<path d="M12 21s-6.5-5.8-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.2 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/>',
  fan: '<path d="M12 20 3.5 10.5A12.75 12.75 0 0 1 20.5 10.5z"/><path d="M12 20V7.3M12 20 7.4 8.1M12 20l4.6-11.9"/><path d="M8.2 15.6a6 6 0 0 1 7.6 0"/>',
  wakaba: '<path d="M12 21 6 15.5V4l6 5 6-5v11.5z"/><path d="M12 9v12"/>',
  scroll: '<rect x="3" y="4" width="4" height="16" rx="2"/><rect x="17" y="4" width="4" height="16" rx="2"/><path d="M7 6h10M7 18h10M10.5 9v6M13.5 9v4"/>',
  megaphone: '<path d="M4 9.5h3l9-4.5v14l-9-4.5H4z"/><path d="M7 14.5 8.6 20h2.6l-1.1-4.6M19.2 9.3a3.6 3.6 0 0 1 0 5.4"/>',
  quiz: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z"/><path d="M9.8 7.8a2.2 2.2 0 1 1 3.2 2c-.7.4-1 .8-1 1.5M12 13.6v.1"/>',
  nobori: '<path d="M5.5 2.5v19M5 4.5h13.5"/><path d="M9 4.5h8.5v14.5H9z"/><path d="M5.5 8.5H9M5.5 12.5H9M5.5 16.5H9M13.25 8v7"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
};
const NAV_ICON_OF = {
  "/": "torii", "/calendar.html": "calendar", "/map.html": "pin", "/kagura/": "fan", "/guide.html": "wakaba", "/history/": "scroll", "/organizers.html": "megaphone", "/quiz.html": "quiz", "/sponsor.html": "nobori",
  "/en/": "torii", "/en/calendar.html": "calendar", "/en/guide.html": "wakaba", "/en/kagura.html": "fan", "/en/history.html": "scroll",
};
// フッター: サイトについての6つのリンクだけを、アイコン(上)と名前(下)で並べる(2026-11-16 運営者が見本Bを選んだ)。
// 主催者・協賛・ガイド・歴史・診断は、上のメニューから入る。「プライバシーポリシー」は狭い幅で「プライバシー／ポリシー」の所でだけ折り返す
const FOOT_ICON = {
  person: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c.8-4.2 3.8-6.5 7.5-6.5s6.7 2.3 7.5 6.5"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.6 6.5 8.4 6.6 8.4-6.6"/>',
  globe: NAV_ICON.globe,
  doc: '<path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14.5 3v4.5H19M9 11.5h7M9 14.5h7M9 17.5h4.5"/>',
  shield: '<path d="M12 3 19 6v5.5c0 4.6-3 8-7 9.5-4-1.5-7-4.9-7-9.5V6z"/><rect x="9.3" y="10.8" width="5.4" height="4.4" rx=".8"/><path d="M10.4 10.8V9.6a1.6 1.6 0 0 1 3.2 0v1.2"/>',
  caution: '<path d="M12 3.5 21 19.5H3z"/><path d="M12 9.5v4.8M12 16.8v.1"/>',
};
const FOOT_LINKS = [["/about.html", "運営者情報", "person"], ["/contact.html", "お問い合わせ", "mail"], ["/en/", "English", "globe", ' hreflang="en" lang="en"'], ["/terms.html", "利用規約", "doc"], ["/privacy.html", "プライバシー<wbr>ポリシー", "shield"], ["/disclaimer.html", "免責事項", "caution"]]
  .map(([h, t, k, a = ""]) => `<a href="${h}"${a}><svg class="fi" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${FOOT_ICON[k]}</svg><span>${t}</span></a>`).join("");
const navIcon = (h, en) => {
  const p = NAV_ICON[en && !h.startsWith("/en/") ? "globe" : NAV_ICON_OF[h]]; // 英語版の「日本語」(そのページの日本語版へ)は地球の絵
  return p ? `<svg class="ni" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">${p}</svg>` : "";
};
// 短い表示(short)は PC の帯でだけ、CSS で見せる(data-s)。読み上げは、いつも元の名前
const navCur = (h, group, active) => active === h ? ' aria-current="page"' : group.includes(active) ? ' aria-current="true"' : "";
const navLink = ([h, t, group, place, short], active, en = false) => {
  const cur = navCur(h, group, active);
  const cls = [cur && "on", place === "sub" && "nav-sub"].filter(Boolean).join(" ");
  return `<a href="${h}"${cls ? ` class="${cls}"` : ""}${cur}${short ? ` data-s="${short}"` : ""}>${navIcon(h, en)}<span>${t}</span></a>`;
};
// PC の上の細い段(主催者・広告主の方へ)。スマホ・タブレットでは出さない(開くメニューのカードにある)
const subNav = (active) => `<p class="subnav">${NAV.filter((x) => x[3] === "sub").map(([h, t, group]) => { const cur = navCur(h, group, active); return `<a href="${h}"${cur ? ` class="on"${cur}` : ""}>${t}</a>`; }).join("")}</p>`;
// スマホの三本線メニュー: JS が動くときだけ、ボタンを出して、メニューを畳む(JS がなければ、メニューは常に見える)
const NAV_SCRIPT = `(function(){var h=document.documentElement,w=window,q=false;function sc(){q=false;h.classList.toggle('scrolled',(w.pageYOffset||0)>8)}w.addEventListener('scroll',function(){if(!q){q=true;w.requestAnimationFrame(sc)}},{passive:true});sc();var b=document.getElementById('menubtn'),n=document.getElementById('gnav');if(!b||!n)return;document.documentElement.classList.add('navjs');b.hidden=false;function set(o){b.setAttribute('aria-expanded',String(o));n.classList.toggle('open',o)}b.addEventListener('click',function(){set(b.getAttribute('aria-expanded')!=='true')});document.addEventListener('keydown',function(e){if(e.key==='Escape'&&b.getAttribute('aria-expanded')==='true'){set(false);b.focus()}})})()`;
const FONT_URL = "https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500&family=Zen+Kaku+Gothic+New:wght@400;500&display=swap";
const FONT_SCRIPT = `(function(){var l=document.getElementById('gf');if(l)l.addEventListener('load',function(){l.media='all'})})()`;

// 共有用の画像(1200x630)。トップの絵とサイト名から、scripts/make-og.mjs で作って assets/ に置いている
const OG_SIZE = { width: 1200, height: 630 };
const ogUrl = (en) => `${cfg.baseUrl}/${en ? "og-en.jpg" : "og.jpg"}`;
const EN_NAV = [["/en/", "Home", ["/en/"]], ["/en/calendar.html", "Calendar", ["/en/calendar.html", "/en/regular-shows.html"]], ["/en/kagura.html", "Kagura styles", ["/en/kagura.html", "/en/kagura/"]], ["/en/guide.html", "First-timer's guide", ["/en/guide.html"]], ["/en/history.html", "History", ["/en/history.html"]], ["/", "日本語", []]];
const EN_FOOTER = `<footer><p class="fnote">Event listings are in Japanese, but your browser can translate them.</p><p class="flinks"><a href="/en/calendar.html">Calendar</a><a href="/en/regular-shows.html">Regular shows</a><a href="/en/kagura.html">Kagura styles</a><a href="/map.html" hreflang="ja">Map (Japanese)</a></p><p class="flinks"><a href="/about.html" hreflang="ja">About (Japanese)</a><a href="/contact.html" hreflang="ja">Contact (Japanese)</a><a href="/privacy.html" hreflang="ja">Privacy policy (Japanese)</a><a href="/disclaimer.html" hreflang="ja">Disclaimer (Japanese)</a></p><p class="copy">© Kagura Meguri</p></footer>`;
// 出典・注釈・広告の説明(.meta.annotation)は、本文の途中から抜き出し、ページの下部に小さくまとめる。
// 広告そのものの印(枠の下の「PR」)は、広告の場所に残す。スクリプトの中と、id のある注釈(入力欄の説明)は動かさない
const NOTE_RE = /<p class="meta annotation"(?![^>]*\bid=)[^>]*>([\s\S]*?)<\/p>/g;
// 2026-11-14 運営者の依頼: 広告の枠の上に置いていた「広告 このページにはアフィリエイト広告が…」の1行はやめた(各枠の下の「PR」と重なるため)。
// じゃらんの広告(同意のあとに読み込む発行タグ)があるページでは、外部への通信のことを、ページ下の広告の注記に書き添える
const VC_NOTE = "じゃらんの広告表示時には外部への通信が発生します。";
// 公演の説明: 話題が変わるところで行を分ける(日時・料金・行き方などの話と、公演の中身の話を、同じ行に続けない)。
// 同じ話題が4文以上続くときは、スマホで1つの塊にならないよう、2文ずつの行に分ける。文は変えない(分け方は phrases.mjs の topicGroups)
const descParas = (s = "") => (String(s).trim() ? `<p>${topicLines(String(s).trim())}</p>` : "");
// ページ下の注記: ほかの場所(宿の枠の条件、各広告の枠の「PR」、免責事項のページ)で伝わっている注意はくり返さない。
// 広告の注記は、ページごとに1行へまとめる(各広告の枠の「PR」はそのまま残る)
const NOTE_DROP = [/^営業状況・空き・価格はリアルタイム表示ではありません/, /^会場の公式アクセスと公共交通を先に確認し/, /泊・大人2名で検索します。/, /^掲載情報確認: /, /^県内全域の一覧です。/];
const NOTE_AD = [/^PR: 宿の案内は広告/, /^<span class="pr">広告<\/span>\s*外部サービスの広告です/, /^<span class="pr">PR<\/span>\s*紹介している商品・返礼品のリンクは広告/];
// 2026-11-24 運営者の依頼(注意書きが長い): 2文を1文に。広告であること(アフィリエイト)と、報酬が入ることは、どちらも残す
const AD_NOTE = '<span class="pr">PR</span> 宿・交通・体験・商品のリンクには広告(アフィリエイト)を含み、予約や購入で当サイトに報酬が入ることがあります。';
const tidyNotes = (notes, vc = false) => {
  const plain = (n) => n.replace(/<[^>]+>/g, "");
  let ad = vc;
  const kept = notes.filter((n) => {
    if (NOTE_AD.some((re) => re.test(n))) { ad = true; return false; }
    if (NOTE_DROP.some((re) => re.test(plain(n)))) { if (/広告|アフィリエイト/.test(n)) ad = true; return false; }
    return true;
  });
  return ad ? [...kept, AD_NOTE + (vc ? VC_NOTE : "")] : kept;
};
const collectNotes = (body) => {
  const notes = [];
  const out = body.split(/(<script[\s\S]*?<\/script>)/).map((part, i) => (i % 2 ? part : part.replace(NOTE_RE, (_, inner) => {
    const t = inner.trim();
    if (t && !notes.includes(t)) notes.push(t);
    return "";
  }).replace(/<details[^>]*><summary>[^<]*<\/summary>\s*<\/details>/g, ""))).join("");
  const shown = tidyNotes(notes, body.includes("data-vc-ad="));
  return shown.length ? `${out}<section class="page-notes" aria-label="出典・注記・広告について"><h2>出典・注記</h2>${shown.map((n) => `<p>${n}</p>`).join("")}</section>` : out;
};
const layout = ({ title, desc, path, body, ld, head = "", splash = "", active = "", noindex = false, withForm = false, ogType = "website", lang = "ja", alts = [], wide = false, railCar = "" }) => {
  const en = lang === "en";
  const quizOffer = !en && !noindex && !withForm && (path === '/' || /^\/(calendar|map|weekend|this-month)\.html$/.test(path) || /^\/(events|regular|pref|month|kagura)\//.test(path));
  // Local CMP loads after parsing; analytics/ads remain closed until an explicit choice.
  // AdSense and GoatCounter remain paused.
  const consentBootstrap = `<link rel="stylesheet" href="/vendor/cookieconsent-3.2.1/cookieconsent.css"><script defer src="/vendor/cookieconsent-3.2.1/cookieconsent.umd.js"></script><script defer src="/consent-manager.js"></script>`;
  const ga4Bootstrap = cfg.analyticsId ? `<script data-ga4-id="${esc(cfg.analyticsId)}" data-ga4-host="${esc(new URL(cfg.baseUrl).hostname)}" data-require-statistics-consent="">${GA4_CONSENT_JS}</script>` : "";
  const alternates = alts.length ? [[lang, path], ...alts].map(([l, h]) => `<link rel="alternate" hreflang="${l}" href="${cfg.baseUrl}${h}">`).join("") + `<link rel="alternate" hreflang="x-default" href="${cfg.baseUrl}${[[lang, path], ...alts].find(([l]) => l === "en")[1]}">` : "";
  const rail = !en && railPage(path) ? sideRailHtml({ on: { rakuten: rakutenOn, jalan: jalanOn, jtb: vcRailOn, nta: vcRailOn }, attrs: affAttrs, esc, wide, car: railCar, path }) : "";
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">${(body + rail).includes('data-vc-ad=') ? clientJs("valuecommerce-consent") : ""}<meta name="viewport" content="width=device-width,initial-scale=1">
<script>${FRAME_BUSTER}</script>${consentBootstrap}
<script>${HEAD_MOTION}</script>
<script>${VT_JS}</script><link rel="expect" href="#main" blocking="render">
<meta name="referrer" content="strict-origin-when-cross-origin">${noindex ? '<meta name="robots" content="noindex,follow">' : '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">'}
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${cfg.baseUrl}${path}">${alternates}${SEO.googleVerification ? `<meta name="google-site-verification" content="${esc(SEO.googleVerification)}">` : ""}${SEO.bingVerification ? `<meta name="msvalidate.01" content="${esc(SEO.bingVerification)}">` : ""}
<link rel="alternate" type="application/atom+xml" title="${esc(cfg.siteName)} 新着の開催情報" href="/feed.xml">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="${ogType}"><meta property="og:url" content="${cfg.baseUrl}${path}"><meta property="og:site_name" content="${en ? "Kagura Meguri" : esc(cfg.siteName)}"><meta property="og:locale" content="${en ? "en_US" : "ja_JP"}"><meta property="og:image" content="${ogUrl(en)}"><meta property="og:image:width" content="${OG_SIZE.width}"><meta property="og:image:height" content="${OG_SIZE.height}"><meta name="twitter:card" content="summary_large_image">${cfg.x?.handle ? `<meta name="twitter:site" content="@${esc(cfg.x.handle)}">` : ""}<meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${ogUrl(en)}">
<meta name="theme-color" content="#f3eee4" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#171513" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon-48.png" type="image/png" sizes="48x48"><link rel="icon" href="/symbol-96.png" type="image/png" sizes="96x96"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link id="gf" rel="stylesheet" href="${FONT_URL}" media="print"><script>${FONT_SCRIPT}</script><noscript><link rel="stylesheet" href="${FONT_URL}"></noscript>
${ga4Bootstrap}<style>${css}</style>${head}
${GOATCOUNTER}
${ld ? `<script type="application/ld+json">${ldJson(ld)}</script>` : ""}</head><body>
${splash}<a class="skip" href="#main">${en ? "Skip to content" : "本文へ移動"}</a>
<header class="top"><div class="wrap"><a class="logo" href="${en ? "/en/" : "/"}"><img src="/symbol-96.png" alt="" width="32" height="32">${en ? "Kagura Meguri" : esc(cfg.siteName)}</a><button class="menubtn" id="menubtn" type="button" aria-expanded="false" aria-controls="gnav" hidden><span class="bars" aria-hidden="true"></span>${en ? "Menu" : "メニュー"}</button><nav id="gnav" aria-label="${en ? "Main menu" : "メインメニュー"}">${(en ? EN_NAV.map((x) => (x[1] === "日本語" ? [alts.find(([l]) => l === "ja")?.[1] ?? "/", x[1], x[2]] : x)) : NAV).map((x) => navLink(x, active, en)).join("")}</nav>${en ? "" : subNav(active)}</div></header><script>${NAV_SCRIPT}</script>
${rail}<div class="wrap${wide ? " wide" : ""}"><main id="main">${en ? body : collectNotes(body)}</main>
${en ? EN_FOOTER : `<footer><nav class="fnav" aria-label="サイトについて">${FOOT_LINKS}</nav><p class="copy">© ${esc(cfg.siteName)}</p></footer>`}${cookieControls(en)+clientJs("cookie-controls")}${rail ? clientJs("side-rail") : ""}</div>
${quizOffer ? `<aside id="quiz-offer" class="quiz-offer" role="region" aria-labelledby="quiz-offer-title" aria-describedby="quiz-offer-desc" hidden><button type="button" class="linkbtn quiz-close" aria-label="診断の案内を閉じる">閉じる</button><p id="quiz-offer-title">気になる神楽、まだ迷っていますか？</p><p id="quiz-offer-desc">${questions.length}問で、好きな舞の雰囲気を探せます。</p><a class="btn" href="/quiz.html">好みから探す</a></aside>${clientJs('quiz-offer')}` : ''}
${body.includes('class="stay-banner') ? clientJs("ad-fallback") : ""}${body.includes('class="d-side"') ? clientJs("side-follow") : ""}${body.includes('class="experience-region"') || body.includes('class="kfold"') ? clientJs("details-target") : ""}${body.includes('class="read-layout"') ? clientJs("reader") : ""}${body.includes('class="octa-bar"') ? clientJs("organizers") : ""}${withForm ? `<script>${formScript(cfg)}</script>` : ""}${cfg.analyticsId ? clientJs("affiliate") + clientJs("analytics-events") : ""}<script>${MOTION_JS}</script></body></html>`;
  // インラインのスクリプト/スタイルのハッシュを集めて、このページ専用の CSP(コンテンツの許可リスト)を <meta> に入れる
  return html.replace('<head><meta charset="utf-8">', `<head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${cspFor(html, cfg)}">`);
};

// 県・神楽の種類のページの URL(リンクは、すべてこの2つで作る)
const prefHref = (p) => `/pref/${encodeURIComponent(p)}.html`;
const kaguraHref = (k) => `/kagura/${encodeURIComponent(k)}.html`;
// 件数の要約(「開催予定 3件 ・ 定期公演 1件」。0件の項目は出さない)
const countLine = (n, m) => [n ? `開催予定 ${n}件` : "", m ? `定期公演 ${m}件` : ""].filter(Boolean).join(" ・ ") || "開催予定はありません";
const kaguraTag = (k, cls = "tag gold") => (k ? `<a class="${cls}" href="${kaguraHref(k)}">${esc(k)}</a>` : "");
// 同じ公演のくり返し(名称と会場が同じ開催)。2回以上あれば「定例開催」の印を付け、開催ページに、ほかの日程を出す
const seriesKey = (e) => `${e.name}|${e.venue ?? ""}`;
const sameSeries = (e) => events.filter((x) => x.id !== e.id && seriesKey(x) === seriesKey(e));
// 時刻の表記: 「13:00〜」。1日に複数回あれば「11:00〜・13:00〜」。時間未定は、決まった言い方にそろえる
const TIME_UNKNOWN = "時刻未確認";
const startTimes = (e) => hm(e.sessions?.length ? e.sessions.map((x) => x.slice(0, 5) + "〜").join("・") : `${e.start.slice(11, 16)}〜`);
// 一覧カードの会場・料金・予約: 分かっている項目だけを出す(会場は常に。分からなければ「未確認」)。出典・確認日は開催ページで見せる
// venueOnly: 終わった開催のカード(料金・予約は、その年のもので、次の回の案内にならないため出さない。検索の「終了した開催」と同じ)
const cardFacts = (e, { venueOnly = false } = {}) => {
  const fact = (k, v) => `<div><span class="k">${k}:</span><span>${v ? esc(v) : '<span class="tbd">未確認</span>'}</span></div>`;
  const reservation = reservationLabel(e);
  return `<div class="meta event-facts">${fact("会場", e.venue)}${!venueOnly && e.fee ? fact("料金", e.fee) : ""}${!venueOnly && reservation !== "要確認" ? fact("予約要否", reservation) : ""}</div>`;
};
// 地名と、名前の最後の「(会場名)」は、まとまりの途中で改行しない(.ph)。Safari など文節で折り返せないブラウザ向け
const ph = (s) => `<span class="ph">${esc(s)}</span>`;
const placePh = (pref, city) => [pref, city].filter(Boolean).map(ph).join(" ");
const namePh = (s = "") => { const m = s.match(/^(.+?)([(（][^()（）]+[)）])$/); return m ? esc(m[1]) + ph(m[2]) : esc(s); };
// 「・」で区切る並び: 区切りは各項目の前に置き、行の頭に来たものは枠の外に隠す(行頭・行末に「・」だけが残らない)
const sepList = (items) => { const xs = items.filter(Boolean); return xs.length ? `<span class="sl"><span class="sl-in">${xs.map((x) => `<span>${x}</span>`).join("")}</span></span>` : ""; };
// withTag: 種類のページでは false(どのカードも同じ種類なので、種類の札をくり返さない)
// past: 終わった開催(「これまでの開催」)。会場だけを出し、年と終了を書き添える(検索の「終了した開催」と同じ書き方)
const card = (e, h = "h3", withFacts = true, withTag = true, { past = false } = {}) => {
  const p = parts(e.start);
  return `<div class="card${past ? " past" : ""}"><div class="date"><small>${p.mo}月</small><b>${p.d}</b><small>${WD[p.wd]}曜</small></div><div>
<${h}><a href="/events/${e.id}.html">${namePh(e.name)}</a></${h}>
<div class="meta">${sepList([sameSeries(e).length ? '<span class="rep">定例開催</span>' : "", e.timeUnknown ? TIME_UNKNOWN : nobr(startTimes(e)), placePh(e.prefecture, e.city), !withFacts && e.fee ? esc(e.fee) : ""])}</div>
${withFacts ? cardFacts(e, { venueOnly: past }) : ""}${past ? `<p class="meta past-note">${+e.start.slice(0, 4)}年の開催(終了)</p>` : ""}${withTag ? kaguraTag(e.kagura) : ""}</div></div>`;
};
// 休演の時期(秋祭りの間など)は、曜日の決まりだけを見せると、いつでも観られると誤解されるため、「休演中」と次の公演日を出す
// 県・種類のページの一覧: 月が変わるところに、月の区切りを入れる(2か月以上にまたがるときだけ)。「いつ」を拾いやすくする。
// 区切りは見出しにせず、カードの見出しの段(h3)は変えない
// after(i): i 件目のあとに入れるもの(都道府県のページの、一覧の途中の帯。stripAfter)
const cardsByMonth = (list, withTag = true, after = () => "") => {
  const multi = new Set(list.map((e) => e.start.slice(0, 7))).size > 1;
  let prev = "";
  return list.map((e, i) => { const k = e.start.slice(0, 7); const head = multi && k !== prev ? `<p class="mhead">${k.slice(0, 4) === nowJst.slice(0, 4) ? `${+k.slice(5, 7)}月` : `${+k.slice(0, 4)}年${+k.slice(5, 7)}月`}</p>` : ""; prev = k; return head + card(e, "h3", true, withTag) + after(i); }).join("");
};
const regPause = (r) => { const st = regularStatus(r, today); return st.paused ? `休演中・${st.next ? `次の公演は${mdLabel(st.next)}` : "次の公演日は未定"}` : ""; };
const regCard = (r, { withTag = true } = {}) => { const pause = regPause(r); return `<div class="card reg${pause ? " paused" : ""}"><div class="date"><small>定期</small><b>${pause ? "休演中" : esc(r.badge || "毎")}</b></div><div>
<h3><a href="/regular/${r.id}.html">${namePh(r.name)}</a></h3>
${pause ? `<p class="reg-pause">${esc(pause)}</p>` : ""}<div class="meta">${sepList([nobr(esc(r.schedule)), placePh(r.prefecture, r.city)])}</div>
${cardFacts(r)}${withTag ? kaguraTag(r.kagura) : ""}</div></div>`; };
const write = (p, c) => { p = p.replace(/^dist(?=\/)/, OUT); mkdirSync(p.replace(/[\\/][^\\/]*$/, "") || ".", { recursive: true }); writeFileSync(p, c); };
const hero = (h, p) => `<section class="hero"><h1>${h}</h1>${p ? `<p>${p}</p>` : ""}</section>`;
const empty = (msg) => `<p class="empty">${msg}</p>`;
// 画面に見えるパンくず(構造化データのパンくずと、あわせて使う)
const crumbNav = (items) => `<nav class="crumbs" aria-label="パンくずリスト"><ol>${items.map(([t, h]) => (h ? `<li><a href="${h}">${esc(t)}</a></li>` : `<li aria-current="page">${esc(t)}</li>`)).join("")}</ol></nav>`;
const itemListLd = (name, list) => (list.length ? { "@context": "https://schema.org", "@type": "ItemList", name, itemListElement: list.map((x, i) => ({ "@type": "ListItem", position: i + 1, url: `${cfg.baseUrl}${x.href}`, name: x.name })) } : null);
const ym = (s) => s.slice(0, 7);
const monthLabel = (k) => `${+k.slice(0, 4)}年${+k.slice(5, 7)}月`;
const monthMap = new Map();
for (const e of upcoming) { const k = ym(e.start); if (!monthMap.has(k)) monthMap.set(k, []); monthMap.get(k).push(e); }
const months = [...monthMap.keys()].sort();
const monthLinks = () => (months.length ? `<div class="taglist">${months.map((k) => `<a class="tag" href="/month/${k}.html">${monthLabel(k)}(${monthMap.get(k).length}件)</a>`).join("")}</div>` : "");
// ほかの探し方: 一覧・開催のページの終わりに置く、次の行き先(今週末・今月・日付と場所・地図・直近の月)。どのページでも同じ並び・同じ形(チップ)。
// self は今のページ(自分へのリンクは出さない)。月のページでは、月はすぐ上の「ほかの月」にあるので出さない(withMonths:false)
// lead は先頭に足す行き先(種類のページでは、その神楽が観られる県のページ。SEO-20261124-2)
const otherWays = (self = "", { withMonths = true, lead = [] } = {}) => `<h2>ほかの探し方</h2><div class="taglist">${[...lead, ["/weekend.html", "今週末の神楽"], ["/this-month.html", "今月の神楽"], ["/calendar.html", "日付・会場・キーワードから探す"], ["/map.html", "地図で探す"], ...(withMonths ? months.slice(0, 3).map((m) => [`/month/${m}.html`, monthLabel(m)]) : [])].filter(([h]) => h !== self).map(([h, t]) => `<a class="tag" href="${h}">${t}</a>`).join("")}</div>`;
const lastmodOf = (list) => list.map((x) => x.checked).filter(Boolean).sort().pop() ?? nowJst.slice(0, 10);
// パンくずの構造化データ: items = [[名前, パス], ..., [名前]](最後だけパスなし)
const crumbsLd = (items) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map(([name, p], i) => ({ "@type": "ListItem", position: i + 1, name, ...(p ? { item: `${cfg.baseUrl}${p}` } : {}) })) });
const listNames = (arr, n = 3) =>arr.slice(0, n).map((x) => x.name.replace(/\s*[(〈].*$/, "")).join("、");
const sourceNote = (x) => {
  if (x.socialEvidence) {
    const s = x.socialEvidence;
    return `<p class="meta annotation">出典: ${esc(s.organizer)} / <a href="${esc(s.postUrl)}" rel="noopener noreferrer" target="_blank">${esc(SOCIAL_LABELS[socialPlatform(s.postUrl)])}の公開投稿</a>（${jpDate(s.checked)}確認）。開催日・会場を確認して掲載しています。最新の案内は投稿元をご確認ください。</p>`;
  }
  if (!x.source && !x.checked && !x.auto) return "";
  const day = x.checked ?? x.lastSeen; // 自動取得したものは、最後に取得元で確認できた日
  return `<p class="meta annotation">出典: ${esc(x.source ?? "")}${day ? `(${jpDate(day)}${x.auto ? "取得" : "確認"})` : ""}</p>`;
};
// Googleカレンダーで、全開催の日程(events.ics)を購読する画面を開くリンク(URLで追加 = 新しい開催も、自動で反映される)
const GCAL_SUBSCRIBE = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(`webcal://${cfg.domain}/events.ics`)}`;
// 新しい解説を作らず、既存ガイドの該当章と、その公演の地図へ案内する。
// 都道府県のページの冒頭の説明: その県の代表的な神楽と特徴の概要(3文くらい。2026-11-15 運営者の依頼「冒頭の説明は、各県の代表的な神楽と特徴を、概要レベルで3行程度、調査して記載」)。
// 文と参考は data/pref-leads.json。文の中の神楽の名前が、その県に載せている神楽の種類なら、種類のページへのリンクにする。参考はページ下の注記へ(.meta.annotation)。
// 書いていない県は、以前の文(日程と会場をまとめています)のまま
const prefLeads = existsSync("data/pref-leads.json") ? readJson("data/pref-leads.json") : {};
const prefLead = (p, kinds) => {
  const l = prefLeads[p];
  if (!l) return phrasesHtml(`<p class="lead">${esc(p)}で開催される神楽の日程と会場を、公式情報をもとにまとめています。${kinds.length ? `${kinds.map((k) => `<a href="${kaguraHref(k)}">${esc(k)}</a>`).join("、")}の公演を掲載しています。` : ""}</p>`);
  const ks = kinds.map(esc).filter(Boolean).sort((a, b) => b.length - a.length), used = new Set();
  const text = ks.length ? esc(l.text).replace(new RegExp(ks.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g"), (m) => (used.has(m) ? m : (used.add(m), `<a href="${kaguraHref(kinds.find((k) => esc(k) === m))}">${m}</a>`))) : esc(l.text);
  return `${phrasesHtml(`<p class="lead">${text}</p>`)}${l.refs?.length ? `<p class="meta annotation">${esc(p)}の神楽の概要の参考: ${l.refs.map((r) => `<a href="${esc(r.url)}" rel="noopener noreferrer" target="_blank">${esc(r.name)}</a>`).join(" / ")}</p>` : ""}`;
};
// 会場の欄: 会場名の下に、所在地(都道府県・市区町村・番地)と地図への案内をまとめる(「所在地」の行と「会場の場所」の見出しを統合)
// Google マップで、会場の場所と経路を探す(公演ページには地図を置かず、ここへ案内する)
const mapsUrl = (x) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${x.venue ?? ""} ${x.prefecture}${x.city ?? ""}`.trim())}`;
// 要点の表で分からない欄は「未確認」と短く書き、確認のお願いは表の下に1回だけ置く
const unknownAs = (v) => (v === "要確認" ? "未確認" : v);
const unknownNote = (on) => (on ? `<p class="unknown-note">未確認の項目は、お出かけ前に公式情報でご確認ください。</p>` : "");
// 説明文の末尾の「出発前に公式情報をご確認ください。」(どの公演にも当てはまるお願い)は、すぐ上の要点の表の下に同じお願い(unknownNote)を出すページではくり返さない。
// 画面に出す文だけを短くする(データ・検索向けの説明文・構造化データは変えない)。「終演時刻は公式情報を…」のように、その公演の中身のある文は残す
const GENERIC_CHECK = /(^|。)(?:出発前|お出かけ前|出かける前)に、?公式(?:情報|案内)(?:を|で)ご確認ください。$/;
const shownDesc = (x, noted) => { const d = String(x.description ?? "").trim(); return noted ? d.replace(GENERIC_CHECK, "$1") : d; };
const venueCell = (x, fallback = "未確認") => `${x.venue ? `<span class="vn">${esc(x.venue)}</span>` : fallback}<span class="addr">${esc([x.prefecture, x.city, x.address].filter(Boolean).join(" "))}</span>${x.lat != null ? `<a class="tomap" href="${mapsUrl(x)}" target="_blank" rel="noopener">地図・経路を見る</a>` : ""}`;
// ---------- 今週末・今月(日付で中身が変わる。deploy.yml が毎日、作り直す) ----------
const today = nowJst.slice(0, 10);
const moreOffers = createMoreOfferIndex(moreOffersData, today);
const sponsorsNow = activeSponsors(sponsorsData, today);
// 協賛枠は、あればページの上のほう(県・種類のページは説明の直後、開催・定期公演のページは右の列の先頭。スマホでは要点のすぐ後)に出す。なければ何も出さない
const sponsorFor = (page, x, o = {}) => sponsorSlot(sponsorsNow, page, { prefecture: x.prefecture, kagura: x.kagura, city: x.city, id: x.id, places: x.places }, { esc, ...o });
const onDay = (e, d) => e.start.slice(0, 10) <= d && (e.end || e.start).slice(0, 10) >= d;
const timeOf = (r) => (r.schedule.match(/\d{1,2}:\d{2}/)?.[0] ?? "99:99").padStart(5, "0");
const daysBetween = (a, b) => { const out = []; for (let d = a; d <= b; d = addDays(d, 1)) out.push(d); return out; };
const maxDay = (...xs) => xs.flat().filter(Boolean).sort().pop();
// 終わった開催: 次の回(同じ催しの後の回)と、検索に残すか(scripts/lib/past-events.mjs の決まり)
const pastOf = new Map(events.filter((e) => !isUpcoming(e)).map((e) => { const next = nextEdition(e, events); return [e.id, { next, indexed: keepPastIndexed(e, { today, next }) }]; }));
// 直近1年の終わった開催と、検索に残す終わった開催(どの終了ページも、県・種類のページからリンクでたどれるように)
const pastRecords = (list) => { const rec = recentPast(list, { today, isUpcoming }); return [...rec, ...list.filter((e) => pastOf.get(e.id)?.indexed && !rec.includes(e))].sort((a, b) => b.start.localeCompare(a.start)); };
// 開催予定が0件の種類・県のページも、直近1年の開催の記録と解説があれば検索に残す(「◯◯神楽 日程」で来年の日程を探す人の入口)
const kaguraIndexed = (k) => upcoming.some((e) => e.kagura === k) || regular.some((r) => r.kagura === k) || (!!kaguraInfo[k] && pastRecords(events.filter((e) => e.kagura === k)).length > 0);
const prefIndexed = (p) => upcoming.some((e) => e.prefecture === p) || regular.some((r) => r.prefecture === p) || (() => { const rec = pastRecords(events.filter((e) => e.prefecture === p)); return rec.length > 0 && (!!(prefLeads[p] || prefInfo[p]) || rec.some((e) => String(e.description ?? "").trim())); })();
// 「これまでの開催」の一覧(新しい順)。開催予定と同じカードで、年と終了を書き添える(1年をまたぐため)
// (2026-11-18 運営者の依頼「近くで観られる神楽、これまでの開催もカード形式に」。以前は日付と名前だけの行の一覧)
const pastList = (list, { withKagura = true, h = "h3" } = {}) => `<div class="past-list">${list.map((x) => card(x, h, true, withKagura, { past: true })).join("")}</div>`;
// 開催予定のない種類・県のページの案内(次の日程の載せ方と、近くで観られる開催)
// 開催予定のあるページの「これまでの開催」: たたんで、ページの下のほうに置く
const pastMore = (past, o) => past.length ? `<details class="past-more"><summary>これまでの開催(${past.length}件)</summary><p class="meta">終了した開催です。日程は年によって変わります。</p>${pastList(past, o)}</details>` : "";
// 次の日程を「確かめ次第載せます」とは書かない(載るかどうか分からないため。2026-11-18 運営者の依頼。終わった開催のページも同じ)
// 近くで観られる開催予定: 同じ県を先に、同じ地方を後に(同じ公演のくり返しは1件にまとめる)。最大 n 件
const nearbyUpcoming = (prefList, n = 4) => {
  const ps = new Set(prefList), rs = new Set(prefList.map(regionOf).filter(Boolean)), seen = new Set();
  return [...upcoming.filter((x) => ps.has(x.prefecture)), ...upcoming.filter((x) => !ps.has(x.prefecture) && rs.has(regionOf(x.prefecture)))]
    .filter((x) => !seen.has(seriesKey(x)) && seen.add(seriesKey(x))).slice(0, n).sort((a, b) => a.start.localeCompare(b.start));
};
const pendingBlock = ({ label, past, near, pastId, withKagura = true, h = "h2" }) => `<section class="ended-note" aria-label="${esc(label)}の次の日程"><p><strong>現在の開催予定はありません。</strong></p>${past.length ? `<p class="meta">例年の時期の目安に、<a href="#${pastId}">これまでの開催</a>を載せています。</p>` : ""}</section>${near.length ? `<${h}>近くで観られる神楽</${h}><div class="near-list">${near.map((x) => card(x, h === "h2" ? "h3" : "h4")).join("")}</div>` : ""}${past.length ? `<${h} id="${pastId}">これまでの開催</${h}><p class="meta">直近1年に掲載した開催です(終了しています)。日程は年によって変わります。</p>${pastList(past, { withKagura, h: h === "h2" ? "h3" : "h4" })}` : ""}`;
// 毎週などの定期公演の、期間中の公演日。毎日の公演は、別に扱う(一覧が、同じ公演で埋まらないように)
const regularDates = (days) => regular.filter((r) => !isDaily(r)).map((r) => ({ r, dates: days.filter((d) => regularOn(r, d)) })).filter((x) => x.dates.length);
const dailyIn = (days) => regular.filter((r) => isDaily(r) && days.some((d) => regularOn(r, d))).map((r) => ({ r, closed: days.filter((d) => !regularOn(r, d)) }));
const wk = weekendRange(today);
const wkLabel = rangeLabel(wk.start, wk.end);
const wkHolidays = [...new Set(wk.days.map(holidayName).filter(Boolean))];
const wkRenkyu = wk.days.length >= 3 ? `${wk.days.length}連休` : "";
const wkEvents = upcoming.filter((e) => wk.days.some((d) => onDay(e, d)));
const wkRegs = regularDates(wk.days), wkDaily = dailyIn(wk.days);
const wkCount = wkEvents.length + wkRegs.reduce((n, x) => n + x.dates.length, 0);
const mk = today.slice(0, 7), tmLabel = monthLabel(mk);
const monthEnd = addDays(`${addDays(`${mk}-28`, 4).slice(0, 7)}-01`, -1);
const monthDays = daysBetween(today, monthEnd);
const tmEvents = upcoming.filter((e) => e.start.slice(0, 7) <= mk);
const tmRegs = regularDates(monthDays), tmDaily = dailyIn(monthDays);
const nextMk = addDays(monthEnd, 1).slice(0, 7);
const nmEvents = upcoming.filter((e) => e.start.slice(0, 7) === nextMk);
// トップの入口: 縦書きの札(2026-11-16 運営者が案Aを選び、地図の札も足した)。
// 札の左の小さな添え書きは、今週末・今月とも日付の期間(今月は今日から月末まで。2026-11-16 運営者の依頼)。毎日の更新で変わる。
// 縦書きの中の数字は、横に倒さず1文字分に収める(.tcy)
const tcy = (s) => String(s).replace(/\d+/g, (n) => `<span class="tcy">${n}</span>`);
const dayRange = (a, b) => tcy(a === b ? `${+a.slice(8, 10)}日` : `${+a.slice(8, 10)}日〜${+b.slice(8, 10)}日`);
const fudaLinks = [
  ["/weekend.html", "今週末の神楽", dayRange(wk.start, wk.end)],
  ["/this-month.html", "今月の神楽", dayRange(today, monthEnd)],
  // 名前が長い(2026-11-16 運営者の依頼で「日付・会場・キーワードから探す」に統一)ので、2行に分け、添え書きは付けない(名前で何ができるかが分かる)
  ["/calendar.html", "日付・会場・<br>キーワードから探す", ""],
  ["/map.html", "地図で探す", "近くの会場"],
  // 種類の札は PC だけ(2026-11-16 運営者の依頼)。スマホは4枚で幅がいっぱいなので出さない(.pc-only)
  ["/kagura/", "種類で探す", "流派・系統", "pc-only"],
].map(([href, label, note, cls]) => `<a href="${href}"${cls ? ` class="${cls}"` : ""}><b>${label}</b>${note ? `<small>${note}</small>` : ""}</a>`).join("");

rmSync(OUT, { recursive: true, force: true });

// クライアント用の軽量データ (地図・日付と場所の検索)
const lite = events.map((e) => { const { id, name, kagura, prefecture, city, venue, description, start, end, sessions, lat, lng, fee, timeUnknown } = e; return { id, name, kagura, prefecture, city, venue, description, reservation: reservationLabel(e), start, end, sessions, lat, lng, fee, timeUnknown, up: isUpcoming(e) }; });
write("dist/events.json", JSON.stringify(lite));
// badge: カードの日付の段に出す一文字(毎・土など。休演中は「休演中」)。地図の「現在地から近い開催」のカードで使う
write("dist/regular.json", JSON.stringify(regular.map((r) => { const { id, name, kagura, prefecture, city, venue, schedule, lat, lng } = r; return { id, name, kagura, prefecture, city, venue, schedule, lat, lng, badge: regPause(r) ? "休演中" : r.badge || "毎" }; })));

const PREF_ORDER = REGIONS.flatMap(([, ps]) => ps);
const byPref = (a, b) => PREF_ORDER.indexOf(a) - PREF_ORDER.indexOf(b);
const prefs = [...new Set([...upcoming, ...regular].map((e) => e.prefecture))].sort(byPref);
const kaguraPref = (k) => [...events, ...regular].find((e) => e.kagura === k)?.prefecture ?? "";
// 神楽の種類の「本拠の県」: 解説の冒頭(tagline の「岩手県南・宮城県北 ・ …」の地域の部分)に書いた最初の県。解説がなければ、掲載中の開催の県。
// 東京での公演だけが載っている東北の神楽(南部神楽・番楽)を、関東の神楽として並べないために使う(種類の並び順と、種類の一覧の地方分け)
const kaguraHome = (k) => { const area = (kaguraInfo[k]?.tagline ?? "").split(" ・ ")[0]; return PREF_ORDER.find((p) => area.includes(p)) ?? kaguraPref(k); };
const kaguraCount = (k) => [...upcoming, ...regular].filter((e) => e.kagura === k).length;
const kaguras = [...new Set([...events, ...regular].map((e) => e.kagura).filter(Boolean))]
  .sort((a, b) => byPref(kaguraHome(a), kaguraHome(b)) || kaguraCount(b) - kaguraCount(a) || a.localeCompare(b, "ja"));

// ---------- トップ ----------
// 「開催予定」: 直近2か月(開催のある月)だけをカードで出し、その先は月ごとのボタンにする(件数が増えても長くならない)
const HOME_MONTHS = 2, HOME_CAP = 8; // 最初に出すのは8件まで。残りは「すべて見る」で
const homeMonths = months.slice(0, HOME_MONTHS), laterMonths = months.slice(HOME_MONTHS);
const monthShort = (k) => (k.slice(0, 4) === nowJst.slice(0, 4) ? `${+k.slice(5, 7)}月` : monthLabel(k));
const regionsUsed = REGIONS.map(([r]) => r).filter((r) => upcoming.some((e) => regionOf(e.prefecture) === r));
const prefsUsed = [...new Set(upcoming.map((e) => e.prefecture))].sort(byPref);
// 先の月のボタンの件数: 地方ごと・県ごと(絞り込んだときに、その数に変える)
const regionCounts = (list) => JSON.stringify(Object.fromEntries([...regionsUsed, ...prefsUsed].map((k) => [k, list.filter((e) => regionOf(e.prefecture) === k || e.prefecture === k).length])));
// 直近2か月の開催のうち、HOME_CAP 件を超える分は隠す(「すべて見る」か、地方・県で絞ったときに出す)
const homeAll = homeMonths.flatMap((k) => monthMap.get(k));
// 一覧の途中の帯(2026-11-15 運営者の依頼「スマホ版は今週末・今月の一覧と同じように」): 見えている開催の5件ごとに、何本目かで中身を分けた帯(横長)をはさむ。
// 地方・県で絞ったり「すべて見る」を押したりすると見えている開催が変わるので、ブラウザ(home.js)が帯を置き直す。使わない帯は #home-pr-pool に隠しておく。
// 両サイドのPR枠が出る画面(幅 1280px 以上)では出さない。協賛のマス(lead)は、絞り込みで前の5件が変わるので入れない
const homeStrips = Array.from({ length: inlistCount(homeAll.length, STRIP_EVERY) }, (_, k) => inlistStrip("/", k, { land: true })).map((h, k) => (h ? `<div class="home-pr" data-k="${k}">${h}</div>` : ""));
const homeShown = Math.min(HOME_CAP, homeAll.length);
let homeIdx = 0;
const homeList = homeMonths.map((k) => {
  const list = monthMap.get(k);
  const rows = list.map((e) => { const i = homeIdx++, ov = i >= HOME_CAP; const after = !ov && (i + 1) % STRIP_EVERY === 0 && i + 1 < homeShown ? homeStrips[(i + 1) / STRIP_EVERY - 1] ?? "" : ""; return `<div data-r="${regionOf(e.prefecture)}" data-p="${esc(e.prefecture)}"${ov ? ' class="ov" hidden' : ""}>${card(e, "h4")}</div>${after}`; });
  const allHidden = rows.every((r) => r.includes(' class="ov" hidden'));
  return `<div class="mgroup"${allHidden ? " hidden" : ""}><h3 class="mhead">${monthShort(k)}</h3>${rows.join("")}</div>`;
}).join("");
const showAll = homeAll.length > HOME_CAP ? `<p class="more"><a class="btn ghost sm" id="showall" href="/calendar.html">直近の開催をすべて見る(${homeAll.length}件)</a></p>` : "";
// 県のボタン: 地方を選んだとき、その地方に開催のある県が2つ以上あれば出す
const prefButtons = regionsUsed.length ? `<div class="regions prefs" role="group" aria-label="都道府県で絞り込む" hidden><button type="button" data-p="" aria-pressed="true">すべての県</button>${prefsUsed.map((p) => `<button type="button" data-p="${esc(p)}" data-in="${regionOf(p)}" aria-pressed="false" hidden>${esc(p)}</button>`).join("")}</div>` : "";
const laterLinks = laterMonths.length ? `<div class="laterwrap"><h3 class="mhead">この先の開催</h3><div class="taglist later">${laterMonths.map((k) => { const l = monthMap.get(k); return `<a class="tag" href="/month/${k}.html" data-n="${l.length}" data-c="${esc(regionCounts(l))}">${monthShort(k)} <span>${l.length}件</span></a>`; }).join("")}</div></div>` : "";
const regionButtons = regionsUsed.length > 1 ? `<div class="regions" role="group" aria-label="地方で絞り込む" hidden><button type="button" data-r="" aria-pressed="true">全国</button>${regionsUsed.map((r) => `<button type="button" data-r="${r}" aria-pressed="false">${r}</button>`).join("")}</div>` : "";
// 見出しは、1文字ずつ、読む順に(上から)現れる。--i が、何文字目か(motion.css の遅延になる)
let heroCh = 0;
const HERO_H1 = [["神話を受け継ぐ", "舞を、"], ["この目で。"]].map((line) => line.map((t) => `<span class="ph">${[...t].map((c) => `<span class="ch" style="--i:${heroCh++}">${c}</span>`).join("")}</span>`).join("")).join("<br>");
write("dist/index.html", layout({
  // 検索結果で選ばれやすく: 「神楽 日程」「神楽 今週末」で探す人に、何ができるかが一目で分かる題と説明にする
  title: `全国の神楽の日程・今週末の公演 | ${cfg.siteName}`,
  desc: clip(`今週末、どこで神楽が観られる？${[...new Set([...["石見神楽", "高千穂神楽", "広島神楽", "備中神楽"].filter((k) => kaguras.includes(k)), ...kaguras])].slice(0, 3).join("・")}など、全国の神楽の日程と会場を、日付・会場・キーワードや地図で探せます。掲載しているのは、公式情報で確かめた開催だけです。`),
  path: "/", active: "/", alts: [["en", "/en/"]],
  // サイト名: 検索結果に、ドメイン名ではなく「神楽めぐり」と出すための情報(トップページの WebSite)
  ld: [{ "@context": "https://schema.org", "@type": "WebSite", name: cfg.siteName, alternateName: ["かぐらめぐり", "Kagura Meguri"], url: `${cfg.baseUrl}/`, inLanguage: "ja", description: cfg.description, publisher: ORG_LD },
    itemListLd("開催予定の神楽", upcoming.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })))].filter(Boolean),
  // オープニング(最初の訪問だけ、ロゴが現れて消える)。main の外に置く(main は出現の動きで translate するため、fixed の基準が main になってしまう)
  splash: `<div class="splash" aria-hidden="true"><img src="/symbol.png" width="96" height="96" alt=""><b>${esc(cfg.siteName)}</b></div>`,
  body: `<section class="home-discovery" aria-label="神楽の公演を探す">
<p class="discovery-title">全国の神楽、公演日程を探す</p>
<nav class="quick fuda" aria-label="公演を探す">${fudaLinks}</nav>
</section>
<section class="hero home-hero">
<picture class="hero-art"><source media="(max-width: 640px)" srcset="/hero-sp.webp" width="1122" height="1402"><img src="/hero-pc.webp" width="1774" height="887" alt="夜の神楽殿で、鬼の面をつけた舞い手が御幣を掲げて舞う水彩画" fetchpriority="high" decoding="async"></picture>${sparksHtml}
<div class="copy"><h1>${HERO_H1}</h1></div>
<div class="vert" aria-hidden="true">笛と太鼓、夜の社に舞う</div><a class="scroll-cue" href="#upcoming"><span>開催予定へ</span><i aria-hidden="true"></i></a></section>
<h2 id="upcoming">開催予定</h2>
${regionButtons}${prefButtons}
${adSlot(cfg.adsense.slotList)}
<div id="list">${homeList || empty('いま掲載している開催情報はありません。掲載のご依頼は<a href="/organizers.html">主催者の方へ</a>から送れます。')}</div>${homeStrips.some(Boolean) ? `<div id="home-pr-pool" data-every="${STRIP_EVERY}" hidden>${homeStrips.filter((h, k) => h && (k + 1) * STRIP_EVERY >= homeShown).join("")}</div>` : ""}
${showAll}
<p class="empty" id="none" hidden>この地域の${laterMonths.length ? "、近いうちの開催はありません。この先の開催は、下の月から探せます" : "開催予定は、いまのところありません"}。</p>
${laterLinks}
<section class="planning-section" aria-labelledby="home-planning-h"><p class="planning-eyebrow">気になる公演が見つかったら</p><h2 id="home-planning-h">神楽へ出かける準備をしよう</h2>${planningLinks({},today)}</section>
${regular.length ? `<h2>毎週・毎晩の定期公演</h2><div class="reglist">${regular.map((r) => regCard(r)).join("")}</div>${regular.length > 3 ? `<p class="more" hidden><button type="button" class="btn ghost sm" id="regmore">定期公演をすべて見る(${regular.length}件)</button></p>` : ""}` : ""}
${prStripFor("/")}
${prefs.length ? `<h2>都道府県で探す</h2><div class="taglist">${prefs.map((p) => `<a class="tag" href="${prefHref(p)}">${esc(p)}</a>`).join("")}</div>` : ""}
${kaguras.length ? `<h2>種類で探す</h2><div class="taglist">${kaguras.map((k) => kaguraTag(k)).join("")}</div>` : ""}
${clientJs("home")}`,
}));

// PLAN-004: 回答はブラウザ内のみ。おすすめは神楽の種類(出典つきの解説ページ)と、その種類の公演。演目の上演は約束しない。
const quizTraditions = traditions.map(t => {
  const info = kaguraInfo[t.kind];
  if(!info?.source) throw new Error(`quiz: 出典のない種類 ${t.kind}`);
  const evidence = t.evidence.map(([feature,path]) => {
    const text = evidenceText(info,path);
    if(!features[feature] || !text) throw new Error(`quiz: 根拠不足 ${t.kind}/${path}`);
    return {feature,weight:evidenceWeight(path),text};
  });
  if(!info.tagline) throw new Error(`quiz: 紹介の一言(tagline)がない ${t.kind}`);
  return {kind:t.kind,href:kaguras.includes(t.kind)?kaguraHref(t.kind):'',source:info.source,tagline:info.tagline,viewing:(info.viewing??[]).slice(0,2),evidence};
});
const quizKindNames = new Set(traditions.map(t=>t.kind));
const quizEvents = upcoming.filter(e=>quizKindNames.has(e.kagura)).map(e=>({id:e.id,name:e.name,start:e.start,end:e.end,timeUnknown:e.timeUnknown,sessions:e.sessions,when:whenOf(e),prefecture:e.prefecture,place:[e.prefecture,e.city].filter(Boolean).join(' '),kind:e.kagura}));
// next: 次の公演日(近い順)、nominal: 曜日の決まりどおりなら次に公演がある日。ブラウザが、見ている日から休演中かを決める(regularStatus と同じ考え方)
const quizRegular = regular.filter(r=>quizKindNames.has(r.kagura)).map(r=>({id:r.id,name:r.name,schedule:r.schedule,prefecture:r.prefecture,until:r.until,kind:r.kagura,next:regularNextDates(r,today,{limit:12}),nominal:regularNominalDate(r,today),pauseDays:PAUSE_DAYS}));
const quizData = JSON.stringify({questions,features,url:`${cfg.baseUrl}/quiz.html`,traditions:quizTraditions,regions:REGIONS,events:quizEvents,regular:quizRegular}).replace(/</g,'\\u003c');
// 画面のプログラムは別ファイル(ページを軽くする)。中身が変わったら ?v= も変わり、古いキャッシュを使わない
const quizJs = lf(readFileSync('scripts/client/quiz.js','utf8')).replace('/* quizEngine */',quizEngine.toString());
const quizJsVersion = createHash('sha256').update(quizJs).digest('hex').slice(0,10);
write('dist/quiz-app.js',quizJs);
write('dist/quiz.html',layout({
  title:`あなたに近い神楽はどれ？${questions.length}問の好み診断 | ${cfg.siteName}`,
  desc:padDesc(`${questions.length}問に答えると、舞のテンポ・面や衣装・物語・祭りの空気などの好みから、${traditions.length}種類の神楽のうち好みに近いものを、出典つきの理由と一緒にご案内します。地域と日程を選べば、観に行ける公演も探せます。登録不要で、回答はブラウザ内だけで計算します。`),
  path:'/quiz.html',active:'/quiz.html',ld:crumbsLd([['ホーム','/'],['神楽の好み診断']]),
  body:`${crumbNav([['ホーム','/'],['神楽の好み診断']])}${hero('あなたに近い神楽はどれ？',`${questions.length}問・1分ほどで、${traditions.length}種類の神楽から好みに近いものを探します。`)}
<p class="lead">好み${questions.filter(q=>q.type==='preference').length}問と、観に行く地域・日程${questions.filter(q=>q.type!=='preference').length}問です。分からない問いは「まだ分からない」で進めます。登録は不要です。回答は保存も送信もしません。</p>
<section id="quiz" aria-label="${questions.length}問の神楽好み診断"><button type="button" class="btn" id="quiz-start" hidden>${questions.length}問の診断をはじめる</button>
<noscript><p>診断にはJavaScriptが必要です。<a href="/calendar.html">公演を探す</a>・<a href="/guide.html">はじめての神楽ガイド</a>もご利用ください。</p></noscript>
<form id="quiz-form" hidden><p id="quiz-progress" aria-live="polite"></p><fieldset id="quiz-field"></fieldset><p id="quiz-error" role="alert"></p><div class="quiz-actions"><button type="button" class="btn ghost" id="quiz-back">前へ戻る</button><button type="submit" class="btn" id="quiz-next">次へ</button></div></form>
<section id="quiz-result" aria-label="おすすめの結果" hidden></section></section>
<section class="quiz-about" aria-labelledby="quiz-about-title"><h2 id="quiz-about-title">診断のしくみ</h2>
<p>結果には、好みと重なった特徴と、そのもとになった解説の文を出します。点数や一致率は出しません。地域と日程は、観に行ける公演を探すためだけに使います。</p>
<h3>診断の対象(${traditions.length}種類)</h3><div class="taglist">${traditions.map(t=>kaguras.includes(t.kind)?`<a class="tag" href="${kaguraHref(t.kind)}">${esc(t.kind)}</a>`:`<span class="tag">${esc(t.kind)}</span>`).join('')}</div>
<p class="meta">解説のない神楽は、まだ診断の対象に入っていません。すべての神楽の公演は<a href="/calendar.html">公演カレンダー</a>から探せます。</p></section>
<script id="quiz-data" type="application/json">${quizData}</script><script defer src="/quiz-app.js?v=${quizJsVersion}"></script>`
}));

// ---------- 地図 (Leaflet + 国土地理院の淡色地図) ----------
// 会場の一覧: 会場ごとにまとめ、その下に、開催(日付つき)と定期公演を並べる。会場の並びは、北の県から
const venueList = () => {
  const groups = new Map();
  for (const x of [...upcoming, ...regular]) {
    const k = `${x.prefecture}|${x.city ?? ""}|${x.venue ?? ""}`;
    if (!groups.has(k)) groups.set(k, { pref: x.prefecture, city: x.city ?? "", venue: x.venue ?? "", items: [] });
    groups.get(k).items.push(x);
  }
  const list = [...groups.values()].sort((a, b) => byPref(a.pref, b.pref) || a.city.localeCompare(b.city, "ja"));
  if (!list.length) return "";
  // 公演は1件ずつカード(日付・公演名・会場だけ。日付・会場・キーワードから探すの結果と同じ形。2026-11-16 運営者の依頼)。定期公演の日付の段は、ほかの一覧の定期公演のカードと同じ
  const item = (x) => {
    const date = x.start
      ? (() => { const p = parts(x.start); return `<small>${p.mo}月</small><b>${p.d}</b><small>${WD[p.wd]}曜</small>`; })()
      : `<small>定期</small><b>${regPause(x) ? "休演中" : esc(x.badge || "毎")}</b>`;
    return `<li class="card${x.start ? "" : " reg"}"><div class="date">${date}</div><div><h3><a href="/${x.start ? "events" : "regular"}/${x.id}.html">${namePh(x.name)}</a></h3><div class="meta event-facts"><div><span class="k">会場:</span><span>${x.venue ? esc(x.venue) : '<span class="tbd">未確認</span>'}</span></div></div></div></li>`;
  };
  // 県ごとに折りたたむ(長い一覧を、開いた県だけ見せる)。会場名のボタン(地図をその場所へ動かす)は、カードの上にそのまま置く
  const prefsIn = [...new Set(list.map((g) => g.pref))];
  const venue = (g) => `<li><button type="button" class="vjump" data-k="${esc(`${g.pref}|${g.city}|${g.venue}`)}" disabled>${esc(g.venue || g.city)}</button><span class="meta"> ${esc(g.pref)}${esc(g.city)}</span><ol class="fcards vitems">${g.items.map(item).join("")}</ol></li>`;
  return `<h2>会場の一覧</h2><p class="meta">会場名を押すと、地図がその場所へ移動します。</p>${prefsIn.map((p) => { const gs = list.filter((g) => g.pref === p); return `<details class="rgroup"><summary>${esc(p)} <span class="meta">${gs.length}会場</span></summary><ul class="venuelist">${gs.map(venue).join("")}</ul></details>`; }).join("")}`;
};
write("dist/map.html", layout({
  title: `神楽の開催地マップ | 会場を地図で探す | ${cfg.siteName}`,
  desc: fillDesc(`これから開催される神楽と、毎晩・毎週の定期公演の会場を地図で探せます。${[...new Set([...upcoming, ...regular].map((e) => e.prefecture))].slice(0, 5).join("・")}など、${upcoming.length + regular.length}件の会場を掲載しています。`, ["地図の印から、各公演の日時・会場と公式情報を確かめられます。", "旅先の近くで開かれる神楽を探すときにも便利です。"]),
  path: "/map.html", active: "/map.html",
  head: LEAFLET,
  ld: [crumbsLd([["ホーム", "/"], ["地図で探す"]]), itemListLd("神楽の開催会場", [...upcoming.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })), ...regular.map((r) => ({ href: `/regular/${r.id}.html`, name: r.name }))])].filter(Boolean),
  body: `${crumbNav([["ホーム", "/"], ["地図で探す"]])}${hero("地図で探す", "これから開催される神楽と、定期公演の会場を地図で探せます。現在地から近い順にも探せます。")}
<div class="nearbar"><button type="button" class="btn" id="nearme" hidden>現在地から近くの開催を探す</button></div>
<p class="meta" id="nearmsg" aria-live="polite"></p>
<div class="mapbox"><div id="map" role="region" aria-label="開催場所の地図"></div><button type="button" class="maplock" id="maplock" aria-pressed="false" hidden>地図を動かす</button></div>
<p class="legend meta"><span><span class="pin ev"></span>日付のある開催</span><span><span class="pin reg"></span>定期公演</span><span><span class="pin mix"></span>両方</span><span>数字は、同じ場所での件数です。</span></p>
<p class="meta" id="mapmsg" aria-live="polite"></p>
<p class="meta">地図: <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院(淡色地図)</a></p>
<section id="nearlist" class="nearbox" aria-labelledby="near-h" hidden></section>${adSlot(cfg.adsense.slotList)}
${venueList()}
${prStripFor("/map.html")}
${clientJs("map")}`,
}));

// ---------- 日付・会場・キーワードから探す(/calendar.html。URL は前のカレンダーのまま) ----------
// 「いつ」(今週末・今月・来月・日付の範囲)と「どこ」(地方 → 都道府県)で、開催予定を絞り込む。条件は URL に残す(共有・戻るで同じ結果)
// 地方・都道府県の選択肢: 開催のある県([県, 終わった開催だけか])。終わった開催だけの県(data-past)は、「終了した開催も含める」のときだけ選べる
// (2026-11-18 運営者の指摘「終了した開催にチェックしても、長崎県が出てこない」。以前は開催予定のある県だけだった)
const finderPrefs = REGIONS.map(([r, ps]) => [r, ps.filter((p) => events.some((e) => e.prefecture === p)).map((p) => [p, !upcoming.some((e) => e.prefecture === p)])]).filter(([, ps]) => ps.length);
// 検索の結果の途中にはさむ帯(スクリプトの中に文字として持つ。「<」は、スクリプトの終わりと見まちがえられないように書き換える)。
// 帯の形は、1〜4本目(公演の掲載・宿・協賛のご案内・体験と行き方)と、5本目からの形(先頭のバナーをずらした数だけ)を持つ。先頭のマス(@LEAD@: 直前の5件に当てはまる協賛)と帯の番号(@N@)は、ブラウザで検索の結果から入れる(inlist-pr.mjs の inlistLead を、そのままスクリプトに入れる)
const jsVal = (v) => JSON.stringify(v).replace(/</g, "\\u003c");
const finderBannerN = rakutenOn ? stripIdsFor("/calendar.html").filter((id) => !RAIL_BANNERS.find((b) => b.id === id)?.vc).length : 0;
// 帯には1個だけ出すので、形ごとに「先頭のマスを入れる形(l)」と「バナーだけの形(b。先頭のマスがないとき)」を持つ
const finderStrips = jsVal(Array.from({ length: INLIST_THEMES.length + finderBannerN }, (_, k) => ({ l: inlistStrip("/calendar.html", k, { lead: ["@LEAD@"], tag: "list@N@", land: true }), b: inlistStrip("/calendar.html", k, { tag: "list@N@", land: true }) })));
// 契約中の協賛が当てはまる開催だけ(開催のID → 協賛のマス)。協賛がなければ空
const finderSponsors = jsVal(Object.fromEntries(upcoming.map((e) => [e.id, listSponsorTile(sponsorsNow, "event", e, { esc })]).filter(([, h]) => h)));
const finderLead = `var LO={sponsorTile:function(x){return SP[x.id]||''}},SP=${finderSponsors};
${inlistLead}`;
write("dist/calendar.html", layout({
  title: `日付・会場・キーワードから神楽を探す | 開催日程の検索 | ${cfg.siteName}`,
  desc: clip(`全国の神楽の開催予定を、公演名・会場・市町村・出演団体のキーワードと、日付・地域で絞り込めます。今週末・今月の開催もすぐに探せます。公式情報をもとに日程を掲載しています。`),
  path: "/calendar.html", active: "/calendar.html", alts: [["en", "/en/calendar.html"]], ld: crumbsLd([["ホーム", "/"], ["日付・会場・キーワードから探す"]]),
  body: `${crumbNav([["ホーム", "/"], ["日付・会場・キーワードから探す"]])}${hero("日付・会場・キーワードから探す", "公演名や会場のキーワード、日付・地域を組み合わせて探せます。")}
<form class="finder" id="finder" role="search" aria-label="開催を探す" hidden>
<div class="ftabs" role="tablist" aria-label="探し方"><button type="button" role="tab" id="tab-dp" aria-controls="panel-dp" aria-selected="true">日付・地域で探す</button><button type="button" role="tab" id="tab-kw" aria-controls="panel-kw" aria-selected="false" tabindex="-1">キーワードで探す</button></div>
<div class="fpanel" role="tabpanel" id="panel-dp" aria-labelledby="tab-dp">
<fieldset><legend>いつ</legend><div class="regions" role="group" aria-label="期間"><button type="button" data-w="all" aria-pressed="true">すべて</button><button type="button" data-w="weekend" aria-pressed="false">今週末</button><button type="button" data-w="month" aria-pressed="false">今月</button><button type="button" data-w="next" aria-pressed="false">来月</button><button type="button" data-w="range" aria-pressed="false">日付を指定</button></div>
<div class="range" id="range" hidden><label><input type="date" id="from" aria-label="いつから"> から</label><label><input type="date" id="to" aria-label="いつまで"> まで</label></div></fieldset>
<fieldset><legend>どこ</legend><div class="where"><label for="region" class="sr">地方</label><select id="region"><option value="">全国</option>${finderPrefs.map(([r, ps]) => `<option value="${r}"${ps.every(([, past]) => past) ? ' data-past="1"' : ""}>${r}</option>`).join("")}</select>
<label for="pref" class="sr">都道府県</label><select id="pref"><option value="">すべての都道府県</option>${finderPrefs.map(([r, ps]) => ps.map(([p, past]) => `<option value="${p}" data-r="${r}"${past ? ' data-past="1"' : ""}>${p}</option>`).join("")).join("")}</select></div></fieldset>
</div>
<div class="fpanel keyword" role="tabpanel" id="panel-kw" aria-labelledby="tab-kw" hidden><label for="keyword">キーワード</label><input type="search" id="keyword" name="q" maxlength="100" placeholder="公演名・会場・市町村・神楽団名" aria-describedby="keyword-help"><p class="meta" id="keyword-help">スペースで区切ると、複数の言葉で絞り込めます。</p></div>
<p class="fpast"><label><input type="checkbox" id="past"> 終了した開催も含める</label></p>
<p class="freset" hidden><button type="button" class="linkbtn" id="reset">条件をリセット</button></p>
</form>
<p class="count" id="count" aria-live="polite"></p>
<div class="results" id="results" aria-label="当てはまる開催"></div>
<div id="weekend-empty" hidden><p><a class="btn" href="/weekend.html">今週末の定期公演の案内も見る</a></p><p class="meta">定期公演は、別の一覧にまとめています。公演日は、主催者の最新案内でご確認ください。</p></div>
<p class="meta">毎晩・毎週の定期公演は、<a href="/weekend.html">今週末の神楽</a>・<a href="/this-month.html">今月の神楽</a>のページにまとめています。</p>
${adSlot(cfg.adsense.slotList)}
${prStripFor("/calendar.html")}${months.length ? `<h2>月ごとの一覧</h2>${monthLinks()}` : ""}
<p><a class="btn ghost gcal" href="${GCAL_SUBSCRIBE}" target="_blank" rel="noopener">すべての開催をGoogleカレンダーに追加</a></p>
<p class="meta">新しい開催も自動で反映されます。</p>
<script>
(function(){
var f=document.getElementById('finder'),out=document.getElementById('results'),cnt=document.getElementById('count');
var rg=document.getElementById('region'),pf=document.getElementById('pref'),fr=document.getElementById('from'),to=document.getElementById('to'),rangeBox=document.getElementById('range'),rs=document.getElementById('reset');
var kw=document.getElementById('keyword'),pastBox=document.getElementById('past');
function normalize(v){return String(v||'').normalize('NFKC').toLowerCase().trim()}
var list=[],loaded=false,failed=false,when='all',tab='dp',regionOf={};
var strips=${finderStrips},EVERY=${STRIP_EVERY};
var THEMES=${INLIST_THEMES.length};
var tabs=[].slice.call(f.querySelectorAll('[role=tab]'));
function setTab(v,focus){tab=v;tabs.forEach(function(t){var on=t.id==='tab-'+v;t.setAttribute('aria-selected',String(on));t.tabIndex=on?0:-1;document.getElementById(t.getAttribute('aria-controls')).hidden=!on;if(on&&focus)t.focus()})}
[].forEach.call(pf.options,function(o){if(o.value)regionOf[o.value]=o.dataset.r});
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var p2=function(n){return String(n).padStart(2,'0')};
var ymd=function(d){return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())};
var WD=['日','月','火','水','木','金','土'];
${finderLead}
f.hidden=false;
// 期間: [はじめ, おわり](日付の文字列。空は「制限なし」)。今週末は、土曜と日曜(日曜に見たときは、その日だけ)
function span(){
  var t=new Date();t.setHours(0,0,0,0);var w=t.getDay();
  if(when==='weekend'){if(w===0)return[ymd(t),ymd(t)];var s=new Date(t);s.setDate(t.getDate()+(6-w));var e=new Date(s);e.setDate(s.getDate()+1);return[ymd(w===6?t:s),ymd(e)]}
  if(when==='month')return[ymd(t),ymd(new Date(t.getFullYear(),t.getMonth()+1,0))];
  if(when==='next')return[ymd(new Date(t.getFullYear(),t.getMonth()+1,1)),ymd(new Date(t.getFullYear(),t.getMonth()+2,0))];
  if(when==='range')return[fr.value||'',to.value||''];
  return['',''];
}
// 地方を選ぶと、都道府県の選択肢を、その地方だけにする。終わった開催だけの地方・県(data-past)は、「終了した開催も含める」のときだけ選べる
function syncPrefs(){
  var p=pastBox.checked;
  [].forEach.call(rg.options,function(o){if(o.value)o.hidden=o.disabled=!!o.dataset.past&&!p});
  if(rg.value&&rg.options[rg.selectedIndex].disabled)rg.value='';
  [].forEach.call(pf.options,function(o){if(o.value)o.hidden=o.disabled=(!!rg.value&&o.dataset.r!==rg.value)||(!!o.dataset.past&&!p)});
  if(pf.value&&(pf.options[pf.selectedIndex].disabled||regionOf[pf.value]!==rg.value&&rg.value))pf.value='';
}
function draw(){
  var sp=span(),a=sp[0],b=sp[1],words=normalize(kw.value).split(/\\s+/).filter(Boolean),withPast=pastBox.checked;
  // 終了した開催は「終了した開催も含める」のときだけ(2026-11-18 運営者の依頼)。これからの開催の後ろに、新しい順で分けて出す
  var all=list.filter(function(x){
    if(!x.up&&!withPast)return false;
    var s=x.start.slice(0,10),e=(x.end||x.start).slice(0,10);
    if(tab==='kw'){var text=normalize([x.name,x.kagura,x.prefecture,x.city,x.venue,x.description].join(' '));return words.every(function(w){return text.indexOf(w)>=0})}
    if(a&&e<a)return false;if(b&&s>b)return false;
    if(pf.value)return x.prefecture===pf.value;
    if(rg.value)return regionOf[x.prefecture]===rg.value;
    return true;
  });
  var hit=all.filter(function(x){return x.up}),done=all.filter(function(x){return !x.up}).reverse();
  // 月ごとに折りたたむ(最初の月だけ開く)
  var groups=[],byM={};hit.forEach(function(x){var m=x.start.slice(0,7);if(!byM[m]){byM[m]=[];groups.push(m)}byM[m].push(x)});
  // 帯の番号は、月をまたいで通して数える(都道府県のページ・トップと同じ。月ごとに1本目に戻ると、同じ「公演を掲載しませんか」が何度も出る。2026-11-15 の監査)
  var K=0,TOT=groups.reduce(function(n,m){return n+Math.max(0,Math.floor((byM[m].length-1)/EVERY))},0);
  out.innerHTML=groups.map(function(m,i){return '<details class="rgroup"'+(i?'':' open')+'><summary>'+(+m.slice(0,4))+'年'+(+m.slice(5,7))+'月 <span class="meta">'+byM[m].length+'件</span></summary><ol class="fcards">'+rows(byM[m])+'</ol></details>'}).join('')
    +(done.length?'<details class="rgroup rpast"'+(groups.length?'':' open')+'><summary>終了した開催 <span class="meta">'+done.length+'件</span></summary><ol class="fcards">'+done.map(row).join('')+'</ol></details>':'');
  // 5件ごとに、帯をはさむ(その月に、まだ続きがあるときだけ)
  // 帯の先頭には、その帯の直前の5件に合わせた宿・協賛を入れる。帯の番号(list1・list2…)は、クリックの名前に入る
  function rows(xs){var o='',tot=TOT;xs.forEach(function(x,i){o+=row(x);if(strips.length&&(i+1)%EVERY===0&&i+1<xs.length){var k=K++,its=xs.slice(i+1-EVERY,i+1).map(function(y){return{prefecture:y.prefecture,city:y.city,day:y.start.slice(0,10),id:y.id}}),h=inlistLead(its,k,tot,LO)[0]||'',s=strips[k<THEMES?k:THEMES+(k-THEMES)%Math.max(1,strips.length-THEMES)],v=s?(h?s.l:s.b):'';if(v)o+='<li class="pr-li">'+v.replace(/@N@/g,String(k+1)).replace('@LEAD@',function(){return h})+'</li>'}});return o}
  // 1件ずつカード(2026-11-15 運営者の依頼): 日付・公演名・会場だけ。日付の段は、ほかの一覧のカードと同じ形
  function row(x){var d=new Date(+x.start.slice(0,4),+x.start.slice(5,7)-1,+x.start.slice(8,10));
    return '<li class="card'+(x.up?'':' past')+'"><div class="date"><small>'+(d.getMonth()+1)+'月</small><b>'+d.getDate()+'</b><small>'+WD[d.getDay()]+'曜</small></div><div><h3><a href="/events/'+esc(x.id)+'.html">'+esc(x.name)+'</a></h3><div class="meta event-facts"><div><span class="k">会場:</span><span>'+(x.venue?esc(x.venue):'<span class="tbd">未確認</span>')+'</span></div></div>'+(x.up?'':'<p class="meta past-note">'+(+x.start.slice(0,4))+'年の開催(終了)</p>')+'</div></li>'}
  cnt.textContent=failed?'開催情報を読み込めませんでした。時間をおいて再読み込みしてください。':!loaded?'読み込んでいます…':withPast&&all.length?'これからの開催 '+hit.length+'件・終了した開催 '+done.length+'件':hit.length?'当てはまる開催 '+hit.length+'件':'条件に合う日付付きの公演情報は、現在掲載されていません。キーワードを短くするか、期間・地域を広げて探してみてください。'+(withPast?'':'終わった開催は「終了した開催も含める」で探せます。');
  document.getElementById('weekend-empty').hidden=!(loaded&&!failed&&!all.length&&tab==='dp'&&when==='weekend');
  var q=new URLSearchParams();if(tab==='kw'){if(kw.value.trim())q.set('q',kw.value.trim())}else{if(when!=='all')q.set('when',when);if(when==='range'){if(fr.value)q.set('from',fr.value);if(to.value)q.set('to',to.value)}if(rg.value)q.set('region',rg.value);if(pf.value)q.set('pref',pf.value)}
  if(withPast)q.set('past','1');
  var s=q.toString();try{history.replaceState(null,'',location.pathname+(s?'?'+s:''))}catch(e){}
  rs.parentNode.hidden=!s;
}
function setWhen(v){when=v;[].forEach.call(f.querySelectorAll('[data-w]'),function(b){b.setAttribute('aria-pressed',String(b.dataset.w===v))});rangeBox.hidden=v!=='range'}
f.addEventListener('click',function(ev){var t=ev.target.closest('[role=tab]');if(t){setTab(t.id.slice(4));draw();if(tab==='kw')kw.focus();return}var b=ev.target.closest('[data-w]');if(!b)return;setWhen(b.dataset.w);draw();if(when==='range'&&!fr.value){fr.focus();try{fr.showPicker()}catch(e){}}});
rs.addEventListener('click',function(){setWhen('all');rg.value='';pf.value='';fr.value='';to.value='';kw.value='';pastBox.checked=false;syncPrefs();draw();(tab==='kw'?kw:f.querySelector('[data-w=all]')).focus()});
f.querySelector('[role=tablist]').addEventListener('keydown',function(ev){if(ev.key!=='ArrowLeft'&&ev.key!=='ArrowRight')return;ev.preventDefault();setTab(tab==='dp'?'kw':'dp',true);draw()});
kw.addEventListener('input',function(ev){if(!ev.isComposing)draw()});
kw.addEventListener('compositionend',draw);
rg.addEventListener('change',function(){syncPrefs();draw()});
pf.addEventListener('change',function(){if(pf.value)rg.value=regionOf[pf.value];syncPrefs();draw()});
fr.addEventListener('change',function(){if(to.value&&fr.value&&to.value<fr.value)to.value=fr.value;draw()});
to.addEventListener('change',function(){if(fr.value&&to.value&&fr.value>to.value)fr.value=to.value;draw()});
f.addEventListener('submit',function(ev){ev.preventDefault();draw()});
pastBox.addEventListener('change',function(){syncPrefs();draw()});
// URL の条件を戻す(共有されたリンク・戻る)
var u=new URLSearchParams(location.search),okDate=function(v){return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v||'')};
kw.value=(u.get('q')||'').slice(0,100);if(kw.value)setTab('kw');
if(['weekend','month','next','range'].indexOf(u.get('when'))>=0)setWhen(u.get('when'));
if(okDate(u.get('from')))fr.value=u.get('from');if(okDate(u.get('to')))to.value=u.get('to');
if(u.get('region')&&[].some.call(rg.options,function(o){return o.value&&o.value===u.get('region')}))rg.value=u.get('region');
if(regionOf[u.get('pref')]){pf.value=u.get('pref');rg.value=regionOf[pf.value]}
if(u.get('past')==='1')pastBox.checked=true;
syncPrefs();draw();
fetch('/events.json').then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(l){list=l.sort(function(a,b){return a.start<b.start?-1:a.start>b.start?1:0});loaded=true;draw()}).catch(function(){failed=true;draw()});
})();
</script>`,
}));

// ---------- 神楽の種類 一覧 + 個別 ----------
write("dist/kagura/index.html", layout({
  title: `神楽の種類一覧 | 流派・系統ごとに探す | ${cfg.siteName}`,
  // 説明文: 「神楽 種類」「神楽 種類 一覧」で探す人に、先に「一覧」と数を答える。例に挙げるのは、これからの開催・定期公演の多い神楽(以前は並びの先頭=北の神楽で、知られた名前が出なかった。SEO-20261124-4)
  desc: fillDesc(`神楽の種類一覧。${[...kaguras].sort((a, b) => [...upcoming, ...regular].filter((x) => x.kagura === b).length - [...upcoming, ...regular].filter((x) => x.kagura === a).length).slice(0, 4).join("・")}など${kaguras.length}種類の特徴と、開催日程・定期公演を探せます。`, ["地方ごとに、北から南へ並べています。", "公式情報をもとに、出典と確認日をつけて掲載しています。"]),
  path: "/kagura/", active: "/kagura/", alts: [["en", "/en/kagura.html"]],
  ld: crumbsLd([["ホーム", "/"], ["種類で探す"]]),
  // 地方ごとの見出しで区切る(北から南へ。並び順はこれまでと同じ)。「どこの神楽か」を見出しで拾えるようにし、先頭に地方への近道を置く
  body: `${crumbNav([["ホーム", "/"], ["種類で探す"]])}${hero("種類で探す", "流派や系統ごとに、開催情報を探せます。")}${(() => {
    const kcard = (k) => `<div class="card"><div><h3><a href="${kaguraHref(k)}">${esc(k)}</a></h3>${kaguraInfo[k]?.tagline ? `<p class="tagline">${esc(kaguraInfo[k].tagline)}</p>` : ""}<div class="meta">${countLine(upcoming.filter((e) => e.kagura === k).length, regular.filter((r) => r.kagura === k).length)}</div></div></div>`;
    const groups = [...REGIONS.map(([r]) => [r, kaguras.filter((k) => regionOf(kaguraHome(k)) === r)]), ["そのほか", kaguras.filter((k) => !REGIONS.some(([r]) => regionOf(kaguraHome(k)) === r))]].filter(([, ks]) => ks.length);
    if (!groups.length) return empty("掲載中の神楽の種類は、まだありません。");
    const jump = groups.length > 1 ? `<nav class="kagura-regions chiprow" aria-label="地方へ移動"><span class="meta">地方から探す</span>${groups.map(([r], i) => `<a class="chip" href="#kagura-region-${i + 1}">${esc(r)}</a>`).join("")}</nav>` : "";
    return jump + groups.map(([r, ks], i) => `<section class="kagura-region" aria-labelledby="kagura-region-${i + 1}"><h2 id="kagura-region-${i + 1}">${esc(r)}の神楽</h2><div class="cardgrid">${ks.map(kcard).join("")}</div></section>`).join("");
  })()}${prStripFor("/kagura/")}${adSlot(cfg.adsense.slotList)}`,
}));
// タイトルに入れる年(「◯◯神楽 2026」のような検索に合わせる)。これからの開催の年の範囲。なければ今年
const yearsOf = (list) => { const ys = [...new Set(list.map((e) => e.start.slice(0, 4)))].sort(); const y = ys.length ? ys : [nowJst.slice(0, 4)]; return y.length > 1 ? `${y[0]}〜${y[y.length - 1]}年` : `${y[0]}年`; };
// 開催の月の範囲(「2026年11月〜2027年1月」。同じ月だけなら「2026年12月」と1回だけ書く)
const monthSpan = (list) => { if (!list.length) return ""; const ks = list.map((e) => ym(e.start)).sort(), a = ks[0], b = ks[ks.length - 1]; return a === b ? monthLabel(a) : `${monthLabel(a)}〜${monthLabel(b)}`; };
// 市区町村の名前から、郡の部分を除く(「北設楽郡東栄町」→「東栄町」)
const townOf = (city = "") => city.replace(/^.+?郡/, "");
// 「11月13日 小林」のように、日付と、名前のかっこ内の地区名(町名は除く)を並べる
const districtOf = (e, town) => (e.name.match(/[(（]([^()（）]+)[)）]$/)?.[1] ?? "").replace(town, "").trim();
// 毎年決まった奉納日(鷲宮催馬楽神楽など。SEO-20261117-2): 冒頭の「〇〇とは」の中に、日と祭礼の表。
// 掲載中の開催(match の語を名前に含む、いちばん近いもの)があれば、その日付と開催ページへのリンクを添える。公式で確かめた日だけを data/kagura-info.json の fixedDays に書く
const fixedDayEvent = (it, list) => (it.match ? list.find((e) => e.name.includes(it.match)) : undefined);
const fixedDaysHtml = (info, list) => {
  const d = info?.fixedDays;
  if (!d?.items?.length) return "";
  const rows = d.items.map((it) => {
    const ev = fixedDayEvent(it, list);
    return `<tr><th scope="row">${esc(it.date)}</th><td><b>${esc(it.name)}</b>${it.note ? `<span class="fd-note">${esc(it.note)}</span>` : ""}${ev ? `<a class="textlink fd-next" href="/events/${esc(ev.id)}.html">${cl(`${dayLabel(ev.start.slice(0, 10))}の開催を見る`)}</a>` : ""}</td></tr>`;
  }).join("");
  const src = d.source?.url ? `<p class="meta">出典: <a href="${esc(d.source.url)}" target="_blank" rel="noopener">${esc(d.source.name)}</a>${d.checked ? `(${esc(jpDate(d.checked))}確認)` : ""}</p>` : "";
  return `<section class="fixed-days" aria-labelledby="k-days"><h3 id="k-days">${esc(d.heading)}</h3><table class="info fd-table">${rows}</table>${d.note ? `<p class="fd-lead">${cl(d.note)}</p>` : ""}${src}</section>`;
};
// 説明文の {next}: 掲載中のいちばん近い奉納日(「次は12月1日(火)の大酉祭。」)。なければ消す
const fixedNextText = (info, list) => {
  const ev = list[0], it = ev && info?.fixedDays?.items?.find((x) => fixedDayEvent(x, [ev]));
  return ev && it ? `次は${mdw(ev.start.slice(0, 10))}の${it.name}。` : "";
};
// 来年の日付だけ年を付ける(「11月27日(金)」「2027年1月2日(土)」)
const dayShort = (d) => dayLabel(d, d.slice(0, 4) !== today.slice(0, 4));
const startTime = (e) => (e.timeUnknown ? "" : `${e.start.slice(11, 16)}〜`);
// 説明文の {upcoming}: 掲載中のいちばん近い開催(同じ名前・会場で続く日は、まとめて書く)。なければ消す(SEO-20261123-2)
// 例: 「次に観られるのは11月27日(金)・11月28日(土)18:00〜、厚木市の神奈川工科大学厚木市子ども科学館。」
const upcomingText = (list) => {
  const ev = list[0];
  if (!ev) return "";
  const same = list.filter((e) => e.name === ev.name && e.venue === ev.venue).slice(0, 3);
  const place = [townOf(ev.city ?? ""), (ev.venue ?? "").replace(/[(（].*$/, "")].filter(Boolean).join("の");
  return `次に観られるのは${same.map((e) => mdw(e.start.slice(0, 10))).join("・")}${same.every((e) => startTime(e) === startTime(ev)) ? startTime(ev) : ""}${place ? `、${place}` : ""}。`;
};
// 説明文の {counts}: 「開催予定19件・定期公演5件」(SEO-20261123-3)
const countsText = (list, reg) => [list.length ? `開催予定${list.length}件` : "", reg.length ? `定期公演${reg.length}件` : ""].filter(Boolean).join("・");
// 「次に観られる公演」(seo.nextBox): 冒頭の「〇〇とは」の段の中に、近い開催を3件まで。日時・名前(開催ページへ)・会場(SEO-20261123-2)
const nextShowsHtml = (list) => {
  const xs = list.slice(0, 3);
  if (!xs.length) return "";
  return `<section class="next-shows" aria-labelledby="k-next"><h3 id="k-next">次に観られる公演</h3><ul>${xs.map((e) => `<li><b>${nobr(esc(dayShort(e.start.slice(0, 10))))}${startTime(e) ? ` ${esc(startTime(e))}` : ""}</b><a href="/events/${esc(e.id)}.html">${esc(e.name)}</a><span class="ns-where">${esc([e.venue, e.city].filter(Boolean).join("・"))}</span></li>`).join("")}</ul>${list.length > xs.length ? `<p class="meta">ほかの${list.length - xs.length}件は、下の「開催予定」に載せています。</p>` : ""}</section>`;
};
// 「毎晩の公演と予約」(seo.regularBox): 冒頭の「〇〇とは」の段の中に、定期公演の曜日・時刻・料金と、予約の流れへの近道(SEO-20261124-3)。
// 「高千穂神楽 予約」で種類のページに来た人を、予約の答えのある定期公演のページへ渡す
const regularBoxHtml = (reg) => {
  if (!reg.length) return "";
  const head = reg.length === 1 && reg[0].badge ? `${reg[0].badge}の公演と予約` : "定期公演と予約";
  return `<section class="next-shows reg-box" aria-labelledby="k-reg"><h3 id="k-reg">${esc(head)}</h3><ul>${reg.map((r) => `<li><b>${esc(regPause(r) || r.schedule)}</b><a href="/regular/${esc(r.id)}.html">${esc(r.name)}</a>${r.fee ? `<span class="ns-where">${esc(r.fee)}</span>` : ""}${r.bookingFlow ? `<a class="textlink" href="/regular/${esc(r.id)}.html#booking-flow-h">予約と当日の流れを見る</a>` : ""}</li>`).join("")}</ul></section>`;
};
// 月ごとの日程の表(seo.monthTable): 冒頭の「〇〇とは」の段の中に、これからの開催を月ごとに1行、その下に定期公演の曜日・時刻(SEO-20261123-3)
const monthTableHtml = (k, list, reg) => {
  if (!list.length && !reg.length) return "";
  const dayOf = (e) => { const d = e.start.slice(0, 10); return `${+d.slice(8, 10)}日(${WD[new Date(d + "T00:00:00Z").getUTCDay()]})`; };
  const rows = [...new Set(list.map((e) => ym(e.start)))].map((key) => `<tr><th scope="row">${esc(monthLabel(key))}</th><td><ul class="ms-list">${list.filter((e) => ym(e.start) === key).map((e) => `<li><span class="ms-day">${esc(dayOf(e))}${startTime(e) ? ` ${esc(startTime(e))}` : ""}</span><a href="/events/${esc(e.id)}.html">${esc(e.name)}</a><span class="ms-where">${esc(townOf(e.city ?? ""))}</span></li>`).join("")}</ul></td></tr>`).join("");
  const regRows = reg.map((r) => `<tr><th scope="row"><a href="/regular/${esc(r.id)}.html">${esc(r.name)}</a></th><td>${esc(regPause(r) || r.schedule)}<span class="ms-where">${esc(townOf(r.city ?? ""))}</span></td></tr>`).join("");
  return `<section class="month-schedule" aria-labelledby="k-months">${list.length ? `<h3 id="k-months">${esc(k)}スケジュール(${esc(monthSpan(list))})</h3><div class="tablewrap"><table class="info ms-table">${rows}</table></div>` : ""}${reg.length ? `<h3${list.length ? "" : ' id="k-months"'}>毎週・毎月の定期公演</h3><div class="tablewrap"><table class="info ms-table ms-reg">${regRows}</table></div>` : ""}<p class="meta">掲載している分の日程です。演目・出演や、中止・変更は、各ページの公式情報で確かめてください。</p></section>`;
};
// 県のページを作る県(これまでの開催も含めて、1件でも載せたことのある県)
const prefPageSet = new Set([...events, ...regular].map((e) => e.prefecture));
for (const k of kaguras) {
  const list = upcoming.filter((e) => e.kagura === k), reg = regular.filter((r) => r.kagura === k);
  const first = [...events, ...regular].find((e) => e.kagura === k);
  // 宿・ふるさと納税の県: これからの開催の県 → 定期公演の県 → その神楽の地元の県(kaguraHome)。
  // 以前は「最初に見つかった記録(終了した開催を含む)」の県で、南部神楽・番楽が「東京都の宿」になっていた(2026-11-15 の監査)
  const homePref = list[0]?.prefecture ?? reg[0]?.prefecture ?? kaguraHome(k) ?? first.prefecture;
  const info = kaguraInfo[k], seo = info?.seo ?? {};
  // この神楽を観られる(観られた)県のページ(ほかの探し方の先頭)。これからの開催・定期公演・これまでの開催の県と、地元の県。
  // 種類と県のページを互いにつなぐ(SEO-20261124-2。以前は種類 → 県のリンクが無く、秋田・長崎・静岡の県のページは一覧からしか辿れなかった)
  const kindPrefs = [...new Set([...list, ...reg, ...events.filter((e) => e.kagura === k), { prefecture: kaguraHome(k) }].map((x) => x.prefecture))].filter((p) => prefPageSet.has(p)).sort(byPref);

  // 開催予定がないとき: 次の日程の案内・近くの開催・これまでの開催
  const none = list.length + reg.length === 0;
  const past = pastRecords(events.filter((e) => e.kagura === k));
  const when = list.length ? `${monthSpan(list)}の開催${list.length}件` : "";
  // 町ごとに分けて見せる神楽(花祭など)。開催のある町だけを、題・説明・見出しに出す(開催のない町の名前で、検索の人を呼ばない)
  const townGroups = (seo.towns ?? []).map((t) => [t, list.filter((e) => townOf(e.city) === t)]).filter(([, xs]) => xs.length);
  const grouped = townGroups.length && townGroups.reduce((n, [, xs]) => n + xs.length, 0) === list.length;
  const townLead = grouped ? townGroups.map(([t, xs]) => `${t}: ${xs.map((e) => `${+e.start.slice(5, 7)}/${+e.start.slice(8, 10)}${districtOf(e, t) ? " " + districtOf(e, t) : ""}`).join("、")}`).join("。") + "。" : "";
  // 日程の一覧は別のページ(県のページ)が受け持つ神楽: 説明を先に、日程へのリンクを目立たせる(同じ検索語で2ページが競らないように)
  const hub = seo.scheduleHub && [...events, ...regular].some((e) => e.prefecture === seo.scheduleHub) ? seo.scheduleHub : "";
  const title = seo.title ? seo.title.replace("{years}", yearsOf(list).replace(/年$/, "")).replace("{towns}", townGroups.map(([t]) => t).join("・") || first.city) : `${k}の日程【${yearsOf(list)}】公演・開催情報`;
  // 一覧の途中の帯(スマホなど、両サイドのPR枠が出ない画面だけ。都道府県のページと同じく、開催予定と定期公演を通して5件ごと。2026-11-15 の監査)
  const kOrder = grouped ? townGroups.flatMap(([, xs]) => xs) : list;
  const kAfter = stripAfter([...kOrder.map((e) => listItem(e, e.start.slice(0, 10), "event")), ...reg.map((r) => listItem(r, today, "regular"))], "/kagura/", {});
  // 「神楽の町を応援する」(ふるさと納税)は、都道府県のページと同じく、一覧の途中の最初の月の変わり目(町ごとに分ける神楽は、最初の町のあと)。
  // 月が1つだけなら開催予定の一覧の後、開催予定がなく定期公演だけならその一覧の後(2026-11-15 運営者の依頼「各神楽のページも県のページと同じ並びに」)
  const kFurusato = list.length + reg.length ? furusatoBlock(moreOffers, { prefecture: homePref, towns: [...list, ...reg].map((x) => x.city) }, today, "kagura_furusato") : "";
  const kBoundary = grouped ? (townGroups.length > 1 ? townGroups[0][1].length - 1 : -1) : list.findIndex((e, i) => i + 1 < list.length && list[i + 1].start.slice(0, 7) !== e.start.slice(0, 7));
  const kFurusatoAt = kBoundary >= 0 ? kBoundary : list.length ? list.length - 1 : list.length + reg.length - 1;
  const kAt = (i) => kAfter(i) + (i === kFurusatoAt ? kFurusato : "");
  const listHtml = grouped
    ? townGroups.map(([t, xs]) => `<section class="town-group" aria-labelledby="town-${esc(t)}"><h3 id="town-${esc(t)}">${esc(t)}の${esc(k)}</h3>${xs.map((e) => card(e, "h4", true, false) + kAt(kOrder.indexOf(e))).join("")}</section>`).join("")
    : list.length ? cardsByMonth(list, false, kAt) : "";
  // 日程の一覧は県のページが受け持つ神楽(広島神楽): 開催予定の欄の先頭に、県のスケジュールへの入口
  const hubHtml = hub ? `<section class="schedule-hub" aria-label="公演スケジュール"><p>${esc(hub)}の神楽の公演は、月別のスケジュールで探せます。会場・料金・予約の要否もまとめています。</p><a class="btn" href="${prefHref(hub)}">${esc(hub.replace(/県$/, ""))}神楽スケジュールを見る</a></section>` : "";
  // 冒頭の要約: 「〇〇とは」と概要(3行ほど)。その下に折り畳みの5つの欄(kaguraFolds)
  // 英語版のページ(訳があるとき)。日本語のページと hreflang で対にし、冒頭の要約の下に小さく案内する
  const enPath = kaguraInfoEn[k] ? enStylePath(k) : null;
  const enLink = enPath ? `<p class="en-link"><a href="${enPath}" hreflang="en" lang="en">In English: ${esc(KAGURA_EN.find((x) => x.key === k).name)}</a></p>` : "";
  const summaryHtml = `<section class="about kagura-summary" aria-labelledby="k-about"><h2 id="k-about">${esc(k)}とは</h2>${info?.intro ? `<p>${cl(info.intro)}</p>${info.source ? `<p class="meta">出典: ${esc(info.source)}</p>` : ""}` : NO_INFO}${fixedDaysHtml(info, list)}${seo.nextBox ? nextShowsHtml(list) : ""}${seo.regularBox ? regularBoxHtml(reg) : ""}${seo.monthTable ? monthTableHtml(k, list, reg) : ""}${enLink}</section>`;
  const scheduleHtml = `${hubHtml}${k === "庄内神楽" && !none ? upcomingSummary(list, { formatWhen: whenOf, level: "h3" }) : ""}${listHtml}${reg.length ? `${list.length ? `<p class="mhead">毎週・毎晩の定期公演</p>` : ""}${reg.map((r, j) => regCard(r, { withTag: false }) + kAt(kOrder.length + j)).join("")}` : ""}${none ? pendingBlock({ label: k, past, near: nearbyUpcoming([...new Set(past.map((e) => e.prefecture).concat(first.prefecture))]), pastId: "k-past", withKagura: false, h: "h3" }) : pastMore(past, { withKagura: false })}`;
  write(`dist/kagura/${k}.html`, layout({
    title: `${title} | ${cfg.siteName}`,
    desc: fillDesc(seo.desc?.replace("{next}", fixedNextText(info, list)).replace("{upcoming}", upcomingText(list)).replace("{counts}", countsText(list, reg)).replace("{years}", yearsOf(list).replace(/年$/, "")) ?? (none && past.length ? `${k}の日程。現在の開催予定はありません。直近では${jpDate(past[0].start.slice(0, 10))}に${past[0].name}が開かれました。${info ? info.intro : ""}` : k === "庄内神楽" ? `${k}の日程。${upcomingSummaryDescription(list, { formatWhen: whenOf })}` : grouped ? `${k}${seo.title?.match(/^[^(（]+([(（][^)）]+[)）])/)?.[1] ?? ""}の日程。${townLead}会場・料金をまとめています。${info ? info.intro : ""}` : `${k}の公演日程・会場・料金をまとめています。${when ? when + (reg.length ? "、" : "。") : ""}${reg.length ? "定期公演" + reg.length + "件。" : ""}${info ? info.intro : ""}`), [placesOf([...list, ...reg], true) && `主な開催地は${placesOf([...list, ...reg], true)}です。`, "日時・会場・料金と、公式情報へのリンクを載せています。", info && `${k}の特徴や見どころも紹介しています。`]),
    path: kaguraHref(k), active: "/kagura/", noindex: !kaguraIndexed(k), alts: enPath ? [["en", enPath]] : [],
    ld: [crumbsLd([["ホーム", "/"], ["種類で探す", "/kagura/"], [k]]), itemListLd(`${k}の開催情報`, [...list.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })), ...reg.map((r) => ({ href: `/regular/${r.id}.html`, name: r.name }))])].filter(Boolean),
    body: `${crumbNav([["ホーム", "/"], ["種類で探す", "/kagura/"], [k]])}${hero(esc(k), countLine(list.length, reg.length))}
${info?.tagline ? `<p class="lead kagura-lead">${cl(info.tagline)}</p>` : ""}${sponsorFor("kagura", { kagura: k, places: [...list, ...reg] })}
${summaryHtml}
${affiliateBlock({ prefecture: homePref, city: "", kagura: k }, { overnight: events.filter((x) => x.kagura === k) })}${expBlock(homePref)}${adSlot(cfg.adsense.slotList)}
${kaguraFolds(k, info, scheduleHtml)}${prStripFor("/kagura/")}
${learnBlock(moreOffers, { kagura: k }, today, "kagura_learn")}
${otherWays("", { lead: kindPrefs.map((p) => [prefHref(p), `${esc(p)}の神楽`]) })}`,
  }));
}

// ---------- 都道府県ページ ----------
for (const p of prefPageSet) {
  const list = events.filter((e) => e.prefecture === p && isUpcoming(e)), reg = regular.filter((r) => r.prefecture === p);
  const kinds = [...new Set([...list, ...reg].map((x) => x.kagura).filter(Boolean))];
  const none = list.length + reg.length === 0;
  const past = pastRecords(events.filter((e) => e.prefecture === p));
  // 広島県: 開催月へのリンクと月別見出しで公演を探しやすくする。
  const isHiroshima = p === "広島県";
  // 広島県の冒頭: 公演はすぐ下の月別のカードで見せる(同じ公演を箇条書きで重ねない)。掲載範囲の注意と、定期公演への近道だけ
  const upcomingIntro = isHiroshima ? `<section class="pref-upcoming" aria-label="掲載の範囲と定期公演"><p>掲載分の日程です。県内のすべての公演ではありません。${reg.length ? '<a href="#hiroshima-regular">定期公演の曜日・受付方法を見る</a>' : ''}</p></section>` : '';
  // 「開催月から探す」の目次と「観覧前に確認」の案内は、2026-11-15 運営者の依頼で削除した(月別の見出しのまとまりは残す)
  const monthKeys = [...new Set(list.map((e) => e.start.slice(0, 7)))];
  // 一覧の途中の帯(スマホなど、両サイドのPR枠が出ない画面だけ。2026-11-15 運営者の依頼「ほかのページに合わせて」)。開催予定と定期公演を通して5件ごと
  const stripAt = stripAfter([...list.map((e) => listItem(e, e.start.slice(0, 10), "event")), ...reg.map((r) => listItem(r, today, "regular"))], "/pref/", {});
  // 「神楽の町を応援する」(ふるさと納税)は、一覧の途中の最初の月の変わり目に置く(2026-11-15 運営者の依頼「一覧の途中(月をまたぐ間)に」)。
  // 月が1つだけなら、開催予定の一覧のすぐ後(定期公演の前)。開催予定がなく定期公演だけなら、その一覧の後
  const furusato = list.length + reg.length ? furusatoBlock(moreOffers, { prefecture: p, towns: [...list, ...reg].map((x) => x.city) }, today, "pref_furusato") : "";
  const boundary = list.findIndex((e, i) => i + 1 < list.length && list[i + 1].start.slice(0, 7) !== e.start.slice(0, 7));
  const furusatoAt = boundary >= 0 ? boundary : list.length ? list.length - 1 : list.length + reg.length - 1;
  const after = (i) => stripAt(i) + (i === furusatoAt ? furusato : "");
  const scheduleHtml = isHiroshima && list.length
    ? monthKeys.map((key) => `<section class="pref-month" aria-labelledby="hiroshima-${key}"><h2 id="hiroshima-${key}">${esc(monthLabel(key))}の開催予定</h2><p class="meta"><a class="textlink" href="/month/${key}.html">${esc(monthLabel(key))}の全国日程を見る</a></p>${list.filter((e) => e.start.startsWith(key)).map((e) => { const i = list.indexOf(e); return card(e, "h3", true) + stripAt(i); }).join("")}</section>${list[furusatoAt]?.start.startsWith(key) ? furusato : ""}`).join("")
    : list.length ? `<h2>開催予定</h2>${cardsByMonth(list, true, after)}` : "";
  const stayHtml = isHiroshima
    ? `<div id="hiroshima-stay" class="pref-stay">${affiliateBlock({ prefecture: p, city: "", kagura: "神楽" }, { overnight: list })}</div>${expBlock(p)}`
    : affiliateBlock({ prefecture: p, city: "", kagura: "神楽" }, { overnight: list }) + expBlock(p);
  // 広島県の説明文の先頭: 今月・来月の開催の件数と、無料の公演の件数(「広島神楽スケジュール」「神楽 広島 無料」で探す人に、最初に答える)
  const thisKey = nowJst.slice(0, 7), nextKey = new Date(Date.UTC(+thisKey.slice(0, 4), +thisKey.slice(5, 7), 1)).toISOString().slice(0, 7);
  const monthCount = (key) => `${+key.slice(5, 7)}月${list.filter((e) => e.start.startsWith(key)).length}件`;
  const freeCount = list.filter((e) => /無料/.test(e.fee ?? "")).length;
  write(`dist/pref/${p}.html`, layout({
    title: isHiroshima ? `広島神楽スケジュール${yearsOf(list).replace(/年$/, "")}｜${p}の神楽 日程・会場一覧 | ${cfg.siteName}` : `${p}の神楽 日程【${yearsOf(list)}】開催・会場一覧 | ${cfg.siteName}`,
    desc: isHiroshima && list.length ? clip(`広島神楽スケジュール。${monthCount(thisKey).replace("月", "月の開催")}・${monthCount(nextKey)}など、月別スケジュールで掲載${freeCount || reg.length ? `(${[freeCount ? `無料の公演${freeCount}件` : "", reg.length ? `定期公演${reg.length}件` : ""].filter(Boolean).join("、")})` : ""}。会場・料金・予約要否は確認できた情報を掲載。県内すべての公演ではありません。公式情報をご確認ください。`) : none ? clip(`${p}の神楽の日程と会場をまとめています。現在の開催予定はありません。${past.length ? `これまでの開催(${[...new Set(past.map((e) => e.kagura).filter(Boolean))].slice(0, 3).join("、") || past[0].name}など${past.length}件)も載せています。` : ""}公式情報をもとに、出典と確認日をつけて掲載しています。`) : fillDesc(`${p}で開催される神楽の日程と会場をまとめています。${list.length ? "開催予定" + list.length + "件" : ""}${reg.length ? (list.length ? "、" : "") + "定期公演" + reg.length + "件" : ""}。${kinds.length ? kinds.join("、") + "などを紹介します。" : ""}公式情報をもとに、出典と確認日をつけて掲載しています。`, [placesOf([...list, ...reg]) && `主な開催地は${placesOf([...list, ...reg])}です。`, prefLeads[p] && `${p}の神楽の特徴も紹介しています。`, "開催月ごとに、日時・会場・料金を確かめられます。"]),
    path: prefHref(p), noindex: !prefIndexed(p),
    ld: [crumbsLd([["ホーム", "/"], [`${p}の神楽`]]), itemListLd(`${p}の神楽`, [...list.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })), ...reg.map((r) => ({ href: `/regular/${r.id}.html`, name: r.name }))])].filter(Boolean),
    body: `${crumbNav([["ホーム", "/"], [`${p}の神楽`]])}${hero(`${esc(p)}の神楽`, countLine(list.length, reg.length))}
${prefLead(p, kinds)}${sponsorFor("pref", { prefecture: p })}
${upcomingIntro}${stayHtml}${adSlot(cfg.adsense.slotList)}${scheduleHtml}${reg.length ? `<h2${isHiroshima ? ' id="hiroshima-regular"' : ''}>毎週・毎晩の定期公演</h2>${reg.map((r, j) => regCard(r) + after(list.length + j)).join("")}` : ""}${none ? pendingBlock({ label: p, past, near: nearbyUpcoming([p]), pastId: "pref-past" }) : pastMore(past)}${prStripFor("/pref/", { skip: ["experiences"] })}
${otherWays()}`,
  }));
}

// ---------- 詳細ページ(日付のある開催) ----------
// iCalendar(RFC 5545): UID/DTSTAMP 必須、CRLF 改行、文字のエスケープ、時間未定は終日扱い
const ie = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const ymd = (s) => s.slice(0, 10).replace(/-/g, "");
const dt = (s) => `${ymd(s)}T${s.slice(11, 13)}${s.slice(14, 16)}00`;
const nextDay = (s) => new Date(asMs(s.slice(0, 10) + "T00:00") + 864e5).toISOString().slice(0, 10).replace(/-/g, "");
const veventLines = (e) => [
  "BEGIN:VEVENT", `UID:${e.id}@${cfg.domain || "kagura"}`, `DTSTAMP:${nowJst.slice(0, 10).replace(/-/g, "")}T000000Z`,
  `SUMMARY:${ie(e.name + calendarNotice(e).suffix)}`,
  ...(calendarNotice(e).text ? [`DESCRIPTION:${ie(calendarNotice(e).text)}`] : []),
  ...(e.timeUnknown ? [`DTSTART;VALUE=DATE:${ymd(e.start)}`, `DTEND;VALUE=DATE:${nextDay(e.end || e.start)}`]
    : [`DTSTART;TZID=Asia/Tokyo:${dt(e.start)}`, `DTEND;TZID=Asia/Tokyo:${dt(e.end || new Date(asMs(e.start) + 2 * 3600e3).toISOString().slice(0, 16))}`]),
  `LOCATION:${ie(`${e.venue ?? ""} ${e.prefecture}${e.city ?? ""}`.trim())}`,
  `URL:${cfg.baseUrl}/events/${e.id}.html`,
  "END:VEVENT",
];
// Googleカレンダーの予定作成画面を、この開催の内容を入れた状態で開くリンク(日時・終日の扱いは、ICS と同じ)
const gcalEvent = (e) => {
  const dates = e.timeUnknown ? `${ymd(e.start)}/${nextDay(e.end || e.start)}` : `${dt(e.start)}/${dt(e.end || new Date(asMs(e.start) + 2 * 3600e3).toISOString().slice(0, 16))}`;
  const details = [calendarNotice(e).text, `${cfg.siteName}: ${cfg.baseUrl}/events/${e.id}.html`, e.url ? `公式情報: ${e.url}` : "", "※ 日時や会場は変わることがあります。出かける前に公式情報をご確認ください。"].filter(Boolean).join("\n");
  const location = `${e.venue ?? ""} ${e.prefecture}${e.city ?? ""}${e.address ?? ""}`.trim();
  return `https://calendar.google.com/calendar/render?${new URLSearchParams({ action: "TEMPLATE", text: e.name + calendarNotice(e).suffix, dates, ctz: "Asia/Tokyo", location, details })}`;
};
const vcal = (list) => ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${cfg.siteName}//JA`, "CALSCALE:GREGORIAN", `X-WR-CALNAME:${ie(cfg.siteName)}`, "X-WR-TIMEZONE:Asia/Tokyo", ...list.flatMap(veventLines), "END:VCALENDAR"].join("\r\n") + "\r\n";
// 共有: LINE で送る・リンクをコピー(押したときだけ、外部へ移動する。コピーはこのページの中だけで動く)
const shareBlock = (path, title) => { const url = `${cfg.baseUrl}${path}`; return `<p class="share"><span class="meta">共有</span><a class="btn ghost sm" href="https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}" target="_blank" rel="noopener" data-goatcounter-click="share-line">LINEで送る</a><button type="button" class="btn ghost sm" data-copy="${esc(url)}">リンクをコピー</button></p>${clientJs("share")}`; };
// 開催までの日数(毎日のビルドで更新される)。当日・翌日は言葉で、それ以降は「あと◯日」
const daysUntil = (ymd) => Math.round((Date.parse(`${ymd}T00:00Z`) - Date.parse(`${nowJst.slice(0, 10)}T00:00Z`)) / 864e5);
const untilBadge = (e) => {
  if (!isUpcoming(e)) return "";
  const d = daysUntil(e.start.slice(0, 10));
  return `<span class="until${d <= 7 ? " soon" : ""}">${d <= 0 ? "本日開催" : d === 1 ? "明日開催" : `開催まで あと${d}日`}</span>`;
};
// 右の列にあった、日時・会場と「公式情報を見る」の枠(要点の表が隠れると出る)は、やめた(2026-11-15 運営者の依頼)
// 開催ページ・定期公演ページの並び(共通): 要点(日時・会場・料金) → 説明 → 公式情報のボタン → この開催のポイント・ほかの日程(ここまでが d-top。スマホでは広告の列より先) → 宿・周辺体験・(PR枠の出ない画面だけ)車で行くなら(d-side) → 出典 → あわせて観たい神楽 → ほかの探し方 → 広告
// あわせて観たい神楽: 同じ種類の開催予定を先に、同じ県の開催予定を後に(開催・定期公演のどちらのページでも使う)
const related = (e) => {
  const uniq = (arr) => arr.filter((x, i) => arr.findIndex((y) => seriesKey(y) === seriesKey(x)) === i && seriesKey(x) !== seriesKey(e) && editionKey(x) !== editionKey(e));
  const same = uniq(upcoming.filter((x) => x.id !== e.id && x.kagura && x.kagura === e.kagura)).slice(0, 4);
  const near = uniq(upcoming.filter((x) => x.id !== e.id && x.prefecture === e.prefecture && !same.includes(x))).slice(0, 4);
  const seen = new Set([seriesKey(e)]);
  const list = [...same, ...near].filter((x) => !seen.has(seriesKey(x)) && seen.add(seriesKey(x))).sort((a, b) => a.start.localeCompare(b.start));
  return list.length ? `<h2>あわせて観たい神楽</h2><ol class="monthlist">${list.map((x) => `<li><span class="md">${esc(mdw(x.start.slice(0, 10)).replace(/\((.)\)$/, ""))}<small>(${WD[parts(x.start).wd]})</small></span><span><a href="/events/${x.id}.html">${esc(x.name)}</a><span class="meta">${sepList([x.kagura ? esc(x.kagura) : "", `${esc(x.prefecture)}${esc(x.city ?? "")}`])}</span></span></li>`).join("")}</ol>` : "";
};
// 終わった開催のページの冒頭: 終了したこと・次の回(あれば、そのページへ)・同じ種類と県の日程への入口
// 次の回がもう終わっていれば、その次へたどり、これからの回を案内する(なければ、いちばん新しい回)
const shownNext = (e) => { let n = pastOf.get(e.id)?.next ?? null; while (n && !isUpcoming(n) && pastOf.get(n.id)?.next) n = pastOf.get(n.id).next; return n; };
const endedNote = (e) => {
  const n = shownNext(e), sd = e.start.slice(0, 10), ed = (e.end || e.start).slice(0, 10);
  const held = `${dayLabel(sd)}${ed !== sd ? `〜${dayLabel(ed, ed.slice(0, 4) !== sd.slice(0, 4))}` : ""}`;
  const nextHtml = n
    ? (isUpcoming(n)
      ? `<p class="ended-next">次の回は <strong>${nobr(esc(dayLabel(n.start.slice(0, 10))))}</strong> です。</p><p class="actions"><a class="btn" href="/events/${n.id}.html" data-goatcounter-click="ended-next">次の回のページを見る</a></p>`
      : `<p class="ended-next">その後の回(${nobr(esc(dayLabel(n.start.slice(0, 10))))})も終了しました。<a href="/events/${n.id}.html">いちばん新しい回のページ</a>に、確かめた情報をまとめています。</p>`)
    : "";
  const links = [e.kagura ? `<a href="${kaguraHref(e.kagura)}">${esc(e.kagura)}の日程</a>` : "", `<a href="${prefHref(e.prefecture)}">${esc(e.prefecture)}の神楽の日程</a>`].filter(Boolean);
  // 文(2026-11-18 運営者の依頼で直した): 「終了しました」「開かれました」の重なりをまとめ、要点が当時の情報だと具体的に書く。一文ずつ段落を分ける。
  // 次の回がまだ載っていないときは、載るかどうか分からないので、次の回のことは書かない
  return `<section class="ended-note" aria-label="開催の終了"><p><strong>${nobr(esc(held))}に開かれ、終了しました。</strong></p><p>下記の日時や料金などは、そのときの情報です。</p>${nextHtml}<p class="meta">ほかの開催は、${links.join("や")}から探せます。</p></section>`;
};
for (const e of events) {
  const JST = "+09:00";
  const ld = {
    "@context": "https://schema.org", "@type": "Event", name: e.name,
    startDate: e.timeUnknown ? e.start.slice(0, 10) : e.start + JST,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", eventStatus: "https://schema.org/EventScheduled",
    location: { "@type": "Place", name: e.venue || `${e.prefecture}${e.city}`, address: { "@type": "PostalAddress", addressRegion: e.prefecture, addressLocality: e.city, ...(e.address ? { streetAddress: e.address } : {}), addressCountry: "JP" } },
    url: `${cfg.baseUrl}/events/${e.id}.html`,
  };
  if (e.end) ld.endDate = e.timeUnknown ? e.end.slice(0, 10) : e.end + JST;
  ld.image = [ogUrl(false)];
  if (e.description) ld.description = e.description;
  Object.assign(ld, eventFeeSchema(e.fee)); // 残席・券種別価格・販売URLは未確認。料金原文は本文に維持。
  if (e.lat != null) ld.location.geo = { "@type": "GeoCoordinates", latitude: e.lat, longitude: e.lng };
  const when = whenOf(e);
  const others = sameSeries(e).filter(isUpcoming);
  // 説明と「公式情報を見る」: 要点(日時・会場・料金)の枠の上に出す(2026-11-14 運営者の依頼)。
  // PC では右の列より上の段(d-lead)に置き、要点の枠と右の列の宿の枠の上端をそろえる。終了した開催は右の列がないので、終了のお知らせのあとに置く
  const lead = `<div class="desc-lead">${descParas(shownDesc(e, e.timeUnknown || !e.venue || !e.fee || reservationLabel(e) === "要確認"))}</div>
${e.url ? `<p class="actions"><a class="btn" data-official-link href="${esc(e.url)}" rel="noopener" target="_blank">公式情報を見る</a></p>` : ""}
`;
  write(`dist/events/${e.id}.html`, layout({
    // 検索結果で切れないよう、長い名称はタイトルでは短くする(ページの見出しは、名称のまま)
    // titleName: 検索語に合わせたタイトルの名称の部分(出演団体名を先に出すなど)。seoDesc: 検索語に合わせた説明文(どちらも、公式の情報で確かめたことだけを書く)
    // 神楽会館の毎月の一般公演は、毎回同じ形のタイトル・説明文(SEO-20261110-3。scripts/lib/kagura-kaikan-seo.mjs)
    title: !e.titleName && isKaguraKaikanMonthly(e) ? `${kaguraKaikanTitle(e)} | ${cfg.siteName}`
      : `${e.titleName ? e.titleName : e.name.length > 36 ? e.name.slice(0, 35) + "…" : e.name}(${jpDate(e.start.slice(0, 10))}) | ${e.prefecture} | ${cfg.siteName}`,
    desc: e.seoDesc ? clip(e.seoDesc, 150) : isKaguraKaikanMonthly(e) ? clip(kaguraKaikanDesc(e), 125) : padDesc(clip(`${fmt(e.start).replace(e.timeUnknown ? / \d\d:\d\d$/ : /$^/, "")}、${e.venue ? e.venue + "(" + e.prefecture + (e.city ?? "") + ")" : e.prefecture + (e.city ?? "")}で開催${isUpcoming(e) ? "される" : "された"}${e.kagura || "神楽"}。${e.fee ? "料金: " + e.fee + "。" : ""}${e.description ?? ""}`), [`${e.prefecture}で開かれるほかの神楽の日程も、あわせて探せます。`, "日時・会場・料金を、公式情報をもとにまとめています。"]),
    path: `/events/${e.id}.html`, noindex: !isUpcoming(e) && !pastOf.get(e.id)?.indexed, ogType: "article", wide: true, ld: [ld, crumbsLd([["ホーム", "/"], [e.prefecture, prefHref(e.prefecture)], [e.name]])],
    body: `${crumbNav([["ホーム", "/"], [e.prefecture, prefHref(e.prefecture)], [e.name]])}${hero(esc(e.name),`${kaguraTag(e.kagura)}<a class="tag" href="${prefHref(e.prefecture)}">${esc(e.prefecture)}</a>${isUpcoming(e) ? untilBadge(e) : '<span class="tag">終了しました</span>'}`)}
<div class="dpage">${isUpcoming(e) ? `<div class="d-lead">${lead}</div>` : ""}<div class="d-top">${isUpcoming(e) ? "" : endedNote(e) + lead}<div class="keyinfo" id="performance-info" tabindex="-1"><table class="info"><tr><th>日時</th><td><span class="when">${nobr(when)}</span>${isUpcoming(e) ? `<a class="tocal" href="${esc(gcalEvent(e))}" target="_blank" rel="noopener">Googleカレンダーに${!e.timeUnknown && !e.end ? "仮登録(終了未確認)" : "追加"}</a>` : ""}</td></tr><tr><th>会場</th><td>${venueCell(e)}</td></tr>
<tr><th>料金</th><td>${e.fee ? cellLines(e.fee) : "未確認"}</td></tr><tr><th>予約要否</th><td>${esc(unknownAs(reservationLabel(e)))}</td></tr></table>${unknownNote(e.timeUnknown || !e.venue || !e.fee || reservationLabel(e) === "要確認")}${glossHtml(e, { esc })}</div>
${noteBlock(e)}
${others.length ? `<p class="dates"><span class="meta">ほかの日程:</span> ${others.map((x) => `<a class="chip" href="/events/${x.id}.html">${esc(mdw(x.start.slice(0, 10)))}</a>`).join("")}</p>` : ""}
${shareBlock(`/events/${e.id}.html`, e.name)}</div>
${isUpcoming(e) ? `<div class="d-side">${sponsorFor("event", e, { side: true })}${stayBlock(e)}${planningLinks(e,today,experienceAff,{prep:false,rakuten:rakutenOn})}${prStrip(e,'event_rental')}</div>` : ""}<div class="d-rest">
${isUpcoming(e) ? "" : related(e)}
${sourceNote(e)}
${isUpcoming(e)?`${offerCards(visitorPlanning,'experiences',e,today,'event_experiences')}${learnBlock(moreOffers, { kagura: e.kagura, prefecture: e.prefecture }, today, "event_learn")}${furusatoBlock(moreOffers, { prefecture: e.prefecture, city: e.city ?? "", towns: [e.city] }, today, "event_furusato")}`:''}
${isUpcoming(e) ? related(e) : ""}
${otherWays()}
${adSlot(cfg.adsense.slotDetail)}</div></div>`,
    railCar: isUpcoming(e) ? transportSection(visitorPlanning,e,today,'event_rental',{rail:true}) : "",
  }));
}

// ---------- 詳細ページ(定期公演) ----------
// 公式の日ごとの日程表(program)がある公演: 今日以降の公演日を表で出す
const programTable = (r) => {
  const rows = (r.program ?? []).filter((p) => p.date >= today);
  if (!rows.length) return "";
  const label = (d) => { const [y, m, dd] = d.split("-").map(Number); return `${y !== +today.slice(0, 4) ? y + "年" : ""}${m}月${dd}日(${"日月火水木金土"[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()]}${holidayName(d) ? "・祝" : ""})`; };
  return `<section class="program" aria-labelledby="program-h"><h2 id="program-h">公演日程(${esc(r.programSource ?? "公式の日程表")})</h2>
<div class="tablewrap"><table class="program-table"><thead><tr><th scope="col">日付</th><th scope="col">時間</th><th scope="col">出演</th><th scope="col">会場</th></tr></thead><tbody>
${rows.map((p) => `<tr><td>${label(p.date)}</td><td>${esc(p.time ?? "")}</td><td>${esc(p.troupe)}</td><td>${esc(p.hall ?? "")}</td></tr>`).join("")}
</tbody></table></div>${r.programNote ? `<p class="meta annotation">${esc(r.programNote)}</p>` : ""}</section>`;
};
// 「予約と当日の流れ」(bookingFlow: { lead, steps: [{ t, d }] }): 予約の語で探して来た人に、予約が要るか・当日の受付・料金をページの最初に答える。
// 置き場所は、説明と「公式情報を見る」のすぐ下、要点の表の上(左の列の先頭)。PC では右の列の宿の枠と上端がそろい、宿の枠は下がらない。
// 文は公式の案内で確かめた事実だけ(SEO-20261117-1。高千穂神社の神楽殿の毎晩の神楽から)
// 次の公演(日ごとの日程表 program のうち、今日以降でいちばん近い回)。説明文の {next} と、ページの先頭の段に出す(SEO-20261123-1)
const nextProgram = (r) => (r.program ?? []).find((p) => p.date >= today);
const nextProgramText = (r) => { const p = nextProgram(r); return p ? `次の公演は${mdw(p.date)}${(p.time ?? "").replace(/\s+/g, "")}、${p.troupe}${p.hall ? `(${p.hall})` : ""}。` : ""; };
const nextProgramHtml = (r) => {
  const p = nextProgram(r);
  if (!p) return "";
  return `<p class="next-show"><span class="ns-label">次の公演</span><b>${nobr(esc(mdw(p.date)))}${p.time ? ` ${esc(p.time)}` : ""}</b><span class="ns-who">${esc([p.troupe, p.hall].filter(Boolean).join("・"))}</span><a class="textlink" href="#program-h">日程表を見る</a></p>`;
};
const bookingFlowHtml = (r) => {
  const b = r.bookingFlow;
  if (!b?.steps?.length) return "";
  return `<section class="booking-flow" aria-labelledby="booking-flow-h"><h2 id="booking-flow-h">予約と当日の流れ</h2>${b.lead ? phrasesHtml(`<p class="bf-lead">${esc(b.lead)}</p>`) : ""}${flowFig(b.steps.map((s) => ({ t: esc(s.t), d: s.d ? esc(s.d) : "" })), "予約と当日の流れ")}</section>`;
};
for (const r of regular) {
  const row = (th, v) => (v ? `<tr><th>${th}</th><td>${cellLines(v)}</td></tr>` : "");
  write(`dist/regular/${r.id}.html`, layout({
    // seoTitle: 検索語に合わせたタイトル(なければ、名前と公演日時から作る)。seoDesc: 検索語に合わせた説明文(どちらも、公式の情報で確かめたことだけを書く)
    title: r.seoTitle ? `${r.seoTitle} | ${cfg.siteName}` : `${r.name} | ${r.schedule.replace(/\(.*$/, "").trim()} | ${cfg.siteName}`,
    // seoDesc の {next}: 次の公演の日・開演時刻・出演(日程表 program から。なければ消す)。文の切れ目で切り、短ければ補う
    desc: r.seoDesc?.includes("{next}") ? padDesc(r.seoDesc.replace("{next}", nextProgramText(r))) : r.seoDesc ? clip(r.seoDesc, 150) : padDesc(clip(`${r.prefecture}${r.city ?? ""}${r.venue ? "の" + r.venue : ""}で観られる、${r.kagura || "神楽"}の定期公演です。公演日時: ${r.schedule.replace(/。$/, "")}。${r.fee ? "料金: " + r.fee.replace(/。$/, "") + "。" : ""}${r.description ?? ""}`)),
    path: `/regular/${r.id}.html`, wide: true, ld: crumbsLd([["ホーム", "/"], [r.prefecture, prefHref(r.prefecture)], [r.name]]),
    body: `${crumbNav([["ホーム", "/"], [r.prefecture, prefHref(r.prefecture)], [r.name]])}${hero(esc(r.name),`<span class="tag">定期公演</span>${kaguraTag(r.kagura)}<a class="tag" href="${prefHref(r.prefecture)}">${esc(r.prefecture)}</a>`)}
<div class="dpage"><div class="d-lead">${nextProgramHtml(r)}<div class="desc-lead">${descParas(shownDesc(r, !r.fee || !r.venue || reservationLabel(r) === "要確認"))}</div>
${r.url ? `<p class="actions"><a class="btn" data-official-link href="${esc(r.url)}" rel="noopener" target="_blank">公式情報を見る</a></p>` : ""}</div><div class="d-top">${bookingFlowHtml(r)}<div class="keyinfo" id="performance-info" tabindex="-1"><table class="info">${r.schedule ? `<tr><th>公演日時</th><td>${scheduleCell(r.schedule)}</td></tr>` : ""}${row("期間", r.season)}${row("休演日", r.closed)}<tr><th>会場</th><td>${venueCell(r, "")}</td></tr>${row("料金", r.fee || "未確認")}${row("予約要否", unknownAs(reservationLabel(r)))}${row("予約・受付方法", r.booking)}</table>${unknownNote(!r.fee || !r.venue || reservationLabel(r) === "要確認")}${glossHtml(r, { esc })}</div>
${programTable(r)}
${shareBlock(`/regular/${r.id}.html`, r.name)}</div>
<div class="d-side">${sponsorFor("regular", r, { side: true })}${affiliateBlock(r)}${planningLinks(r,today,experienceAff,{prep:false,rakuten:rakutenOn})}${prStrip(r,'regular_rental')}</div><div class="d-rest">
${sourceNote(r)}
${offerCards(visitorPlanning,'experiences',r,today,'regular_experiences')}${learnBlock(moreOffers, { kagura: r.kagura, prefecture: r.prefecture }, today, "regular_learn")}${furusatoBlock(moreOffers, { prefecture: r.prefecture, city: r.city ?? "", towns: [r.city] }, today, "regular_furusato")}
${related(r)}
${otherWays()}
${adSlot(cfg.adsense.slotDetail)}</div></div>`,
    railCar: transportSection(visitorPlanning,r,today,'regular_rental',{rail:true}),
  }));
}

// ---------- 月別ページ(「11月 神楽 開催」のような、日付の検索に当てる。日付・場所の検索はJSで結果を出すため、検索エンジンには中身が見えない) ----------
months.forEach((k) => {
  const list = monthMap.get(k), label = monthLabel(k);
  const prefsIn = [...new Set(list.map((e) => e.prefecture))], kindsIn = [...new Set(list.map((e) => e.kagura).filter(Boolean))];
  write(`dist/month/${k}.html`, layout({
    title: `${label}の神楽 開催日程(${list.length}件) | ${cfg.siteName}`,
    desc: fillDesc(`${label}に開催される神楽の日程一覧です。${prefsIn.join("・")}の${list.length}件${kindsIn.length ? "(" + kindsIn.join("、") + ")" : ""}を日付順に掲載しています。会場や料金、公式情報へのリンクつき。`, ["公式情報をもとに、出典と確認日をつけて掲載しています。", "週末や旅の予定に合わせて、観に行ける神楽を探せます。"]),
    path: `/month/${k}.html`, active: "/month/",
    ld: [crumbsLd([["ホーム", "/"], ["日付・会場・キーワードから探す", "/calendar.html"], [label]]), itemListLd(`${label}の神楽`, list.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })))],
    body: `${crumbNav([["ホーム", "/"], ["日付・会場・キーワードから探す", "/calendar.html"], [label]])}${hero(`${label}の神楽`, countLine(list.length, 0))}
<p class="lead">${label}に開催される神楽を、日付順にまとめています。</p>
<nav class="month-regions chiprow" aria-label="${label}に開催のある県"><span class="meta">各県の全日程を見る</span>${prefsIn.map((p) => `<a class="chip" href="${prefHref(p)}">${esc(p)}</a>`).join("")}</nav>
${adSlot(cfg.adsense.slotList)}<h2 class="sr">${label}の開催一覧</h2>${withStrips(list.map((e) => ({ html: card(e), item: listItem(e, e.start.slice(0, 10), "event") })), "/month/", {})}
<h2>ほかの月</h2><div class="taglist">${months.filter((m) => m !== k).map((m) => `<a class="tag" href="/month/${m}.html">${monthLabel(m)}</a>`).join("")}</div>
${regular.length ? `<h2>毎週・毎晩の定期公演</h2>${regular.map((r) => regCard(r)).join("")}` : ""}
${prStripFor("/month/")}
${otherWays(`/month/${k}.html`, { withMonths: false })}`,
  }));
});

// ---------- 今週末の神楽・今月の神楽(「神楽 今週末」「今月 神楽」のような検索と、ブックマークに当てる。URLは固定で、中身が日付で変わる) ----------
const occCard = (r, d) => {
  const p = parts(`${d}T00:00`);
  return `<div class="card reg occ"><div class="date"><small>${p.mo}月</small><b>${p.d}</b><small>${WD[p.wd]}曜</small></div><div>
<h3><a href="/regular/${r.id}.html">${esc(r.name)}</a></h3>
<div class="meta">${sepList(["定期公演", nobr(esc(r.schedule)), placePh(r.prefecture, r.city)])}</div>
${cardFacts(r)}${kaguraTag(r.kagura)}</div></div>`;
};
const dailyBlock = (list) => (list.length ? `<h2>毎晩の定期公演</h2>${list.map(({ r, closed }) => regCard(r) + (closed.length ? `<p class="meta">※ ${closed.map(mdLabel).join("・")}は、休演です。</p>` : "")).join("")}` : "");

{
  const items = [...wkEvents.map((e) => ({ k: e.start, html: card(e), item: listItem(e, e.start.slice(0, 10), "event") })), ...wkRegs.flatMap(({ r, dates }) => dates.map((d) => ({ k: `${d}T${timeOf(r)}`, html: occCard(r, d), item: listItem(r, d, "regular") })))].sort((a, b) => a.k.localeCompare(b.k));
  const after = upcoming.filter((e) => e.start.slice(0, 10) > wk.end).slice(0, 5);
  const names = [...wkEvents, ...wkRegs.map((x) => x.r), ...wkDaily.map((x) => x.r)];
  const weekendRegions = [...new Set(names.map(x=>x.prefecture).filter(Boolean))];
  const sub = [wkRenkyu, wkHolidays.join("・")].filter(Boolean).join("・");
  write("dist/weekend.html", layout({
    title: `今週末の神楽(${wkLabel}) | ${cfg.siteName}`,
    desc: padDesc(clip(`今週末、${wkLabel}${wkRenkyu ? `の${wkRenkyu}` : ""}に観られる神楽の開催と定期公演を日付順にまとめています。${weekendRegions.length ? `${weekendRegions.slice(0,3).join("、")}${weekendRegions.length>3?"など":""}の開催情報を掲載しています。日時・会場と公式情報を確認できます。` : "開催情報がない週は、その先の開催をご案内します。"}毎日自動で更新しています。`)),
    path: "/weekend.html", active: "/weekend.html", wide: true,
    ld: [crumbsLd([["ホーム", "/"], ["日付・会場・キーワードから探す", "/calendar.html"], ["今週末の神楽"]]), itemListLd(`今週末の神楽(${wkLabel})`, [...wkEvents.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })), ...[...wkRegs, ...wkDaily].map(({ r }) => ({ href: `/regular/${r.id}.html`, name: r.name }))])].filter(Boolean),
    body: `${crumbNav([["ホーム", "/"], ["日付・会場・キーワードから探す", "/calendar.html"], ["今週末の神楽"]])}${hero("今週末の神楽")}
<p class="lead">この週末${sub ? `(${esc(sub)})` : ""}に観られる神楽を、日付順に並べています(${jpDate(today)}時点)。</p>
${weekendRegions.length ? `<nav class="weekend-regions chiprow" aria-label="この週末に開催のある県"><span class="meta">各県の全日程を見る</span>${weekendRegions.map(p=>`<a class="chip" href="${prefHref(p)}">${esc(p)}</a>`).join('')}</nav>` : ''}
<div class="dpage"><div class="d-lead narrow">${adSlot(cfg.adsense.slotList)}<h2>開催予定${items.length ? `(${items.length}件)` : ""}</h2></div><div class="d-top">
${withStrips(items, "/weekend.html", { wide: true }) || empty(`${esc(wkLabel)}の開催情報は、いまのところ見つかっていません。${wkDaily.length ? "毎晩の定期公演なら、今週末も観られます。" : ""}`)}
${dailyBlock(wkDaily)}
</div><div class="d-side">${tripBand("weekend", "週末の宿を探す")}${selfPair("weekend")}${prStripFor("/weekend.html", { wide: true })}</div><div class="d-rest">
${after.length ? `<h2>このあとの神楽</h2>${after.map((e) => card(e)).join("")}` : ""}
${otherWays("/weekend.html")}</div></div>`,
  }));
}
{
  const late = monthDays.length <= 10; // 月末が近いときは、来月の予定も見せる
  const names = [...tmEvents, ...tmRegs.map((x) => x.r)];
  // 今週末と同じ「各県の全日程を見る」(2026-11-16 運営者の依頼「今月の神楽も同じ仕様に」)。並びは、一覧に出る順(開催 → 毎週・毎晩の定期公演)
  const tmRegions = [...new Set([...names, ...tmDaily.map((x) => x.r)].map((x) => x.prefecture).filter(Boolean))];
  write("dist/this-month.html", layout({
    title: `今月の神楽 ${tmLabel}の開催日程 | ${cfg.siteName}`,
    desc: padDesc(clip(`${tmLabel}、今日から月末までに観られる神楽をまとめています。${[tmEvents.length ? `開催${tmEvents.length}件` : "", tmRegs.length + tmDaily.length ? `定期公演${tmRegs.length + tmDaily.length}件の公演日` : ""].filter(Boolean).join("と、").replace(/.+/, (t) => `${t}を載せています`) || "開催情報がないときは、来月の予定をご案内します"}。${names.length ? `${listNames(names)}など。` : ""}毎日自動で更新しています。`)),
    path: "/this-month.html", active: "/this-month.html", wide: true,
    ld: [crumbsLd([["ホーム", "/"], ["日付・会場・キーワードから探す", "/calendar.html"], ["今月の神楽"]]), itemListLd(`今月の神楽(${tmLabel})`, [...tmEvents.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })), ...[...tmRegs, ...tmDaily].map(({ r }) => ({ href: `/regular/${r.id}.html`, name: r.name }))])].filter(Boolean),
    body: `${crumbNav([["ホーム", "/"], ["日付・会場・キーワードから探す", "/calendar.html"], ["今月の神楽"]])}${hero("今月の神楽")}
<p class="lead">今日から月末までに観られる神楽を、日付順に並べています(${jpDate(today)}時点)。</p>
${tmRegions.length ? `<nav class="tm-regions chiprow" aria-label="今月これから開催のある県"><span class="meta">各県の全日程を見る</span>${tmRegions.map((p) => `<a class="chip" href="${prefHref(p)}">${esc(p)}</a>`).join("")}</nav>` : ""}
<div class="dpage"><div class="d-lead narrow">${adSlot(cfg.adsense.slotList)}<h2>開催予定${tmEvents.length ? `(${tmEvents.length}件)` : ""}</h2></div><div class="d-top">
${withStrips(tmEvents.map((e) => ({ html: card(e), item: listItem(e, e.start.slice(0, 10), "event") })), "/this-month.html", { wide: true }) || empty(`${tmLabel}の、これからの開催情報は、いまのところ見つかっていません。`)}
${months.includes(mk) ? `<p class="meta"><a class="textlink" href="/month/${mk}.html">${tmLabel}の開催一覧を見る ›</a></p>` : ""}
${tmRegs.length ? `<h2>毎週の定期公演</h2>${tmRegs.map(({ r, dates }) => `${regCard(r)}<p class="meta">今月の公演日: ${dates.map((d) => `${+d.slice(8, 10)}日`).join("・")}</p>`).join("")}` : ""}
${dailyBlock(tmDaily)}
</div><div class="d-side">${tripBand("this-month", "今月の旅の宿を探す")}${selfPair("this-month")}${prStripFor("/this-month.html", { wide: true })}</div><div class="d-rest">
${late && nmEvents.length ? `<h2>来月(${monthLabel(nextMk)})の神楽</h2>${nmEvents.slice(0, 5).map((e) => card(e)).join("")}${nmEvents.length > 5 || months.includes(nextMk) ? `<p class="meta"><a class="textlink" href="/month/${nextMk}.html">${monthLabel(nextMk)}の開催一覧(${nmEvents.length}件)を見る ›</a></p>` : ""}` : ""}
${otherWays("/this-month.html")}</div></div>`,
  }));
}

// ---------- はじめての神楽ガイド(「神楽 初めて」「夜神楽 服装」などの検索に当てる、読み物) ----------
{
  const title = "はじめての神楽ガイド 持ち物・服装・交通の準備";
  write("dist/guide.html", layout({
    title: `${title} | ${cfg.siteName}`,
    desc: "はじめての神楽観覧に向けて、見どころ・マナーと夜神楽の服装・持ち物、公共交通やレンタカーでの行き帰りを紹介。不要な場面も含めて準備を選べます。公式案内を確認し、公演前後の周辺体験もあわせて計画しましょう。",
    path: "/guide.html", active: "/guide.html", alts: [["en", "/en/guide.html"]], wide: true,
    ld: [crumbsLd([["ホーム", "/"], ["はじめての神楽ガイド"]]), {
      "@context": "https://schema.org", "@type": "Article", headline: title, inLanguage: "ja", datePublished: '2026-10-20', dateModified: GUIDE_CHECKED,
      author: ORG_LD, publisher: ORG_LD,
      mainEntityOfPage: `${cfg.baseUrl}/guide.html`, image: ogUrl(false),
    }],
    body: `${crumbNav([["ホーム", "/"], ["はじめての神楽ガイド"]])}${hero("はじめての神楽ガイド", "見どころ・マナー・服装と持ち物")}<div class="prose guide">${phrasesHtml(guideHtml({
      esc,
      supplies: offersFor(visitorPlanning, 'supplies', { guide: true }, today),
      rentalHtml:rentalSearch(visitorPlanning,{guide:true},today,'guide_rental'),
      kaguraLink: (k) => (kaguras.includes(k) ? `<a href="${kaguraHref(k)}">${esc(k)}</a>` : esc(k)),
    }))}</div>`,
  }));
}

// 周辺体験は、一般的な観覧ガイドと分けて地域・確認日を明示する。
write('dist/experiences.html',layout({
  title:`神楽の前後に楽しむ体験を全国47都道府県から探す | ${cfg.siteName}`,
  desc:padDesc('神楽の公演前後に楽しむ体験を、全国47都道府県から探せます。開催地域に合わせて陶芸やものづくり、自然体験、日帰り温泉などを検討し、リンク先で日付・所要時間・会場からの距離を確認して旅の予定を組みましょう。'),
  path:'/experiences.html',ld:[crumbsLd([['ホーム','/'],['はじめての神楽ガイド','/guide.html'],['公演前後の周辺体験']]),{'@context':'https://schema.org','@type':'Article',headline:'神楽の前後に楽しむ周辺体験',inLanguage:'ja',datePublished:PLANNING_CHECKED,dateModified:PLANNING_CHECKED,author:ORG_LD,publisher:ORG_LD,mainEntityOfPage:`${cfg.baseUrl}/experiences.html`,image:ogUrl(false)}],
  body:`${crumbNav([['ホーム','/'],['はじめての神楽ガイド','/guide.html'],['公演前後の周辺体験']])}${hero('神楽の前後も、土地を楽しむ','全国47都道府県から、もうひとつの寄り道を。')}${phrasesHtml(`<p>神楽を観に行く土地で、ものづくりや自然体験、日帰り温泉も楽しめます。行き先の都道府県から探せます。</p>${experienceDirectory(experienceAff,{rakuten:rakutenOn})}${offerCards(visitorPlanning,'experiences',{guide:true},today,'experience_guide')}<h2>神楽の予定から旅を組み立てる</h2><p><a class="btn" href="/calendar.html">公演の日付・地域を探す</a> <a class="btn ghost" href="/guide.html#transport">行き帰りの交通を確認</a> <a class="btn ghost" href="/guide.html#packing">持ち物を選ぶ</a></p>`)}`
}));

// ---------- 神楽の歴史(総論と年表、古代・中世・近世・近代の4ページ) ----------
{
  const pages = historyPages({ esc, kaguraLink: (k) => (kaguras.includes(k) ? `<a href="${kaguraHref(k)}">${esc(k)}</a>` : esc(k)) });
  for (const [key, pg] of Object.entries(pages)) {
    const path = key === "index" ? "/history/" : `/history/${key}.html`;
    const era = HISTORY_ERAS.find((e) => e.slug === key);
    const crumbs = key === "index" ? [["ホーム", "/"], ["神楽の歴史"]] : [["ホーム", "/"], ["神楽の歴史", "/history/"], [era.title]];
    write(`dist${key === "index" ? "/history/index.html" : path}`, layout({
      title: `${pg.title} | ${cfg.siteName}`, desc: clip(pg.desc, 160), path, active: "/history/", alts: key === "index" ? [["en", "/en/history.html"]] : [], wide: true,
      ld: [crumbsLd(crumbs.map(([t, h]) => [t, h])), {
        "@context": "https://schema.org", "@type": "Article", headline: pg.title, inLanguage: "ja", datePublished: HISTORY_CHECKED, dateModified: HISTORY_CHECKED,
        author: ORG_LD, publisher: ORG_LD, mainEntityOfPage: `${cfg.baseUrl}${path}`, image: ogUrl(false),
      }],
      body: `${crumbNav(crumbs)}${hero(esc(pg.h1), esc(pg.sub))}<div class="prose history">${phrasesHtml(historyReader(key, pg.body()))}</div>${key === "index" ? learnBlock(moreOffers, { kagura: "*" }, today, "history_learn") : ""}`,
    }));
  }
}

// ---------- English pages (/en/): 海外からの旅行者向け。トップ・ガイド・種類の一覧・歴史・日程・定期公演と、種類ごとのページ ----------
const enPages = (() => {
  // 種類: 日本語の「種類で探す」と同じ順番・同じ種類。県は、これからの開催・定期公演の県(なければ、その神楽の地元の県)
  const styles = kaguras.map((k) => {
    const ps = [...new Set([...upcoming, ...regular].filter((x) => x.kagura === k).map((x) => x.prefecture))];
    return { key: k, prefs: ps.length ? ps : [kaguraHome(k)].filter(Boolean), indexed: kaguraIndexed(k) };
  });
  return englishPages({ esc, upcoming, regular, styles, kaguraHref: (k) => (kaguras.includes(k) ? kaguraHref(k) : null), infoJa: kaguraInfo, infoEn: kaguraInfoEn, regularEn, today });
})();
{
  // 英語のトップ: 日本語のトップと同じ絵。見出しは横書きで、フレーズごとに順に現れる(題は「Kagura: …」を、コロンで分ける)
  const heroEn = (h, p) => `<section class="hero home-hero">
<picture class="hero-art"><source media="(max-width: 640px)" srcset="/hero-sp.webp" width="1122" height="1402"><img src="/hero-pc.webp" width="1774" height="887" alt="Watercolor of a masked dancer holding a paper wand, dancing in a kagura hall at night" fetchpriority="high" decoding="async"></picture>${sparksHtml}
<div class="copy"><h1>${h.split(/(?<=:) /).map((t) => `<span class="ph">${esc(t)}</span>`).join(" ")}</h1><p><span class="ph ph3">${esc(p)}</span></p></div></section>`;
  for (const pg of enPages) {
    const crumbs = pg.crumbs ?? [["Home", "/en/"], [pg.h1]];
    const top = pg.path === "/en/";
    // メニューで「いまいる場所」: 種類ごとのページは「Kagura styles」、定期公演は「Calendar」の中
    const active = pg.path.startsWith("/en/kagura/") ? "/en/kagura/" : pg.path;
    write(`dist${top ? "/en/index.html" : pg.path}`, layout({
      lang: "en", title: pg.title, desc: pg.desc, path: pg.path, active, alts: pg.ja ? [["ja", pg.ja]] : [], noindex: !!pg.noindex,
      ld: [...(top ? [] : [crumbsLd(crumbs)]), { "@context": "https://schema.org", "@type": pg.type ?? "Article", [pg.type === "CollectionPage" ? "name" : "headline"]: pg.h1, inLanguage: "en", datePublished: pg.published ?? (pg.key.startsWith("style:") || ["calendar", "regular"].includes(pg.key) ? EN_UPDATED : EN_CHECKED), dateModified: pg.modified ?? EN_UPDATED, author: ORG_LD, publisher: ORG_LD, mainEntityOfPage: `${cfg.baseUrl}${pg.path}`, image: ogUrl(true), ...(pg.about ? { about: pg.about } : {}) }],
      body: `${top ? "" : `<nav class="crumbs" aria-label="Breadcrumb"><ol>${crumbs.map(([t, h]) => (h ? `<li><a href="${h}">${esc(t)}</a></li>` : `<li aria-current="page">${esc(t)}</li>`)).join("")}</ol></nav>`}${top ? heroEn(pg.h1, pg.sub) : hero(esc(pg.h1), esc(pg.sub))}<div class="prose en">${pg.body()}</div>`,
    }));
  }
}

// ---------- 固定ページ ----------
// 協賛・主催者・運営者情報・規約などの本文も、ガイド・歴史と同じく、ことばの切れ目で折り返す(2026-11-15 運営者の依頼。以前は文字の途中で折り返していた)
const doc = (path, title, desc, inner, opts = {}) => {
  const crumbs = [["ホーム", "/"], ...(opts.crumbs ?? []), [title]];
  write(`dist${path}`, layout({ title: `${title} | ${cfg.siteName}`, desc, path, ld: crumbsLd(crumbs), body: `${crumbNav(crumbs)}${hero(title, opts.lead ?? "")}<div class="prose${opts.cls ? ` ${opts.cls}` : ""}">${phrasesHtml(inner)}</div>`, ...opts.layout }));
};

doc("/submit.html", "掲載の依頼", "神楽の開催情報の掲載依頼フォーム", `<p>神楽の開催情報をお送りください。公式情報で内容を確かめてから掲載します。掲載される場所や流れは<a href="/organizers.html">主催者の方へ</a>をご覧ください。</p>${submitForm(cfg)}`, { lead: "掲載は無料です。", crumbs: [["主催者の方へ", "/organizers.html"]], layout: { noindex: true, withForm: true, active: "/submit.html" } });

// 主催者の方へ(掲載の依頼を増やす。「神楽 イベント 掲載 無料」のような検索にも当てる)
doc("/organizers.html", "主催者の方へ", `神楽の主催者・神社・保存会・神楽団・自治体・観光協会の皆さまへ。${cfg.siteName}では、神楽の開催情報を無料で掲載しています。掲載される場所や送り方、掲載までの流れ、訂正・削除の方法をご案内します。`,
  organizersHtml({ esc, siteName: cfg.siteName, formReady: formReady(cfg) }),
  { lead: "神楽の開催情報を、無料で掲載します。", layout: { active: "/organizers.html" } });

// 広告・協賛のご案内(媒体資料。MON-2。2026-11-14 に作り直した。細かく書かず、内容・期間・ご予算を相談しながら決められることを伝える。例のリンクは、実在する県・種類・開催・定期公演のページ)
const kaguraEg = kaguras.find((k) => upcoming.some((e) => e.kagura === k) || regular.some((r) => r.kagura === k));
doc("/sponsor.html", "広告・協賛のご案内", `観光協会・宿・道の駅・お店の皆さまへ。${cfg.siteName}の協賛枠・記事広告・年間協賛のご案内です。神楽を観に出かける方に、地域の情報を届けます。内容・期間・ご予算は、ご相談しながら決められます。`,
  sponsorHtml({ esc, siteName: cfg.siteName,
    pref: prefs.length ? { name: prefs[0], href: prefHref(prefs[0]) } : undefined,
    kagura: kaguraEg ? { name: kaguraEg, href: kaguraHref(kaguraEg) } : undefined,
    ev: upcoming.length ? { name: upcoming[0].name, href: `/events/${upcoming[0].id}.html` } : undefined,
    reg: regular.length ? { name: regular[0].name, href: `/regular/${regular[0].id}.html` } : undefined, prices: cfg.sponsorPrices ?? {},
    facts: { events: upcoming.length, prefs: prefs.length, kaguras: kaguras.length, regular: regular.length },
    stats: statsFresh(mediaStats, today) ? mediaStats : null }),
  { lead: "神楽を観に出かける方へ、地域の情報を届けます。", cls: "sp-page", layout: { head: SPONSOR_CSS, active: "/sponsor.html" } });
// 記事広告の見本(架空の宿。noindex で、サイトマップにも入れない)。見出しは記事の題、要点に「見本」と書く
{
  const crumbs = [["ホーム", "/"], ["広告・協賛のご案内", "/sponsor.html"], ["記事広告の見本"]];
  write("dist/pr/sample.html", layout({
    title: `記事広告の見本 | ${cfg.siteName}`, desc: "記事広告(編集部が取材して書く、PR記事)の見本です。架空の温泉宿を例に、神楽の日の過ごし方を紹介する記事の形をご覧いただけます。", path: "/pr/sample.html", active: "/pr/sample.html", noindex: true, ld: crumbsLd(crumbs), head: SPONSOR_CSS,
    body: `${crumbNav(crumbs)}${hero(esc(SAMPLE_SPONSOR.article.title), "記事広告の見本です。宿は架空のものです。")}<div class="prose">${sponsorArticleSampleHtml({ esc, siteName: cfg.siteName })}</div>`,
  }));
}

doc("/about.html", "運営者情報", `${cfg.siteName}の運営者情報です。全国の神楽の開催情報をまとめる目的、運営者と連絡先、開催情報の集め方と出典の示し方、訂正のご依頼の方法、広告などによる収益について説明しています。`, `
<p class="symbol"><img src="/symbol.png" alt="${esc(op.name)}のシンボル" width="120" height="120"></p>
<table class="info"><tr><th>サイト名</th><td>${esc(cfg.siteName)}</td></tr><tr><th>運営者</th><td>${esc(op.name)}</td></tr>
<tr><th>連絡先</th><td><a class="textlink" href="/contact.html">お問い合わせフォーム</a></td></tr><tr><th>開設</th><td>${esc(op.established)}</td></tr></table>
<h2>このサイトについて</h2>
<p>${esc(cfg.siteName)}は、全国の神楽の開催情報を、探しやすくまとめたサイトです。地域の神社や保存会が受け継いできた神楽に出会うきっかけになれば、と考えています。</p>
<h2>掲載情報について</h2>
<p>開催情報は、主催者からの投稿と、公開されている情報をもとに掲載しています。日時・会場・料金の変更や、中止もあります。出かける前に、主催者の公式情報をご確認ください。</p>
<dl class="about-points"><div><dt>出典と確認日</dt><dd>主催者・自治体・観光協会などの公式情報を出典にしています。各ページの下に、出典の名前と確認した日を載せています。</dd></div>
<div><dt>更新</dt><dd>公開されている情報は、プログラムで定期的に確かめています。取得元のページから開催情報が消えたときは、掲載を取り下げます。終わった開催は、一覧と検索結果から外します。</dd></div>
<div><dt>訂正・削除</dt><dd><a href="/contact.html">お問い合わせ</a>からご連絡ください。主催者の方からのご依頼は、確認のうえ速やかに反映します。</dd></div>
<div><dt>解説の文章</dt><dd>神楽の種類や地域の解説は、文化庁の「文化遺産オンライン」や自治体、観光協会などの公開情報をもとに書き、参考にした資料へのリンクを載せています。</dd></div></dl>
<p>最終更新: ${esc(op.updated)}</p>
<h2>収益について</h2>
<p>${cfg.adsense.client || hasAffiliate ? `当サイトは、${[cfg.adsense.client ? "広告" : "", hasAffiliate ? "アフィリエイトプログラム" : ""].filter(Boolean).join("および")}による収益で運営しています。` : "現在、当サイトは広告やアフィリエイトによる収益を得ていません。今後導入する場合は、始める前にこの記載とプライバシーポリシーを更新します。"}</p>
<p>広告・協賛の掲載をご検討の方は、<a href="/sponsor.html">広告・協賛のご案内</a>をご覧ください。協賛の有無で、開催情報の掲載や並び順は変わりません。</p>
<p>情報の集め方や免責については、<a href="/disclaimer.html">免責事項・情報の取り扱い</a>をご覧ください。</p>`);

doc("/contact.html", "お問い合わせ", `${cfg.siteName}へのお問い合わせフォームです。掲載中の開催情報の訂正や削除のご依頼、サイトの不具合のご報告などを受け付けています。新しい開催情報の掲載は、掲載の依頼フォームをご利用ください。`, `
<p>次のようなご連絡は、下のフォームで受け付けています。</p>
<ul><li>開催情報の訂正や、掲載の削除のご依頼</li><li>サイトの不具合のご報告</li><li>その他のお問い合わせ</li></ul>
<p>新しい開催情報の掲載は、<a href="/submit.html">掲載の依頼フォーム</a>をご利用ください。</p>
${contactForm(cfg)}`, { layout: { withForm: true } });

// プライバシーポリシー・免責事項: 設定(広告・アクセス解析・アフィリエイト・フォーム送信先・自動取得)に合わせて、本文が変わる
const SOURCES_FILE = process.env.SOURCES_FILE ?? "data/sources.json";
const autoSources = existsSync(SOURCES_FILE) ? readJson(SOURCES_FILE).filter((s) => s.enabled !== false && s.termsChecked).map((s) => s.name) : [];
const policyCtx = {
  cfg, op, mailLink, auto: autoSources, autoPublish: cfg.collect?.autoPublish !== false,
  hasAds: !!cfg.adsense.client, hasGA: !!cfg.analyticsId, hasCB: true, hasGC: !!cfg.goatcounter, hasAffil: hasAffiliate,
  form: { ready: formReady(cfg), providerName: cfg.form?.providerName },
};
doc("/privacy.html", "プライバシーポリシー", `${cfg.siteName}のプライバシーポリシーです。取得する情報と利用目的、外部サービスへの情報の送信、Cookie、個人情報の開示・訂正・削除のご請求について定めています。`, privacyHtml(policyCtx));
doc("/terms.html", "利用規約", `${cfg.siteName}の利用規約です。サイトの利用条件、開催情報の投稿の扱い、禁止事項、免責、規約の変更、準拠法と管轄裁判所について定めています。サイトをご利用の前にお読みください。`, termsHtml(policyCtx));
doc("/disclaimer.html", "免責事項・情報の取り扱い", `${cfg.siteName}の免責事項です。開催情報の集め方と自動処理、掲載の停止、外部サイトへのリンク、損害についての責任の範囲を説明しています。お出かけの前には、主催者の公式情報をご確認ください。`, disclaimerHtml(policyCtx));
// ---------- sitemap / robots / ads.txt / security.txt / 404 ----------
// lastmod は「そのページの中身が変わった日」(出典の確認日)にする。ビルドした日を全ページに入れると、検索エンジンに信頼されなくなる
const staticDay = (() => { const m = String(op.updated ?? "").match(/(\d{4})年(\d{1,2})月(\d{1,2})日/); return m ? `${m[1]}-${pad(m[2])}-${pad(m[3])}` : nowJst.slice(0, 10); })();
const allDay = lastmodOf([...upcoming, ...regular]);
const sm = [
  ['/quiz.html', QUIZ_CHECKED],
  ['/experiences.html', PLANNING_CHECKED],
  ["/", allDay], ["/map.html", allDay], ["/calendar.html", allDay], ["/kagura/", allDay],
  // 日付で変わるページ: 「その週末・その月になった日」と、載せている情報の確認日の、新しいほう
  ["/weekend.html", maxDay(daysBetween(addDays(today, -6), today).find((d) => weekendRange(d).end === wk.end), [...wkEvents, ...wkRegs.map((x) => x.r), ...wkDaily.map((x) => x.r)].map((x) => x.checked))],
  ["/this-month.html", maxDay(`${mk}-01`, [...tmEvents, ...tmRegs.map((x) => x.r), ...tmDaily.map((x) => x.r)].map((x) => x.checked), events.filter((e) => e.start.slice(0, 7) === mk && !isUpcoming(e)).map((e) => addDays((e.end || e.start).slice(0, 10), 1)).filter((d) => d <= today))],
  ["/guide.html", GUIDE_CHECKED], ["/history/", HISTORY_CHECKED], ...HISTORY_ERAS.map((e) => [`/history/${e.slug}.html`, HISTORY_CHECKED]), ["/organizers.html", staticDay], ["/sponsor.html", staticDay],
  ["/about.html", staticDay], ["/contact.html", staticDay], ["/privacy.html", (() => { const m = privacyUpdated(cfg).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/); return m ? `${m[1]}-${pad(m[2])}-${pad(m[3])}` : staticDay; })()], ["/terms.html", staticDay], ["/disclaimer.html", staticDay],
  // 検索に載せないページ(noindex)は、サイトマップにも入れない
  // 開催予定がなくても、これまでの開催と解説で検索に残す種類・県のページ(kaguraIndexed / prefIndexed)も入れる
  ...kaguras.filter(kaguraIndexed).map((k) => [kaguraHref(k), lastmodOf([...upcoming, ...regular].filter((x) => x.kagura === k).concat(upcoming.some((e) => e.kagura === k) || regular.some((r) => r.kagura === k) ? [] : pastRecords(events.filter((e) => e.kagura === k))))]),
  ...[...new Set([...events, ...regular].map((e) => e.prefecture))].sort(byPref).filter(prefIndexed).map((p) => [prefHref(p), lastmodOf([...upcoming, ...regular].filter((x) => x.prefecture === p).concat(prefs.includes(p) ? [] : pastRecords(events.filter((e) => e.prefecture === p))))]),
  ...months.map((k) => [`/month/${k}.html`, lastmodOf(monthMap.get(k))]),
  ...upcoming.map((e) => [`/events/${e.id}.html`, e.checked ?? nowJst.slice(0, 10)]),
  // 終わった開催のうち、検索に残すページ(次の回がなく、説明があり、終わってから400日以内)
  ...events.filter((e) => pastOf.get(e.id)?.indexed).map((e) => [`/events/${e.id}.html`, e.checked ?? nowJst.slice(0, 10)]),
  ...regular.map((r) => [`/regular/${r.id}.html`, r.checked ?? nowJst.slice(0, 10)]),
  // 英語のページ: 中身が変わった日(日程の表があるページは、載せている開催の確認日の新しいほう)
  ...enPages.filter((p) => !p.noindex).map((p) => [p.path, p.key === "calendar" ? maxDay(EN_UPDATED, allDay) : p.key === "regular" ? maxDay(EN_UPDATED, lastmodOf(regular)) : p.modified ?? EN_UPDATED]),
];
const urls = sm.map(([u]) => u);
write("dist/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sm.map(([u, d]) => `<url><loc>${cfg.baseUrl}${u}</loc><lastmod>${d}</lastmod></url>`).join("")}</urlset>`);

// ---------- 新着フィード(Atom)・カレンダー購読(ICS)・共有画像 ----------
const xml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const feedItems = [...upcoming.map((e) => ({ id: e.id, title: e.name, href: `/events/${e.id}.html`, day: e.checked ?? nowJst.slice(0, 10), summary: `${jpDate(e.start.slice(0, 10))} ${e.prefecture}${e.city ?? ""} ${e.venue ?? ""}。${e.description ?? ""}` })),
  ...regular.map((r) => ({ id: r.id, title: r.name, href: `/regular/${r.id}.html`, day: r.checked ?? nowJst.slice(0, 10), summary: `${r.schedule} ${r.prefecture}${r.city ?? ""} ${r.venue ?? ""}。${r.description ?? ""}` }))]
  .sort((a, b) => b.day.localeCompare(a.day)).slice(0, 30);
write("dist/feed.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="ja"><title>${xml(cfg.siteName)} 新着の開催情報</title><subtitle>${xml(cfg.description)}</subtitle><link href="${cfg.baseUrl}/feed.xml" rel="self"/><link href="${cfg.baseUrl}/"/><id>${cfg.baseUrl}/</id><updated>${allDay}T00:00:00+09:00</updated><author><name>${xml(op.name)}</name></author>${feedItems.map((i) => `<entry><title>${xml(i.title)}</title><link href="${cfg.baseUrl}${i.href}"/><id>${cfg.baseUrl}${i.href}</id><updated>${i.day}T00:00:00+09:00</updated><summary>${xml(i.summary.trim())}</summary></entry>`).join("")}</feed>\n`);
write("dist/events.ics", vcal(upcoming));
mkdirSync(OUT, { recursive: true });
// 運営者のシンボル(ヘッダー・ファビコン・ホーム画面・構造化データのロゴ)。元画像から作ったものを assets/ に置いている
for (const f of ["symbol.png", "symbol-96.png", "favicon-48.png", "apple-touch-icon.png", "hero-pc.webp", "hero-sp.webp", "og.jpg", "og-en.jpg", "washi.svg", "washi-dark.svg", "pr-sponsor.svg", "pr-organizers.svg", "pr-sponsor-wide.svg", "pr-organizers-wide.svg", "shimenawa.svg", "shimenawa-stain.svg", "shimenawa-fuzz.svg", "shimenawa-end.svg", "shimenawa-end-r.svg", "shide.svg"]) copyFileSync(`assets/${f}`, `${OUT}/${f}`);
// 検索エンジンや古いブラウザは、/favicon.ico を直接見に行く。シンボルの画像から作って置く
writeFileSync(`${OUT}/favicon.ico`, pngToIco(readFileSync("assets/favicon-48.png")));

// 404: メールやSNSで URL の直後に「)にまとめています」などが続き、メールの画面がそこまでリンクにしたとき、もとのページへ移す。
// 11/08 の営業メールの「(https://kagurameguri.jp/sponsor.html)にまとめています」で起きた。「.html」や「/」の直後が閉じかっこ・句読点のときだけ。
// 移す先は、このサイトのパスだけ(「//」で始まる別のサイトへは移さない)。移した先が無ければ、ふつうの 404 のまま
const fixTrailingJunk = `(function(){try{var p=decodeURIComponent(location.pathname),c=")）]」』、。,";var i=p.indexOf(".html"),to="",at=function(k){var ch=p.charAt(k);return ch!==""&&c.indexOf(ch)>=0};if(i>0&&at(i+5))to=p.slice(0,i+5);else if(at(1))to="/";if(!to||to.charAt(1)==="/")return;location.replace(encodeURI(to)+location.search+location.hash)}catch(e){}})();`;
write("dist/404.html", layout({
  title: `ページが見つかりません | ${cfg.siteName}`, desc: "お探しのページは見つかりませんでした", path: "/404.html", noindex: true,
  body: `${hero("ページが見つかりません", "URLが変わったか、掲載がすでに終了している可能性があります。")}
<p><a class="btn" href="/">開催予定を見る</a> <a class="btn ghost" href="/calendar.html">日付・会場・キーワードから探す</a></p>
<script>${fixTrailingJunk}</script>`,
}));

if (cfg.domain) write("dist/CNAME", cfg.domain + "\n");
write("dist/robots.txt", `User-agent: *\nAllow: /\nSitemap: ${cfg.baseUrl}/sitemap.xml\n`);
// IndexNow のキーのファイル(このサイトの持ち主が送ったことを、Bing などが確かめる。公開してよい値)
if (validIndexNowKey(SEO.indexNowKey)) write(`dist/${SEO.indexNowKey}.txt`, SEO.indexNowKey);
if (cfg.adsense.client) write("dist/ads.txt", `google.com, ${cfg.adsense.client.replace("ca-", "")}, DIRECT, f08c47fec0942fa0\n`);
// セキュリティ連絡先(RFC 9116)。メールアドレスは、お問い合わせフォームのURLで代える
const expires = new Date(asMs(nowJst) + 365 * 864e5).toISOString();
const securityTxt = `Contact: ${cfg.baseUrl}/contact.html\nExpires: ${expires}\nPreferred-Languages: ja, en\nCanonical: ${cfg.baseUrl}/.well-known/security.txt\n`;
write("dist/.well-known/security.txt", securityTxt);
write("dist/security.txt", securityTxt);
// GitHub Pages は無視するが、Cloudflare Pages / Netlify へ移したときに、本物のHTTPヘッダになる設定
write("dist/_headers", `/*\n  Strict-Transport-Security: max-age=63072000; includeSubDomains\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=()\n  Cross-Origin-Opener-Policy: same-origin\n`);
console.log(`built: ${events.length} events (${upcoming.length} upcoming), ${regular.length} regular, ${urls.length} pages`);
// 協賛枠: 契約の終わりまで載り続けるか(祭りの時期が過ぎて、載る場所がなくなる契約を知らせる。公開は止めない)
for (const c of sponsorCoverage(sponsorsData, { events, regular, today })) {
  if (!c.pages) console.warn(`SPONSOR_NO_PAGE: ${c.id} は、いま載るページがありません(placements を見直してください)`);
  else if (c.short) console.warn(`SPONSOR_ENDS_EARLY: ${c.id} は、契約の終わり(${c.end})より前の ${c.last} の後、載る場所がなくなる見込みです(地域の枠 area にすると続けて載ります)`);
}


// Version-pinned local CMP assets, including its MIT license. No CDN runtime dependency.
mkdirSync(`${OUT}/vendor/cookieconsent-3.2.1`, { recursive: true });
for (const f of ["cookieconsent.umd.js", "cookieconsent.css", "LICENSE"]) copyFileSync(`assets/vendor/cookieconsent-3.2.1/${f}`, `${OUT}/vendor/cookieconsent-3.2.1/${f}`);
copyFileSync("scripts/client/consent-manager.js", `${OUT}/consent-manager.js`);
