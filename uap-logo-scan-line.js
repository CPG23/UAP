(function(){
  'use strict';
  var STYLE_ID = 'uap-logo-scan-line-style';

  function applyLogoScanLine(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '@keyframes uapLogoMistSweep{0%{transform:translateX(-120%) scaleX(.75);opacity:.08;}18%{opacity:.72;}62%{opacity:.68;}100%{transform:translateX(130%) scaleX(1.04);opacity:.05;}}',
      '@keyframes uapLogoMistBreath{0%,100%{opacity:.72;filter:blur(1.8px);box-shadow:0 0 14px rgba(0,212,255,.18),0 0 36px rgba(0,255,157,.09);}50%{opacity:1;filter:blur(2.4px);box-shadow:0 0 24px rgba(0,212,255,.42),0 0 56px rgba(0,255,157,.20);}}',
      '#loading .loading-bar{display:none!important;visibility:hidden!important;opacity:0!important;animation:none!important;}',
      '#loading .alien-head{animation:none!important;transition:none!important;transform:translateX(-32vw)!important;will-change:auto!important;}',
      '#loading img.alien-head{animation:none!important;transition:none!important;transform:translateX(-32vw)!important;will-change:auto!important;}',
      '.startup-title::after,.brand-title::after{content:""!important;position:absolute!important;left:0!important;right:auto!important;bottom:-9px!important;width:min(340px,76vw)!important;height:8px!important;border:0!important;border-radius:999px!important;background:linear-gradient(90deg,transparent,rgba(0,212,255,.13),rgba(0,255,157,.11),transparent)!important;overflow:visible!important;opacity:1!important;box-shadow:none!important;animation:uapLogoMistBreath 1.9s ease-in-out infinite!important;}',
      '.startup-title::before,.brand-title::before{content:""!important;position:absolute!important;left:0!important;bottom:-20px!important;width:min(340px,76vw)!important;height:30px!important;border-radius:999px!important;background:radial-gradient(ellipse at center,rgba(220,255,248,.88) 0%,rgba(0,212,255,.62) 24%,rgba(0,255,157,.30) 48%,rgba(0,212,255,.10) 68%,transparent 82%)!important;filter:blur(9px)!important;animation:uapLogoMistSweep 1.75s cubic-bezier(.18,.72,.2,1) infinite!important;pointer-events:none!important;}',
      '.brand-title::after{bottom:-8px!important;width:min(220px,48vw)!important;height:7px!important;}',
      '.brand-title::before{bottom:-19px!important;width:min(220px,48vw)!important;height:26px!important;}',
      '@media(max-width:560px){.startup-title::after{bottom:-8px!important;width:min(300px,78vw)!important}.startup-title::before{bottom:-19px!important;width:min(300px,78vw)!important}.brand-title::after{width:min(190px,54vw)!important}.brand-title::before{width:min(190px,54vw)!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyLogoScanLine, { once: true });
  else applyLogoScanLine();
  window.addEventListener('load', applyLogoScanLine);
})();
