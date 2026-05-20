(function(){
  'use strict';
  if (window.__uapOpenGuardFix) return;
  window.__uapOpenGuardFix = true;

  var STYLE_ID = 'uap-open-guard-style';
  var touchStart = null;
  var lastTouchToggle = 0;
  var lastPointerToggle = 0;

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
  function stopCardEvent(event){
    event.preventDefault();
    event.__uapCardToggleHandled = true;
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    else event.stopPropagation();
  }
  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.article-main{touch-action:manipulation!important}',
      '.details{content-visibility:auto!important;contain:layout paint!important}',
      '.uap-detail-summary{contain:layout paint!important}'
    ].join('');
    (document.head || document.documentElement).appendChild(style);
  }
  function cardFromEvent(event){
    if (event.__uapCardToggleHandled) return null;
    if (interactiveTarget(event.target)) return null;
    return articleCard(event.target);
  }
  function handlePointerDown(event){
    if (event.button != null && event.button !== 0) return;
    if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    var card = cardFromEvent(event);
    if (!card) return;
    stopCardEvent(event);
    lastPointerToggle = Date.now();
    toggle(card);
  }
  function handleMouseDown(event){
    if (window.PointerEvent) return;
    if (event.button != null && event.button !== 0) return;
    var card = cardFromEvent(event);
    if (!card) return;
    stopCardEvent(event);
    lastPointerToggle = Date.now();
    toggle(card);
  }
  function handleClick(event){
    var card = cardFromEvent(event);
    if (!card) return;

    stopCardEvent(event);
    if (Date.now() - lastPointerToggle < 650) return;
    if (Date.now() - lastTouchToggle < 450) return;
    toggle(card);
  }
  function handleTouchStart(event){
    if (!event.touches || event.touches.length !== 1) {
      touchStart = null;
      return;
    }
    if (interactiveTarget(event.target)) {
      touchStart = null;
      return;
    }
    var card = articleCard(event.target);
    if (!card) {
      touchStart = null;
      return;
    }
    var touch = event.touches[0];
    touchStart = { x: touch.clientX, y: touch.clientY, target: event.target, card: card, moved: false };
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
    var card = touchStart.card || articleCard(touchStart.target);
    touchStart = null;
    if (!card) return;
    stopCardEvent(event);
    lastTouchToggle = Date.now();
    toggle(card);
  }
  function handleKeyDown(event){
    if (event.key !== 'Enter' && event.key !== ' ') return;
    var main = closest(event.target, '.article-main');
    if (!main || interactiveTarget(event.target)) return;
    var card = articleCard(main);
    if (!card) return;
    stopCardEvent(event);
    toggle(card);
  }

  injectStyle();
  window.addEventListener('pointerdown', handlePointerDown, true);
  window.addEventListener('mousedown', handleMouseDown, true);
  window.addEventListener('click', handleClick, true);
  window.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true });
  window.addEventListener('touchmove', handleTouchMove, { capture: true, passive: true });
  window.addEventListener('touchend', handleTouchEnd, { capture: true, passive: false });
  window.addEventListener('keydown', handleKeyDown, true);
})();
