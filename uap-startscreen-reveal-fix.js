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

  function extractWallpaper(){
    var style = document.getElementById('uap-startscreen-wallpaper-style');
    var css = style ? style.textContent || '' : '';
    var match = css.match(/url\((data:image\/[a-z0-9.+-]+;base64,[^)]+)\)/i);
    if (match && match[1]) return match[1];
    try {
      var bg = window.getComputedStyle(loading()).backgroundImage || '';
      match = bg.match(/url\("?(data:image\/[a-z0-9.+-]+;base64,[^)"']+)"?\)/i);
      return match && match[1] ? match[1] : '';
    } catch(e) { return ''; }
  }

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
    }, 440);
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
    var wallpaper = extractWallpaper();
    var imageLayer = wallpaper
      ? 'background-image:url(' + wallpaper + ')!important;background-position:center center!important;background-size:cover!important;background-repeat:no-repeat!important;'
      : 'background:#02070b!important;';
    var css = [
      '#loading{position:fixed!important;inset:0!important;z-index:1000!important;display:block!important;overflow:hidden!important;background:#02070b!important;animation:uapStartupHide 9.35s linear forwards!important;}',
      '#loading::before{content:""!important;position:absolute!important;inset:0!important;z-index:1!important;display:block!important;pointer-events:none!important;' + imageLayer + 'opacity:.04!important;transform:scale(1)!important;animation:uapAlienReveal 9s cubic-bezier(.2,.78,.2,1) forwards!important;will-change:opacity,transform!important;}',
      '#loading::after{content:""!important;position:absolute!important;inset:0!important;z-index:2!important;display:block!important;pointer-events:none!important;background:radial-gradient(circle at 50% 38%,rgba(120,210,255,.08),rgba(2,7,11,.10) 45%,rgba(2,7,11,.32) 100%)!important;opacity:.68!important;animation:uapStartupVignette 9s ease forwards!important;}',
      '#loading>*{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;}',
      '#loading.hidden{opacity:0!important;visibility:hidden!important;pointer-events:none!important;transition:opacity .36s ease,visibility .36s ease!important;}',
      '@keyframes uapStartupHide{0%,96.5%{opacity:1;visibility:visible;pointer-events:auto;}100%{opacity:0;visibility:hidden;pointer-events:none;}}',
      '@keyframes uapAlienReveal{0%{opacity:.035;transform:scale(1);}18%{opacity:.10;}38%{opacity:.28;}62%{opacity:.58;}82%{opacity:.84;}100%{opacity:1;transform:scale(1.075);}}',
      '@keyframes uapStartupVignette{0%{opacity:.82;}55%{opacity:.55;}100%{opacity:.34;}}'
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
    observer = new MutationObserver(function(){ window.requestAnimationFrame(keepVisibleUntilReady); });
    observer.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
  }

  injectStyle();
  watchLoadingOnly();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ injectStyle(); watchLoadingOnly(); }, { once: true });
  window.addEventListener('load', function(){ injectStyle(); watchLoadingOnly(); }, { once: true });
  [40, 80, 160, 320, 640, 1000, 1600, 2400, 3400, 4600, 6000, 7600, 9000].forEach(function(delay){ window.setTimeout(injectStyle, delay); });
  intervalId = window.setInterval(keepVisibleUntilReady, 120);
})();
