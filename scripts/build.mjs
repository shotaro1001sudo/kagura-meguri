import { createRakutenStayResolver } from "./lib/rakuten-stay-issued.mjs";
import { cookieControls } from './lib/cookie-controls.mjs';
import { calendarNotice } from './lib/calendar-notice.mjs';
import { eventFeeSchema } from './lib/event-fee-schema.mjs';
import { upcomingSummary, upcomingSummaryDescription } from './lib/upcoming-summary.mjs';
import { reservationLabel } from './lib/reservation.mjs';
// 静的サイト生成: data/events.json + data/regular.json + config.json -> dist/
// 2026-10-21: event-handoff smoke marker (comment only; no functional or output change).
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync } from "node:fs";
import * as cheerio from "cheerio";
import { cspFor, FRAME_BUSTER } from "./lib/csp.mjs";
import { submitForm, contactForm, formScript, formReady } from "./lib/form.mjs";
import { privacyHtml, privacyUpdated, disclaimerHtml, termsHtml } from "./lib/policy.mjs";
import { guideHtml, CHECKED as GUIDE_CHECKED } from "./lib/guide.mjs";
import { englishPages, CHECKED as EN_CHECKED, SITE_EN } from "./lib/english.mjs";
import { historyPages, ERAS as HISTORY_ERAS, CHECKED as HISTORY_CHECKED } from "./lib/history.mjs";
import { organizersHtml } from "./lib/organizers.mjs";
import { REGIONS, regionOf } from "./lib/util.mjs";
import { pngToIco } from "./lib/ico.mjs";
import { encodeSjisURI } from "./lib/sjis.mjs";
import { weekendRange, rangeLabel, mdLabel, regularOn, isDaily, addDays, holidayName } from "./lib/dates.mjs";
import { VC, vcEnabled, vcTag } from "./lib/valuecommerce.mjs";
import { stayBannersHtml } from "./lib/stay-banners.mjs";
import { createMoreOfferIndex, learnBlock, furusatoBlock } from "./lib/more-offers.mjs";
import { questions, features, traditions, quizEngine, QUIZ_CHECKED } from './lib/quiz.mjs';
import { CHECKED as PLANNING_CHECKED, offersFor, offerCards, experienceDirectory, experienceSection, planningLinks, rentalSearch, transportSection } from './lib/visitor-planning.mjs';

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
const GOATCOUNTER = cfg.goatcounter ? `<script data-goatcounter="https://${cfg.goatcounter}.goatcounter.com/count" async src="https://gc.zgo.at/count.v5.js" integrity="sha384-atnOLvQb9t+jTSipvd75X2yginT4PjVbqDdlJAmxMm+wYElFmeR6EmLP5bYeoRVQ" crossorigin="anonymous"></script>` : "";
if (process.env.TEST_AFF_OFF) cfg.affiliate = { rakutenAffiliateId: "", valueCommerceSid: "", jalanPid: "", jalanActivityPid: "", amazonTag: "" }; // テスト用(アフィリエイト未設定の状態から確かめる)
if (process.env.TEST_AFFILIATE) cfg.affiliate = { ...cfg.affiliate, amazonTag: process.env.TEST_AFFILIATE };
if (process.env.TEST_AFF_TRAVEL) cfg.affiliate = { ...cfg.affiliate, rakutenAffiliateId: "test.rakuten", valueCommerceSid: VC.sid, jalanPid: VC.stay }; // テスト用(宿のアフィリエイト)
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
  validateCommon(rawRegular, new Set());
  for (const r of rawRegular) {
    if (!r.schedule) errs.push(`[${r.id}] schedule(いつ開催されるか)が空です`);
    if (r.until && !/^\d{4}-\d{2}-\d{2}$/.test(r.until)) errs.push(`[${r.id}] until は YYYY-MM-DD 形式にしてください`);
    // 公演日の計算に使う(今週末・今月のページ)。schedule の文章と、食い違わないように
    const ints = (v, lo, hi) => Array.isArray(v) && v.length > 0 && v.every((n) => Number.isInteger(n) && n >= lo && n <= hi);
    if (r.weekdays != null && !ints(r.weekdays, 0, 6)) errs.push(`[${r.id}] weekdays は、曜日の番号(0=日曜〜6=土曜)の配列にしてください`);
    if (r.months != null && !ints(r.months, 1, 12)) errs.push(`[${r.id}] months は、月(1〜12)の配列にしてください`);
    if (r.closedDates != null && !(Array.isArray(r.closedDates) && r.closedDates.every((d) => /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d)))) errs.push(`[${r.id}] closedDates は "MM-DD" の配列にしてください`);
  }
  if (errs.length) { console.error("データエラー:\n" + errs.map((x) => "  " + x).join("\n")); process.exit(1); }
}

