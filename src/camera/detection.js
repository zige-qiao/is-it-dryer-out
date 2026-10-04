import { readSegmentedDigits } from './segments.js';
import { components, binaryPixels, bounds, normalise } from './image.js';
import { locateUnits } from './units.js';

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
    for (const point of item.points) {
      const x = point % width - item.x, y = Math.floor(point / width) - item.y;
      data.fill(0, (y * w + x) * 4, (y * w + x) * 4 + 3);
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
  for (const glyph of [...componentGlyphs(pixels, 0, binary), ...componentGlyphs(pixels, 1, binary), ...(binary ? componentGlyphs(pixels, 2, true) : [])]) {
    const existing = glyphs.find(item => item.digit === glyph.digit && Math.abs(item.x - glyph.x) < 3 && Math.abs(item.y - glyph.y) < 3 && Math.abs(item.height - glyph.height) < 3);
    if (!existing) glyphs.push(glyph);
  }
  // A disconnected vertical segment inside a decoded full digit is not a 1.
  return glyphs.filter(g => !glyphs.some(other => other !== g && other.height > g.height * 1.15 &&
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

export function digitPairs(glyphs) {
  const pairs = [];
  for (const a of glyphs) for (const b of glyphs) {
    const h = Math.max(a.height, b.height), gap = b.x - right(a);
    // A right-aligned 1 leaves much more empty space in its character cell.
    if (gap < 0 || gap > h * (b.digit === '1' ? .95 : .6) || Math.min(a.height, b.height) < h * .7 || Math.abs(bottom(a) - bottom(b)) > h * .18) continue;
    pairs.push({ items: [a, b], value: a.digit + b.digit, height: h });
  }
  return pairs;
}

export function temperatureGroups(glyphs) {
  const pairs = digitPairs(glyphs), groups = [];
  for (const temp of pairs.filter(pair => Number(pair.value) >= 10 && Number(pair.value) <= 32)) {
    const last = temp.items[1];
    const fractions = glyphs.filter(glyph => glyph.x >= right(last) && glyph.x - right(last) < temp.height * .65 &&
      glyph.height >= temp.height * .3 && glyph.height <= temp.height * .75 && Math.abs(bottom(glyph) - bottom(last)) < temp.height * .2);
    for (const fraction of fractions) groups.push({ items: [...temp.items, fraction], value: `${temp.value}.${fraction.digit}`, height: temp.height });
  }
  return groups.sort((a, b) => b.height - a.height);
}

export function numericGroups(pixels, mask, glyphs) {
  const dots = components(mask, pixels.width, pixels.height);
  return { temperature: temperatureGroups(glyphs).filter(g => Number(g.value) <= 32 && dots.some(dot => {
    const last = g.items[1], fraction = g.items[2], h = g.height;
    return dot.count >= 1 && dot.width <= h * .18 && dot.height <= h * .18 &&
      dot.x >= right(last) - h * .08 && dot.x <= fraction.x + h * .08 && dot.y > bottom(last) - h * .2 && dot.y <= bottom(last) + h * .05;
  })), humidity: digitPairs(glyphs).filter(g => Number(g.value) >= 20 && Number(g.value) <= 90) };
}

export function detectCandidates(pixels, threshold = .55) {
  const prepared = normalise(pixels, threshold), units = locateUnits(prepared, prepared.mask);
  const numericMask = prepared.mask.slice();
  // Remove only the components belonging to a symbol, not its bounding rectangle.
  // In particular, degree/C can sit above a small fractional digit.
  for (const unit of units) for (const stroke of unit.strokes || [])
    for (const point of stroke.points || []) numericMask[point] = 0;
  const glyphs = locateGlyphs(binaryPixels(pixels, numericMask), true).sort((a, b) => a.x - b.x);
  const groups = numericGroups(pixels, numericMask, glyphs);
  const readings = [];
  for (const unit of units) {
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
      box: bounds([digitBounds, unit.box], pad), confidence: { unit: unit.confidence, numeric: .95,
        evidence: { unit: unit.unit, glyphs: group.items.map(g => g.digit), aligned: true, decimal: unit.field === 'temperature' } }, height: group.height });
  }
  // Unassociated background digits must not suppress a smaller verified LCD.
  const dominantHeight = Math.max(0, ...readings.map(r => r.height));
  return { readings: readings.filter(r => r.height >= dominantHeight * .6), units, glyphs, prepared };
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
