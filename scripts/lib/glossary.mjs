// ことばの説明(開催ページ・定期公演ページの要点の枠の下に出す、短い説明)。
// はじめて神楽を観に行く方は、料金の欄の「御初穂料・ご神前」や、説明の「神楽宿」が分からない。
// その開催の名前・説明・料金・会場・受付の欄に出てきた言葉だけを、1つにつき1行で説明する(一覧のカードには出さない)。
//
// 決まり
// - 説明は、はじめての神楽ガイド(scripts/lib/guide.mjs)に出典つきで書いてあることの範囲にとどめる。金額や作法の細かい決まりは書かない(地域と公演で違うため)。
//   ・御初穂料・御神前: ガイド「お礼の気持ち(御花・御神前)」(出典: 高千穂町観光協会「高千穂の夜神楽」)
//   ・神楽宿: ガイド「神社の祭り・夜神楽」(出典: 同上。夜神楽の会場は、神社に限らず、民家や公民館のこともある)
//   ・御花: ガイド「お礼の気持ち(御花・御神前)」(出典: 浜田市観光協会「石見神楽 Q&A」)
// - 言葉を足すときは、ガイドに出典つきの説明を先に書く。開催ページからガイドへのリンクは置かない(2026-10-30 運営者の判断)。
export const CHECKED = "2026-10-25"; // ガイドの確認日と同じ

export const GLOSSARY = [
  { id: "hatsuho", re: /初穂料|[ご御]神前/, term: "御初穂料・御神前(ご神前)", text: "神事に参列する礼儀として、受付で納めるもの(お金など)のことです。" },
  { id: "kagurayado", re: /神楽宿/, term: "神楽宿(かぐらやど)", text: "夜神楽の会場になる、民家や公民館のことです。" },
  { id: "ohana", re: /御花/, term: "御花(おはな)", text: "神楽の団体に渡すご祝儀のことです。気持ちなので、任意です。" },
];

/** その開催に出てくる言葉の説明(出てこなければ空) */
export const glossFor = (x = {}) => {
  const texts = [x.name, x.description, x.fee, x.venue, x.booking, x.reservation, x.closed].filter((v) => typeof v === "string");
  return GLOSSARY.filter((g) => texts.some((t) => g.re.test(t)));
};

/** 要点の枠の下に出す形。esc は呼び出し側のもの */
export const glossHtml = (x, { esc }) => {
  const list = glossFor(x);
  return list.length ? `<dl class="gloss" aria-label="ことばの説明">${list.map((g) => `<div><dt>${esc(g.term)}</dt><dd>${esc(g.text)}</dd></div>`).join("")}</dl>` : "";
};
