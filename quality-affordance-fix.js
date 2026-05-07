(function() {
  'use strict';

  var STYLE_ID = 'uap-quality-affordance-style';

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.quality-help{display:none!important}',
      '.badge.quality{position:relative!important;display:inline-flex!important;align-items:center!important;gap:5px!important;padding-right:8px!important;border-color:rgba(0,255,157,.46)!important;background:linear-gradient(135deg,rgba(0,255,157,.13),rgba(0,212,255,.08))!important;box-shadow:0 0 12px rgba(0,255,157,.16)!important;cursor:pointer!important;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease!important}',
      '.badge.quality::after{content:"i";display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;border:1px solid rgba(0,212,255,.68);border-radius:50%;color:#00d4ff;font-family:"Share Tech Mono",monospace;font-size:9px;line-height:1;text-transform:none;letter-spacing:0;background:rgba(0,212,255,.08)}',
      '.badge.quality:active{transform:scale(.96)!important;box-shadow:0 0 18px rgba(0,255,157,.28)!important}',
      '@media(hover:hover){.badge.quality:hover{border-color:rgba(0,255,157,.82)!important;box-shadow:0 0 18px rgba(0,255,157,.26)!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function removeQualityHelp() {
    document.querySelectorAll('.quality-help').forEach(function(el) { el.remove(); });
  }

  function enhanceBadges() {
    document.querySelectorAll('.badge.quality').forEach(function(badge) {
      badge.setAttribute('aria-label', 'Wertung öffnen und Erklärung anzeigen');
      badge.title = 'Details zur Wertung anzeigen';
    });
  }

  function apply() {
    injectStyle();
    removeQualityHelp();
    enhanceBadges();
  }

  function start() {
    apply();
    var observer = new MutationObserver(function() { setTimeout(apply, 0); });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
