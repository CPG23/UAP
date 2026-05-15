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
      '@keyframes uapStartupSignalPacket{0%{left:-26%;opacity:0;transform:scaleX(.38);}12%{opacity:.96;}72%{opacity:.86;}100%{left:104%;opacity:0;transform:scaleX(1.12);}}',
      '@keyframes uapStartupSignalAfterglow{0%{opacity:0;transform:translateX(-18%) scaleX(.15);}18%{opacity:.42;}76%{opacity:.16;transform:translateX(54%) scaleX(1.25);}100%{opacity:0;transform:translateX(92%) scaleX(1.72);}}',
      '@keyframes uapStartupSignalCore{0%,100%{box-shadow:0 0 12px rgba(0,212,255,.7),0 0 34px rgba(0,132,255,.34),0 0 78px rgba(0,255,221,.18);}50%{box-shadow:0 0 22px rgba(0,255,221,.96),0 0 58px rgba(0,132,255,.5),0 0 118px rgba(0,255,221,.3);}}',
      '#loading .uap-startup-anim-wrap{display:none!important;}',
      '#loading .startup-title{font-family:"Rajdhani","Exo 2",system-ui,sans-serif!important;font-weight:800!important;letter-spacing:.035em!important;text-transform:uppercase!important;color:#f7feff!important;-webkit-text-fill-color:#f7feff!important;background:none!important;text-shadow:0 1px 0 rgba(255,255,255,.42),0 0 12px rgba(255,255,255,.58),0 0 30px rgba(0,212,255,.5),0 0 64px rgba(0,132,255,.25)!important;animation:none!important;}',
      '#loading .startup-title *{color:#f7feff!important;-webkit-text-fill-color:#f7feff!important;background:none!important;text-shadow:inherit!important;animation:none!important;filter:none!important;}',
      '#loading .startup-title::after{display:none!important;content:none!important;animation:none!important;}',
      '#loading .uap-startup-line-final{position:absolute!important;height:4px!important;border-radius:999px!important;z-index:6!important;pointer-events:none!important;overflow:visible!important;filter:blur(.25px)!important;background:linear-gradient(90deg,rgba(0,255,221,0),rgba(0,132,255,.42) 10%,rgba(0,255,221,.86) 42%,rgba(235,255,255,.92) 50%,rgba(0,255,221,.78) 58%,rgba(0,132,255,.38) 90%,rgba(0,255,221,0))!important;animation:uapStartupSignalCore 3.4s ease-in-out infinite!important;}',
      '#loading .uap-startup-line-final::before{content:""!important;position:absolute!important;top:-13px!important;bottom:-13px!important;width:28%!important;border-radius:999px!important;background:radial-gradient(ellipse at 48% 50%,rgba(255,255,255,.96) 0,rgba(0,255,221,.9) 22%,rgba(0,132,255,.5) 50%,rgba(0,0,0,0) 76%)!important;filter:blur(10px)!important;animation:uapStartupSignalPacket 2.85s cubic-bezier(.18,.72,.22,1) infinite!important;}',
      '#loading .uap-startup-line-final::after{content:""!important;position:absolute!important;left:0!important;right:0!important;top:-20px!important;bottom:-20px!important;border-radius:999px!important;background:linear-gradient(90deg,rgba(0,255,221,0),rgba(0,212,255,.06) 18%,rgba(0,255,221,.34) 44%,rgba(235,255,255,.22) 54%,rgba(0,132,255,.12) 72%,rgba(0,255,221,0))!important;filter:blur(16px)!important;transform-origin:left center!important;animation:uapStartupSignalAfterglow 2.85s ease-out infinite!important;}',
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
    line.style.setProperty('top', (titleRect.bottom - loadingRect.top + 15) + 'px', 'important');
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
      var scale = 0.72 + zoom * 0.52;
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
