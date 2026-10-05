import { locateGlyphs, grayscaleConfidence, middleBar, digitPairs, temperatureGroups, validateTemperatureGroup } from './detection.js';
import { bounds, extract, normalise, binaryPixels, components } from './image.js';
import { INDOOR_LIMITS } from '../config.js';
import { runWithRecognitionBudget } from './budget.js';

export const PROCESSING_VARIANTS = Object.freeze([{ preprocessing: 'adaptive', threshold: .55 }, { preprocessing: 'display', threshold: .65 }, { preprocessing: 'adaptive', threshold: .4 }, { preprocessing: 'gentle', threshold: .55 }, { preprocessing: 'denoised', threshold: .7 }]);
export const PERSPECTIVE_REFINEMENT_VARIANT = Object.freeze({ preprocessing: 'adaptive', threshold: .75 });
const right = b => b.x + b.width, bottom = b => b.y + b.height;
export const intersection = (a, b) => Math.max(0, Math.min(right(a), right(b)) - Math.max(a.x, b.x)) * Math.max(0, Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y));
export const samePosition = (a, b) => intersection(a, b) / Math.max(a.width * a.height, b.width * b.height) > .55;
export function consolidateGlyphs(items) {
  const groups = [];
  for (const item of items) {
    const group = groups.find(g => samePosition(g[0], item));
    if (group) group.push(item); else groups.push([item]);
  }
  return groups.filter(g => new Set(g.map(i => i.digit)).size === 1).map(g => g.sort((a, b) => b.confidence - a.confidence)[0]);
}
function luminance(p, x, y) {
  const i = (Math.max(0, Math.min(p.height - 1, Math.round(y))) * p.width + Math.max(0, Math.min(p.width - 1, Math.round(x)))) * 4;
  return .299 * p.data[i] + .587 * p.data[i + 1] + .114 * p.data[i + 2];
}
function connectedDisplay(pixels, a, b) {
  const left = a.x < b.x ? a : b, other = left === a ? b : a, h = Math.max(a.height, b.height);
  if (other.x - right(left) > h * 2.5 || Math.abs(bottom(a) - bottom(b)) > h * .25 || Math.min(a.height, b.height) < h * .7) return false;
  // A broad bezel/background break between fields indicates separate displays.
  let breaks = 0;
  for (const y of [.22, .4, .7]) {
    const backgrounds = [a,b].map(box => [.15,.25,.35,.65,.75].flatMap(x => [.27,.73].map(y => luminance(pixels, box.x + box.width*x, box.y + box.height*y))).sort((a,b)=>a-b)[7]);
    if (Math.abs(backgrounds[0]-backgrounds[1]) > 25) return false;
    const bg = (backgrounds[0]+backgrounds[1])/2;
    let run = 0, longest = 0;
    for (let x = Math.ceil(right(left)); x < other.x; x++) { run = Math.abs(luminance(pixels, x, left.y + h * y) - bg) > 40 ? run + 1 : 0; longest = Math.max(longest, run); }
    if (longest > h * .22) breaks++;
  }
  return breaks < 2;
}
function decimalEvidence(pixels, dots, group) {
  const last = group.items[1], fraction = group.items[2], h = group.height;
  return dots.some(dot => {
    if (dot.count < 2 || dot.width > h * .18 || dot.height > h * .18 || dot.width < dot.height * .35 || dot.height < dot.width * .35 ||
      dot.x < right(last) - h * .08 || dot.x > fraction.x + h * .08 || dot.y < bottom(last) - h * .18 || bottom(dot) > bottom(last) + h * .08) return false;
    const cx = dot.x + dot.width / 2, cy = dot.y + dot.height / 2;
    return (luminance(pixels, cx - dot.width - 2, cy) + luminance(pixels, cx, cy - dot.height - 2)) / 2 - luminance(pixels, cx, cy) >= 8;
  });
}

