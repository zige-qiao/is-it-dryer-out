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
  const label = {
    getBBox: () => ({ x: 12, y: baseline - 16, width: 90, height: 20 }),
    getAttribute: () => baseline,
    setAttribute: (_, value) => { baseline = value; },
  };
  context.positionAhIndoorLabel({ querySelector: () => label }, curve, line);
  return baseline - 16;
}
test('indoor label avoids crossing segments even when their endpoints are outside its width', () => {
  assert.ok(place([{ x: 0, y: 60 }, { x: 150, y: 60 }]) > 75);
  assert.ok(place([{ x: 0, y: 95 }, { x: 150, y: 95 }]) < 75);
});
test('indoor label prefers above when clear and stays inside plot at either extreme', () => {
  assert.ok(place([{ x: 0, y: 20 }, { x: 150, y: 20 }]) < 75);
  for (const line of [15, 129]) {
    const top = place([{ x: 0, y: 60 }, { x: 150, y: 60 }], line);
    assert.ok(top >= 18 && top + 20 <= 126);
  }
});
