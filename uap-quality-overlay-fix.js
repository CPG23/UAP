(function(){
  'use strict';
  if (window.__uapQualityOverlayFix) return;
  window.__uapQualityOverlayFix = true;

  var STYLE_ID = 'uap-quality-overlay-fix-style';
  var feedPromise = null;

  function compact(value){ return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"]/g, function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch];
    });
  }
  function slug(value){ return compact(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'article'; }
  function articleId(article){ return compact(article && article.id) || slug(article && article.title); }
  function pointsNumber(value){
    if (typeof value === 'number') return value;
    var match = String(value || '').match(/-?\d+/);
    return match ? Number(match[0]) : 0;
  }
  function pointText(points){
    if (typeof points === 'string') return points;
    var n = Number(points) || 0;
    return (n > 0 ? '+' : '') + n + ' Pkt';
  }
  function scoreFor(article){ return Number(article && (article.quality || article.sourceQuality || 0)) || 0; }
  function sourceCount(article){ return Math.max(1, Number(article && article.mentions || 0) || (1 + ((article && article.otherSources || []).length || 0))); }

  function injectStyle(){
    var css = [
      '.quality-overlay{align-items:flex-end!important;padding:16px!important;}',
      '.quality-sheet{max-height:min(78vh,620px)!important;overflow:auto!important;border-color:rgba(0,255,157,.45)!important;}',
      '.quality-score-line{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 10px;padding:9px 10px;border:1px solid rgba(0,212,255,.32);background:rgba(0,212,255,.055);font-family:"Share Tech Mono",monospace;font-size:11px;color:#bdefff}',
      '.quality-score-line strong{color:#00ff9d;font-size:16px;font-weight:400}',
      '.quality-rules{gap:7px!important}',
      '.quality-rule{grid-template-columns:82px 1fr!important;border-top:1px solid rgba(13,58,92,.65)!important;padding-top:8px!important}',
      '.quality-rule strong{color:#dff7ff!important}',
      '.quality-rule.is-adjustment .quality-points{color:#00ff9d!important}',
      '.quality-rule.is-cap .quality-points{color:#ffc980!important}',
      '.quality-note{margin:10px 0 14px!important;color:#8fb2c0!important;font-family:"Share Tech Mono",monospace!important;font-size:10px!important;line-height:1.5!important}'
    ].join('\n');
    var style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
  }

  function loadFeed(){
    if (!feedPromise) {
      feedPromise = fetch('latest-news.json?quality=' + Date.now(), { cache: 'no-store' })
        .then(function(resp){ return resp.ok ? resp.json() : { articles: [] }; })
        .catch(function(){ return { articles: [] }; });
    }
    return feedPromise;
  }
  function findArticle(id){
    return loadFeed().then(function(feed){
      var articles = Array.isArray(feed.articles) ? feed.articles : [];
      return articles.filter(function(article){ return articleId(article) === id; })[0] || null;
    });
  }

  function normalizedRows(article){
    var rows = (article && Array.isArray(article.qualityBreakdown) ? article.qualityBreakdown : [])
      .filter(function(row){ return row && (row.label || row.text || row.points != null); })
      .map(function(row){
        return {
          label: compact(row.label || 'Wertung'),
          points: row.points,
          text: compact(row.text || '')
        };
      });
    if (!rows.length) {
      rows = [
        { label: 'Basis', points: Math.min(27, scoreFor(article)), text: 'Grundwertung, weil der Artikel als UAP/UFO-relevant erkannt wurde.' },
        { label: 'Relevanz', points: Math.max(0, scoreFor(article) - 27), text: 'Zusätzliche Punkte aus Begriffen, Quelle, Thema und Quellenanzahl.' }
      ];
    }
    var sum = rows.reduce(function(total, row){ return total + pointsNumber(row.points); }, 0);
    var score = scoreFor(article);
    var diff = score - sum;
    if (diff > 0) {
      rows.push({ label: 'Priorisierung', points: diff, text: 'Zusätzliche Anhebung durch die finale GitHub-Bewertung, z.B. wegen starkem Thema, Quellenlage oder Mindestwertung für besonders relevante Ereignisse.', adjustment: 'is-adjustment' });
    } else if (diff < 0) {
      rows.push({ label: 'Deckelung', points: diff, text: 'Die Rohpunkte wurden begrenzt, damit einzelne Artikel oder schwächere Quellentypen nicht zu hoch bewertet werden.', adjustment: 'is-cap' });
    }
    return rows;
  }

  function generalRows(feed){
    var map = {};
    (feed.articles || []).forEach(function(article){
      (article.qualityBreakdown || []).forEach(function(row){
        if (!row || !row.label) return;
        var label = compact(row.label);
        var point = pointsNumber(row.points);
        if (!map[label]) map[label] = { label: label, min: point, max: point, count: 0, text: compact(row.text || '') };
        map[label].min = Math.min(map[label].min, point);
        map[label].max = Math.max(map[label].max, point);
        map[label].count += 1;
        if (!map[label].text && row.text) map[label].text = compact(row.text);
      });
    });
    var rows = Object.keys(map).map(function(label){ return map[label]; });
    rows.sort(function(a,b){ return b.max - a.max || b.count - a.count; });
    return rows.slice(0, 9).map(function(row){
      var points = row.min === row.max ? pointText(row.max) : pointText(row.min) + ' bis ' + pointText(row.max).replace('+', '');
      return {
        label: row.label,
        points: points,
        text: row.text || ('Dieser Faktor wurde bei ' + row.count + ' aktuellen Artikeln verwendet.')
      };
    }).concat([{ label: 'Ausgleich', points: '+/-', text: 'Wenn die Summe der Faktoren nicht exakt der sichtbaren Wertung entspricht, zeigt das Artikel-Overlay zusätzlich Priorisierung oder Deckelung.' }]);
  }

  function closeQuality(){
    var old = document.querySelector('.quality-overlay');
    if (old) old.remove();
  }
  function overlayHtml(title, subtitle, rows, article){
    var scoreLine = article ? '<div class="quality-score-line"><span>Quellen: ' + sourceCount(article) + '</span><strong>' + scoreFor(article) + ' Punkte</strong></div>' : '';
    return '<div class="quality-sheet"><h3>' + esc(title) + '</h3>' +
      scoreLine +
      '<p>' + esc(subtitle) + '</p>' +
      '<div class="quality-rules">' + rows.map(function(row){
        var cls = row.adjustment ? ' ' + row.adjustment : '';
        return '<div class="quality-rule' + cls + '"><span class="quality-points">' + esc(pointText(row.points)) + '</span><span><strong>' + esc(row.label || 'Wertung') + ':</strong> ' + esc(row.text || '') + '</span></div>';
      }).join('') + '</div>' +
      '<p class="quality-note">Die Wertung ist eine Priorisierung für die App. Sie bewertet Relevanz und Quellenlage, nicht ob eine Behauptung wahr ist.</p>' +
      '<button type="button" class="quality-close">SCHLIESSEN</button></div>';
  }
  function showOverlay(html){
    closeQuality();
    var overlay = document.createElement('div');
    overlay.className = 'quality-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = html;
    overlay.addEventListener('click', function(e){
      if (e.target === overlay || e.target.classList.contains('quality-close')) closeQuality();
    });
    document.body.appendChild(overlay);
  }
  function showArticleQuality(id){
    findArticle(id).then(function(article){
      if (!article) return;
      showOverlay(overlayHtml('Wertung ' + scoreFor(article), 'Diese Aufschlüsselung kommt direkt aus den GitHub-Daten dieses Artikels.', normalizedRows(article), article));
    });
  }
  function showGeneralQuality(){
    loadFeed().then(function(feed){
      showOverlay(overlayHtml('Wertung', 'Die App sortiert nach dieser Punktzahl. Bei jedem Artikel ist die konkrete Aufschlüsselung hinterlegt.', generalRows(feed || { articles: [] }), null));
    });
  }

  function handleQualityEvent(e){
    var target = e.target;
    if (!target || !target.closest) return;
    var topHelp = target.closest('.quality-top-help');
    if (topHelp) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      showGeneralQuality();
      return;
    }
    var badge = target.closest('.badge.quality');
    if (badge) {
      var card = badge.closest('.article-card');
      var id = card && card.dataset.uapId;
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      showArticleQuality(id);
    }
  }

  injectStyle();
  window.addEventListener('click', handleQualityEvent, true);
  window.addEventListener('keydown', function(e){
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.closest && e.target.closest('.badge.quality')) handleQualityEvent(e);
  }, true);
})();
