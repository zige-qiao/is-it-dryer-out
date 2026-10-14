const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createThemeController, normalizeThemePreference, resolveTheme } = require('../src/ui/theme.js');
const { UI_PREFERENCES_STORAGE_KEY } = require('../src/config.js');
const { element } = require('./helpers/browser.cjs');

function setup(theme = 'system', dark = false, legacy = false) {
  const root = element(), controls = ['system', 'light', 'dark'].map(value => Object.assign(element(), { value }));
  const document = Object.assign(element(), { documentElement: root, visibilityState: 'visible' });
  const window = element(), media = Object.assign(element(), { matches: dark });
  if (legacy) {
    media.addEventListener = undefined;
    media.addListener = callback => { media.listener = callback; };
  }
  window.matchMedia = query => { assert.equal(query, '(prefers-color-scheme: dark)'); return media; };
  let saved = 0;
  const properties = new Map();
  root.style.setProperty = (key, value) => properties.set(key, value);
  const preferences = { theme };
  const controller = createThemeController({ preferences, controls, save() { saved++; } }, { document, window });
  return { controller, root, controls, document, window, media, preferences, properties, get saved() { return saved; } };
}

test('appearance defaults to System and resolves device appearance only for System', () => {
  for (const invalid of [undefined, null, '', 'auto', 'DARK', 1, {}, []]) {
    assert.equal(normalizeThemePreference(invalid), 'system');
    assert.equal(resolveTheme(invalid, true), 'dark');
    assert.equal(resolveTheme(invalid, false), 'light');
  }
  for (const preference of ['system', 'light', 'dark']) for (const dark of [false, true]) {
    const fixture = setup(preference, dark);
    fixture.controller.apply();
    const resolved = preference === 'system' ? (dark ? 'dark' : 'light') : preference;
    assert.equal(fixture.root.dataset.theme, resolved);
    assert.equal(fixture.properties.get('color-scheme'), resolved);
    assert.deepEqual(fixture.controls.map(control => control.checked), ['system', 'light', 'dark'].map(value => value === preference));
    assert.equal(fixture.saved, 0);
  }
});

test('live device changes respect overrides and do not persist resolved System values', () => {
  const fixture = setup();
  fixture.controller.apply(); fixture.controller.bind();
  fixture.media.matches = true; fixture.media.emit('change');
  assert.equal(fixture.root.dataset.theme, 'dark'); assert.equal(fixture.preferences.theme, 'system');
  fixture.preferences.theme = 'light'; fixture.controller.apply();
  fixture.media.matches = false; fixture.media.emit('change');
  fixture.media.matches = true; fixture.media.emit('change');
  assert.equal(fixture.root.dataset.theme, 'light');
  fixture.preferences.theme = 'dark'; fixture.controller.apply();
  fixture.media.matches = false; fixture.media.emit('change');
  assert.equal(fixture.root.dataset.theme, 'dark'); assert.equal(fixture.saved, 0);
});

test('native radio changes save immediately once and returning to System uses current device appearance', () => {
  const fixture = setup('system', true);
  fixture.controller.apply(); fixture.controller.bind(); fixture.controller.bind();
  fixture.controls[1].checked = true; fixture.controls[1].emit('change');
  assert.equal(fixture.preferences.theme, 'light'); assert.equal(fixture.root.dataset.theme, 'light');
  fixture.controls[0].checked = true; fixture.controls[0].emit('change');
  assert.equal(fixture.preferences.theme, 'system'); assert.equal(fixture.root.dataset.theme, 'dark');
  fixture.controls[1].emit('change');
  assert.equal(fixture.saved, 2); assert.equal(fixture.preferences.theme, 'system');
});

test('foreground and restored-page checks recover missed device changes without saving', () => {
  const fixture = setup(); fixture.controller.apply(); fixture.controller.bind();
  fixture.media.matches = true; fixture.document.visibilityState = 'hidden'; fixture.document.emit('visibilitychange');
  assert.equal(fixture.root.dataset.theme, 'light');
  fixture.document.visibilityState = 'visible'; fixture.document.emit('visibilitychange');
  assert.equal(fixture.root.dataset.theme, 'dark');
  fixture.media.matches = false; fixture.window.emit('pageshow');
  assert.equal(fixture.root.dataset.theme, 'light');
  fixture.preferences.theme = 'dark'; fixture.controller.apply(); fixture.window.emit('pageshow');
  assert.equal(fixture.root.dataset.theme, 'dark'); assert.equal(fixture.saved, 0);
});

test('older media-query listeners and missing device appearance API degrade safely', () => {
  const fixture = setup('system', false, true); fixture.controller.apply(); fixture.controller.bind();
  fixture.media.matches = true; fixture.media.listener(); assert.equal(fixture.root.dataset.theme, 'dark');
  const withoutMedia = setup(); withoutMedia.window.matchMedia = undefined;
  const controller = createThemeController({ preferences: withoutMedia.preferences, controls: withoutMedia.controls }, { document: withoutMedia.document, window: withoutMedia.window });
  assert.doesNotThrow(() => { controller.apply(); controller.bind(); });
  assert.equal(withoutMedia.root.dataset.theme, 'light');
});

test('the head bootstrap resolves saved appearance before CSS, including invalid or blocked storage', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(script); assert.ok(script.index < html.indexOf('<link rel="stylesheet"'));
  for (const dark of [false, true]) for (const saved of [null, '{}', 'null', 'bad json', '{"theme":true}', ...['system', 'light', 'dark'].map(theme => JSON.stringify({ theme }))]) {
    const root = element();
    let scheme;
    root.style.setProperty = (key, value) => { assert.equal(key, 'color-scheme'); scheme = value; };
    vm.runInNewContext(script[1], {
      document: { documentElement: root }, window: { matchMedia: () => ({ matches: dark }) },
      localStorage: { getItem(key) { assert.equal(key, UI_PREFERENCES_STORAGE_KEY); return saved; } },
    });
    let preference;
    try { preference = JSON.parse(saved)?.theme; } catch {}
    assert.equal(root.dataset.theme, resolveTheme(preference, dark)); assert.equal(scheme, root.dataset.theme);
    assert.equal(root.classList.contains('layout-pending'), true);
  }
  const root = element(), context = { document: { documentElement: root }, window: { matchMedia: () => ({ matches: true }) } };
  Object.defineProperty(context, 'localStorage', { get() { throw Error('SecurityError'); } });
  assert.doesNotThrow(() => vm.runInNewContext(script[1], context)); assert.equal(root.dataset.theme, 'dark');
});
