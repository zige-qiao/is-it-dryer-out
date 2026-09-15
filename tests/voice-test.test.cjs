const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function fixture(mode) {
  const nodes = new Map();
  const timers = new Map();
  const objects = [];
  const documentEvents = {};
  let now = 0;
  let hidden = false;
  let visibilityState = 'visible';
  let timerId = 0;
  class Node {
    constructor() { this.events = {}; this.value = ''; this.textContent = ''; this.hidden = false; this.disabled = false; }
    addEventListener(name, callback) { this.events[name] = callback; }
    setAttribute(name, value) { (this.attributes ||= {})[name] = value; }
    click() { return this.events.click?.({ preventDefault() {} }); }
  }
  class Recognition {
    constructor() { this.listeners = {}; objects.push(this); }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    emit(name, event = {}) { for (const fn of this.listeners[name] || []) fn(event); }
    start() { this.emit('start'); this.emit('audiostart'); }
    stop() { this.stopCount = (this.stopCount || 0) + 1; }
    abort() {}
  }
  const node = id => { if (!nodes.has(id)) nodes.set(id, new Node()); return nodes.get(id); };
  const context = {
    window: { SpeechRecognition: Recognition, isSecureContext: true },
    document: {
      getElementById: node,
      querySelectorAll: () => [node('reuse'), node('fresh'), node('interrupt')],
      addEventListener(name, callback) { documentEvents[name] = callback; },
      get hidden() { return hidden; },
      get visibilityState() { return visibilityState; },
      documentElement: { lang: 'en-GB' },
    },
    navigator: {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.0.0 Mobile/15E148 Safari/604.1',
      platform: 'iPhone', maxTouchPoints: 5,
    }, location: { search: `?mode=${mode}` }, performance: { now: () => now },
    URL, URLSearchParams,
    setTimeout(fn, ms) { timers.set(++timerId, { fn, ms }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  };
  const source = readFileSync(require.resolve('../voice-test.js'), 'utf8')
    .replace('import.meta.url', JSON.stringify('https://example.test/voice-test.js?v=114'));
  vm.runInNewContext(source, context);
  return {
    node, objects, timers,
    setTime(value) { now = value; },
    visibility(state) {
      hidden = state === 'hidden';
      visibilityState = state;
      documentEvents.visibilitychange();
    },
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
    assert.match(f.node('log').value, /build=0.5.3.3\+diagnostics.1 assetRevision=114/);
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
