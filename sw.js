/* UAP SIGNAL — Service Worker */
var CACHE = 'uap-v2';
var STATE_CACHE = 'uap-state';

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      return c.addAll(['./']);
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE && k !== STATE_CACHE; })
          .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).catch(function() {
      return caches.match(e.request).then(function(r) {
        return r || caches.match('./');
      });
    })
  );
});

// ── Periodic Background Sync ────────────────────────────────────────────
self.addEventListener('periodicsync', function(e) {
  if (e.tag === 'uap-daily-check') {
    e.waitUntil(checkForNewArticles());
  }
});

// ── Notification click: open app ──────────────────────────────────
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(wins) {
      for (var i = 0; i < wins.length; i++) {
        if ('focus' in wins[i]) return wins[i].focus();
      }
      return clients.openWindow('./');
    })
  );
});

// ── Background article check ───────────────────────────────────────
async function checkForNewArticles() {
  try {
    var stateCache = await caches.open(STATE_CACHE);
    var stateResp = await stateCache.match('notify-state');
    var state = { seenIds: [], lastCheck: null };
    if (stateResp) {
      try { state = await stateResp.json(); } catch(x) {}
    }

    var cutoff = Date.now() - 48 * 3600 * 1000;
    var queries = ['UAP+UFO+2026', 'UFO+Pentagon+AARO+2026'];
    var newTitles = [];

    for (var qi = 0; qi < queries.length; qi++) {
      try {
        var rssUrl = 'https://news.google.com/rss/search?q=' + queries[qi] + '&hl=en-US&gl=US&ceid=US:en';
        var proxy = 'https://api.allorigins.win/get?url=' + encodeURIComponent(rssUrl);
        var r = await fetch(proxy);
        if (!r.ok) continue;
        var json = await r.json();
        var doc = new DOMParser().parseFromString(json.contents || '', 'text/xml');
        var items = Array.from(doc.querySelectorAll('item'));
        for (var ii = 0; ii < items.length; ii++) {
          var item = items[ii];
          var pubText = ((item.querySelector('pubDate') || {}).textContent || '').trim();
          var d = new Date(pubText);
          if (!d || isNaN(d.getTime()) || d.getTime() < cutoff) continue;
          var title = ((item.querySelector('title') || {}).textContent || '')
            .replace(/<![CDATA[|]]>/g, '').trim();
          if (!title) continue;
          var id = topicId(title);
          if (!state.seenIds.includes(id)) {
            newTitles.push(title);
            state.seenIds.push(id);
          }
        }
      } catch(ex) { /* skip on network error */ }
    }

    state.seenIds = state.seenIds.slice(-300);
    state.lastCheck = new Date().toISOString();
    await stateCache.put('notify-state', new Response(JSON.stringify(state), {
      headers: { 'Content-Type': 'application/json' }
    }));

    if (newTitles.length > 0) {
      var count = newTitles.length;
      var body = count === 1
        ? newTitles[0]
        : count + ' neue Meldungen — ' + newTitles[0];
      await self.registration.showNotification(
        'UAP SIGNAL ◈ ' + count + ' neue Meldung' + (count > 1 ? 'en' : ''),
        {
          body: body,
          icon: './icon-192.png',
          badge: './icon-192.png',
          tag: 'uap-news',
          renotify: true,
          data: { url: './' }
        }
      );
    }
  } catch(err) {
    console.warn('[UAP SW] Background check error:', err);
  }
}

function topicId(title) {
  var STOP = new Set(['a','an','the','to','of','for','in','on','at','by','with','from',
    'and','or','is','are','was','were','be','been','has','have','had','will','would',
    'could','should','may','might','do','does','did','new','over','under','after',
    'before','about','as','into','its','it','this','that','what','how','why','says',
    'said','also','but','not','no','all','more','their','they','he','she','we','us',
    'you','uap','ufo','ufos','official','news','report','reports','latest','update']);
  var words = (title || '').toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(function(w) { return w.length > 2 && !STOP.has(w); })
    .sort();
  var key = words.slice(0, 4).join('-');
  var h = 0;
  for (var i = 0; i < key.length; i++) { h = ((h << 5) - h + key.charCodeAt(i)) | 0; }
  return 't' + Math.abs(h).toString(36);
}
