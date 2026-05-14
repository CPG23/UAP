(function(){
  'use strict';

  if (window.__uapFeedTitleDedupeFix) return;
  window.__uapFeedTitleDedupeFix = true;

  var nativeFetch = window.fetch;

  function clean(value){ return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function titleKey(title){ return clean(title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function sourceKey(source){ return clean((source && (source.url || source.link || source.title || source.source)) || '').toLowerCase(); }
  function sourceFromArticle(article){
    return {
      title: article.title || '',
      url: article.url || article.link || '',
      link: article.link || article.url || '',
      source: article.source || '',
      publishedAt: article.publishedAt || article.detectedAt || article.date || ''
    };
  }
  function dedupeSources(sources){
    var seen = {};
    return (sources || []).filter(function(source){
      var key = sourceKey(source);
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }
  function mergeArticle(target, incoming){
    var incomingSources = [sourceFromArticle(incoming)].concat(incoming.otherSources || []);
    var sources = dedupeSources((target.otherSources || []).concat(incomingSources));
    target.otherSources = sources.filter(function(source){ return titleKey(source.title) !== titleKey(target.title); });
    target.mentions = Math.max(target.mentions || 1, incoming.mentions || 1, 1 + target.otherSources.length);
    target.clusterTitles = target.otherSources.map(function(source){ return clean(source.title); }).filter(Boolean).slice(0, 10);
    if (clean(incoming.summary).length > clean(target.summary).length) target.summary = incoming.summary;
    if (Number(incoming.quality || 0) > Number(target.quality || 0)) target.quality = incoming.quality;
    if (Number(incoming.sourceQuality || 0) > Number(target.sourceQuality || 0)) target.sourceQuality = incoming.sourceQuality;
    return target;
  }
  function repair(payload){
    if (!payload || !Array.isArray(payload.articles)) return payload;
    var byTitle = {};
    var order = [];
    payload.articles.forEach(function(article){
      var key = titleKey(article && article.title);
      if (!key) return;
      if (!byTitle[key]) {
        byTitle[key] = article;
        order.push(key);
      } else {
        mergeArticle(byTitle[key], article);
      }
    });
    payload = Object.assign({}, payload, { articles: order.map(function(key){ return byTitle[key]; }) });
    payload.scanMeta = Object.assign({}, payload.scanMeta || {}, { appTitleDedupe: 'normalized_title_v1' });
    return payload;
  }

  window.fetch = function(input, init){
    return nativeFetch.apply(this, arguments).then(function(response){
      var url = typeof input === 'string' ? input : input && input.url || '';
      if (url.indexOf('latest-news.json') === -1) return response;
      return response.clone().json().then(function(payload){
        return new Response(JSON.stringify(repair(payload)), {
          status: response.status,
          statusText: response.statusText,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
        });
      }).catch(function(){ return response; });
    });
  };
})();
