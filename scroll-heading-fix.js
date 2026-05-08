(function(){
  'use strict';

  var STYLE_ID = 'uap-scroll-heading-fix-style';
  var restoringUntil = 0;
  var lastY = 0;
  var css = [
    '.article-card h2{color:#eef9fd!important;font-weight:700!important;text-shadow:none!important}',
    '.article-card .article-main{overflow-anchor:none!important}',
    '#feed,.old-list{overflow-anchor:none!important}',
    'html{scroll-behavior:auto!important}'
  ].join('\n');

  function injectStyle(){
    var style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
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
      if (Date.now() <= restoringUntil && Math.abs((window.scrollY || 0) - lastY) > 24) window.scrollTo(0, lastY);
    }).observe(document.getElementById('feed') || document.body, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
