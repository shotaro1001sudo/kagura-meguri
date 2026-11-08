/** 夜通し・深夜まで続く神楽か(MON-6)。
 * 公式の名称・説明の言葉だけで判断し、開始・終了の時刻からは推測しない(2026-10-26 の方針)。
 * データの overnightStay(true / false)で、開催ごとに上書きできる。
 * 戻り値: "yokagura"(名称・種類に「夜神楽」)/ "overnight"(説明に夜通しなど・明示)/ ""(対象外) */
export const overnightKagura = (e) => {
  if (e.overnightStay === false) return "";
  if (/夜神楽/.test(`${e.name ?? ""} ${e.kagura ?? ""}`)) return "yokagura";
  if (e.overnightStay === true || /夜通し|徹夜|翌朝まで|翌朝にかけて/.test(e.description ?? "")) return "overnight";
  return "";
};
