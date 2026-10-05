import { INDOOR_LIMITS } from '../config.js';
import { readSegmentedDigits } from './segments.js';
import { components, binaryPixels, bounds, normalise } from './image.js';
import { locateUnits } from './units.js';
import { validateFractionCell } from './cell-validator.js';
import { checkRecognitionBudget } from './budget.js';

export function validateTemperatureGroup(pixels, group, options = {}) {
  return validateFractionCell(pixels, group, options);
}

const SEGMENT_PATTERNS = ['1111110', '0110000', '1101101', '1111001', '0110011', '1011011', '1011111', '1110000', '1111111', '1111011'];
export function grayscaleConfidence(pixels, glyph, neighbours = []) {
  // A full-width glyph cannot be a narrow LCD one. Thresholding can leave
  // only a vertical fragment of a five while its other strokes define bounds.
  if (glyph.digit === '1') {
    if (glyph.width / glyph.height >= .3) return 0;
    // Check the original cell to the left of the vertical fragment. A faint
    // three can lose its horizontal bars during thresholding and look like one.
    const sample = (x, y) => {
      const xx = Math.max(0, Math.min(pixels.width - 1, Math.round(x))), yy = Math.max(0, Math.min(pixels.height - 1, Math.round(y)));
      const p = (yy * pixels.width + xx) * 4;
      return .299 * pixels.data[p] + .587 * pixels.data[p + 1] + .114 * pixels.data[p + 2];
    };
    const cellLeft = Math.max(glyph.x - glyph.height * .5, ...neighbours.filter(g => g !== glyph &&
      g.x + g.width <= glyph.x && g.height >= glyph.height * .7 && Math.abs(g.y - glyph.y) < glyph.height * .2)
      .map(g => g.x + g.width + glyph.height * .04));
    const stroke = [.27,.73].map(y => sample(glyph.x + glyph.width * .5, glyph.y + glyph.height * y));
    const background = [.27,.73].map(y => sample(glyph.x - glyph.height * .2, glyph.y + glyph.height * y));
    const minimumContrast = Math.max(8, (Math.max(...background) - Math.min(...stroke)) * .15);
    if (background.some((b,i) => b - stroke[i] < minimumContrast)) return 0;
    const contrasts = [.05, .5, .95].map(y => [.2, .35, .5].filter(dx => glyph.x - glyph.height * dx >= cellLeft).map(dx => {
      const x = glyph.x - glyph.height * dx;
      const bg = (sample(x, glyph.y + glyph.height * .27) + sample(x, glyph.y + glyph.height * .73)) / 2;
      return bg - sample(x, glyph.y + glyph.height * y);
    }).filter(c => c >= minimumContrast).length);
    return contrasts.some(count => count >= 2) ? 0 : .9;
  }
  const at = (x, y) => {
    const xx = Math.max(0, Math.min(pixels.width - 1, Math.round(glyph.x + glyph.width * x)));
    const yy = Math.max(0, Math.min(pixels.height - 1, Math.round(glyph.y + glyph.height * y)));
    const p = (yy * pixels.width + xx) * 4;
    return .299 * pixels.data[p] + .587 * pixels.data[p + 1] + .114 * pixels.data[p + 2];
  };
  const background = [(at(.4, .27) + at(.6, .27)) / 2, (at(.4, .73) + at(.6, .73)) / 2];
  const locations = [[.5, .05], [.9, .27], [.9, .73], [.5, .95], [.1, .73], [.1, .27], [.5, .5]];
  const minimumContrast = Math.max(8, (Math.max(...background) - Math.min(...locations.map(([x,y])=>at(x,y)))) * .15);
  const evidence = locations.map(([x, y], i) => {
    const b = i === 6 ? (background[0] + background[1]) / 2 : background[y < .5 ? 0 : 1];
    const horizontal = i === 0 || i === 3 || i === 6;
    const contrast = [-.12, -.06, 0, .06, .12].map(d => b - at(x + (horizontal ? d : 0), y + (horizontal ? 0 : d))).sort((a,b)=>a-b);
    // A coherent segment survives a thin reflected streak; isolated dark noise
    // cannot activate an absent segment through one lucky sample.
    return contrast[2] >= minimumContrast ? 1 : 0;
  });
  const pattern = SEGMENT_PATTERNS[Number(glyph.digit)];
  if (!pattern || evidence.some((value, i) => pattern[i] === '1' ? value < .4 : value > .2)) return 0;
  return evidence.reduce((sum, value, i) => sum + (pattern[i] === '1' ? value : 1 - value), 0) / 7;
}

