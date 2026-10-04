import { rulerValueFromDrag } from '../ui/ruler.js';

export function createZoomRuler({ input, onValue, onGesture }, environment = globalThis) {
  const surface = input.closest?.('.camera-zoom-ruler'), ticks = surface?.querySelector('.ruler-ticks');
  const now = () => environment.performance?.now() ?? Date.now();
  const spacing = () => (surface?.clientWidth || 360) * .8 / 70;
  let gesture = null, glide = null, engaged = false;
  function engage(value) { if (engaged !== value) { engaged = value; onGesture(value); } }
  function render() {
    if (!ticks) return;
    const centre = Number(input.value) * 10, step = spacing();
    let html = '';
    for (let n = 10; n <= 80; n++) {
      const major = n % 10 === 0, offset = (n - centre) * step;
      html += `<span class="ruler-tick${major ? ' ruler-tick-major' : ''}" style="left:calc(50% + ${offset}px)">${major && Math.abs(offset) > 16 ? `<span>${n / 10}×</span>` : ''}</span>`;
    }
    ticks.innerHTML = html; surface.setAttribute('aria-disabled', String(input.disabled));
  }
  function release() {
    const old = gesture; gesture = null;
    if (old && surface.hasPointerCapture?.(old.id)) surface.releasePointerCapture(old.id);
    return old;
  }
  function stop() {
    if (glide !== null) environment.cancelAnimationFrame?.(glide);
    glide = null; release(); engage(false);
  }
  function valueFrom(start, dx) {
    const value = rulerValueFromDrag(start, dx, 1, 8, .1, spacing());
    if (value !== Number(input.value)) { onValue(value); render(); }
    return value;
  }
  function finish(event) {
    if (!gesture || gesture.id !== event.pointerId) return;
    const old = release(), time = now(), samples = old.samples;
    const first = samples[0], last = samples.at(-1);
    const speed = first && last && last.time > first.time ? (last.x - first.x) / (last.time - first.time) : 0;
    if (!old.moved || time - (last?.time || 0) >= 80 || Math.abs(speed) < .25 || !environment.requestAnimationFrame || environment.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { engage(false); return; }
    const start = Number(input.value), distance = Math.sign(speed) * Math.min(120, Math.abs(speed) * 180);
    function animate() {
      const progress = Math.min(1, (now() - time) / 450), value = valueFrom(start, distance * (1 - (1 - progress) ** 3));
      if (progress === 1 || value === 1 || value === 8 || input.disabled) { glide = null; engage(false); }
      else glide = environment.requestAnimationFrame(animate);
    }
    glide = environment.requestAnimationFrame(animate);
  }
  function initialize() {
    input.addEventListener('input', () => { stop(); onValue(input.value); render(); });
    input.addEventListener('keydown', stop);
    if (!surface) return;
    surface.addEventListener('pointerdown', event => {
      if (input.disabled || event.button !== 0 || event.isPrimary === false) return;
      stop(); gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, value: Number(input.value), moved: false, samples: [{x:event.clientX,time:now()}] };
    });
    surface.addEventListener('pointermove', event => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      if (!gesture.moved) {
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 4) { stop(); return; }
        if (Math.abs(dx) < 4) return;
        gesture.moved = true; surface.setPointerCapture?.(event.pointerId);
        input.focus({ preventScroll: true }); engage(true);
      }
      event.preventDefault(); const time = now();
      gesture.samples.push({x:event.clientX,time}); gesture.samples = gesture.samples.filter(s => time - s.time <= 80);
      valueFrom(gesture.value, dx);
    });
    surface.addEventListener('pointerup', finish);
    for (const name of ['pointercancel', 'lostpointercapture']) surface.addEventListener(name, event => { if (gesture?.id === event.pointerId) stop(); });
    environment.window?.addEventListener('pointerup', finish);
    environment.window?.addEventListener('pointercancel', stop);
    if (environment.ResizeObserver) new environment.ResizeObserver(() => { stop(); render(); }).observe(surface);
    render();
  }
  return { initialize, render, stop };
}
