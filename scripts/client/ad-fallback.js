// 宿のバナー画像が読み込めないとき(広告ブロックや通信の失敗)は、そのバナーを隠す。
// 枠の中に見えるバナーが1つも残らなければ、見出しと「PR」だけの空の枠にならないよう、枠ごと隠す。
(function () {
  function check(band) {
    var shown = [].some.call(band.querySelectorAll(".stay-banner"), function (b) { return !b.hidden; });
    if (!shown) band.hidden = true;
  }
  function fail(img) {
    var banner = img.closest(".stay-banner");
    var band = banner && banner.closest(".trip-band, .aff");
    if (!band) return;
    banner.hidden = true;
    check(band);
  }
  document.addEventListener("error", function (e) { if (e.target && e.target.tagName === "IMG") fail(e.target); }, true);
  // このスクリプトより先に読み込みに失敗した画像(画面の上のほうのバナー)も拾う
  [].forEach.call(document.querySelectorAll(".stay-banner img"), function (img) { if (img.complete && !img.naturalWidth) fail(img); });
})();
