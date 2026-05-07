const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'index.html');
const swPath = path.join(process.cwd(), 'sw.js');
let html = fs.readFileSync(indexPath, 'utf8');
let sw = fs.readFileSync(swPath, 'utf8');

const marker = 'uap-startup-watchdog-v2';
const oldMarker = 'uap-startup-watchdog-v1';

// Remove older watchdog if present so the current version is the single source of truth.
html = html.replace(/\n  \/\/ uap-startup-watchdog-v1:[\s\S]*?\n  \}\)\(\);\n\n  \/\/ Auto-load on start\n/, '\n  // Auto-load on start\n');

const watchdog = `
  // ${marker}: hard fallback independent of window load and live search.
  (function() {
    var startedAt = Date.now();
    var opened = false;
    function forceOpenApp() {
      if (opened) return;
      opened = true;
      var loading = document.getElementById('loading');
      if (loading) {
        loading.style.opacity = '0';
        loading.style.pointerEvents = 'none';
        setTimeout(function() { loading.style.display = 'none'; }, 300);
      }
      if (document.body) document.body.classList.remove('no-scroll');
      window.__uapStartupWatchdogDone = true;
    }
    function arm() {
      var elapsed = Date.now() - startedAt;
      setTimeout(forceOpenApp, Math.max(0, 9000 - elapsed));
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', arm, { once: true });
      setTimeout(arm, 1000);
    } else {
      arm();
    }
  })();
`;

if (!html.includes(marker)) {
  const anchor = '  // Auto-load on start\n';
  if (!html.includes(anchor)) throw new Error('Auto-load anchor not found');
  html = html.replace(anchor, watchdog + '\n' + anchor);
}

html = html.replace(/var _startupMinMs = \d+;/, 'var _startupMinMs = 9000;');
html = html.replace("    document.body.classList.add('no-scroll'); // overlay visible via CSS display:flex", "    if (!window.__uapStartupWatchdogDone) document.body.classList.add('no-scroll'); // overlay visible via CSS display:flex");
html = html.replace(/\.finally\(function\(\) \{\s*\/\/ If the scan finishes earlier, still keep the intended 9-second intro\.\s*setTimeout\(_hideStartOverlayOnce, 0\);\s*\}\);/s, `.finally(function() {
                // The launch screen is controlled by the 9-second timers only.
              });`);
html = html.replace(/\.finally\(function\(\) \{ _hideStartOverlayOnce\(\); \}\);/g, `.finally(function() {
                // The launch screen is controlled by the 9-second timers only.
              });`);

if (!html.includes(marker) || html.includes(oldMarker) || !html.includes('if (!window.__uapStartupWatchdogDone) document.body.classList.add')) {
  throw new Error('Watchdog validation failed');
}

sw = sw.replace(/var CACHE = 'uap-[^']+';/, "var CACHE = 'uap-v12-hard-start-watchdog';");
if (!sw.includes('uap-v12-hard-start-watchdog')) throw new Error('SW cache validation failed');

fs.writeFileSync(indexPath, html);
fs.writeFileSync(swPath, sw);
console.log('Installed hardened startup watchdog.');
