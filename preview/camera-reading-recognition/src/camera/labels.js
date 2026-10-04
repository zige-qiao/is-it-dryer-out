const collides = (a, b, gap = 4) => a.x < b.x + b.width + gap && a.x + a.width + gap > b.x &&
  a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;

// Measured text sizes, independent of crop sizes. Returned positions never edit crops.
export function placeLabels({ width, height, items, reserved = [] }) {
  const placed = [], handles = items.flatMap(({ box: b }) => [[b.x, b.y], [b.x + b.width, b.y],
    [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(([x, y]) => ({ x: x - 20, y: y - 20, width: 40, height: 40 })));
  const inside = r => r.x >= 4 && r.y >= 4 && r.x + r.width <= width - 4 && r.y + r.height <= height - 4;
  for (const item of items) {
    const { box: b, size: s, field, previous } = item;
    const x = Math.max(4, Math.min(width - s.width - 4, field === 'humidity' ? b.x + b.width - s.width - 20 : b.x + 20));
    const candidates = [previous && { x: b.x + previous.x, y: b.y + previous.y },
      { x, y: b.y - s.height - 24 }, { x, y: b.y - s.height * 2 - 28 },
      { x, y: b.y + b.height + 24 }, { x: b.x - s.width - 24, y: b.y + (b.height - s.height) / 2 },
      { x: b.x + b.width + 24, y: b.y + (b.height - s.height) / 2 }].filter(Boolean);
    const allowed = r => inside(r) && ![...reserved, ...handles, ...placed].some(other => collides(r, other));
    let position = candidates.map(p => ({ ...p, ...s })).find(allowed);
    if (!position) {
      // Stack in unused photo space when the boxes are too close for nearby names.
      for (let y = 4; y + s.height <= height - 4 && !position; y += s.height + 4)
        for (const xx of [4, width - s.width - 4]) {
          const r = { x: xx, y, ...s };
          if (allowed(r) && !items.some(i => collides(r, i.box))) { position = r; break; }
        }
    }
    if (!position) {
      // A selection can cover the entire photo: keep names usable inside it
      // rather than covering a corner's interactive resize target.
      for (let y = 4; y + s.height <= height - 4 && !position; y += s.height + 4)
        for (const xx of [4, width - s.width - 4]) {
          const r = { x: xx, y, ...s }; if (allowed(r)) { position = r; break; }
        }
    }
    if (!position) position = { x: 4, y: 4 + placed.length * (s.height + 4), ...s };
    placed.push({ ...position, field });
  }
  return placed;
}

export function createLabelLayout(surface, boxes, environment = globalThis) {
  let previous = {}, crops = {};
  function render(next = crops) {
    crops = next;
    const rect = surface.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const items = Object.entries(boxes).flatMap(([field, box]) => {
      const crop = crops[field], label = box.querySelector?.('span');
      if (!crop || !label) return [];
      const size = label.getBoundingClientRect();
      return [{ field, box: { x: crop.x * rect.width, y: crop.y * rect.height, width: crop.width * rect.width, height: crop.height * rect.height },
        size: { width: size.width, height: size.height }, previous: previous[field], label, element: box }];
    });
    const retake = surface.querySelector?.('#cameraRetakeButton')?.getBoundingClientRect();
    const reserved = retake ? [{ x: retake.left - rect.left, y: retake.top - rect.top, width: retake.width, height: retake.height }] : [];
    for (const position of placeLabels({ width: rect.width, height: rect.height, items, reserved })) {
      const item = items.find(i => i.field === position.field), b = item.box;
      const offset = { x: position.x - b.x - 2, y: position.y - b.y - 2 };
      Object.assign(item.label.style, { left: `${offset.x}px`, top: `${offset.y}px` });
      previous[position.field] = { x: position.x - b.x, y: position.y - b.y };
      let line = item.element.querySelector('.camera-label-connector');
      if (!line) { line = environment.document.createElement('i'); line.className = 'camera-label-connector'; line.setAttribute('aria-hidden', 'true'); item.element.append(line); }
      const sx = position.x + position.width / 2, sy = position.y + position.height / 2;
      const tx = Math.max(b.x, Math.min(b.x + b.width, sx)), ty = Math.max(b.y, Math.min(b.y + b.height, sy));
      const length = Math.hypot(tx - sx, ty - sy);
      Object.assign(line.style, { left: `${sx - b.x - 2}px`, top: `${sy - b.y - 2}px`, width: `${length}px`, transform: `rotate(${Math.atan2(ty - sy, tx - sx)}rad)` });
    }
  }
  function initialize() {
    if (!environment.ResizeObserver) return;
    const observer = new environment.ResizeObserver(() => render()); observer.observe(surface);
    for (const box of Object.values(boxes)) { const label = box.querySelector?.('span'); if (label) observer.observe(label); }
  }
  return { render, initialize, reset: () => { previous = {}; crops = {}; } };
}
