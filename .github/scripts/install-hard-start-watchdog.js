const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'index.html');
const swPath = path.join(process.cwd(), 'sw.js');
let html = fs.readFileSync(indexPath, 'utf8');
let sw = fs.readFileSync(swPath, 'utf8');

const marker = 'uap-startup-watchdog-v1';
const watchdog = `
  // ${marker}: hard fallback independent of window load and live search.
  (function() {
    var startedAt = Date.now();
    function forceOpenApp() {
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

// Keep the normal startup logic strict as well.
html = html.replace(/var _startupMinMs = \d+;/, 'var _startupMinMs = 9000;');
html = html.replace(/\.finally\(function\(\) \{\s*\/\/ If the scan finishes earlier, still keep the intended 9-second intro\.\s*setTimeout\(_hideStartOverlayOnce, 0\);\s*\}\);/s, `.finally(function() {
                // The launch screen is controlled by the 9-second timers only.
              });`);
html = html.replace(/\.finally\(function\(\) \{ _hideStartOverlayOnce\(\); \}\);/g, `.finally(function() {
                // The launch screen is controlled by the 9-second timers only.
              });`);

// Make hideOverlay cooperate with the watchdog when present.
html = html.replace(/function _hideStartOverlayOnce\(\) \{\n\s*if \(_overlayHidden\) return;\n\s*_overlayHidden = true;\n\s*hideOverlay\(\);\n\s*\}/, `function _hideStartOverlayOnce() {
        if (_overlayHidden) return;
        _overlayHidden = true;
        hideOverlay();
      }`);

if (!html.includes(marker) || !html.includes('window.__uapStartupWatchdogDone')) {
  throw new Error('Watchdog validation failed');
}

sw = sw.replace(/var CACHE = 'uap-[^']+';/, "var CACHE = 'uap-v11-start-watchdog';");
if (!sw.includes('uap-v11-start-watchdog')) throw new Error('SW cache validation failed');

fs.writeFileSync(indexPath, html);
fs.writeFileSync(swPath, sw);
console.log('Installed hard startup watchdog.');
