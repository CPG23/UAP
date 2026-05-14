(function(){
  'use strict';

  var STYLE_ID = 'uap-app-overrides-style';
  var FILTER_ID = 'uap-new-filter-bar';
  var EMPTY_ID = 'uap-new-filter-empty';
  var NTFY_TOPIC = 'UAP-News26';
  var NEW_WINDOW_MS = 24 * 60 * 60 * 1000;
  var feedPromise = null;
  var feedData = null;
  var applying = false;
  var queued = false;
  var newOnly = false;
  var lastScrollY = 0;
  var restoreScrollUntil = 0;
  var GERMAN_MARKERS = /[\u00e4\u00f6\u00fc\u00df]|\b(der|die|das|den|dem|des|und|oder|nicht|eine|einer|einen|mit|von|fuer|f\u00fcr|ueber|\u00fcber|heute|wird|wurden|nachrichten|quelle|artikel)\b/i;

  function compact(value){ return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function slug(title){ return String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"]/g, function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch];
    });
  }
  function looksGerman(text){ return GERMAN_MARKERS.test(String(text || '')); }
  function sentences(text){ return compact(text).match(/[^.!?]+[.!?]+(?:\s|$)/g) || []; }
  function shortSummary(text, reference){
    var clean = compact(text);
    if (!clean) return '';
    var ref = compact(reference);
    var targetSentences = Math.max(1, Math.min(sentences(ref).length || 2, 5));
    var maxLen = ref ? Math.max(260, Math.min(760, Math.round(ref.length * 1.2))) : 520;
    var parts = sentences(clean);
    if (parts.length > targetSentences) clean = compact(parts.slice(0, targetSentences).join('')) || clean;
    if (clean.length <= maxLen) return clean;
    return clean.slice(0, maxLen).replace(/\s+\S*$/, '').replace(/[,:;]+$/, '').trim() + '.';
  }
  function formatDate(value){
    if (!value) return '';
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value).slice(0, 10);
    try { return d.toLocaleDateString('de-AT', { day:'2-digit', month:'2-digit', year:'numeric' }); }
    catch(e){ return d.toISOString().slice(0, 10); }
  }
  function articleId(article){ return compact(article && article.id) || slug(article && article.title); }
  function cardId(card){
    if (!card) return '';
    if (card.dataset && card.dataset.uapId) return card.dataset.uapId;
    var summary = card.querySelector('.summary[id], .uap-detail-summary[id]');
    if (summary && summary.id) return summary.id.replace(/^summary-/, '');
    var title = card.querySelector('h2');
    return title ? slug(title.textContent) : '';
  }
  function primarySummary(card){
    return card.querySelector('.uap-detail-summary') || card.querySelector('.summary:not(.translation)');
  }
  function allSummaryNodes(card){
    return Array.prototype.slice.call(card.querySelectorAll('.summary, .uap-detail-summary')).filter(function(el){
      return !el.classList.contains('translation');
    });
  }
  function setSummaries(card, text){ allSummaryNodes(card).forEach(function(el){ el.textContent = text; }); }

  function loadFeed(){
    if (!feedPromise) {
      feedPromise = fetch('latest-news.json?app=' + Date.now(), { cache: 'no-store' })
        .then(function(resp){ return resp.ok ? resp.json() : { articles: [] }; })
        .then(function(feed){ feedData = feed || { articles: [] }; return feedData; })
        .catch(function(){ feedData = { articles: [] }; return feedData; });
    }
    return feedPromise;
  }
  function articleMap(feed){
    var map = {};
    (feed && feed.articles || []).forEach(function(article, index){
      var id = articleId(article);
      if (id) map[id] = { article: article, index: index };
    });
    return map;
  }
  function findArticle(feed, card){
    var id = cardId(card);
    var map = articleMap(feed || feedData || {});
    if (id && map[id]) return map[id].article;
    var title = compact(card.querySelector('h2') && card.querySelector('h2').textContent).toLowerCase();
    var articles = feed && feed.articles || [];
    for (var i = 0; i < articles.length; i++) {
      if (compact(articles[i].title).toLowerCase() === title || slug(articles[i].title) === id) return articles[i];
    }
    return null;
  }
  function sourcesFor(article){
    var sources = [];
    if (article && (article.link || article.url)) sources.push({ source: article.source || 'Quelle', link: article.link || article.url, title: article.title || '' });
    (article && (article.otherSources || article._otherSources) || []).forEach(function(source){
      if (source && (source.link || source.url)) sources.push({ source: source.source || 'Quelle', link: source.link || source.url, title: source.title || '' });
    });
    var seen = {};
    return sources.filter(function(source){
      var key = compact(source.link || source.source + '|' + source.title).toLowerCase();
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }
  function sourceListHtml(article){
    return sourcesFor(article).map(function(source){
      var title = source.title && source.title !== article.title ? '<div class="source-headline">' + esc(source.title) + '</div>' : '';
      return '<a class="source-link" href="' + esc(source.link) + '" target="_blank" rel="noopener noreferrer"><div class="source-name">' + esc(source.source || 'Quelle') + '</div>' + title + '</a>';
    }).join('');
  }
  function translationBag(article){ return article && (article.translations || article.translation) || null; }
  function chooseOriginal(article, title, summary){
    var bag = translationBag(article);
    if (!bag) return null;
    var sourceIsGerman = looksGerman(title + ' ' + summary);
    var entry = sourceIsGerman ? bag.de : bag.en;
    if (entry && entry.provider === 'original' && (entry.title || entry.summary)) return entry;
    if (bag.en && bag.en.provider === 'original') return bag.en;
    if (bag.de && bag.de.provider === 'original') return bag.de;
    return null;
  }
  function choosePrepared(article, title, summary){
    var bag = translationBag(article);
    if (!bag) return null;
    var sourceIsGerman = looksGerman(title + ' ' + summary);
    var entry = sourceIsGerman ? bag.en : bag.de;
    if (entry && entry.provider !== 'original' && (entry.title || entry.summary)) return entry;
    if (bag.de && bag.de.provider !== 'original') return bag.de;
    if (bag.en && bag.en.provider !== 'original') return bag.en;
    return null;
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
      'body.uap-new-filter-active .article-card:not(.uap-is-new){display:none!important}body.uap-new-filter-active.uap-new-filter-empty #uap-new-filter-empty{display:block}',
      '.article-card{cursor:pointer}.article-card .article-main{cursor:pointer;overflow-anchor:none!important}.article-card h2{color:#eef9fd!important;font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif!important;font-weight:700!important;letter-spacing:0!important;text-transform:none!important;text-shadow:none!important}',
      '.article-card .summary:not(.uap-detail-summary){display:none!important}.article-card .uap-detail-summary{display:none!important;margin:12px 16px 0 18px!important;color:#b7ccd5!important;line-height:1.55!important;font-size:14px!important}.article-card.uap-detail-open .uap-detail-summary,.article-card.uap-detail-open .details{display:block!important}',
      '.article-card.uap-is-new{border-color:rgba(0,255,157,.95)!important;box-shadow:0 0 0 1px rgba(0,255,157,.38),0 0 24px rgba(0,255,157,.18)!important}.article-card.uap-is-new::before{background:#00ff9d!important;opacity:1!important;width:4px!important;box-shadow:0 0 18px rgba(0,255,157,.9)!important}',
      '.badge.uap-new-badge{border-color:rgba(0,255,157,.9)!important;background:rgba(0,255,157,.18)!important;color:#eafff4!important;box-shadow:0 0 16px rgba(0,255,157,.22)!important}',
      '.article-topline{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:9px}.article-topline .badges{justify-content:flex-end;margin:0;flex:1 1 auto}',
      '.article-date-prominent{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;color:#d7f6ff;border:1px solid rgba(13,58,92,.95);background:rgba(0,212,255,.085);padding:4px 8px;font-family:"Share Tech Mono",monospace;font-size:11px;letter-spacing:1.2px;white-space:nowrap}.article-date-prominent::before{content:"DATUM";color:#00d4ff;font-size:9px;letter-spacing:1.4px}',
      '.notify-btn{display:inline-flex!important;align-items:center!important;justify-content:center!important;position:relative}.notify-btn svg{width:19px;height:19px;display:block;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;fill:none}.notify-btn.active{color:#07130f!important;border-color:rgba(0,255,157,.9)!important;background:#00ff9d!important;box-shadow:0 0 18px rgba(0,255,157,.38)}.notify-btn.blocked{color:#ffb69c!important;border-color:rgba(255,107,53,.5)!important;background:rgba(255,107,53,.08)!important}.notify-btn.active .notify-slash{display:none}',
      '.quality-top-help{display:inline-flex;align-items:center;gap:8px;margin:0 0 12px;padding:7px 10px;border:1px solid rgba(0,255,157,.42);background:rgba(0,255,157,.075);color:#c6ffe4;font-family:"Share Tech Mono",monospace;font-size:11px;letter-spacing:1.1px;cursor:pointer}.quality-top-help .quality-info-dot{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border:1px solid rgba(0,212,255,.72);border-radius:50%;color:#00d4ff;font-size:10px;letter-spacing:0}.quality-help{display:none!important}',
      '.badge.quality{position:relative!important;display:inline-flex!important;align-items:center!important;gap:5px!important;padding-right:8px!important;border-color:rgba(0,255,157,.46)!important;background:linear-gradient(135deg,rgba(0,255,157,.13),rgba(0,212,255,.08))!important;cursor:pointer!important}.badge.quality::after{content:"i";display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;border:1px solid rgba(13,58,92,.95);border-radius:50%;color:#00d4ff;font-family:"Share Tech Mono",monospace;font-size:9px;line-height:1;letter-spacing:0}',
      '.quality-overlay,.notify-guide-overlay{position:fixed;inset:0;z-index:3200;display:flex;align-items:flex-end;justify-content:center;padding:18px;background:rgba(1,6,10,.74);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}.quality-sheet,.notify-guide-sheet{width:min(540px,100%);border:1px solid rgba(0,212,255,.5);background:linear-gradient(180deg,rgba(8,20,32,.98),rgba(3,10,15,.99));box-shadow:0 0 36px rgba(0,212,255,.24);padding:16px;color:#d6e8f0}.quality-sheet h3,.notify-guide-sheet h3{margin:0 0 8px;color:#00d4ff;font-family:"Rajdhani",sans-serif;font-size:22px;letter-spacing:0}.quality-sheet p,.notify-guide-sheet p{margin:0 0 12px;color:#adc5cf;font-size:13px;line-height:1.5}.quality-rules,.notify-guide-steps{display:grid;gap:8px;margin:0 0 14px}.quality-rule,.notify-guide-step{display:grid;grid-template-columns:86px 1fr;gap:10px;align-items:start;border-top:1px solid rgba(13,58,92,.72);padding-top:8px;font-size:12px;line-height:1.45;color:#c2d4dc}.quality-points{color:#00d4ff;font-family:"Share Tech Mono",monospace;font-size:11px;white-space:nowrap}.quality-close,.notify-guide-btn{min-height:40px;border:1px solid rgba(0,212,255,.42);background:rgba(0,212,255,.07);color:#00d4ff;font-family:"Share Tech Mono",monospace;font-size:10px;letter-spacing:1.2px;cursor:pointer}.notify-guide-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.notify-guide-btn.primary{border-color:rgba(0,255,157,.65);background:rgba(0,255,157,.12);color:#00ff9d}',
      '.article-card.uap-translation-active h2,.article-card.uap-translation-active .summary,.article-card.uap-translation-active .uap-detail-summary{color:#b8ffd7!important}.translate-btn.uap-translating,.translate-btn.uap-translated{border-color:rgba(0,255,157,.72)!important;color:#b8ffd7!important;background:rgba(0,255,157,.12)!important;box-shadow:0 0 16px rgba(0,255,157,.18)!important}.article-card .translation{display:none!important}',
      '.old-toggle{display:none!important}.old-list,.old-list.collapsed{display:flex!important;flex-direction:column!important;gap:12px!important;overflow:visible!important;max-height:none!important;height:auto!important}html{scroll-behavior:auto!important}#feed,.old-list{overflow-anchor:none!important}',
      '@media(max-width:560px){.brand-title{font-size:clamp(27px,10vw,39px)!important;letter-spacing:1px!important}.startup-title{top:calc(7px + env(safe-area-inset-top))!important;left:3px!important;font-size:clamp(64px,22vw,104px)!important;letter-spacing:1px!important}.startup-credit{top:calc(8px + env(safe-area-inset-top) + clamp(76px,23vw,116px))!important;left:6px!important;letter-spacing:1.3px!important}.status{font-size:8px!important}}',
      '@media(max-width:420px){.article-topline{gap:8px}.article-date-prominent{font-size:10px;padding:4px 6px}.article-topline .badge{font-size:8px;padding:2px 5px}.quality-rule{grid-template-columns:76px 1fr}.notify-guide-actions{grid-template-columns:1fr}}'
    ].join('\n');
    var style = document.getElementById(STYLE_ID);
    if (!style) { style = document.createElement('style'); style.id = STYLE_ID; document.head.appendChild(style); }
    if (style.textContent !== css) style.textContent = css;
  }

  function setTitles(){
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
    document.title = 'UAP News';
    var apple = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (apple) apple.setAttribute('content', 'UAP News');
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
    document.querySelectorAll('.notification-focus').forEach(function(el){ el.remove(); });
    document.querySelectorAll('.uap-hidden-by-notification').forEach(function(card){ card.classList.remove('uap-hidden-by-notification'); });
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
    btn.setAttribute('aria-label', permission === 'granted' ? 'Push-Benachrichtigungen aktiv' : 'Push-Benachrichtigungen deaktiviert');
    var state = permission === 'granted' ? 'active' : (permission === 'denied' ? 'blocked' : 'inactive');
    if (btn.dataset.bellState !== state || !btn.querySelector('svg')) {
      btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/><path class="notify-slash" d="M4 4l16 16"/></svg>';
      btn.dataset.bellState = state;
    }
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
      'Die Push-Meldungen sollen nur \u00fcber die ntfy-App am Smartphone kommen.',
      'Der Kanal in der ntfy-App muss exakt UAP-News26 hei\u00dfen und abonniert sein.',
      'Falls Chrome zus\u00e4tzlich Meldungen von ntfy.sh zeigt, deaktiviere in Chrome die Website-Benachrichtigungen f\u00fcr ntfy.sh.'
    ];
    overlay.innerHTML = '<div class="notify-guide-sheet"><h3>Push \u00fcber ntfy-App</h3><p>F\u00fcr diese App wird keine zus\u00e4tzliche Chrome-Benachrichtigung ben\u00f6tigt. Entscheidend ist das Abo in der ntfy-App.</p><div class="notify-guide-steps">' +
      steps.map(function(step, index){ return '<div class="notify-guide-step"><strong>' + (index + 1) + '</strong><span>' + step + '</span></div>'; }).join('') +
      '</div><div class="notify-guide-actions"><button type="button" class="notify-guide-btn primary" data-notify-primary>NTFY-KANAL \u00d6FFNEN</button><button type="button" class="notify-guide-btn" data-notify-close>SCHLIESSEN</button></div></div>';
    overlay.addEventListener('click', function(e){
      if (e.target === overlay || e.target.hasAttribute('data-notify-close')) closeNotifyGuide();
      if (e.target.hasAttribute('data-notify-primary')) openNtfy();
    });
    document.body.appendChild(overlay);
  }

  function ensureQualityHelp(){
    if (document.querySelector('.quality-top-help')) return;
    var target = null;
    Array.prototype.slice.call(document.querySelectorAll('h1,h2,h3,.section-title,.feed-title')).some(function(el){
      if (/Aktuelle\s+Themen/i.test(el.textContent || '')) { target = el; return true; }
      return false;
    });
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quality-top-help';
    btn.innerHTML = '<span class="quality-info-dot">i</span><span>Wertung</span>';
    if (target && target.parentNode) target.parentNode.insertBefore(btn, target.nextSibling);
    else {
      var notice = document.getElementById('notice');
      if (notice && notice.parentNode) notice.parentNode.insertBefore(btn, notice);
    }
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
      { label: 'Relevanz', points: Math.max(0, score - 27 - sourceBonus), text: 'Punkte aus starken Begriffen im Titel/Text, offiziellen Stellen und Quellenvertrauen.' },
      { label: 'Quellen', points: sourceBonus, text: mentions > 1 ? mentions + ' Quellen berichten \u00fcber dasselbe Thema.' : 'Nur eine Quelle im aktuellen Feed.' }
    ];
  }
  function showQuality(score, article, general){
    closeQuality();
    var rows = general ? [
      { label:'Mehrere Quellen', points:'bis +28 Pkt', text:'7 Punkte pro weiterer unabh\u00e4ngiger Quelle zum gleichen Thema.' },
      { label:'Quelle', points:'+14 / +9 Pkt', text:'14 Punkte f\u00fcr offizielle Quellen, 9 Punkte f\u00fcr etablierte Nachrichtenmedien.' },
      { label:'Begriffe', points:'bis +24 Pkt', text:'Je relevanter Begriff wie Disclosure, Whistleblower, Pentagon, NASA, AARO oder Congress.' },
      { label:'Offiziell', points:'bis +18 Pkt', text:'Wenn Beh\u00f6rden, offizielle Stellen, klassifizierte Dokumente oder Regierungskontext vorkommen.' },
      { label:'Basis', points:'+27 Pkt', text:'Klarer UAP/UFO-Bezug, nachdem Unterhaltung, Gaming und Fiktion herausgefiltert wurden.' }
    ] : qualityRows(article, score);
    rows.sort(function(a,b){
      if (/basis/i.test(a.label || '')) return 1;
      if (/basis/i.test(b.label || '')) return -1;
      return (Number(a.points) || 0) - (Number(b.points) || 0);
    });
    var shown = general ? 'Wertung' : 'Wertung ' + (score || article && article.quality || 0);
    var overlay = document.createElement('div');
    overlay.className = 'quality-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = '<div class="quality-sheet"><h3>' + esc(shown) + '</h3><div class="quality-score-line">' + (general ? 'So entstehen die Punkte.' : 'Punkte in diesem Artikel') + '</div><p>Die Wertung sagt nicht, ob eine Aussage wahr ist. Sie zeigt, wie stark ein Artikel f\u00fcr UAP News priorisiert wird.</p><div class="quality-rules">' +
      rows.map(function(row){ return '<div class="quality-rule"><span class="quality-points">' + esc(pointText(row.points)) + '</span><span><strong>' + esc(row.label || 'Wertung') + ':</strong> ' + esc(row.text || '') + '</span></div>'; }).join('') +
      '</div><button type="button" class="quality-close">SCHLIESSEN</button></div>';
    overlay.addEventListener('click', function(e){ if (e.target === overlay || e.target.classList.contains('quality-close')) closeQuality(); });
    document.body.appendChild(overlay);
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
      btn.addEventListener('click', function(e){ e.preventDefault(); newOnly = !newOnly; updateFilter(); }, true);
    }
  }
  function parseArticleTime(article, feed){
    var candidates = [article && article.publishedAt, article && article.detectedAt, article && article.createdAt, article && article.updatedAt, article && article.timestamp, article && article.date, feed && feed.timestamp];
    for (var i = 0; i < candidates.length; i++) {
      var value = candidates[i];
      var t = Date.parse(value && String(value).length <= 10 ? String(value) + 'T00:00:00Z' : value);
      if (!isNaN(t)) return t;
    }
    return 0;
  }
  function isNewArticle(article, feed){
    var time = parseArticleTime(article, feed);
    var age = Date.now() - time;
    return !!time && age >= 0 && age <= NEW_WINDOW_MS;
  }
  function setNewBadge(card, active){
    var badges = card.querySelector('.badges');
    var existing = card.querySelector('.uap-new-badge');
    card.classList.toggle('uap-is-new', !!active);
    if (active && badges && !existing) {
      var badge = document.createElement('span');
      badge.className = 'badge uap-new-badge';
      badge.textContent = 'New';
      badges.insertBefore(badge, badges.firstChild);
    } else if (!active && existing) existing.remove();
  }
  function updateFilter(){
    var btn = document.getElementById('uap-new-filter-toggle');
    document.body.classList.toggle('uap-new-filter-active', newOnly);
    if (btn) {
      btn.classList.toggle('active', newOnly);
      btn.setAttribute('aria-pressed', newOnly ? 'true' : 'false');
      btn.textContent = newOnly ? 'Alle anzeigen' : 'Nur neue anzeigen';
    }
    var feed = document.getElementById('feed');
    var count = feed ? feed.querySelectorAll('.article-card.uap-is-new').length : 0;
    document.body.classList.toggle('uap-new-filter-empty', newOnly && count === 0);
  }

  function articleHtml(article){
    var id = articleId(article);
    var sources = sourcesFor(article);
    return '' +
      '<button class="article-main" type="button">' +
        '<div class="badges"><span class="badge sources">' + sources.length + ' Quelle' + (sources.length === 1 ? '' : 'n') + '</span><span class="badge quality" role="button" tabindex="0">Wertung ' + esc(article.quality || 0) + '</span></div>' +
        '<h2>' + esc(article.title || 'UAP News') + '</h2>' +
        '<div class="meta"><span>' + esc(article.source || 'UAP News') + '</span><span>' + esc(formatDate(article.publishedAt || article.date)) + '</span></div>' +
      '</button>' +
      '<div class="summary" id="summary-' + esc(id) + '">' + esc(article.summary || '') + '</div>' +
      '<div class="details"><div class="actions"><button class="translate-btn" type="button">\u00dcbersetzen</button></div><div class="sources-title">Quellen</div><div class="source-list">' + sourceListHtml(article) + '</div></div>';
  }
  function renderMissing(feed){
    var feedEl = document.getElementById('feed');
    if (!feedEl || !feed || !Array.isArray(feed.articles)) return;
    var existing = {};
    feedEl.querySelectorAll('.article-card').forEach(function(card){ existing[cardId(card)] = true; });
    feed.articles.forEach(function(article){
      var id = articleId(article);
      if (!id || existing[id]) return;
      var card = document.createElement('article');
      card.className = 'article-card uap-backfilled-article';
      card.dataset.uapId = id;
      card.innerHTML = articleHtml(article);
      feedEl.appendChild(card);
      existing[id] = true;
    });
  }
  function syncCard(card, article, feed, index){
    var id = article ? articleId(article) : cardId(card);
    card.dataset.uapId = id;
    card.classList.remove('unread', 'uap-hidden-by-notification', 'uap-seen-overflow');
    card.querySelectorAll('.action-link,.translation').forEach(function(el){ el.remove(); });
    var badges = card.querySelector('.badges');
    card.querySelectorAll('.badges .badge').forEach(function(badge){
      if (!badge.classList.contains('sources') && !badge.classList.contains('quality') && !badge.classList.contains('uap-new-badge')) badge.remove();
    });
    var q = card.querySelector('.badge.quality');
    if (q) {
      q.textContent = q.textContent.replace(/^Q\s*/i, 'Wertung ');
      q.title = 'Details zur Wertung anzeigen';
      q.setAttribute('role', 'button');
      q.setAttribute('tabindex', '0');
    }
    if (article) {
      var sources = sourcesFor(article);
      var sourceBadge = card.querySelector('.badge.sources');
      if (sourceBadge) sourceBadge.textContent = sources.length + ' Quelle' + (sources.length === 1 ? '' : 'n');
      var sourceList = card.querySelector('.source-list');
      if (sourceList) sourceList.innerHTML = sourceListHtml(article);
      var summary = card.querySelector('.summary:not(.uap-detail-summary)');
      if (summary && article.summary && card.dataset.replaceTranslated !== '1') summary.textContent = article.summary;
      setNewBadge(card, isNewArticle(article, feed));
      card.dataset.uapOrder = String(index);
    }
    var main = card.querySelector('.article-main');
    var h2 = main && main.querySelector('h2');
    var meta = main && main.querySelector('.meta');
    if (main && h2 && badges && meta) {
      var date = meta.querySelector('span:last-child');
      if (date) {
        date.className = 'article-date-prominent';
        var top = main.querySelector('.article-topline');
        if (!top) { top = document.createElement('div'); top.className = 'article-topline'; main.insertBefore(top, h2); }
        if (date.parentNode !== top) top.appendChild(date);
        if (badges.parentNode !== top) top.appendChild(badges);
      }
      if (meta.parentNode) meta.remove();
    }
  }
  function syncFeed(feed){
    var feedEl = document.getElementById('feed');
    if (!feedEl) return;
    feedEl.querySelectorAll(':scope > .old-list').forEach(function(list){
      while (list.firstChild) feedEl.insertBefore(list.firstChild, list);
      list.remove();
    });
    feedEl.querySelectorAll(':scope > .old-toggle').forEach(function(el){ el.remove(); });
    renderMissing(feed);
    var map = articleMap(feed);
    feedEl.querySelectorAll('.article-card').forEach(function(card){
      var info = map[cardId(card)];
      syncCard(card, info && info.article, feed, info ? info.index : 9999);
    });
    Array.prototype.slice.call(feedEl.querySelectorAll('.article-card')).sort(function(a,b){
      return Number(a.dataset.uapOrder || 9999) - Number(b.dataset.uapOrder || 9999);
    }).forEach(function(card){ feedEl.appendChild(card); });
    updateFilter();
  }

  function ensureDetails(card){
    return loadFeed().then(function(feed){
      var article = findArticle(feed, card);
      var details = card.querySelector('.details');
      if (!details) { details = document.createElement('div'); details.className = 'details'; card.appendChild(details); }
      var detail = card.querySelector('.uap-detail-summary');
      if (!detail) {
        detail = document.createElement('div');
        detail.className = 'uap-detail-summary';
        var oldSummary = card.querySelector('.summary:not(.uap-detail-summary)');
        detail.textContent = article && article.summary || oldSummary && oldSummary.textContent || '';
        card.insertBefore(detail, details);
      }
      if (!details.querySelector('.actions')) details.insertAdjacentHTML('afterbegin', '<div class="actions"><button class="translate-btn" type="button">\u00dcbersetzen</button></div>');
      if (!details.querySelector('.source-list')) details.insertAdjacentHTML('beforeend', '<div class="sources-title">Quellen</div><div class="source-list"></div>');
      if (article) {
        var list = details.querySelector('.source-list');
        if (list) list.innerHTML = sourceListHtml(article);
      }
      return detail;
    });
  }
  function setOpen(card, open){
    if (!card) return;
    card.classList.toggle('uap-detail-open', !!open);
    card.classList.toggle('open', !!open);
    if (open) {
      ensureDetails(card).then(function(detail){ if (detail) detail.style.display = 'block'; });
    } else {
      card.querySelectorAll('.uap-detail-summary').forEach(function(summary){ summary.style.display = 'none'; });
    }
  }
  function rememberScroll(){
    lastScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    restoreScrollUntil = Date.now() + 900;
    [0,40,120,260,520,820].forEach(function(delay){ setTimeout(restoreScroll, delay); });
  }
  function restoreScroll(){
    if (Date.now() <= restoreScrollUntil && Math.abs((window.scrollY || 0) - lastScrollY) > 24) window.scrollTo(0, lastScrollY);
  }

  function handleTranslate(e){
    var btn = e.target && e.target.closest && e.target.closest('.translate-btn');
    if (!btn) return false;
    var card = btn.closest('.article-card');
    if (!card) return false;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    loadFeed().then(function(feed){
      var article = findArticle(feed, card);
      var title = card.querySelector('h2');
      var summary = primarySummary(card);
      if (!article || !title || !summary) throw new Error('translation missing');
      if (card.dataset.replaceTranslated === '1') {
        title.textContent = card.dataset.replaceOriginalTitle || title.textContent;
        setSummaries(card, card.dataset.replaceOriginalSummary || '');
        card.dataset.replaceTranslated = '0';
        card.classList.remove('uap-translation-active');
        btn.textContent = '\u00dcbersetzen';
        return;
      }
      card.dataset.replaceOriginalTitle = card.dataset.replaceOriginalTitle || compact(title.textContent);
      card.dataset.replaceOriginalSummary = card.dataset.replaceOriginalSummary || compact(summary.textContent);
      var original = chooseOriginal(article, card.dataset.replaceOriginalTitle, card.dataset.replaceOriginalSummary);
      if (original) {
        card.dataset.replaceOriginalTitle = compact(original.title || card.dataset.replaceOriginalTitle);
        card.dataset.replaceOriginalSummary = compact(original.summary || card.dataset.replaceOriginalSummary);
      }
      var prepared = choosePrepared(article, card.dataset.replaceOriginalTitle, card.dataset.replaceOriginalSummary);
      if (!prepared) throw new Error('prepared translation missing');
      title.textContent = compact(prepared.title || card.dataset.replaceOriginalTitle);
      setSummaries(card, shortSummary(prepared.summary || card.dataset.replaceOriginalSummary, card.dataset.replaceOriginalSummary));
      card.dataset.replaceTranslated = '1';
      card.classList.add('uap-translation-active');
      btn.textContent = 'Original anzeigen';
    }).catch(function(){
      btn.textContent = '\u00dcbersetzung noch nicht bereit';
      setTimeout(function(){ if (btn.textContent === '\u00dcbersetzung noch nicht bereit') btn.textContent = '\u00dcbersetzen'; }, 2200);
    });
    return true;
  }

  function isInteractive(target){
    return !!(target && target.closest && target.closest('a,input,select,textarea,.badge.quality,.quality-overlay,.notify-guide-overlay,.source-list,.translate-btn,.quality-top-help,#notify-btn'));
  }
  function apply(){
    if (applying) return;
    applying = true;
    queued = false;
    injectStyle();
    setTitles();
    normalizeNotificationOpen();
    ensureFilterBar();
    ensureNotifyButton();
    ensureQualityHelp();
    document.querySelectorAll('a.icon-btn[href*="latest-news.json"],.quality-help').forEach(function(el){ el.remove(); });
    var meta = document.getElementById('feed-meta');
    if (meta) meta.textContent = '';
    loadFeed().then(syncFeed).finally(function(){ applying = false; });
  }
  function queue(){
    if (queued || applying) return;
    queued = true;
    setTimeout(apply, 120);
  }

  document.addEventListener('click', function(e){
    if (handleTranslate(e)) return;
    var notify = e.target.closest && e.target.closest('#notify-btn');
    if (notify) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); showNotifyGuide(); return; }
    var topHelp = e.target.closest && e.target.closest('.quality-top-help');
    if (topHelp) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); showQuality(0, null, true); return; }
    var quality = e.target.closest && e.target.closest('.badge.quality');
    if (quality) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      var card = quality.closest('.article-card');
      loadFeed().then(function(feed){
        var article = findArticle(feed, card);
        var match = quality.textContent.match(/\d+/);
        showQuality(match ? Number(match[0]) : 0, article, false);
      });
      return;
    }
    var card = e.target.closest && e.target.closest('.article-card');
    if (!card || isInteractive(e.target)) return;
    rememberScroll();
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    setOpen(card, !card.classList.contains('uap-detail-open'));
  }, true);

  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') { closeQuality(); closeNotifyGuide(); return; }
    var quality = e.target.closest && e.target.closest('.badge.quality');
    if (quality && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); quality.click(); return; }
    var card = e.target.closest && e.target.closest('.article-card');
    if (card && !isInteractive(e.target) && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(card, !card.classList.contains('uap-detail-open')); }
  }, true);

  function start(){
    apply();
    [250,800,1600,3000].forEach(function(delay){ setTimeout(queue, delay); });
    new MutationObserver(function(){ restoreScroll(); queue(); }).observe(document.getElementById('feed') || document.body, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['class'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
