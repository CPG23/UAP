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
      '@keyframes uapStartupSignalSweep{0%{left:-36%;opacity:0;}10%{opacity:.82;}84%{opacity:.82;}100%{left:106%;opacity:0;}}',
      '@keyframes uapStartupSignalTicks{0%{background-position:0 0;}100%{background-position:48px 0;}}',
      '@keyframes uapStartupSignalCore{0%,100%{box-shadow:0 0 22px rgba(0,212,255,.72),0 0 54px rgba(0,132,255,.4),0 0 110px rgba(0,255,221,.22);}50%{box-shadow:0 0 38px rgba(0,255,221,1),0 0 86px rgba(0,132,255,.66),0 0 150px rgba(0,255,221,.42);}}',
      '#loading .uap-startup-anim-wrap{display:none!important;}',
      '#loading .startup-title{font-family:"Rajdhani","Exo 2",system-ui,sans-serif!important;font-weight:800!important;letter-spacing:.035em!important;text-transform:uppercase!important;color:#f7feff!important;-webkit-text-fill-color:#f7feff!important;background:none!important;text-shadow:0 1px 0 rgba(255,255,255,.42),0 0 12px rgba(255,255,255,.58),0 0 30px rgba(0,212,255,.5),0 0 64px rgba(0,132,255,.25)!important;animation:none!important;}',
      '#loading .startup-title *{color:#f7feff!important;-webkit-text-fill-color:#f7feff!important;background:none!important;text-shadow:inherit!important;animation:none!important;filter:none!important;}',
      '#loading .startup-title::after{display:none!important;content:none!important;animation:none!important;}',
      '#loading .uap-startup-line-final{position:absolute!important;height:11px!important;border-radius:999px!important;z-index:6!important;pointer-events:none!important;overflow:visible!important;filter:blur(.7px)!important;background-image:radial-gradient(ellipse at 50% 50%,rgba(230,255,255,.95) 0,rgba(0,255,221,.72) 30%,rgba(0,132,255,.26) 56%,rgba(0,0,0,0) 74%),linear-gradient(90deg,rgba(0,255,221,0),rgba(0,212,255,.36) 9%,rgba(220,254,255,.9) 50%,rgba(0,212,255,.36) 91%,rgba(0,255,221,0)),linear-gradient(90deg,rgba(0,255,221,0),rgba(0,255,221,.5) 22%,rgba(0,132,255,.68) 50%,rgba(0,255,221,.5) 78%,rgba(0,255,221,0));background-size:112% 420%,100% 100%,100% 100%!important;background-position:center center!important;animation:uapStartupSignalCore 3.2s ease-in-out infinite!important;}',
      '#loading .uap-startup-line-final::before{content:""!important;position:absolute!important;top:-24px!important;bottom:-24px!important;width:42%!important;border-radius:999px!important;background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.92) 0,rgba(0,255,221,.82) 18%,rgba(0,132,255,.42) 48%,rgba(0,0,0,0) 76%)!important;filter:blur(12px)!important;animation:uapStartupSignalSweep 3.15s cubic-bezier(.2,.72,.22,1) infinite!important;}',
      '#loading .uap-startup-line-final::after{content:""!important;position:absolute!important;left:6px!important;right:6px!important;top:3px!important;bottom:3px!important;border-radius:999px!important;background-image:repeating-linear-gradient(90deg,rgba(0,255,221,0) 0 13px,rgba(158,255,255,.74) 13px 16px,rgba(0,132,255,.22) 16px 20px,rgba(0,255,221,0) 20px 32px)!important;filter:blur(.45px) drop-shadow(0 0 10px rgba(0,255,221,.82))!important;opacity:.62!important;animation:uapStartupSignalTicks 1.35s linear infinite!important;}',
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
    line.style.setProperty('top', (titleRect.bottom - loadingRect.top + 14) + 'px', 'important');
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
      var zoom = smoothStep(reveal);
      var visibility = 1 - Math.pow(1 - reveal, 2);
      var scale = 0.76 + zoom * 0.48;
      var y = -30 - zoom * 20;
      var brightness = 0.12 + visibility * 1.08;
      var contrast = 0.82 + visibility * 0.38;
      var opacity = 0.05 + visibility * 0.95;
      alien.style.setProperty('opacity', opacity.toFixed(2), 'important');
      alien.style.setProperty('filter', 'brightness(' + brightness.toFixed(2) + ') contrast(' + contrast.toFixed(2) + ') saturate(1.16)', 'important');
      alien.style.setProperty('animation', 'none', 'important');
      alien.style.setProperty('transition', 'none', 'important');
      alien.style.setProperty('transform', 'translate(-50%, ' + y.toFixed(2) + '%) scale(' + scale.toFixed(3) + ')', 'important');
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
