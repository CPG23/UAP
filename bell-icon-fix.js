(function() {
  'use strict';

  var STYLE_ID = 'uap-bell-icon-style';

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.notify-btn{display:inline-flex!important;align-items:center!important;justify-content:center!important}',
      '.notify-btn svg{width:19px;height:19px;display:block;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;fill:none;filter:drop-shadow(0 0 6px rgba(0,212,255,.45))}',
      '.notify-btn .notify-slash{display:block;stroke:#ffb69c;stroke-width:2.35;filter:drop-shadow(0 0 7px rgba(255,107,53,.55))}',
      '.notify-btn.active .notify-slash{display:none}',
      '.notify-btn.active svg{filter:drop-shadow(0 0 7px rgba(0,255,157,.58))}',
      '.notify-btn.blocked .notify-slash{stroke:#ff6b35}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function bellSvg() {
    return '' +
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />' +
        '<path d="M10 21h4" />' +
        '<path class="notify-slash" d="M4 4l16 16" />' +
      '</svg>';
  }

  function renderBell() {
    injectStyle();
    var btn = document.getElementById('notify-btn');
    if (!btn) return;
    var active = btn.classList.contains('active');
    var blocked = btn.classList.contains('blocked');
    var state = active ? 'active' : (blocked ? 'blocked' : 'inactive');
    if (btn.dataset.bellIconState === state && btn.querySelector('svg')) return;
    btn.innerHTML = bellSvg();
    btn.dataset.bellIconState = state;
    btn.setAttribute('aria-label', active ? 'Push-Benachrichtigungen aktiv' : 'Push-Benachrichtigungen deaktiviert');
  }

  function start() {
    renderBell();
    var observer = new MutationObserver(function() { setTimeout(renderBell, 0); });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
