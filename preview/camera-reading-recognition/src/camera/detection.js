import { readSegmentedDigits } from './segments.js';

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
  const joined = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (mask[y * width + x]) {
    for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy++)
      for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx++) joined[yy * width + xx] = 1;
  }
  const glyphs = [], queue = new Int32Array(mask.length);
  for (let p = 0; p < joined.length; p++) {
    if (!joined[p]) continue;
    let head = 0, tail = 1, left = width, right = 0, top = height, bottom = 0;
    queue[0] = p; joined[p] = 0;
    while (head < tail) {
      const point = queue[head++], x = point % width, y = Math.floor(point / width);
      if (mask[point]) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
      for (const next of [x > 0 ? point - 1 : -1, x < width - 1 ? point + 1 : -1, y > 0 ? point - width : -1, y < height - 1 ? point + width : -1]) {
        if (next >= 0 && joined[next]) { joined[next] = 0; queue[tail++] = next; }
      }
    }
    const w = right - left + 1, h = bottom - top + 1;
    if (h < Math.max(12, height * .025) || w < 3 || w / h < .08 || w / h > 1.05) continue;
    const data = new Uint8ClampedArray(w * h * 4).fill(255);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (mask[(top + y) * width + left + x]) data.fill(0, (y * w + x) * 4, (y * w + x) * 4 + 3);
    }
    const digit = readSegmentedDigits({ data, width: w, height: h }, 1);
    if (digit) glyphs.push({ digit, x: left, y: top, width: w, height: h });
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
  return glyphs;
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

export function detectReadingRegions(pixels) {
  const glyphs = locateGlyphs(pixels).sort((a, b) => a.x - b.x);
  const temp = temperatureGroups(glyphs)[0];
  if (!temp) return null;
  const last = temp.items[1], fraction = temp.items[2];
  const candidates = digitPairs(glyphs).filter(pair => Number(pair.value) >= 20 && Number(pair.value) <= 90 &&
    pair.items[0].x > right(fraction) && pair.items[0].x - right(fraction) < temp.height * 1.7 &&
    pair.height >= temp.height * .65 && pair.height <= temp.height * 1.4 && Math.abs(bottom(pair.items[0]) - bottom(last)) < temp.height * .25);
  candidates.sort((a, b) => b.height - a.height);
  const rh = candidates[0];
  return { regions: { temperature: union(temp.items, pixels.width, pixels.height), humidity: rh ? union(rh.items, pixels.width, pixels.height) : null },
    values: { temperature: temp.value, humidity: rh?.value || '' } };
}
