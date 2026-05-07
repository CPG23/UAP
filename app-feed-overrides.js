(function() {
  'use strict';

  var STYLE_ID = 'uap-feed-overrides-style';
  var processing = false;
  var readIds = loadReadIds();
  var notificationIds = getNotificationIds();
  var notificationMode = notificationIds.length > 0;

  function loadReadIds() {
    try { return JSON.parse(localStorage.getItem('uap_read_ids_v1') || '[]'); } catch (e) { return []; }
  }
  function getNotificationIds() {
    try {
      var params = new URLSearchParams(window.location.search);
      var raw = params.get('ids') || '';
      return raw.split(',').map(function(id) { return id.trim(); }).filter(Boolean);
    } catch (e) {
      return [];
    }
  }
  function saveReadIds() {
    try { localStorage.setItem('uap_read_ids_v1', JSON.stringify(readIds.slice(-600))); } catch (e) {}
  }
  function idForCard(card) {
    var summary = card && card.querySelector('.summary[id]');
    if (summary && summary.id) return summary.id.replace(/^summary-/, '');
    var title = card && card.querySelector('h2');
    return title ? title.textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : '';
  }
  function isRead(id) { return readIds.indexOf(id) !== -1; }
  function markRead(id) {
    if (!id || isRead(id)) return;
    readIds.push(id);
    saveReadIds();
  }
  function translateText(text) {
    var url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=de&dt=t&q=' + encodeURIComponent(text || '');
    return fetch(url).then(function(r) { return r.json(); }).then(function(data) {
      return data && data[0] ? data[0].map(function(part) { return part[0]; }).join('').trim() : '';
    });
  }
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.startup-panel{display:none!important}',
      '.quality-help{margin:-4px 0 14px;color:#8aa6b3;font-family:"Share Tech Mono",monospace;font-size:10px;line-height:1.55;border-left:2px solid rgba(0,212,255,.5);padding-left:10px}',
      '.badge.quality{cursor:help}',
      '.badge.new{color:#07130f!important;border-color:rgba(0,255,157,.9)!important;background:#00ff9d!important;font-weight:700}',
      '.old-toggle{width:100%;margin:6px 0 12px;padding:11px 12px;border:1px solid rgba(13,58,92,.9);background:rgba(8,20,32,.82);color:#00d4ff;font-family:"Share Tech Mono",monospace;font-size:11px;letter-spacing:1.5px;text-align:left;cursor:pointer}',
      '.old-list{display:flex;flex-direction:column;gap:12px}',
      '.old-list.collapsed{display:none}',
      '.article-card.unread::before{background:#00ff9d!important;opacity:1!important}',
      '.notification-focus{margin:0 0 14px;padding:11px 12px;border:1px solid rgba(0,255,157,.35);background:rgba(0,255,157,.06);color:#b5f5d4;font-family:"Share Tech Mono",monospace;font-size:10px;line-height:1.55}',
      '.uap-hidden-by-notification{display:none!important}'
    ].join('\n');
    document.head.appendChild(style);
  }
  function addQualityHelp() {
    if (document.querySelector('.quality-help')) return;
    var notice = document.getElementById('notice');
    if (!notice || !notice.parentNode) return;
    var help = document.createElement('div');
    help.className = 'quality-help';
    help.textContent = 'Wertung: UAP-Relevanz im Titel, offizielle Begriffe oder Institutionen, Anzahl unabhängiger Quellen und Themenbündelung.';
    notice.parentNode.insertBefore(help, notice);
  }
  function addNotificationFocus(count) {
    if (!notificationMode || document.querySelector('.notification-focus')) return;
    var feed = document.getElementById('feed');
    if (!feed || !feed.parentNode) return;
    var box = document.createElement('div');
    box.className = 'notification-focus';
    box.textContent = 'Aus Push-Benachrichtigung geöffnet: Es werden nur die ' + count + ' gemeldeten neuen Artikel angezeigt.';
    feed.parentNode.insertBefore(box, feed);
  }
  function cleanToolbar() {
    document.querySelectorAll('a.icon-btn[href*="latest-news.json"]').forEach(function(a) { a.remove(); });
    var meta = document.getElementById('feed-meta');
    if (meta) meta.textContent = notificationMode ? 'Neue Artikel aus Push-Benachrichtigung' : 'Gesammelte Nachrichten aus GitHub';
  }
  function cleanCard(card) {
    if (!card) return;
    var id = card.dataset.uapId || idForCard(card);
    card.dataset.uapId = id;
    if (card.dataset.uapCleaned !== '1') {
      card.dataset.uapCleaned = '1';
      card.querySelectorAll('.badges .badge').forEach(function(badge) {
        if (!badge.classList.contains('sources') && !badge.classList.contains('quality')) badge.remove();
      });
      var q = card.querySelector('.badge.quality');
      if (q) {
        q.title = 'Wertung: Relevanz, Quellenanzahl, offizielle Begriffe und Themenbündelung.';
        q.textContent = q.textContent.replace(/^Q\s*/i, 'Wertung ');
      }
      card.querySelectorAll('.action-link').forEach(function(a) { a.remove(); });
      card.querySelectorAll('.translation').forEach(function(t) { t.remove(); });
    }
    if (!isRead(id)) {
      card.classList.add('unread');
      var badges = card.querySelector('.badges');
      if (badges && !badges.querySelector('.badge.new')) {
        var n = document.createElement('span');
        n.className = 'badge new';
        n.textContent = 'NEU';
        badges.insertBefore(n, badges.firstChild);
      }
    }
  }
  function regroupCards() {
    var feed = document.getElementById('feed');
    if (!feed || processing) return;
    var cards = Array.prototype.slice.call(feed.querySelectorAll(':scope > .article-card'));
    if (!cards.length) return;
    processing = true;
    try {
      cards.forEach(cleanCard);
      feed.querySelectorAll(':scope > .old-toggle, :scope > .old-list').forEach(function(el) { el.remove(); });

      if (notificationMode) {
        var order = {};
        notificationIds.forEach(function(id, index) { order[id] = index; });
        var matched = cards.filter(function(card) { return order[card.dataset.uapId] !== undefined; });
        matched.sort(function(a, b) { return order[a.dataset.uapId] - order[b.dataset.uapId]; });
        cards.forEach(function(card) {
          if (order[card.dataset.uapId] === undefined) card.classList.add('uap-hidden-by-notification');
          else card.classList.remove('uap-hidden-by-notification');
        });
        matched.forEach(function(card) { feed.appendChild(card); });
        addNotificationFocus(matched.length || notificationIds.length);
        return;
      }

      cards.forEach(function(card) { card.classList.remove('uap-hidden-by-notification'); });
      var fresh = cards.filter(function(card) { return !isRead(card.dataset.uapId); });
      var old = cards.filter(function(card) { return isRead(card.dataset.uapId); });
      fresh.forEach(function(card) { feed.appendChild(card); });
      if (old.length) {
        var collapsed = fresh.length > 0;
        var toggle = document.createElement('button');
        var oldList = document.createElement('div');
        toggle.type = 'button';
        toggle.className = 'old-toggle';
        oldList.className = 'old-list' + (collapsed ? ' collapsed' : '');
        function label() { toggle.textContent = (collapsed ? '▸ ' : '▾ ') + 'Ältere Artikel (' + old.length + ')'; }
        label();
        toggle.addEventListener('click', function() {
          collapsed = !collapsed;
          oldList.classList.toggle('collapsed', collapsed);
          label();
        });
        old.forEach(function(card) { oldList.appendChild(card); });
        feed.appendChild(toggle);
        feed.appendChild(oldList);
      }
    } finally {
      processing = false;
    }
  }
  function markCardRead(card) {
    var id = card && (card.dataset.uapId || idForCard(card));
    markRead(id);
    if (card) {
      card.classList.remove('unread');
      var badge = card.querySelector('.badge.new');
      if (badge) badge.remove();
    }
    if (!notificationMode) setTimeout(regroupCards, 0);
  }
  function handleTranslate(e) {
    var btn = e.target.closest && e.target.closest('.translate-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    var card = btn.closest('.article-card');
    var title = card && card.querySelector('h2');
    var summary = card && card.querySelector('.summary');
    if (!card || !title || !summary) return;
    if (card.dataset.translated === '1') {
      title.textContent = card.dataset.originalTitle || title.textContent;
      summary.textContent = card.dataset.originalSummary || summary.textContent;
      card.dataset.translated = '0';
      btn.textContent = 'Übersetzen';
      return;
    }
    card.dataset.originalTitle = card.dataset.originalTitle || title.textContent;
    card.dataset.originalSummary = card.dataset.originalSummary || summary.textContent;
    btn.disabled = true;
    btn.textContent = 'Übersetze...';
    translateText(card.dataset.originalTitle + '\n|||\n' + card.dataset.originalSummary).then(function(text) {
      var parts = String(text || '').split('|||');
      title.textContent = (parts[0] || text || card.dataset.originalTitle).trim();
      summary.textContent = (parts[1] || card.dataset.originalSummary).trim();
      card.dataset.translated = '1';
      btn.textContent = 'Original anzeigen';
    }).catch(function() {
      btn.textContent = 'Übersetzung fehlgeschlagen';
    }).finally(function() {
      btn.disabled = false;
    });
  }
  function applyAll() {
    injectStyle();
    addQualityHelp();
    cleanToolbar();
    document.querySelectorAll('.article-card').forEach(cleanCard);
    regroupCards();
  }

  document.addEventListener('click', function(e) {
    if (e.target.closest && e.target.closest('.translate-btn')) handleTranslate(e);
  }, true);
  document.addEventListener('click', function(e) {
    var main = e.target.closest && e.target.closest('.article-main');
    if (main) markCardRead(main.closest('.article-card'));
  }, true);

  var observer = new MutationObserver(function() { setTimeout(applyAll, 0); });
  function start() {
    applyAll();
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
