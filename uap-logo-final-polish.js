(function(){
  'use strict';

  if (window.__uapLogoFinalPolish) return;
  window.__uapLogoFinalPolish = true;

  var STYLE_ID = 'uap-logo-final-polish-style';
  var LOGO_SRC = './UFO-Logo.png?v=177';

  function logoMarkup(){
    return '<img class="uap-logo-img" src="' + LOGO_SRC + '" alt="UAP-News" decoding="async"><span class="uap-news-s" aria-hidden="true"></span><span class="uap-logo-letter" aria-hidden="true"></span>';
  }

  function injectStyle(){
    var old = document.getElementById(STYLE_ID);
    if (old) old.remove();
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.brand-sub{display:none!important;visibility:hidden!important;opacity:0!important;height:0!important;margin:0!important;padding:0!important;}',
      '.startup-title.uap-logo-final,.brand-title.uap-logo-final{display:block!important;position:relative!important;contain:none!important;isolation:isolate!important;overflow:visible!important;background:none!important;text-shadow:none!important;color:transparent!important;-webkit-text-fill-color:transparent!important;letter-spacing:0!important;text-transform:none!important;white-space:nowrap!important;line-height:1!important;}',
      '#loading .startup-title.uap-logo-final{position:absolute!important;top:max(10px,env(safe-area-inset-top))!important;left:12px!important;right:auto!important;bottom:auto!important;width:72px!important;height:auto!important;transform:none!important;margin:0!important;z-index:3!important;}',
      '.brand-title.uap-logo-final{width:72px!important;max-width:72px!important;height:auto!important;padding:0!important;margin:0!important;}',
      '.startup-title.uap-logo-final::before,.startup-title.uap-logo-final::after,.brand-title.uap-logo-final::before,.brand-title.uap-logo-final::after{display:none!important;content:none!important;}',
      '.uap-logo-final .uap-logo-img{display:block!important;width:72px!important;height:auto!important;max-width:72px!important;object-fit:contain!important;object-position:center center!important;background:transparent!important;border:0!important;margin:0!important;padding:0!important;filter:none!important;animation:none!important;}',
      '#loading .uap-logo-final .uap-logo-img{filter:none!important;}',
      '.brand-title.uap-brand-logo,.brand-title.uap-logo-final{contain:none!important;overflow:visible!important;}',
      '.uap-logo-letter,.uap-logo-space,.uap-edge-letter,.uap-edge-space,.uap-news-s{display:none!important;}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function applyLogo(el){
    if (!el) return;
    el.classList.add('uap-logo-final');
    el.dataset.uapLogoAsset = '1';
    el.dataset.uapLetters = '1';
    if (!el.querySelector('.uap-logo-img')) el.innerHTML = logoMarkup();
    else {
      var img = el.querySelector('.uap-logo-img');
      if (img.getAttribute('src') !== LOGO_SRC) img.setAttribute('src', LOGO_SRC);
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
