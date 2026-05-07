const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'index.html');
const swPath = path.join(process.cwd(), 'sw.js');
let html = fs.readFileSync(indexPath, 'utf8');
let sw = fs.readFileSync(swPath, 'utf8');

const currentFastBlock = `    } else {
      // Normal load: show cached feed immediately; refresh live news in the background.
      var _overlayHidden = false;
      function _hideStartOverlayOnce() {
        if (_overlayHidden) return;
        _overlayHidden = true;
        hideOverlay();
      }
      var _hasInitialFeed = initialArts.length > 0;
      if (_hasInitialFeed) {
        setTimeout(_hideStartOverlayOnce, 250);
      } else {
        setTimeout(_hideStartOverlayOnce, 2200);
      }
      setTimeout(function() {
        applyLatestNotification()
          .catch(function(){})
          .finally(function() {
            loadNews()
              .catch(function() {})
              .finally(function() { _hideStartOverlayOnce(); });
          });
      }, 50);
    }`;

const olderBlock = `    } else {
      // Normal load: sync notification state then fetch live RSS
      setTimeout(function() {
        applyLatestNotification()
          .catch(function(){})
          .finally(function() {
            loadNews()
              .catch(function() {})
              .finally(function() { hideOverlay(); });
          });
      }, 300);
    }`;

const nineSecondBlock = `    } else {
      // Normal load: keep the launch screen visible for 9 seconds, then show whatever is ready.
      var _startupMinMs = 9000;
      var _overlayHidden = false;
      function _hideStartOverlayOnce() {
        if (_overlayHidden) return;
        _overlayHidden = true;
        hideOverlay();
      }

      // Hard stop for the launch screen. Search and summaries may continue in the background.
      setTimeout(_hideStartOverlayOnce, _startupMinMs);

      setTimeout(function() {
        applyLatestNotification()
          .catch(function(){})
          .finally(function() {
            loadNews()
              .catch(function() {})
              .finally(function() {
                // If the scan finishes earlier, still keep the intended 9-second intro.
                setTimeout(_hideStartOverlayOnce, 0);
              });
          });
      }, 50);
    }`;

if (html.includes(currentFastBlock)) {
  html = html.replace(currentFastBlock, nineSecondBlock);
} else if (html.includes(olderBlock)) {
  html = html.replace(olderBlock, nineSecondBlock);
} else if (!html.includes('Normal load: keep the launch screen visible for 9 seconds')) {
  throw new Error('Expected normal startup block not found');
}

// Add a normal browser cache hint for the HTML shell.
if (!html.includes('http-equiv="Cache-Control"')) {
  html = html.replace('<meta name="viewport" content="width=device-width, initial-scale=1.0">', '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">');
}

sw = sw.replace(/var CACHE = 'uap-[^']+';/, "var CACHE = 'uap-v10-nine-second-start';");

if (!html.includes('_startupMinMs = 9000') || !html.includes('Normal load: keep the launch screen visible for 9 seconds')) {
  throw new Error('Nine-second start patch validation failed');
}
if (!sw.includes('uap-v10-nine-second-start')) {
  throw new Error('Service worker cache version validation failed');
}

fs.writeFileSync(indexPath, html);
fs.writeFileSync(swPath, sw);
console.log('Installed nine-second startup behavior.');
