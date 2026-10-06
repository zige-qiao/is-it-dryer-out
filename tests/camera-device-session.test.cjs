const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDeviceSession } = require('../src/camera/device-session.js');

function fixture({ telephoto = true, supportsTorch = true, failSwitch = false, failTorch = false, mismatch = false } = {}) {
  let time = 0, id = 0, brightness = 120, torch = false, captured = false, pausedSettings = false;
  const timers = new Map(), streams = [], opens = [], notifications = [], zooms = [];
  const preferences = { autoFlash: true }, video = { videoWidth: 1920, videoHeight: 1080, currentTime: 0, paused: false, play: async () => {} };
  const controls = {
    stop() {}, start: async (track, settings) => { torch = false; captured = false; zooms.push(settings); },
    setZoom: value => zooms.push(value), waitIdle: async () => {}, setCapturing: value => captured = value, setSwitching: value => captured = value,
    snapshot: () => ({ flash: torch, supportsTorch }), settled: () => !captured,
    setTorch: async value => { if (failTorch && value) throw new Error('torch'); torch = value; },
    toggleFlash: async () => { torch = !torch; }, notify: text => notifications.push(text),
  };
  const env = {
    document: { hidden: false, createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4096).fill(brightness) }) }) }) },
    navigator: { mediaDevices: {
      enumerateDevices: async () => telephoto ? [{ kind: 'videoinput', deviceId: 'tele', label: 'Back Telephoto Camera' }] : [],
      getUserMedia: async constraints => {
        const selected = constraints.video.deviceId?.exact || 'main'; opens.push(selected);
        if (failSwitch && selected === 'tele') throw new Error('Camera busy');
        const track = { readyState: 'live', stopped: false, stop() { this.stopped = true; this.readyState = 'ended'; }, getSettings: () => ({ deviceId: mismatch && selected === 'tele' ? 'main' : selected }) };
        const stream = { getVideoTracks: () => [track], getTracks: () => [track] }; streams.push(stream); return stream;
      },
    } },
    setTimeout(fn, delay) { timers.set(++id, { fn, at: time + delay }); return id; }, clearTimeout: id => timers.delete(id),
  };
  const session = createDeviceSession({ video, controls, preferences, onStream() {}, settingsOpen: () => pausedSettings }, env);
  async function tick(ms) {
    const end = time + ms;
    for (;;) {
      const item = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!item) break;
      time = item[1].at; video.currentTime++; timers.delete(item[0]); await item[1].fn();
    }
    time = end;
  }
  const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
  return { session, preferences, video, env, streams, opens, zooms, notifications, timers, tick, flush,
    setBrightness: value => brightness = value, settings: value => pausedSettings = value, get torch() { return torch; } };
}

test('telephoto switches at 3x, preserves latest zoom, and returns below the threshold', async () => {
  const f = fixture(); await f.session.start(); f.session.setZoom(3); f.session.setZoom(5); await f.flush();
  assert.deepEqual(f.opens, ['main', 'tele']); assert.ok(f.zooms.some(z => z?.base === 3)); assert.equal(f.streams[0].getVideoTracks()[0].stopped, true);
  f.session.setZoom(1); await f.flush(); assert.equal(f.opens.at(-1), 'main'); f.session.stop(); assert.equal(f.timers.size, 0);
});

test('3x and 5x reuse the telephoto stream and return to the starting camera at 1x',async()=>{
 const f=fixture();await f.session.start();f.session.setZoom(3);await f.flush();
 const tele=f.streams.at(-1);f.session.setZoom(5);await f.flush();f.session.setZoom(3);await f.flush();
 assert.deepEqual(f.opens,['main','tele']);assert.equal(f.streams.at(-1),tele);assert.ok(f.zooms.includes(5));
 f.session.setZoom(1);await f.flush();assert.deepEqual(f.opens,['main','tele','main']);f.session.stop();
});

test('unverified device readback releases that stream and recovers the previous camera',async()=>{
 const f=fixture({mismatch:true});await f.session.start();f.session.setZoom(5);await f.flush();
 assert.deepEqual(f.opens,['main','tele','main']);assert.ok(f.streams[1].getVideoTracks()[0].stopped);
 assert.ok(f.zooms.some(z=>z?.base===1&&z?.zoom===5));assert.equal(f.session.busy(),false);f.session.stop();
});

