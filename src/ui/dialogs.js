

export function createDialogs({
  elements,
  dialogScrollLock,
} = {}, environment = globalThis) {
  const { window, document, requestAnimationFrame, cancelAnimationFrame } = environment;

  function enableSheetDrag(dialog) {
    const header = dialog.querySelector('.section-heading, .plan-dialog-heading, .location-dialog-heading, .settings-dialog-heading');
    const handle = dialog.querySelector('.sheet-handle');
    let gesture = null;
    const reset = () => {
      gesture = null;
      dialog.style.removeProperty('transform');
      dialog.classList.remove('sheet-dragging');
    };
    [handle, header].filter(Boolean).forEach(surface => {
      surface.classList.add('sheet-drag-surface');
      surface.addEventListener('pointerdown', event => {
        if (!window.matchMedia('(max-width: 39.999rem)').matches || !event.isPrimary || event.button !== 0 ||
            event.target.closest('button, input, select, a, summary')) return;
        gesture = { id: event.pointerId, y: event.clientY, distance: 0 };
        surface.setPointerCapture(event.pointerId);
      });
      surface.addEventListener('pointermove', event => {
        if (!gesture || gesture.id !== event.pointerId) return;
        gesture.distance = Math.max(0, event.clientY - gesture.y);
        dialog.classList.add('sheet-dragging');
        dialog.style.transform = 'translateY(' + gesture.distance + 'px)';
      });
      surface.addEventListener('pointerup', event => {
        if (!gesture || gesture.id !== event.pointerId) return;
        const dismiss = Math.max(0, event.clientY - gesture.y) >= 120;
        reset();
        if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
        if (dismiss) dialog.close();
      });
      surface.addEventListener('pointercancel', reset);
      surface.addEventListener('lostpointercapture', reset);
    });
    dialog.addEventListener('close', reset);
  }

  function createDialogScrollLock() {
    let saved = null, viewportFrame = null;
    const root = document.documentElement, body = document.body;
    const page = document.querySelector('.app-shell');
    const remember = (element, names) => names.map(name => [name, element.style.getPropertyValue(name), element.style.getPropertyPriority(name)]);
    const restore = (element, properties) => properties.forEach(([name,value,priority]) => {
      if (value) element.style.setProperty(name,value,priority);
      else element.style.removeProperty(name);
    });
    const syncViewport = () => {
      if (!saved) return;
      const viewport = window.visualViewport;
      const height = viewport?.height || window.innerHeight;
      const top = viewport?.offsetTop || 0;
      if (!(height > 0)) return;
      root.style.setProperty('--sheet-visible-height', height + 'px');
      root.style.setProperty('--sheet-visible-bottom', (top + height) + 'px');
    };
    const release = () => {
      if (!saved || document.querySelector('dialog[open]')) return;
      window.visualViewport?.removeEventListener('resize', syncViewport);
      window.visualViewport?.removeEventListener('scroll', syncViewport);
      window.removeEventListener('resize', syncViewport);
      if (viewportFrame !== null) window.cancelAnimationFrame(viewportFrame);
      viewportFrame = null;
      const previous = saved;
      saved = null;
      restore(page, previous.page);
      restore(body, previous.body);
      restore(root, previous.root);
      root.style.setProperty('scroll-behavior','auto');
      window.scrollTo({left:previous.x,top:previous.y,behavior:'instant'});
      restore(root, previous.behavior);
    };
    const open = dialog => {
      if (dialog.open) return;
      if (!saved) {
        const bounds = page.getBoundingClientRect();
        const height = Math.max(root.scrollHeight, body.scrollHeight);
        saved = {x:window.scrollX,y:window.scrollY,
          body:remember(body,['min-height','overflow']),
          page:remember(page,['position','top','left','width','margin']),
          root:remember(root,['overflow','overscroll-behavior','--sheet-visible-height','--sheet-visible-bottom']),
          behavior:remember(root,['scroll-behavior'])};
        root.style.setProperty('overflow','hidden');
        root.style.setProperty('overscroll-behavior','none');
        root.style.setProperty('scroll-behavior','auto');
        body.style.setProperty('min-height',height+'px');
        page.style.setProperty('position','fixed');
        page.style.setProperty('top',bounds.top+'px');
        page.style.setProperty('left',bounds.left+'px');
        page.style.setProperty('width',bounds.width+'px');
        page.style.setProperty('margin','0');
        body.style.setProperty('overflow','hidden');
        window.visualViewport?.addEventListener('resize', syncViewport);
        window.visualViewport?.addEventListener('scroll', syncViewport);
        window.addEventListener('resize', syncViewport);
        syncViewport();
      }
      try {
        dialog.showModal();
        syncViewport();
        if (viewportFrame !== null) window.cancelAnimationFrame(viewportFrame);
        viewportFrame = window.requestAnimationFrame(() => { viewportFrame = null; syncViewport(); });
      }
      catch (error) { release(); throw error; }
    };
    return {open,release};
  }

  function openPlanDialog() {
    if (elements.planDialog.open) return;
    dialogScrollLock.open(elements.planDialog);
    elements.planDialogTitle.focus({ preventScroll: true });
  }

  function closePlanDialog() {
    if (elements.planDialog.open) elements.planDialog.close();
  }

  return { enableSheetDrag, createDialogScrollLock, openPlanDialog, closePlanDialog };
}
