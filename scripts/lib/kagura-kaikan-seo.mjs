// 神楽会館(大分県豊後大野市清川町)の毎月の一般公演の、開催ページのタイトルと説明文をそろえる(SEO-20261110-3)
// - タイトル: 「神楽会館 {神楽の種類} 一般公演 {月}月{日}日 | 豊後大野市清川町」(サイト名は build が付ける)
//   神楽の種類は、その回の開催データのもの。出演が御嶽神楽の回だけ「御嶽神楽」になる(12月など、ほかの団体が出る回に御嶽神楽と書かない)
// - 説明文: 先頭に開演時刻と、前売り・当日券の料金。料金に当日券の記載がなければ「料金」とだけ書く(公式にないことは足さない)
// - 自動収集の新しい月の回にも、同じ形が付く(名称に「一般公演」を含む、神楽会館の開催)
// - 開催データに titleName・seoDesc があれば、そちらを優先する(build 側)
const WEEK = "日月火水木金土";

/** 神楽会館の毎月の一般公演か */
export function isKaguraKaikanMonthly(e) {
  return e?.venue === "神楽会館" && e.prefecture === "大分県" && e.city === "豊後大野市" && /一般公演/.test(e.name ?? "");
}

/** タイトルの、サイト名より前の部分 */
export function kaguraKaikanTitle(e) {
  const [, m, d] = e.start.slice(0, 10).split("-").map(Number);
  return `神楽会館 ${e.kagura || "神楽"} 一般公演 ${m}月${d}日 | 豊後大野市清川町`;
}

/** 料金の文を、前売りと当日券に分けて読みやすくする(例: 前売り 一般1,200円・中学生以下500円、当日券は各500円増し) */
export function kaguraKaikanFee(fee) {
  const s = String(fee ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const m = s.match(/^(.*?)\s*\(\s*(当日券[^)]*)\)\s*$/);
  if (!m) return `料金 ${s}`;
  const advance = m[1].replace(/、/g, "・");
  const sameDay = m[2].replace(/^当日券は、?(?:それぞれ|各)?/, "当日券は各").replace(/増$/, "増し");
  return `前売り ${advance}、${sameDay}`;
}

/** 説明文(build で150字に切る) */
export function kaguraKaikanDesc(e) {
  // 出演団体が入るよう、日付と会場の文は短く(年はタイトル・本文にある)
  const day = e.start.slice(0, 10), [, m, d] = day.split("-").map(Number);
  const wd = WEEK[new Date(`${day}T00:00:00Z`).getUTCDay()];
  const time = e.timeUnknown ? "" : `開演${e.start.slice(11, 16)}${e.end && e.end.slice(0, 10) === day ? `(〜${e.end.slice(11, 16)})` : ""}。`;
  const fee = kaguraKaikanFee(e.fee);
  return `${time}${fee ? fee + "。" : ""}${m}月${d}日(${wd})、神楽会館(豊後大野市清川町)の${e.kagura ? e.kagura + "の" : ""}一般公演。${e.description ?? ""}`;
}
