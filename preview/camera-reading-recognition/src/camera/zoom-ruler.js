import { rulerValueFromDrag } from '../ui/ruler.js';

export function createZoomRuler({ input, onValue, onGesture }, environment = globalThis) {
  const surface = input.closest?.('.camera-zoom-ruler');
  const ticks = surface?.querySelector('.ruler-ticks');
  let gesture = null;
  function render() {
    if (!ticks) return;
    const centre = Number(input.value) * 10, radius = Math.ceil((surface.clientWidth || 360) / 16) + 1;
    let html = '';
    for (let n = Math.max(10, Math.floor(centre) - radius); n <= Math.min(80, Math.ceil(centre) + radius); n++) {
      const major = n % 10 === 0;
      html += `<span class="ruler-tick${major ? ' ruler-tick-major' : ''}" style="left:calc(50% + ${(n - centre) * 8}px)">${major && Math.abs((n - centre) * 8) > 16 ? `<span>${n / 10}×</span>` : ''}</span>`;
    }
    ticks.innerHTML = html;
    surface.setAttribute('aria-disabled', String(input.disabled));
  }
  function stop() {
    const old = gesture; gesture = null;
    if (old && surface.hasPointerCapture?.(old.id)) surface.releasePointerCapture(old.id);
    if (old?.moved) onGesture(false);
  }
  function initialize() {
    input.addEventListener('input', () => { onValue(input.value); render(); });
    if (!surface) return;
    surface.addEventListener('pointerdown', event => {
      if (input.disabled || gesture || event.button !== 0 || event.isPrimary === false) return;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, value: Number(input.value), moved: false };
    });
    surface.addEventListener('pointermove', event => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      if (!gesture.moved) {
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 4) { stop(); return; }
        if (Math.abs(dx) < 4) return;
        gesture.moved = true; surface.setPointerCapture?.(event.pointerId);
        input.focus({ preventScroll: true }); onGesture(true);
      }
      event.preventDefault();
      const value = rulerValueFromDrag(gesture.value, dx, 1, 8, .1, 8);
      if (value !== Number(input.value)) { onValue(value); render(); }
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) surface.addEventListener(name, event => {
      if (gesture?.id === event.pointerId) stop();
    });
    environment.window?.addEventListener('pointerup', stop);
    environment.window?.addEventListener('pointercancel', stop);
    if (environment.ResizeObserver) new environment.ResizeObserver(render).observe(surface);
    render();
  }
  return { initialize, render, stop };
}
