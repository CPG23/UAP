(function(){
  'use strict';

  var STYLE_ID = 'uap-translation-authoritative-style';

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.translate-btn.uap-translating,.translate-btn.uap-translated{border-color:rgba(0,255,157,.72)!important;color:#b8ffd7!important;background:rgba(0,255,157,.12)!important;box-shadow:0 0 16px rgba(0,255,157,.18)!important}',
      '.article-card.uap-translation-active h2,.article-card.uap-translation-active .summary,.article-card.uap-translation-active .uap-detail-summary{color:#b8ffd7!important}',
      '.article-card.uap-translation-active .summary,.article-card.uap-translation-active .uap-detail-summary{text-shadow:0 0 10px rgba(0,255,157,.12)!important}',
      '.article-card .details .uap-detail-summary{display:block!important;margin:0 0 12px!important;color:#9db6c2;font-size:13px;line-height:1.55}'
    ].join('\n');
    document.head.appendChild(style);
  }

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
      if ((current + part).length > 1500 && current.trim()) {
        chunks.push(current.trim());
        current = part;
      } else {
        current += part;
      }
    });
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }

  function parseGoogle(data){
    var translated = data && data[0]
      ? data[0].map(function(part){ return part && part[0] ? part[0] : ''; }).join('')
      : '';
    translated = cleanTranslation(translated);
    if (!translated) throw new Error('Keine Übersetzung erhalten');
    return translated;
  }

  function googleChunk(chunk){
    var query = '&ie=UTF-8&oe=UTF-8&q=' + encodeURIComponent(chunk);
    var urls = [
      'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=de&dt=t' + query,
      'https://translate.google.com/translate_a/single?client=gtx&sl=auto&tl=de&dt=t' + query
    ];
    return fetchWithTimeout(urls[0], 5500)
      .then(function(resp){ if (!resp.ok) throw new Error('Google ' + resp.status); return resp.json(); })
      .then(parseGoogle)
      .catch(function(){
        return fetchWithTimeout(urls[1], 5500)
          .then(function(resp){ if (!resp.ok) throw new Error('Google fallback ' + resp.status); return resp.json(); })
          .then(parseGoogle);
      });
  }

  function googleOne(text){
    var chunks = splitForGoogle(text);
    if (!chunks.length) return Promise.resolve('');
    return Promise.all(chunks.map(googleChunk)).then(function(out){ return out.join(' '); });
  }

  function translateParts(title, summary){
    return Promise.all([googleOne(title), googleOne(summary)]).then(function(parts){
      return {
        title: cleanTranslation(parts[0]) || title,
        summary: cleanTranslation(parts[1]) || summary
      };
    });
  }

  function ensureDetailSummary(card){
    var details = card && card.querySelector('.details');
    if (!details) return null;
    var detail = details.querySelector('.uap-detail-summary');
    if (!detail) {
      detail = document.createElement('div');
      detail.className = 'uap-detail-summary';
      var actions = details.querySelector('.actions');
      if (actions) details.insertBefore(detail, actions);
      else details.insertBefore(detail, details.firstChild);
    }
    var source = card.querySelector('.summary:not(.uap-detail-summary)');
    if (!detail.textContent.trim() && source) detail.textContent = source.textContent;
    return detail;
  }

  function summaryElements(card){
    ensureDetailSummary(card);
    return Array.prototype.slice.call(card.querySelectorAll('.details .uap-detail-summary, .summary'));
  }

  function primarySummary(card){
    var detail = ensureDetailSummary(card);
    if (detail && String(detail.textContent || '').trim()) return detail;
    var list = summaryElements(card);
    return list.find(function(el){ return String(el.textContent || '').trim(); }) || null;
  }

  function setSummaries(card, text){
    summaryElements(card).forEach(function(el){ el.textContent = text; });
  }

  function setButton(btn, text, disabled){
    if (!btn) return;
    btn.disabled = !!disabled;
    btn.textContent = text;
  }

  function markActive(card, btn, active){
    if (card) card.classList.toggle('uap-translation-active', !!active);
    if (btn) {
      btn.classList.toggle('uap-translating', !!active && btn.textContent !== 'Original anzeigen');
      btn.classList.toggle('uap-translated', !!active && btn.textContent === 'Original anzeigen');
    }
  }

  function translateCard(card, btn){
    injectStyle();
    var title = card && card.querySelector('h2');
    var summary = card && primarySummary(card);
    if (!card || !title || !summary || card.dataset.uapTranslationBusy === '1') return;

    if (card.dataset.uapTranslated === '1') {
      title.textContent = card.dataset.uapOriginalTitle || title.textContent;
      setSummaries(card, card.dataset.uapOriginalSummary || summary.textContent);
      card.dataset.uapTranslated = '0';
      card.classList.remove('uap-translation-active');
      if (btn) btn.classList.remove('uap-translating', 'uap-translated');
      setButton(btn, 'Übersetzen', false);
      return;
    }

    var originalTitle = card.dataset.uapOriginalTitle || title.textContent;
    var originalSummary = card.dataset.uapOriginalSummary || summary.textContent;
    card.dataset.uapOriginalTitle = originalTitle;
    card.dataset.uapOriginalSummary = originalSummary;
    card.dataset.uapTranslationBusy = '1';
    setButton(btn, 'Übersetze...', true);
    markActive(card, btn, true);

    translateParts(originalTitle, originalSummary)
      .then(function(result){
        title.textContent = result.title || originalTitle;
        setSummaries(card, result.summary || originalSummary);
        card.dataset.uapTranslated = '1';
        setButton(btn, 'Original anzeigen', false);
        if (btn) btn.classList.remove('uap-translating');
        markActive(card, btn, true);
      })
      .catch(function(){
        card.classList.remove('uap-translation-active');
        if (btn) btn.classList.remove('uap-translating', 'uap-translated');
        setButton(btn, 'Übersetzung fehlgeschlagen', false);
        setTimeout(function(){
          if (btn.textContent === 'Übersetzung fehlgeschlagen') setButton(btn, 'Übersetzen', false);
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectStyle, { once: true });
  else injectStyle();
})();
