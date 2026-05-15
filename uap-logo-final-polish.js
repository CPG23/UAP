(function(){
  'use strict';

  if (window.__uapLogoFinalPolish) return;
  window.__uapLogoFinalPolish = true;

  var STYLE_ID = 'uap-logo-final-polish-style';

  function logoMarkup(){
    return [
      '<span class="uap-edge-letter" data-ch="U">U</span>',
      '<span class="uap-edge-letter" data-ch="A">A</span>',
      '<span class="uap-edge-letter" data-ch="P">P</span>',
      '<span class="uap-edge-space" aria-hidden="true"></span>',
      '<span class="uap-edge-letter" data-ch="N">N</span>',
      '<span class="uap-edge-letter" data-ch="e">e</span>',
      '<span class="uap-edge-letter" data-ch="w">w</span>',
      '<span class="uap-edge-letter uap-news-s" data-ch="s">s</span>'
    ].join('');
  }

  function injectStyle(){
    var old = document.getElementById(STYLE_ID);
    if (old) old.remove();
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '@keyframes uapLogoEdgeRun{0%,100%{opacity:.18;filter:drop-shadow(0 0 2px rgba(0,255,221,.2));}18%{opacity:.95;filter:drop-shadow(0 0 10px rgba(0,255,221,.85)) drop-shadow(0 0 22px rgba(0,132,255,.48));}36%{opacity:.24;filter:drop-shadow(0 0 4px rgba(0,212,255,.32));}}',
      '@keyframes uapLogoBreath{0%,100%{text-shadow:0 1px 0 rgba(255,255,255,.58),0 0 15px rgba(255,255,255,.56),0 0 34px rgba(0,212,255,.48),0 0 70px rgba(0,132,255,.25);}50%{text-shadow:0 1px 0 rgba(255,255,255,.82),0 0 22px rgba(255,255,255,.82),0 0 48px rgba(0,255,221,.78),0 0 96px rgba(0,132,255,.45);}}',
      '@keyframes uapNewsTailLive{0%,100%{opacity:.9;filter:blur(.26px) drop-shadow(0 0 10px rgba(0,212,255,.5));}50%{opacity:1;filter:blur(.26px) drop-shadow(0 0 20px rgba(0,255,221,.9)) drop-shadow(0 0 38px rgba(0,132,255,.42));}}',
      '.startup-title.uap-logo-final,.brand-title.uap-logo-final{display:inline-block!important;position:relative!important;isolation:isolate!important;overflow:visible!important;font-family:"Rajdhani","Exo 2",system-ui,sans-serif!important;font-weight:800!important;letter-spacing:.035em!important;text-transform:none!important;white-space:nowrap!important;color:#fbfeff!important;-webkit-text-fill-color:#fbfeff!important;text-shadow:none!important;background:none!important;}',
      '#loading .startup-title.uap-logo-final{top:28px!important;left:50%!important;right:auto!important;bottom:auto!important;transform:translateX(-50%)!important;margin:0!important;font-size:clamp(72px,18vw,120px)!important;line-height:.82!important;}',
      '.brand-title.uap-logo-final{line-height:.82!important;}',
      '.startup-title.uap-logo-final::after,.brand-title.uap-logo-final::after{display:none!important;content:none!important;}',
      '.uap-logo-final .uap-edge-space{display:inline-block!important;width:.24em!important;}',
      '.uap-logo-final .uap-edge-letter{position:relative!important;display:inline-block!important;color:#fbfeff!important;-webkit-text-fill-color:#fbfeff!important;-webkit-text-stroke:1px rgba(210,255,255,.34)!important;background:none!important;text-shadow:0 1px 0 rgba(255,255,255,.58),0 0 15px rgba(255,255,255,.56),0 0 34px rgba(0,212,255,.48),0 0 70px rgba(0,132,255,.25)!important;animation:uapLogoBreath 5.6s ease-in-out infinite!important;z-index:2!important;}',
      '.uap-logo-final .uap-edge-letter::before{content:attr(data-ch)!important;position:absolute!important;inset:0!important;color:transparent!important;-webkit-text-fill-color:transparent!important;-webkit-text-stroke:2px rgba(155,255,247,.88)!important;text-shadow:none!important;opacity:.18!important;pointer-events:none!important;animation:uapLogoEdgeRun 5.2s linear infinite!important;}',
      '.uap-logo-final .uap-edge-letter:nth-child(1)::before{animation-delay:0s!important}.uap-logo-final .uap-edge-letter:nth-child(2)::before{animation-delay:.18s!important}.uap-logo-final .uap-edge-letter:nth-child(3)::before{animation-delay:.36s!important}.uap-logo-final .uap-edge-letter:nth-child(5)::before{animation-delay:.72s!important}.uap-logo-final .uap-edge-letter:nth-child(6)::before{animation-delay:.9s!important}.uap-logo-final .uap-edge-letter:nth-child(7)::before{animation-delay:1.08s!important}.uap-logo-final .uap-edge-letter:nth-child(8)::before{animation-delay:1.26s!important}',
      '.uap-logo-final .uap-news-s{transform:translateY(.34em) scaleY(1.38)!important;transform-origin:50% 100%!important;margin-left:.01em!important;margin-bottom:-.29em!important;z-index:3!important;}',
      '.uap-logo-final .uap-news-s::after{content:""!important;position:absolute!important;right:.46em!important;bottom:.015em!important;width:5.03em!important;height:.34em!important;border-radius:.17em!important;background:linear-gradient(90deg,rgba(0,255,221,0),rgba(0,212,255,.72) 7%,rgba(218,255,255,1) 68%,rgba(255,255,255,1))!important;filter:blur(.24px) drop-shadow(0 0 10px rgba(0,212,255,.5))!important;animation:uapNewsTailLive 4.8s ease-in-out infinite!important;pointer-events:none!important;z-index:-1!important;}',
      '.brand-title.uap-logo-final .uap-edge-letter{-webkit-text-stroke:.75px rgba(210,255,255,.32)!important;text-shadow:0 1px 0 rgba(255,255,255,.48),0 0 9px rgba(255,255,255,.38),0 0 22px rgba(0,212,255,.4),0 0 42px rgba(0,132,255,.18)!important;}',
      '.brand-title.uap-logo-final .uap-edge-letter::before{-webkit-text-stroke:1.35px rgba(155,255,247,.74)!important;}',
      '.brand-title.uap-logo-final .uap-news-s{transform:translateY(.28em) scaleY(1.3)!important;margin-bottom:-.23em!important;}',
      '.brand-title.uap-logo-final .uap-news-s::after{height:.25em!important;bottom:.01em!important;border-radius:.125em!important;filter:blur(.18px) drop-shadow(0 0 8px rgba(0,212,255,.42))!important;}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function applyLogo(el){
    if (!el) return;
    el.classList.add('uap-logo-final');
    if (!el.querySelector('.uap-news-s')) el.innerHTML = logoMarkup();
    Array.prototype.slice.call(el.querySelectorAll('.uap-edge-letter')).forEach(function(letter){
      if (!letter.getAttribute('data-ch')) letter.setAttribute('data-ch', letter.textContent || '');
    });
    el.setAttribute('aria-label', 'UAP News');
  }

  function apply(){
    injectStyle();
    applyLogo(document.querySelector('#loading .startup-title'));
    applyLogo(document.querySelector('.brand-title'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();
  window.addEventListener('load', apply);
  setTimeout(apply, 50);
  setTimeout(apply, 250);
  setTimeout(apply, 900);

  new MutationObserver(function(){ requestAnimationFrame(apply); })
    .observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
