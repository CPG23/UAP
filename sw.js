var CACHE = 'uap-v72-latest-polish';
var META  = 'uap-meta-v1';
var OVERRIDE_VERSION = '72';
var OVERRIDE_FILES = [
  'translation-override-fix.js',
  'app-feed-overrides.js',
  'bell-icon-fix.js',
  'notification-guide-fix.js',
  'quality-affordance-fix.js',
  'logo-title-fix.js',
  'startup-polish-fix.js',
  'summary-fallback-fix.js',
  'quality-wording-fix.js',
  'quality-order-startup-fix.js',
  'summary-metadata-fix.js',
  'quality-info-points-fix.js',
  'article-detail-rating-fix.js',
  'notification-direct-fix.js',
  'all-articles-layout-fix.js',
  'final-ui-order-fix.js',
  'scroll-heading-fix.js',
  'latest-polish-fix.js'
];

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

function scriptTag(file) {
  return '<script src="./' + file + '?v=' + OVERRIDE_VERSION + '"></script>';
}

function withFeedOverrides(resp) {
  var headers = new Headers(resp.headers);
  headers.set('Cache-Control', 'no-store');
  return resp.text().then(function(html) {
    var startupHide = '<style id="uap-startup-panel-hard-hide">#loading .startup-panel,#loading .startup-panel-label,#loading-status{display:none!important}#loading .startup-panel-wrap{bottom:22px!important;gap:0!important}</style>';
    if (html.indexOf('uap-startup-panel-hard-hide') === -1) {
      html = html.replace('</head>', startupHide + '</head>');
    }
    html = html.replace(/<div class="startup-panel">\s*<div class="startup-panel-label">[\s\S]*?<\/div>\s*<div id="loading-status">[\s\S]*?<\/div>\s*<\/div>\s*<div class="loading-bar">/m, '<div class="loading-bar">');
    if (html.indexOf('app-feed-overrides.js') === -1) {
      html = html.replace('</body>', OVERRIDE_FILES.map(scriptTag).join('') + '</body>');
    } else {
      OVERRIDE_FILES.forEach(function(file) {
        var re = new RegExp(file.replace('.', '\\.') + '\\?v=\\d+', 'g');
        if (html.indexOf(file) === -1) {
          html = html.replace('</body>', scriptTag(file) + '</body>');
        } else {
          html = html.replace(re, file + '?v=' + OVERRIDE_VERSION);
        }
      });
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

  if (OVERRIDE_FILES.some(function(file) { return url.pathname.endsWith('/' + file); })) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }));
    return;
  }

  e.respondWith(
    fetch(e.request).catch(function() { return caches.match(e.request); })
  );
});
