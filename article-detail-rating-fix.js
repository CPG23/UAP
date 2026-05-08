(function(){
  'use strict';

  var STYLE_ID = 'uap-article-detail-rating-fix-style';

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.article-card:not(.uap-detail-open) .summary{display:none!important}',
      '.article-card.uap-detail-open .summary{display:block!important}',
      '.article-card{cursor:pointer}',
      '.article-card .article-main{cursor:pointer}',
      '.quality-sheet:not(.general-quality) .quality-rules{display:flex!important;flex-direction:column!important;gap:7px!important}',
      '.quality-sheet:not(.general-quality) .quality-rule{display:grid!important}',
      '.quality-sheet.general-quality .quality-points{display:inline-block!important}',
      '.quality-sheet.general-quality .quality-rule{display:grid!important}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function articleCardFrom(target){
    return target && target.closest && target.closest('.article-card');
  }

  function isInteractive(target){
    return !!(target && target.closest && target.closest('button,a,input,select,textarea,.badge.quality,.quality-overlay,.sources,.source-list,.translate-btn'));
  }

  function setOpen(card, open){
    if (!card) return;
    card.classList.toggle('uap-detail-open', !!open);
  }

  function toggleCard(card){
    setOpen(card, !card.classList.contains('uap-detail-open'));
  }

  function parsePoints(row){
    var text = row.querySelector('.quality-points');
    var match = text && text.textContent.match(/[-+]?\d+/);
    return match ? Number(match[0]) : 0;
  }

  function isBasis(row){
    var strong = row.querySelector('strong');
    return /\bBasis\b/i.test(strong ? strong.textContent : row.textContent || '');
  }

  function sortArticleQuality(sheet){
    if (!sheet || sheet.classList.contains('general-quality')) return;
    var rules = sheet.querySelector('.quality-rules');
    if (!rules) return;
    var rows = Array.prototype.slice.call(rules.querySelectorAll('.quality-rule'));
    rows.sort(function(a,b){
      if (isBasis(a) && !isBasis(b)) return 1;
      if (!isBasis(a) && isBasis(b)) return -1;
      return parsePoints(a) - parsePoints(b);
    });
    rows.forEach(function(row){ rules.appendChild(row); });
  }

  function apply(){
    injectStyle();
    document.querySelectorAll('.quality-sheet').forEach(sortArticleQuality);
  }

  window.addEventListener('click', function(e){
    var card = articleCardFrom(e.target);
    if (!card || isInteractive(e.target)) return;
    toggleCard(card);
  }, true);

  window.addEventListener('click', function(e){
    if (!(e.target && e.target.closest && e.target.closest('.quality-top-help'))) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }, false);

  document.addEventListener('keydown', function(e){
    var card = articleCardFrom(e.target);
    if (!card || isInteractive(e.target)) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleCard(card);
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
  document.addEventListener('click', function(){ setTimeout(apply, 0); }, true);
  new MutationObserver(function(){ setTimeout(apply, 0); }).observe(document.documentElement, { childList: true, subtree: true });
})();
