(function(){
  'use strict';
  if (window.__uapControlsLayoutFix) return;
  window.__uapControlsLayoutFix = true;

  var STYLE_ID = 'uap-controls-layout-fix-style';

  function injectStyle(){
    var css = [
      '#uap-new-filter-bar{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;margin:0 0 12px!important;padding:10px 0!important;border-bottom:1px solid rgba(13,58,92,.65)!important;}',
      '#uap-new-filter-toggle{order:1!important;margin:0!important;flex:0 0 auto!important;}',
      '#uap-new-filter-bar .quality-top-help{order:2!important;margin:0!important;flex:0 0 auto!important;min-height:34px!important;padding:0 10px!important;}',
      '@media(max-width:420px){#uap-new-filter-bar{gap:8px!important;}#uap-new-filter-toggle,#uap-new-filter-bar .quality-top-help{min-height:32px!important;padding:0 8px!important;font-size:9px!important;letter-spacing:.9px!important;}.quality-info-dot{width:14px!important;height:14px!important;font-size:9px!important;}}'
    ].join('\n');
    var style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
  }

  function moveControls(){
    injectStyle();
    var feed = document.getElementById('feed');
    var bar = document.getElementById('uap-new-filter-bar');
    var quality = document.querySelector('.quality-top-help');
    if (!feed || !bar || !quality) return;
    if (quality.parentNode !== bar) bar.appendChild(quality);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', moveControls, { once: true });
  else moveControls();
  window.addEventListener('load', moveControls, { once: true });
  [80, 220, 600, 1200, 2200].forEach(function(delay){ window.setTimeout(moveControls, delay); });
  if (window.MutationObserver) {
    new MutationObserver(function(){ window.requestAnimationFrame(moveControls); })
      .observe(document.documentElement, { childList: true, subtree: true });
  }
})();