// Combine independently validated glyphs in one corrected coordinate system.
// Fractions get a local threshold neighbourhood rather than the large-digit one.
export async function combineEvidence(pixels, variants, checkpoint, { expected = null, selection = null, sourceEvidence = null } = {}) {
  const guarded = work => runWithRecognitionBudget(checkpoint.check, work);
  const units = variants.flatMap(v => v.found.units), glyphs = variants.flatMap(v => v.found.glyphs.map(g => ({ ...g, variant: v })));
  let combined = consolidateGlyphs(glyphs);
  const obstructions = variants.flatMap(v => [...(v.found.rawGlyphs || v.found.glyphs), ...(v.found.rawObstructions || [])]);
  const bandHeight = Math.max(0, ...variants.map(v => (v.found.currentBand?.height || 0) * pixels.height));
  const pairs = guarded(() => digitPairs(combined, obstructions).filter(p => Number(p.value) >= INDOOR_LIMITS.temperature.min && Number(p.value) <= INDOOR_LIMITS.temperature.max && p.height >= bandHeight * .6).sort((a, b) => b.height - a.height).slice(0, 8));
  const masks = variants.map(v => v.found.prepared.mask);
  for (const pair of pairs) {
    if (!await checkpoint()) return null;
    const last = pair.items[1], h = pair.height;
    const box = { x: Math.floor(right(last)), y: Math.floor(bottom(last) - h * .75), width: Math.ceil(h * .66), height: Math.ceil(h * .8) };
    if (box.x + box.width >= pixels.width || box.y < 0) continue;
    const crop = extract(pixels, box);
    for (const config of PROCESSING_VARIANTS) {
      if (!await checkpoint()) return null;
      const prepared = guarded(() => normalise(crop, config.threshold, config.preprocessing)), mask = prepared.mask.slice();
      for (const u of units) for (const pt of u.strokes?.flatMap(s => s.points || []) || []) {
        const x = pt % pixels.width - box.x, y = Math.floor(pt / pixels.width) - box.y;
        if (x >= 0 && x < crop.width && y >= 0 && y < crop.height) mask[y * crop.width + x] = 0;
      }
      const local = guarded(() => locateGlyphs(binaryPixels(crop, mask), true).map(g => {
        const full = { ...g, x: g.x + box.x, y: g.y + box.y };
        if (full.digit === '8' || full.digit === '0') { const middle = middleBar(pixels, full); full.digit = middle === null ? '' : middle ? '8' : '0'; }
        return { ...full, confidence: full.digit ? grayscaleConfidence(pixels, full, glyphs) : 0, variant: variants.find(v => v.preprocessing === config.preprocessing && v.threshold === config.threshold) || variants[0], localFraction: true };
      }).filter(g => g.confidence > 0 && g.height >= h * .3 && g.height <= h * .75 && Math.abs(bottom(g) - bottom(last)) < h * .2));
      glyphs.push(...local);
    }
  }
  combined = consolidateGlyphs(glyphs);
  const dots = [];
  for (const mask of masks) { if (!await checkpoint()) return null; dots.push(...guarded(() => components(mask, pixels.width, pixels.height).filter(d => d.width < pixels.height * .2 && d.height < pixels.height * .2))); }
  const numbered = guarded(() => temperatureGroups(combined, obstructions).filter(g => Number(g.value) <= INDOOR_LIMITS.temperature.max));
  const decimalGroups = numbered.filter(g => decimalEvidence(pixels, dots, g));
  const groups = guarded(() => decimalGroups.filter(g => validateTemperatureGroup(pixels, g, { sourceEvidence })));
  const humidityCandidates = variants.flatMap(v => v.found.readings.filter(r => r.field === 'humidity').map(r => ({ ...r, variant: v })));
  const humidity = humidityCandidates.filter(r => !humidityCandidates.some(other => other.value !== r.value &&
    samePosition(other.digitBounds, r.digitBounds) && other.confidence.numeric >= r.confidence.numeric - .04));
  const readings = [];
  readings.rejectionReason = pairs.length && !numbered.length ? 'missing-fraction' : numbered.length && !decimalGroups.length ? 'missing-decimal' : decimalGroups.length && !groups.length ? 'unreadable-fraction-cell' : groups.length ? 'unassigned-temperature' : 'unreadable-integer-digits';
  for (const group of groups) {
    if (!await checkpoint()) return null;
    const digits = bounds(group.items), h = group.height;
    if (group.items.some(g => g.x <= 0 || g.y <= 0 || right(g) >= pixels.width - 1 || bottom(g) >= pixels.height - 1)) continue;
    const nearby = units.filter(u => u.field === 'temperature' && u.box.x >= right(group.items[1]) - h * .12 && u.box.x < right(group.items[1]) + h * .8 && Math.abs(u.box.y - group.items[1].y) < h * .35);
    if (nearby.some(u => u.unit === '°F')) { readings.rejectionReason = 'unsupported-fahrenheit'; continue; }
    const celsius = nearby.find(u => u.unit === '°C');
    const anchor = humidity.find(r => intersection(r.digitBounds, digits) === 0 && connectedDisplay(pixels, digits, r.digitBounds));
    const assigned = expected === 'temperature' && selection && intersection(selection, digits) / (digits.width * digits.height) >= .65;
    if (!celsius && !anchor && !assigned) continue;
    const variant = group.items[2].variant || group.items[0].variant;
    readings.push({ field: 'temperature', value: group.value, digitBounds: digits, unitBounds: celsius?.box || digits,
      box: bounds(celsius ? [digits, celsius.box] : [digits], 2), height: h, variant,
      confidence: { unit: celsius?.confidence || 0, numeric: Math.min(...group.items.map(g => g.confidence)),
        evidence: { unit: celsius ? '°C' : assigned ? 'manual-assignment' : 'humidity-anchor', decimal: true, glyphs: group.items.map(g => g.digit), assignment: celsius ? 'unit' : assigned ? 'manual' : 'same-display-humidity', combined: true } } });
  }
  return readings;
}
