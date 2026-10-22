// 神楽会館の「公演のお知らせ」専用アダプタ。
// 一覧記事の「投稿日」や「予約開始日」ではなく、詳細の「公演日時」の欄だけを読む。
// 未確認のサイト構造なら、誤掲載するより0件/例外を返して止める。
import * as cheerio from "cheerio";
import { clean, parseJaDate } from "../lib/util.mjs";

const DETAIL = /^\/performance\/\d+\.html$/;
const TITLE = /(?:一般公演|自主公演)/;
const normalize = (s) => clean(String(s ?? "").normalize("NFKC"));
const pad = (n) => String(+n).padStart(2, "0");

// 一覧ページの公演「詳細記事」だけを同一オリジン内で拾う。年度計画PDFや他ジャンルは対象外。
export function discover(html, source, pageUrl = source.url) {
  const base = new URL(source.url);
  if (new URL(pageUrl).pathname !== base.pathname) return [];
  const $ = cheerio.load(html), result = new Set();
  $("a[href]").each((_, a) => {
    const label = normalize($(a).text());
    if (!TITLE.test(label)) return;
    try {
      const u = new URL($(a).attr("href"), pageUrl);
      if (u.origin === base.origin && DETAIL.test(u.pathname)) result.add(u.href.split("#")[0]);
    } catch { /* 不正なリンクを採用しない */ }
  });
  if (!result.size) throw new Error("神楽会館の一般/自主公演の詳細リンクが見つかりません（一覧構造の再確認が必要）");
  if (result.size > 12) throw new Error("神楽会館の詳細リンク数が想定を超えました（自動取得を中止）");
  return [...result];
}

// 公演日時の「ラベルと値の組」を取得し、公開日や予約開始日にはフォールバックしない。
function findField($, label) {
  let value = "";
  $("tr").each((_, tr) => {
    if (value) return;
    const cells = $(tr).children("th, td");
    if (cells.length < 2 || normalize(cells.first().text()).replace(/\s/g, "") !== label) return;
    value = normalize(cells.eq(1).text());
  });
  if (value) return value;
  $("dt").each((_, dt) => {
    if (!value && normalize($(dt).text()) === label) value = normalize($(dt).next("dd").text());
  });
  return value;
}

function dateFromField(raw) {
  const s = normalize(raw);
  const day = s.match(/(?:令和\s*(?:元|\d{1,2})\s*年|\d{4}\s*年)\s*\d{1,2}\s*月\s*\d{1,2}\s*日/);
  if (!day) return null;
  const afterDay = s.slice((day.index ?? 0) + day[0].length);
  // 公演日時セル内の時刻のみ。予約開始日の時刻を拾わない。
  const timeMatches = [...afterDay.matchAll(/(\d{1,2})\s*(?:時|:)\s*(\d{1,2})\s*(?:分)?/g)]
    .filter((m) => +m[1] < 24 && +m[2] < 60)
    .slice(0, 2).map((m) => `${pad(m[1])}:${pad(m[2])}`);
  const normalized = `${day[0]}${timeMatches.length ? " " + timeMatches.join(" ～ ") : ""}`;
  const parsed = parseJaDate(normalized);
  if (!parsed) return null;
  // 2026年2月31日など、正規表現上だけ成立する日付は排除する。
  const date = parsed.start.slice(0, 10), d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) return null;
  return parsed;
}

export function parse(html, source, pageUrl = source.url) {
  const u = new URL(pageUrl);
  if (!DETAIL.test(u.pathname) || u.origin !== new URL(source.url).origin) return [];
  const $ = cheerio.load(html);
  const title = $("h1,h2,h3").map((_, el) => normalize($(el).text())).get()
    .find((s) => TITLE.test(s) && !/公演計画/.test(s));
  // 公演タイトルと公演日時が揃わない場合は誤公開を防ぐ。
  if (!title) return [];
  const rawDate = findField($, "公演日時");
  if (!rawDate) throw new Error(`公演日時セルを検出できません: ${pageUrl}`);
  const date = dateFromField(rawDate);
  if (!date) throw new Error(`公演日時を解析できません: ${pageUrl}`);
  const name = `神楽会館 ${title.replace(/\s*のご案内.*$/, "").replace(/\s*～.*$/, "")}`.slice(0, 100);
  const fee = findField($, "入場料").slice(0, 80);
  return [{
    name, start: date.start, ...(date.end ? { end: date.end } : {}),
    ...(date.hasTime ? {} : { timeUnknown: true }),
    prefecture: source.prefecture || "大分県", city: source.city || "豊後大野市",
    venue: "神楽会館", kagura: source.kagura || "豊後神楽", fee,
    url: pageUrl,
  }];
}
