(function(){
  'use strict';

  if (window.__uapStartupAnimationFinal) return;
  window.__uapStartupAnimationFinal = true;

  var STYLE_ID = 'uap-startup-animation-final-style';
  var pulseTimer = null;
  var layoutTimer = null;

  function injectStyle(){
    var old = document.getElementById(STYLE_ID);
    if (old) old.remove();
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '@keyframes uapStartupBeamMove{0%{transform:translateX(-120%) skewX(-15deg);opacity:0;}10%{opacity:.9;}55%{opacity:1;}100%{transform:translateX(165%) skewX(-15deg);opacity:0;}}',
      '@keyframes uapStartupLineGlow{0%,100%{opacity:.7;box-shadow:0 0 12px rgba(0,220,255,.7),0 0 26px rgba(0,132,255,.38);}50%{opacity:1;box-shadow:0 0 26px rgba(0,255,221,1),0 0 62px rgba(0,132,255,.78);}}',
      '#loading .startup-title .uap-logo-letter{animation:none!important;color:#fff!important;-webkit-text-fill-color:#fff!important;filter:none!important;}',
      '#loading .startup-title{color:#fff!important;-webkit-text-fill-color:#fff!important;text-shadow:0 0 10px rgba(255,255,255,.62),0 0 26px rgba(0,212,255,.72)!important;}',
      '#loading .uap-startup-anim-wrap{position:absolute!important;z-index:5!important;pointer-events:none!important;overflow:hidden!important;mix-blend-mode:screen!important;isolation:isolate!important;}',
      '#loading .uap-startup-beam{position:absolute!important;top:0!important;bottom:0!important;left:0!important;width:58%!important;background:linear-gradient(90deg,rgba(0,255,221,0),rgba(126,255,255,.62),rgba(0,166,255,.72),rgba(0,255,221,0))!important;filter:blur(8px)!important;animation:uapStartupBeamMove 2.8s ease-in-out infinite!important;}',
      '#loading .uap-startup-line{position:absolute!important;left:0!important;right:0!important;bottom:0!important;height:4px!important;border-radius:999px!important;background:linear-gradient(90deg,rgba(0,255,221,0),#00d4ff 18%,#7dffff 50%,#00ffdd 82%,rgba(0,255,221,0))!important;animation:uapStartupLineGlow 2.8s ease-in-out infinite!important;}',
      '#loading.hidden .uap-startup-anim-wrap{display:none!important;}',
      '#loading .alien-head,#loading img.alien-head{animation:none!important;transition:none!important;}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function ensureBeam(){
    var loading = document.getElementById('loading');
    if (!loading || loading.classList.contains('hidden')) return null;
    var wrap = loading.querySelector('.uap-startup-anim-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'uap-startup-anim-wrap';
      wrap.innerHTML = '<div class="uap-startup-beam"></div><div class="uap-startup-line"></div>';
      loading.appendChild(wrap);
    }
    return wrap;
  }

  function syncBeamToLogo(){
    var loading = document.getElementById('loading');
    var title = loading && loading.querySelector('.startup-title');
    var wrap = ensureBeam();
    if (!loading || !title || !wrap) return;

    var titleRect = title.getBoundingClientRect();
    var loadingRect = loading.getBoundingClientRect();
    var width = Math.max(220, titleRect.width || 0);
    var height = Math.max(70, titleRect.height || 0) + 18;
    var left = titleRect.left - loadingRect.left;
    var top = titleRect.top - loadingRect.top;

    wrap.style.setProperty('left', left + 'px', 'important');
    wrap.style.setProperty('top', top + 'px', 'important');
    wrap.style.setProperty('width', width + 'px', 'important');
    wrap.style.setProperty('height', height + 'px', 'important');
  }

  function keepBeamAligned(){
    if (layoutTimer) return;
    var started = Date.now();
    layoutTimer = setInterval(function(){
      var loading = document.getElementById('loading');
      if (!loading || loading.classList.contains('hidden') || Date.now() - started > 12000) {
        clearInterval(layoutTimer);
        layoutTimer = null;
        return;
      }
      syncBeamToLogo();
    }, 120);
  }

  function startAlienPulse(){
    if (pulseTimer) return;
    var start = Date.now();
    pulseTimer = setInterval(function(){
      var loading = document.getElementById('loading');
      if (!loading || loading.classList.contains('hidden')) {
        clearInterval(pulseTimer);
        pulseTimer = null;
        return;
      }
      var alien = loading.querySelector('.alien-head');
      if (!alien) return;

      var wave = (Math.sin((Date.now() - start) / 420) + 1) / 2;
      var brightness = 0.72 + wave * 0.62;
      var contrast = 1.02 + wave * 0.18;
      var opacity = 0.72 + wave * 0.28;
      alien.style.setProperty('opacity', opacity.toFixed(2), 'important');
      alien.style.setProperty('filter', 'brightness(' + brightness.toFixed(2) + ') contrast(' + contrast.toFixed(2) + ') saturate(1.14)', 'important');
      alien.style.setProperty('animation', 'none', 'important');
      alien.style.setProperty('transition', 'none', 'important');
      alien.style.setProperty('transform', 'translate(-50%, -50%)', 'important');
      alien.style.setProperty('will-change', 'opacity, filter', 'important');
    }, 70);
  }

  function run(){
    injectStyle();
    ensureBeam();
    syncBeamToLogo();
    keepBeamAligned();
    startAlienPulse();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
  window.addEventListener('load', run);
  window.addEventListener('resize', syncBeamToLogo);
  setTimeout(run, 50);
  setTimeout(run, 250);
  setTimeout(run, 800);
  setTimeout(run, 1600);
})();
