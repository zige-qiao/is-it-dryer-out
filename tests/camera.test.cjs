const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCameraController } = require('../src/camera/controller.js');
const { validateCameraReadings, cameraErrorMessage, boundedCrop, parseRecognisedDigits } = require('../src/camera/readings.js');
const { readSegmentedDigits } = require('../src/camera/segments.js');
const { createStorage } = require('../src/services/storage.js');
const { element, environment, memoryStorage } = require('./helpers/browser.cjs');
const flush = () => new Promise(setImmediate);
const fixtures = [];
test.afterEach(() => { fixtures.splice(0).forEach(f => f.controller.cancel()); });

function fixture({ deferredMedia = false, deferredReading = false, error, torch = true, regionResult, regionError } = {}) {
  const elements = Object.fromEntries(['indoorDialog', 'cameraTitle', 'cameraInputButton', 'cameraBackButton', 'cameraPanel', 'cameraCapturePanel',
    'cameraReviewPanel', 'cameraErrorPanel', 'cameraVideo', 'cameraPreview', 'cameraCaptureHint', 'cameraReviewHint', 'cameraFlash', 'cameraCaptureStatus', 'cameraCaptureButton',
    'cameraPhoto', 'cameraTempCrop', 'cameraRhCrop', 'cameraTempBox', 'cameraRhBox', 'cameraTempDraft', 'cameraRhDraft',
    'cameraTempError', 'cameraRhError', 'cameraConfirmButton', 'cameraReadStatus', 'cameraPhotoWrap', 'cameraPendingBox', 'cameraAssignment', 'cameraAssignChoices', 'cameraAssignTemp', 'cameraAssignRh', 'cameraDiscardBox', 'cameraErrorMessage',
    'cameraErrorHelp', 'cameraErrorDetails', 'cameraManualButton', 'cameraRetryButton', 'cameraRetakeButton', 'cameraReadAgainButton', 'cameraFeed', 'cameraZoomControl', 'cameraZoom', 'cameraZoomValue', 'cameraHelpButton', 'cameraCropHint', 'cameraReadStatusText'].map(name => [name, element()]));
  const canvas = () => { const draws=[]; return { ...element(), draws, width: 0, height: 0, getContext: () => ({ drawImage(...args) { draws.push(args); } }) }; };
  for (const name of ['cameraPreview', 'cameraPhoto', 'cameraTempCrop', 'cameraRhCrop']) elements[name] = canvas();
  elements.indoorDialog.open = true;
  elements.cameraFeed.getBoundingClientRect = () => ({width:360,height:180});
  Object.assign(elements.cameraVideo, { videoWidth: 1920, videoHeight: 1080, play: async () => {}, getBoundingClientRect: () => ({ width: 360, height: 270 }) });
  const track = { stopped: 0, stop() { this.stopped++; }, getCapabilities: () => ({ torch }), applyConstraints: async value => { constraints.push(value); } };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const requests = [], constraints = [], saved = [], state = { indoorTemp: 24, indoorRh: 58 }, renders = [], crops = [], sources = [];
  let resolveMedia, resolveReading, cancelled = 0, before = 0;
  const mediaPromise = new Promise(resolve => resolveMedia = resolve);
  const readPromise = new Promise(resolve => resolveReading = resolve);
  Object.assign(elements.cameraPhotoWrap, { getBoundingClientRect: () => ({ left:0, top:0, width:400, height:300 }), setPointerCapture() {}, hasPointerCapture: () => false });
  const regions = { temperature:{x:.1,y:.2,width:.35,height:.2}, humidity:{x:.55,y:.2,width:.25,height:.2} };
  const found = values => ({ regions:{temperature:values.temperature?regions.temperature:null,humidity:values.humidity?regions.humidity:null}, values });
  const env = environment({ isSecureContext: true, document: { createElement: canvas, querySelectorAll: () => [] },
    navigator: { mediaDevices: { getUserMedia: async value => { requests.push(value); if(error) throw error; return deferredMedia ? mediaPromise : stream; } } } });
  const controller = createCameraController({ state, elements, beforeCamera: () => before++, returnFocus() {},
    render: () => renders.push({ ...state }), saveIndoorReadings: source => saved.push({ source, ...state }),
    recogniseService: { cancel: () => cancelled++, locate: async source => { sources.push(source); return found(await (deferredReading ? readPromise : {temperature:'22.3',humidity:'59'})); }, readRegion: async (source, region, field) => { sources.push(source); crops.push({region,field}); if(regionError)throw regionError;if(regionResult)return regionResult;const values=await (deferredReading ? readPromise : { temperature: '22.3', humidity: '59' }); return {status:'found',field,readings:{[field]:{region,value:values[field]}}}; } },
  }, env);
  controller.initialize(); fixtures.push({controller});
  return { elements, controller, track, requests, constraints, saved, state, renders, crops, sources,
    resolveMedia: () => resolveMedia(stream), resolveReading, get cancelled() { return cancelled; }, get before() { return before; } };
}

