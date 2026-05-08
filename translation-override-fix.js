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

  function splitForGoogle(text){
    var input = String(text || '').trim();
    if (!input) return [];
    var chunks = [];
    var current = '';
    input.split(/(\s+)/).forEach(function(part){
      if ((current + part).length > 1600 && current.trim()) {
        chunks.push(current.trim());
        current = part;
      } else {
        current += part;
      }
    });
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }

  function googleOne(text){
    var chunks = splitForGoogle(text);
    if (!chunks.length) return Promise.resolve('');
    var work = Promise.resolve([]);
    chunks.forEach(function(chunk){
      work = work.then(function(out){
        var url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=de&dt=t&q=' + encodeURIComponent(chunk);
        return fetchWithTimeout(url, 7000)
          .then(function(resp){ if (!resp.ok) throw new Error('Google ' + resp.status); return resp.json(); })
          .then(function(data){
            var translated = data && data[0]
              ? data[0].map(function(part){ return part && part[0] ? part[0] : ''; }).join('')
              : '';
            translated = cleanTranslation(translated);
            if (!translated) throw new Error('Keine Uebersetzung erhalten');
            out.push(translated);
            return out;
          });
      });
    });
    return work.then(function(out){ return out.join(' '); });
  }

  function pollinationsOne(text){
    var source = String(text || '').trim();
    if (!source) return Promise.resolve('');
    var prompt = 'Translate the following article text to German. Keep names, dates and facts unchanged. Return only the translation:\n\n' + source;
    var url = 'https://text.pollinations.ai/' + encodeURIComponent(prompt) + '?model=openai&json=false';
    return fetchWithTimeout(url, 9000)
      .then(function(resp){ if (!resp.ok) throw new Error('Fallback ' + resp.status); return resp.text(); })
      .then(function(text){
        var cleaned = cleanTranslation(text);
        if (!cleaned) throw new Error('Fallback leer');
        return cleaned;
      });
  }

  function translateParts(title, summary){
    return Promise.all([
      googleOne(title).catch(function(){ return pollinationsOne(title); }),
      googleOne(summary).catch(function(){ return pollinationsOne(summary); })
    ]).then(function(parts){
      return {
        title: cleanTranslation(parts[0]) || title,
        summary: cleanTranslation(parts[1]) || summary
      };
    });
  }

  function summaryElements(card){
    return Array.prototype.slice.call(card.querySelectorAll('.uap-detail-summary, .summary'));
  }

  function primarySummary(card){
    var list = summaryElements(card);
    return list.find(function(el){ return el.offsetParent !== null && String(el.textContent || '').trim(); })
      || list.find(function(el){ return String(el.textContent || '').trim(); })
      || null;
  }

  function setSummaries(card, text){
    summaryElements(card).forEach(function(el){ el.textContent = text; });
  }

  function setButton(btn, text, disabled){
    if (!btn) return;
    btn.disabled = !!disabled;
    btn.textContent = text;
  }

  function translateCard(card, btn){
    var title = card && card.querySelector('h2');
    var summary = card && primarySummary(card);
    if (!card || !title || !summary || card.dataset.uapTranslationBusy === '1') return;

    if (card.dataset.uapTranslated === '1') {
      title.textContent = card.dataset.uapOriginalTitle || title.textContent;
      setSummaries(card, card.dataset.uapOriginalSummary || summary.textContent);
      card.dataset.uapTranslated = '0';
      setButton(btn, 'Uebersetzen', false);
      return;
    }

    var originalTitle = card.dataset.uapOriginalTitle || title.textContent;
    var originalSummary = card.dataset.uapOriginalSummary || summary.textContent;
    card.dataset.uapOriginalTitle = originalTitle;
    card.dataset.uapOriginalSummary = originalSummary;
    card.dataset.uapTranslationBusy = '1';
    setButton(btn, 'Uebersetze...', true);

    translateParts(originalTitle, originalSummary)
      .then(function(result){
        title.textContent = result.title || originalTitle;
        setSummaries(card, result.summary || originalSummary);
        card.dataset.uapTranslated = '1';
        setButton(btn, 'Original anzeigen', false);
      })
      .catch(function(){
        setButton(btn, 'Uebersetzung fehlgeschlagen', false);
        setTimeout(function(){
          if (btn.textContent === 'Uebersetzung fehlgeschlagen') setButton(btn, 'Uebersetzen', false);
        }, 1800);
      })
      .finally(function(){
        card.dataset.uapTranslationBusy = '0';
      });
  }

  window.addEventListener('click', function(e){
    var btn = e.target && e.target.closest && e.target.closest('.translate-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    translateCard(btn.closest('.article-card'), btn);
  }, true);
})();
