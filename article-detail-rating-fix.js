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
      '.article-card .summary:not(.uap-detail-summary){display:none!important}',
      '.article-card .uap-detail-summary{display:none!important;margin-top:12px!important;color:#b7ccd5!important;line-height:1.55!important;font-size:14px!important}',
      '.article-card.uap-detail-open .uap-detail-summary{display:block!important}',
      '.article-card{cursor:pointer}',
      '.article-card .article-main{cursor:pointer}',
      '.article-card h2{font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif!important;font-weight:400!important;letter-spacing:0!important;text-transform:none!important}',
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

  function slug(title){
    return String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function idOf(card){
    if (!card) return '';
    if (card.dataset && card.dataset.uapId) return card.dataset.uapId;
    var summary = card.querySelector('.summary[id]');
    if (summary && summary.id) return summary.id.replace(/^summary-/, '');
    return slug(titleOf(card));
  }

  function findArticle(feed, card){
    var id = idOf(card);
    var title = titleOf(card).toLowerCase();
    var articles = feed && feed.articles || [];
    for (var i = 0; i < articles.length; i++) if (id && articles[i].id === id) return articles[i];
    for (var j = 0; j < articles.length; j++) if ((articles[j].title || '').toLowerCase() === title) return articles[j];
    for (var k = 0; k < articles.length; k++) if (slug(articles[k].title) === id) return articles[k];
    return null;
  }

  function existingSummaryText(card){
    var summary = card && card.querySelector('.summary:not(.uap-detail-summary)');
    return summary ? summary.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  function setSummaryText(summary, text){
    if (!summary || !text) return;
    summary.textContent = text;
  }

  function ensureSummary(card){
    if (!card) return Promise.resolve(null);
    var main = card.querySelector('.article-main') || card;
    var detail = card.querySelector('.uap-detail-summary');
    if (!detail) {
      detail = document.createElement('div');
      detail.className = 'uap-detail-summary';
      detail.setAttribute('data-uap-detail-summary', 'true');
      var sources = main.querySelector('.source-list');
      if (sources) main.insertBefore(detail, sources);
      else main.appendChild(detail);
    }
    var current = detail.textContent.replace(/\s+/g, ' ').trim();
    if (current) return Promise.resolve(detail);
    var fallback = existingSummaryText(card);
    if (fallback) {
      setSummaryText(detail, fallback);
      return Promise.resolve(detail);
    }
    return loadFeed().then(function(feed){
      var article = findArticle(feed, card);
      if (article && article.summary) setSummaryText(detail, article.summary);
      return detail;
    });
  }

  function articleCardFrom(target){
    return target && target.closest && target.closest('.article-card');
  }

  function isInteractive(target){
    return !!(target && target.closest && target.closest('button,a,input,select,textarea,.badge.quality,.quality-overlay,.sources,.source-list,.translate-btn'));
  }

  function keepOpenCardsVisible(){
    var feed = document.getElementById('feed');
    if (!feed) return;
    document.querySelectorAll('.old-list .article-card.uap-detail-open').forEach(function(card){
      var toggle = feed.querySelector('.old-toggle');
      if (toggle && toggle.parentNode === feed) feed.insertBefore(card, toggle);
      else feed.appendChild(card);
    });
    document.querySelectorAll('.article-card.uap-detail-open .uap-detail-summary').forEach(function(summary){
      summary.style.display = 'block';
    });
  }

  function setOpen(card, open){
    if (!card) return;
    card.classList.toggle('uap-detail-open', !!open);
    if (open) {
      keepOpenCardsVisible();
      ensureSummary(card).then(function(summary){
        card.querySelectorAll('.summary:not(.uap-detail-summary)').forEach(function(oldSummary){ oldSummary.style.display = 'none'; });
        if (summary) summary.style.display = 'block';
        keepOpenCardsVisible();
      });
    } else {
      card.querySelectorAll('.uap-detail-summary').forEach(function(summary){ summary.style.display = 'none'; });
      card.querySelectorAll('.summary:not(.uap-detail-summary)').forEach(function(summary){ summary.style.display = 'none'; });
    }
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
    var cards = Array.prototype.slice.call(container.querySelectorAll(':scope > .article-card:not(.uap-detail-open)'));
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
    keepOpenCardsVisible();
  }

  function apply(){
    injectStyle();
    document.querySelectorAll('.article-card .summary:not(.uap-detail-summary)').forEach(function(summary){
      summary.style.display = 'none';
    });
    document.querySelectorAll('.article-card:not(.uap-detail-open) .uap-detail-summary').forEach(function(summary){
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
