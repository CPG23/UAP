(function(){
  'use strict';

  if (window.__uapFeedClusterSafetyFix) return;
  window.__uapFeedClusterSafetyFix = true;

  var nativeFetch = window.fetch;
  var SPACE_RE = /\s+/g;
  var WORD_RE = /[a-z0-9]+/g;
  var STOP = ('a an the to of for in on at by with from and or is are was were be been has have had will would could should may might new latest update report reports news says said about into after before over under this that these those watch video live first amid via than uap uaps ufo ufos unidentified anomalous aerial flying phenomena article source sources public').split(' ');
  var STOP_SET = STOP.reduce(function(acc, word){ acc[word] = true; return acc; }, {});

  function clean(value){ return String(value == null ? '' : value).replace(SPACE_RE, ' ').trim(); }
  function slug(value){ return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'article'; }
  function words(text){
    return (clean(text).toLowerCase().match(WORD_RE) || []).filter(function(word){ return word.length > 2 && !STOP_SET[word]; });
  }
  function wordSet(text){
    return words(text).reduce(function(acc, word){ acc[word] = true; return acc; }, {});
  }
  function overlap(a, b){
    var total = 0;
    var sizeA = Object.keys(a).length;
    var sizeB = Object.keys(b).length;
    if (!sizeA || !sizeB) return 0;
    Object.keys(a).forEach(function(word){ if (b[word]) total++; });
    return total / Math.min(sizeA, sizeB);
  }
  function storyKey(text){
    var raw = clean(text).toLowerCase();
    var hasUap = /\b(uap|uaps|ufo|ufos|unidentified anomalous|unidentified aerial|unidentified flying|alien)\b/.test(raw);
    var hasFiles = /\b(file|files|record|records|archive|archives|document|documents|video|videos|photo|photos|material|materials)\b/.test(raw);
    var hasRelease = /\b(release|released|releases|releasing|declassif|unseal|unsealed|publish|published|posting|posted|opens?)\b/.test(raw);
    var hasGov = /\b(pentagon|department of war|defense department|defence department|dod|war\.gov|pursue|trump|united states|u\.s\.|us government|federal|state department|fbi|nasa)\b/.test(raw);

    if (raw.indexOf('sleeping dog') !== -1 && /\b(corbell|lazar|whistleblower|cia|ufo|uap)\b/.test(raw)) return 'sleeping-dog-corbell';
    if (/\b(ukraine|ukrainian)\b/.test(raw) && /\b(advisor|minister|ministry|armed forces|military|russia|russian|defence|defense)\b/.test(raw)) return 'ukraine-uap-program';
    if (/\bjapan\b/.test(raw) && hasUap && (hasFiles || hasRelease || /\bdisclosure\b/.test(raw))) return 'japan-uap-files';
    if (hasUap && hasFiles && hasRelease && hasGov) return 'us-uap-file-release';
    if (hasUap && hasGov && /\b(website|site|portal|war\.gov|launch|launched|public view)\b/.test(raw) && (hasFiles || hasRelease)) return 'us-uap-file-release';
    if (raw.indexOf('pursue') !== -1 && hasUap && (hasFiles || hasRelease || /\b(site|portal|website)\b/.test(raw))) return 'us-uap-file-release';
    return '';
  }
  function sourceText(source){ return clean([source && source.title, source && source.source].join(' ')); }
  function articleText(article){ return clean([article && article.title, article && article.description, article && article.summary].join(' ')); }
  function sameStory(article, source){
    var aText = articleText(article);
    var sText = sourceText(source);
    var aKey = storyKey(aText);
    var sKey = storyKey(sText);
    if (aKey || sKey) return aKey === sKey;
    var aWords = wordSet(aText);
    var sWords = wordSet(sText);
    return overlap(aWords, sWords) >= 0.46;
  }
  function sourceKey(source){ return clean((source && (source.url || source.link || source.title || source.source)) || '').toLowerCase(); }
  function dedupe(sources){
    var seen = {};
    return sources.filter(function(source){
      var key = sourceKey(source);
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }
  function sourceFromArticle(article){
    return {
      title: article.title || '',
      url: article.url || article.link || '',
      link: article.link || article.url || '',
      source: article.source || '',
      publishedAt: article.publishedAt || article.detectedAt || article.date || ''
    };
  }
  function summaryFor(key, title){
    if (key === 'us-uap-file-release') return 'The U.S. Department of War/Pentagon has begun releasing UFO/UAP records through a public archive, with officials saying readers can review the material and draw their own conclusions.';
    if (key === 'ukraine-uap-program') return 'A Ukrainian defense adviser said Ukraine tracks unidentified aerial activity as part of wartime security monitoring, because unusual objects could indicate new Russian technology or other threats.';
    if (key === 'japan-uap-files') return 'The article reports that Japan may release or examine UAP-related files after renewed public attention on U.S. and Ukrainian UFO disclosures.';
    if (key === 'sleeping-dog-corbell') return 'The article concerns Jeremy Corbell, Bob Lazar or related claims around the film Sleeping Dog and alleged UFO or intelligence-community material.';
    return '';
  }
  function rank(source){
    var src = clean(source.source).toLowerCase();
    var title = clean(source.title).length;
    var trusted = /\b(\.gov|department|pbs|ap news|bbc|abc|sky|cbc|al jazeera|axios)\b/.test(src) ? 1000 : 0;
    return trusted + title;
  }
  function makeArticleFromGroup(key, sources, template){
    sources = dedupe(sources).sort(function(a,b){ return rank(b) - rank(a); });
    var primary = sources[0] || {};
    var other = sources.slice(1);
    var title = clean(primary.title) || 'UAP News';
    var quality = Math.max(45, Math.min(100, Number(template.quality || template.sourceQuality || 50) - 3 + Math.min(18, other.length * 3)));
    return {
      id: slug(key || title),
      title: title,
      source: clean(primary.source) || 'UAP News',
      link: clean(primary.link || primary.url),
      date: template.date,
      publishedAt: primary.publishedAt || template.publishedAt || template.date,
      summary: summaryFor(key, title),
      mentions: Math.max(1, 1 + other.length),
      otherSources: other,
      clusterTitles: other.map(function(source){ return clean(source.title); }).filter(Boolean).slice(0, 10),
      quality: quality,
      sourceQuality: quality,
      qualityExplanation: template.qualityExplanation || '',
      qualityBreakdown: template.qualityBreakdown || [],
      matchedTerms: template.matchedTerms || []
    };
  }
  function splitArticle(article, buckets){
    var otherSources = Array.isArray(article.otherSources) ? article.otherSources : [];
    if (!otherSources.length) return article;
    var kept = [];
    otherSources.forEach(function(source){
      if (sameStory(article, source)) {
        kept.push(source);
        return;
      }
      var key = storyKey(sourceText(source)) || ('single-' + slug(source.title || source.source || sourceKey(source)));
      if (!buckets[key]) buckets[key] = { key: key.indexOf('single-') === 0 ? '' : key, sources: [], template: article };
      buckets[key].sources.push(source);
    });
    article = Object.assign({}, article);
    article.otherSources = dedupe(kept);
    article.mentions = Math.max(1, 1 + article.otherSources.length);
    article.clusterTitles = article.otherSources.map(function(source){ return clean(source.title); }).filter(Boolean).slice(0, 10);
    return article;
  }
  function mergeByStory(articles){
    var out = [];
    var keyed = {};
    articles.forEach(function(article){
      var key = storyKey(articleText(article));
      if (!key) { out.push(article); return; }
      if (!keyed[key]) { keyed[key] = article; out.push(article); return; }
      var target = keyed[key];
      var sources = dedupe((target.otherSources || []).concat([sourceFromArticle(article)]).concat(article.otherSources || []));
      target.otherSources = sources;
      target.mentions = Math.max(1, 1 + sources.length);
      target.clusterTitles = sources.map(function(source){ return clean(source.title); }).filter(Boolean).slice(0, 10);
      target.quality = Math.max(Number(target.quality || 0), Number(article.quality || 0), Math.min(100, 50 + sources.length * 3));
    });
    return out;
  }
  function repair(payload){
    if (!payload || !Array.isArray(payload.articles)) return payload;
    var buckets = {};
    var articles = payload.articles.map(function(article){ return splitArticle(article, buckets); });
    Object.keys(buckets).forEach(function(name){
      var bucket = buckets[name];
      articles.push(makeArticleFromGroup(bucket.key, bucket.sources, bucket.template || {}));
    });
    payload = Object.assign({}, payload);
    payload.articles = mergeByStory(articles).filter(function(article){ return clean(article.title); });
    payload.scanMeta = Object.assign({}, payload.scanMeta || {}, { appClusterSafety: 'split_unrelated_sources_v1' });
    return payload;
  }

  window.fetch = function(input, init){
    return nativeFetch.apply(this, arguments).then(function(response){
      var url = typeof input === 'string' ? input : input && input.url || '';
      if (url.indexOf('latest-news.json') === -1) return response;
      return response.clone().json().then(function(payload){
        var repaired = repair(payload);
        return new Response(JSON.stringify(repaired), {
          status: response.status,
          statusText: response.statusText,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
        });
      }).catch(function(){ return response; });
    });
  };
})();
