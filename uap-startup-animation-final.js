(function(){
  'use strict';

  if (window.__uapStartupAnimationFinal) return;
  window.__uapStartupAnimationFinal = true;

  var STYLE_ID = 'uap-startup-animation-final-style';
  var pulseTimer = null;

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '@keyframes uapStartupBeamMove{0%{transform:translateX(-135%) skewX(-18deg);opacity:0;}12%{opacity:1;}68%{opacity:1;}100%{transform:translateX(135%) skewX(-18deg);opacity:0;}}',
      '@keyframes uapStartupLineGlow{0%,100%{opacity:.72;box-shadow:0 0 12px rgba(0,220,255,.62),0 0 26px rgba(0,132,255,.32);}50%{opacity:1;box-shadow:0 0 24px rgba(0,255,221,1),0 0 54px rgba(0,132,255,.72);}}',
      '#loading .uap-startup-anim-wrap{position:absolute!important;top:28px!important;left:50%!important;transform:translateX(-50%)!important;width:min(620px,88vw)!important;height:clamp(76px,18vw,132px)!important;z-index:4!important;pointer-events:none!important;overflow:hidden!important;mix-blend-mode:screen!important;}',
      '#loading .uap-startup-beam{position:absolute!important;inset:0!important;width:42%!important;background:linear-gradient(90deg,rgba(0,255,221,0),rgba(126,255,255,.28),rgba(0,166,255,.42),rgba(0,255,221,0))!important;filter:blur(10px)!important;animation:uapStartupBeamMove 2.9s ease-out infinite!important;}',
      '#loading .uap-startup-line{position:absolute!important;left:0!important;right:0!important;bottom:3px!important;height:4px!important;border-radius:999px!important;background:linear-gradient(90deg,rgba(0,255,221,0),#00d4ff 18%,#7dffff 50%,#00ffdd 82%,rgba(0,255,221,0))!important;animation:uapStartupLineGlow 2.9s ease-in-out infinite!important;}',
      '#loading.hidden .uap-startup-anim-wrap{display:none!important;}',
      '@media(max-width:560px){#loading .uap-startup-anim-wrap{top:28px!important;width:86vw!important;height:clamp(70px,21vw,112px)!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function ensureBeam(){
    var loading = document.getElementById('loading');
    if (!loading || loading.classList.contains('hidden')) return;
    if (loading.querySelector('.uap-startup-anim-wrap')) return;
    var wrap = document.createElement('div');
    wrap.className = 'uap-startup-anim-wrap';
    wrap.innerHTML = '<div class="uap-startup-beam"></div><div class="uap-startup-line"></div>';
    loading.appendChild(wrap);
  }

  function startAlienPulse(){
    if (pulseTimer) return;
    var start = Date.now();
    pulseTimer = setInterval(function(){
      var loading = document.getElementById('loading');
      var alien = loading && loading.querySelector('.alien-head');
      if (!loading || loading.classList.contains('hidden') || !alien) {
        clearInterval(pulseTimer);
        pulseTimer = null;
        return;
      }
      var wave = (Math.sin((Date.now() - start) / 520) + 1) / 2;
      var brightness = 0.86 + wave * 0.34;
      var opacity = 0.88 + wave * 0.12;
      alien.style.setProperty('opacity', String(opacity), 'important');
      alien.style.setProperty('filter', 'brightness(' + brightness.toFixed(2) + ') contrast(1.10) saturate(1.08)', 'important');
      alien.style.setProperty('animation', 'none', 'important');
      alien.style.setProperty('transform', 'translate(-50%, -50%)', 'important');
    }, 80);
  }

  function run(){
    injectStyle();
    ensureBeam();
    startAlienPulse();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
  window.addEventListener('load', run);
  setTimeout(run, 50);
  setTimeout(run, 250);
  setTimeout(run, 800);
})();
