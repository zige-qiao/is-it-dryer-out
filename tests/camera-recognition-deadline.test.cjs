const test = require('node:test'), assert = require('node:assert/strict');
const { createRecognitionService } = require('../src/camera/recognition.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture({ drawCost = 0, workerCost = 0 } = {}) {
  let time = 0, timer; const workers = [], delays = [];
  class Worker {
    constructor() { time += workerCost; workers.push(this); this.messages = []; }
    postMessage(message) { this.message = message; this.messages.push(message); }
    terminate() { this.stopped = true; }
    emit(payload, stageId = this.message.stageId) { this.onmessage({ data: { id: this.message.id, stageId, ...payload } }); }
  }
  const env = { Worker, performance: { now: () => time }, setTimeout(fn, delay) { timer = fn; delays.push(delay); return 1; }, clearTimeout() {}, document: { createElement() {
    const c = { width: 0, height: 0 }; c.getContext = () => ({ drawImage() { time += drawCost; }, getImageData: () => ({ width: c.width, height: c.height, data: new Uint8ClampedArray(c.width*c.height*4) }) }); return c;
  } } };
  const service = createRecognitionService(env);
  return { service, workers, delays, advance(ms) { time += ms; }, timeout() { timer(); } };
}
function prepared(worker, proposals = []) {
  const { width, height } = worker.message.pixels;
  return { hypotheses: [{ id: 'identity', angle: 0, shear: 0, method: 'none', matrix: [1,0,0,0,1,0,0,0,1], width, height }], proposals,
    orientation: { state: 'pending', credibleIds: ['identity'] } };
}
function reading(value = '58', resolved = true) {
  const box = { x: .5, y: .2, width: .3, height: .4 };
  return { values: { temperature: '', humidity: value }, readings: { humidity: { field: 'humidity', value, region: box, digitBounds: box,
    confidence: { unit: .96, numeric: 1 }, correction: { matrix: [1,0,0,0,1,0,0,0,1] } } },
    orientation: { state: resolved ? 'resolved' : 'pending', credibleIds: ['identity'], evaluatedIds: resolved ? ['identity'] : [], resolvedFields: { temperature: false, humidity: resolved } } };
}

test('startup and pixel extraction consume the original recognition budget', async () => {
  const f = fixture({ workerCost: 120, drawCost: 80 }), read = f.service.locate({ width: 400, height: 200 });
  assert.equal(f.delays[0], 10000); assert.equal(f.workers[0].message.kind, 'prepare'); assert.equal(f.workers[0].message.remainingMs, 9800);
  f.service.cancel(); assert.equal(await read, null);
});
test('a synchronous extraction crossing the deadline cannot dispatch or succeed late', async () => {
  const f = fixture({ drawCost: 10001 }), read = f.service.locate({ width: 400, height: 200 });
  await assert.rejects(read, { name: 'TimeoutError' }); assert.equal(f.workers[0].messages.length, 0); assert.equal(f.workers[0].stopped, true);
});
test('resolved progress survives timeout; unexamined orientation alternatives stay blank', async () => {
  for (const resolved of [true, false]) {
    const f = fixture(), read = f.service.locate({ width: 400, height: 200 }), w = f.workers[0];
    w.emit({ result: prepared(w) }); await tick(); w.emit({ progress: reading('58', resolved) });
    f.advance(10000); f.timeout();
    if (resolved) { const r = await read; assert.equal(r.values.humidity, '58'); assert.equal(r.rejectionReason, 'timeout'); }
    else await assert.rejects(read, { name: 'TimeoutError' });
  }
});
test('stage IDs reject late progress from the preparation stage', async () => {
  const f = fixture(), read = f.service.locate({ width: 400, height: 200 }), w = f.workers[0], prior = w.message.stageId;
  w.emit({ result: prepared(w) }); await tick(); w.emit({ progress: reading('50') }, prior);
  f.advance(10000); f.timeout(); await assert.rejects(read, { name: 'TimeoutError' });
});
test('a conflict withdraws provisional progress before timeout', async () => {
  const f = fixture(), read = f.service.locate({ width: 400, height: 200 }), w = f.workers[0];
  w.emit({ result: prepared(w) }); await tick(); w.emit({ progress: reading() });
  const conflicting = reading('58', false); conflicting.orientation.state = 'conflicted';
  w.emit({ progress: conflicting }); f.advance(10000); f.timeout(); await assert.rejects(read, { name: 'TimeoutError' });
});
test('retake cancellation settles old work and rejects stale results', async () => {
  const f = fixture(), old = f.service.locate({ width: 400, height: 200 }), first = f.workers[0];
  const next = f.service.locate({ width: 400, height: 200 }); assert.equal(await old, null); assert.equal(first.stopped, true);
  first.emit({ progress: reading('50') }); f.service.cancel(); assert.equal(await next, null);
});
test('expired worker completion cannot publish an apparently complete reading', async () => {
  const f = fixture(), read = f.service.locate({ width: 400, height: 200 }), w = f.workers[0];
  w.emit({ result: prepared(w) }); await tick(); f.advance(10000); w.emit({ result: reading() });
  await assert.rejects(read, { name: 'TimeoutError' }); assert.equal(w.stopped, true);
});

