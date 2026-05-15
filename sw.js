var CACHE = 'uap-v165-startup-logo-rewrite';
var META  = 'uap-meta-v1';
var OVERRIDE_VERSION = '165';
var OVERRIDE_FILES = [
  'uap-startup-alien.js',
  'uap-startup-visible-fix.js',
  'uap-feed-normalize.js',
  'uap-app-overrides.js',
  'uap-logo-scan-line.js',
  'uap-ui-polish.js',
  'uap-startup-animation-final.js'
];

var STARTUP_LOGO_HTML = '<h1 class="startup-title" aria-label="UAP News"><span class="uap-edge-letter">U</span><span class="uap-edge-letter">A</span><span class="uap-edge-letter">P</span><span class="uap-edge-space" aria-hidden="true"></span><span class="uap-edge-letter">N</span><span class="uap-edge-letter">e</span><span class="uap-edge-letter">w</span><span class="uap-edge-letter uap-news-s">s</span></h1>';

var STARTUP_STILL_STYLE = '\n@keyframes uapLogoEdgeGlow{0%,100%{color:#fbfeff;-webkit-text-fill-color:#fbfeff;-webkit-text-stroke:1px rgba(190,255,255,.2);text-shadow:0 1px 0 rgba(255,255,255,.56),0 0 16px rgba(255,255,255,.62),0 0 34px rgba(0,212,255,.44),0 0 72px rgba(0,132,255,.26);filter:drop-shadow(0 0 2px rgba(0,255,221,.22));}42%{color:#fff;-webkit-text-fill-color:#fff;-webkit-text-stroke:1px rgba(210,255,255,.46);text-shadow:0 1px 0 rgba(255,255,255,.86),0 0 24px rgba(255,255,255,.98),0 0 52px rgba(0,255,221,.95),0 0 96px rgba(0,132,255,.68),0 0 140px rgba(0,255,221,.34);filter:drop-shadow(0 0 10px rgba(0,255,221,.7));}}\n@keyframes uapLogoTailGlow{0%,100%{opacity:.42;box-shadow:0 0 10px rgba(0,212,255,.32),0 0 24px rgba(0,255,221,.16);}50%{opacity:.9;box-shadow:0 0 18px rgba(0,255,221,.72),0 0 44px rgba(0,132,255,.38);}}\n#loading{background:#000!important;background-color:#000!important;background-image:none!important;box-shadow:inset 0 0 0 100vmax #000!important;overflow:hidden!important;}\n#loading .alien-head,#loading img.alien-head{position:absolute!important;left:calc(50% + 26vw)!important;top:50%!important;margin:0!important;width:min(1770px,225vw)!important;height:min(996px,126vw)!important;max-width:none!important;max-height:92vh!important;opacity:.05!important;mix-blend-mode:normal!important;filter:brightness(.12) contrast(.82) saturate(1.16)!important;mask-image:radial-gradient(ellipse 58% 72% at 58% 51%,#000 0 46%,rgba(0,0,0,.78) 62%,rgba(0,0,0,.22) 80%,transparent 100%)!important;-webkit-mask-image:radial-gradient(ellipse 58% 72% at 58% 51%,#000 0 46%,rgba(0,0,0,.78) 62%,rgba(0,0,0,.22) 80%,transparent 100%)!important;border-radius:44px!important;animation:none!important;transition:none!important;transform:translate(-50%,-6%) scale(.72)!important;transform-origin:center center!important;will-change:opacity,filter,transform!important;background:#000!important;background-color:#000!important;box-shadow:0 0 0 100vmax #000!important;background-size:contain!important;background-position:center center!important;background-repeat:no-repeat!important;object-fit:contain!important;object-position:center center!important;}\n#loading .startup-title{position:absolute!important;top:28px!important;left:50%!important;right:auto!important;bottom:auto!important;display:block!important;transform:translateX(-50%)!important;margin:0!important;z-index:2!important;font-family:"Rajdhani","Exo 2",system-ui,sans-serif!important;font-weight:800!important;letter-spacing:.035em!important;text-transform:none!important;white-space:nowrap!important;overflow:visible!important;color:#fbfeff!important;-webkit-text-fill-color:#fbfeff!important;text-shadow:none!important;}\n#loading .startup-title::after{display:none!important;content:none!important;}\n#loading .uap-edge-letter{position:relative!important;display:inline-block!important;color:#fbfeff!important;-webkit-text-fill-color:#fbfeff!important;-webkit-text-stroke:1px rgba(190,255,255,.2)!important;background:none!important;text-shadow:0 1px 0 rgba(255,255,255,.56),0 0 16px rgba(255,255,255,.62),0 0 34px rgba(0,212,255,.44),0 0 72px rgba(0,132,255,.26)!important;animation:uapLogoEdgeGlow 3.8s ease-in-out infinite!important;}\n#loading .uap-edge-space{display:inline-block!important;width:.24em!important;}\n#loading .uap-edge-letter:nth-child(1){animation-delay:0s!important;}#loading .uap-edge-letter:nth-child(2){animation-delay:.14s!important;}#loading .uap-edge-letter:nth-child(3){animation-delay:.28s!important;}#loading .uap-edge-letter:nth-child(5){animation-delay:.48s!important;}#loading .uap-edge-letter:nth-child(6){animation-delay:.62s!important;}#loading .uap-edge-letter:nth-child(7){animation-delay:.76s!important;}#loading .uap-edge-letter:nth-child(8){animation-delay:.9s!important;}\n#loading .uap-news-s::after{content:""!important;position:absolute!important;right:.42em!important;bottom:.08em!important;width:4.9em!important;height:.045em!important;border-radius:999px!important;background:linear-gradient(90deg,rgba(0,255,221,0),rgba(0,212,255,.58) 14%,rgba(218,255,255,.9) 62%,rgba(255,255,255,.7))!important;filter:blur(.3px)!important;animation:uapLogoTailGlow 3.8s ease-in-out infinite!important;pointer-events:none!important;}\n#loading .loading-bar,#loading .uap-startup-line-final,#loading .uap-startup-space-layer{display:none!important;visibility:hidden!important;opacity:0!important;animation:none!important;}\n';

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

  e.respondWith(
    fetch(e.request).catch(function() { return caches.match(e.request); })
  );
});