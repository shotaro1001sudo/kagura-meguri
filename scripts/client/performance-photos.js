// Capture covers lazy images and finder results inserted after initial load.
(function () {
  function failed(img) {
    if (img.matches('.performance-photo img')) img.closest('.performance-photo').hidden = true;
  }
  document.addEventListener('error', function (event) {
    if (event.target instanceof HTMLImageElement) failed(event.target);
  }, true);
  document.querySelectorAll('.performance-photo img').forEach(function (img) {
    if (img.complete && img.naturalWidth === 0) failed(img);
  });
})();
