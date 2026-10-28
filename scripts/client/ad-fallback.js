// Failed creatives stay hidden; recheck their parent when the consent controller
// changes other banners. Never mount VC tags or override its consent decision.
(function () {
  var failed = new WeakSet();
  function check(band) {
    var shown = [].some.call(band.querySelectorAll('.stay-banner'), function (b) {
      if (failed.has(b)) b.hidden = true;
      return !b.hidden;
    });
    band.hidden = !shown;
  }
  function sync() {
    document.querySelectorAll('.trip-band, .aff').forEach(function (band) {
      if (band.querySelector('.stay-banner')) check(band);
    });
  }
  function creative(img, success) {
    var banner = img.closest('.stay-banner');
    var band = banner && banner.closest('.trip-band, .aff');
    if (!band) return;
    if (success) {
      failed.delete(banner);
      // A late load after rejection must not reveal a VC slot.
      if (!banner.hasAttribute('data-vc-ad') ||
          ['allowed', 'unselected'].includes(window.kaguraVcConsent?.state)) banner.hidden = false;
    } else {
      failed.add(banner);
      banner.hidden = true;
    }
    check(band);
  }
  document.addEventListener('error', function (e) { if (e.target?.tagName === 'IMG') creative(e.target, false); }, true);
  document.addEventListener('load', function (e) { if (e.target?.tagName === 'IMG') creative(e.target, true); }, true);
  window.addEventListener('kagura:ads-ready', sync);
  document.querySelectorAll('.stay-banner img').forEach(function (img) {
    if (img.complete && !img.naturalWidth) creative(img, false);
  });
  sync();
})();
