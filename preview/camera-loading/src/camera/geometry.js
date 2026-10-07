import { components, bounds } from './image.js';
import { checkRecognitionBudget } from './budget.js';
export const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export function compose(a, b) { return Array.from({ length: 9 }, (_, i) => {
  const row = Math.floor(i / 3), column = i % 3;
  return a[row * 3] * b[column] + a[row * 3 + 1] * b[column + 3] + a[row * 3 + 2] * b[column + 6];
}); }
export function project(matrix, x, y) {
  const d = matrix[6] * x + matrix[7] * y + matrix[8];
  return [(matrix[0] * x + matrix[1] * y + matrix[2]) / d, (matrix[3] * x + matrix[4] * y + matrix[5]) / d];
}
export function projectBox(matrix, box) {
  return bounds([[box.x, box.y], [box.x + box.width, box.y], [box.x + box.width, box.y + box.height], [box.x, box.y + box.height]]
    .map(([x, y]) => { const p = project(matrix, x, y); return { x: p[0], y: p[1], width: 0, height: 0 }; }));
}
export function inverse(m) {
  const a = m[4] * m[8] - m[5] * m[7], b = m[5] * m[6] - m[3] * m[8], c = m[3] * m[7] - m[4] * m[6];
  const det = m[0] * a + m[1] * b + m[2] * c;
  if (Math.abs(det) < 1e-10) return null;
  return [a, m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4], b,
    m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5], c,
    m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]].map(v => v / det);
}
export function homography(from, to) {
  const rows = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i], [u, v] = to[i];
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u], [0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let pivot = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(rows[r][c]) > Math.abs(rows[pivot][c])) pivot = r;
    if (Math.abs(rows[pivot][c]) < 1e-8) return null;
    [rows[c], rows[pivot]] = [rows[pivot], rows[c]];
    const divisor = rows[c][c]; for (let j = c; j <= 8; j++) rows[c][j] /= divisor;
    for (let r = 0; r < 8; r++) if (r !== c) { const amount = rows[r][c]; for (let j = c; j <= 8; j++) rows[r][j] -= amount * rows[c][j]; }
  }
  return [...rows.map(row => row[8]), 1];
}
export function rotation(width, height, angle, shear = 0) {
  const theta = angle * Math.PI / 180, c = Math.cos(theta), s = Math.sin(theta), a = c, b = -s + shear * c, d = s, e = c + shear * s;
  return [a, b, width / 2 - a * width / 2 - b * height / 2, d, e, height / 2 - d * width / 2 - e * height / 2, 0, 0, 1];
}

// All matrices map corrected destination pixels back to the unchanged source.
// Quarter turns use exact integer coordinates and exchange the canvas axes.
export function expandedRotation(width, height, angle, shear = 0) {
  const turn = ((angle % 360) + 360) % 360;
  if (!shear && Math.abs(turn - Math.round(turn / 90) * 90) < 1e-8) {
    const quarter = Math.round(turn / 90) % 4;
    const matrices = [IDENTITY, [0,-1,width-1,1,0,0,0,0,1], [-1,0,width-1,0,-1,height-1,0,0,1], [0,1,0,-1,0,height-1,0,0,1]];
    return { matrix: [...matrices[quarter]], width: quarter % 2 ? height : width, height: quarter % 2 ? width : height, cardinal: true };
  }
  const centred = rotation(width, height, angle, shear), forward = inverse(centred);
  const box = projectBox(forward, { x: 0, y: 0, width: width - 1, height: height - 1 });
  return { matrix: compose(centred, [1,0,box.x,0,1,box.y,0,0,1]), width: Math.ceil(box.width) + 1, height: Math.ceil(box.height) + 1, cardinal: false };
}

export function exactTransform(pixels, correction) {
  const { width, height, matrix } = correction, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (x === 0) checkRecognitionBudget();
    const [sx, sy] = project(matrix, x, y), p = (y * width + x) * 4;
    data.set(pixels.data.subarray((sy * pixels.width + sx) * 4, (sy * pixels.width + sx) * 4 + 4), p);
  }
  return { width, height, data };
}

export function correctedPixels(pixels, correction) {
  return correction.cardinal ? exactTransform(pixels, correction) : warp(pixels, correction.matrix, correction.width, correction.height);
}

// Dominant raw edge directions propose rotation before any digits are decoded.
// Vertical and horizontal strokes vote into the same orientation histogram.
export function strokeAngles(pixels) {
  const { width, height, data } = pixels, votes = new Float64Array(51);
  const gray = (x, y) => .299 * data[(y * width + x) * 4] + .587 * data[(y * width + x) * 4 + 1] + .114 * data[(y * width + x) * 4 + 2];
  for (let y = 1; y < height - 1; y += 2) for (let x = 1; x < width - 1; x += 2) {
    if (x === 1) checkRecognitionBudget();
    const dx = gray(x + 1, y) - gray(x - 1, y), dy = gray(x, y + 1) - gray(x, y - 1);
    const strength = Math.hypot(dx, dy); if (strength < 6) continue;
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    angle = ((angle + 225) % 90) - 45;
    if (Math.abs(angle) <= 25) votes[Math.round(angle) + 25] += strength;
  }
  const peaks = [...votes].map((v, i) => ({ angle: i - 25, v: v + (votes[i - 1] || 0) + (votes[i + 1] || 0) }))
    .sort((a, b) => b.v - a.v);
  const result = [];
  for (const peak of peaks) if (peak.v && !result.some(a => Math.abs(a - peak.angle) < 4)) { result.push(peak.angle); if (result.length === 3) break; }
  return result;
}

