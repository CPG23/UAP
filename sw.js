var CACHE = 'uap-v3';
var META  = 'uap-meta-v1';

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
        keys.filter(function(k) { return k !== CACHE && k !== META; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).catch(function() {
      return caches.match(e.request).then(function(r) { return r || caches.match('./'); });
    })
  );
});

self.addEventListener('periodicsync', function(e) {
  if (e.tag === 'daily-news') e.waitUntil(fetchAndNotify());
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var art = e.notification.data || {};
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(cs) {
      if (cs.length > 0) {
        cs[0].focus();
        cs[0].postMessage({ type: 'NOTIFICATION_ARTICLE', data: art });
        return;
      }
      return self.clients.openWindow('./').then(function(c) {
        if (c) setTimeout(function() { c.postMessage({ type: 'NOTIFICATION_ARTICLE', data: art }); }, 1800);
      });
    })
  );
});

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
      var id    = link.replace(/[^a-z0-9]/gi, '').substring(0, 40);
      if (!id || seenIds.indexOf(id) > -1) continue;
      if (pd && now - new Date(pd).getTime() > week) continue;
      newArts.push({ id: id, title: title, source: src || 'UAP News', url: link });
    }

    if (newArts.length === 0) return;

    var first = newArts[0];
    var count = newArts.length;
    var body  = first.title + (count > 1 ? '\n+ ' + (count - 1) + ' weitere Meldung' + (count > 2 ? 'en' : '') : '');

    await self.registration.showNotification(
      'UAP NEWS — ' + count + ' neue Meldung' + (count > 1 ? 'en' : ''), {
        body: body, tag: 'uap-daily', renotify: true,
        data: { articles: newArts, first: first },
        icon: './', badge: './'
      }
    );

    var newIds = seenIds.concat(newArts.map(function(a) { return a.id; })).slice(-200);
    var mc2    = await caches.open(META);
    await mc2.put('seen-ids', new Response(JSON.stringify(newIds), { headers: { 'Content-Type': 'application/json' } }));
  } catch(err) {
    console.log('[SW periodic]', err);
  }
}
