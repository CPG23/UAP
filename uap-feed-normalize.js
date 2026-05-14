(function(){
  'use strict';

  if (window.__uapFeedSafetyCheck) return;
  window.__uapFeedSafetyCheck = true;

  var nativeFetch = window.fetch;

  function clean(value){ return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function titleKey(value){ return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function sourceKey(source){ return clean((source && (source.url || source.link || source.title || source.source)) || '').toLowerCase(); }
  function parseTime(article){
    var value = article && (article.publishedAt || article.detectedAt || article.createdAt || article.updatedAt || article.timestamp || article.date);
    var t = Date.parse(value && String(value).length <= 10 ? String(value) + 'T00:00:00Z' : value);
    return isNaN(t) ? 0 : t;
  }
  function parseQuality(article){ return Number(article && (article.quality || article.sourceQuality || 0)) || 0; }
  function dedupeSources(sources, primaryTitle){
    var seen = {};
    var primary = titleKey(primaryTitle);
    return (sources || []).filter(function(source){
      if (!source) return false;
      var key = sourceKey(source);
      if (!key || seen[key]) return false;
      if (primary && titleKey(source.title) === primary) return false;
      seen[key] = true;
      return true;
    });
  }
  function sourceFromArticle(article){
    return {
      title: article.title || '',
      url: article.url || article.link || '',
      link: article.link || article.url || '',
      source: article.source || '',
      publishedAt: article.publishedAt || article.detectedAt || article.date || ''
    };
  }
  function mergeDuplicateTitle(target, incoming){
    var sources = dedupeSources((target.otherSources || []).concat([sourceFromArticle(incoming)]).concat(incoming.otherSources || []), target.title);
    target.otherSources = sources;
    target.mentions = Math.max(Number(target.mentions || 1), Number(incoming.mentions || 1), 1 + sources.length);
    target.clusterTitles = sources.map(function(source){ return clean(source.title); }).filter(Boolean).slice(0, 10);
    if (clean(incoming.summary).length > clean(target.summary).length) target.summary = incoming.summary;
    if (parseQuality(incoming) > parseQuality(target)) {
      target.quality = parseQuality(incoming);
      target.sourceQuality = parseQuality(incoming);
      if (incoming.qualityBreakdown) target.qualityBreakdown = incoming.qualityBreakdown;
    }
    return target;
  }
  function normalizeArticle(article){
    if (!article || !clean(article.title)) return null;
    article = Object.assign({}, article);
    article.otherSources = dedupeSources(article.otherSources || [], article.title);
    article.mentions = Math.max(1, 1 + article.otherSources.length, Number(article.mentions || 1));
    article.clusterTitles = article.otherSources.map(function(source){ return clean(source.title); }).filter(Boolean).slice(0, 10);
    article.quality = parseQuality(article);
    article.sourceQuality = article.quality;
    return article;
  }
  function safetyCheck(payload){
    if (!payload || !Array.isArray(payload.articles)) return payload;
    var byTitle = {};
    var order = [];
    payload.articles.forEach(function(raw){
      var article = normalizeArticle(raw);
      if (!article) return;
      var key = titleKey(article.title);
      if (!byTitle[key]) {
        byTitle[key] = article;
        order.push(key);
      } else {
        mergeDuplicateTitle(byTitle[key], article);
      }
    });
    var articles = order.map(function(key){ return byTitle[key]; });
    articles.sort(function(a,b){
      var qualityDiff = parseQuality(b) - parseQuality(a);
      if (qualityDiff) return qualityDiff;
      return parseTime(b) - parseTime(a);
    });
    payload = Object.assign({}, payload, { articles: articles });
    payload.scanMeta = Object.assign({}, payload.scanMeta || {}, { browserFeedSafety: 'display_safety_only_v1' });
    return payload;
  }

  window.fetch = function(input, init){
    return nativeFetch.apply(this, arguments).then(function(response){
      var url = typeof input === 'string' ? input : input && input.url || '';
      if (url.indexOf('latest-news.json') === -1) return response;
      return response.clone().json().then(function(payload){
        return new Response(JSON.stringify(safetyCheck(payload)), {
          status: response.status,
          statusText: response.statusText,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
        });
      }).catch(function(){ return response; });
    });
  };

  function sourceCount(article){ return Math.max(1, 1 + ((article && article.otherSources || []).length)); }
  function syncVisibleFeed(feed){
    var feedEl = document.getElementById('feed');
    if (!feedEl) return;
    var byTitle = {};
    (feed && feed.articles || []).forEach(function(article, index){ byTitle[titleKey(article.title)] = { article: article, index: index }; });
    Array.prototype.slice.call(feedEl.querySelectorAll('.article-card')).forEach(function(card){
      var h2 = card.querySelector('h2');
      var info = byTitle[titleKey(h2 && h2.textContent)];
      if (!info || !info.article) return;
      var article = info.article;
      var quality = parseQuality(article);
      card.dataset.uapQuality = String(quality);
      card.dataset.uapSortTime = String(parseTime(article));
      card.dataset.uapOrder = String(info.index);
      var q = card.querySelector('.badge.quality');
      if (q) q.textContent = 'Wertung ' + quality;
      var sources = card.querySelector('.badge.sources');
      if (sources) {
        var count = sourceCount(article);
        sources.textContent = count + ' Quelle' + (count === 1 ? '' : 'n');
      }
    });
    Array.prototype.slice.call(feedEl.querySelectorAll('.article-card')).sort(function(a,b){
      var qualityDiff = Number(b.dataset.uapQuality || 0) - Number(a.dataset.uapQuality || 0);
      if (qualityDiff) return qualityDiff;
      var timeDiff = Number(b.dataset.uapSortTime || 0) - Number(a.dataset.uapSortTime || 0);
      if (timeDiff) return timeDiff;
      return Number(a.dataset.uapOrder || 9999) - Number(b.dataset.uapOrder || 9999);
    }).forEach(function(card){ feedEl.appendChild(card); });
  }

  var applying = false;
  var queued = false;
  function applyDisplaySync(){
    if (applying) return;
    applying = true;
    queued = false;
    fetch('latest-news.json?safetyDisplay=' + Date.now(), { cache: 'no-store' })
      .then(function(resp){ return resp.ok ? resp.json() : { articles: [] }; })
      .then(syncVisibleFeed)
      .catch(function(){})
      .finally(function(){ applying = false; });
  }
  function queueDisplaySync(){
    if (queued) return;
    queued = true;
    setTimeout(applyDisplaySync, 160);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyDisplaySync, { once:true });
  else applyDisplaySync();
  [300, 900, 1800, 3200].forEach(function(delay){ setTimeout(applyDisplaySync, delay); });
  new MutationObserver(queueDisplaySync).observe(document.documentElement, { childList:true, subtree:true });
})();
