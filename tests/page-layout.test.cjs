const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PAGE_BOXES, normalizePageOrder, pageLayoutDefaults, createPageLayout } = require('../src/ui/page-layout.js');
const { createStorage } = require('../src/services/storage.js');
const { UI_PREFERENCES_STORAGE_KEY } = require('../src/config.js');
const { element, memoryStorage, environment } = require('./helpers/browser.cjs');

test('page order repairs partial, duplicate and unknown data in default order', () => {
  const defaults = PAGE_BOXES.map(box => box.id);
  for (const invalid of [null, undefined, {}, 'indoor-summary', 2, []]) assert.deepEqual(normalizePageOrder(invalid), defaults);
  assert.deepEqual(normalizePageOrder(['supporting-details', 'unknown', 'supporting-details', null, 'recommendation']),
    ['supporting-details', 'recommendation', 'indoor-summary', 'moisture-comparison']);
});

test('layout preferences migrate missing fields and preserve explicit booleans', () => {
  const localStorage = memoryStorage();
  for (const summary of [false, true, null, 'false', undefined]) {
    localStorage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify({ showIndoorSummary: summary, showMoistureComparison: true,
      pageOrder: ['supporting-details', 'supporting-details'], showRecommendation: 'false' }));
    const preferences = {};
    createStorage({ uiPreferences: preferences, applyUiPreferences() {} }, environment({ localStorage })).loadUiPreferences();
    assert.equal(preferences.showIndoorSummary, typeof summary === 'boolean' ? summary : false);
    assert.equal(preferences.showMoistureComparison, true); assert.equal(preferences.showRecommendation, true);
    assert.deepEqual(preferences.pageOrder, ['supporting-details', 'indoor-summary', 'recommendation', 'moisture-comparison']);
  }
});

function fixture(blocked = false) {
  const preferences = { ...pageLayoutDefaults(), showCameraButton: false, openIndoorOnLaunch: false };
  const shell = element(), footer = element(), list = element(), dialog = element(), status = element(), fallback = element(), reset = element();
  const menu = element(), up = element(), down = element(), window = element();
  up.dataset.move = 'up'; down.dataset.move = 'down'; menu.insertBefore(up, null); menu.insertBefore(down, null);
  menu.querySelectorAll = () => [up, down]; menu.hidden = true;
  menu.contains = target => target === menu || target === up || target === down;
  menu.getBoundingClientRect = () => ({ width: 192, height: 96 });
  const rows = new Map(), boxes = new Map(), frames = new Map(); let frameId = 0, saves = 0, focused;
  for (const [index, box] of PAGE_BOXES.entries()) {
    const row = element(), input = element(), handle = element();
    const captured = new Set();
    for (const item of [row, input, handle]) item.focus = () => { focused = item; document.activeElement = item; };
    handle.contains = target => target === handle;
    handle.getBoundingClientRect = () => ({ left: 16, top: list.children.indexOf(row) * 100, bottom: list.children.indexOf(row) * 100 + 44 });
    handle.setPointerCapture = id => captured.add(id); handle.hasPointerCapture = id => captured.has(id); handle.releasePointerCapture = id => captured.delete(id);
    row.querySelector = selector => ({ 'input': input, '[data-drag-handle]': handle })[selector];
    row.getBoundingClientRect = () => ({ top: list.children.indexOf(row) * 100, height: 100 });
    row.controls = { input, handle }; rows.set(box.id, row); boxes.set(box.id, element());
    list.insertBefore(row, null); shell.insertBefore(boxes.get(box.id), null);
  }
  shell.insertBefore(footer, null);
  shell.querySelector = selector => boxes.get(selector.match(/"([^"]+)"/)[1]);
  list.querySelector = selector => rows.get(selector.match(/"([^"]+)"/)[1]);
  list.getBoundingClientRect = () => ({ top: 0, bottom: 400 }); dialog.getBoundingClientRect = () => ({ top: 0, bottom: 300, left: 0, right: 320 }); dialog.scrollTop = 0;
  const document = element(); document.documentElement = element(); document.visibilityState = 'visible';
  const nodes = { '.app-shell': shell, '.project-credit-row': footer, '#pageLayoutList': list, '#settingsDialog': dialog,
    '#pageLayoutStatus': status, '#settingsEditIndoor': fallback, '#resetPageLayout': reset, '#pageLayoutMenu': menu };
  for (const action of [up, down]) action.focus = () => { focused = action; document.activeElement = action; };
  document.querySelector = selector => nodes[selector];
  const localStorage = blocked ? { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } } : memoryStorage();
  const storage = createStorage({ uiPreferences: preferences, applyUiPreferences() {} }, environment({ localStorage }));
  const controller = createPageLayout({ preferences, save() { saves++; storage.saveUiPreferences(); } }, {
    document, window, requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; }, cancelAnimationFrame(id) { frames.delete(id); },
  });
  controller.apply(); controller.bind();
  return { preferences, shell, footer, list, rows, boxes, dialog, status, fallback, reset, document, frames, localStorage, menu, up, down, window,
    get saves() { return saves; }, get focused() { return focused; } };
}