// Locate LCD glyphs from image evidence, without assuming left/right crop ratios.
export function contrastMask({ data, width, height }) {
  const gray = new Uint8Array(width * height), stride = width + 1;
  const integral = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      const value = Math.round(.299 * data[p] + .587 * data[p + 1] + .114 * data[p + 2]);
      gray[y * width + x] = value; sum += value;
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + sum;
    }
  }
  const mask = new Uint8Array(width * height), radius = Math.max(12, Math.round(width / 24));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const left = Math.max(0, x - radius), right = Math.min(width, x + radius + 1);
    const top = Math.max(0, y - radius), bottom = Math.min(height, y + radius + 1);
    const sum = integral[bottom * stride + right] - integral[top * stride + right] - integral[bottom * stride + left] + integral[top * stride + left];
    mask[y * width + x] = gray[y * width + x] < sum / ((right - left) * (bottom - top)) - 14 ? 1 : 0;
  }
  return mask;
}

function componentGlyphs(pixels, radius, binary) {
  const { width, height } = pixels;
  const mask = binary ? Uint8Array.from({ length: width * height }, (_, i) => pixels.data[i * 4] < 128 ? 1 : 0) : contrastMask(pixels);
  const glyphs = [];
  for (const item of components(mask, width, height, radius, true)) {
    const w = item.width, h = item.height;
    if (h < Math.max(7, height * .015) || w < 2 || w / h < .06 || w / h > 1.05) continue;
    const data = new Uint8ClampedArray(w * h * 4).fill(255);
    // Components locate the bounds; disconnected strokes inside them still
    // belong to the glyph (notably the middle bar of an eight).
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (mask[(item.y + y) * width + item.x + x]) data.fill(0, (y * w + x) * 4, (y * w + x) * 4 + 3);
    }
    const digit = readSegmentedDigits({ data, width: w, height: h }, 1);
    if (digit) glyphs.push({ digit, x: item.x, y: item.y, width: w, height: h });
  }
  return glyphs;
}

export function locateGlyphs(pixels, binary = false) {
  const glyphs = [];
  // A second pass joins tiny LCD segment gaps. Keep the unjoined pass as well
  // so a small decimal is not merged with the Celsius symbol above it.
  const join = Math.max(2, Math.min(4, Math.round(Math.max(pixels.width, pixels.height) / 180)));
  for (const glyph of [...componentGlyphs(pixels, 0, binary), ...componentGlyphs(pixels, 1, binary), ...(binary ? componentGlyphs(pixels, join, true) : [])]) {
    const existing = glyphs.find(item => Math.abs(item.x - glyph.x) < 3 && Math.abs(item.y - glyph.y) < 3 && Math.abs(item.width - glyph.width) < 3 && Math.abs(item.height - glyph.height) < 3);
    if (!existing) glyphs.push(glyph);
    else if (existing.digit !== glyph.digit) existing.digit = ''; // Conflicting geometry is not a second physical digit.
  }
  // A disconnected vertical segment inside a decoded full digit is not a 1.
  return glyphs.filter(g => g.digit && !glyphs.some(other => other !== g && other.height > g.height * 1.15 &&
    g.x >= other.x - 1 && g.y >= other.y - 1 && g.x + g.width <= other.x + other.width + 1 && g.y + g.height <= other.y + other.height + 1));
}

const right = glyph => glyph.x + glyph.width, bottom = glyph => glyph.y + glyph.height;
function union(items, width, height) {
  const pad = Math.max(2, Math.max(...items.map(item => item.height)) * .045);
  const x = Math.max(0, Math.min(...items.map(item => item.x)) - pad);
  const y = Math.max(0, Math.min(...items.map(item => item.y)) - pad);
  return { x: x / width, y: y / height,
    width: (Math.min(width, Math.max(...items.map(right)) + pad) - x) / width,
    height: (Math.min(height, Math.max(...items.map(bottom)) + pad) - y) / height };
}

export function digitPairs(glyphs, obstructions = glyphs) {
  const pairs = [];
  for (const a of glyphs) {
    checkRecognitionBudget();
    for (const b of glyphs) {
      const h = Math.max(a.height, b.height), gap = b.x - right(a);
      // A right-aligned 1 leaves much more empty space in its character cell.
      if (gap < 0 || b.x + b.width / 2 - a.x - a.width / 2 < h * .3 || gap > h * (b.digit === '1' ? .95 : .6) || Math.min(a.height, b.height) < h * .7 || Math.abs(bottom(a) - bottom(b)) > h * .18) continue;
      if (obstructions.some(g => g.height >= h * .7 && Math.abs(bottom(g) - bottom(b)) < h * .18 &&
        g.x >= right(a) && right(g) <= b.x)) continue;
      pairs.push({ items: [a, b], value: a.digit + b.digit, height: h });
    }
  }
  return pairs;
}

