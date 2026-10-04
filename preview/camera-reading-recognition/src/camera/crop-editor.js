import { boundedCrop } from './readings.js';

export function changeCrop(original, dx, dy, handle = 'move') {
  const min = .02;
  if (handle === 'move') return { ...original,
    x: Math.max(0, Math.min(1 - original.width, original.x + dx)),
    y: Math.max(0, Math.min(1 - original.height, original.y + dy)) };
  let left = original.x, top = original.y, right = left + original.width, bottom = top + original.height;
  if (handle.includes('w')) left = Math.max(0, Math.min(right - min, left + dx));
  if (handle.includes('e')) right = Math.min(1, Math.max(left + min, right + dx));
  if (handle.includes('n')) top = Math.max(0, Math.min(bottom - min, top + dy));
  if (handle.includes('s')) bottom = Math.min(1, Math.max(top + min, bottom + dy));
  return boundedCrop({ x: left, y: top, width: right - left, height: bottom - top });
}

export function createCropEditor({ surface, boxes, onChange, onCommit, onGesture = () => {} }) {
  let crops = { temperature: null, humidity: null, pending: null }, gesture = null;
  function update(next) {
    crops = { ...next };
    for (const [field, box] of Object.entries(boxes)) {
      const crop = crops[field]; box.hidden = !crop;
      if (crop) Object.assign(box.style, { left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` });
    }
  }
  function changed(field, crop) { update({ ...crops, [field]: crop }); onChange(field, crop); }
  function point(event) {
    const rect = surface.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
  }
  function reset() {
    const previous = gesture; gesture = null;
    if (previous && surface.hasPointerCapture?.(previous.id)) surface.releasePointerCapture(previous.id);
    update({ temperature: null, humidity: null, pending: null });
  }
  function initialize() {
    surface.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.isPrimary === false || gesture) return;
      const box = event.target.closest('[data-camera-field]'), handle = event.target.closest('[data-crop-handle]');
      if (event.target.closest('button') && !handle) return;
      const field = box?.dataset.cameraField || 'pending';
      event.preventDefault(); const start = point(event);
      gesture = { id: event.pointerId, field, start, original: crops[field], handle: box ? handle?.dataset.cropHandle || 'move' : 'draw', moved: false };
      onGesture(true, field);
      surface.setPointerCapture(event.pointerId);
    });
    surface.addEventListener('pointermove', event => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const current = point(event), dx = current.x - gesture.start.x, dy = current.y - gesture.start.y;
      if (!gesture.moved && Math.abs(dx) + Math.abs(dy) < .006) return;
      gesture.moved = true; event.preventDefault();
      const crop = gesture.handle === 'draw' ? boundedCrop({ x: Math.min(current.x, gesture.start.x), y: Math.min(current.y, gesture.start.y), width: Math.abs(dx), height: Math.abs(dy) })
        : changeCrop(gesture.original, dx, dy, gesture.handle);
      changed(gesture.field, crop);
    });
    function end(event, cancelled = false) {
      if (!gesture || event.pointerId !== gesture.id) return;
      const previous = gesture; gesture = null;
      if (surface.hasPointerCapture?.(event.pointerId)) surface.releasePointerCapture(event.pointerId);
      if (cancelled) { update({ ...crops, [previous.field]: previous.original }); if (previous.moved) onChange(previous.field, previous.original); }
      onGesture(false, previous.field, cancelled);
      if (!cancelled && previous.moved) onCommit(previous.field);
    }
    surface.addEventListener('pointerup', event => end(event));
    surface.addEventListener('pointercancel', event => end(event, true));
    surface.addEventListener('lostpointercapture', event => end(event, true));
    for (const [field, box] of Object.entries(boxes)) box.addEventListener('keydown', event => {
      if (!crops[field] || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault(); const step = event.altKey ? .002 : .01;
      const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
      const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
      const next = changeCrop(crops[field], dx, dy, event.target?.dataset.cropHandle || (event.shiftKey ? 'se' : 'move'));
      if (JSON.stringify(next) === JSON.stringify(crops[field])) return;
      changed(field, next); onCommit(field);
    });
    surface.addEventListener('keydown', event => {
      if (event.target !== surface || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault(); changed('pending', { x: .25, y: .25, width: .5, height: .3 });
      onCommit('pending'); boxes.pending?.focus({ preventScroll: true });
    });
  }
  return { initialize, update, reset };
}
