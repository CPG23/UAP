var CACHE = 'uap-v134-logo-soft-scan-line';
var META  = 'uap-meta-v1';
var OVERRIDE_VERSION = '134';
var OVERRIDE_FILES = [
  'uap-startup-alien.js',
  'uap-startup-visible-fix.js',
  'uap-feed-normalize.js',
  'uap-app-overrides.js',
  'uap-logo-scan-line.js'
];

var STARTUP_STILL_STYLE = '\n#loading{background:#000!important;background-color:#000!important;background-image:none!important;box-shadow:inset 0 0 0 100vmax #000!important;overflow:hidden!important;}\n#loading .alien-head{width:min(1770px,225vw)!important;height:min(996px,126vw)!important;max-width:none!important;max-height:92vh!important;opacity:1!important;mix-blend-mode:normal!important;filter:none!important;mask-image:none!important;-webkit-mask-image:none!important;animation:none!important;transition:none!important;transform:translateX(-32vw)!important;will-change:auto!important;background:#000!important;background-color:#000!important;box-shadow:0 0 0 100vmax #000!important;background-size:contain!important;background-position:center center!important;background-repeat:no-repeat!important;}\n#loading img.alien-head{height:auto!important;object-fit:contain!important;object-position:center center!important;}\n@keyframes uapMistSweep{0%{transform:translateX(-125%) scaleX(.82);opacity:.08;}18%{opacity:.78;}62%{opacity:.72;}100%{transform:translateX(135%) scaleX(1.08);opacity:.06;}}\n@keyframes uapMistBreath{0%,100%{opacity:.72;filter:blur(2.2px);box-shadow:0 0 18px rgba(0,212,255,.20),0 0 46px rgba(0,255,157,.10);}50%{opacity:1;filter:blur(2.8px);box-shadow:0 0 30px rgba(0,212,255,.45),0 0 72px rgba(0,255,157,.22);}}\n#loading .loading-bar{display:block!important;position:absolute!important;left:50%!important;bottom:92px!important;width:min(340px,76vw)!important;height:9px!important;transform:translateX(-50%)!important;background:linear-gradient(90deg,transparent,rgba(0,212,255,.12),rgba(0,255,157,.10),transparent)!important;overflow:visible!important;z-index:8!important;opacity:1!important;border:0!important;border-radius:999px!important;animation:uapMistBreath 1.9s ease-in-out infinite!important;}\n#loading .loading-bar::before{content:""!important;position:absolute!important;left:0!important;top:50%!important;width:58%!important;height:30px!important;margin-top:-15px!important;border-radius:999px!important;background:radial-gradient(ellipse at center,rgba(220,255,248,.95) 0%,rgba(0,212,255,.72) 24%,rgba(0,255,157,.35) 48%,rgba(0,212,255,.12) 68%,transparent 82%)!important;filter:blur(9px)!important;animation:uapMistSweep 1.75s cubic-bezier(.18,.72,.2,1) infinite!important;}\n#loading .loading-bar::after{content:""!important;position:absolute!important;inset:3px 0!important;border-radius:999px!important;background:linear-gradient(90deg,transparent,rgba(0,212,255,.38),rgba(216,255,247,.74),rgba(0,255,157,.34),transparent)!important;filter:blur(4px)!important;opacity:.86!important;animation:uapMistSweep 2.35s cubic-bezier(.2,.7,.2,1) infinite reverse!important;}\n';

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

  e.respondWith(
    fetch(e.request).catch(function() { return caches.match(e.request); })
  );
});