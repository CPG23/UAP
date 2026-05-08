(function(){
  'use strict';

  var STYLE_ID = 'uap-article-detail-rating-fix-style';
  var sorting = false;
  var feedPromise = null;

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.article-card:not(.uap-detail-open) .summary{display:none!important}',
      '.article-card.uap-detail-open .summary{display:block!important;margin-top:12px!important}',
      '.article-card{cursor:pointer}',
      '.article-card .article-main{cursor:pointer}',
      '.article-card h2{font-weight:400!important}',
      '.article-card strong{font-weight:500!important}',
      '.quality-sheet:not(.general-quality) .quality-rules{display:flex!important;flex-direction:column!important;gap:7px!important}',
      '.quality-sheet:not(.general-quality) .quality-rule{display:grid!important}',
      '.quality-sheet.general-quality .quality-points{display:inline-block!important}',
      '.quality-sheet.general-quality .quality-rule{display:grid!important}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function loadFeed(){
    if (!feedPromise) {
      feedPromise = fetch('latest-news.json?detail=' + Date.now(), { cache: 'no-store' })
        .then(function(r){ return r.json(); })
        .catch(function(){ return { articles: [] }; });
    }
    return feedPromise;
  }

  function titleOf(card){
    var title = card && card.querySelector('h2');
    return title ? title.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  function idOf(card){
    if (!card) return '';
    if (card.dataset && card.dataset.uapId) return card.dataset.uapId;
    var summary = card.querySelector('.summary[id]');
    if (summary && summary.id) return summary.id.replace(/^summary-/, '');
    return '';
  }

  function findArticle(feed, card){
    var id = idOf(card);
    var title = titleOf(card).toLowerCase();
    var articles = feed && feed.articles || [];
    for (var i = 0; i < articles.length; i++) if (id && articles[i].id === id) return articles[i];
    for (var j = 0; j < articles.length; j++) if ((articles[j].title || '').toLowerCase() === title) return articles[j];
    return null;
  }

  function ensureSummary(card){
    var summary = card && card.querySelector('.summary');
    if (summary && summary.textContent.trim()) return Promise.resolve(summary);
    return loadFeed().then(function(feed){
      var article = findArticle(feed, card);
      if (!article || !article.summary) return summary || null;
      var main = card.querySelector('.article-main') || card;
      if (!summary) {
        summary = document.createElement('div');
        summary.className = 'summary';
        main.appendChild(summary);
      }
      summary.textContent = article.summary;
      return summary;
    });
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
    if (open) ensureSummary(card).then(function(){
      card.querySelectorAll('.summary').forEach(function(summary){ summary.style.display = 'block'; });
    });
    else card.querySelectorAll('.summary').forEach(function(summary){ summary.style.display = 'none'; });
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

  function cardQuality(card){
    var badge = card && card.querySelector('.badge.quality');
    var match = badge && badge.textContent.match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  function sortCardsIn(container){
    if (!container || sorting) return;
    var cards = Array.prototype.slice.call(container.querySelectorAll(':scope > .article-card'));
    if (cards.length < 2) return;
    sorting = true;
    try {
      cards.sort(function(a,b){ return cardQuality(b) - cardQuality(a); });
      cards.forEach(function(card){ container.appendChild(card); });
    } finally {
      sorting = false;
    }
  }

  function sortVisibleFeeds(){
    sortCardsIn(document.getElementById('feed'));
    document.querySelectorAll('.old-list').forEach(sortCardsIn);
  }

  function apply(){
    injectStyle();
    document.querySelectorAll('.article-card:not(.uap-detail-open) .summary').forEach(function(summary){
      summary.style.display = 'none';
    });
    document.querySelectorAll('.quality-sheet').forEach(sortArticleQuality);
    sortVisibleFeeds();
  }

  window.addEventListener('click', function(e){
    var card = articleCardFrom(e.target);
    if (!card || isInteractive(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
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
      e.stopPropagation();
      e.stopImmediatePropagation();
      toggleCard(card);
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
  document.addEventListener('click', function(){ setTimeout(apply, 0); }, true);
  new MutationObserver(function(){ setTimeout(apply, 0); }).observe(document.documentElement, { childList: true, subtree: true });
})();