export function strokeShear(pixels, angle) {
  const { width, height, data } = pixels, votes = new Float64Array(31);
  for (let y = 2; y < height - 2; y += 2) for (let x = 2; x < width - 2; x += 2) {
    if (x === 2) checkRecognitionBudget();
    const p = (y * width + x) * 4;
    const dx = data[p + 4] - data[p - 4], dy = data[p + width * 4] - data[p - width * 4];
    if (Math.abs(dx) < 8 || Math.abs(dy) > Math.abs(dx) * .7) continue;
    const direction = Math.atan(dy / dx) * 180 / Math.PI - angle;
    if (Math.abs(direction) <= 15) votes[Math.round(direction) + 15] += Math.abs(dx);
  }
  const total = votes.reduce((a, b) => a + b, 0);
  let peak = 15, strength = 0;
  for (let i = 1; i < 30; i++) { const v = votes[i - 1] + votes[i] + votes[i + 1]; if (v > strength) { peak = i; strength = v; } }
  // Only a concentrated set of consistent vertical strokes supports shear.
  if (total < 300 || strength / total < .25 || Math.abs(peak - 15) < 2) return 0;
  return Math.max(-.22, Math.min(.22, -Math.tan((peak - 15) * Math.PI / 180)));
}
export function warp(pixels, matrix, width = pixels.width, height = pixels.height) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (x === 0) checkRecognitionBudget();
    const [sx, sy] = project(matrix, x, y), xx = Math.floor(sx), yy = Math.floor(sy);
    if (xx < 0 || yy < 0 || xx + 1 >= pixels.width || yy + 1 >= pixels.height) continue;
    const dx = sx - xx, dy = sy - yy, p = (y * width + x) * 4, q = (yy * pixels.width + xx) * 4;
    for (let channel = 0; channel < 3; channel++) data[p + channel] =
      (pixels.data[q + channel] * (1 - dx) + pixels.data[q + 4 + channel] * dx) * (1 - dy) +
      (pixels.data[q + pixels.width * 4 + channel] * (1 - dx) + pixels.data[q + pixels.width * 4 + 4 + channel] * dx) * dy;
  }
  return { width, height, data };
}

export function screenCorrections(pixels) {
  const gray = new Uint8Array(pixels.width * pixels.height), histogram = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) { if ((i & 1023) === 0) checkRecognitionBudget(); gray[i] = Math.round(.299 * pixels.data[i * 4] + .587 * pixels.data[i * 4 + 1] + .114 * pixels.data[i * 4 + 2]); histogram[gray[i]]++; }
  const results = [];
  for (const fraction of [.25, .4, .55, .7]) {
    let total = 0, threshold = 0;
    while (threshold < 255 && total < gray.length * fraction) total += histogram[threshold++];
    const mask = Uint8Array.from(gray, v => v < threshold ? 1 : 0);
    for (const item of components(mask, pixels.width, pixels.height)) {
      const area = item.width * item.height;
      if (area < gray.length * .025 || area > gray.length * .65 || item.width / item.height < 1.4 || item.width / item.height > 4.5 || item.count / area < .55 ||
        item.x < 2 || item.y < 2 || item.x + item.width > pixels.width - 2 || item.y + item.height > pixels.height - 2) continue;
      const quad = item.corners;
      const lengths = quad.map((p, i) => Math.hypot(p[0] - quad[(i + 1) % 4][0], p[1] - quad[(i + 1) % 4][1]));
      if (Math.min(...lengths) < 12 || lengths[0] / lengths[2] < .55 || lengths[0] / lengths[2] > 1.8 || lengths[1] / lengths[3] < .55 || lengths[1] / lengths[3] > 1.8) continue;
      const scale = Math.max(1, 480 / ((lengths[0] + lengths[2]) / 2));
      const width = Math.min(800, Math.round((lengths[0] + lengths[2]) / 2 * scale)), height = Math.round((lengths[1] + lengths[3]) / 2 * scale);
      if (width / height < 1.6 || width / height > 4.5) continue;
      if (results.some(i => Math.abs(i.quad[0][0] - quad[0][0]) < 8 && Math.abs(i.quad[0][1] - quad[0][1]) < 8)) continue;
      const matrix = homography([[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]], quad);
      if (matrix) results.push({ matrix, width, height, quad, method: 'perspective' });
    }
  }
  return results.sort((a, b) => b.width * b.height - a.width * a.height).slice(0, 4);
}
