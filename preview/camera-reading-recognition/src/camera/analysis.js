import { detectCandidates, locateGlyphs, numericGroups, grayscaleConfidence } from './detection.js';
import { normalise, bounds, extract, binaryPixels } from './image.js';
import { IDENTITY, rotation, warp, projectBox, inverse, screenCorrections, strokeAngles, strokeShear, compose } from './geometry.js';
import { PROCESSING_VARIANTS, combineEvidence, samePosition } from './evidence.js';

export { PROCESSING_VARIANTS } from './evidence.js';
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
  return extract(normalise(corrected, correction?.threshold || .55, correction?.preprocessing), destination);
}

// Each stage yields to support cancellation in browsers where workers cannot start.
export async function analyzeImage(pixels, options = {}, checkpoint = async () => true, onProgress = () => {}) {
  const selection = options.region ? asBox(options.region, pixels.width, pixels.height) : null;
  const expected = options.field || null, all = [], seen = new Set(), rejections = new Set();
  const enlargement = options.refine ? Math.min(4, Math.max(1, 600 / Math.max(pixels.width, pixels.height))) : 1;
  const prepared = normalise(pixels);
  if (prepared.empty) {
    const result = { regions: { temperature: null, humidity: null }, values: { temperature: '', humidity: '' }, readings: {}, status: expected ? 'found' : 'unassigned', field: expected };
    if (expected && selection) { result.regions[expected] = options.region; result.readings[expected] = {
      field: expected, value: '', region: options.region, confidence: { unit: 0, numeric: 0 }, correction: { method: 'none', matrix: IDENTITY }, preview: extract(prepared, selection) }; }
    return result;
  }
  function buildReadings() {
    const result = { currentBand: all.map(c => c.found.currentBand && cropBox(projectBox(c.correction.matrix, asBox(c.found.currentBand, c.correction.width, c.correction.height)), pixels.width, pixels.height)).filter(Boolean).sort((a, b) => b.height - a.height)[0] || null, regions: { temperature: null, humidity: null }, values: { temperature: '', humidity: '' }, readings: {}, rejectionReasons: {}, status: 'unassigned', field: expected };
    for (const field of fields) {
      const matches = all.flatMap(candidate => candidate.readings.filter(r => r.field === field).map(reading => ({ candidate, reading })))
        .filter(m => projectBox(m.candidate.correction.matrix, m.reading.digitBounds).height / pixels.height >= (result.currentBand?.height || 0) * .6)
        .sort((a, b) => (b.reading.confidence.numeric + b.reading.confidence.unit * .15) - (a.reading.confidence.numeric + a.reading.confidence.unit * .15) || b.reading.height - a.reading.height);
      const match = matches[0]; if (!match) continue;
      const { candidate, reading } = match, matrix = candidate.correction.matrix;
      const digitBox = projectBox(matrix, reading.digitBounds), unitBox = projectBox(matrix, reading.unitBounds);
      let sourceBox = projectBox(matrix, reading.box);
      if (selection) sourceBox = bounds([selection, digitBox, unitBox], 2);
      const conflicts = matches.some(m => m.reading.value !== reading.value && m.reading.confidence.numeric >= reading.confidence.numeric - .04 &&
        samePosition(projectBox(m.candidate.correction.matrix, m.reading.digitBounds), digitBox));
      const ambiguous = reading.confidence.evidence?.assignment === 'same-display-humidity' && matches.some(m => m.reading.value !== reading.value && !samePosition(projectBox(m.candidate.correction.matrix, m.reading.digitBounds), digitBox));
      const support = new Set(matches.filter(m => m.reading.value === reading.value && samePosition(projectBox(m.candidate.correction.matrix, m.reading.digitBounds), digitBox)).map(m => m.candidate.correction.preprocessing + ':' + m.candidate.correction.threshold));
      const weakCorrection = candidate.correction.method !== 'none' && support.size < 2;
      const value = conflicts || ambiguous || weakCorrection ? '' : reading.value;
      const entry = { field, value, region: cropBox(sourceBox, pixels.width, pixels.height), digitBounds: cropBox(digitBox, pixels.width, pixels.height),
        unitBounds: cropBox(unitBox, pixels.width, pixels.height), confidence: { ...reading.confidence, numeric: conflicts || ambiguous || weakCorrection ? 0 : reading.confidence.numeric },
        rejectionReason: conflicts ? 'conflicting-digits' : ambiguous ? 'ambiguous-temperature' : weakCorrection ? 'insufficient-variant-support' : null,
        correction: { ...candidate.correction, sourceWidth: pixels.width, sourceHeight: pixels.height },
        preview: extract(candidate.found.prepared, selection ? projectBox(inverse(matrix), sourceBox) : reading.box) };
      result.regions[field] = entry.region; result.values[field] = value; result.readings[field] = entry;
    }
    result.status = Object.keys(result.readings).length ? 'found' : 'unassigned';
    if (!result.values.temperature) result.rejectionReasons.temperature = result.readings.temperature?.rejectionReason || [...rejections].find(r => r === 'unsupported-fahrenheit' || r === 'missing-decimal' || r === 'missing-fraction') || 'unreadable-temperature';
    if (!result.values.humidity) result.rejectionReasons.humidity = result.readings.humidity?.rejectionReason || 'unreadable-humidity';
    return result;
  }
  async function tryCorrection(correction) {
    if (!await checkpoint()) return false;
    const scale = correction.native ? 1 : Math.min(enlargement, 800 / Math.max(correction.width, correction.height));
    if (scale !== 1) correction = { ...correction,
      matrix: compose(correction.matrix, [1 / scale, 0, 0, 0, 1 / scale, 0, 0, 0, 1]),
      width: Math.max(1, Math.round(correction.width * scale)), height: Math.max(1, Math.round(correction.height * scale)) };
    const key = JSON.stringify(correction.matrix);
    if (seen.has(key)) return true; seen.add(key);
    const image = correction.method === 'none' && scale === 1 ? pixels : warp(pixels, correction.matrix, correction.width, correction.height);
    const sourceBox = box => projectBox(correction.matrix, box);
    const variants = options.preprocessing || options.thresholds || options.threshold ? (options.preprocessing || ['adaptive', 'denoised', 'gentle']).flatMap(preprocessing => (options.thresholds || [options.threshold || (preprocessing === 'denoised' ? .7 : .55)]).map(threshold => ({ preprocessing, threshold }))) : PROCESSING_VARIANTS;
    const local = [];
    for (const { preprocessing, threshold } of variants) {
      if (!await checkpoint()) return false;
      const found = detectCandidates(image, threshold, preprocessing);
      const accepted = reading => !selection || overlap(sourceBox(reading.digitBounds), selection) / Math.max(1, sourceBox(reading.digitBounds).width * sourceBox(reading.digitBounds).height) >= .45;
      const readings = found.readings.filter(accepted);
      const units = found.units.filter(unit => !selection || overlap(sourceBox(unit.box), selection) > 0 || readings.some(r => r.field === unit.field && overlap(r.unitBounds, unit.box) > 0));
      const score = readings.length * 20 + units.length * 4;
      const candidate = { correction: { ...correction, threshold, preprocessing }, found, readings, units, score, threshold, preprocessing };
      all.push(candidate); local.push(candidate);
    }
    reportProgress(); // Preserve validated humidity before a fraction search.
    if (!local.some(c => c.readings.some(r => r.field === 'temperature')) || options.requiredField === 'temperature') {
      const combined = await combineEvidence(image, local, checkpoint, { expected, selection: selection && projectBox(inverse(correction.matrix), selection) });
      if (!combined) return false;
      if (!combined.length) rejections.add(combined.rejectionReason);
      for (const reading of combined) if (acceptedCombined(reading)) {
        const candidate = reading.variant;
        all.push({ ...candidate, readings: [reading] });
      }
    }
    reportProgress();
    return true;
    function acceptedCombined(reading) { return !selection || overlap(sourceBox(reading.digitBounds), selection) / Math.max(1, sourceBox(reading.digitBounds).width * sourceBox(reading.digitBounds).height) >= .45; }
    function reportProgress() {
      const selectedFields = new Set(all.flatMap(c => c.units.map(u => u.field)));
      if (!selection || selectedFields.size <= 1 && (!expected || ![...selectedFields].some(field => field !== expected))) onProgress(buildReadings());
    }
  }
  const basic = (angle, shear = 0) => ({ matrix: rotation(pixels.width, pixels.height, angle, shear), width: pixels.width, height: pixels.height,
    angle, shear, method: angle || shear ? 'strokes' : 'none' });
  // Stop once the requested field(s) have complete unit/numeric evidence.
  const complete = () => { const result = buildReadings(); return options.requiredField ? Boolean(result.values[options.requiredField]) :
    selection ? Boolean(expected ? result.values[expected] : Object.values(result.values).some(Boolean)) : Boolean(result.values.temperature && result.values.humidity); };
  // Larger native display crops need no enlargement; keep their faint fraction
  // and decimal intact before trying a resampled geometric correction.
  if (options.refine && Math.max(pixels.width, pixels.height) > 400 && !await tryCorrection({ ...basic(0), native: true })) return null;
  if (!complete() && !await tryCorrection(basic(0))) return null;
  const straight = complete();
  if (!straight && !options.quick) {
    if (options.angle && !await tryCorrection(basic(options.angle))) return null;
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
    const angles = strokeAngles(pixels).slice(0, 4);
    for (const angle of angles) { if (complete()) break; if (!await tryCorrection(basic(angle))) return null; }
  }
  const promising = complete() || options.quick ? [] : all.filter(c => c.units.length).sort((a, b) => b.score - a.score).slice(0, 2);
  for (const candidate of promising) {
    if (candidate.correction.method === 'perspective') continue;
    const angle = candidate.correction.angle || 0;
    for (const delta of [-2, -1, 1, 2]) { if (complete()) break; if (Math.abs(angle + delta) <= 25 && !await tryCorrection(basic(angle + delta))) return null; }
    const shear = strokeShear(pixels, angle);
    if (!complete() && shear && !await tryCorrection(basic(angle, shear))) return null;
  }
  const result = buildReadings();
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
      const best = units.find(u => u.unit.field === field);
      // Unit-only angle guesses are not sufficient to rotate an unresolved crop.
      const correction = { ...basic(0), preprocessing: 'gentle' };
      const unitBox = best ? projectBox(best.candidate.correction.matrix, best.unit.box) : null;
      const sourceBox = best ? bounds([selection, unitBox], 2) : selection;
      const prepared = normalise(pixels, .55, 'gentle'), preview = extract(prepared, sourceBox);
      const binary = extract(binaryPixels(prepared, prepared.mask), sourceBox);
      const mask = Uint8Array.from({length: binary.width * binary.height}, (_, i) => binary.data[i * 4] < 128 ? 1 : 0);
      const raw = extract(pixels, sourceBox);
      const glyphs = locateGlyphs(binary, true).filter(g => grayscaleConfidence(raw, g) > 0).sort((a, b) => a.x - b.x);
      const groups = numericGroups(binary, mask, glyphs)[field];
      const group = groups.sort((a, b) => b.height - a.height)[0], value = best ? '' : group?.value || '';
      const destination = projectBox(inverse(correction.matrix), sourceBox), digits = group ? bounds(group.items) : null;
      const digitBounds = digits ? cropBox(projectBox(correction.matrix, { ...digits, x: digits.x + Math.max(0, Math.floor(destination.x)),
        y: digits.y + Math.max(0, Math.floor(destination.y)) }), pixels.width, pixels.height) : null;
      result.readings[field] = { field, value, region: cropBox(sourceBox, pixels.width, pixels.height), digitBounds, confidence: { unit: best ? best.unit.confidence : 0, numeric: value ? .95 : 0,
        evidence: { unit: best?.unit.unit || 'unreadable', glyphs: group?.items.map(g => g.digit) || [], explicitAssignment: Boolean(expected) } },
        unitBounds: best ? cropBox(unitBox, pixels.width, pixels.height) : null,
        rejectionReason: best ? 'unreadable-digits' : 'unreadable-unit-or-digits',
        correction: { ...correction, sourceWidth: pixels.width, sourceHeight: pixels.height }, preview };
      result.regions[field] = result.readings[field].region; result.values[field] = value;
    }
  }
  if (expected && field && field !== expected) { result.status = 'contradictory'; result.field = expected; return result; }
  result.field = field || null; result.status = field ? 'found' : 'unassigned';
  return result;
}
