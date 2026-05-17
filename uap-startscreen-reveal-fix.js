(function(){
  'use strict';
  if (window.__uapStartscreenRevealFix) return;
  window.__uapStartscreenRevealFix = true;

  var STYLE_ID = 'uap-startscreen-reveal-fix-style';

  function injectStyle(){
    var css = [
      '#loading{background-color:#02070b!important;}',
      '#loading::before{content:""!important;position:absolute!important;inset:0!important;z-index:1!important;display:block!important;pointer-events:none!important;background:linear-gradient(180deg,rgba(2,7,11,.84),rgba(2,7,11,.76) 42%,rgba(2,7,11,.9))!important;animation:uapStartscreenReveal 5s cubic-bezier(.16,1,.3,1) forwards!important;will-change:opacity,backdrop-filter!important;backdrop-filter:grayscale(.35) brightness(.72) blur(1.2px)!important;-webkit-backdrop-filter:grayscale(.35) brightness(.72) blur(1.2px)!important;}',
      '#loading::after{content:""!important;position:absolute!important;inset:0!important;z-index:2!important;display:block!important;pointer-events:none!important;background:radial-gradient(circle at 50% 42%,rgba(120,210,255,.16),transparent 24%),linear-gradient(180deg,transparent 0%,rgba(0,0,0,.14) 62%,rgba(0,0,0,.32) 100%)!important;opacity:.18!important;animation:uapStartscreenSignalReveal 5s ease-out forwards!important;}',
      '#loading>*{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;}',
      '@keyframes uapStartscreenReveal{0%{opacity:.88;backdrop-filter:grayscale(.42) brightness(.58) blur(1.4px);-webkit-backdrop-filter:grayscale(.42) brightness(.58) blur(1.4px);}58%{opacity:.38;backdrop-filter:grayscale(.18) brightness(.84) blur(.45px);-webkit-backdrop-filter:grayscale(.18) brightness(.84) blur(.45px);}94%{opacity:.06;backdrop-filter:grayscale(0) brightness(1) blur(0);-webkit-backdrop-filter:grayscale(0) brightness(1) blur(0);}100%{opacity:0;backdrop-filter:none;-webkit-backdrop-filter:none;}}',
      '@keyframes uapStartscreenSignalReveal{0%{opacity:.05;}45%{opacity:.2;}94%{opacity:.28;}100%{opacity:.18;}}'
    ].join('\n');
    var style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
    }
    if (style.textContent !== css) style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  injectStyle();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectStyle, { once: true });
  window.addEventListener('load', injectStyle, { once: true });
  [60, 180, 420, 700, 1200, 1800, 2600, 3400, 4300].forEach(function(delay){ window.setTimeout(injectStyle, delay); });
  if (window.MutationObserver) {
    new MutationObserver(function(){ window.requestAnimationFrame(injectStyle); })
      .observe(document.documentElement, { childList: true, subtree: true });
  }
})();
