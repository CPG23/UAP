(function(){
  'use strict';
  if (window.__uapManualScan) return;
  window.__uapManualScan = true;

  var STYLE_ID = 'uap-manual-scan-style';
  var TOKEN_KEY = 'uapManualScanGitHubToken';
  var LAST_RUN_KEY = 'uapManualScanLastStartedAt';
  var WORKFLOW_URL = 'https://api.github.com/repos/CPG23/UAP/actions/workflows/daily-scan.yml/dispatches';
  var TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new?name=UAP%20Manual%20Scan&description=Startet%20den%20Daily%20UAP%20Scan%20direkt%20aus%20der%20App&target_name=CPG23&expires_in=366&actions=write';
  var latestFeedScanAt = '';

  function esc(value){ return String(value == null ? '' : value).replace(/[&<>"]/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]; }); }
  function compact(value){ return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function token(){ try { return compact(localStorage.getItem(TOKEN_KEY)); } catch(e) { return ''; } }
  function saveToken(value){ try { localStorage.setItem(TOKEN_KEY, compact(value)); } catch(e) {} }
  function clearToken(){ try { localStorage.removeItem(TOKEN_KEY); } catch(e) {} }
  function localManualRun(){ try { return compact(localStorage.getItem(LAST_RUN_KEY)); } catch(e) { return ''; } }
  function rememberRun(){ try { localStorage.setItem(LAST_RUN_KEY, new Date().toISOString()); } catch(e) {} }
  function parseTime(value){ var date = new Date(value || ''); return isNaN(date.getTime()) ? 0 : date.getTime(); }
  function scanTimeValue(){
    var local = localManualRun();
    var feed = compact(latestFeedScanAt);
    if (parseTime(local) > parseTime(feed)) return local;
    return feed || local;
  }
  function formatScanLabel(value){
    if (!value) return '';
    var date = new Date(value);
    if (isNaN(date.getTime())) return '';
    try { return date.toLocaleString('de-AT', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }); }
    catch(e){ return value.slice(0, 16).replace('T', ' '); }
  }
  function lastRunLabel(){ return formatScanLabel(scanTimeValue()); }
  function refreshLatestScan(){
    return fetch('latest-news.json?lastScan=' + Date.now(), { cache: 'no-store' })
      .then(function(resp){ return resp.ok ? resp.json() : {}; })
      .then(function(feed){
        latestFeedScanAt = compact(feed && ((feed.scanMeta || {}).scanStartedAt || feed.timestamp));
      })
      .catch(function(){});
  }

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '#refresh-btn{display:none!important}',
      '.scan-btn{border-color:rgba(0,255,157,.52)!important;background:linear-gradient(135deg,rgba(0,255,157,.11),rgba(0,212,255,.07))!important;color:#caffea!important;box-shadow:0 0 14px rgba(0,255,157,.13)!important}',
      '.scan-btn svg{width:19px!important;height:19px!important;display:block!important;stroke:currentColor!important;stroke-width:2!important;stroke-linecap:round!important;stroke-linejoin:round!important;fill:none!important}',
      '.scan-btn.is-running{opacity:.72!important;cursor:wait!important;animation:uapScanPulse 1.2s ease-in-out infinite}',
      '@keyframes uapScanPulse{0%,100%{box-shadow:0 0 10px rgba(0,255,157,.14)}50%{box-shadow:0 0 22px rgba(0,255,157,.34)}}',
      '.manual-scan-overlay{position:fixed;inset:0;z-index:3600;display:flex;align-items:flex-end;justify-content:center;padding:18px;background:rgba(1,6,10,.76);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}',
      '.manual-scan-sheet{width:min(540px,100%);border:1px solid rgba(0,255,157,.48);background:linear-gradient(180deg,rgba(8,20,32,.98),rgba(3,10,15,.99));box-shadow:0 0 36px rgba(0,255,157,.2);padding:16px;color:#d6e8f0}',
      '.manual-scan-sheet h3{margin:0 0 8px;color:#00ff9d;font-family:"Rajdhani",sans-serif;font-size:22px;letter-spacing:0}',
      '.manual-scan-sheet p{margin:0 0 12px;color:#adc5cf;font-size:13px;line-height:1.5}',
      '.manual-scan-status{min-height:20px;margin:0 0 12px;color:#b8f9d7;font-family:"Share Tech Mono",monospace;font-size:11px;line-height:1.45}',
      '.manual-scan-status.error{color:#ffb7b7}',
      '.manual-scan-token{width:100%;height:40px;margin:0 0 10px;border:1px solid rgba(0,212,255,.42);background:rgba(0,212,255,.06);color:#dff8ff;padding:0 10px;font-family:"Share Tech Mono",monospace;font-size:12px;outline:none}',
      '.manual-scan-token:focus{border-color:rgba(0,255,157,.8);box-shadow:0 0 0 2px rgba(0,255,157,.15)}',
      '.manual-scan-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.manual-scan-actions.three{grid-template-columns:1fr 1fr 1fr}',
      '.manual-scan-btn{min-height:40px;border:1px solid rgba(0,212,255,.42);background:rgba(0,212,255,.07);color:#00d4ff;font-family:"Share Tech Mono",monospace;font-size:10px;letter-spacing:1.1px;cursor:pointer;text-transform:uppercase}',
      '.manual-scan-btn.primary{border-color:rgba(0,255,157,.68);background:rgba(0,255,157,.13);color:#00ff9d}',
      '.manual-scan-btn.danger{border-color:rgba(255,120,120,.45);color:#ffb7b7;background:rgba(255,90,90,.06)}',
      '.manual-scan-help{display:block;margin:0 0 10px;color:#79dfff;font-family:"Share Tech Mono",monospace;font-size:10px;letter-spacing:1px;text-decoration:none}',
      '@media(max-width:420px){.manual-scan-actions,.manual-scan-actions.three{grid-template-columns:1fr}.manual-scan-sheet{padding:14px}}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function icon(){
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12a8 8 0 0 1 8-8"/><path d="M12 4h5v5"/><path d="M20 12a8 8 0 0 1-8 8"/><path d="M12 20H7v-5"/></svg>';
  }

  function removeRefreshButton(){
    var old = document.getElementById('refresh-btn');
    if (old && old.parentNode) old.parentNode.removeChild(old);
  }

  function ensureButton(){
    injectStyle();
    removeRefreshButton();
    var row = document.querySelector('.button-row');
    if (!row || document.getElementById('manual-scan-btn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'manual-scan-btn';
    btn.className = 'icon-btn scan-btn';
    btn.setAttribute('aria-label', 'Daily Scan manuell starten');
    btn.setAttribute('title', 'Daily Scan starten');
    btn.innerHTML = icon();
    row.insertBefore(btn, row.firstChild);
  }

  function close(){ var old = document.querySelector('.manual-scan-overlay'); if (old) old.remove(); }
  function status(text, error){
    var node = document.querySelector('.manual-scan-status');
    if (!node) return;
    node.textContent = text || '';
    node.classList.toggle('error', !!error);
  }
  function setBusy(busy){
    var overlay = document.querySelector('.manual-scan-overlay');
    var main = document.getElementById('manual-scan-start');
    var toolbar = document.getElementById('manual-scan-btn');
    if (main) main.disabled = !!busy;
    if (toolbar) toolbar.classList.toggle('is-running', !!busy);
    if (overlay) overlay.dataset.busy = busy ? '1' : '0';
  }

  function createSetupMarkup(){
    return '<h3>Daily Scan starten</h3>' +
      '<p>Für den direkten Start braucht die App einmalig eine GitHub-Freigabe. Der Token bleibt nur auf diesem Gerät.</p>' +
      '<a class="manual-scan-help" href="' + esc(TOKEN_URL) + '" target="_blank" rel="noopener noreferrer">TOKEN ERSTELLEN</a>' +
      '<input class="manual-scan-token" id="manual-scan-token" type="password" autocomplete="off" placeholder="GitHub Token einfügen">' +
      '<div class="manual-scan-status"></div>' +
      '<div class="manual-scan-actions"><button type="button" class="manual-scan-btn primary" id="manual-scan-save-start">Speichern & starten</button><button type="button" class="manual-scan-btn" data-manual-scan-close>Schließen</button></div>';
  }
  function createReadyMarkup(){
    var last = lastRunLabel();
    return '<h3>Daily Scan</h3>' +
      '<p>' + (last ? 'Zuletzt gestarteter Scan: ' + esc(last) + '.' : 'Bereit zum manuellen Start.') + '</p>' +
      '<div class="manual-scan-status"></div>' +
      '<div class="manual-scan-actions three"><button type="button" class="manual-scan-btn primary" id="manual-scan-start">Scan starten</button><button type="button" class="manual-scan-btn danger" id="manual-scan-clear">Token löschen</button><button type="button" class="manual-scan-btn" data-manual-scan-close>Schließen</button></div>';
  }

  function renderOverlay(){
    close();
    injectStyle();
    var overlay = document.createElement('div');
    overlay.className = 'manual-scan-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = '<div class="manual-scan-sheet">' + (token() ? createReadyMarkup() : createSetupMarkup()) + '</div>';
    overlay.addEventListener('click', function(event){
      if (event.target === overlay || event.target.hasAttribute('data-manual-scan-close')) close();
      if (event.target && event.target.id === 'manual-scan-save-start') {
        var input = document.getElementById('manual-scan-token');
        var value = input ? input.value : '';
        if (!compact(value)) { status('Bitte zuerst den GitHub Token einfügen.', true); return; }
        saveToken(value);
        startScan();
      }
      if (event.target && event.target.id === 'manual-scan-start') startScan();
      if (event.target && event.target.id === 'manual-scan-clear') { clearToken(); close(); show(); }
    });
    document.body.appendChild(overlay);
    var input = document.getElementById('manual-scan-token');
    if (input) setTimeout(function(){ input.focus(); }, 50);
  }

  function show(){
    renderOverlay();
    if (!token()) return;
    refreshLatestScan().then(function(){
      if (document.querySelector('.manual-scan-overlay')) renderOverlay();
    });
  }

  function friendlyError(err, code){
    var message = compact(err && err.message) || 'Der Scan konnte nicht gestartet werden.';
    if (code === 401 || /bad credentials/i.test(message)) return 'GitHub hat den Token abgelehnt.';
    if (code === 403 || /resource not accessible|permission/i.test(message)) return 'Der Token darf diesen Workflow nicht starten.';
    if (code === 404) return 'Der Scan konnte in der App nicht gefunden werden.';
    return message;
  }

  function startScan(){
    var value = token();
    if (!value) { show(); return; }
    setBusy(true);
    status('Scan wird gestartet ...');
    fetch(WORKFLOW_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + value,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ref: 'main' })
    }).then(function(resp){
      if (resp.status === 204) return null;
      return resp.json().catch(function(){ return {}; }).then(function(body){
        var err = new Error(body && body.message || ('Antwort ' + resp.status));
        err.status = resp.status;
        throw err;
      });
    }).then(function(){
      rememberRun();
      status('Scan gestartet. Die neue Liste erscheint nach ein paar Minuten automatisch in der App.');
      var btn = document.getElementById('manual-scan-btn');
      if (btn) btn.setAttribute('title', 'Daily Scan gestartet');
      setTimeout(function(){ setBusy(false); close(); }, 6000);
    }).catch(function(err){
      setBusy(false);
      status(friendlyError(err, err && err.status), true);
    });
  }

  function bind(){
    document.addEventListener('click', function(event){
      var btn = event.target && event.target.closest ? event.target.closest('#manual-scan-btn') : null;
      if (!btn) return;
      event.preventDefault();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation(); else event.stopPropagation();
      show();
    }, true);
    document.addEventListener('keydown', function(event){ if (event.key === 'Escape') close(); }, true);
  }

  function apply(){ ensureButton(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ apply(); bind(); refreshLatestScan(); }, { once: true });
  else { apply(); bind(); refreshLatestScan(); }
  window.addEventListener('load', function(){ apply(); refreshLatestScan(); }, { once: true });
  [150, 500, 1200, 2400].forEach(function(delay){ setTimeout(apply, delay); });
  if (window.MutationObserver) {
    new MutationObserver(function(){ window.requestAnimationFrame(apply); })
      .observe(document.documentElement, { childList: true, subtree: true });
  }
})();
