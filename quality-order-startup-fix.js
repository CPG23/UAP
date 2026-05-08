(function() {
  'use strict';

  var STYLE_ID = 'uap-quality-order-startup-style';

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.startup-title{font-size:clamp(52px,15vw,92px)!important;line-height:.88!important;text-shadow:0 0 12px rgba(255,255,255,.86),0 0 32px rgba(0,212,255,1),0 0 74px rgba(0,255,157,.58)!important}',
      '.startup-credit{top:calc(8px + env(safe-area-inset-top) + clamp(62px,16vw,102px))!important}',
      '@media(max-width:560px){.startup-title{font-size:clamp(48px,16vw,78px)!important}.startup-credit{top:calc(7px + env(safe-area-inset-top) + clamp(58px,17vw,88px))!important}}',
      '.quality-sheet.general-quality .quality-score-line{color:#a9cbd7!important}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function parsePoints(row) {
    var text = row.querySelector('.quality-points');
    var match = text && text.textContent.match(/[-+]?\d+/);
    return match ? Number(match[0]) : 0;
  }

  function isBasis(row) {
    var strong = row.querySelector('strong');
    return /\bBasis\b/i.test(strong ? strong.textContent : row.textContent || '');
  }

  function sortArticleQualityRows(sheet) {
    var rules = sheet && sheet.querySelector('.quality-rules');
    if (!rules || sheet.classList.contains('general-quality')) return;
    var rows = Array.prototype.slice.call(rules.querySelectorAll('.quality-rule'));
    rows.sort(function(a, b) {
      if (isBasis(a) && !isBasis(b)) return 1;
      if (!isBasis(a) && isBasis(b)) return -1;
      return parsePoints(a) - parsePoints(b);
    });
    rows.forEach(function(row) { rules.appendChild(row); });
  }

  function polishGeneralOverlay(sheet) {
    var title = sheet && sheet.querySelector('h3');
    if (!title) return;
    if (/^Wertung\s+0\s*$/i.test(title.textContent.trim())) {
      sheet.classList.add('general-quality');
      title.textContent = 'Wertung';
      var line = sheet.querySelector('.quality-score-line');
      if (line) line.textContent = 'Beim Antippen einer Artikel-Wertung werden die konkreten Punkte dieses Artikels angezeigt.';
      sheet.querySelectorAll('.quality-rule').forEach(function(row) {
        var strong = row.querySelector('strong');
        var label = strong ? strong.textContent.replace(':', '').trim() : '';
        var text = row.querySelector('span:last-child');
        if (text && label) text.innerHTML = '<strong>' + label + ':</strong> ' + text.textContent.replace(label + ':', '').trim();
      });
    }
  }

  function apply() {
    injectStyle();
    document.querySelectorAll('.quality-sheet').forEach(function(sheet) {
      polishGeneralOverlay(sheet);
      sortArticleQualityRows(sheet);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
  document.addEventListener('click', function() { setTimeout(apply, 0); }, true);
  new MutationObserver(function() { setTimeout(apply, 0); }).observe(document.documentElement, { childList: true, subtree: true });
})();
