const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFlashTest } = require('../diagnostics/camera-flash-test.js');
const { element, environment } = require('./helpers/browser.cjs');

function fixture(options = {}) {
  const elements = Object.fromEntries(['start', 'plain', 'capture', 'torch', 'pause', 'autoFlash', 'autoStatus', 'zoom', 'zoomValue', 'zoomStatus', 'telephoto', 'status', 'capabilities', 'video', 'result', 'resultMode', 'photo', 'log', 'copyLog', 'copyStatus'].map(id => [id, element()]));
  elements.autoFlash.checked = options.auto === true;
  const tracks = [], requests = [], shots = [], changes = [], zooms = [], revoked = [], timers = new Map();
  let now = 0, id = 0, time = 0, advancing = true;
  const document = element(); document.hidden = false;
  let brightness = options.brightness ?? 180;
  const draws = [];
  document.createElement = name => name === 'option' ? element() : ({ getContext: () => ({
    drawImage(...args) { if (options.sampleError) throw Error('sampling failed'); draws.push(args); },
    getImageData: () => ({ data: new Uint8ClampedArray([brightness, brightness, brightness, 255]) }),
  }) });
  const window = element();
  Object.assign(elements.video, {
    readyState: 4, paused: true, videoWidth: 1920, videoHeight: 1080,
    async play() { this.paused = false; if (options.playFailsAfterPhoto && shots.length) throw Error('play failed'); },
    pause() { this.paused = true; },
  });
  Object.defineProperty(elements.video, 'currentTime', { get() { if (advancing) time++; return time; } });
  elements.photo.decode = async () => {};
  const env = environment({
    document, isSecureContext: options.secure !== false,
    addEventListener: window.addEventListener.bind(window),
    navigator: { userAgent: 'iPhone diagnostic test browser', clipboard: options.clipboard, mediaDevices: {
      async enumerateDevices() { if (options.listError) throw Error('listing failed'); return options.devices || []; },
      async getUserMedia(value) {
      requests.push(value);
      const deviceId = options.ignoreCamera ? 'private-device' : value.video.deviceId?.exact || 'private-device';
      if (options.cameraFailure && deviceId === 'private-tele') throw Error('telephoto open failed');
      if (options.cameraPermission && deviceId === 'private-tele') await options.cameraPermission;
      const state = { torch: false, ...(options.zoomRange ? { zoom: 1 } : {}) };
      const track = {
        readyState: 'live', stop() { this.readyState = 'ended'; this.stopped = true; state.torch = false; },
        getCapabilities: () => ({ torch: options.torch !== false && !(options.noTeleTorch && deviceId === 'private-tele'), zoom: options.zoomRange }),
        getSettings: () => ({ ...state, deviceId, groupId: 'private-group' }),
        getConstraints: () => ({ width: { ideal: 1920 }, advanced: [{ zoom: 2, torch: state.torch }] }),
        async applyConstraints(value) {
          const constraint = value.advanced.at(-1), on = constraint.torch;
          if (constraint.zoom !== undefined) {
            zooms.push({ zoom: constraint.zoom, track: this });
            if (options.zoomPromise) await options.zoomPromise;
            if (options.zoomError) throw Error('zoom failed');
            if (!options.ignoreZoom) state.zoom = constraint.zoom;
            return;
          }
          changes.push({ on, value, track: this });
          if (options.torchPromise) await options.torchPromise;
          if (options.torchOffFails && !on) throw new Error('torch off failed');
          if (options.autoTorchFails && on) throw new Error('automatic torch failed');
          if (options.teleTorchFails && on && deviceId === 'private-tele') throw new Error('telephoto torch failed');
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
    performance: { now: () => now },
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
  async function tick(milliseconds = 500) {
    const target = now + milliseconds;
    while (now < target) {
      await flush(); now = Math.min(target, now + 100);
      for (const [key, timer] of [...timers]) if (timer.due <= now && timers.delete(key)) timer.fn();
    }
    await flush();
  }
  return { elements, document, window, controller, tracks, shots, changes, zooms, requests, revoked, timers, finish, flush, tick, draws,
    setBrightness(value) { brightness = value; }, freezeFrames() { advancing = false; } };
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

test('copyable diagnostic records flash request, torch isolation, photo result and recovery without image data or device identifiers', async () => {
  let copied;
  const f = fixture({ modes: [], clipboard: { async writeText(text) { copied = text; } } });
  await f.finish(f.controller.startCamera()); await f.finish(f.controller.toggleTorch()); await f.controller.togglePause();
  await f.finish(f.controller.takePhoto('flash')); await f.controller.copyDiagnosticLog();
  assert.equal(copied, f.elements.log.value); assert.match(copied, /log v5.*\nStarted:.*\nBrowser: iPhone diagnostic test browser/);
  assert.match(copied, /photo.capabilities.*"fillLightMode":\[\]/);
  assert.match(copied, /photo.request.*"fillLightMode":"flash".*"torch":false/);
  assert.match(copied, /photo.returned.*"type":"image\/jpeg"/); assert.match(copied, /photo.complete.*"previewPaused":true/);
  assert.doesNotMatch(copied, /private-device|private-group|deviceId|groupId|blob:photo|data:image/);
  assert.match(f.elements.copyStatus.textContent, /Log copied/);
});

test('clipboard rejection selects the log for manual copying without changing camera state', async () => {
  const f = fixture({ clipboard: { async writeText() { throw Error('denied'); } } });
  let selected = false; f.elements.log.select = () => selected = true;
  await f.finish(f.controller.startCamera()); const status = f.elements.status.textContent;
  await f.controller.copyDiagnosticLog(); assert.equal(selected, true);
  assert.match(f.elements.copyStatus.textContent, /Log selected/); assert.equal(f.elements.status.textContent, status);
  assert.equal(f.tracks[0].readyState, 'live');
});

test('logs retain failed requests and camera release after backgrounding', async () => {
  const f = fixture({ photoError: true }); await f.finish(f.controller.startCamera()); await f.finish(f.controller.takePhoto('flash'));
  f.document.hidden = true; f.document.emit('visibilitychange');
  assert.match(f.elements.log.value, /photo.error.*Error: capture failed/);
  assert.match(f.elements.log.value, /test.stop.*"hidden":true/); assert.match(f.elements.log.value, /camera.release/);
  assert.equal(f.elements.result.hidden, true);
});

test('Auto flash samples the central half and requires three dark frames before enabling torch and flash', async () => {
  const f = fixture({ auto: true, brightness: 20, modes: [] }); await f.finish(f.controller.startCamera());
  assert.equal(f.elements.autoFlash.checked, true); assert.equal(f.elements.plain.textContent, 'Auto photo');
  await f.tick(1000); assert.equal(f.changes.length, 0);
  await f.tick(500); assert.deepEqual(f.changes.map(change => change.on), [true]);
  assert.deepEqual(f.draws[0].slice(1), [480, 270, 960, 540, 0, 0, 32, 32]);
  await f.finish(f.controller.takePhoto());
  assert.deepEqual(f.shots[0].settings, { fillLightMode: 'flash' }); assert.equal(f.shots[0].torch, false);
  assert.deepEqual(f.changes.map(change => change.on), [true, false, true]);
  assert.match(f.elements.log.value, /auto.brightness.*"brightness":20,"threshold":50/);
  assert.match(f.elements.log.value, /auto.decision.*"mode":"flash"/);
  assert.match(f.elements.log.value, /photo.attempt.*"automatic":true/);
});

test('bright scenes and a brief dark dip keep Auto photo on default settings', async () => {
  const f = fixture({ auto: true, brightness: 180 }); await f.finish(f.controller.startCamera());
  await f.tick(1500); await f.finish(f.controller.takePhoto());
  assert.equal(f.shots[0].settings, undefined);
  f.setBrightness(49); await f.tick(1000); f.setBrightness(50); await f.tick(500);
  f.setBrightness(49); await f.tick(1000);
  assert.equal(f.changes.length, 0); assert.doesNotMatch(f.elements.log.value, /auto.decision/);
});

test('torch feedback cannot undo a latched flash decision', async () => {
  const f = fixture({ auto: true, brightness: 15 }); await f.finish(f.controller.startCamera()); await f.tick(1500);
  f.setBrightness(240); await f.tick(2000); await f.finish(f.controller.takePhoto());
  assert.equal(f.tracks[0].getSettings().torch, true); assert.deepEqual(f.shots[0].settings, { fillLightMode: 'flash' });
  assert.equal((f.elements.log.value.match(/auto.decision/g) || []).length, 1);
});

test('manual torch override disables Auto flash and survives camera restarts', async () => {
  const f = fixture({ auto: true, brightness: 10 }); await f.finish(f.controller.startCamera()); await f.tick(1500);
  await f.finish(f.controller.toggleTorch()); assert.equal(f.tracks[0].getSettings().torch, false);
  assert.equal(f.elements.autoFlash.checked, false); assert.equal(f.elements.plain.textContent, 'Take photo');
  await f.tick(2000); assert.deepEqual(f.changes.map(change => change.on), [true, false]);
  await f.finish(f.controller.startCamera()); await f.tick(2000);
  assert.equal(f.elements.autoFlash.checked, false); assert.equal(f.tracks[1].getSettings().torch, false);
  await f.finish(f.controller.takePhoto()); assert.equal(f.shots[0].settings, undefined);
});

test('disabling Auto flash stops sampling and turns off only its own torch', async () => {
  const f = fixture({ auto: true, brightness: 10 }); await f.finish(f.controller.startCamera()); await f.tick(1500);
  f.elements.autoFlash.checked = false; await f.finish(f.controller.toggleAutoFlash());
  const count = f.draws.length; await f.tick(2000);
  assert.equal(f.draws.length, count); assert.equal(f.tracks[0].getSettings().torch, false); assert.equal(f.timers.size, 0);
  await f.finish(f.controller.toggleTorch());
  f.elements.autoFlash.checked = true; await f.finish(f.controller.toggleAutoFlash());
  f.elements.autoFlash.checked = false; await f.finish(f.controller.toggleAutoFlash());
  // Re-enabling a latched decision with an already-manual torch does not claim ownership.
  assert.equal(f.tracks[0].getSettings().torch, true);
});

test('low light without torch support still selects an explicit flash attempt', async () => {
  const f = fixture({ auto: true, brightness: 10, torch: false, modes: [] });
  await f.finish(f.controller.startCamera()); await f.tick(1500); await f.finish(f.controller.takePhoto());
  assert.equal(f.changes.length, 0); assert.equal(f.elements.autoFlash.checked, true);
  assert.deepEqual(f.shots[0].settings, { fillLightMode: 'flash' });
});

for (const [name, options, error] of [
  ['sampling', { sampleError: true }, 'sampling failed'],
  ['automatic torch', { autoTorchFails: true }, 'automatic torch failed'],
]) test(`${name} failure disables Auto flash while retaining manual capture`, async () => {
  const f = fixture({ auto: true, brightness: 10, ...options }); await f.finish(f.controller.startCamera()); await f.tick(1500);
  assert.equal(f.elements.autoFlash.checked, false); assert.match(f.elements.autoStatus.textContent, new RegExp(error));
  assert.equal(f.elements.plain.disabled, false); assert.equal(f.elements.torch.disabled, false); assert.equal(f.timers.size, 0);
  await f.finish(f.controller.takePhoto()); assert.equal(f.shots[0].settings, undefined);
  await f.finish(f.controller.takePhoto('flash')); assert.deepEqual(f.shots[1].settings, { fillLightMode: 'flash' });
});

test('paused, missing and unchanged frames cannot accumulate a low-light decision', async () => {
  const f = fixture({ auto: true, brightness: 10 }); await f.finish(f.controller.startCamera()); await f.tick(500);
  await f.controller.togglePause(); const count = f.draws.length; await f.tick(2000); assert.equal(f.draws.length, count);
  await f.finish(f.controller.takePhoto()); assert.equal(f.shots[0].paused, true); assert.equal(f.shots[0].settings, undefined);
  await f.finish(f.controller.togglePause());
  f.elements.video.videoWidth = 0; await f.tick(2000); assert.equal(f.draws.length, count);
  f.elements.video.videoWidth = 1920; f.freezeFrames(); await f.tick(2000);
  assert.equal(f.changes.length, 0); assert.equal(f.draws.length, count + 1);
});

test('Auto capture while paused restores its latched torch and pause states', async () => {
  const f = fixture({ auto: true, brightness: 10, stalls: true }); await f.finish(f.controller.startCamera()); await f.tick(1500);
  await f.controller.togglePause(); await f.finish(f.controller.takePhoto());
  assert.equal(f.shots[0].paused, true); assert.deepEqual(f.shots[0].settings, { fillLightMode: 'flash' });
  assert.equal(f.tracks[1].getSettings().torch, true); assert.equal(f.elements.video.paused, true);
  assert.equal(f.elements.autoFlash.checked, true); assert.equal(f.timers.size, 0);
});

test('capture suspends sampling and backgrounding cancels automatic lighting', async () => {
  let resolvePhoto;
  const f = fixture({ auto: true, brightness: 10, photoPromise: new Promise(done => resolvePhoto = done) });
  await f.finish(f.controller.startCamera()); await f.tick(500);
  const attempt = f.controller.takePhoto(); await f.flush(); const count = f.draws.length;
  await f.tick(2000); assert.equal(f.draws.length, count); assert.equal(f.elements.autoFlash.disabled, true);
  f.document.hidden = true; f.document.emit('visibilitychange'); resolvePhoto(new Blob(['late'])); await f.finish(attempt);
  assert.equal(f.timers.size, 0); assert.equal(f.tracks[0].stopped, true);
  assert.doesNotMatch(f.elements.log.value, /auto.decision/);
});

test('a new camera session resets the brightness latch without switching Auto flash off', async () => {
  const f = fixture({ auto: true, brightness: 10 }); await f.finish(f.controller.startCamera()); await f.tick(1500);
  f.setBrightness(180); await f.finish(f.controller.startCamera()); await f.tick(1500); await f.finish(f.controller.takePhoto());
  assert.equal(f.elements.autoFlash.checked, true); assert.equal(f.shots[0].settings, undefined);
  assert.equal(f.tracks[0].stopped, true); assert.equal(f.tracks[1].getSettings().torch, false);
  f.window.emit('pagehide'); assert.equal(f.timers.size, 0);
});

test('backgrounding during automatic torch activation ignores late completion and clears sampling', async () => {
  let resolve;
  const f = fixture({ auto: true, brightness: 10, torchPromise: new Promise(done => resolve = done) });
  await f.finish(f.controller.startCamera()); await f.tick(1500);
  assert.equal(f.elements.autoFlash.disabled, true); const count = f.draws.length;
  await f.tick(1000); assert.equal(f.draws.length, count);
  f.document.hidden = true; f.document.emit('visibilitychange'); resolve(); await f.flush();
  assert.equal(f.tracks[0].stopped, true); assert.equal(f.timers.size, 0);
  assert.equal(f.elements.torch.getAttribute('aria-pressed'), 'false'); assert.equal(f.elements.capture.disabled, true);
});

test('sampling failure after a low-light latch releases the automatically activated torch', async () => {
  const options = { auto: true, brightness: 10 };
  const f = fixture(options); await f.finish(f.controller.startCamera()); await f.tick(1500);
  options.sampleError = true; await f.tick(500);
  assert.equal(f.elements.autoFlash.checked, false); assert.equal(f.tracks[0].getSettings().torch, false);
  assert.equal(f.elements.plain.disabled, false); assert.equal(f.timers.size, 0);
});

test('failed restoration of automatic torch disables Auto flash and retains the returned photo', async () => {
  const f = fixture({ auto: true, brightness: 10, torchOnFails: true });
  await f.finish(f.controller.startCamera()); await f.tick(1500); await f.finish(f.controller.takePhoto());
  assert.equal(f.elements.autoFlash.checked, false); assert.equal(f.elements.result.hidden, false);
  assert.equal(f.elements.plain.disabled, false); assert.match(f.elements.autoStatus.textContent, /torch restore failed/);
  assert.equal(f.tracks[0].getSettings().torch, false);
});

const lensDevices = [
  { kind: 'videoinput', deviceId: 'private-device', label: 'Back Camera' },
  { kind: 'videoinput', deviceId: 'private-front', label: 'Front Camera' },
  { kind: 'videoinput', deviceId: 'private-tele', label: 'Back Telephoto Camera' },
];
const nativeZoomRange = { min: 1, max: 8, step: .1 };

test('telephoto switching includes exactly 3x and switches back below 3x', async () => {
  const f = fixture({ devices: lensDevices, zoomRange: nativeZoomRange }); await f.finish(f.controller.startCamera());
  assert.equal(f.elements.telephoto.value, '1');
  await f.finish(f.controller.setZoom(2.9)); assert.equal(f.requests.length, 1); assert.ok(Math.abs(f.zooms.at(-1).zoom - 2.9) < 1e-8);
  await f.finish(f.controller.setZoom(3));
  assert.equal(f.requests[1].video.deviceId.exact, 'private-tele'); assert.equal(f.tracks[0].stopped, true);
  assert.equal(f.zooms.at(-1).zoom, 1); assert.match(f.elements.zoomStatus.textContent, /Selected telephoto/);
  await f.finish(f.controller.setZoom(4.5)); assert.equal(f.requests.length, 2); assert.equal(f.zooms.at(-1).zoom, 1.5);
  await f.finish(f.controller.setZoom(2.9)); assert.equal(f.requests[2].video.deviceId.exact, 'private-device');
  assert.equal(f.tracks[1].stopped, true); assert.match(f.elements.zoomStatus.textContent, /Starting rear camera/);
});

test('unidentified lenses never switch based on device order; manual mapping enables switching', async () => {
  const f = fixture({ devices: [lensDevices[0], { ...lensDevices[2], label: 'Camera B' }], zoomRange: nativeZoomRange });
  await f.finish(f.controller.startCamera()); await f.finish(f.controller.setZoom(3));
  assert.equal(f.requests.length, 1); assert.match(f.elements.zoomStatus.textContent, /Telephoto unavailable or not selected/);
  f.elements.telephoto.value = '0'; await f.finish(f.controller.selectTelephoto());
  assert.equal(f.requests.at(-1).video.deviceId.exact, 'private-tele');
  f.elements.telephoto.value = '-1'; await f.finish(f.controller.selectTelephoto());
  assert.equal(f.requests.at(-1).video.deviceId.exact, 'private-device');
});

test('native zoom limits are reported without software cropping or selecting an unavailable lens', async () => {
  const f = fixture({ zoomRange: { min: 1, max: 2, step: .5 } }); await f.finish(f.controller.startCamera());
  await f.finish(f.controller.setZoom(5)); assert.equal(f.zooms.at(-1).zoom, 2);
  assert.equal(f.elements.zoomValue.textContent, '5.0× requested'); assert.match(f.elements.zoomStatus.textContent, /limit reached/);
  assert.equal(f.draws.length, 0); assert.equal(f.requests.length, 1);
});

test('camera listing failure leaves flash capture usable on the starting camera', async () => {
  const f = fixture({ listError: true }); await f.finish(f.controller.startCamera());
  assert.match(f.elements.zoomStatus.textContent, /listing failed/); assert.equal(f.elements.telephoto.disabled, true);
  await f.finish(f.controller.takePhoto('flash')); assert.equal(f.shots.length, 1);
});

test('telephoto can be selected without native zoom and still supply a flash photo', async () => {
  const f = fixture({ devices: lensDevices }); await f.finish(f.controller.startCamera()); await f.finish(f.controller.setZoom(3));
  assert.match(f.elements.zoomStatus.textContent, /Selected telephoto.*Native zoom is unavailable/);
  await f.finish(f.controller.takePhoto('flash')); assert.equal(f.shots[0].track, f.tracks[1]);
  assert.deepEqual(f.shots[0].settings, { fillLightMode: 'flash' }); assert.equal(f.zooms.length, 0);
});

for (const [name, options, error] of [
  ['unavailable telephoto', { cameraFailure: true }, 'telephoto open failed'],
  ['ignored camera selection', { ignoreCamera: true }, 'did not select'],
]) test(`${name} reopens the previous camera and reports the switch failure`, async () => {
  const f = fixture({ devices: lensDevices, zoomRange: nativeZoomRange, ...options });
  await f.finish(f.controller.startCamera()); await f.finish(f.controller.setZoom(3));
  assert.equal(f.requests.at(-1).video.deviceId.exact, 'private-device'); assert.equal(f.elements.capture.disabled, false);
  assert.match(f.elements.zoomStatus.textContent, new RegExp(error));
  await f.finish(f.controller.takePhoto()); assert.equal(f.shots.length, 1);
});

test('lens switches retain the low-light decision, torch and pause choices through capture recovery', async () => {
  const f = fixture({ auto: true, brightness: 10, devices: lensDevices, zoomRange: nativeZoomRange, stalls: true });
  await f.finish(f.controller.startCamera()); await f.tick(1500); await f.controller.togglePause();
  await f.finish(f.controller.setZoom(3)); assert.equal(f.elements.video.paused, true);
  assert.equal(f.tracks[1].getSettings().torch, true); assert.equal(f.elements.autoFlash.checked, true);
  await f.finish(f.controller.takePhoto());
  assert.equal(f.shots[0].track, f.tracks[1]); assert.equal(f.shots[0].torch, false);
  assert.deepEqual(f.shots[0].settings, { fillLightMode: 'flash' });
  assert.equal(f.requests.at(-1).video.deviceId.exact, 'private-tele');
  assert.equal(f.tracks.at(-1).getSettings().torch, true); assert.equal(f.elements.video.paused, true);
  assert.equal(f.tracks.at(-1).getSettings().zoom, 1); assert.equal(f.timers.size, 0);
});

test('a telephoto camera without torch preserves flash capture and reports the unavailable continuous light', async () => {
  const f = fixture({ auto: true, brightness: 10, devices: lensDevices, noTeleTorch: true });
  await f.finish(f.controller.startCamera()); await f.tick(1500); await f.finish(f.controller.setZoom(3));
  assert.equal(f.elements.torch.disabled, true); assert.match(f.elements.zoomStatus.textContent, /Torch unavailable/);
  await f.finish(f.controller.takePhoto()); assert.deepEqual(f.shots[0].settings, { fillLightMode: 'flash' });
});

test('automatic torch failure during a lens switch disables Auto flash and recovers manual capture', async () => {
  const f = fixture({ auto: true, brightness: 10, devices: lensDevices, teleTorchFails: true });
  await f.finish(f.controller.startCamera()); await f.tick(1500); await f.finish(f.controller.setZoom(3));
  assert.equal(f.elements.autoFlash.checked, false); assert.match(f.elements.autoStatus.textContent, /telephoto torch failed/);
  assert.equal(f.elements.capture.disabled, false); assert.equal(f.tracks.at(-1).getSettings().torch, false);
  await f.finish(f.controller.takePhoto('flash')); assert.equal(f.shots.length, 1);
});

test('backgrounding cancels a pending camera switch and releases a late stream', async () => {
  let resolve;
  const f = fixture({ devices: lensDevices, cameraPermission: new Promise(done => resolve = done) });
  await f.finish(f.controller.startCamera()); const attempt = f.controller.setZoom(3); await f.flush();
  assert.equal(f.elements.capture.disabled, true); await f.controller.setZoom(2);
  f.document.hidden = true; f.document.emit('visibilitychange'); resolve(); await f.finish(attempt);
  assert.ok(f.tracks.every(track => track.stopped)); assert.equal(f.timers.size, 0);
  assert.equal(f.elements.video.srcObject, null); assert.equal(f.elements.capture.disabled, true);
});

test('timed-out camera selection recovers and a late telephoto cannot replace the recovered feed', async () => {
  let resolve;
  const f = fixture({ devices: lensDevices, cameraPermission: new Promise(done => resolve = done) });
  await f.finish(f.controller.startCamera()); await f.finish(f.controller.setZoom(3));
  assert.match(f.elements.zoomStatus.textContent, /Opening selected camera timed out/);
  assert.equal(f.elements.capture.disabled, false); const recovered = f.elements.video.srcObject;
  resolve(); await f.flush(); assert.equal(f.elements.video.srcObject, recovered); assert.equal(f.tracks.at(-1).stopped, true);
});

test('ignored native zoom reports an error without claiming a verified magnification', async () => {
  const f = fixture({ zoomRange: nativeZoomRange, ignoreZoom: true }); await f.finish(f.controller.startCamera());
  await f.finish(f.controller.setZoom(2)); assert.match(f.elements.zoomStatus.textContent, /did not verify/);
  assert.equal(f.elements.capture.disabled, false); assert.equal(f.tracks[0].getSettings().zoom, 1);
});

test('lens and zoom diagnostics exclude camera names and stable identifiers', async () => {
  const f = fixture({ devices: lensDevices, zoomRange: nativeZoomRange });
  await f.finish(f.controller.startCamera()); await f.finish(f.controller.setZoom(3));
  assert.match(f.elements.log.value, /camera.switched.*"to":"telephoto"/);
  assert.match(f.elements.log.value, /zoom.applied.*"nativeZoom":1/);
  assert.doesNotMatch(f.elements.log.value, /private-device|private-tele|private-front|deviceId|groupId|Back Telephoto Camera/);
  f.window.emit('pagehide'); assert.equal(f.timers.size, 0); assert.ok(f.tracks.every(track => track.stopped));
});

test('backgrounding during capability discovery cannot start camera listing or new timers afterward', async () => {
  const f = fixture({ capabilityPromise: new Promise(() => {}), devices: lensDevices });
  const attempt = f.controller.startCamera(); await f.flush();
  f.document.hidden = true; f.document.emit('visibilitychange'); await f.finish(attempt);
  assert.equal(f.timers.size, 0); assert.equal(f.elements.telephoto.children.length, 0);
  assert.doesNotMatch(f.elements.log.value, /camera.list /); assert.equal(f.tracks[0].stopped, true);
});
