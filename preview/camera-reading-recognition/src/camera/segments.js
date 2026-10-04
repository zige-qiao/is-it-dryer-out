// Read the standard seven-segment geometry, independently of OCR language models.
const DIGITS = new Map([
  ['1111110', '0'], ['0110000', '1'], ['1101101', '2'], ['1111001', '3'],
  ['0110011', '4'], ['1011011', '5'], ['1011111', '6'], ['1110000', '7'],
  ['1111111', '8'], ['1111011', '9'],
]);

export function readSegmentedDigits({ data, width, height }, maxDigits = 3) {
  const ink = (x, y) => data[(y * width + x) * 4] < 128;
  const columns = Array.from({ length: width }, (_, x) => {
    let count = 0; for (let y = 0; y < height; y++) if (ink(x, y)) count++;
    return count >= Math.max(3, height * .035);
  });
  const runs = [];
  let start = -1, last = -1;
  const gap = Math.max(2, Math.round(height * .018));
  for (let x = 0; x <= width + gap; x++) {
    if (columns[x]) { if (start < 0) start = x; last = x; }
    else if (start >= 0 && x - last > gap) { runs.push({ left: start, right: last }); start = -1; }
  }
  const glyphs = runs.map(({ left, right }) => {
    let top = height, bottom = -1;
    for (let x = left; x <= right; x++) for (let y = 0; y < height; y++) if (ink(x, y)) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
    return { left, right, top, bottom, width: right - left + 1, height: bottom - top + 1 };
  }).filter(glyph => glyph.height >= height * .45 && glyph.width >= 3);
  if (!glyphs.length || glyphs.length > maxDigits) return '';
  let result = '';
  for (const glyph of glyphs) {
    const density = (x1, y1, x2, y2) => {
      const left = glyph.left + Math.floor(glyph.width * x1), right = glyph.left + Math.ceil(glyph.width * x2);
      const top = glyph.top + Math.floor(glyph.height * y1), bottom = glyph.top + Math.ceil(glyph.height * y2);
      let count = 0, total = 0;
      for (let y = top; y < Math.min(height, bottom); y++) for (let x = left; x < Math.min(width, right); x++) { total++; if (ink(x, y)) count++; }
      return total ? count / total : 0;
    };
    if (glyph.width / glyph.height < .3) {
      if (density(.1, .12, .9, .38) < .35 || density(.1, .62, .9, .88) < .35) return '';
      result += '1'; continue;
    }
    if (glyph.width / glyph.height > 1.1) return '';
    const zones = [[.28, .025, .72, .13], [.80, .19, .98, .39], [.80, .61, .98, .81],
      [.28, .87, .72, .98], [.02, .61, .20, .81], [.02, .19, .20, .39], [.28, .445, .72, .555]];
    const densities = zones.map(zone => density(...zone));
    // Reject an uncertain segment instead of choosing a plausible number.
    if (densities.some(value => value > .18 && value < .36)) return '';
    const pattern = densities.map(value => value >= .36 ? '1' : '0').join('');
    const digit = DIGITS.get(pattern); if (!digit) return '';
    result += digit;
  }
  return result;
}
