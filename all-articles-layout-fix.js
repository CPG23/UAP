(function(){
  'use strict';

  var STYLE_ID = 'uap-all-articles-layout-style';
  var feedPromise = null;
  var latestFeed = null;
  var running = false;

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.article-card h2{color:#0b8fc1!important;text-shadow:0 0 8px rgba(0,139,194,.14)!important}',
      '.article-card.uap-detail-open .details .actions{margin:10px 0 13px!important}',
      '.article-card.uap-detail-open .details .actions + .sources-title{margin-top:2px!important}',
      '.article-card.uap-detail-open .uap-detail-summary{display:block!important}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function loadFeed(){
    if (!feedPromise) {
      feedPromise = fetch('latest-news.json?all=' + Date.now(), { cache: 'no-store' })
        .then(function(r){ return r.json(); })
        .then(function(feed){ latestFeed = feed; return feed; })
        .catch(function(){ return { articles: [] }; });
    }
    return feedPromise;
  }

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"]/g, function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch];
    });
  }

  function slug(title){
    return String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function fmtDate(value){
    if (!value) return '';
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value).slice(0, 10);
    return d.toLocaleDateString('de-AT', { day:'2-digit', month:'2-digit', year:'numeric' });
  }

  function isoDate(value){
    if (!value) return '';
    var d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
  }

  function todayIso(){
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function cardId(card){
    if (!card) return '';
    if (card.dataset && card.dataset.uapId) return card.dataset.uapId;
    var summary = card.querySelector('.summary[id]');
    if (summary && summary.id) return summary.id.replace(/^summary-/, '');
    var title = card.querySelector('h2');
    return title ? slug(title.textContent) : '';
  }

  function allSources(article){
    var list = [];
    if (article.link) list.push({ source: article.source || 'Quelle', link: article.link, title: article.title || '' });
    (article.otherSources || []).forEach(function(s){ if (s && s.link) list.push(s); });
    var seen = {};
    return list.filter(function(s){
      var key = String(s.source || '').toLowerCase() + '|' + String(s.link || '').toLowerCase();
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function sourceHtml(article){
    return allSources(article).map(function(s){
      var title = s.title && s.title !== article.title ? '<div class="source-headline">' + esc(s.title) + '</div>' : '';
      return '<a class="source-link" href="' + esc(s.link) + '" target="_blank" rel="noopener noreferrer"><div class="source-name">' + esc(s.source || 'Quelle') + '</div>' + title + '</a>';
    }).join('');
  }

  function articleHtml(article){
    var id = article.id || slug(article.title);
    var sources = allSources(article);
    return '' +
      '<button class="article-main" type="button">' +
        '<div class="badges"><span class="badge sources">' + sources.length + ' Quelle' + (sources.length === 1 ? '' : 'n') + '</span><span class="badge quality" role="button" tabindex="0">Wertung ' + esc(article.quality || 0) + '</span></div>' +
        '<h2>' + esc(article.title || 'UAP News') + '</h2>' +
        '<div class="meta"><span>' + esc(article.source || 'UAP News') + '</span><span>' + esc(fmtDate(article.date)) + '</span></div>' +
      '</button>' +
      '<div class="summary" id="summary-' + esc(id) + '">' + esc(article.summary || '') + '</div>' +
      '<div class="details">' +
        '<div class="actions"><button class="translate-btn" type="button">Übersetzen</button></div>' +
        '<div class="sources-title">Quellen</div>' +
        '<div class="source-list">' + sourceHtml(article) + '</div>' +
      '</div>';
  }

  function renderMissing(feed){
    var feedEl = document.getElementById('feed');
    if (!feedEl || !feed || !Array.isArray(feed.articles)) return;
    var existing = {};
    document.querySelectorAll('.article-card').forEach(function(card){ existing[cardId(card)] = true; });
    feed.articles.forEach(function(article){
      var id = article.id || slug(article.title);
      if (!id || existing[id]) return;
      var card = document.createElement('article');
      card.className = 'article-card uap-backfilled-article';
      card.dataset.uapId = id;
      card.innerHTML = articleHtml(article);
      feedEl.appendChild(card);
      existing[id] = true;
    });
  }

  function articleMap(feed){
    var map = {};
    (feed && feed.articles || []).forEach(function(article){
      var id = article.id || slug(article.title);
      if (id) map[id] = article;
    });
    return map;
  }

  function promoteCurrentDayArticles(feed){
    var feedEl = document.getElementById('feed');
    if (!feedEl || !feed) return;
    var today = todayIso();
    var map = articleMap(feed);
    var oldToggle = feedEl.querySelector(':scope > .old-toggle');
    document.querySelectorAll('.old-list .article-card').forEach(function(card){
      var article = map[cardId(card)];
      if (!article || isoDate(article.date) !== today) return;
      card.dataset.currentScan = 'true';
      if (oldToggle && oldToggle.parentNode === feedEl) feedEl.insertBefore(card, oldToggle);
      else feedEl.appendChild(card);
    });
  }

  function updateSeenSection(){
    var feedEl = document.getElementById('feed');
    if (!feedEl) return;
    var toggle = feedEl.querySelector(':scope > .old-toggle');
    var list = feedEl.querySelector(':scope > .old-list');
    if (!toggle || !list) return;
    var count = list.querySelectorAll('.article-card').length;
    var hasVisibleCurrentOrNew = Array.prototype.some.call(feedEl.querySelectorAll(':scope > .article-card'), function(card){
      return card.offsetParent !== null;
    });
    var collapsed = hasVisibleCurrentOrNew;
    list.classList.toggle('collapsed', collapsed);
    toggle.textContent = (collapsed ? '▸ ' : '▾ ') + 'Bereits gesehen (' + count + ')';
    if (!toggle.dataset.uapSeenBound) {
      toggle.dataset.uapSeenBound = '1';
      toggle.addEventListener('click', function(){
        setTimeout(function(){
          var nowCollapsed = list.classList.contains('collapsed');
          toggle.textContent = (nowCollapsed ? '▸ ' : '▾ ') + 'Bereits gesehen (' + count + ')';
        }, 0);
      });
    }
  }

  function scheduleGrouping(feed){
    [0, 120, 400, 900, 1800, 3200].forEach(function(delay){
      setTimeout(function(){
        promoteCurrentDayArticles(feed);
        updateSeenSection();
      }, delay);
    });
  }

  function moveDetailActions(card){
    var details = card && card.querySelector('.details');
    if (!details) return;
    var actions = details.querySelector('.actions');
    var sourcesTitle = details.querySelector('.sources-title');
    if (actions && sourcesTitle && actions.compareDocumentPosition(sourcesTitle) & Node.DOCUMENT_POSITION_PRECEDING) {
      details.insertBefore(actions, sourcesTitle);
    }
  }

  function shorten(text){
    var clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (clean.length < 380) return clean;
    var sentences = clean.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [];
    if (sentences.length) return sentences.slice(0, 3).join('').trim();
    return clean.slice(0, Math.floor(clean.length * 0.5)).replace(/\s+\S*$/, '').trim() + '.';
  }

  function ensureBackfilledSummary(card){
    var detail = card.querySelector('.uap-detail-summary');
    if (!detail) {
      detail = document.createElement('div');
      detail.className = 'uap-detail-summary';
      var details = card.querySelector('.details');
      if (details) card.insertBefore(detail, details);
      else card.appendChild(detail);
    }
    if (!detail.textContent.trim()) {
      var summary = card.querySelector('.summary:not(.uap-detail-summary)');
      detail.textContent = shorten(summary ? summary.textContent : '');
    }
    detail.style.display = 'block';
  }

  function isInteractive(target){
    return !!(target && target.closest && target.closest('a,input,select,textarea,.badge.quality,.quality-overlay,.source-list,.translate-btn,.quality-top-help,.old-toggle'));
  }

  function toggleBackfilled(card){
    var open = !card.classList.contains('uap-detail-open');
    card.classList.toggle('uap-detail-open', open);
    card.classList.toggle('open', open);
    moveDetailActions(card);
    if (open) ensureBackfilledSummary(card);
  }

  function articleForCard(card){
    var id = cardId(card);
    var map = articleMap(latestFeed || {});
    return map[id] || null;
  }

  function closeQualityOverlay(){
    var existing = document.querySelector('.quality-overlay');
    if (existing) existing.remove();
  }

  function pointText(points){
    var n = Number(points) || 0;
    return (n > 0 ? '+' : '') + n + ' Pkt';
  }

  function showFastQuality(card, badge){
    var article = articleForCard(card);
    var scoreMatch = String(badge && badge.textContent || '').match(/\d+/);
    var score = article && article.quality || (scoreMatch ? Number(scoreMatch[0]) : 0);
    var rows = article && Array.isArray(article.qualityBreakdown) ? article.qualityBreakdown.slice() : [];
    if (!rows.length) rows = [{ label: 'Wertung', points: score, text: 'Artikel wurde nach UAP-Bezug, Quellen und Relevanz bewertet.' }];
    rows.sort(function(a,b){
      if (/basis/i.test(a.label || '')) return 1;
      if (/basis/i.test(b.label || '')) return -1;
      return (Number(a.points) || 0) - (Number(b.points) || 0);
    });
    closeQualityOverlay();
    var overlay = document.createElement('div');
    overlay.className = 'quality-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = '<div class="quality-sheet">' +
      '<h3>Wertung ' + esc(score) + '</h3>' +
      '<div class="quality-score-line">Punkte in diesem Artikel</div>' +
      '<p>Die Wertung priorisiert UAP-Relevanz, offizielle Stellen, Quellenvertrauen und mehrere unabhängige Quellen.</p>' +
      '<div class="quality-rules">' + rows.map(function(row){
        return '<div class="quality-rule"><span class="quality-points">' + pointText(row.points) + '</span><span><strong>' + esc(row.label || 'Wertung') + ':</strong> ' + esc(row.text || '') + '</span></div>';
      }).join('') + '</div>' +
      '<button type="button" class="quality-close">SCHLIESSEN</button>' +
    '</div>';
    overlay.addEventListener('click', function(e){ if (e.target === overlay || e.target.classList.contains('quality-close')) closeQualityOverlay(); });
    document.body.appendChild(overlay);
  }

  function apply(){
    if (running) return;
    running = true;
    injectStyle();
    loadFeed().then(function(feed){
      renderMissing(feed);
      scheduleGrouping(feed);
    }).finally(function(){
      document.querySelectorAll('.article-card').forEach(moveDetailActions);
      updateSeenSection();
      running = false;
    });
  }

  window.addEventListener('click', function(e){
    var quality = e.target && e.target.closest && e.target.closest('.badge.quality');
    if (quality) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      showFastQuality(quality.closest('.article-card'), quality);
      return;
    }
    var card = e.target && e.target.closest && e.target.closest('.uap-backfilled-article');
    if (!card || isInteractive(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    toggleBackfilled(card);
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
  new MutationObserver(function(){ setTimeout(apply, 0); }).observe(document.documentElement, { childList:true, subtree:true });
})();
