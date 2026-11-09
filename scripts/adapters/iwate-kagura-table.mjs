// アダプタ: 岩手県 花北・遠野応援隊「神楽公演情報」の表(公演日 | 名称 | 内容)。
// 1行の「内容」に、時刻・出演団体・「会場:施設名(〒… 住所)」・交通・駐車場が並ぶ。
// 方針(分からないものは推測しない):
//  - 年は「公演日」のセルの「YYYY年M月D日」からだけ取る(年のない行は読まない)
//  - 会場が1つに決まらない行(「会場:」がない、まつりのパレードなど)は載せない
//  - 時刻は「開演」があればそれ、なければ内容の最初の「H時(M分)〜」。複数日の行は時刻未定とする
//  - 神楽の団体名が内容にない行(郷土芸能だけの行など)は載せない
//  - 中止・延期・非公開の行は載せない
//  - 公式リンクは source.linkUrl があればそれ(岩手県は、トップページ以外へのリンクを担当課への問い合わせ事項としているため、トップページにする)
import * as cheerio from "cheerio";

const pad = (n) => String(n).padStart(2, "0");
const norm = (s) => String(s ?? "").normalize("NFKC").replace(/[\s ]+/g, " ").trim();
// 種類: 国指定の早池峰神楽(大償・岳)だけを分け、ほかは地域でまとめる(系統を推測で書かない)
const kindOf = (troupes, fallback) => (troupes.some((t) => /^(大償|岳)神楽$/.test(t)) ? "早池峰神楽" : fallback);

export function parse(html, source, pageUrl = source.url) {
  const $ = cheerio.load(html);
  const out = [];
  let seenTable = false;
  $("table tr").each((_, tr) => {
    const cells = $(tr).children("td, th").map((_, c) => norm($(c).text())).get();
    if (cells.length < 3) return;
    if (/公演日/.test(cells[0])) { seenTable = true; return; }
    const [day, title, body] = cells;
    const d = day.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (!d) return;
    if (/中止|延期|非公開|関係者のみ/.test(title + body)) return;
    const multi = /[〜~～-]\s*(\d{1,2}月)?\d{1,2}日/.test(day);
    // 会場: 「会場:」の後ろ、「交通」「駐車場」「コメント」の前まで
    const vm = body.match(/会場\s*[::]\s*(.+?)(?=\s*(交通|駐車場|コメント|※|$))/);
    if (!vm) return;
    const placeRaw = vm[1].trim();
    const pm = placeRaw.match(/^(.*?)\s*[((]([^()()]*)[))]\s*$/);
    const venue = (pm ? pm[1] : placeRaw).trim();
    const address = (pm ? pm[2] : "").replace(/〒?\s*\d{3}-\d{4}\s*/, "").trim();
    if (!venue || /及び|ほか|周辺/.test(venue)) return;
    const cm = address.match(/^(?:岩手県)?((?:[^\s]{1,5}郡)?[^\s]{1,5}?[市町村])/);
    const city = cm ? cm[1] : "";
    if (!city) return;
    // 団体名は、会場より前の部分から、漢字・カタカナの「〇〇神楽」だけを拾う(コメント欄の文章を拾わない)
    const troupes = [...new Set([...body.slice(0, vm.index).matchAll(/([一-龥々ヶァ-ヴー]{1,8}神楽)/g)].map((m) => m[1]))]
      .filter((t) => !/^(大乗|山伏|打ち鳴らし)?神楽$/.test(t) && !/共演|大会|公演|舞初め/.test(t));
    if (!troupes.length) return;
    let time = null;
    if (!multi) {
      const head = body.slice(0, vm.index);
      const t = head.match(/開演\s*(\d{1,2})時(?:(\d{1,2})分)?/) ?? head.match(/(\d{1,2})時(?:(\d{1,2})分)?\s*[〜~～]/) ?? head.match(/(\d{1,2}):(\d{2})\s*[〜~～]/);
      if (t && +t[1] < 24) time = `${pad(+t[1])}:${pad(+(t[2] ?? 0))}`;
    }
    const name = /神楽/.test(title) ? title : `${title}(${troupes.slice(0, 3).join("・")})`;
    out.push({
      name,
      kagura: kindOf(troupes, source.kagura || "岩手の神楽"),
      start: `${d[1]}-${pad(+d[2])}-${pad(+d[3])}T${time ?? "00:00"}`,
      timeUnknown: time ? undefined : true,
      venue,
      ...(address ? { address: address.replace(/^岩手県/, "") } : {}),
      prefecture: "岩手県",
      city,
      url: source.linkUrl || pageUrl,
    });
  });
  if (!seenTable) throw new Error("「公演日」の表が見つかりません(ページ構造が変わった可能性)");
  return out;
}
