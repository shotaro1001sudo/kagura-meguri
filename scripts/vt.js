/* ページの移動の、なめらかな切り替え(View Transitions)。<head> で読み込む(最初の描画の前に、イベントを受け取るため)。
   一覧のカードの題名と、開催・定期公演ページの見出し(h1)に、移動の瞬間だけ同じ名前を付けて、位置と大きさをつなぐ。
   名前を前もって付けないのは、同じ開催が1ページに2回並ぶと、名前が重なって、切り替えが失敗するため。
   カードの題名は、ページによって h2〜h4 と違うので、カードの中の見出しを探す。押したカードがあれば、それを優先する。
   対応していないブラウザ・動きを減らす設定では、何もしない(普通に切り替わる)。 */
(function(){
  var DETAIL=/^\/(events|regular)\/[^/]+$/,NAME='ev-title',clicked=null;
  function path(u){try{var x=new URL(u,location.href);return x.origin===location.origin?decodeURIComponent(x.pathname):null}catch(e){return null}}
  function heading(){return document.querySelector('main h1')}
  function titleOf(a){var c=a&&a.closest('.card');return c&&c.querySelector('h2,h3,h4')}
  function visible(el){var r=el.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight}
  // 行き先(または移動元)が p のカードの題名。押したカードを最優先し、なければ、画面に見えているものを選ぶ
  function cardTitle(p){
    if(clicked&&path(clicked.href)===p&&titleOf(clicked))return titleOf(clicked);
    var hs=[].slice.call(document.querySelectorAll('main .card a[href]')).filter(function(a){return path(a.href)===p}).map(titleOf).filter(Boolean);
    return hs.filter(visible)[0]||hs[0];
  }
  function mark(el,vt){if(!el)return;el.style.viewTransitionName=NAME;vt.finished.finally(function(){el.style.viewTransitionName=''})}
  addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');clicked=a||null},true);
  // 移動する前のページ: 行き先が開催ページなら、押したカードの題名に。いまが開催ページなら、見出しに
  addEventListener('pageswap',function(e){
    if(!e.viewTransition)return;
    var to=e.activation&&e.activation.entry?path(e.activation.entry.url):clicked&&path(clicked.href),here=location.pathname;
    if(!to)return;
    if(DETAIL.test(here))mark(heading(),e.viewTransition);else if(DETAIL.test(to))mark(cardTitle(to),e.viewTransition);
  });
  // 移動したあとのページ: 本文の出現の動き(pagein)は、切り替えと重なるので止める
  addEventListener('pagereveal',function(e){
    if(!e.viewTransition)return;
    document.documentElement.classList.add('vt');
    var act=window.navigation&&navigation.activation,from=act&&act.from?path(act.from.url):path(document.referrer),here=location.pathname;
    if(!from||from===here)return;
    if(DETAIL.test(here))mark(heading(),e.viewTransition);else if(DETAIL.test(from))mark(cardTitle(from),e.viewTransition);
  });
})();
