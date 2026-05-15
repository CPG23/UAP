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
      '@keyframes uapStartupLineSweep{0%{background-position:220% 0;box-shadow:0 0 10px rgba(0,220,255,.48),0 0 22px rgba(0,132,255,.26);}45%{background-position:0 0;box-shadow:0 0 28px rgba(0,255,221,1),0 0 66px rgba(0,132,255,.72);}100%{background-position:-160% 0;box-shadow:0 0 14px rgba(0,220,255,.76),0 0 34px rgba(0,132,255,.46);}}',
      '#loading .uap-startup-anim-wrap{display:none!important;}',
      '#loading .startup-title{font-family:"Rajdhani","Exo 2",system-ui,sans-serif!important;font-weight:800!important;letter-spacing:.035em!important;text-transform:uppercase!important;color:#f4feff!important;-webkit-text-fill-color:#f4feff!important;background:none!important;text-shadow:0 1px 0 rgba(255,255,255,.42),0 0 12px rgba(255,255,255,.6),0 0 30px rgba(0,212,255,.58),0 0 68px rgba(0,132,255,.28)!important;animation:none!important;}',
      '#loading .startup-title *{color:#f4feff!important;-webkit-text-fill-color:#f4feff!important;background:none!important;text-shadow:inherit!important;animation:none!important;filter:none!important;}',
      '#loading .startup-title::after{height:5px!important;bottom:-14px!important;background-size:320% 100%!important;background-image:linear-gradient(90deg,rgba(0,255,221,0),rgba(0,220,255,.45) 10%,#00d4ff 24%,#dffbff 42%,#00a6ff 52%,#00ffdd 64%,rgba(0,220,255,.58) 82%,rgba(0,255,221,0))!important;animation:uapStartupLineSweep 2.45s ease-in-out infinite!important;}',
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
      var reveal = Math.min(1, elapsed / 3400);
      var eased = 1 - Math.pow(1 - reveal, 3);
      var subtlePulse = (Math.sin(elapsed / 650) + 1) / 2;
      var zoomWave = (Math.sin(elapsed / 1450) + 1) / 2;
      var brightness = 0.32 + eased * 0.82 + subtlePulse * 0.08;
      var contrast = 0.96 + eased * 0.22;
      var opacity = 0.30 + eased * 0.70;
      var scale = 1.02 + zoomWave * 0.18;
      alien.style.setProperty('opacity', opacity.toFixed(2), 'important');
      alien.style.setProperty('filter', 'brightness(' + brightness.toFixed(2) + ') contrast(' + contrast.toFixed(2) + ') saturate(1.14)', 'important');
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
