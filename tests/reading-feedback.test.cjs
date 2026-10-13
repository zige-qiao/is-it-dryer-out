const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createReadingControls } = require('../src/ui/readings.js');
const { element, environment } = require('./helpers/browser.cjs');

const fields = [
  ['indoorTemp', 'indoorTempInput', 24, 10, 45, .1, '°C'],
  ['indoorRh', 'indoorRhInput', 58, 10, 90, 1, '%'],
  ['minTemp', 'minTempInput', 18, 8, 28, 1, '°C'],
  ['targetRh', 'targetRhInput', 55, 35, 65, 1, '%'],
  ['roomLength', 'roomLength', 4, 1, 20, .1, ' m'],
  ['roomWidth', 'roomWidth', 5, 1, 20, .1, ' m'],
  ['roomHeight', 'roomHeight', 2.5, 1.8, 5, .1, ' m'],
  ['customAirflow', 'customAirflow', 80, 10, 500, 5, ' m³/h'],
];

function fixture(field = fields[1]) {
  const [key, id, value, min, max, step] = field;
  const input = element(), feedback = element(), ruler = element(), dialog = element(), stepper = element();
  stepper.dataset = { stepTarget: key, stepDirection: '1' };
  input.id = id; input.step = step; input.value = String(value);
  Object.defineProperty(input, 'valueAsNumber', { get: () => input.value.trim() ? Number(input.value) : NaN });
  input.closest = () => dialog;
  input.setAttribute('aria-describedby', 'existing-help');
  feedback.id = `${id}Feedback`; feedback.classList.add('visually-hidden');
  const state = { [key]: value };
  let saves = 0, renders = 0;
  const save = () => { saves++; };
  const controls = createReadingControls({ state, render(){ renders++; }, saveIndoorReadings: save, savePlanSettings: save }, environment({
    document: { querySelector: selector => selector === `#${id}Feedback` ? feedback
      : selector === `[data-ruler="${key}"] input` ? ruler : null, querySelectorAll: () => [stepper] },
  }));
  controls.bindTypedValue(input, key, min, max, save);
  controls.bindSteppers();
  return {input, feedback, ruler, dialog, stepper, state, get saves(){return saves;}, get renders(){return renders;}};
}

test('all typed fields restore invalid entries without saving and explain their own inclusive range', () => {
  for (const field of fields) {
    const [key, id, value, min, max, , unit] = field;
    const f = fixture(field);
    assert.equal(f.input.getAttribute('aria-describedby'), `existing-help ${id}Feedback`);
    for (const invalid of ['', 'not a number', String(min - 1), String(max + 1)]) {
      f.input.value = invalid; f.input.emit('change');
      assert.equal(f.state[key], value);
      assert.equal(Number(f.input.value), value);
      assert.equal(f.saves, 0);
      assert.equal(f.feedback.textContent, `Enter a value between ${min}${unit} and ${max}${unit}. Saved value restored.`);
      assert.equal(f.feedback.classList.contains('visually-hidden'), false);
      assert.notEqual(f.input.getAttribute('aria-invalid'), 'true');
    }
    assert.equal(f.renders, 4);
  }
});

test('feedback clears on a new edit, ruler adjustment, valid commit or sheet dismissal', () => {
  for (const clear of [f => f.input.emit('input'), f => f.ruler.emit('input'), f => f.stepper.emit('click'), f => f.dialog.emit('close'),
    f => { f.input.value = '60'; f.input.emit('change'); }]) {
    const f = fixture(); f.input.value = '105'; f.input.emit('change');
    assert.ok(f.feedback.textContent); clear(f);
    assert.equal(f.feedback.textContent, '');
    assert.equal(f.feedback.classList.contains('visually-hidden'), true);
  }
});

test('valid typed readings still snap, save once and retain inclusive boundaries', () => {
  const f = fixture(fields[0]);
  f.input.value = '23.76'; f.input.emit('change');
  assert.equal(f.state.indoorTemp, 23.8); assert.equal(f.input.value, '23.8'); assert.equal(f.saves, 1);
  for (const field of fields) {
    const [key, , , min, max] = field, f = fixture(field);
    for (const valid of [min, max]) {
      f.input.value = String(valid); f.input.emit('change');
      assert.equal(f.state[key], valid); assert.equal(f.feedback.textContent, '');
    }
    assert.equal(f.saves, 2);
  }
});
