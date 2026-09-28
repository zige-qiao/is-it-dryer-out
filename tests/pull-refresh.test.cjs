const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const gestureSource = source.slice(source.indexOf('function bindPullToRefresh()'), source.indexOf('function bindTypedValue('));

function fixture() {
  const listeners = new Map();
  const classes = new Set();
  const properties = new Map();
  const body = {
    classList: {
      add: name => classes.add(name),
      remove: name => classes.delete(name),
      contains: name => classes.has(name),
    },
    style: {
      setProperty: (name, value) => properties.set(name, value),
      removeProperty: name => properties.delete(name),
    },
  };
  const state = { weatherRequestPending: false, weatherLoadFailed: false };
  const elements = { pullRefreshText: { textContent: '' } };
  let refreshes = 0;
  let dialogOpen = false;
  const document = {
    body,
    addEventListener: (name, listener) => listeners.set(name, listener),
    querySelector: () => dialogOpen ? {} : null,
    hidden: false,
  };
  const window = { scrollY: 0 };
  const context = vm.createContext({ document, window, state, elements, setTimeout: () => 1, clearTimeout: () => {}, fetchWeather: async () => { refreshes++; } });
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
  return { start, move, end, classes, properties, state, elements, get refreshes() { return refreshes; }, set dialogOpen(value) { dialogOpen = value; }, window };
}

test('only a deliberate downward pull at page top refreshes weather once', async () => {
  const f = fixture();
  f.start();
  assert.equal(f.move(100, 145), true);
  assert.equal(f.elements.pullRefreshText.textContent, 'Pull to update weather');
  await f.end();
  assert.equal(f.refreshes, 0);
  f.start();
  f.move(100, 190);
  assert.equal(f.elements.pullRefreshText.textContent, 'Release to update weather');
  await f.end();
  assert.equal(f.refreshes, 1);
  assert.equal(f.classes.has('pull-active'), false);
  assert.equal(f.elements.pullRefreshText.textContent, 'Weather updated');
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

test('failed weather update shows a brief failure state without a page reload', async () => {
  const f = fixture();
  f.state.weatherLoadFailed = true;
  f.start(); f.move(100, 200); await f.end();
  assert.equal(f.refreshes, 1);
  assert.equal(f.elements.pullRefreshText.textContent, 'Weather update failed');
  assert.equal(f.classes.has('pull-result'), true);
});
