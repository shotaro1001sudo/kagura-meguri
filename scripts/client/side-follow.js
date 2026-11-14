// PC(幅960px以上)の公演・定期公演ページ: 右の列(要点・宿・レンタカーなどの案内)を、スクロールに合わせてついて来させる。
// 列が画面に収まるときは、見出しの下で止まって、そのままついて来る。
// 列が画面より長いときは、列の下端が画面の下に届くまで普通に流れ、そこで止まる(下のほうの案内も、必ず見える)。
// 列の中だけをスクロールさせる箱にはしない(ぎこちない動きになるため)。位置の計算は、大きさが変わったときだけ行い、スクロール中は何もしない
(() => {
  const side = document.querySelector(".d-side");
  if (!side || typeof window.matchMedia !== "function") return;
  const wide = window.matchMedia("(min-width:960px)");
  const header = document.querySelector(".top");
  const GAP = 16;
  let queued = false;
  function update() {
    queued = false;
    if (!wide.matches) { side.classList.remove("follow"); return; }
    const head = Math.ceil(header ? header.getBoundingClientRect().height : 0) + GAP;
    const top = Math.min(head, window.innerHeight - side.offsetHeight - GAP);
    side.style.setProperty("--side-top", `${top}px`);
    side.classList.add("follow");
  }
  function queue() { if (!queued) { queued = true; window.requestAnimationFrame(update); } }
  window.addEventListener("resize", queue, { passive: true });
  if (typeof wide.addEventListener === "function") wide.addEventListener("change", queue);
  // 画像(バナー)の読み込みや、同意のあとに出る広告で列の高さが変わったら、止まる位置を計算し直す
  if (typeof ResizeObserver === "function") new ResizeObserver(queue).observe(side);
  window.addEventListener("load", queue);
  update();
})();
