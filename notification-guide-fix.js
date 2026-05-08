(function() {
  'use strict';

  var STYLE_ID = 'uap-notification-guide-style';
  var NTFY_TOPIC = 'UAP-News26';

  function openNtfy() {
    window.open('https://ntfy.sh/' + encodeURIComponent(NTFY_TOPIC), '_blank', 'noopener,noreferrer');
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.notify-guide-overlay{position:fixed;inset:0;z-index:3200;display:flex;align-items:flex-end;justify-content:center;padding:18px;background:rgba(1,6,10,.74);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}',
      '.notify-guide-sheet{width:min(540px,100%);border:1px solid rgba(0,212,255,.5);background:linear-gradient(180deg,rgba(8,20,32,.98),rgba(3,10,15,.99));box-shadow:0 0 36px rgba(0,212,255,.24);padding:16px;color:#d6e8f0}',
      '.notify-guide-sheet h3{margin:0 0 8px;color:#00d4ff;font-family:"Rajdhani",sans-serif;font-size:22px;letter-spacing:0}',
      '.notify-guide-sheet p{margin:0 0 12px;color:#adc5cf;font-size:13px;line-height:1.5}',
      '.notify-guide-steps{display:grid;gap:8px;margin:0 0 14px}',
      '.notify-guide-step{display:grid;grid-template-columns:24px 1fr;gap:10px;align-items:start;border-top:1px solid rgba(13,58,92,.72);padding-top:8px;font-size:12px;line-height:1.45;color:#c2d4dc}',
      '.notify-guide-step strong{color:#00ff9d;font-family:"Share Tech Mono",monospace;font-size:11px;font-weight:400}',
      '.notify-guide-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
      '.notify-guide-btn{min-height:40px;border:1px solid rgba(0,212,255,.42);background:rgba(0,212,255,.07);color:#00d4ff;font-family:"Share Tech Mono",monospace;font-size:10px;letter-spacing:1.2px;cursor:pointer}',
      '.notify-guide-btn.primary{border-color:rgba(0,255,157,.65);background:rgba(0,255,157,.12);color:#00ff9d}',
      '@media(max-width:420px){.notify-guide-actions{grid-template-columns:1fr}.notify-guide-sheet{padding:14px}.notify-guide-sheet h3{font-size:20px}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function closeGuide() {
    var existing = document.querySelector('.notify-guide-overlay');
    if (existing) existing.remove();
  }

  function showGuide() {
    injectStyle();
    closeGuide();
    var overlay = document.createElement('div');
    overlay.className = 'notify-guide-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    var steps = [
      'Die Push-Meldungen sollen nur über die ntfy-App am Smartphone kommen.',
      'Der Kanal in der ntfy-App muss exakt UAP-News26 heißen und abonniert sein.',
      'Falls Chrome zusätzlich Meldungen von ntfy.sh zeigt, deaktiviere in Chrome die Website-Benachrichtigungen für ntfy.sh. Diese Chrome-Meldung wird von der App nicht benötigt.'
    ];
    overlay.innerHTML =
      '<div class="notify-guide-sheet">' +
        '<h3>Push über ntfy-App</h3>' +
        '<p>Für diese App wird keine zusätzliche Chrome-Benachrichtigung benötigt. Entscheidend ist das Abo in der ntfy-App.</p>' +
        '<div class="notify-guide-steps">' +
          steps.map(function(step, index) {
            return '<div class="notify-guide-step"><strong>' + (index + 1) + '</strong><span>' + step + '</span></div>';
          }).join('') +
        '</div>' +
        '<div class="notify-guide-actions">' +
          '<button type="button" class="notify-guide-btn primary" data-notify-primary>NTFY-KANAL ÖFFNEN</button>' +
          '<button type="button" class="notify-guide-btn" data-notify-close>SCHLIESSEN</button>' +
        '</div>' +
      '</div>';
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay || e.target.hasAttribute('data-notify-close')) closeGuide();
      if (e.target.hasAttribute('data-notify-primary')) openNtfy();
    });
    document.body.appendChild(overlay);
  }

  window.addEventListener('click', function(e) {
    var btn = e.target.closest && e.target.closest('#notify-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    showGuide();
  }, true);
})();
