(function(){
  'use strict';
  if (window.__uapStartscreenRevealFix) return;
  window.__uapStartscreenRevealFix = true;

  var STYLE_ID = 'uap-startscreen-reveal-fix-style';
  var START = Date.now();
  var DURATION = 9000;

  function loading(){ return document.getElementById('loading'); }

  function keepVisibleUntilReady(){
    var el = loading();
    if (!el) return;
    var elapsed = Date.now() - START;
    if (elapsed < DURATION) {
      el.classList.remove('hidden');
      el.style.setProperty('opacity', '1', 'important');
      el.style.setProperty('visibility', 'visible', 'important');
      el.style.setProperty('pointer-events', 'auto', 'important');
      return;
    }
    el.classList.add('hidden');
    el.style.removeProperty('opacity');
    el.style.removeProperty('visibility');
    el.style.removeProperty('pointer-events');
  }

  function injectStyle(){
    var css = [
      '#loading{background-color:#02070b!important;animation:uapStartupHide 9.35s linear forwards!important;}',
      '#loading::before{content:""!important;position:absolute!important;inset:0!important;z-index:1!important;display:block!important;pointer-events:none!important;background:#02070b!important;opacity:.985!important;animation:uapStartscreenReveal 9s cubic-bezier(.33,0,.12,1) forwards!important;will-change:opacity!important;}',
      '#loading::after{content:""!important;position:absolute!important;inset:0!important;z-index:2!important;display:block!important;pointer-events:none!important;background:radial-gradient(circle at 50% 42%,rgba(120,210,255,.12),transparent 24%),linear-gradient(180deg,rgba(0,0,0,.1),rgba(0,0,0,.2) 70%,rgba(0,0,0,.34))!important;opacity:.03!important;animation:uapStartscreenSignalReveal 9s ease-in-out forwards!important;will-change:opacity!important;}',
      '#loading>*{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;}',
      '#loading.hidden{opacity:0!important;visibility:hidden!important;pointer-events:none!important;transition:opacity .36s ease,visibility .36s ease!important;}',
      '@keyframes uapStartupHide{0%,96.5%{opacity:1;visibility:visible;pointer-events:auto;}100%{opacity:0;visibility:hidden;pointer-events:none;}}',
      '@keyframes uapStartscreenReveal{0%{opacity:.985;}14%{opacity:.95;}28%{opacity:.86;}42%{opacity:.72;}56%{opacity:.52;}70%{opacity:.31;}82%{opacity:.14;}91%{opacity:.045;}96%{opacity:0;}100%{opacity:0;}}',
      '@keyframes uapStartscreenSignalReveal{0%{opacity:.015;}38%{opacity:.07;}70%{opacity:.14;}92%{opacity:.2;}100%{opacity:.2;}}'
    ].join('\n');
    var style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
    }
    if (style.textContent !== css) style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
    keepVisibleUntilReady();
  }

  injectStyle();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectStyle, { once: true });
  window.addEventListener('load', injectStyle, { once: true });
  [60, 180, 420, 700, 1200, 1800, 2600, 3400, 4300, 5600, 7000, 8400, 9050].forEach(function(delay){ window.setTimeout(injectStyle, delay); });
  window.setInterval(keepVisibleUntilReady, 160);
  if (window.MutationObserver) {
    new MutationObserver(function(){ window.requestAnimationFrame(injectStyle); })
      .observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
  }
})();
