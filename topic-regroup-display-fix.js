(function(){
  'use strict';

  var STYLE_ID = 'uap-topic-regroup-display-style';
  var feedPromise = null;
  var applying = false;
  var queued = false;

  var UAP_RE = /\b(uap|ufo|ufos|ovni|unidentified\s+(?:aerial|anomalous|flying)|alien)\b/i;
  var FILE_RE = /\b(file|files|record|records|archive|document|documents|photo|photos|image|images|video|videos|footage|akten|fotos)\b/i;
  var RELEASE_RE = /\b(release|released|releases|declassif|publish|published|publishes|unseal|disclos|drops?|freig|veroffentlicht|veroeffentlicht)\b/i;
  var OFFICIAL_RE = /\b(pentagon|dod|defense|defence|government|congress|aoc|aaro|foia|trump|white\s+house|national\s+archives|us|u\.s\.|official|federal)\b/i;

  function clean(value){ return String(value || '').replace(/\s+/g, ' ').trim(); }
  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"]/g, function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch];
    });
  }
  function slug(title){ return String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function topicText(article){
    return clean([article && article.title, article && article.description, article && article.summary, article && article.source].join(' '));
  }
  function sourceText(source){ return clean([source && source.title, source && source.source].join(' ')); }
  function isFileReleaseText(text){
    return UAP_RE.test(text) && FILE_RE.test(text) && RELEASE_RE.test(text) && OFFICIAL_RE.test(text);
  }
  function isFileReleaseArticle(article){ return isFileReleaseText(topicText(article)); }
  function isFileReleaseSource(source){ return isFileReleaseText(sourceText(source)); }
  function sameTopic(a, b){ return isFileReleaseArticle(a) && isFileReleaseArticle(b); }
  function sourceFromArticle(article){
    return {
      source: article && article.source || 'Quelle',
      link: article && (article.link || article.url) || '',
      url: article && (article.url || article.link) || '',
      title: article && article.title || ''
    };
  }
  function allSources(article){
    var list = [sourceFromArticle(article)];
    (article && (article.otherSources || article._otherSources) || []).forEach(function(s){
      if (!s) return;
      list.push({ source: s.source || 'Quelle', link: s.link || s.url || '', url: s.url || s.link || '', title: s.title || '' });
    });
    return dedupeSources(list);
  }
  function sourceKey(source){ return clean(source.link || source.url || source.title || source.source).toLowerCase(); }
  function dedupeSources(list){
    var seen = {};
    return list.filter(function(source){
      var key = sourceKey(source);
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }
  function pruneSources(article, sources){
    if (!isFileReleaseArticle(article)) return dedupeSources(sources);
    var primary = sources[0] || sourceFromArticle(article);
    var rest = sources.slice(1).filter(isFileReleaseSource);
    return dedupeSources([primary].concat(rest));
  }
  function groupFeedArticles(articles){
    var used = {};
    var primaryById = {};
    var duplicateIds = {};
    var groups = [];

    articles.forEach(function(article, index){
      if (used[index]) return;
      var group = [article];
      used[index] = true;
      for (var j = index + 1; j < articles.length; j++) {
        if (used[j]) continue;
        if (sameTopic(article, articles[j])) {
          group.push(articles[j]);
          used[j] = true;
        }
      }
      groups.push(group);
    });

    groups.forEach(function(group){
      var primary = group[0];
      if (!primary) return;
      var id = primary.id || slug(primary.title);
      var sources = [];
      group.forEach(function(article){ sources = sources.concat(allSources(article)); });
      sources = pruneSources(primary, sources);
      primaryById[id] = { article: primary, sources: sources, ids: group.map(function(a){ return a.id || slug(a.title); }) };
      group.slice(1).forEach(function(article){ duplicateIds[article.id || slug(article.title)] = id; });
    });

    return { primaryById: primaryById, duplicateIds: duplicateIds };
  }
  function loadFeed(){
    if (!feedPromise) {
      feedPromise = fetch('latest-news.json?topicRegroupDisplay=' + Date.now(), { cache: 'no-store' })
        .then(function(r){ return r.json(); })
        .catch(function(){ return { articles: [] }; });
    }
    return feedPromise;
  }
  function injectStyle(){
    var style = document.getElementById(STYLE_ID);
    var css = '.article-card.uap-topic-duplicate{display:none!important}';
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
  function sourceHtml(article, sources){
    return sources.map(function(source){
      var link = source.link || source.url || '';
      var title = source.title && source.title !== article.title ? '<div class="source-headline">' + esc(source.title) + '</div>' : '';
      var inner = '<div class="source-name">' + esc(source.source || 'Quelle') + '</div>' + title;
      return link ? '<a class="source-link" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>' : '<div class="source-link">' + inner + '</div>';
    }).join('');
  }
  function applyToDom(grouped){
    document.querySelectorAll('.article-card').forEach(function(card){
      var id = cardId(card);
      var replacementPrimary = grouped.duplicateIds[id];
      card.classList.toggle('uap-topic-duplicate', !!replacementPrimary);
      if (replacementPrimary) return;

      var group = grouped.primaryById[id];
      if (!group) return;
      var sources = group.sources || [];
      var badge = card.querySelector('.badge.sources');
      if (badge) badge.textContent = sources.length + ' Quelle' + (sources.length === 1 ? '' : 'n');
      var list = card.querySelector('.source-list');
      var signature = sources.map(sourceKey).join('|');
      if (list && card.dataset.topicRegroupSignature !== signature) {
        list.innerHTML = sourceHtml(group.article, sources);
        card.dataset.topicRegroupSignature = signature;
      }
    });
  }
  function apply(){
    queued = false;
    if (applying) return;
    applying = true;
    injectStyle();
    loadFeed().then(function(feed){
      var articles = feed && feed.articles || [];
      applyToDom(groupFeedArticles(articles));
    }).finally(function(){ applying = false; });
  }
  function queueApply(){
    if (queued || applying) return;
    queued = true;
    setTimeout(apply, 80);
  }
  function start(){
    apply();
    [250, 800, 1600, 3000].forEach(function(delay){ setTimeout(queueApply, delay); });
    new MutationObserver(queueApply).observe(document.getElementById('feed') || document.body, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
