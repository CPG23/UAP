(function(){
  'use strict';

  var STYLE_ID = 'uap-manual-scan-style';
  var WORKFLOW_URL = 'https://github.com/CPG23/UAP/actions/workflows/daily-scan.yml';

  function injectStyle(){
    var style = document.getElementById(STYLE_ID);
    var css = [
      '.manual-scan-btn{min-width:46px!important;padding:0 8px!important;font-size:10px!important;letter-spacing:1.2px!important}',
      '.manual-scan-btn:focus-visible{outline:2px solid rgba(0,255,157,.85)!important;outline-offset:2px!important}'
    ].join('\n');
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
  }

  function showScanInfo(){
    var notice = document.getElementById('notice');
    if (!notice || !notice.parentNode) return;
    var box = document.querySelector('.manual-scan-info');
    if (!box) {
      box = document.createElement('div');
      box.className = 'notify-info manual-scan-info';
      notice.parentNode.insertBefore(box, notice);
    }
    box.textContent = 'GitHub Actions wird geöffnet. Dort mit deinem GitHub-Konto auf Run workflow tippen, um den Scan sofort zu starten.';
    clearTimeout(showScanInfo.timer);
    showScanInfo.timer = setTimeout(function(){ if (box.parentNode) box.remove(); }, 9000);
  }

  function addButton(){
    var row = document.querySelector('.button-row');
    if (!row || document.getElementById('manual-scan-btn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'manual-scan-btn';
    btn.className = 'icon-btn manual-scan-btn';
    btn.textContent = 'SCAN';
    btn.title = 'GitHub-Scan manuell starten';
    btn.setAttribute('aria-label', 'GitHub-Scan manuell starten');
    btn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      showScanInfo();
      window.open(WORKFLOW_URL, '_blank', 'noopener,noreferrer');
    }, true);
    row.insertBefore(btn, row.firstChild);
  }

  function apply(){
    injectStyle();
    addButton();
  }

  function start(){
    apply();
    new MutationObserver(function(){ setTimeout(apply, 0); }).observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
