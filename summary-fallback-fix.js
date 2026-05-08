(function() {
  'use strict';

  function cardSummary(card) {
    var title = card.querySelector('h2');
    var source = card.querySelector('.source-name') || card.querySelector('.badge.sources');
    var date = card.querySelector('.article-date-prominent');
    var titleText = title ? title.textContent.trim() : 'diese Meldung';
    var sourceText = source ? source.textContent.trim() : 'der Quelle';
    var dateText = date ? date.textContent.replace(/^DATUM/i, '').trim() : '';
    var when = dateText ? ' vom ' + dateText : '';
    return 'Der Feed meldet' + when + ' einen Artikel von ' + sourceText + ' mit dem Titel: "' + titleText + '". Der vollständige Artikeltext konnte für diese Meldung nicht zuverlässig ausgelesen werden; deshalb enthält diese Zusammenfassung nur Angaben, die direkt aus dem Feed bzw. den gelisteten Quellen stammen.';
  }

  function apply() {
    document.querySelectorAll('.article-card').forEach(function(card) {
      var summary = card.querySelector('.summary');
      if (!summary) return;
      var text = summary.textContent.trim();
      if (!text || /^Keine belastbare Zusammenfassung vorhanden\.?$/i.test(text)) {
        summary.textContent = cardSummary(card);
      }
    });
  }

  function start() {
    apply();
    var observer = new MutationObserver(function() { setTimeout(apply, 0); });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
