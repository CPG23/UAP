(function(){
  'use strict';
  if (window.__uapStartscreenBannerFix) return;
  window.__uapStartscreenBannerFix = true;

  var STYLE_ID = 'uap-startscreen-banner-style';
  var BANNER_ID = 'uap-startscreen-banner';

  function injectStyle(){
    var css = [
      '#loading .uap-startscreen-banner{position:absolute!important;top:calc(6px + env(safe-area-inset-top))!important;left:0!important;right:0!important;height:min(24vw,112px)!important;min-height:62px!important;z-index:4!important;display:flex!important;align-items:flex-start!important;justify-content:center!important;padding:0 6px!important;margin:0!important;visibility:visible!important;opacity:1!important;pointer-events:none!important;}',
      '#loading .uap-startscreen-banner img{display:block!important;width:100%!important;height:100%!important;max-width:none!important;object-fit:contain!important;object-position:center top!important;background:transparent!important;border:0!important;margin:0!important;padding:0!important;filter:none!important;visibility:visible!important;opacity:1!important;pointer-events:none!important;}',
      '#loading.hidden .uap-startscreen-banner{pointer-events:none!important;}',
      '@media(max-width:560px){#loading .uap-startscreen-banner{top:calc(4px + env(safe-area-inset-top))!important;height:28vw!important;min-height:70px!important;padding:0 4px!important;}}'
    ].join('\n');
    var style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
  }

  function bannerSource(){
    var img = document.querySelector('header .uap-header-banner-img, .brand-title .uap-header-banner-img');
    return img && (img.currentSrc || img.src) || '';
  }

  function ensureBanner(){
    injectStyle();
    var loading = document.getElementById('loading');
    var src = bannerSource();
    if (!loading || !src) return false;
    var wrap = document.getElementById(BANNER_ID);
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = BANNER_ID;
      wrap.className = 'uap-startscreen-banner';
      loading.insertBefore(wrap, loading.firstChild);
    }
    var img = wrap.querySelector('img');
    if (!img) {
      img = document.createElement('img');
      img.alt = 'UAP-News';
      img.decoding = 'async';
      wrap.appendChild(img);
    }
    if (img.src !== src) img.src = src;
    return true;
  }

  function schedule(){
    [0, 80, 180, 360, 700, 1100, 1700, 2600, 3600].forEach(function(delay){
      window.setTimeout(ensureBanner, delay);
    });
  }

  injectStyle();
  schedule();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  window.addEventListener('load', schedule, { once: true });
})();