test('regional stages reuse the operation hypotheses and remaining deadline', async () => {
  const f = fixture(), read = f.service.locate({ width: 3200, height: 1600 }), w = f.workers[0];
  const prepare = prepared(w, [{ region: { x: .2, y: .3, width: .1, height: .1 } }]);
  prepare.hypotheses.push({ ...prepare.hypotheses[0], id: 'orientation-90', angle: 90 });
  prepare.orientation.credibleIds.push('orientation-90');
  w.emit({ result: prepare }); await tick();
  assert.deepEqual(w.message.options.hypotheses.map(h => h.id), ['identity', 'orientation-90']);
  f.advance(3700); w.emit({ result: { values: { temperature: '', humidity: '' }, readings: {}, orientation: { state: 'resolved', resolvedFields: {} } } }); await tick();
  assert.equal(w.message.pixels.width, 320); assert.equal(w.message.remainingMs, 6300);
  assert.deepEqual(w.message.options.hypotheses.map(h => h.id), ['identity', 'orientation-90']);
  assert.equal(f.delays.length, 1); f.service.cancel(); assert.equal(await read, null);
});
test('manual preparation receives the full prior transform and timeout keeps assignment', async () => {
  const f = fixture(), correction = { angle: 90, matrix: [0,-1,400,1,0,0,0,0,1], orientationResolved: true, method: 'strokes' };
  const read = f.service.readRegion({ width: 400, height: 200 }, { x: .4, y: .2, width: .4, height: .4 }, 'humidity', correction), w = f.workers[0];
  assert.deepEqual(w.message.options.priorCorrection, correction); w.emit({ result: prepared(w) }); await tick();
  assert.equal(w.message.options.field, 'humidity'); w.emit({ progress: reading() }); f.advance(10000); f.timeout();
  const r = await read; assert.equal(r.field, 'humidity'); assert.equal(r.status, 'found'); assert.equal(r.values.humidity, '58');
});

