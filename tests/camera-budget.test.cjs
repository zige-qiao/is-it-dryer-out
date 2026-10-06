const test = require('node:test');
const assert = require('node:assert/strict');
const { RECOGNITION_LIMIT_MS, createRecognitionBudget, runWithRecognitionBudget, checkRecognitionBudget } = require('../src/camera/budget.js');
const { normalise, components } = require('../src/camera/image.js');

test('the public operation limit and omitted worker budget share ten seconds', async () => {
  const { RECOGNITION_LIMIT_MS: publicLimit } = require('../src/camera/recognition.js');
  const { processImage } = require('../src/camera/worker.js');
  assert.equal(RECOGNITION_LIMIT_MS, 10000);
  assert.equal(publicLimit, RECOGNITION_LIMIT_MS);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'performance');
  const pixels = { width: 20, height: 20, data: new Uint8ClampedArray(20 * 20 * 4).fill(205) };
  try {
    for (const elapsed of [9000, 10000]) {
      let calls = 0;
      Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => calls++ ? elapsed : 0 } });
      const pending = processImage({ pixels, kind: 'prepare' });
      if (elapsed < RECOGNITION_LIMIT_MS) assert.ok(await pending);
      else await assert.rejects(pending, { name: 'RecognitionDeadlineError' });
    }
  } finally {
    Object.defineProperty(globalThis, 'performance', descriptor);
  }
});

test('recognition budget rejects expiry and cancellation after yielding', async () => {
  let clock = 0, current = true;
  const budget = createRecognitionBudget({ now: () => clock, deadline: 8,
    isCurrent: () => current, yieldControl: async () => { clock = 8; } });
  assert.equal(budget.check(), true);
  await assert.rejects(budget.checkpoint(), { name: 'RecognitionDeadlineError' });
  current = false;
  assert.throws(budget.check, { name: 'RecognitionCancelledError' });
});

test('pixel normalization and component expansion check the active deadline inside their loops', () => {
  for (const work of [
    () => normalise({ width: 128, height: 128, data: new Uint8ClampedArray(128 * 128 * 4) }),
    () => components(new Uint8Array(128 * 128).fill(1), 128, 128),
  ]) {
    let checks = 0;
    const budget = createRecognitionBudget({ now: () => checks++, deadline: 3 });
    assert.throws(() => runWithRecognitionBudget(budget.check, work), { name: 'RecognitionDeadlineError' });
    assert.equal(checkRecognitionBudget(), true, 'failed work restores the enclosing guard');
  }
});

test('nested synchronous budget guards restore their caller', () => {
  let outer = 0, inner = 0;
  runWithRecognitionBudget(() => ++outer, () => {
    runWithRecognitionBudget(() => ++inner, checkRecognitionBudget);
    checkRecognitionBudget();
  });
  assert.equal(outer, 2);
  assert.equal(inner, 2);
  assert.equal(checkRecognitionBudget(), true);
});