export function temperatureGroups(glyphs, obstructions = glyphs) {
  const pairs = digitPairs(glyphs, obstructions), groups = [];
  for (const temp of pairs.filter(pair => Number(pair.value) >= 10 && Number(pair.value) <= INDOOR_LIMITS.temperature.max)) {
    checkRecognitionBudget();
    const last = temp.items[1];
    const fractions = glyphs.filter(glyph => glyph.x >= right(last) && glyph.x - right(last) < temp.height * .65 &&
      glyph.height >= temp.height * .3 && glyph.height <= temp.height * .75 && Math.abs(bottom(glyph) - bottom(last)) < temp.height * .2);
    for (const fraction of fractions) {
      if (obstructions.some(g => g.height >= temp.height * .7 && Math.abs(bottom(g) - bottom(last)) < temp.height * .18 &&
        g.x >= right(last) && g.x < fraction.x && !(g.rawComponent && fraction.digit !== '1' &&
          g.y <= fraction.y && right(g) >= right(fraction) && bottom(g) >= bottom(fraction)))) continue;
      groups.push({ items: [...temp.items, fraction], value: `${temp.value}.${fraction.digit}`, height: temp.height });
    }
  }
  return groups.sort((a, b) => b.height - a.height);
}

export function numericGroups(pixels, mask, glyphs, obstructions = glyphs) {
  const dots = components(mask, pixels.width, pixels.height);
  return { temperature: temperatureGroups(glyphs, obstructions).filter(g => Number(g.value) <= INDOOR_LIMITS.temperature.max && dots.some(dot => {
    const last = g.items[1], fraction = g.items[2], h = g.height;
    return dot.count >= 2 && dot.width <= h * .18 && dot.height <= h * .18 && dot.width >= dot.height * .35 && dot.height >= dot.width * .35 &&
      dot.x >= right(last) - h * .08 && dot.x <= fraction.x + h * .08 && dot.y > bottom(last) - h * .2 && dot.y <= bottom(last) + h * .05;
  })), humidity: digitPairs(glyphs, obstructions).filter(g => Number(g.value) >= INDOOR_LIMITS.humidity.min && Number(g.value) <= 90) };
}

export function detectCandidates(pixels, threshold = .55, variant = 'adaptive', options = {}) {
  const prepared = normalise(pixels, threshold, variant), units = locateUnits(prepared, prepared.mask);
  // Keep pre-symbol evidence immutable. Undecodable components remain available
  // for complete-group obstruction checks even when masking removes their ink.
  const rawComponents = components(prepared.mask, pixels.width, pixels.height, 1, true);
  const numericMask = prepared.mask.slice();
  // Remove only the components belonging to a symbol, not its bounding rectangle.
  // In particular, degree/C can sit above a small fractional digit.
  for (const unit of units) for (const stroke of unit.strokes || [])
    for (const point of stroke.points || []) numericMask[point] = 0;
  const located = locateGlyphs(binaryPixels(pixels, numericMask), true).map(glyph => {
    if (glyph.digit !== '0' && glyph.digit !== '8') return glyph;
    const evidence = middleBar(pixels, glyph);
    return { ...glyph, digit: evidence === null ? '' : evidence ? '8' : '0' };
  }).filter(g => g.digit);
  const glyphs = located.map(g => ({ ...g, confidence: grayscaleConfidence(pixels, g, located) })).filter(g => g.confidence > 0).sort((a, b) => a.x - b.x);
  // A joined unit/fraction component is preserved as evidence, but is not an
  // inserted integer if it contains a complete non-one fractional glyph. The
  // full native grayscale cell is still validated after grouping.
  const rawObstructions = rawComponents.filter(c => c.height >= 7 && c.width >= 2 && c.width / c.height >= .06 && c.width / c.height <= 1.05 && c.count / (c.width * c.height) < .8).map(c => ({ ...c, rawComponent: true }));
  const groups = numericGroups(pixels, numericMask, glyphs, [...located, ...rawObstructions]);
  groups.temperature = groups.temperature.filter(group => validateTemperatureGroup(pixels, group, options));
  const readings = [];
  for (const unit of units) {
    if (unit.unit === '°F') continue;
    const candidates = groups[unit.field].filter(group => {
      const last = group.items[1], h = group.height;
      if (unit.field === 'temperature') return unit.box.x >= right(last) - h * .12 && unit.box.x - right(last) < h * .8 &&
        Math.abs(unit.box.y - last.y) < h * .3 && unit.box.height >= h * .15 && unit.box.height <= h * .8;
      return unit.box.x >= right(last) - h * .12 && unit.box.x - right(last) < h * .8 &&
        Math.abs(bottom(unit.box) - bottom(last)) < h * .3 && unit.box.height >= h * .2 && unit.box.height <= h * 1.1;
    }).sort((a, b) => b.height - a.height || right(b.items[1]) - right(a.items[1]));
    const group = candidates[0];
    if (!group) continue;
    if (unit.field === 'humidity' && temperatureGroups(glyphs).some(t => t.items[0] === group.items[0] && t.items[1] === group.items[1] &&
      t.items[2].x >= unit.box.x && t.items[2].x < right(unit.box))) continue;
    const digitBounds = bounds(group.items), pad = Math.max(2, group.height * .06);
    readings.push({ field: unit.field, value: group.value, digitBounds, unitBounds: unit.box,
      box: bounds([digitBounds, unit.box], pad), confidence: { unit: unit.confidence, numeric: Math.min(...group.items.map(g => g.confidence)),
        evidence: { unit: unit.unit, glyphs: group.items.map(g => g.digit), aligned: true, decimal: unit.field === 'temperature' } }, height: group.height });
  }
  const band = principalBand(numericMask, pixels.width, pixels.height, units);
  const dominantHeight = Math.max(band?.height || 0, ...readings.map(r => r.height));
  return { readings: readings.filter(r => r.height >= dominantHeight * .6), units, glyphs, rawGlyphs: located, rawComponents, rawObstructions, rawMask: prepared.mask, prepared,
    currentBand: band && { ...band, x: band.x / pixels.width, y: band.y / pixels.height, width: band.width / pixels.width, height: band.height / pixels.height } };
}

