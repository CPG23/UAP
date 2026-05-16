(function(){
  'use strict';
  if (window.__uapFinalStabilityFix) return;
  window.__uapFinalStabilityFix = true;

  function hideStart(){
    var loading = document.getElementById('loading');
    if (loading) loading.classList.add('hidden');
  }

  function reapplyStartupWallpaper(){
    var loading = document.getElementById('loading');
    if (!loading) return;
    while (loading.firstChild) loading.removeChild(loading.firstChild);
    loading.setAttribute('aria-hidden', 'true');
    loading.style.position = 'fixed';
    loading.style.inset = '0';
    loading.style.zIndex = '1000';
    loading.style.display = 'block';
    loading.style.overflow = 'hidden';

    var wallpaper = document.getElementById('uap-startscreen-wallpaper-style');
    if (wallpaper && wallpaper.parentNode) {
      document.head.appendChild(wallpaper);
    }
    window.setTimeout(hideStart, 5000);
  }

  function reorderNewBadges(){
    Array.prototype.slice.call(document.querySelectorAll('.article-topline')).forEach(function(line){
      var date = line.querySelector('.article-date-prominent');
      var badges = line.querySelector('.badges');
      var badge = line.querySelector('.uap-new-badge');
      if (!date || !badge) return;
      if (badge.parentNode !== line) {
        line.insertBefore(badge, date);
      } else if (line.firstElementChild !== badge) {
        line.insertBefore(badge, line.firstElementChild);
      }
      if (badges && !badges.children.length) badges.remove();
    });
  }

  function injectStyle(){
    if (document.getElementById('uap-final-stability-style')) return;
    var style = document.createElement('style');
    style.id = 'uap-final-stability-style';
    style.textContent = [
      '#loading{animation:uapStartupHide 5s forwards!important;}',
      '#loading>*{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;}',
      '#loading.hidden{opacity:0!important;visibility:hidden!important;pointer-events:none!important;}',
      '.article-topline{justify-content:flex-start!important;}',
      '.article-topline>.uap-new-badge{order:0!important;flex:0 0 auto!important;margin-right:0!important;}',
      '.article-topline>.article-date-prominent{order:1!important;flex:0 0 auto!important;}',
      '.article-topline>.badges{order:2!important;display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:6px!important;margin-left:auto!important;}',
      '@keyframes uapStartupHide{0%,94%{opacity:1;visibility:visible;pointer-events:auto;}100%{opacity:0;visibility:hidden;pointer-events:none;}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function apply(){
    injectStyle();
    reapplyStartupWallpaper();
    reorderNewBadges();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();
  window.addEventListener('load', apply, { once: true });
  [50, 150, 350, 800, 1500, 2500].forEach(function(delay){ window.setTimeout(apply, delay); });

  if (window.MutationObserver) {
    new MutationObserver(function(){ window.requestAnimationFrame(reorderNewBadges); })
      .observe(document.documentElement, { childList: true, subtree: true });
  }
})();
