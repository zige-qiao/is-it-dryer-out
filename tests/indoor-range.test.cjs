const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateCameraReadings } = require('../src/camera/readings.js');
const { parseVoiceCommand } = require('../src/voice/parser.js');
const { createStorage } = require('../src/services/storage.js');
const { STORAGE_KEY } = require('../src/config.js');
const { memoryStorage } = require('./helpers/browser.cjs');
const { compareMoisture } = require('../src/domain/humidity.js');

test('camera and voice accept the new inclusive boundaries and reject outside them', () => {
  for (const [temp, rh] of [[10, 10], [45, 90], [38.7, 15]]) {
    assert.equal(validateCameraReadings(String(temp), String(rh)).valid, true);
    assert.deepEqual(parseVoiceCommand(`${temp} degrees ${rh} percent`).values, { indoorTemp: temp, indoorRh: rh });
  }
  for (const [temp, rh] of [[9.9, 50], [45.1, 50], [25, 9], [25, 91], [25, 10.5]]) assert.equal(validateCameraReadings(temp, rh).valid, false);
  assert.deepEqual(parseVoiceCommand('40 20').values, { indoorTemp: 40, indoorRh: 20 });
});
test('saved expanded-range values survive reload and Auto flash defaults migrate independently', () => {
  const localStorage = memoryStorage(), state = { indoorTemp: 24, indoorRh: 58 }, uiPreferences = { autoFlash: true };
  const storage = createStorage({ state, uiPreferences, applyUiPreferences() {} }, { localStorage, Date });
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ indoorTemp: 45, indoorRh: 10 })); storage.loadIndoorReadings();
  assert.equal(state.indoorTemp, 45); assert.equal(state.indoorRh, 10); storage.loadUiPreferences(); assert.equal(uiPreferences.autoFlash, true);
  uiPreferences.autoFlash = false; storage.saveUiPreferences(); uiPreferences.autoFlash = true; storage.loadUiPreferences(); assert.equal(uiPreferences.autoFlash, false);
});
test('moisture comparison remains finite at indoor range extremes', () => {
  for (const temp of [10, 45]) for (const rh of [10, 90]) {
    const comparison = compareMoisture(temp, rh, 8, 80);
    for (const value of Object.values(comparison)) if (typeof value === 'number') assert.ok(Number.isFinite(value));
  }
});
