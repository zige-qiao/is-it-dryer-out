const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFlashTest } = require('../camera-flash-test.js');
const { element, environment } = require('./helpers/browser.cjs');

function fixture(options = {}) {
  const elements = Object.fromEntries(['start', 'capture', 'status', 'capabilities', 'video', 'result', 'photo'].map(id => [id, element()]));
  const tracks = [], requests = [], shots = [], revoked = [], timers = new Map();
  let now = 0, id = 0, time = 0, advancing = true;
  const document = element(); document.hidden = false;
  const window = element();
  Object.assign(elements.video, {
    readyState: 4, paused: true,
    async play() { this.paused = false; if (options.playFailsAfterPhoto && shots.length) throw Error('play failed'); },
    pause() { this.paused = true; },
  });
  Object.defineProperty(elements.video, 'currentTime', { get() { if (advancing) time++; return time; } });
  elements.photo.decode = async () => {};
  const env = environment({
    document, isSecureContext: options.secure !== false,
    addEventListener: window.addEventListener.bind(window),
    navigator: { mediaDevices: { async getUserMedia(value) {
      requests.push(value);
      const track = { readyState: 'live', stop() { this.readyState = 'ended'; this.stopped = true; } }; tracks.push(track);
      if (options.permission) await options.permission;
      if (options.reopenFails && tracks.length > 1) throw Error('reopen failed');
      if (tracks.length > 1) advancing = true;
      return { getTracks: () => [track], getVideoTracks: () => [track] };
    } } },
    ImageCapture: options.missingAPI ? undefined : class {
      constructor(track) { this.track = track; }
      async getPhotoCapabilities() {
        if (options.capabilityError) throw Error('capabilities failed');
        return { fillLightMode: options.modes || ['off', 'flash'] };
      }
      async takePhoto(settings) {
        shots.push({ track: this.track, settings });
        if (options.stalls) advancing = false;
        if (options.photoError) throw Error('capture failed');
        if (options.photoPromise) return options.photoPromise;
        return new Blob(['photo'], { type: 'image/jpeg' });
      }
    },
    URL: { createObjectURL: () => 'blob:photo', revokeObjectURL: value => revoked.push(value) },
    setTimeout(fn, ms) { timers.set(++id, { fn, due: now + ms }); return id; },
    clearTimeout(key) { timers.delete(key); },
  });
  const controller = createFlashTest(elements, env); controller.initialize();
  async function flush() { for (let n = 0; n < 12; n++) await Promise.resolve(); }
  async function finish(promise) {
    let done = false; promise.finally(() => { done = true; });
    for (let n = 0; n < 200 && !done; n++) {
      await flush(); now += 100;
      for (const [key, timer] of [...timers]) if (timer.due <= now && timers.delete(key)) timer.fn();
    }
    assert.ok(done, 'operation settled within its deadline'); await promise;
  }
  return { elements, document, window, controller, tracks, shots, requests, revoked, timers, finish, flush };
}

test('uses the live rear-camera video track to request a real flash photo and resumes preview', async () => {
  const f = fixture(); await f.finish(f.controller.startCamera());
  assert.equal(f.requests[0].audio, false); assert.equal(f.requests[0].video.facingMode.ideal, 'environment');
  await f.finish(f.controller.takePhoto());
  assert.equal(f.shots[0].track, f.tracks[0]); assert.deepEqual(f.shots[0].settings, { fillLightMode: 'flash' });
  assert.equal(f.requests.length, 1); assert.equal(f.elements.result.hidden, false);
  assert.match(f.elements.status.textContent, /Photo captured.*Live feed resumed/);
  assert.equal(f.elements.capture.disabled, false); assert.equal(f.timers.size, 0);
});

for (const [name, options] of [
  ['missing ImageCapture', { missingAPI: true }], ['no flash mode', { modes: ['off', 'auto'] }],
  ['capability failure', { capabilityError: true }],
]) test(`${name} leaves the feed open but never requests a flash photo`, async () => {
  const f = fixture(options); await f.finish(f.controller.startCamera()); await f.controller.takePhoto();
  assert.equal(f.elements.capture.disabled, true); assert.equal(f.shots.length, 0);
  assert.equal(f.elements.video.hidden, false); assert.ok(f.elements.capabilities.textContent);
});

test('failed capture leaves preview and retry usable', async () => {
  const f = fixture({ photoError: true }); await f.finish(f.controller.startCamera()); await f.finish(f.controller.takePhoto());
  assert.match(f.elements.status.textContent, /Photo failed.*capture failed.*Live feed resumed/);
  assert.equal(f.elements.capture.disabled, false); assert.equal(f.elements.result.hidden, true);
});

test('stalled preview reopens the camera without discarding the captured photo', async () => {
  const f = fixture({ stalls: true }); await f.finish(f.controller.startCamera()); await f.finish(f.controller.takePhoto());
  assert.equal(f.requests.length, 2); assert.equal(f.tracks[0].stopped, true);
  assert.equal(f.elements.result.hidden, false); assert.equal(f.elements.capture.disabled, false);
});

test('failed preview recovery offers Start camera and preserves photo', async () => {
  const f = fixture({ stalls: true, reopenFails: true }); await f.finish(f.controller.startCamera()); await f.finish(f.controller.takePhoto());
  assert.match(f.elements.status.textContent, /Photo captured.*reopen failed/);
  assert.equal(f.elements.start.disabled, false); assert.equal(f.elements.capture.disabled, true);
  assert.equal(f.elements.result.hidden, false);
});

test('hung capture times out and overlapping capture taps are ignored', async () => {
  const f = fixture({ photoPromise: new Promise(() => {}) }); await f.finish(f.controller.startCamera());
  const attempt = f.controller.takePhoto(); await f.controller.takePhoto(); await f.finish(attempt);
  assert.equal(f.shots.length, 1); assert.match(f.elements.status.textContent, /timed out.*Live feed resumed/);
  assert.equal(f.elements.capture.disabled, false); assert.equal(f.timers.size, 0);
});

test('backgrounding cancels pending capture and late photos cannot reappear', async () => {
  let resolve; const f = fixture({ photoPromise: new Promise(done => resolve = done) });
  await f.finish(f.controller.startCamera()); const attempt = f.controller.takePhoto();
  f.document.hidden = true; f.document.emit('visibilitychange');
  resolve(new Blob(['late'])); await f.finish(attempt);
  assert.ok(f.tracks[0].stopped); assert.equal(f.elements.result.hidden, true);
  assert.equal(f.elements.video.srcObject, null); assert.equal(f.timers.size, 0);
});

test('late permission approval after page exit immediately releases the acquired camera', async () => {
  let resolve; const f = fixture({ permission: new Promise(done => resolve = done) });
  const attempt = f.controller.startCamera(); f.window.emit('pagehide'); resolve(); await f.finish(attempt);
  assert.ok(f.tracks[0].stopped); assert.equal(f.elements.video.srcObject, null);
});

test('page exit releases live camera and photo object URL', async () => {
  const f = fixture(); await f.finish(f.controller.startCamera()); await f.finish(f.controller.takePhoto());
  f.window.emit('pagehide'); assert.ok(f.tracks[0].stopped); assert.deepEqual(f.revoked, ['blob:photo']);
  assert.equal(f.elements.result.hidden, true); assert.equal(f.elements.capture.disabled, true);
});

test('insecure context explains HTTPS requirement without opening camera', async () => {
  const f = fixture({ secure: false }); await f.finish(f.controller.startCamera());
  assert.match(f.elements.status.textContent, /HTTPS/); assert.equal(f.requests.length, 0);
});
