(function(){
  'use strict';

  var STYLE_ID = 'uap-new-articles-filter-style';
  var FILTER_ID = 'uap-new-filter-bar';
  var EMPTY_ID = 'uap-new-filter-empty';
  var feedPromise = null;
  var applying = false;
  var queued = false;
  var newOnly = false;
  var NEW_WINDOW_MS = 24 * 60 * 60 * 1000;

  function compact(value){ return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function slug(title){ return String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  function loadFeed(){
    if (!feedPromise) {
      feedPromise = fetch('latest-news.json?newFilter=' + Date.now(), { cache: 'no-store' })
        .then(function(resp){ return resp.ok ? resp.json() : { articles: [] }; })
        .catch(function(){ return { articles: [] }; });
    }
    return feedPromise;
  }

  function articleMap(feed){
    var map = {};
    (feed && feed.articles || []).forEach(function(article, index){
      var id = compact(article && article.id) || slug(article && article.title);
      if (id) map[id] = { article: article, index: index };
    });
    return map;
  }

  function cardId(card){
    if (!card) return '';
    if (card.dataset && card.dataset.uapId) return card.dataset.uapId;
    var summary = card.querySelector('.summary[id], .uap-detail-summary[id]');
    if (summary && summary.id) return summary.id.replace(/^summary-/, '');
    var title = card.querySelector('h2');
    return title ? slug(title.textContent) : '';
  }

  function parseArticleTime(article, feed){
    var candidates = [
      article && article.publishedAt,
      article && article.detectedAt,
      article && article.createdAt,
      article && article.updatedAt,
      article && article.timestamp
    ];
    for (var i = 0; i < candidates.length; i++) {
      var t = Date.parse(candidates[i]);
      if (!isNaN(t)) return t;
    }
    var date = compact(article && article.date);
    if (date) {
      var fromDate = Date.parse(date.length <= 10 ? date + 'T00:00:00Z' : date);
      if (!isNaN(fromDate)) return fromDate;
    }
    var feedTime = Date.parse(feed && feed.timestamp);
    return isNaN(feedTime) ? 0 : feedTime;
  }

  function isNewArticle(article, feed){
    var time = parseArticleTime(article, feed);
    if (!time) return false;
    var age = Date.now() - time;
    return age >= 0 && age <= NEW_WINDOW_MS;
  }

  function injectStyle(){
    var style = document.getElementById(STYLE_ID);
    var css = [
      '#uap-new-filter-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 12px;padding:10px 0;border-bottom:1px solid rgba(13,58,92,.65)}',
      '#uap-new-filter-bar .uap-new-filter-label{color:#9fc7d4;font-family:"Share Tech Mono",monospace;font-size:10px;letter-spacing:1.2px;text-transform:uppercase}',
      '#uap-new-filter-toggle{min-height:34px;padding:0 12px;border:1px solid rgba(0,212,255,.44);background:rgba(0,212,255,.055);color:#bfefff;font-family:"Share Tech Mono",monospace;font-size:10px;letter-spacing:1.2px;cursor:pointer}',
      '#uap-new-filter-toggle.active{border-color:rgba(0,255,157,.88);background:rgba(0,255,157,.15);color:#d8ffe9;box-shadow:0 0 18px rgba(0,255,157,.24)}',
      '.article-card.uap-is-new{border-color:rgba(0,255,157,.95)!important;box-shadow:0 0 0 1px rgba(0,255,157,.38),0 0 24px rgba(0,255,157,.18)!important}',
      '.article-card.uap-is-new::before{background:#00ff9d!important;opacity:1!important;width:4px!important;box-shadow:0 0 18px rgba(0,255,157,.9)!important}',
      '.badge.uap-new-badge{border-color:rgba(0,255,157,.9)!important;background:rgba(0,255,157,.18)!important;color:#eafff4!important;box-shadow:0 0 16px rgba(0,255,157,.22)!important}',
      'body.uap-new-filter-active .article-card:not(.uap-is-new){display:none!important}',
      'body.uap-new-filter-active .article-card.uap-topic-duplicate{display:none!important}',
      '#uap-new-filter-empty{display:none;margin:0 0 12px;padding:11px 12px;border:1px solid rgba(0,212,255,.28);background:rgba(0,212,255,.055);color:#9fc7d4;font-family:"Share Tech Mono",monospace;font-size:10px;line-height:1.5}',
      'body.uap-new-filter-active.uap-new-filter-empty #uap-new-filter-empty{display:block}',
      '#feed > .old-toggle,#feed > .old-list{display:none!important}',
      '.article-card.unread{filter:none!important}'
    ].join('\n');
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
  }

  function ensureFilterBar(){
    var feed = document.getElementById('feed');
    if (!feed || !feed.parentNode) return null;
    var bar = document.getElementById(FILTER_ID);
    if (!bar) {
      bar = document.createElement('div');
      bar.id = FILTER_ID;
      bar.innerHTML = '<div class="uap-new-filter-label">Neue Artikel</div><button id="uap-new-filter-toggle" type="button" aria-pressed="false">New anzeigen</button>';
      feed.parentNode.insertBefore(bar, feed);
      var empty = document.createElement('div');
      empty.id = EMPTY_ID;
      empty.textContent = 'Keine neuen Artikel in den letzten 24 Stunden.';
      feed.parentNode.insertBefore(empty, feed);
    }
    var btn = document.getElementById('uap-new-filter-toggle');
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', function(e){
        e.preventDefault();
        newOnly = !newOnly;
        updateFilterState();
      }, true);
    }
    return bar;
  }

  function updateFilterState(){
    var btn = document.getElementById('uap-new-filter-toggle');
    document.body.classList.toggle('uap-new-filter-active', newOnly);
    if (btn) {
      btn.classList.toggle('active', newOnly);
      btn.setAttribute('aria-pressed', newOnly ? 'true' : 'false');
      btn.textContent = newOnly ? 'Alle anzeigen' : 'New anzeigen';
    }
    updateEmptyState();
  }

  function updateEmptyState(){
    var feed = document.getElementById('feed');
    if (!feed) return;
    var visibleNew = Array.prototype.slice.call(feed.querySelectorAll(':scope > .article-card.uap-is-new')).filter(function(card){
      return !card.classList.contains('uap-topic-duplicate') && !card.classList.contains('uap-hidden-by-notification');
    }).length;
    document.body.classList.toggle('uap-new-filter-empty', newOnly && visibleNew === 0);
  }

  function removeReadSections(feed){
    Array.prototype.slice.call(feed.querySelectorAll(':scope > .old-list')).forEach(function(list){
      while (list.firstChild) feed.insertBefore(list.firstChild, list);
      if (list.parentNode) list.parentNode.removeChild(list);
    });
    Array.prototype.slice.call(feed.querySelectorAll(':scope > .old-toggle')).forEach(function(toggle){
      if (toggle.parentNode) toggle.parentNode.removeChild(toggle);
    });
    feed.querySelectorAll('.article-card').forEach(function(card){
      card.classList.remove('unread', 'uap-seen-overflow');
    });
  }

  function orderCards(feed, map){
    var cards = Array.prototype.slice.call(feed.querySelectorAll(':scope > .article-card'));
    cards.sort(function(a, b){
      var ai = map[cardId(a)] ? map[cardId(a)].index : 9999;
      var bi = map[cardId(b)] ? map[cardId(b)].index : 9999;
      return ai - bi;
    }).forEach(function(card){ feed.appendChild(card); });
  }

  function setNewBadge(card, active){
    var badges = card.querySelector('.badges');
    var existing = card.querySelector('.uap-new-badge');
    card.classList.toggle('uap-is-new', active);
    if (active && badges && !existing) {
      var badge = document.createElement('span');
      badge.className = 'badge uap-new-badge';
      badge.textContent = 'New';
      badges.insertBefore(badge, badges.firstChild);
    } else if (!active && existing) {
      existing.remove();
    }
  }

  function markNewArticles(feed, data){
    var map = articleMap(data);
    feed.querySelectorAll(':scope > .article-card').forEach(function(card){
      var info = map[cardId(card)];
      setNewBadge(card, !!(info && isNewArticle(info.article, data)));
    });
    orderCards(feed, map);
  }

  function apply(data){
    var feed = document.getElementById('feed');
    if (!feed) return;
    injectStyle();
    ensureFilterBar();
    removeReadSections(feed);
    markNewArticles(feed, data || { articles: [] });
    updateFilterState();
  }

  function run(){
    queued = false;
    if (applying) return;
    applying = true;
    loadFeed().then(apply).finally(function(){ applying = false; });
  }

  function queue(){
    if (queued || applying) return;
    queued = true;
    setTimeout(run, 120);
  }

  function start(){
    run();
    [300, 900, 1800, 3200].forEach(function(delay){ setTimeout(queue, delay); });
    new MutationObserver(queue).observe(document.getElementById('feed') || document.body, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