test('keyboard moves preserve nodes, focus, hidden visibility and footer position', () => {
  const f = fixture(), row = f.rows.get('indoor-summary');
  row.controls.handle.emit('click');
  assert.equal(f.up.disabled, true); assert.equal(f.focused, f.down); assert.equal(f.menu.hidden, false);
  f.down.emit('click');
  assert.deepEqual(f.preferences.pageOrder, ['recommendation', 'indoor-summary', 'moisture-comparison', 'supporting-details']);
  assert.equal(f.focused, row.controls.handle); assert.match(f.status.textContent, /position 2 of 4/);
  assert.equal(f.boxes.get('indoor-summary').hidden, true); assert.equal(f.menu.hidden, true);
  assert.deepEqual(f.shell.children, [...f.preferences.pageOrder.map(id => f.boxes.get(id)), f.footer]);
  row.controls.handle.emit('click'); f.up.emit('click');
  row.controls.handle.emit('click'); assert.equal(f.up.disabled, true); assert.equal(f.focused, f.down);
  assert.equal(f.saves, 2);
});

test('visibility, reset and all-hidden fallback work with blocked storage', () => {
  const f = fixture(true);
  for (const box of PAGE_BOXES) {
    const input = f.rows.get(box.id).controls.input; input.checked = false; input.emit('change', { target: input });
  }
  assert.equal(f.fallback.hidden, false); assert.ok([...f.boxes.values()].every(box => box.hidden)); assert.equal(f.footer.hidden, false);
  f.rows.get('supporting-details').controls.handle.emit('click'); f.up.emit('click'); assert.equal(f.preferences.pageOrder[2], 'supporting-details');
  f.reset.emit('click');
  for (const [key, value] of Object.entries(pageLayoutDefaults())) assert.deepEqual(f.preferences[key], value);
  assert.equal(f.preferences.showCameraButton, false); assert.equal(f.preferences.openIndoorOnLaunch, false); assert.equal(f.fallback.hidden, true);
});

test('pointer dragging defers commits, supports edge scrolling and restores order on Escape or cancellation', () => {
  for (const cancel of ['escape', 'pointercancel', 'lostpointercapture', 'close', 'drop']) {
    const f = fixture(), handle = f.rows.get('recommendation').controls.handle;
    const pointer = { button: 0, pointerId: 1, clientY: 20, preventDefault() {}, stopPropagation() {} };
    handle.emit('pointerdown', pointer); handle.emit('pointermove', { ...pointer, clientY: 390 });
    assert.deepEqual(f.preferences.pageOrder, normalizePageOrder()); assert.equal(f.saves, 0);
    [...f.frames.values()][0](); assert.ok(f.dialog.scrollTop > 0);
    assert.equal(f.rows.get('supporting-details').dataset.insert, 'after');
    if (cancel === 'escape') f.document.emit('keydown', { key: 'Escape', preventDefault() {}, stopImmediatePropagation() {} });
    else if (cancel === 'close') f.dialog.emit('close');
    else handle.emit(cancel === 'drop' ? 'pointerup' : cancel, pointer);
    assert.deepEqual(f.preferences.pageOrder, cancel === 'drop'
      ? ['indoor-summary', 'moisture-comparison', 'supporting-details', 'recommendation'] : normalizePageOrder());
    assert.equal(f.saves, cancel === 'drop' ? 1 : 0); assert.equal(handle.hasPointerCapture(1), false);
    assert.ok([...f.rows.values()].every(row => !row.dataset.insert));
  }
});

