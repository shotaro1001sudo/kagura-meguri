/* 共有: 「リンクをコピー」を押すと、このページの URL をコピーする(コピーできない環境では、URL を選べる形で出す) */
document.addEventListener('click', function (ev) {
  var b = ev.target.closest('[data-copy]');
  if (!b) return;
  var u = b.getAttribute('data-copy'), done = function () { b.textContent = 'コピーしました'; setTimeout(function () { b.textContent = 'リンクをコピー'; }, 2500); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done, function () { window.prompt('このリンクをコピーしてください', u); });
  else window.prompt('このリンクをコピーしてください', u);
});
