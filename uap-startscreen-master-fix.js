(function(){
  'use strict';
  if (window.__uapStartscreenMasterFix) {
    if (typeof window.__uapStartscreenMasterApply === 'function') window.__uapStartscreenMasterApply();
    return;
  }
  window.__uapStartscreenMasterFix = true;

  var STYLE_ID = 'uap-startscreen-master-fix-style';
  var STAGE_CLASS = 'uap-alien-stage';
  var SHADE_CLASS = 'uap-alien-shade';
  var START = Date.now();
  var DURATION = 9000;
  var rafId = 0;
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

  function ease(value){
    value = Math.max(0, Math.min(1, value));
    return value * value * (3 - 2 * value);
  }

  function removeOldBlackLayer(){
    var old = document.getElementById('uap-startscreen-reveal-fix-style');
    if (old && /background:#02070b!important;opacity:\.99|uapAlienDimReveal/.test(old.textContent || '')) old.remove();
  }

  function important(el, prop, value){
    if (el) el.style.setProperty(prop, value, 'important');
  }

  function forceLoadingBase(){
    var el = loading();
    if (!el) return null;
    important(el, 'position', 'fixed');
    important(el, 'inset', '0');
    important(el, 'z-index', '1000');
    important(el, 'display', 'block');
    important(el, 'visibility', 'visible');
    important(el, 'pointer-events', 'auto');
    important(el, 'overflow', 'hidden');
    important(el, 'background', '#02070b');
    important(el, 'background-color', '#02070b');
    important(el, 'background-image', 'none');
    return el;
  }

  function ensureLayer(className){
    var el = forceLoadingBase();
    if (!el) return null;
    var layer = el.querySelector('.' + className);
    if (!layer) {
      layer = document.createElement('div');
      layer.className = className;
      el.appendChild(layer);
    }
    important(layer, 'display', 'block');
    important(layer, 'visibility', 'visible');
    important(layer, 'position', 'absolute');
    important(layer, 'inset', '0');
    important(layer, 'pointer-events', 'none');
    return layer;
  }

  function ensureStage(){
    var wallpaper = extractWallpaper();
    var stage = ensureLayer(STAGE_CLASS);
    var shade = ensureLayer(SHADE_CLASS);
    if (!stage || !shade) return null;

    important(stage, 'z-index', '1');
    important(stage, 'background-color', '#02070b');
    if (wallpaper) important(stage, 'background-image', 'url(' + wallpaper + ')');
    important(stage, 'background-position', 'center center');
    important(stage, 'background-size', 'cover');
    important(stage, 'background-repeat', 'no-repeat');
    important(stage, 'will-change', 'opacity, transform');

    important(shade, 'z-index', '2');
    important(shade, 'background', 'radial-gradient(circle at 50% 38%, rgba(125,215,255,.07), rgba(2,7,11,.10) 42%, rgba(2,7,11,.30) 100%)');
    important(shade, 'will-change', 'opacity');
    return stage;
  }

  function finish(){
    var el = loading();
    if (!el) return;
    el.classList.add('hidden');
    important(el, 'opacity', '0');
    important(el, 'visibility', 'hidden');
    important(el, 'pointer-events', 'none');
    window.setTimeout(function(){ important(el, 'display', 'none'); }, 420);
    if (timer) window.clearInterval(timer);
    if (rafId) window.cancelAnimationFrame(rafId);
  }

  function draw(){
    var el = forceLoadingBase();
    if (!el) return;
    var elapsed = Date.now() - START;
    if (elapsed >= DURATION) { finish(); return; }

    var stage = ensureStage();
    var shade = el.querySelector('.' + SHADE_CLASS);
    var progress = ease(elapsed / DURATION);
    var opacity = 0.025 + (0.975 * progress);
    var zoom = 1 + (0.09 * progress);
    var shadeOpacity = 0.82 - (0.58 * progress);

    important(stage, 'opacity', String(opacity));
    important(stage, 'transform', 'scale(' + zoom.toFixed(4) + ')');
    important(shade, 'opacity', String(shadeOpacity));
    el.classList.remove('hidden');
    important(el, 'opacity', '1');
    important(el, 'visibility', 'visible');
    rafId = window.requestAnimationFrame(draw);
  }

  function installStyle(){
    var css = [
      'html body #loading{background:#02070b!important;background-image:none!important;overflow:hidden!important;}',
      'html body #loading::before,html body #loading::after{display:none!important;content:none!important;animation:none!important;background:none!important;}',
      'html body #loading > .' + STAGE_CLASS + ',html body #loading > .' + SHADE_CLASS + '{display:block!important;visibility:visible!important;opacity:1;}',
      'html body #loading.hidden{opacity:0!important;visibility:hidden!important;pointer-events:none!important;transition:opacity .38s ease,visibility .38s ease!important;}'
    ].join('\n');
    var style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function apply(){
    removeOldBlackLayer();
    installStyle();
    ensureStage();
    if (!rafId) draw();
  }

  window.__uapStartscreenMasterApply = apply;
  apply();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  window.addEventListener('load', apply, { once: true });
  [20, 60, 120, 240, 420, 700, 1100, 1700, 2600, 3800, 5200, 7000, 8600].forEach(function(delay){ window.setTimeout(apply, delay); });
  timer = window.setInterval(apply, 700);
})();
