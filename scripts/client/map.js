/* 地図で探す: 同じ場所の開催は1本のピンにまとめる(数字は件数。吹き出しに、日付順の一覧)。
   地図は国土地理院の淡色地図(日本語の表記で、外国の地名が外国語の文字で出ない。色も静かで画面になじむ)。
   ピンの色: 朱=日付のある開催 / 金=定期公演 / 半分ずつ=両方。
   ページのスクロールとぶつからないように、マウスはクリックしてからホイールで拡大、指で触る端末は「地図を動かす」を押してから動かす。
   下の会場の一覧の会場名を押すと、地図がその場所に移り、吹き出しが開く */
document.addEventListener('DOMContentLoaded', function () {
  var d = document, msg = d.getElementById('mapmsg'), box = d.getElementById('map'), lock = d.getElementById('maplock');
  if (typeof L === 'undefined') { box.hidden = true; if (lock) lock.hidden = true; msg.textContent = '地図を読み込めませんでした。通信状況をご確認のうえ、ページを再読み込みしてください。一覧・日付と場所の検索からも開催情報をご覧いただけます。'; return; }
  var touch = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);
  var map = L.map('map', { scrollWheelZoom: false, dragging: !touch, tap: false }).setView([34.5, 133.5], 6);
  L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>' }).addTo(map);
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
      .map(function (x) { return { x: x, ev: true, html: '<span class="pd">' + md(x.start) + '</span><a href="/events/' + esc(x.id) + '.html">' + esc(x.name) + '</a><span class="meta">' + (x.timeUnknown ? '時間は公式情報をご確認ください' : esc(x.sessions && x.sessions.length ? x.sessions.join('・') : x.start.slice(11, 16) + '〜' + (x.end && x.end.slice(0, 10) === x.start.slice(0, 10) ? x.end.slice(11, 16) : ''))) + '</span>' }; })
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
    var byVenue = {}, bySpot = {}, pts = [];
    order.forEach(function (k) {
      var s = spots[k], cls = s.ev && s.reg ? 'mix' : s.ev ? 'ev' : 'reg', size = s.n > 1 ? 30 : 24; // 押せる大きさは 24px 以上(WCAG 2.2 2.5.8)
      var icon = L.divIcon({ className: 'pin ' + cls, html: s.n > 1 ? String(s.n) : '', iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2] });
      var html = s.vorder.map(function (v) { var g = s.venues[v]; return '<b>' + esc(g.name) + '</b><ul>' + g.items.map(function (h) { return '<li>' + h + '</li>'; }).join('') + '</ul>'; }).join('');
      var m = L.marker([s.lat, s.lng], { icon: icon, title: s.vorder.map(function (v) { return s.venues[v].name; }).join('、') + '(' + s.n + '件)' }).addTo(map).bindPopup(html, { maxWidth: 280 });
      s.vorder.forEach(function (v) { byVenue[v] = m; });
      bySpot[k] = m;
      pts.push([s.lat, s.lng]);
    });
    nearby(items, bySpot);
    if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40] }); else if (pts.length) map.setView(pts[0], 9); else msg.textContent = 'いま地図に出せる開催情報はありません。';
    var smooth = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    d.querySelectorAll('.vjump').forEach(function (b) {
      var m = byVenue[b.dataset.k]; if (!m) return;
      b.disabled = false;
      b.addEventListener('click', function () { box.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' }); map.setView(m.getLatLng(), Math.max(map.getZoom(), 12)); m.openPopup(); });
    });
  }).catch(function () { msg.textContent = '開催情報を読み込めませんでした。時間をおいて再読み込みしてください。'; });

  /* 現在地から近い開催(2026-11-14 運営者の依頼)。
     ボタンを押したときだけ、ブラウザの位置情報を1回だけ使う。距離は、この端末の中で計算する(直線距離)。
     位置情報は、送らない・保存しない・アクセス解析にも送らない。URL にも残さない */
  function nearby(items, bySpot) {
    var btn = d.getElementById('nearme'), out = d.getElementById('nearlist'), say = d.getElementById('nearmsg'), note = d.getElementById('nearnote');
    if (!btn || !out || !say || !navigator.geolocation || window.isSecureContext === false) return;
    btn.hidden = false; if (note) note.hidden = false;
    var SHOW = 10, FIT = 5, you = null;
    var rad = function (x) { return x * Math.PI / 180; };
    var km = function (a, b, c, e) { var p = Math.sin(rad(c - a) / 2), q = Math.sin(rad(e - b) / 2), h = p * p + Math.cos(rad(a)) * Math.cos(rad(c)) * q * q; return 12742 * Math.asin(Math.min(1, Math.sqrt(h))); };
    var kmText = function (n) { return n < 1 ? '1km未満' : n < 10 ? '約' + n.toFixed(1).replace(/\.0$/, '') + 'km' : '約' + Math.round(n) + 'km'; };
    function show(lat, lng) {
      var list = items.map(function (it) { return { it: it, k: (+it.x.lat).toFixed(4) + ',' + (+it.x.lng).toFixed(4), km: km(lat, lng, +it.x.lat, +it.x.lng) }; })
        .sort(function (a, b) { return a.km - b.km || (a.it.ev === b.it.ev ? (a.it.x.start || '') < (b.it.x.start || '') ? -1 : 1 : a.it.ev ? -1 : 1); })
        .slice(0, SHOW);
      if (!list.length) { say.textContent = 'いま地図に出せる開催情報はありません。'; return; }
      var row = function (r) {
        var x = r.it.x, when = r.it.ev ? md(x.start) : '定期公演', href = (r.it.ev ? '/events/' : '/regular/') + esc(x.id) + '.html';
        return '<li><span class="km">' + kmText(r.km) + '</span><span class="pd">' + when + '</span><a href="' + href + '">' + esc(x.name) + '</a>'
          + '<span class="meta">' + esc(x.prefecture + (x.city || '') + (x.venue ? '・' + x.venue : '')) + '</span>'
          + (bySpot[r.k] ? '<button type="button" class="linkbtn nearjump" data-k="' + esc(r.k) + '">地図で見る</button>' : '') + '</li>';
      };
      out.innerHTML = '<h2 id="near-h">現在地から近い開催</h2><p class="meta">近い順に' + list.length + '件。距離は直線距離で、道のりではありません。行き方は、公式情報や地図アプリでご確認ください。</p><ol class="nearlist">' + list.map(row).join('') + '</ol>';
      out.hidden = false;
      say.textContent = '現在地から近い開催を、' + list.length + '件表示しました。';
      out.querySelectorAll('.nearjump').forEach(function (b) {
        b.addEventListener('click', function () { var m = bySpot[b.dataset.k]; if (!m) return; box.scrollIntoView({ block: 'center' }); map.setView(m.getLatLng(), Math.max(map.getZoom(), 12)); m.openPopup(); });
      });
      // 地図: 現在地の印をつけ、現在地と近い会場が入るように合わせる
      if (you) map.removeLayer(you);
      you = L.circleMarker([lat, lng], { radius: 8, weight: 3, color: '#fff', fillColor: '#2f6fb3', fillOpacity: 1, className: 'you' }).addTo(map).bindTooltip('現在地(おおよそ)');
      map.fitBounds([[lat, lng]].concat(list.slice(0, FIT).map(function (r) { return [+r.it.x.lat, +r.it.x.lng]; })), { padding: [40, 40], maxZoom: 12 });
    }
    btn.addEventListener('click', function () {
      btn.disabled = true; say.textContent = '現在地を調べています…';
      navigator.geolocation.getCurrentPosition(function (p) {
        btn.disabled = false; show(p.coords.latitude, p.coords.longitude);
      }, function (e) {
        btn.disabled = false;
        say.textContent = e && e.code === 1 ? '位置情報の利用が許可されていません。ブラウザの設定で許可するか、下の会場の一覧から探してください。'
          : e && e.code === 3 ? '時間内に現在地を調べられませんでした。もう一度お試しください。'
          : '現在地を調べられませんでした。下の会場の一覧から探してください。';
      }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
    });
  }
});
