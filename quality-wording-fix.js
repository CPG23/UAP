(function() {
  'use strict';

  function polishOverlay() {
    var sheet = document.querySelector('.quality-sheet');
    if (!sheet) return;
    var title = sheet.querySelector('h3');
    var line = sheet.querySelector('.quality-score-line');
    if (title && /^Wertung\s+0\s*$/i.test(title.textContent.trim())) {
      title.textContent = 'Wertung';
      if (line) line.textContent = 'Beim Antippen einer Artikel-Wertung werden die konkreten Punkte dieses Artikels angezeigt.';
    }
  }

  function ensureTopHint() {
    if (document.querySelector('.quality-top-help')) return;
    var feed = document.getElementById('feed');
    if (!feed || !feed.parentNode) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quality-top-help';
    btn.innerHTML = '<span class="quality-info-dot">i</span><span>Wertung</span>';
    btn.title = 'Erklärung zur Artikelwertung anzeigen';
    feed.parentNode.insertBefore(btn, feed);
  }

  function apply() {
    ensureTopHint();
    polishOverlay();
  }

  document.addEventListener('click', function() { setTimeout(apply, 0); }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
  new MutationObserver(function() { setTimeout(apply, 0); }).observe(document.documentElement, { childList: true, subtree: true });
})();
