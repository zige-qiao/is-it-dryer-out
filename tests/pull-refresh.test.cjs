const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const gestureSource = source.slice(source.indexOf('function bindPullToRefresh()'), source.indexOf('function bindTypedValue('));

function fixture({ reducedMotion = true, footerHeight = 64, verdictHeight = 400 } = {}) {
  const listeners = new Map();
  const classes = new Set();
  const properties = new Map();
  const timers = new Map();
  const frames = new Map();
  let nextTimer = 0;
  let nextFrame = 0;
  let resolveWeather;
  let waitForWeather = false;
  const body = {
    classList: {
      add: name => classes.add(name),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
      toggle: (name, force) => force ? classes.add(name) : classes.delete(name),
    },
    style: {
      setProperty: (name, value) => properties.set(name, value),
      removeProperty: name => properties.delete(name),
    },
  };
  const state = { weatherRequestPending: false, weatherLoadFailed: false };
  const elements = {
    pullRefreshText: { textContent: '' },
    pullRefresh: { offsetHeight: 76 },
    verdictPanel: { offsetTop: 0, offsetHeight: verdictHeight },
    forecastPanel: { offsetTop: verdictHeight - 12, offsetHeight: footerHeight },
  };
  let refreshes = 0;
  let dialogOpen = false;
  const document = {
    body,
    addEventListener: (name, listener) => listeners.set(name, listener),
    querySelector: () => dialogOpen ? {} : null,
    hidden: false,
  };
  const window = { scrollY: 0, matchMedia: () => ({ matches: reducedMotion }) };
  const context = vm.createContext({
    document, window, state, elements,
    setTimeout: callback => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame: callback => { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    fetchWeather: async () => {
      refreshes++;
      if (waitForWeather) await new Promise(resolve => { resolveWeather = resolve; });
    },
  });
  vm.runInContext(gestureSource, context);
  context.bindPullToRefresh();
  const target = { closest: () => null };
  const start = (x = 100, y = 100, from = target) => listeners.get('touchstart')({ touches: [{ clientX: x, clientY: y }], target: from });
  const move = (x, y) => {
    let prevented = false;
    listeners.get('touchmove')({ touches: [{ clientX: x, clientY: y }], preventDefault: () => { prevented = true; } });
    return prevented;
  };
  const end = () => listeners.get('touchend')();
  return {
    start, move, end, classes, properties, state, elements, window,
    get refreshes() { return refreshes; },
    set dialogOpen(value) { dialogOpen = value; },
    deferWeather: () => { waitForWeather = true; },
    resolveWeather: () => resolveWeather(),
    finishResult: () => { for (const callback of timers.values()) callback(); timers.clear(); },
    tick: time => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time)); },
    cancel: () => listeners.get('touchcancel')(),
  };
}

test('only a deliberate downward pull at page top refreshes weather once', async () => {
  const f = fixture();
  f.start();
  assert.equal(f.move(100, 145), true);
  assert.equal(f.elements.pullRefreshText.textContent, 'Keep pulling');
  assert.equal(f.properties.get('--pull-distance'), '40.3px');
  assert.equal(f.classes.has('pull-mid'), false);
  assert.equal(f.classes.has('pull-ready'), false);
  await f.end();
  assert.equal(f.refreshes, 0);
  assert.equal(f.properties.has('--pull-distance'), false);
  f.start();
  f.move(100, 200);
  assert.equal(f.elements.pullRefreshText.textContent, 'Release to re-check');
  assert.equal(f.classes.has('pull-ready'), true);
  await f.end();
  assert.equal(f.refreshes, 1);
  assert.equal(f.classes.has('pull-active'), false);
  assert.equal(f.properties.get('--pull-distance'), '76px');
  assert.equal(f.properties.get('--pull-follow-distance'), '24px');
  assert.equal(f.elements.pullRefreshText.textContent, 'Weather updated');
  f.finishResult();
  assert.equal(f.classes.has('pull-result'), false);
  assert.equal(f.properties.has('--pull-distance'), false);
});

test('pull ignores scrolling, open sheets, active requests, and controls', async () => {
  const f = fixture();
  f.window.scrollY = 12; f.start(); f.move(100, 200); await f.end();
  f.window.scrollY = 0; f.dialogOpen = true; f.start(); f.move(100, 200); await f.end();
  f.dialogOpen = false; f.state.weatherRequestPending = true; f.start(); f.move(100, 200); await f.end();
  f.state.weatherRequestPending = false;
  f.start(100, 100, { closest: () => ({}) }); f.move(100, 200); await f.end();
  f.start(); f.move(200, 120); await f.end();
  assert.equal(f.refreshes, 0);
});

test('refresh threshold exposes the full cue at narrow and desktop card heights', async () => {
  for (const verdictHeight of [364, 397, 416]) {
    const f = fixture({ verdictHeight });
    f.start(); f.move(100, 200);
    assert.equal(f.classes.has('pull-ready'), true);
    assert.ok(parseFloat(f.properties.get('--pull-distance')) >= f.elements.pullRefresh.offsetHeight);
    f.cancel();
  }
});

