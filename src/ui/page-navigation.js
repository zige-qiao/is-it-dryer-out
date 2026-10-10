const VIEWS = ['overview', 'why'];
const EXCLUDED = '#ahChart';
const SETTLE_OPTIONS = { duration: 360, easing: 'cubic-bezier(0.3, 0.45, 0.4, 1)', fill: 'both' };

export function viewFromHash(hash) {
  return hash === '#why' ? 'why' : 'overview';
}

export function createPageNavigation({ renderChart, suppressGestureClick, canStartPointerGesture = () => true } = {}, environment = globalThis) {
  const { document, window, requestAnimationFrame, cancelAnimationFrame } = environment;
  const stage = document.querySelector('#pageStage');
  const track = document.querySelector('#pageTrack');
  const views = new Map(VIEWS.map(id => [id, document.querySelector(`#${id}Page`)]));
  const links = [...document.querySelectorAll('[data-page-link]')];
  const positions = new Map(VIEWS.map(id => [id, 0]));
  let current = null, gesture = null, previewId = null, animations = [], paintFrame = null;
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const overlayOpen = () => document.querySelector('dialog[open], #pageLayoutMenu:not([hidden]), .camera-help-content:not([hidden]), .timer-help[open], [popover]:popover-open');

  const validTime = value => Number.isFinite(value) && value >= 0;
  function samplePosition(event, x) {
    const movement = x - gesture.lastX;
    if (movement) gesture.lastMovement = Math.sign(movement);
    gesture.lastX = x;
    const time = gesture.eventTiming ? event.timeStamp : environment.performance?.now();
    if (!validTime(time) || time < gesture.samples.at(-1)?.time) gesture.timingValid = false;
    if (!gesture.timingValid) return;
    gesture.samples.push({ x, time });
    while (gesture.samples.length > 32 || gesture.samples[0].time < time - 100) gesture.samples.shift();
  }

  function isFlick(previous, travel) {
    if (!previous.timingValid || travel < 48 || previous.lastMovement !== -previous.direction) return false;
    const first = previous.samples[0], last = previous.samples.at(-1);
    const duration = last.time - first.time;
    return duration > 0 && -previous.direction * (last.x - first.x) / duration >= 0.5;
  }

  function cancelPaint() {
    if (paintFrame !== null) cancelAnimationFrame(paintFrame);
    paintFrame = null;
  }

  function queuePaint() {
    if (paintFrame !== null) return;
    const pending = gesture;
    paintFrame = requestAnimationFrame(() => {
      if (gesture !== pending || !pending.active) return;
      paintFrame = null;
      pending.paintedDx = pending.dx;
      track.style.transform = `translateX(${pending.dx}px)`;
    });
  }

  function stopMotion() {
    cancelPaint();
    for (const animation of animations) animation.cancel();
    animations = [];
    track.style.removeProperty('transform');
    for (const [id, view] of views) {
      view.style.removeProperty('transform');
      view.style.removeProperty('top');
      view.classList.remove('is-page-preview');
      view.hidden = id !== current;
    }
    stage.classList.remove('is-page-moving', 'is-page-preparing', 'is-page-settling');
    document.documentElement.classList.remove('is-page-moving', 'is-page-preparing');
    previewId = null;
  }

  function preview(id, top = window.scrollY - positions.get(id), offset = null, moving = true) {
    const view = views.get(id);
    view.inert = true;
    view.setAttribute('aria-hidden', 'true');
    view.classList.add('is-page-preview');
    view.style.top = `${top}px`;
    if (offset !== null) view.style.transform = `translateX(${offset}px)`;
    view.hidden = false;
    previewId = id;
    if (moving) {
      stage.classList.add('is-page-moving');
      document.documentElement.classList.add('is-page-moving');
    }
  }

  function select(id, { updateHistory = false, animate = true, drag = 0, width = null, motion = !reducedMotion() } = {}) {
    if (overlayOpen() || id === current) return;
    const previous = current;
    const outgoing = views.get(previous);
    if (previous) positions.set(previous, window.scrollY);
    stopMotion();
    current = id;
    const incoming = views.get(id);
    const moveFocus = outgoing?.contains(document.activeElement);
    for (const [key, view] of views) {
      view.hidden = key !== id;
      view.inert = key !== id;
      view.setAttribute('aria-hidden', String(key !== id));
    }
    for (const link of links) {
      if (link.dataset.pageLink === id) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    document.documentElement.dataset.activeView = id;
    if (updateHistory) window.history.pushState(window.history.state, '', `#${id}`);
    window.scrollTo({ top: positions.get(id), behavior: 'instant' });
    // Preserve the position actually available after viewport/content changes.
    positions.set(id, window.scrollY);
    if (moveFocus) document.querySelector(id === 'why' ? '#explanationToggle' : '#decisionLabel').focus({ preventScroll: true });
    if (id === 'overview') renderChart?.();
    document.dispatchEvent(new environment.Event('viewchange'));
    if (!previous || !animate || !motion || !incoming.animate) return;
    const direction = VIEWS.indexOf(id) > VIEWS.indexOf(previous) ? 1 : -1;
    const options = width === null ? { duration: 160, easing: 'ease-out', fill: 'both' } : SETTLE_OPTIONS;
    width ??= stage.getBoundingClientRect().width;
    preview(previous, positions.get(id) - positions.get(previous));
    stage.classList.add('is-page-settling');
    animations = [
      outgoing.animate([{ transform: `translateX(${drag}px)` }, { transform: `translateX(${-direction * width}px)` }], options),
      incoming.animate([{ transform: `translateX(${direction * width + drag}px)` }, { transform: 'translateX(0)' }], options),
    ];
    animations[1].onfinish = stopMotion;
  }

  function cancelGesture(immediate = true) {
    const previous = gesture;
    gesture = null;
    cancelPaint();
    if (immediate || !previous?.active || !previous.motion) { stopMotion(); return; }
    const view = views.get(current), other = views.get(previewId);
    if (!view.animate) { stopMotion(); return; }
    const width = previous.width;
    // Transfer the shared track offset to the release animations in one task.
    track.style.removeProperty('transform');
    stage.classList.remove('is-page-preparing');
    document.documentElement.classList.remove('is-page-preparing');
    stage.classList.add('is-page-settling');
    const options = SETTLE_OPTIONS;
    animations = [view.animate([{ transform: `translateX(${previous.paintedDx}px)` }, { transform: 'translateX(0)' }], options)];
    if (other) animations.push(other.animate([
      { transform: `translateX(${previous.direction * width + previous.paintedDx}px)` },
      { transform: `translateX(${previous.direction * width}px)` },
    ], options));
    animations[0].onfinish = stopMotion;
  }

  function readHash() {
    cancelGesture();
    const id = viewFromHash(window.location.hash);
    if (window.location.hash !== `#${id}`) window.history.replaceState(window.history.state, '', `#${id}`);
    // History can change while a sheet owns focus; apply it after dismissal.
    if (overlayOpen()) return;
    select(id);
  }

  function bind() {
    window.history.scrollRestoration = 'manual';
    readHash();
    for (const link of links) link.addEventListener('click', event => {
      if (event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (overlayOpen()) return;
      cancelGesture();
      select(link.dataset.pageLink, { updateHistory: true, animate: false });
    });
    window.addEventListener('hashchange', readHash);
    window.addEventListener('popstate', readHash);
    document.addEventListener('close', () => {
      if (viewFromHash(window.location.hash) !== current) readHash();
    }, true);
    document.addEventListener('touchstart', event => {
      cancelGesture();
      if (event.touches.length !== 1 || overlayOpen() ||
          !canStartPointerGesture({ pointerType: 'touch', isPrimary: true }) ||
          event.target.closest(EXCLUDED)) return;
      const touch = event.touches[0];
      gesture = { x: touch.clientX, y: touch.clientY, scroll: window.scrollY, dx: 0, paintedDx: 0,
        width: stage.getBoundingClientRect().width, motion: !reducedMotion(), active: false,
        eventTiming: validTime(event.timeStamp), timingValid: true, samples: [], lastX: touch.clientX, lastMovement: 0 };
      samplePosition(event, touch.clientX);
      if (gesture.motion) {
        stage.classList.add('is-page-preparing');
        document.documentElement.classList.add('is-page-preparing');
        // Layout the only adjacent page before horizontal recognition. Keep it
        // offscreen and inert so a tap or vertical scroll does not navigate.
        const direction = current === 'overview' ? 1 : -1;
        preview(VIEWS[VIEWS.indexOf(current) + direction], undefined, direction * gesture.width, false);
      }
    }, { passive: true });
    document.addEventListener('touchmove', event => {
      if (!gesture) return;
      if (event.touches.length !== 1 || !event.cancelable) { cancelGesture(); return; }
      const touch = event.touches[0], dx = touch.clientX - gesture.x, dy = touch.clientY - gesture.y;
      samplePosition(event, touch.clientX);
      if (!gesture.active) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
        if (Math.abs(dx) <= Math.abs(dy) * 1.5 || Math.abs(window.scrollY - gesture.scroll) > 1) { cancelGesture(); return; }
        const direction = dx < 0 ? 1 : -1;
        const next = VIEWS[VIEWS.indexOf(current) + direction];
        if (!next) { cancelGesture(); return; }
        gesture.active = true;
        gesture.direction = direction;
        gesture.next = next;
        if (gesture.motion) {
          stage.classList.add('is-page-moving');
          document.documentElement.classList.add('is-page-moving');
        }
        suppressGestureClick?.();
      }
      event.preventDefault();
      const width = gesture.width;
      gesture.dx = gesture.direction === 1 ? Math.max(-width, Math.min(0, dx)) : Math.min(width, Math.max(0, dx));
      if (gesture.motion) queuePaint();
    }, { passive: false });
    document.addEventListener('touchend', event => {
      if (!gesture) return;
      if (overlayOpen()) { cancelGesture(); return; }
      const previous = gesture;
      const touch = event.changedTouches[0];
      const dx = touch ? touch.clientX - previous.x : previous.dx;
      if (touch) samplePosition(event, touch.clientX);
      const travel = -previous.direction * dx;
      const committed = previous.active && (travel > previous.width / 2 || (touch && isFlick(previous, travel)));
      if (committed) {
        gesture = null;
        suppressGestureClick?.();
        select(previous.next, { updateHistory: true, drag: previous.paintedDx, width: previous.width, motion: previous.motion });
      } else cancelGesture(false);
    }, { passive: true });
    document.addEventListener('touchcancel', () => cancelGesture(), { passive: true });
    document.addEventListener('toggle', () => { if (overlayOpen()) cancelGesture(); }, true);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') cancelGesture(); });
    window.addEventListener('resize', () => cancelGesture());
    window.addEventListener('pagehide', () => cancelGesture());
    if (environment.MutationObserver) new environment.MutationObserver(() => {
      if ((gesture || previewId || animations.length) && overlayOpen()) cancelGesture();
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open', 'hidden', 'aria-expanded'] });
  }

  return { bind, isOverview: () => current === 'overview' };
}
