(function(){
  'use strict';

  var STYLE_ID = 'uap-latest-polish-style';
  var feedPromise = null;
  var running = false;
  var queued = false;

  function injectStyle(){
    var style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = [
      '#loading .startup-panel,#loading .startup-panel-label,#loading-status{display:none!important}',
      '#loading .startup-panel-wrap{bottom:22px!important;gap:0!important}',
      '.old-list .article-card.uap-seen-overflow{display:none!important}',
      '.article-card .badge.sources{align-items:center!important;justify-content:center!important;text-align:center!important}',
      '.source-list[data-uap-synced="1"]{display:grid!important;gap:8px!important}'
    ].join('\n');
  }

  function removeStartupPanel(){
    document.querySelectorAll('#loading .startup-panel,#loading .startup-panel-label,#loading-status').forEach(function(el){
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  }

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"]/g, function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch];
    });
  }

  function slug(title){
    return String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function cardId(card){
    if (!card) return '';
    if (card.dataset && card.dataset.uapId) return card.dataset.uapId;
    var summary = card.querySelector('.summary[id]');
    if (summary && summary.id) return summary.id.replace(/^summary-/, '');
    var title = card.querySelector('h2');
    return title ? slug(title.textContent) : '';
  }

  function loadFeed(){
    if (!feedPromise) {
      feedPromise = fetch('latest-news.json?polish=' + Date.now(), { cache: 'no-store' })
        .then(function(r){ return r.json(); })
        .catch(function(){ return { articles: [] }; });
    }
    return feedPromise;
  }

  function articleMap(feed){
    var map = {};
    (feed && feed.articles || []).forEach(function(article){
      var id = article.id || slug(article.title);
      if (id) map[id] = article;
    });
    return map;
  }

  function allSources(article){
    var list = [];
    if (article && (article.link || article.url)) {
      list.push({ source: article.source || 'Quelle', link: article.link || article.url, title: article.title || '' });
    }
    (article && (article.otherSources || article._otherSources) || []).forEach(function(s){
      if (s && (s.link || s.url)) list.push({ source: s.source || 'Quelle', link: s.link || s.url, title: s.title || '' });
    });
    var seen = {};
    return list.filter(function(s){
      var key = String(s.link || '').toLowerCase() || (String(s.source || '').toLowerCase() + '|' + String(s.title || '').toLowerCase());
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function sourceHtml(article, sources){
    return sources.map(function(s){
      var title = s.title && s.title !== article.title ? '<div class="source-headline">' + esc(s.title) + '</div>' : '';
      return '<a class="source-link" href="' + esc(s.link) + '" target="_blank" rel="noopener noreferrer"><div class="source-name">' + esc(s.source || 'Quelle') + '</div>' + title + '</a>';
    }).join('');
  }

  function syncSources(feed){
    var map = articleMap(feed);
    document.querySelectorAll('.article-card').forEach(function(card){
      var article = map[cardId(card)];
      if (!article) return;
      var sources = allSources(article);
      var badge = card.querySelector('.badge.sources');
      if (badge) badge.textContent = sources.length + ' Quelle' + (sources.length === 1 ? '' : 'n');
      var list = card.querySelector('.source-list');
      if (list && sources.length) {
        list.innerHTML = sourceHtml(article, sources);
        list.dataset.uapSynced = '1';
      }
      var summary = card.querySelector('.summary:not(.uap-detail-summary)');
      if (summary && article.summary && card.dataset.uapTranslated !== '1') {
        var current = String(summary.textContent || '').trim();
        if (!current || /Keine belastbare Zusammenfassung vorhanden|No reliable summary available|full article text could not/i.test(current)) {
          summary.textContent = article.summary;
        }
      }
    });
  }

  function visibleSeenCards(list){
    return Array.prototype.slice.call(list.querySelectorAll('.article-card:not(.uap-seen-overflow)'));
  }

  function capSeenArticles(){
    var feed = document.getElementById('feed');
    if (!feed) return;
    var list = feed.querySelector(':scope > .old-list');
    var toggle = feed.querySelector(':scope > .old-toggle');
    if (!list) return;
    var cards = Array.prototype.slice.call(list.querySelectorAll('.article-card'));
    cards.forEach(function(card, index){
      card.classList.toggle('uap-seen-overflow', index >= 10);
    });
    if (toggle) {
      var visible = Math.min(cards.length, 10);
      var collapsed = list.classList.contains('collapsed');
      toggle.textContent = (collapsed ? '▸ ' : '▾ ') + 'Bereits gelesen (' + visible + ')';
    }
  }

  function apply(){
    if (running) return;
    running = true;
    queued = false;
    injectStyle();
    removeStartupPanel();
    loadFeed().then(function(feed){
      syncSources(feed);
      capSeenArticles();
    }).finally(function(){ running = false; });
  }

  function queueApply(){
    if (queued || running) return;
    queued = true;
    setTimeout(apply, 60);
  }

  function start(){
    apply();
    [180, 600, 1400, 2600].forEach(function(delay){ setTimeout(apply, delay); });
    new MutationObserver(queueApply).observe(document.getElementById('feed') || document.body, { childList:true, subtree:true, characterData:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
