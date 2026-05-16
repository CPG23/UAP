(function(){
  'use strict';
  if (window.__uapHeaderRetryFix) return;
  window.__uapHeaderRetryFix = true;

  var STYLE_ID = 'uap-header-retry-fix-style';
  var cachedSrc = '';

  function installStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      'header{padding:0!important;background:#000!important;border-bottom:1px solid rgba(0,212,255,.42)!important;overflow:hidden!important;}',
      'header .header-inner{display:block!important;width:100%!important;max-width:none!important;margin:0!important;padding:0!important;}',
      'header .brand{display:block!important;width:100%!important;min-width:0!important;margin:0!important;padding:0!important;}',
      '.brand-sub,.status{display:none!important;visibility:hidden!important;opacity:0!important;height:0!important;margin:0!important;padding:0!important;}',
      '.brand-title.uap-logo-final{display:block!important;width:100vw!important;height:24vw!important;min-height:92px!important;max-height:172px!important;margin-left:calc(50% - 50vw)!important;margin-right:calc(50% - 50vw)!important;padding:0!important;line-height:0!important;overflow:hidden!important;background:#000!important;color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;pointer-events:none!important;}',
      '.brand-title.uap-logo-final::before,.brand-title.uap-logo-final::after{display:none!important;content:none!important;}',
      '.brand-title.uap-logo-final .uap-header-banner-img{display:block!important;width:100%!important;max-width:none!important;height:100%!important;object-fit:fill!important;object-position:center center!important;background:#000!important;border:0!important;margin:0!important;padding:0!important;filter:none!important;animation:none!important;pointer-events:none!important;}',
      '.uap-logo-final .uap-logo-img,.uap-logo-letter,.uap-logo-space,.uap-edge-letter,.uap-edge-space,.uap-news-s{display:none!important;}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function extractSrc(text){
    var match = text && text.match(/var\s+HEADER_SRC\s*=\s*'([^']+)'/);
    return match ? match[1] : '';
  }

  function readSrc(){
    var existing = document.querySelector('.uap-header-banner-img[src^="data:image"]');
    if (existing && existing.src) {
      cachedSrc = existing.src;
      return Promise.resolve(cachedSrc);
    }
    if (cachedSrc) return Promise.resolve(cachedSrc);
    return fetch('./uap-logo-final-polish.js?v=' + Date.now(), { cache: 'no-store' })
      .then(function(resp){ return resp.text(); })
      .then(function(text){ cachedSrc = extractSrc(text); return cachedSrc; })
      .catch(function(){ return ''; });
  }

  function apply(src){
    if (!src) return false;
    var el = document.querySelector('.brand-title');
    if (!el) return false;
    if (el.dataset.uapHeaderRetry === '1' && el.querySelector('.uap-header-banner-img')) return true;
    el.classList.add('uap-logo-final');
    el.dataset.uapLogoAsset = '1';
    el.dataset.uapLetters = '1';
    el.dataset.uapFinalBanner = '1';
    el.dataset.uapHeaderRetry = '1';
    el.innerHTML = '<img class="uap-header-banner-img" src="' + src + '" alt="UAP-News" decoding="async">';
    el.setAttribute('aria-label', 'UAP-News');
    return true;
  }

  function run(){
    installStyle();
    readSrc().then(function(src){ apply(src); });
  }

  run();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  window.addEventListener('load', run, { once: true });
  var tries = 0;
  var timer = setInterval(function(){
    tries += 1;
    readSrc().then(function(src){ if (apply(src) || tries > 50) clearInterval(timer); });
  }, 150);
})();
