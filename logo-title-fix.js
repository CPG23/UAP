(function() {
  'use strict';

  var STYLE_ID = 'uap-logo-title-style';

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.brand-title,.startup-title{display:inline-block!important;position:relative!important;color:#eafcff!important;font-family:"Rajdhani",sans-serif!important;font-weight:700!important;line-height:.92!important;letter-spacing:2px!important;text-transform:none!important;text-shadow:0 0 8px rgba(255,255,255,.65),0 0 22px rgba(0,212,255,.9),0 0 44px rgba(0,255,157,.35)!important;white-space:nowrap!important}',
      '.brand-title{font-size:clamp(28px,8vw,46px)!important}',
      '.startup-title{top:28px!important;left:50%!important;transform:translateX(-50%)!important;margin:0!important;font-size:clamp(48px,15vw,92px)!important;z-index:2!important}',
      '.brand-title::after,.startup-title::after{content:"";position:absolute;left:1px;right:0;bottom:-7px;height:2px;background:linear-gradient(90deg,#00d4ff,#00ff9d,transparent);box-shadow:0 0 18px rgba(0,212,255,.95)}',
      '.startup-title .startup-u,.startup-title .startup-a,.startup-title .startup-p,.startup-title .startup-news{color:inherit!important;font:inherit!important;letter-spacing:inherit!important;text-shadow:inherit!important;line-height:inherit!important}',
      '.startup-title .startup-byline{display:none!important}',
      '@media(max-width:560px){.brand-title{font-size:clamp(27px,10vw,39px)!important;letter-spacing:1px!important}.startup-title{font-size:clamp(42px,16vw,72px)!important;letter-spacing:1px!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function setTitles() {
    var brand = document.querySelector('.brand-title');
    if (brand) brand.textContent = 'UAP News';

    var startup = document.querySelector('.startup-title');
    if (startup) startup.textContent = 'UAP News';

    document.title = 'UAP News';
    var appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appleTitle) appleTitle.setAttribute('content', 'UAP News');
  }

  function apply() {
    injectStyle();
    setTitles();
  }

  function start() {
    apply();
    var observer = new MutationObserver(function() { setTimeout(apply, 0); });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
