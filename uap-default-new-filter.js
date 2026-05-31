(function(){
  'use strict';
  if (window.__uapDefaultNewFilter) return;
  window.__uapDefaultNewFilter = true;

  var applied = false;
  var attempts = 0;

  function apply(){
    if (applied || attempts > 40) return;
    attempts += 1;
    var btn = document.getElementById('uap-new-filter-toggle');
    if (!btn) {
      setTimeout(apply, 100);
      return;
    }
    if (btn.getAttribute('aria-pressed') !== 'true') btn.click();
    applied = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  else setTimeout(apply, 0);
  window.addEventListener('load', apply, { once: true });
})();