test('rapid selections and closure during camera acquisition release late streams',async()=>{
 const f=fixture();await f.session.start();const original=f.env.navigator.mediaDevices.getUserMedia;let release;
 f.env.navigator.mediaDevices.getUserMedia=constraints=>new Promise(resolve=>release=async()=>resolve(await original(constraints)));
 f.session.setZoom(3);await f.flush();assert.equal(f.session.busy(),true);
 f.session.setZoom(5);f.session.setZoom(1);f.session.stop();await release();await f.flush();
 assert.ok(f.streams.at(-1).getVideoTracks()[0].stopped);assert.equal(f.session.busy(),false);assert.equal(f.timers.size,0);
});
test('missing or failed telephoto retains a usable rear camera without repeated switching', async () => {
  for (const opts of [{ telephoto: false }, { failSwitch: true }]) {
    const f = fixture(opts); await f.session.start(); f.session.setZoom(4); await f.flush();
    assert.equal(f.opens.at(-1), 'main'); assert.ok(f.notifications.length); f.session.setZoom(5); await f.flush();
    assert.ok(f.opens.filter(id => id === 'tele').length <= 1); f.session.stop();
  }
});
test('Auto flash waits for sustained darkness and latches despite torch illumination', async () => {
  const f = fixture(); await f.session.start(); await f.tick(500); assert.equal(f.session.captureMode(), 'default');
  f.setBrightness(20); await f.tick(1000); assert.equal(f.torch, false); await f.tick(500); assert.equal(f.torch, true); assert.equal(f.session.captureMode(), 'flash');
  f.setBrightness(150); await f.tick(1500); assert.equal(f.session.captureMode(), 'flash');
  f.session.setZoom(3); await f.flush(); assert.equal(f.session.captureMode(), 'flash'); assert.equal(f.torch, true); f.session.stop();
});
test('brief darkness, paused frames and settings interaction do not trigger lighting', async () => {
  const f = fixture(); await f.session.start(); f.setBrightness(20); await f.tick(1000); f.setBrightness(120); await f.tick(500);
  f.setBrightness(20); f.settings(true); await f.tick(2000); f.settings(false); f.video.paused = true; await f.tick(2000);
  assert.equal(f.torch, false); f.session.stop();
});
test('manual flash overrides Auto for this session without changing its saved preference', async () => {
  const f = fixture(); await f.session.start(); f.setBrightness(20); await f.tick(1500); await f.session.toggleFlash();
  assert.equal(f.torch, false); assert.equal(f.preferences.autoFlash, true); await f.tick(2000); assert.equal(f.session.captureMode(), 'off'); f.session.stop();
});
test('disabling Auto removes its torch; unsupported torch still permits flash capture', async () => {
  const f = fixture(); await f.session.start(); f.setBrightness(20); await f.tick(1500); f.preferences.autoFlash = false; assert.equal(f.session.captureMode(), 'off'); await f.tick(500); assert.equal(f.torch, false); f.session.stop();
  const unsupported = fixture({ supportsTorch: false }); await unsupported.session.start(); unsupported.setBrightness(20); await unsupported.tick(1500);
  assert.equal(unsupported.torch, false); assert.equal(unsupported.session.captureMode(), 'flash'); unsupported.session.stop();
});
test('automatic lighting failure preserves manual capture and explains the failure', async () => {
  const f = fixture({ failTorch: true }); await f.session.start(); f.setBrightness(20); await f.tick(1500);
  assert.equal(f.session.captureMode(), 'off'); assert.match(f.notifications.at(-1), /Auto flash unavailable/); f.session.stop();
});
test('late permission completion after stop releases the acquired camera', async () => {
  const f = fixture(); let resolve; const original = f.env.navigator.mediaDevices.getUserMedia;
  f.env.navigator.mediaDevices.getUserMedia = constraints => new Promise(r => resolve = async () => r(await original(constraints)));
  const start = f.session.start(); f.session.stop(); await resolve(); await assert.rejects(start, /cancelled/);
  assert.equal(f.streams[0].getVideoTracks()[0].stopped, true);
});
