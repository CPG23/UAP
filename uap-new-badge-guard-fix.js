(function(){
  'use strict';
  if (window.__uapNewBadgeGuardFix) return;
  window.__uapNewBadgeGuardFix = true;

  var STYLE_ID = 'uap-new-badge-guard-style';
  var NEW_WINDOW_MS = 24 * 60 * 60 * 1000;
  var state = { articles: {}, sources: {}, scheduled: false };

  function compact(value){ return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function slug(value){ return compact(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'article'; }
  function key(value){ return compact(value).toLowerCase(); }
  function parseTime(value){
    if (!value) return 0;
    var text = String(value);
    var time = Date.parse(text.length <= 10 ? text + 'T00:00:00Z' : text);
    return isNaN(time) ? 0 : time;
  }
  function recent(time){
    var age = Date.now() - time;
    return !!time && age >= 0 && age <= NEW_WINDOW_MS;
  }
  function articleId(article){ return compact(article && article.id) || slug(article && article.title); }
  function sourceTime(source){ return parseTime(source && (source.displayedAt || source.sourceDisplayedAt || source.firstDisplayedAt || source.detectedAt || source.createdAt)); }
  function articleDisplayTime(article){ return parseTime(article && (article.displayedAt || article.firstDisplayedAt || article.detectedAt || article.createdAt)); }
  function articlePublishedTime(article){ return parseTime(article && (article.publishedAt || article.date)); }
  function isExplicitNewSource(source, article, primary){
    var marked = primary ? !!(article && article.sourceIsNew) : !!(source && source.isNew);
    if (!marked) return false;
    var time = primary ? parseTime(article && (article.sourceDisplayedAt || article.displayedAt)) : sourceTime(source);
    return recent(time);
  }
  function hasExplicitNewSource(article){
    if (isExplicitNewSource(null, article, true)) return true;
    return !!((article && article.otherSources) || []).some(function(source){ return isExplicitNewSource(source, article, false); });
  }
  function isTrueNewArticle(article){
    if (!article) return false;
    if (hasExplicitNewSource(article)) return true;
    var displayed = articleDisplayTime(article);
    if (!displayed || !recent(displayed)) return false;
    var published = articlePublishedTime(article);
    if (published && !recent(published) && displayed - published > NEW_WINDOW_MS) return false;
    return true;
  }
  function addSourceMapEntry(map, link, source, article, primary){
    if (!link || !source) return;
    var normalized = { isNew: isExplicitNewSource(source, article, primary) };
    map[link] = normalized;
    map[key(link)] = normalized;
    try {
      var absolute = new URL(link, window.location.href).href;
      map[absolute] = normalized;
      map[key(absolute)] = normalized;
    } catch(e) {}
  }
  function buildMaps(feed){
    var articles = {};
    var sources = {};
    ((feed && feed.articles) || []).forEach(function(article){
      articles[articleId(article)] = { isNew: isTrueNewArticle(article) };
      addSourceMapEntry(sources, article.link || article.url, {
        displayedAt: article.sourceDisplayedAt || article.displayedAt,
        isNew: article.sourceIsNew
      }, article, true);
      (article.otherSources || []).forEach(function(source){
        addSourceMapEntry(sources, source.link || source.url, source, article, false);
      });
    });
    state.articles = articles;
    state.sources = sources;
  }
  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = '.uap-new-guard-hidden{display:none!important;}';
    document.head.appendChild(style);
  }
  function ensureArticleBadge(card){
    var line = card.querySelector('.article-topline');
    var date = card.querySelector('.article-date-prominent');
    if (!line || !date) return;
    if (!line.querySelector('.uap-new-badge')) {
      var badge = document.createElement('span');
      badge.className = 'badge uap-new-badge';
      badge.textContent = 'New';
      line.insertBefore(badge, date);
    }
  }
  function removeArticleBadge(card){
    card.classList.remove('uap-is-new');
    var badge = card.querySelector('.article-topline .uap-new-badge');
    if (badge) badge.remove();
  }
  function sourceForLink(link){ return state.sources[link] || state.sources[key(link)] || null; }
  function cleanSourceBadges(){
    Array.prototype.slice.call(document.querySelectorAll('.source-link')).forEach(function(linkEl){
      var href = linkEl.getAttribute('href') || '';
      var source = sourceForLink(href) || sourceForLink(linkEl.href || '');
      if (source && source.isNew) return;
      linkEl.classList.remove('uap-source-new');
      var badge = linkEl.querySelector('.source-new-badge');
      if (badge) badge.remove();
    });
  }
  function applyArticleBadges(){
    var btn = document.getElementById('uap-new-filter-toggle');
    var filterActive = !!(btn && btn.classList.contains('active')) || document.body.classList.contains('uap-new-filter-active');
    var visibleNew = 0;
    Array.prototype.slice.call(document.querySelectorAll('.article-card[data-uap-id]')).forEach(function(card){
      var record = state.articles[card.getAttribute('data-uap-id')];
      var isNew = !!(record && record.isNew);
      if (isNew) {
        card.classList.add('uap-is-new');
        ensureArticleBadge(card);
        visibleNew += 1;
      } else {
        removeArticleBadge(card);
      }
      card.classList.toggle('uap-new-guard-hidden', filterActive && !isNew);
    });
    document.body.classList.toggle('uap-new-filter-empty', filterActive && visibleNew === 0);
  }
  function apply(){
    state.scheduled = false;
    injectStyle();
    applyArticleBadges();
    cleanSourceBadges();
  }
  function schedule(){
    if (state.scheduled) return;
    state.scheduled = true;
    if (window.requestAnimationFrame) window.requestAnimationFrame(apply);
    else window.setTimeout(apply, 0);
  }
  function load(){
    return fetch('latest-news.json?newGuard=' + Date.now(), { cache: 'no-store' })
      .then(function(resp){ return resp.ok ? resp.json() : { articles: [] }; })
      .then(function(feed){ buildMaps(feed); apply(); })
      .catch(apply);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
  else load();
  window.addEventListener('load', load, { once: true });
  [150, 400, 900, 1800, 3200].forEach(function(delay){ window.setTimeout(apply, delay); });
  document.addEventListener('click', function(e){
    if (e.target && e.target.closest && e.target.closest('#uap-new-filter-toggle')) window.setTimeout(apply, 30);
  }, true);
  if (window.MutationObserver) {
    var feed = document.getElementById('feed');
    if (feed) new MutationObserver(schedule).observe(feed, { childList: true, subtree: true });
  }
})();
