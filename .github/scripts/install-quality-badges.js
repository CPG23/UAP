const fs = require('fs');
const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');
let changed = false;

function replaceOnce(pattern, replacement, label) {
  const before = html;
  html = html.replace(pattern, replacement);
  if (html !== before) {
    changed = true;
    console.log('patched:', label);
  } else {
    console.log('skipped or missing:', label);
  }
}

if (!html.includes('.quality-badge')) {
  replaceOnce(/(  \.badge-official \{[\s\S]*?\n  \}\n\n)/, `$1  .quality-badge {
    border-color: rgba(0,255,157,0.38);
    color: var(--accent2);
    background: rgba(0,255,157,0.06);
  }

  .quality-medium {
    border-color: rgba(0,212,255,0.34);
    color: var(--accent);
    background: rgba(0,212,255,0.05);
  }

  .quality-low {
    border-color: rgba(255,107,53,0.36);
    color: var(--accent3);
    background: rgba(255,107,53,0.06);
  }

  .term-chip {
    font-family: 'Share Tech Mono', monospace;
    font-size: 9px;
    letter-spacing: 1.6px;
    padding: 2px 7px;
    border: 1px solid rgba(90,122,138,0.45);
    color: #8aa8b8;
    background: rgba(90,122,138,0.06);
    text-transform: uppercase;
  }

`, 'quality CSS');
}

if (!html.includes('function _qualityInfo(article)')) {
  const helpers = `
  function _qualityInfo(article) {
    var q = Number(article.quality || article._quality || 0);
    if (q >= 5) return { label: 'QUALITAET HOCH', cls: 'quality-badge' };
    if (q >= 3) return { label: 'QUALITAET MITTEL', cls: 'quality-badge quality-medium' };
    return { label: 'QUALITAET NIEDRIG', cls: 'quality-badge quality-low' };
  }

  function _normaliseTerms(article) {
    var terms = article.matchedTerms || article._matchedTerms || [];
    if (!Array.isArray(terms)) return [];
    return terms.filter(Boolean).slice(0, 5);
  }

`;
  replaceOnce(/(  function _makeArticleCard\(article, index\) \{)/, helpers + '$1', 'quality helpers');
}

if (!html.includes('const _quality = _qualityInfo(article);')) {
  replaceOnce(/(\s*const _hiddenSourceCount = Math\.max\(0, \(article\._mentions \|\| 1\) - _visibleSourceCount\);\n)/, `$1    const _quality = _qualityInfo(article);
    const _terms = _normaliseTerms(article);
`, 'card quality variables');
}

if (!html.includes('_terms.map(function(t)')) {
  replaceOnce(/(\s*\$\{\(article\._mentions \|\| 1\) > 1 \? '<span class="badge badge-official">' \+ \(article\._mentions \|\| 1\) \+ ' QUELLEN<\/span>' : ''\}\n)/, `$1        \${article.quality || article._quality ? '<span class="badge ' + _quality.cls + '">' + _quality.label + '</span>' : ''}
        \${_terms.map(function(t) { return '<span class="term-chip">' + escHtml(String(t)).toUpperCase() + '</span>'; }).join('')}
`, 'card quality badges');
}

if (!html.includes('_matchedTerms: a.matchedTerms || []')) {
  replaceOnce(/(_mentions: a\.mentions \|\| 1,\n)/g, `$1              quality: a.quality || 0,
              _quality: a.quality || 0,
              matchedTerms: a.matchedTerms || [],
              _matchedTerms: a.matchedTerms || [],
`, 'latest-news quality fields');
}

if (!html.includes('.quality-badge') || !html.includes('function _qualityInfo(article)') || !html.includes('_terms.map(function(t)') || !html.includes('_matchedTerms: a.matchedTerms || []')) {
  throw new Error('Quality badge install incomplete');
}

if (changed) {
  fs.writeFileSync(path, html, 'utf8');
  console.log('index.html updated');
} else {
  console.log('index.html already up to date');
}
