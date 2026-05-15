(function(){
  'use strict';

  if (window.__uapStartupAnimationFinal) return;
  window.__uapStartupAnimationFinal = true;

  var STYLE_ID = 'uap-startup-animation-final-style';
  var pulseTimer = null;
  var titleTimer = null;
  var lineTimer = null;

  function injectStyle(){
    var old = document.getElementById(STYLE_ID);
    if (old) old.remove();
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '@keyframes uapStartupLineDot{0%{left:-10%;opacity:0;}10%{opacity:1;}82%{opacity:1;}100%{left:100%;opacity:0;}}',
      '@keyframes uapStartupLineBase{0%,100%{box-shadow:0 0 12px rgba(0,212,255,.58),0 0 28px rgba(0,132,255,.26);}50%{box-shadow:0 0 22px rgba(0,255,221,.95),0 0 54px rgba(0,132,255,.56);}}',
      '#loading .uap-startup-anim-wrap{display:none!important;}',
      '#loading .startup-title{font-family:"Rajdhani","Exo 2",system-ui,sans-serif!important;font-weight:800!important;letter-spacing:.035em!important;text-transform:uppercase!important;color:#f7feff!important;-webkit-text-fill-color:#f7feff!important;background:none!important;text-shadow:0 1px 0 rgba(255,255,255,.42),0 0 12px rgba(255,255,255,.58),0 0 30px rgba(0,212,255,.5),0 0 64px rgba(0,132,255,.25)!important;animation:none!important;}',
      '#loading .startup-title *{color:#f7feff!important;-webkit-text-fill-color:#f7feff!important;background:none!important;text-shadow:inherit!important;animation:none!important;filter:none!important;}',
      '#loading .startup-title::after{display:none!important;content:none!important;animation:none!important;}',
      '#loading .uap-startup-line-final{position:absolute!important;height:5px!important;border-radius:999px!important;z-index:6!important;pointer-events:none!important;overflow:hidden!important;background:linear-gradient(90deg,rgba(0,255,221,0),rgba(0,212,255,.78) 12%,#00d4ff 28%,#00ffdd 72%,rgba(0,212,255,.78) 88%,rgba(0,255,221,0))!important;animation:uapStartupLineBase 2.4s ease-in-out infinite!important;}',
      '#loading .uap-startup-line-final::before{content:""!important;position:absolute!important;top:-8px!important;bottom:-8px!important;width:28%!important;border-radius:999px!important;background:linear-gradient(90deg,rgba(255,255,255,0),rgba(223,251,255,.95),rgba(0,255,221,.8),rgba(255,255,255,0))!important;filter:blur(5px)!important;animation:uapStartupLineDot 2.25s ease-in-out infinite!important;}',
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

  function ensureAnimatedLine(){
    var loading = document.getElementById('loading');
    var title = loading && loading.querySelector('.startup-title');
    if (!loading || loading.classList.contains('hidden') || !title) return;
    var line = loading.querySelector('.uap-startup-line-final');
    if (!line) {
      line = document.createElement('div');
      line.className = 'uap-startup-line-final';
      loading.appendChild(line);
    }
    var titleRect = title.getBoundingClientRect();
    var loadingRect = loading.getBoundingClientRect();
    line.style.setProperty('left', (titleRect.left - loadingRect.left) + 'px', 'important');
    line.style.setProperty('top', (titleRect.bottom - loadingRect.top + 12) + 'px', 'important');
    line.style.setProperty('width', titleRect.width + 'px', 'important');
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

  function keepLineAligned(){
    if (lineTimer) return;
    var started = Date.now();
    lineTimer = setInterval(function(){
      var loading = document.getElementById('loading');
      if (!loading || loading.classList.contains('hidden') || Date.now() - started > 12000) {
        clearInterval(lineTimer);
        lineTimer = null;
        return;
      }
      ensureAnimatedLine();
    }, 120);
  }

  function startAlienReveal(){
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
      var reveal = Math.min(1, elapsed / 3600);
      var eased = 1 - Math.pow(1 - reveal, 3);
      var scale = 1.00 + eased * 0.24;
      var brightness = 0.16 + eased * 1.03;
      var contrast = 0.88 + eased * 0.32;
      var opacity = 0.08 + eased * 0.92;
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
    ensureAnimatedLine();
    keepTitleStable();
    keepLineAligned();
    startAlienReveal();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
  window.addEventListener('load', run);
  window.addEventListener('resize', ensureAnimatedLine);
  setTimeout(run, 50);
  setTimeout(run, 250);
  setTimeout(run, 800);
  setTimeout(run, 1600);
})();
