(function(){
  'use strict';
  if (window.__uapOpenGuardFix) return;
  window.__uapOpenGuardFix = true;

  var touchStart = null;
  var lastTouchToggle = 0;

  function closest(target, selector){
    return target && target.closest ? target.closest(selector) : null;
  }
  function interactiveTarget(target){
    return closest(target, 'a,input,select,textarea,button:not(.article-main),.badge.quality,.translate-btn,#notify-btn,.quality-overlay,.notify-guide-overlay,.source-list');
  }
  function articleCard(target){
    return closest(target, '.article-card');
  }
  function setOpen(card, open){
    if (!card) return;
    card.classList.toggle('uap-detail-open', !!open);
    card.classList.toggle('open', !!open);
    var main = card.querySelector('.article-main');
    if (main) main.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function toggle(card){
    setOpen(card, !card.classList.contains('uap-detail-open'));
  }
  function handleClick(event){
    if (event.defaultPrevented) return;
    if (Date.now() - lastTouchToggle < 450) return;
    if (interactiveTarget(event.target)) return;
    var card = articleCard(event.target);
    if (!card) return;
    event.preventDefault();
    toggle(card);
  }
  function handleTouchStart(event){
    if (!event.touches || event.touches.length !== 1) {
      touchStart = null;
      return;
    }
    var touch = event.touches[0];
    touchStart = { x: touch.clientX, y: touch.clientY, target: event.target, moved: false };
  }
  function handleTouchMove(event){
    if (!touchStart || !event.touches || event.touches.length !== 1) return;
    var touch = event.touches[0];
    if (Math.abs(touch.clientX - touchStart.x) > 12 || Math.abs(touch.clientY - touchStart.y) > 12) {
      touchStart.moved = true;
    }
  }
  function handleTouchEnd(event){
    if (!touchStart || touchStart.moved || event.defaultPrevented) {
      touchStart = null;
      return;
    }
    if (interactiveTarget(touchStart.target)) {
      touchStart = null;
      return;
    }
    var card = articleCard(touchStart.target);
    touchStart = null;
    if (!card) return;
    event.preventDefault();
    lastTouchToggle = Date.now();
    toggle(card);
  }

  document.addEventListener('click', handleClick, true);
  document.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true });
  document.addEventListener('touchmove', handleTouchMove, { capture: true, passive: true });
  document.addEventListener('touchend', handleTouchEnd, { capture: true, passive: false });
})();
