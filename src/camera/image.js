// Pure pixel operations, shared by the worker and its cooperative fallback.
export function normalise(pixels, threshold = .55) {
  const { width, height, data } = pixels, stride = width + 1;
  const gray = new Float32Array(width * height), sum = new Float64Array(stride * (height + 1)), squares = new Float64Array(sum.length);
  let minimum = 255, maximum = 0;
  for (let y = 0; y < height; y++) {
    let row = 0, rowSquares = 0;
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4, value = .299 * data[p] + .587 * data[p + 1] + .114 * data[p + 2];
      gray[y * width + x] = value; minimum = Math.min(minimum, value); maximum = Math.max(maximum, value);
      row += value; rowSquares += value * value;
      const q = (y + 1) * stride + x + 1;
      sum[q] = sum[q - stride] + row; squares[q] = squares[q - stride] + rowSquares;
    }
  }
  const output = new Uint8ClampedArray(data.length).fill(255), mask = new Uint8Array(width * height);
  if (maximum - minimum < 4) return { width, height, data: output, mask, empty: true };
  const radius = Math.max(8, Math.round(width / 60));
  const areaSum = (table, l, t, r, b) => table[b * stride + r] - table[t * stride + r] - table[b * stride + l] + table[t * stride + l];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const l = Math.max(0, x - radius), r = Math.min(width, x + radius + 1), t = Math.max(0, y - radius), b = Math.min(height, y + radius + 1);
    const n = (r - l) * (b - t), mean = areaSum(sum, l, t, r, b) / n;
    const deviation = Math.sqrt(Math.max(0, areaSum(squares, l, t, r, b) / n - mean * mean));
    const difference = mean - gray[y * width + x];
    const value = Math.round(255 - Math.max(0, difference) * 230 / Math.max(2 / threshold, deviation));
    const p = (y * width + x) * 4;
    output[p] = output[p + 1] = output[p + 2] = value;
    mask[y * width + x] = difference > Math.max(2, deviation * threshold) ? 1 : 0;
  }
  return { width, height, data: output, mask, empty: false };
}

export function components(mask, width, height, radius = 0, includePoints = false) {
  const joined = new Uint8Array(mask.length), queue = new Int32Array(mask.length), result = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (mask[y * width + x]) {
    for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy++)
      for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx++) joined[yy * width + xx] = 1;
  }
  for (let p = 0; p < joined.length; p++) {
    if (!joined[p]) continue;
    let head = 0, tail = 1, left = width, right = -1, top = height, bottom = -1, count = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    const corners = [[width, height], [0, height], [0, 0], [width, 0]], extremes = [Infinity, -Infinity, -Infinity, Infinity], points = includePoints ? [] : null;
    queue[0] = p; joined[p] = 0;
    while (head < tail) {
      const point = queue[head++], x = point % width, y = Math.floor(point / width);
      if (mask[point]) {
        points?.push(point);
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        count++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
        if (x + y < extremes[0]) { extremes[0] = x + y; corners[0] = [x, y]; }
        if (x - y > extremes[1]) { extremes[1] = x - y; corners[1] = [x, y]; }
        if (x + y > extremes[2]) { extremes[2] = x + y; corners[2] = [x, y]; }
        if (x - y < extremes[3]) { extremes[3] = x - y; corners[3] = [x, y]; }
      }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy, next = yy * width + xx;
        if (xx >= 0 && xx < width && yy >= 0 && yy < height && joined[next]) { joined[next] = 0; queue[tail++] = next; }
      }
    }
    if (count) result.push({ x: left, y: top, width: right - left + 1, height: bottom - top + 1, count, corners, ...(points ? { points } : {}),
      correlation: (sxy - sx * sy / count) / Math.sqrt(Math.max(1, (sxx - sx * sx / count) * (syy - sy * sy / count))) });
  }
  return result;
}

export function density(mask, width, item, x1, y1, x2, y2) {
  const l = item.x + Math.floor(item.width * x1), r = item.x + Math.ceil(item.width * x2);
  const t = item.y + Math.floor(item.height * y1), b = item.y + Math.ceil(item.height * y2);
  let ink = 0, count = 0;
  for (let y = t; y < b; y++) for (let x = l; x < r; x++) { ink += mask[y * width + x] || 0; count++; }
  return count ? ink / count : 0;
}

export function bounds(items, padding = 0) {
  const x = Math.min(...items.map(i => i.x)) - padding, y = Math.min(...items.map(i => i.y)) - padding;
  return { x, y, width: Math.max(...items.map(i => i.x + i.width)) + padding - x, height: Math.max(...items.map(i => i.y + i.height)) + padding - y };
}

export function extract(pixels, box) {
  const x = Math.max(0, Math.floor(box.x)), y = Math.max(0, Math.floor(box.y));
  const width = Math.max(1, Math.min(pixels.width, Math.ceil(box.x + box.width)) - x), height = Math.max(1, Math.min(pixels.height, Math.ceil(box.y + box.height)) - y);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row++) data.set(pixels.data.subarray(((y + row) * pixels.width + x) * 4, ((y + row) * pixels.width + x + width) * 4), row * width * 4);
  return { width, height, data };
}

export function binaryPixels(pixels, mask) {
  const data = new Uint8ClampedArray(pixels.width * pixels.height * 4).fill(255);
  for (let i = 0; i < mask.length; i++) if (mask[i]) data.fill(0, i * 4, i * 4 + 3);
  return { width: pixels.width, height: pixels.height, data };
}
