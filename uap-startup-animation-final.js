(function(){
  'use strict';

  if (window.__uapStartupAnimationFinal) return;
  window.__uapStartupAnimationFinal = true;

  var STYLE_ID = 'uap-startup-animation-final-style';
  var REVEAL_MS = 9200;
  var pulseTimer = null;
  var titleTimer = null;

  function injectStyle(){
    var old = document.getElementById(STYLE_ID);
    if (old) old.remove();
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '@keyframes uapLogoEdgeGlow{0%,100%{color:#f7feff;-webkit-text-fill-color:#f7feff;text-shadow:0 1px 0 rgba(255,255,255,.46),0 0 12px rgba(255,255,255,.52),0 0 28px rgba(0,212,255,.34),0 0 56px rgba(0,132,255,.18);filter:drop-shadow(0 0 0 rgba(0,255,221,0));}42%{color:#ffffff;-webkit-text-fill-color:#ffffff;text-shadow:0 1px 0 rgba(255,255,255,.72),0 0 18px rgba(255,255,255,.86),0 0 38px rgba(0,255,221,.82),0 0 78px rgba(0,132,255,.48),0 0 118px rgba(0,255,221,.2);filter:drop-shadow(0 0 7px rgba(0,255,221,.55));}}',
      '#loading .uap-startup-anim-wrap{display:none!important;}',
      '#loading .uap-startup-space-layer{display:none!important;}',
      '#loading .uap-startup-line-final{display:none!important;visibility:hidden!important;opacity:0!important;animation:none!important;}',
      '#loading .startup-title{font-family:"Rajdhani","Exo 2",system-ui,sans-serif!important;font-weight:800!important;letter-spacing:.035em!important;text-transform:uppercase!important;color:#f7feff!important;-webkit-text-fill-color:#f7feff!important;background:none!important;text-shadow:none!important;animation:none!important;z-index:2!important;}',
      '#loading .startup-title::after{display:none!important;content:none!important;animation:none!important;}',
      '#loading .uap-edge-letter{display:inline-block!important;color:#f7feff!important;-webkit-text-fill-color:#f7feff!important;background:none!important;text-shadow:0 1px 0 rgba(255,255,255,.46),0 0 12px rgba(255,255,255,.52),0 0 28px rgba(0,212,255,.34),0 0 56px rgba(0,132,255,.18)!important;animation:uapLogoEdgeGlow 3.8s ease-in-out infinite!important;will-change:filter,text-shadow!important;}',
      '#loading .uap-edge-space{display:inline-block!important;width:.24em!important;}',
      '#loading .uap-edge-letter:nth-child(1){animation-delay:0s!important;}#loading .uap-edge-letter:nth-child(2){animation-delay:.14s!important;}#loading .uap-edge-letter:nth-child(3){animation-delay:.28s!important;}#loading .uap-edge-letter:nth-child(5){animation-delay:.48s!important;}#loading .uap-edge-letter:nth-child(6){animation-delay:.62s!important;}#loading .uap-edge-letter:nth-child(7){animation-delay:.76s!important;}#loading .uap-edge-letter:nth-child(8){animation-delay:.9s!important;}',
      '#loading .alien-head,#loading img.alien-head{animation:none!important;transition:none!important;transform-origin:center center!important;z-index:1!important;mask-image:radial-gradient(ellipse 62% 76% at 58% 51%,#000 0 50%,rgba(0,0,0,.82) 66%,rgba(0,0,0,.28) 84%,transparent 100%)!important;-webkit-mask-image:radial-gradient(ellipse 62% 76% at 58% 51%,#000 0 50%,rgba(0,0,0,.82) 66%,rgba(0,0,0,.28) 84%,transparent 100%)!important;}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function renderStartupTitle(){
    var loading = document.getElementById('loading');
    var title = loading && loading.querySelector('.startup-title');
    if (!loading || loading.classList.contains('hidden') || !title) return;
    if (title.querySelector('.uap-edge-letter')) return;
    title.innerHTML = 'UAP News'.split('').map(function(ch){
      if (ch === ' ') return '<span class="uap-edge-space" aria-hidden="true"></span>';
      return '<span class="uap-edge-letter">' + ch + '</span>';
    }).join('');
    title.setAttribute('aria-label', 'UAP News');
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
      renderStartupTitle();
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
      var y = -6 - zoom * 44;
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
    renderStartupTitle();
    keepTitleStable();
    startAlienReveal();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
  window.addEventListener('load', run);
  setTimeout(run, 50);
  setTimeout(run, 250);
  setTimeout(run, 800);
  setTimeout(run, 1600);
})();
