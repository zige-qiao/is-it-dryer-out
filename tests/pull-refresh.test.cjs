const { test } = require('node:test');
const assert = require('node:assert/strict');
const { environment } = require('./helpers/browser.cjs');
const { createPullRefresh } = require('../src/ui/pull-refresh.js');

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
  let dialogOpen = false; let popupOpen = false; let overlayChanged;
  let onOverview = true;
  const document = {
    body,
    addEventListener: (name, listener) => listeners.set(name, listener),
    querySelector: () => dialogOpen || popupOpen ? {} : null,
    hidden: false,
  };
  const window = { scrollY: 0, matchMedia: () => ({ matches: reducedMotion }) };
  const context = environment({
    document, window, state, elements,
    MutationObserver: class { constructor(fn) { overlayChanged = fn; } observe() {} },
    setTimeout: callback => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame: callback => { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    fetchWeather: async () => {
      refreshes++;
      if (waitForWeather) await new Promise(resolve => { resolveWeather = resolve; });
    },
    isOverview: () => onOverview,
  });
  Object.assign(context, createPullRefresh(context, context));
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
    set dialogOpen(value) { dialogOpen = value; overlayChanged(); },
    set popupOpen(value) { popupOpen = value; overlayChanged(); },
    set onOverview(value) { onOverview = value; listeners.get('viewchange')(); },
    click: event => listeners.get('click')(event),
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

test('pull ignores scrolling, open sheets, active requests, and text editing', async () => {
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

for (const overlay of ['dialogOpen', 'popupOpen']) {
  test(`${overlay} blocks starts and cancels a recognised pull before release`, async () => {
    const f = fixture(); f[overlay] = true;
    f.start(); f.move(100,300); await f.end(); assert.equal(f.refreshes,0);
    f[overlay] = false; f.start(); f.move(100,300); f[overlay] = true;
    assert.equal(f.properties.has('--pull-distance'),false);
    f[overlay] = false; await f.end(); assert.equal(f.refreshes,0);
    f.start(); f.move(100,300); await f.end(); assert.equal(f.refreshes,1);
  });
  test(`${overlay} during a pending request clears visuals and never restores feedback`, async () => {
    const f=fixture(); f.deferWeather(); f.start(); f.move(100,300); const pending=f.end();
    f[overlay]=true; assert.equal(f.classes.has('pull-refreshing'),false);
    assert.equal(f.properties.has('--pull-distance'),false);
    f[overlay]=false; f.resolveWeather(); await pending;
    assert.equal(f.classes.has('pull-result'),false); assert.equal(f.refreshes,1);
  });
}
test('pulls on interactive surfaces suppress only the resulting pointer click', async () => {
  const f=fixture(); const control={closest:()=>null};
  f.start(100,100,control); await f.end();
  let blocked=false; const click={detail:1,preventDefault(){blocked=true},stopImmediatePropagation(){}};
  f.click(click); assert.equal(blocked,false);
  f.start(100,100,control); f.move(100,130); await f.end();
  f.click(click); assert.equal(blocked,true);
  blocked=false; f.start(100,100,control); await f.end(); f.click(click); assert.equal(blocked,false);
});

test('returning a ready pull to its origin never refreshes', async () => {
  const f=fixture(); f.start(); f.move(100,300); f.move(100,100); await f.end();
  assert.equal(f.refreshes,0); assert.equal(f.properties.has('--pull-distance'),false);
});
test('fractional rendered footer geometry keeps follower clearance exact', () => {
  const f=fixture();
  f.elements.verdictPanel.getBoundingClientRect=()=>({bottom:400.3125+(parseFloat(f.properties.get('--pull-distance'))||0)});
  f.elements.forecastPanel.getBoundingClientRect=()=>({bottom:452.125+(parseFloat(f.properties.get('--pull-follow-distance'))||0)});
  f.start(); f.move(100,300);
  const distance=parseFloat(f.properties.get('--pull-distance')), follow=parseFloat(f.properties.get('--pull-follow-distance'));
  assert.ok(Math.abs(distance-follow-51.8125)<.01);
  f.cancel();
});


test('Why and the fixed tab bar cannot start refresh; leaving Overview clears an active pull', () => {
  const f = fixture();
  f.onOverview = false; f.start(); f.move(100, 250); f.end();
  assert.equal(f.refreshes, 0);
  f.onOverview = true;
  f.start(100, 100, { closest: selector => selector === 'nav' ? {} : null });
  f.move(100, 250); f.end(); assert.equal(f.refreshes, 0);
  f.start(); f.move(100, 250); assert.equal(f.classes.has('pull-active'), true);
  f.onOverview = false; f.end();
  assert.equal(f.refreshes, 0); assert.equal(f.properties.size, 0);
});


test('horizontal swipes and taps never measure or paint pull-to-refresh geometry', async () => {
  for (const kind of ['horizontal', 'tap', 'vertical-scroll', 'short-downward', 'cancel', 'overlay']) {
    const f = fixture();
    let geometryReads = 0, styleWrites = 0, marked = false;
    f.elements.verdictPanel.getBoundingClientRect = () => { geometryReads++; return { bottom: 400 }; };
    f.elements.forecastPanel.getBoundingClientRect = () => { geometryReads++; return { bottom: 452 }; };
    Object.defineProperty(f.elements.verdictPanel, 'offsetHeight', {get(){geometryReads++; return 400;}});
    Object.defineProperty(f.elements.pullRefresh, 'offsetHeight', {get(){geometryReads++; return 76;}});
    const follower = { dataset: {} }, recommendation = {};
    recommendation.parentElement = { children: [recommendation, follower] };
    f.elements.verdictPanel.closest = () => { marked = true; return recommendation; };
    const setProperty = f.properties.set.bind(f.properties);
    f.properties.set = (...args) => { styleWrites++; return setProperty(...args); };
    f.start();
    if (kind === 'horizontal') f.move(20, 103);
    if (kind === 'vertical-scroll') { f.window.scrollY = 20; f.move(100, 140); }
    if (kind === 'short-downward') f.move(100, 108);
    if (kind === 'cancel') f.cancel();
    if (kind === 'overlay') f.dialogOpen = true;
    await f.end();
    assert.equal(geometryReads, 0, `${kind} must not measure a pull that never starts`);
    assert.equal(styleWrites, 0, `${kind} must not paint zero-distance transforms`);
    assert.equal(marked, false, `${kind} must not change follower styles`);
    assert.equal(f.refreshes, 0);
  }
});

test('downward intent prepares pull geometry using the current card size', async () => {
  const f = fixture();
  let measured = false;
  f.elements.verdictPanel.getBoundingClientRect = () => { measured = true; return { bottom: 400 }; };
  f.elements.forecastPanel.getBoundingClientRect = () => ({ bottom: 452 });
  f.start(); assert.equal(measured, false);
  // Weather or text layout can change between touch-down and recognised intent.
  f.elements.verdictPanel.offsetHeight = 600;
  f.move(100, 220);
  assert.equal(measured, true);
  assert.ok(Math.abs(parseFloat(f.properties.get('--pull-distance')) - 300 * (1 - Math.exp(-120 / 300))) < .01);
  await f.end(); assert.equal(f.refreshes, 1);
});
