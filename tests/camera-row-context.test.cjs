const test = require('node:test'), assert = require('node:assert/strict');
const { establishRowContexts, refreshRowContexts, validateRowCells, mapRowContexts, dedupeRowContexts } = require('../src/camera/row-context.js');
const { IDENTITY, compose, homography, expandedRotation } = require('../src/camera/geometry.js');
const { monitor } = require('./helpers/camera-pixels.cjs');
const context = (extra = {}) => ({ row: { x: 10, y: 20, width: 150, height: 100 }, integerHeight: 100,
  displayBounds: { x: 0, y: 0, width: 200, height: 240 }, matrix: IDENTITY, evidence: 'raw-strokes', displayId: 'a', ...extra });
const cell = (extra = {}) => ({ x: 20, y: 20, width: 45, height: 100, ...extra });

test('each integer cell passes inclusive eighty-percent height and fifty-percent vertical overlap', () => {
  assert.equal(validateRowCells([cell({ height: 80, y: 80 })], IDENTITY, [context()]).valid, true);
  assert.equal(validateRowCells([cell({ height: 79.99 })], IDENTITY, [context()]).reason, 'historical-integer-height');
  assert.equal(validateRowCells([cell({ height: 80, y: 80.01 })], IDENTITY, [context()]).reason, 'outside-current-row');
  assert.equal(validateRowCells([cell(), cell({ x: 90, height: 60 })], IDENTITY, [context()]).valid, false);
  assert.equal(validateRowCells([cell({ width: 3 })], IDENTITY, [context()]).valid, true, 'narrow ones use their full vertical cell');
});

test('crop and enlargement mappings preserve reference scale and prohibit historical replacement', () => {
  const original = context(), cropMap = [3, 0, -30, 0, 3, -30, 0, 0, 1];
  const contexts = mapRowContexts([original], cropMap);
  assert.equal(contexts[0].integerHeight, 100); assert.deepEqual(contexts[0].row, original.row);
  assert.equal(validateRowCells([cell()], cropMap, contexts).valid, true);
  assert.equal(validateRowCells([cell({ height: 35, y: 150 })], cropMap, contexts).valid, false);
  const small = context({ row: { x: 10, y: 150, width: 150, height: 35 }, integerHeight: 35 });
  assert.equal(validateRowCells([cell({ height: 35, y: 150 })], IDENTITY, [small]).valid, true);
  assert.equal(validateRowCells([cell({ height: 35, y: 150 })], IDENTITY, [small, original]).reason, 'historical-integer-height');
});

test('different displays retain independent digit scales', () => {
  const second = context({ displayId: 'b', row: { x: 250, y: 20, width: 100, height: 35 }, integerHeight: 35,
    displayBounds: { x: 240, y: 0, width: 150, height: 150 } });
  assert.equal(validateRowCells([cell({ x: 260, height: 35 })], IDENTITY, [context(), second]).displayId, 'b');
  assert.equal(validateRowCells([cell({ x: 260, height: 35 })], IDENTITY, [context(), second]).valid, true);
  assert.equal(validateRowCells([cell(), cell({ x: 260 })], IDENTITY, [context(), second]).valid, false);
});

test('supported perspective and rotation compare cells in the preserved rectified frame', () => {
  const perspective = homography([[0, 0], [200, 0], [200, 240], [0, 240]], [[30, 20], [240, 55], [210, 260], [0, 220]]);
  for (const matrix of [perspective, expandedRotation(200, 240, 90).matrix,
    compose(perspective, [2, 0, 0, 0, 2, 0, 0, 0, 1])]) {
    assert.equal(validateRowCells([cell({ width: 3 })], matrix, [context({ matrix })]).valid, true);
    assert.equal(validateRowCells([cell({ height: 60 })], matrix, [context({ matrix })]).valid, false);
  }
});

test('raw preparation establishes row context before decoding and preserves correction matrices', () => {
  const pixels = monitor(55, 120, 80);
  const hypotheses = [0, 180].map(angle => ({ id: `axis-${angle}`, ...expandedRotation(pixels.width, pixels.height, angle) }));
  const contexts = establishRowContexts(pixels, hypotheses);
  assert.ok(contexts.length >= 2);
  assert.ok(contexts.every(c => c.evidence === 'raw-strokes' && c.state === 'established'));
  assert.ok(contexts.filter(c => c.integerHeight >= 70).length >= 2);
  assert.equal(validateRowCells([{ x: 55, y: 120, width: 50, height: 80 }], IDENTITY, contexts).valid, true);
  assert.equal(validateRowCells([{ x: 55, y: 236, width: 18, height: 28 }], IDENTITY, contexts).valid, false);
});

