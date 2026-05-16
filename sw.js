var CACHE = 'uap-v191-startscreen-wallpaper-header';
var META  = 'uap-meta-v1';
var OVERRIDE_VERSION = '191';
var OVERRIDE_FILES = [
  'uap-startup-visible-fix.js',
  'uap-feed-normalize.js',
  'uap-app-overrides.js',
  'uap-logo-scan-line.js',
  'uap-ui-polish.js',
  'uap-logo-final-polish.js',
  'uap-header-retry-fix.js',
  'uap-startscreen-empty-fix.js'
];

var STARTUP_EMPTY_HTML = '<div id="loading" aria-hidden="true"></div>';
var STARTUP_BOOT_SCRIPT = '<script src="./uap-startscreen-wallpaper.js?v=' + OVERRIDE_VERSION + '"></script>';

var STARTUP_STILL_STYLE = '\n#loading{position:fixed!important;inset:0!important;z-index:1000!important;display:block!important;background:#02070b!important;overflow:hidden!important;animation:uapStartupHide 5s forwards!important;}\n#loading.hidden{opacity:0!important;visibility:hidden!important;pointer-events:none!important;}\n#loading>*{display:none!important;visibility:hidden!important;opacity:0!important;}\n@keyframes uapStartupHide{0%,94%{opacity:1;visibility:visible;pointer-events:auto;}100%{opacity:0;visibility:hidden;pointer-events:none;}}\n';

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

function stripOverrideScripts(html) {
  [
    'uap-startup-alien.js',
    'uap-startup-animation-final.js',
    'uap-startup-visible-fix.js',
    'uap-feed-normalize.js',
    'uap-app-overrides.js',
    'uap-logo-scan-line.js',
    'uap-ui-polish.js',
    'uap-logo-final-polish.js',
    'uap-header-retry-fix.js',
    'uap-startscreen-wallpaper.js',
    'uap-startscreen-empty-fix.js'
  ].forEach(function(file) {
    var escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp('<script[^>]*' + escaped + '[^>]*><\\/script>', 'g'), '');
  });
  return html;
}

function replaceStartupMarkup(html) {
  return html.replace(/<div id="loading"[\s\S]*?<\/div>\s*<header>/, STARTUP_EMPTY_HTML + STARTUP_BOOT_SCRIPT + '\n<header>');
}

function withFeedOverrides(resp) {
  var headers = new Headers(resp.headers);
  headers.set('Cache-Control', 'no-store');
  return resp.text().then(function(html) {
    html = stripOverrideScripts(html);
    html = replaceStartupMarkup(html);
    html = html.replace('</style>', STARTUP_STILL_STYLE + '</style>');
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

  if (OVERRIDE_FILES.concat(['uap-startscreen-wallpaper.js']).some(function(file) { return url.pathname.endsWith('/' + file); })) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }));
    return;
  }

  if (url.pathname.endsWith('/UFO-Logo.png')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }));
    return;
  }

  e.respondWith(
    fetch(e.request).catch(function() { return caches.match(e.request); })
  );
});