// PC(幅960px以上)の公演・定期公演ページ: 右の列(要点・宿・レンタカーなどの案内)を、スクロールに合わせてついて来させる。
// 列が画面に収まるときは、見出しの下で止まって、そのままついて来る。
// 列が画面より長いときは、上の枠(要点など)が画面の上へ流れて隠れ、残りの枠が画面に収まるところで止まる。
// 止まったときに、上の枠が見出しの下から半分だけのぞかないよう、枠の切れ目で止める(2026-11-14 運営者の依頼)。
// ただし最初の広告の枠(宿など)は隠さない。そこから下が画面より長いときは、その枠を見出しの下に合わせて止め、下のほうの枠は列の終わりで見える。
// 列の中だけをスクロールさせる箱にはしない(ぎこちない動きになるため)。位置の計算は、大きさが変わったときだけ行い、スクロール中は何もしない
(() => {
  const side = document.querySelector(".d-side");
  if (!side || typeof window.matchMedia !== "function") return;
  const wide = window.matchMedia("(min-width:960px)");
  const header = document.querySelector(".top");
  const GAP = 16;
  let queued = false;
  function stopAt() {
    const headH = Math.ceil(header ? header.getBoundingClientRect().height : 0), head = headH + GAP;
    const room = window.innerHeight - head - GAP, height = side.offsetHeight;
    if (height <= room) return head;
    const base = side.getBoundingClientRect().top;
    const els = [...side.children].filter((x) => x.offsetHeight > 0);
    const boxes = els.map((x) => { const r = x.getBoundingClientRect(); return { top: r.top - base, bottom: r.bottom - base }; });
    // 最初の広告の枠(宿など。要点・協賛枠より後ろ)より下は、上へ流して隠さない
    const firstAd = els.findIndex((x) => !x.matches(".side-summary,.sponsor-slot,[class*=sponsor]"));
    for (let k = 0; k < boxes.length; k++) {
      if (height - boxes[k].top > room && k !== firstAd) continue;
      // この枠を見出しの下に合わせる。1つ上の枠の下端は、見出しに隠れる位置まで上げる
      // (最初の広告の枠から下が画面より長いときは、ここで止め、下のほうの枠は列の終わりで見えるようにする)
      return k === 0 ? head : Math.min(head - boxes[k].top, headH - boxes[k - 1].bottom);
    }
    return window.innerHeight - height - GAP;
  }
  function update() {
    queued = false;
    if (!wide.matches) { side.classList.remove("follow"); return; }
    side.style.setProperty("--side-top", `${stopAt()}px`);
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
