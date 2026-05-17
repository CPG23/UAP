(function(){
  'use strict';
  if (window.__uapStartscreenMasterFix) return;
  window.__uapStartscreenMasterFix = true;

  var STYLE_ID = 'uap-startscreen-master-fix-style';
  var START = Date.now();
  var DURATION = 9000;
  var timer = null;

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

  function removeOldBlackLayer(){
    var old = document.getElementById('uap-startscreen-reveal-fix-style');
    if (old && /background:#02070b!important;opacity:\.99|uapAlienDimReveal/.test(old.textContent || '')) old.remove();
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
      'html body #loading{position:fixed!important;inset:0!important;z-index:1000!important;display:block!important;overflow:hidden!important;background:#02070b!important;animation:uapStartupMasterHide 9.35s linear forwards!important;}',
      'html body #loading::before{content:""!important;position:absolute!important;inset:0!important;z-index:1!important;display:block!important;pointer-events:none!important;' + imageLayer + 'opacity:.035!important;transform:scale(1)!important;animation:uapAlienMasterReveal 9s cubic-bezier(.2,.78,.2,1) forwards!important;will-change:opacity,transform!important;}',
      'html body #loading::after{content:""!important;position:absolute!important;inset:0!important;z-index:2!important;display:block!important;pointer-events:none!important;background:radial-gradient(circle at 50% 38%,rgba(125,215,255,.10),rgba(2,7,11,.08) 42%,rgba(2,7,11,.28) 100%)!important;opacity:.72!important;animation:uapStartupMasterVignette 9s ease forwards!important;}',
      'html body #loading>*{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;}',
      'html body #loading.hidden{opacity:0!important;visibility:hidden!important;pointer-events:none!important;transition:opacity .38s ease,visibility .38s ease!important;}',
      '@keyframes uapStartupMasterHide{0%,96.5%{opacity:1;visibility:visible;pointer-events:auto;}100%{opacity:0;visibility:hidden;pointer-events:none;}}',
      '@keyframes uapAlienMasterReveal{0%{opacity:.03;transform:scale(1);}16%{opacity:.08;}34%{opacity:.24;}56%{opacity:.52;}78%{opacity:.82;}100%{opacity:1;transform:scale(1.085);}}',
      '@keyframes uapStartupMasterVignette{0%{opacity:.80;}50%{opacity:.52;}100%{opacity:.30;}}'
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

  apply();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  window.addEventListener('load', apply, { once: true });
  [30, 80, 150, 260, 420, 700, 1100, 1700, 2500, 3500, 4700, 6100, 7600, 9000].forEach(function(delay){ window.setTimeout(apply, delay); });
  timer = window.setInterval(apply, 220);
})();
