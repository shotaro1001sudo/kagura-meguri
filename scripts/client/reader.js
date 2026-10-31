// 読み物(はじめての神楽ガイド・神楽の歴史): 章ナビで「今読んでいる見出し」を示し、ガイドでは持ち物チェックリストの数を数える。
// スクリプトがなくても、章ナビのリンクとチェックボックスはそのまま使える。チェックは保存しない。
(function () {
  var root = document.documentElement;
  var header = document.querySelector('.top');
  // 章ナビは、ヘッダーのすぐ下に固定する(ヘッダーの高さは画面幅で変わる)
  function setTop() { if (header) root.style.setProperty('--read-top', header.offsetHeight + 'px'); }
  setTop();
  if (header && window.ResizeObserver) new ResizeObserver(setTop).observe(header);

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nav = document.querySelector('.gnav');
  var list = nav && nav.querySelector('ol');
  var links = nav ? [].slice.call(nav.querySelectorAll('a[href^="#"]')) : [];
  var heads = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  var page = nav && nav.querySelector('a[aria-current="page"]');
  var last = -2, waiting = false;
  // 横に並ぶ章ナビ(スマホ・タブレット)では、今の見出し(歴史では今のページ)が見える位置まで横に送る
  function center(a) {
    if (!a || a.offsetParent === null) a = page;
    if (!a || !list || list.scrollWidth <= list.clientWidth + 1) return;
    var left = a.offsetLeft - (list.clientWidth - a.offsetWidth) / 2;
    if (list.scrollTo) list.scrollTo({ left: left, behavior: reduce ? 'auto' : 'smooth' }); else list.scrollLeft = left;
  }
  function mark(i) {
    links.forEach(function (a, k) { if (k === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    center(links[i]);
  }
  function update() {
    waiting = false;
    var line = Math.min(window.innerHeight * 0.35, 280), i = -1;
    heads.forEach(function (h, k) { if (h && h.getBoundingClientRect().top <= line) i = k; });
    if (i !== last) { last = i; mark(i); }
  }
  if (links.length) {
    window.addEventListener('scroll', function () { if (!waiting) { waiting = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  } else center(page);

  // 持ち物チェックリスト(ガイド): 用意できた数と、まとめて外すボタン
  var box = document.querySelector('.checklist');
  if (!box) return;
  var inputs = [].slice.call(box.querySelectorAll('input[type="checkbox"]'));
  var foot = box.querySelector('.checklist-foot');
  var count = box.querySelector('.checklist-count');
  var reset = box.querySelector('.checklist-reset');
  function sync() {
    var on = inputs.filter(function (x) { return x.checked; }).length;
    if (count) count.textContent = on === inputs.length ? 'ぜんぶ用意できました' : on + ' / ' + inputs.length + ' 用意した';
    if (reset) reset.hidden = !on;
    box.classList.toggle('done', on === inputs.length);
  }
  box.addEventListener('change', sync);
  if (reset) reset.addEventListener('click', function () { inputs.forEach(function (x) { x.checked = false; }); sync(); });
  if (foot) foot.hidden = false;
  sync();
})();
