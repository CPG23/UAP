var CACHE = 'uap-v97-remove-manual-scan';
var META  = 'uap-meta-v1';
var OVERRIDE_VERSION = '97';
var OVERRIDE_FILES = [
  'translation-replace-only-fix.js',
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
  'latest-polish-fix.js',
  'topic-regroup-display-fix.js',
  'new-articles-filter-fix.js',
  'startup-opaque-fix.js'
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

function stripOverrideScripts(html) {
  OVERRIDE_FILES.concat(['translation-override-fix.js', 'manual-scan-config.js', 'manual-scan-link-fix.js']).forEach(function(file) {
    var escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp('<script[^>]+src=["\'][^"\']*' + escaped + '[^"\']*["\'][^>]*><\\/script>', 'g'), '');
  });
  return html;
}

function rewriteStartupLogo(html) {
  html = html.replace(/<title>[\s\S]*?<\/title>/i, '<title>UAP News</title>');
  html = html.replace(/<meta name="apple-mobile-web-app-title" content="[^"]*">/i, '<meta name="apple-mobile-web-app-title" content="UAP News">');
  html = html.replace(/<div class="brand-title">[\s\S]*?<\/div>/i, '<div class="brand-title">UAP News</div>');
  html = html.replace(/<h1 class="startup-title">[\s\S]*?<\/h1>/i, '<h1 class="startup-title">UAP News</h1><div class="startup-credit">created by Chris Gehring</div>');
  return html;
}

function criticalStartupStyle() {
  return [
    '<style id="uap-startup-panel-hard-hide">',
    '#loading{background:#030a0f!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
    '#loading::before{content:"";position:absolute;inset:0;background:#030a0f;z-index:-1}',
    '#loading .startup-panel,#loading .startup-panel-label,#loading-status{display:none!important}',
    '#loading .startup-panel-wrap{bottom:22px!important;gap:0!important}',
    '.startup-title{display:inline-block!important;position:absolute!important;top:calc(8px + env(safe-area-inset-top))!important;left:4px!important;right:auto!important;transform:none!important;margin:0!important;text-align:left!important;color:#eafcff!important;font-family:"Rajdhani",sans-serif!important;font-weight:700!important;font-size:clamp(72px,22vw,136px)!important;line-height:.82!important;letter-spacing:2px!important;text-transform:none!important;text-shadow:0 0 8px rgba(255,255,255,.65),0 0 22px rgba(0,212,255,.9),0 0 44px rgba(0,255,157,.35)!important;white-space:nowrap!important;z-index:2!important}',
    '.startup-title::after{content:"";position:absolute;left:1px;right:0;bottom:-7px;height:2px;background:linear-gradient(90deg,#00d4ff,#00ff9d,transparent);box-shadow:0 0 18px rgba(0,212,255,.95)}',
    '.startup-credit{position:absolute!important;top:calc(10px + env(safe-area-inset-top) + clamp(86px,23vw,150px))!important;left:8px!important;right:auto!important;text-align:left!important;z-index:2!important;color:#c6f4ff!important;font-family:"Share Tech Mono",monospace!important;font-size:clamp(9px,2.5vw,12px)!important;letter-spacing:1.8px!important;text-transform:none!important;text-shadow:0 0 6px rgba(255,255,255,.45),0 0 16px rgba(0,212,255,.75)!important;opacity:.92!important}',
    '@media(max-width:560px){.startup-title{top:calc(7px + env(safe-area-inset-top))!important;left:3px!important;font-size:clamp(64px,22vw,104px)!important;letter-spacing:1px!important}.startup-credit{top:calc(8px + env(safe-area-inset-top) + clamp(76px,23vw,116px))!important;left:6px!important;letter-spacing:1.3px!important}}',
    '</style>'
  ].join('');
}

function withFeedOverrides(resp) {
  var headers = new Headers(resp.headers);
  headers.set('Cache-Control', 'no-store');
  return resp.text().then(function(html) {
    var startupHide = criticalStartupStyle();
    html = rewriteStartupLogo(html);
    html = html.replace(/<style id="uap-startup-panel-hard-hide">[\s\S]*?<\/style>/i, '');
    html = html.replace('</head>', startupHide + '</head>');
    html = html.replace(/<div class="startup-panel">\s*<div class="startup-panel-label">[\s\S]*?<\/div>\s*<div id="loading-status">[\s\S]*?<\/div>\s*<\/div>\s*<div class="loading-bar">/m, '<div class="loading-bar">');
    html = stripOverrideScripts(html);
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
