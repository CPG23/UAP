var CACHE = 'uap-v31-startup-polish';
var META  = 'uap-meta-v1';

self.addEventListener('install', function(e) {
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
      return self.clients.matchAll({ type: 'window' }).then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({ type: 'SW_UPDATED' });
          if (client.url && client.navigate) client.navigate(client.url);
        });
      });
    })
  );
});

function withFeedOverrides(resp) {
  var headers = new Headers(resp.headers);
  headers.set('Cache-Control', 'no-store');
  return resp.text().then(function(html) {
    var scripts = '<script src="./app-feed-overrides.js?v=31"></script><script src="./bell-icon-fix.js?v=31"></script><script src="./notification-guide-fix.js?v=31"></script><script src="./quality-affordance-fix.js?v=31"></script><script src="./logo-title-fix.js?v=31"></script><script src="./startup-polish-fix.js?v=31"></script>';
    if (html.indexOf('app-feed-overrides.js') === -1) {
      html = html.replace('</body>', scripts + '</body>');
    } else {
      html = html.replace(/app-feed-overrides\.js\?v=\d+/g, 'app-feed-overrides.js?v=31');
      if (html.indexOf('bell-icon-fix.js') === -1) {
        html = html.replace('</body>', '<script src="./bell-icon-fix.js?v=31"></script></body>');
      } else {
        html = html.replace(/bell-icon-fix\.js\?v=\d+/g, 'bell-icon-fix.js?v=31');
      }
      if (html.indexOf('notification-guide-fix.js') === -1) {
        html = html.replace('</body>', '<script src="./notification-guide-fix.js?v=31"></script></body>');
      } else {
        html = html.replace(/notification-guide-fix\.js\?v=\d+/g, 'notification-guide-fix.js?v=31');
      }
      if (html.indexOf('quality-affordance-fix.js') === -1) {
        html = html.replace('</body>', '<script src="./quality-affordance-fix.js?v=31"></script></body>');
      } else {
        html = html.replace(/quality-affordance-fix\.js\?v=\d+/g, 'quality-affordance-fix.js?v=31');
      }
      if (html.indexOf('logo-title-fix.js') === -1) {
        html = html.replace('</body>', '<script src="./logo-title-fix.js?v=31"></script></body>');
      } else {
        html = html.replace(/logo-title-fix\.js\?v=\d+/g, 'logo-title-fix.js?v=31');
      }
      if (html.indexOf('startup-polish-fix.js') === -1) {
        html = html.replace('</body>', '<script src="./startup-polish-fix.js?v=31"></script></body>');
      } else {
        html = html.replace(/startup-polish-fix\.js\?v=\d+/g, 'startup-polish-fix.js?v=31');
      }
    }
    return new Response(html, { status: resp.status, statusText: resp.statusText, headers: headers });
  });
}

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);

  if (e.request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/UAP/')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).then(function(resp) {
        return withFeedOverrides(resp.clone());
      }).catch(function() {
        return caches.match(e.request).then(function(cached) {
          return cached ? withFeedOverrides(cached.clone()) : new Response('Offline', { status: 503 });
        });
      })
    );
    return;
  }

  if (url.pathname.endsWith('/latest-news.json')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).then(function(resp) {
        var copy = resp.clone();
        caches.open(CACHE).then(function(cache) { cache.put(e.request, copy); });
        return resp;
      }).catch(function() { return caches.match(e.request); })
    );
    return;
  }

  if (url.pathname.endsWith('/app-feed-overrides.js') || url.pathname.endsWith('/bell-icon-fix.js') || url.pathname.endsWith('/notification-guide-fix.js') || url.pathname.endsWith('/quality-affordance-fix.js') || url.pathname.endsWith('/logo-title-fix.js') || url.pathname.endsWith('/startup-polish-fix.js')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }));
    return;
  }

  e.respondWith(
    fetch(e.request).catch(function() { return caches.match(e.request); })
  );
});
