export function createCameraHelp({ button, content, dialog }, document) {
  let pinned = false, open = false;
  function show(value) { open = value; content.hidden = !value; button.setAttribute('aria-expanded', String(value)); }
  function close() { pinned = false; show(false); }
  function initialize() {
    button.addEventListener('pointerenter', () => show(true));
    button.addEventListener('pointerleave', event => { if (!pinned && document.activeElement !== button && !content.contains?.(event.relatedTarget)) show(false); });
    content.addEventListener('pointerleave', event => { if (!pinned && !content.contains?.(document.activeElement) && event.relatedTarget !== button) show(false); });
    content.addEventListener('focusin', () => show(true));
    content.addEventListener('focusout', event => { if (!pinned && event.relatedTarget !== button && !content.contains?.(event.relatedTarget)) show(false); });
    button.addEventListener('focus', () => show(true));
    button.addEventListener('blur', event => { if (!pinned && !content.contains?.(event.relatedTarget)) show(false); });
    button.addEventListener('click', () => { pinned = !pinned; show(pinned); });
    dialog.addEventListener('pointerdown', event => {
      if (event.target !== button && !button.contains?.(event.target) && !content.contains?.(event.target)) close();
    }, true);
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape' && open) { event.preventDefault(); event.stopImmediatePropagation(); close(); }
    }, true);
    dialog.addEventListener('cancel', event => { if (open) { event.preventDefault(); close(); } });
    dialog.addEventListener('close', close);
    close();
  }
  return { initialize, close };
}
