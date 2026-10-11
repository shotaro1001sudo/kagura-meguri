/* トップの「開催予定」: 地方 → 都道府県で絞り込む。最初は決まった件数まで出し、「すべて見る」で残りも出す。
   定期公演は最初の3件だけ出し、「すべて表示」で残りも出す。JS が動かないときは、HTML のまま(残りは、日付・場所で探すへのリンク) */
(function () {
  var d = document, list = d.getElementById('list');
  if (!list) return;
  var g = d.querySelector('.regions:not(.prefs)'), pf = d.querySelector('.regions.prefs'), more = d.getElementById('showall');
  var st = { r: '', p: '', all: false };
  function press(box, key, v) { box.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset[key] === v)); }); }
  function apply() {
    var n = 0;
    list.querySelectorAll('.mgroup').forEach(function (m) {
      var k = 0;
      m.querySelectorAll('[data-r]').forEach(function (el) {
        var show = st.p ? el.dataset.p === st.p : st.r ? el.dataset.r === st.r : (st.all || !el.classList.contains('ov'));
        el.hidden = !show; if (show) k++;
      });
      m.hidden = k === 0; n += k;
    });
    d.getElementById('none').hidden = n > 0;
    if (more) more.parentNode.hidden = st.all || !!st.r || !list.querySelector('.ov');
    var key = st.p || st.r, any = false;
    d.querySelectorAll('.later a').forEach(function (a) {
      var c = key ? (JSON.parse(a.dataset.c)[key] || 0) : +a.dataset.n;
      a.querySelector('span').textContent = c + '件'; a.hidden = c === 0; if (c) any = true;
    });
    var lw = d.querySelector('.laterwrap'); if (lw) lw.hidden = !any;
  }
  if (g) {
    g.hidden = false;
    g.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      st.r = b.dataset.r; st.p = ''; press(g, 'r', st.r);
      if (pf) { // その地方に、開催のある県が2つ以上あるときだけ、県のボタンを出す
        var shown = 0;
        pf.querySelectorAll('button').forEach(function (x) { var on = !!st.r && (x.dataset.p === '' || x.dataset.in === st.r); x.hidden = !on; if (on && x.dataset.p) shown++; });
        pf.hidden = shown < 2; press(pf, 'p', '');
      }
      apply();
    });
  }
  if (pf) pf.addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (!b) return; st.p = b.dataset.p; press(pf, 'p', st.p); apply(); });
  if (more) more.addEventListener('click', function (ev) { ev.preventDefault(); st.all = true; apply(); });
  var rl = d.querySelector('.reglist'), rb = d.getElementById('regmore');
  if (rl && rb) {
    var rest = [].slice.call(rl.querySelectorAll('.card')).slice(3);
    if (rest.length) {
      rest.forEach(function (c) { c.hidden = true; });
      rb.parentNode.hidden = false;
      rb.addEventListener('click', function () { rest.forEach(function (c) { c.hidden = false; }); rb.parentNode.hidden = true; });
    }
  }
  apply();
})();
