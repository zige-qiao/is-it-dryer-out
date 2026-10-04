import { detectCandidates, locateGlyphs, numericGroups } from './detection.js';
import { normalise, bounds, extract, binaryPixels } from './image.js';
import { IDENTITY, rotation, warp, projectBox, inverse, screenCorrections, strokeAngles, strokeShear, compose } from './geometry.js';

const fields = ['temperature', 'humidity'];
const overlap = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
const cropBox = (box, width, height) => {
  const x = Math.max(0, Math.min(width - 1, box.x)), y = Math.max(0, Math.min(height - 1, box.y));
  return { x: x / width, y: y / height, width: Math.max(1, Math.min(width, box.x + box.width) - x) / width,
    height: Math.max(1, Math.min(height, box.y + box.height) - y) / height };
};
const asBox = (crop, width, height) => ({ x: crop.x * width, y: crop.y * height, width: crop.width * width, height: crop.height * height });

export function makePreview(pixels, correction, sourceBox) {
  const matrix = correction?.matrix || IDENTITY, destination = projectBox(inverse(matrix) || IDENTITY, sourceBox);
  const corrected = warp(pixels, matrix, correction?.width || pixels.width, correction?.height || pixels.height);
  return extract(normalise(corrected, correction?.threshold || .55), destination);
}

