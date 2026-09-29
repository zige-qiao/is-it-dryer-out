const { test } = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./fixtures/ventilation-baseline.json');
const { estimateOpeningWindowPlan } = require('../src/domain/ventilation.js');
const { parseVoiceCommand } = require('../src/voice/parser.js');
const { relativeHumidityAtTemperature, saturationVaporPressure } = require('../src/domain/humidity.js');

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
