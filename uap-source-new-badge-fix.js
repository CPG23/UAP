(function(){
  'use strict';
  if (window.__uapSourceNewBadgeFix) return;
  window.__uapSourceNewBadgeFix = true;

  var STYLE_ID = 'uap-source-new-badge-style';
  var NEW_WINDOW_MS = 24 * 60 * 60 * 1000;
  var state = { sources: {} };

  function compact(value){ return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function key(value){ return compact(value).toLowerCase(); }
  function parseTime(value){
    if (!value) return 0;
    var text = String(value);
    var time = Date.parse(text.length <= 10 ? text + 'T00:00:00Z' : text);
    return isNaN(time) ? 0 : time;
  }
  function sourceTime(source){
    return parseTime(source && (source.displayedAt || source.sourceDisplayedAt || source.firstDisplayedAt || source.detectedAt || source.createdAt));
  }
  function isNewSource(source){
    var time = sourceTime(source);
    var age = Date.now() - time;
    return !!time && age >= 0 && age <= NEW_WINDOW_MS;
  }
  function addMapEntry(map, link, source){
    if (!link || !source) return;
    map[link] = source;
    map[key(link)] = source;
    try {
      var absolute = new URL(link, window.location.href).href;
      map[absolute] = source;
      map[key(absolute)] = source;
    } catch(e) {}
  }
  function normalizeSource(raw, article, primary){
    if (!raw) return null;
    var link = compact(raw.link || raw.url);
    if (!link) return null;
    return {
      link: link,
      title: raw.title || '',
      source: raw.source || 'Quelle',
      displayedAt: primary
        ? (article.sourceDisplayedAt || raw.displayedAt || raw.sourceDisplayedAt || raw.firstDisplayedAt || raw.detectedAt || raw.createdAt)
        : (raw.displayedAt || raw.sourceDisplayedAt || raw.firstDisplayedAt || raw.detectedAt || raw.createdAt),
      isNew: !!(primary ? article.sourceIsNew : raw.isNew)
    };
  }
  function buildSourceMap(feed){
    var map = {};
    ((feed && feed.articles) || []).forEach(function(article){
      var primary = normalizeSource({
        link: article.link || article.url,
        title: article.title || '',
        source: article.source || 'Quelle',
        displayedAt: article.sourceDisplayedAt || article.displayedAt
      }, article, true);
      addMapEntry(map, primary && primary.link, primary);
      (article.otherSources || []).forEach(function(raw){
        var source = normalizeSource(raw, article, false);
        addMapEntry(map, source && source.link, source);
      });
    });
    return map;
  }
  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.source-link.uap-source-new{border-color:rgba(0,255,157,.72)!important;background:linear-gradient(135deg,rgba(0,255,157,.12),rgba(0,212,255,.04))!important;box-shadow:0 0 16px rgba(0,255,157,.14)!important}',
      '.source-name-row{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;width:100%!important}',
      '.source-name-row .source-name{min-width:0!important}',
      '.source-new-badge{box-sizing:border-box!important;height:20px!important;min-height:20px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:0 7px!important;border:1px solid rgba(0,255,157,.86)!important;background:rgba(0,255,157,.16)!important;color:#eafff4!important;font-family:"Share Tech Mono",monospace!important;font-size:9px!important;line-height:1!important;letter-spacing:1.2px!important;text-transform:uppercase!important;box-shadow:0 0 14px rgba(0,255,157,.22)!important;white-space:nowrap!important}'
    ].join('\n');
    document.head.appendChild(style);
  }
  function sourceForLink(link){
    return state.sources[link] || state.sources[key(link)] || null;
  }
  function ensureBadge(linkEl){
    var name = linkEl.querySelector('.source-name');
    if (!name) return;
    var row = name.closest('.source-name-row');
    if (!row) {
      row = document.createElement('div');
      row.className = 'source-name-row';
      name.parentNode.insertBefore(row, name);
      row.appendChild(name);
    }
    if (!row.querySelector('.source-new-badge')) {
      var badge = document.createElement('span');
      badge.className = 'source-new-badge';
      badge.textContent = 'New';
      row.appendChild(badge);
    }
  }
  function removeBadge(linkEl){
    linkEl.classList.remove('uap-source-new');
    var badge = linkEl.querySelector('.source-new-badge');
    if (badge) badge.remove();
  }
  function applyBadges(){
    injectStyle();
    Array.prototype.slice.call(document.querySelectorAll('.source-link')).forEach(function(linkEl){
      var href = linkEl.getAttribute('href') || '';
      var source = sourceForLink(href) || sourceForLink(linkEl.href || '');
      if (!source || !isNewSource(source)) {
        removeBadge(linkEl);
        return;
      }
      linkEl.classList.add('uap-source-new');
      ensureBadge(linkEl);
    });
  }
  function loadFeed(){
    return fetch('latest-news.json?sourceBadges=' + Date.now(), { cache: 'no-store' })
      .then(function(resp){ return resp.ok ? resp.json() : { articles: [] }; })
      .then(function(feed){ state.sources = buildSourceMap(feed); applyBadges(); })
      .catch(function(){ applyBadges(); });
  }
  function schedule(){
    if (window.requestAnimationFrame) window.requestAnimationFrame(applyBadges);
    else window.setTimeout(applyBadges, 0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadFeed, { once: true });
  else loadFeed();
  window.addEventListener('load', function(){ loadFeed(); }, { once: true });
  [200, 600, 1200, 2500].forEach(function(delay){ window.setTimeout(applyBadges, delay); });
  document.addEventListener('click', function(e){
    if (e.target && e.target.closest && e.target.closest('.article-main')) window.setTimeout(applyBadges, 40);
  }, true);
  if (window.MutationObserver) {
    new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
