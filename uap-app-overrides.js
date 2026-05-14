(function(){
  'use strict';

  if (window.__uapAppFinalLayer) return;
  window.__uapAppFinalLayer = true;

  var STYLE_ID = 'uap-app-overrides-style';
  var FILTER_ID = 'uap-new-filter-bar';
  var EMPTY_ID = 'uap-new-filter-empty';
  var NTFY_TOPIC = 'UAP-News26';
  var NEW_WINDOW_MS = 24 * 60 * 60 * 1000;
  var APP_URL = 'https://cpg23.github.io/UAP/';
  var state = {
    feed: { articles: [] },
    newOnly: false,
    translated: {}
  };
  var GERMAN_MARKERS = /[\u00e4\u00f6\u00fc\u00df]|\b(der|die|das|den|dem|des|und|oder|nicht|eine|einer|einen|mit|von|fuer|f\u00fcr|ueber|\u00fcber|heute|wird|wurden|nachrichten|quelle|artikel)\b/i;

  function compact(value){ return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function slug(value){ return compact(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'article'; }
  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"]/g, function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch];
    });
  }
  function looksGerman(text){ return GERMAN_MARKERS.test(String(text || '')); }
  function articleId(article){ return compact(article && article.id) || slug(article && article.title); }
  function sourceKey(source){ return compact(source && (source.link || source.url || source.source + '|' + source.title)).toLowerCase(); }
  function parseArticleTime(article, feed){
    var candidates = [article && article.publishedAt, article && article.detectedAt, article && article.createdAt, article && article.updatedAt, article && article.timestamp, article && article.date, feed && feed.timestamp];
    for (var i = 0; i < candidates.length; i++) {
      var value = candidates[i];
      var t = Date.parse(value && String(value).length <= 10 ? String(value) + 'T00:00:00Z' : value);
      if (!isNaN(t)) return t;
    }
    return 0;
  }
  function formatDate(value){
    if (!value) return '';
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value).slice(0, 10);
    try { return d.toLocaleDateString('de-AT', { day:'2-digit', month:'2-digit', year:'numeric' }); }
    catch(e){ return d.toISOString().slice(0, 10); }
  }
  function isNewArticle(article){
    var time = parseArticleTime(article, state.feed);
    var age = Date.now() - time;
    return !!time && age >= 0 && age <= NEW_WINDOW_MS;
  }
  function sourcesFor(article){
    var sources = [];
    if (article && (article.link || article.url)) sources.push({ source: article.source || 'Quelle', link: article.link || article.url, title: article.title || '' });
    (article && article.otherSources || []).forEach(function(source){
      if (source && (source.link || source.url)) sources.push({ source: source.source || 'Quelle', link: source.link || source.url, title: source.title || '' });
    });
    var seen = {};
    return sources.filter(function(source){
      var key = sourceKey(source);
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }
  function translationBag(article){ return article && (article.translations || article.translation) || null; }
  function choosePrepared(article){
    var bag = translationBag(article);
    if (!bag) return null;
    var sourceIsGerman = looksGerman((article.title || '') + ' ' + (article.summary || ''));
    var entry = sourceIsGerman ? bag.en : bag.de;
    if (entry && entry.provider !== 'original' && (entry.title || entry.summary)) return entry;
    if (bag.de && bag.de.provider !== 'original') return bag.de;
    if (bag.en && bag.en.provider !== 'original') return bag.en;
    return null;
  }
  function findArticleById(id){
    return (state.feed.articles || []).filter(function(article){ return articleId(article) === id; })[0] || null;
  }

  function injectStyle(){
    var css = [
      '#loading{background:#030a0f!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
      '#loading::before{content:"";position:absolute;inset:0;background:#030a0f;z-index:-1}',
      '#loading .startup-panel,#loading .startup-panel-label,#loading-status{display:none!important}',
      '#loading .startup-panel-wrap{bottom:22px!important;gap:0!important}',
      '.startup-title{display:inline-block!important;position:absolute!important;top:calc(8px + env(safe-area-inset-top))!important;left:4px!important;right:auto!important;transform:none!important;margin:0!important;text-align:left!important;color:#eafcff!important;font-family:"Rajdhani",sans-serif!important;font-weight:700!important;font-size:clamp(72px,22vw,136px)!important;line-height:.82!important;letter-spacing:2px!important;text-transform:none!important;text-shadow:0 0 8px rgba(255,255,255,.65),0 0 22px rgba(0,212,255,.9),0 0 44px rgba(0,255,157,.35)!important;white-space:nowrap!important;z-index:2!important;animation:uapStartupLogoPulse 3.2s ease-in-out infinite!important}',
      '.startup-title::after,.brand-title::after{content:"";position:absolute;left:1px;right:0;bottom:-7px;height:2px;background:linear-gradient(90deg,#00d4ff,#00ff9d,transparent);box-shadow:0 0 18px rgba(0,212,255,.95)}',
      '.startup-credit{position:absolute!important;top:calc(10px + env(safe-area-inset-top) + clamp(86px,23vw,150px))!important;left:8px!important;color:#c6f4ff!important;font-family:"Share Tech Mono",monospace!important;font-size:clamp(9px,2.5vw,12px)!important;letter-spacing:1.8px!important;text-shadow:0 0 6px rgba(255,255,255,.45),0 0 16px rgba(0,212,255,.75)!important;z-index:2!important}',
      '.alien-head{width:min(760px,120vw)!important;max-width:none!important;animation:uapAlienSteadyZoom 13s linear infinite!important;will-change:transform,opacity!important;transform-origin:center center!important}',
      '@keyframes uapAlienSteadyZoom{0%{opacity:.56;transform:translate3d(0,0,0) scale(1.06)}50%{opacity:.78;transform:translate3d(0,-1px,0) scale(1.5)}100%{opacity:.92;transform:translate3d(0,0,0) scale(1.86)}}',
      '@keyframes uapStartupLogoPulse{0%,100%{filter:brightness(.8)}45%{filter:brightness(1.45)}}',
      '.brand{position:relative;padding-left:2px}.brand-title{display:inline-block!important;position:relative!important;color:#eafcff!important;font-family:"Rajdhani",sans-serif!important;font-weight:700!important;font-size:clamp(28px,8vw,46px)!important;line-height:.92!important;letter-spacing:2px!important;text-transform:none!important;text-shadow:0 0 8px rgba(255,255,255,.65),0 0 22px rgba(0,212,255,.9),0 0 44px rgba(0,255,157,.35)!important;white-space:nowrap!important}',
      '#uap-new-filter-bar{display:flex;align-items:center;justify-content:flex-start;gap:10px;margin:0 0 12px;padding:10px 0;border-bottom:1px solid rgba(13,58,92,.65)}',
      '#uap-new-filter-toggle{min-height:34px;padding:0 12px;border:1px solid rgba(0,212,255,.44);background:rgba(0,212,255,.055);color:#bfefff;font-family:"Share Tech Mono",monospace;font-size:10px;letter-spacing:1.2px;cursor:pointer;text-transform:uppercase}',
      '#uap-new-filter-toggle.active{border-color:rgba(0,255,157,.88);background:rgba(0,255,157,.15);color:#d8ffe9;box-shadow:0 0 18px rgba(0,255,157,.24)}',
      '#uap-new-filter-empty{display:none;margin:0 0 12px;padding:11px 12px;border:1px solid rgba(0,212,255,.28);background:rgba(0,212,255,.055);color:#9fc7d4;font-family:"Share Tech Mono",monospace;font-size:10px;line-height:1.5}',
      'body.uap-new-filter-active.uap-new-filter-empty #uap-new-filter-empty{display:block}',
      '#feed{display:flex!important;flex-direction:column!important;gap:12px!important;overflow-anchor:none!important}',
      '.article-card{cursor:pointer;transform:translateZ(0);overflow-anchor:none!important}.article-card.uap-detail-open{contain:layout style!important}.article-card h2{color:#eef9fd!important;font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif!important;font-weight:700!important;letter-spacing:0!important;text-transform:none!important;text-shadow:none!important}',
      '.article-main{width:100%;text-align:left;border:0;background:transparent;color:inherit;padding:14px 16px 12px 18px;cursor:pointer;overflow-anchor:none!important}',
      '.article-topline{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}.article-topline .badges{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:6px!important;margin:0!important;flex:1 1 auto}',
      '.article-date-prominent{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;color:#d7f6ff;border:1px solid rgba(13,58,92,.95);background:rgba(0,212,255,.085);padding:4px 8px;font-family:"Share Tech Mono",monospace;font-size:11px;letter-spacing:1.2px;white-space:nowrap}.article-date-prominent::before{content:"DATUM";color:#00d4ff;font-size:9px;letter-spacing:1.4px}',
      '.badge.sources{display:inline-flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;min-height:24px!important;padding:4px 8px!important;line-height:1!important;vertical-align:middle!important}',
      '.badge.quality{position:relative!important;display:inline-flex!important;align-items:center!important;gap:5px!important;padding:4px 8px!important;min-height:24px!important;border-color:rgba(0,255,157,.46)!important;background:linear-gradient(135deg,rgba(0,255,157,.13),rgba(0,212,255,.08))!important;cursor:pointer!important}.badge.quality::after{content:"i";display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;border:1px solid rgba(13,58,92,.95);border-radius:50%;color:#00d4ff;font-family:"Share Tech Mono",monospace;font-size:9px;line-height:1;letter-spacing:0}',
      '.article-card.uap-is-new{border-color:rgba(0,255,157,.95)!important;box-shadow:0 0 0 1px rgba(0,255,157,.38),0 0 24px rgba(0,255,157,.18)!important}.article-card.uap-is-new::before{background:#00ff9d!important;opacity:1!important;width:4px!important;box-shadow:0 0 18px rgba(0,255,157,.9)!important}.badge.uap-new-badge{border-color:rgba(0,255,157,.9)!important;background:rgba(0,255,157,.18)!important;color:#eafff4!important;box-shadow:0 0 16px rgba(0,255,157,.22)!important}',
      '.uap-summary-preview{display:none!important}.uap-detail-summary{display:none!important;margin:12px 16px 0 18px!important;color:#b7ccd5!important;line-height:1.55!important;font-size:14px!important;overflow-anchor:auto!important}.article-card.uap-detail-open .uap-detail-summary,.article-card.uap-detail-open .details{display:block!important}',
      '.details{display:none;border-top:1px solid rgba(13,58,92,.72);background:rgba(3,10,15,.46);padding:14px 16px 16px 18px;overflow-anchor:auto!important}.actions{display:flex;gap:8px;margin-bottom:12px}.translate-btn{min-height:34px;border:1px solid rgba(0,212,255,.42);background:rgba(0,212,255,.07);color:#00d4ff;font-family:"Share Tech Mono",monospace;font-size:10px;letter-spacing:1.2px;cursor:pointer}.article-card.uap-translation-active h2,.article-card.uap-translation-active .uap-detail-summary{color:#b8ffd7!important}',
      '.sources-title{color:#00ff9d;font-family:"Share Tech Mono",monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:9px}.source-list{display:grid;gap:8px}.source-link{display:block;border:1px solid rgba(13,58,92,.72);background:rgba(0,212,255,.035);padding:9px 10px;text-decoration:none}.source-name{color:#00d4ff;font-family:"Share Tech Mono",monospace;font-size:10px;letter-spacing:1.2px}.source-headline{margin-top:4px;color:#a9bfca;font-size:12px;line-height:1.35}',
      '.notify-btn{display:inline-flex!important;align-items:center!important;justify-content:center!important;position:relative}.notify-btn svg{width:19px;height:19px;display:block;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;fill:none}.notify-btn.active{color:#07130f!important;border-color:rgba(0,255,157,.9)!important;background:#00ff9d!important;box-shadow:0 0 18px rgba(0,255,157,.38)}.notify-btn.blocked{color:#ffb69c!important;border-color:rgba(255,107,53,.5)!important;background:rgba(255,107,53,.08)!important}.notify-btn.active .notify-slash{display:none}',
      '.quality-top-help{display:inline-flex;align-items:center;gap:8px;margin:0 0 12px;padding:7px 10px;border:1px solid rgba(0,255,157,.42);background:rgba(0,255,157,.075);color:#c6ffe4;font-family:"Share Tech Mono",monospace;font-size:11px;letter-spacing:1.1px;cursor:pointer}.quality-top-help .quality-info-dot{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border:1px solid rgba(0,212,255,.72);border-radius:50%;color:#00d4ff;font-size:10px;letter-spacing:0}',
      '.quality-overlay,.notify-guide-overlay{position:fixed;inset:0;z-index:3200;display:flex;align-items:flex-end;justify-content:center;padding:18px;background:rgba(1,6,10,.74);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}.quality-sheet,.notify-guide-sheet{width:min(540px,100%);border:1px solid rgba(0,212,255,.5);background:linear-gradient(180deg,rgba(8,20,32,.98),rgba(3,10,15,.99));box-shadow:0 0 36px rgba(0,212,255,.24);padding:16px;color:#d6e8f0}.quality-sheet h3,.notify-guide-sheet h3{margin:0 0 8px;color:#00d4ff;font-family:"Rajdhani",sans-serif;font-size:22px;letter-spacing:0}.quality-sheet p,.notify-guide-sheet p{margin:0 0 12px;color:#adc5cf;font-size:13px;line-height:1.5}.quality-rules,.notify-guide-steps{display:grid;gap:8px;margin:0 0 14px}.quality-rule,.notify-guide-step{display:grid;grid-template-columns:86px 1fr;gap:10px;align-items:start;border-top:1px solid rgba(13,58,92,.72);padding-top:8px;font-size:12px;line-height:1.45;color:#c2d4dc}.quality-points{color:#00d4ff;font-family:"Share Tech Mono",monospace;font-size:11px;white-space:nowrap}.quality-close,.notify-guide-btn{min-height:40px;border:1px solid rgba(0,212,255,.42);background:rgba(0,212,255,.07);color:#00d4ff;font-family:"Share Tech Mono",monospace;font-size:10px;letter-spacing:1.2px;cursor:pointer}.notify-guide-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.notify-guide-btn.primary{border-color:rgba(0,255,157,.65);background:rgba(0,255,157,.12);color:#00ff9d}',
      '.old-toggle,.quality-help,a.icon-btn[href*="latest-news.json"]{display:none!important}.old-list,.old-list.collapsed{display:flex!important;flex-direction:column!important;gap:12px!important;overflow:visible!important;max-height:none!important;height:auto!important}html{scroll-behavior:auto!important}',
      '@media(max-width:560px){.brand-title{font-size:clamp(27px,10vw,39px)!important;letter-spacing:1px!important}.startup-title{top:calc(7px + env(safe-area-inset-top))!important;left:3px!important;font-size:clamp(64px,22vw,104px)!important;letter-spacing:1px!important}.startup-credit{top:calc(8px + env(safe-area-inset-top) + clamp(76px,23vw,116px))!important;left:6px!important;letter-spacing:1.3px!important}.status{font-size:8px!important}}',
      '@media(max-width:420px){.article-topline{gap:8px}.article-date-prominent{font-size:10px;padding:4px 6px}.article-topline .badge{font-size:8px;padding:2px 5px}.quality-rule{grid-template-columns:76px 1fr}.notify-guide-actions{grid-template-columns:1fr}}'
    ].join('\n');
    var style = document.getElementById(STYLE_ID);
    if (!style) { style = document.createElement('style'); style.id = STYLE_ID; document.head.appendChild(style); }
    if (style.textContent !== css) style.textContent = css;
  }

  function setBranding(){
    document.title = 'UAP News';
    var apple = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (apple) apple.setAttribute('content', 'UAP News');
    var brand = document.querySelector('.brand-title');
    if (brand) brand.textContent = 'UAP News';
    var startup = document.querySelector('.startup-title');
    if (startup) startup.textContent = 'UAP News';
    var loading = document.getElementById('loading');
    if (loading && !document.querySelector('.startup-credit')) {
      var credit = document.createElement('div');
      credit.className = 'startup-credit';
      loading.appendChild(credit);
    }
    var creditEl = document.querySelector('.startup-credit');
    if (creditEl) creditEl.textContent = 'created by Chris Gehring';
    document.querySelectorAll('#loading .startup-panel,#loading .startup-panel-label,#loading-status').forEach(function(el){ el.remove(); });
  }
  function normalizeNotificationOpen(){
    try {
      var url = new URL(window.location.href);
      if (url.searchParams.has('notif') || url.searchParams.has('ids')) {
        url.searchParams.delete('notif');
        url.searchParams.delete('ids');
        window.history.replaceState({}, document.title, url.pathname + (url.search || '') + url.hash);
      }
    } catch(e) {}
  }

  function ensureStaticControls(){
    ensureNotifyButton();
    ensureQualityHelp();
    ensureFilterBar();
    var meta = document.getElementById('feed-meta');
    if (meta) meta.textContent = '';
  }
  function ensureFilterBar(){
    var feed = document.getElementById('feed');
    if (!feed || !feed.parentNode) return;
    if (!document.getElementById(FILTER_ID)) {
      var bar = document.createElement('div');
      bar.id = FILTER_ID;
      bar.innerHTML = '<button id="uap-new-filter-toggle" type="button" aria-pressed="false">Nur neue anzeigen</button>';
      feed.parentNode.insertBefore(bar, feed);
      var empty = document.createElement('div');
      empty.id = EMPTY_ID;
      empty.textContent = 'Keine neuen Artikel in den letzten 24 Stunden.';
      feed.parentNode.insertBefore(empty, feed);
    }
    var btn = document.getElementById('uap-new-filter-toggle');
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', function(e){
        e.preventDefault();
        state.newOnly = !state.newOnly;
        renderFeed();
      }, true);
    }
  }
  function ensureNotifyButton(){
    var row = document.querySelector('.button-row');
    if (!row) return;
    var btn = document.getElementById('notify-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'notify-btn';
      btn.className = 'icon-btn notify-btn';
      row.insertBefore(btn, row.firstChild);
    }
    var permission = ('Notification' in window) ? Notification.permission : 'unsupported';
    btn.classList.toggle('active', permission === 'granted');
    btn.classList.toggle('blocked', permission === 'denied');
    btn.setAttribute('aria-label', permission === 'granted' ? 'Push-Benachrichtigungen aktiv' : 'Push-Benachrichtigungen über ntfy öffnen');
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/><path class="notify-slash" d="M4 4l16 16"/></svg>';
  }
  function ensureQualityHelp(){
    if (document.querySelector('.quality-top-help')) return;
    var feed = document.getElementById('feed');
    if (!feed || !feed.parentNode) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quality-top-help';
    btn.innerHTML = '<span class="quality-info-dot">i</span><span>Wertung</span>';
    feed.parentNode.insertBefore(btn, feed);
  }

  function loadFeed(){
    return fetch('latest-news.json?app=' + Date.now(), { cache: 'no-store' })
      .then(function(resp){ return resp.ok ? resp.json() : { articles: [] }; })
      .then(function(feed){
        state.feed = feed || { articles: [] };
        if (!Array.isArray(state.feed.articles)) state.feed.articles = [];
        return state.feed;
      })
      .catch(function(){ state.feed = { articles: [] }; return state.feed; });
  }

  function sourceListHtml(article){
    return sourcesFor(article).map(function(source){
      var title = source.title && source.title !== article.title ? '<div class="source-headline">' + esc(source.title) + '</div>' : '';
      return '<a class="source-link" href="' + esc(source.link) + '" target="_blank" rel="noopener noreferrer"><div class="source-name">' + esc(source.source || 'Quelle') + '</div>' + title + '</a>';
    }).join('');
  }
  function articleHtml(article, index){
    var id = articleId(article);
    var sources = sourcesFor(article);
    var quality = Number(article.quality || article.sourceQuality || 0) || 0;
    var isNew = isNewArticle(article);
    var translated = state.translated[id];
    var title = translated && translated.title ? translated.title : article.title;
    var summary = translated && translated.summary ? translated.summary : article.summary;
    var cardClass = 'article-card' + (isNew ? ' uap-is-new' : '') + (translated ? ' uap-translation-active' : '');
    return '' +
      '<article class="' + cardClass + '" data-uap-id="' + esc(id) + '" data-uap-order="' + index + '" data-uap-quality="' + quality + '" data-uap-sort-time="' + parseArticleTime(article, state.feed) + '">' +
        '<button class="article-main" type="button" aria-expanded="false">' +
          '<div class="article-topline"><span class="article-date-prominent">' + esc(formatDate(article.publishedAt || article.date)) + '</span><div class="badges">' +
            (isNew ? '<span class="badge uap-new-badge">New</span>' : '') +
            '<span class="badge sources">' + sources.length + ' Quelle' + (sources.length === 1 ? '' : 'n') + '</span>' +
            '<span class="badge quality" role="button" tabindex="0">Wertung ' + quality + '</span>' +
          '</div></div>' +
          '<h2>' + esc(title || 'UAP News') + '</h2>' +
          '<div class="meta"><span>' + esc(article.source || 'UAP News') + '</span></div>' +
        '</button>' +
        '<div class="uap-summary-preview" id="summary-' + esc(id) + '">' + esc(summary || '') + '</div>' +
        '<div class="uap-detail-summary">' + esc(summary || '') + '</div>' +
        '<div class="details"><div class="actions"><button class="translate-btn" type="button">' + (translated ? 'Original anzeigen' : 'Übersetzen') + '</button></div><div class="sources-title">Quellen</div><div class="source-list">' + sourceListHtml(article) + '</div></div>' +
      '</article>';
  }
  function renderFeed(){
    ensureFilterBar();
    var feedEl = document.getElementById('feed');
    if (!feedEl) return;
    var articles = (state.feed.articles || []).slice();
    if (state.newOnly) articles = articles.filter(isNewArticle);
    feedEl.innerHTML = articles.map(articleHtml).join('');
    var btn = document.getElementById('uap-new-filter-toggle');
    if (btn) {
      btn.classList.toggle('active', state.newOnly);
      btn.setAttribute('aria-pressed', state.newOnly ? 'true' : 'false');
      btn.textContent = state.newOnly ? 'Alle anzeigen' : 'Nur neue anzeigen';
    }
    var newCount = (state.feed.articles || []).filter(isNewArticle).length;
    document.body.classList.toggle('uap-new-filter-active', state.newOnly);
    document.body.classList.toggle('uap-new-filter-empty', state.newOnly && newCount === 0);
  }

  function openNtfy(){ window.open('https://ntfy.sh/' + encodeURIComponent(NTFY_TOPIC), '_blank', 'noopener,noreferrer'); }
  function closeNotifyGuide(){ var old = document.querySelector('.notify-guide-overlay'); if (old) old.remove(); }
  function showNotifyGuide(){
    closeNotifyGuide();
    var overlay = document.createElement('div');
    overlay.className = 'notify-guide-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    var steps = [
      'Die Push-Meldungen kommen über die ntfy-App am Smartphone.',
      'Der Kanal in der ntfy-App muss exakt UAP-News26 heißen und abonniert sein.',
      'Ein Klick auf eine Push-Meldung öffnet die normale App-Ansicht.'
    ];
    overlay.innerHTML = '<div class="notify-guide-sheet"><h3>Push über ntfy-App</h3><p>Entscheidend ist das Abo in der ntfy-App. Die App selbst braucht keine zusätzlichen Rohdaten-Links.</p><div class="notify-guide-steps">' +
      steps.map(function(step, index){ return '<div class="notify-guide-step"><strong>' + (index + 1) + '</strong><span>' + step + '</span></div>'; }).join('') +
      '</div><div class="notify-guide-actions"><button type="button" class="notify-guide-btn primary" data-notify-primary>NTFY-KANAL ÖFFNEN</button><button type="button" class="notify-guide-btn" data-notify-close>SCHLIESSEN</button></div></div>';
    overlay.addEventListener('click', function(e){
      if (e.target === overlay || e.target.hasAttribute('data-notify-close')) closeNotifyGuide();
      if (e.target.hasAttribute('data-notify-primary')) openNtfy();
    });
    document.body.appendChild(overlay);
  }

  function closeQuality(){ var old = document.querySelector('.quality-overlay'); if (old) old.remove(); }
  function pointText(points){
    if (typeof points === 'string') return points;
    var n = Number(points) || 0;
    return (n > 0 ? '+' : '') + n + ' Pkt';
  }
  function qualityRows(article, score){
    if (article && Array.isArray(article.qualityBreakdown) && article.qualityBreakdown.length) return article.qualityBreakdown.slice();
    var mentions = article && article.mentions || 1;
    var sourceBonus = Math.min(28, Math.max(0, mentions - 1) * 7);
    return [
      { label: 'Basis', points: 27, text: 'Klarer UAP/UFO-Bezug, nachdem Unterhaltung, Gaming und Fiktion herausgefiltert wurden.' },
      { label: 'Relevanz', points: Math.max(0, score - 27 - sourceBonus), text: 'Punkte aus starken Begriffen, offiziellen Stellen und Quellenvertrauen.' },
      { label: 'Quellen', points: sourceBonus, text: mentions > 1 ? mentions + ' Quellen berichten über dasselbe Thema.' : 'Nur eine Quelle im aktuellen Feed.' }
    ];
  }
  function showQuality(article, general){
    closeQuality();
    var score = article ? Number(article.quality || article.sourceQuality || 0) || 0 : 0;
    var rows = general ? [
      { label:'Mehrere Quellen', points:'bis +40 Pkt', text:'Mehr Quellen erhöhen die Priorität, wenn sie zum gleichen Thema gehören.' },
      { label:'Quelle', points:'+14 / +9 Pkt', text:'Offizielle Quellen und etablierte Nachrichtenmedien werden stärker gewichtet.' },
      { label:'Begriffe', points:'bis +24 Pkt', text:'Relevante Begriffe wie Disclosure, Whistleblower, Pentagon, NASA, AARO oder Congress erhöhen die Relevanz.' },
      { label:'Basis', points:'+27 Pkt', text:'Klarer UAP/UFO-Bezug, nachdem Unterhaltung, Gaming und Fiktion herausgefiltert wurden.' }
    ] : qualityRows(article, score);
    rows.sort(function(a,b){
      if (/basis/i.test(a.label || '')) return 1;
      if (/basis/i.test(b.label || '')) return -1;
      return (Number(a.points) || 0) - (Number(b.points) || 0);
    });
    var overlay = document.createElement('div');
    overlay.className = 'quality-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = '<div class="quality-sheet"><h3>' + esc(general ? 'Wertung' : 'Wertung ' + score) + '</h3><p>Die Wertung sagt nicht, ob eine Aussage wahr ist. Sie zeigt, wie stark ein Artikel für UAP News priorisiert wird.</p><div class="quality-rules">' +
      rows.map(function(row){ return '<div class="quality-rule"><span class="quality-points">' + esc(pointText(row.points)) + '</span><span><strong>' + esc(row.label || 'Wertung') + ':</strong> ' + esc(row.text || '') + '</span></div>'; }).join('') +
      '</div><button type="button" class="quality-close">SCHLIESSEN</button></div>';
    overlay.addEventListener('click', function(e){ if (e.target === overlay || e.target.classList.contains('quality-close')) closeQuality(); });
    document.body.appendChild(overlay);
  }

  function toggleTranslation(card){
    var id = card && card.dataset.uapId;
    var article = findArticleById(id);
    if (!article) return;
    if (state.translated[id]) {
      delete state.translated[id];
      renderFeed();
      var restored = document.querySelector('.article-card[data-uap-id="' + CSS.escape(id) + '"]');
      if (restored) restored.classList.add('uap-detail-open');
      return;
    }
    var prepared = choosePrepared(article);
    if (!prepared) {
      var btn = card.querySelector('.translate-btn');
      if (btn) {
        btn.textContent = 'Übersetzung noch nicht bereit';
        setTimeout(function(){ if (btn.textContent === 'Übersetzung noch nicht bereit') btn.textContent = 'Übersetzen'; }, 2200);
      }
      return;
    }
    state.translated[id] = { title: compact(prepared.title || article.title), summary: compact(prepared.summary || article.summary) };
    renderFeed();
    var updated = document.querySelector('.article-card[data-uap-id="' + CSS.escape(id) + '"]');
    if (updated) updated.classList.add('uap-detail-open');
  }

  function bindEvents(){
    document.addEventListener('click', function(e){
      var notify = e.target.closest && e.target.closest('#notify-btn');
      if (notify) { e.preventDefault(); e.stopPropagation(); showNotifyGuide(); return; }
      var topHelp = e.target.closest && e.target.closest('.quality-top-help');
      if (topHelp) { e.preventDefault(); e.stopPropagation(); showQuality(null, true); return; }
      var quality = e.target.closest && e.target.closest('.badge.quality');
      if (quality) {
        e.preventDefault(); e.stopPropagation();
        showQuality(findArticleById(quality.closest('.article-card').dataset.uapId), false);
        return;
      }
      var translate = e.target.closest && e.target.closest('.translate-btn');
      if (translate) { e.preventDefault(); e.stopPropagation(); toggleTranslation(translate.closest('.article-card')); return; }
      var card = e.target.closest && e.target.closest('.article-card');
      if (!card || e.target.closest('a,input,select,textarea,.source-list,.quality-overlay,.notify-guide-overlay')) return;
      e.preventDefault();
      var open = !card.classList.contains('uap-detail-open');
      card.classList.toggle('uap-detail-open', open);
      var main = card.querySelector('.article-main');
      if (main) main.setAttribute('aria-expanded', open ? 'true' : 'false');
    }, true);
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape') { closeQuality(); closeNotifyGuide(); return; }
      var quality = e.target.closest && e.target.closest('.badge.quality');
      if (quality && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); quality.click(); }
    }, true);
  }

  function start(){
    injectStyle();
    setBranding();
    normalizeNotificationOpen();
    ensureStaticControls();
    bindEvents();
    loadFeed().then(function(){ ensureStaticControls(); renderFeed(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
