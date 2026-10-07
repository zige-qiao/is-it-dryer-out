const { test } = require('node:test');
const assert = require('node:assert/strict');
const { estimateOpeningWindowPlan, findNextUsefulOpeningTime } = require('../src/domain/ventilation.js');
const { weatherAtTime } = require('../src/domain/forecast.js');
const { dewPoint, vaporPressure, relativeHumidityAtTemperature, compareMoisture } = require('../src/domain/humidity.js');

const startTime = new Date('2026-10-07T12:00:00Z');
const settings = { indoorTemp: 24, indoorRh: 58, targetRh: 55, minTemp: 18, roomPreset: 'medium', openingSetup: 'single', outdoorPressure: 1013.25 };
const weather = (minute, temp, rh, pressure = 1013.25) => ({
  time: new Date(+startTime + minute * 60000), temp, rh, dewPoint: dewPoint(temp, rh), pressure, wind: 10,
});
const estimate = (state, timeline) => estimateOpeningWindowPlan(state, timeline[0], timeline);

test('cooling-hidden moisture removal provides useful drying without claiming the RH target was reached', () => {
  const plan = estimate(settings, [weather(0, 12.6, 94), weather(180, 12.6, 94)]);
  assert.equal(plan.status, 'settling');
  assert.equal(plan.minutes, 45);
  assert.ok(Math.abs(plan.projectedTemp - 20.849805089316344) < 1e-10);
  assert.ok(Math.abs(plan.projectedRh - 59.012553686093106) < 1e-10);
  const referenceRh = relativeHumidityAtTemperature(vaporPressure(plan.projectedTemp, plan.projectedRh), settings.indoorTemp);
  assert.ok(Math.abs(referenceRh - 48.719196285231725) < 1e-10);
  assert.ok(plan.projectedRh > settings.targetRh);
});

test('cooling-hidden drying respects the last permitted temperature state', () => {
  const state = { ...settings, minTemp: 22 };
  const plan = estimate(state, [weather(0, 12.6, 94), weather(180, 12.6, 94)]);
  assert.equal(plan.status, 'too-cold');
  assert.equal(plan.limitMinutes, 26);
  assert.ok(plan.projectedTemp >= state.minTemp);
  assert.ok(state.indoorRh - plan.projectedRh < 1);
});

test('warming with only a small moisture reduction does not establish useful drying', () => {
  const state = { ...settings, indoorTemp: 16, indoorRh: 55, targetRh: 40, minTemp: 10 };
  const plan = estimate(state, [weather(0, 40, 10), weather(180, 40, 10)]);
  assert.equal(plan.status, 'minimal-impact');
  assert.ok(plan.projectedTemp > state.indoorTemp);
  assert.ok(state.indoorRh - plan.projectedRh > 5, 'a large RH fall caused mainly by warming is insufficient');
});

test('pressure-driven RH falls cannot masquerade as moisture removal', () => {
  const state = { ...settings, indoorRh: 65, targetRh: 40, minTemp: 10, roomPreset: 'custom', roomLength: 10, roomWidth: 10, roomHeight: 10, openingSetup: 'custom', customAirflow: 10 };
  const plan = estimate(state, [weather(0, 24, 58), weather(180, 24, 58, 700)]);
  assert.ok(state.indoorRh - plan.projectedRh > 2);
  assert.equal(plan.status, 'minimal-impact');
});

test('useful moisture removal still counts when a pressure increase raises predicted RH', () => {
  const state = { ...settings, indoorRh: 65, targetRh: 40, minTemp: 10, roomPreset: 'custom', roomLength: 10, roomWidth: 10, roomHeight: 10, openingSetup: 'custom', customAirflow: 10 };
  const plan = estimate(state, [weather(0, 24, 50), weather(180, 24, 50, 1200)]);
  assert.equal(plan.status, 'slow');
  assert.ok(plan.projectedRh > state.indoorRh);
});

