(function(){
  'use strict';
  var IMAGE_BLACK = '#000';
  var IMAGE_X = 'calc(50% - 4vw)';
  var IMAGE_Y = '50%';

  function ensureLoadingBarStyle(){
    if (document.getElementById('uap-loading-bar-style')) return;
    var style = document.createElement('style');
    style.id = 'uap-loading-bar-style';
    style.textContent = '#loading .loading-bar{display:none!important;visibility:hidden!important;opacity:0!important;animation:none!important;}#loading .alien-head,#loading img.alien-head{position:absolute!important;left:' + IMAGE_X + '!important;top:' + IMAGE_Y + '!important;margin:0!important;animation:none!important;transition:none!important;transform:translate(-50%,-50%)!important;will-change:auto!important;}';
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
      bar.style.display = 'none';
      bar.style.visibility = 'hidden';
      bar.style.opacity = '0';
      bar.style.animation = 'none';
    }

    var el = document.querySelector('#loading .alien-head');
    if (!el) return;

    el.style.position = 'absolute';
    el.style.left = IMAGE_X;
    el.style.top = IMAGE_Y;
    el.style.display = 'block';
    el.style.width = 'min(1770px, 225vw)';
    el.style.height = 'min(996px, 126vw)';
    el.style.maxWidth = 'none';
    el.style.maxHeight = '92vh';
    el.style.margin = '0';
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
    el.style.transform = 'translate(-50%, -50%)';
    el.style.willChange = 'auto';
    el.style.zIndex = '1';

    if (el.tagName && el.tagName.toLowerCase() === 'img') {
      el.style.minHeight = '0';
      el.style.objectFit = 'contain';
      el.style.objectPosition = 'center center';
    } else {
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
  setTimeout(showStartupImage, 800);
})();
