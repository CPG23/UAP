(function(){
  'use strict';

  var STYLE_ID = 'uap-scroll-stability-style';
  var userScrollUntil = 0;
  var nativeScrollTo = window.scrollTo;

  function markUserScroll(){
    userScrollUntil = Date.now() + 1200;
  }

  function injectStyle(){
    var css = [
      'html,body,#feed,.article-card,.article-main{overflow-anchor:auto!important}',
      '.article-card.uap-detail-open{contain:layout style!important}',
      '.article-card.uap-detail-open .details,.article-card.uap-detail-open .uap-detail-summary{overflow-anchor:auto!important}',
      '.article-card{transform:translateZ(0)}',
      '.article-topline .badges{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:6px!important;margin:0!important}',
      '.article-topline .badge.sources{display:inline-flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;min-height:24px!important;padding:4px 8px!important;line-height:1!important;vertical-align:middle!important}',
      '.article-topline .badge.sources,.article-topline .article-date-prominent{align-self:center!important}'
    ].join('\n');
    var style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
  }

  window.scrollTo = function(){
    if (Date.now() < userScrollUntil) return;
    return nativeScrollTo.apply(window, arguments);
  };

  ['touchstart','touchmove','wheel','scroll'].forEach(function(type){
    window.addEventListener(type, markUserScroll, { passive:true, capture:true });
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectStyle, { once:true });
  else injectStyle();
})();
