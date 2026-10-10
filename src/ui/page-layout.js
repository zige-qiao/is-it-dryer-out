export const PAGE_BOXES = [
  { id: 'recommendation', label: 'Recommendation', preference: 'showRecommendation', visible: true, pinned: true },
  { id: 'indoor-summary', label: 'Indoor summary', preference: 'showIndoorSummary', visible: false },
  { id: 'moisture-comparison', label: 'Moisture comparison', preference: 'showMoistureComparison', visible: true },
  { id: 'supporting-details', label: 'Chart key', preference: 'showSupportingDetails', visible: true },
];

export function normalizePageOrder(value) {
  const known = PAGE_BOXES.map(box => box.id);
  const order = Array.isArray(value) ? [...new Set(value.filter(id => known.includes(id) && id !== 'recommendation'))] : [];
  return ['recommendation', ...order, ...known.filter(id => id !== 'recommendation' && !order.includes(id))];
}

export function pageLayoutDefaults() {
  return { pageOrder: normalizePageOrder(), ...Object.fromEntries(PAGE_BOXES.map(box => [box.preference, box.visible])) };
}

export function createPageLayout({ preferences, save, canStartPointerGesture = () => true }, environment = globalThis) {
  const { document, requestAnimationFrame, cancelAnimationFrame } = environment;
  const shell = document.querySelector('#overviewPage') || document.querySelector('.app-shell');
  const list = document.querySelector('#pageLayoutList');
  const dialog = document.querySelector('#settingsDialog');
  const scroller = dialog.querySelector('.settings-dialog-content') || dialog;
  const sheetHeader = dialog.querySelector('.sheet-header');
  const status = document.querySelector('#pageLayoutStatus');
  const menu = document.querySelector('#pageLayoutMenu');
  const actions = [...menu.querySelectorAll('[data-move]')];
  const rows = new Map(PAGE_BOXES.map(box => [box.id, list.querySelector(`[data-layout-row="${box.id}"]`)]));
  const nodes = new Map(PAGE_BOXES.map(box => [box.id, shell.querySelector(`[data-page-box="${box.id}"]`)]));
  let drag = null, frame = null, menuId = null, suppressClick = null;
  const setTimer = environment.setTimeout || globalThis.setTimeout;
  const clearTimer = environment.clearTimeout || globalThis.clearTimeout;

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
    for (const action of actions) action.disabled = action.dataset.move === 'up' ? index <= 1 : index === PAGE_BOXES.length - 1;
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
    // The menu belongs to the stationary shell; only options scroll.
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
    preferences.showRecommendation = true;
    for (const [index, id] of preferences.pageOrder.entries()) {
      const box = PAGE_BOXES.find(box => box.id === id), row = rows.get(id);
      nodes.get(id).hidden = preferences[box.preference] !== true;
      if (shell.children[index] !== nodes.get(id)) shell.insertBefore(nodes.get(id), shell.children[index] || null);
      if (list.children[index] !== row) list.insertBefore(row, list.children[index] || null);
      if (!box.pinned) row.querySelector('input').checked = preferences[box.preference] === true;
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

  let motion = [], settling = null;
  const reducedMotion = () => (environment.window || environment).matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const measure = () => new Map([...rows].map(([id, row]) => [id, row.getBoundingClientRect()]));

  function stopMotion() {
    for (const animation of motion) animation.cancel();
    motion = [];
    if (settling) { settling.layer.remove(); settling.source.classList.remove('is-drag-source'); settling = null; }
  }

  function animateRows(before, except) {
    if (reducedMotion()) return;
    for (const [id, row] of rows) {
      const distance = before.get(id).top - row.getBoundingClientRect().top;
      if (id !== except && distance && row.animate) motion.push(row.animate(
        [{ transform: `translateY(${distance}px)` }, { transform: 'translateY(0)' }], { duration: 160, easing: 'ease-out' }));
    }
  }

  function clearPreview() {
    list.classList.remove('is-reordering');
    for (const row of rows.values()) {
      row.style.removeProperty('transform'); row.classList.remove('is-reorder-ready', 'is-drag-source');
    }
  }

  function beginPreview() {
    drag.bounds = measure(); drag.scrollStart = scroller.scrollTop; drag.lastFrame = null;
    drag.source = rows.get(drag.id);
    const source = drag.bounds.get(drag.id);
    drag.offset = drag.startY - source.top;
    drag.layer = document.createElement('div'); drag.layer.className = 'layout-drag-layer';
    drag.layer.setAttribute('aria-hidden', 'true'); drag.layer.inert = true;
    drag.gap = document.createElement('div'); drag.gap.className = 'layout-drag-gap';
    drag.preview = document.createElement('ul'); drag.preview.className = 'page-layout-list layout-drag-preview';
    const copy = drag.source.cloneNode(true);
    for (const node of [copy, ...copy.querySelectorAll('*')]) {
      for (const attr of ['id', 'for', 'name', 'data-layout-row', 'data-drag-handle', 'aria-controls', 'aria-describedby']) node.removeAttribute(attr);
      if (node.matches?.('button,input,[tabindex]')) node.setAttribute('tabindex', '-1');
      node.classList.remove('is-reorder-ready', 'is-drag-source');
    }
    drag.preview.append(copy); drag.layer.append(drag.gap, drag.preview); dialog.append(drag.layer);
    list.classList.add('is-reordering'); drag.source.classList.add('is-drag-source');
    drag.preview.style.width = `${source.width}px`; drag.preview.style.height = `${source.height}px`;
    copy.style.minHeight = `${source.height}px`;
  }

  function updateTarget(y) {
    if (!drag?.active) return;
    drag.y = y;
    const scroll = scroller.scrollTop - drag.scrollStart;
    const source = drag.bounds.get(drag.id), other = preferences.pageOrder.filter(id => id !== drag.id);
    const centre = y - drag.offset + source.height / 2 + scroll;
    // Fixed, untransformed midpoints keep the destination stable while neighbours animate.
    const midpoint = id => { const b = drag.bounds.get(id); return b.top + b.height / 2; };
    while (drag.index < other.length && centre > midpoint(other[drag.index]) + 8) drag.index++;
    while (drag.index > 1 && centre < midpoint(other[drag.index - 1]) - 8) drag.index--;
    const order = [...other]; order.splice(drag.index, 0, drag.id);
    let top = drag.bounds.get('recommendation').top;
    let destination;
    for (const id of order) {
      const bounds = drag.bounds.get(id);
      if (id === drag.id) destination = top;
      else rows.get(id).style.transform = `translateY(${top - bounds.top}px)`;
      top += bounds.height;
    }
    const body = scroller.getBoundingClientRect(), shell = dialog.getBoundingClientRect();
    const left = source.left - body.left;
    drag.layer.style.left = `${body.left - shell.left - (dialog.clientLeft || 0)}px`;
    drag.layer.style.top = `${body.top - shell.top - (dialog.clientTop || 0)}px`;
    drag.layer.style.width = `${body.width}px`; drag.layer.style.height = `${body.height}px`;
    const pinned = drag.bounds.get('recommendation');
    const minTop = pinned.top + pinned.height - scroll;
    const maxTop = top - source.height - scroll;
    drag.previewTop = Math.max(minTop, Math.min(y - drag.offset, maxTop)) - body.top;
    drag.preview.style.left = `${left}px`; drag.preview.style.top = `${drag.previewTop}px`;
    drag.gap.style.left = `${left}px`; drag.gap.style.top = `${destination - scroll - body.top}px`;
    drag.gap.style.width = `${source.width}px`; drag.gap.style.height = `${source.height}px`;
    if (drag.edge && edgeIntent().direction !== drag.edge.direction) drag.edge = null;
  }

  function edgeIntent() {
    const viewport = scroller.getBoundingClientRect();
    const top = Math.max(viewport.top, sheetHeader?.getBoundingClientRect().bottom || viewport.top) + 16;
    const bottom = viewport.bottom - 16;
    const scroll = scroller.scrollTop - drag.scrollStart;
    const first = drag.bounds.get(preferences.pageOrder[1]);
    const last = drag.bounds.get(preferences.pageOrder.at(-1));
    const above = top - (first.top - scroll), below = last.top + last.height - scroll - bottom;
    const zone = Math.min(24, Math.max(0, (bottom - top) / 2));
    if (zone && above > .5 && drag.y < top + zone) return {
      direction: -1, remaining: above, intensity: Math.min(1, (top + zone - drag.y) / zone),
    };
    if (zone && below > .5 && drag.y > bottom - zone) return {
      direction: 1, remaining: below, intensity: Math.min(1, (drag.y - bottom + zone) / zone),
    };
    return { direction: 0 };
  }

  function scrollEdge(time) {
    if (!drag?.active) return;
    const elapsed = drag.lastFrame === null ? 0 : Math.min(32, Math.max(0, time - drag.lastFrame));
    drag.lastFrame = time;
    const intent = edgeIntent();
    if (!intent.direction) drag.edge = null;
    else {
      if (drag.edge?.direction !== intent.direction) drag.edge = { direction: intent.direction, since: time };
      const scrollingTime = Math.min(elapsed, Math.max(0, time - drag.edge.since - 200));
      const distance = Math.min(intent.remaining, intent.intensity * intent.intensity * 160 * scrollingTime / 1000);
      if (distance) scroller.scrollTop += intent.direction * distance;
    }
    updateTarget(drag.y);
    frame = requestAnimationFrame(scrollEdge);
  }

  function finish(cancelled, immediate = false) {
    if (!drag) { if (immediate) stopMotion(); return; }
    const previous = drag; drag = null;
    clearTimer(previous.timer); previous.handle.classList.remove('is-reorder-ready');
    rows.get(previous.id).classList.remove('is-reorder-ready');
    cancelAnimationFrame(frame); frame = null;
    if (previous.handle.hasPointerCapture(previous.pointer)) previous.handle.releasePointerCapture(previous.pointer);
    if (!previous.active) {
      if (cancelled || previous.armed) suppressClick = previous.handle;
      return;
    }
    suppressClick = previous.handle;
    const before = measure(); clearPreview();
    if (!cancelled) {
      const order = preferences.pageOrder.filter(id => id !== previous.id);
      order.splice(previous.index, 0, previous.id); commit(order, previous.id, previous.handle);
    } else {
      previous.handle.focus({ preventScroll: true }); status.textContent = 'Page move cancelled.';
    }
    if (immediate || reducedMotion() || !previous.preview.animate) { previous.layer.remove(); return; }
    animateRows(before, previous.id);
    previous.source.classList.add('is-drag-source');
    settling = { layer: previous.layer, source: previous.source };
    const target = previous.source.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    const animation = previous.preview.animate([{ transform: 'translateY(0)' },
      { transform: `translateY(${target - previous.previewTop}px)` }], { duration: 160, easing: 'ease-out', fill: 'forwards' });
    motion.push(animation);
    animation.onfinish = () => { if (settling?.layer === previous.layer) stopMotion(); };
  }

  function bind() {
    for (const action of actions) action.addEventListener('click', () => {
      if (!menuId || action.disabled) return;
      const id = menuId, handle = handleFor(id), order = [...preferences.pageOrder], from = order.indexOf(id);
      const to = from + (action.dataset.move === 'up' ? -1 : 1);
      if (to < 1 || to >= order.length) return;
      stopMotion(); const before = measure(); closeMenu();
      order.splice(from, 1); order.splice(to, 0, id);
      commit(order, id, handle); animateRows(before);
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
      if (box.pinned) continue;
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
        if (event.button !== 0 || event.isPrimary === false || drag) return;
        event.stopPropagation(); stopMotion(); suppressClick = null;
        if (!canStartPointerGesture(event)) { suppressClick = handle; return; }
        drag = { id: box.id, handle, pointer: event.pointerId, index: preferences.pageOrder.indexOf(box.id),
          startX: event.clientX, startY: event.clientY, y: event.clientY, active: false,
          touch: event.pointerType === 'touch', armed: false, timer: null };
        handle.setPointerCapture(event.pointerId);
        if (drag.touch) {
          const pending = drag;
          pending.timer = setTimer(() => {
            if (drag !== pending) return;
            pending.armed = true;
            handle.classList.add('is-reorder-ready'); row.classList.add('is-reorder-ready');
            closeMenu();
          }, 300);
        }
      });
      handle.addEventListener('pointermove', event => {
        if (drag?.pointer !== event.pointerId) return;
        const moved = Math.hypot((event.clientX || 0) - (drag.startX || 0), event.clientY - drag.startY) >= 8;
        // A swipe before the hold completes belongs to native scrolling for its entire lifetime.
        if (drag.touch && !drag.armed) { if (moved) finish(true); return; }
        if (!drag.active && moved) {
          drag.active = true; closeMenu(); handle.focus({ preventScroll: true }); beginPreview();
          frame = requestAnimationFrame(scrollEdge);
        }
        if (drag.active) { event.preventDefault(); updateTarget(event.clientY); }
      });
      // touch-action is fixed when a gesture starts. Claim only an armed hold,
      // before the browser commits its first native pan; pending touches scroll normally.
      handle.addEventListener('touchmove', event => {
        if (!drag?.touch || !drag.armed || drag.handle !== handle) return;
        if (!event.cancelable) { finish(true); return; }
        event.preventDefault();
      }, { passive: false });
      handle.addEventListener('contextmenu', event => event.preventDefault());
      handle.addEventListener('pointerup', event => { if (drag?.pointer === event.pointerId) finish(false); });
      for (const name of ['pointercancel', 'lostpointercapture']) handle.addEventListener(name, event => {
        if (drag?.pointer === event.pointerId) finish(true);
      });
    }
    document.addEventListener('keydown', event => {
      if (!drag) stopMotion();
      if (drag && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); finish(true); }
      else if (menuId && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeMenu(true); }
    }, true);
    document.addEventListener('pointerdown', event => {
      if (!drag) stopMotion();
      if (drag && event.pointerId !== drag.pointer) finish(true);
      if (menuId && !menu.contains(event.target) && !handleFor(menuId).contains(event.target)) closeMenu(menu.contains(document.activeElement));
    }, true);
    document.addEventListener('focusin', event => {
      if (menuId && !menu.contains(event.target) && event.target !== handleFor(menuId)) closeMenu();
    });
    const closeForViewport = () => closeMenu(menu.contains(document.activeElement));
    scroller.addEventListener('scroll', () => { if (drag && !drag.active) finish(true); else if (!drag) stopMotion(); closeForViewport(); });
    dialog.addEventListener('close', () => { finish(true, true); closeMenu(); });
    const window = environment.window || environment;
    const cancelForViewport = () => { finish(true, true); closeForViewport(); };
    window.addEventListener?.('resize', cancelForViewport);
    window.visualViewport?.addEventListener('resize', cancelForViewport);
    window.visualViewport?.addEventListener('scroll', cancelForViewport);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') { finish(true, true); closeMenu(); } });
    document.querySelector('#resetPageLayout').addEventListener('click', () => {
      finish(true, true); closeMenu(); Object.assign(preferences, pageLayoutDefaults()); apply(); save();
      status.textContent = 'Page layout reset to defaults.';
    });
  }

  return { apply, bind };
}
