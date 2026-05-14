(function(){
  'use strict';

  function normalizeNotificationOpen(){
    try {
      var url = new URL(window.location.href);
      if (url.searchParams.has('notif') || url.searchParams.has('ids')) {
        url.searchParams.delete('notif');
        url.searchParams.delete('ids');
        window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : '') + url.hash);
      }
    } catch (err) {}
  }

  function showNormalFeed(){
    document.querySelectorAll('.notification-focus').forEach(function(el){ el.remove(); });
    document.querySelectorAll('.uap-hidden-by-notification').forEach(function(card){
      card.classList.remove('uap-hidden-by-notification');
    });
  }

  function apply(){
    normalizeNotificationOpen();
    showNormalFeed();
  }

  function start(){
    apply();
    new MutationObserver(function(){ setTimeout(apply, 0); }).observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