test('missing or competing reference evidence stays blank', () => {
  assert.equal(validateRowCells([cell()], IDENTITY, []).reason, 'current-row-unestablished');
  assert.equal(validateRowCells([], IDENTITY, [context()]).valid, false);
  const competing = context({ row: { x: 10, y: 130, width: 150, height: 100 } });
  assert.equal(validateRowCells([cell()], IDENTITY, [context(), competing]).valid, false);
});

test('native refresh retains the established overview row and can strengthen its scale', () => {
  const pixels = monitor(55, 120, 80), hypothesis = { id: 'identity', ...expandedRotation(pixels.width, pixels.height, 0) };
  const earlier = context({ row: { x: 55, y: 236, width: 320, height: 28 }, integerHeight: 28,
    displayBounds: { x: 0, y: 70, width: 550, height: 330 } });
  const refreshed = refreshRowContexts(pixels, [hypothesis], [earlier]);
  assert.equal(refreshed[0], earlier);
  assert.ok(refreshed.some(c => c.integerHeight === 80));
  assert.equal(validateRowCells([{ x: 55, y: 236, width: 18, height: 28 }], IDENTITY, refreshed).valid, false);
  const blank = { ...pixels, data: new Uint8ClampedArray(pixels.data.length).fill(205) };
  assert.equal(refreshRowContexts(blank, [hypothesis], [earlier])[0], earlier, 'unreadable main digits do not replace established evidence');
});

test('edge strips cannot restrict inferred current-row context to one field', () => {
  const pixels = monitor(55, 120, 80), hypothesis = { id: 'identity', ...expandedRotation(pixels.width, pixels.height, 0) };
  const strip = { kind: 'display', strokeScore: 3, axes: { fill: .9, aspect: 2.5 },
    region: { x: 0, y: 0, width: .28, height: 1 } };
  const contexts = establishRowContexts(pixels, [hypothesis], [strip]);
  assert.equal(validateRowCells([{ x: 271, y: 120, width: 50, height: 80 }], IDENTITY, contexts).valid, true);
});

test('complete aligned raw integer row chooses a full LCD proposal over a partial nested colour component', () => {
  const pixels = monitor(55, 120, 80), hypothesis = { id: 'identity', method: 'strokes', ...expandedRotation(pixels.width, pixels.height, 0) };
  const proposal = (displayId, x, y, width, height) => ({ displayId, kind: 'display', strokeScore: 3,
    axes: { fill: .7, aspect: 2 }, region: { x: x / pixels.width, y: y / pixels.height, width: width / pixels.width, height: height / pixels.height },
    // Connected colour component extrema need not be the LCD corners.
    quad: [[x + 80, y], [x + width, y], [x + width, y + height], [x + 80, y + height]] });
  const partial = proposal('partial', 250, 100, 150, 200), full = proposal('full', 30, 95, 390, 240);
  const contexts = establishRowContexts(pixels, [hypothesis], [partial, full]);
  assert.ok(contexts.length); assert.ok(contexts.every(c => c.displayId === 'full'));
  assert.ok(contexts.every(c => !c.displayQuad), 'ordinary stroke geometry does not trust connected-colour extrema as corners');
  assert.equal(validateRowCells([{ x: 55, y: 120, width: 50, height: 80 }, { x: 115, y: 120, width: 50, height: 80 }], IDENTITY, contexts).valid, true);
  assert.equal(validateRowCells([{ x: 271, y: 120, width: 50, height: 80 }], IDENTITY, contexts).valid, true);
  assert.equal(validateRowCells([{ x: 271, y: 236, width: 18, height: 28 }], IDENTITY, contexts).valid, false);
});

test('floating-point remapping drift cannot multiply identical row references', () => {
  const original = context();
  const drift = { ...original, matrix: original.matrix.map(value => value + 1e-8), row: { ...original.row, y: original.row.y + 1e-8 } };
  assert.deepEqual(dedupeRowContexts([original, drift]), [original]);
  const larger = context({ integerHeight: 110 });
  assert.deepEqual(dedupeRowContexts([original, drift, larger]), [original, larger], 'stronger physical scale remains separate evidence');
});

test('a perpendicular raw fragment cannot veto a validated ninety-degree display row', () => {
  const quarterTurn = expandedRotation(200, 240, 90).matrix;
  const correct = context({ matrix: quarterTurn });
  const perpendicular = context({ row: { x: 20, y: 100, width: 80, height: 58 }, integerHeight: 58 });
  const cells = [cell(), cell({ x: 90 })];
  assert.equal(validateRowCells(cells, quarterTurn, [perpendicular, correct]).valid, true);
  assert.equal(validateRowCells(cells, quarterTurn, [perpendicular]).valid, false, 'perpendicular geometry cannot establish the reading either');
  const opposite = context({ matrix: [-1,0,199,0,-1,239,0,0,1], row: { x: 40, y: 119, width: 150, height: 100 } });
  assert.equal(validateRowCells([cell()], IDENTITY, [opposite]).valid, true, 'opposite directions preserve the physical display vertical axis');
});
