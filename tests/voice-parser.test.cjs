const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseVoiceCommand, parseSpokenNumber, lastValueBeforeUnit, inferUnlabelledIndoorValues } = require('../src/voice/parser.js');

test('adjacent Celsius unit names preserve both labelled and unlabelled readings', () => {
  for (const transcript of [
    '21 degrees Celsius, 55 percent',
    'twenty-one degree Celsius and fifty-five per cent',
    'twenty-one degrees C and fifty-five percent',
    '21 Celsius, 55 percent',
    '21 C, 55 percent',
    '21°C, 55%',
    'temperature 21 degrees Celsius, humidity 55 percent',
  ]) assert.deepEqual(parseVoiceCommand(transcript), { values: { indoorTemp: 21, indoorRh: 55 }, errors: [] }, transcript);
});

test('corrections, hyphenated number words, one-field updates and rounding retain their behaviour', () => {
  const examples = [
    ['21 degrees Celsius actually 22 Celsius, 55 percent', { indoorTemp: 22, indoorRh: 55 }],
    ['temperature twenty-one, sorry twenty-two and a half degrees Celsius', { indoorTemp: 22.5 }],
    ['humidity fifty percent, no fifty-five percent', { indoorRh: 55 }],
    ['temperature 20 degrees, I mean 21 degrees', { indoorTemp: 21 }],
    ['humidity 50 percent, make that 60 percent', { indoorRh: 60 }],
    ['21 and 55 actually 22 and 60', { indoorTemp: 22, indoorRh: 60 }],
    ['humidity 55.6 percent', { indoorRh: 56 }],
    ['temperature 21.46 degrees', { indoorTemp: 21.5 }],
    ['temperature twenty-one point five degrees Celsius', { indoorTemp: 21.5 }],
    ['room is 22 degrees, relative humidity 60 percent', { indoorTemp: 22, indoorRh: 60 }],
  ];
  for (const [transcript, values] of examples) assert.deepEqual(parseVoiceCommand(transcript), { values, errors: [] }, transcript);
});

test('negated readings cannot reappear through unit fallback or numeric shorthand', () => {
  for (const transcript of [
    "don't change humidity 60 percent",
    'do not change temperature 21 degrees Celsius',
    'dont set indoor humidity 60 percent',
    "don't update my indoor relative humidity 60 percent",
    'do not change the temperature 90 degrees',
    'do not change 21 degrees, 55 percent',
    'do not change 21 and 55',
    'don’t change humidity 60 percent',
    'do not change temperature 21 degrees and humidity 60 percent',
    'do not change temperature or humidity 60 percent',
    'do not change 21 degrees and humidity 60 percent',
  ]) assert.deepEqual(parseVoiceCommand(transcript), { values: {}, errors: [] }, transcript);
  assert.equal(lastValueBeforeUnit('do not change humidity 60 percent', 'percent'), null);
  assert.deepEqual(inferUnlabelledIndoorValues('do not change 21 and 55'), {});
});

test('negated fields remain excluded while an explicit other field can update', () => {
  for (const transcript of [
    "don't change temperature, humidity 60 percent",
    'do not change temperature 21 degrees Celsius, humidity 60 percent',
    'humidity 60 percent, do not change temperature 21 degrees',
  ]) assert.deepEqual(parseVoiceCommand(transcript), { values: { indoorRh: 60 }, errors: [] }, transcript);
  assert.deepEqual(parseVoiceCommand('do not change humidity 60 percent, temperature 21 degrees'),
    { values: { indoorTemp: 21 }, errors: [] });
});

test('target and minimum settings never become current indoor readings or range errors', () => {
  for (const transcript of [
    'target humidity 55 percent',
    'target indoor relative humidity 55 percent',
    'target room humidity 55 percent',
    'target temperature 21 degrees',
    'minimum humidity 55 percent',
    'target 55 percent',
    'target 55',
    'minimum temperature 18 degrees',
    'minimum indoor temperature 18 degrees Celsius',
    'min room temp 18 degrees C',
    'minimum 18 degrees',
    'min 18',
    'target humidity minus sixty percent, minimum temperature -20 degrees',
    'target humidity 55 percent actually 60 percent',
  ]) assert.deepEqual(parseVoiceCommand(transcript), { values: {}, errors: [] }, transcript);
  assert.equal(lastValueBeforeUnit('target 55 percent', 'percent'), null);
  assert.deepEqual(inferUnlabelledIndoorValues('minimum 18'), {});
});

test('plan-field exclusions preserve explicit current readings on either side', () => {
  const examples = [
    ['target humidity 55 percent, temperature 21 degrees Celsius', { indoorTemp: 21 }],
    ['temperature 21 degrees Celsius, target humidity 55 percent', { indoorTemp: 21 }],
    ['minimum temperature 18 degrees, humidity 60 percent', { indoorRh: 60 }],
    ['minimum 18 degrees, humidity 60 percent', { indoorRh: 60 }],
    ['humidity 60 percent, min temp 18 degrees', { indoorRh: 60 }],
    ['temperature 21, target 55', { indoorTemp: 21 }],
  ];
  for (const [transcript, values] of examples) assert.deepEqual(parseVoiceCommand(transcript), { values, errors: [] }, transcript);
});

test('signed numeric and spoken negative temperatures produce range errors', () => {
  for (const transcript of [
    'temperature -20 degrees',
    'temperature −20 degrees Celsius',
    'minus 20 degrees C',
    'temperature minus twenty-one point five degrees',
    'temperature negative twenty-one and a half degrees Celsius',
    '-20.5°C',
    '-20.5',
  ]) {
    const result = parseVoiceCommand(transcript);
    assert.deepEqual(result.values, {}, transcript);
    assert.match(result.errors.join(' '), /Indoor temperature must be between 10 and 45/, transcript);
  }
});

test('negative humidity and identifiable negative shorthand fields retain their signs for validation', () => {
  for (const transcript of ['humidity -60 percent', 'humidity minus twenty percent', 'negative sixty per cent', '-60']) {
    const result = parseVoiceCommand(transcript);
    assert.deepEqual(result.values, {}, transcript);
    assert.match(result.errors.join(' '), /Indoor humidity must be between 10 and 90/, transcript);
  }
  assert.deepEqual(parseVoiceCommand('minus 20 and 55'), {
    values: { indoorRh: 55 }, errors: ['Indoor temperature must be between 10 and 45.'],
  });
  assert.deepEqual(parseVoiceCommand('21 and minus 60'), {
    values: { indoorTemp: 21 }, errors: ['Indoor humidity must be between 10 and 90.'],
  });
  assert.deepEqual(parseVoiceCommand('temperature minus twenty, actually twenty-one degrees'), {
    values: { indoorTemp: 21 }, errors: [],
  });
  assert.deepEqual(parseVoiceCommand('temperature twenty-one, no minus twenty degrees'), {
    values: {}, errors: ['Indoor temperature must be between 10 and 45.'],
  });
  assert.equal(parseSpokenNumber('minus twenty-one and a half'), -21.5);
  assert.equal(parseSpokenNumber('-21.5 and a half'), -22);
  assert.deepEqual(parseVoiceCommand('+21 degrees Celsius, +55 percent'), { values: { indoorTemp: 21, indoorRh: 55 }, errors: [] });
});
