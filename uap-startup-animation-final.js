(function(){
  'use strict';

  if (window.__uapStartupAnimationFinal) return;
  window.__uapStartupAnimationFinal = true;

  var STYLE_ID = 'uap-startup-animation-final-style';
  var pulseTimer = null;
  var titleTimer = null;

  function injectStyle(){
    var old = document.getElementById(STYLE_ID);
    if (old) old.remove();
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '@keyframes uapStartupTitleShimmer{0%{background-position:160% 0;text-shadow:0 0 10px rgba(255,255,255,.58),0 0 24px rgba(0,212,255,.42);}45%{background-position:0 0;text-shadow:0 0 14px rgba(255,255,255,.78),0 0 36px rgba(0,255,221,.74),0 0 68px rgba(0,132,255,.46);}100%{background-position:-120% 0;text-shadow:0 0 10px rgba(255,255,255,.58),0 0 24px rgba(0,212,255,.42);}}',
      '@keyframes uapStartupLineSweep{0%{background-position:180% 0;box-shadow:0 0 12px rgba(0,220,255,.64),0 0 26px rgba(0,132,255,.34);}50%{background-position:0 0;box-shadow:0 0 26px rgba(0,255,221,1),0 0 62px rgba(0,132,255,.78);}100%{background-position:-120% 0;box-shadow:0 0 14px rgba(0,220,255,.74),0 0 30px rgba(0,132,255,.44);}}',
      '#loading .uap-startup-anim-wrap{display:none!important;}',
      '#loading .startup-title{background-image:linear-gradient(100deg,#ffffff 0%,#ffffff 34%,#8dffff 45%,#00a6ff 52%,#00ffdd 60%,#ffffff 72%,#ffffff 100%)!important;background-size:260% 100%!important;background-position:160% 0!important;-webkit-background-clip:text!important;background-clip:text!important;color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:0 0 10px rgba(255,255,255,.58),0 0 24px rgba(0,212,255,.42)!important;animation:uapStartupTitleShimmer 3.4s ease-in-out infinite!important;}',
      '#loading .startup-title *{background:inherit!important;background-size:inherit!important;background-position:inherit!important;-webkit-background-clip:text!important;background-clip:text!important;color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:inherit!important;animation:none!important;filter:none!important;}',
      '#loading .startup-title::after{height:4px!important;background-size:240% 100%!important;background-image:linear-gradient(90deg,rgba(0,255,221,0),rgba(0,220,255,.55) 14%,#7dffff 36%,#00a6ff 50%,#00ffdd 64%,rgba(0,220,255,.62) 84%,rgba(0,255,221,0))!important;animation:uapStartupLineSweep 3.4s ease-in-out infinite!important;}',
      '#loading .alien-head,#loading img.alien-head{animation:none!important;transition:none!important;}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function normalizeStartupTitle(){
    var loading = document.getElementById('loading');
    var title = loading && loading.querySelector('.startup-title');
    if (!loading || loading.classList.contains('hidden') || !title) return;
    if (title.textContent.replace(/\s+/g, ' ').trim() !== 'UAP News' || title.querySelector('.uap-logo-letter')) {
      title.textContent = 'UAP News';
    }
  }

  function keepTitleStable(){
    if (titleTimer) return;
    var started = Date.now();
    titleTimer = setInterval(function(){
      var loading = document.getElementById('loading');
      if (!loading || loading.classList.contains('hidden') || Date.now() - started > 12000) {
        clearInterval(titleTimer);
        titleTimer = null;
        return;
      }
      normalizeStartupTitle();
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

      var wave = (Math.sin((Date.now() - start) / 360) + 1) / 2;
      var brightness = 0.54 + wave * 0.86;
      var contrast = 1.02 + wave * 0.24;
      var opacity = 0.62 + wave * 0.38;
      alien.style.setProperty('opacity', opacity.toFixed(2), 'important');
      alien.style.setProperty('filter', 'brightness(' + brightness.toFixed(2) + ') contrast(' + contrast.toFixed(2) + ') saturate(1.18)', 'important');
      alien.style.setProperty('animation', 'none', 'important');
      alien.style.setProperty('transition', 'none', 'important');
      alien.style.setProperty('transform', 'translate(-50%, -50%)', 'important');
      alien.style.setProperty('will-change', 'opacity, filter', 'important');
    }, 70);
  }

  function run(){
    injectStyle();
    normalizeStartupTitle();
    keepTitleStable();
    startAlienPulse();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
  window.addEventListener('load', run);
  setTimeout(run, 50);
  setTimeout(run, 250);
  setTimeout(run, 800);
  setTimeout(run, 1600);
})();
