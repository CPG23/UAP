(function(){
  'use strict';
  var IMAGE_BLACK = '#000';

  function ensureLoadingBarStyle(){
    if (document.getElementById('uap-loading-bar-style')) return;
    var style = document.createElement('style');
    style.id = 'uap-loading-bar-style';
    style.textContent = '@keyframes uapMistSweep{0%{transform:translateX(-125%) scaleX(.82);opacity:.08;}18%{opacity:.78;}62%{opacity:.72;}100%{transform:translateX(135%) scaleX(1.08);opacity:.06;}}@keyframes uapMistBreath{0%,100%{opacity:.72;filter:blur(2.2px);box-shadow:0 0 18px rgba(0,212,255,.20),0 0 46px rgba(0,255,157,.10);}50%{opacity:1;filter:blur(2.8px);box-shadow:0 0 30px rgba(0,212,255,.45),0 0 72px rgba(0,255,157,.22);}}#loading .loading-bar{display:block!important;position:absolute!important;left:50%!important;bottom:92px!important;width:min(340px,76vw)!important;height:9px!important;transform:translateX(-50%)!important;background:linear-gradient(90deg,transparent,rgba(0,212,255,.12),rgba(0,255,157,.10),transparent)!important;overflow:visible!important;z-index:8!important;opacity:1!important;border:0!important;border-radius:999px!important;animation:uapMistBreath 1.9s ease-in-out infinite!important;}#loading .loading-bar::before{content:""!important;position:absolute!important;left:0!important;top:50%!important;width:58%!important;height:30px!important;margin-top:-15px!important;border-radius:999px!important;background:radial-gradient(ellipse at center,rgba(220,255,248,.95) 0%,rgba(0,212,255,.72) 24%,rgba(0,255,157,.35) 48%,rgba(0,212,255,.12) 68%,transparent 82%)!important;filter:blur(9px)!important;animation:uapMistSweep 1.75s cubic-bezier(.18,.72,.2,1) infinite!important;}#loading .loading-bar::after{content:""!important;position:absolute!important;inset:3px 0!important;border-radius:999px!important;background:linear-gradient(90deg,transparent,rgba(0,212,255,.38),rgba(216,255,247,.74),rgba(0,255,157,.34),transparent)!important;filter:blur(4px)!important;opacity:.86!important;animation:uapMistSweep 2.35s cubic-bezier(.2,.7,.2,1) infinite reverse!important;}';
    document.head.appendChild(style);
  }

  function showStartupImage(){
    ensureLoadingBarStyle();

    var loading = document.querySelector('#loading');
    if (loading) {
      loading.style.background = IMAGE_BLACK;
      loading.style.backgroundColor = IMAGE_BLACK;
      loading.style.backgroundImage = 'none';
      loading.style.boxShadow = 'inset 0 0 0 100vmax ' + IMAGE_BLACK;
      loading.style.overflow = 'hidden';
    }

    var bar = document.querySelector('#loading .loading-bar');
    if (bar) {
      bar.style.display = 'block';
      bar.style.zIndex = '8';
      bar.style.opacity = '1';
      bar.style.bottom = '92px';
      bar.style.height = '9px';
      bar.style.overflow = 'visible';
    }

    var el = document.querySelector('#loading .alien-head');
    if (!el) return;

    el.style.display = 'block';
    el.style.width = 'min(1770px, 225vw)';
    el.style.maxWidth = 'none';
    el.style.maxHeight = '92vh';
    el.style.margin = '0 auto';
    el.style.opacity = '1';
    el.style.mixBlendMode = 'normal';
    el.style.filter = 'none';
    el.style.maskImage = 'none';
    el.style.webkitMaskImage = 'none';
    el.style.background = IMAGE_BLACK;
    el.style.backgroundColor = IMAGE_BLACK;
    el.style.boxShadow = '0 0 0 100vmax ' + IMAGE_BLACK;
    el.style.border = '0';
    el.style.borderRadius = '0';
    el.style.animation = 'none';
    el.style.transition = 'none';
    el.style.transform = 'translateX(-32vw)';
    el.style.willChange = 'auto';
    el.style.zIndex = '1';

    if (el.tagName && el.tagName.toLowerCase() === 'img') {
      el.style.height = 'auto';
      el.style.minHeight = '0';
      el.style.objectFit = 'contain';
      el.style.objectPosition = 'center center';
    } else {
      el.style.height = 'min(996px, 126vw)';
      el.style.backgroundSize = 'contain';
      el.style.backgroundPosition = 'center center';
      el.style.backgroundRepeat = 'no-repeat';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showStartupImage, { once: true });
  else showStartupImage();
  window.addEventListener('load', showStartupImage);
  setTimeout(showStartupImage, 50);
  setTimeout(showStartupImage, 250);
})();
