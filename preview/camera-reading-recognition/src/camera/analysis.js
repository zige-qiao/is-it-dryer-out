import { detectCandidates, locateGlyphs, numericGroups, grayscaleConfidence, validateTemperatureGroup } from './detection.js';
import { normalise, bounds, extract, binaryPixels, components } from './image.js';
import { IDENTITY, rotation, correctedPixels, projectBox, inverse, compose } from './geometry.js';
import { PROCESSING_VARIANTS, PERSPECTIVE_REFINEMENT_VARIANT, combineEvidence, samePosition } from './evidence.js';
import { prepareOrientation } from './orientation.js';
import { runWithRecognitionBudget } from './budget.js';

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
  const corrected = correctedPixels(pixels, { ...correction, matrix, width: correction?.width || pixels.width, height: correction?.height || pixels.height });
  return extract(normalise(corrected, correction?.threshold || .55, correction?.preprocessing), destination);
}

// Each stage yields to support cancellation in browsers where workers cannot start.
export async function analyzeImage(pixels, options = {}, checkpoint = async () => true, onProgress = () => {}) {
  const guarded = work => runWithRecognitionBudget(checkpoint.check, work);
  const preparation = options.hypotheses ? { hypotheses: options.hypotheses, orientation: options.orientation } : guarded(() => prepareOrientation(pixels, options));
  const hypotheses = preparation.hypotheses, evaluatedIds = new Set(), nativeComplete = new Map();
  const credibleIds = preparation.orientation?.credibleIds || hypotheses.map(h => h.id);
  const selection = options.region ? asBox(options.region, pixels.width, pixels.height) : null;
  const expected = options.field || null, all = [], seen = new Set(), rejections = new Set();
  const enlargement = options.refine ? Math.min(4, Math.max(1, 600 / Math.max(pixels.width, pixels.height))) : 1;
  const prepared = guarded(() => normalise(pixels));
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
      const hasSupport = m => m.candidate.correction.method === 'none' || new Set(matches.filter(other =>
        other.candidate.correction.id === m.candidate.correction.id && other.reading.value === m.reading.value &&
        samePosition(projectBox(other.candidate.correction.matrix, other.reading.digitBounds), projectBox(m.candidate.correction.matrix, m.reading.digitBounds)))
        .map(other => other.candidate.correction.preprocessing + ':' + other.candidate.correction.threshold)).size >= 2;
      // An unvalidated one-variant hypothesis cannot withdraw a validated field.
      // Credible orientations still all finish before any value is published.
      const validated = matches.filter(hasSupport);
      const match = validated[0] || matches[0]; if (!match) continue;
      const { candidate, reading } = match, matrix = candidate.correction.matrix;
      const digitBox = projectBox(matrix, reading.digitBounds), unitBox = projectBox(matrix, reading.unitBounds);
      let sourceBox = projectBox(matrix, reading.box);
      if (selection) sourceBox = bounds([selection, digitBox, unitBox], 2);
      const conflicts = validated.some(m => (m.reading.value !== reading.value || m.candidate.correction.id !== candidate.correction.id && (!samePosition(projectBox(m.candidate.correction.matrix, m.reading.digitBounds), digitBox) || m.reading.confidence.evidence?.assignment !== reading.confidence.evidence?.assignment)) && (m.candidate.correction.id !== candidate.correction.id || m.reading.confidence.numeric >= reading.confidence.numeric - .04) &&
        (m.candidate.correction.id !== candidate.correction.id || samePosition(projectBox(m.candidate.correction.matrix, m.reading.digitBounds), digitBox)));
      const ambiguous = reading.confidence.evidence?.assignment === 'same-display-humidity' && validated.some(m => m.reading.value !== reading.value && !samePosition(projectBox(m.candidate.correction.matrix, m.reading.digitBounds), digitBox));
      const weakCorrection = !hasSupport(match);
      const orientationResolved = credibleIds.every(id => evaluatedIds.has(id));
      const value = conflicts || ambiguous || weakCorrection || !orientationResolved ? '' : reading.value;
      const entry = { field, value, region: cropBox(sourceBox, pixels.width, pixels.height), digitBounds: cropBox(digitBox, pixels.width, pixels.height),
        unitBounds: cropBox(unitBox, pixels.width, pixels.height), confidence: { ...reading.confidence, numeric: conflicts || ambiguous || weakCorrection ? 0 : reading.confidence.numeric },
        rejectionReason: conflicts ? 'conflicting-digits' : ambiguous ? 'ambiguous-temperature' : weakCorrection ? 'insufficient-variant-support' : null,
        correction: { ...candidate.correction, orientationResolved: orientationResolved && Boolean(value), sourceWidth: pixels.width, sourceHeight: pixels.height },
        preview: guarded(() => extract(candidate.found.prepared, selection ? projectBox(inverse(matrix), sourceBox) : reading.box)) };
      result.regions[field] = entry.region; result.values[field] = value; result.readings[field] = entry;
    }
    result.status = Object.keys(result.readings).length ? 'found' : 'unassigned';
    result.orientation = { state: credibleIds.every(id => evaluatedIds.has(id)) ? (Object.values(result.readings).some(e => e.rejectionReason === 'conflicting-digits') ? 'conflicted' : 'resolved') : 'pending', credibleIds, evaluatedIds: [...evaluatedIds], resolvedFields: Object.fromEntries(fields.map(field => [field, Boolean(result.values[field])])) };
    if (!result.values.temperature) result.rejectionReasons.temperature = result.readings.temperature?.rejectionReason || [...rejections].find(r => r === 'unsupported-fahrenheit' || r === 'missing-decimal' || r === 'missing-fraction' || r === 'unreadable-fraction-cell') || 'unreadable-temperature';
    if (!result.values.humidity) result.rejectionReasons.humidity = result.readings.humidity?.rejectionReason || 'unreadable-humidity';
    return result;
  }
  async function tryCorrection(correction) {
    if (!await checkpoint()) return false;
    const scale = correction.native ? 1 : Math.min(enlargement, 800 / Math.max(correction.width, correction.height));
    if (scale !== 1) correction = { ...correction,
      cardinal: false,
      matrix: compose(correction.matrix, [1 / scale, 0, 0, 0, 1 / scale, 0, 0, 0, 1]),
      width: Math.max(1, Math.round(correction.width * scale)), height: Math.max(1, Math.round(correction.height * scale)) };
    const key = JSON.stringify(correction.matrix);
    if (seen.has(key)) return true; seen.add(key);
    const unchanged = correction.width === pixels.width && correction.height === pixels.height && correction.matrix.every((v,i)=>v===IDENTITY[i]);
    const image = unchanged ? pixels : guarded(() => correctedPixels(pixels, correction));
    const sourceBox = box => projectBox(correction.matrix, box);
    const variants = [...(options.preprocessing || options.thresholds || options.threshold ? (options.preprocessing || ['adaptive', 'denoised', 'gentle']).flatMap(preprocessing => (options.thresholds || [options.threshold || (preprocessing === 'denoised' ? .7 : .55)]).map(threshold => ({ preprocessing, threshold }))) : PROCESSING_VARIANTS)];
    const local = [];
    for (const { preprocessing, threshold } of variants) {
      if (!await checkpoint()) return false;
      const found = guarded(() => detectCandidates(image, threshold, preprocessing, { sourceEvidence: { pixels, matrix: correction.matrix } }));
      const accepted = reading => !selection || overlap(sourceBox(reading.digitBounds), selection) / Math.max(1, sourceBox(reading.digitBounds).width * sourceBox(reading.digitBounds).height) >= .45;
      const readings = found.readings.filter(accepted);
      const units = found.units.filter(unit => !selection || overlap(sourceBox(unit.box), selection) > 0 || readings.some(r => r.field === unit.field && overlap(r.unitBounds, unit.box) > 0));
      const score = readings.length * 20 + units.length * 4;
      const candidate = { correction: { ...correction, threshold, preprocessing }, found, readings, units, score, threshold, preprocessing };
      all.push(candidate); local.push(candidate);
      reportProgress();
      // A faint perspective LCD can retain its fraction only after rejecting
      // more of the local background. Obtain a second preprocessing family at
      // the same geometry; native cell validation still controls acceptance.
      if (correction.method === 'perspective' && local.length === PROCESSING_VARIANTS.length &&
        local.filter(c => c.readings.some(r => r.field === 'temperature')).length === 1 &&
        !options.preprocessing && !options.thresholds && !options.threshold) variants.push(PERSPECTIVE_REFINEMENT_VARIANT);
      const requested = options.requiredField ? [options.requiredField] : expected ? [expected] : fields;
      if (local.length >= 2 && requested.every(field => matchingLocalField(field))) break;
    }
    reportProgress(); // Preserve validated humidity before a fraction search.
    if (!matchingLocalField('temperature')) {
      const combined = await combineEvidence(image, local, checkpoint, { expected, selection: selection && projectBox(inverse(correction.matrix), selection), sourceEvidence: { pixels, matrix: correction.matrix } });
      if (!combined) return false;
      if (!combined.length) rejections.add(combined.rejectionReason);
      for (const reading of combined) if (acceptedCombined(reading)) {
        const candidate = reading.variant;
        all.push({ ...candidate, readings: [reading] });
      }
    }
    reportProgress();
    const requested = options.requiredField ? [options.requiredField] : expected ? [expected] : fields;
    nativeComplete.set(correction.id, requested.every(field => matchingLocalField(field) || correction.method === 'none' && local.some(c=>c.readings.some(r=>r.field===field&&r.value))));
    return true;
    function matchingLocalField(field) {
      const readings=local.flatMap(c=>c.readings.filter(r=>r.field===field).map(reading=>({reading,candidate:c})));
      return readings.some(a=>readings.some(b=>a.candidate!==b.candidate&&a.reading.value&&a.reading.value===b.reading.value&&samePosition(a.reading.digitBounds,b.reading.digitBounds)&&a.reading.confidence.evidence?.assignment===b.reading.confidence.evidence?.assignment));
    }
    function acceptedCombined(reading) { return !selection || overlap(sourceBox(reading.digitBounds), selection) / Math.max(1, sourceBox(reading.digitBounds).width * sourceBox(reading.digitBounds).height) >= .45; }
    function reportProgress() {
      const selectedFields = new Set(all.flatMap(c => c.units.map(u => u.field)));
      if (credibleIds.every(id => evaluatedIds.has(id)) && (!selection || selectedFields.size <= 1 && (!expected || ![...selectedFields].some(field => field !== expected)))) onProgress(guarded(buildReadings));
    }
  }
  const basic = (angle, shear = 0) => ({ matrix: rotation(pixels.width, pixels.height, angle, shear), width: pixels.width, height: pixels.height,
    angle, shear, method: angle || shear ? 'strokes' : 'none' });
  // Larger native display crops need no enlargement; keep their faint fraction
  // and decimal intact before trying a resampled geometric correction.
  for (const hypothesis of hypotheses) {
    if (!credibleIds.includes(hypothesis.id)) continue;
    if (selection && options.refine && enlargement > 1 && !hypothesis.native) {
      if (!await tryCorrection({ ...hypothesis, native: true })) return null;
      if (!nativeComplete.get(hypothesis.id) && !await tryCorrection(hypothesis)) return null;
    } else if (!await tryCorrection(hypothesis)) return null;
    evaluatedIds.add(hypothesis.id);
  }
  const result = guarded(buildReadings);
  if (await checkpoint()) onProgress(result);
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
      const prepared = guarded(() => normalise(pixels, .55, 'gentle')), preview = guarded(() => extract(prepared, sourceBox));
      const binary = guarded(() => extract(binaryPixels(prepared, prepared.mask), sourceBox));
      const mask = Uint8Array.from({length: binary.width * binary.height}, (_, i) => binary.data[i * 4] < 128 ? 1 : 0);
      const raw = guarded(() => extract(pixels, sourceBox));
      const located = guarded(() => locateGlyphs(binary, true));
      const glyphs = guarded(() => located.filter(g => grayscaleConfidence(raw, g, located) > 0).sort((a, b) => a.x - b.x));
      const rawObstructions = guarded(() => components(mask, binary.width, binary.height).filter(c => c.height >= 7 && c.width >= 2 && c.width / c.height >= .06 && c.width / c.height <= 1.05 && c.count / (c.width * c.height) < .8).map(c => ({ ...c, rawComponent: true })));
      const groups = guarded(() => numericGroups(binary, mask, glyphs, [...located, ...rawObstructions]))[field];
      const group = groups.filter(g => field !== 'temperature' || guarded(() => validateTemperatureGroup(raw, g, { rawMask: normalise(raw).mask }))).sort((a, b) => b.height - a.height)[0], value = best || result.orientation?.state !== 'resolved' || credibleIds.length !== 1 ? '' : group?.value || '';
      const destination = projectBox(inverse(correction.matrix), sourceBox), digits = group ? bounds(group.items) : null;
      const digitBounds = digits ? cropBox(projectBox(correction.matrix, { ...digits, x: digits.x + Math.max(0, Math.floor(destination.x)),
        y: digits.y + Math.max(0, Math.floor(destination.y)) }), pixels.width, pixels.height) : null;
      result.readings[field] = { field, value, region: cropBox(sourceBox, pixels.width, pixels.height), digitBounds, confidence: { unit: best ? best.unit.confidence : 0, numeric: value ? .95 : 0,
        evidence: { unit: best?.unit.unit || 'unreadable', glyphs: group?.items.map(g => g.digit) || [], explicitAssignment: Boolean(expected) } },
        unitBounds: best ? cropBox(unitBox, pixels.width, pixels.height) : null,
        rejectionReason: best ? 'unreadable-digits' : 'unreadable-unit-or-digits',
        correction: { ...correction, sourceWidth: pixels.width, sourceHeight: pixels.height }, preview };
      result.regions[field] = result.readings[field].region; result.values[field] = value;
      if(result.orientation?.state==='resolved') result.orientation.resolvedFields[field]=Boolean(value);
    }
  }
  if (expected && field && field !== expected) { result.status = 'contradictory'; result.field = expected; return result; }
  result.field = field || null; result.status = field ? 'found' : 'unassigned';
  return result;
}
