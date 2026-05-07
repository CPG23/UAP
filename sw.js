var CACHE = 'uap-v8-google-translate';
var META  = 'uap-meta-v1';

self.addEventListener('install', function(e) {
  // Don't pre-cache HTML - always fetch fresh from network
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
      // Tell all open tabs to reload so they get the new version immediately
      return self.clients.matchAll({ type: 'window' }).then(function(clients) {
        clients.forEach(function(c) { c.postMessage({ type: 'SW_UPDATED' }); });
      });
    })
  );
});

function patchHtml(html) {
  var start = html.indexOf('  async function translateText(text, combined) {');
  var end = html.indexOf('\n\n  async function translateSummary(aid) {', start);
  if (start < 0 || end < 0) return html;

  var replacement = `  async function translateText(text, combined) {
    var sourceText = String(text || '').trim();
    if (!sourceText) throw new Error('Kein Text zum Übersetzen');

    function sleep(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); }
    function cleanTranslation(t) {
      t = (t || '').trim();
      if (!t || t.length < 2) return '';
      if (/^\\s*<!doctype|<html/i.test(t)) return '';
      return t.replace(/^\\s*\\"|\\"\\s*$/g, '').trim();
    }
    async function fetchWithTimeout(url, options, timeoutMs) {
      var ctrl = new AbortController();
      var t = setTimeout(function() { ctrl.abort(); }, timeoutMs);
      try {
        options = options || {};
        options.signal = ctrl.signal;
        var r = await fetch(url, options);
        clearTimeout(t);
        return r;
      } catch(e) {
        clearTimeout(t);
        throw e;
      }
    }
    function splitForGoogle(input) {
      var chunks = [];
      var parts = String(input || '').split(/(\\n+)/);
      var current = '';
      parts.forEach(function(part) {
        if ((current + part).length > 1600 && current.trim()) {
          chunks.push(current);
          current = part;
        } else {
          current += part;
        }
      });
      if (current.trim()) chunks.push(current);
      return chunks.length ? chunks : [String(input || '')];
    }
    async function googleOne(input) {
      var chunks = splitForGoogle(input);
      var out = [];
      for (var i = 0; i < chunks.length; i++) {
        var url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=de&dt=t&q=' + encodeURIComponent(chunks[i]);
        var r = await fetchWithTimeout(url, { cache: 'no-store' }, 12000);
        if (!r.ok) throw new Error('google ' + r.status);
        var data = await r.json();
        var translated = data && data[0] ? data[0].map(function(p) { return p && p[0] ? p[0] : ''; }).join('') : '';
        translated = cleanTranslation(translated);
        if (!translated) throw new Error('google leer');
        out.push(translated);
      }
      return out.join('');
    }
    async function googleTranslate() {
      if (combined && sourceText.indexOf('|||') > -1) {
        var parts = sourceText.split('|||');
        var title = await googleOne(parts.shift());
        var summary = await googleOne(parts.join('|||'));
        return title + ' ||| ' + summary;
      }
      return googleOne(sourceText);
    }

    try {
      return await googleTranslate();
    } catch(googleError) {
      // Google is normally fastest and most reliable; keep the AI service as a reserve path.
    }

    var prompt = combined
      ? 'Translate the following two English texts to German. Keep the ||| separator between them. Return ONLY the translations, nothing else.\\n\\n' + sourceText
      : 'Translate the following English text to German. Return ONLY the translated text, nothing else.\\n\\n' + sourceText;
    async function postModel(model, timeoutMs) {
      var r = await fetchWithTimeout('https://text.pollinations.ai/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: 'You translate accurately into German. Return only the translation, no markdown.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0,
          max_tokens: 1800
        })
      }, timeoutMs);
      if (!r.ok) throw new Error('post ' + model + ' ' + r.status);
      var d = await r.json();
      var c = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
      var out = cleanTranslation(c);
      if (!out) throw new Error('empty post ' + model);
      return out;
    }
    async function getModel(model, timeoutMs, seed) {
      var url = 'https://text.pollinations.ai/' + encodeURIComponent(prompt) + '?model=' + encodeURIComponent(model) + '&seed=' + seed;
      var r = await fetchWithTimeout(url, {}, timeoutMs);
      if (!r.ok) throw new Error('get ' + model + ' ' + r.status);
      var out = cleanTranslation(await r.text());
      if (!out) throw new Error('empty get ' + model);
      return out;
    }

    var seedBase = Math.abs(prompt.split('').reduce(function(h, c) { return ((h << 5) - h + c.charCodeAt(0)) | 0; }, 0));
    var attempts = [
      function() { return postModel('openai-fast', 18000); },
      function() { return getModel('openai-fast', 18000, seedBase + 11); },
      function() { return postModel('mistral', 22000); },
      function() { return getModel('mistral', 22000, seedBase + 37); }
    ];

    for (var i = 0; i < attempts.length; i++) {
      try {
        return await attempts[i]();
      } catch(e) {
        if (i < attempts.length - 1) await sleep(500 + i * 350);
      }
    }
    throw new Error('Übersetzung aktuell nicht erreichbar. Bitte erneut tippen.');
  }`;

  html = html.slice(0, start) + replacement + html.slice(end);
  html = html.replace("btn.innerHTML = '&#10227; ...';", "btn.innerHTML = '&#10227; Übersetze...';");
  html = html.replace("btn.disabled = true; btn.innerHTML = '&#10227; ...';", "btn.disabled = true; btn.innerHTML = '&#10227; Übersetze...';");
  html = html.replace(/setTimeout\(\(\) => \{ btn\.innerHTML = '&#127760; Übersetzen'; btn\.disabled = false; \}, 4000\);/g, "setTimeout(() => { btn.innerHTML = '&#127760; Übersetzen'; btn.disabled = false; }, 1500);");
  html = html.replace(/setTimeout\(function\(\)\{ btn\.innerHTML = '&#127760; &#220;bersetzen'; btn\.disabled = false; \}, 4000\);/g, "setTimeout(function(){ btn.innerHTML = '&#127760; &#220;bersetzen'; btn.disabled = false; }, 1500);");
  return html;
}

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  // Navigation requests (HTML): always bypass cache - get fresh from network and patch app hotfixes
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' }).then(function(resp) {
        var type = resp.headers.get('content-type') || '';
        if (type.indexOf('text/html') === -1) return resp;
        return resp.text().then(function(html) {
          var headers = new Headers(resp.headers);
          headers.set('content-type', 'text/html; charset=utf-8');
          headers.set('cache-control', 'no-store');
          return new Response(patchHtml(html), { status: resp.status, statusText: resp.statusText, headers: headers });
        });
      }).catch(function() {
        return caches.match('./') || new Response('Offline', { status: 503 });
      })
    );
    return;
  }
  // All other resources: network-first, cache fallback
  e.respondWith(
    fetch(e.request).catch(function() {
      return caches.match(e.request);
    })
  );
});

