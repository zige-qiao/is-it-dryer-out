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

test('recognition stops before the held meter is released', () => {
  const stop = functionSource('stopVoiceInput', 'toggleVoiceListening');
  const finish = functionSource('finishVoiceListening', 'completeVoiceSession');

  assert.match(stop, /session\.recognition\.stop\(\)/);
  assert.doesNotMatch(stop, /stopVoiceMeter\(session\)/);
  assert.match(finish, /stopVoiceMeter\(session\)/);
});

test('manual iOS stops retain and reuse the same meter with bounded cleanup', () => {
  const meter = functionSource('stopVoiceMeter', 'markVoiceActivity');
  const start = functionSource('startVoiceMeter', 'voiceErrorMessage');
  const finish = functionSource('finishVoiceListening', 'completeVoiceSession');
  const complete = functionSource('completeVoiceSession', 'showVoiceDialog');
  const toggle = functionSource('toggleVoiceListening', 'closeVoiceDialog');
  const close = functionSource('closeVoiceDialog', 'applyVoiceChanges');

  assert.match(meter, /function retainVoiceMeter/);
  assert.match(meter, /retainedVoiceMeter = meter/);
  assert.match(meter, /VOICE_IOS_RETAINED_METER_TIMEOUT_MS/);
  assert.match(start, /retained meter reused/);
  assert.match(start, /session\.meter = meter/);
  assert.match(finish, /retainMeter && IS_IOS && retainVoiceMeter\(session\)/);
  assert.match(complete, /session\.manualStop && !session\.cleanupTimedOut && !session\.hadError/);
  assert.match(toggle, /stopVoiceInput\(!elements\.voiceDialog\.open, activeVoiceSession, "manual"\)/);
  assert.match(close, /releaseRetainedVoiceMeter\("dialog closed"\)/);
  assert.match(app, /releaseRetainedVoiceMeter\("page hidden"\)/);
});

test('production build identifies the v0.5.4.5 diagnostics branch', () => {
  assert.match(app, /APP_BUILD_VERSION = "v0\.5\.4\.5-voice-diagnostics"/);
  assert.match(index, /styles\.css\?v=122/);
  assert.match(index, /app\.js\?v=122/);
  assert.match(serviceWorker, /is-it-dryer-out-v122/);
  assert.match(serviceWorker, /styles\.css\?v=122/);
  assert.match(serviceWorker, /app\.js\?v=122/);
});
