(function(){
  'use strict';
  var IMAGE_BLACK = '#000';

  function ensureLoadingBarStyle(){
    if (document.getElementById('uap-loading-bar-style')) return;
    var style = document.createElement('style');
    style.id = 'uap-loading-bar-style';
    style.textContent = '@keyframes uapLoadingRun{0%{left:-72%;opacity:.55;}12%{opacity:1;}100%{left:108%;opacity:.9;}}#loading .loading-bar{display:block!important;position:absolute!important;left:50%!important;bottom:58px!important;width:min(280px,66vw)!important;height:4px!important;transform:translateX(-50%)!important;background:#071f27!important;overflow:hidden!important;z-index:5!important;opacity:1!important;border-radius:999px!important;box-shadow:0 0 14px rgba(0,212,255,.26)!important;}#loading .loading-bar::after{content:""!important;position:absolute!important;top:0!important;left:-72%!important;width:72%!important;height:100%!important;border-radius:999px!important;background:linear-gradient(90deg,transparent,#00d4ff 35%,#00ff9d 65%,transparent)!important;box-shadow:0 0 12px rgba(0,212,255,.75),0 0 20px rgba(0,255,157,.35)!important;animation:uapLoadingRun 1.18s ease-in-out infinite!important;}';
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
      bar.style.zIndex = '5';
      bar.style.opacity = '1';
      bar.style.bottom = '58px';
      bar.style.height = '4px';
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
