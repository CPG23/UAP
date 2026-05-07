const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'index.html');
const swPath = path.join(process.cwd(), 'sw.js');
let html = fs.readFileSync(indexPath, 'utf8');
let sw = fs.readFileSync(swPath, 'utf8');

const marker = 'uap-fast-news-search-v1';
const override = `
  // ${marker}: fast multi-source startup search. Renders as soon as usable hits arrive.
  (function() {
    function _fastDecodeHtml(str) {
      var box = document.createElement('textarea');
      box.innerHTML = String(str || '');
      return box.value.replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim();
    }
    function _fastCleanTitle(title) {
      return _fastDecodeHtml(title).replace(/\\s+-\\s+[^-]{2,80}$/,'').trim();
    }
    function _fastSummary(text, title) {
      var s = _fastDecodeHtml(text || '');
      var t = _fastDecodeHtml(title || '');
      if (!s || s === t || s.length < 45) return '';
      return s.length > 420 ? s.slice(0, 420).replace(/\\s+\\S*$/, '') + '...' : s;
    }
    function _fastDate(value) {
      var d = value ? new Date(value) : new Date();
      if (isNaN(d.getTime())) d = new Date();
      return d.toISOString().split('T')[0];
    }
    function _fastQuality(text) {
      var hay = String(text || '').toLowerCase();
      var score = 0;
      ['uap','ufo','aaro','pentagon','congress','senate','nasa','dod','disclosure','unidentified anomalous'].forEach(function(term) {
        if (hay.indexOf(term) > -1) score += 12;
      });
      return Math.min(100, score);
    }
    function _fastTerms(text) {
      var hay = String(text || '').toLowerCase();
      var terms = [];
      ['uap','ufo','aaro','pentagon','congress','nasa','disclosure'].forEach(function(term) {
        if (hay.indexOf(term) > -1) terms.push(term.toUpperCase());
      });
      return terms.slice(0, 4);
    }
    function _fastAllowed(item) {
      var hay = ((item.title || '') + ' ' + (item.summary || '') + ' ' + (item.source || '')).toLowerCase();
      var positive = /\\buap\\b|\\bufo\\b|unidentified anomalous|aaro|pentagon.*ufo|congress.*ufo|nasa.*uap|disclosure.*ufo|drone incursions/.test(hay);
      var negative = /sports|football|basketball|wrestling|ufc|fantasy|game|movie review|astrology/.test(hay);
      return positive && !negative;
    }
    function _fastNormalise(items) {
      var seen = {};
      var out = [];
      (items || []).forEach(function(raw) {
        var title = _fastCleanTitle(raw.title || '');
        if (!title || title.length < 8) return;
        var id = topicId(title);
        if (!id || seen[id]) return;
        var item = {
          id: id,
          title: title,
          source: raw.source || 'UAP News',
          date: _fastDate(raw.date || raw.pubDate || raw.publishedAt),
          summary: _fastSummary(raw.summary || raw.description || raw.contentSnippet, title),
          url: raw.url || raw.link || '',
          isOfficial: /pentagon|aaro|nasa|congress|dod|senate|military|defense/i.test((raw.source || '') + ' ' + title),
          _mentions: raw.mentions || 1,
          quality: raw.quality || _fastQuality(title + ' ' + (raw.summary || raw.description || '')),
          _quality: raw.quality || _fastQuality(title + ' ' + (raw.summary || raw.description || '')),
          matchedTerms: raw.matchedTerms || _fastTerms(title + ' ' + (raw.summary || raw.description || '')),
          _matchedTerms: raw.matchedTerms || _fastTerms(title + ' ' + (raw.summary || raw.description || '')),
          _otherSources: raw._otherSources || []
        };
        if (!_fastAllowed(item)) return;
        seen[id] = true;
        out.push(item);
      });
      return out.slice(0, 12);
    }
    function _fastParseGoogleRss(xml) {
      var doc = new DOMParser().parseFromString(String(xml || ''), 'text/xml');
      return Array.prototype.slice.call(doc.querySelectorAll('item')).map(function(item) {
        var source = item.querySelector('source');
        return {
          title: item.querySelector('title') ? item.querySelector('title').textContent : '',
          url: item.querySelector('link') ? item.querySelector('link').textContent : '',
          source: source ? source.textContent : 'Google News',
          date: item.querySelector('pubDate') ? item.querySelector('pubDate').textContent : '',
          summary: item.querySelector('description') ? item.querySelector('description').textContent : ''
        };
      });
    }
    function _fastTimeout(ms) {
      return new Promise(function(_, reject) { setTimeout(function() { reject(new Error('timeout')); }, ms); });
    }
    function _fastFetchJson(url, ms) {
      return Promise.race([
        fetch(url, { cache: 'no-store' }).then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }),
        _fastTimeout(ms || 4500)
      ]);
    }
    function _fastFetchText(url, ms) {
      return Promise.race([
        fetch(url, { cache: 'no-store' }).then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }),
        _fastTimeout(ms || 4500)
      ]);
    }
    function _fastGoogleUrl(query) {
      return 'https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=en-US&gl=US&ceid=US:en';
    }
    function _fastSourceTasks() {
      var queries = [
        'UAP OR UFO when:14d',
        'AARO OR Pentagon UFO OR UAP when:30d',
        'UFO disclosure congress OR senate when:30d'
      ];
      var tasks = [];
      queries.forEach(function(q) {
        var rss = _fastGoogleUrl(q);
        tasks.push(function() { return _fastFetchText('https://api.allorigins.win/raw?url=' + encodeURIComponent(rss), 4200).then(_fastParseGoogleRss); });
        tasks.push(function() { return _fastFetchJson('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(rss), 5200).then(function(d) { return (d.items || []).map(function(it) { return { title: it.title, url: it.link, source: it.author || 'Google News', date: it.pubDate, summary: it.description }; }); }); });
      });
      tasks.push(function() { return _fastFetchJson('https://api.gdeltproject.org/api/v2/doc/doc?query=' + encodeURIComponent('(UAP OR UFO OR AARO OR "unidentified anomalous")') + '&mode=artlist&format=json&maxrecords=30&sort=hybridrel', 4500).then(function(d) { return (d.articles || []).map(function(a) { return { title: a.title, url: a.url, source: a.sourceCountry || a.domain || 'GDELT', date: a.seendate, summary: a.title }; }); }); });
      return tasks;
    }
    async function _fastCollectNews() {
      var tasks = _fastSourceTasks();
      var bag = [];
      var rendered = false;
      await Promise.allSettled(tasks.map(function(task) {
        return task().then(function(items) {
          bag = bag.concat(items || []);
          var now = _fastNormalise(bag);
          if (!rendered && now.length >= 3) {
            rendered = true;
            currentArticles = now;
            renderArticles(now);
            lastScanTime = new Date();
            var last = document.getElementById('last-scan');
            if (last) last.textContent = _fmtScanTime(lastScanTime);
            saveFeedCache();
          }
        });
      }));
      var finalItems = _fastNormalise(bag);
      if (finalItems.length) {
        currentArticles = finalItems;
        renderArticles(finalItems);
        lastScanTime = new Date();
        var last2 = document.getElementById('last-scan');
        if (last2) last2.textContent = _fmtScanTime(lastScanTime);
        saveFeedCache();
      }
      return finalItems;
    }
    if (!window.__uapOriginalLoadNews && typeof loadNews === 'function') {
      window.__uapOriginalLoadNews = loadNews;
    }
    loadNews = async function() {
      try {
        var fastItems = await _fastCollectNews();
        if (fastItems && fastItems.length) return fastItems;
      } catch(e) {}
      if (window.__uapOriginalLoadNews) return window.__uapOriginalLoadNews();
      return [];
    };
  })();
`;

if (!html.includes(marker)) {
  const anchor = '  // Auto-load on start\n';
  if (!html.includes(anchor)) throw new Error('Auto-load anchor not found');
  html = html.replace(anchor, override + '\n' + anchor);
}

// Keep startup watchdog near the top as an actual fallback, but bump cache version too.
sw = sw.replace(/var CACHE = 'uap-[^']+';/, "var CACHE = 'uap-v13-fast-news-search';");
if (!html.includes(marker) || !html.includes('_fastCollectNews') || !sw.includes('uap-v13-fast-news-search')) {
  throw new Error('Fast news search validation failed');
}

fs.writeFileSync(indexPath, html);
fs.writeFileSync(swPath, sw);
console.log('Installed fast multi-source news search.');
