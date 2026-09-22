const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function fixture(mode, options = {}) {
  const nodes = new Map();
  const timers = new Map();
  const objects = [];
  const documentEvents = {};
  let now = 0;
  let hidden = false;
  let visibilityState = 'visible';
  let timerId = 0;
  const mediaTracks = [];
  const animationFrames = new Map();
  const windowEvents = {};
  let animationId = 0;
  class Node {
    constructor() { this.events = {}; this.style = {}; this.value = ''; this.textContent = ''; this.hidden = false; this.disabled = false; }
    addEventListener(name, callback) { this.events[name] = callback; }
    setAttribute(name, value) { (this.attributes ||= {})[name] = value; }
    click() { return this.events.click?.({ preventDefault() {} }); }
  }
  class Recognition {
    constructor() { this.listeners = {}; objects.push(this); }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    emit(name, event = {}) { for (const fn of this.listeners[name] || []) fn(event); }
    start() { this.startCount = (this.startCount || 0) + 1; this.emit('start'); this.emit('audiostart'); }
    stop() { this.stopCount = (this.stopCount || 0) + 1; }
    abort() { this.abortCount = (this.abortCount || 0) + 1; }
  }
  const node = id => { if (!nodes.has(id)) nodes.set(id, new Node()); return nodes.get(id); };
  const context = {
    window: {
      SpeechRecognition: Recognition, isSecureContext: true,
      addEventListener(name, callback) { windowEvents[name] = callback; },
    },
    document: {
      getElementById: node,
      querySelectorAll: () => [node('reuse'), node('fresh'), node('interrupt'), node('prime'), node('hold'), node('hold-persist'), node('track-pause')],
      addEventListener(name, callback) { documentEvents[name] = callback; },
      get hidden() { return hidden; },
      get visibilityState() { return visibilityState; },
      documentElement: { lang: 'en-GB' },
    },
    navigator: {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.0.0 Mobile/15E148 Safari/604.1',
      platform: 'iPhone', maxTouchPoints: 5,
      mediaDevices: {
        async getUserMedia() {
          if (options.getUserMedia) return options.getUserMedia(mediaTracks);
          const track = { readyState: 'live', enabled: true, stop() { this.readyState = 'ended'; this.stopCount = (this.stopCount || 0) + 1; } };
          mediaTracks.push(track);
          return { getAudioTracks: () => [track], getTracks: () => [track] };
        },
      },
    }, location: { search: `?mode=${mode}${options.staged ? '&staged=1' : ''}${options.stopEnabled ? '&stopTrack=enabled' : ''}` }, performance: { now: () => now },
    URL, URLSearchParams,
    setTimeout(fn, ms) { timers.set(++timerId, { fn, ms }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(fn) {
      const id = ++animationId;
      animationFrames.set(id, () => { animationFrames.delete(id); fn(); });
      return id;
    },
    cancelAnimationFrame(id) { animationFrames.delete(id); },
  };
  if (options.AudioContext) context.window.AudioContext = options.AudioContext;
  const source = readFileSync(require.resolve('../voice-test.js'), 'utf8')
    .replace('import.meta.url', JSON.stringify('https://example.test/voice-test.js?v=126'));
  vm.runInNewContext(source, context);
  return {
    node, objects, timers, mediaTracks, animationFrames,
    tick(ms) {
      const entry = [...timers.entries()].find(([, timer]) => timer.ms === ms);
      assert.ok(entry, `Expected ${ms}ms timer`);
      timers.delete(entry[0]);
      entry[1].fn();
    },
    setTime(value) { now = value; },
    visibility(state) {
      hidden = state === 'hidden';
      visibilityState = state;
      documentEvents.visibilitychange();
    },
    pagehide() { windowEvents.pagehide?.(); },
  };
}

for (const mode of ['reuse', 'fresh']) {
  test(`${mode}: three recordings, isolated listeners and private logs`, () => {
    const f = fixture(mode);
    for (let i = 0; i < 3; i++) {
      f.node('start').click();
      assert.equal(f.node('start').disabled, true);
      const recognition = f.objects.at(-1);
      const result = [{ transcript: 'private speech' }];
      result.isFinal = true;
      recognition.emit('result', { results: [result] });
      recognition.emit('end');
      assert.equal(f.node('start').disabled, false);
      assert.equal(f.timers.size, 0);
    }
    assert.equal(f.objects.length, mode === 'reuse' ? 1 : 3);
    assert.equal((f.node('log').value.match(/current=true results=1/g) || []).length, 3);
    assert.equal(f.node('log').value.includes('private speech'), false);
    assert.match(f.node('log').value, /browser=Chrome_iOS browserVersion=140\.0\.0\.0 osVersion=27\.0 webkit=605\.1\.15/);
    assert.match(f.node('log').value, /user agent value="Mozilla\/5\.0/);
    f.node('clear').click();
    assert.match(f.node('log').value, /build=v0.5.4.9-stop-enabled-test assetRevision=126/);
  });
}

test('interruption mode logs markers and keeps recognition active while hidden', () => {
  const f = fixture('interrupt');
  assert.equal(f.node('interruption-guide').hidden, false);
  f.node('start').click();
  const recognition = f.objects[0];
  f.node('mark-interruption').click();
  f.setTime(1250);
  f.visibility('hidden');
  assert.equal(recognition.stopCount || 0, 0);
  f.visibility('visible');
  assert.equal(recognition.stopCount || 0, 0);
  f.node('mark-interruption').click();
  assert.match(f.node('log').value, /external audio interruption marker phase=before/);
  assert.match(f.node('log').value, /external audio interruption marker phase=after durationMs=1250/);
  assert.match(f.node('log').value, /visibility state=hidden/);
  assert.match(f.node('log').value, /visibility state=visible/);
  f.node('stop').click();
  recognition.emit('end');
  assert.equal(f.node('start').disabled, false);
});

test('standard modes still stop recognition when hidden', () => {
  const f = fixture('reuse');
  f.node('start').click();
  const recognition = f.objects[0];
  f.visibility('hidden');
  assert.equal(recognition.stopCount, 1);
  assert.match(f.node('log').value, /stop requested reason=page hidden/);
});

test('manual stop waits for end, and missing end requires reload', () => {
  const f = fixture('reuse');
  f.node('start').click();
  f.node('stop').click();
  assert.equal(f.objects[0].stopCount, 1);
  assert.equal(f.node('start').disabled, true);
  const timeout = [...f.timers.values()].find(timer => timer.ms === 3000);
  timeout.fn();
  assert.match(f.node('status').textContent, /Reload/);
  f.node('start').click();
  assert.equal(f.objects.length, 1);
});

test('late events from an old fresh recognizer do not end the current attempt', () => {
  const f = fixture('fresh');
  f.node('start').click();
  f.objects[0].emit('end');
  f.node('start').click();
  f.objects[0].emit('end');
  assert.equal(f.node('start').disabled, true);
  f.objects[1].emit('end');
  assert.equal(f.node('start').disabled, false);
});

test('prime mode briefly opens and releases a microphone stream before retry', async () => {
  const f = fixture('prime');
  assert.equal(f.node('reset-guide').hidden, false);
  const reset = f.node('reset-microphone').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.node('start').disabled, true);
  assert.equal(f.mediaTracks.length, 1);
  const hold = [...f.timers.values()].find(timer => timer.ms === 400);
  assert.ok(hold);
  hold.fn();
  await reset;
  assert.equal(f.mediaTracks[0].stopCount, 1);
  assert.equal(f.node('start').disabled, false);
  assert.match(f.node('log').value, /microphone reset opened tracks=1 state=live/);
  assert.match(f.node('log').value, /microphone reset released tracks=1/);
});

test('hold mode keeps the microphone stream open until recognition ends', async () => {
  const f = fixture('hold');
  assert.equal(f.node('hold-guide').hidden, false);
  assert.equal(f.node('hold-waveform').hidden, false);
  await f.node('start').click();
  assert.equal(f.mediaTracks.length, 1);
  assert.equal(f.mediaTracks[0].readyState, 'live');
  assert.equal(f.mediaTracks[0].stopCount || 0, 0);
  assert.match(f.node('log').value, /held microphone opened tracks=1 state=live/);
  assert.match(f.node('log').value, /start requested object=1 mode=hold/);
  f.objects[0].emit('end');
  assert.equal(f.mediaTracks[0].readyState, 'ended');
  assert.equal(f.mediaTracks[0].stopCount, 1);
  assert.match(f.node('log').value, /held microphone released tracks=1/);
  assert.equal(f.node('start').disabled, false);
});

test('persistent hold mode reuses the same live stream after manual stop', async () => {
  const f = fixture('hold-persist');
  assert.equal(f.node('hold-guide').hidden, false);
  assert.equal(f.node('hold-waveform').hidden, false);
  await f.node('start').click();
  const firstRecognition = f.objects[0];
  f.node('stop').click();
  firstRecognition.emit('end');
  assert.equal(f.mediaTracks.length, 1);
  assert.equal(f.mediaTracks[0].readyState, 'live');
  assert.equal(f.mediaTracks[0].stopCount || 0, 0);
  assert.match(f.node('log').value, /held microphone retained reason=manual stop nextAttempt=2/);

  await f.node('start').click();
  assert.equal(f.objects.length, 2);
  assert.equal(f.mediaTracks.length, 1);
  assert.match(f.node('log').value, /held microphone reused tracks=1 state=live/);
  f.objects[1].emit('end');
  assert.equal(f.mediaTracks[0].readyState, 'ended');
  assert.equal(f.mediaTracks[0].stopCount, 1);
  assert.match(f.node('log').value, /held microphone released tracks=1/);
});

function MeterAudioContext() {
  this.state = 'running';
  this.closeCount = 0;
  this.resume = async () => { this.state = 'running'; };
  this.close = async () => { this.state = 'closed'; this.closeCount++; };
  this.createAnalyser = () => ({
    fftSize: 0,
    getFloatTimeDomainData: samples => {
      for (let i = 0; i < samples.length; i++) samples[i] = this.silent ? 0 : (i % 2 ? 0.25 : -0.25);
    },
    getByteTimeDomainData(samples) {
      for (let i = 0; i < samples.length; i++) samples[i] = i % 2 ? 160 : 96;
    },
  });
  this.createMediaStreamSource = () => ({ connect() {}, disconnect() {} });
  MeterAudioContext.instances.push(this);
}
MeterAudioContext.instances = [];

test('enabled-stop control retains live capture through end, then explicitly releases and reopens', async () => {
  const f = fixture('track-pause', { staged: true, stopEnabled: true, AudioContext: MeterAudioContext });
  assert.equal(f.node('stop-enabled').attributes['aria-current'], 'page');
  await f.node('open-microphone').click();
  f.node('start').click();
  f.node('stop').click();
  assert.equal(f.objects[0].stopCount, 1);
  assert.equal(f.mediaTracks[0].enabled, true);
  assert.equal(f.animationFrames.size, 1);
  f.objects[0].emit('end');
  assert.equal(f.mediaTracks[0].enabled, true);
  assert.match(f.node('status').textContent, /microphone still active/);
  assert.equal(f.node('release-microphone').disabled, false);
  f.node('release-microphone').click();
  assert.equal(f.mediaTracks[0].readyState, 'ended');
  assert.equal(f.timers.size, 0);
  await f.node('open-microphone').click();
  assert.equal(f.mediaTracks.length, 2);
  assert.equal(f.objects[1].startCount || 0, 0);
  f.node('start').click();
  f.node('abort').click();
  assert.equal(f.mediaTracks[1].enabled, false);
  f.objects[1].emit('end');
  f.node('release-microphone').click();
});

test('enabled-stop retained stream is bounded by idle timeout and hidden cleanup', async () => {
  for (const cleanup of ['timeout', 'hidden']) {
    const f = fixture('track-pause', { staged: true, stopEnabled: true, AudioContext: MeterAudioContext });
    await f.node('open-microphone').click();
    f.node('start').click();
    f.node('stop').click();
    f.objects[0].emit('end');
    if (cleanup === 'timeout') f.tick(30000);
    else f.visibility('hidden');
    assert.equal(f.mediaTracks[0].readyState, 'ended');
    assert.equal(f.timers.size, 0);
    assert.equal(f.animationFrames.size, 0);
  }
});

test('staged microphone measures before recognition, then releases and reopens without reload', async () => {
  const f = fixture('track-pause', { staged: true, AudioContext: MeterAudioContext });
  assert.equal(f.node('start').disabled, true);
  await f.node('open-microphone').click();
  assert.equal(f.objects[0].startCount || 0, 0);
  assert.equal(f.node('release-microphone').disabled, false);
  f.tick(100);
  f.tick(1000);
  assert.match(f.node('log').value, /audio probe phase=microphone-only/);
  f.node('start').click();
  assert.equal(f.objects[0].startCount, 1);
  f.tick(100);
  f.tick(1000);
  assert.match(f.node('log').value, /audio probe phase=recognition/);
  f.node('stop').click();
  f.objects[0].emit('end');
  f.node('release-microphone').click();
  await f.node('open-microphone').click();
  assert.equal(f.mediaTracks.length, 2);
  assert.equal(f.objects[1].startCount || 0, 0);
  f.node('release-microphone').click();
  assert.equal(f.mediaTracks[1].readyState, 'ended');
  assert.equal(f.timers.size, 0);
});

test('staged microphone timeout releases without starting recognition', async () => {
  const f = fixture('track-pause', { staged: true, AudioContext: MeterAudioContext });
  await f.node('open-microphone').click();
  f.tick(30000);
  assert.equal(f.mediaTracks[0].readyState, 'ended');
  assert.equal(f.objects[0].startCount || 0, 0);
  assert.equal(f.timers.size, 0);
});

test('staged release cancels pending permission and disposes its late stream', async () => {
  let resolveMedia;
  const track = { readyState: 'live', stop() { this.readyState = 'ended'; } };
  const f = fixture('track-pause', { staged: true, getUserMedia: () => new Promise(resolve => { resolveMedia = resolve; }) });
  const pending = f.node('open-microphone').click();
  f.node('release-microphone').click();
  resolveMedia({ getAudioTracks: () => [track], getTracks: () => [track] });
  await pending;
  assert.equal(track.readyState, 'ended');
  assert.equal(f.objects[0].startCount || 0, 0);
  assert.equal(f.timers.size, 0);
});

test('audio probe measures independently of waveform frames and reports silent/interrupted capture', async () => {
  const f = fixture('track-pause', { AudioContext: MeterAudioContext });
  await f.node('start').click();
  const context = MeterAudioContext.instances.at(-1);
  f.mediaTracks[0].muted = false;
  f.tick(100);
  f.tick(1000);
  assert.match(f.node('log').value, /audio probe phase=recognition enabled=true muted=false readyState=live context=running sampleReads=1 readsSinceReport=1 waveformFrames=1 framesSinceReport=0 rmsMax=0.250000 peakMax=0.250000/);
  context.silent = true;
  context.state = 'interrupted';
  f.tick(100);
  f.tick(1000);
  assert.match(f.node('log').value, /context=interrupted sampleReads=2 readsSinceReport=1 waveformFrames=1 framesSinceReport=0 rmsMax=0.000000 peakMax=0.000000/);
  f.node('stop').click();
  f.objects[0].emit('end');
  f.tick(100);
  f.tick(1000);
  assert.match(f.node('log').value, /\[attempt -\] audio probe phase=retained enabled=false/);
  assert.equal(f.animationFrames.size, 0);
  f.node('release-microphone').click();
  assert.equal([...f.timers.values()].filter(timer => [100, 1000].includes(timer.ms)).length, 0);
  await f.node('start').click();
  f.tick(100);
  f.tick(1000);
  assert.match(f.node('log').value, /\[attempt 2\] audio probe .*sampleReads=1 readsSinceReport=1/);
  f.objects[1].emit('end');
  assert.equal(f.timers.size, 0);
});

test('audio probe reports unavailable measurements without an audio context and cleans up on hide', async () => {
  const f = fixture('track-pause');
  await f.node('start').click();
  f.tick(1000);
  assert.match(f.node('log').value, /context=unavailable sampleReads=0 readsSinceReport=0 waveformFrames=0 framesSinceReport=0 rmsMax=unavailable peakMax=unavailable/);
  f.visibility('hidden');
  assert.equal(f.timers.size, 0);
});

test('track-pause immediately pauses its real meter and retries with the same re-enabled stream', async () => {
  MeterAudioContext.instances.length = 0;
  const f = fixture('track-pause', { AudioContext: MeterAudioContext });
  await f.node('start').click();
  const track = f.mediaTracks[0];
  assert.equal(track.enabled, true);
  assert.equal(f.animationFrames.size, 1);
  const firstFrame = [...f.animationFrames.values()][0];
  firstFrame();
  assert.notEqual(f.node('hold-wave-3').style.height, '2px');

  f.node('stop').click();
  assert.equal(track.enabled, false);
  assert.equal(f.animationFrames.size, 0);
  assert.equal(f.node('hold-wave-3').style.height, '2px');
  assert.equal(f.objects[0].stopCount, 1);
  f.objects[0].emit('end');
  assert.equal(track.readyState, 'live');
  assert.match(f.node('log').value, /disabled-does-not-prove-hardware-off-or-capture-stopped/);

  await f.node('start').click();
  assert.equal(f.mediaTracks.length, 1);
  assert.equal(track.enabled, true);
  assert.equal(f.animationFrames.size, 1);
  f.objects[1].emit('end');
  assert.equal(track.readyState, 'ended');
  assert.equal(MeterAudioContext.instances[0].state, 'closed');
});

test('track-pause abort disables immediately, discards late results, and retries the same stream', async () => {
  const f = fixture('track-pause', { AudioContext: MeterAudioContext });
  await f.node('start').click();
  const track = f.mediaTracks[0];
  f.node('abort').click();
  assert.equal(track.enabled, false);
  assert.equal(f.objects[0].abortCount, 1);
  f.objects[0].emit('error', { error: 'aborted' });
  assert.equal(track.readyState, 'live');
  f.objects[0].emit('result', { results: [{ isFinal: true }] });
  assert.match(f.node('log').value, /result discarded reason=aborted run/);
  f.objects[0].emit('end');
  await f.node('start').click();
  assert.equal(f.mediaTracks.length, 1);
  assert.equal(track.enabled, true);
  f.objects[1].emit('end');
});

test('track-pause explicit release and retained idle timeout stop the stream', async () => {
  const f = fixture('track-pause');
  await f.node('start').click();
  f.node('stop').click();
  f.objects[0].emit('end');
  const track = f.mediaTracks[0];
  assert.equal(f.node('release-microphone').disabled, false);
  f.node('release-microphone').click();
  assert.equal(track.readyState, 'ended');

  await f.node('start').click();
  f.node('stop').click();
  f.objects[1].emit('end');
  const secondTrack = f.mediaTracks[1];
  const idle = [...f.timers.values()].find(timer => timer.ms === 30000);
  assert.ok(idle);
  idle.fn();
  assert.equal(secondTrack.readyState, 'ended');
  assert.match(f.node('log').value, /held microphone idle timeout seconds=30/);
});

test('track-pause hidden page releases immediately even after Stop is pending', async () => {
  const f = fixture('track-pause', { AudioContext: MeterAudioContext });
  await f.node('start').click();
  const track = f.mediaTracks[0];
  f.node('stop').click();
  assert.equal(track.enabled, false);
  f.visibility('hidden');
  assert.equal(track.readyState, 'ended');
  f.objects[0].emit('end');
  assert.equal(track.readyState, 'ended');
});

test('track-pause pagehide releases active resources', async () => {
  const f = fixture('track-pause');
  await f.node('start').click();
  const track = f.mediaTracks[0];
  f.pagehide();
  assert.equal(track.readyState, 'ended');
  assert.equal(f.objects[0].abortCount, 1);
});

test('track-pause cancels async microphone preparation and releases the late stream', async () => {
  let resolveMedia;
  const f = fixture('track-pause', {
    getUserMedia(mediaTracks) {
      return new Promise(resolve => {
        resolveMedia = () => {
          const track = { readyState: 'live', enabled: true, stop() { this.readyState = 'ended'; this.stopCount = (this.stopCount || 0) + 1; } };
          mediaTracks.push(track);
          resolve({ getAudioTracks: () => [track], getTracks: () => [track] });
        };
      });
    },
  });
  const starting = f.node('start').click();
  f.node('stop').click();
  resolveMedia();
  await starting;
  assert.equal(f.mediaTracks[0].readyState, 'ended');
  assert.equal(f.objects[0].startCount || 0, 0);
  assert.equal(f.node('start').disabled, false);
  assert.match(f.node('log').value, /held microphone preparation discarded reason=run cancelled/);
});

test('track-pause hidden during async preparation cannot retain or re-enable the late stream', async () => {
  let resolveMedia;
  const f = fixture('track-pause', {
    getUserMedia(mediaTracks) {
      return new Promise(resolve => {
        resolveMedia = () => {
          const track = { readyState: 'live', enabled: true, stop() { this.readyState = 'ended'; this.stopCount = (this.stopCount || 0) + 1; } };
          mediaTracks.push(track);
          resolve({ getAudioTracks: () => [track], getTracks: () => [track] });
        };
      });
    },
  });
  const starting = f.node('start').click();
  f.visibility('hidden');
  resolveMedia();
  await starting;
  assert.equal(f.mediaTracks[0].readyState, 'ended');
  assert.equal(f.objects[0].startCount || 0, 0);
  assert.match(f.node('log').value, /held microphone preparation discarded reason=page hidden/);
});

test('track-pause error and missing end release resources and reject stale callbacks', async () => {
  const f = fixture('track-pause');
  await f.node('start').click();
  const first = f.objects[0];
  const track = f.mediaTracks[0];
  first.emit('error', { error: 'network' });
  assert.equal(track.readyState, 'ended');
  const cleanup = [...f.timers.values()].find(timer => timer.ms === 3000);
  assert.ok(cleanup);
  cleanup.fn();
  assert.match(f.node('status').textContent, /Reload/);
  first.emit('result', { results: [{ isFinal: true }] });
  first.emit('end');
  assert.equal(track.stopCount, 1);
});
