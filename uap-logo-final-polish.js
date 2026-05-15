(function(){
  'use strict';

  if (window.__uapLogoFinalPolish) return;
  window.__uapLogoFinalPolish = true;

  var STYLE_ID = 'uap-logo-final-polish-style';
  var LOGO_SRC = './UFO-Logo.png?v=181';
  var processedLogoSrc = null;
  var processingLogo = false;

  function logoMarkup(){
    return '<img class="uap-logo-img" src="' + (processedLogoSrc || LOGO_SRC) + '" alt="UAP-News" decoding="async"><span class="uap-news-s" aria-hidden="true"></span><span class="uap-logo-letter" aria-hidden="true"></span>';
  }

  function injectStyle(){
    var old = document.getElementById(STYLE_ID);
    if (old) old.remove();
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.brand-sub{display:none!important;visibility:hidden!important;opacity:0!important;height:0!important;margin:0!important;padding:0!important;}',
      '.startup-title.uap-logo-final,.brand-title.uap-logo-final{display:block!important;position:relative!important;contain:none!important;isolation:isolate!important;overflow:visible!important;background:transparent!important;background-image:none!important;text-shadow:none!important;color:transparent!important;-webkit-text-fill-color:transparent!important;letter-spacing:0!important;text-transform:none!important;white-space:nowrap!important;line-height:1!important;}',
      '#loading .startup-title.uap-logo-final{position:absolute!important;top:max(12px,env(safe-area-inset-top))!important;left:50%!important;right:auto!important;bottom:auto!important;width:min(86vw,360px)!important;height:auto!important;transform:translateX(-50%)!important;margin:0!important;z-index:3!important;}',
      '.brand-title.uap-logo-final{width:min(48vw,190px)!important;max-width:190px!important;height:auto!important;padding:0!important;margin:0!important;}',
      '.startup-title.uap-logo-final::before,.startup-title.uap-logo-final::after,.brand-title.uap-logo-final::before,.brand-title.uap-logo-final::after{display:none!important;content:none!important;}',
      '.uap-logo-final .uap-logo-img{display:block!important;width:min(48vw,190px)!important;height:auto!important;max-width:190px!important;object-fit:contain!important;object-position:center center!important;background:transparent!important;background-image:none!important;border:0!important;margin:0!important;padding:0!important;filter:none!important;animation:none!important;}',
      '#loading .uap-logo-final .uap-logo-img{width:min(86vw,360px)!important;max-width:360px!important;filter:none!important;}',
      '.brand-title.uap-brand-logo,.brand-title.uap-logo-final{contain:none!important;overflow:visible!important;background:transparent!important;background-image:none!important;}',
      '.uap-logo-letter,.uap-logo-space,.uap-edge-letter,.uap-edge-space,.uap-news-s{display:none!important;}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function shouldRemovePixel(data, index){
    var a = data[index + 3];
    if (a === 0) return true;
    var r = data[index], g = data[index + 1], b = data[index + 2];
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var sat = max - min;
    return sat < 34 && max > 18 && max < 250;
  }

  function processLogo(callback){
    if (processedLogoSrc) { callback(); return; }
    if (processingLogo) return;
    processingLogo = true;
    var img = new Image();
    img.onload = function(){
      try {
        var canvas = document.createElement('canvas');
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        var image = ctx.getImageData(0, 0, w, h);
        var data = image.data;
        var seen = new Uint8Array(w * h);
        var queueX = [];
        var queueY = [];
        function push(x, y){
          if (x < 0 || y < 0 || x >= w || y >= h) return;
          var p = y * w + x;
          if (seen[p]) return;
          var i = p * 4;
          if (!shouldRemovePixel(data, i)) return;
          seen[p] = 1;
          queueX.push(x);
          queueY.push(y);
        }
        for (var x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
        for (var y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
        for (var q = 0; q < queueX.length; q++) {
          var cx = queueX[q];
          var cy = queueY[q];
          push(cx + 1, cy); push(cx - 1, cy); push(cx, cy + 1); push(cx, cy - 1);
        }
        for (var p = 0; p < seen.length; p++) {
          if (seen[p]) data[p * 4 + 3] = 0;
        }
        ctx.putImageData(image, 0, 0);
        processedLogoSrc = canvas.toDataURL('image/png');
      } catch (err) {
        processedLogoSrc = LOGO_SRC;
      }
      processingLogo = false;
      callback();
    };
    img.onerror = function(){ processingLogo = false; processedLogoSrc = LOGO_SRC; callback(); };
    img.src = LOGO_SRC;
  }

  function applyLogo(el){
    if (!el) return;
    el.classList.add('uap-logo-final');
    el.dataset.uapLogoAsset = '1';
    el.dataset.uapLetters = '1';
    var desired = processedLogoSrc || LOGO_SRC;
    if (!el.querySelector('.uap-logo-img')) el.innerHTML = logoMarkup();
    else {
      var img = el.querySelector('.uap-logo-img');
      if (img.getAttribute('src') !== desired) img.setAttribute('src', desired);
      img.setAttribute('alt', 'UAP-News');
      if (!el.querySelector('.uap-news-s')) el.insertAdjacentHTML('beforeend', '<span class="uap-news-s" aria-hidden="true"></span>');
      if (!el.querySelector('.uap-logo-letter')) el.insertAdjacentHTML('beforeend', '<span class="uap-logo-letter" aria-hidden="true"></span>');
    }
    el.setAttribute('aria-label', 'UAP-News');
  }

  function apply(){
    injectStyle();
    applyLogo(document.querySelector('#loading .startup-title'));
    applyLogo(document.querySelector('.brand-title'));
    processLogo(function(){
      applyLogo(document.querySelector('#loading .startup-title'));
      applyLogo(document.querySelector('.brand-title'));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();
  window.addEventListener('load', apply);
  setTimeout(apply, 20);
  setTimeout(apply, 80);
  setTimeout(apply, 200);
  setTimeout(apply, 500);
  setTimeout(apply, 1000);

  new MutationObserver(function(){ requestAnimationFrame(apply); })
    .observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
