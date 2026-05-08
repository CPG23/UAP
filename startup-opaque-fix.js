(function(){
  'use strict';
  var STYLE_ID = 'uap-startup-opaque-final-style';
  function apply(){
    var style = document.getElementById(STYLE_ID);
    var css = [
      '#loading{background:#030a0f!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
      '#loading::before{content:"";position:absolute;inset:0;background:#030a0f;z-index:-1}',
      '#loading .startup-panel,#loading .startup-panel-label,#loading-status{display:none!important}'
    ].join('\n');
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once:true });
  else apply();
  setTimeout(apply, 250);
  setTimeout(apply, 900);
})();
