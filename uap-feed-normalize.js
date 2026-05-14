(function(){
  'use strict';

  if (window.__uapFeedNormalize) return;
  window.__uapFeedNormalize = true;

  var nativeFetch = window.fetch;
  var SPACE_RE = /\s+/g;
  var WORD_RE = /[a-z0-9]+/g;
  var STOP = ('a an the to of for in on at by with from and or is are was were be been has have had will would could should may might new latest update report reports news says said about into after before over under this that these those watch video live first amid via than public article source sources uap uaps ufo ufos unidentified anomalous aerial flying phenomena').split(' ');
  var STOP_SET = STOP.reduce(function(acc, word){ acc[word] = true; return acc; }, {});
  var STRONG = ('aaro alien archive archives congress crash declassified disclosure document documents dod federal files foia government hearing image images military nasa nonhuman pentagon photos pilot radar records release released senate sighting sightings trump video videos war whistleblower ministry defense defence advisor website portal transparency').split(' ');
  var STRONG_SET = STRONG.reduce(function(acc, word){ acc[word] = true; return acc; }, {});
  var LOW_TRUST = /\b(tmz|daily mail|the sun|latestly|bollywoodshaadis|stupiddope|mashable india)\b/;
  var TRUSTED = /\b(\.gov|department|pbs|ap news|associated press|bbc|abc|sky|cbc|al jazeera|axios|reuters)\b/;

  function clean(value){ return String(value == null ? '' : value).replace(SPACE_RE, ' ').trim(); }
  function slug(value){ return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'article'; }
  function titleKey(value){ return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function words(text){ return (clean(text).toLowerCase().match(WORD_RE) || []).filter(function(word){ return word.length > 2 && !STOP_SET[word]; }); }
  function wordSet(text){ return words(text).reduce(function(acc, word){ acc[word] = true; return acc; }, {}); }
  function shared(a, b){ return Object.keys(a).filter(function(word){ return b[word]; }); }
  function overlap(a, b){ var sa = Object.keys(a).length; var sb = Object.keys(b).length; return sa && sb ? shared(a,b).length / Math.min(sa, sb) : 0; }
  function strongShared(a, b){ return shared(a,b).filter(function(word){ return STRONG_SET[word]; }).length; }
  function sourceKey(source){ return clean((source && (source.url || source.link || source.title || source.source)) || '').toLowerCase(); }
  function sourceFromArticle(article){ return { title: article.title || '', url: article.url || article.link || '', link: article.link || article.url || '', source: article.source || '', publishedAt: article.publishedAt || article.detectedAt || article.date || '' }; }
  function articleKey(article){ return sourceKey(sourceFromArticle(article)) || slug(article && article.title); }
  function articleText(article){ return clean([article && article.title, article && article.description, article && article.summary].join(' ')); }
  function sourceText(source){ return clean([source && source.title, source && source.source].join(' ')); }
  function candidateText(candidate){ return candidate.kind === 'article' ? articleText(candidate.article) : sourceText(candidate.source); }
  function dedupeSources(sources){
    var seen = {};
    return (sources || []).filter(function(source){
      if (!source) return false;
      var key = sourceKey(source);
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function eventProfile(text){
    var raw = clean(text).toLowerCase();
    var hasUap = /\b(uap|uaps|ufo|ufos|unidentified anomalous|unidentified aerial|unidentified flying|alien)\b/.test(raw);
    var hasFiles = /\b(file|files|record|records|archive|archives|document|documents|transcript|transcripts|video|videos|photo|photos|material|materials)\b/.test(raw);
    var hasRelease = /\b(release|released|releases|releasing|declassif|unseal|unsealed|publish|published|posting|posted|drops?|opens?|transparency|public archive)\b/.test(raw);
    var hasProgram = /\b(program|tracking|monitoring|studying|study|directive|advisor|ministry|minister)\b/.test(raw);
    var hasSighting = /\b(sighting|sightings|spotted|seen|encounter|encountered|lights|orbs|object|objects)\b/.test(raw);
    var hasFilm = /\b(film|movie|documentary|sleeping dog|trailer|director|hollywood)\b/.test(raw);
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
    var common = shared(aWords, bWords);
    var strong = strongShared(aWords, bWords);
    return (ratio >= 0.48 && common.length >= 4) || (ratio >= 0.32 && strong >= 2) || (ratio >= 0.38 && common.length >= 6);
  }

  function rankSource(source){
    var src = clean(source && source.source).toLowerCase();
    return (TRUSTED.test(src) ? 1000 : 0) + clean(source && source.title).length;
  }
  function sourcePoints(mentions){
    if (mentions >= 20) return 40;
    if (mentions >= 10) return 34;
    if (mentions >= 5) return 24;
    return Math.max(0, (mentions - 1) * 5);
  }
  function qualityCap(article, mentions, type){
    var source = clean(article && article.source).toLowerCase();
    if (type === 'film') return 76;
    if (mentions <= 1 && LOW_TRUST.test(source)) return 72;
    if (mentions <= 1) return 84;
    return 100;
  }
  function baseScore(article){
    var parts = (article.qualityBreakdown || []).filter(function(part){ return part && part.label !== 'Mehrere Quellen'; });
    var score = parts.reduce(function(total, part){ return total + (Number(part.points) || 0); }, 0);
    return score || Number(article.quality || article.sourceQuality || 50) || 50;
  }
  function normalizeQuality(article){
    var mentions = Math.max(1, Number(article.mentions || 1));
    var type = eventProfile([article.title, article.summary, (article.clusterTitles || []).join(' '), (article.otherSources || []).map(function(s){ return s && s.title; }).join(' ')].join(' ')).type;
    var parts = (article.qualityBreakdown || []).filter(function(part){ return part && part.label !== 'Mehrere Quellen'; });
    var points = sourcePoints(mentions);
    if (points > 0) parts.push({ label: 'Mehrere Quellen', points: points, text: mentions + ' Quellen im aktuellen Feed.' });
    var score = baseScore(article) + points;
    if (type === 'file-release' && mentions >= 20) score = Math.max(score, 90);
    else if (type === 'file-release' && mentions >= 10) score = Math.max(score, 86);
    else if (type === 'program' && mentions >= 3) score = Math.max(score, 78);
    article.qualityBreakdown = parts;
    article.quality = Math.max(20, Math.min(qualityCap(article, mentions, type), score));
    article.sourceQuality = article.quality;
    return article;
  }

  function makeGroup(items){
    var templates = items.filter(function(item){ return item.kind === 'article'; }).map(function(item){ return item.article; });
    templates = templates.concat(items.filter(function(item){ return item.template; }).map(function(item){ return item.template; }));
    var template = templates.sort(function(a,b){ return articleText(b).length - articleText(a).length; })[0] || {};
    var base = Object.assign({}, template);
    var sources = [];
    items.forEach(function(item){
      if (item.kind === 'article') {
        sources.push(sourceFromArticle(item.article));
        sources = sources.concat(item.article.otherSources || []);
      } else {
        sources.push(item.source);
      }
    });
    sources = dedupeSources(sources).sort(function(a,b){ return rankSource(b) - rankSource(a); });
    var primary = sources[0] || {};
    var other = sources.slice(1);
    base.id = slug((eventProfile(candidateText(items[0])).type || 'story') + '-' + (clean(primary.title) || base.title || 'article'));
    base.title = clean(primary.title) || clean(base.title) || 'UAP News';
    base.source = clean(primary.source) || clean(base.source) || 'UAP News';
    base.link = clean(primary.link || primary.url || base.link || base.url);
    base.publishedAt = primary.publishedAt || base.publishedAt || base.date;
    base.mentions = Math.max(1, 1 + other.length);
    base.otherSources = other;
    base.clusterTitles = other.map(function(source){ return clean(source.title); }).filter(Boolean).slice(0, 10);
    base.summary = clean(base.summary);
    delete base.translations;
    delete base.translationMeta;
    return normalizeQuality(base);
  }

  function collectCandidates(articles){
    var candidates = [];
    var seen = {};
    function add(candidate){
      var key = candidate.kind + ':' + (candidate.kind === 'article' ? articleKey(candidate.article) : sourceKey(candidate.source));
      if (!key || seen[key]) return;
      seen[key] = true;
      candidates.push(candidate);
    }
    articles.forEach(function(article){
      if (!article || !clean(article.title)) return;
      add({ kind: 'article', article: article });
      (article.otherSources || []).forEach(function(source){ if (source && clean(source.title)) add({ kind: 'source', source: source, template: article }); });
    });
    return candidates;
  }
  function groupCandidates(candidates){
    var used = {};
    var groups = [];
    candidates.forEach(function(candidate, index){
      if (used[index]) return;
      var group = [candidate];
      used[index] = true;
      for (var i = index + 1; i < candidates.length; i++) {
        if (!used[i] && sameStoryText(candidateText(candidate), candidateText(candidates[i]))) {
          group.push(candidates[i]);
          used[i] = true;
        }
      }
      groups.push(group);
    });
    return groups;
  }
  function mergeDuplicateTitles(articles){
    var byTitle = {};
    var order = [];
    articles.forEach(function(article){
      var key = titleKey(article && article.title);
      if (!key) return;
      if (!byTitle[key]) {
        byTitle[key] = article;
        order.push(key);
        return;
      }
      var target = byTitle[key];
      var sources = dedupeSources((target.otherSources || []).concat([sourceFromArticle(article)]).concat(article.otherSources || []));
      target.otherSources = sources.filter(function(source){ return titleKey(source.title) !== titleKey(target.title); });
      target.mentions = Math.max(target.mentions || 1, article.mentions || 1, 1 + target.otherSources.length);
      target.clusterTitles = target.otherSources.map(function(source){ return clean(source.title); }).filter(Boolean).slice(0, 10);
      if (clean(article.summary).length > clean(target.summary).length) target.summary = article.summary;
      target.quality = Math.max(Number(target.quality || 0), Number(article.quality || 0));
      normalizeQuality(target);
    });
    return order.map(function(key){ return byTitle[key]; });
  }
  function normalizeFeed(payload){
    if (!payload || !Array.isArray(payload.articles)) return payload;
    var articles = groupCandidates(collectCandidates(payload.articles)).map(makeGroup).filter(function(article){ return clean(article.title); });
    articles = mergeDuplicateTitles(articles).map(normalizeQuality);
    articles.sort(function(a,b){
      var qualityDiff = Number(b.quality || 0) - Number(a.quality || 0);
      if (qualityDiff) return qualityDiff;
      return Date.parse(b.publishedAt || b.date || 0) - Date.parse(a.publishedAt || a.date || 0);
    });
    payload = Object.assign({}, payload, { articles: articles });
    payload.scanMeta = Object.assign({}, payload.scanMeta || {}, { appFeedNormalize: 'consolidated_v1' });
    return payload;
  }

  window.fetch = function(input, init){
    return nativeFetch.apply(this, arguments).then(function(response){
      var url = typeof input === 'string' ? input : input && input.url || '';
      if (url.indexOf('latest-news.json') === -1) return response;
      return response.clone().json().then(function(payload){
        return new Response(JSON.stringify(normalizeFeed(payload)), {
          status: response.status,
          statusText: response.statusText,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
        });
      }).catch(function(){ return response; });
    });
  };

  function parseTime(article){
    var value = article && (article.publishedAt || article.detectedAt || article.createdAt || article.updatedAt || article.timestamp || article.date);
    var t = Date.parse(value && String(value).length <= 10 ? String(value) + 'T00:00:00Z' : value);
    return isNaN(t) ? 0 : t;
  }
  function sourceCount(article){ return Math.max(1, 1 + ((article && article.otherSources || []).length)); }
  function syncVisibleFeed(feed){
    var feedEl = document.getElementById('feed');
    if (!feedEl) return;
    var byTitle = {};
    (feed && feed.articles || []).forEach(function(article, index){ byTitle[titleKey(article.title)] = { article: article, index: index }; });
    Array.prototype.slice.call(feedEl.querySelectorAll('.article-card')).forEach(function(card){
      var h2 = card.querySelector('h2');
      var info = byTitle[titleKey(h2 && h2.textContent)];
      if (!info || !info.article) return;
      var article = info.article;
      var quality = Number(article.quality || article.sourceQuality || 0) || 0;
      card.dataset.uapQuality = String(quality);
      card.dataset.uapSortTime = String(parseTime(article));
      card.dataset.uapOrder = String(info.index);
      var q = card.querySelector('.badge.quality');
      if (q) q.textContent = 'Wertung ' + quality;
      var sources = card.querySelector('.badge.sources');
      if (sources) {
        var count = sourceCount(article);
        sources.textContent = count + ' Quelle' + (count === 1 ? '' : 'n');
      }
    });
    Array.prototype.slice.call(feedEl.querySelectorAll('.article-card')).sort(function(a,b){
      var qualityDiff = Number(b.dataset.uapQuality || 0) - Number(a.dataset.uapQuality || 0);
      if (qualityDiff) return qualityDiff;
      var timeDiff = Number(b.dataset.uapSortTime || 0) - Number(a.dataset.uapSortTime || 0);
      if (timeDiff) return timeDiff;
      return Number(a.dataset.uapOrder || 9999) - Number(b.dataset.uapOrder || 9999);
    }).forEach(function(card){ feedEl.appendChild(card); });
  }
  var applying = false;
  var queued = false;
  function applyDisplaySync(){
    if (applying) return;
    applying = true;
    queued = false;
    fetch('latest-news.json?normalizeDisplay=' + Date.now(), { cache: 'no-store' })
      .then(function(resp){ return resp.ok ? resp.json() : { articles: [] }; })
      .then(syncVisibleFeed)
      .catch(function(){})
      .finally(function(){ applying = false; });
  }
  function queueDisplaySync(){
    if (queued) return;
    queued = true;
    setTimeout(applyDisplaySync, 120);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyDisplaySync, { once:true });
  else applyDisplaySync();
  [300, 900, 1800, 3200].forEach(function(delay){ setTimeout(applyDisplaySync, delay); });
  new MutationObserver(queueDisplaySync).observe(document.documentElement, { childList:true, subtree:true });
})();
