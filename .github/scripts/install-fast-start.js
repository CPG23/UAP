const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'index.html');
let html = fs.readFileSync(file, 'utf8');

const oldBlock = `    } else {
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

const newBlock = `    } else {
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

if (!html.includes(oldBlock)) {
  throw new Error('Expected startup loading block not found');
}

html = html.replace(oldBlock, newBlock);

if (!html.includes('show cached feed immediately') || !html.includes('_hideStartOverlayOnce')) {
  throw new Error('Fast start patch validation failed');
}

fs.writeFileSync(file, html);
console.log('Installed fast app start patch.');
