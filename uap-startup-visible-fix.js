(function(){
  'use strict';
  var IMAGE_BLACK = '#000';

  function ensureLoadingBarStyle(){
    if (document.getElementById('uap-loading-bar-style')) return;
    var style = document.createElement('style');
    style.id = 'uap-loading-bar-style';
    style.textContent = '@keyframes uapScanSweep{0%{transform:translateX(-115%);opacity:.2;}10%{opacity:1;}55%{opacity:1;}100%{transform:translateX(170%);opacity:.25;}}@keyframes uapScanPulse{0%,100%{box-shadow:0 0 14px rgba(0,212,255,.25),0 0 30px rgba(0,255,157,.12);}50%{box-shadow:0 0 22px rgba(0,212,255,.75),0 0 50px rgba(0,255,157,.35);}}@keyframes uapScanDot{0%{transform:translateX(-40px) scale(.55);opacity:0;}12%{opacity:1;}80%{opacity:1;}100%{transform:translateX(320px) scale(1.05);opacity:0;}}#loading .loading-bar{display:block!important;position:absolute!important;left:50%!important;bottom:62px!important;width:min(320px,72vw)!important;height:6px!important;transform:translateX(-50%)!important;background:linear-gradient(90deg,rgba(0,212,255,.04),rgba(0,212,255,.18),rgba(0,255,157,.12),rgba(0,212,255,.04))!important;overflow:hidden!important;z-index:8!important;opacity:1!important;border-radius:999px!important;border:1px solid rgba(0,212,255,.28)!important;animation:uapScanPulse 1.6s ease-in-out infinite!important;}#loading .loading-bar::before{content:""!important;position:absolute!important;inset:-7px -34%!important;border-radius:999px!important;background:linear-gradient(90deg,transparent 0%,rgba(0,212,255,.18) 24%,#00d4ff 42%,#d8fff7 50%,#00ff9d 58%,rgba(0,255,157,.18) 76%,transparent 100%)!important;filter:blur(.3px)!important;animation:uapScanSweep 1.25s cubic-bezier(.2,.75,.18,1) infinite!important;}#loading .loading-bar::after{content:""!important;position:absolute!important;top:50%!important;left:0!important;width:9px!important;height:9px!important;margin-top:-4.5px!important;border-radius:50%!important;background:#eaffff!important;box-shadow:82px 0 0 #00d4ff,164px 0 0 #00ff9d,246px 0 0 #00d4ff,0 0 14px #00d4ff,82px 0 14px #00d4ff,164px 0 14px #00ff9d,246px 0 14px #00d4ff!important;animation:uapScanDot 1.9s linear infinite!important;}';
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
      bar.style.bottom = '62px';
      bar.style.height = '6px';
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