test('regional orientation conflict withdraws an earlier validated field at timeout', async () => {
  const f = fixture(), read = f.service.locate({ width: 400, height: 200 }), w = f.workers[0];
  w.emit({ result: prepared(w, [{ region: { x: 0, y: 0, width: 1, height: 1 } }]) }); await tick();
  w.emit({ result: reading('58') }); await tick();
  // Humidity also schedules an anchored temperature crop; progress from that
  // subsequent stage must be allowed to withdraw the original physical glyphs.
  const conflict = reading('', false); conflict.orientation.state = 'conflicted';
  conflict.orientation.evaluatedIds = ['identity']; conflict.readings.humidity.rejectionReason = 'conflicting-digits';
  w.emit({ progress: conflict }); f.advance(10000); f.timeout(); await assert.rejects(read, { name: 'TimeoutError' });
});
test('conflict withdrawal preserves a separately resolved unaffected field', () => {
  const { mergeResults } = require('../src/camera/regions.js');
  const earlier = reading(); const t = { ...earlier.readings.humidity, field: 'temperature', value: '21.4', digitBounds: { x: .1, y: .2, width: .2, height: .4 } };
  earlier.readings.temperature = t; earlier.values.temperature = t.value; earlier.orientation.resolvedFields.temperature = true;
  const conflict = reading('', false); conflict.orientation.state = 'conflicted'; conflict.readings.humidity.rejectionReason = 'conflicting-digits';
  const merged = mergeResults([earlier, conflict]); assert.equal(merged.values.humidity, ''); assert.equal(merged.values.temperature, '21.4');
  assert.equal(merged.orientation.state, 'conflicted'); assert.equal(merged.orientation.resolvedFields.temperature, true);
});
test('manual unitless fallback updates resolved-field metadata and rejects unexamined alternatives', async () => {
  const { analyzeImage } = require('../src/camera/analysis.js');
  const { image, digit } = require('./helpers/camera-pixels.cjs');
  const pixels = image(); digit(pixels, '5', 55, 120, 80); digit(pixels, '8', 115, 120, 80);
  const identity = { id: 'identity', angle: 0, matrix: [1,0,0,0,1,0,0,0,1], width: pixels.width, height: pixels.height, method: 'none' };
  const options = { region: { x: .08, y: .26, width: .25, height: .25 }, field: 'humidity', hypotheses: [identity], orientation: { credibleIds: ['identity'] } };
  const result = await analyzeImage(pixels, options); assert.equal(result.values.humidity, '58');
  assert.equal(result.readings.humidity.confidence.evidence.explicitAssignment, true); assert.equal(result.orientation.resolvedFields.humidity, true);
  const pending = await analyzeImage(pixels, { ...options, orientation: { credibleIds: ['identity', 'unexamined'] } });
  assert.equal(pending.values.humidity, ''); assert.equal(pending.orientation.resolvedFields.humidity, false);
});
test('worker completion checks the deadline after the final synchronous stage', async () => {
  const { processImage } = require('../src/camera/worker.js');
  const { RecognitionDeadlineError } = require('../src/camera/budget.js');
  const pixels = { width: 20, height: 20, data: new Uint8ClampedArray(20 * 20 * 4).fill(205) }; let checks = 0;
  const checkpoint = async () => true; checkpoint.check = () => { checks++; };
  await processImage({ pixels, kind: 'prepare' }, checkpoint); const finalCheck = checks;
  checks = 0; checkpoint.check = () => { if (++checks === finalCheck) throw new RecognitionDeadlineError(); };
  await assert.rejects(processImage({ pixels, kind: 'prepare' }, checkpoint), { name: 'RecognitionDeadlineError' });
});

test('strong interior LCD crops original pixels before overview while reusing hypotheses', async () => {
  const f = fixture(), read = f.service.locate({ width: 3200, height: 1600 }), w = f.workers[0];
  const p = { region: { x: .2, y: .2, width: .5, height: .25 }, kind: 'display', displayId: 'lcd', strokeScore: 2, axes: { aspect: 2, fill: .8 } };
  const prepare = prepared(w, [p]); w.emit({ result: prepare }); await tick();
  assert.equal(w.message.options.refine, true); assert.equal(w.message.options.quick, undefined);
  assert.equal(w.message.pixels.width, 800); assert.equal(w.message.pixels.height, 200);
  assert.deepEqual(w.message.options.hypotheses.map(h => h.id), ['identity']);
  f.service.cancel(); assert.equal(await read, null);
});
test('unexamined credible separate LCD prevents completion and timeout publication', async () => {
  const f = fixture(), read = f.service.locate({ width: 400, height: 200 }), w = f.workers[0];
  const strong = x => ({ region: { x, y: .1, width: .4, height: .3 }, kind: 'display', displayId: `lcd-${x}`, strokeScore: 2, axes: { aspect: 2, fill: .8 } });
  w.emit({ result: prepared(w, [strong(.05), strong(.55)]) }); await tick();
  const first = reading(); first.values.temperature = '21.4'; first.readings.temperature = { ...first.readings.humidity, field: 'temperature', value: '21.4' };
  first.orientation.resolvedFields.temperature = true; w.emit({ result: first }); await tick();
  assert.equal(w.stopped, undefined); assert.equal(w.messages.length, 3);
  f.advance(10000); f.timeout(); await assert.rejects(read, { name: 'TimeoutError' });
});
test('unitless manual assignment rejects credible 180-degree competing interpretation', async () => {
  const { analyzeImage } = require('../src/camera/analysis.js');
  const { image, digit } = require('./helpers/camera-pixels.cjs');
  const { remapHypotheses } = require('../src/camera/orientation.js');
  const pixels = image(); digit(pixels, '5', 55, 120, 80); digit(pixels, '8', 115, 120, 80);
  const hypotheses = remapHypotheses([{ id: 'identity', angle: 0, method: 'none' }, { id: 'upside-down', angle: 180, method: 'strokes' }], pixels);
  const r = await analyzeImage(pixels, { region: { x: .08, y: .26, width: .25, height: .25 }, field: 'humidity', hypotheses,
    orientation: { credibleIds: hypotheses.map(h => h.id) } });
  assert.equal(r.values.humidity, ''); assert.equal(r.orientation.resolvedFields.humidity, false);
});

