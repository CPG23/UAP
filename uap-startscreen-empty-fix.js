(function(){
  'use strict';
  if (window.__uapStartscreenEmptyFix) return;
  window.__uapStartscreenEmptyFix = true;

  function clearLoading(){
    var loading = document.getElementById('loading');
    if (!loading) return;
    loading.setAttribute('aria-hidden', 'true');
    while (loading.firstChild) loading.removeChild(loading.firstChild);
  }

  function install(){
    clearLoading();
    var loading = document.getElementById('loading');
    if (!loading || !window.MutationObserver) return;
    var observer = new MutationObserver(function(){
      if (loading.firstChild) clearLoading();
    });
    observer.observe(loading, { childList: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  window.addEventListener('load', clearLoading, { once: true });
})();
