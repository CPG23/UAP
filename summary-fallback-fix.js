(function() {
  'use strict';

  function cardSummary(card) {
    var title = card.querySelector('h2');
    var source = card.querySelector('.source-name') || card.querySelector('.badge.sources');
    var date = card.querySelector('.article-date-prominent');
    var titleText = title ? title.textContent.trim() : 'this report';
    var sourceText = source ? source.textContent.trim() : 'the listed source';
    var dateText = date ? date.textContent.replace(/^DATUM/i, '').trim() : '';
    var when = dateText ? ' dated ' + dateText : '';
    return 'The feed lists an article from ' + sourceText + when + ' with the title: "' + titleText + '". The full article text could not be reliably extracted for this item, so this summary only uses information shown in the feed and the listed sources. No extra claims have been added.';
  }

  function apply() {
    document.querySelectorAll('.article-card').forEach(function(card) {
      var summary = card.querySelector('.summary');
      if (!summary) return;
      var text = summary.textContent.trim();
      if (!text || /^Keine belastbare Zusammenfassung vorhanden\.?$/i.test(text) || /^No reliable summary available\.?$/i.test(text)) {
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
