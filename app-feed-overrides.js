(function() {
  'use strict';

  var STYLE_ID = 'uap-feed-overrides-style';
  var processing = false;
  var readIds = loadReadIds();
  var notificationIds = getNotificationIds();
  var notificationMode = notificationIds.length > 0;
  var NTFY_TOPIC = 'UAP-News26';

  function loadReadIds() {
    try { return JSON.parse(localStorage.getItem('uap_read_ids_v1') || '[]'); } catch (e) { return []; }
  }
  function saveReadIds() {
    try { localStorage.setItem('uap_read_ids_v1', JSON.stringify(readIds.slice(-600))); } catch (e) {}
  }
  function getNotificationIds() {
    try {
      var raw = new URLSearchParams(window.location.search).get('ids') || '';
      return raw.split(',').map(function(id) { return id.trim(); }).filter(Boolean);
    } catch (e) { return []; }
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
      '#loading{background:rgba(3,10,15,.86)!important;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}',
      '.alien-head{width:min(760px,120vw)!important;max-width:none!important;animation:uapAlienDeepZoom 9s ease-in-out infinite!important;opacity:.72!important}',
      '@keyframes uapAlienDeepZoom{0%,100%{opacity:.62;transform:scale(1.08);filter:brightness(.62) saturate(1.2) drop-shadow(0 0 22px rgba(0,212,255,.95)) drop-shadow(0 0 52px rgba(0,212,255,.55))}50%{opacity:.92;transform:scale(1.92);filter:brightness(.9) saturate(1.55) drop-shadow(0 0 42px rgba(0,212,255,1)) drop-shadow(0 0 84px rgba(0,212,255,.72)) drop-shadow(0 0 120px rgba(0,255,157,.32))}}',
      '.startup-panel{display:none!important}',
      '.brand{position:relative;padding-left:2px}',
      '.brand-title{display:inline-block!important;position:relative;color:#eafcff!important;font-family:"Rajdhani",sans-serif!important;font-weight:700!important;font-size:clamp(28px,8vw,46px)!important;line-height:.92!important;letter-spacing:2px!important;text-shadow:0 0 8px rgba(255,255,255,.65),0 0 22px rgba(0,212,255,.9),0 0 44px rgba(0,255,157,.35)!important}',
      '.brand-title::after{content:"";position:absolute;left:1px;right:0;bottom:-7px;height:2px;background:linear-gradient(90deg,#00d4ff,#00ff9d,transparent);box-shadow:0 0 18px rgba(0,212,255,.95)}',
      '.brand-sub{margin-top:10px!important;color:#9fc7d4!important;letter-spacing:2.4px!important}',
      '.status{padding-top:4px}',
      '.quality-help{margin:-4px 0 14px;color:#8aa6b3;font-family:"Share Tech Mono",monospace;font-size:10px;line-height:1.55;border-left:2px solid rgba(0,212,255,.5);padding-left:10px}',
      '.article-topline{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:9px}',
      '.article-topline .badges{justify-content:flex-end;margin:0;flex:1 1 auto}',
      '.article-date-prominent{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;color:#d7f6ff;border:1px solid rgba(0,212,255,.42);background:rgba(0,212,255,.085);padding:4px 8px;font-family:"Share Tech Mono",monospace;font-size:11px;letter-spacing:1.2px;white-space:nowrap}',
      '.article-date-prominent::before{content:"DATUM";color:#00d4ff;font-size:9px;letter-spacing:1.4px}',
      '.badge.quality{cursor:pointer}',
      '.notify-btn{position:relative}',
      '.notify-btn.active{color:#07130f!important;border-color:rgba(0,255,157,.9)!important;background:#00ff9d!important;box-shadow:0 0 18px rgba(0,255,157,.38)}',
      '.notify-btn.blocked{color:#ffb69c!important;border-color:rgba(255,107,53,.5)!important;background:rgba(255,107,53,.08)!important}',
      '.notify-info{margin:0 0 14px;padding:10px 12px;border:1px solid rgba(0,212,255,.28);background:rgba(0,212,255,.055);color:#a9cbd7;font-family:"Share Tech Mono",monospace;font-size:10px;line-height:1.5}',
      '.quality-overlay{position:fixed;inset:0;z-index:2500;display:flex;align-items:flex-end;justify-content:center;padding:18px;background:rgba(1,6,10,.72);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}',
      '.quality-sheet{width:min(520px,100%);border:1px solid rgba(0,212,255,.48);background:linear-gradient(180deg,rgba(8,20,32,.98),rgba(3,10,15,.98));box-shadow:0 0 36px rgba(0,212,255,.22);padding:16px 16px 14px;color:#d6e8f0}',
      '.quality-sheet h3{margin:0 0 8px;color:#00d4ff;font-family:"Rajdhani",sans-serif;font-size:21px;letter-spacing:0}',
      '.quality-score-line{font-family:"Share Tech Mono",monospace;color:#00ff9d;font-size:12px;margin-bottom:12px}',
      '.quality-sheet p{margin:0 0 12px;color:#9db6c2;font-size:13px;line-height:1.5}',
      '.quality-rules{display:grid;gap:7px;margin:0 0 14px}',
      '.quality-rule{display:grid;grid-template-columns:82px 1fr;gap:10px;align-items:start;border-top:1px solid rgba(13,58,92,.72);padding-top:7px;font-size:12px;line-height:1.4;color:#b7ccd5}',
      '.quality-points{color:#00d4ff;font-family:"Share Tech Mono",monospace;font-size:11px;white-space:nowrap}',
      '.quality-close{width:100%;height:38px;border:1px solid rgba(0,212,255,.42);background:rgba(0,212,255,.07);color:#00d4ff;font-family:"Share Tech Mono",monospace;font-size:11px;letter-spacing:1.8px;cursor:pointer}',
      '.old-toggle{width:100%;margin:6px 0 12px;padding:11px 12px;border:1px solid rgba(13,58,92,.9);background:rgba(8,20,32,.82);color:#00d4ff;font-family:"Share Tech Mono",monospace;font-size:11px;letter-spacing:1.5px;text-align:left;cursor:pointer}',
      '.old-list{display:flex;flex-direction:column;gap:12px}',
      '.old-list.collapsed{display:none}',
      '.notification-focus{margin:0 0 14px;padding:11px 12px;border:1px solid rgba(0,255,157,.35);background:rgba(0,255,157,.06);color:#b5f5d4;font-family:"Share Tech Mono",monospace;font-size:10px;line-height:1.55}',
      '.uap-hidden-by-notification{display:none!important}',
      '@media(max-width:560px){.header-inner{gap:10px}.brand-title{font-size:clamp(27px,10vw,39px)!important;letter-spacing:1px!important}.status{font-size:8px!important}}',
      '@media(max-width:420px){.article-topline{gap:8px}.article-date-prominent{font-size:10px;padding:4px 6px}.article-topline .badge{font-size:8px;padding:2px 5px}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function addQualityHelp() {
    if (document.querySelector('.quality-help')) return;
    var notice = document.getElementById('notice');
    if (!notice || !notice.parentNode) return;
    var help = document.createElement('div');
    help.className = 'quality-help';
    help.textContent = 'Tipp auf die Wertung zeigt die einfache Punkte-Erklärung.';
    notice.parentNode.insertBefore(help, notice);
  }
  function cleanToolbar() {
    document.querySelectorAll('a.icon-btn[href*="latest-news.json"]').forEach(function(a) { a.remove(); });
    var meta = document.getElementById('feed-meta');
    if (meta) meta.textContent = '';
    addNotifyButton();
  }
  function setNotifyState(btn) {
    if (!btn) btn = document.getElementById('notify-btn');
    if (!btn) return;
    btn.classList.remove('active', 'blocked');
    var permission = ('Notification' in window) ? Notification.permission : 'unsupported';
    if (permission === 'granted') {
      btn.classList.add('active');
      btn.title = 'Push-Benachrichtigungen sind am Gerät erlaubt. Tippen öffnet den ntfy-Kanal UAP-News26.';
    } else if (permission === 'denied') {
      btn.classList.add('blocked');
      btn.title = 'Benachrichtigungen sind im Browser blockiert.';
    } else {
      btn.title = 'Push-Benachrichtigungen aktivieren';
    }
  }
  function addNotifyButton() {
    var row = document.querySelector('.button-row');
    if (!row || document.getElementById('notify-btn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'notify-btn';
    btn.className = 'icon-btn notify-btn';
    btn.setAttribute('aria-label', 'Push-Benachrichtigungen aktivieren');
    btn.textContent = '🔔';
    row.insertBefore(btn, row.firstChild);
    setNotifyState(btn);
  }
  function showNotifyInfo(text) {
    var notice = document.getElementById('notice');
    if (!notice || !notice.parentNode) return;
    var box = document.querySelector('.notify-info');
    if (!box) {
      box = document.createElement('div');
      box.className = 'notify-info';
      notice.parentNode.insertBefore(box, notice);
    }
    box.textContent = text;
    clearTimeout(showNotifyInfo.timer);
    showNotifyInfo.timer = setTimeout(function() { if (box.parentNode) box.remove(); }, 9000);
  }
  function openNtfy() {
    var url = 'https://ntfy.sh/' + encodeURIComponent(NTFY_TOPIC);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  function activateNotifications() {
    if (!('Notification' in window)) {
      showNotifyInfo('Dieses Gerät unterstützt Browser-Benachrichtigungen hier nicht. Der ntfy-Kanal UAP-News26 wird geöffnet, dort kannst du das Abo aktivieren.');
      openNtfy();
      return;
    }
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(function() {
        setNotifyState();
        showNotifyInfo('Die Browser-Berechtigung wurde geprüft. Für dauerhafte Pushs öffnet sich jetzt UAP-News26 in ntfy; das Abo liegt beim Gerät und nicht im App-Cache.');
        openNtfy();
      });
      return;
    }
    if (Notification.permission === 'denied') {
      setNotifyState();
      showNotifyInfo('Benachrichtigungen sind im Browser blockiert. Bitte in den Browser- oder App-Einstellungen erlauben. UAP-News26 wird trotzdem in ntfy geöffnet.');
      openNtfy();
      return;
    }
    setNotifyState();
    showNotifyInfo('Benachrichtigungen sind erlaubt. UAP-News26 wird in ntfy geöffnet; dort bleibt das Abo unabhängig vom App-Cache erhalten.');
    openNtfy();
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

  function rebuildArticleHeader(card) {
    var main = card.querySelector('.article-main');
    if (!main) return;
    var h2 = main.querySelector('h2');
    var badges = main.querySelector('.badges');
    var meta = main.querySelector('.meta');
    if (!h2 || !badges || !meta) return;
    var dateSpan = meta.querySelector('span:last-child');
    if (!dateSpan) return;
    dateSpan.className = 'article-date-prominent';
    var top = main.querySelector('.article-topline');
    if (!top) {
      top = document.createElement('div');
      top.className = 'article-topline';
      main.insertBefore(top, h2);
    }
    if (dateSpan.parentNode !== top) top.appendChild(dateSpan);
    if (badges.parentNode !== top) top.appendChild(badges);
    if (meta && meta.parentNode) meta.remove();
  }

  function qualityNumberFromBadge(badge) {
    var match = String(badge && badge.textContent || '').match(/(\d+)/);
    return match ? match[1] : '-';
  }
  function showQualityOverlay(score) {
    closeQualityOverlay();
    var overlay = document.createElement('div');
    overlay.className = 'quality-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
      '<div class="quality-sheet">' +
        '<h3>Wertung ' + score + '</h3>' +
        '<div class="quality-score-line">Je höher, desto relevanter und verlässlicher wirkt das Thema.</div>' +
        '<p>Die App bewertet nicht, ob eine Behauptung wahr ist. Sie schätzt nur ein, wie wichtig und belastbar ein Artikel für UAP-News wirkt.</p>' +
        '<div class="quality-rules">' +
          '<div class="quality-rule"><span class="quality-points">Basis</span><span>Der Artikel muss klar mit UAP/UFO zu tun haben. Filme, Spiele und reine Unterhaltung werden herausgefiltert.</span></div>' +
          '<div class="quality-rule"><span class="quality-points">mehr</span><span>UAP/UFO steht direkt im Titel oder wird im Text deutlich erwähnt.</span></div>' +
          '<div class="quality-rule"><span class="quality-points">mehr</span><span>Offizielle Stellen wie NASA, Pentagon, AARO, Congress, Senate oder Regierungsdokumente kommen vor.</span></div>' +
          '<div class="quality-rule"><span class="quality-points">mehr</span><span>Die Quelle ist offiziell oder ein etabliertes Medium, zum Beispiel Reuters, AP, BBC, NBC, The Guardian, Newsweek oder ähnliche.</span></div>' +
          '<div class="quality-rule"><span class="quality-points">mehr</span><span>Mehrere unabhängige Quellen berichten über dasselbe Thema.</span></div>' +
          '<div class="quality-rule"><span class="quality-points">weniger</span><span>Unklare, reißerische oder schwache Quellen bekommen keinen Vertrauensbonus.</span></div>' +
        '</div>' +
        '<button type="button" class="quality-close">SCHLIESSEN</button>' +
      '</div>';
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay || e.target.classList.contains('quality-close')) closeQualityOverlay();
    });
    document.body.appendChild(overlay);
  }
  function closeQualityOverlay() {
    var existing = document.querySelector('.quality-overlay');
    if (existing) existing.remove();
  }

  function cleanCard(card) {
    if (!card) return;
    var id = card.dataset.uapId || idForCard(card);
    card.dataset.uapId = id;
    card.querySelectorAll('.badges .badge').forEach(function(badge) {
      if (!badge.classList.contains('sources') && !badge.classList.contains('quality')) badge.remove();
    });
    var q = card.querySelector('.badge.quality');
    if (q) {
      q.title = 'Antippen, um die Punkteberechnung zu sehen.';
      q.setAttribute('role', 'button');
      q.setAttribute('tabindex', '0');
      q.textContent = q.textContent.replace(/^Q\s*/i, 'Wertung ');
    }
    rebuildArticleHeader(card);
    card.querySelectorAll('.action-link').forEach(function(a) { a.remove(); });
    card.querySelectorAll('.translation').forEach(function(t) { t.remove(); });
    if (!isRead(id)) card.classList.add('unread');
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
    if (card) card.classList.remove('unread');
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
    setNotifyState();
  }

  document.addEventListener('click', function(e) {
    var notify = e.target.closest && e.target.closest('#notify-btn');
    if (!notify) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    activateNotifications();
  }, true);
  document.addEventListener('click', function(e) {
    var quality = e.target.closest && e.target.closest('.badge.quality');
    if (!quality) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    showQualityOverlay(qualityNumberFromBadge(quality));
  }, true);
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeQualityOverlay();
    var quality = e.target.closest && e.target.closest('.badge.quality');
    if (quality && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      showQualityOverlay(qualityNumberFromBadge(quality));
    }
  }, true);
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
