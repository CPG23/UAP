var CACHE = 'uap-v186-no-startup-alien';
var META  = 'uap-meta-v1';
var OVERRIDE_VERSION = '186';
var OVERRIDE_FILES = [
  'uap-startup-visible-fix.js',
  'uap-feed-normalize.js',
  'uap-app-overrides.js',
  'uap-logo-scan-line.js',
  'uap-ui-polish.js',
  'uap-logo-final-polish.js'
];

var STARTUP_LOGO_HTML = '<h1 class="startup-title uap-logo-final" aria-label="UAP-News" data-uap-logo-asset="1" data-uap-letters="1"></h1>';

var STARTUP_STILL_STYLE = '\n#loading{background:#000!important;background-color:#000!important;background-image:none!important;box-shadow:inset 0 0 0 100vmax #000!important;overflow:hidden!important;}\n#loading.hidden{pointer-events:none!important;}\n#loading .alien-head,#loading img.alien-head{display:none!important;visibility:hidden!important;opacity:0!important;animation:none!important;}\n#loading .startup-title{position:absolute!important;top:0!important;left:0!important;right:0!important;bottom:auto!important;display:block!important;width:100vw!important;height:36vw!important;min-height:132px!important;max-height:34vh!important;transform:none!important;margin:0!important;z-index:3!important;line-height:0!important;letter-spacing:0!important;text-shadow:none!important;background:#000!important;background-image:none!important;color:transparent!important;-webkit-text-fill-color:transparent!important;overflow:hidden!important;isolation:isolate!important;pointer-events:none!important;}\n#loading .startup-title::before,#loading .startup-title::after{display:none!important;content:none!important;}\n#loading .uap-logo-img,#loading .uap-header-banner-img{display:block!important;width:100%!important;height:100%!important;max-width:none!important;object-fit:contain!important;object-position:center top!important;background:#000!important;background-image:none!important;border:0!important;margin:0!important;padding:0!important;filter:none!important;animation:none!important;pointer-events:none!important;}\n#loading .uap-edge-letter,#loading .uap-edge-space,#loading .uap-news-s,#loading .uap-logo-letter,#loading .uap-logo-space{display:none!important;}\n#loading .loading-bar,#loading .uap-startup-line-final,#loading .uap-startup-space-layer{display:none!important;visibility:hidden!important;opacity:0!important;animation:none!important;}\n';

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
    'uap-logo-final-polish.js'
  ].forEach(function(file) {
    var escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp('<script[^>]+src=["\'][^"\']*' + escaped + '[^"\']*["\'][^>]*><\\/script>', 'g'), '');
  });
  return html;
}

function withFeedOverrides(resp) {
  var headers = new Headers(resp.headers);
  headers.set('Cache-Control', 'no-store');
  return resp.text().then(function(html) {
    html = stripOverrideScripts(html);
    html = html.replace(/<h1 class="startup-title"[\s\S]*?<\/h1>/, STARTUP_LOGO_HTML);
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

  if (OVERRIDE_FILES.some(function(file) { return url.pathname.endsWith('/' + file); })) {
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