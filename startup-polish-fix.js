(function() {
  'use strict';

  var STYLE_ID = 'uap-startup-polish-style';

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.startup-title{position:absolute!important;top:calc(8px + env(safe-area-inset-top))!important;left:4px!important;right:auto!important;transform:none!important;margin:0!important;text-align:left!important;font-size:clamp(40px,12vw,74px)!important;animation:uapStartupLogoPulse 3.2s ease-in-out infinite!important}',
      '.startup-credit{position:absolute!important;top:calc(8px + env(safe-area-inset-top) + clamp(48px,13vw,82px))!important;left:6px!important;right:auto!important;text-align:left!important}',
      '.alien-head{animation:uapAlienSteadyZoom 13s linear infinite!important;will-change:transform,opacity!important;transform-origin:center center!important;backface-visibility:hidden!important;filter:brightness(.78) saturate(1.38) drop-shadow(0 0 34px rgba(0,212,255,.95)) drop-shadow(0 0 78px rgba(0,212,255,.58)) drop-shadow(0 0 108px rgba(0,255,157,.24))!important}',
      '@keyframes uapAlienSteadyZoom{0%{opacity:.56;transform:translate3d(0,0,0) scale(1.06)}20%{opacity:.63;transform:translate3d(0,-1px,0) scale(1.22)}40%{opacity:.72;transform:translate3d(0,-1px,0) scale(1.38)}60%{opacity:.8;transform:translate3d(0,-1px,0) scale(1.54)}80%{opacity:.87;transform:translate3d(0,0,0) scale(1.7)}100%{opacity:.92;transform:translate3d(0,0,0) scale(1.86)}}',
      '@media(max-width:560px){.startup-title{top:calc(7px + env(safe-area-inset-top))!important;left:3px!important;font-size:clamp(38px,13vw,62px)!important}.startup-credit{top:calc(7px + env(safe-area-inset-top) + clamp(45px,14vw,70px))!important;left:5px!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function alignCredit() {
    var loading = document.getElementById('loading');
    var title = document.querySelector('.startup-title');
    if (!loading || !title) return;
    var credit = document.querySelector('.startup-credit');
    if (!credit) {
      credit = document.createElement('div');
      credit.className = 'startup-credit';
      loading.appendChild(credit);
    }
    credit.textContent = 'created by Chris Gehring';
  }

  function apply() {
    injectStyle();
    alignCredit();
  }

  function start() {
    apply();
    var observer = new MutationObserver(function() { setTimeout(apply, 0); });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
