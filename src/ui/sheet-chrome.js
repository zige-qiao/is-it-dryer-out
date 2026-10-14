// Native content scrolls behind pinned glass chrome; the visual scrollbar is optional.
export function createSheetChrome({ dialog } = {}, environment = globalThis) {
  const { document, window, requestAnimationFrame, cancelAnimationFrame } = environment;
  const header = dialog.querySelector('.sheet-header');
  const body = dialog.querySelector('.sheet-body');
  const footer = dialog.querySelector('.sheet-footer');
  let rail, thumb, frame = null, drag = null, metrics = null, bound = false;
  const forcedColours = window.matchMedia('(forced-colors: active)');
  const supported = () => environment.CSS?.supports('backdrop-filter', 'blur(4px)') ||
    environment.CSS?.supports('-webkit-backdrop-filter', 'blur(4px)');
  const replaceScrollbar = () => environment.CSS?.supports('scrollbar-width', 'none');
  const clamp = (value, max) => Math.max(0, Math.min(max, value));

  function cancelDrag() {
    const previous = drag;
    drag = null;
    if (previous && body.hasPointerCapture(previous.id)) body.releasePointerCapture(previous.id);
  }

  function cancel() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    cancelDrag();
  }

  function update() {
    if (!dialog.open || document.visibilityState === 'hidden') return;
    if (forcedColours.matches) {
      cancelDrag();
      dialog.classList.remove('has-frosted-header', 'has-sheet-scrollbar', 'has-header-overlap');
      if (rail) rail.hidden = true;
      metrics = null;
      return;
    }
    const headerBox = header.getBoundingClientRect();
    if (!(headerBox.height > 0)) return;
    const footerBox = footer?.getBoundingClientRect();
    const footerHeight = Math.max(0, footerBox?.height || 0);
    dialog.style.setProperty('--sheet-header-height', `${headerBox.height}px`);
    dialog.style.setProperty('--sheet-footer-height', `${footerHeight}px`);
    // Apply the overlap before measuring the real, final scroller geometry.
    dialog.classList.add('has-frosted-header');
    const shellBox = dialog.getBoundingClientRect(), bodyBox = body.getBoundingClientRect();
    // Leave the page glass continuous until real content crosses the header edge.
    // Ignore hidden/empty regions and decorative drag layers when finding that edge.
    const contentTop = [...body.children].reduce((top, child) => {
      if (child.getAttribute('aria-hidden') === 'true') return top;
      const box = child.getBoundingClientRect();
      return box.height > 1 ? Math.min(top, box.top) : top;
    }, Infinity);
    dialog.classList.toggle('has-header-overlap', contentTop < headerBox.bottom);
    const bottom = footerHeight ? Math.min(bodyBox.bottom, footerBox.top) : bodyBox.bottom;
    const visible = Math.max(0, bottom - headerBox.bottom);
    if (!rail) return;
    const range = Math.max(0, body.scrollHeight - body.clientHeight);
    const trackHeight = Math.max(0, visible - 8);
    const thumbHeight = Math.min(trackHeight, Math.max(24, trackHeight * visible / (visible + range)));
    const travel = Math.max(0, trackHeight - thumbHeight);
    const offset = range ? clamp(body.scrollTop, range) / range * travel : 0;
    metrics = { range, visible, travel, top: headerBox.bottom + 4, left: shellBox.right - dialog.clientLeft - 16,
      right: shellBox.right - dialog.clientLeft - 4, bottom: bottom - 4, thumbHeight, offset };
    dialog.classList.add('has-sheet-scrollbar');
    rail.hidden = range <= 1 || trackHeight <= 0;
    rail.style.top = `${headerBox.height + 4}px`;
    rail.style.height = `${trackHeight}px`;
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translateY(${offset}px)`;
  }

  function schedule() {
    if (frame !== null || !dialog.open) return;
    const pending = requestAnimationFrame(() => { if (frame !== pending) return; frame = null; update(); });
    frame = pending;
  }

  function bind() {
    if (bound || !header || !body || !supported() || !environment.ResizeObserver || !environment.MutationObserver) return;
    bound = true;
    if (replaceScrollbar()) {
      rail = document.createElement('div'); rail.className = 'sheet-scrollbar'; rail.hidden = true;
      rail.setAttribute('aria-hidden', 'true');
      thumb = document.createElement('span'); thumb.className = 'sheet-scrollbar-thumb'; rail.append(thumb);
      dialog.append(rail);
    }
    body.setAttribute('tabindex', '0'); body.setAttribute('role', 'region');
    body.setAttribute('aria-labelledby', dialog.getAttribute('aria-labelledby'));
    const resize = new environment.ResizeObserver(schedule);
    const content = new Set();
    function observeContent() {
      for (const node of content) if (!body.contains(node)) { resize.unobserve(node); content.delete(node); }
      for (const node of body.children) if (!content.has(node)) { resize.observe(node); content.add(node); }
    }
    for (const node of [dialog, header, body, footer].filter(Boolean)) resize.observe(node);
    observeContent();
    new environment.MutationObserver(() => { observeContent(); schedule(); }).observe(body,
      { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'class', 'style'] });
    new environment.MutationObserver(() => { if (dialog.open) schedule(); else cancel(); }).observe(dialog,
      { attributes: true, attributeFilter: ['open'] });
    body.addEventListener('scroll', schedule, { passive: true });
    body.addEventListener('pointerdown', event => {
      if (!rail || event.pointerType !== 'mouse' || event.button !== 0 || rail.hidden || !metrics ||
          event.clientX < metrics.left || event.clientX > metrics.right ||
          event.clientY < metrics.top || event.clientY > metrics.bottom ||
          event.target.closest('button, input, select, textarea, a, summary')) return;
      const thumbTop = metrics.top + metrics.offset;
      event.preventDefault(); body.focus({ preventScroll: true });
      if (event.clientY < thumbTop || event.clientY > thumbTop + metrics.thumbHeight) {
        body.scrollTop = clamp(body.scrollTop + (event.clientY < thumbTop ? -metrics.visible : metrics.visible), metrics.range);
        schedule(); return;
      }
      drag = { id: event.pointerId, y: event.clientY, scroll: body.scrollTop };
      body.setPointerCapture(event.pointerId);
    });
    body.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId || !metrics) return;
      body.scrollTop = clamp(drag.scroll + (metrics.travel ? (event.clientY - drag.y) * metrics.range / metrics.travel : 0), metrics.range);
      schedule();
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) body.addEventListener(name, cancelDrag);
    dialog.addEventListener('close', () => {
      cancel(); dialog.classList.remove('has-header-overlap');
      if (rail) rail.hidden = true; metrics = null;
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') cancel(); else schedule(); });
    window.addEventListener('pagehide', cancel);
    window.addEventListener('resize', () => { cancelDrag(); schedule(); });
    forcedColours.addEventListener('change', () => { cancel(); schedule(); });
    update();
  }

  return { bind };
}
