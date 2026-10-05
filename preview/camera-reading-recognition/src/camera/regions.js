import { components, bounds } from './image.js';
import { detectCandidates, digitPairs } from './detection.js';
import { samePosition } from './evidence.js';
import { compose, IDENTITY } from './geometry.js';

const intersection = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
export function boundedRegion(box, width, height, padding = 0) {
  const x = Math.max(0, Math.min(width - 1, Math.floor(box.x - padding))), y = Math.max(0, Math.min(height - 1, Math.floor(box.y - padding)));
  return { x: x / width, y: y / height, width: Math.max(1, Math.min(width, Math.ceil(box.x + box.width + padding)) - x) / width,
    height: Math.max(1, Math.min(height, Math.ceil(box.y + box.height + padding)) - y) / height };
}

// Proposals are made on raw luminance first. Thresholded glyphs only supplement
// them; a visible LCD edge is never required and a rectangle alone is not a reading.
export function proposeRegions(pixels) {
  const { width, height, data } = pixels, gray = new Uint8Array(width * height), histogram = new Uint32Array(256), raw = [];
  for (let i = 0; i < gray.length; i++) { const v = Math.round(.299 * data[i * 4] + .587 * data[i * 4 + 1] + .114 * data[i * 4 + 2]); gray[i] = v; histogram[v]++; }
  for (const fraction of [.2, .4, .6, .8]) {
    let level = 0, count = 0; while (level < 255 && count < gray.length * fraction) count += histogram[level++];
    for (const bright of [false, true]) {
      const mask = Uint8Array.from(gray, value => bright ? Number(value > level) : Number(value < level));
      for (const item of components(mask, width, height)) {
        const area = item.width * item.height, aspect = item.width / item.height;
        if (area < gray.length * .0015 || area > gray.length * .7 || aspect < 1.4 || aspect > 5 ||
          item.count / area < .55 || item.height < 14 || item.x <= 1 || item.y <= 1 || item.x + item.width >= width - 1 || item.y + item.height >= height - 1) continue;
        raw.push({ box: item, score: 1, kind: 'display' });
      }
    }
  }
  // Broad raw colour groups preserve faint LCD edges which may not form a
  // luminance silhouette against a black case or a similarly bright background.
  for (const offset of [0, 16]) {
    const colours = new Map();
    for (let i = 0; i < gray.length; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      const key = `${Math.floor((g - r + 128 + offset) / 32)},${Math.floor((b - r + 128 + offset) / 32)}`;
      if (!colours.has(key)) colours.set(key, []); colours.get(key).push(i);
    }
    for (const indices of colours.values()) {
      if (indices.length < 50) continue;
      const mask = new Uint8Array(gray.length); for (const i of indices) mask[i] = 1;
      for (const item of components(mask, width, height)) {
        const area = item.width * item.height, ratio = item.width / item.height;
        if (area < gray.length * .0015 || area > gray.length * .7 || ratio < 1.4 || ratio > 5 ||
          item.height < 14 || item.count / area < .6 || item.x <= 1 || item.y <= 1 || item.x + item.width >= width - 1 || item.y + item.height >= height - 1) continue;
        raw.push({ box: item, score: 3, kind: 'display' });
      }
    }
  }
  for (const delta of [4, 8, 16, 24]) {
    const mask = Uint8Array.from(gray, (_, i) => Number(data[i * 4 + 1] - data[i * 4] > delta && data[i * 4 + 1] >= data[i * 4 + 2] - 12));
    for (const item of components(mask, width, height, 1)) {
      const area = item.width * item.height, ratio = item.width / item.height;
      if (area < gray.length * .0015 || area > gray.length * .7 || ratio < 1.1 || ratio > 5 || item.height < 14 || item.count / area < .5) continue;
      raw.push({ box: item, score: 5, kind: 'display' });
    }
  }
  const evidence = detectCandidates(pixels), softer = detectCandidates(pixels, .4);
  for (const unit of softer.units) if (!evidence.units.some(u => u.field === unit.field && intersection(u.box, unit.box) > Math.min(u.box.width * u.box.height, unit.box.width * unit.box.height) * .7)) evidence.units.push(unit);
  for (const glyph of softer.glyphs) if (!evidence.glyphs.some(g => g.digit === glyph.digit && intersection(g, glyph) > Math.min(g.width * g.height, glyph.width * glyph.height) * .8)) evidence.glyphs.push(glyph);
  const pairs = digitPairs(evidence.glyphs);
  const currentBand = [evidence.currentBand, softer.currentBand].filter(Boolean).sort((a, b) => b.height - a.height)[0] || null;
  const band = currentBand && { x: currentBand.x * width, y: currentBand.y * height, width: currentBand.width * width, height: currentBand.height * height };
  for (const proposal of raw) {
    const contains = b => intersection(proposal.box, b) / (b.width * b.height) > .7;
    if (band && contains(band)) proposal.score += 40;
    proposal.score += evidence.units.filter(u => contains(u.box)).length * 8 + pairs.filter(g => contains(bounds(g.items))).length * 2;
  }
  const supplemental = [];
  for (const u of evidence.units) {
    const h = u.box.height, b = u.box;
    const box = u.field === 'temperature' ? { x: b.x - h * 7, y: b.y - h, width: h * 16, height: h * 6 }
      : { x: b.x - h * 8, y: b.y - h * 3, width: h * 10, height: h * 5 };
    if (pairs.some(p => intersection(box, bounds(p.items)) > 0 && p.items.some(g => g.digit !== '1')))
      supplemental.push({ box, score: 8, kind: 'unit' });
  }
  for (const p of pairs) {
    if (p.height < Math.max(10, (band?.height || 0) * .6) || p.items.every(g => g.digit === '1')) continue;
    const b = bounds(p.items), related = evidence.units.some(u => u.box.x >= b.x + b.width - p.height * .2 &&
      u.box.x <= b.x + b.width + p.height * 1.3 && u.box.y >= b.y - p.height * .3 && u.box.y <= b.y + p.height);
    supplemental.push({ box: { x: b.x - p.height * .25, y: b.y - p.height * .25,
      width: b.width + p.height * 1.6, height: b.height + p.height * .5 }, score: related ? 12 : 7, kind: 'strokes' });
  }
  const result = [];
  for (const proposal of [...raw, ...supplemental].sort((a, b) => b.score - a.score || a.box.width * a.box.height - b.box.width * b.box.height)) {
    // Raw LCD interiors already include their digits. Avoid pulling the dark
    // bezel into the crop where a vertical edge could masquerade as a one.
    const region = boundedRegion(proposal.box, width, height, proposal.kind === 'display' ? proposal.box.height * .025 : 0);
    if (region.width < .01 || region.height < .01 || result.some(r => {
      const overlap = intersection(region, r.region), a = region.width * region.height, b = r.region.width * r.region.height;
      return overlap / (a + b - overlap) > .7 || (r.kind === proposal.kind && overlap / Math.min(a, b) > .85);
    })) continue;
    if (band && proposal.kind !== 'display' && intersection(proposal.box, band) === 0) continue;
    result.push({ region, kind: proposal.kind, currentBand }); if (result.length === 4) break;
  }
  return result;
}

