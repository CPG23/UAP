(function(){
  'use strict';
  if (window.__uapStartscreenMasterFix) {
    if (typeof window.__uapStartscreenMasterApply === 'function') window.__uapStartscreenMasterApply();
    return;
  }
  window.__uapStartscreenMasterFix = true;

  var STYLE_ID = 'uap-startscreen-master-fix-style';
  var START = Date.now();
  var DURATION = 9000;
  var timer = null;
  var cachedWallpaper = '';

  function loading(){ return document.getElementById('loading'); }

  function extractWallpaper(){
    if (cachedWallpaper) return cachedWallpaper;
    var style = document.getElementById('uap-startscreen-wallpaper-style');
    var css = style ? style.textContent || '' : '';
    var match = css.match(/url\((data:image\/[a-z0-9.+-]+;base64,[^)]+)\)/i);
    if (match && match[1]) {
      cachedWallpaper = match[1];
      window.__uapStartscreenWallpaperSrc = cachedWallpaper;
      return cachedWallpaper;
    }
    try {
      var el = loading();
      var bg = el ? window.getComputedStyle(el).backgroundImage || '' : '';
      match = bg.match(/url\("?(data:image\/[a-z0-9.+-]+;base64,[^)"']+)"?\)/i);
      if (match && match[1]) {
        cachedWallpaper = match[1];
        window.__uapStartscreenWallpaperSrc = cachedWallpaper;
        return cachedWallpaper;
      }
    } catch(e) {}
    cachedWallpaper = window.__uapStartscreenWallpaperSrc || '';
    return cachedWallpaper;
  }

  function removeOldBlackLayer(){
    var old = document.getElementById('uap-startscreen-reveal-fix-style');
    if (old && /background:#02070b!important;opacity:\.99|uapAlienDimReveal/.test(old.textContent || '')) old.remove();
  }

  function forceBaseBlack(){
    var el = loading();
    if (!el) return;
    el.style.setProperty('background', '#02070b', 'important');
    el.style.setProperty('background-color', '#02070b', 'important');
    el.style.setProperty('background-image', 'none', 'important');
    el.style.setProperty('background-size', 'auto', 'important');
    el.style.setProperty('background-position', 'center center', 'important');
    el.style.setProperty('overflow', 'hidden', 'important');
  }

  function finish(){
    var el = loading();
    if (!el) return;
    el.classList.add('hidden');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    window.setTimeout(function(){ el.style.setProperty('display', 'none', 'important'); }, 420);
    if (timer) window.clearInterval(timer);
  }

  function keepAlive(){
    var el = loading();
    if (!el) return;
    var elapsed = Date.now() - START;
    forceBaseBlack();
    if (elapsed >= DURATION) { finish(); return; }
    el.classList.remove('hidden');
    el.style.removeProperty('display');
    el.style.setProperty('opacity', '1', 'important');
    el.style.setProperty('visibility', 'visible', 'important');
    el.style.setProperty('pointer-events', 'auto', 'important');
  }

  function apply(){
    removeOldBlackLayer();
    var wallpaper = extractWallpaper();
    var imageLayer = wallpaper
      ? 'background-image:url(' + wallpaper + ')!important;background-position:center center!important;background-size:cover!important;background-repeat:no-repeat!important;'
      : 'background:#02070b!important;';
    var css = [
      'html body #loading{position:fixed!important;inset:0!important;z-index:1000!important;display:block!important;overflow:hidden!important;background:#02070b!important;background-image:none!important;animation:uapStartupMasterHide 9.35s linear forwards!important;}',
      'html body #loading::before{content:""!important;position:absolute!important;inset:0!important;z-index:1!important;display:block!important;pointer-events:none!important;' + imageLayer + 'opacity:.015!important;transform:scale(1)!important;animation:uapAlienMasterReveal 9s cubic-bezier(.2,.78,.2,1) forwards!important;will-change:opacity,transform!important;}',
      'html body #loading::after{content:""!important;position:absolute!important;inset:0!important;z-index:2!important;display:block!important;pointer-events:none!important;background:radial-gradient(circle at 50% 38%,rgba(125,215,255,.07),rgba(2,7,11,.10) 42%,rgba(2,7,11,.32) 100%)!important;opacity:.78!important;animation:uapStartupMasterVignette 9s ease forwards!important;}',
      'html body #loading>*{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;}',
      'html body #loading.hidden{opacity:0!important;visibility:hidden!important;pointer-events:none!important;transition:opacity .38s ease,visibility .38s ease!important;}',
      '@keyframes uapStartupMasterHide{0%,96.5%{opacity:1;visibility:visible;pointer-events:auto;}100%{opacity:0;visibility:hidden;pointer-events:none;}}',
      '@keyframes uapAlienMasterReveal{0%{opacity:.015;transform:scale(1);}18%{opacity:.045;}36%{opacity:.14;}56%{opacity:.36;}76%{opacity:.68;}100%{opacity:1;transform:scale(1.09);}}',
      '@keyframes uapStartupMasterVignette{0%{opacity:.84;}50%{opacity:.55;}100%{opacity:.24;}}'
    ].join('\n');
    var style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
    keepAlive();
  }

  window.__uapStartscreenMasterApply = apply;
  apply();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  window.addEventListener('load', apply, { once: true });
  [20, 50, 90, 150, 240, 380, 600, 900, 1300, 1900, 2700, 3700, 5000, 6500, 8000, 9000].forEach(function(delay){ window.setTimeout(apply, delay); });
  timer = window.setInterval(apply, 160);
})();