// ---------- 日付: すべて「日本時間の文字列」として扱う(ビルドを行うサーバーの時区に依存させない) ----------
const nowJst = process.env.BUILD_NOW ?? new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16);
const asMs = (s) => Date.parse(`${s}:00Z`);
const isUpcoming = (e) => {
  if (e.timeUnknown) return (e.end || e.start).slice(0, 10) >= nowJst.slice(0, 10);
  const endMs = e.end ? asMs(e.end) : asMs(e.start) + 3 * 3600e3; // 終了時刻なしは開始から3時間を開催中とみなす
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
// 定期公演の「公演日時」: 主な上演を1行目に、かっこ内(開場・受付など)と2文目(ほかの上演日)は小さく別の行に
const scheduleCell = (s) => String(s).split("。").filter(Boolean).map((part, i) => {
  const m = i ? null : part.match(/^(.+?)\((.+)\)$/);
  return i ? `<small class="sched-more">${nobr(esc(part))}</small>` : `<span class="sched-main">${nobr(esc(m ? m[1] : part))}</span>${m ? `<small class="sched-more">${nobr(esc(m[2]))}</small>` : ""}`;
}).join("");
const jpDate = (s) => { const [y, m, d] = s.split("-").map(Number); return `${y}年${m}月${d}日`; };
const events = rawEvents.sort((a, b) => a.start.localeCompare(b.start));
const upcoming = events.filter(isUpcoming);
const regular = rawRegular.filter((r) => !r.until || r.until >= nowJst.slice(0, 10));
const kaguraInfo = existsSync("data/kagura-info.json") ? readJson("data/kagura-info.json") : {};
const prefInfo = existsSync("data/pref-info.json") ? readJson("data/pref-info.json") : {};
// 出典リンクの一覧(外部リンクは、新しいタブで開き、推薦しない旨の rel を付ける)
const refList = (refs = []) => refs.length ? `<p class="meta">参考: ${refs.map((r) => `<a href="${esc(r.url)}" rel="noopener noreferrer" target="_blank">${esc(r.name)}</a>`).join(" / ")}</p>` : "";
// 神楽の種類ページの、くわしい解説(歴史・特徴・演目・観賞のコツ)。データがある項目だけ出す
const kaguraDetail = (k, info) => !(info?.history?.length || info?.features?.length) ? "" : `<section class="detail">${info.history?.length ? `<h2>${esc(k)}の歴史</h2>${info.history.map((t) => `<p>${esc(t)}</p>`).join("")}` : ""}
${info.features?.length ? `<h2>${esc(k)}の特徴</h2><ul>${info.features.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
${info.programs?.length ? `<h2>主な演目</h2><dl>${info.programs.map((x) => `<dt>${esc(x.name)}</dt><dd>${esc(x.text)}</dd>`).join("")}</dl>` : ""}
${info.viewing?.length ? `<h2>観賞のコツ</h2><ul>${info.viewing.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
${refList(info.refs)}</section>`;
// 開催ごとの編集部の解説(data/event-notes.json)。公式情報から調べた事実だけを、出典つきで載せる
const eventNotes = existsSync("data/event-notes.json") ? readJson("data/event-notes.json") : [];
const noteBlock = (e) => {
  const n = eventNotes.find((x) => x.ids.includes(e.id));
  if (!n) return "";
  const local = n.local?.[e.id];
  return `<section class="detail note"><h2>この開催のポイント</h2>${[...(n.paras ?? []), ...(local ? [local] : [])].map((t) => `<p>${esc(t)}</p>`).join("")}<ul>${n.points.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>${refList(n.refs)}</section>`;
};
// 都道府県ページの解説
const prefDetail = (p) => { const i = prefInfo[p]; return i ? `<section class="detail"><h2>${esc(p)}の神楽について</h2>${i.paras.map((t) => `<p>${esc(t)}</p>`).join("")}${refList(i.refs)}</section>` : ""; };
const SEO = cfg.seo ?? {};
// 検索結果の説明文は、全角で80〜120字くらいが、読まれやすい長さ。長すぎるものは、文の切れ目で切る
const clip = (s, n = 118) => { s = String(s).replace(/\s+/g, " ").trim(); if (s.length <= n) return s; const cut = s.slice(0, n); const i = cut.lastIndexOf("。"); return (i > n * 0.5 ? cut.slice(0, i + 1) : cut.slice(0, n - 1) + "…"); };
// 説明文が短すぎる(情報の少ないイベント)ときは、サイトとしての補足を足す
const padDesc = (s) => (s.length >= 70 ? s : clip(`${s}公式情報へのリンクや地図、カレンダー登録つき。出典と確認日も載せています。`));
const ldJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c"); // </script> による構造崩れを防ぐ

// ---------- 収益化 ----------
const a = cfg.affiliate;
// 報酬の出るリンクか(ID が未設定の間は、報酬のない、ふつうのリンクとして動く)。バリューコマースは、サイトID(sid)と、提携先ごとのID(pid)の両方が要る
const vcAllowed = !!(cfg.adsense.client && cfg.cookiebotId); // Existing CSP only; no new hosts or consent bypass.
const rakutenOn = !!a.rakutenAffiliateId, jalanOn = vcEnabled({sid:a.valueCommerceSid,pid:a.jalanPid,allowed:vcAllowed},"stay"), amazonOn = !!a.amazonTag;
const experienceAff = { sid: a.valueCommerceSid, pid: a.jalanActivityPid, allowed:vcAllowed }; // 体験は宿と別案件のpid
const hasAffiliate = rakutenOn || jalanOn || amazonOn || !!(experienceAff.sid && experienceAff.pid) || ['supplies','experiences','rental'].some(category=>offersFor(visitorPlanning,category,{guide:true},nowJst.slice(0,10)).length);
const rakuten = (url) => (rakutenOn ? `https://hb.afl.rakuten.co.jp/hgc/${a.rakutenAffiliateId}/?pc=${encodeURIComponent(url)}&m=${encodeURIComponent(url)}` : url);
const amazon = (kw) => `https://www.amazon.co.jp/s?k=${encodeURIComponent(kw)}${amazonOn ? `&tag=${a.amazonTag}` : ""}`;
// 宿の検索(会場の市区町村で探す)。日付があれば、その日の1泊・大人2名で開く。
// じゃらんはキーワードを Shift_JIS で、楽天トラベルは charset=utf-8 の指定つきで受け取る(どちらも、実際の検索結果で確認済み)
const stayPlace = (x) => (x.city ? x.city.replace(/^.*郡/, "") : x.prefecture);
const jalanStay = (x, day) => {
  const q = [`keyword=${encodeSjisURI(stayPlace(x))}`];
  if (day) q.push(`stayYear=${+day.slice(0, 4)}`, `stayMonth=${+day.slice(5, 7)}`, `stayDay=${+day.slice(8, 10)}`, "stayCount=1", "roomCount=1", "adultNum=2");
  return `https://www.jalan.net/uw/uwp2011/uww2011init.do?${q.join("&")}`;
};
const issuedRakutenStays = createRakutenStayResolver(JSON.parse(readFileSync("data/rakuten-stay-issued.json", "utf8")));
const rakutenStay = (x, day) => {
  const q = ["charset=utf-8", `f_query=${encodeURIComponent(stayPlace(x))}`];
  if (day) { const n = addDays(day, 1); q.push(`f_nen1=${day.slice(0, 4)}`, `f_tuki1=${+day.slice(5, 7)}`, `f_hi1=${+day.slice(8, 10)}`, `f_nen2=${n.slice(0, 4)}`, `f_tuki2=${+n.slice(5, 7)}`, `f_hi2=${+n.slice(8, 10)}`, "f_otona_su=2", "f_heya_su=1"); }
  const destination = `https://kw.travel.rakuten.co.jp/keyword/Search.do?${q.join("&")}`;
  return rakutenOn ? issuedRakutenStays.resolve(destination, rakuten) : destination;
};
// 外部リンク(アフィリエイト)の属性。報酬の出るリンクは sponsored。クリック数は、アクセス解析(GoatCounter)で数える
const affAttrs = (on, name) => `rel="${on ? "sponsored " : ""}noopener" target="_blank" data-goatcounter-click="${esc(name)}" data-goatcounter-title="${esc(name)}"`;
const stayBanners = (id) => stayBannersHtml({ on: { rakuten: rakutenOn, jalan: jalanOn }, id, attrs: affAttrs, esc });
// 今週末・今月のページの宿: 開催がいくつかの県にまたがるため、日付・地域を絞らない宿のバナーだけを出す(提携IDがあるときだけ)
const tripBand = (id, heading) => { const b = stayBanners(id); return b ? `<aside class="aff trip-band" aria-labelledby="${id}-stay-h"><h2 id="${id}-stay-h">${heading}</h2><p class="stay-cond"><span>開催地の近くで探す</span></p>${b}${prNote(true)}</aside>` : ""; };
const prNote = (on) => (on ? `<span class="pr">PR</span><p class="meta annotation">PR: 宿の案内は広告(アフィリエイトリンク)を含みます。</p>` : "");

// 開催ページの宿: 会場の市区町村・開催日の1泊・大人2名の検索結果へ直接つなぐ(バナーは宿のトップへ飛ぶだけなので使わない)。
// 提携IDがあれば、楽天は楽天アフィリエイト(hgc)、じゃらんはバリューコマース(じゃらんnet・MyLink)を経由する。リダイレクト先が同じ検索になることを確認済み(2026-10-25)
const stayLinks = (e, day, place) => {
  const btn = (k, url, name, on) => !on ? "" : k==="jalan" ? vcTag({kind:"stay",destination:url,text:`${place}の宿をじゃらんで探す`,className:"stay-btn",meta:{"data-goatcounter-click":`stay-jalan/${e.id}`}}) : `<a class="stay-btn" href="${esc(url)}" ${affAttrs(on, `stay-${k}/${e.id}`)}>${esc(place)}の宿を${name}で探す</a>`;
  const btns = [btn("jalan", jalanStay(e, day), "じゃらん", jalanOn), btn("rakuten", rakutenStay(e, day), "楽天トラベル", rakutenOn)].join(" ");
  return btns ? `<p class="staylinks">${btns}</p>` : "";
};
/** 開催ページの「会場近くの宿」: 開催日の1泊で、会場の市区町村の宿を探す(これからの開催だけ) */
function stayBlock(e) {
  if (!rakutenOn && !jalanOn) return "";
  const day = e.start.slice(0, 10), place = stayPlace(e);
  const on = rakutenOn || jalanOn;
  // 時刻や日またぎだけでは夜公演と断定できないため、宿の案内は時間帯に依存しない。
  // 枠の中は見出しと宿のボタンだけにする(公演・会場・検索の条件の説明は置かない。2026-10-30 運営者の判断)
  const links = stayLinks(e, day, place);
  return `<aside class="stay" aria-labelledby="stay-h"><h2 id="stay-h">会場周辺の宿</h2>
${links}
<details class="stay-note"><summary>ご注意</summary><p class="meta annotation">${links ? `${jpDate(day)}泊・大人2名で検索します。人数・宿泊日はリンク先で変更できます。` : "宿泊日・人数・地域は、リンク先で指定してください。"}${esc(place)}周辺で、会場からの距離、最終チェックイン、空室・料金を宿の案内で確認してください。</p></details>
${prNote(on)}</aside>`;
}

/** 種類・都道府県・定期公演のページの宿の案内(日付なし)。見出しは、会場が決まっていれば「会場近くの宿」、県・種類のページは「◯◯県の宿」 */
function affiliateBlock(e, { banners = true } = {}) {
  if (!rakutenOn && !jalanOn && !amazonOn) return "";
  const bn = banners ? stayBanners(e.prefecture) : "";
  // 定期公演(バナーなし): じゃらんと楽天トラベルは、開催ページの宿と同じ書き方・同じ枠線のボタンにそろえる
  const place = stayPlace(e);
  const stay = banners ? "" : [
    jalanOn ? vcTag({kind:"stay",destination:jalanStay(e),text:`${place}の宿をじゃらんで探す`,className:"stay-btn",meta:{"data-goatcounter-click":`aff-jalan/${e.prefecture}`}}) : "",
    rakutenOn ? `<a class="stay-btn" href="${esc(rakutenStay(e))}" ${affAttrs(true, `aff-rakuten/${e.prefecture}`)}>${esc(place)}の宿を楽天トラベルで探す</a>` : "",
  ].join("");
  const goods = amazonOn ? `<div class="afflist"><a href="${esc(amazon(e.kagura || "神楽"))}" ${affAttrs(true, `aff-amazon/${e.prefecture}`)}><b>神楽の本・グッズ</b><small>Amazon</small></a></div>` : "";
  return `<aside class="aff"><h2>${e.venue ? "会場近くの宿" : `${esc(e.prefecture)}の宿`}</h2>${stay ? `<p class="staylinks">${stay}</p>` : ""}${goods}${bn}${prNote(!!bn || !!stay || amazonOn)}</aside>`;
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
const ORG_LD = { "@type": "Organization", name: op.name, url: `${cfg.baseUrl}/about.html`, logo: { "@type": "ImageObject", url: `${cfg.baseUrl}/symbol.png`, width: 330, height: 330 } };
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
// メインメニュー: 「探し方」で並べる。[行き先, 表示, このメニューが「今いる場所」になるページ(active の値)]
const NAV = [
  ["/", "開催予定", ["/"]],
  ["/calendar.html", "日付・場所で探す", ["/calendar.html", "/weekend.html", "/this-month.html", "/month/"]],
  ["/map.html", "地図で探す", ["/map.html"]],
  ["/kagura/", "種類で探す", ["/kagura/"]],
  ["/guide.html", "神楽を初めて観る方へ", ["/guide.html"]],
  ["/history/", "神楽の歴史", ["/history/"]],
  ["/organizers.html", "主催者の方へ", ["/organizers.html", "/submit.html"]],
];
const navLink = ([h, t, group], active) => {
  const cur = active === h ? ' aria-current="page"' : group.includes(active) ? ' aria-current="true"' : "";
  return `<a href="${h}"${cur ? ` class="on"${cur}` : ""}>${t}</a>`;
};
// スマホの三本線メニュー: JS が動くときだけ、ボタンを出して、メニューを畳む(JS がなければ、メニューは常に見える)
const NAV_SCRIPT = `(function(){var h=document.documentElement,w=window,q=false;function sc(){q=false;h.classList.toggle('scrolled',(w.pageYOffset||0)>8)}w.addEventListener('scroll',function(){if(!q){q=true;w.requestAnimationFrame(sc)}},{passive:true});sc();var b=document.getElementById('menubtn'),n=document.getElementById('gnav');if(!b||!n)return;document.documentElement.classList.add('navjs');b.hidden=false;function set(o){b.setAttribute('aria-expanded',String(o));n.classList.toggle('open',o)}b.addEventListener('click',function(){set(b.getAttribute('aria-expanded')!=='true')});document.addEventListener('keydown',function(e){if(e.key==='Escape'&&b.getAttribute('aria-expanded')==='true'){set(false);b.focus()}})})()`;
const FONT_URL = "https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500&family=Zen+Kaku+Gothic+New:wght@400;500&display=swap";
const FONT_SCRIPT = `(function(){var l=document.getElementById('gf');if(l)l.addEventListener('load',function(){l.media='all'})})()`;

// 共有用の画像(1200x630)。トップの絵とサイト名から、scripts/make-og.mjs で作って assets/ に置いている
const OG_SIZE = { width: 1200, height: 630 };
const ogUrl = (en) => `${cfg.baseUrl}/${en ? "og-en.jpg" : "og.jpg"}`;
const EN_NAV = [["/en/", "Home", ["/en/"]], ["/en/guide.html", "First-timer's guide", ["/en/guide.html"]], ["/en/kagura.html", "Kagura styles", ["/en/kagura.html"]], ["/en/history.html", "History", ["/en/history.html"]], ["/", "日本語", ["/"]]];
const EN_FOOTER = `<footer><p class="fnote">Event listings are in Japanese, but your browser can translate them.</p><p class="flinks"><a href="/calendar.html" hreflang="ja">Calendar</a><a href="/map.html" hreflang="ja">Map</a></p><p class="flinks"><a href="/about.html" hreflang="ja">About (Japanese)</a><a href="/contact.html" hreflang="ja">Contact (Japanese)</a><a href="/privacy.html" hreflang="ja">Privacy policy (Japanese)</a><a href="/disclaimer.html" hreflang="ja">Disclaimer (Japanese)</a></p><p class="copy">© Kagura Meguri</p></footer>`;
// 出典・注釈・広告の説明(.meta.annotation)は、本文の途中から抜き出し、ページの下部に小さくまとめる。
// 広告そのものの印(リンクの「(広告)」・バッジの「PR」)は、広告の場所に残す。スクリプトの中と、id のある注釈(入力欄の説明)は動かさない
const NOTE_RE = /<p class="meta annotation"(?![^>]*\bid=)[^>]*>([\s\S]*?)<\/p>/g;
// 広告の注記: ページの先頭ではなく、最初の広告の枠(宿・本・体験など)のすぐ上に置く。先頭に置くと、本文より前に毎回大きく出て、雰囲気を壊すため。
// 広告の原本(発行タグ)を1文字も変えないよう、HTMLを作り直さず、元の文字列の位置に差し込む
const VC_DISCLOSURE = '<p class="vc-disclosure"><strong>広告</strong> このページにはアフィリエイト広告が含まれます。じゃらんの広告表示時には外部への通信が発生します。</p>';
const withAdDisclosure = (html) => {
  if (!html.includes("data-vc-ad=")) return html;
  const $ = cheerio.load(html, { sourceCodeLocationInfo: true }, false);
  let el = $('a[rel~="sponsored"], [data-vc-ad], .vc-ad, .pr').first();
  if (!el.length) return VC_DISCLOSURE + html;
  // 本文・右の列の直下(なければページの直下)にある、広告の枠そのものまでさかのぼる
  while (el.parent()[0]?.type === "tag" && !el.parent().is(".d-top, .d-side, .d-rest")) el = el.parent();
  const at = el[0].sourceCodeLocation.startOffset;
  return html.slice(0, at) + VC_DISCLOSURE + html.slice(at);
};
// 公演の説明: 長い文は、スマホで1つの塊にならないよう、2文ずつの段落に分ける(文は変えない)
const descParas = (s = "") => {
  const sentences = String(s).match(/[^。]+。?/g)?.map((x) => x.trim()).filter(Boolean) ?? [];
  if (String(s).length <= 90 || sentences.length < 3) return `<p>${esc(s)}</p>`;
  const out = [];
  for (let i = 0; i < sentences.length; i += 2) out.push(sentences.slice(i, i + 2).join(""));
  return out.map((t) => `<p>${esc(t)}</p>`).join("");
};
// ページ下の注記: ほかの場所(宿の枠の条件、各広告の「PR」「(広告)」の印、免責事項のページ)で伝わっている注意はくり返さない。
// 広告の注記は、ページごとに1行へまとめる(各広告の印と、ページ上の「広告」の注記はそのまま残る)
const NOTE_DROP = [/^営業状況・空き・価格はリアルタイム表示ではありません/, /^会場の公式アクセスと公共交通を先に確認し/, /泊・大人2名で検索します。/, /^掲載情報確認: /, /^県内全域の一覧です。/];
const NOTE_AD = [/^PR: 宿の案内は広告/, /^<span class="pr">広告<\/span>\s*外部サービスの広告です/, /^<span class="pr">PR<\/span>\s*紹介している商品・返礼品のリンクは広告/];
const AD_NOTE = '<span class="pr">広告</span> 宿・交通・体験・商品などのリンクは広告(アフィリエイトリンク)を含みます。予約・購入・寄付で当サイトに報酬が入ることがあります。';
const tidyNotes = (notes) => {
  const plain = (n) => n.replace(/<[^>]+>/g, "");
  let ad = false;
  const kept = notes.filter((n) => {
    if (NOTE_AD.some((re) => re.test(n))) { ad = true; return false; }
    if (NOTE_DROP.some((re) => re.test(plain(n)))) { if (/広告|アフィリエイト/.test(n)) ad = true; return false; }
    return true;
  });
  return ad ? [...kept, AD_NOTE] : kept;
};
const collectNotes = (body) => {
  const notes = [];
  const out = body.split(/(<script[\s\S]*?<\/script>)/).map((part, i) => (i % 2 ? part : part.replace(NOTE_RE, (_, inner) => {
    const t = inner.trim();
    if (t && !notes.includes(t)) notes.push(t);
    return "";
  }).replace(/<details[^>]*><summary>[^<]*<\/summary>\s*<\/details>/g, ""))).join("");
  const shown = tidyNotes(notes);
  return shown.length ? `${out}<section class="page-notes" aria-label="出典・注記・広告について"><h2>出典・注記</h2>${shown.map((n) => `<p>${n}</p>`).join("")}</section>` : out;
};
const layout = ({ title, desc, path, body, ld, head = "", splash = "", active = "", noindex = false, withForm = false, ogType = "website", lang = "ja", alts = [], wide = false }) => {
  const en = lang === "en";
  const quizOffer = !en && !noindex && !withForm && (path === '/' || /^\/(calendar|map|weekend|this-month)\.html$/.test(path) || /^\/(events|regular|pref|month|kagura)\//.test(path));
  // A resource-free VC readiness listener precedes CMP only on VC pages.
  // Cookiebot remains the first external script, synchronous; all rendering/analytics follow it.
  const cookieBotBootstrap = cfg.cookiebotId ? `<script id="Cookiebot" src="https://consent.cookiebot.com/uc.js" data-cbid="${esc(cfg.cookiebotId)}" data-blockingmode="auto" type="text/javascript"></script>` : "";
  // Consent bootstrap also checks the current Cookiebot state, even if its Ready event has fired.
  const ga4Bootstrap = cfg.analyticsId ? `<script data-ga4-id="${esc(cfg.analyticsId)}" data-ga4-host="${esc(new URL(cfg.baseUrl).hostname)}"${cfg.cookiebotId ? ' data-require-statistics-consent=""' : ""}>${GA4_CONSENT_JS}</script>` : "";
  const alternates = alts.length ? [[lang, path], ...alts].map(([l, h]) => `<link rel="alternate" hreflang="${l}" href="${cfg.baseUrl}${h}">`).join("") + `<link rel="alternate" hreflang="x-default" href="${cfg.baseUrl}${[[lang, path], ...alts].find(([l]) => l === "en")[1]}">` : "";
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">${body.includes('data-vc-ad=') ? clientJs("valuecommerce-ready") : ""}${cookieBotBootstrap}${body.includes('data-vc-ad=') ? clientJs("valuecommerce-consent") : ""}<meta name="viewport" content="width=device-width,initial-scale=1">
<script>${FRAME_BUSTER}</script>
<script>${HEAD_MOTION}</script>
<script>${VT_JS}</script><link rel="expect" href="#main" blocking="render">
<meta name="referrer" content="strict-origin-when-cross-origin">${noindex ? '<meta name="robots" content="noindex,follow">' : '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">'}
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${cfg.baseUrl}${path}">${alternates}${SEO.googleVerification ? `<meta name="google-site-verification" content="${esc(SEO.googleVerification)}">` : ""}${SEO.bingVerification ? `<meta name="msvalidate.01" content="${esc(SEO.bingVerification)}">` : ""}
<link rel="alternate" type="application/atom+xml" title="${esc(cfg.siteName)} 新着の開催情報" href="/feed.xml">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="${ogType}"><meta property="og:url" content="${cfg.baseUrl}${path}"><meta property="og:site_name" content="${en ? "Kagura Meguri" : esc(cfg.siteName)}"><meta property="og:locale" content="${en ? "en_US" : "ja_JP"}"><meta property="og:image" content="${ogUrl(en)}"><meta property="og:image:width" content="${OG_SIZE.width}"><meta property="og:image:height" content="${OG_SIZE.height}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${ogUrl(en)}">
<meta name="theme-color" content="#f3eee4" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#171513" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon-48.png" type="image/png" sizes="48x48"><link rel="icon" href="/symbol-96.png" type="image/png" sizes="96x96"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link id="gf" rel="stylesheet" href="${FONT_URL}" media="print"><script>${FONT_SCRIPT}</script><noscript><link rel="stylesheet" href="${FONT_URL}"></noscript>
${ga4Bootstrap}<style>${css}</style>${head}${cfg.adsense.client ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${cfg.adsense.client}" crossorigin="anonymous"></script>` : ""}
${GOATCOUNTER}
${ld ? `<script type="application/ld+json">${ldJson(ld)}</script>` : ""}</head><body>
${splash}<a class="skip" href="#main">${en ? "Skip to content" : "本文へ移動"}</a>
<header class="top"><div class="wrap"><a class="logo" href="${en ? "/en/" : "/"}"><img src="/symbol-96.png" alt="" width="32" height="32">${en ? "Kagura Meguri" : esc(cfg.siteName)}</a><button class="menubtn" id="menubtn" type="button" aria-expanded="false" aria-controls="gnav" hidden><span class="bars" aria-hidden="true"></span>${en ? "Menu" : "メニュー"}</button><nav id="gnav" aria-label="${en ? "Main menu" : "メインメニュー"}">${(en ? EN_NAV : NAV).map((x) => navLink(x, active)).join("")}</nav></div></header><script>${NAV_SCRIPT}</script>
<div class="wrap${wide ? " wide" : ""}"><main id="main">${withAdDisclosure(en ? body : collectNotes(body))}</main>
${en ? EN_FOOTER : `<footer><p class="flinks"><a href="/organizers.html">主催者の方へ(掲載は無料)</a><a href="/guide.html">はじめての神楽ガイド</a><a href="/history/">神楽の歴史</a><a href="/quiz.html">神楽の好み診断</a><a href="/en/" hreflang="en" lang="en">English</a></p>
<p class="flinks"><a href="/about.html">運営者情報</a><a href="/contact.html">お問い合わせ</a><a href="/terms.html">利用規約</a><a href="/privacy.html">プライバシーポリシー</a><a href="/disclaimer.html">免責事項</a></p><p class="copy">© ${esc(cfg.siteName)}</p></footer>`}${cfg.cookiebotId ? cookieControls(en)+clientJs("cookie-controls") : ""}</div>
${quizOffer ? `<aside id="quiz-offer" class="quiz-offer" role="region" aria-labelledby="quiz-offer-title" aria-describedby="quiz-offer-desc" hidden><button type="button" class="linkbtn quiz-close" aria-label="診断の案内を閉じる">閉じる</button><p id="quiz-offer-title">気になる神楽、まだ迷っていますか？</p><p id="quiz-offer-desc">${questions.length}問で、好きな舞の雰囲気を探せます。</p><a class="btn" href="/quiz.html">好みから探す</a></aside>${clientJs('quiz-offer')}` : ''}
${body.includes('class="stay-banner') ? clientJs("ad-fallback") : ""}${body.includes('class="experience-region"') ? clientJs("details-target") : ""}${body.includes('class="guide-layout"') ? clientJs("guide") : ""}${withForm ? `<script>${formScript(cfg)}</script>` : ""}${cfg.analyticsId ? clientJs("affiliate") + clientJs("analytics-events") : ""}<script>${MOTION_JS}</script></body></html>`;
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
const cardFacts = (e) => {
  const fact = (k, v) => `<div><span class="k">${k}:</span><span>${v ? esc(v) : '<span class="tbd">未確認</span>'}</span></div>`;
  const reservation = reservationLabel(e);
  return `<div class="meta event-facts">${fact("会場", e.venue)}${e.fee ? fact("料金", e.fee) : ""}${reservation !== "要確認" ? fact("予約要否", reservation) : ""}</div>`;
};
// 地名と、名前の最後の「(会場名)」は、まとまりの途中で改行しない(.ph)。Safari など文節で折り返せないブラウザ向け
const ph = (s) => `<span class="ph">${esc(s)}</span>`;
const placePh = (pref, city) => [pref, city].filter(Boolean).map(ph).join(" ");
const namePh = (s = "") => { const m = s.match(/^(.+?)([(（][^()（）]+[)）])$/); return m ? esc(m[1]) + ph(m[2]) : esc(s); };
// 「・」で区切る並び: 区切りは各項目の前に置き、行の頭に来たものは枠の外に隠す(行頭・行末に「・」だけが残らない)
const sepList = (items) => { const xs = items.filter(Boolean); return xs.length ? `<span class="sl"><span class="sl-in">${xs.map((x) => `<span>${x}</span>`).join("")}</span></span>` : ""; };
const card = (e, h = "h3", withFacts = true) => {
  const p = parts(e.start);
  return `<div class="card"><div class="date"><small>${p.mo}月</small><b>${p.d}</b><small>${WD[p.wd]}曜</small></div><div>
<${h}><a href="/events/${e.id}.html">${namePh(e.name)}</a></${h}>
<div class="meta">${sepList([sameSeries(e).length ? '<span class="rep">定例開催</span>' : "", e.timeUnknown ? TIME_UNKNOWN : nobr(startTimes(e)), placePh(e.prefecture, e.city), !withFacts && e.fee ? esc(e.fee) : ""])}</div>
${withFacts ? cardFacts(e) : ""}${kaguraTag(e.kagura)}</div></div>`;
};
const regCard = (r) => `<div class="card reg"><div class="date"><small>定期</small><b>${esc(r.badge || "毎")}</b></div><div>
<h3><a href="/regular/${r.id}.html">${namePh(r.name)}</a></h3>
<div class="meta">${sepList([nobr(esc(r.schedule)), placePh(r.prefecture, r.city)])}</div>
${cardFacts(r)}${kaguraTag(r.kagura)}</div></div>`;
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
const lastmodOf = (list) => list.map((x) => x.checked).filter(Boolean).sort().pop() ?? nowJst.slice(0, 10);
// パンくずの構造化データ: items = [[名前, パス], ..., [名前]](最後だけパスなし)
const crumbsLd = (items) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map(([name, p], i) => ({ "@type": "ListItem", position: i + 1, name, ...(p ? { item: `${cfg.baseUrl}${p}` } : {}) })) });
const listNames = (arr, n = 3) =>arr.slice(0, n).map((x) => x.name.replace(/\s*[(〈].*$/, "")).join("、");
const sourceNote = (x) => {
  if (!x.source && !x.checked && !x.auto) return "";
  const day = x.checked ?? x.lastSeen; // 自動取得したものは、最後に取得元で確認できた日
  return `<p class="meta annotation">出典: ${esc(x.source ?? "")}${day ? `(${jpDate(day)}${x.auto ? "取得" : "確認"})` : ""}</p>`;
};
// Googleカレンダーで、全開催の日程(events.ics)を購読する画面を開くリンク(URLで追加 = 新しい開催も、自動で反映される)
const GCAL_SUBSCRIBE = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(`webcal://${cfg.domain}/events.ics`)}`;
// 新しい解説を作らず、既存ガイドの該当章と、その公演の地図へ案内する。
const preparationLinks = () => `<nav class="viewing-preparation" aria-label="観覧前の準備"><span class="meta">観覧前に確認: </span><a class="tag" href="/guide.html#prepare">服装・持ち物・交通</a><a class="tag" href="/guide.html#check">日程・予約の確認</a></nav>`;
// 会場の欄: 会場名の下に、所在地(都道府県・市区町村・番地)と地図への案内をまとめる(「所在地」の行と「会場の場所」の見出しを統合)
// Google マップで、会場の場所と経路を探す(公演ページには地図を置かず、ここへ案内する)
const mapsUrl = (x) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${x.venue ?? ""} ${x.prefecture}${x.city ?? ""}`.trim())}`;
// 要点の表で分からない欄は「未確認」と短く書き、確認のお願いは表の下に1回だけ置く
const unknownAs = (v) => (v === "要確認" ? "未確認" : v);
const unknownNote = (on) => (on ? `<p class="unknown-note">未確認の項目は、お出かけ前に公式情報でご確認ください。</p>` : "");
const venueCell = (x, fallback = "未確認") => `${x.venue ? esc(x.venue) : fallback}<span class="addr">${esc([x.prefecture, x.city, x.address].filter(Boolean).join(" "))}</span>${x.lat != null ? `<a class="tomap" href="${mapsUrl(x)}" target="_blank" rel="noopener">地図・経路を見る</a>` : ""}`;
// ---------- 今週末・今月(日付で中身が変わる。deploy.yml が毎日、作り直す) ----------
const today = nowJst.slice(0, 10);
const moreOffers = createMoreOfferIndex(moreOffersData, today);
const onDay = (e, d) => e.start.slice(0, 10) <= d && (e.end || e.start).slice(0, 10) >= d;
const timeOf = (r) => (r.schedule.match(/\d{1,2}:\d{2}/)?.[0] ?? "99:99").padStart(5, "0");
const daysBetween = (a, b) => { const out = []; for (let d = a; d <= b; d = addDays(d, 1)) out.push(d); return out; };
const maxDay = (...xs) => xs.flat().filter(Boolean).sort().pop();
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

rmSync(OUT, { recursive: true, force: true });

// クライアント用の軽量データ (地図・日付と場所の検索)
const lite = events.map((e) => { const { id, name, kagura, prefecture, city, venue, description, start, end, lat, lng, fee, timeUnknown } = e; return { id, name, kagura, prefecture, city, venue, description, reservation: reservationLabel(e), start, end, lat, lng, fee, timeUnknown, up: isUpcoming(e) }; });
write("dist/events.json", JSON.stringify(lite));
write("dist/regular.json", JSON.stringify(regular.map(({ id, name, kagura, prefecture, city, venue, schedule, lat, lng }) => ({ id, name, kagura, prefecture, city, venue, schedule, lat, lng }))));

const PREF_ORDER = REGIONS.flatMap(([, ps]) => ps);
const byPref = (a, b) => PREF_ORDER.indexOf(a) - PREF_ORDER.indexOf(b);
const prefs = [...new Set([...upcoming, ...regular].map((e) => e.prefecture))].sort(byPref);
const kaguraPref = (k) => [...events, ...regular].find((e) => e.kagura === k)?.prefecture ?? "";
const kaguraCount = (k) => [...upcoming, ...regular].filter((e) => e.kagura === k).length;
const kaguras = [...new Set([...events, ...regular].map((e) => e.kagura).filter(Boolean))]
  .sort((a, b) => byPref(kaguraPref(a), kaguraPref(b)) || kaguraCount(b) - kaguraCount(a) || a.localeCompare(b, "ja"));

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
let homeIdx = 0;
const homeList = homeMonths.map((k) => {
  const list = monthMap.get(k);
  const rows = list.map((e) => { const ov = homeIdx++ >= HOME_CAP; return `<div data-r="${regionOf(e.prefecture)}" data-p="${esc(e.prefecture)}"${ov ? ' class="ov" hidden' : ""}>${card(e, "h4")}</div>`; });
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
  desc: clip(`今週末、どこで神楽が観られる？${[...new Set([...["石見神楽", "高千穂神楽", "広島神楽", "備中神楽"].filter((k) => kaguras.includes(k)), ...kaguras])].slice(0, 3).join("・")}など、全国の神楽の日程と会場を、日付・場所・地図で探せます。掲載しているのは、公式情報で確かめた開催だけです。`),
  path: "/", active: "/", alts: [["en", "/en/"]],
  // サイト名: 検索結果に、ドメイン名ではなく「神楽めぐり」と出すための情報(トップページの WebSite)
  ld: [{ "@context": "https://schema.org", "@type": "WebSite", name: cfg.siteName, alternateName: ["かぐらめぐり", "Kagura Meguri"], url: `${cfg.baseUrl}/`, inLanguage: "ja", description: cfg.description, publisher: ORG_LD },
    itemListLd("開催予定の神楽", upcoming.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })))].filter(Boolean),
  // オープニング(最初の訪問だけ、ロゴが現れて消える)。main の外に置く(main は出現の動きで translate するため、fixed の基準が main になってしまう)
  splash: `<div class="splash" aria-hidden="true"><img src="/symbol.png" width="96" height="96" alt=""><b>${esc(cfg.siteName)}</b></div>`,
  body: `<section class="home-discovery" aria-label="神楽の公演を探す">
<p class="discovery-title">全国の神楽、公演日程を探す</p>
<nav class="quick" aria-label="日付から探す"><a href="/weekend.html"><b>今週末の神楽</b></a><a href="/this-month.html"><b>今月の神楽</b></a><a href="/calendar.html"><b>日付・場所で探す</b></a></nav>
</section>
<section class="hero home-hero">
<picture class="hero-art"><source media="(max-width: 640px)" srcset="/hero-sp.webp" width="1122" height="1402"><img src="/hero-pc.webp" width="1774" height="887" alt="夜の神楽殿で、鬼の面をつけた舞い手が御幣を掲げて舞う水彩画" fetchpriority="high" decoding="async"></picture>${sparksHtml}
<div class="copy"><h1>${HERO_H1}</h1></div>
<div class="vert" aria-hidden="true">笛と太鼓、夜の社に舞う</div></section>
<h2>開催予定</h2>
${regionButtons}${prefButtons}
${adSlot(cfg.adsense.slotList)}
<div id="list">${homeList || empty('いま掲載している開催情報はありません。掲載のご依頼は<a href="/organizers.html">主催者の方へ</a>から送れます。')}</div>
${showAll}
<p class="empty" id="none" hidden>この地域の${laterMonths.length ? "、近いうちの開催はありません。この先の開催は、下の月から探せます" : "開催予定は、いまのところありません"}。</p>
${laterLinks}
<section class="planning-section" aria-labelledby="home-planning-h"><p class="planning-eyebrow">気になる公演が見つかったら</p><h2 id="home-planning-h">神楽へ出かける準備をしよう</h2>${planningLinks({},today)}</section>
${regular.length ? `<h2>毎週・毎晩の定期公演</h2><div class="reglist">${regular.map(regCard).join("")}</div>${regular.length > 3 ? `<p class="more" hidden><button type="button" class="btn ghost sm" id="regmore">定期公演をすべて見る(${regular.length}件)</button></p>` : ""}` : ""}
${prefs.length ? `<h2>都道府県で探す</h2><div class="taglist">${prefs.map((p) => `<a class="tag" href="${prefHref(p)}">${esc(p)}</a>`).join("")}</div>` : ""}
${kaguras.length ? `<h2>種類で探す</h2><div class="taglist">${kaguras.map((k) => kaguraTag(k)).join("")}</div>` : ""}
${clientJs("home")}`,
}));

// PLAN-004: 回答はブラウザ内のみ。おすすめは神楽の種類(出典つきの解説ページ)と、その種類の公演。演目の上演は約束しない。
const quizTraditions = traditions.map(t => {
  const info = kaguraInfo[t.kind];
  if(!info?.source) throw new Error(`quiz: 出典のない種類 ${t.kind}`);
  const evidence = t.evidence.map(([feature,path]) => {
    const text = path.split('.').reduce((v,k)=>v?.[k],info);
    if(!features[feature] || typeof text !== 'string' || !text) throw new Error(`quiz: 根拠不足 ${t.kind}/${path}`);
    return {feature,path,text};
  });
  return {kind:t.kind,href:kaguraHref(t.kind),source:info.source,evidence};
});
const quizKindNames = new Set(traditions.map(t=>t.kind));
const quizEvents = upcoming.filter(e=>quizKindNames.has(e.kagura)).map(e=>({id:e.id,name:e.name,start:e.start,end:e.end,timeUnknown:e.timeUnknown,sessions:e.sessions,when:whenOf(e),prefecture:e.prefecture,place:[e.prefecture,e.city].filter(Boolean).join(' '),kind:e.kagura}));
const quizRegular = regular.filter(r=>quizKindNames.has(r.kagura)).map(r=>({id:r.id,name:r.name,schedule:r.schedule,prefecture:r.prefecture,until:r.until,kind:r.kagura}));
const quizData = JSON.stringify({questions,features,traditions:quizTraditions,prefectures:REGIONS.flatMap(([,ps])=>ps),events:quizEvents,regular:quizRegular}).replace(/</g,'\\u003c');
const quizJs = lf(readFileSync('scripts/client/quiz.js','utf8')).replace('/* quizEngine */',quizEngine.toString());
write('dist/quiz.html',layout({
  title:`あなたが惹かれる神楽はどれ？${questions.length}問の好み診断 | ${cfg.siteName}`,
  desc:padDesc(`${questions.length}問に答えて、舞の動き・面や衣装・物語・雰囲気から自分の好みを探してみませんか。好みと任意の観覧条件から、神楽の楽しみ方と開催情報をご案内します。登録不要で、回答はブラウザ内だけで計算します。`),
  path:'/quiz.html',ld:crumbsLd([['ホーム','/'],['神楽の好み診断']]),
  body:`${crumbNav([['ホーム','/'],['神楽の好み診断']])}${hero('あなたが惹かれる神楽はどれ？',`${questions.length}問で、好きな舞の雰囲気を探してみませんか。好み${questions.filter(q=>q.type==='preference').length}問と、任意の観覧条件${questions.filter(q=>q.type!=='preference').length}問。分からない項目はそのままで大丈夫です。`)}
<section id="quiz" aria-label="${questions.length}問の神楽好み診断"><button type="button" class="btn" id="quiz-start" hidden>${questions.length}問の診断をはじめる</button>
<noscript><p>診断にはJavaScriptが必要です。<a href="/calendar.html">公演を探す</a>・<a href="/guide.html">はじめての神楽ガイド</a>もご利用ください。</p></noscript>
<form id="quiz-form" hidden><p id="quiz-progress" aria-live="polite"></p><fieldset id="quiz-field"></fieldset><p id="quiz-error" role="alert"></p><div class="quiz-actions"><button type="button" class="btn ghost" id="quiz-back">前へ戻る</button><button type="submit" class="btn" id="quiz-next">次へ</button></div></form>
<section id="quiz-result" aria-label="おすすめの結果" hidden></section></section>
<p class="meta annotation">登録不要。回答は保存・外部送信しません。</p>
<script id="quiz-data" type="application/json">${quizData}</script><script>${quizJs}</script>`
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
  const item = (x) => (x.start
    ? `<span class="md">${esc(mdw(x.start.slice(0, 10)))}</span><a href="/events/${x.id}.html">${esc(x.name)}</a>`
    : `<span class="md">定期公演</span><a href="/regular/${x.id}.html">${esc(x.name)}</a> <span class="meta">${esc(x.schedule.replace(/[(。].*$/, "").trim())}</span>`);
  // 県ごとに折りたたむ(長い一覧を、開いた県だけ見せる)
  const prefsIn = [...new Set(list.map((g) => g.pref))];
  const venue = (g) => `<li><button type="button" class="vjump" data-k="${esc(`${g.pref}|${g.city}|${g.venue}`)}" disabled>${esc(g.venue || g.city)}</button><span class="meta"> ${esc(g.pref)}${esc(g.city)}</span><ul class="vitems">${g.items.map((x) => `<li>${item(x)}</li>`).join("")}</ul></li>`;
  return `<h2>会場の一覧</h2><p class="meta">会場名を押すと、地図がその場所へ移動します。</p>${prefsIn.map((p) => { const gs = list.filter((g) => g.pref === p); return `<details class="rgroup"><summary>${esc(p)} <span class="meta">${gs.length}会場</span></summary><ul class="venuelist">${gs.map(venue).join("")}</ul></details>`; }).join("")}`;
};
write("dist/map.html", layout({
  title: `神楽の開催地マップ | 会場を地図で探す | ${cfg.siteName}`,
  desc: clip(`これから開催される神楽と、毎晩・毎週の定期公演の会場を地図で探せます。${[...new Set([...upcoming, ...regular].map((e) => e.prefecture))].slice(0, 5).join("・")}など、${upcoming.length + regular.length}件の会場を掲載しています。`),
  path: "/map.html", active: "/map.html",
  head: LEAFLET,
  ld: [crumbsLd([["ホーム", "/"], ["地図で探す"]]), itemListLd("神楽の開催会場", [...upcoming.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })), ...regular.map((r) => ({ href: `/regular/${r.id}.html`, name: r.name }))])].filter(Boolean),
  body: `${crumbNav([["ホーム", "/"], ["地図で探す"]])}${hero("地図で探す", "これから開催される神楽と、定期公演の会場を地図で探せます。")}<div class="mapbox"><div id="map" role="region" aria-label="開催場所の地図"></div><button type="button" class="maplock" id="maplock" aria-pressed="false" hidden>地図を動かす</button></div>
<p class="legend meta"><span><span class="pin ev"></span>日付のある開催</span><span><span class="pin reg"></span>定期公演</span><span><span class="pin mix"></span>両方</span><span>数字は、同じ場所での件数です。</span></p>
<p class="meta" id="mapmsg" aria-live="polite"></p>
<p class="meta">地図: <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院(淡色地図)</a></p>${adSlot(cfg.adsense.slotList)}
${venueList()}
${clientJs("map")}`,
}));

// ---------- 日付・場所で探す(/calendar.html。URL は前のカレンダーのまま) ----------
// 「いつ」(今週末・今月・来月・日付の範囲)と「どこ」(地方 → 都道府県)で、開催予定を絞り込む。条件は URL に残す(共有・戻るで同じ結果)
const finderPrefs = REGIONS.map(([r, ps]) => [r, ps.filter((p) => upcoming.some((e) => e.prefecture === p))]).filter(([, ps]) => ps.length);
write("dist/calendar.html", layout({
  title: `日付・場所で神楽を探す | 開催日程の検索 | ${cfg.siteName}`,
  desc: clip(`神楽の開催予定を、公演名・会場・市町村・出演団体のキーワードと日付・地域で絞り込めます。公式情報をもとに日程を掲載しています。`),
  path: "/calendar.html", active: "/calendar.html", ld: crumbsLd([["ホーム", "/"], ["日付・場所で探す"]]),
  body: `${crumbNav([["ホーム", "/"], ["日付・場所で探す"]])}${hero("日付・場所で探す", "公演名や会場のキーワード、日付・地域を組み合わせて探せます。")}
<form class="finder" id="finder" role="search" aria-label="開催を探す" hidden>
<div class="ftabs" role="tablist" aria-label="探し方"><button type="button" role="tab" id="tab-dp" aria-controls="panel-dp" aria-selected="true">日付・場所で探す</button><button type="button" role="tab" id="tab-kw" aria-controls="panel-kw" aria-selected="false" tabindex="-1">キーワードで探す</button></div>
<div class="fpanel" role="tabpanel" id="panel-dp" aria-labelledby="tab-dp">
<fieldset><legend>いつ</legend><div class="regions" role="group" aria-label="期間"><button type="button" data-w="all" aria-pressed="true">すべて</button><button type="button" data-w="weekend" aria-pressed="false">今週末</button><button type="button" data-w="month" aria-pressed="false">今月</button><button type="button" data-w="next" aria-pressed="false">来月</button><button type="button" data-w="range" aria-pressed="false">日付を指定</button></div>
<div class="range" id="range" hidden><label><input type="date" id="from" aria-label="いつから"> から</label><label><input type="date" id="to" aria-label="いつまで"> まで</label></div></fieldset>
<fieldset><legend>どこ</legend><div class="where"><label for="region" class="sr">地方</label><select id="region"><option value="">全国</option>${finderPrefs.map(([r]) => `<option value="${r}">${r}</option>`).join("")}</select>
<label for="pref" class="sr">都道府県</label><select id="pref"><option value="">すべての都道府県</option>${finderPrefs.map(([r, ps]) => ps.map((p) => `<option value="${p}" data-r="${r}">${p}</option>`).join("")).join("")}</select></div></fieldset>
</div>
<div class="fpanel keyword" role="tabpanel" id="panel-kw" aria-labelledby="tab-kw" hidden><label for="keyword">キーワード</label><input type="search" id="keyword" name="q" maxlength="100" placeholder="公演名・会場・市町村・神楽団名" aria-describedby="keyword-help"><p class="meta" id="keyword-help">スペースで区切ると、複数の言葉で絞り込めます。</p></div>
<p class="freset" hidden><button type="button" class="linkbtn" id="reset">条件をリセット</button></p>
</form>
<p class="count" id="count" aria-live="polite"></p>
<div class="results" id="results" aria-label="当てはまる開催"></div>
<div id="weekend-empty" hidden><p><a class="btn" href="/weekend.html">今週末の定期公演の案内も見る</a></p><p class="meta">定期公演は別の一覧で案内しています。地域・日程と主催者の最新案内を確認してください。</p></div>
<p class="meta">毎晩・毎週の定期公演は、<a href="/weekend.html">今週末の神楽</a>・<a href="/this-month.html">今月の神楽</a>のページにまとめています。</p>
${adSlot(cfg.adsense.slotList)}
${months.length ? `<h2>月ごとの一覧</h2>${monthLinks()}` : ""}
<p><a class="btn ghost gcal" href="${GCAL_SUBSCRIBE}" target="_blank" rel="noopener">すべての開催をGoogleカレンダーに追加</a></p>
<p class="meta">新しい開催も自動で反映されます。</p>
<script>
(function(){
var f=document.getElementById('finder'),out=document.getElementById('results'),cnt=document.getElementById('count');
var rg=document.getElementById('region'),pf=document.getElementById('pref'),fr=document.getElementById('from'),to=document.getElementById('to'),rangeBox=document.getElementById('range'),rs=document.getElementById('reset');
var kw=document.getElementById('keyword');
function normalize(v){return String(v||'').normalize('NFKC').toLowerCase().trim()}
var list=[],loaded=false,failed=false,when='all',tab='dp',regionOf={};
var tabs=[].slice.call(f.querySelectorAll('[role=tab]'));
function setTab(v,focus){tab=v;tabs.forEach(function(t){var on=t.id==='tab-'+v;t.setAttribute('aria-selected',String(on));t.tabIndex=on?0:-1;document.getElementById(t.getAttribute('aria-controls')).hidden=!on;if(on&&focus)t.focus()})}
[].forEach.call(pf.options,function(o){if(o.value)regionOf[o.value]=o.dataset.r});
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var p2=function(n){return String(n).padStart(2,'0')};
var ymd=function(d){return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())};
var WD=['日','月','火','水','木','金','土'];
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
// 地方を選ぶと、都道府県の選択肢を、その地方だけにする
function syncPrefs(){
  [].forEach.call(pf.options,function(o){if(o.value)o.hidden=o.disabled=!!rg.value&&o.dataset.r!==rg.value});
  if(pf.value&&regionOf[pf.value]!==rg.value&&rg.value)pf.value='';
}
function draw(){
  var sp=span(),a=sp[0],b=sp[1],words=normalize(kw.value).split(/\\s+/).filter(Boolean);
  var hit=list.filter(function(x){
    if(!x.up)return false;
    var s=x.start.slice(0,10),e=(x.end||x.start).slice(0,10);
    if(tab==='kw'){var text=normalize([x.name,x.kagura,x.prefecture,x.city,x.venue,x.description].join(' '));return words.every(function(w){return text.indexOf(w)>=0})}
    if(a&&e<a)return false;if(b&&s>b)return false;
    if(pf.value)return x.prefecture===pf.value;
    if(rg.value)return regionOf[x.prefecture]===rg.value;
    return true;
  });
  // 月ごとに折りたたむ(最初の月だけ開く)
  var groups=[],byM={};hit.forEach(function(x){var m=x.start.slice(0,7);if(!byM[m]){byM[m]=[];groups.push(m)}byM[m].push(x)});
  out.innerHTML=groups.map(function(m,i){return '<details class="rgroup"'+(i?'':' open')+'><summary>'+(+m.slice(0,4))+'年'+(+m.slice(5,7))+'月 <span class="meta">'+byM[m].length+'件</span></summary><ol class="monthlist">'+byM[m].map(row).join('')+'</ol></details>'}).join('');
  function row(x){var d=new Date(+x.start.slice(0,4),+x.start.slice(5,7)-1,+x.start.slice(8,10));
    return '<li><span class="md">'+(d.getMonth()+1)+'月'+d.getDate()+'日<small>('+WD[d.getDay()]+')</small></span><span><a href="/events/'+esc(x.id)+'.html">'+esc(x.name)+'</a><span class="meta"><span class="sl"><span class="sl-in">'+(x.kagura?'<span>'+esc(x.kagura)+'</span>':'')+'<span>'+esc(x.prefecture)+esc(x.city||'')+'</span>'+(x.timeUnknown?'':'<span><span class="nw">'+x.start.slice(11,16).replace(/^0/,'')+'〜</span></span>')+'</span></span></span><span class="meta comparison-facts"><span><span class="k">会場:</span><span>'+(x.venue?esc(x.venue):'<span class="tbd">未確認</span>')+'</span></span>'+(x.fee?'<span><span class="k">料金:</span><span>'+esc(x.fee)+'</span></span>':'')+(x.reservation&&x.reservation!=='要確認'?'<span><span class="k">予約要否:</span><span>'+esc(x.reservation)+'</span></span>':'')+'</span></span></li>'}
  cnt.textContent=failed?'開催情報を読み込めませんでした。時間をおいて再読み込みしてください。':!loaded?'読み込んでいます…':hit.length?'当てはまる開催 '+hit.length+'件':'条件に合う日付付きの公演情報は、現在掲載されていません。キーワードを短くするか、期間・地域を広げて探してみてください。';
  document.getElementById('weekend-empty').hidden=!(loaded&&!failed&&!hit.length&&tab==='dp'&&when==='weekend');
  var q=new URLSearchParams();if(tab==='kw'){if(kw.value.trim())q.set('q',kw.value.trim())}else{if(when!=='all')q.set('when',when);if(when==='range'){if(fr.value)q.set('from',fr.value);if(to.value)q.set('to',to.value)}if(rg.value)q.set('region',rg.value);if(pf.value)q.set('pref',pf.value)}
  var s=q.toString();try{history.replaceState(null,'',location.pathname+(s?'?'+s:''))}catch(e){}
  rs.parentNode.hidden=!s;
}
function setWhen(v){when=v;[].forEach.call(f.querySelectorAll('[data-w]'),function(b){b.setAttribute('aria-pressed',String(b.dataset.w===v))});rangeBox.hidden=v!=='range'}
f.addEventListener('click',function(ev){var t=ev.target.closest('[role=tab]');if(t){setTab(t.id.slice(4));draw();if(tab==='kw')kw.focus();return}var b=ev.target.closest('[data-w]');if(!b)return;setWhen(b.dataset.w);draw();if(when==='range'&&!fr.value){fr.focus();try{fr.showPicker()}catch(e){}}});
rs.addEventListener('click',function(){setWhen('all');rg.value='';pf.value='';fr.value='';to.value='';kw.value='';syncPrefs();draw();(tab==='kw'?kw:f.querySelector('[data-w=all]')).focus()});
f.querySelector('[role=tablist]').addEventListener('keydown',function(ev){if(ev.key!=='ArrowLeft'&&ev.key!=='ArrowRight')return;ev.preventDefault();setTab(tab==='dp'?'kw':'dp',true);draw()});
kw.addEventListener('input',function(ev){if(!ev.isComposing)draw()});
kw.addEventListener('compositionend',draw);
rg.addEventListener('change',function(){syncPrefs();draw()});
pf.addEventListener('change',function(){if(pf.value)rg.value=regionOf[pf.value];syncPrefs();draw()});
fr.addEventListener('change',function(){if(to.value&&fr.value&&to.value<fr.value)to.value=fr.value;draw()});
to.addEventListener('change',function(){if(fr.value&&to.value&&fr.value>to.value)fr.value=to.value;draw()});
f.addEventListener('submit',function(ev){ev.preventDefault();draw()});
// URL の条件を戻す(共有されたリンク・戻る)
var u=new URLSearchParams(location.search),okDate=function(v){return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v||'')};
kw.value=(u.get('q')||'').slice(0,100);if(kw.value)setTab('kw');
if(['weekend','month','next','range'].indexOf(u.get('when'))>=0)setWhen(u.get('when'));
if(okDate(u.get('from')))fr.value=u.get('from');if(okDate(u.get('to')))to.value=u.get('to');
if(u.get('region')&&[].some.call(rg.options,function(o){return o.value&&o.value===u.get('region')}))rg.value=u.get('region');
if(regionOf[u.get('pref')]){pf.value=u.get('pref');rg.value=regionOf[pf.value]}
syncPrefs();draw();
fetch('/events.json').then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(l){list=l.sort(function(a,b){return a.start<b.start?-1:a.start>b.start?1:0});loaded=true;draw()}).catch(function(){failed=true;draw()});
})();
</script>`,
}));

// ---------- 神楽の種類 一覧 + 個別 ----------
write("dist/kagura/index.html", layout({
  title: `神楽の種類一覧 | 流派・系統ごとに探す | ${cfg.siteName}`,
  desc: clip(`${kaguras.slice(0, 5).join("、")}など、神楽の種類ごとに開催日程と定期公演を探せます。それぞれの特徴もあわせて紹介しています。`),
  path: "/kagura/", active: "/kagura/", alts: [["en", "/en/kagura.html"]],
  ld: crumbsLd([["ホーム", "/"], ["種類で探す"]]),
  body: `${crumbNav([["ホーム", "/"], ["種類で探す"]])}${hero("種類で探す", "流派や系統ごとに、開催情報を探せます。")}<h2 class="sr">神楽の種類の一覧</h2>${kaguras
    .map((k) => `<div class="card"><div><h3><a href="${kaguraHref(k)}">${esc(k)}</a></h3>${kaguraInfo[k]?.tagline ? `<p class="tagline">${esc(kaguraInfo[k].tagline)}</p>` : ""}<div class="meta">${countLine(upcoming.filter((e) => e.kagura === k).length, regular.filter((r) => r.kagura === k).length)}</div></div></div>`)
    .join("") || empty("掲載中の神楽の種類は、まだありません。")}${adSlot(cfg.adsense.slotList)}`,
}));
// タイトルに入れる年(「◯◯神楽 2026」のような検索に合わせる)。これからの開催の年の範囲。なければ今年
const yearsOf = (list) => { const ys = [...new Set(list.map((e) => e.start.slice(0, 4)))].sort(); const y = ys.length ? ys : [nowJst.slice(0, 4)]; return y.length > 1 ? `${y[0]}〜${y[y.length - 1]}年` : `${y[0]}年`; };
for (const k of kaguras) {
  const list = upcoming.filter((e) => e.kagura === k), reg = regular.filter((r) => r.kagura === k);
  const first = [...events, ...regular].find((e) => e.kagura === k);
  const info = kaguraInfo[k];
  const when = list.length ? `${monthLabel(ym(list[0].start))}〜${monthLabel(ym(list[list.length - 1].start))}の開催${list.length}件` : "";
  write(`dist/kagura/${k}.html`, layout({
    title: `${k}の日程【${yearsOf(list)}】公演・開催情報 | ${cfg.siteName}`,
    desc: clip(k === "庄内神楽" ? `${k}の日程。${upcomingSummaryDescription(list, { formatWhen: whenOf })}` : `${k}の公演日程・会場・料金をまとめています。${when ? when + "、" : ""}${reg.length ? "定期公演" + reg.length + "件。" : ""}${info ? info.intro : ""}`),
    path: kaguraHref(k), active: "/kagura/", noindex: list.length + reg.length === 0,
    ld: [crumbsLd([["ホーム", "/"], ["種類で探す", "/kagura/"], [k]]), itemListLd(`${k}の開催情報`, [...list.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })), ...reg.map((r) => ({ href: `/regular/${r.id}.html`, name: r.name }))])].filter(Boolean),
    body: `${crumbNav([["ホーム", "/"], ["種類で探す", "/kagura/"], [k]])}${hero(esc(k), countLine(list.length, reg.length))}
${info?.tagline ? `<p class="lead kagura-lead">${esc(info.tagline)}</p>` : ""}
${k === "庄内神楽" ? upcomingSummary(list, { formatWhen: whenOf }) : ""}${list.length ? `<h2>開催予定</h2>${list.map((e) => card(e)).join("")}` : ""}${reg.length ? `<h2>毎週・毎晩の定期公演</h2>${reg.map(regCard).join("")}` : ""}${list.length + reg.length ? "" : empty("現在の開催予定はありません。")}
${affiliateBlock({ prefecture: first.prefecture, city: "", kagura: k })}${adSlot(cfg.adsense.slotList)}
${info ? `<section class="about"><h2>${esc(k)}とは</h2><p>${esc(info.intro)}</p><p class="meta">出典: ${esc(info.source)}</p></section>` : ""}
${kaguraDetail(k, info)}
${learnBlock(moreOffers, { kagura: k }, today, "kagura_learn")}${furusatoBlock(moreOffers, { prefecture: first.prefecture, towns: [...list, ...reg].map((x) => x.city) }, today, "kagura_furusato")}`,
  }));
}