// Each stage yields to support cancellation in browsers where workers cannot start.
export async function analyzeImage(pixels, options = {}, checkpoint = async () => true) {
  const selection = options.region ? asBox(options.region, pixels.width, pixels.height) : null;
  const expected = options.field || null, all = [], seen = new Set();
  const prepared = normalise(pixels);
  if (prepared.empty) {
    const result = { regions: { temperature: null, humidity: null }, values: { temperature: '', humidity: '' }, readings: {}, status: expected ? 'found' : 'unassigned', field: expected };
    if (expected && selection) { result.regions[expected] = options.region; result.readings[expected] = {
      field: expected, value: '', region: options.region, confidence: { unit: 0, numeric: 0 }, correction: { method: 'none', matrix: IDENTITY }, preview: extract(prepared, selection) }; }
    return result;
  }
  async function tryCorrection(correction) {
    if (!await checkpoint()) return false;
    const key = JSON.stringify(correction.matrix);
    if (seen.has(key)) return true; seen.add(key);
    const image = correction.method === 'none' ? pixels : warp(pixels, correction.matrix, correction.width, correction.height);
    const sourceBox = box => projectBox(correction.matrix, box);
    for (const threshold of options.thresholds || [options.threshold || .55]) {
      if (!await checkpoint()) return false;
      const found = detectCandidates(image, threshold);
      const accepted = reading => !selection || overlap(sourceBox(reading.digitBounds), selection) / Math.max(1, sourceBox(reading.digitBounds).width * sourceBox(reading.digitBounds).height) >= .45;
      const readings = found.readings.filter(accepted);
      const units = found.units.filter(unit => !selection || overlap(sourceBox(unit.box), selection) > 0 || readings.some(r => r.field === unit.field && overlap(r.unitBounds, unit.box) > 0));
      const score = readings.length * 20 + units.length * 4;
      all.push({ correction: { ...correction, threshold }, found, readings, units, score });
      if ((selection || options.allowPartial) ? readings.length : new Set(readings.map(r => r.field)).size === 2) break;
    }
    return true;
  }
  const basic = (angle, shear = 0) => ({ matrix: rotation(pixels.width, pixels.height, angle, shear), width: pixels.width, height: pixels.height,
    angle, shear, method: angle || shear ? 'strokes' : 'none' });
  if (!await tryCorrection(basic(options.angle || 0))) return null;
  // Stop once the requested field(s) have complete unit/numeric evidence.
  const complete = () => all.some(c => (selection || options.allowPartial) ? c.readings.length > 0 : new Set(c.readings.map(r => r.field)).size === 2);
  const straight = complete();
  if (!straight) {
    for (const correction of screenCorrections(pixels)) {
      if (complete()) break; if (!await tryCorrection(correction)) return null;
      const last = all.at(-1);
      if (last.readings.length && !complete()) {
        const rectified = warp(pixels, correction.matrix, correction.width, correction.height);
        const angle = strokeAngles(rectified)[0] || 0, shear = strokeShear(rectified, angle);
        if ((angle || shear) && Math.abs(angle) <= 8 && !await tryCorrection({ ...correction,
          matrix: compose(correction.matrix, rotation(correction.width, correction.height, angle, shear)), angle, shear })) return null;
      }
    }
    const angles = [...strokeAngles(pixels), ...Array.from({ length: 11 }, (_, i) => i * 5 - 25)];
    for (const angle of angles) { if (complete()) break; if (!await tryCorrection(basic(angle))) return null; }
  }
  const promising = complete() ? [] : all.filter(c => c.units.length).sort((a, b) => b.score - a.score).slice(0, 2);
  for (const candidate of promising) {
    if (candidate.correction.method === 'perspective') continue;
    const angle = candidate.correction.angle || 0;
    for (const delta of [-2, -1, 1, 2]) { if (complete()) break; if (Math.abs(angle + delta) <= 25 && !await tryCorrection(basic(angle + delta))) return null; }
    const shear = strokeShear(pixels, angle);
    if (!complete() && shear && !await tryCorrection(basic(angle, shear))) return null;
  }
  const result = { regions: { temperature: null, humidity: null }, values: { temperature: '', humidity: '' }, readings: {}, status: 'unassigned', field: expected };
  for (const field of fields) {
    const matches = all.flatMap(candidate => candidate.readings.filter(r => r.field === field).map(reading => ({ candidate, reading })))
      .sort((a, b) => b.candidate.score - a.candidate.score || b.reading.height - a.reading.height);
    const match = matches[0]; if (!match) continue;
    const { candidate, reading } = match, matrix = candidate.correction.matrix;
    const digitBox = projectBox(matrix, reading.digitBounds), unitBox = projectBox(matrix, reading.unitBounds);
    let sourceBox = projectBox(matrix, reading.box);
    if (selection) sourceBox = bounds([selection, digitBox, unitBox], 2);
    const conflicts = matches.some(m => m.reading.value !== reading.value && m.candidate.score >= candidate.score &&
      overlap(projectBox(m.candidate.correction.matrix, m.reading.unitBounds), unitBox) > unitBox.width * unitBox.height * .4);
    const value = conflicts ? '' : reading.value;
    const entry = { field, value, region: cropBox(sourceBox, pixels.width, pixels.height), digitBounds: cropBox(digitBox, pixels.width, pixels.height),
      unitBounds: cropBox(unitBox, pixels.width, pixels.height), confidence: { ...reading.confidence, numeric: conflicts ? 0 : reading.confidence.numeric },
      correction: { ...candidate.correction, sourceWidth: pixels.width, sourceHeight: pixels.height },
      preview: extract(candidate.found.prepared, selection ? projectBox(inverse(matrix), sourceBox) : reading.box) };
    result.regions[field] = entry.region; result.values[field] = value; result.readings[field] = entry;
  }
  if (!selection) { result.status = Object.keys(result.readings).length ? 'found' : 'unassigned'; return result; }
  const identified = fields.filter(field => result.readings[field]);
  const bestUnits = all.slice().sort((a, b) => b.score - a.score)[0]?.units || [];
  const selectedUnits = bestUnits.filter(unit => {
    const candidate = all.find(c => c.units.includes(unit)), box = projectBox(candidate.correction.matrix, unit.box);
    return overlap(box, selection) / Math.max(1, box.width * box.height) > .65;
  });
  // Two units in a user selection require a tighter box, not arbitrary assignment.
  if (identified.length > 1 || new Set(selectedUnits.map(u => u.field)).size > 1) { result.status = 'ambiguous'; result.field = null; return result; }
  let field = identified[0];
  if (!field) {
    const units = all.flatMap(c => c.units.map(unit => ({ candidate: c, unit }))).sort((a, b) => b.candidate.score - a.candidate.score);
    const kinds = [...new Set(units.map(u => u.unit.field))];
    if (kinds.length > 1) { result.status = 'ambiguous'; result.field = null; return result; }
    field = kinds[0] || expected;
    if (field) {
      const best = units.find(u => u.unit.field === field), correction = best?.candidate.correction || basic(options.angle || 0);
      const sourceBox = best ? bounds([selection, projectBox(correction.matrix, best.unit.box)], 2) : selection;
      const binary = normalise(makePreview(pixels, correction, sourceBox)), preview = { width: binary.width, height: binary.height, data: binary.data };
      const glyphs = locateGlyphs(binaryPixels(binary, binary.mask), true).sort((a, b) => a.x - b.x);
      const groups = numericGroups(binary, binary.mask, glyphs)[field];
      const group = groups.sort((a, b) => b.height - a.height)[0], value = best ? '' : group?.value || '';
      const destination = projectBox(inverse(correction.matrix), sourceBox), digits = group ? bounds(group.items) : null;
      const digitBounds = digits ? cropBox(projectBox(correction.matrix, { ...digits, x: digits.x + Math.max(0, Math.floor(destination.x)),
        y: digits.y + Math.max(0, Math.floor(destination.y)) }), pixels.width, pixels.height) : null;
      result.readings[field] = { field, value, region: cropBox(sourceBox, pixels.width, pixels.height), digitBounds, confidence: { unit: best ? best.unit.confidence : 0, numeric: value ? .95 : 0,
        evidence: { unit: best?.unit.unit || 'unreadable', glyphs: group?.items.map(g => g.digit) || [], explicitAssignment: Boolean(expected) } },
        unitBounds: best ? cropBox(projectBox(correction.matrix, best.unit.box), pixels.width, pixels.height) : null,
        correction: { ...correction, sourceWidth: pixels.width, sourceHeight: pixels.height }, preview };
      result.regions[field] = result.readings[field].region; result.values[field] = value;
    }
  }
  if (expected && field && field !== expected) { result.status = 'contradictory'; result.field = expected; return result; }
  result.field = field || null; result.status = field ? 'found' : 'unassigned';
  return result;
}
