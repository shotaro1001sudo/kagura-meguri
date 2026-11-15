// PCの両サイドのPR枠(2026-11-15 運営者の依頼): 上端を、本文の枠の上端にそろえる。
// 画面を下へ動かしてその枠が上へ消えたあとは、画面の上(96px)に付いてくる。
// スクリプトが動かないときは、ずっと 96px(CSS の既定)。
(() => {
  const rails = document.querySelectorAll(".side-rail");
  // そろえる相手は、ページの種類ごとに1つに決める(同じ種類のページは、どれも同じ決まり。2026-11-15 運営者の依頼「全公演ページで統一」)。
  // - 公演ページ(開催・定期公演)と今週末・今月: 右の列(.d-side)の上端 = 要点の枠(日時・会場)の上端。宿の枠がない公演でも同じ高さになる
  // - 終了した開催: 右の列がないので、要点の枠(.keyinfo)の上端
  // - 都道府県・神楽の種類: 宿の枠。日付・場所で探す: 探す条件の枠。地図で探す: 地図。種類で探す: 最初のカードの並び
  const anchor = document.querySelector("main .d-side") ||
    document.querySelector("main .keyinfo, main .stay, main aside.aff, main .finder, main .mapbox, main .kagura-region .cardgrid");
  if (!rails.length || !anchor) return;
  const place = () => {
    // 公演ページの右の列は画面に付いてくる(上から約97px で止まる)ので、そのあいだも右の列と同じ高さになる
    const top = Math.round(Math.max(96, anchor.getBoundingClientRect().top));
    for (const rail of rails) rail.style.setProperty("--rail-top", top + "px");
  };
  addEventListener("scroll", place, { passive: true });
  addEventListener("resize", place);
  addEventListener("load", place);
  // 画像や文字の読み込みで本文の高さが変わったときや、本文の出てくる動きが終わったときも、位置を合わせ直す
  if (typeof ResizeObserver === "function") new ResizeObserver(place).observe(document.body);
  document.addEventListener("transitionend", place, true);
  document.addEventListener("animationend", place, true);
  place();
})();
