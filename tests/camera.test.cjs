const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCameraController } = require('../src/camera/controller.js');
const { validateCameraReadings, cameraErrorMessage, boundedCrop, parseRecognisedDigits } = require('../src/camera/readings.js');
const { readSegmentedDigits } = require('../src/camera/segments.js');
const { createStorage } = require('../src/services/storage.js');
const { element, environment, memoryStorage } = require('./helpers/browser.cjs');
const flush = () => new Promise(setImmediate);

function fixture({ deferredMedia = false, deferredReading = false, error, torch = true } = {}) {
  const elements = Object.fromEntries(['indoorDialog', 'cameraTitle', 'cameraInputButton', 'cameraBackButton', 'cameraPanel', 'cameraCapturePanel',
    'cameraReviewPanel', 'cameraErrorPanel', 'cameraVideo', 'cameraFlash', 'cameraCaptureStatus', 'cameraCaptureButton',
    'cameraPhoto', 'cameraTempCrop', 'cameraRhCrop', 'cameraTempBox', 'cameraRhBox', 'cameraTempDraft', 'cameraRhDraft',
    'cameraTempError', 'cameraRhError', 'cameraConfirmButton', 'cameraReadStatus', 'cameraCropControls', 'cameraErrorMessage',
    'cameraErrorHelp', 'cameraErrorDetails', 'cameraManualButton', 'cameraRetryButton', 'cameraRetakeButton', 'cameraReadAgainButton'].map(name => [name, element()]));
  const canvas = () => ({ ...element(), width: 0, height: 0, getContext: () => ({ drawImage() {} }) });
  for (const name of ['cameraPhoto', 'cameraTempCrop', 'cameraRhCrop']) elements[name] = canvas();
  elements.indoorDialog.open = true;
  Object.assign(elements.cameraVideo, { videoWidth: 1920, videoHeight: 1080, play: async () => {}, getBoundingClientRect: () => ({ width: 360, height: 270 }) });
  const track = { stopped: 0, stop() { this.stopped++; }, getCapabilities: () => ({ torch }), applyConstraints: async value => { constraints.push(value); } };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const requests = [], constraints = [], saved = [], state = { indoorTemp: 24, indoorRh: 58 }, renders = [], crops = [];
  let resolveMedia, resolveReading, cancelled = 0, before = 0;
  const mediaPromise = new Promise(resolve => resolveMedia = resolve);
  const readPromise = new Promise(resolve => resolveReading = resolve);
  const sliders = ['temperature','humidity'].flatMap(field => ['x','y','width','height'].map(axis => {
    const slider = element(); slider.dataset = { cameraCrop: field, cropAxis: axis }; return slider;
  }));
  const env = environment({ isSecureContext: true, document: { createElement: canvas, querySelectorAll: () => sliders },
    navigator: { mediaDevices: { getUserMedia: async value => { requests.push(value); if(error) throw error; return deferredMedia ? mediaPromise : stream; } } } });
  const controller = createCameraController({ state, elements, beforeCamera: () => before++, returnFocus() {},
    render: () => renders.push({ ...state }), saveIndoorReadings: source => saved.push({ source, ...state }),
    recogniseService: { cancel: () => cancelled++, recognise: async fields => { crops.push(fields); return deferredReading ? readPromise : { temperature: '22.3', humidity: '59' }; } },
  }, env);
  controller.initialize();
  return { elements, controller, track, requests, constraints, saved, state, renders, crops, sliders,
    resolveMedia: () => resolveMedia(stream), resolveReading, get cancelled() { return cancelled; }, get before() { return before; } };
}

test('camera uses video only, keeps readings as drafts, and saves both only after confirmation', async () => {
  const f = fixture(); await f.controller.startCamera();
  assert.equal(f.requests[0].audio, false); assert.equal(f.requests[0].video.facingMode.ideal, 'environment');
  assert.equal(f.before, 1); f.controller.capturePhoto(); await flush();
  assert.equal(f.track.stopped, 1); assert.deepEqual(f.state, { indoorTemp: 24, indoorRh: 58 });
  assert.equal(f.elements.cameraTempDraft.value, '22.3'); assert.equal(f.saved.length, 0);
  f.controller.confirm(); assert.deepEqual(f.state, { indoorTemp: 22.3, indoorRh: 59 });
  assert.equal(f.saved[0].source, 'photo'); assert.equal(f.renders.length, 1); assert.equal(f.elements.cameraPhoto.width, 0);
});

test('late camera permission completion after cancellation releases its own stream', async () => {
  const f = fixture({ deferredMedia: true }); const opening = f.controller.startCamera();
  f.controller.cancel(); f.resolveMedia(); await opening;
  assert.equal(f.track.stopped, 1); assert.equal(f.elements.cameraVideo.srcObject, null); assert.equal(f.saved.length, 0);
});

test('cancelled recognition cannot replace a newer camera view or save readings', async () => {
  const f = fixture({ deferredReading: true }); await f.controller.startCamera(); f.controller.capturePhoto();
  f.controller.cancel(); f.resolveReading({ temperature: '31.0', humidity: '88' }); await flush();
  assert.equal(f.elements.cameraTempDraft.value, ''); assert.deepEqual(f.state, { indoorTemp: 24, indoorRh: 58 }); assert.equal(f.saved.length, 0);
});

