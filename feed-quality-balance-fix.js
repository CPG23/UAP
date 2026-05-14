(function(){
  'use strict';

  if (window.__uapFeedQualityBalanceFix) return;
  window.__uapFeedQualityBalanceFix = true;

  var nativeFetch = window.fetch;

  function clean(value){ return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function allText(article){
    return clean([
      article && article.title,
      article && article.summary,
      (article && article.clusterTitles || []).join(' '),
      (article && article.otherSources || []).map(function(source){ return source && source.title; }).join(' ')
    ].join(' ')).toLowerCase();
  }
  function eventType(article){
    var raw = allText(article);
    var hasUap = /\b(uap|uaps|ufo|ufos|unidentified anomalous|unidentified aerial|unidentified flying|alien)\b/.test(raw);
    var hasFiles = /\b(file|files|record|records|archive|archives|document|documents|transcript|transcripts|video|videos|photo|photos|material|materials)\b/.test(raw);
    var hasRelease = /\b(release|released|releases|releasing|declassif|unseal|unsealed|publish|published|posting|posted|drops?|opens?|transparency|public archive)\b/.test(raw);
    var hasFilm = /\b(film|movie|documentary|sleeping dog|trailer|director|hollywood)\b/.test(raw);
    var hasProgram = /\b(program|tracking|monitoring|studying|study|directive|advisor|ministry|minister)\b/.test(raw);
    var hasSighting = /\b(sighting|sightings|spotted|seen|encounter|encountered|lights|orbs|object|objects)\b/.test(raw);
    if (hasUap && hasFiles && hasRelease) return 'file-release';
    if (hasUap && hasProgram) return 'program';
    if (hasUap && hasFilm) return 'film';
    if (hasUap && hasSighting) return 'sighting';
    return '';
  }
  function sourcePoints(mentions){
    if (mentions >= 20) return 40;
    if (mentions >= 10) return 34;
    if (mentions >= 5) return 24;
    return Math.max(0, (mentions - 1) * 5);
  }
  function capFor(article, mentions, type){
    var source = clean(article.source).toLowerCase();
    if (type === 'film') return 76;
    if (mentions <= 1 && /\b(tmz|daily mail|the sun|latestly|bollywoodshaadis|stupiddope|mashable india)\b/.test(source)) return 72;
    if (mentions <= 1) return 84;
    return 100;
  }
  function baseScore(article){
    var parts = (article.qualityBreakdown || []).filter(function(part){ return part && part.label !== 'Mehrere Quellen'; });
    var score = parts.reduce(function(total, part){ return total + (Number(part.points) || 0); }, 0);
    return score || Number(article.quality || article.sourceQuality || 50) || 50;
  }
  function normalize(article){
    var mentions = Math.max(1, Number(article.mentions || 1));
    var type = eventType(article);
    var parts = (article.qualityBreakdown || []).filter(function(part){ return part && part.label !== 'Mehrere Quellen'; });
    var points = sourcePoints(mentions);
    if (points > 0) parts.push({ label: 'Mehrere Quellen', points: points, text: mentions + ' Quellen im aktuellen Feed.' });
    var score = baseScore(article) + points;
    if (type === 'file-release' && mentions >= 20) score = Math.max(score, 90);
    else if (type === 'file-release' && mentions >= 10) score = Math.max(score, 86);
    else if (type === 'program' && mentions >= 3) score = Math.max(score, 78);
    article.qualityBreakdown = parts;
    article.quality = Math.max(20, Math.min(capFor(article, mentions, type), score));
    article.sourceQuality = article.quality;
    return article;
  }
  function repair(payload){
    if (!payload || !Array.isArray(payload.articles)) return payload;
    payload = Object.assign({}, payload, { articles: payload.articles.map(normalize) });
    payload.articles.sort(function(a,b){
      var qb = Number(b.quality || 0) - Number(a.quality || 0);
      if (qb) return qb;
      return Date.parse(b.publishedAt || b.date || 0) - Date.parse(a.publishedAt || a.date || 0);
    });
    payload.scanMeta = Object.assign({}, payload.scanMeta || {}, { appQualityBalance: 'source_strength_event_type_v1' });
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