test('camera uses video only, keeps readings as drafts, and saves both only after confirmation', async () => {
  const f = fixture(); await f.controller.startCamera();
  assert.equal(f.requests[0].audio, false); assert.equal(f.requests[0].video.facingMode.ideal, 'environment');
  assert.equal(f.before, 1); f.controller.capturePhoto(); await flush();
  assert.deepEqual(f.elements.cameraPhoto.draws[0].slice(1,5),f.elements.cameraPreview.draws.at(-1).slice(1,5));
  assert.equal(f.elements.cameraPhoto.width,1600);assert.equal(f.elements.cameraPhoto.height,800);
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

test('moving a detected crop invalidates only that value and re-reads on completion', async () => {
  const f = fixture(); await f.controller.startCamera(); f.controller.capturePhoto(); await flush();
  f.elements.cameraTempBox.emit('keydown',{key:'ArrowRight',preventDefault(){}});
  assert.equal(f.elements.cameraTempDraft.value, ''); assert.equal(f.elements.cameraRhDraft.value, '59');
  assert.equal(f.elements.cameraConfirmButton.disabled, true); f.controller.confirm(); assert.equal(f.saved.length, 0);
  await flush(); assert.equal(f.elements.cameraTempDraft.value,'22.3');
  assert.equal(f.crops[0].field,'temperature');
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
  assert.equal(parseRecognisedDigits('22', 95, 2), '22'); assert.equal(parseRecognisedDigits('22', 80, 2), '');
  assert.equal(parseRecognisedDigits('2 2', 99, 2), '');
  assert.deepEqual(boundedCrop({ x: .99, y: -.1, width: 2, height: 2 }), { x: .98, y: 0, width: 1 - .98, height: 1 });
});

test('a blank or noise-only LCD crop remains unresolved', () => {
  const data = new Uint8ClampedArray(120 * 80 * 4).fill(255);
  assert.equal(readSegmentedDigits({ data, width: 120, height: 80 }), '');
  for (let i = 0; i < 20; i++) data[((i * 17) % (120 * 80)) * 4] = 0;
  assert.equal(readSegmentedDigits({ data, width: 120, height: 80 }), '');
  const solid = new Uint8ClampedArray(50 * 80 * 4);
  for (let i = 3; i < solid.length; i += 4) solid[i] = 255;
  assert.equal(readSegmentedDigits({ data: solid, width: 50, height: 80 }), '');
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
  assert.equal(f.elements.cameraRhBox.hidden,true);
  assert.equal(f.elements.cameraReadStatusText.textContent, 'Humidity needs attention.');
});

test('blank detection leaves both boxes and thumbnails hidden instead of inventing crops',async()=>{
  const f=fixture({deferredReading:true}); await f.controller.startCamera();f.controller.capturePhoto();
  f.resolveReading({temperature:'',humidity:''});await flush();
  assert.equal(f.elements.cameraTempBox.hidden,true);assert.equal(f.elements.cameraRhBox.hidden,true);
  assert.equal(f.elements.cameraTempCrop.width,0);assert.equal(f.elements.cameraRhCrop.width,0);
  assert.equal(f.crops.length,0);assert.match(f.elements.cameraReadStatusText.textContent,/No readings found/);
  assert.equal(f.elements.cameraTempError.textContent,'');assert.equal(f.elements.cameraConfirmButton.disabled,true);
});

test('invalid edited drafts cannot be saved and retake discards all pending values', async () => {
  const f = fixture(); await f.controller.startCamera(); f.controller.capturePhoto(); await flush();
  f.elements.cameraTempDraft.value = '223'; f.elements.cameraTempDraft.emit('input'); f.controller.confirm();
  assert.equal(f.saved.length, 0); assert.match(f.elements.cameraTempError.textContent, /10–32/);
  await f.controller.startCamera(); assert.equal(f.elements.cameraTempDraft.value, '');
  assert.equal(f.elements.cameraPhoto.width, 0); assert.equal(f.elements.cameraCapturePanel.hidden, false);
});

function pointer(field,x,y,button=false){return {pointerId:1,button:0,isPrimary:true,clientX:x,clientY:y,preventDefault(){},target:{closest:s=>s==='[data-camera-field]'&&field?{dataset:{cameraField:field}}:s==='button'&&button?{}:null}};}
async function review(f){await f.controller.startCamera();f.controller.capturePhoto();await flush();}
function draw(f){f.elements.cameraPhotoWrap.emit('pointerdown',pointer(null,20,180));f.elements.cameraPhotoWrap.emit('pointermove',pointer(null,100,240));f.elements.cameraPhotoWrap.emit('pointerup',pointer(null,100,240));}
test('retake during processing settles into a clean live capture without accepting a late result',async()=>{
 const f=fixture({deferredReading:true});await f.controller.startCamera();f.controller.capturePhoto();f.elements.cameraRetakeButton.emit('click');f.resolveReading({temperature:'31.0',humidity:'88'});await flush();
 assert.equal(f.elements.cameraCapturePanel.hidden,false);assert.equal(f.elements.cameraTempDraft.value,'');assert.equal(f.elements.cameraPhoto.width,0);assert.equal(f.saved.length,0);
});
test('taps, retake hits and cancelled gestures do not re-read or clear existing drafts',async()=>{
 const f=fixture();await review(f);const surface=f.elements.cameraPhotoWrap;
 surface.emit('pointerdown',pointer('temperature',100,80));assert.equal(f.elements.cameraConfirmButton.disabled,true);surface.emit('pointerup',pointer('temperature',100,80));assert.equal(f.crops.length,0);assert.equal(f.elements.cameraConfirmButton.disabled,false);
 surface.emit('pointerdown',pointer(null,380,280,true));surface.emit('pointermove',pointer(null,390,290));surface.emit('pointerup',pointer(null,390,290));assert.equal(f.crops.length,0);
 surface.emit('pointerdown',pointer('temperature',100,80));surface.emit('pointermove',pointer(null,120,100));surface.emit('pointercancel',pointer(null,120,100));assert.equal(f.crops.length,0);assert.equal(f.elements.cameraTempDraft.value,'22.3');assert.equal(f.elements.cameraConfirmButton.disabled,false);
});
test('an unreadable unit asks for assignment only after drawing and allows discarding without losing readings',async()=>{
 const f=fixture({regionResult:{status:'unassigned',field:null,readings:{}}});await review(f);draw(f);await flush();
 assert.equal(f.elements.cameraAssignment.hidden,false);assert.equal(f.elements.cameraAssignChoices.hidden,false);assert.match(f.elements.cameraReadStatusText.textContent,/Which reading/);assert.equal(f.elements.cameraConfirmButton.disabled,true);assert.equal(f.elements.cameraRhDraft.value,'59');
 f.elements.cameraDiscardBox.emit('click');assert.equal(f.elements.cameraPendingBox.hidden,true);assert.equal(f.elements.cameraConfirmButton.disabled,false);
});
test('ambiguous units require tightening; contradictory units cannot swap an existing field',async()=>{
 const both=fixture({regionResult:{status:'ambiguous',field:null}});await review(both);draw(both);await flush();assert.equal(both.elements.cameraAssignChoices.hidden,true);assert.equal(both.elements.cameraConfirmButton.disabled,true);
 const wrong=fixture({regionResult:{status:'contradictory',field:'temperature'}});await review(wrong);wrong.elements.cameraTempBox.emit('keydown',{key:'ArrowRight',preventDefault(){}});await flush();assert.equal(wrong.elements.cameraTempDraft.value,'');assert.equal(wrong.elements.cameraRhDraft.value,'59');assert.match(wrong.elements.cameraReadStatusText.textContent,/Unit doesn’t match/);
});
test('a worker error leaves existing unaffected readings and manual correction available',async()=>{
 const f=fixture({regionError:new Error('worker')});await review(f);f.elements.cameraTempBox.emit('keydown',{key:'ArrowRight',preventDefault(){}});await flush();assert.equal(f.elements.cameraRhDraft.value,'59');assert.match(f.elements.cameraReadStatusText.textContent,/Reading failed/);assert.equal(f.elements.cameraReadStatus.dataset.state,'error');f.elements.cameraTempDraft.value='22.1';f.elements.cameraTempDraft.emit('input');assert.equal(f.elements.cameraReadStatus.dataset.state,'ready');f.controller.confirm();assert.equal(f.saved[0].indoorTemp,22.1);
});

test('capture help switches content and closes when taking a photo or retaking',async()=>{
 const f=fixture();await f.controller.startCamera();assert.equal(f.elements.cameraHelpButton.hidden,false);
 assert.equal(f.elements.cameraHelpButton.getAttribute('aria-label'),'Camera help');assert.equal(f.elements.cameraCaptureHint.hidden,false);assert.equal(f.elements.cameraReviewHint.hidden,true);
 assert.equal(f.elements.cameraCaptureStatus.hidden,true);f.elements.cameraHelpButton.emit('click');assert.equal(f.elements.cameraCropHint.hidden,false);
 f.controller.capturePhoto();await flush();assert.equal(f.elements.cameraCropHint.hidden,true);assert.equal(f.elements.cameraCaptureHint.hidden,true);assert.equal(f.elements.cameraReviewHint.hidden,false);
 f.elements.cameraHelpButton.emit('click');await f.controller.startCamera();assert.equal(f.elements.cameraCropHint.hidden,true);assert.equal(f.elements.cameraReviewHint.hidden,true);
});

test('ready status requires valid drafts and becomes attention for invalid or missing manual input',async()=>{
 const f=fixture();await review(f);assert.equal(f.elements.cameraReadStatus.dataset.state,'ready');
 f.elements.cameraTempDraft.value='223';f.elements.cameraTempDraft.emit('input');assert.equal(f.elements.cameraReadStatus.dataset.state,'attention');assert.equal(f.elements.cameraConfirmButton.disabled,true);
 f.elements.cameraTempDraft.value='22.1';f.elements.cameraTempDraft.emit('input');assert.equal(f.elements.cameraReadStatus.dataset.state,'ready');assert.equal(f.elements.cameraConfirmButton.disabled,false);
 f.elements.cameraRhDraft.value='';f.elements.cameraRhDraft.emit('input');assert.equal(f.elements.cameraReadStatus.dataset.state,'attention');assert.equal(f.elements.cameraConfirmButton.disabled,true);
});

test('moving a box shows information rather than a ready or processing status',async()=>{
 const f=fixture();await review(f);const surface=f.elements.cameraPhotoWrap;
 surface.emit('pointerdown',pointer('temperature',100,80));surface.emit('pointermove',pointer(null,120,100));
 assert.equal(f.elements.cameraReadStatus.dataset.state,'info');assert.equal(f.elements.cameraConfirmButton.disabled,true);
 surface.emit('pointercancel',pointer(null,120,100));assert.equal(f.elements.cameraReadStatus.dataset.state,'ready');
});

test('recognition retains a native framed source privately and releases it on every exit',async()=>{
 for(const action of ['cancel','confirm','handleHidden','startCamera']){
  const f=fixture();await review(f);const original=f.sources[0];assert.notEqual(original,f.elements.cameraPhoto);assert.equal(original.width,1920);assert.equal(original.height,960);
  f.elements.cameraTempBox.emit('keydown',{key:'ArrowRight',preventDefault(){}});await flush();assert.equal(f.sources[1],original);
  await f.controller[action]();assert.equal(original.width,0);assert.equal(original.height,0);
 }
});

test('review status changes text and icon together and editing help is hidden on returning to manual entry',async()=>{
 const f=fixture({deferredReading:true});await f.controller.startCamera();f.controller.capturePhoto();
 assert.equal(f.elements.cameraReadStatus.dataset.state,'processing');assert.equal(f.elements.cameraReadStatusText.textContent,'Reading numbers…');
 assert.equal(f.elements.cameraHelpButton.hidden,false);f.resolveReading({temperature:'22.3',humidity:'59'});await flush();
 assert.equal(f.elements.cameraReadStatus.dataset.state,'ready');assert.equal(f.elements.cameraReadStatusText.textContent,'Review both values.');
 f.elements.cameraHelpButton.emit('click');assert.equal(f.elements.cameraCropHint.hidden,false);
 f.controller.cancel();assert.equal(f.elements.cameraHelpButton.hidden,true);assert.equal(f.elements.cameraCropHint.hidden,true);
});
