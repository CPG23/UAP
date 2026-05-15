(function(){
  'use strict';

  if (window.__uapUiPolishLayer) return;
  window.__uapUiPolishLayer = true;

  var STYLE_ID = 'uap-ui-polish-style';

  function logoMarkup(){
    return [
      '<span class="uap-edge-letter">U</span>',
      '<span class="uap-edge-letter">A</span>',
      '<span class="uap-edge-letter">P</span>',
      '<span class="uap-edge-space" aria-hidden="true"></span>',
      '<span class="uap-edge-letter">N</span>',
      '<span class="uap-edge-letter">e</span>',
      '<span class="uap-edge-letter">w</span>',
      '<span class="uap-edge-letter uap-news-s">s</span>'
    ].join('');
  }

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '@keyframes uapLogoEdgeGlow{0%,100%{color:#fbfeff;-webkit-text-fill-color:#fbfeff;-webkit-text-stroke:.65px rgba(190,255,255,.26);text-shadow:0 1px 0 rgba(255,255,255,.58),0 0 12px rgba(255,255,255,.58),0 0 28px rgba(0,212,255,.52),0 0 58px rgba(0,132,255,.28);filter:drop-shadow(0 0 2px rgba(0,255,221,.22));}42%{color:#fff;-webkit-text-fill-color:#fff;-webkit-text-stroke:.65px rgba(218,255,255,.56);text-shadow:0 1px 0 rgba(255,255,255,.85),0 0 18px rgba(255,255,255,.92),0 0 42px rgba(0,255,221,.92),0 0 78px rgba(0,132,255,.62);filter:drop-shadow(0 0 8px rgba(0,255,221,.72));}}',
      '@keyframes uapLogoTailGlow{0%,100%{opacity:.52;box-shadow:0 0 8px rgba(0,212,255,.34),0 0 18px rgba(0,255,221,.16);}50%{opacity:1;box-shadow:0 0 16px rgba(0,255,221,.78),0 0 34px rgba(0,132,255,.38);}}',
      '.brand-title::after{display:none!important;content:none!important}',
      '.brand-title.uap-brand-logo{display:inline-block!important;position:relative!important;isolation:isolate!important;overflow:visible!important;line-height:.82!important;letter-spacing:.035em!important;text-transform:none!important;text-shadow:none!important;color:#fbfeff!important;-webkit-text-fill-color:#fbfeff!important}',
      '.brand-title.uap-brand-logo .uap-edge-letter{position:relative!important;display:inline-block!important;color:#fbfeff!important;-webkit-text-fill-color:#fbfeff!important;-webkit-text-stroke:.65px rgba(190,255,255,.26)!important;background:none!important;text-shadow:0 1px 0 rgba(255,255,255,.58),0 0 12px rgba(255,255,255,.58),0 0 28px rgba(0,212,255,.52),0 0 58px rgba(0,132,255,.28)!important;animation:uapLogoEdgeGlow 3.8s ease-in-out infinite!important;will-change:filter,text-shadow!important;z-index:2!important}',
      '.brand-title.uap-brand-logo .uap-edge-space{display:inline-block!important;width:.24em!important}',
      '.brand-title.uap-brand-logo .uap-edge-letter:nth-child(1){animation-delay:0s!important}.brand-title.uap-brand-logo .uap-edge-letter:nth-child(2){animation-delay:.14s!important}.brand-title.uap-brand-logo .uap-edge-letter:nth-child(3){animation-delay:.28s!important}.brand-title.uap-brand-logo .uap-edge-letter:nth-child(5){animation-delay:.48s!important}.brand-title.uap-brand-logo .uap-edge-letter:nth-child(6){animation-delay:.62s!important}.brand-title.uap-brand-logo .uap-edge-letter:nth-child(7){animation-delay:.76s!important}.brand-title.uap-brand-logo .uap-edge-letter:nth-child(8){animation-delay:.9s!important}',
      '.brand-title.uap-brand-logo .uap-news-s{transform:scaleY(1.14)!important;transform-origin:50% 92%!important;margin-bottom:-.045em!important;z-index:3!important}',
      '.brand-title.uap-brand-logo .uap-news-s::after{content:""!important;position:absolute!important;right:.43em!important;bottom:.055em!important;width:4.95em!important;height:.105em!important;border-radius:.055em!important;background:linear-gradient(90deg,rgba(0,255,221,0),rgba(0,212,255,.45) 10%,rgba(218,255,255,.76) 68%,rgba(255,255,255,.72))!important;filter:blur(.28px)!important;animation:uapLogoTailGlow 3.8s ease-in-out infinite!important;pointer-events:none!important;z-index:-1!important}',
      'main{padding-top:16px!important}',
      '#uap-new-filter-bar{margin:0 0 14px!important;padding:8px 0 12px!important;border-bottom:1px solid rgba(61,98,119,.42)!important}',
      '#uap-new-filter-toggle{border-radius:7px!important;border-color:rgba(0,212,255,.34)!important;background:linear-gradient(180deg,rgba(0,212,255,.085),rgba(0,212,255,.035))!important;color:#d7f6ff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)!important}',
      '#uap-new-filter-toggle.active{border-color:rgba(0,255,157,.8)!important;background:linear-gradient(180deg,rgba(0,255,157,.18),rgba(0,212,255,.06))!important;color:#f1fff7!important}',
      '#uap-new-filter-empty{border-radius:8px!important;padding:14px 14px!important;border:1px solid rgba(0,212,255,.25)!important;background:linear-gradient(180deg,rgba(8,20,32,.82),rgba(3,10,15,.92))!important;color:#bad2dc!important;box-shadow:0 10px 28px rgba(0,0,0,.18)!important}',
      '#feed{gap:14px!important}',
      '.article-card{border-radius:8px!important;border-color:rgba(44,79,100,.82)!important;background:linear-gradient(180deg,rgba(10,24,36,.96),rgba(4,13,21,.985))!important;box-shadow:0 10px 26px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.035)!important;transition:border-color .18s ease,box-shadow .18s ease,background .18s ease!important}',
      '.article-card::before{width:3px!important;opacity:.66!important;background:linear-gradient(180deg,#00d4ff,#00ff9d)!important}',
      '.article-card.uap-detail-open{border-color:rgba(0,212,255,.62)!important;box-shadow:0 14px 34px rgba(0,0,0,.28),0 0 0 1px rgba(0,212,255,.16)!important}',
      '.article-card.uap-is-new{border-color:rgba(0,255,157,.9)!important;box-shadow:0 12px 30px rgba(0,0,0,.24),0 0 0 1px rgba(0,255,157,.34),0 0 24px rgba(0,255,157,.16)!important}',
      '.article-main{padding:15px 15px 13px 18px!important}',
      '.article-card h2{margin:0 0 9px!important;color:#f0fbff!important;font-size:clamp(16px,4.3vw,19px)!important;line-height:1.26!important;font-weight:720!important}',
      '.article-card .meta{color:#82a5b4!important;font-size:12px!important;line-height:1.35!important}',
      '.article-topline{margin-bottom:10px!important;align-items:center!important}',
      '.article-date-prominent,.badge{border-radius:6px!important}',
      '.article-date-prominent{min-height:25px!important;padding:4px 8px!important;border-color:rgba(0,212,255,.28)!important;background:rgba(0,212,255,.065)!important;color:#cceef8!important}',
      '.article-date-prominent::before{color:#68dff4!important}',
      '.badge.sources{min-height:25px!important;border-color:rgba(118,151,166,.34)!important;background:rgba(154,190,205,.055)!important;color:#c1d3dc!important}',
      '.badge.uap-new-badge{min-height:25px!important;color:#062015!important;background:#00ff9d!important;border-color:#89ffd0!important;box-shadow:0 0 16px rgba(0,255,157,.34)!important;font-weight:700!important}',
      '.badge.quality{--score:0;min-width:92px!important;min-height:25px!important;padding:4px 8px 4px 9px!important;border-color:rgba(0,212,255,.34)!important;background:linear-gradient(180deg,rgba(0,212,255,.09),rgba(0,255,157,.055))!important;color:#e5fbff!important;box-shadow:inset 0 -2px 0 rgba(0,0,0,.18)!important}',
      '.badge.quality::before{content:"";position:absolute;left:7px;right:22px;bottom:3px;height:2px;border-radius:999px;background:linear-gradient(90deg,#00ff9d,#00d4ff);transform-origin:left center;transform:scaleX(calc(var(--score) / 100));opacity:.9;box-shadow:0 0 9px rgba(0,212,255,.55)}',
      '.badge.quality::after{border-color:rgba(0,212,255,.5)!important;background:rgba(0,212,255,.08)!important;color:#8ff2ff!important}',
      '.uap-detail-summary{margin:0 16px 0 18px!important;padding:0 0 14px!important;color:#c4d8e0!important;font-size:14.5px!important;line-height:1.58!important}',
      '.details{padding:14px 16px 16px 18px!important;border-top-color:rgba(61,98,119,.48)!important;background:linear-gradient(180deg,rgba(0,212,255,.035),rgba(3,10,15,.58))!important}',
      '.translate-btn{border-radius:7px!important;padding:0 12px!important;background:linear-gradient(180deg,rgba(0,212,255,.1),rgba(0,212,255,.045))!important;color:#aef4ff!important}',
      '.sources-title{color:#8dffd2!important;margin-bottom:10px!important}',
      '.source-list{gap:9px!important}',
      '.source-link{border-radius:7px!important;border-color:rgba(61,98,119,.58)!important;background:rgba(7,21,31,.7)!important;padding:10px 11px!important}',
      '.source-link:active{background:rgba(0,212,255,.08)!important}',
      '.source-name{color:#7defff!important}',
      '.source-headline{color:#c0d2da!important}',
      '.quality-top-help{border-radius:7px!important;margin-bottom:13px!important;background:linear-gradient(180deg,rgba(0,255,157,.09),rgba(0,212,255,.035))!important;color:#dafdec!important}',
      '.quality-sheet,.notify-guide-sheet{border-radius:8px!important;border-color:rgba(0,212,255,.42)!important;box-shadow:0 18px 48px rgba(0,0,0,.42),0 0 34px rgba(0,212,255,.2)!important}',
      '.quality-close,.notify-guide-btn{border-radius:7px!important}',
      '@media(max-width:420px){.article-main{padding:14px 12px 12px 16px!important}.article-card h2{font-size:16px!important}.article-date-prominent{font-size:9px!important}.article-date-prominent::before{font-size:8px!important}.badge.quality{min-width:84px!important}.badge.sources{max-width:96px!important;white-space:nowrap!important}.uap-detail-summary{margin-left:16px!important;margin-right:12px!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function renderBrandLogo(){
    var brand = document.querySelector('.brand-title');
    if (!brand) return;
    if (!brand.classList.contains('uap-brand-logo')) brand.classList.add('uap-brand-logo');
    if (!brand.querySelector('.uap-news-s')) brand.innerHTML = logoMarkup();
    brand.setAttribute('aria-label', 'UAP News');
  }

  function enhanceQualityBadges(root){
    Array.prototype.slice.call((root || document).querySelectorAll('.badge.quality')).forEach(function(badge){
      var text = badge.textContent || '';
      var match = text.match(/(\d+)/);
      var score = match ? Math.max(0, Math.min(100, Number(match[1]) || 0)) : 0;
      badge.style.setProperty('--score', score);
      badge.setAttribute('aria-label', 'Wertung ' + score + ' von 100');
    });
  }

  function apply(){
    injectStyle();
    renderBrandLogo();
    enhanceQualityBadges(document);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();

  new MutationObserver(function(mutations){
    var shouldApply = false;
    mutations.forEach(function(mutation){
      if (mutation.addedNodes && mutation.addedNodes.length) shouldApply = true;
      if (mutation.type === 'characterData') shouldApply = true;
    });
    if (shouldApply) requestAnimationFrame(apply);
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
