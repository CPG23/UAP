(function(){
  'use strict';
  function showStartupImage(){
    var loading = document.querySelector('#loading');
    if (loading) {
      loading.style.background = '#000';
      loading.style.backgroundColor = '#000';
      loading.style.backgroundImage = 'none';
      loading.style.overflow = 'hidden';
    }

    var el = document.querySelector('#loading .alien-head');
    if (!el) return;

    el.style.display = 'block';
    el.style.width = 'min(760px, 96vw)';
    el.style.maxWidth = '96vw';
    el.style.maxHeight = '58vh';
    el.style.margin = '0 auto';
    el.style.opacity = '1';
    el.style.mixBlendMode = 'normal';
    el.style.filter = 'none';
    el.style.maskImage = 'none';
    el.style.webkitMaskImage = 'none';
    el.style.backgroundColor = 'transparent';
    el.style.border = '0';
    el.style.borderRadius = '0';
    el.style.animation = 'none';
    el.style.transform = 'none';
    el.style.zIndex = '1';

    if (el.tagName && el.tagName.toLowerCase() === 'img') {
      el.style.height = 'auto';
      el.style.minHeight = '0';
      el.style.objectFit = 'contain';
      el.style.objectPosition = 'center center';
    } else {
      el.style.height = 'min(430px, 54vw)';
      el.style.backgroundSize = 'contain';
      el.style.backgroundPosition = 'center center';
      el.style.backgroundRepeat = 'no-repeat';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showStartupImage, { once: true });
  else showStartupImage();
  window.addEventListener('load', showStartupImage);
  setTimeout(showStartupImage, 250);
})();
