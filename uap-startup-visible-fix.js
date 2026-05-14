(function(){
  'use strict';
  function showStartupImage(){
    var el = document.querySelector('#loading .alien-head');
    if (!el) return;
    el.style.display = 'block';
    el.style.width = 'min(560px, 92vw)';
    el.style.maxWidth = '92vw';
    el.style.margin = '0 auto';
    el.style.opacity = '0.92';
    el.style.mixBlendMode = 'normal';
    el.style.filter = 'brightness(1.28) contrast(1.08) drop-shadow(0 0 22px rgba(0,212,255,.85)) drop-shadow(0 0 48px rgba(0,255,157,.28))';
    el.style.maskImage = 'none';
    el.style.webkitMaskImage = 'none';
    el.style.backgroundColor = 'transparent';
    el.style.border = '0';
    el.style.borderRadius = '0';
    el.style.animation = 'none';
    el.style.transform = 'translateZ(0)';
    el.style.zIndex = '1';
    if (el.tagName && el.tagName.toLowerCase() === 'img') {
      el.style.height = 'auto';
      el.style.minHeight = '0';
      el.style.objectFit = 'contain';
    } else {
      el.style.height = 'min(650px, 108vw)';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showStartupImage, { once: true });
  else showStartupImage();
  window.addEventListener('load', showStartupImage);
  setTimeout(showStartupImage, 250);
})();
