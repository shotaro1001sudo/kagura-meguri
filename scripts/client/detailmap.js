/* 開催ページ・定期公演ページの地図: 最初は小さく、動かさない(ページのスクロールとぶつからない)。
   「地図を大きく見る」を押すと、大きくなり、指やマウスで動かせる。位置は、地図の要素の data-lat / data-lng / data-zoom から読む */
document.addEventListener('DOMContentLoaded', function () {
  var el = document.getElementById('map'), btn = document.getElementById('mapbig');
  if (!el) return;
  if (typeof L === 'undefined') { el.parentNode.hidden = true; return; }
  var at = [+el.dataset.lat, +el.dataset.lng];
  var m = L.map('map', { scrollWheelZoom: false, dragging: false, tap: false, zoomControl: false }).setView(at, +el.dataset.zoom || 15);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(m);
  L.marker(at, { icon: L.divIcon({ className: 'pin ev', iconSize: [24, 24], iconAnchor: [12, 12] }), title: el.getAttribute('aria-label') }).addTo(m);
  var zc = L.control.zoom();
  if (btn) btn.addEventListener('click', function () {
    var big = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(big)); btn.textContent = big ? '地図を小さくする' : '地図を大きく見る';
    el.parentNode.classList.toggle('big', big);
    if (big) { m.dragging.enable(); m.scrollWheelZoom.enable(); zc.addTo(m); } else { m.dragging.disable(); m.scrollWheelZoom.disable(); zc.remove(); }
    m.invalidateSize(); m.setView(at, m.getZoom());
  });
});
