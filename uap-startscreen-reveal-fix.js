(function(){
  'use strict';
  if (window.__uapStartscreenRevealFix) return;
  window.__uapStartscreenRevealFix = true;

  var STYLE_ID = 'uap-startscreen-reveal-fix-style';
  var START = Date.now();
  var DURATION = 9000;
  var intervalId = null;
  var observer = null;

  function loading(){ return document.getElementById('loading'); }

  function finishLoading(el){
    if (!el) return;
    el.classList.add('hidden');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    window.setTimeout(function(){
      el.style.setProperty('display', 'none', 'important');
      if (intervalId) window.clearInterval(intervalId);
      if (observer) observer.disconnect();
    }, 420);
  }

  function keepVisibleUntilReady(){
    var el = loading();
    if (!el) return;
    var elapsed = Date.now() - START;
    if (elapsed < DURATION) {
      el.classList.remove('hidden');
      el.style.setProperty('opacity', '1', 'important');
      el.style.setProperty('visibility', 'visible', 'important');
      el.style.setProperty('pointer-events', 'auto', 'important');
      el.style.removeProperty('display');
      return;
    }
    finishLoading(el);
  }

  function injectStyle(){
    var css = [
      '#loading{background-color:#02070b!important;animation:uapStartupHide 9.35s linear forwards!important;}',
      '#loading::after{content:""!important;position:absolute!important;inset:0!important;z-index:5!important;display:block!important;pointer-events:none!important;background:#02070b!important;opacity:.96!important;animation:uapAlienDimReveal 9s cubic-bezier(.33,0,.12,1) forwards!important;will-change:opacity!important;}',
      '#loading>*{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;}',
      '#loading.hidden{opacity:0!important;visibility:hidden!important;pointer-events:none!important;transition:opacity .36s ease,visibility .36s ease!important;}',
      '@keyframes uapStartupHide{0%,96.5%{opacity:1;visibility:visible;pointer-events:auto;}100%{opacity:0;visibility:hidden;pointer-events:none;}}',
      '@keyframes uapAlienDimReveal{0%{opacity:.97;}12%{opacity:.95;}25%{opacity:.88;}38%{opacity:.74;}52%{opacity:.55;}66%{opacity:.34;}78%{opacity:.18;}88%{opacity:.08;}96%{opacity:0;}100%{opacity:0;}}'
    ].join('\n');
    var style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
    keepVisibleUntilReady();
  }

  function watchLoadingOnly(){
    if (!window.MutationObserver || observer) return;
    var el = loading();
    if (!el) return;
    observer = new MutationObserver(function(){
      window.requestAnimationFrame(keepVisibleUntilReady);
    });
    observer.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
  }

  injectStyle();
  watchLoadingOnly();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ injectStyle(); watchLoadingOnly(); }, { once: true });
  window.addEventListener('load', function(){ injectStyle(); watchLoadingOnly(); }, { once: true });
  [60, 180, 420, 700, 1200, 1800, 2600, 3400, 4300, 5600, 7000, 8400, 9050].forEach(function(delay){ window.setTimeout(injectStyle, delay); });
  intervalId = window.setInterval(keepVisibleUntilReady, 160);
})();