// Compare a coherent middle stroke with both empty interiors. Grayscale
// survives blur and avoids interpreting threshold speckle as an active bar.
export function middleBar(pixels, glyph) {
  const { data, width } = pixels;
  const luminance = (x, y) => { const p = (y * width + x) * 4; return .299 * data[p] + .587 * data[p + 1] + .114 * data[p + 2]; };
  const sample = (x, y) => luminance(Math.min(pixels.width - 1, Math.max(0, Math.round(glyph.x + glyph.width * x))),
    Math.min(pixels.height - 1, Math.max(0, Math.round(glyph.y + glyph.height * y))));
  const differences = [];
  for (let x = .3; x <= .7; x += .04) {
    const background = (sample(x, .27) + sample(x, .73)) / 2;
    const bar = Math.min(sample(x, .46), sample(x, .5), sample(x, .54));
    differences.push(background - bar);
  }
  const lit = differences.filter(d => d >= 8).length / differences.length;
  if (lit >= .75) return true;
  if (lit <= .2 && differences.reduce((a, b) => a + b, 0) / differences.length < 5) return false;
  return null;
}

// Undecoded, digit-shaped strokes can establish the main LCD band. A paired
// band must share height/baseline and lie next to a detected unit; random scene
// components cannot suppress another monitor's verified readings.
function principalBand(mask, width, height, units) {
  const strokes = components(mask, width, height, Math.max(1, Math.min(3, Math.round(width / 240))))
    .filter(c => c.x > 1 && c.y > 1 && right(c) < width - 1 && bottom(c) < height - 1 && c.height >= 10 && c.width / c.height >= .12 && c.width / c.height <= .95 && c.count / (c.width * c.height) < .8);
  const bands = [];
  for (const a of strokes) for (const b of strokes) {
    const h = Math.max(a.height, b.height), gap = b.x - right(a);
    if (gap < 0 || gap > h * .9 || Math.min(a.height, b.height) < h * .7 || Math.abs(bottom(a) - bottom(b)) > h * .18) continue;
    const box = bounds([a, b]);
    if (units.some(u => u.box.x >= right(b) - h * .15 && u.box.x <= right(b) + h * 1.1 && u.box.y >= a.y - h * .3 && u.box.y <= bottom(a))) bands.push(box);
  }
  return bands.sort((a, b) => b.height - a.height)[0] || null;
}

export function detectReadingRegions(pixels) {
  const candidates = detectCandidates(pixels).readings.sort((a, b) => b.height - a.height);
  if (!candidates.length) return null;
  const regions = { temperature: null, humidity: null }, values = { temperature: '', humidity: '' };
  for (const field of Object.keys(regions)) {
    const reading = candidates.find(item => item.field === field);
    if (!reading) continue;
    regions[field] = union([reading.box], pixels.width, pixels.height); values[field] = reading.value;
  }
  return { regions, values };
}
