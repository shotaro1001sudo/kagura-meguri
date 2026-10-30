// A link like /experiences.html#experience-pref-340000 points into a closed region.
// Open that region and show it from its heading; everything stays usable without this script.
(function () {
  function reveal() {
    var id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (_) { return; }
    var target = id && document.getElementById(id);
    var region = target && target.closest('details');
    if (!region || region.open) return;
    region.open = true;
    region.scrollIntoView();
  }
  window.addEventListener('hashchange', reveal);
  reveal();
})();
