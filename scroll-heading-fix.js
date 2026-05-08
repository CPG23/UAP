(function(){
  'use strict';

  var STYLE_ID = 'uap-scroll-heading-fix-style';
  var restoringUntil = 0;
  var lastY = 0;

  function injectStyle(){
    var existing = document.getElementById(STYLE_ID);
    if (existing) existing.remove();
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.article-card h2{color:#eef9fd!important;font-weight:700!important;text-shadow:none!important}',
      '.article-card .article-main{overflow-anchor:none!important}',
      '#feed,.old-list{overflow-anchor:none!important}',
      'html{scroll-behavior:auto!important}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function rememberScroll(){
    lastY = window.scrollY || document.documentElement.scrollTop || 0;
    restoringUntil = Date.now() + 900;
    [0, 40, 120, 260, 520, 820].forEach(function(delay){
      setTimeout(function(){
        if (Date.now() <= restoringUntil && Math.abs((window.scrollY || 0) - lastY) > 24) {
          window.scrollTo(0, lastY);
        }
      }, delay);
    });
  }

  function isArticleOpenClick(target){
    if (!target || !target.closest) return false;
    if (target.closest('a,.translate-btn,.badge.quality,.quality-overlay,.quality-top-help,.old-toggle,input,select,textarea')) return false;
    return !!target.closest('.article-main');
  }

  document.addEventListener('click', function(e){
    if (isArticleOpenClick(e.target)) rememberScroll();
  }, true);

  function start(){
    injectStyle();
    new MutationObserver(function(){
      injectStyle();
      if (Date.now() <= restoringUntil && Math.abs((window.scrollY || 0) - lastY) > 24) window.scrollTo(0, lastY);
    }).observe(document.documentElement, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
