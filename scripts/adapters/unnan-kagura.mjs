// アダプタ: 雲南市観光協会「雲南市内神楽団体 神楽公演スケジュール(YYYY年M月分)」から、公演を取り出す。
// ページは毎月、同じURLで書き換えられる。1公演は次の形の段落:
//   <イベント名> 出雲神楽の夕べ / <日　　時> 11月7日(土) / <会　　場> 古代鉄歌謡館(大東町中湯)
//   <出演団体> 中野神楽保存会(三刀屋町中野) / <時　　間> 19:00〜 / <料金> … / <詳細はこちら>(リンク)
// 方針(分からないものは推測しない):
//  - 年はページの見出し「(YYYY年M月分)」からだけ取る。見出しがなければ、全体を失敗にする
//  - 「15:00頃〜」のような目安の時刻は、時刻未定として扱う
//  - 会場のかっこの地名が雲南市以外(奥出雲町・安来市など)なら、その市町村で登録する。分からない地名は雲南市内とする
//  - 一般公開でないもの(非公開・関係者のみ)と、中止・延期は除く
import * as cheerio from "cheerio";

const pad = (n) => String(n).padStart(2, "0");
// 雲南市の外の市町村(かっこの地名がこれで始まるとき)。県が違えば prefecture も変える
const OUTSIDE = [
  ["奥出雲町", "島根県", "仁多郡奥出雲町"], ["飯南町", "島根県", "飯石郡飯南町"], ["安来市", "島根県", "安来市"],
  ["松江市", "島根県", "松江市"], ["出雲市", "島根県", "出雲市"], ["大田市", "島根県", "大田市"],
  ["庄原市", "広島県", "庄原市"], ["三次市", "広島県", "三次市"],
];
const norm = (s) => String(s ?? "").normalize("NFKC").replace(/[　\s]+/g, " ").trim();

export function parse(html, source, pageUrl = source.url) {
  const $ = cheerio.load(html);
  const title = norm($("h1").first().text() + " " + $("title").text());
  const ym = title.match(/(\d{4})年(\d{1,2})月分/);
  if (!ym) throw new Error("見出しに「YYYY年M月分」がありません(年を推測しないため、読みません)");
  const year = +ym[1], month = +ym[2];
  const out = [];
  $("p").each((_, el) => {
    const $p = $(el);
    const lines = ($p.html() ?? "").split(/<br\s*\/?>/i).map((x) => norm(cheerio.load(`<i>${x}</i>`)("i").text()));
    const field = (key) => {
      const re = new RegExp(`^<\\s*${key.split("").join("\\s*")}\\s*>\\s*(.*)$`);
      for (const l of lines) { const m = l.match(re); if (m) return m[1].trim(); }
      return "";
    };
    const name = field("イベント名");
    const day = field("日時");
    if (!name || !day) return;
    if (/中止|延期|非公開|関係者のみ|一般観覧不可/.test($p.text())) return;
    const d = day.match(/(\d{1,2})月(\d{1,2})日/);
    if (!d) return;
    const m = +d[1];
    // 年をまたぐ月(12月分のページに1月の公演がある等)は翌年
    const y = m < month - 6 ? year + 1 : year;
    const timeRaw = field("時間");
    const t = timeRaw.match(/^(\d{1,2})[:：](\d{2})/);
    const approx = /頃|ごろ/.test(timeRaw);
    const timeOk = t && !approx;
    const placeRaw = field("会場");
    const pm = placeRaw.match(/^(.*?)[(（]([^()（）]+)[)）]\s*$/);
    let venue = (pm ? pm[1] : placeRaw).trim();
    let area = pm ? pm[2].trim() : "";
    // かっこの中が地名(「大東町下佐世」「奥出雲町上阿井」など)でなければ、施設名の補足として会場名に残す
    if (area && !/^[^\s]{1,5}?[市町村]/.test(area)) { venue = `${venue}(${area})`; area = ""; }
    let prefecture = source.prefecture || "島根県", city = source.city || "雲南市", address = area;
    const out1 = OUTSIDE.find(([k]) => area.startsWith(k));
    if (out1) { [, prefecture, city] = out1; address = area.slice(out1[0].length).trim(); }
    const troupe = field("出演団体");
    const fee = field("料金") || field("入園料金") || field("入場料") || field("入場料金");
    const link = $p.find("a[href]").filter((_, a) => /詳細/.test($(a).text())).first().attr("href");
    const fullName = /神楽/.test(name) ? name : `${name} 神楽(${troupe.replace(/[(（][^)）]*[)）]/g, "").split("・")[0].trim()})`;
    out.push({
      name: fullName,
      start: `${y}-${pad(m)}-${pad(+d[2])}T${timeOk ? `${pad(+t[1])}:${t[2]}` : "00:00"}`,
      timeUnknown: timeOk ? undefined : true,
      venue,
      ...(address ? { address } : {}),
      prefecture,
      city,
      ...(fee ? { fee } : {}),
      url: link ? new URL(link, pageUrl).href : pageUrl,
    });
  });
  return out;
}
