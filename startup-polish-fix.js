(function() {
  'use strict';

  var STYLE_ID = 'uap-startup-polish-style';

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.startup-title{position:absolute!important;top:calc(8px + env(safe-area-inset-top))!important;left:4px!important;right:auto!important;transform:none!important;margin:0!important;text-align:left!important;font-size:clamp(72px,22vw,136px)!important;line-height:.82!important;animation:uapStartupLogoPulse 3.2s ease-in-out infinite!important}',
      '.startup-credit{position:absolute!important;top:calc(10px + env(safe-area-inset-top) + clamp(86px,23vw,150px))!important;left:8px!important;right:auto!important;text-align:left!important}',
      '.startup-panel,#loading-status,.startup-panel-label{display:none!important}',
      '.startup-panel-wrap{bottom:22px!important;gap:0!important}',
      '.alien-head{animation:uapAlienSteadyZoom 13s linear infinite!important;will-change:transform,opacity!important;transform-origin:center center!important;backface-visibility:hidden!important;filter:brightness(.78) saturate(1.38) drop-shadow(0 0 34px rgba(0,212,255,.95)) drop-shadow(0 0 78px rgba(0,212,255,.58)) drop-shadow(0 0 108px rgba(0,255,157,.24))!important}',
      '@keyframes uapAlienSteadyZoom{0%{opacity:.56;transform:translate3d(0,0,0) scale(1.06)}20%{opacity:.63;transform:translate3d(0,-1px,0) scale(1.22)}40%{opacity:.72;transform:translate3d(0,-1px,0) scale(1.38)}60%{opacity:.8;transform:translate3d(0,-1px,0) scale(1.54)}80%{opacity:.87;transform:translate3d(0,0,0) scale(1.7)}100%{opacity:.92;transform:translate3d(0,0,0) scale(1.86)}}',
      '@media(max-width:560px){.startup-title{top:calc(7px + env(safe-area-inset-top))!important;left:3px!important;font-size:clamp(64px,22vw,104px)!important}.startup-credit{top:calc(8px + env(safe-area-inset-top) + clamp(76px,23vw,116px))!important;left:6px!important}}'
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
