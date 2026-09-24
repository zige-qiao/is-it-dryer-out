const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const app = readFileSync(require.resolve('../app.js'), 'utf8');
const index = readFileSync(require.resolve('../index.html'), 'utf8');
const serviceWorker = readFileSync(require.resolve('../service-worker.js'), 'utf8');

function functionSource(name, nextName) {
  const start = app.indexOf(`function ${name}`);
  const end = app.indexOf(`function ${nextName}`, start);
  assert.notEqual(start, -1, `${name} should exist`);
  assert.notEqual(end, -1, `${nextName} should follow ${name}`);
  return app.slice(start, end);
}

test('iOS holds the microphone meter before starting speech recognition', () => {
  const source = functionSource('startVoiceInput', 'stopVoiceInput');
  const iosPath = source.indexOf('if (IS_IOS && navigator.mediaDevices?.getUserMedia)');
  const meterStart = source.indexOf('startVoiceMeter(session)', iosPath);
  const recognitionContinuation = source.indexOf('.then(startRecognition)', meterStart);

  assert.notEqual(iosPath, -1);
  assert.notEqual(meterStart, -1);
  assert.notEqual(recognitionContinuation, -1);
  assert.ok(iosPath < meterStart && meterStart < recognitionContinuation);
  assert.match(source, /recognition waiting for held meter/);
  assert.match(source, /recognition start requested[^\n]+meter: session\.meter\?\.stream \? "held" : "unavailable"/);
});

