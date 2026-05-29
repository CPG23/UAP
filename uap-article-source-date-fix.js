(function(){
  'use strict';
  if (window.__uapArticleSourceDateFix) return;
  window.__uapArticleSourceDateFix = true;

  var datesById = {};
  var loaded = false;

  function compact(value){ return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function slug(value){ return compact(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'article'; }
  function parseDate(value){
    var text = compact(value);
    if (!text) return 0;
    var time = Date.parse(text.length <= 10 ? text + 'T00:00:00Z' : text);
    return isNaN(time) ? 0 : time;
  }
  function formatDate(value){
    var time = parseDate(value);
    if (!time) return '';
    try { return new Date(time).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
    catch(e) { return new Date(time).toISOString().slice(0, 10); }
  }
  function articleId(article){ return compact(article && article.id) || slug(article && article.title); }
  function sourceDisplayDate(article){
    return compact(article && (article.sourcePublishedAt || article.sourceDate || article.publisherPublishedAt || article.publisherDate));
  }
  function buildMap(feed){
    datesById = {};
    (feed && feed.articles || []).forEach(function(article){
      var id = articleId(article);
      var date = formatDate(sourceDisplayDate(article));
      if (id && date) datesById[id] = date;
    });
    loaded = true;
  }
  function applyDates(){
    Array.prototype.slice.call(document.querySelectorAll('.article-card[data-uap-id]')).forEach(function(card){
      var date = datesById[card.getAttribute('data-uap-id') || ''];
      if (!date) return;
      var badge = card.querySelector('.article-date-prominent');
      if (badge && badge.textContent !== date) badge.textContent = date;
    });
  }
  function loadFeed(){
    return fetch('latest-news.json?articleSourceDates=' + Date.now(), { cache: 'no-store' })
      .then(function(resp){ return resp.ok ? resp.json() : { articles: [] }; })
      .then(function(feed){ buildMap(feed); applyDates(); })
      .catch(function(){ loaded = true; });
  }
  function schedule(){ if (loaded) applyDates(); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ loadFeed(); }, { once: true });
  else loadFeed();
  window.addEventListener('load', schedule, { once: true });
  [250, 700, 1400, 2600].forEach(function(delay){ window.setTimeout(schedule, delay); });
  if (window.MutationObserver) {
    new MutationObserver(function(){ window.requestAnimationFrame(schedule); })
      .observe(document.documentElement, { childList: true, subtree: true });
  }
})();
