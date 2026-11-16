// PCの両サイドのPR枠(2026-11-15 運営者の依頼): 上端を、本文の枠の上端にそろえる。
// 画面を下へ動かしてその枠が上へ消えたあとは、画面の上(96px)に付いてくる。
// スクリプトが動かないときは、ずっと 96px(CSS の既定)。
(() => {
  const rails = document.querySelectorAll(".side-rail");
  // そろえる相手は、ページの種類ごとに1つに決める(同じ種類のページは、どれも同じ決まり。2026-11-15 運営者の依頼「全公演ページで統一」)。
  // - 公演ページ(開催・定期公演)と今週末・今月: 右の列(.d-side)の上端 = 要点の枠(日時・会場)の上端。宿の枠がない公演でも同じ高さになる
  // - 終了した開催: 右の列がないので、要点の枠(.keyinfo)の上端
  // - 都道府県: 宿の枠。日付・会場・キーワードから探す: 探す条件の枠。地図で探す: 地図。種類で探す: 最初のカードの並び
  // - 神楽の種類(各神楽のページ): 「◯◯県の宿」の枠(県のページと同じ。2026-11-15 運営者の依頼。その日のうちに「◯◯とは」→「歴史」→ 宿の枠 と変わった)
  // - トップ: 開催予定の、月の最初の公演のカード(同日の依頼)
  // - 月別のページ: 最初の公演のカード(トップと同じ。同日の監査で、月別のページにも PR 枠を出した)
  // 各神楽のページは、同日「県のページと同じ並びに」で宿の枠が「歴史」より上に来たので、県のページと同じく宿の枠(aside.aff)にそろう
  // (運営者の判断「宿の高さにして」。「歴史」の高さのままだと、PCの最初の画面にPR枠が出なかった)
  const anchor = document.querySelector("main .d-side") ||
    document.querySelector("main .keyinfo, main .stay, main .kagura-folds, main aside.aff, main .finder, main .mapbox, main .kagura-region .cardgrid, main #list .card, main h2.sr + .card");
  if (!rails.length || !anchor) return;
  // 1画面に収まらないバナーは、下から隠す(2026-11-16 運営者の依頼「トップの両サイドのPRの下の方が切れている」)。
  // 上端が本文の枠にそろって下がっているあいだ(トップは最初の公演のカードが画面の下の方にある)は、CSS の高さごとの数では収まらないため。
  // 画面を下へ動かして枠が上がるにつれて、隠したバナーがまた出てくる。1つも収まらないときは、下の「PR」も出さない
  const fit = (rail, top) => {
    if (getComputedStyle(rail).display === "none") return;
    const items = [...rail.children].filter((c) => !c.classList.contains("pr-foot"));
    for (const c of items) c.classList.remove("rail-out");
    const foot = rail.querySelector(":scope > .pr-foot"), gap = parseFloat(getComputedStyle(rail).rowGap) || 0;
    const room = innerHeight - top - 8 - (foot ? foot.offsetHeight + gap : 0);
    let used = 0, shown = 0, out = false;
    for (const c of items) {
      if (getComputedStyle(c).display === "none") continue;
      const h = (shown ? gap : 0) + c.offsetHeight;
      if (out || used + h > room) { out = true; c.classList.add("rail-out"); continue; }
      used += h; shown++;
    }
    rail.classList.toggle("rail-none", !shown);
  };
  let last = "";
  const place = (force) => {
    // 公演ページの右の列は画面に付いてくる(上から約97px で止まる)ので、そのあいだも右の列と同じ高さになる
    const top = Math.round(Math.max(96, anchor.getBoundingClientRect().top));
    const key = top + "x" + innerHeight + "x" + innerWidth;
    if (key === last && force !== true) return;
    last = key;
    for (const rail of rails) { rail.style.setProperty("--rail-top", top + "px"); fit(rail, top); }
  };
  const again = () => place(true);
  // バナーの画像が読み込まれたときと、広告の同意でバナーが出たり消えたりしたときも、数え直す
  for (const rail of rails) {
    rail.addEventListener("load", again, true);
    if (typeof MutationObserver === "function") new MutationObserver(again).observe(rail, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden"] });
  }
  addEventListener("scroll", () => place(), { passive: true });
  addEventListener("resize", () => place());
  addEventListener("load", again);
  // 画像や文字の読み込みで本文の高さが変わったときや、本文の出てくる動きが終わったときも、位置を合わせ直す
  if (typeof ResizeObserver === "function") new ResizeObserver(() => place()).observe(document.body);
  document.addEventListener("transitionend", () => place(), true);
  document.addEventListener("animationend", () => place(), true);
  place(true);
})();