test('worker progress must pass established current-row checks before timeout preservation', async () => {
  for (const height of [40, 80]) {
    const f = fixture(), read = f.service.locate({ width: 400, height: 200 }), w = f.workers[0];
    const prep = prepared(w);
    prep.rowContexts = [{ row: { x: 20, y: 30, width: 340, height: 100 }, integerHeight: 100,
      displayBounds: { x: 0, y: 0, width: 400, height: 200 }, matrix: [1,0,0,0,1,0,0,0,1], state: 'established', displayId: 'lcd' }];
    w.emit({ result: prep }); await tick();
    const progress = reading('60'); progress.readings.humidity.integerCells = [
      { x: 210, y: 40, width: 35, height }, { x: 260, y: 40, width: 35, height }];
    w.emit({ progress }); f.advance(10000); f.timeout();
    if (height === 80) assert.equal((await read).values.humidity, '60');
    else await assert.rejects(read, { name: 'TimeoutError' });
  }
});

test('original-resolution crop requests rebase overview row evidence without replacing its scale', async () => {
  const f = fixture(), read = f.service.locate({ width: 3200, height: 1600 }), w = f.workers[0];
  const proposal = { region: { x: .2, y: .2, width: .5, height: .25 }, kind: 'display', displayId: 'lcd',
    strokeScore: 2, axes: { aspect: 4, fill: .8 } };
  const prep = prepared(w, [proposal]);
  prep.rowContexts = [{ row: { x: 150, y: 100, width: 300, height: 80 }, integerHeight: 80,
    displayBounds: { x: 100, y: 80, width: 400, height: 220 }, matrix: [1,0,0,0,1,0,0,0,1], displayId: 'lcd' }];
  w.emit({ result: prep }); await tick();
  assert.deepEqual(w.message.options.rowContexts[0].matrix, [2,0,-320,0,2,-160,0,0,1]);
  assert.equal(w.message.options.rowContexts[0].integerHeight, 80);
  const progress = reading('60');
  progress.rowContexts = w.message.options.rowContexts;
  progress.readings.humidity.integerCells = [{ x: 40, y: 40, width: 80, height: 160 }, { x: 140, y: 40, width: 80, height: 160 }];
  w.emit({ progress }); f.advance(10000); f.timeout();
  const result = await read;
  assert.equal(result.values.humidity, '60');
  assert.deepEqual(result.readings.humidity.correction.matrix, [2,0,640,0,2,320,0,0,1]);
  assert.ok(result.rowContexts.every(context => context.integerHeight === 80));
});

test('stronger row evidence from later progress withdraws a previously safe partial before timeout', async () => {
  const f = fixture(), read = f.service.locate({ width: 400, height: 200 }), w = f.workers[0];
  const small = { row: { x: 20, y: 130, width: 340, height: 40 }, integerHeight: 40,
    displayBounds: { x: 0, y: 0, width: 400, height: 200 }, matrix: [1,0,0,0,1,0,0,0,1], displayId: 'lcd' };
  const prep = prepared(w); prep.rowContexts = [small]; w.emit({ result: prep }); await tick();
  const progress = reading('49');
  progress.readings.humidity.integerCells = [{ x: 210, y: 130, width: 25, height: 40 }, { x: 260, y: 130, width: 25, height: 40 }];
  w.emit({ progress });
  w.emit({ result: progress }); await tick();
  assert.equal(w.message.options.requiredField, 'temperature', 'the earlier partial is retained while refining the other field');
  const regional = w.message.options.rowContexts[0];
  w.emit({ progress: { rowContexts: [{ ...regional, row: { ...regional.row, y: 20, height: 100 }, integerHeight: 100 }],
    values: { temperature: '', humidity: '' }, readings: {}, orientation: { state: 'resolved', resolvedFields: {} } } });
  f.advance(10000); f.timeout(); await assert.rejects(read, { name: 'TimeoutError' });
  assert.equal(w.stopped, true);
});