test('editing while OCR is pending cancels the attempt and preserves the correction', async () => {
  const f = fixture({ deferredReading: true }); await f.controller.startCamera(); f.controller.capturePhoto();
  f.elements.cameraTempDraft.value = '21.8'; f.elements.cameraTempDraft.emit('input');
  f.elements.cameraRhDraft.value = '60'; f.elements.cameraRhDraft.emit('input');
  f.resolveReading({ temperature: '31.0', humidity: '88' }); await flush();
  assert.equal(f.elements.cameraTempDraft.value, '21.8'); assert.equal(f.elements.cameraConfirmButton.disabled, false);
  f.controller.confirm(); assert.equal(f.saved[0].indoorTemp, 21.8);
});

test('crop adjustments invalidate recognised values until corrected or read again', async () => {
  const f = fixture(); await f.controller.startCamera(); f.controller.capturePhoto(); await flush();
  f.sliders[0].value = '10'; f.sliders[0].emit('input');
  assert.equal(f.elements.cameraTempDraft.value, ''); assert.equal(f.elements.cameraRhDraft.value, '');
  assert.equal(f.elements.cameraConfirmButton.disabled, true); f.controller.confirm(); assert.equal(f.saved.length, 0);
});

test('flash constraints are video-track scoped and backgrounding releases capture', async () => {
  const f = fixture(); await f.controller.startCamera(); await f.controller.toggleFlash();
  assert.deepEqual(f.constraints, [{ advanced: [{ torch: true }] }]); assert.equal(f.elements.cameraFlash.getAttribute('aria-pressed'), 'true');
  f.controller.handleHidden(); assert.equal(f.track.stopped, 1); assert.equal(f.elements.cameraFlash.getAttribute('aria-pressed'), 'false');
  const unsupported = fixture({ torch: false }); await unsupported.controller.startCamera(); assert.equal(unsupported.elements.cameraFlash.hidden, true);
});

test('permission and missing-camera errors offer recovery without changing readings', async () => {
  for (const name of ['NotAllowedError', 'NotFoundError', 'NotReadableError']) {
    const f = fixture({ error: { name } }); await f.controller.startCamera();
    assert.equal(f.elements.cameraErrorPanel.hidden, false); assert.equal(f.saved.length, 0);
    assert.ok(f.elements.cameraErrorMessage.textContent); f.elements.cameraManualButton.emit('click'); assert.equal(f.elements.cameraPanel.hidden, true);
  }
  assert.match(cameraErrorMessage({}, false).message, /HTTPS/);
});

test('camera validation rejects missing, fractional humidity, excess precision and out-of-range results without clamping', () => {
  for (const pair of [['','59'],['22.3',''],['223','59'],['22.35','59'],['22.3','59.5'],['9.9','59'],['22.3','91'],['1e1','59']]) assert.equal(validateCameraReadings(...pair).valid, false, pair.join('/'));
  assert.equal(validateCameraReadings('10.0','20').valid, true); assert.equal(validateCameraReadings('32','90').valid, true);
  assert.equal(parseRecognisedDigits('22', 80, 2), '22'); assert.equal(parseRecognisedDigits('22', 20, 2), '');
  assert.equal(parseRecognisedDigits('2 2', 99, 2), '');
  assert.deepEqual(boundedCrop({ x: .98, y: -.1, width: 2, height: 2 }), { x: .95, y: 0, width: 1 - .95, height: 1 });
});

test('a blank or noise-only LCD crop remains unresolved', () => {
  const data = new Uint8ClampedArray(120 * 80 * 4).fill(255);
  assert.equal(readSegmentedDigits({ data, width: 120, height: 80 }), '');
  for (let i = 0; i < 20; i++) data[((i * 17) % (120 * 80)) * 4] = 0;
  assert.equal(readSegmentedDigits({ data, width: 120, height: 80 }), '');
});

test('photo origin is temporary metadata and manual/voice saves clear it', () => {
  const state = { indoorTemp: 22.3, indoorRh: 59 }, localStorage = memoryStorage();
  const storage = createStorage({ state }, environment({ localStorage, Date: { now: () => 1234 } }));
  storage.saveIndoorReadings('photo'); assert.equal(state.indoorReadingSource, 'photo');
  assert.equal(localStorage.getItem('dew-indoor-readings'), '{"indoorTemp":22.3,"indoorRh":59,"indoorLastSet":1234}');
  storage.saveIndoorReadings(); assert.equal(state.indoorReadingSource, null);
});

test('partial recognition leaves the missing value empty and confirmation disabled', async () => {
  const f = fixture({ deferredReading: true }); await f.controller.startCamera(); f.controller.capturePhoto();
  f.resolveReading({ temperature: '22.3', humidity: '' }); await flush();
  assert.equal(f.elements.cameraTempDraft.value, '22.3'); assert.equal(f.elements.cameraRhDraft.value, '');
  assert.equal(f.elements.cameraConfirmButton.disabled, true); f.controller.confirm(); assert.equal(f.saved.length, 0);
  assert.match(f.elements.cameraReadStatus.textContent, /One reading/);
});

test('invalid edited drafts cannot be saved and retake discards all pending values', async () => {
  const f = fixture(); await f.controller.startCamera(); f.controller.capturePhoto(); await flush();
  f.elements.cameraTempDraft.value = '223'; f.elements.cameraTempDraft.emit('input'); f.controller.confirm();
  assert.equal(f.saved.length, 0); assert.match(f.elements.cameraTempError.textContent, /10–32/);
  await f.controller.startCamera(); assert.equal(f.elements.cameraTempDraft.value, '');
  assert.equal(f.elements.cameraPhoto.width, 0); assert.equal(f.elements.cameraCapturePanel.hidden, false);
});
