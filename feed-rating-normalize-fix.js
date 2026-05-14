(function(){
  'use strict';

  if (window.__uapFeedRatingNormalizeFix) return;
  window.__uapFeedRatingNormalizeFix = true;

  var nativeFetch = window.fetch;
  var SPACE_RE = /\s+/g;

  function clean(value){ return String(value == null ? '' : value).replace(SPACE_RE, ' ').trim(); }
  function slug(value){ return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'article'; }
  function storyKey(text){
    var raw = clean(text).toLowerCase();
    var hasUap = /\b(uap|uaps|ufo|ufos|unidentified anomalous|unidentified aerial|unidentified flying|alien)\b/.test(raw);
    var hasFiles = /\b(file|files|record|records|archive|archives|document|documents|transcript|transcripts|video|videos|photo|photos|material|materials)\b/.test(raw);
    var hasRelease = /\b(release|released|releases|releasing|declassif|unseal|unsealed|publish|published|posting|posted|drops?|opens?|transparency|public archive)\b/.test(raw);
    var hasGov = /\b(us|u\.s\.|united states|government|federal|pentagon|department of war|defense department|defence department|dod|war\.gov|pursue|trump|state department|fbi|nasa)\b/.test(raw);

    if (raw.indexOf('sleeping dog') !== -1 && /\b(corbell|lazar|whistleblower|cia|ufo|uap)\b/.test(raw)) return 'sleeping-dog-corbell';
    if (/\b(ukraine|ukrainian)\b/.test(raw) && /\b(advisor|minister|ministry|armed forces|military|russia|russian|defence|defense|wartime|war)\b/.test(raw)) return 'ukraine-uap-program';
    if (/\bjapan\b/.test(raw) && hasUap && (hasFiles || hasRelease || /\bdisclosure\b/.test(raw))) return 'japan-uap-files';
    if (hasUap && hasFiles && hasRelease && (hasGov || /\b(green men|public can|draw.*conclusions|transparency push|historic public release)\b/.test(raw))) return 'us-uap-file-release';
    if (hasUap && hasFiles && hasRelease && !/\b(ukraine|ukrainian|japan|russia|russian|china|chinese)\b/.test(raw)) return 'us-uap-file-release';
    return '';
  }
  function articleText(article){ return clean([article && article.title, article && article.description, article && article.summary].join(' ')); }
  function sourceText(source){ return clean([source && source.title, source && source.source].join(' ')); }
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
  function dedupe(sources){
    var seen = {};
    return (sources || []).filter(function(source){
      var key = sourceKey(source);
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }
  function rank(source){
    var src = clean(source.source).toLowerCase();
    var title = clean(source.title).length;
    var trusted = /\b(\.gov|department|pbs|ap news|associated press|bbc|abc|sky|cbc|al jazeera|axios|reuters)\b/.test(src) ? 1000 : 0;
    return trusted + title;
  }
  function sourcePoints(mentions){ return Math.min(28, Math.max(0, mentions - 1) * 7); }
  function capFor(article, mentions){
    var source = clean(article.source).toLowerCase();
    if (mentions > 1) return 100;
    if (/\b(tmz|daily mail|the sun|latestly|bollywoodshaadis|stupiddope|mashable india)\b/.test(source)) return 72;
    return 84;
  }
  function normalizeBreakdown(article, mentions){
    var points = sourcePoints(mentions);
    var parts = (article.qualityBreakdown || []).filter(function(part){
      return part && part.label !== 'Mehrere Quellen';
    });
    if (points > 0) {
      parts.push({ label: 'Mehrere Quellen', points: points, text: mentions + ' Quellen im aktuellen Feed.' });
    }
    return parts;
  }
  function normalizeQuality(article){
    var mentions = Math.max(1, Number(article.mentions || 1));
    article.qualityBreakdown = normalizeBreakdown(article, mentions);
    var score = article.qualityBreakdown.reduce(function(total, part){ return total + (Number(part.points) || 0); }, 0);
    if (!score) score = Number(article.quality || article.sourceQuality || 50) || 50;
    article.quality = Math.max(20, Math.min(capFor(article, mentions), score));
    article.sourceQuality = article.quality;
    return article;
  }
  function summaryFor(key){
    if (key === 'us-uap-file-release') return 'The U.S. Department of War/Pentagon has begun releasing UFO/UAP records through a public archive, with officials saying readers can review the material and draw their own conclusions.';
    if (key === 'ukraine-uap-program') return 'A Ukrainian defense adviser said Ukraine tracks unidentified aerial activity as part of wartime security monitoring, because unusual objects could indicate new Russian technology or other threats.';
    if (key === 'japan-uap-files') return 'The article reports that Japan may release or examine UAP-related files after renewed public attention on U.S. and Ukrainian UFO disclosures.';
    if (key === 'sleeping-dog-corbell') return 'The article concerns Jeremy Corbell, Bob Lazar or related claims around the film Sleeping Dog and alleged UFO or intelligence-community material.';
    return '';
  }
  function groupArticle(key, sources, template){
    sources = dedupe(sources).sort(function(a,b){ return rank(b) - rank(a); });
    var primary = sources[0] || {};
    var other = sources.slice(1);
    var article = Object.assign({}, template || {}, {
      id: key,
      title: clean(primary.title) || clean(template && template.title) || 'UAP News',
      source: clean(primary.source) || 'UAP News',
      link: clean(primary.link || primary.url),
      publishedAt: primary.publishedAt || template && template.publishedAt || template && template.date,
      summary: summaryFor(key) || template && template.summary || '',
      mentions: Math.max(1, 1 + other.length),
      otherSources: other,
      clusterTitles: other.map(function(source){ return clean(source.title); }).filter(Boolean).slice(0, 10)
    });
    return normalizeQuality(article);
  }
  function repair(payload){
    if (!payload || !Array.isArray(payload.articles)) return payload;
    var buckets = {};
    var result = [];

    function addBucket(key, source, template){
      if (!buckets[key]) buckets[key] = { sources: [], template: template || {} };
      buckets[key].sources.push(source);
      if (template && (!buckets[key].template || clean(template.summary).length > clean(buckets[key].template.summary).length)) buckets[key].template = template;
    }

    payload.articles.forEach(function(article){
      var aKey = storyKey(articleText(article));
      var remainingSources = [];
      (article.otherSources || []).forEach(function(source){
        var sKey = storyKey(sourceText(source));
        if (sKey) addBucket(sKey, source, article);
        else remainingSources.push(source);
      });
      if (aKey) addBucket(aKey, sourceFromArticle(article), article);
      else {
        article = Object.assign({}, article, {
          otherSources: dedupe(remainingSources),
          mentions: Math.max(1, 1 + dedupe(remainingSources).length)
        });
        result.push(normalizeQuality(article));
      }
    });

    Object.keys(buckets).forEach(function(key){ result.push(groupArticle(key, buckets[key].sources, buckets[key].template)); });
    result.sort(function(a,b){
      var qb = Number(b.quality || 0) - Number(a.quality || 0);
      if (qb) return qb;
      return Date.parse(b.publishedAt || b.date || 0) - Date.parse(a.publishedAt || a.date || 0);
    });
    payload = Object.assign({}, payload, { articles: result });
    payload.scanMeta = Object.assign({}, payload.scanMeta || {}, { appRatingNormalize: 'file_release_grouping_and_quality_v1' });
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
