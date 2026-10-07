import { findCurrentRows } from './current-row.js';
import { correctedPixels, compose, inverse, project, projectBox, IDENTITY } from './geometry.js';
import { checkRecognitionBudget } from './budget.js';

const right = box => box.x + box.width;
const bottom = box => box.y + box.height;
const intersection = (a, b) => Math.max(0, Math.min(right(a), right(b)) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y));
function contains(quad, point) {
  if (!quad?.length) return true;
  const crosses = quad.map(([x, y], index) => {
    const [nextX, nextY] = quad[(index + 1) % quad.length];
    return (nextX - x) * (point.y - y) - (nextY - y) * (point.x - x);
  });
  return crosses.every(value => value >= -1e-7) || crosses.every(value => value <= 1e-7);
}

// A context keeps its original rectified display frame. Only its mapping moves
// when preparation pixels are rebased into a crop or the original photograph.
export function mapRowContexts(contexts = [], inputMap = IDENTITY) {
  return contexts.map(context => ({ ...context, matrix: compose(inputMap, context.matrix || IDENTITY) }));
}

export function dedupeRowContexts(contexts = []) {
  const seen = new Set();
  return contexts.filter(context => {
    checkRecognitionBudget();
    const rounded = values => values.map(value => Math.round(value * 1e6) / 1e6);
    const key = JSON.stringify([rounded(context.matrix || IDENTITY),
      rounded([context.row.x, context.row.y, context.row.width, context.row.height, context.integerHeight])]);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

export function establishRowContexts(pixels, hypotheses, proposals = []) {
  const contexts = [];
  const displays = [];
  for (const proposal of proposals.filter(p => p.priorBounds || p.kind === 'display' && p.strokeScore > 0 &&
    p.axes?.fill > .5 && p.axes?.aspect > 1.8 && p.region.x > 0 && p.region.y > 0 &&
    p.region.x + p.region.width < 1 && p.region.y + p.region.height < 1)) {
    checkRecognitionBudget();
    const source = { x: proposal.region.x * pixels.width, y: proposal.region.y * pixels.height,
      width: proposal.region.width * pixels.width, height: proposal.region.height * pixels.height };
    const duplicate = displays.find(display => intersection(display.source, source) /
      Math.min(display.source.width * display.source.height, source.width * source.height) >= .7);
    if (!duplicate) displays.push({ source, proposal, alternatives: [{ source, proposal }] });
    else duplicate.alternatives.push({ source, proposal });
    if (duplicate && (proposal.priorBounds ? source.width * source.height > duplicate.source.width * duplicate.source.height :
      source.width * source.height < duplicate.source.width * duplicate.source.height)) {
      duplicate.source = source; duplicate.proposal = proposal;
    }
  }
  for (const hypothesis of hypotheses) {
    checkRecognitionBudget();
    const matrix = hypothesis.matrix || IDENTITY, forward = inverse(matrix);
    if (!forward) continue;
    const corrected = correctedPixels(pixels, hypothesis);
    const wholeRows = findCurrentRows(corrected);
    const boxes = displays.map(display => {
      // Connected colour can describe only half an LCD. A complete aligned
      // raw integer row chooses the smallest proposal containing all its cells.
      const supported = display.alternatives.filter(({ source }) => {
        const projected = projectBox(forward, source);
        return wholeRows.some(reference => intersection(projected, reference.row) >=
          reference.row.width * reference.row.height * .999);
      }).sort((a, b) => a.source.width * a.source.height - b.source.width * b.source.height);
      const { source, proposal } = supported[0] || display;
      const projected = projectBox(forward, source);
      const sourceQuad = proposal.quad || [[source.x, source.y], [right(source), source.y],
        [right(source), bottom(source)], [source.x, bottom(source)]];
      return { ...projected, id: proposal.recognitionDisplayId || proposal.displayId,
        ...(proposal.priorBounds && proposal.quad || hypothesis.method === 'perspective' &&
          (hypothesis.evidence?.rawQuad || hypothesis.evidence?.supportedPrior) ?
          { quad: sourceQuad.map(([x, y]) => project(forward, x, y)) } : {}) };
    }).filter(box => box.width > 0 && box.height > 0);
    const rows = boxes.length ? findCurrentRows(corrected, boxes) : wholeRows;
    for (const [index, row] of rows.entries()) contexts.push({ ...row,
      state: 'established', hypothesisId: hypothesis.id,
      displayId: row.displayBounds.id || `inferred-${index}`, displayQuad: row.displayBounds.quad,
      matrix: [...matrix] });
  }
  return dedupeRowContexts(contexts);
}

// Native crop detail can strengthen an overview reference. The overview's
// full display bounds supply context even when the selection omits its main row.
export function refreshRowContexts(pixels, hypotheses, existing = []) {
  if (!existing.length) return establishRowContexts(pixels, hypotheses);
  const retained = dedupeRowContexts(existing);
  const proposals = retained.filter(context => context.displayBounds).map(context => {
    checkRecognitionBudget();
    const matrix = context.matrix || IDENTITY, box = projectBox(matrix, context.displayBounds);
    return { priorBounds: true, displayId: context.displayId,
      region: { x: box.x / pixels.width, y: box.y / pixels.height,
        width: box.width / pixels.width, height: box.height / pixels.height },
      ...(context.displayQuad ? { quad: context.displayQuad.map(([x, y]) => project(matrix, x, y)) } : {}) };
  });
  return dedupeRowContexts([...retained, ...establishRowContexts(pixels, hypotheses, proposals)]);
}

// Validate integer cells only. Temperature fractions retain their separate
// decimal, full-cell grayscale and unit-separation validation.
export function validateRowCells(cells, matrix = IDENTITY, contexts = []) {
  if (!cells?.length || cells.some(cell => !Number.isFinite(cell.x) || !Number.isFinite(cell.y) ||
    !(cell.width > 0) || !(cell.height > 0))) return { valid: false, reason: 'invalid-integer-cells' };
  const matches = [];
  for (const context of contexts) {
    checkRecognitionBudget();
    const forward = inverse(context.matrix || IDENTITY);
    if (!forward || !context.row || !(context.integerHeight > 0) || !context.displayBounds) continue;
    const transform = compose(forward, matrix);
    // A row detected along a perpendicular hypothesis is a different geometric
    // interpretation, not stronger height evidence for this display axis.
    // Check the local projective direction, so supported perspective retains
    // the same physical vertical axis while opposite directions remain valid.
    if (!cells.every(cell => {
      const top = project(transform, cell.x + cell.width / 2, cell.y);
      const bottom = project(transform, cell.x + cell.width / 2, cell.y + cell.height);
      const dx = bottom[0] - top[0], dy = bottom[1] - top[1], length = Math.hypot(dx, dy);
      return length > 0 && Math.abs(dy) >= length * .9;
    })) continue;
    const mapped = cells.map(cell => projectBox(transform, cell));
    const display = context.displayBounds;
    // The full selection never supplies a reference: each physical integer cell
    // must bind to this LCD before its height can be compared with the main row.
    if (!mapped.every(cell => {
      const centre = { x: cell.x + cell.width / 2, y: cell.y + cell.height / 2 };
      return contains(context.displayQuad, centre) && centre.x >= display.x && centre.x <= right(display) && centre.y >= display.y && centre.y <= bottom(display) &&
        intersection(cell, display) >= cell.width * cell.height * .5;
    })) continue;
    const ratio = context.integerHeight / Math.max(...mapped.map(cell => cell.height));
    const heightValid = mapped.every(cell => cell.height + 1e-7 >= context.integerHeight * .8);
    const overlapValid = mapped.every(cell => Math.max(0, Math.min(bottom(cell), bottom(context.row)) -
      Math.max(cell.y, context.row.y)) + 1e-7 >= cell.height * .5);
    matches.push({ context, mapped, ratio, heightValid, overlapValid });
  }
  if (!matches.length) return { valid: false, reason: 'current-row-unestablished' };
  // Relative height in each context removes crop/enlargement scale. Stronger
  // same-display evidence must veto an earlier smaller historical reference.
  matches.sort((a, b) => b.ratio - a.ratio);
  const strongest = matches[0], peers = matches.filter(match => match.ratio >= strongest.ratio * .8);
  const failed = peers.find(match => !match.heightValid || !match.overlapValid);
  if (failed) return { valid: false,
    reason: !failed.heightValid ? 'historical-integer-height' : 'outside-current-row',
    displayId: failed.context.displayId, context: failed.context };
  return { valid: true, reason: null, displayId: strongest.context.displayId, context: strongest.context };
}
