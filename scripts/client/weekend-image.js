/* 今週末の公演を、SNS 用の縦長の画像(1080×1350)に描く。描くのはこのブラウザの中だけで、外部には送らない。
   データは、ページに埋め込んだ #sns-data(ビルドのときに作る)。「画像を保存」で PNG を保存、共有できる端末では「共有する」も出す */
(function () {
var box = document.getElementById('sns-kit');
if (!box) return;
var data;
try { data = JSON.parse(document.getElementById('sns-data').textContent); } catch (e) { return; }
var W = 1080, H = 1350, M = 72, FOOT = H - 196;
var C = { bg: '#171513', fg: '#e4ddd0', mut: '#aaa093', line: '#3a352e', ac: '#cf7a68', gold: '#b3a272' };
var SERIF = '"Shippori Mincho","Hiragino Mincho ProN","Yu Mincho",serif', SANS = '"Zen Kaku Gothic New","Hiragino Sans","Yu Gothic",sans-serif';
var NOSTART = '、。，．・：；？！）」』】〕ー…';

function font(g, f, color) { g.font = f; g.fillStyle = color; }
// 和文の折り返し: 幅を超えたら改行し、句読点・閉じかっこは行の頭に出さない。英数字の並び(日付・URL)の途中でも切らない。
// lines 行を超えたら、最後の行を「…」で切る
var ALNUM = /[0-9A-Za-z.\/:-]/;
function wrap(g, text, max, lines) {
  var out = [], cur = '', cut = false;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (cur && g.measureText(cur + ch).width > max && NOSTART.indexOf(ch) < 0) {
      var carry = '';
      if (ALNUM.test(ch)) { var m = cur.match(/[0-9A-Za-z.\/:-]+$/); if (m && m[0].length < cur.length) { carry = m[0]; cur = cur.slice(0, -carry.length); } }
      out.push(cur); cur = carry;
      if (out.length === lines) { cut = true; break; }
    }
    cur += ch;
  }
  if (!cut) { if (cur) out.push(cur); return out; }
  var last = out[lines - 1];
  while (last && g.measureText(last + '…').width > max) last = last.slice(0, -1);
  out[lines - 1] = last + '…';
  return out;
}
// 1件分(左に日付、右に名称・時刻と場所・出演)。描く前に高さを測るため、measureOnly なら描かない
function row(g, it, y, measureOnly) {
  var tx = M + 178, tw = W - M - tx;
  g.font = '500 42px ' + SERIF; var name = wrap(g, it.name, tw, 2);
  g.font = '500 29px ' + SANS; var meta = wrap(g, it.meta, tw, 2);
  var trp = it.troupes ? wrap(g, '出演: ' + it.troupes, tw, 1) : [];
  var h = 30 + name.length * 58 + 6 + meta.length * 42 + trp.length * 42 + 26;
  if (measureOnly) return h;
  font(g, '500 54px ' + SERIF, C.ac); g.fillText(it.md, M, y + 76);
  font(g, '500 28px ' + SANS, C.mut); g.fillText(it.wd, M + 4, y + 120);
  var yy = y + 30;
  font(g, '500 42px ' + SERIF, C.fg); name.forEach(function (l) { yy += 50; g.fillText(l, tx, yy); yy += 8; });
  yy += 6;
  font(g, '500 29px ' + SANS, C.mut); meta.forEach(function (l) { yy += 40; g.fillText(l, tx, yy); });
  font(g, '500 29px ' + SANS, C.gold); trp.forEach(function (l) { yy += 42; g.fillText(l, tx, yy); });
  g.fillStyle = C.line; g.fillRect(M, y + h - 1, W - M * 2, 2);
  return h;
}
// 入るだけ並べる。入りきらなければ「ほか N件」。more が false なら、入らない分は黙って省く(このあとの公演の、埋め草)
function rows(g, list, y, more) {
  var drawn = 0;
  for (var i = 0; i < list.length; i++) {
    var h = row(g, list[i], y, true), rest = list.length - i - 1;
    if (y + h > FOOT - (rest && more ? 64 : 0)) break;
    row(g, list[i], y, false); y += h; drawn++;
  }
  if (more && drawn < list.length) { font(g, '500 30px ' + SANS, C.mut); g.fillText('ほか ' + (list.length - drawn) + '件は、サイトでご覧ください', M, y + 54); y += 80; }
  return y;
}
function draw(g) {
  g.textBaseline = 'alphabetic';
  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
  g.fillStyle = C.ac; g.fillRect(M, 70, 96, 4);
  font(g, '500 30px ' + SANS, C.gold); g.fillText(data.site, M, 134);
  font(g, '500 76px ' + SERIF, C.fg); g.fillText(data.title, M, 236);
  font(g, '500 40px ' + SERIF, C.ac); g.fillText(data.range, M, 302);
  g.fillStyle = C.line; g.fillRect(M, 340, W - M * 2, 2);
  var y = 344;
  if (data.items.length) y = rows(g, data.items, y, true);
  else { font(g, '500 34px ' + SERIF, C.fg); g.fillText('今週末の掲載は、いまのところありません', M, y + 74); y += 110; }
  // 空いた場所に、このあとの公演を入れる(1件も入らなければ、見出しも出さない)
  var next = data.next;
  if (next.length && y + 70 + row(g, next[0], 0, true) <= FOOT) {
    font(g, '500 30px ' + SANS, C.gold); g.fillText(data.nextTitle, M, y + 62);
    rows(g, next, y + 76, false);
  }
  g.fillStyle = C.line; g.fillRect(M, FOOT, W - M * 2, 2);
  font(g, '500 24px ' + SANS, C.mut);
  wrap(g, data.note, W - M * 2, 1).concat([data.asOf]).forEach(function (l, i) { g.fillText(l, M, FOOT + 48 + i * 34); });
  font(g, '500 38px ' + SANS, C.fg); g.fillText(data.url, M, H - 62);
}

var cv = document.createElement('canvas');
cv.width = W; cv.height = H; cv.className = 'sns-canvas';
cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', data.alt);
box.querySelector('.sns-preview').appendChild(cv);
var save = document.getElementById('sns-save'), share = document.getElementById('sns-share'), st = document.getElementById('sns-status');
// 字形がそろってから描く(Webフォントの読み込みを待つ。待ちすぎたら、手元の字体で描く)
var all = [data.title, data.range, data.site, data.note, data.asOf, data.url, data.nextTitle].concat(data.items.concat(data.next).map(function (x) { return x.md + x.wd + x.name + x.meta + (x.troupes || ''); })).join('') + '出演:ほか件は、サイトでご覧くださいいまのところありません…';
var fonts = document.fonts && document.fonts.load
  ? document.fonts.ready.then(function () { return Promise.all([document.fonts.load('500 76px "Shippori Mincho"', all), document.fonts.load('500 30px "Zen Kaku Gothic New"', all)]); })
  : Promise.resolve();
Promise.race([fonts, new Promise(function (r) { setTimeout(r, 4000); })]).catch(function () {}).then(function () {
  draw(cv.getContext('2d'));
  save.disabled = false;
  if (share && navigator.canShare) cv.toBlob(function (b) { try { if (b && navigator.canShare({ files: [new File([b], data.file, { type: 'image/png' })] })) share.hidden = false; } catch (e) {} }, 'image/png');
});
function blob(fn) { cv.toBlob(function (b) { if (b) fn(b); else st.textContent = '画像を作れませんでした。'; }, 'image/png'); }
save.addEventListener('click', function () {
  blob(function (b) {
    var a = document.createElement('a'), u = URL.createObjectURL(b);
    a.href = u; a.download = data.file; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 10000);
    st.textContent = '画像を保存しました(' + data.file + ')。';
  });
});
if (share) share.addEventListener('click', function () {
  blob(function (b) {
    navigator.share({ files: [new File([b], data.file, { type: 'image/png' })], text: data.shareText }).catch(function () {});
  });
});
})();
