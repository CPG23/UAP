(function(){
  'use strict';

  if (window.__uapFeedQualityDisplayFix) return;
  window.__uapFeedQualityDisplayFix = true;

  var applying = false;
  var queued = false;

  function clean(value){ return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function titleKey(value){ return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function cardTitle(card){ var h2 = card && card.querySelector('h2'); return h2 ? clean(h2.textContent) : ''; }
  function parseTime(article){
    var value = article && (article.publishedAt || article.detectedAt || article.createdAt || article.updatedAt || article.timestamp || article.date);
    var t = Date.parse(value && String(value).length <= 10 ? String(value) + 'T00:00:00Z' : value);
    return isNaN(t) ? 0 : t;
  }
  function buildMap(feed){
    var map = {};
    (feed && feed.articles || []).forEach(function(article, index){
      var key = titleKey(article.title);
      if (!key) return;
      map[key] = { article: article, index: index };
    });
    return map;
  }
  function sourceCount(article){ return Math.max(1, 1 + ((article && article.otherSources || []).length)); }
  function sync(feed){
    var feedEl = document.getElementById('feed');
    if (!feedEl) return;
    var map = buildMap(feed);
    Array.prototype.slice.call(feedEl.querySelectorAll('.article-card')).forEach(function(card){
      var info = map[titleKey(cardTitle(card))];
      if (!info || !info.article) return;
      var article = info.article;
      var quality = Number(article.quality || article.sourceQuality || 0) || 0;
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
  function apply(){
    if (applying) return;
    applying = true;
    queued = false;
    fetch('latest-news.json?qualityDisplay=' + Date.now(), { cache: 'no-store' })
      .then(function(resp){ return resp.ok ? resp.json() : { articles: [] }; })
      .then(sync)
      .catch(function(){})
      .finally(function(){ applying = false; });
  }
  function queue(){
    if (queued) return;
    queued = true;
    setTimeout(apply, 120);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once:true });
  else apply();
  [300, 900, 1800, 3200].forEach(function(delay){ setTimeout(apply, delay); });
  new MutationObserver(queue).observe(document.documentElement, { childList:true, subtree:true });
})();
