import { normalise, components, bounds, extract, density } from './image.js';
import { checkRecognitionBudget } from './budget.js';

const right = b => b.x + b.width;
const bottom = b => b.y + b.height;
const overlap = (a, b) => Math.max(0, Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y));

// Integer cells and the reference must be expressed in the same (rectified)
// display coordinates. Fractions are deliberately validated by the caller.
export function passesCurrentRow(cells, row, integerHeight) {
  return !!row && Number.isFinite(integerHeight) && integerHeight > 0 && cells.length > 0 && cells.every(cell =>
    Number.isFinite(cell.height) && cell.height >= integerHeight * .8 && overlap(cell, row) >= cell.height * .5);
}

function cellStrokes(mask, width, cell) {
  const aspect = cell.width / cell.height, fill = cell.count / (cell.width * cell.height);
  if (cell.count < 4 || aspect < .06 || aspect > .9 || fill < .12) return false;
  // Thin ones can be solid; broad glyphs need an interior and two levels of
  // ink. This rejects bezels, dividers and solid scene objects without decoding.
  const upper = density(mask, width, cell, 0, .1, 1, .4);
  const lower = density(mask, width, cell, 0, .6, 1, .9);
  // A narrow one has coherent vertical ink through both halves. Sparse bezel
  // fragments can join into a tall bounding box, but do not supply a full cell.
  if (aspect < .3) return fill >= .35 && upper >= .3 && lower >= .3;
  if (fill > .88) return false;
  const centre = density(mask, width, cell, .3, .16, .7, .38) + density(mask, width, cell, .3, .62, .7, .84);
  return upper >= .08 && lower >= .08 && centre < 1.5;
}

function rawRows(pixels) {
  const prepared = normalise(pixels, .4, 'gentle'), cells = [];
  // Joining is based on the source stroke width, not expected digit size.
  // Several small joins cover broken segment junctions without enlargement.
  for (const radius of [0, 1, 2]) {
    for (const cell of components(prepared.mask, pixels.width, pixels.height, radius)) {
      checkRecognitionBudget();
      if (cell.x <= 0 || cell.y <= 0 || right(cell) >= pixels.width || bottom(cell) >= pixels.height ||
          !cellStrokes(prepared.mask, pixels.width, cell)) continue;
      if (!cells.some(c => Math.abs(c.x - cell.x) <= 1 && Math.abs(c.y - cell.y) <= 1 &&
        Math.abs(c.width - cell.width) <= 1 && Math.abs(c.height - cell.height) <= 1)) cells.push(cell);
    }
  }
  const rows = [];
  for (const a of cells) for (const b of cells) {
    checkRecognitionBudget();
    const h = Math.max(a.height, b.height), gap = b.x - right(a);
    if (gap < 0 || gap > h * 1.8 || Math.min(a.height, b.height) < h * .8 ||
        Math.abs(bottom(a) - bottom(b)) > h * .2 || Math.abs(a.y - b.y) > h * .2 ||
        Math.max(a.width / a.height, b.width / b.height) < .3) continue;
    const row = bounds([a, b]);
    const integerHeight = Math.max(a.height, b.height);
    if (!rows.some(r => Math.abs(r.row.x - row.x) < h * .08 && Math.abs(r.row.y - row.y) < h * .08 &&
      Math.abs(r.integerHeight - integerHeight) < h * .08)) rows.push({ row, integerHeight });
  }
  return rows.sort((a, b) => b.integerHeight - a.integerHeight);
}

function aligned(a, b) {
  const h = Math.max(a.integerHeight, b.integerHeight);
  return Math.min(a.integerHeight, b.integerHeight) >= h * .8 &&
    Math.max(a.row.x - right(b.row), b.row.x - right(a.row)) <= h * 1.8 &&
    Math.abs(a.row.y - b.row.y) <= h * .2 && Math.abs(bottom(a.row) - bottom(b.row)) <= h * .2;
}

// No numerical or unit result participates in reference selection. Supplied
// LCD bounds isolate unrelated displays. The caller maps these pixel bounds
// through the preparation transform to retain original-photo evidence.
export function findCurrentRows(pixels, displayBoxes = []) {
  checkRecognitionBudget();
  const explicit = displayBoxes.length > 0;
  const boxes = explicit ? displayBoxes : [{ x: 0, y: 0, width: pixels.width, height: pixels.height }];
  const result = [];
  for (const box of boxes) {
    const origin = { x: Math.max(0, Math.floor(box.x)), y: Math.max(0, Math.floor(box.y)) };
    const crop = extract(pixels, box), rows = rawRows(crop);
    while (rows.length) {
      checkRecognitionBudget();
      const main = rows.shift(), same = rows.filter(r => aligned(main, r));
      const row = bounds([main.row, ...same.map(r => r.row)]);
      // Comparable rows at separate baselines in one LCD are competing
      // assignments; keep that display unresolved rather than guessing.
      if (explicit && rows.some(r => !aligned(main, r) && r.integerHeight >= main.integerHeight * .8)) break;
      const displayBounds = explicit ? box : {
        x: Math.max(0, row.x - main.integerHeight * 1.5), y: Math.max(0, row.y - main.integerHeight * .5),
        width: Math.min(crop.width, right(row) + main.integerHeight * 1.5) - Math.max(0, row.x - main.integerHeight * 1.5),
        height: Math.min(crop.height, bottom(row) + main.integerHeight * 2.5) - Math.max(0, row.y - main.integerHeight * .5)
      };
      if (!explicit) {
        // A smaller row spanning beyond the larger row's digit cells supplies
        // independent display geometry. Padding around a nearby background
        // number must not bind that other LCD to the larger reference.
        const separate = rows.filter(r => r.integerHeight < main.integerHeight * .8).map(r =>
          bounds([r.row, ...rows.filter(other => aligned(r, other)).map(other => other.row)])).filter(other =>
          (other.y >= bottom(row) || bottom(other) <= row.y) && other.width >= row.width * .9 &&
          (other.x < row.x - main.integerHeight * .25 || right(other) > right(row) + main.integerHeight * .25));
        const below = separate.filter(other => other.y >= bottom(row)), above = separate.filter(other => bottom(other) <= row.y);
        const displayBottom = below.length ? Math.min(bottom(displayBounds), ...below.map(r => r.y)) : bottom(displayBounds);
        if (above.length) displayBounds.y = Math.max(displayBounds.y, ...above.map(bottom));
        displayBounds.height = displayBottom - displayBounds.y;
      }
      result.push({ row: { ...row, x: row.x + origin.x, y: row.y + origin.y }, integerHeight: main.integerHeight,
        displayBounds: explicit ? { ...box } : { ...displayBounds, x: displayBounds.x + origin.x, y: displayBounds.y + origin.y }, evidence: 'raw-strokes' });
      if (explicit) break;
      // Historical rows inside the inferred LCD cannot create fresh references.
      for (let i = rows.length - 1; i >= 0; i--) if (same.includes(rows[i]) ||
        rows[i].row.x < right(displayBounds) && right(rows[i].row) > displayBounds.x &&
        rows[i].row.y >= displayBounds.y && bottom(rows[i].row) <= bottom(displayBounds)) rows.splice(i, 1);
    }
  }
  return result;
}


