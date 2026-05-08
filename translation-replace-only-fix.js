(function(){
  'use strict';

  var STYLE_ID = 'uap-translation-replace-only-style';
  var feedPromise = null;
  var articleMap = null;
  var GERMAN_MARKERS = /[äöüß]|\b(der|die|das|den|dem|des|und|oder|nicht|eine|einer|einen|mit|von|für|ueber|über|heute|wird|wurden|nachrichten|quelle|artikel)\b/i;

  function compact(value){ return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function slug(title){ return String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function looksGerman(text){ return GERMAN_MARKERS.test(String(text || '')); }
  function sentences(text){ return compact(text).match(/[^.!?]+[.!?]+(?:\s|$)/g) || []; }
  function shortSummary(text, reference){
    var clean = compact(text);
    if (!clean) return '';
    var ref = compact(reference);
    var targetSentences = Math.max(1, Math.min(sentences(ref).length || 2, 3));
    var maxLen = ref ? Math.max(180, Math.min(420, Math.round(ref.length * 1.25))) : 360;
    var parts = sentences(clean);
    if (parts.length) clean = compact(parts.slice(0, targetSentences).join('')) || clean;
    if (clean.length <= maxLen) return clean;
    return clean.slice(0, maxLen).replace(/\s+\S*$/, '').replace(/[,:;]+$/, '').trim() + '.';
  }

  function injectStyle(){
    var style = document.getElementById(STYLE_ID);
    var css = [
      '.article-card.uap-translation-active h2,.article-card.uap-translation-active .summary{color:#b8ffd7!important}',
      '.translate-btn.uap-translating,.translate-btn.uap-translated{border-color:rgba(0,255,157,.72)!important;color:#b8ffd7!important;background:rgba(0,255,157,.12)!important;box-shadow:0 0 16px rgba(0,255,157,.18)!important}',
      '.article-card .translation{display:none!important}'
    ].join('\n');
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
  }

  function cardId(card){
    if (!card) return '';
    if (card.dataset && card.dataset.uapId) return card.dataset.uapId;
    var summary = card.querySelector('.summary[id]');
    if (summary && summary.id) return summary.id.replace(/^summary-/, '');
    var title = card.querySelector('h2');
    return title ? slug(title.textContent) : '';
  }

  function loadFeed(){
    if (!feedPromise) {
      feedPromise = fetch('latest-news.json?replaceTranslate=' + Date.now(), { cache: 'no-store' })
        .then(function(resp){ return resp.ok ? resp.json() : { articles: [] }; })
        .then(function(feed){
          articleMap = {};
          (feed.articles || []).forEach(function(article){
            var id = article && (article.id || slug(article.title));
            if (id) articleMap[id] = article;
          });
          return feed;
        })
        .catch(function(){ articleMap = {}; return { articles: [] }; });
    }
    return feedPromise;
  }

  function findArticle(feed, card){
    var id = cardId(card);
    var map = articleMap || {};
    if (id && map[id]) return { id: id, article: map[id] };
    var title = compact(card.querySelector('h2') && card.querySelector('h2').textContent);
    var titleSlug = slug(title);
    if (titleSlug && map[titleSlug]) return { id: titleSlug, article: map[titleSlug] };
    var articles = feed && feed.articles || [];
    for (var i = 0; i < articles.length; i++) {
      if (compact(articles[i].title) === title || slug(articles[i].title) === titleSlug) {
        return { id: articles[i].id || titleSlug, article: articles[i] };
      }
    }
    return { id: id || titleSlug, article: null };
  }

  function preparedTranslation(feed, found, originalTitle, originalSummary){
    var article = found.article || {};
    var bag = article.translations || article.translation || (feed.translations && feed.translations[found.id]) || null;
    if (!bag) return null;
    var sourceIsGerman = looksGerman(originalTitle + ' ' + originalSummary);
    var target = sourceIsGerman ? bag.en : bag.de;
    if (target && target.provider !== 'original' && (target.title || target.summary)) return target;
    target = bag.de && bag.de.provider !== 'original' ? bag.de : (bag.en && bag.en.provider !== 'original' ? bag.en : null);
    return target;
  }

  function googleTranslate(text, target){
    var url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + encodeURIComponent(target || 'de') + '&dt=t&q=' + encodeURIComponent(text || '');
    return fetch(url).then(function(r){ return r.json(); }).then(function(data){
      return data && data[0] ? data[0].map(function(part){ return part[0]; }).join('').trim() : '';
    });
  }

  function summaryNodes(card){
    return Array.prototype.slice.call(card.querySelectorAll('.summary')).filter(function(el){
      return !el.classList.contains('translation');
    });
  }
  function removeExtraTranslationBoxes(card){
    card.querySelectorAll('.translation').forEach(function(el){ el.textContent = ''; el.style.display = 'none'; });
    card.querySelectorAll('.uap-detail-summary[data-uap-created-by-translation="1"]').forEach(function(el){ el.remove(); });
  }
  function setSummaries(card, text){
    var nodes = summaryNodes(card);
    nodes.forEach(function(el){ el.textContent = text; });
  }
  function setButton(btn, state, text){
    btn.disabled = state === 'loading';
    btn.classList.toggle('uap-translating', state === 'loading');
    btn.classList.toggle('uap-translated', state === 'done');
    btn.textContent = text;
  }

  function restore(card, btn){
    var title = card.querySelector('h2');
    if (title) title.textContent = card.dataset.replaceOriginalTitle || title.textContent;
    setSummaries(card, card.dataset.replaceOriginalSummary || '');
    removeExtraTranslationBoxes(card);
    card.dataset.replaceTranslated = '0';
    card.classList.remove('uap-translation-active');
    setButton(btn, 'idle', 'Übersetzen');
  }

  function applyTranslation(card, btn, result){
    var title = card.querySelector('h2');
    var translatedTitle = compact(result.title);
    var translatedSummary = shortSummary(result.summary, card.dataset.replaceOriginalSummary);
    if (title && translatedTitle) title.textContent = translatedTitle;
    if (translatedSummary) setSummaries(card, translatedSummary);
    removeExtraTranslationBoxes(card);
    card.dataset.replaceTranslated = '1';
    card.classList.add('uap-translation-active');
    setButton(btn, 'done', 'Original anzeigen');
  }

  function handleClick(e){
    var btn = e.target && e.target.closest && e.target.closest('.translate-btn');
    if (!btn) return;
    var card = btn.closest('.article-card');
    if (!card) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    injectStyle();
    removeExtraTranslationBoxes(card);

    if (card.dataset.replaceTranslated === '1') {
      restore(card, btn);
      return;
    }

    var title = card.querySelector('h2');
    var summary = summaryNodes(card)[0];
    card.dataset.replaceOriginalTitle = card.dataset.replaceOriginalTitle || compact(title && title.textContent);
    card.dataset.replaceOriginalSummary = card.dataset.replaceOriginalSummary || compact(summary && summary.textContent);
    setButton(btn, 'loading', 'Übersetze...');

    loadFeed().then(function(feed){
      var found = findArticle(feed, card);
      var originalTitle = card.dataset.replaceOriginalTitle || (found.article && found.article.title) || '';
      var originalSummary = card.dataset.replaceOriginalSummary || (found.article && found.article.summary) || '';
      var prepared = preparedTranslation(feed, found, originalTitle, originalSummary);
      if (prepared) {
        applyTranslation(card, btn, {
          title: prepared.title || originalTitle,
          summary: prepared.summary || originalSummary
        });
        return;
      }
      var target = looksGerman(originalTitle + ' ' + originalSummary) ? 'en' : 'de';
      return googleTranslate(originalTitle + '\n|||\n' + originalSummary, target).then(function(text){
        var parts = String(text || '').split('|||');
        applyTranslation(card, btn, {
          title: parts[0] || originalTitle,
          summary: parts[1] || originalSummary
        });
      });
    }).catch(function(){
      setButton(btn, 'idle', 'Übersetzung fehlgeschlagen');
      setTimeout(function(){ if (btn.textContent === 'Übersetzung fehlgeschlagen') setButton(btn, 'idle', 'Übersetzen'); }, 2200);
    });
  }

  window.addEventListener('click', handleClick, true);

  function start(){
    injectStyle();
    setTimeout(loadFeed, 0);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
