// PCの両サイドのPR枠(2026-11-15 運営者の依頼): 上端を、本文の宿の枠(「会場周辺の宿」「◯◯県の宿」など)の上端にそろえる。
// 画面を下へ動かして宿の枠が上へ消えたあとは、画面の上(96px)に付いてくる。
// スクリプトが動かないときは、ずっと 96px(CSS の既定)。
(() => {
  const rails = document.querySelectorAll(".side-rail");
  // 日付・場所で探すページは宿の枠がないので、探す条件の枠(.finder)の上端に、地図で探すページは地図(.mapbox)の上端に、
  // 種類で探すページは最初のカードの並び(.kagura-region .cardgrid)の上端にそろえる
  const anchor = document.querySelector("main .stay, main aside.aff, main .finder, main .mapbox, main .kagura-region .cardgrid");
  if (!rails.length || !anchor) return;
  const place = () => {
    // 開催ページの右の列は画面に付いてくる(上から約97px で止まる)ので、そのあいだも宿の枠と同じ高さになる
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
