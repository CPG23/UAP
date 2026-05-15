(function(){
  'use strict';

  if (window.__uapStartupAnimationFinal) return;
  window.__uapStartupAnimationFinal = true;

  var STYLE_ID = 'uap-startup-animation-final-style';
  var REVEAL_MS = 9200;
  var pulseTimer = null;
  var titleTimer = null;

  function logoMarkup(){
    return [
      '<span class="uap-edge-letter">U</span>',
      '<span class="uap-edge-letter">A</span>',
      '<span class="uap-edge-letter">P</span>',
      '<span class="uap-edge-space" aria-hidden="true"></span>',
      '<span class="uap-edge-letter">N</span>',
      '<span class="uap-edge-letter">e</span>',
      '<span class="uap-edge-letter">w</span>',
      '<span class="uap-edge-letter uap-news-s">s</span>'
    ].join('');
  }

  function injectStyle(){
    var old = document.getElementById(STYLE_ID);
    if (old) old.remove();
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '@keyframes uapLogoEdgeGlow{0%,100%{color:#fbfeff;-webkit-text-fill-color:#fbfeff;-webkit-text-stroke:1px rgba(190,255,255,.28);text-shadow:0 1px 0 rgba(255,255,255,.62),0 0 18px rgba(255,255,255,.68),0 0 40px rgba(0,212,255,.54),0 0 82px rgba(0,132,255,.32);filter:drop-shadow(0 0 3px rgba(0,255,221,.28));}42%{color:#ffffff;-webkit-text-fill-color:#ffffff;-webkit-text-stroke:1px rgba(218,255,255,.6);text-shadow:0 1px 0 rgba(255,255,255,.9),0 0 28px rgba(255,255,255,1),0 0 62px rgba(0,255,221,1),0 0 112px rgba(0,132,255,.76),0 0 160px rgba(0,255,221,.42);filter:drop-shadow(0 0 13px rgba(0,255,221,.82));}}',
      '@keyframes uapLogoTailGlow{0%,100%{opacity:.5;box-shadow:0 0 12px rgba(0,212,255,.36),0 0 28px rgba(0,255,221,.18);}50%{opacity:1;box-shadow:0 0 24px rgba(0,255,221,.86),0 0 54px rgba(0,132,255,.48);}}',
      '#loading .uap-startup-anim-wrap{display:none!important;}',
      '#loading .uap-startup-space-layer{display:none!important;}',
      '#loading .uap-startup-line-final{display:none!important;visibility:hidden!important;opacity:0!important;animation:none!important;}',
      '#loading .startup-title{position:absolute!important;top:28px!important;left:50%!important;right:auto!important;bottom:auto!important;transform:translateX(-50%)!important;margin:0!important;font-family:"Rajdhani","Exo 2",system-ui,sans-serif!important;font-size:clamp(72px,18vw,120px)!important;line-height:.82!important;font-weight:800!important;letter-spacing:.035em!important;text-transform:none!important;color:#f7feff!important;-webkit-text-fill-color:#f7feff!important;background:none!important;text-shadow:none!important;animation:none!important;z-index:2!important;overflow:visible!important;white-space:nowrap!important;isolation:isolate!important;}',
      '#loading .startup-title::after{display:none!important;content:none!important;animation:none!important;}',
      '#loading .uap-edge-letter{position:relative!important;display:inline-block!important;color:#fbfeff!important;-webkit-text-fill-color:#fbfeff!important;-webkit-text-stroke:1px rgba(190,255,255,.28)!important;background:none!important;text-shadow:0 1px 0 rgba(255,255,255,.62),0 0 18px rgba(255,255,255,.68),0 0 40px rgba(0,212,255,.54),0 0 82px rgba(0,132,255,.32)!important;animation:uapLogoEdgeGlow 3.8s ease-in-out infinite!important;will-change:filter,text-shadow!important;}',
      '#loading .uap-edge-space{display:inline-block!important;width:.24em!important;}',
      '#loading .uap-edge-letter:nth-child(1){animation-delay:0s!important;}#loading .uap-edge-letter:nth-child(2){animation-delay:.14s!important;}#loading .uap-edge-letter:nth-child(3){animation-delay:.28s!important;}#loading .uap-edge-letter:nth-child(5){animation-delay:.48s!important;}#loading .uap-edge-letter:nth-child(6){animation-delay:.62s!important;}#loading .uap-edge-letter:nth-child(7){animation-delay:.76s!important;}#loading .uap-edge-letter:nth-child(8){animation-delay:.9s!important;}',
      '#loading .uap-news-s{transform:scaleY(1.2)!important;transform-origin:50% 92%!important;margin-bottom:-.08em!important;z-index:1!important;}',
      '#loading .uap-news-s::after{content:""!important;position:absolute!important;right:.43em!important;bottom:.075em!important;width:4.95em!important;height:.16em!important;border-radius:.08em!important;background:linear-gradient(90deg,rgba(0,255,221,0),rgba(0,212,255,.62) 10%,rgba(218,255,255,.96) 68%,rgba(255,255,255,.92))!important;filter:blur(.55px)!important;animation:uapLogoTailGlow 3.8s ease-in-out infinite!important;pointer-events:none!important;z-index:-1!important;}',
      '#loading .alien-head,#loading img.alien-head{animation:none!important;transition:none!important;transform-origin:center center!important;z-index:1!important;border-radius:44px!important;mask-image:radial-gradient(ellipse 58% 72% at 58% 51%,#000 0 46%,rgba(0,0,0,.78) 62%,rgba(0,0,0,.22) 80%,transparent 100%)!important;-webkit-mask-image:radial-gradient(ellipse 58% 72% at 58% 51%,#000 0 46%,rgba(0,0,0,.78) 62%,rgba(0,0,0,.22) 80%,transparent 100%)!important;}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function renderStartupTitle(){
    var loading = document.getElementById('loading');
    var title = loading && loading.querySelector('.startup-title');
    if (!loading || loading.classList.contains('hidden') || !title) return;
    if (!title.querySelector('.uap-news-s')) title.innerHTML = logoMarkup();
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
