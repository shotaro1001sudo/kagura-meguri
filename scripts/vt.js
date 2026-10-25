/* ページ移動では、題名も本文と一緒に現れる。カードからでも、通常のリンクからでも同じ動きにする。
   <head> で受け取り、最初の描画より前に pagein と View Transition の二重再生を防ぐ。
   .vt は復元時も残す。終了時に外すと pagein が再び始まってしまう。
   非対応・JSなしでは通常の pagein / 静的表示、動きを減らす設定では CSS が両方を止める。 */
(function(){
  addEventListener('pagereveal',function(e){
    if(!e.viewTransition)return;
    document.documentElement.classList.add('vt');
  });
})();
