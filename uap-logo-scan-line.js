(function(){
  'use strict';
  var STYLE_ID = 'uap-logo-scan-line-style';

  function wrapLogoText(el){
    if (!el || el.dataset.uapLetters === '1') return;
    var text = (el.textContent || 'UAP News').replace(/\s+/g, ' ').trim() || 'UAP News';
    el.textContent = '';
    Array.prototype.forEach.call(text, function(ch, index){
      var span = document.createElement('span');
      span.className = ch === ' ' ? 'uap-logo-space' : 'uap-logo-letter';
      span.style.setProperty('--i', index);
      span.textContent = ch === ' ' ? '\u00a0' : ch;
      el.appendChild(span);
    });
    el.dataset.uapLetters = '1';
  }

  function applyLogoScanLine(){
    wrapLogoText(document.querySelector('.startup-title'));
    wrapLogoText(document.querySelector('.brand-title'));

    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '@keyframes uapLetterScan{0%,100%{color:#ffffff;-webkit-text-fill-color:#ffffff;text-shadow:0 0 8px rgba(255,255,255,.48),0 0 18px rgba(0,212,255,.38);filter:brightness(.96);}7%{color:#7df7ff;-webkit-text-fill-color:#7df7ff;text-shadow:0 0 12px rgba(125,247,255,.95),0 0 34px rgba(0,212,255,1),0 0 52px rgba(0,140,255,.55);filter:brightness(1.45);}14%{color:#00bfff;-webkit-text-fill-color:#00bfff;text-shadow:0 0 16px rgba(0,191,255,1),0 0 42px rgba(0,126,255,.85),0 0 60px rgba(0,255,221,.42);filter:brightness(1.32);}22%{color:#ffffff;-webkit-text-fill-color:#ffffff;text-shadow:0 0 8px rgba(255,255,255,.48),0 0 18px rgba(0,212,255,.38);filter:brightness(1);}}',
      '#loading .loading-bar{display:none!important;visibility:hidden!important;opacity:0!important;animation:none!important;}',
      '#loading .alien-head,#loading img.alien-head{position:absolute!important;left:calc(50% - 4vw)!important;top:50%!important;margin:0!important;width:min(1770px,225vw)!important;height:min(996px,126vw)!important;max-width:none!important;max-height:92vh!important;animation:none!important;transition:none!important;transform:translate(-50%,-50%)!important;will-change:auto!important;}',
      '.startup-title::before,.startup-title::after,.brand-title::before,.brand-title::after{content:none!important;display:none!important;animation:none!important;}',
      '.startup-title,.brand-title{background:none!important;background-image:none!important;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;text-shadow:none!important;animation:none!important;white-space:nowrap!important;}',
      '.uap-logo-letter{display:inline-block!important;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;animation:uapLetterScan 3.2s ease-in-out infinite!important;animation-delay:calc(var(--i) * .13s)!important;}',
      '.uap-logo-space{display:inline-block!important;width:.28em!important;animation:none!important;}',
      '@media(max-width:560px){.uap-logo-letter{animation-duration:3s!important;animation-delay:calc(var(--i) * .12s)!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyLogoScanLine, { once: true });
  else applyLogoScanLine();
  window.addEventListener('load', applyLogoScanLine);
  setTimeout(applyLogoScanLine, 250);
})();
