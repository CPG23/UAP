(function(){
  'use strict';

  function cleanTranslation(text){
    text = String(text || '').trim();
    if (!text || /^\s*<!doctype|<html/i.test(text)) return '';
    return text.replace(/^\s*"|"\s*$/g, '').trim();
  }

  function fetchWithTimeout(url, timeoutMs){
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller ? setTimeout(function(){ controller.abort(); }, timeoutMs) : null;
    return fetch(url, { cache: 'no-store', signal: controller && controller.signal })
      .finally(function(){ if (timer) clearTimeout(timer); });
  }

  function splitText(text){
    var input = String(text || '').trim();
    if (!input) return [];
    var chunks = [];
    var current = '';
    input.split(/(\n+)/).forEach(function(part){
      if ((current + part).length > 1400 && current.trim()) {
        chunks.push(current);
        current = part;
      } else {
        current += part;
      }
    });
    if (current.trim()) chunks.push(current);
    return chunks;
  }

  function googleTranslate(text){
    var chunks = splitText(text);
    if (!chunks.length) return Promise.resolve('');
    var chain = Promise.resolve([]);
    chunks.forEach(function(chunk){
      chain = chain.then(function(out){
        var url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=de&dt=t&q=' + encodeURIComponent(chunk);
        return fetchWithTimeout(url, 9000)
          .then(function(resp){ if (!resp.ok) throw new Error('Google ' + resp.status); return resp.json(); })
          .then(function(data){
            var translated = data && data[0] ? data[0].map(function(part){ return part && part[0] ? part[0] : ''; }).join('') : '';
            translated = cleanTranslation(translated);
            if (!translated) throw new Error('Keine Übersetzung erhalten');
            out.push(translated);
            return out;
          });
      });
    });
    return chain.then(function(out){ return out.join(''); });
  }

  function summaryElement(card){
    return card.querySelector('.uap-detail-summary') || card.querySelector('.summary');
  }

  function setButton(btn, text, disabled){
    btn.disabled = !!disabled;
    btn.textContent = text;
  }

  function translateCard(card, btn){
    var title = card && card.querySelector('h2');
    var summary = card && summaryElement(card);
    if (!card || !title || !summary) return;

    if (card.dataset.uapTranslated === '1') {
      title.textContent = card.dataset.uapOriginalTitle || title.textContent;
      summary.textContent = card.dataset.uapOriginalSummary || summary.textContent;
      card.dataset.uapTranslated = '0';
      setButton(btn, 'Übersetzen', false);
      return;
    }

    card.dataset.uapOriginalTitle = card.dataset.uapOriginalTitle || title.textContent;
    card.dataset.uapOriginalSummary = card.dataset.uapOriginalSummary || summary.textContent;
    setButton(btn, 'Übersetze...', true);

    googleTranslate(card.dataset.uapOriginalTitle + '\n|||\n' + card.dataset.uapOriginalSummary)
      .then(function(text){
        var parts = String(text || '').split('|||');
        var translatedTitle = cleanTranslation(parts.shift() || '');
        var translatedSummary = cleanTranslation(parts.join('|||') || '');
        if (!translatedTitle && !translatedSummary) throw new Error('Keine Übersetzung erhalten');
        title.textContent = translatedTitle || card.dataset.uapOriginalTitle;
        summary.textContent = translatedSummary || card.dataset.uapOriginalSummary;
        card.dataset.uapTranslated = '1';
        setButton(btn, 'Original anzeigen', false);
      })
      .catch(function(){
        setButton(btn, 'Übersetzung fehlgeschlagen', false);
        setTimeout(function(){
          if (btn.textContent === 'Übersetzung fehlgeschlagen') setButton(btn, 'Übersetzen', false);
        }, 1800);
      });
  }

  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest && e.target.closest('.translate-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    translateCard(btn.closest('.article-card'), btn);
  }, true);
})();
