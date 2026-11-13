// 終わった開催を、検索に残すかどうかの決まり(scripts/build.mjs から使う)。
//
// 終わった開催のページは、日程を調べる人の入口になる(来年の日程・次に観られる神楽を探す人が来る)。
// そこで、次の開催ページを残す。ただし、中身の薄いページ・古いページ・次の回と重なるページは検索に載せない。
//   - 検索に残す: 説明文があり、終わってから PAST_KEEP_DAYS 日以内で、同じ催しの次の回がまだ登録されていない
//   - 検索に載せない(ページは残し、リンクはたどらせる): 説明文がない / 古い / 次の回がある(次の回へ案内する)
// 神楽の種類・県のページも、開催予定が0件のあいだ、直近1年の開催の記録と解説があれば検索に残す。

export const PAST_KEEP_DAYS = 400; // 1年たって次の回の時期が来ても、まだ次の回が登録されていないとき(発表が遅い催し)のぶんの余裕
export const PAST_RECORD_DAYS = 365; // 種類・県のページに出す「これまでの開催」の期間

// 毎年の回をまとめるための名前(「第20回」「2026年」「令和8年度」などを外す)
export const editionName = (name = "") => String(name)
  .replace(/第\s*[0-9０-９]+\s*回\s*/g, "")
  .replace(/(?:20\d\d|令和\s*[0-9０-９元]+)\s*(?:年度|年)?/g, "")
  .replace(/[\s　]+/g, "")
  .replace(/[（]/g, "(").replace(/[）]/g, ")")
  .replace(/\(\)/g, "");

// 同じ催し(年ごと・月ごとの回)を見分ける鍵。events.json の series があれば、それを優先する
export const editionKey = (e) => e.series ? `series:${e.series}` : `${e.prefecture}|${e.city ?? ""}|${editionName(e.name)}`;

const dayOf = (e) => (e.end || e.start).slice(0, 10);
export const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00Z`) - Date.parse(`${a}T00:00Z`)) / 864e5);

/** 同じ催しの、この回より後の回(いちばん早いもの)。なければ null */
export const nextEdition = (e, events) => events
  .filter((x) => x.id !== e.id && editionKey(x) === editionKey(e) && x.start.slice(0, 10) > dayOf(e))
  .sort((a, b) => a.start.localeCompare(b.start))[0] ?? null;

/** 終わった開催のページを、検索に残すか */
export const keepPastIndexed = (e, { today, next }) =>
  !next && !!String(e.description ?? "").trim() && daysBetween(dayOf(e), today) <= PAST_KEEP_DAYS;

/** 直近 days 日のうちに終わった開催(新しい順) */
export const recentPast = (list, { today, isUpcoming, days = PAST_RECORD_DAYS }) => list
  .filter((e) => !isUpcoming(e) && daysBetween(dayOf(e), today) <= days)
  .sort((a, b) => b.start.localeCompare(a.start));
