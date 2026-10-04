const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFlashTest } = require('../camera-flash-test.js');
const { element, environment } = require('./helpers/browser.cjs');

function fixture(options = {}) {
  const elements = Object.fromEntries(['start', 'plain', 'capture', 'torch', 'pause', 'status', 'capabilities', 'video', 'result', 'resultMode', 'photo'].map(id => [id, element()]));
  const tracks = [], requests = [], shots = [], changes = [], revoked = [], timers = new Map();
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
      const state = { torch: false };
      const track = {
        readyState: 'live', stop() { this.readyState = 'ended'; this.stopped = true; state.torch = false; },
        getCapabilities: () => ({ torch: options.torch !== false }),
        getSettings: () => ({ ...state }),
        getConstraints: () => ({ width: { ideal: 1920 }, advanced: [{ zoom: 2, torch: state.torch }] }),
        async applyConstraints(value) {
          const on = value.advanced.at(-1).torch; changes.push({ on, value, track: this });
          if (options.torchPromise) await options.torchPromise;
          if (options.torchOffFails && !on) throw new Error('torch off failed');
          if (options.torchOnFails && on && changes.length > 1) throw new Error('torch restore failed');
          if (!options.ignoreTorch) state.torch = on;
        },
      }; tracks.push(track);
      if (options.permission) await options.permission;
      if (options.reopenFails && tracks.length > 1) throw Error('reopen failed');
      if (tracks.length > 1) advancing = true;
      return { getTracks: () => [track], getVideoTracks: () => [track] };
    } } },
    ImageCapture: options.missingAPI ? undefined : class {
      constructor(track) { this.track = track; if (options.noCapabilitiesMethod) this.getPhotoCapabilities = undefined; if (options.noPhotoMethod) this.takePhoto = undefined; }
      async getPhotoCapabilities() {
        if (options.capabilityError) throw Error('capabilities failed');
        if (options.capabilityPromise) return options.capabilityPromise;
        return { fillLightMode: options.modes || ['off', 'flash'] };
      }
      async takePhoto(settings) {
        shots.push({ track: this.track, settings, paused: elements.video.paused, torch: this.track.getSettings().torch });
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
  return { elements, document, window, controller, tracks, shots, changes, requests, revoked, timers, finish, flush };
}

test('uses the live rear-camera video track to request a real flash photo and resumes preview', async () => {
  const f = fixture(); await f.finish(f.controller.startCamera());
  assert.equal(f.requests[0].audio, false); assert.equal(f.requests[0].video.facingMode.ideal, 'environment');
  await f.finish(f.controller.takePhoto('flash'));
  assert.equal(f.shots[0].track, f.tracks[0]); assert.deepEqual(f.shots[0].settings, { fillLightMode: 'flash' });
  assert.equal(f.requests.length, 1); assert.equal(f.elements.result.hidden, false);
  assert.match(f.elements.status.textContent, /Photo returned.*Live feed active/);
  assert.equal(f.elements.capture.disabled, false); assert.equal(f.timers.size, 0);
});

for (const [name, options] of [
  ['missing ImageCapture', { missingAPI: true }], ['missing takePhoto', { noPhotoMethod: true }],
]) test(`${name} leaves the feed open but never requests a photo`, async () => {
  const f = fixture(options); await f.finish(f.controller.startCamera()); await f.controller.takePhoto();
  assert.equal(f.elements.capture.disabled, true); assert.equal(f.shots.length, 0);
  assert.equal(f.elements.video.hidden, false); assert.ok(f.elements.capabilities.textContent);
});

test('failed capture leaves preview and retry usable', async () => {
  const f = fixture({ photoError: true }); await f.finish(f.controller.startCamera()); await f.finish(f.controller.takePhoto());
  assert.match(f.elements.status.textContent, /Photo failed.*capture failed.*Live feed active/);
  assert.equal(f.elements.capture.disabled, false); assert.equal(f.elements.result.hidden, true);
});

test('stalled preview reopens the camera without discarding the captured photo', async () => {
  const f = fixture({ stalls: true }); await f.finish(f.controller.startCamera()); await f.finish(f.controller.takePhoto());
  assert.equal(f.requests.length, 2); assert.equal(f.tracks[0].stopped, true);
  assert.equal(f.elements.result.hidden, false); assert.equal(f.elements.capture.disabled, false);
});

test('failed preview recovery offers Start camera and preserves photo', async () => {
  const f = fixture({ stalls: true, reopenFails: true }); await f.finish(f.controller.startCamera()); await f.finish(f.controller.takePhoto());
  assert.match(f.elements.status.textContent, /Photo returned.*reopen failed/);
  assert.equal(f.elements.start.disabled, false); assert.equal(f.elements.capture.disabled, true);
  assert.equal(f.elements.result.hidden, false);
});

test('hung capture times out and overlapping capture taps are ignored', async () => {
  const f = fixture({ photoPromise: new Promise(() => {}) }); await f.finish(f.controller.startCamera());
  const attempt = f.controller.takePhoto(); await f.controller.takePhoto(); await f.finish(attempt);
  assert.equal(f.shots.length, 1); assert.match(f.elements.status.textContent, /timed out.*Live feed active/);
  assert.equal(f.elements.capture.disabled, false); assert.equal(f.timers.size, 0);
  assert.equal(f.tracks[0].stopped, true); assert.equal(f.requests.length, 2);
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

for (const [name, options] of [
  ['empty modes', { modes: [] }], ['query failure', { capabilityError: true }],
  ['missing query', { noCapabilitiesMethod: true }], ['stalled query', { capabilityPromise: new Promise(() => {}) }],
]) test(`${name} allows both default-photo and explicit-flash attempts`, async () => {
  const f = fixture(options); await f.finish(f.controller.startCamera());
  assert.equal(f.elements.plain.disabled, false); assert.equal(f.elements.capture.disabled, false);
  const report = f.elements.capabilities.textContent;
  await f.finish(f.controller.takePhoto()); await f.finish(f.controller.takePhoto('flash'));
  assert.equal(f.shots[0].settings, undefined); assert.deepEqual(f.shots[1].settings, { fillLightMode: 'flash' });
  assert.equal(f.elements.capabilities.textContent, report); assert.match(f.elements.resultMode.textContent, /Flash requested/);
});

test('empty flash capabilities still permit a rejected request and show its exact error', async () => {
  const f = fixture({ modes: [], photoError: true }); await f.finish(f.controller.startCamera()); await f.finish(f.controller.takePhoto('flash'));
  assert.equal(f.shots.length, 1); assert.match(f.elements.status.textContent, /Flash requested.*Error: capture failed/);
  assert.equal(f.elements.capture.disabled, false);
});

test('pause keeps the same live track and torch available; resume uses that stream', async () => {
  const f = fixture({ missingAPI: true }); await f.finish(f.controller.startCamera());
  await f.controller.togglePause(); assert.equal(f.elements.video.paused, true); assert.equal(f.tracks[0].readyState, 'live');
  await f.finish(f.controller.toggleTorch()); assert.equal(f.tracks[0].getSettings().torch, true);
  assert.equal(f.elements.video.paused, true); assert.equal(f.elements.torch.getAttribute('aria-pressed'), 'true');
  await f.finish(f.controller.togglePause()); assert.equal(f.requests.length, 1); assert.equal(f.elements.video.paused, false);
});

test('capture while paused switches torch off, preserves other constraints, and restores both states', async () => {
  const f = fixture({ modes: [] }); await f.finish(f.controller.startCamera()); await f.finish(f.controller.toggleTorch()); await f.controller.togglePause();
  await f.finish(f.controller.takePhoto('flash'));
  assert.equal(f.shots[0].paused, true); assert.equal(f.shots[0].torch, false);
  assert.deepEqual(f.changes.map(change => change.on), [true, false, true]);
  assert.deepEqual(f.changes[1].value, { width: { ideal: 1920 }, advanced: [{ zoom: 2 }, { torch: false }] });
  assert.equal(f.elements.video.paused, true); assert.equal(f.tracks[0].getSettings().torch, true);
  assert.equal(f.elements.pause.textContent, 'Resume feed'); assert.match(f.elements.status.textContent, /Preview paused/);
});

test('failed torch-off operation prevents capture and preserves a paused feed', async () => {
  const f = fixture({ torchOffFails: true }); await f.finish(f.controller.startCamera()); await f.finish(f.controller.toggleTorch()); await f.controller.togglePause();
  await f.finish(f.controller.takePhoto()); assert.equal(f.shots.length, 0);
  assert.match(f.elements.status.textContent, /Photo failed.*torch off failed/); assert.equal(f.elements.video.paused, true);
});

test('camera restart after capture restores torch and pause on the replacement track', async () => {
  const f = fixture({ stalls: true }); await f.finish(f.controller.startCamera()); await f.finish(f.controller.toggleTorch()); await f.controller.togglePause();
  await f.finish(f.controller.takePhoto()); assert.equal(f.requests.length, 2);
  assert.equal(f.tracks[0].stopped, true); assert.equal(f.tracks[1].getSettings().torch, true); assert.equal(f.elements.video.paused, true);
});

test('torch restoration failure does not discard the photo or disable capture', async () => {
  const f = fixture({ torchOnFails: true }); await f.finish(f.controller.startCamera()); await f.finish(f.controller.toggleTorch());
  await f.finish(f.controller.takePhoto()); assert.equal(f.elements.result.hidden, false);
  assert.match(f.elements.status.textContent, /Torch restoration failed.*torch restore failed/); assert.equal(f.elements.plain.disabled, false);
});

test('missing torch support disables only torch and still allows photos and pause', async () => {
  const f = fixture({ torch: false }); await f.finish(f.controller.startCamera());
  assert.equal(f.elements.torch.disabled, true); assert.equal(f.elements.plain.disabled, false); assert.equal(f.elements.pause.disabled, false);
});

test('ignored torch constraint reports failure without showing a false on state', async () => {
  const f = fixture({ ignoreTorch: true }); await f.finish(f.controller.startCamera()); await f.finish(f.controller.toggleTorch());
  assert.match(f.elements.status.textContent, /did not apply/); assert.equal(f.elements.torch.getAttribute('aria-pressed'), 'false');
});

test('backgrounding during a pending torch operation clears controls and ignores late completion', async () => {
  let resolve; const f = fixture({ torchPromise: new Promise(done => resolve = done) }); await f.finish(f.controller.startCamera());
  const change = f.controller.toggleTorch(); assert.equal(f.elements.capture.disabled, true); assert.equal(f.elements.pause.disabled, true);
  f.document.hidden = true; f.document.emit('visibilitychange'); resolve(); await f.finish(change);
  assert.ok(f.tracks[0].stopped); assert.equal(f.elements.torch.getAttribute('aria-pressed'), 'false');
  assert.equal(f.elements.pause.getAttribute('aria-pressed'), 'false'); assert.equal(f.elements.capture.disabled, true);
});

test('torch timeout releases its owner and prevents subsequent photos until restarted', async () => {
  const f = fixture({ torchPromise: new Promise(() => {}) }); await f.finish(f.controller.startCamera());
  await f.finish(f.controller.toggleTorch()); await f.controller.takePhoto('flash');
  assert.equal(f.tracks[0].stopped, true); assert.equal(f.shots.length, 0);
  assert.equal(f.elements.capture.disabled, true); assert.equal(f.elements.start.disabled, false);
  assert.match(f.elements.status.textContent, /Torch change timed out/);
});
