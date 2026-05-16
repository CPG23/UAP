(function(){
  'use strict';
  if (window.__uapFinalStabilityFix) return;
  window.__uapFinalStabilityFix = true;

  var NEW_WINDOW_MS = 24 * 60 * 60 * 1000;

  function compact(value){ return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"]/g, function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch];
    });
  }
  function hideStart(){
    var loading = document.getElementById('loading');
    if (loading) loading.classList.add('hidden');
  }
  function parseTime(article, feed){
    var candidates = [article && article.publishedAt, article && article.detectedAt, article && article.createdAt, article && article.updatedAt, article && article.date, feed && feed.timestamp];
    for (var i = 0; i < candidates.length; i++) {
      var value = candidates[i];
      var time = Date.parse(value && String(value).length <= 10 ? String(value) + 'T00:00:00Z' : value);
      if (!isNaN(time)) return time;
    }
    return 0;
  }
  function isNew(article, feed){
    var time = parseTime(article, feed);
    var age = Date.now() - time;
    return !!time && age >= 0 && age <= NEW_WINDOW_MS;
  }
  function formatDate(value){
    if (!value) return '';
    var d = new Date(String(value).length <= 10 ? String(value) + 'T00:00:00Z' : value);
    if (isNaN(d.getTime())) return String(value).slice(0, 10);
    try { return d.toLocaleDateString('de-AT', { day:'2-digit', month:'2-digit', year:'numeric' }); }
    catch(e){ return d.toISOString().slice(0, 10); }
  }
  function articleId(article){ return compact(article && article.id) || compact(article && article.title).toLowerCase().replace(/[^a-z0-9]+/g, '-'); }
  function sourcesFor(article){
    var sources = [];
    if (article && (article.link || article.url)) sources.push({ source: article.source || 'Quelle', link: article.link || article.url, title: article.title || '' });
    (article && article.otherSources || []).forEach(function(source){
      if (source && (source.link || source.url)) sources.push({ source: source.source || 'Quelle', link: source.link || source.url, title: source.title || '' });
    });
    var seen = {};
    return sources.filter(function(source){
      var key = compact(source.link || source.url || source.source + '|' + source.title).toLowerCase();
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function reapplyStartupWallpaper(){
    var loading = document.getElementById('loading');
    if (!loading) return;
    while (loading.firstChild) loading.removeChild(loading.firstChild);
    loading.setAttribute('aria-hidden', 'true');
    loading.style.setProperty('position', 'fixed', 'important');
    loading.style.setProperty('inset', '0', 'important');
    loading.style.setProperty('z-index', '1000', 'important');
    loading.style.setProperty('display', 'block', 'important');
    loading.style.setProperty('overflow', 'hidden', 'important');

    var wallpaper = document.getElementById('uap-startscreen-wallpaper-style');
    if (wallpaper && wallpaper.parentNode) document.head.appendChild(wallpaper);
    window.setTimeout(hideStart, 5000);
  }

  function reorderNewBadges(){
    Array.prototype.slice.call(document.querySelectorAll('.article-topline')).forEach(function(line){
      var date = line.querySelector('.article-date-prominent');
      var badges = line.querySelector('.badges');
      var badge = line.querySelector('.uap-new-badge');
      if (!date || !badge) return;
      if (badge.parentNode !== line) line.insertBefore(badge, date);
      else if (line.firstElementChild !== badge) line.insertBefore(badge, line.firstElementChild);
      if (badges && !badges.children.length) badges.remove();
    });
  }

  function fallbackArticleHtml(article, feed, index){
    var id = articleId(article) || ('article-' + index);
    var sources = sourcesFor(article);
    var date = article.publishedAt || article.date || feed.timestamp;
    var newBadge = isNew(article, feed) ? '<span class="badge uap-new-badge">New</span>' : '';
    var quality = Number(article.quality || article.sourceQuality || 0) || 0;
    return '<article class="article-card' + (newBadge ? ' uap-is-new' : '') + '" data-uap-id="' + esc(id) + '">' +
      '<button class="article-main" type="button" aria-expanded="false">' +
        '<div class="article-topline">' + newBadge + '<span class="article-date-prominent">' + esc(formatDate(date)) + '</span><div class="badges"><span class="badge sources">' + sources.length + ' Quelle' + (sources.length === 1 ? '' : 'n') + '</span><span class="badge quality">Wertung ' + quality + '</span></div></div>' +
        '<h2>' + esc(article.title || 'UAP News') + '</h2>' +
        '<div class="meta"><span>' + esc(article.source || 'UAP News') + '</span></div>' +
      '</button>' +
      '<div class="uap-detail-summary">' + esc(article.summary || '') + '</div>' +
      '<div class="details"><div class="sources-title">Quellen</div><div class="source-list">' + sources.map(function(source){ return '<a class="source-link" href="' + esc(source.link) + '" target="_blank" rel="noopener noreferrer"><div class="source-name">' + esc(source.source || 'Quelle') + '</div><div class="source-headline">' + esc(source.title || '') + '</div></a>'; }).join('') + '</div></div>' +
    '</article>';
  }

  function renderFallbackFeed(){
    var feedEl = document.getElementById('feed');
    if (!feedEl || feedEl.children.length) return;
    fetch('latest-news.json?fallback=' + Date.now(), { cache: 'no-store' })
      .then(function(resp){ return resp.ok ? resp.json() : { articles: [] }; })
      .then(function(feed){
        if (!feedEl || feedEl.children.length) return;
        var articles = Array.isArray(feed.articles) ? feed.articles : [];
        feedEl.innerHTML = articles.map(function(article, index){ return fallbackArticleHtml(article, feed, index); }).join('');
        reorderNewBadges();
      })
      .catch(function(){
        if (feedEl && !feedEl.children.length) feedEl.innerHTML = '<div class="article-card"><div class="article-main"><h2>Feed konnte nicht geladen werden</h2><div class="meta">Bitte erneut aktualisieren.</div></div></div>';
      });
  }

  function bindFallbackOpen(){
    document.addEventListener('click', function(e){
      var main = e.target.closest && e.target.closest('.article-main');
      if (!main) return;
      var card = main.closest('.article-card');
      if (!card || e.target.closest('a,.badge.quality')) return;
      card.classList.toggle('uap-detail-open');
      card.classList.toggle('open');
      main.setAttribute('aria-expanded', card.classList.contains('uap-detail-open') ? 'true' : 'false');
    }, false);
  }

  function injectStyle(){
    if (document.getElementById('uap-final-stability-style')) return;
    var style = document.createElement('style');
    style.id = 'uap-final-stability-style';
    style.textContent = [
      '#loading{animation:uapStartupHide 5s forwards!important;}',
      '#loading>*{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;}',
      '#loading.hidden{opacity:0!important;visibility:hidden!important;pointer-events:none!important;}',
      'header{padding:0!important;background:#000!important;border-bottom:1px solid rgba(0,212,255,.42)!important;overflow:hidden!important;}',
      'header .header-inner,header .brand{display:block!important;width:100%!important;max-width:none!important;margin:0!important;padding:0!important;}',
      '.brand-sub,.status{display:none!important;}',
      '.article-topline{justify-content:flex-start!important;}',
      '.article-topline>.uap-new-badge{order:0!important;flex:0 0 auto!important;margin-right:0!important;}',
      '.article-topline>.article-date-prominent{order:1!important;flex:0 0 auto!important;}',
      '.article-topline>.badges{order:2!important;display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:6px!important;margin-left:auto!important;}',
      '@keyframes uapStartupHide{0%,94%{opacity:1;visibility:visible;pointer-events:auto;}100%{opacity:0;visibility:hidden;pointer-events:none;}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function apply(){
    injectStyle();
    reapplyStartupWallpaper();
    reorderNewBadges();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();
  window.addEventListener('load', apply, { once: true });
  [50, 150, 350, 800, 1500, 2500].forEach(function(delay){ window.setTimeout(apply, delay); });
  [1200, 3000, 6000].forEach(function(delay){ window.setTimeout(renderFallbackFeed, delay); });
  bindFallbackOpen();

  if (window.MutationObserver) {
    new MutationObserver(function(){ window.requestAnimationFrame(reorderNewBadges); })
      .observe(document.documentElement, { childList: true, subtree: true });
  }
})();
