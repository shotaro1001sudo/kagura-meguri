/* ページの移動の、なめらかな切り替え(View Transitions)。<head> で読み込む(最初の描画の前に、イベントを受け取るため)。
   一覧のカードの題名と、開催・定期公演ページの見出し(h1)に、移動の瞬間だけ同じ名前を付けて、位置と大きさをつなぐ。
   名前を前もって付けないのは、同じ開催が1ページに2回並ぶと、名前が重なって、切り替えが失敗するため。
   対応していないブラウザ・動きを減らす設定では、何もしない(普通に切り替わる)。 */
(function(){
  var DETAIL=/^\/(events|regular)\/[^/]+$/,NAME='ev-title';
  function path(u){try{var x=new URL(u,location.href);return x.origin===location.origin?decodeURIComponent(x.pathname):null}catch(e){return null}}
  function heading(){return document.querySelector('main h1')}
  function cardTitle(p){var a=[].slice.call(document.querySelectorAll('main .card h3 a, main .card h2 a')).filter(function(x){return path(x.href)===p})[0];return a&&a.closest('h3,h2')}
  function mark(el,vt){if(!el)return;el.style.viewTransitionName=NAME;vt.finished.finally(function(){el.style.viewTransitionName=''})}
  // 移動する前のページ: 行き先が開催ページなら、押したカードの題名に。いまが開催ページなら、見出しに
  addEventListener('pageswap',function(e){
    if(!e.viewTransition||!e.activation||!e.activation.entry)return;
    var to=path(e.activation.entry.url),here=location.pathname;
    if(!to)return;
    if(DETAIL.test(here))mark(heading(),e.viewTransition);else if(DETAIL.test(to))mark(cardTitle(to),e.viewTransition);
  });
  // 移動したあとのページ: 本文の出現の動き(pagein)は、切り替えと重なるので止める
  addEventListener('pagereveal',function(e){
    if(!e.viewTransition)return;
    document.documentElement.classList.add('vt');
    var from=window.navigation&&navigation.activation&&navigation.activation.from&&path(navigation.activation.from.url),here=location.pathname;
    if(!from)return;
    if(DETAIL.test(here))mark(heading(),e.viewTransition);else if(DETAIL.test(from))mark(cardTitle(from),e.viewTransition);
  });
})();
