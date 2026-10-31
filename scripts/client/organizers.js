// 主催者の方へ: スマホでは、冒頭の「掲載を依頼する」ボタンより下を読んでいて、最後のボタンがまだ見えない間だけ、
// 画面の下に申し込みボタンを出す(最後のボタンやフッターの上には重ねない)。PC(画面が広いとき)は CSS で出さない。
// スクリプトがなければ何もしない(冒頭と最後のボタンはそのまま使える)。
(function () {
  var bar = document.querySelector('.octa-bar');
  var top = document.querySelector('.octa');
  var end = document.querySelector('.cta-end');
  if (!bar || !top || !end) return;
  var waiting = false;
  function sync() {
    waiting = false;
    bar.hidden = !(top.getBoundingClientRect().bottom < 0 && end.getBoundingClientRect().top > window.innerHeight);
  }
  function later() { if (!waiting) { waiting = true; requestAnimationFrame(sync); } }
  window.addEventListener('scroll', later, { passive: true });
  window.addEventListener('resize', later);
  sync();
})();