test('new defaults hide the first Indoor box, show comparison, and retain saved layouts', () => {
  assert.deepEqual(pageLayoutDefaults(), { pageOrder: ['indoor-summary', 'recommendation', 'moisture-comparison', 'supporting-details'],
    showIndoorSummary: false, showRecommendation: true, showMoistureComparison: true, showSupportingDetails: true });
  const localStorage = memoryStorage(), saved = { pageOrder: ['supporting-details', 'moisture-comparison', 'recommendation', 'indoor-summary'],
    showIndoorSummary: true, showRecommendation: false, showMoistureComparison: false, showSupportingDetails: true };
  localStorage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify(saved));
  const preferences = {};
  createStorage({ uiPreferences: preferences, applyUiPreferences() {} }, environment({ localStorage })).loadUiPreferences();
  assert.deepEqual(preferences, saved);
});

test('a tap or sub-threshold movement opens the menu without saving or dragging', () => {
  const f = fixture(), handle = f.rows.get('indoor-summary').controls.handle;
  const pointer = { button: 0, pointerId: 2, clientX: 10, clientY: 10, stopPropagation() {}, preventDefault() {} };
  handle.emit('pointerdown', pointer); handle.emit('pointermove', { ...pointer, clientX: 14, clientY: 15 });
  assert.equal(f.frames.size, 0); assert.equal(f.saves, 0);
  handle.emit('pointerup', pointer); handle.emit('click');
  assert.equal(f.menu.hidden, false); assert.equal(f.saves, 0); assert.equal(handle.getAttribute('aria-expanded'), 'true');
});

test('a completed or cancelled drag suppresses its pointer click but accepts later keyboard activation', () => {
  for (const cancelled of [true, false]) {
    const f = fixture(), handle = f.rows.get('indoor-summary').controls.handle;
    const pointer = { button: 0, pointerId: 3, clientX: 10, clientY: 10, stopPropagation() {}, preventDefault() {} };
    handle.emit('pointerdown', pointer); handle.emit('pointermove', { ...pointer, clientY: 18 });
    assert.equal(f.frames.size, 1);
    handle.emit(cancelled ? 'pointercancel' : 'pointerup', pointer);
    handle.emit('click', { preventDefault() {} }); assert.equal(f.menu.hidden, true);
    handle.emit('keydown', { key: 'Enter' }); handle.emit('click'); assert.equal(f.menu.hidden, false);
  }
});

test('menu navigation, Escape and Tab retain useful focus and do not close Settings', () => {
  const f = fixture(), handle = f.rows.get('recommendation').controls.handle;
  handle.emit('click'); assert.equal(f.focused, f.up);
  for (const [key, expected] of [['ArrowDown', f.down], ['ArrowDown', f.up], ['End', f.down], ['Home', f.up]]) {
    f.menu.emit('keydown', { key, preventDefault() {} }); assert.equal(f.focused, expected);
  }
  let stopped = false;
  f.document.emit('keydown', { key: 'Escape', preventDefault() {}, stopImmediatePropagation() { stopped = true; } });
  assert.equal(stopped, true); assert.equal(f.menu.hidden, true); assert.equal(f.focused, handle); assert.equal(f.saves, 0);
  handle.emit('click'); f.menu.emit('keydown', { key: 'Tab', preventDefault() {} });
  assert.equal(f.focused, f.rows.get('recommendation').controls.input); assert.equal(f.menu.hidden, true);
  handle.emit('click'); f.menu.emit('keydown', { key: 'Tab', shiftKey: true, preventDefault() {} }); assert.equal(f.focused, handle);
});

test('menu dismissal respects outside focus and restores hidden focus on scrolling', () => {
  for (const reason of ['outside', 'focus', 'scroll', 'resize', 'close', 'reset', 'background']) {
    const f = fixture(), handle = f.rows.get('supporting-details').controls.handle;
    handle.emit('click'); assert.equal(f.down.disabled, true); assert.equal(f.focused, f.up);
    if (reason === 'outside') f.document.emit('pointerdown', { target: f.reset });
    if (reason === 'focus') { f.reset.focus(); f.document.emit('focusin', { target: f.reset }); }
    if (reason === 'scroll') f.dialog.emit('scroll');
    if (reason === 'resize') f.window.emit('resize');
    if (reason === 'close') f.dialog.emit('close');
    if (reason === 'reset') f.reset.emit('click');
    if (reason === 'background') { f.document.visibilityState = 'hidden'; f.document.emit('visibilitychange'); }
    assert.equal(f.menu.hidden, true); assert.equal(handle.getAttribute('aria-expanded'), 'false');
    if (['scroll', 'resize'].includes(reason)) assert.equal(f.focused, handle);
    assert.equal(f.saves, reason === 'reset' ? 1 : 0);
  }
});
