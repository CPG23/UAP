(function(){
  'use strict';
  if (window.__uapSourceNewBadgeFix) return;
  window.__uapSourceNewBadgeFix = true;

  var STYLE_ID = 'uap-source-new-badge-style';
  var NEW_WINDOW_MS = 24 * 60 * 60 * 1000;
  var state = { sources: {}, scheduled: false, observer: null };

  function compact(value){ return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function key(value){ return compact(value).toLowerCase(); }
  function parseTime(value){
    if (!value) return 0;
    var text = String(value);
    var time = Date.parse(text.length <= 10 ? text + 'T00:00:00Z' : text);
    return isNaN(time) ? 0 : time;
  }
  function formatDate(value){
    var time = parseTime(value);
    if (!time) return '';
    var date = new Date(time);
    try { return date.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
    catch(e){ return date.toISOString().slice(0, 10); }
  }
  function sourceTime(source){
    return parseTime(source && (source.displayedAt || source.sourceDisplayedAt || source.firstDisplayedAt || source.detectedAt || source.createdAt));
  }
  function sourceDate(source){
    return formatDate(source && (source.publishedAt || source.date));
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
      publishedAt: primary
        ? (raw.publishedAt || raw.date || article.publishedAt || article.date)
        : (raw.publishedAt || raw.date),
      date: primary ? (raw.date || article.date) : raw.date,
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
        publishedAt: article.publishedAt,
        date: article.date,
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
      '.source-name-row .source-name{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important}',
      '.source-badge-row{display:inline-flex!important;align-items:center!important;justify-content:flex-end!important;gap:6px!important;flex:0 0 auto!important}',
      '.source-date-badge,.source-new-badge{box-sizing:border-box!important;height:20px!important;min-height:20px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:0 7px!important;font-family:"Share Tech Mono",monospace!important;font-size:9px!important;line-height:1!important;letter-spacing:1.1px!important;text-transform:uppercase!important;white-space:nowrap!important}',
      '.source-date-badge{border:1px solid rgba(0,212,255,.42)!important;background:rgba(0,212,255,.075)!important;color:#bfefff!important}',
      '.source-new-badge{border:1px solid rgba(0,255,157,.86)!important;background:rgba(0,255,157,.16)!important;color:#eafff4!important;box-shadow:0 0 14px rgba(0,255,157,.22)!important}',
      '@media(max-width:420px){.source-name-row{gap:6px!important}.source-date-badge,.source-new-badge{height:19px!important;min-height:19px!important;padding:0 6px!important;font-size:8px!important;letter-spacing:.9px!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }
  function sourceForLink(link){
    return state.sources[link] || state.sources[key(link)] || null;
  }
  function ensureRow(linkEl){
    var name = linkEl.querySelector('.source-name');
    if (!name) return null;
    var row = name.closest('.source-name-row');
    if (!row) {
      row = document.createElement('div');
      row.className = 'source-name-row';
      name.parentNode.insertBefore(row, name);
      row.appendChild(name);
    }
    var badgeRow = row.querySelector('.source-badge-row');
    if (!badgeRow) {
      badgeRow = document.createElement('span');
      badgeRow.className = 'source-badge-row';
      row.appendChild(badgeRow);
    }
    return badgeRow;
  }
  function ensureDate(linkEl, source){
    var dateText = sourceDate(source);
    var existing = linkEl.querySelector('.source-date-badge');
    if (!dateText) {
      if (existing) existing.remove();
      return;
    }
    var badgeRow = ensureRow(linkEl);
    if (!badgeRow) return;
    if (!existing) {
      existing = document.createElement('span');
      existing.className = 'source-date-badge';
      badgeRow.insertBefore(existing, badgeRow.firstChild);
    }
    existing.textContent = dateText;
  }
  function ensureNewBadge(linkEl){
    var badgeRow = ensureRow(linkEl);
    if (!badgeRow) return;
    if (!badgeRow.querySelector('.source-new-badge')) {
      var badge = document.createElement('span');
      badge.className = 'source-new-badge';
      badge.textContent = 'New';
      badgeRow.appendChild(badge);
    }
  }
  function removeBadges(linkEl){
    linkEl.classList.remove('uap-source-new');
    var newBadge = linkEl.querySelector('.source-new-badge');
    if (newBadge) newBadge.remove();
    var dateBadge = linkEl.querySelector('.source-date-badge');
    if (dateBadge) dateBadge.remove();
  }
  function removeNewBadge(linkEl){
    linkEl.classList.remove('uap-source-new');
    var badge = linkEl.querySelector('.source-new-badge');
    if (badge) badge.remove();
  }
  function applyBadges(){
    state.scheduled = false;
    injectStyle();
    Array.prototype.slice.call(document.querySelectorAll('.source-link')).forEach(function(linkEl){
      var href = linkEl.getAttribute('href') || '';
      var source = sourceForLink(href) || sourceForLink(linkEl.href || '');
      if (!source) {
        removeBadges(linkEl);
        return;
      }
      ensureDate(linkEl, source);
      if (!isNewSource(source)) {
        removeNewBadge(linkEl);
        return;
      }
      linkEl.classList.add('uap-source-new');
      ensureNewBadge(linkEl);
    });
  }
  function loadFeed(){
    return fetch('latest-news.json?sourceBadges=' + Date.now(), { cache: 'no-store' })
      .then(function(resp){ return resp.ok ? resp.json() : { articles: [] }; })
      .then(function(feed){ state.sources = buildSourceMap(feed); applyBadges(); observeFeed(); })
      .catch(function(){ applyBadges(); observeFeed(); });
  }
  function schedule(){
    if (state.scheduled) return;
    state.scheduled = true;
    if (window.requestAnimationFrame) window.requestAnimationFrame(applyBadges);
    else window.setTimeout(applyBadges, 0);
  }
  function observeFeed(){
    if (!window.MutationObserver || state.observer) return;
    var feed = document.getElementById('feed');
    if (!feed) return;
    state.observer = new MutationObserver(schedule);
    state.observer.observe(feed, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadFeed, { once: true });
  else loadFeed();
  window.addEventListener('load', function(){ loadFeed(); }, { once: true });
  [200, 600, 1200, 2500].forEach(function(delay){ window.setTimeout(applyBadges, delay); });
  document.addEventListener('click', function(e){
    if (e.target && e.target.closest && e.target.closest('.article-main')) window.setTimeout(applyBadges, 40);
  }, true);
})();
