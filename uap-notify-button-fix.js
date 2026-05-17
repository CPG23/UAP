(function(){
  'use strict';
  if (window.__uapNotifyButtonFix) return;
  window.__uapNotifyButtonFix = true;

  var STYLE_ID = 'uap-notify-button-fix-style';
  var TOPIC = 'UAP-News26';

  function injectStyle(){
    var css = [
      '.notify-btn{border-color:rgba(0,212,255,.48)!important;background:linear-gradient(135deg,rgba(0,212,255,.1),rgba(0,255,157,.06))!important;color:#8eefff!important;box-shadow:0 0 14px rgba(0,212,255,.12)!important;}',
      '.notify-btn::after{content:"i"!important;position:absolute!important;right:4px!important;bottom:3px!important;width:12px!important;height:12px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border:1px solid rgba(0,255,157,.72)!important;border-radius:50%!important;background:rgba(3,10,15,.92)!important;color:#00ff9d!important;font-family:"Share Tech Mono",monospace!important;font-size:8px!important;line-height:1!important;letter-spacing:0!important;}',
      '.notify-btn svg{width:19px!important;height:19px!important;stroke:currentColor!important;}',
      '.notify-btn .notify-slash{display:none!important;visibility:hidden!important;opacity:0!important;}',
      '.notify-btn:hover,.notify-btn:focus-visible{border-color:rgba(0,255,157,.7)!important;color:#caffea!important;box-shadow:0 0 18px rgba(0,255,157,.18)!important;}'
    ].join('\n');
    var style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
  }

  function icon(){
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>';
  }

  function patchGuideText(){
    var sheet = document.querySelector('.notify-guide-sheet');
    if (!sheet || sheet.dataset.notifyFixed === '1') return;
    sheet.dataset.notifyFixed = '1';
    var title = sheet.querySelector('h3');
    if (title) title.textContent = 'Push über ntfy';
    var p = sheet.querySelector('p');
    if (p) p.textContent = 'Diese Schaltfläche aktiviert oder deaktiviert nichts in der App. Sie öffnet nur den ntfy-Kanal bzw. diese Info.';
    var steps = sheet.querySelectorAll('.notify-guide-step span');
    if (steps[0]) steps[0].textContent = 'Benachrichtigungen werden in der ntfy-App für den Kanal ' + TOPIC + ' verwaltet.';
    if (steps[1]) steps[1].textContent = 'Beim Tippen auf eine Push-Meldung öffnet sich die normale UAP-News-App.';
  }

  function apply(){
    injectStyle();
    var btn = document.getElementById('notify-btn');
    if (btn) {
      btn.classList.add('uap-notify-info-btn');
      btn.classList.remove('active');
      btn.setAttribute('aria-label', 'ntfy-Push-Info und Kanal öffnen');
      btn.setAttribute('title', 'ntfy-Push-Info und Kanal öffnen');
      if (btn.innerHTML !== icon()) btn.innerHTML = icon();
    }
    patchGuideText();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();
  window.addEventListener('load', apply, { once: true });
  [80, 220, 600, 1200, 2400].forEach(function(delay){ window.setTimeout(apply, delay); });
  if (window.MutationObserver) {
    new MutationObserver(function(){ window.requestAnimationFrame(apply); })
      .observe(document.documentElement, { childList: true, subtree: true });
  }
})();