test('iOS matches the successful hold-test waveform and completion lifecycle', () => {
  const meter = functionSource('startVoiceMeter', 'voiceErrorMessage');
  const start = functionSource('startVoiceInput', 'stopVoiceInput');

  assert.match(meter, /IS_IOS \? new Uint8Array/);
  assert.match(meter, /getByteTimeDomainData\(samples\)/);
  assert.match(meter, /Math\.sqrt\(total \/ samples\.length\) \/ 24/);
  assert.match(meter, /IS_IOS \? \[8, 14, 22, 14, 8\]/);
  assert.match(start, /maximumDuration = IS_IOS \? VOICE_IOS_MAX_DURATION_MS : VOICE_MAX_DURATION_MS/);
  assert.match(start, /if \(!IS_IOS\) \{\s*session\.finalTimer/);
  assert.match(start, /recognition\.addEventListener\("speechend"[^]*?if \(IS_IOS\) return/);
});

test('the iOS fallback pulse is used only when no held stream is available', () => {
  assert.match(app, /classList\.toggle\("is-meterless", IS_IOS && !session\.meter\?\.stream\)/);
});

test('a system-muted retained meter is reopened only on the next voice request', async () => {
  const vm = require('node:vm');
  let releases = 0;
  let captureRequests = 0;
  const events = [];
  const track = { readyState: 'live', enabled: true, muted: true };
  const meter = { stream: { getAudioTracks: () => [track] } };
  const session = { id: 2, meter: null };
  const context = {
    IS_IOS: true,
    retainedVoiceMeter: meter,
    session,
    releaseRetainedVoiceMeter: () => {
      releases += 1;
      track.readyState = 'ended';
      context.retainedVoiceMeter = null;
    },
    navigator: { mediaDevices: { getUserMedia: async () => {
      captureRequests += 1;
      throw { name: 'NotAllowedError' };
    } } },
    voiceDebugLog: (event) => events.push(event),
  };
  const meterSource = app.slice(app.indexOf('async function startVoiceMeter'), app.indexOf('function voiceErrorMessage'));
  await vm.runInNewContext(`${meterSource} startVoiceMeter(session);`, context);
  assert.equal(releases, 1);
  assert.equal(captureRequests, 1);
  assert.equal(session.meter, null);
  assert.equal(context.retainedVoiceMeter, null);
  assert.ok(events.includes('retained meter muted; reopening after voice request'));
});

test('recognition stops before the held meter is released', () => {
  const stop = functionSource('stopVoiceInput', 'toggleVoiceListening');
  const finish = functionSource('finishVoiceListening', 'completeVoiceSession');

  assert.match(stop, /session\.recognition\.stop\(\)/);
  assert.doesNotMatch(stop, /stopVoiceMeter\(session\)/);
  assert.match(finish, /stopVoiceMeter\(session\)/);
});

test('iOS foreground sessions retain a stationary meter across completion and dialog close', () => {
  const meter = functionSource('stopVoiceMeter', 'markVoiceActivity');
  const start = functionSource('startVoiceMeter', 'voiceErrorMessage');
  const finish = functionSource('finishVoiceListening', 'completeVoiceSession');
  const complete = functionSource('completeVoiceSession', 'showVoiceDialog');
  const toggle = functionSource('toggleVoiceListening', 'closeVoiceDialog');
  const close = functionSource('closeVoiceDialog', 'applyVoiceChanges');

  assert.match(meter, /function retainVoiceMeter/);
  assert.match(meter, /retainedVoiceMeter = meter/);
  assert.doesNotMatch(meter, /VOICE_IOS_RETAINED_METER_TIMEOUT_MS/);
  assert.match(meter, /cancelAnimationFrame\(meter.frame\)/);
  assert.match(start, /retained meter reused/);
  assert.match(start, /session\.meter = meter/);
  assert.match(finish, /retainMeter && IS_IOS && !document.hidden && retainVoiceMeter\(session\)/);
  assert.match(complete, /finishVoiceListening\(session\)/);
  assert.match(toggle, /stopVoiceInput\(!elements\.voiceDialog\.open, activeVoiceSession, "manual"\)/);
  assert.doesNotMatch(close, /releaseRetainedVoiceMeter/);
  assert.match(app, /releaseRetainedVoiceMeter\("page hidden"\)/);
});

test('diagnostic build identifies the muted-meter branch and synchronized cache', () => {
  assert.match(app, /APP_BUILD_VERSION = "v0\.5\.4\.13-muted-meter-reopen-test"/);
  assert.match(index, /styles\.css\?v=131/);
  assert.match(index, /app\.js\?v=131/);
  assert.match(serviceWorker, /is-it-dryer-out-v131/);
  assert.match(serviceWorker, /styles\.css\?v=131/);
  assert.match(serviceWorker, /app\.js\?v=131/);
});

test('live hearing replaces listening in the status box until review', () => {
  const result = functionSource('showVoiceResult', 'resetVoiceMeter');
  assert.match(result, /voiceTranscriptPanel.hidden = !allowApply/);
  assert.match(result, /: `Hearing:/);
  const start = functionSource('startVoiceInput', 'stopVoiceInput');
  assert.match(start, /voiceStatus.textContent = `Hearing:/);
  assert.match(start, /voiceTranscriptPanel.hidden = true/);
});

test('retention leaves tracks enabled, cancels animation and schedules no timeout', () => {
  const vm = require('node:vm');
  let cancelled = 0;
  let reset = 0;
  const track = { readyState: 'live', enabled: true, stop() { throw new Error('unexpected stop'); } };
  const session = { id: 1, meter: { stream: { getAudioTracks: () => [track] }, frame: 7, releaseTimer: null } };
  const context = { session, clearTimeout() {}, cancelAnimationFrame() { cancelled++; }, resetVoiceMeter() { reset++; }, voiceDebugLog() {} };
  vm.runInNewContext(`let retainedVoiceMeter = null; ${functionSource('retainVoiceMeter', 'markVoiceActivity')} retainVoiceMeter(session);`, context);
  assert.equal(session.meter, null);
  assert.equal(track.enabled, true);
  assert.equal(cancelled, 1);
  assert.equal(reset, 1);
});

test('navigation releases capture and manual stop freezes waveform without stopping tracks', () => {
  const stop = functionSource('stopVoiceInput', 'toggleVoiceListening');
  assert.match(stop, /cancelAnimationFrame\(session.meter.frame\)/);
  assert.match(stop, /resetVoiceMeter\(\)/);
  assert.match(app, /window.addEventListener\("pagehide"/);
  assert.match(app, /releaseRetainedVoiceMeter\("page left"\)/);
  assert.match(app, /finishVoiceListening\(session, false\)/);
  assert.doesNotMatch(index, /Microphone ready for retry|Release microphone/);
});
