var CACHE = 'uap-v174-corrected-logo-asset';
var META  = 'uap-meta-v1';
var OVERRIDE_VERSION = '174';
var OVERRIDE_FILES = [
  'uap-startup-alien.js',
  'uap-startup-visible-fix.js',
  'uap-feed-normalize.js',
  'uap-app-overrides.js',
  'uap-logo-scan-line.js',
  'uap-ui-polish.js',
  'uap-startup-animation-final.js',
  'uap-logo-final-polish.js'
];

var STARTUP_LOGO_HTML = '<h1 class="startup-title uap-logo-final" aria-label="UAP News" data-uap-logo-asset="1" data-uap-letters="1"><img class="uap-logo-img" src="./uap-news-logo.svg?v=174" alt="UAP News" decoding="async"><span class="uap-news-s" aria-hidden="true"></span><span class="uap-logo-letter" aria-hidden="true"></span></h1>';

var STARTUP_STILL_STYLE = '\n#loading{background:#000!important;background-color:#000!important;background-image:none!important;box-shadow:inset 0 0 0 100vmax #000!important;overflow:hidden!important;}\n#loading .alien-head,#loading img.alien-head{position:absolute!important;left:calc(50% + 26vw)!important;top:50%!important;margin:0!important;width:min(1770px,225vw)!important;height:min(996px,126vw)!important;max-width:none!important;max-height:92vh!important;opacity:.05!important;mix-blend-mode:normal!important;filter:brightness(.12) contrast(.82) saturate(1.16)!important;mask-image:radial-gradient(ellipse 58% 72% at 58% 51%,#000 0 46%,rgba(0,0,0,.78) 62%,rgba(0,0,0,.22) 80%,transparent 100%)!important;-webkit-mask-image:radial-gradient(ellipse 58% 72% at 58% 51%,#000 0 46%,rgba(0,0,0,.78) 62%,rgba(0,0,0,.22) 80%,transparent 100%)!important;border-radius:44px!important;animation:none!important;transition:none!important;transform:translate(-50%,-6%) scale(.72)!important;transform-origin:center center!important;will-change:opacity,filter,transform!important;background:#000!important;background-color:#000!important;box-shadow:0 0 0 100vmax #000!important;background-size:contain!important;background-position:center center!important;background-repeat:no-repeat!important;object-fit:contain!important;object-position:center center!important;}\n#loading .startup-title{position:absolute!important;top:24px!important;left:50%!important;right:auto!important;bottom:auto!important;display:block!important;width:min(92vw,620px)!important;height:auto!important;transform:translateX(-50%)!important;margin:0!important;z-index:3!important;line-height:1!important;letter-spacing:0!important;text-shadow:none!important;background:none!important;color:transparent!important;-webkit-text-fill-color:transparent!important;overflow:visible!important;isolation:isolate!important;}\n#loading .startup-title::before,#loading .startup-title::after{display:none!important;content:none!important;}\n#loading .uap-logo-img{display:block!important;width:100%!important;height:auto!important;max-width:100%!important;object-fit:contain!important;object-position:center center!important;background:transparent!important;border:0!important;margin:0!important;padding:0!important;filter:drop-shadow(0 0 5px rgba(0,212,255,.18))!important;animation:none!important;}\n#loading .uap-edge-letter,#loading .uap-edge-space,#loading .uap-news-s,#loading .uap-logo-letter,#loading .uap-logo-space{display:none!important;}\n#loading .loading-bar,#loading .uap-startup-line-final,#loading .uap-startup-space-layer{display:none!important;visibility:hidden!important;opacity:0!important;animation:none!important;}\n';

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
  OVERRIDE_FILES.forEach(function(file) {
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

  if (url.pathname.endsWith('/uap-news-logo.svg')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }));
    return;
  }

  e.respondWith(
    fetch(e.request).catch(function() { return caches.match(e.request); })
  );
});