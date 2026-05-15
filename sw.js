var CACHE = 'uap-v169-refined-s-tail-logo';
var META  = 'uap-meta-v1';
var OVERRIDE_VERSION = '169';
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

var STARTUP_LOGO_HTML = '<h1 class="startup-title uap-logo-final" aria-label="UAP News"><span class="uap-edge-letter" data-ch="U">U</span><span class="uap-edge-letter" data-ch="A">A</span><span class="uap-edge-letter" data-ch="P">P</span><span class="uap-edge-space" aria-hidden="true"></span><span class="uap-edge-letter" data-ch="N">N</span><span class="uap-edge-letter" data-ch="e">e</span><span class="uap-edge-letter" data-ch="w">w</span><span class="uap-edge-letter uap-news-s" data-ch="s">s</span></h1>';

var STARTUP_STILL_STYLE = '\n@keyframes uapLogoEdgeGlow{0%,100%{color:#fbfeff;-webkit-text-fill-color:#fbfeff;-webkit-text-stroke:1px rgba(190,255,255,.28);text-shadow:0 1px 0 rgba(255,255,255,.62),0 0 18px rgba(255,255,255,.68),0 0 40px rgba(0,212,255,.54),0 0 82px rgba(0,132,255,.32);filter:drop-shadow(0 0 3px rgba(0,255,221,.28));}42%{color:#fff;-webkit-text-fill-color:#fff;-webkit-text-stroke:1px rgba(218,255,255,.6);text-shadow:0 1px 0 rgba(255,255,255,.9),0 0 28px rgba(255,255,255,1),0 0 62px rgba(0,255,221,1),0 0 112px rgba(0,132,255,.76),0 0 160px rgba(0,255,221,.42);filter:drop-shadow(0 0 13px rgba(0,255,221,.82));}}\n#loading{background:#000!important;background-color:#000!important;background-image:none!important;box-shadow:inset 0 0 0 100vmax #000!important;overflow:hidden!important;}\n#loading .alien-head,#loading img.alien-head{position:absolute!important;left:calc(50% + 26vw)!important;top:50%!important;margin:0!important;width:min(1770px,225vw)!important;height:min(996px,126vw)!important;max-width:none!important;max-height:92vh!important;opacity:.05!important;mix-blend-mode:normal!important;filter:brightness(.12) contrast(.82) saturate(1.16)!important;mask-image:radial-gradient(ellipse 58% 72% at 58% 51%,#000 0 46%,rgba(0,0,0,.78) 62%,rgba(0,0,0,.22) 80%,transparent 100%)!important;-webkit-mask-image:radial-gradient(ellipse 58% 72% at 58% 51%,#000 0 46%,rgba(0,0,0,.78) 62%,rgba(0,0,0,.22) 80%,transparent 100%)!important;border-radius:44px!important;animation:none!important;transition:none!important;transform:translate(-50%,-6%) scale(.72)!important;transform-origin:center center!important;will-change:opacity,filter,transform!important;background:#000!important;background-color:#000!important;box-shadow:0 0 0 100vmax #000!important;background-size:contain!important;background-position:center center!important;background-repeat:no-repeat!important;object-fit:contain!important;object-position:center center!important;}\n#loading .startup-title{position:absolute!important;top:28px!important;left:50%!important;right:auto!important;bottom:auto!important;display:block!important;transform:translateX(-50%)!important;margin:0!important;z-index:2!important;font-family:"Rajdhani","Exo 2",system-ui,sans-serif!important;font-size:clamp(72px,18vw,120px)!important;line-height:.82!important;font-weight:800!important;letter-spacing:.035em!important;text-transform:none!important;white-space:nowrap!important;overflow:visible!important;isolation:isolate!important;color:#fbfeff!important;-webkit-text-fill-color:#fbfeff!important;text-shadow:none!important;}\n#loading .startup-title::after{display:none!important;content:none!important;}\n#loading .uap-edge-letter{position:relative!important;display:inline-block!important;color:#fbfeff!important;-webkit-text-fill-color:#fbfeff!important;-webkit-text-stroke:1px rgba(190,255,255,.28)!important;background:none!important;text-shadow:0 1px 0 rgba(255,255,255,.62),0 0 18px rgba(255,255,255,.68),0 0 40px rgba(0,212,255,.54),0 0 82px rgba(0,132,255,.32)!important;animation:uapLogoEdgeGlow 3.8s ease-in-out infinite!important;}\n#loading .uap-edge-space{display:inline-block!important;width:.24em!important;}\n#loading .uap-news-s{transform:translateY(.32em) scaleY(1.24)!important;transform-origin:50% 100%!important;margin-bottom:-.26em!important;z-index:3!important;}\n#loading .uap-news-s::after{content:""!important;position:absolute!important;right:.50em!important;bottom:-.14em!important;width:5.02em!important;height:.20em!important;border-radius:.10em!important;background:linear-gradient(90deg,rgba(0,255,221,0),rgba(0,212,255,.62) 8%,rgba(218,255,255,.96) 42%,rgba(255,255,255,.98) 100%)!important;filter:blur(.16px) drop-shadow(0 0 9px rgba(0,212,255,.46))!important;pointer-events:none!important;z-index:-1!important;}\n#loading .loading-bar,#loading .uap-startup-line-final,#loading .uap-startup-space-layer{display:none!important;visibility:hidden!important;opacity:0!important;animation:none!important;}\n';

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