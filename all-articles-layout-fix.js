(function(){
  'use strict';

  var STYLE_ID = 'uap-all-articles-layout-style';
  var feedPromise = null;
  var running = false;

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.article-card h2{color:#00d4ff!important;text-shadow:0 0 12px rgba(0,212,255,.22)!important}',
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

  function promoteCurrentScanArticles(feed){
    var feedEl = document.getElementById('feed');
    if (!feedEl || !feed) return;
    var scanDay = isoDate(feed.timestamp || new Date());
    var map = articleMap(feed);
    var oldToggle = feedEl.querySelector(':scope > .old-toggle');
    document.querySelectorAll('.old-list .article-card').forEach(function(card){
      var article = map[cardId(card)];
      if (!article || isoDate(article.date) !== scanDay) return;
      card.dataset.currentScan = 'true';
      card.classList.remove('unread');
      if (oldToggle && oldToggle.parentNode === feedEl) feedEl.insertBefore(card, oldToggle);
      else feedEl.appendChild(card);
    });
  }

  function schedulePromotion(feed){
    [0, 120, 400, 900, 1800, 3200].forEach(function(delay){
      setTimeout(function(){ promoteCurrentScanArticles(feed); }, delay);
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

  function apply(){
    if (running) return;
    running = true;
    injectStyle();
    loadFeed().then(function(feed){
      renderMissing(feed);
      schedulePromotion(feed);
    }).finally(function(){
      document.querySelectorAll('.article-card').forEach(moveDetailActions);
      running = false;
    });
  }

  window.addEventListener('click', function(e){
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
