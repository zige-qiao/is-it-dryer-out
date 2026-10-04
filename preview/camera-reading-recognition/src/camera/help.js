export function createCameraHelp({ button, content, dialog }, document) {
  let pinned = false, open = false;
  function show(value) { open = value; content.hidden = !value; button.setAttribute('aria-expanded', String(value)); }
  function close() { pinned = false; show(false); }
  function initialize() {
    button.addEventListener('pointerenter', () => show(true));
    button.addEventListener('pointerleave', () => { if (!pinned && document.activeElement !== button) show(false); });
    button.addEventListener('focus', () => show(true));
    button.addEventListener('blur', () => { if (!pinned) show(false); });
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
