(function(){
  'use strict';
  var STYLE_ID = 'uap-logo-scan-line-style';
  var IMAGE_X = 'calc(50% + 26vw)';

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
      '@keyframes uapLetterScanOnce{0%,7%{color:#ffffff;-webkit-text-fill-color:#ffffff;text-shadow:0 0 8px rgba(255,255,255,.45),0 0 18px rgba(0,220,255,.32);filter:brightness(.98);}22%{color:#8bfbff;-webkit-text-fill-color:#8bfbff;text-shadow:0 0 14px rgba(139,251,255,1),0 0 38px rgba(0,232,255,1),0 0 64px rgba(0,120,255,.72);filter:brightness(1.58);}42%{color:#00dfff;-webkit-text-fill-color:#00dfff;text-shadow:0 0 18px rgba(0,223,255,1),0 0 48px rgba(0,150,255,.98),0 0 72px rgba(0,255,221,.62);filter:brightness(1.42);}72%,100%{color:#ffffff;-webkit-text-fill-color:#ffffff;text-shadow:0 0 9px rgba(255,255,255,.5),0 0 22px rgba(0,220,255,.44);filter:brightness(1.04);}}',
      '#loading .loading-bar{display:none!important;visibility:hidden!important;opacity:0!important;animation:none!important;}',
      '#loading .alien-head,#loading img.alien-head{position:absolute!important;left:' + IMAGE_X + '!important;top:50%!important;margin:0!important;width:min(1770px,225vw)!important;height:min(996px,126vw)!important;max-width:none!important;max-height:92vh!important;opacity:1!important;transition:none!important;transform:translate(-50%,-50%)!important;will-change:opacity,filter!important;}',
      '.startup-title::before,.brand-title::before{content:none!important;display:none!important;animation:none!important;}',
      '.startup-title,.brand-title{background:none!important;background-image:none!important;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;text-shadow:none!important;animation:none!important;white-space:nowrap!important;}',
      '.startup-title{position:absolute!important;top:28px!important;left:50%!important;right:auto!important;bottom:auto!important;display:block!important;transform:translateX(-50%)!important;margin:0!important;z-index:2!important;}',
      '.brand-title{position:relative!important;display:inline-block!important;contain:paint!important;}',
      '.startup-title::after,.brand-title::after{content:""!important;display:block!important;position:absolute!important;left:0!important;right:0!important;bottom:-12px!important;transform:none!important;width:100%!important;height:3px!important;border-radius:999px!important;background:linear-gradient(90deg,rgba(0,255,221,0),rgba(0,220,255,.9) 16%,rgba(0,132,255,1) 50%,rgba(0,255,221,.88) 84%,rgba(0,255,221,0))!important;box-shadow:0 0 14px rgba(0,220,255,.78),0 0 30px rgba(0,132,255,.45)!important;pointer-events:none!important;}',
      '.brand-title::after{bottom:-8px!important;height:2px!important;box-shadow:0 0 10px rgba(0,220,255,.55)!important;}',
      '.uap-logo-letter{display:inline-block!important;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;animation:none!important;text-shadow:none!important;filter:none!important;}',
      '.startup-title .uap-logo-letter{animation:uapLetterScanOnce 3.9s ease-out 1 both!important;animation-delay:calc(var(--i) * .12s)!important;}',
      '.brand-title .uap-logo-letter{color:#eafcff!important;-webkit-text-fill-color:#eafcff!important;animation:none!important;filter:none!important;text-shadow:0 0 8px rgba(255,255,255,.42),0 0 18px rgba(0,212,255,.48)!important;}',
      '.uap-logo-space{display:inline-block!important;width:.28em!important;animation:none!important;}',
      '@media(max-width:560px){.startup-title .uap-logo-letter{animation-duration:3.6s!important;animation-delay:calc(var(--i) * .105s)!important}.startup-title{top:28px!important}.startup-title::after{bottom:-10px!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyLogoScanLine, { once: true });
  else applyLogoScanLine();
  window.addEventListener('load', applyLogoScanLine);
  setTimeout(applyLogoScanLine, 250);
})();
