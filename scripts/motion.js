/* 動きの制御。.js クラス(head のスクリプトが、動きを減らす設定でないときだけ付ける)がないと、何もしない */
(function () {
  var d = document, h = d.documentElement, w = window;
  if (!h.classList.contains('js')) return;

  /* ① スクロール連動の出現: 画面に入った順に、少しずつ時間をずらして、ふわっと出す */
  var els = [].slice.call(d.querySelectorAll(%%SEL_JSON%%));
  var fired = false;
  var show = function (el) { el.classList.add('in'); };
  if (els.length && 'IntersectionObserver' in w) {
    var io = new IntersectionObserver(function (es) {
      fired = true;
      var n = 0;
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        el.style.transitionDelay = Math.min(n++, 5) * 70 + 'ms';
        show(el);
        io.unobserve(el);
        setTimeout(function () { el.style.transitionDelay = ''; }, 1300); // ホバーの反応に、遅れが残らないように
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    els.forEach(function (el) { io.observe(el); });
    // 保険: 観察が一度も始まらない環境(想定外)では、全部を表示する。表示済みの位置には、影響しない
    setTimeout(function () { if (!fired) els.forEach(show); }, 4000);
  } else {
    els.forEach(show);
  }
  w.addEventListener('beforeprint', function () { els.forEach(show); });

  /* ② 視差(パララックス): スクロール量を、CSS変数 --py に渡すだけ。動かす計算は、CSSの translate が行う */
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
