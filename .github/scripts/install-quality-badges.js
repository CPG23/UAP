// Temporary installer for article quality signals.
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

if (!html.includes('.quality-badge')) {
  patch(/(  \.badge-official \{[\s\S]*?\n  \}\n\n)/, `$1  .quality-badge {
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

`, 'quality CSS after official badge');
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
  patch(/(  function _makeArticleCard\(article, (?:index|idx)\) \{)/, helpers + '$1', 'quality helper functions');
}

if (!html.includes('const _quality = _qualityInfo(article);')) {
  if (!patch(/(\s*const _hiddenSourceCount = Math\.max\(0, \(article\._mentions \|\| 1\) - _visibleSourceCount\);\n)/, `$1    const _quality = _qualityInfo(article);
    const _terms = _normaliseTerms(article);
`, 'quality variables after hidden source count')) {
    patch(/(\s*const _aid = article\.id;\n)/, `$1    const _quality = _qualityInfo(article);
    const _terms = _normaliseTerms(article);
`, 'quality variables after article id');
  }
}

if (!html.includes('_terms.map(function(t)')) {
  const badgeHtml = `        \${article.quality || article._quality ? '<span class="badge ' + _quality.cls + '">' + _quality.label + '</span>' : ''}
        \${_terms.map(function(t) { return '<span class="term-chip">' + escHtml(String(t)).toUpperCase() + '</span>'; }).join('')}
`;
  if (!patch(/(\s*\$\{\(article\._mentions \|\| 1\) > 1 \? '<span class="badge badge-official">' \+ \(article\._mentions \|\| 1\) \+ ' QUELLEN<\/span>' : ''\}\n)/, `$1${badgeHtml}`, 'quality badges after source count')) {
    if (!patch(/(\s*\$\{article\._otherSources && article\._otherSources\.length \? `[\s\S]*?\+Quellen[\s\S]*?` : ''\}\n)/, `$1${badgeHtml}`, 'quality badges after multi-source badge')) {
      patch(/(\s*<span class="badge badge-source">[\s\S]*?<\/span>\n)/, `$1${badgeHtml}`, 'quality badges after source badge');
    }
  }
}

if (!html.includes('_matchedTerms: a.matchedTerms || []')) {
  patch(/(_mentions: a\.mentions \|\| 1,\n)/g, `$1              quality: a.quality || 0,
              _quality: a.quality || 0,
              matchedTerms: a.matchedTerms || [],
              _matchedTerms: a.matchedTerms || [],
`, 'latest-news quality fields');
}

const required = ['.quality-badge', 'function _qualityInfo(article)', '_terms.map(function(t)', '_matchedTerms: a.matchedTerms || []'];
const missing = required.filter(s => !html.includes(s));
if (missing.length) throw new Error('Quality badge install incomplete: ' + missing.join(', '));

if (changed) {
  fs.writeFileSync(path, html, 'utf8');
  console.log('index.html updated');
} else {
  console.log('index.html already up to date');
}
