/* 共有: 「リンクをコピー」などを押すと、data-copy の URL をコピーする(コピーできない環境では、URL を選べる形で出す)。
   同じページで2回読み込まれても、1回分だけ動く。押したあとは、ボタンの元の文言に戻す */
(function () {
if (window.__kmCopy) return;
window.__kmCopy = 1;
document.addEventListener('click', function (ev) {
  var b = ev.target.closest('[data-copy]');
  if (!b) return;
  var label = b.getAttribute('data-label') || b.textContent;
  b.setAttribute('data-label', label);
  var u = b.getAttribute('data-copy'), done = function () { b.textContent = 'コピーしました'; setTimeout(function () { b.textContent = label; }, 2500); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done, function () { window.prompt('このリンクをコピーしてください', u); });
  else window.prompt('このリンクをコピーしてください', u);
});
})();
