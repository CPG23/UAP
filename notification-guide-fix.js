(function() {
  'use strict';

  var STYLE_ID = 'uap-notification-guide-style';
  var NTFY_TOPIC = 'UAP-News26';

  function permissionState() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  }

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
      '.notify-guide-btn:disabled{opacity:.46;cursor:not-allowed}',
      '@media(max-width:420px){.notify-guide-actions{grid-template-columns:1fr}.notify-guide-sheet{padding:14px}.notify-guide-sheet h3{font-size:20px}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function setButtonState() {
    var btn = document.getElementById('notify-btn');
    if (!btn) return;
    btn.classList.remove('active', 'blocked');
    var state = permissionState();
    if (state === 'granted') btn.classList.add('active');
    if (state === 'denied' || state === 'unsupported') btn.classList.add('blocked');
  }

  function closeGuide() {
    var existing = document.querySelector('.notify-guide-overlay');
    if (existing) existing.remove();
  }

  function guideText(state) {
    if (state === 'denied') {
      return {
        title: 'Benachrichtigungen blockiert',
        intro: 'Die App darf derzeit keine Push-Hinweise anzeigen. Das muss einmal in den Browser- oder App-Einstellungen erlaubt werden.',
        steps: [
          'Öffne die Einstellungen deines Browsers oder der installierten UAP-App.',
          'Erlaube dort Benachrichtigungen für diese Website bzw. App.',
          'Öffne zusätzlich in ntfy den Kanal UAP-News26 und stelle sicher, dass er abonniert ist.'
        ],
        primary: 'NTFY-KANAL ÖFFNEN',
        canAsk: false
      };
    }
    if (state === 'unsupported') {
      return {
        title: 'Browser unterstützt Push hier nicht',
        intro: 'Dieser Browser oder diese Ansicht bietet keine direkte Browser-Benachrichtigung. Die zuverlässige Zustellung läuft über ntfy.',
        steps: [
          'Öffne den ntfy-Kanal UAP-News26.',
          'Abonniere den Kanal in der ntfy-App am Smartphone.',
          'Neue GitHub-Nachrichten werden dann über ntfy zugestellt.'
        ],
        primary: 'NTFY-KANAL ÖFFNEN',
        canAsk: false
      };
    }
    return {
      title: 'Benachrichtigungen aktivieren',
      intro: 'Damit neue UAP-Artikel sofort am Smartphone erscheinen, sind zwei Dinge wichtig: Browser-Erlaubnis und ntfy-Abo.',
      steps: [
        'Erlaube Benachrichtigungen, wenn dein Browser danach fragt.',
        'Öffne danach den ntfy-Kanal UAP-News26.',
        'Falls der Kanal in der ntfy-App schon abonniert ist, musst du dort nichts neu anlegen.'
      ],
      primary: 'BERECHTIGUNG ANFRAGEN',
      canAsk: true
    };
  }

  function showGuide() {
    injectStyle();
    closeGuide();
    var state = permissionState();
    var text = guideText(state);
    var overlay = document.createElement('div');
    overlay.className = 'notify-guide-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
      '<div class="notify-guide-sheet">' +
        '<h3>' + text.title + '</h3>' +
        '<p>' + text.intro + '</p>' +
        '<div class="notify-guide-steps">' +
          text.steps.map(function(step, index) {
            return '<div class="notify-guide-step"><strong>' + (index + 1) + '</strong><span>' + step + '</span></div>';
          }).join('') +
        '</div>' +
        '<div class="notify-guide-actions">' +
          '<button type="button" class="notify-guide-btn primary" data-notify-primary>' + text.primary + '</button>' +
          '<button type="button" class="notify-guide-btn" data-notify-close>SCHLIESSEN</button>' +
        '</div>' +
      '</div>';
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay || e.target.hasAttribute('data-notify-close')) closeGuide();
      if (e.target.hasAttribute('data-notify-primary')) {
        if (text.canAsk && 'Notification' in window) {
          e.target.disabled = true;
          Notification.requestPermission().then(function() {
            setButtonState();
            openNtfy();
            closeGuide();
          });
        } else {
          openNtfy();
        }
      }
    });
    document.body.appendChild(overlay);
  }

  window.addEventListener('click', function(e) {
    var btn = e.target.closest && e.target.closest('#notify-btn');
    if (!btn) return;
    setButtonState();
    if (permissionState() === 'granted') return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    showGuide();
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setButtonState);
  else setButtonState();
})();
