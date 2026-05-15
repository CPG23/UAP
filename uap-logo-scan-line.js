(function(){
  'use strict';
  var STYLE_ID = 'uap-logo-scan-line-style';

  function applyLogoScanLine(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '@keyframes uapLogoTextScan{0%,100%{background-position:0% 50%;filter:drop-shadow(0 0 9px rgba(255,255,255,.45)) drop-shadow(0 0 22px rgba(0,212,255,.55));}48%{background-position:100% 50%;filter:drop-shadow(0 0 14px rgba(255,255,255,.72)) drop-shadow(0 0 34px rgba(0,212,255,.9)) drop-shadow(0 0 48px rgba(0,255,157,.32));}}',
      '@keyframes uapLogoTextBreathe{0%,100%{opacity:.92;}50%{opacity:1;}}',
      '#loading .loading-bar{display:none!important;visibility:hidden!important;opacity:0!important;animation:none!important;}',
      '#loading .alien-head,#loading img.alien-head{position:absolute!important;left:calc(50% - 32vw)!important;top:50%!important;margin:0!important;width:min(1770px,225vw)!important;height:min(996px,126vw)!important;max-width:none!important;max-height:92vh!important;animation:none!important;transition:none!important;transform:translate(-50%,-50%)!important;will-change:auto!important;}',
      '.startup-title::before,.startup-title::after,.brand-title::before,.brand-title::after{content:none!important;display:none!important;animation:none!important;}',
      '.startup-title,.brand-title{background:linear-gradient(105deg,#ffffff 0%,#eaffff 30%,#00d4ff 45%,#dffff8 52%,#00ff9d 62%,#ffffff 78%,#ffffff 100%)!important;background-size:260% 100%!important;background-clip:text!important;-webkit-background-clip:text!important;color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;animation:uapLogoTextScan 3.4s ease-in-out infinite,uapLogoTextBreathe 2.4s ease-in-out infinite!important;}',
      '.startup-title span,.brand-title span{color:inherit!important;-webkit-text-fill-color:inherit!important;text-shadow:none!important;}',
      '@media(max-width:560px){.startup-title,.brand-title{background-size:300% 100%!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyLogoScanLine, { once: true });
  else applyLogoScanLine();
  window.addEventListener('load', applyLogoScanLine);
})();
