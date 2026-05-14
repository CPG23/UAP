(function(){
  'use strict';

  if (window.__uapFeedRatingNormalizeFix) return;
  window.__uapFeedRatingNormalizeFix = true;

  var nativeFetch = window.fetch;
  var SPACE_RE = /\s+/g;
  var WORD_RE = /[a-z0-9]+/g;
  var STOP = ('a an the to of for in on at by with from and or is are was were be been has have had will would could should may might new latest update report reports news says said about into after before over under this that these those watch video live first amid via than public article source sources uap uaps ufo ufos unidentified anomalous aerial flying phenomena').split(' ');
  var STOP_SET = STOP.reduce(function(acc, word){ acc[word] = true; return acc; }, {});
  var STRONG = ('aaro alien archive archives congress crash declassified disclosure document documents dod federal files foia government hearing image images military nasa nonhuman pentagon photos pilot radar records release released senate sighting sightings trump video videos war whistleblower ministry defense defence advisor website portal transparency').split(' ');
  var STRONG_SET = STRONG.reduce(function(acc, word){ acc[word] = true; return acc; }, {});

  function clean(value){ return String(value == null ? '' : value).replace(SPACE_RE, ' ').trim(); }
  function slug(value){ return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'article'; }
  function words(text){ return (clean(text).toLowerCase().match(WORD_RE) || []).filter(function(word){ return word.length > 2 && !STOP_SET[word]; }); }
  function wordSet(text){ return words(text).reduce(function(acc, word){ acc[word] = true; return acc; }, {}); }
  function shared(a, b){ return Object.keys(a).filter(function(word){ return b[word]; }); }
  function overlap(a, b){ var sa = Object.keys(a).length; var sb = Object.keys(b).length; return sa && sb ? shared(a,b).length / Math.min(sa, sb) : 0; }
  function strongShared(a, b){ return shared(a,b).filter(function(word){ return STRONG_SET[word]; }).length; }
  function articleText(article){ return clean([article && article.title, article && article.description, article && article.summary].join(' ')); }
  function sourceText(source){ return clean([source && source.title, source && source.source].join(' ')); }
  function candidateText(item){ return item.kind === 'article' ? articleText(item.article) : sourceText(item.source); }
  function sourceKey(source){ return clean((source && (source.url || source.link || source.title || source.source)) || '').toLowerCase(); }
  function articleKey(article){ return sourceKey(sourceFromArticle(article)); }
  function sourceFromArticle(article){ return { title: article.title || '', url: article.url || article.link || '', link: article.link || article.url || '', source: article.source || '', publishedAt: article.publishedAt || article.detectedAt || article.date || '' }; }

  function eventProfile(text){
    var raw = clean(text).toLowerCase();
    var hasUap = /\b(uap|uaps|ufo|ufos|unidentified anomalous|unidentified aerial|unidentified flying|alien)\b/.test(raw);
    var hasFiles = /\b(file|files|record|records|archive|archives|document|documents|transcript|transcripts|video|videos|photo|photos|material|materials)\b/.test(raw);
    var hasRelease = /\b(release|released|releases|releasing|declassif|unseal|unsealed|publish|published|posting|posted|drops?|opens?|transparency|public archive)\b/.test(raw);
    var hasProgram = /\b(program|tracking|monitoring|studying|study|directive|advisor|ministry|minister)\b/.test(raw);
    var hasSighting = /\b(sighting|sightings|spotted|seen|encounter|encountered|lights|orbs|object|objects)\b/.test(raw);
    var hasFilm = /\b(film|movie|documentary|sleeping dog|trailer|director)\b/.test(raw);
    var type = '';
    if (hasUap && hasFiles && hasRelease) type = 'file-release';
    else if (hasUap && hasProgram) type = 'program';
    else if (hasUap && hasFilm) type = 'film';
    else if (hasUap && hasSighting) type = 'sighting';

    var actors = [];
    [
      ['us', /\b(us|u\.s\.|united states|american|pentagon|department of war|defense department|defence department|dod|war\.gov|federal|trump|state department|fbi)\b/],
      ['ukraine', /\b(ukraine|ukrainian)\b/],
      ['japan', /\bjapan\b/],
      ['russia', /\b(russia|russian)\b/],
      ['china', /\b(china|chinese)\b/],
      ['nasa', /\bnasa\b/],
      ['congress', /\b(congress|senate|representative|hearing)\b/],
      ['aaro', /\baaro\b/],
      ['corbell-lazar', /\b(corbell|lazar)\b/]
    ].forEach(function(pair){ if (pair[1].test(raw)) actors.push(pair[0]); });
    return { type: type, actors: actors };
  }
  function actorCompatible(a, b){ return !a.actors.length || !b.actors.length || a.actors.some(function(actor){ return b.actors.indexOf(actor) !== -1; }); }
  function sameStoryText(aText, bText){
    var aProfile = eventProfile(aText);
    var bProfile = eventProfile(bText);
    if (aProfile.type || bProfile.type) return !!(aProfile.type && aProfile.type === bProfile.type && actorCompatible(aProfile, bProfile));
    var aWords = wordSet(aText);
    var bWords = wordSet(bText);
    var ratio = overlap(aWords, bWords);
    var strong = strongShared(aWords, bWords);
    return (ratio >= 0.48 && shared(aWords, bWords).length >= 4) || (ratio >= 0.32 && strong >= 2) || (ratio >= 0.38 && shared(aWords, bWords).length >= 6);
  }
  function dedupe(sources){
    var seen = {};
    return (sources || []).filter(function(source){ var key = sourceKey(source); if (!key || seen[key]) return false; seen[key] = true; return true; });
  }
  function rank(source){
    var src = clean(source.source).toLowerCase();
    var trusted = /\b(\.gov|department|pbs|ap news|associated press|bbc|abc|sky|cbc|al jazeera|axios|reuters)\b/.test(src) ? 1000 : 0;
    return trusted + clean(source.title).length;
  }
  function sourcePoints(mentions){ return Math.min(28, Math.max(0, mentions - 1) * 7); }
  function capFor(article, mentions){
    var source = clean(article.source).toLowerCase();
    if (mentions > 1) return 100;
    if (/\b(tmz|daily mail|the sun|latestly|bollywoodshaadis|stupiddope|mashable india)\b/.test(source)) return 72;
    return 84;
  }
  function normalizeQuality(article){
    var mentions = Math.max(1, Number(article.mentions || 1));
    var parts = (article.qualityBreakdown || []).filter(function(part){ return part && part.label !== 'Mehrere Quellen'; });
    var points = sourcePoints(mentions);
    if (points > 0) parts.push({ label: 'Mehrere Quellen', points: points, text: mentions + ' Quellen im aktuellen Feed.' });
    var score = parts.reduce(function(total, part){ return total + (Number(part.points) || 0); }, 0) || Number(article.quality || article.sourceQuality || 50) || 50;
    article.qualityBreakdown = parts;
    article.quality = Math.max(20, Math.min(capFor(article, mentions), score));
    article.sourceQuality = article.quality;
    return article;
  }
  function genericSummary(article){
    var title = clean(article.title);
    var profile = eventProfile(title + ' ' + clean(article.summary));
    if (clean(article.summary)) return clean(article.summary);
    if (profile.type === 'file-release') return 'Mehrere Quellen berichten über die Veröffentlichung oder Freigabe von UFO/UAP-Dateien, Dokumenten oder Archivmaterial. Die Einordnung wird anhand der verknüpften Quellen im nächsten Scan weiter präzisiert.';
    if (profile.type === 'program') return 'Der Artikel beschreibt ein UAP/UFO-bezogenes Programm, Monitoring oder eine behördliche Einschätzung. Die ausführliche Zusammenfassung wird beim nächsten GitHub-Scan aus dem Artikelinhalt ergänzt.';
    if (profile.type === 'sighting') return 'Der Artikel berichtet über eine UAP/UFO-Sichtung oder ungewöhnliche Beobachtung. Die ausführliche Zusammenfassung wird beim nächsten GitHub-Scan aus dem Artikelinhalt ergänzt.';
    return title ? 'Der Artikel behandelt: ' + title + '.' : '';
  }
  function makeGroup(items){
    var articleItems = items.filter(function(item){ return item.kind === 'article'; });
    var sourceTemplates = items.filter(function(item){ return item.template; }).map(function(item){ return item.template; });
    var templates = articleItems.map(function(item){ return item.article; }).concat(sourceTemplates);
    var template = templates.sort(function(a,b){ return clean(articleText(b)).length - clean(articleText(a)).length; })[0];
    var base = template ? Object.assign({}, template) : {};
    var sources = [];
    items.forEach(function(item){
      if (item.kind === 'article') {
        sources.push(sourceFromArticle(item.article));
        sources = sources.concat(item.article.otherSources || []);
      } else sources.push(item.source);
    });
    sources = dedupe(sources).sort(function(a,b){ return rank(b) - rank(a); });
    var primary = sources[0] || {};
    var other = sources.slice(1);
    base.id = slug(eventProfile(candidateText(items[0])).type + '-' + (clean(primary.title) || base.title || 'article'));
    base.title = clean(primary.title) || clean(base.title) || 'UAP News';
    base.source = clean(primary.source) || clean(base.source) || 'UAP News';
    base.link = clean(primary.link || primary.url || base.link || base.url);
    base.publishedAt = primary.publishedAt || base.publishedAt || base.date;
    base.mentions = Math.max(1, 1 + other.length);
    base.otherSources = other;
    base.clusterTitles = other.map(function(source){ return clean(source.title); }).filter(Boolean).slice(0, 10);
    base.summary = genericSummary(base);
    delete base.translations;
    delete base.translationMeta;
    return normalizeQuality(base);
  }
  function mergeDuplicateArticles(articles){
    var merged = [];
    articles.forEach(function(article){
      var key = articleKey(article) || slug(article.title);
      var existing = merged.filter(function(item){ return (articleKey(item) || slug(item.title)) === key; })[0];
      if (!existing) { merged.push(article); return; }
      var sources = dedupe((existing.otherSources || []).concat(article.otherSources || []));
      existing.otherSources = sources;
      existing.mentions = Math.max(existing.mentions || 1, article.mentions || 1, 1 + sources.length);
      existing.clusterTitles = sources.map(function(source){ return clean(source.title); }).filter(Boolean).slice(0, 10);
      if (clean(article.summary).length > clean(existing.summary).length) existing.summary = article.summary;
      existing.quality = Math.max(Number(existing.quality || 0), Number(article.quality || 0));
      normalizeQuality(existing);
    });
    return merged;
  }
  function repair(payload){
    if (!payload || !Array.isArray(payload.articles)) return payload;
    var candidates = [];
    var seenCandidate = {};
    function addCandidate(candidate){
      var key = candidate.kind + ':' + (candidate.kind === 'article' ? articleKey(candidate.article) : sourceKey(candidate.source));
      if (!key || seenCandidate[key]) return;
      seenCandidate[key] = true;
      candidates.push(candidate);
    }
    payload.articles.forEach(function(article){
      if (!article || !clean(article.title)) return;
      addCandidate({ kind: 'article', article: article });
      (article.otherSources || []).forEach(function(source){ if (source && clean(source.title)) addCandidate({ kind: 'source', source: source, template: article }); });
    });
    var used = {};
    var groups = [];
    candidates.forEach(function(item, index){
      if (used[index]) return;
      var group = [item];
      used[index] = true;
      for (var i = index + 1; i < candidates.length; i++) {
        if (!used[i] && sameStoryText(candidateText(item), candidateText(candidates[i]))) { group.push(candidates[i]); used[i] = true; }
      }
      groups.push(group);
    });
    var articles = mergeDuplicateArticles(groups.map(makeGroup).filter(function(article){ return clean(article.title); }));
    articles.sort(function(a,b){
      var qb = Number(b.quality || 0) - Number(a.quality || 0);
      if (qb) return qb;
      return Date.parse(b.publishedAt || b.date || 0) - Date.parse(a.publishedAt || a.date || 0);
    });
    payload = Object.assign({}, payload, { articles: articles });
    payload.scanMeta = Object.assign({}, payload.scanMeta || {}, { appRatingNormalize: 'generic_story_similarity_v3_dedupe_summary' });
    return payload;
  }

  window.fetch = function(input, init){
    return nativeFetch.apply(this, arguments).then(function(response){
      var url = typeof input === 'string' ? input : input && input.url || '';
      if (url.indexOf('latest-news.json') === -1) return response;
      return response.clone().json().then(function(payload){
        return new Response(JSON.stringify(repair(payload)), { status: response.status, statusText: response.statusText, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
      }).catch(function(){ return response; });
    });
  };
})();
