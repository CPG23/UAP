(function(){
  'use strict';

  var STYLE_ID = 'uap-final-ui-order-style';
  var feedPromise = null;
  var applying = false;

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#loading .startup-panel,#loading-status,.startup-panel-label{display:none!important}',
      '#loading .startup-panel-wrap{bottom:22px!important;gap:0!important}',
      '.article-card h2{color:#066f9a!important;text-shadow:none!important}',
      '.article-card .badge{border-color:rgba(255,255,255,.82)!important;color:#00b978!important;background:rgba(255,255,255,.035)!important;box-shadow:none!important}',
      '.article-card .badge.quality::after{color:#00b978!important;border-color:rgba(255,255,255,.72)!important;background:rgba(255,255,255,.04)!important}',
      '.old-toggle{color:#00b978!important;border-color:rgba(255,255,255,.58)!important;background:rgba(255,255,255,.035)!important}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function loadFeed(){
    if (!feedPromise) {
      feedPromise = fetch('latest-news.json?finalOrder=' + Date.now(), { cache: 'no-store' })
        .then(function(r){ return r.json(); })
        .catch(function(){ return { articles: [] }; });
    }
    return feedPromise;
  }

  function todayIso(){
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function isoDate(value){
    if (!value) return '';
    var d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
  }

  function slug(title){
    return String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function cardId(card){
    if (!card) return '';
    if (card.dataset && card.dataset.uapId) return card.dataset.uapId;
    var summary = card.querySelector('.summary[id]');
    if (summary && summary.id) return summary.id.replace(/^summary-/, '');
    var title = card.querySelector('h2');
    return title ? slug(title.textContent) : '';
  }

  function articleMap(feed){
    var map = {};
    (feed && feed.articles || []).forEach(function(article, index){
      var id = article.id || slug(article.title);
      if (id) map[id] = { article: article, index: index };
    });
    return map;
  }

  function ensureSeenBlock(feedEl){
    var toggle = feedEl.querySelector(':scope > .old-toggle');
    var list = feedEl.querySelector(':scope > .old-list');
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'old-toggle';
      feedEl.appendChild(toggle);
    }
    if (!list) {
      list = document.createElement('div');
      list.className = 'old-list';
      feedEl.appendChild(list);
    }
    if (!toggle.dataset.finalSeenBound) {
      toggle.dataset.finalSeenBound = '1';
      toggle.addEventListener('click', function(){
        list.classList.toggle('collapsed');
        updateSeenLabel(toggle, list, list.classList.contains('collapsed'));
      });
    }
    return { toggle: toggle, list: list };
  }

  function updateSeenLabel(toggle, list, collapsed){
    var count = list.querySelectorAll('.article-card').length;
    toggle.textContent = (collapsed ? '▸ ' : '▾ ') + 'Bereits gesehen (' + count + ')';
  }

  function sortByFeedOrder(cards, map){
    return cards.sort(function(a, b){
      var ai = map[cardId(a)] ? map[cardId(a)].index : 9999;
      var bi = map[cardId(b)] ? map[cardId(b)].index : 9999;
      return ai - bi;
    });
  }

  function enforceOrder(feed){
    var feedEl = document.getElementById('feed');
    if (!feedEl || !feed || !Array.isArray(feed.articles)) return;
    var map = articleMap(feed);
    var today = todayIso();
    var seen = ensureSeenBlock(feedEl);
    var allCards = Array.prototype.slice.call(feedEl.querySelectorAll('.article-card'));
    var current = [];
    var alreadySeen = [];

    allCards.forEach(function(card){
      var data = map[cardId(card)];
      var date = data && data.article ? isoDate(data.article.date) : '';
      if (date === today) current.push(card);
      else alreadySeen.push(card);
    });

    sortByFeedOrder(current, map).forEach(function(card){
      feedEl.insertBefore(card, seen.toggle);
    });
    sortByFeedOrder(alreadySeen, map).forEach(function(card){
      seen.list.appendChild(card);
    });

    var collapsed = current.length > 0;
    seen.list.classList.toggle('collapsed', collapsed);
    updateSeenLabel(seen.toggle, seen.list, collapsed);
  }

  function apply(){
    if (applying) return;
    applying = true;
    injectStyle();
    loadFeed().then(enforceOrder).finally(function(){ applying = false; });
  }

  function schedule(){
    setTimeout(apply, 0);
    setTimeout(apply, 500);
    setTimeout(apply, 1500);
    setTimeout(apply, 3500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
  new MutationObserver(function(){ setTimeout(apply, 250); }).observe(document.documentElement, { childList:true, subtree:true });
})();
