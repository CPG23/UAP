(function(){
  'use strict';

  var STYLE_ID = 'uap-translation-prepared-style';
  var feedPromise = null;
  var articleMapCache = null;
  var GERMAN_MARKERS = /[äöüß]|\b(der|die|das|den|dem|des|und|oder|nicht|eine|einer|einen|mit|von|für|ueber|über|heute|wird|wurden|nachrichten|quelle|artikel)\b/i;

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

  function compact(text){
    return String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  }

  function sentences(text){
    return compact(text).match(/[^.!?]+[.!?]+(?:\s|$)/g) || [];
  }

  function shortenSummary(text, reference){
    var clean = compact(text);
    if (!clean) return '';

    var referenceText = compact(reference);
    var referenceSentences = sentences(referenceText).length || 3;
    var targetSentences = Math.max(1, Math.min(referenceSentences, 3));
    var maxLen = referenceText ? Math.max(220, Math.min(520, Math.round(referenceText.length * 1.35))) : 420;

    if (clean.length <= maxLen && sentences(clean).length <= targetSentences) return clean;

    var parts = sentences(clean);
    if (parts.length) {
      var candidate = compact(parts.slice(0, targetSentences).join(''));
      while (candidate.length > maxLen && targetSentences > 1) {
        targetSentences -= 1;
        candidate = compact(parts.slice(0, targetSentences).join(''));
      }
      if (candidate && candidate.length <= maxLen) return candidate;
      if (candidate) clean = candidate;
    }

    if (clean.length <= maxLen) return clean;
    return clean.slice(0, maxLen).replace(/\s+\S*$/, '').replace(/[,:;]+$/, '').trim() + '.';
  }

  function escId(text){
    return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function looksGerman(text){
    return GERMAN_MARKERS.test(String(text || ''));
  }

  function cardId(card){
    if (!card) return '';
    if (card.dataset && card.dataset.uapId) return card.dataset.uapId;
    var summary = card.querySelector('.summary[id]');
    if (summary && summary.id) return summary.id.replace(/^summary-/, '');
    var title = card.querySelector('h2');
    return title ? escId(title.textContent) : '';
  }

  function loadFeed(){
    if (!feedPromise) {
      feedPromise = fetch('latest-news.json?translate=' + Date.now(), { cache: 'no-store' })
        .then(function(resp){ if (!resp.ok) throw new Error('feed ' + resp.status); return resp.json(); })
        .then(function(feed){
          articleMapCache = {};
          (feed.articles || []).forEach(function(article){
            var id = article && (article.id || escId(article.title));
            if (id) articleMapCache[id] = article;
          });
          return feed;
        })
        .catch(function(){
          articleMapCache = {};
          return { articles: [], translations: {} };
        });
    }
    return feedPromise;
  }

  function findArticle(feed, card){
    var id = cardId(card);
    var map = articleMapCache || {};
    if (id && map[id]) return { id: id, article: map[id] };

    var title = compact(card && card.querySelector('h2') && card.querySelector('h2').textContent);
    var slug = escId(title);
    if (slug && map[slug]) return { id: slug, article: map[slug] };

    var articles = feed && feed.articles || [];
    for (var i = 0; i < articles.length; i++) {
      if (compact(articles[i].title) === title || escId(articles[i].title) === slug) {
        return { id: articles[i].id || slug, article: articles[i] };
      }
    }
    return { id: id || slug, article: null };
  }

  function translationBag(feed, id, article){
    if (article && article.translation) return article.translation;
    if (article && article.translations) return article.translations;
    if (feed && feed.translations && id && feed.translations[id]) return feed.translations[id];
    return null;
  }

  function isPreparedTarget(entry){
    return entry && compact(entry.title) && compact(entry.summary) && entry.provider !== 'original';
  }

  function choosePreparedTranslation(feed, id, article, originalTitle, originalSummary){
    var bag = translationBag(feed, id, article);
    if (!bag) return null;

    var sourceIsGerman = looksGerman(originalTitle + ' ' + originalSummary);
    if (sourceIsGerman && isPreparedTarget(bag.en)) return bag.en;
    if (!sourceIsGerman && isPreparedTarget(bag.de)) return bag.de;
    if (isPreparedTarget(bag.en)) return bag.en;
    if (isPreparedTarget(bag.de)) return bag.de;
    return null;
  }

  function findExistingDetailSummary(card){
    return card && card.querySelector('.details .uap-detail-summary');
  }

  function findSourceSummary(card){
    return card && (findExistingDetailSummary(card) || card.querySelector('.summary:not(.uap-detail-summary)') || card.querySelector('.summary'));
  }

  function ensureDetailSummary(card){
    var detail = findExistingDetailSummary(card);
    if (detail) return detail;
    var details = card && card.querySelector('.details');
    if (!details) return null;
    detail = document.createElement('div');
    detail.className = 'uap-detail-summary';
    detail.dataset.uapCreatedByTranslation = '1';
    var actions = details.querySelector('.actions');
    if (actions) details.insertBefore(detail, actions);
    else details.insertBefore(detail, details.firstChild);
    return detail;
  }

  function summaryTargets(card){
    var list = Array.prototype.slice.call(card.querySelectorAll('.details .uap-detail-summary, .summary'));
    if (!list.some(function(el){ return el.classList.contains('uap-detail-summary'); })) {
      var detail = ensureDetailSummary(card);
      if (detail) list.unshift(detail);
    }
    return list;
  }

  function setSummaries(card, text){
    summaryTargets(card).forEach(function(el){ el.textContent = text; });
  }

  function setButton(btn, text, disabled){
    if (!btn) return;
    btn.disabled = !!disabled;
    btn.textContent = text;
  }

  function markButton(btn, state){
    if (!btn) return;
    btn.classList.toggle('uap-translating', state === 'loading');
    btn.classList.toggle('uap-translated', state === 'done');
  }

  function restoreOriginal(card, btn, titleEl, summaryEl){
    titleEl.textContent = card.dataset.uapOriginalTitle || titleEl.textContent;
    setSummaries(card, card.dataset.uapOriginalSummary || (summaryEl && summaryEl.textContent) || '');
    card.dataset.uapTranslated = '0';
    card.classList.remove('uap-translation-active');
    markButton(btn, 'idle');
    setButton(btn, 'Übersetzen', false);
  }

  function applyPreparedTranslation(card, btn, titleEl, result){
    var originalSummary = card.dataset.uapOriginalSummary || '';
    titleEl.textContent = compact(result.title) || titleEl.textContent;
    setSummaries(card, shortenSummary(result.summary, originalSummary) || originalSummary);
    card.dataset.uapTranslated = '1';
    card.classList.add('uap-translation-active');
    markButton(btn, 'done');
    setButton(btn, 'Original anzeigen', false);
  }

  function failFast(card, btn, message){
    card.classList.remove('uap-translation-active');
    markButton(btn, 'idle');
    setButton(btn, message || 'Übersetzung wird vorbereitet', false);
    setTimeout(function(){
      if (btn && btn.textContent === (message || 'Übersetzung wird vorbereitet')) setButton(btn, 'Übersetzen', false);
    }, 2200);
  }

  function translateCard(card, btn){
    injectStyle();
    var titleEl = card && card.querySelector('h2');
    var summaryEl = card && findSourceSummary(card);
    if (!card || !titleEl || card.dataset.uapTranslationBusy === '1') return;

    if (card.dataset.uapTranslated === '1') {
      restoreOriginal(card, btn, titleEl, summaryEl);
      return;
    }

    var originalTitle = compact(card.dataset.uapOriginalTitle || titleEl.textContent);
    var originalSummary = compact(card.dataset.uapOriginalSummary || (summaryEl && summaryEl.textContent));
    card.dataset.uapOriginalTitle = originalTitle;
    card.dataset.uapOriginalSummary = originalSummary;
    card.dataset.uapTranslationBusy = '1';
    card.classList.remove('uap-translation-active');
    setButton(btn, 'Übersetze...', true);
    markButton(btn, 'loading');

    loadFeed().then(function(feed){
      var found = findArticle(feed, card);
      var article = found.article;
      if (!article) throw new Error('Artikel nicht gefunden');

      if (!card.dataset.uapOriginalSummary) card.dataset.uapOriginalSummary = compact(article.summary || originalSummary);
      var prepared = choosePreparedTranslation(feed, found.id, article, originalTitle || article.title, card.dataset.uapOriginalSummary || article.summary);
      if (!prepared) throw new Error('Vorbereitete Übersetzung fehlt');
      applyPreparedTranslation(card, btn, titleEl, prepared);
    }).catch(function(){
      failFast(card, btn, 'Übersetzung wird vorbereitet');
    }).finally(function(){
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

  function start(){
    injectStyle();
    setTimeout(loadFeed, 0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
