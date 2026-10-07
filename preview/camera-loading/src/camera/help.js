export function createCameraHelp({ button, content, dialog }, document) {
  let pinned = false, open = false;
  function show(value) { open = value; content.hidden = !value; button.setAttribute('aria-expanded', String(value)); }
  function close() { pinned = false; show(false); }
  function initialize(listen = (target, ...args) => target.addEventListener(...args)) {
    listen(button, 'pointerenter', () => show(true));
    listen(button, 'pointerleave', event => { if (!pinned && document.activeElement !== button && !content.contains?.(event.relatedTarget)) show(false); });
    listen(content, 'pointerleave', event => { if (!pinned && !content.contains?.(document.activeElement) && event.relatedTarget !== button) show(false); });
    listen(content, 'focusin', () => show(true));
    listen(content, 'focusout', event => { if (!pinned && event.relatedTarget !== button && !content.contains?.(event.relatedTarget)) show(false); });
    listen(button, 'focus', () => show(true));
    listen(button, 'blur', event => { if (!pinned && !content.contains?.(event.relatedTarget)) show(false); });
    listen(button, 'click', () => { pinned = !pinned; show(pinned); });
    listen(dialog, 'pointerdown', event => {
      if (event.target !== button && !button.contains?.(event.target) && !content.contains?.(event.target)) close();
    }, true);
    listen(dialog, 'keydown', event => {
      if (event.key === 'Escape' && open) { event.preventDefault(); event.stopImmediatePropagation(); close(); }
    }, true);
    listen(dialog, 'cancel', event => { if (open) { event.preventDefault(); close(); } });
    listen(dialog, 'close', close);
    close();
  }
  return { initialize, close };
}
