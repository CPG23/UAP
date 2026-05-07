const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'index.html');
const swPath = path.join(process.cwd(), 'sw.js');
let html = fs.readFileSync(indexPath, 'utf8');
let sw = fs.readFileSync(swPath, 'utf8');

const marker = 'uap-latest-news-primary-v1';
const block = `
  // ${marker}: render the GitHub-generated feed first; live search is only a refresh fallback.
  (function() {
    function _latestTopicId(title) {
      return typeof topicId === 'function' ? topicId(title || '') : String(title || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
    }
    function _latestMapArticle(a, summaries) {
      var id = _latestTopicId(a.title || '');
      var sum = (summaries && (summaries[id] || summaries[a.id])) || a.summary || '';
      var title = (a.title || '').trim();
      if (sum.trim() === title || sum.trim().length < 50) sum = a.description || '';
      return {
        id: id,
        title: title,
        source: a.source || 'UAP News',
        date: a.date || new Date().toISOString().split('T')[0],
        summary: sum,
        url: a.link || a.url || '',
        isNew: false,
        isOfficial: /pentagon|aaro|nasa|congress|dod|senate|military|defense/i.test((a.source || '') + ' ' + title),
        _mentions: a.mentions || (a.otherSources ? a.otherSources.length + 1 : 1),
        quality: a.quality || 0,
        _quality: a.quality || 0,
        matchedTerms: a.matchedTerms || [],
        _matchedTerms: a.matchedTerms || [],
        _otherSources: (a.otherSources || []).map(function(s) {
          return { source: s.source || 'UAP News', url: s.link || s.url || '', title: s.title || '' };
        })
      };
    }
    window.__uapRenderLatestNewsFirst = async function() {
      try {
        var resp = await fetch('./latest-news.json?_=' + Date.now(), { cache: 'no-store' });
        if (!resp.ok) return [];
        var data = await resp.json();
        var articles = (data.articles || data.topics || []).map(function(a) { return _latestMapArticle(a, data.summaries || {}); }).filter(function(a) { return a.title; });
        if (!articles.length) return [];
        currentArticles = articles.slice(0, 12);
        renderArticles(currentArticles);
        if (data.timestamp) {
          lastScanTime = new Date(data.timestamp);
          var last = document.getElementById('last-scan');
          if (last && !isNaN(lastScanTime.getTime())) last.textContent = _fmtScanTime(lastScanTime);
        }
        saveFeedCache();
        return currentArticles;
      } catch(e) {
        return [];
      }
    };
  })();
`;

if (!html.includes(marker)) {
  const anchor = '  // Auto-load on start\n';
  if (!html.includes(anchor)) throw new Error('Auto-load anchor not found');
  html = html.replace(anchor, block + '\n' + anchor);
}

const oldNormal = `      setTimeout(function() {
        applyLatestNotification()
          .catch(function(){})
          .finally(function() {
            loadNews()
              .catch(function() {})
              .finally(function() {
                // The launch screen is controlled only by the 9-second hard stop above.
              });
          });
      }, 50);`;
const newNormal = `      setTimeout(function() {
        var renderedLatest = window.__uapRenderLatestNewsFirst ? window.__uapRenderLatestNewsFirst() : Promise.resolve([]);
        renderedLatest
          .catch(function(){ return []; })
          .then(function(items) {
            return applyLatestNotification()
              .catch(function(){})
              .then(function() {
                if (items && items.length) {
                  // Keep live search as a background refresh only when the generated feed is present.
                  loadNews().catch(function() {});
                  return;
                }
                return loadNews().catch(function() {});
              });
          })
          .finally(function() {
            // The launch screen is controlled only by the 9-second hard stop above.
          });
      }, 50);`;

if (html.includes(oldNormal)) {
  html = html.replace(oldNormal, newNormal);
} else if (!html.includes('window.__uapRenderLatestNewsFirst')) {
  throw new Error('Normal load block not found');
}

sw = sw.replace(/var CACHE = 'uap-[^']+';/, "var CACHE = 'uap-v14-latest-news-primary';");

if (!html.includes(marker) || !html.includes('__uapRenderLatestNewsFirst') || !sw.includes('uap-v14-latest-news-primary')) {
  throw new Error('Latest news primary validation failed');
}

fs.writeFileSync(indexPath, html);
fs.writeFileSync(swPath, sw);
console.log('Installed latest-news primary rendering.');
