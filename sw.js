var CACHE = 'uap-v12-hard-start-watchdog';
var META  = 'uap-meta-v1';

self.addEventListener('install', function(e) {
  // Don't pre-cache HTML - always fetch fresh from network
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE && k !== META; })
            .map(function(k) { return caches.delete(k); })
      );
    })
    .then(function() { return self.clients.claim(); })
    .then(function() {
      // Tell all open tabs to reload so they get the new version immediately
      return self.clients.matchAll({ type: 'window' }).then(function(clients) {
        clients.forEach(function(c) { c.postMessage({ type: 'SW_UPDATED' }); });
      });
    })
  );
});


self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  // Navigation requests (HTML): always bypass cache - get fresh from network
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' }).catch(function() {
        return caches.match('./') || new Response('Offline', { status: 503 });
      })
    );
    return;
  }
  // All other resources: network-first, cache fallback
  e.respondWith(
    fetch(e.request).catch(function() {
      return caches.match(e.request);
    })
  );
});

// Receive seen-IDs from the app after each scan
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SYNC_SEEN_IDS' && Array.isArray(e.data.ids)) {
    caches.open(META).then(function(c) {
      c.put('seen-ids', new Response(JSON.stringify(e.data.ids), { headers: { 'Content-Type': 'application/json' } }));
    });
  }
});

self.addEventListener('periodicsync', function(e) {
  if (e.tag === 'daily-news') e.waitUntil(fetchAndNotify());
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(cs) {
      if (cs.length > 0) {
        cs[0].focus();
        cs[0].postMessage({ type: 'NOTIFICATION_ARTICLE' });
        return;
      }
      return self.clients.openWindow('./');
    })
  );
});

function topicId(title) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim()
    .split(/\s+/).filter(function(w) { return w.length > 3; }).sort().join('-');
}

async function fetchAndNotify() {
  try {
    var seenIds = [];
    try {
      var mc = await caches.open(META);
      var r  = await mc.match('seen-ids');
      if (r) seenIds = await r.json();
    } catch(x) {}

    var q     = encodeURIComponent('UAP UFO 2026');
    var proxy = 'https://api.allorigins.win/get?url='
              + encodeURIComponent('https://news.google.com/rss/search?q=' + q + '&hl=en&gl=US&ceid=US:en');
    var resp  = await fetch(proxy, { signal: AbortSignal.timeout(20000) });
    var json  = await resp.json();
    var xml   = json.contents || '';
    var items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

    var newArts = [];
    var now  = Date.now();
    var week = 7 * 24 * 60 * 60 * 1000;

    for (var i = 0; i < items.length && newArts.length < 5; i++) {
      var it    = items[i];
      var title = (it.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || ['',''])[1].trim();
      var link  = (it.match(/<link>([\s\S]*?)<\/link>/)                              || ['',''])[1].trim();
      var src   = (it.match(/<source[^>]*>([\s\S]*?)<\/source>/)                     || ['',''])[1].trim();
      var pd    = (it.match(/<pubDate>([\s\S]*?)<\/pubDate>/)                         || ['',''])[1].trim();
      if (!title) continue;
      var id = topicId(title);
      if (!id || seenIds.indexOf(id) > -1) continue;
      if (pd && now - new Date(pd).getTime() > week) continue;
      newArts.push({ id: id, title: title, source: src || 'UAP News', url: link });
    }

    var count = newArts.length;
    var notifTitle, body;
    if (count === 0) {
      notifTitle = 'UAP NEWS - Keine neuen Meldungen';
      body = 'Seit dem letzten Check gibt es keine neuen UAP-Artikel.';
    } else {
      notifTitle = 'UAP NEWS - ' + count + ' neue Meldung' + (count > 1 ? 'en' : '');
      body = newArts[0].title + (count > 1 ? '\n+ ' + (count - 1) + ' weitere Meldung' + (count > 2 ? 'en' : '') : '');
    }

    await self.registration.showNotification(notifTitle, {
      body: body, tag: 'uap-daily', renotify: true,
      icon: './', badge: './'
    });

    var newIds = seenIds.concat(newArts.map(function(a) { return a.id; })).slice(-200);
    var mc2 = await caches.open(META);
    await mc2.put('seen-ids', new Response(JSON.stringify(newIds), { headers: { 'Content-Type': 'application/json' } }));
  } catch(err) {
    console.log('[SW periodic]', err);
  }
}
