const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function fixture(mode) {
  const nodes = new Map();
  const timers = new Map();
  const objects = [];
  let timerId = 0;
  class Node {
    constructor() { this.events = {}; this.value = ''; }
    addEventListener(name, callback) { this.events[name] = callback; }
    setAttribute() {}
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
    document: { getElementById: node, querySelectorAll: () => [node('reuse'), node('fresh')], addEventListener() {}, documentElement: { lang: 'en-GB' } },
    navigator: {}, location: { search: `?mode=${mode}` }, performance: { now: () => 0 },
    URL, URLSearchParams,
    setTimeout(fn, ms) { timers.set(++timerId, { fn, ms }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  };
  const source = readFileSync(require.resolve('../voice-test.js'), 'utf8')
    .replace('import.meta.url', JSON.stringify('https://example.test/voice-test.js?v=113'));
  vm.runInNewContext(source, context);
  return { node, objects, timers };
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
    f.node('clear').click();
    assert.match(f.node('log').value, /build=0.5.3.2\+diagnostics.1 assetRevision=113/);
  });
}

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
