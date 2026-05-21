(function(){
  'use strict';
  if (window.__uapSourceDateFix) return;
  window.__uapSourceDateFix = true;

  var STYLE_ID = 'uap-source-date-fix-style';
  var sourceDateByLink = {};
  var feedLoaded = false;

  function compact(value){ return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function linkKey(value){ return compact(value).toLowerCase(); }
  function parseDate(value){
    var text = compact(value);
    if (!text) return 0;
    var time = Date.parse(text.length <= 10 ? text + 'T00:00:00Z' : text);
    return isNaN(time) ? 0 : time;
  }
  function formatDate(value){
    var time = parseDate(value);
    if (!time) return '';
    try {
      return new Date(time).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch(e) {
      return new Date(time).toISOString().slice(0, 10);
    }
  }
  function sourceDate(source, article){
    return compact(
      source && (source.publishedAt || source.date || source.displayedAt || source.sourceDisplayedAt || source.firstDisplayedAt || source.detectedAt || source.createdAt)
    ) || compact(article && (article.publishedAt || article.date || article.sourceDisplayedAt || article.displayedAt));
  }
  function remember(link, date){
    var key = linkKey(link);
    var formatted = formatDate(date);
    if (key && formatted) sourceDateByLink[key] = formatted;
  }
  function buildMap(feed){
    sourceDateByLink = {};
    (feed && feed.articles || []).forEach(function(article){
      if (!article || typeof article !== 'object') return;
      remember(article.link || article.url, sourceDate(article, article));
      (article.otherSources || []).forEach(function(source){
        if (!source || typeof source !== 'object') return;
        remember(source.link || source.url, sourceDate(source, article));
      });
    });
    feedLoaded = true;
  }
  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.source-name{display:flex!important;align-items:flex-start!important;gap:7px!important;flex-wrap:wrap!important;line-height:1.35!important}',
      '.source-date{order:-2!important;display:inline-flex!important;align-items:center!important;flex:0 0 auto!important;color:#b8d6e0!important;border:1px solid rgba(0,212,255,.24)!important;background:rgba(0,212,255,.045)!important;padding:2px 6px!important;line-height:1.2!important;font-family:"Share Tech Mono",monospace!important;font-size:10px!important;letter-spacing:1px!important;text-transform:uppercase!important}',
      '.source-date::before{content:"DATUM";color:#00d4ff!important;margin-right:6px!important;font-size:9px!important;letter-spacing:1.1px!important}',
      '.source-new-badge{order:3!important}',
      '.source-meta{display:none!important}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }
  function applyDates(){
    injectStyle();
    Array.prototype.slice.call(document.querySelectorAll('.source-link')).forEach(function(link){
      var href = linkKey(link.getAttribute('href') || link.href || '');
      var date = sourceDateByLink[href];
      if (!date) return;

      var sourceName = link.querySelector('.source-name');
      if (!sourceName) return;

      Array.prototype.slice.call(link.querySelectorAll('.source-meta .source-date')).forEach(function(oldBadge){
        oldBadge.parentNode && oldBadge.parentNode.removeChild(oldBadge);
      });

      var badge = sourceName.querySelector(':scope > .source-date');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'source-date';
        sourceName.insertBefore(badge, sourceName.firstChild);
      }
      if (badge.textContent !== date) badge.textContent = date;
    });
  }
  function loadFeed(){
    return fetch('latest-news.json?sourceDates=' + Date.now(), { cache: 'no-store' })
      .then(function(resp){ return resp.ok ? resp.json() : { articles: [] }; })
      .then(function(feed){ buildMap(feed); applyDates(); })
      .catch(function(){ feedLoaded = true; applyDates(); });
  }
  function schedule(){
    if (feedLoaded) applyDates();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ loadFeed(); }, { once: true });
  else loadFeed();
  window.addEventListener('load', schedule, { once: true });
  [250, 700, 1400, 2600].forEach(function(delay){ window.setTimeout(schedule, delay); });
  if (window.MutationObserver) {
    new MutationObserver(function(){ window.requestAnimationFrame(schedule); })
      .observe(document.documentElement, { childList: true, subtree: true });
  }
})();
