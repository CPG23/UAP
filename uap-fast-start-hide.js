(function(){
  'use strict';
  if (window.__uapFastStartHide) return;
  window.__uapFastStartHide = true;

  function hideStart(){
    var loading = document.getElementById('loading');
    if (!loading) return;
    loading.classList.add('hidden');
    loading.setAttribute('aria-hidden', 'true');
    loading.style.setProperty('opacity', '0', 'important');
    loading.style.setProperty('visibility', 'hidden', 'important');
    loading.style.setProperty('pointer-events', 'none', 'important');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hideStart, { once: true });
  else hideStart();
  window.addEventListener('load', hideStart, { once: true });
  [100, 250, 500, 900, 1400, 2200, 4000].forEach(function(delay){ window.setTimeout(hideStart, delay); });
})();