// Local correction coordinates compose through the raw source crop back to the photo.
export function mapRegionalResult(result, crop, pixels, source) {
  if (!result) return result;
  const map = b => b && ({ x: crop.x + b.x * crop.width, y: crop.y + b.y * crop.height, width: b.width * crop.width, height: b.height * crop.height });
  const mapped = { ...result, currentBand: map(result.currentBand), regions: {}, readings: {} };
  const matrix = [crop.width * source.width / pixels.width, 0, crop.x * source.width, 0,
    crop.height * source.height / pixels.height, crop.y * source.height, 0, 0, 1];
  for (const field of ['temperature', 'humidity']) {
    mapped.regions[field] = map(result.regions?.[field]);
    const e = result.readings?.[field]; if (!e) continue;
    mapped.readings[field] = { ...e, region: map(e.region), digitBounds: map(e.digitBounds), unitBounds: map(e.unitBounds),
      correction: { ...e.correction, matrix: compose(matrix, e.correction?.matrix || IDENTITY), sourceWidth: source.width, sourceHeight: source.height,
        sourceRegion: crop, analysisWidth: pixels.width, analysisHeight: pixels.height } };
  }
  return mapped;
}

export function mergeResults(results) {
  const output = { regions: { temperature: null, humidity: null }, values: { temperature: '', humidity: '' }, readings: {}, status: 'unassigned', field: null };
  const bands = results.map(r => r?.currentBand).filter(Boolean);
  const credibleDisplays = new Set(results.flatMap(r => r?.orientation?.credibleDisplayIds || []));
  for (const field of ['temperature', 'humidity']) {
    const entries = results.filter(r => !r?.orientation || r.orientation.resolvedFields?.[field] || r.orientation.state !== 'pending').map(r => r?.readings?.[field] && ({ ...r.readings[field], displayId: r.readings[field].displayId || r.displayId })).filter(e => {
      if (!e?.digitBounds) return Boolean(e);
      const b = e.digitBounds;
      const related = bands.filter(band => b.x < band.x + band.width * 3 && b.x + b.width > band.x - band.width * 2 &&
        b.y >= band.y - band.height * .3 && b.y <= band.y + band.height * 2.5);
      return b.height >= Math.max(0, ...related.map(band => band.height)) * .6;
    });
    const quality = e => (e.confidence?.numeric || 0) + (e.confidence?.unit || 0) * .15;
    const best = entries.filter(e => e.value).sort((a, b) => quality(b) - quality(a))[0] || entries[0]; if (!best) continue;
    const withdrawn = entries.some(e => e.rejectionReason === 'conflicting-digits' && (!e.digitBounds || !best.digitBounds || samePosition(e.digitBounds, best.digitBounds)));
    const displayConflict = entries.some(a => a.value && credibleDisplays.has(a.displayId) && entries.some(b => b.value && a.displayId !== b.displayId && credibleDisplays.has(b.displayId) &&
      (a.value !== b.value || !a.digitBounds || !b.digitBounds || !samePosition(a.digitBounds, b.digitBounds))));
    const conflict = withdrawn || displayConflict || entries.some(e => e.value && best.value && e.value !== best.value &&
      (!e.digitBounds || !best.digitBounds || samePosition(e.digitBounds, best.digitBounds)) && (e.confidence?.numeric || 0) >= (best.confidence?.numeric || 0) - .04);
    const ambiguous = field === 'temperature' && best.confidence?.evidence?.assignment === 'same-display-humidity' &&
      entries.some(e => e.value && e.value !== best.value && e.digitBounds && best.digitBounds && !samePosition(e.digitBounds, best.digitBounds));
    output.readings[field] = conflict || ambiguous ? { ...best, value: '', rejectionReason: ambiguous ? 'ambiguous-temperature' : 'conflicting-digits', confidence: { ...best.confidence, numeric: 0 },
      correction: best.correction && { ...best.correction, orientationResolved: false } } : best;
    output.regions[field] = best.region; output.values[field] = conflict || ambiguous ? '' : best.value;
  }
  if (Object.keys(output.readings).length) output.status = 'found';
  const oriented = results.filter(r => r?.orientation);
  if (oriented.length) output.orientation = { state: oriented.some(r => r.orientation.state === 'pending') ? 'pending' : Object.values(output.readings).some(e => e.rejectionReason === 'conflicting-digits') ? 'conflicted' : 'resolved',
    credibleIds: [...new Set(oriented.flatMap(r => r.orientation.credibleIds || []))], credibleDisplayIds: [...credibleDisplays], evaluatedIds: [...new Set(oriented.flatMap(r => r.orientation.evaluatedIds || []))], resolvedFields: Object.fromEntries(['temperature','humidity'].map(field => [field, Boolean(output.values[field])])) };
  return output;
}

export function humiditySearchRegion(result, source) {
  const box = result?.values?.humidity && result.readings?.humidity?.digitBounds;
  if (!box) return null;
  const h = box.height * source.height;
  return boundedRegion({ x: box.x * source.width - h * 4, y: box.y * source.height - h * .25,
    width: box.width * source.width + h * 8, height: h * 1.5 }, source.width, source.height);
}
