const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCameraLoader, loadCameraModule, CAMERA_MODULE_FILES } = require('../src/ui/camera-loader.js');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = () => new Promise(setImmediate);
test('resource failures remain retryable before invoking native module import', async () => {
  const seen = [], offline = { fetch: async (url, options) => {
    seen.push([url.pathname.split('/').at(-1), options.cache]);
    throw Error('offline');
  } };
  await assert.rejects(loadCameraModule(offline), /offline/);
  assert.equal(seen.length, CAMERA_MODULE_FILES.length);
  const invalid = { fetch: async () => ({ ok: false }) };
  await assert.rejects(loadCameraModule(invalid), /unavailable/);
  const online = { fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }) };
  assert.equal(typeof (await loadCameraModule(online)).createCameraController, 'function');
  assert.ok(seen.every(([, cache]) => cache === 'force-cache'));
});
function fixture(load) {
  const state = { open: true, visible: true, busy: false, error: '', loads: 0, starts: 0, initialized: 0 };
  const camera = { initialize() { state.initialized++; }, startCamera() { state.starts++; } };
  const loader = createCameraLoader({
    load: () => { state.loads++; return load ? load(camera, state) : camera; },
    canActivate: () => state.open && state.visible,
    setBusy: value => state.busy = value,
    showError: value => state.error = value,
  });
  return { state, camera, loader };
}
test('first tap loads once, ignores repeated taps and retains the initialized controller', async () => {
  const wait = deferred(), f = fixture(() => wait.promise);
  const first = f.loader.start();
  assert.equal(f.state.busy, true);
  await f.loader.start(); await flush();
  assert.equal(f.state.loads, 1);
  wait.resolve(f.camera); await first;
  assert.equal(f.state.busy, false); assert.equal(f.state.starts, 1);
  await f.loader.start();
  assert.equal(f.state.loads, 1); assert.equal(f.state.initialized, 1); assert.equal(f.state.starts, 2);
});
test('dismissal, background and voice cancellation prevent late activation', async () => {
  for (const reason of ['dismiss', 'background', 'pagehide', 'voice']) {
    const wait = deferred(), f = fixture(() => wait.promise), first = f.loader.start();
    if (reason === 'dismiss') f.state.open = false;
    if (reason === 'background') f.state.visible = false;
    f.loader.cancel();
    assert.equal(f.state.busy, false); assert.equal(f.state.error, '');
    // Returning to the sheet/foreground must not revive the cancelled tap.
    f.state.open = f.state.visible = true;
    wait.resolve(f.camera); await first;
    assert.equal(f.state.starts, 0, reason);
    await f.loader.start(); assert.equal(f.state.starts, 1); assert.equal(f.state.loads, 1);
  }
});
test('a new tap after cancellation shares the import but owns activation', async () => {
  const wait = deferred(), f = fixture(() => wait.promise);
  const old = f.loader.start(); f.loader.cancel(); const current = f.loader.start();
  wait.resolve(f.camera); await Promise.all([old, current]);
  assert.equal(f.state.starts, 1); assert.equal(f.state.loads, 1); assert.equal(f.state.busy, false);
});
test('import, creation and initialization failures restore the button and allow retry', async () => {
  for (const stage of ['import', 'creation', 'initialization']) {
    let failed = false;
    const f = fixture(camera => {
      if (!failed) {
        failed = true;
        if (stage === 'import') return Promise.reject(Error('offline'));
        if (stage === 'creation') throw Error('creation failed');
        return { initialize() { throw Error('initialization failed'); } };
      }
      return camera;
    });
    await f.loader.start();
    assert.equal(f.state.busy, false); assert.equal(f.state.starts, 0);
    assert.equal(f.state.error, 'Camera couldn’t load. Try again or enter readings manually.');
    const retry = f.loader.start(); assert.equal(f.state.error, ''); await retry;
    assert.equal(f.state.starts, 1); assert.equal(f.state.loads, 2);
  }
});
test('obsolete failures cannot clear a newer attempt or display an error after cancellation', async () => {
  const wait = deferred(), f = fixture(() => wait.promise);
  const old = f.loader.start(); await flush(); f.loader.cancel();
  wait.reject(Error('offline')); await old;
  assert.equal(f.state.error, ''); assert.equal(f.state.busy, false);
  const next = f.loader.start(); assert.equal(f.state.busy, true); await next;
  assert.notEqual(f.state.error, '');
  f.loader.cancel(); assert.equal(f.state.error, '');
});
test('closed or hidden sheets never load, and eligibility is checked again after loading', async () => {
  const f = fixture(); f.state.open = false; await f.loader.start();
  f.state.open = true; f.state.visible = false; await f.loader.start(); assert.equal(f.state.loads, 0);
  const wait = deferred(), late = fixture(() => wait.promise), start = late.loader.start();
  late.state.visible = false; wait.resolve(late.camera); await start;
  assert.equal(late.state.starts, 0); assert.equal(late.state.busy, false);
});
