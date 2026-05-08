(function(){
  'use strict';

  var STYLE_ID = 'uap-final-ui-order-style';
  var feedPromise = null;
  var applying = false;
  var queued = false;
  var patchedSeenDom = false;

  function injectStyle(){
    var existing = document.getElementById(STYLE_ID);
    if (existing) existing.remove();
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#loading .startup-panel,#loading-status,.startup-panel-label{display:none!important}',
      '#loading .startup-panel-wrap{bottom:22px!important;gap:0!important}',
      '.article-card h2{color:#045b80!important;text-shadow:none!important;font-weight:500!important}',
      '.quality-top-help,.article-date-prominent,.article-card .badge{border:1px solid rgba(0,255,157,.42)!important;background:rgba(0,255,157,.075)!important;color:#c6ffe4!important;box-shadow:0 0 16px rgba(0,255,157,.12)!important}',
      '.article-date-prominent::before{color:#c6ffe4!important}',
      '.article-card .badge.quality::after{color:#c6ffe4!important;border-color:rgba(0,255,157,.42)!important;background:rgba(0,255,157,.075)!important}',
      '.old-toggle{color:#c6ffe4!important;border-color:rgba(0,255,157,.42)!important;background:rgba(0,255,157,.075)!important;box-shadow:0 0 16px rgba(0,255,157,.12)!important}',
      '.old-list.collapsed{display:none!important}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function isSeenBlock(node){
    return !!(node && node.classList && (node.classList.contains('old-toggle') || node.classList.contains('old-list')) && node.parentElement && node.parentElement.id === 'feed');
  }

  function patchSeenDom(){
    if (patchedSeenDom || !window.Element || !window.Node) return;
    patchedSeenDom = true;
    var nativeRemove = Element.prototype.remove;
    var nativeAppendChild = Node.prototype.appendChild;

    Element.prototype.remove = function(){
      if (isSeenBlock(this)) return undefined;
      return nativeRemove.call(this);
    };

    Node.prototype.appendChild = function(child){
      if (this && this.id === 'feed' && child && child.classList) {
        if (child.classList.contains('old-toggle')) {
          var existingToggle = this.querySelector(':scope > .old-toggle');
          if (existingToggle && existingToggle !== child) return child;
        }
        if (child.classList.contains('old-list')) {
          var existingList = this.querySelector(':scope > .old-list');
          if (existingList && existingList !== child) {
            while (child.firstChild) existingList.appendChild(child.firstChild);
            return child;
          }
        }
      }
      return nativeAppendChild.call(this, child);
    };

    patchSeenDom.nativeRemove = nativeRemove;
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

  function articleInfo(card, map){
    return map[cardId(card)] || { article: {}, index: 9999 };
  }

  function qualityOf(card, map){
    var info = articleInfo(card, map);
    var q = Number(info.article && info.article.quality);
    if (!isNaN(q)) return q;
    var badge = card.querySelector('.badge.quality');
    var match = badge && String(badge.textContent || '').match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  function removeDuplicateSeenBlocks(feedEl){
    var toggles = Array.prototype.slice.call(feedEl.querySelectorAll(':scope > .old-toggle'));
    var lists = Array.prototype.slice.call(feedEl.querySelectorAll(':scope > .old-list'));
    var nativeRemove = patchSeenDom.nativeRemove || Element.prototype.remove;
    toggles.slice(1).forEach(function(toggle){ nativeRemove.call(toggle); });
    if (lists.length > 1) {
      var keep = lists[0];
      lists.slice(1).forEach(function(list){
        while (list.firstChild) keep.appendChild(list.firstChild);
        nativeRemove.call(list);
      });
    }
  }

  function ensureSeenBlock(feedEl){
    removeDuplicateSeenBlocks(feedEl);
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
      toggle.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        list.classList.toggle('collapsed');
        toggle.dataset.userOpened = list.classList.contains('collapsed') ? '0' : '1';
        updateSeenLabel(toggle, list, list.classList.contains('collapsed'));
      }, true);
    }
    return { toggle: toggle, list: list };
  }

  function updateSeenLabel(toggle, list, collapsed){
    var count = list.querySelectorAll('.article-card').length;
    toggle.textContent = (collapsed ? '▸ ' : '▾ ') + 'Bereits gelesen (' + count + ')';
  }

  function sortCurrent(cards, map){
    return cards.sort(function(a, b){
      return articleInfo(a, map).index - articleInfo(b, map).index;
    });
  }

  function sortSeenByQuality(cards, map){
    return cards.sort(function(a, b){
      var qualityDiff = qualityOf(b, map) - qualityOf(a, map);
      if (qualityDiff) return qualityDiff;
      var dateDiff = isoDate(articleInfo(b, map).article.date).localeCompare(isoDate(articleInfo(a, map).article.date));
      if (dateDiff) return dateDiff;
      return articleInfo(a, map).index - articleInfo(b, map).index;
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
      var data = articleInfo(card, map);
      var date = data && data.article ? isoDate(data.article.date) : '';
      if (date === today) current.push(card);
      else alreadySeen.push(card);
    });

    sortCurrent(current, map).forEach(function(card){
      feedEl.insertBefore(card, seen.toggle);
    });
    sortSeenByQuality(alreadySeen, map).forEach(function(card){
      seen.list.appendChild(card);
    });

    var collapsed = current.length > 0 && seen.toggle.dataset.userOpened !== '1';
    seen.list.classList.toggle('collapsed', collapsed);
    updateSeenLabel(seen.toggle, seen.list, collapsed);
  }

  function apply(){
    queued = false;
    if (applying) return;
    applying = true;
    patchSeenDom();
    injectStyle();
    loadFeed().then(enforceOrder).finally(function(){ applying = false; });
  }

  function queueApply(){
    if (queued) return;
    queued = true;
    var run = window.requestAnimationFrame || function(cb){ return setTimeout(cb, 16); };
    run(apply);
  }

  function schedule(){
    apply();
    setTimeout(queueApply, 500);
    setTimeout(queueApply, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
  new MutationObserver(queueApply).observe(document.documentElement, { childList:true, subtree:true });
})();
