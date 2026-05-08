(function(){
  function close(){ var old = document.querySelector('.quality-info-overlay'); if (old) old.remove(); }
  function row(points, label, text){
    return '<div class="quality-rule"><span class="quality-points">+' + points + ' Pkt</span><span><strong>' + label + ':</strong> ' + text + '</span></div>';
  }
  function show(){
    close();
    var overlay = document.createElement('div');
    overlay.className = 'quality-overlay quality-info-overlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.innerHTML = '<div class="quality-sheet general-quality">' +
      '<h3>Wertung</h3>' +
      '<div class="quality-score-line">So entstehen die Punkte. Es gibt keine Minuspunkte.</div>' +
      '<p>Die Wertung sagt nicht, ob eine Aussage wahr ist. Sie zeigt, wie stark ein Artikel fuer UAP News priorisiert wird.</p>' +
      '<div class="quality-rules">' +
        row(27, 'Basis', 'klarer UAP/UFO-Bezug, nachdem Unterhaltung, Gaming und Fiktion herausgefiltert wurden.') +
        row('bis 24', 'Begriffe', 'je relevanter Begriff wie Disclosure, Whistleblower, Pentagon, NASA, AARO oder Congress.') +
        row('bis 18', 'Offiziell', 'wenn Behoerden, offizielle Stellen, klassifizierte Dokumente oder Regierungskontext vorkommen.') +
        row('bis 10', 'Titel', 'wenn wichtige UAP-Begriffe direkt im Titel stehen.') +
        row('9/14', 'Quelle', '9 Punkte fuer etablierte Nachrichtenmedien, 14 Punkte fuer offizielle Quellen.') +
        row(13, 'Starker Titel', 'wenn der Titel selbst einen klaren UAP/UFO-Bezug hat.') +
        row(7, 'Kernaussage', 'wenn ein besonders relevantes UAP-Thema wie Disclosure, Hearing, Whistleblower oder Non-human vorkommt.') +
        row(6, 'Behoerde im Titel', 'wenn Pentagon, NASA, AARO, Congress oder Senate direkt im Titel stehen.') +
        row('bis 28', 'Mehrere Quellen', '7 Punkte pro weiterer unabhaengiger Quelle zum gleichen Thema.') +
      '</div>' +
      '<button type="button" class="quality-close">SCHLIESSEN</button>' +
    '</div>';
    overlay.addEventListener('click', function(e){ if (e.target === overlay || e.target.classList.contains('quality-close')) close(); });
    document.body.appendChild(overlay);
  }
  window.addEventListener('click', function(e){
    var target = e.target && e.target.closest && e.target.closest('.quality-top-help');
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    show();
  }, true);
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') close(); }, true);
})();
