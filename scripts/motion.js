/* 動きの制御。.js クラス(head のスクリプトが、動きを減らす設定でないときだけ付ける)がないと、何もしない */
(function () {
  var d = document, h = d.documentElement, w = window;
  if (!h.classList.contains('js')) return;

  /* オープニング(トップの最初の訪問だけ): 押す・キーを押すと、すぐ消す。消えたあとは、画面から外す */
  var splash = d.querySelector('.splash');
  if (splash && h.classList.contains('intro')) {
    var skip = function () { h.classList.add('unsplash'); };
    splash.addEventListener('click', skip);
    w.addEventListener('keydown', skip, { once: true });
    splash.addEventListener('animationend', function (e) { if (e.target === splash) splash.remove(); });
  }

  /* 視差(パララックス): スクロール量を、CSS変数 --py に渡すだけ。動かす計算は、CSSの translate が行う */
  var hero = d.querySelector('.home-hero');
  if (hero && 'IntersectionObserver' in w && w.matchMedia && w.matchMedia('(min-width:561px)').matches) {
    var visible = true, ticking = false;
    var update = function () { h.style.setProperty('--py', Math.min(w.pageYOffset || 0, 900) + 'px'); };
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      var sp = hero.querySelector('.sparks'); if (sp) sp.classList.toggle('off', !visible); // 見えていない間は、火の粉を止める
      // 一気に先頭へ戻ったときは、「見えるようになった」通知が、スクロールより遅れる。見えた瞬間に、最新の値へそろえる
      if (visible) update();
    }, { rootMargin: '120px' }).observe(hero);
    w.addEventListener('scroll', function () {
      if (!visible || ticking) return;
      ticking = true;
      w.requestAnimationFrame(function () { ticking = false; update(); });
    }, { passive: true });
    // 戻る/進む(ページの復元)のときも、いまの位置にそろえる
    w.addEventListener('pageshow', update);
    update();
  }
})();
