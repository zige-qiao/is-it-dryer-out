const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGeocoding } = require('../src/services/geocoding.js');
const { REVERSE_GEOCODING_TIMEOUT_MS } = require('../src/config.js');
const { environment } = require('./helpers/browser.cjs');

const tick = () => new Promise(setImmediate);
function fixture(fetch) {
  const timers = new Map();
  let now = 0, nextTimer = 0;
  const service = createGeocoding({}, environment({ fetch,
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id),
  }));
  return { service, timers, advance(ms) {
    now += ms;
    for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); }
  } };
}
function observedSignal() {
  const controller = new AbortController(), signal = controller.signal;
  const add = signal.addEventListener.bind(signal), remove = signal.removeEventListener.bind(signal);
  const listeners = new Set();
  signal.addEventListener = (event, listener, options) => { if (event === 'abort') listeners.add(listener); add(event, listener, options); };
  signal.removeEventListener = (event, listener) => { if (event === 'abort') listeners.delete(listener); remove(event, listener); };
  return { controller, signal, listeners };
}

for (const phase of ['fetch', 'decode']) test(`reverse lookup has one five-second deadline including stalled ${phase}`, async () => {
  let requestSignal, finish;
  const stalled = new Promise(resolve => { finish = resolve; });
  const f = fixture((url, options) => { requestSignal = options.signal; return phase === 'fetch' ? stalled : Promise.resolve({ ok: true, json: () => stalled }); });
  const external = observedSignal();
  const lookup = f.service.reverseGeocodeLocation(53.4, -2.3, { signal: external.signal });
  const rejected = assert.rejects(lookup, { name: 'TimeoutError' });
  await tick();
  f.advance(REVERSE_GEOCODING_TIMEOUT_MS - 1);
  assert.equal(requestSignal.aborted, false);
  f.advance(1);
  await rejected;
  assert.equal(requestSignal.aborted, true);
  assert.equal(f.timers.size, 0);
  assert.equal(external.listeners.size, 0);
  finish(phase === 'fetch' ? { ok: true, json: async () => ({ locality: 'Late name' }) } : { locality: 'Late name' });
  await tick();
});

for (const phase of ['fetch', 'decode']) test(`caller cancellation settles stalled ${phase} and releases lookup resources`, async () => {
  let requestSignal;
  const stalled = new Promise(() => {});
  const f = fixture((url, options) => { requestSignal = options.signal; return phase === 'fetch' ? stalled : Promise.resolve({ ok: true, json: () => stalled }); });
  const external = observedSignal();
  const lookup = f.service.reverseGeocodeLocation(53.4, -2.3, { signal: external.signal });
  const rejected = assert.rejects(lookup, { name: 'AbortError' });
  await tick();
  external.controller.abort();
  await rejected;
  assert.equal(requestSignal.aborted, true);
  assert.equal(f.timers.size, 0);
  assert.equal(external.listeners.size, 0);
});

test('an already-cancelled lookup does not fetch or arm a timer', async () => {
  let calls = 0;
  const f = fixture(() => { calls++; });
  const external = observedSignal(); external.controller.abort();
  await assert.rejects(f.service.reverseGeocodeLocation(53, -2, { signal: external.signal }), { name: 'AbortError' });
  assert.equal(calls, 0); assert.equal(f.timers.size, 0); assert.equal(external.listeners.size, 0);
});

test('successful names and request/decode failures all clean up the deadline and listener', async () => {
  for (const outcome of ['success', 'http', 'decode', 'fetch']) {
    const f = fixture(async () => {
      if (outcome === 'fetch') throw new Error('Offline');
      return { ok: outcome !== 'http', json: async () => {
        if (outcome === 'decode') throw new Error('Invalid JSON');
        return { locality: 'Sale', city: 'Sale', principalSubdivision: 'Greater Manchester' };
      } };
    });
    const external = observedSignal();
    const lookup = f.service.reverseGeocodeLocation(53, -2, { signal: external.signal });
    if (outcome === 'success') assert.equal(await lookup, 'Sale, Greater Manchester');
    else await assert.rejects(lookup);
    assert.equal(f.timers.size, 0); assert.equal(external.listeners.size, 0);
  }
});