test('failed weather update shows a brief failure state without a page reload', async () => {
  const f = fixture();
  f.state.weatherLoadFailed = true;
  f.start(); f.move(100, 200); await f.end();
  assert.equal(f.refreshes, 1);
  assert.equal(f.elements.pullRefreshText.textContent, 'Weather update failed');
  assert.equal(f.classes.has('pull-result'), true);
  assert.equal(f.classes.has('pull-failed'), true);
});

test('verdict remains pulled out while weather is pending and ignores repeated pulls', async () => {
  const f = fixture();
  f.deferWeather();
  f.start(); f.move(100, 200);
  const completion = f.end();
  assert.equal(f.classes.has('pull-refreshing'), true);
  assert.equal(f.properties.get('--pull-distance'), '76px');
  f.start(); f.move(100, 200); await f.end();
  assert.equal(f.refreshes, 1);
  f.resolveWeather();
  await completion;
  assert.equal(f.classes.has('pull-result'), true);
  assert.equal(f.properties.get('--pull-distance'), '76px');
  f.finishResult();
  assert.equal(f.properties.has('--pull-distance'), false);
});

test('pulls resist from the start, approach half the verdict height, and move followers past the footer', async () => {
  const f = fixture();
  f.start();
  f.move(100, 145);
  assert.equal(f.properties.get('--pull-follow-distance'), '0px');
  f.move(100, 165);
  assert.equal(f.properties.get('--pull-distance'), '55.49px');
  assert.equal(f.properties.get('--pull-follow-distance'), '3.49px');
  f.move(100, 500);
  assert.equal(f.properties.get('--pull-distance'), '172.93px');
  assert.equal(f.properties.get('--pull-follow-distance'), '120.93px');
  f.move(100, 1000);
  assert.ok(parseFloat(f.properties.get('--pull-distance')) < 200);
  assert.ok(parseFloat(f.properties.get('--pull-distance')) > 172.93);
  await f.end();
  assert.equal(f.properties.get('--pull-distance'), '76px');
  assert.equal(f.properties.get('--pull-follow-distance'), '24px');
});

test('wrapped footer delays follower movement until the verdict passes its border', async () => {
  const f = fixture({ footerHeight: 96 });
  f.start();
  f.move(100, 200);
  assert.equal(f.properties.get('--pull-distance'), '78.69px');
  assert.equal(f.properties.get('--pull-follow-distance'), '0px');
  f.move(100, 230);
  assert.equal(f.properties.get('--pull-follow-distance'), '11.59px');
  f.cancel();
  assert.equal(f.properties.has('--pull-follow-distance'), false);
});

test('a footer height change during refresh keeps following cards below its border', async () => {
  const f = fixture();
  f.deferWeather();
  f.start(); f.move(100, 200);
  const completion = f.end();
  assert.equal(f.properties.get('--pull-follow-distance'), '24px');
  f.elements.forecastPanel.offsetHeight = 96;
  f.resolveWeather();
  await completion;
  assert.equal(f.properties.get('--pull-distance'), '76px');
  assert.equal(f.properties.get('--pull-follow-distance'), '0px');
});

test('spring updates verdict and following cards from the same distance', async () => {
  const f = fixture({ reducedMotion: false });
  f.start(); f.move(100, 300);
  await f.end();
  for (const time of [0, 100, 200, 300, 400, 450]) {
    f.tick(time);
    const verdict = parseFloat(f.properties.get('--pull-distance'));
    const followers = parseFloat(f.properties.get('--pull-follow-distance'));
    assert.ok(Math.abs(followers - Math.max(0, verdict - 52)) <= 0.02);
  }
  f.finishResult();
  assert.equal(f.classes.has('pull-result'), true);
  for (const time of [500, 600, 700, 800, 900]) {
    f.tick(time);
    assert.equal(f.classes.has('pull-result'), true);
  }
  f.tick(950);
  assert.equal(f.classes.has('pull-result'), false);
  assert.equal(f.properties.has('--pull-distance'), false);
  assert.equal(f.properties.has('--pull-follow-distance'), false);
  assert.equal(f.elements.pullRefreshText.textContent, 'Keep pulling');
});

test('failure icon stays through the return and resets before the next pull', async () => {
  const f = fixture({ reducedMotion: false });
  f.state.weatherLoadFailed = true;
  f.start(); f.move(100, 220);
  await f.end();
  f.finishResult();
  assert.equal(f.classes.has('pull-result'), true);
  assert.equal(f.classes.has('pull-failed'), true);
  for (const time of [0, 150, 300]) {
    f.tick(time);
    assert.equal(f.classes.has('pull-result'), true);
    assert.equal(f.classes.has('pull-failed'), true);
  }
  f.tick(450);
  assert.equal(f.classes.has('pull-result'), false);
  assert.equal(f.classes.has('pull-failed'), false);
  f.start(); f.move(100, 120);
  assert.equal(f.classes.has('pull-active'), true);
  assert.equal(f.classes.has('pull-mid'), false);
  assert.equal(f.classes.has('pull-ready'), false);
  f.cancel();
});

test('interrupted pulls retract without refreshing', async () => {
  const f = fixture();
  f.start(); f.move(100, 170);
  f.move(200, 175);
  await f.end();
  assert.equal(f.refreshes, 0);
  assert.equal(f.classes.has('pull-active'), false);
  assert.equal(f.properties.has('--pull-distance'), false);
});
