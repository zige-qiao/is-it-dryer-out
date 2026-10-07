// Shared snapping geometry; each control owns its gestures and persistence.
export function rulerValueFromDrag(start, distance, min, max, step, spacing) {
  return Number(Math.min(max, Math.max(min, Math.round((start - distance / spacing * step) / step) * step)).toFixed(step < 1 ? 1 : 0));
}
