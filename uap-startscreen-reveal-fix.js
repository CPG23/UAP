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
    if (elapsed < DURATION - 220) {
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
      '#loading{background-color:#02070b!important;animation:uapStartupHide 9s forwards!important;}',
      '#loading::before{content:""!important;position:absolute!important;inset:0!important;z-index:1!important;display:block!important;pointer-events:none!important;background:linear-gradient(180deg,rgba(2,7,11,.96),rgba(2,7,11,.94) 44%,rgba(2,7,11,.98))!important;animation:uapStartscreenReveal 9s cubic-bezier(.16,1,.3,1) forwards!important;will-change:opacity,backdrop-filter!important;backdrop-filter:grayscale(.65) brightness(.34) blur(2.2px)!important;-webkit-backdrop-filter:grayscale(.65) brightness(.34) blur(2.2px)!important;}',
      '#loading::after{content:""!important;position:absolute!important;inset:0!important;z-index:2!important;display:block!important;pointer-events:none!important;background:radial-gradient(circle at 50% 42%,rgba(120,210,255,.13),transparent 23%),linear-gradient(180deg,transparent 0%,rgba(0,0,0,.18) 62%,rgba(0,0,0,.36) 100%)!important;opacity:.04!important;animation:uapStartscreenSignalReveal 9s ease-out forwards!important;}',
      '#loading>*{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;}',
      '#loading.hidden{opacity:0!important;visibility:hidden!important;pointer-events:none!important;transition:opacity .36s ease,visibility .36s ease!important;}',
      '@keyframes uapStartupHide{0%,96%{opacity:1;visibility:visible;pointer-events:auto;}100%{opacity:0;visibility:hidden;pointer-events:none;}}',
      '@keyframes uapStartscreenReveal{0%{opacity:.97;backdrop-filter:grayscale(.72) brightness(.25) blur(2.4px);-webkit-backdrop-filter:grayscale(.72) brightness(.25) blur(2.4px);}38%{opacity:.78;backdrop-filter:grayscale(.5) brightness(.45) blur(1.8px);-webkit-backdrop-filter:grayscale(.5) brightness(.45) blur(1.8px);}72%{opacity:.32;backdrop-filter:grayscale(.18) brightness(.82) blur(.55px);-webkit-backdrop-filter:grayscale(.18) brightness(.82) blur(.55px);}96%{opacity:.03;backdrop-filter:grayscale(0) brightness(1) blur(0);-webkit-backdrop-filter:grayscale(0) brightness(1) blur(0);}100%{opacity:0;backdrop-filter:none;-webkit-backdrop-filter:none;}}',
      '@keyframes uapStartscreenSignalReveal{0%{opacity:.02;}48%{opacity:.12;}86%{opacity:.26;}100%{opacity:.18;}}'
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
  [60, 180, 420, 700, 1200, 1800, 2600, 3400, 4300, 5600, 7000, 8400, 9100].forEach(function(delay){ window.setTimeout(injectStyle, delay); });
  window.setInterval(keepVisibleUntilReady, 120);
  if (window.MutationObserver) {
    new MutationObserver(function(){ window.requestAnimationFrame(injectStyle); })
      .observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
  }
})();
