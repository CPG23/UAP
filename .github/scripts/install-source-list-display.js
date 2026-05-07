// Temporary installer for clearer source counts and source lists.
const fs = require('fs');
const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');
let changed = false;

function patch(pattern, replacement, label) {
  const before = html;
  html = html.replace(pattern, replacement);
  if (html !== before) {
    changed = true;
    console.log('patched:', label);
    return true;
  }
  console.log('missed:', label);
  return false;
}

if (!html.includes('.source-list')) {
  patch(/(  \.other-sources span\.src-nolink \{[\s\S]*?\n  \}\n\n)/, `$1  .source-list {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .source-item {
    display: grid;
    grid-template-columns: 22px 1fr;
    gap: 8px;
    align-items: start;
  }

  .source-index {
    color: var(--accent2);
    opacity: 0.75;
  }

  .source-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .source-name {
    width: max-content;
    max-width: 100%;
  }

  .source-title {
    color: #8aa8b8;
    opacity: 0.85;
    line-height: 1.45;
    letter-spacing: 0.4px;
  }

`, 'source list CSS');
}

if (!html.includes('const _sourceCount = 1 + ((article._otherSources')) {
  if (!patch(/(\s*const _terms = _normaliseTerms\(article\);\n)/, `$1    const _sourceCount = 1 + ((article._otherSources && article._otherSources.length) || 0);
`, 'source count after terms')) {
    patch(/(\s*const _aid = article\.id;\n)/, `    const _sourceCount = 1 + ((article._otherSources && article._otherSources.length) || 0);
$1`, 'source count before article id');
  }
}

patch(/\$\{article\._otherSources && article\._otherSources\.length \? `<span class="badge multi-src-badge"[^`]*>\+Quellen<\/span>` : ''\}/, "${_sourceCount > 1 ? `<span class=\"badge multi-src-badge\" style=\"border-color:var(--accent2);color:var(--accent2);background:rgba(0,255,157,0.06)\">${_sourceCount} QUELLEN</span>` : ''}", 'source count badge');

if (!html.includes("label.textContent = 'QUELLEN (' + uniqueSources.length + ')';")) {
  patch(/    if \(article\._otherSources && article\._otherSources\.length\) \{[\s\S]*?\n    \}\n    return card;/, `    var allSources = [{ source: article.source || 'UAP News', url: article.url || '', title: article.title || '' }]
      .concat(article._otherSources || []);
    var seenSources = {};
    var uniqueSources = allSources.filter(function(s) {
      var key = String((s.source || '') + '|' + (s.url || '')).toLowerCase();
      if (seenSources[key]) return false;
      seenSources[key] = true;
      return true;
    });
    if (uniqueSources.length > 1) {
      const summaryRow = card.querySelector('.summary-row');
      const div = document.createElement('div');
      div.className = 'other-sources source-list';
      const label = document.createElement('div');
      label.className = 'section-label';
      label.textContent = 'QUELLEN (' + uniqueSources.length + ')';
      div.appendChild(label);
      uniqueSources.forEach(function(s, si) {
        const row = document.createElement('div');
        row.className = 'source-item';
        const num = document.createElement('span');
        num.className = 'source-index';
        num.textContent = String(si + 1).padStart(2, '0');
        const main = document.createElement('div');
        main.className = 'source-main';
        if (s.url) {
          const a = document.createElement('a');
          a.href = s.url; a.target = '_blank'; a.rel = 'noopener';
          a.className = 'source-name';
          a.textContent = s.source || 'UAP News';
          main.appendChild(a);
        } else {
          const sp = document.createElement('span');
          sp.className = 'src-nolink source-name';
          sp.textContent = s.source || 'UAP News';
          main.appendChild(sp);
        }
        if (s.title && s.title !== article.title) {
          const title = document.createElement('span');
          title.className = 'source-title';
          title.textContent = s.title;
          main.appendChild(title);
        }
        row.appendChild(num);
        row.appendChild(main);
        div.appendChild(row);
      });
      if (summaryRow) summaryRow.after(div);
    }
    return card;`, 'replace compact source list');
}

patch(/return \{ source: o\.source, url: o\.url \|\| o\.link \|\| '', link: o\.link \|\| o\.url \|\| '' \};/g, "return { source: o.source, url: o.url || o.link || '', link: o.link || o.url || '', title: o.title || '' };", 'cluster source titles');
patch(/return \{ source: s\.source \|\| 'UAP News', url: s\.link \|\| s\.url \|\| '' \};/g, "return { source: s.source || 'UAP News', url: s.link || s.url || '', title: s.title || '' };", 'latest-news source titles');

const required = [
  '.source-list',
  'const _sourceCount = 1 + ((article._otherSources',
  '${_sourceCount > 1 ?',
  "label.textContent = 'QUELLEN (' + uniqueSources.length + ')';",
  "title: s.title || ''"
];
const missing = required.filter(s => !html.includes(s));
if (missing.length) throw new Error('Source list install incomplete: ' + missing.join(', '));

if (changed) {
  fs.writeFileSync(path, html, 'utf8');
  console.log('index.html updated');
} else {
  console.log('index.html already up to date');
}
