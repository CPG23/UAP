(function(){
  'use strict';

  if (window.__uapStartupAnimationFinal) return;
  window.__uapStartupAnimationFinal = true;

  var STYLE_ID = 'uap-startup-animation-final-style';
  var REVEAL_MS = 9200;
  var pulseTimer = null;
  var titleTimer = null;
  var lineTimer = null;

  function injectStyle(){
    var old = document.getElementById(STYLE_ID);
    if (old) old.remove();
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '@keyframes uapStartupSignalSweep{0%{left:-34%;opacity:0;}8%{opacity:.92;}86%{opacity:.92;}100%{left:106%;opacity:0;}}',
      '@keyframes uapStartupSignalTicks{0%{background-position:0 0;}100%{background-position:42px 0;}}',
      '@keyframes uapStartupSignalCore{0%,100%{box-shadow:0 0 14px rgba(0,212,255,.68),0 0 36px rgba(0,132,255,.34),0 0 76px rgba(0,255,221,.18);}50%{box-shadow:0 0 26px rgba(0,255,221,.98),0 0 62px rgba(0,132,255,.58),0 0 118px rgba(0,255,221,.34);}}',
      '#loading .uap-startup-anim-wrap{display:none!important;}',
      '#loading .startup-title{font-family:"Rajdhani","Exo 2",system-ui,sans-serif!important;font-weight:800!important;letter-spacing:.035em!important;text-transform:uppercase!important;color:#f7feff!important;-webkit-text-fill-color:#f7feff!important;background:none!important;text-shadow:0 1px 0 rgba(255,255,255,.42),0 0 12px rgba(255,255,255,.58),0 0 30px rgba(0,212,255,.5),0 0 64px rgba(0,132,255,.25)!important;animation:none!important;}',
      '#loading .startup-title *{color:#f7feff!important;-webkit-text-fill-color:#f7feff!important;background:none!important;text-shadow:inherit!important;animation:none!important;filter:none!important;}',
      '#loading .startup-title::after{display:none!important;content:none!important;animation:none!important;}',
      '#loading .uap-startup-line-final{position:absolute!important;height:8px!important;border-radius:999px!important;z-index:6!important;pointer-events:none!important;overflow:hidden!important;background-image:linear-gradient(90deg,rgba(0,255,221,0),rgba(0,212,255,.42) 10%,rgba(220,254,255,.92) 50%,rgba(0,212,255,.42) 90%,rgba(0,255,221,0)),linear-gradient(90deg,rgba(0,255,221,0),rgba(0,255,221,.55) 22%,rgba(0,132,255,.72) 50%,rgba(0,255,221,.55) 78%,rgba(0,255,221,0));background-size:100% 100%,100% 100%!important;animation:uapStartupSignalCore 2.8s ease-in-out infinite!important;}',
      '#loading .uap-startup-line-final::before{content:""!important;position:absolute!important;top:-16px!important;bottom:-16px!important;width:36%!important;border-radius:999px!important;background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.98) 0,rgba(0,255,221,.92) 20%,rgba(0,132,255,.48) 48%,rgba(0,0,0,0) 72%)!important;filter:blur(7px)!important;animation:uapStartupSignalSweep 2.9s cubic-bezier(.2,.72,.22,1) infinite!important;}',
      '#loading .uap-startup-line-final::after{content:""!important;position:absolute!important;left:5px!important;right:5px!important;top:2px!important;bottom:2px!important;border-radius:999px!important;background-image:repeating-linear-gradient(90deg,rgba(0,255,221,0) 0 11px,rgba(158,255,255,.82) 11px 14px,rgba(0,132,255,.28) 14px 17px,rgba(0,255,221,0) 17px 28px)!important;filter:drop-shadow(0 0 7px rgba(0,255,221,.78))!important;opacity:.78!important;animation:uapStartupSignalTicks 1.15s linear infinite!important;}',
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
    line.style.setProperty('top', (titleRect.bottom - loadingRect.top + 13) + 'px', 'important');
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

  function smoothStep(value){
    return value * value * (3 - 2 * value);
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
      var reveal = Math.min(1, elapsed / REVEAL_MS);
      var eased = smoothStep(reveal);
      var scale = 0.78 + eased * 0.46;
      var brightness = 0.12 + eased * 1.07;
      var contrast = 0.82 + eased * 0.38;
      var opacity = 0.05 + eased * 0.95;
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
