/* 地図で探す: 同じ場所の開催は1本のピンにまとめる(数字は件数。吹き出しに、日付順の一覧)。
   ピンの色: 朱=日付のある開催 / 金=定期公演 / 半分ずつ=両方。
   ページのスクロールとぶつからないように、マウスはクリックしてからホイールで拡大、指で触る端末は「地図を動かす」を押してから動かす。
   下の会場の一覧の会場名を押すと、地図がその場所に移り、吹き出しが開く */
document.addEventListener('DOMContentLoaded', function () {
  var d = document, msg = d.getElementById('mapmsg'), box = d.getElementById('map'), lock = d.getElementById('maplock');
  if (typeof L === 'undefined') { box.hidden = true; if (lock) lock.hidden = true; msg.textContent = '地図を読み込めませんでした。通信状況をご確認のうえ、ページを再読み込みしてください。一覧・日付と場所の検索からも開催情報をご覧いただけます。'; return; }
  var touch = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);
  var map = L.map('map', { scrollWheelZoom: false, dragging: !touch, tap: false }).setView([34.5, 133.5], 6);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(map);
  function live(on) {
    if (on) { map.scrollWheelZoom.enable(); map.dragging.enable(); } else { map.scrollWheelZoom.disable(); if (touch) map.dragging.disable(); }
    if (lock) { lock.setAttribute('aria-pressed', String(on)); lock.textContent = on ? '地図の操作を終える' : '地図を動かす'; }
  }
  if (lock) { lock.hidden = !touch; lock.addEventListener('click', function () { live(lock.getAttribute('aria-pressed') !== 'true'); }); }
  if (!touch) { map.on('click', function () { live(true); }); map.on('mouseout', function () { live(false); }); }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var WD = ['日', '月', '火', '水', '木', '金', '土'];
  var md = function (s) { var t = new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)); return (t.getMonth() + 1) + '月' + t.getDate() + '日(' + WD[t.getDay()] + ')'; };
  var vkey = function (x) { return x.prefecture + '|' + (x.city || '') + '|' + (x.venue || ''); };
  var get = function (u) { return fetch(u).then(function (r) { if (!r.ok) throw 0; return r.json(); }); };
  Promise.all([get('/events.json'), get('/regular.json')]).then(function (res) {
    var items = res[0].filter(function (x) { return x.up && x.lat && x.lng; }).sort(function (a, b) { return a.start < b.start ? -1 : 1; })
      .map(function (x) { return { x: x, ev: true, html: '<span class="pd">' + md(x.start) + '</span><a href="/events/' + esc(x.id) + '.html">' + esc(x.name) + '</a>' }; })
      .concat(res[1].filter(function (x) { return x.lat && x.lng; })
        .map(function (x) { return { x: x, ev: false, html: '<span class="pd">定期公演</span><a href="/regular/' + esc(x.id) + '.html">' + esc(x.name) + '</a> <small>' + esc(String(x.schedule).replace(/[(。].*$/, '')) + '</small>' }; }));
    // 同じ場所(緯度・経度がほぼ同じ)ごとにまとめる。その中を、会場ごとに分ける
    var spots = {}, order = [];
    items.forEach(function (it) {
      var k = (+it.x.lat).toFixed(4) + ',' + (+it.x.lng).toFixed(4);
      if (!spots[k]) { spots[k] = { lat: +it.x.lat, lng: +it.x.lng, venues: {}, vorder: [], ev: false, reg: false, n: 0 }; order.push(k); }
      var s = spots[k], v = vkey(it.x);
      if (!s.venues[v]) { s.venues[v] = { name: it.x.venue || it.x.city || '', items: [] }; s.vorder.push(v); }
      s.venues[v].items.push(it.html); s.n++; if (it.ev) s.ev = true; else s.reg = true;
    });
    var byVenue = {}, pts = [];
    order.forEach(function (k) {
      var s = spots[k], cls = s.ev && s.reg ? 'mix' : s.ev ? 'ev' : 'reg', size = s.n > 1 ? 30 : 22;
      var icon = L.divIcon({ className: 'pin ' + cls, html: s.n > 1 ? String(s.n) : '', iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2] });
      var html = s.vorder.map(function (v) { var g = s.venues[v]; return '<b>' + esc(g.name) + '</b><ul>' + g.items.map(function (h) { return '<li>' + h + '</li>'; }).join('') + '</ul>'; }).join('');
      var m = L.marker([s.lat, s.lng], { icon: icon, title: s.vorder.map(function (v) { return s.venues[v].name; }).join('、') + '(' + s.n + '件)' }).addTo(map).bindPopup(html, { maxWidth: 280 });
      s.vorder.forEach(function (v) { byVenue[v] = m; });
      pts.push([s.lat, s.lng]);
    });
    if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40] }); else if (pts.length) map.setView(pts[0], 9); else msg.textContent = 'いま地図に出せる開催情報はありません。';
    var smooth = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    d.querySelectorAll('.vjump').forEach(function (b) {
      var m = byVenue[b.dataset.k]; if (!m) return;
      b.disabled = false;
      b.addEventListener('click', function () { box.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' }); map.setView(m.getLatLng(), Math.max(map.getZoom(), 12)); m.openPopup(); });
    });
  }).catch(function () { msg.textContent = '開催情報を読み込めませんでした。時間をおいて再読み込みしてください。'; });
});
