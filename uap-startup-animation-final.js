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
      '@keyframes uapStartupTitleShimmer{0%{background-position:170% 0;text-shadow:0 1px 0 rgba(255,255,255,.35),0 0 10px rgba(255,255,255,.55),0 0 26px rgba(0,212,255,.5),0 0 58px rgba(0,132,255,.24);filter:brightness(1.04);}45%{background-position:0 0;text-shadow:0 1px 0 rgba(255,255,255,.55),0 0 18px rgba(255,255,255,.88),0 0 44px rgba(0,255,221,.82),0 0 86px rgba(0,132,255,.58);filter:brightness(1.22);}100%{background-position:-130% 0;text-shadow:0 1px 0 rgba(255,255,255,.35),0 0 10px rgba(255,255,255,.55),0 0 26px rgba(0,212,255,.5),0 0 58px rgba(0,132,255,.24);filter:brightness(1.04);}}',
      '@keyframes uapStartupLineSweep{0%{background-position:180% 0;box-shadow:0 0 14px rgba(0,220,255,.7),0 0 28px rgba(0,132,255,.38);}50%{background-position:0 0;box-shadow:0 0 30px rgba(0,255,221,1),0 0 72px rgba(0,132,255,.82);}100%{background-position:-120% 0;box-shadow:0 0 16px rgba(0,220,255,.8),0 0 36px rgba(0,132,255,.5);}}',
      '#loading .uap-startup-anim-wrap{display:none!important;}',
      '#loading .startup-title{font-family:"Rajdhani","Exo 2",system-ui,sans-serif!important;font-weight:800!important;letter-spacing:.035em!important;text-transform:uppercase!important;background-image:linear-gradient(100deg,#dffbff 0%,#ffffff 22%,#b9ffff 38%,#00d4ff 49%,#00ffdd 59%,#ffffff 75%,#dffbff 100%)!important;background-size:275% 100%!important;background-position:170% 0!important;-webkit-background-clip:text!important;background-clip:text!important;color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:0 1px 0 rgba(255,255,255,.35),0 0 10px rgba(255,255,255,.55),0 0 26px rgba(0,212,255,.5),0 0 58px rgba(0,132,255,.24)!important;animation:uapStartupTitleShimmer 3.1s ease-in-out infinite!important;}',
      '#loading .startup-title *{background:inherit!important;background-size:inherit!important;background-position:inherit!important;-webkit-background-clip:text!important;background-clip:text!important;color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:inherit!important;animation:none!important;filter:none!important;}',
      '#loading .startup-title::after{height:5px!important;bottom:-14px!important;background-size:260% 100%!important;background-image:linear-gradient(90deg,rgba(0,255,221,0),rgba(0,220,255,.68) 14%,#b9ffff 34%,#00a6ff 50%,#00ffdd 66%,rgba(0,220,255,.7) 84%,rgba(0,255,221,0))!important;animation:uapStartupLineSweep 3.1s ease-in-out infinite!important;}',
      '#loading .alien-head,#loading img.alien-head{animation:none!important;transition:none!important;transform-origin:center center!important;}'
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

      var elapsed = Date.now() - start;
      var wave = (Math.sin(elapsed / 430) + 1) / 2;
      var zoomWave = (Math.sin(elapsed / 1250) + 1) / 2;
      var brightness = 0.60 + wave * 0.58;
      var contrast = 1.03 + wave * 0.16;
      var opacity = 0.74 + wave * 0.26;
      var scale = 1.02 + zoomWave * 0.18;
      alien.style.setProperty('opacity', opacity.toFixed(2), 'important');
      alien.style.setProperty('filter', 'brightness(' + brightness.toFixed(2) + ') contrast(' + contrast.toFixed(2) + ') saturate(1.16)', 'important');
      alien.style.setProperty('animation', 'none', 'important');
      alien.style.setProperty('transition', 'none', 'important');
      alien.style.setProperty('transform', 'translate(-50%, -50%) scale(' + scale.toFixed(3) + ')', 'important');
      alien.style.setProperty('will-change', 'opacity, filter, transform', 'important');
    }, 50);
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