// Receive seen-IDs from the app after each scan
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SYNC_SEEN_IDS' && Array.isArray(e.data.ids)) {
    caches.open(META).then(function(c) {
      c.put('seen-ids', new Response(JSON.stringify(e.data.ids), { headers: { 'Content-Type': 'application/json' } }));
    });
  }
});

self.addEventListener('periodicsync', function(e) {
  if (e.tag === 'daily-news') e.waitUntil(fetchAndNotify());
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(cs) {
      if (cs.length > 0) {
        cs[0].focus();
        cs[0].postMessage({ type: 'NOTIFICATION_ARTICLE' });
        return;
      }
      return self.clients.openWindow('./');
    })
  );
});

function topicId(title) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim()
    .split(/\s+/).filter(function(w) { return w.length > 3; }).sort().join('-');
}

async function fetchAndNotify() {
  try {
    var seenIds = [];
    try {
      var mc = await caches.open(META);
      var r  = await mc.match('seen-ids');
      if (r) seenIds = await r.json();
    } catch(x) {}

    var q     = encodeURIComponent('UAP UFO 2026');
    var proxy = 'https://api.allorigins.win/get?url='
              + encodeURIComponent('https://news.google.com/rss/search?q=' + q + '&hl=en&gl=US&ceid=US:en');
    var resp  = await fetch(proxy, { signal: AbortSignal.timeout(20000) });
    var json  = await resp.json();
    var xml   = json.contents || '';
    var items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

    var newArts = [];
    var now  = Date.now();
    var week = 7 * 24 * 60 * 60 * 1000;

    for (var i = 0; i < items.length && newArts.length < 5; i++) {
      var it    = items[i];
      var title = (it.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || ['',''])[1].trim();
      var link  = (it.match(/<link>([\s\S]*?)<\/link>/)                              || ['',''])[1].trim();
      var src   = (it.match(/<source[^>]*>([\s\S]*?)<\/source>/)                     || ['',''])[1].trim();
      var pd    = (it.match(/<pubDate>([\s\S]*?)<\/pubDate>/)                         || ['',''])[1].trim();
      if (!title) continue;
      var id = topicId(title);
      if (!id || seenIds.indexOf(id) > -1) continue;
      if (pd && now - new Date(pd).getTime() > week) continue;
      newArts.push({ id: id, title: title, source: src || 'UAP News', url: link });
    }

    var count = newArts.length;
    var notifTitle, body;
    if (count === 0) {
      notifTitle = 'UAP NEWS - Keine neuen Meldungen';
      body = 'Seit dem letzten Check gibt es keine neuen UAP-Artikel.';
    } else {
      notifTitle = 'UAP NEWS - ' + count + ' neue Meldung' + (count > 1 ? 'en' : '');
      body = newArts[0].title + (count > 1 ? '\n+ ' + (count - 1) + ' weitere Meldung' + (count > 2 ? 'en' : '') : '');
    }

    await self.registration.showNotification(notifTitle, {
      body: body, tag: 'uap-daily', renotify: true,
      icon: './', badge: './'
    });

    var newIds = seenIds.concat(newArts.map(function(a) { return a.id; })).slice(-200);
    var mc2 = await caches.open(META);
    await mc2.put('seen-ids', new Response(JSON.stringify(newIds), { headers: { 'Content-Type': 'application/json' } }));
  } catch(err) {
    console.log('[SW periodic]', err);
  }
}
