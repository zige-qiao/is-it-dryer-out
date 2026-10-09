export const PAGE_BOXES = [
  { id: 'indoor-summary', label: 'Indoor summary', preference: 'showIndoorSummary', visible: false },
  { id: 'recommendation', label: 'Recommendation', preference: 'showRecommendation', visible: true },
  { id: 'moisture-comparison', label: 'Moisture comparison', preference: 'showMoistureComparison', visible: true },
  { id: 'supporting-details', label: 'Supporting details', preference: 'showSupportingDetails', visible: true },
];

export function normalizePageOrder(value) {
  const known = PAGE_BOXES.map(box => box.id);
  const order = Array.isArray(value) ? [...new Set(value.filter(id => known.includes(id)))] : [];
  return [...order, ...known.filter(id => !order.includes(id))];
}

export function pageLayoutDefaults() {
  return { pageOrder: normalizePageOrder(), ...Object.fromEntries(PAGE_BOXES.map(box => [box.preference, box.visible])) };
}

export function createPageLayout({ preferences, save }, environment = globalThis) {
  const { document, requestAnimationFrame, cancelAnimationFrame } = environment;
  const shell = document.querySelector('.app-shell');
  const footer = document.querySelector('.project-credit-row');
  const list = document.querySelector('#pageLayoutList');
  const dialog = document.querySelector('#settingsDialog');
  const status = document.querySelector('#pageLayoutStatus');
  const menu = document.querySelector('#pageLayoutMenu');
  const actions = [...menu.querySelectorAll('[data-move]')];
  const rows = new Map(PAGE_BOXES.map(box => [box.id, list.querySelector(`[data-layout-row="${box.id}"]`)]));
  const nodes = new Map(PAGE_BOXES.map(box => [box.id, shell.querySelector(`[data-page-box="${box.id}"]`)]));
  let drag = null, frame = null, menuId = null, suppressClick = null;

  function handleFor(id) { return rows.get(id).querySelector('[data-drag-handle]'); }

  function closeMenu(restoreFocus = false) {
    if (!menuId) return;
    const handle = handleFor(menuId);
    menuId = null;
    menu.hidden = true;
    handle.setAttribute('aria-expanded', 'false');
    if (restoreFocus) handle.focus({ preventScroll: true });
  }

  function updateMenuActions() {
    if (!menuId) return;
    const index = preferences.pageOrder.indexOf(menuId);
    for (const action of actions) action.disabled = action.dataset.move === 'up' ? index === 0 : index === PAGE_BOXES.length - 1;
  }

  function openMenu(id) {
    if (menuId === id) { closeMenu(true); return; }
    closeMenu();
    menuId = id;
    const handle = handleFor(id), box = PAGE_BOXES.find(box => box.id === id);
    handle.setAttribute('aria-expanded', 'true');
    menu.setAttribute('aria-label', `Reorder ${box.label}`);
    updateMenuActions();
    menu.hidden = false;
    // Position within the scrollable dialog, clamped to its visible viewport.
    const bounds = dialog.getBoundingClientRect(), anchor = handle.getBoundingClientRect();
    const viewport = environment.visualViewport || environment.window?.visualViewport;
    const top = Math.max(bounds.top + (dialog.clientTop || 0), viewport?.offsetTop || 0) + 8;
    const bottom = Math.min(bounds.bottom, (viewport?.offsetTop || 0) + (viewport?.height || environment.innerHeight || bounds.bottom)) - 8;
    const left = Math.max(bounds.left + (dialog.clientLeft || 0), viewport?.offsetLeft || 0) + 8;
    const right = Math.min(bounds.right, (viewport?.offsetLeft || 0) + (viewport?.width || environment.innerWidth || bounds.right)) - 8;
    menu.style.maxHeight = `${Math.max(44, bottom - top)}px`;
    const size = menu.getBoundingClientRect();
    const x = Math.max(left, Math.min(anchor.left, right - size.width));
    const y = Math.max(top, Math.min(anchor.bottom + 8 + size.height <= bottom ? anchor.bottom + 8 : anchor.top - size.height - 8, bottom - size.height));
    menu.style.left = `${x - bounds.left - (dialog.clientLeft || 0)}px`;
    menu.style.top = `${y - bounds.top + dialog.scrollTop - (dialog.clientTop || 0)}px`;
    actions.find(action => !action.disabled)?.focus({ preventScroll: true });
  }

  function apply() {
    preferences.pageOrder = normalizePageOrder(preferences.pageOrder);
    for (const [index, id] of preferences.pageOrder.entries()) {
      const box = PAGE_BOXES.find(box => box.id === id), row = rows.get(id);
      nodes.get(id).hidden = preferences[box.preference] !== true;
      if (shell.children[index] !== nodes.get(id)) shell.insertBefore(nodes.get(id), shell.children[index] || footer);
      if (list.children[index] !== row) list.insertBefore(row, list.children[index] || null);
      row.querySelector('input').checked = preferences[box.preference] === true;
    }
    document.querySelector('#settingsEditIndoor').hidden = preferences.showIndoorSummary || preferences.showMoistureComparison;
    document.documentElement.classList.remove('layout-pending');
    updateMenuActions();
  }

  function commit(order, id, focus) {
    preferences.pageOrder = order;
    apply(); save();
    const row = rows.get(id);
    if (focus) (focus.disabled ? row : focus).focus({ preventScroll: true });
    status.textContent = `${PAGE_BOXES.find(box => box.id === id).label}, position ${order.indexOf(id) + 1} of ${order.length}.`;
  }

  function clearMarkers() {
    for (const row of rows.values()) { delete row.dataset.insert; row.classList.remove('is-dragging'); }
  }

  function updateTarget(y) {
    if (!drag?.active) return;
    drag.y = y;
    const other = preferences.pageOrder.filter(id => id !== drag.id);
    const index = other.findIndex(id => {
      const bounds = rows.get(id).getBoundingClientRect();
      return y < bounds.top + bounds.height / 2;
    });
    drag.index = index < 0 ? other.length : index;
    clearMarkers();
    rows.get(drag.id).classList.add('is-dragging');
    if (drag.index < other.length) rows.get(other[drag.index]).dataset.insert = 'before';
    else rows.get(other.at(-1)).dataset.insert = 'after';
  }

  function scrollEdge() {
    if (!drag?.active) return;
    const bounds = list.getBoundingClientRect(), viewport = dialog.getBoundingClientRect();
    const top = Math.max(bounds.top, viewport.top), bottom = Math.min(bounds.bottom, viewport.bottom);
    const delta = drag.y < top + 48 ? -Math.min(12, (top + 48 - drag.y) / 4)
      : drag.y > bottom - 48 ? Math.min(12, (drag.y - bottom + 48) / 4) : 0;
    if (delta) { dialog.scrollTop += delta; updateTarget(drag.y); }
    frame = requestAnimationFrame(scrollEdge);
  }

  function finish(cancelled) {
    if (!drag) return;
    const previous = drag; drag = null;
    cancelAnimationFrame(frame); frame = null;
    clearMarkers();
    if (previous.handle.hasPointerCapture(previous.pointer)) previous.handle.releasePointerCapture(previous.pointer);
    if (!previous.active) return;
    suppressClick = previous.handle;
    if (!cancelled) {
      const order = preferences.pageOrder.filter(id => id !== previous.id);
      order.splice(previous.index, 0, previous.id);
      commit(order, previous.id, previous.handle);
    } else {
      previous.handle.focus({ preventScroll: true });
      status.textContent = 'Page move cancelled.';
    }
  }

  function bind() {
    for (const action of actions) action.addEventListener('click', () => {
      if (!menuId || action.disabled) return;
      const id = menuId, handle = handleFor(id), order = [...preferences.pageOrder], from = order.indexOf(id);
      const to = from + (action.dataset.move === 'up' ? -1 : 1);
      if (to < 0 || to >= order.length) return;
      closeMenu();
      order.splice(from, 1); order.splice(to, 0, id);
      commit(order, id, handle);
    });
    menu.addEventListener('keydown', event => {
      if (!menuId) return;
      const available = actions.filter(action => !action.disabled);
      const index = available.indexOf(document.activeElement);
      if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + available.length) % available.length;
        available[next]?.focus({ preventScroll: true });
      } else if (event.key === 'Tab') {
        event.preventDefault();
        const row = rows.get(menuId);
        closeMenu(true);
        if (!event.shiftKey) row.querySelector('input').focus({ preventScroll: true });
      }
    });
    for (const box of PAGE_BOXES) {
      const row = rows.get(box.id), handle = row.querySelector('[data-drag-handle]');
      row.querySelector('input').addEventListener('change', event => {
        preferences[box.preference] = event.target.checked;
        apply(); save();
        event.target.focus({ preventScroll: true });
      });
      handle.addEventListener('click', event => {
        if (suppressClick === handle) { suppressClick = null; event.preventDefault(); return; }
        openMenu(box.id);
      });
      handle.addEventListener('keydown', () => { suppressClick = null; });
      handle.addEventListener('pointerdown', event => {
        if (event.button !== 0 || drag) return;
        event.stopPropagation(); suppressClick = null;
        drag = { id: box.id, handle, pointer: event.pointerId, index: preferences.pageOrder.indexOf(box.id),
          startX: event.clientX, startY: event.clientY, y: event.clientY, active: false };
        handle.setPointerCapture(event.pointerId);
      });
      handle.addEventListener('pointermove', event => {
        if (drag?.pointer !== event.pointerId) return;
        if (!drag.active && Math.hypot((event.clientX || 0) - (drag.startX || 0), event.clientY - drag.startY) >= 8) {
          drag.active = true; closeMenu(); handle.focus({ preventScroll: true });
          frame = requestAnimationFrame(scrollEdge);
        }
        if (drag.active) { event.preventDefault(); updateTarget(event.clientY); }
      });
      handle.addEventListener('pointerup', event => { if (drag?.pointer === event.pointerId) finish(false); });
      for (const name of ['pointercancel', 'lostpointercapture']) handle.addEventListener(name, event => {
        if (drag?.pointer === event.pointerId) finish(true);
      });
    }
    document.addEventListener('keydown', event => {
      if (drag && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); finish(true); }
      else if (menuId && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeMenu(true); }
    }, true);
    document.addEventListener('pointerdown', event => {
      if (menuId && !menu.contains(event.target) && !handleFor(menuId).contains(event.target)) closeMenu(menu.contains(document.activeElement));
    }, true);
    document.addEventListener('focusin', event => {
      if (menuId && !menu.contains(event.target) && event.target !== handleFor(menuId)) closeMenu();
    });
    const closeForViewport = () => closeMenu(menu.contains(document.activeElement));
    dialog.addEventListener('scroll', closeForViewport);
    dialog.addEventListener('close', () => { finish(true); closeMenu(); });
    const window = environment.window || environment;
    window.addEventListener?.('resize', closeForViewport);
    window.visualViewport?.addEventListener('resize', closeForViewport);
    window.visualViewport?.addEventListener('scroll', closeForViewport);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') { finish(true); closeMenu(); } });
    document.querySelector('#resetPageLayout').addEventListener('click', () => {
      finish(true); closeMenu(); Object.assign(preferences, pageLayoutDefaults()); apply(); save();
      status.textContent = 'Page layout reset to defaults.';
    });
  }

  return { apply, bind };
}