test('a below-minimum room may dry briefly before the forecast starts cooling it', () => {
  const state = { ...settings, indoorTemp: 16, indoorRh: 80, targetRh: 30, roomPreset: 'small', openingSetup: 'cross' };
  const plan = estimate(state, [weather(0, 22, 5), weather(5, 0, 30)]);
  assert.equal(plan.status, 'too-cold');
  assert.equal(plan.limitMinutes, 1);
  assert.ok(plan.projectedTemp > state.indoorTemp && plan.projectedTemp < state.minTemp);
});

test('the future search finds a useful window after wetter conditions, without mutating inputs', () => {
  const timeline = [weather(0, 24, 90), weather(60, 12, 70), weather(240, 12, 70)];
  const before = structuredClone({ settings, timeline });
  const next = findNextUsefulOpeningTime(settings, timeline);
  assert.equal(estimate(settings, timeline).status, 'wetter');
  assert.equal(next.toISOString(), '2026-10-07T12:31:00.000Z');
  assert.deepEqual({ settings, timeline }, before);
  const nextWeather = weatherAtTime(timeline, next);
  assert.equal(compareMoisture(settings.indoorTemp, settings.indoorRh, nextWeather.temp, nextWeather.rh).status, 'drier');
  const plan = estimateOpeningWindowPlan(settings, nextWeather, timeline);
  assert.ok((plan.minutes ?? plan.limitMinutes) > 0);
});

test('a minute search catches a brief useful window between quarter-hour boundaries', () => {
  const state = { ...settings, roomPreset: 'small', openingSetup: 'cross' };
  const timeline = [weather(0, 24, 90), weather(6, 24, 30), weather(12, 24, 90), weather(180, 24, 90)];
  assert.equal(findNextUsefulOpeningTime(state, timeline).toISOString(), '2026-10-07T12:03:00.000Z');
});

test('drier weather that would immediately breach the minimum provides no future opening time', () => {
  const state = { ...settings, indoorTemp: 18, indoorRh: 70, targetRh: 40 };
  const timeline = [weather(0, 10, 95), weather(48 * 60, 10, 95)];
  assert.equal(findNextUsefulOpeningTime(state, timeline), null);
});

test('future guidance requires enough available weather to establish a benefit without extrapolating', () => {
  assert.equal(findNextUsefulOpeningTime(settings, []), null);
  assert.equal(findNextUsefulOpeningTime(settings, [weather(0, 24, 30)]), null);
  const timeline = [weather(0, 24, 90), weather(1, 24, 30)];
  assert.equal(findNextUsefulOpeningTime(settings, timeline), null);
  const last = timeline.at(-1);
  assert.equal(estimateOpeningWindowPlan(settings, last, [last]).status, 'good', 'holding the final sample would incorrectly establish a future opportunity');
});

test('saturation checks use moisture removed before the unsafe pressure step', () => {
  const state = { ...settings, indoorRh: 90, targetRh: 40, roomPreset: 'small', openingSetup: 'cross' };
  const timeline = [weather(0, 12.6, 94), weather(1, 12.6, 94), weather(2, 12.6, 94, 1600)];
  const plan = estimate(state, timeline);
  assert.equal(plan.status, 'condensation');
  assert.equal(plan.limitMinutes, 1);
  assert.ok(plan.projectedRh < 100);
  assert.ok(plan.projectedTemp >= state.minTemp);
  assert.ok(state.indoorRh - plan.projectedRh > 1);
});

test('the search stops at 48 hours even with later suitable weather', () => {
  const timeline = [weather(0, 24, 90), weather(48 * 60, 24, 90), weather(49 * 60, 24, 30), weather(52 * 60, 24, 30)];
  assert.equal(findNextUsefulOpeningTime(settings, timeline), null);
});

test('a future opportunity can be found beyond 24 hours irrespective of chart range', () => {
  const timeline = [weather(0, 24, 90), weather(25 * 60, 24, 90), weather(26 * 60, 24, 30), weather(29 * 60, 24, 30)];
  const a = findNextUsefulOpeningTime({ ...settings, chartHours: 24 }, timeline);
  const b = findNextUsefulOpeningTime({ ...settings, chartHours: 48 }, timeline);
  assert.ok(+a > +startTime + 24 * 3600000);
  assert.equal(+a, +b);
});
