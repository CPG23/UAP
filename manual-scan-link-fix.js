(function(){
  'use strict';

  var STYLE_ID = 'uap-manual-scan-style';
  var STORAGE_PIN = 'uapManualScanPin';
  var SCAN_API_URL = 'https://uap-news-scan.YOUR-CLOUDFLARE-SUBDOMAIN.workers.dev';
  var POLL_INTERVAL_MS = 6000;
  var POLL_LIMIT = 70;

  function configuredApiUrl(){
    var value = String(window.UAP_SCAN_API_URL || SCAN_API_URL || '').replace(/\/$/, '');
    if (!value || /YOUR-CLOUDFLARE-SUBDOMAIN/i.test(value)) return '';
    return value;
  }

  function injectStyle(){
    var style = document.getElementById(STYLE_ID);
    var css = [
      '.manual-scan-btn{min-width:46px!important;padding:0 8px!important;font-size:10px!important;letter-spacing:1.2px!important}',
      '.manual-scan-btn.is-running{color:#001b12!important;background:linear-gradient(135deg,#00ff9d,#00d4ff)!important;border-color:rgba(0,255,157,.95)!important}',
      '.manual-scan-btn:focus-visible{outline:2px solid rgba(0,255,157,.85)!important;outline-offset:2px!important}',
      '.manual-scan-info{cursor:pointer!important}',
      '.manual-scan-info.is-error{border-color:rgba(255,91,91,.55)!important;color:#ffd4d4!important}',
      '.manual-scan-info.is-success{border-color:rgba(0,255,157,.55)!important;color:#d8fff0!important}'
    ].join('\n');
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
  }

  function showScanInfo(text, type, persist){
    var notice = document.getElementById('notice');
    if (!notice || !notice.parentNode) return;
    var box = document.querySelector('.manual-scan-info');
    if (!box) {
      box = document.createElement('div');
      box.className = 'notify-info manual-scan-info';
      notice.parentNode.insertBefore(box, notice);
    }
    box.className = 'notify-info manual-scan-info' + (type ? ' is-' + type : '');
    box.textContent = text;
    clearTimeout(showScanInfo.timer);
    if (!persist) showScanInfo.timer = setTimeout(function(){ if (box.parentNode) box.remove(); }, 12000);
  }

  function getStoredPin(){
    try { return localStorage.getItem(STORAGE_PIN) || ''; }
    catch (err) { return ''; }
  }

  function setStoredPin(pin){
    try { localStorage.setItem(STORAGE_PIN, pin); }
    catch (err) {}
  }

  function forgetStoredPin(){
    try { localStorage.removeItem(STORAGE_PIN); }
    catch (err) {}
  }

  function askForPin(){
    var existing = getStoredPin();
    var pin = window.prompt('Scan-PIN eingeben', existing);
    if (pin === null) return '';
    pin = String(pin).trim();
    if (pin) setStoredPin(pin);
    return pin;
  }

  function setRunning(running){
    var btn = document.getElementById('manual-scan-btn');
    if (!btn) return;
    btn.disabled = !!running;
    btn.classList.toggle('is-running', !!running);
    btn.textContent = running ? '...' : 'SCAN';
  }

  function articleIds(feed){
    var articles = feed && Array.isArray(feed.articles) ? feed.articles : [];
    return articles.map(function(article){ return String(article.id || article.link || article.title || ''); }).filter(Boolean);
  }

  function fetchFeedSnapshot(){
    return fetch('./latest-news.json?scanTs=' + Date.now(), { cache: 'no-store' })
      .then(function(resp){ return resp.ok ? resp.json() : null; })
      .then(function(feed){
        return {
          timestamp: feed && feed.timestamp ? String(feed.timestamp) : '',
          ids: articleIds(feed)
        };
      })
      .catch(function(){ return { timestamp:'', ids:[] }; });
  }

  function postScan(apiUrl, pin){
    return fetch(apiUrl + '/scan', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'X-UAP-Scan-Pin': pin
      },
      body: JSON.stringify({ pin: pin })
    }).then(readApiResponse);
  }

  function fetchStatus(apiUrl, pin, since){
    var url = apiUrl + '/status' + (since ? '?since=' + encodeURIComponent(since) : '');
    return fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: { 'X-UAP-Scan-Pin': pin }
    }).then(readApiResponse);
  }

  function readApiResponse(resp){
    return resp.json().catch(function(){ return {}; }).then(function(data){
      if (!resp.ok || data.ok === false) {
        var error = new Error(data.message || 'Der Scan konnte nicht ausgeführt werden.');
        error.status = resp.status;
        throw error;
      }
      return data;
    });
  }

  function countNewIds(before, after){
    var known = new Set(before.ids || []);
    return (after.ids || []).filter(function(id){ return !known.has(id); }).length;
  }

  function statusText(run){
    if (!run) return 'Scan wurde gestartet. Warte auf GitHub...';
    if (run.status === 'queued') return 'Scan wartet bei GitHub...';
    if (run.status === 'in_progress') return 'Scan läuft. Nachrichten werden geprüft...';
    if (run.status === 'completed') {
      if (run.conclusion === 'success') return 'Scan abgeschlossen. Aktualisiere Nachrichten...';
      return 'Scan beendet, aber GitHub meldet ein Problem.';
    }
    return 'Scan-Status wird geprüft...';
  }

  function pollUntilDone(apiUrl, pin, since, before, attempt){
    return fetchStatus(apiUrl, pin, since).then(function(data){
      var run = data.run;
      showScanInfo(statusText(run), '', true);
      if (run && run.status === 'completed') {
        if (run.conclusion !== 'success') throw new Error('Der GitHub-Scan wurde nicht erfolgreich beendet.');
        return fetchFeedSnapshot().then(function(after){
          var added = countNewIds(before, after);
          if (added > 0) {
            showScanInfo(added === 1 ? 'Scan fertig: 1 neuer Artikel gefunden.' : 'Scan fertig: ' + added + ' neue Artikel gefunden.', 'success', false);
          } else {
            showScanInfo('Scan fertig: Keine neuen sichtbaren Artikel gefunden.', 'success', false);
          }
        });
      }
      if (attempt >= POLL_LIMIT) throw new Error('Der Scan läuft länger als erwartet. Bitte später noch einmal prüfen.');
      return new Promise(function(resolve){ setTimeout(resolve, POLL_INTERVAL_MS); })
        .then(function(){ return pollUntilDone(apiUrl, pin, since, before, attempt + 1); });
    });
  }

  function startScan(){
    var apiUrl = configuredApiUrl();
    if (!apiUrl) {
      showScanInfo('Automatischer Scan ist vorbereitet. Es fehlt noch die Cloudflare-Worker-Adresse in der App-Konfiguration.', 'error', false);
      return;
    }

    var pin = askForPin();
    if (!pin) return;

    setRunning(true);
    showScanInfo('Scan wird gestartet...', '', true);
    fetchFeedSnapshot()
      .then(function(before){
        return postScan(apiUrl, pin).then(function(started){
          var since = started && started.startedAt ? started.startedAt : new Date().toISOString();
          showScanInfo('Scan gestartet. GitHub prüft jetzt neue UAP-Nachrichten...', '', true);
          return pollUntilDone(apiUrl, pin, since, before, 0);
        });
      })
      .catch(function(err){
        if (err && err.status === 401) forgetStoredPin();
        showScanInfo((err && err.message) ? err.message : 'Der Scan konnte nicht gestartet werden.', 'error', false);
      })
      .then(function(){ setRunning(false); }, function(){ setRunning(false); });
  }

  function addButton(){
    var row = document.querySelector('.button-row');
    if (!row || document.getElementById('manual-scan-btn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'manual-scan-btn';
    btn.className = 'icon-btn manual-scan-btn';
    btn.textContent = 'SCAN';
    btn.title = 'Scan jetzt starten';
    btn.setAttribute('aria-label', 'Scan jetzt starten');
    btn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      startScan();
    }, true);
    row.insertBefore(btn, row.firstChild);
  }

  function apply(){
    injectStyle();
    addButton();
  }

  function start(){
    apply();
    new MutationObserver(function(){ setTimeout(apply, 0); }).observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
