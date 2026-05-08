(function(){
  'use strict';

  var STYLE_ID = 'uap-notification-direct-fix-style';
  var running = false;
  var feedPromise = null;

  function idsFromUrl(){
    try {
      return (new URLSearchParams(location.search).get('ids') || '')
        .split(',')
        .map(function(id){ return id.trim(); })
        .filter(Boolean);
    } catch(e) { return []; }
  }

  var notificationIds = idsFromUrl();
  if (!notificationIds.length) return;

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.uap-notification-empty{margin:12px 0;padding:12px;border:1px solid rgba(0,212,255,.32);background:rgba(0,212,255,.06);color:#a9cbd7;font-family:"Share Tech Mono",monospace;font-size:11px;line-height:1.5}',
      '.uap-notification-rendered .summary{display:none!important}',
      '.uap-notification-rendered.uap-detail-open .summary{display:block!important}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function loadFeed(){
    if (!feedPromise) {
      feedPromise = fetch('latest-news.json?notifDirect=' + Date.now(), { cache: 'no-store' })
        .then(function(r){ return r.json(); })
        .catch(function(){ return { articles: [], notificationBatch: { articles: [] } }; });
    }
    return feedPromise;
  }

  function slug(title){
    return String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function titleOf(card){
    var h2 = card && card.querySelector('h2');
    return h2 ? h2.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  function cardId(card){
    if (!card) return '';
    if (card.dataset && card.dataset.uapId) return card.dataset.uapId;
    var summary = card.querySelector('.summary[id]');
    if (summary && summary.id) return summary.id.replace(/^summary-/, '');
    return slug(titleOf(card));
  }

  function findArticle(feed, id){
    var articles = feed && feed.articles || [];
    for (var i = 0; i < articles.length; i++) if (articles[i].id === id) return articles[i];
    for (var j = 0; j < articles.length; j++) if (slug(articles[j].title) === id) return articles[j];
    var batch = feed && feed.notificationBatch && feed.notificationBatch.articles || [];
    for (var k = 0; k < batch.length; k++) if (batch[k].id === id) return batch[k];
    return null;
  }

  function normalizeExistingCards(feed){
    var articles = feed && feed.articles || [];
    document.querySelectorAll('.article-card').forEach(function(card){
      var title = titleOf(card).toLowerCase();
      for (var i = 0; i < articles.length; i++) {
        if ((articles[i].title || '').toLowerCase() === title) {
          card.dataset.uapId = articles[i].id;
          break;
        }
      }
    });
  }

  function sourceLinks(article){
    var sources = [];
    if (article.link) sources.push({ source: article.source || 'Quelle', link: article.link, title: article.title || '' });
    (article.otherSources || []).forEach(function(s){ if (s && s.link) sources.push(s); });
    if (!sources.length) return '';
    return '<div class="source-list">' + sources.map(function(s){
      var label = (s.source || s.title || 'Quelle').replace(/</g, '&lt;');
      return '<a href="' + String(s.link || '#') + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
    }).join('') + '</div>';
  }

  function renderArticle(article){
    var card = document.createElement('article');
    card.className = 'article-card unread uap-notification-rendered';
    card.dataset.uapId = article.id || slug(article.title);
    card.innerHTML =
      '<div class="article-main">' +
        '<div class="article-topline">' +
          '<span class="article-date-prominent">' + (article.date || '') + '</span>' +
          '<div class="badges">' +
            '<span class="badge sources">' + (article.mentions || 1) + ' Quelle' + ((article.mentions || 1) > 1 ? 'n' : '') + '</span>' +
            '<span class="badge quality" role="button" tabindex="0">Wertung ' + (article.quality || 0) + '</span>' +
          '</div>' +
        '</div>' +
        '<h2>' + String(article.title || 'UAP News').replace(/</g, '&lt;') + '</h2>' +
        '<div class="summary">' + String(article.summary || '').replace(/</g, '&lt;') + '</div>' +
        sourceLinks(article) +
      '</div>';
    return card;
  }

  function apply(){
    if (running) return;
    running = true;
    injectStyle();
    loadFeed().then(function(feed){
      normalizeExistingCards(feed);
      var feedEl = document.getElementById('feed');
      if (!feedEl) return;
      feedEl.querySelectorAll(':scope > .old-toggle, :scope > .old-list').forEach(function(el){ el.remove(); });
      var matched = [];
      var existing = Array.prototype.slice.call(document.querySelectorAll('.article-card'));
      notificationIds.forEach(function(id){
        var card = existing.find(function(c){ return cardId(c) === id; });
        if (card) {
          card.classList.remove('uap-hidden-by-notification');
          matched.push(card);
          return;
        }
        var article = findArticle(feed, id);
        if (article) {
          card = renderArticle(article);
          matched.push(card);
        }
      });
      existing.forEach(function(card){
        if (matched.indexOf(card) === -1) card.classList.add('uap-hidden-by-notification');
      });
      matched.forEach(function(card){ feedEl.appendChild(card); });
      var focus = document.querySelector('.notification-focus');
      if (focus) focus.textContent = 'Aus Push-Benachrichtigung geöffnet: ' + matched.length + ' gemeldete Meldung' + (matched.length === 1 ? '' : 'en') + '.';
      if (!matched.length && !document.querySelector('.uap-notification-empty')) {
        var empty = document.createElement('div');
        empty.className = 'uap-notification-empty';
        empty.textContent = 'Die Push-Meldung konnte keinem gespeicherten Artikel mehr zugeordnet werden. Bitte die aktuelle Artikelliste öffnen.';
        feedEl.parentNode.insertBefore(empty, feedEl);
      }
    }).finally(function(){ running = false; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
  new MutationObserver(function(){ setTimeout(apply, 0); }).observe(document.documentElement, { childList: true, subtree: true });
})();
