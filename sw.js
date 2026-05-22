var CACHE = 'uap-v224-manual-scan-no-refresh';
var META  = 'uap-meta-v1';
var OVERRIDE_VERSION = '224';
var OVERRIDE_FILES = [
  'uap-fast-app.js',
  'uap-header-retry-fix.js',
  'uap-manual-scan.js',
  'uap-notify-button-fix.js',
  'uap-source-date-fix.js',
  'uap-fast-start-hide.js'
];
var OLD_OVERRIDE_FILES = [
  'uap-feed-normalize.js',
  'uap-app-overrides.js',
  'uap-source-new-badge-fix.js',
  'uap-quality-overlay-fix.js',
  'uap-controls-layout-fix.js',
  'uap-final-stability-fix.js',
  'uap-open-guard-fix.js',
  'uap-new-badge-guard-fix.js',
  'uap-startup-alien.js',
  'uap-startup-animation-final.js',
  'uap-startup-visible-fix.js',
  'uap-logo-scan-line.js',
  'uap-ui-polish.js',
  'uap-logo-final-polish.js',
  'uap-startscreen-empty-fix.js',
  'uap-startscreen-banner-fix.js',
  'uap-startscreen-wallpaper.js',
  'uap-visual-final-fix.js',
  'uap-startscreen-reveal-fix.js',
  'uap-startscreen-master-fix.js'
];
var NO_STORE_FILES = OVERRIDE_FILES.concat(OLD_OVERRIDE_FILES);

var STARTUP_STILL_STYLE = '\n#loading{display:none!important;visibility:hidden!important;pointer-events:none!important;}\n';

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
        clients.forEach(function(client) { client.postMessage({ type: 'SW_UPDATED' }); });
      });
    })
  );
});

function scriptTag(file) {
  return '<script src="./' + file + '?v=' + OVERRIDE_VERSION + '"></script>';
}

function stripScripts(html) {
  OLD_OVERRIDE_FILES.concat(OVERRIDE_FILES).forEach(function(file) {
    var escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp('<script[^>]*' + escaped + '[^>]*><\\/script>', 'g'), '');
  });
  return html;
}

function normalizeStartupMarkup(html) {
  html = html.replace(/<div id="loading"[\s\S]*?<\/div>/, '<div id="loading" aria-hidden="true"></div>');
  html = html.replace('</style>', STARTUP_STILL_STYLE + '</style>');
  return html;
}

function withFastApp(resp) {
  var headers = new Headers(resp.headers);
  headers.set('Cache-Control', 'no-store');
  return resp.text().then(function(html) {
    html = stripScripts(html);
    html = normalizeStartupMarkup(html);
    html = html.replace('</body>', OVERRIDE_FILES.map(scriptTag).join('') + '</body>');
    return new Response(html, { status: resp.status, statusText: resp.statusText, headers: headers });
  });
}

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);

  if (e.request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/UAP/')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).then(function(resp) {
        return withFastApp(resp.clone());
      }).catch(function() {
        return caches.match(e.request).then(function(cached) {
          return cached ? withFastApp(cached.clone()) : new Response('Offline', { status: 503 });
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

  if (NO_STORE_FILES.some(function(file) { return url.pathname.endsWith('/' + file); })) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }));
    return;
  }

  e.respondWith(fetch(e.request).catch(function() { return caches.match(e.request); }));
});