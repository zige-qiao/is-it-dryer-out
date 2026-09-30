const { test } = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./fixtures/ventilation-baseline.json');
const { estimateOpeningWindowPlan } = require('../src/domain/ventilation.js');
const { parseVoiceCommand } = require('../src/voice/parser.js');
const { absoluteHumidity, compareMoisture, dewPoint, humidityRatio, relativeHumidityAtTemperature, saturationVaporPressure } = require('../src/domain/humidity.js');

for(const fixture of fixtures) test(`calculation parity: ${fixture.label}`, () => {
  const weather = value => ({...value,time:new Date(value.time)});
  const settings = structuredClone(fixture.settings), before=structuredClone(settings);
  assert.deepEqual(estimateOpeningWindowPlan(settings,weather(fixture.start),fixture.timeline.map(weather)),fixture.expected);
  assert.deepEqual(settings,before,'calculations must not mutate their input');
  if(fixture.expectedWarmedRh !== undefined) {
    assert.equal(relativeHumidityAtTemperature(saturationVaporPressure(fixture.start.dewPoint),settings.indoorTemp),fixture.expectedWarmedRh);
    assert.ok(fixture.expectedWarmedRh>=100,'outdoor air should present condensation risk');
  }
});
test('voice parser handles labelled readings, shorthand, exclusions and range errors', () => {
  assert.deepEqual(parseVoiceCommand('21 and 55').values,{indoorTemp:21,indoorRh:55});
  assert.deepEqual(parseVoiceCommand('humidity 60 percent').values,{indoorRh:60});
  assert.deepEqual(parseVoiceCommand("don't change temperature, humidity 60 percent").values,{indoorRh:60});
  assert.ok(parseVoiceCommand('temperature 90 degrees').errors.length);
});

test('moisture status follows humidity ratio even when actual AH orders the readings differently', () => {
  const indoor = { temp: 10, rh: 80 };
  const outdoor = { temp: 30, rh: 24 };
  assert.ok(absoluteHumidity(indoor.temp, indoor.rh) > absoluteHumidity(outdoor.temp, outdoor.rh));
  assert.ok(humidityRatio(indoor.temp, indoor.rh) < humidityRatio(outdoor.temp, outdoor.rh));
  const comparison = compareMoisture(indoor.temp, indoor.rh, outdoor.temp, outdoor.rh);
  assert.ok(comparison.difference < 0);
  assert.ok(comparison.outdoorEquivalent > comparison.indoor);
});

test('a cold room may be ventilated when incoming drier air warms it', () => {
  const settings = {
    ...fixtures[1].settings,
    indoorTemp: 16,
    indoorRh: 65,
    minTemp: 18,
    targetRh: 45,
  };
  const start = {
    time: new Date('2026-09-29T12:00:00Z'),
    temp: 22,
    rh: 35,
    pressure: 1013.25,
    wind: 10,
    dewPoint: dewPoint(22, 35),
  };
  const later = { ...start, time: new Date('2026-09-29T15:00:00Z') };
  const plan = estimateOpeningWindowPlan(settings, start, [start, later]);
  assert.notEqual(plan.status, 'below-minimum');
  assert.notEqual(plan.status, 'too-cold');
  assert.ok(plan.projectedTemp > settings.indoorTemp);
});

test('a room below its minimum still rejects air that would cool it', () => {
  const settings = { ...fixtures[1].settings, indoorTemp: 16, indoorRh: 65, minTemp: 18 };
  const start = { ...fixtures[1].start, time: new Date(fixtures[1].start.time), temp: 10 };
  assert.equal(estimateOpeningWindowPlan(settings, start, [start]).status, 'below-minimum');
});

test('warming a cold room stops when the forecast starts cooling it again below minimum', () => {
  const settings = {
    ...fixtures[1].settings,
    indoorTemp: 16,
    indoorRh: 65,
    minTemp: 18,
    targetRh: 30,
  };
  const start = {
    time: new Date('2026-09-29T12:00:00Z'),
    temp: 22,
    rh: 35,
    pressure: 1013.25,
    wind: 10,
    dewPoint: dewPoint(22, 35),
  };
  const cooler = {
    ...start,
    time: new Date('2026-09-29T12:05:00Z'),
    temp: 0,
    rh: 30,
    dewPoint: dewPoint(0, 30),
  };
  const plan = estimateOpeningWindowPlan(settings, start, [start, cooler]);
  assert.equal(plan.status, 'minimal-impact');
  assert.equal(plan.limitMinutes, 1);
  assert.ok(plan.projectedTemp >= settings.indoorTemp);
});
