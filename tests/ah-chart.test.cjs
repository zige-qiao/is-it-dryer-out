const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const app = readFileSync(require.resolve('../app.js'), 'utf8');
const context = { clamp: (value, min, max) => Math.max(min, Math.min(max, value)) };
vm.createContext(context);
vm.runInContext(app.slice(app.indexOf('function positionAhIndoorLabel(')), context);
function place(curve, line = 75) {
  let baseline = line - 6;
  let x = 12;
  const label = {
    getBBox: () => ({ x: 12, y: baseline - 16, width: 90, height: 20 }),
    getAttribute: () => baseline,
    setAttribute: (name, value) => { if (name === 'y') baseline = value; else if (name === 'x') x = value; },
  };
  context.positionAhIndoorLabel({ querySelector: () => label }, curve, line);
  return { top: baseline - 16, x };
}
test('indoor label avoids crossing segments even when their endpoints are outside its width', () => {
  const shifted = place([{ x: 0, y: 60 }, { x: 150, y: 60 }]);
  assert.equal(shifted.x, 386);
  assert.ok(shifted.top < 75);
  assert.ok(place([{ x: 0, y: 60 }, { x: 480, y: 60 }]).top > 75);
  assert.equal(place([{ x: 0, y: 95 }, { x: 150, y: 95 }]).x, 12);
});
test('indoor label prefers above when clear and stays inside plot at either extreme', () => {
  assert.ok(place([{ x: 0, y: 20 }, { x: 150, y: 20 }]).top < 75);
  for (const line of [15, 129]) {
    const { top, x } = place([{ x: 0, y: 60 }, { x: 150, y: 60 }], line);
    assert.ok(x >= 12 && x + 90 <= 476);
    assert.ok(top >= 18 && top + 20 <= 126);
  }
});
