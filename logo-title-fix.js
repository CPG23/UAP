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
      '.startup-title{top:calc(10px + env(safe-area-inset-top))!important;left:6px!important;right:auto!important;transform:none!important;margin:0!important;font-size:clamp(40px,12vw,74px)!important;z-index:2!important;text-align:left!important;animation:uapStartupLogoPulse 2.7s ease-in-out infinite!important}',
      '.brand-title::after,.startup-title::after{content:"";position:absolute;left:1px;right:0;bottom:-7px;height:2px;background:linear-gradient(90deg,#00d4ff,#00ff9d,transparent);box-shadow:0 0 18px rgba(0,212,255,.95)}',
      '.startup-title::after{animation:uapStartupLinePulse 2.7s ease-in-out infinite!important}',
      '@keyframes uapStartupLogoPulse{0%,100%{color:#7aa6b5;text-shadow:0 0 3px rgba(0,212,255,.3),0 0 10px rgba(0,212,255,.32),0 0 20px rgba(0,255,157,.12);filter:brightness(.68)}45%{color:#ffffff;text-shadow:0 0 10px rgba(255,255,255,.95),0 0 28px rgba(0,212,255,1),0 0 64px rgba(0,212,255,.95),0 0 110px rgba(0,255,157,.7);filter:brightness(1.55)}62%{color:#dffaff;text-shadow:0 0 6px rgba(255,255,255,.78),0 0 20px rgba(0,212,255,.85),0 0 48px rgba(0,255,157,.42);filter:brightness(1.12)}}',
      '@keyframes uapStartupLinePulse{0%,100%{opacity:.35;box-shadow:0 0 7px rgba(0,212,255,.32)}45%{opacity:1;box-shadow:0 0 24px rgba(0,212,255,1),0 0 42px rgba(0,255,157,.7)}}',
      '.startup-title .startup-u,.startup-title .startup-a,.startup-title .startup-p,.startup-title .startup-news{color:inherit!important;font:inherit!important;letter-spacing:inherit!important;text-shadow:inherit!important;line-height:inherit!important}',
      '.startup-title .startup-byline{display:none!important}',
      '.startup-credit{position:absolute;top:calc(10px + env(safe-area-inset-top) + clamp(48px,13vw,82px))!important;left:8px!important;z-index:2!important;color:#c6f4ff!important;font-family:"Share Tech Mono",monospace!important;font-size:clamp(9px,2.5vw,12px)!important;letter-spacing:1.8px!important;text-transform:none!important;text-shadow:0 0 6px rgba(255,255,255,.45),0 0 16px rgba(0,212,255,.75)!important;opacity:.92!important}',
      '@media(max-width:560px){.brand-title{font-size:clamp(27px,10vw,39px)!important;letter-spacing:1px!important}.startup-title{top:calc(8px + env(safe-area-inset-top))!important;left:4px!important;font-size:clamp(38px,13vw,62px)!important;letter-spacing:1px!important}.startup-credit{left:6px!important;top:calc(8px + env(safe-area-inset-top) + clamp(45px,14vw,70px))!important;letter-spacing:1.3px!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function ensureStartupCredit() {
    var loading = document.getElementById('loading');
    if (!loading) return;
    var credit = document.querySelector('.startup-credit');
    if (!credit) {
      credit = document.createElement('div');
      credit.className = 'startup-credit';
      loading.appendChild(credit);
    }
    credit.textContent = 'created by Chris Gehring';
  }

  function setTitles() {
    var brand = document.querySelector('.brand-title');
    if (brand) brand.textContent = 'UAP News';

    var startup = document.querySelector('.startup-title');
    if (startup) startup.textContent = 'UAP News';

    ensureStartupCredit();

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
