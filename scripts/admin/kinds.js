// 神楽の種類の名前の比べ方(画面とテストの両方で使う。画面のプログラムなので、ほかのファイルを読み込まない)
// 全角・半角、空白、「の」の有無をそろえる(「石見の神楽」→「石見神楽」)
export const kindKey = (s) => String(s || "").normalize("NFKC").toLowerCase().replace(/[\s　の]/g, "");

/** 似た名前の、サイトにある神楽の種類(同じ名前の書き方違い・片方がもう片方を含む) */
export function nearKinds(name, kinds = []) {
  const a = kindKey(name), stem = (s) => s.replace(/神楽$/, "");
  if (!a) return [];
  return kinds.filter((k) => { const b = kindKey(k); return a === b || (stem(b).length >= 2 && a.includes(stem(b))) || (stem(a).length >= 2 && b.includes(stem(a))); });
}
