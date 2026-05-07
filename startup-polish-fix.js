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
      '.alien-head{animation:uapAlienSteadyZoom 18s linear infinite!important;will-change:transform,opacity,filter!important;transform-origin:center center!important;backface-visibility:hidden!important}',
      '@keyframes uapAlienSteadyZoom{0%{opacity:.56;transform:translate3d(0,0,0) scale(1.06);filter:brightness(.62) saturate(1.18) drop-shadow(0 0 20px rgba(0,212,255,.82)) drop-shadow(0 0 48px rgba(0,212,255,.42))}20%{opacity:.63;transform:translate3d(0,-1px,0) scale(1.22);filter:brightness(.66) saturate(1.23) drop-shadow(0 0 23px rgba(0,212,255,.86)) drop-shadow(0 0 54px rgba(0,212,255,.46))}40%{opacity:.72;transform:translate3d(0,-1px,0) scale(1.38);filter:brightness(.72) saturate(1.3) drop-shadow(0 0 28px rgba(0,212,255,.92)) drop-shadow(0 0 64px rgba(0,212,255,.52))}60%{opacity:.8;transform:translate3d(0,-1px,0) scale(1.54);filter:brightness(.79) saturate(1.38) drop-shadow(0 0 32px rgba(0,212,255,.96)) drop-shadow(0 0 72px rgba(0,212,255,.58)) drop-shadow(0 0 96px rgba(0,255,157,.18))}80%{opacity:.87;transform:translate3d(0,0,0) scale(1.7);filter:brightness(.86) saturate(1.46) drop-shadow(0 0 36px rgba(0,212,255,1)) drop-shadow(0 0 80px rgba(0,212,255,.66)) drop-shadow(0 0 108px rgba(0,255,157,.24))}100%{opacity:.92;transform:translate3d(0,0,0) scale(1.86);filter:brightness(.92) saturate(1.54) drop-shadow(0 0 40px rgba(0,212,255,1)) drop-shadow(0 0 88px rgba(0,212,255,.72)) drop-shadow(0 0 120px rgba(0,255,157,.3))}}',
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
