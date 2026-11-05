// 動画の再生ボタン: 押したときに初めて、YouTube(プライバシー強化モードの youtube-nocookie.com)の再生画面を読み込む。
// 押すまでは、YouTube に一切つながない(プライバシーポリシーの外部送信の表のとおり)。
(function(){
document.addEventListener('click',function(ev){
  var b=ev.target&&ev.target.closest?ev.target.closest('button.yt-play[data-yt]'):null;
  if(!b)return;
  var id=b.getAttribute('data-yt')||'';
  if(!/^[A-Za-z0-9_-]{11}$/.test(id))return;
  var f=document.createElement('iframe');
  f.src='https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&rel=0&playsinline=1';
  f.title=(b.getAttribute('data-title')||'動画')+'(YouTube)';
  f.setAttribute('allow','autoplay; encrypted-media; picture-in-picture; fullscreen');
  f.setAttribute('allowfullscreen','');
  // YouTube は、埋め込み先のサイト(オリジン)が分からないと再生しない。送るのはオリジンだけ
  f.setAttribute('referrerpolicy','strict-origin-when-cross-origin');
  b.parentNode.replaceChild(f,b);
  f.focus();
});
})();
