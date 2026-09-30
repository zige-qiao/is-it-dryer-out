const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createChart } = require('../src/ui/chart.js');
const { absoluteHumidity, compareMoisture, dewPoint } = require('../src/domain/humidity.js');
const context = createChart();
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

test('chart preserves actual AH values while semantic colour follows the moisture comparison', () => {
  const state = {
    indoorTemp: 10,
    indoorRh: 80,
    outdoorTemp: 30,
    outdoorRh: 24,
    roomPreset: 'medium',
    openingSetup: 'single',
  };
  const weather = {
    time: new Date('2026-09-29T12:00:00Z'),
    temp: 30,
    rh: 24,
    wind: 0,
    pressure: 1013.25,
    dewPoint: dewPoint(30, 24),
  };
  const later = { ...weather, time: new Date('2026-09-29T13:00:00Z') };
  const outlook = createChart({ state }).buildAhOutlook([weather, later], 1);
  const comparison = compareMoisture(state.indoorTemp, state.indoorRh, weather.temp, weather.rh);
  assert.equal(outlook.points[0].value, absoluteHumidity(weather.temp, weather.rh));
  assert.equal(outlook.indoor, absoluteHumidity(state.indoorTemp, state.indoorRh));
  assert.equal(outlook.points[0].semantic, Math.max(0, Math.min(1, 0.5 + comparison.difference / (comparison.margin * 3.5))));
  assert.ok(outlook.points[0].value < outlook.indoor);
  assert.ok(outlook.points[0].semantic < 0.5);
});