// ---------- 都道府県ページ ----------
for (const p of [...new Set([...events, ...regular].map((e) => e.prefecture))]) {
  const list = events.filter((e) => e.prefecture === p && isUpcoming(e)), reg = regular.filter((r) => r.prefecture === p);
  const kinds = [...new Set([...list, ...reg].map((x) => x.kagura).filter(Boolean))];
  // 広島県: 開催月へのリンクと月別見出しで公演を探しやすくする。
  const isHiroshima = p === "広島県";
  // 広島県の冒頭: 公演はすぐ下の月別のカードで見せる(同じ公演を箇条書きで重ねない)。掲載範囲の注意と、定期公演への近道だけ
  const upcomingIntro = isHiroshima ? `<section class="pref-upcoming" aria-label="掲載の範囲と定期公演"><p>掲載分の日程です。県内のすべての公演ではありません。${reg.length ? '<a href="#hiroshima-regular">定期公演の曜日・受付方法を見る</a>' : ''}</p></section>` : '';
  const monthKeys = [...new Set(list.map((e) => e.start.slice(0, 7)))];
  const monthLinks = monthKeys.map((key) => `<a class="tag" href="#hiroshima-${key}">${esc(monthLabel(key))}(${list.filter((e) => e.start.startsWith(key)).length}件)</a>`).join("");
  const monthNavigation = isHiroshima && monthKeys.length
    ? `<nav class="pref-month-nav" aria-label="広島県の神楽公演を開催月から探す"><span class="meta">開催月から探す</span>${monthLinks}${hasAffiliate ? `<a class="tag" href="#hiroshima-stay">遠方からの宿探し</a>` : ""}</nav>`
    : "";
  const scheduleHtml = isHiroshima && list.length
    ? monthKeys.map((key) => `<section class="pref-month" aria-labelledby="hiroshima-${key}"><h2 id="hiroshima-${key}">${esc(monthLabel(key))}の開催予定</h2><p class="meta"><a href="/month/${key}.html">${esc(monthLabel(key))}の全国日程を見る</a></p>${list.filter((e) => e.start.startsWith(key)).map((e) => card(e, "h3", true)).join("")}</section>`).join("")
    : list.length ? `<h2>開催予定</h2>${list.map((e) => card(e)).join("")}` : "";
  const stayHtml = isHiroshima
    ? `<div id="hiroshima-stay" class="pref-stay">${affiliateBlock({ prefecture: p, city: "", kagura: "神楽" })}</div>`
    : affiliateBlock({ prefecture: p, city: "", kagura: "神楽" });
  write(`dist/pref/${p}.html`, layout({
    title: `${p}の神楽 日程【${yearsOf(list)}】開催・会場一覧 | ${cfg.siteName}`,
    desc: clip(`${p}で開催される神楽の日程と会場をまとめています。${isHiroshima ? "公式情報をもとに、直近・月別スケジュールと予約方法をご案内。" : ""}${list.length ? "開催予定" + list.length + "件" : ""}${reg.length ? (list.length ? "、" : "") + "定期公演" + reg.length + "件" : ""}。${kinds.length ? kinds.join("、") + "などを紹介します。" : ""}公式情報をもとに、出典と確認日をつけて掲載しています。`),
    path: prefHref(p), noindex: list.length + reg.length === 0,
    ld: [crumbsLd([["ホーム", "/"], [`${p}の神楽`]]), itemListLd(`${p}の神楽`, [...list.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })), ...reg.map((r) => ({ href: `/regular/${r.id}.html`, name: r.name }))])].filter(Boolean),
    body: `${crumbNav([["ホーム", "/"], [`${p}の神楽`]])}${hero(`${esc(p)}の神楽`, countLine(list.length, reg.length))}
<p class="lead">${esc(p)}で開催される神楽の日程と会場を、公式情報をもとにまとめています。${kinds.length ? `${kinds.map((k) => `<a href="${kaguraHref(k)}">${esc(k)}</a>`).join("、")}の公演を掲載しています。` : ""}</p>
${upcomingIntro}${monthNavigation}${isHiroshima && list.length + reg.length ? preparationLinks() : ""}${stayHtml}${adSlot(cfg.adsense.slotList)}${scheduleHtml}${reg.length ? `<h2${isHiroshima ? ' id="hiroshima-regular"' : ''}>毎週・毎晩の定期公演</h2>${reg.map(regCard).join("")}` : ""}${list.length + reg.length ? "" : empty("現在の開催予定はありません。")}${prefDetail(p)}${list.length+reg.length?experienceSection({prefecture:p},today,experienceAff):''}${list.length + reg.length ? furusatoBlock(moreOffers, { prefecture: p, towns: [...list, ...reg].map((x) => x.city) }, today, "pref_furusato") : ""}`,
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
/** 開催ページの右の列(PCだけ): スクロールしても、日時・会場と、公式情報のボタンが見えるように */
const sideSummary = (e, when) => `<div class="side-summary"><p class="ss-when">${when}</p><p class="ss-place">${esc(e.venue || `${e.prefecture}${e.city ?? ""}`)}</p>${e.fee ? `<p class="ss-fee">${esc(e.fee)}</p>` : ""}${e.url ? `<a class="btn" data-official-side href="${esc(e.url)}" rel="noopener" target="_blank">公式情報を見る</a>` : ""}</div>`;
// 要点の表が画面の上に隠れたら、右の列に要点を出す(最初から出すと、すぐ左の表と重なるため)
const SIDE_SUMMARY_JS = `(function(){var k=document.querySelector('.keyinfo'),s=document.querySelector('.side-summary');if(!k||!s||!window.IntersectionObserver)return;new IntersectionObserver(function(x){s.classList.toggle('on',!x[0].isIntersecting&&x[0].boundingClientRect.top<0)}).observe(k)})()`;
// 開催ページ・定期公演ページの並び(共通): 要点(日時・会場・料金) → 公式情報のボタン・共有 → 説明・ほかの日程 → 地図・経路 → 出典 → 宿の案内 → あわせて観たい神楽 → 広告
// あわせて観たい神楽: 同じ種類の開催予定を先に、同じ県の開催予定を後に(開催・定期公演のどちらのページでも使う)
const related = (e) => {
  const uniq = (arr) => arr.filter((x, i) => arr.findIndex((y) => seriesKey(y) === seriesKey(x)) === i && seriesKey(x) !== seriesKey(e));
  const same = uniq(upcoming.filter((x) => x.id !== e.id && x.kagura && x.kagura === e.kagura)).slice(0, 4);
  const near = uniq(upcoming.filter((x) => x.id !== e.id && x.prefecture === e.prefecture && !same.includes(x))).slice(0, 4);
  const seen = new Set([seriesKey(e)]);
  const list = [...same, ...near].filter((x) => !seen.has(seriesKey(x)) && seen.add(seriesKey(x))).sort((a, b) => a.start.localeCompare(b.start));
  return list.length ? `<h2>あわせて観たい神楽</h2><ol class="monthlist">${list.map((x) => `<li><span class="md">${esc(mdw(x.start.slice(0, 10)).replace(/\((.)\)$/, ""))}<small>(${WD[parts(x.start).wd]})</small></span><span><a href="/events/${x.id}.html">${esc(x.name)}</a><span class="meta">${sepList([x.kagura ? esc(x.kagura) : "", `${esc(x.prefecture)}${esc(x.city ?? "")}`])}</span></span></li>`).join("")}</ol>` : "";
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
  write(`dist/events/${e.id}.html`, layout({
    // 検索結果で切れないよう、長い名称はタイトルでは短くする(ページの見出しは、名称のまま)
    title: `${e.name.length > 36 ? e.name.slice(0, 35) + "…" : e.name}(${jpDate(e.start.slice(0, 10))}) | ${e.prefecture} | ${cfg.siteName}`,
    desc: padDesc(clip(`${fmt(e.start).replace(e.timeUnknown ? / \d\d:\d\d$/ : /$^/, "")}、${e.venue ? e.venue + "(" + e.prefecture + (e.city ?? "") + ")" : e.prefecture + (e.city ?? "")}で開催される${e.kagura || "神楽"}。${e.fee ? "料金: " + e.fee + "。" : ""}${e.description ?? ""}`)),
    path: `/events/${e.id}.html`, noindex: !isUpcoming(e), ogType: "article", wide: true, ld: [ld, crumbsLd([["ホーム", "/"], [e.prefecture, prefHref(e.prefecture)], [e.name]])],
    body: `${crumbNav([["ホーム", "/"], [e.prefecture, prefHref(e.prefecture)], [e.name]])}${hero(esc(e.name),`${kaguraTag(e.kagura)}<a class="tag" href="${prefHref(e.prefecture)}">${esc(e.prefecture)}</a>${isUpcoming(e) ? untilBadge(e) : '<span class="tag">終了しました</span>'}`)}
<div class="dpage"><div class="d-top"><div class="keyinfo" id="performance-info" tabindex="-1"><table class="info"><tr><th>日時</th><td><span class="when">${nobr(when)}</span>${isUpcoming(e) ? `<a class="tocal" href="${esc(gcalEvent(e))}" target="_blank" rel="noopener">Googleカレンダーに${!e.timeUnknown && !e.end ? "仮登録(終了未確認)" : "追加"}</a>${calendarNotice(e).text ? `<small class="calendar-notice">${esc(calendarNotice(e).text)}</small>` : ""}` : ""}</td></tr><tr><th>会場</th><td>${venueCell(e)}</td></tr>
<tr><th>料金</th><td>${e.fee ? esc(e.fee) : "未確認"}</td></tr><tr><th>予約要否</th><td>${esc(unknownAs(reservationLabel(e)))}</td></tr></table>${unknownNote(e.timeUnknown || !e.venue || !e.fee || reservationLabel(e) === "要確認")}</div>
<div class="desc-lead">${descParas(e.description)}</div>
${e.url ? `<p class="actions"><a class="btn" data-official-link href="${esc(e.url)}" rel="noopener" target="_blank">公式情報を見る</a></p>` : ""}</div>
${isUpcoming(e) ? `<div class="d-side">${sideSummary(e, when)}${stayBlock(e)}${transportSection(visitorPlanning,e,today,'event_rental')}${learnBlock(moreOffers, { kagura: e.kagura, prefecture: e.prefecture }, today, "event_learn", { side: true })}${furusatoBlock(moreOffers, { prefecture: e.prefecture, city: e.city ?? "", towns: [e.city] }, today, "event_furusato", { side: true })}</div>` : ""}<div class="d-rest">
${noteBlock(e)}
${others.length ? `<p class="dates"><span class="meta">ほかの日程:</span> ${others.map((x) => `<a class="chip" href="/events/${x.id}.html">${esc(mdw(x.start.slice(0, 10)))}</a>`).join("")}</p>` : ""}
${sourceNote(e)}
${isUpcoming(e)?`${planningLinks(e,today,experienceAff,{prep:false})}${offerCards(visitorPlanning,'experiences',e,today,'event_experiences')}`:''}
${shareBlock(`/events/${e.id}.html`, e.name)}
${related(e)}
${adSlot(cfg.adsense.slotDetail)}</div></div>${isUpcoming(e) ? `<script>${SIDE_SUMMARY_JS}</script>` : ""}`,
  }));
}

// ---------- 詳細ページ(定期公演) ----------
for (const r of regular) {
  const row = (th, v) => (v ? `<tr><th>${th}</th><td>${esc(v)}</td></tr>` : "");
  write(`dist/regular/${r.id}.html`, layout({
    title: `${r.name} | ${r.schedule.replace(/\(.*$/, "").trim()} | ${cfg.siteName}`,
    desc: padDesc(clip(`${r.prefecture}${r.city ?? ""}${r.venue ? "の" + r.venue : ""}で観られる、${r.kagura || "神楽"}の定期公演です。公演日時: ${r.schedule.replace(/。$/, "")}。${r.fee ? "料金: " + r.fee.replace(/。$/, "") + "。" : ""}${r.description ?? ""}`)),
    path: `/regular/${r.id}.html`, wide: true, ld: crumbsLd([["ホーム", "/"], [r.prefecture, prefHref(r.prefecture)], [r.name]]),
    body: `${crumbNav([["ホーム", "/"], [r.prefecture, prefHref(r.prefecture)], [r.name]])}${hero(esc(r.name),`<span class="tag">定期公演</span>${kaguraTag(r.kagura)}<a class="tag" href="${prefHref(r.prefecture)}">${esc(r.prefecture)}</a>`)}
<div class="dpage"><div class="d-top"><div class="keyinfo" id="performance-info" tabindex="-1"><table class="info">${r.schedule ? `<tr><th>公演日時</th><td>${scheduleCell(r.schedule)}</td></tr>` : ""}${row("期間", r.season)}${row("休演日", r.closed)}<tr><th>会場</th><td>${venueCell(r, "")}</td></tr>${row("料金", r.fee || "未確認")}${row("予約要否", unknownAs(reservationLabel(r)))}${row("予約・受付方法", r.booking)}</table>${unknownNote(!r.fee || !r.venue || reservationLabel(r) === "要確認")}</div>
<div class="desc-lead">${descParas(r.description)}</div>
${r.url ? `<p class="actions"><a class="btn" data-official-link href="${esc(r.url)}" rel="noopener" target="_blank">公式情報を見る</a></p>` : ""}</div>
<div class="d-side">${affiliateBlock(r, { banners: false })}${transportSection(visitorPlanning,r,today,'regular_rental')}${learnBlock(moreOffers, { kagura: r.kagura, prefecture: r.prefecture }, today, "regular_learn", { side: true })}${furusatoBlock(moreOffers, { prefecture: r.prefecture, city: r.city ?? "", towns: [r.city] }, today, "regular_furusato", { side: true })}</div><div class="d-rest">
${sourceNote(r)}
${planningLinks(r,today,experienceAff,{prep:false})}${offerCards(visitorPlanning,'experiences',r,today,'regular_experiences')}
${shareBlock(`/regular/${r.id}.html`, r.name)}
${related(r)}
${adSlot(cfg.adsense.slotDetail)}</div></div>`,
  }));
}

// ---------- 月別ページ(「11月 神楽 開催」のような、日付の検索に当てる。日付・場所の検索はJSで結果を出すため、検索エンジンには中身が見えない) ----------
months.forEach((k) => {
  const list = monthMap.get(k), label = monthLabel(k);
  const prefsIn = [...new Set(list.map((e) => e.prefecture))], kindsIn = [...new Set(list.map((e) => e.kagura).filter(Boolean))];
  write(`dist/month/${k}.html`, layout({
    title: `${label}の神楽 開催日程(${list.length}件) | ${cfg.siteName}`,
    desc: clip(`${label}に開催される神楽の日程一覧です。${prefsIn.join("・")}の${list.length}件${kindsIn.length ? "(" + kindsIn.join("、") + ")" : ""}を日付順に掲載しています。会場や料金、公式情報へのリンクつき。`),
    path: `/month/${k}.html`, active: "/month/",
    ld: [crumbsLd([["ホーム", "/"], ["日付・場所で探す", "/calendar.html"], [label]]), itemListLd(`${label}の神楽`, list.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })))],
    body: `${crumbNav([["ホーム", "/"], ["日付・場所で探す", "/calendar.html"], [label]])}${hero(`${label}の神楽`, countLine(list.length, 0))}
<p class="lead">${label}に開催される神楽を日付順にまとめています。${prefsIn.map((p) => `<a href="${prefHref(p)}">${esc(p)}</a>`).join("、")}の開催です。</p>
${adSlot(cfg.adsense.slotList)}<h2 class="sr">${label}の開催一覧</h2>${list.map((e) => card(e)).join("")}
<h2>ほかの月</h2><div class="taglist">${months.filter((m) => m !== k).map((m) => `<a class="tag" href="/month/${m}.html">${monthLabel(m)}</a>`).join("")}</div>
${regular.length ? `<h2>毎週・毎晩の定期公演</h2>${regular.map(regCard).join("")}` : ""}`,
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
const otherWays = (self) => `<h2>ほかの探し方</h2><div class="taglist">${[["/weekend.html", "今週末の神楽"], ["/this-month.html", "今月の神楽"], ["/calendar.html", "日付・場所で探す"], ["/map.html", "地図で探す"]].filter(([h]) => h !== self).map(([h, t]) => `<a class="tag" href="${h}">${t}</a>`).join("")}${months.slice(0, 3).map((m) => `<a class="tag" href="/month/${m}.html">${monthLabel(m)}</a>`).join("")}</div>`;

{
  const items = [...wkEvents.map((e) => ({ k: e.start, html: card(e) })), ...wkRegs.flatMap(({ r, dates }) => dates.map((d) => ({ k: `${d}T${timeOf(r)}`, html: occCard(r, d) })))].sort((a, b) => a.k.localeCompare(b.k));
  const after = upcoming.filter((e) => e.start.slice(0, 10) > wk.end).slice(0, 5);
  const names = [...wkEvents, ...wkRegs.map((x) => x.r), ...wkDaily.map((x) => x.r)];
  const weekendRegions = [...new Set(names.map(x=>x.prefecture).filter(Boolean))];
  const sub = [wkRenkyu, wkHolidays.join("・")].filter(Boolean).join("・");
  write("dist/weekend.html", layout({
    title: `今週末の神楽(${wkLabel}) | ${cfg.siteName}`,
    desc: padDesc(clip(`今週末、${wkLabel}${wkRenkyu ? `の${wkRenkyu}` : ""}に観られる神楽の開催と定期公演を日付順にまとめています。${weekendRegions.length ? `${weekendRegions.slice(0,3).join("、")}${weekendRegions.length>3?"など":""}の開催情報を掲載しています。日時・会場と公式情報を確認できます。` : "開催情報がない週は、その先の開催をご案内します。"}毎日自動で更新しています。`)),
    path: "/weekend.html", active: "/weekend.html", wide: true,
    ld: [crumbsLd([["ホーム", "/"], ["日付・場所で探す", "/calendar.html"], ["今週末の神楽"]]), itemListLd(`今週末の神楽(${wkLabel})`, [...wkEvents.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })), ...[...wkRegs, ...wkDaily].map(({ r }) => ({ href: `/regular/${r.id}.html`, name: r.name }))])].filter(Boolean),
    body: `${crumbNav([["ホーム", "/"], ["日付・場所で探す", "/calendar.html"], ["今週末の神楽"]])}${hero("今週末の神楽", `${esc(wkLabel)}${sub ? ` ・ ${esc(sub)}` : ""}`)}
<p class="lead">この週末に観られる神楽を、日付順に並べています(${jpDate(today)}時点)。</p>
${weekendRegions.length ? `<p class="weekend-regions">この週末の掲載地域：${weekendRegions.map(p=>`<a href="${prefHref(p)}">${esc(p)}</a>`).join('・')}。リンク先では各県の全日程を確認できます。</p>` : ''}
<div class="dpage"><div class="d-top">
${adSlot(cfg.adsense.slotList)}<h2>開催予定${items.length ? `(${items.length}件)` : ""}</h2>
${items.map((x) => x.html).join("") || empty(`${esc(wkLabel)}の開催情報は、いまのところ見つかっていません。${wkDaily.length ? "毎晩の定期公演なら、今週末も観られます。" : ""}`)}
${dailyBlock(wkDaily)}
</div>${items.length && tripBand("weekend", "週末の宿を探す") ? `<div class="d-side">${tripBand("weekend", "週末の宿を探す")}</div>` : ""}<div class="d-rest">
${after.length ? `<h2>このあとの神楽</h2>${after.map((e) => card(e)).join("")}` : ""}
${otherWays("/weekend.html")}</div></div>`,
  }));
}
{
  const late = monthDays.length <= 10; // 月末が近いときは、来月の予定も見せる
  const names = [...tmEvents, ...tmRegs.map((x) => x.r)];
  write("dist/this-month.html", layout({
    title: `今月の神楽 ${tmLabel}の開催日程 | ${cfg.siteName}`,
    desc: padDesc(clip(`${tmLabel}、今日から月末までに観られる神楽をまとめています。${[tmEvents.length ? `開催${tmEvents.length}件` : "", tmRegs.length + tmDaily.length ? `定期公演${tmRegs.length + tmDaily.length}件の公演日` : ""].filter(Boolean).join("と、").replace(/.+/, (t) => `${t}を載せています`) || "開催情報がないときは、来月の予定をご案内します"}。${names.length ? `${listNames(names)}など。` : ""}毎日自動で更新しています。`)),
    path: "/this-month.html", active: "/this-month.html", wide: true,
    ld: [crumbsLd([["ホーム", "/"], ["日付・場所で探す", "/calendar.html"], ["今月の神楽"]]), itemListLd(`今月の神楽(${tmLabel})`, [...tmEvents.map((e) => ({ href: `/events/${e.id}.html`, name: e.name })), ...[...tmRegs, ...tmDaily].map(({ r }) => ({ href: `/regular/${r.id}.html`, name: r.name }))])].filter(Boolean),
    body: `${crumbNav([["ホーム", "/"], ["日付・場所で探す", "/calendar.html"], ["今月の神楽"]])}${hero("今月の神楽", `${tmLabel} ・ ${esc(mdLabel(today))}から月末まで`)}
<p class="lead">今日から月末までに観られる神楽を、日付順に並べています。</p>
<div class="dpage"><div class="d-top">
${adSlot(cfg.adsense.slotList)}<h2>開催予定${tmEvents.length ? `(${tmEvents.length}件)` : ""}</h2>
${tmEvents.map((e) => card(e)).join("") || empty(`${tmLabel}の、これからの開催情報は、いまのところ見つかっていません。`)}
${months.includes(mk) ? `<p class="meta"><a href="/month/${mk}.html">${tmLabel}の開催一覧を見る ›</a></p>` : ""}
${tmRegs.length ? `<h2>毎週の定期公演</h2>${tmRegs.map(({ r, dates }) => `${regCard(r)}<p class="meta">今月の公演日: ${dates.map((d) => `${+d.slice(8, 10)}日`).join("・")}</p>`).join("")}` : ""}
${dailyBlock(tmDaily)}
</div>${tmEvents.length && tripBand("this-month", "今月の旅の宿を探す") ? `<div class="d-side">${tripBand("this-month", "今月の旅の宿を探す")}</div>` : ""}<div class="d-rest">
${late && nmEvents.length ? `<h2>来月(${monthLabel(nextMk)})の神楽</h2>${nmEvents.slice(0, 5).map((e) => card(e)).join("")}${nmEvents.length > 5 || months.includes(nextMk) ? `<p class="meta"><a href="/month/${nextMk}.html">${monthLabel(nextMk)}の開催一覧(${nmEvents.length}件)を見る ›</a></p>` : ""}` : ""}
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
    body: `${crumbNav([["ホーム", "/"], ["はじめての神楽ガイド"]])}${hero("はじめての神楽ガイド", "見どころ・マナー・服装と持ち物")}<div class="prose guide">${guideHtml({
      esc,
      supplies: offersFor(visitorPlanning, 'supplies', { guide: true }, today),
      rentalHtml:rentalSearch(visitorPlanning,{guide:true},today,'guide_rental'),
      kaguraLink: (k) => (kaguras.includes(k) ? `<a href="${kaguraHref(k)}">${esc(k)}</a>` : esc(k)),
    })}</div>`,
  }));
}

// 周辺体験は、一般的な観覧ガイドと分けて地域・確認日を明示する。
write('dist/experiences.html',layout({
  title:`神楽の前後に楽しむ体験を全国47都道府県から探す | ${cfg.siteName}`,
  desc:padDesc('神楽の公演前後に楽しむ体験を、全国47都道府県から探せます。開催地域に合わせて陶芸やものづくり、自然体験、日帰り温泉などを検討し、リンク先で日付・所要時間・会場からの距離を確認して旅の予定を組みましょう。'),
  path:'/experiences.html',ld:[crumbsLd([['ホーム','/'],['はじめての神楽ガイド','/guide.html'],['公演前後の周辺体験']]),{'@context':'https://schema.org','@type':'Article',headline:'神楽の前後に楽しむ周辺体験',inLanguage:'ja',datePublished:PLANNING_CHECKED,dateModified:PLANNING_CHECKED,author:ORG_LD,publisher:ORG_LD,mainEntityOfPage:`${cfg.baseUrl}/experiences.html`,image:ogUrl(false)}],
  body:`${crumbNav([['ホーム','/'],['はじめての神楽ガイド','/guide.html'],['公演前後の周辺体験']])}${hero('神楽の前後も、土地を楽しむ','全国47都道府県から、もうひとつの寄り道を。')}<p>公演を観る日も、旅先を先に選ぶ日も。訪問する都道府県から、ものづくり・自然体験・日帰り温泉などを探してみませんか。日付・所要時間・移動の余裕を確かめて予定を組みましょう。</p>${experienceDirectory(experienceAff)}${offerCards(visitorPlanning,'experiences',{guide:true},today,'experience_guide')}<h2>神楽の予定から旅を組み立てる</h2><p><a class="btn" href="/calendar.html">公演の日付・地域を探す</a> <a class="btn ghost" href="/guide.html#transport">行き帰りの交通を確認</a> <a class="btn ghost" href="/guide.html#packing">持ち物を選ぶ</a></p>`
}));

// ---------- 神楽の歴史(総論と年表、古代・中世・近世・近代の4ページ) ----------
{
  const pages = historyPages({ esc, kaguraLink: (k) => (kaguras.includes(k) ? `<a href="${kaguraHref(k)}">${esc(k)}</a>` : esc(k)) });
  for (const [key, pg] of Object.entries(pages)) {
    const path = key === "index" ? "/history/" : `/history/${key}.html`;
    const era = HISTORY_ERAS.find((e) => e.slug === key);
    const crumbs = key === "index" ? [["ホーム", "/"], ["神楽の歴史"]] : [["ホーム", "/"], ["神楽の歴史", "/history/"], [era.title]];
    write(`dist${key === "index" ? "/history/index.html" : path}`, layout({
      title: `${pg.title} | ${cfg.siteName}`, desc: clip(pg.desc, 160), path, active: "/history/", alts: key === "index" ? [["en", "/en/history.html"]] : [],
      ld: [crumbsLd(crumbs.map(([t, h]) => [t, h])), {
        "@context": "https://schema.org", "@type": "Article", headline: pg.title, inLanguage: "ja", datePublished: HISTORY_CHECKED, dateModified: HISTORY_CHECKED,
        author: ORG_LD, publisher: ORG_LD, mainEntityOfPage: `${cfg.baseUrl}${path}`, image: ogUrl(false),
      }],
      body: `${crumbNav(crumbs)}${hero(esc(pg.h1), esc(pg.sub))}<div class="prose history">${pg.body()}</div>${key === "index" ? learnBlock(moreOffers, { kagura: "*" }, today, "history_learn") : ""}`,
    }));
  }
}

// ---------- English entry pages (/en/): 海外からの旅行者向け。開催情報の詳細は日本語のまま ----------
{
  // 英語の種類一覧は、開催予定か定期公演がある種類だけ(日本語の「種類で探す」で、検索に載せている種類と同じ)
  const styles = kaguras.filter((k) => upcoming.some((e) => e.kagura === k) || regular.some((r) => r.kagura === k))
    .map((k) => ({ key: k, prefs: [...new Set([...upcoming, ...regular].filter((x) => x.kagura === k).map((x) => x.prefecture))] }));
  const pages = englishPages({ esc, upcoming, styles, kaguraHref: (k) => (kaguras.includes(k) ? kaguraHref(k) : null) });
  const JA = { index: "/", guide: "/guide.html", kagura: "/kagura/", history: "/history/" };
  // 英語のトップ: 日本語のトップと同じ絵。見出しは横書きで、フレーズごとに順に現れる(題は「Kagura: …」を、コロンで分ける)
  const heroEn = (h, p) => `<section class="hero home-hero">
<picture class="hero-art"><source media="(max-width: 640px)" srcset="/hero-sp.webp" width="1122" height="1402"><img src="/hero-pc.webp" width="1774" height="887" alt="Watercolor of a masked dancer holding a paper wand, dancing in a kagura hall at night" fetchpriority="high" decoding="async"></picture>${sparksHtml}
<div class="copy"><h1>${h.split(/(?<=:) /).map((t) => `<span class="ph">${esc(t)}</span>`).join(" ")}</h1><p><span class="ph ph3">${esc(p)}</span></p></div></section>`;
  for (const [key, pg] of Object.entries(pages)) {
    const path = key === "index" ? "/en/" : `/en/${key}.html`;
    const crumbs = key === "index" ? [["Home"]] : [["Home", "/en/"], [pg.h1]];
    write(`dist${key === "index" ? "/en/index.html" : path}`, layout({
      lang: "en", title: pg.title, desc: pg.desc, path, active: path, alts: [["ja", JA[key]]],
      ld: [...(key === "index" ? [] : [crumbsLd(crumbs)]), { "@context": "https://schema.org", "@type": "Article", headline: pg.h1, inLanguage: "en", datePublished: EN_CHECKED, dateModified: EN_CHECKED, author: ORG_LD, publisher: ORG_LD, mainEntityOfPage: `${cfg.baseUrl}${path}`, image: ogUrl(true) }],
      body: `${key === "index" ? "" : `<nav class="crumbs" aria-label="Breadcrumb"><ol>${crumbs.map(([t, h]) => (h ? `<li><a href="${h}">${esc(t)}</a></li>` : `<li aria-current="page">${esc(t)}</li>`)).join("")}</ol></nav>`}${key === "index" ? heroEn(pg.h1, pg.sub) : hero(esc(pg.h1), esc(pg.sub))}<div class="prose en">${pg.body()}</div>`,
    }));
  }
}

// ---------- 固定ページ ----------
const doc = (path, title, desc, inner, opts = {}) => {
  const crumbs = [["ホーム", "/"], ...(opts.crumbs ?? []), [title]];
  write(`dist${path}`, layout({ title: `${title} | ${cfg.siteName}`, desc, path, ld: crumbsLd(crumbs), body: `${crumbNav(crumbs)}${hero(title, opts.lead ?? "")}<div class="prose">${inner}</div>`, ...opts.layout }));
};

doc("/submit.html", "掲載の依頼", "神楽の開催情報の掲載依頼フォーム", `<p>神楽の開催情報をお送りください。公式情報で内容を確かめてから掲載します。掲載される場所や流れは<a href="/organizers.html">主催者の方へ</a>をご覧ください。</p>${submitForm(cfg)}`, { lead: "掲載は無料です。", crumbs: [["主催者の方へ", "/organizers.html"]], layout: { noindex: true, withForm: true, active: "/submit.html" } });

// 主催者の方へ(掲載の依頼を増やす。「神楽 イベント 掲載 無料」のような検索にも当てる)
doc("/organizers.html", "主催者の方へ", `神楽の主催者・神社・保存会・神楽団・自治体・観光協会の皆さまへ。${cfg.siteName}では、神楽の開催情報を無料で掲載しています。掲載される場所や送り方、掲載までの流れ、訂正・削除の方法をご案内します。`,
  organizersHtml({ esc, siteName: cfg.siteName, formReady: formReady(cfg) }),
  { lead: "神楽の開催情報を、無料で掲載します。", layout: { active: "/organizers.html" } });

doc("/about.html", "運営者情報", `${cfg.siteName}の運営者情報です。運営者と連絡先、サイトの目的、開催情報の集め方と出典の示し方、広告などによる収益について説明しています。`, `
<p class="symbol"><img src="/symbol.png" alt="${esc(op.name)}のシンボル" width="120" height="120"></p>
<table class="info"><tr><th>サイト名</th><td>${esc(cfg.siteName)}</td></tr><tr><th>運営者</th><td>${esc(op.name)}</td></tr>
<tr><th>連絡先</th><td>${mailLink()}</td></tr><tr><th>開設</th><td>${esc(op.established)}</td></tr></table>
<h2>このサイトについて</h2>
<p>${esc(cfg.siteName)}は、全国の神楽の開催情報を、探しやすくまとめたサイトです。神楽は、地域の神社や保存会が長く受け継いできた大切な文化です。このサイトが、そんな神楽に出会うきっかけになればと考えています。</p>
<h2>掲載情報について</h2>
<p>開催情報は、主催者からの投稿と、公開されている情報をもとに掲載しています。各ページには、情報の出典と確認日を載せています。日時・会場・料金が変わったり、開催が中止になったりすることもあるので、出かける前に必ず主催者の公式情報をご確認ください。</p>
<p>掲載内容の訂正や削除のご依頼は、お問い合わせからご連絡ください。</p>
<h2>情報の確認と更新</h2>
<ul><li>開催情報は、主催者や自治体、観光協会などの公式情報を出典にしています。各ページの下のほうに、出典の名前と確認した日を載せています。</li>
<li>公開されている情報は、プログラムで定期的に確かめています。取得元のページから開催情報が消えたときは、日程の変更や中止も考えられるため、掲載を取り下げます。</li>
<li>終わった開催は、一覧や検索結果から外します。</li>
<li>主催者の方から訂正や取り下げのご依頼があれば、確認したうえで速やかに反映します。</li>
<li>神楽の種類や地域の解説は、文化庁の「文化遺産オンライン」や自治体、観光協会などの公開情報をもとに書いており、参考にした資料へのリンクも載せています。</li></ul>
<p>最終更新: ${esc(op.updated)}</p>
<h2>収益について</h2>
<p>${cfg.adsense.client || hasAffiliate ? `当サイトは、${[cfg.adsense.client ? "広告" : "", hasAffiliate ? "アフィリエイトプログラム" : ""].filter(Boolean).join("および")}による収益で運営しています。` : "現在、当サイトは広告やアフィリエイトによる収益を得ていません。今後導入する場合は、始める前にこの記載とプライバシーポリシーを更新します。"}</p>
<p>情報の集め方や免責については、<a href="/disclaimer.html">免責事項・情報の取り扱い</a>をご覧ください。</p>`);

doc("/contact.html", "お問い合わせ", `${cfg.siteName}へのお問い合わせフォームです。掲載中の開催情報の訂正や削除のご依頼、サイトの不具合のご報告などを受け付けています。`, `
<p>次のようなご連絡は、下のフォームで受け付けています。</p>
<ul><li>開催情報の訂正や、掲載の削除のご依頼</li><li>サイトの不具合のご報告</li><li>その他のお問い合わせ</li></ul>
<p>新しい開催情報の掲載は、<a href="/submit.html">掲載の依頼フォーム</a>をご利用ください。</p>
${contactForm(cfg)}`, { layout: { withForm: true } });

// プライバシーポリシー・免責事項: 設定(広告・アクセス解析・アフィリエイト・フォーム送信先・自動取得)に合わせて、本文が変わる
const SOURCES_FILE = process.env.SOURCES_FILE ?? "data/sources.json";
const autoSources = existsSync(SOURCES_FILE) ? readJson(SOURCES_FILE).filter((s) => s.enabled !== false && s.termsChecked).map((s) => s.name) : [];
const policyCtx = {
  cfg, op, mailLink, auto: autoSources, autoPublish: cfg.collect?.autoPublish !== false,
  hasAds: !!cfg.adsense.client, hasGA: !!cfg.analyticsId, hasCB: !!cfg.cookiebotId, hasGC: !!cfg.goatcounter, hasAffil: hasAffiliate,
  form: { ready: formReady(cfg), providerName: cfg.form?.providerName },
};
doc("/privacy.html", "プライバシーポリシー", `${cfg.siteName}のプライバシーポリシーです。取得する情報と利用目的、外部サービスへの情報の送信、Cookie、個人情報の開示・訂正・削除のご請求について定めています。`, privacyHtml(policyCtx));
doc("/terms.html", "利用規約", `${cfg.siteName}の利用規約です。サイトの利用条件、開催情報の投稿の扱い、禁止事項、免責、規約の変更、準拠法と管轄裁判所について定めています。`, termsHtml(policyCtx));
doc("/disclaimer.html", "免責事項・情報の取り扱い", `${cfg.siteName}の免責事項です。開催情報の集め方と自動処理、掲載の停止、外部サイトへのリンク、損害についての責任の範囲を説明しています。`, disclaimerHtml(policyCtx));
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
  ["/guide.html", GUIDE_CHECKED], ["/history/", HISTORY_CHECKED], ["/en/", EN_CHECKED], ["/en/guide.html", EN_CHECKED], ["/en/kagura.html", EN_CHECKED], ["/en/history.html", EN_CHECKED], ...HISTORY_ERAS.map((e) => [`/history/${e.slug}.html`, HISTORY_CHECKED]), ["/organizers.html", staticDay],
  ["/about.html", staticDay], ["/contact.html", staticDay], ["/privacy.html", (() => { const m = privacyUpdated(cfg).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/); return m ? `${m[1]}-${pad(m[2])}-${pad(m[3])}` : staticDay; })()], ["/terms.html", staticDay], ["/disclaimer.html", staticDay],
  // 検索に載せないページ(noindex)は、サイトマップにも入れない
  ...kaguras.filter((k) => upcoming.some((e) => e.kagura === k) || regular.some((r) => r.kagura === k)).map((k) => [kaguraHref(k), lastmodOf([...upcoming, ...regular].filter((x) => x.kagura === k))]),
  ...prefs.map((p) => [prefHref(p), lastmodOf([...upcoming, ...regular].filter((x) => x.prefecture === p))]),
  ...months.map((k) => [`/month/${k}.html`, lastmodOf(monthMap.get(k))]),
  ...upcoming.map((e) => [`/events/${e.id}.html`, e.checked ?? nowJst.slice(0, 10)]),
  ...regular.map((r) => [`/regular/${r.id}.html`, r.checked ?? nowJst.slice(0, 10)]),
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
for (const f of ["symbol.png", "symbol-96.png", "favicon-48.png", "apple-touch-icon.png", "hero-pc.webp", "hero-sp.webp", "og.jpg", "og-en.jpg", "washi.svg", "washi-dark.svg"]) copyFileSync(`assets/${f}`, `${OUT}/${f}`);
// 検索エンジンや古いブラウザは、/favicon.ico を直接見に行く。シンボルの画像から作って置く
writeFileSync(`${OUT}/favicon.ico`, pngToIco(readFileSync("assets/favicon-48.png")));

write("dist/404.html", layout({
  title: `ページが見つかりません | ${cfg.siteName}`, desc: "お探しのページは見つかりませんでした", path: "/404.html", noindex: true,
  body: `${hero("ページが見つかりません", "URLが変わったか、掲載がすでに終了している可能性があります。")}
<p><a class="btn" href="/">開催予定を見る</a> <a class="btn ghost" href="/calendar.html">日付・場所で探す</a></p>`,
}));

if (cfg.domain) write("dist/CNAME", cfg.domain + "\n");
write("dist/robots.txt", `User-agent: *\nAllow: /\nSitemap: ${cfg.baseUrl}/sitemap.xml\n`);
if (cfg.adsense.client) write("dist/ads.txt", `google.com, ${cfg.adsense.client.replace("ca-", "")}, DIRECT, f08c47fec0942fa0\n`);
// セキュリティ連絡先(RFC 9116)。メールアドレスは、お問い合わせフォームのURLで代える
const expires = new Date(asMs(nowJst) + 365 * 864e5).toISOString();
const securityTxt = `Contact: ${cfg.baseUrl}/contact.html\nExpires: ${expires}\nPreferred-Languages: ja, en\nCanonical: ${cfg.baseUrl}/.well-known/security.txt\n`;
write("dist/.well-known/security.txt", securityTxt);
write("dist/security.txt", securityTxt);
// GitHub Pages は無視するが、Cloudflare Pages / Netlify へ移したときに、本物のHTTPヘッダになる設定
write("dist/_headers", `/*\n  Strict-Transport-Security: max-age=63072000; includeSubDomains\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()\n  Cross-Origin-Opener-Policy: same-origin\n`);
console.log(`built: ${events.length} events (${upcoming.length} upcoming), ${regular.length} regular, ${urls.length} pages`);

const stayAudit = issuedRakutenStays.audit();
console.log(`Rakuten stay issued coverage: ${stayAudit.verified.length} verified / ${stayAudit.unverified.length} unverified unique destinations`);
if (stayAudit.unverified.length) console.warn("RAKUTEN_STAY_ISSUANCE_UNVERIFIED: existing links retained; obtain exact issued URLs", JSON.stringify(stayAudit.unverified));
