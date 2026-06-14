(function(){
  'use strict';
  if (window.__uapDefaultNewFilter) return;
  window.__uapDefaultNewFilter = true;

  var applied = false;
  var attempts = 0;
  var nativeFetch = window.fetch;
  var rankById = {};

  function compact(value){ return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function sourceKey(source){ return compact(source && (source.link || source.url || source.title || source.source)).toLowerCase(); }
  function sourceCount(article){
    var seen = {};
    [article].concat(article && article.otherSources || []).forEach(function(source){
      var key = sourceKey(source);
      if (key) seen[key] = true;
    });
    return Math.max(1, Object.keys(seen).length);
  }
  function quality(article){ return Number(article && (article.quality || article.sourceQuality || 0)) || 0; }
  function articleTime(article){
    var value = article && (article.publishedAt || article.date || article.displayedAt);
    var time = Date.parse(value || '');
    return isNaN(time) ? 0 : time;
  }
  function sortFeed(payload){
    if (!payload || !Array.isArray(payload.articles)) return payload;
    payload.articles.sort(function(a, b){
      return sourceCount(b) - sourceCount(a) || quality(b) - quality(a) || articleTime(b) - articleTime(a);
    });
    rankById = {};
    payload.articles.forEach(function(article, index){ rankById[compact(article.id)] = index; });
    return payload;
  }
  function reorderVisibleCards(){
    var feed = document.getElementById('feed');
    if (!feed) return;
    var cards = Array.prototype.slice.call(feed.querySelectorAll('.article-card[data-uap-id]'));
    if (cards.length < 2) return;
    var sorted = cards.slice().sort(function(a, b){
      var aRank = rankById.hasOwnProperty(a.dataset.uapId) ? rankById[a.dataset.uapId] : 9999;
      var bRank = rankById.hasOwnProperty(b.dataset.uapId) ? rankById[b.dataset.uapId] : 9999;
      return aRank - bRank;
    });
    if (cards.every(function(card, index){ return card === sorted[index]; })) return;
    sorted.forEach(function(card){ feed.appendChild(card); });
  }
  function watchFeed(){
    var feed = document.getElementById('feed');
    if (!feed || feed.dataset.sourcePriorityBound) return;
    feed.dataset.sourcePriorityBound = '1';
    new MutationObserver(function(){ setTimeout(reorderVisibleCards, 0); }).observe(feed, { childList: true });
    reorderVisibleCards();
  }

  window.fetch = function(input, init){
    return nativeFetch.apply(this, arguments).then(function(response){
      var url = typeof input === 'string' ? input : input && input.url || '';
      if (url.indexOf('latest-news.json') === -1) return response;
      return response.clone().json().then(function(payload){
        return new Response(JSON.stringify(sortFeed(payload)), {
          status: response.status,
          statusText: response.statusText,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
        });
      }).catch(function(){ return response; });
    });
  };

  function apply(){
    if (applied || attempts > 40) return;
    attempts += 1;
    var btn = document.getElementById('uap-new-filter-toggle');
    if (!btn) { setTimeout(apply, 100); return; }
    if (btn.getAttribute('aria-pressed') !== 'true') btn.click();
    watchFeed();
    applied = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  else setTimeout(apply, 0);
  window.addEventListener('load', apply, { once: true });
})();
