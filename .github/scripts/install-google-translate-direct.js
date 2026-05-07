const fs = require('fs');

const indexFile = 'index.html';
const swFile = 'sw.js';

let index = fs.readFileSync(indexFile, 'utf8');
let sw = fs.readFileSync(swFile, 'utf8');
const beforeIndex = index;
const beforeSw = sw;

const replacementMatch = sw.match(/var replacement = `([\s\S]*?)`;\n\n  html = html\.slice\(0, start\)/);
if (!replacementMatch) throw new Error('Google translation replacement not found in sw.js');
const replacement = replacementMatch[1];

const indexStart = index.indexOf('  async function translateText(text, combined) {');
const indexEnd = index.indexOf('\n\n  async function translateSummary(aid) {', indexStart);
if (indexStart < 0 || indexEnd < 0) throw new Error('translateText block not found in index.html');
index = index.slice(0, indexStart) + replacement + index.slice(indexEnd);
index = index.replace("btn.innerHTML = '&#10227; ...';", "btn.innerHTML = '&#10227; Übersetze...';");
index = index.replace("btn.disabled = true; btn.innerHTML = '&#10227; ...';", "btn.disabled = true; btn.innerHTML = '&#10227; Übersetze...';");
index = index.replace(/setTimeout\(\(\) => \{ btn\.innerHTML = '&#127760; Übersetzen'; btn\.disabled = false; \}, 4000\);/g, "setTimeout(() => { btn.innerHTML = '&#127760; Übersetzen'; btn.disabled = false; }, 1500);");
index = index.replace(/setTimeout\(function\(\)\{ btn\.innerHTML = '&#127760; &#220;bersetzen'; btn\.disabled = false; \}, 4000\);/g, "setTimeout(function(){ btn.innerHTML = '&#127760; &#220;bersetzen'; btn.disabled = false; }, 1500);");
fs.writeFileSync(indexFile, index);

const patchStart = sw.indexOf('\nfunction patchHtml(html) {');
const patchEnd = sw.indexOf('\n\nself.addEventListener(\'fetch\'', patchStart);
if (patchStart >= 0 && patchEnd > patchStart) {
  sw = sw.slice(0, patchStart) + sw.slice(patchEnd);
}
sw = sw.replace("var CACHE = 'uap-v8-google-translate';", "var CACHE = 'uap-v9-direct-google-translate';");
sw = sw.replace(/\/\/ Navigation requests \(HTML\): always bypass cache - get fresh from network and patch app hotfixes[\s\S]*?\n  \}\n  \/\/ All other resources:/, "// Navigation requests (HTML): always bypass cache - get fresh from network\n  if (e.request.mode === 'navigate') {\n    e.respondWith(\n      fetch(e.request, { cache: 'no-cache' }).catch(function() {\n        return caches.match('./') || new Response('Offline', { status: 503 });\n      })\n    );\n    return;\n  }\n  // All other resources:");
fs.writeFileSync(swFile, sw);

if (!index.includes('translate.googleapis.com')) throw new Error('index.html does not contain Google Translate endpoint');
if (!index.includes('googleTranslate')) throw new Error('index.html does not contain googleTranslate');
if (sw.includes('function patchHtml(html)')) throw new Error('sw.js still contains patchHtml');

console.log(beforeIndex === index && beforeSw === sw ? 'already installed' : 'installed direct Google Translate');
