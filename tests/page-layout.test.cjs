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
    ['recommendation', 'supporting-details', 'indoor-summary', 'moisture-comparison']);
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
    assert.deepEqual(preferences.pageOrder, ['recommendation', 'supporting-details', 'indoor-summary', 'moisture-comparison']);
  }
});

function fixture(blocked = false, eligible = () => true) {
  const preferences = { ...pageLayoutDefaults(), showCameraButton: false, openIndoorOnLaunch: false };
  const shell = element(), footer = element(), list = element(), dialog = element(), status = element(), fallback = element(), reset = element();
  const menu = element(), up = element(), down = element(), window = element();
  up.dataset.move = 'up'; down.dataset.move = 'down'; menu.insertBefore(up, null); menu.insertBefore(down, null);
  menu.querySelectorAll = () => [up, down]; menu.hidden = true;
  menu.contains = target => target === menu || target === up || target === down;
  menu.getBoundingClientRect = () => ({ width: 192, height: 96 });
  const rows = new Map(), boxes = new Map(), frames = new Map(), timers = new Map(); let frameId = 0, saves = 0, focused, time = 0, timerId = 0;
  for (const [index, box] of PAGE_BOXES.entries()) {
    const row = element(), input = element(), handle = element();
    row.cloneNode = () => element(); row.style.removeProperty = name => { delete row.style[name]; };
    const captured = new Set();
    for (const item of [row, input, handle]) item.focus = () => { focused = item; document.activeElement = item; };
    handle.contains = target => target === handle;
    handle.getBoundingClientRect = () => ({ left: 16, top: list.children.indexOf(row) * 100, bottom: list.children.indexOf(row) * 100 + 44 });
    handle.setPointerCapture = id => captured.add(id); handle.hasPointerCapture = id => captured.has(id); handle.releasePointerCapture = id => captured.delete(id);
    row.querySelector = selector => ({ 'input': input, '[data-drag-handle]': handle })[selector];
    row.getBoundingClientRect = () => ({ top: list.children.indexOf(row) * 100 - scroller.scrollTop, height: 100, left: 16, width: 288 });
    row.controls = { input, handle }; rows.set(box.id, row); boxes.set(box.id, element());
    list.insertBefore(row, null); shell.insertBefore(boxes.get(box.id), null);
  }
  shell.insertBefore(footer, null);
  shell.querySelector = selector => boxes.get(selector.match(/"([^"]+)"/)[1]);
  list.querySelector = selector => rows.get(selector.match(/"([^"]+)"/)[1]);
  const scroller = element(); scroller.scrollTop = 0; scroller.getBoundingClientRect = () => ({ top: 80, bottom: 240, left: 0, width: 320, height: 160 }); dialog.querySelector = () => scroller;
  list.getBoundingClientRect = () => ({ top: 0, bottom: 400 }); dialog.getBoundingClientRect = () => ({ top: 0, bottom: 300, left: 0, right: 320 }); dialog.scrollTop = 0;
  const document = element(); document.documentElement = element(); document.visibilityState = 'visible';
  const nodes = { '.app-shell': shell, '.project-credit-row': footer, '#pageLayoutList': list, '#settingsDialog': dialog,
    '#pageLayoutStatus': status, '#settingsEditIndoor': fallback, '#resetPageLayout': reset, '#pageLayoutMenu': menu };
  for (const action of [up, down]) action.focus = () => { focused = action; document.activeElement = action; };
  document.querySelector = selector => nodes[selector];
  document.createElement = () => { const node = element(); node.remove = () => { dialog.children = dialog.children.filter(child => child !== node); }; return node; };
  const localStorage = blocked ? { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } } : memoryStorage();
  const storage = createStorage({ uiPreferences: preferences, applyUiPreferences() {} }, environment({ localStorage }));
  const controller = createPageLayout({ preferences, canStartPointerGesture: eligible, save() { saves++; storage.saveUiPreferences(); } }, {
    document, window, requestAnimationFrame(fn) { const id = ++frameId; frames.set(id, time => { frames.delete(id); fn(time); }); return id; }, cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(fn, delay) { timers.set(++timerId, { fn, due: time + delay }); return timerId; }, clearTimeout(id) { timers.delete(id); },
  });
  controller.apply(); controller.bind();
  return { preferences, shell, footer, list, rows, boxes, dialog, scroller, status, fallback, reset, document, frames, localStorage, menu, up, down, window,
    advance(ms) { time += ms; for (const [id, timer] of timers) if (timer.due <= time) { timers.delete(id); timer.fn(); } }, timers,
    get saves() { return saves; }, get focused() { return focused; } };
}

const touchPointer = { button: 0, pointerId: 1, pointerType: 'touch', isPrimary: true,
  clientX: 20, clientY: 120, stopPropagation() {}, preventDefault() {} };

test('fully visible movable rows never scroll, even beyond either list edge', () => {
  for (const y of [90, 120, 395, 430, 590]) {
    const f = fixture(), h = f.rows.get('indoor-summary').controls.handle;
    f.scroller.getBoundingClientRect = () => ({ top: 80, bottom: 500, left: 0, width: 320, height: 420 });
    h.emit('pointerdown', touchPointer); f.advance(300); h.emit('pointermove', { ...touchPointer, clientY: y });
    for (let time = 0; time <= 1000; time += 16) [...f.frames.values()].at(-1)?.(time);
    assert.equal(f.scroller.scrollTop, 0); h.emit('pointercancel', touchPointer);
  }
});

test('edge scrolling waits 200ms, caps speed, stops at the last row and resets after leaving', () => {
  const f = fixture(), h = f.rows.get('indoor-summary').controls.handle;
  const move = y => h.emit('pointermove', { ...touchPointer, clientY: y });
  const frame = time => [...f.frames.values()].at(-1)(time);
  h.emit('pointerdown', touchPointer); f.advance(300); move(230);
  frame(0); frame(199); assert.equal(f.scroller.scrollTop, 0);
  frame(216); assert.ok(f.scroller.scrollTop > 0 && f.scroller.scrollTop <= 160 * .016);
  const before = f.scroller.scrollTop; move(180); move(230); frame(232); frame(431);
  assert.equal(f.scroller.scrollTop, before, 'even leaving and re-entering between frames resets dwell');
  frame(448); assert.ok(f.scroller.scrollTop > before);
  for (let time = 464; time <= 3000; time += 16) frame(time);
  assert.ok(Math.abs(f.scroller.scrollTop - 176) < .51, 'stop when last row clears bottom fade');
  const stopped = f.scroller.scrollTop; frame(4000); assert.equal(f.scroller.scrollTop, stopped);
  move(90); frame(4016); frame(4215); assert.equal(f.scroller.scrollTop, stopped, 'reversal requires fresh dwell');
  frame(4232); assert.ok(f.scroller.scrollTop < stopped);
  for (let time = 4248; time <= 7000; time += 16) frame(time);
  assert.ok(Math.abs(f.scroller.scrollTop - 4) < .51, 'stop when first movable row clears top fade');
  h.emit('pointercancel', touchPointer); assert.equal(f.frames.size, 0);
});

test('drag destinations use measured heights and stable midpoints; cancellation preserves nodes and values', () => {
  const f = fixture(), h = f.rows.get('indoor-summary').controls.handle;
  let top = 0;
  for (const [id, row] of f.rows) {
    const height = id === 'moisture-comparison' ? 160 : 100, originalTop = top;
    row.getBoundingClientRect = () => ({ top: originalTop - f.scroller.scrollTop, left: 16, width: 288, height }); top += height;
  }
  const move = y => h.emit('pointermove', { ...touchPointer, clientY: y });
  h.emit('pointerdown', touchPointer); f.advance(300); move(260);
  const comparison = f.rows.get('moisture-comparison');
  assert.equal(comparison.style.transform, 'translateY(-100px)', 'crossing midpoint plus 8 opens a source-height gap');
  move(250); assert.equal(comparison.style.transform, 'translateY(-100px)', 'movement inside hysteresis retains destination');
  move(239); assert.equal(comparison.style.transform, 'translateY(0px)', 'crossing midpoint minus 8 returns destination');
  assert.equal(f.saves, 0); assert.deepEqual(f.preferences.pageOrder, normalizePageOrder());
  h.emit('pointercancel', touchPointer);
  assert.equal(f.saves, 0); assert.equal(f.dialog.children.length, 0);
  assert.ok([...f.rows.values()].every(row => row.style.transform === undefined));
});

test('touch taps keep the menu; holding arms at 300ms and needs 8px movement to drag', () => {
  const f = fixture(), h = f.rows.get('indoor-summary').controls.handle;
  h.emit('pointerdown', touchPointer); f.advance(299);
  assert.equal(h.classList.contains('is-reorder-ready'), false);
  h.emit('pointerup', touchPointer); h.emit('click'); assert.equal(f.menu.hidden, false);
  h.emit('click'); h.emit('pointerdown', touchPointer); f.advance(300);
  assert.equal(h.classList.contains('is-reorder-ready'), true);
  h.emit('pointermove', { ...touchPointer, clientY: 127 }); assert.equal(f.frames.size, 0);
  let prevented = false;
  h.emit('touchmove', { cancelable: true, preventDefault() { prevented = true; } }); assert.equal(prevented, true);
  h.emit('pointermove', { ...touchPointer, clientY: 128 }); assert.equal(f.frames.size, 1);
  h.emit('pointermove', { ...touchPointer, clientY: 398 });
  [...f.frames.values()][0](0); [...f.frames.values()].at(-1)(16); f.scroller.emit('scroll'); assert.equal(f.frames.size > 0, true);
  h.emit('pointerup', touchPointer); h.emit('click', { preventDefault() {} });
  assert.equal(f.saves, 1); assert.equal(f.preferences.pageOrder.at(-1), 'indoor-summary');
  assert.equal(f.menu.hidden, true); assert.equal(h.classList.contains('is-reorder-ready'), false);
});

test('early swipes in any direction cancel the hold permanently without blocking native scrolling', () => {
  for (const [dx, dy] of [[0, -8], [0, 8], [-8, 0], [8, 0], [6, 6]]) {
    const f = fixture(), h = f.rows.get('indoor-summary').controls.handle;
    h.emit('pointerdown', touchPointer); f.advance(299);
    h.emit('touchmove', { cancelable: true, preventDefault() { assert.fail('pending hold must allow native scrolling'); } });
    h.emit('pointermove', { ...touchPointer, clientX: 20 + dx, clientY: 120 + dy }); f.advance(500);
    h.emit('pointermove', { ...touchPointer, clientY: 398 }); h.emit('pointerup', touchPointer);
    h.emit('click', { preventDefault() {} });
    assert.equal(f.frames.size, 0); assert.equal(f.saves, 0); assert.equal(f.menu.hidden, true);
    assert.equal(f.timers.size, 0); assert.equal(h.hasPointerCapture(1), false);
    assert.equal(h.classList.contains('is-reorder-ready'), false);
  }
});

test('stationary holds suppress menus and cancelled holds clean timers, feedback and capture', () => {
  for (const armed of [false, true]) for (const reason of ['release', 'cancel', 'capture', 'scroll', 'resize', 'close', 'background', 'second', 'escape', 'uncancelable']) {
    const f = fixture(), h = f.rows.get('indoor-summary').controls.handle;
    h.emit('pointerdown', touchPointer); if (armed) f.advance(300);
    if (reason === 'release') h.emit('pointerup', touchPointer);
    if (reason === 'cancel' || reason === 'capture') h.emit(reason === 'cancel' ? 'pointercancel' : 'lostpointercapture', touchPointer);
    if (reason === 'scroll') f.scroller.emit('scroll');
    if (reason === 'resize') f.window.emit('resize');
    if (reason === 'close') f.dialog.emit('close');
    if (reason === 'background') { f.document.visibilityState = 'hidden'; f.document.emit('visibilitychange'); }
    if (reason === 'second') f.document.emit('pointerdown', { ...touchPointer, pointerId: 2, isPrimary: false });
    if (reason === 'escape') f.document.emit('keydown', { key: 'Escape', preventDefault() {}, stopImmediatePropagation() {} });
    if (reason === 'uncancelable') { h.emit('touchmove', { cancelable: false }); if (!armed) h.emit('pointercancel', touchPointer); }
    f.advance(500); h.emit('click', { preventDefault() {} });
    assert.equal(f.menu.hidden, reason === 'release' && !armed ? false : true, `${armed}/${reason}`);
    assert.equal(f.saves, 0); assert.equal(f.timers.size, 0); assert.equal(h.hasPointerCapture(1), false);
    assert.equal(h.classList.contains('is-reorder-ready'), false);
  }
});

test('momentum-ineligible touch cannot arm, drag or open the menu; keyboard remains available', () => {
  const f = fixture(false, () => false), h = f.rows.get('indoor-summary').controls.handle;
  h.emit('pointerdown', touchPointer); f.advance(500); h.emit('pointermove', { ...touchPointer, clientY: 398 });
  h.emit('pointerup', touchPointer); h.emit('click', { preventDefault() {} });
  assert.equal(f.timers.size, 0); assert.equal(f.frames.size, 0); assert.equal(f.saves, 0); assert.equal(f.menu.hidden, true);
  h.emit('keydown', { key: 'Enter' }); h.emit('click'); assert.equal(f.menu.hidden, false);
});

test('keyboard moves preserve nodes, focus, hidden visibility and footer position', () => {
  const f = fixture(), row = f.rows.get('indoor-summary');
  row.controls.handle.emit('click');
  assert.equal(f.up.disabled, true); assert.equal(f.focused, f.down); assert.equal(f.menu.hidden, false);
  f.down.emit('click');
  assert.deepEqual(f.preferences.pageOrder, ['recommendation', 'moisture-comparison', 'indoor-summary', 'supporting-details']);
  assert.equal(f.focused, row.controls.handle); assert.match(f.status.textContent, /position 3 of 4/);
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
  assert.equal(f.fallback.hidden, false); assert.ok([...f.boxes.entries()].every(([id, box]) => box.hidden === (id !== 'recommendation'))); assert.equal(f.footer.hidden, false);
  f.rows.get('supporting-details').controls.handle.emit('click'); f.up.emit('click'); assert.equal(f.preferences.pageOrder[2], 'supporting-details');
  f.reset.emit('click');
  for (const [key, value] of Object.entries(pageLayoutDefaults())) assert.deepEqual(f.preferences[key], value);
  assert.equal(f.preferences.showCameraButton, false); assert.equal(f.preferences.openIndoorOnLaunch, false); assert.equal(f.fallback.hidden, true);
});

test('pointer dragging defers commits, supports edge scrolling and restores order on Escape or cancellation', () => {
  for (const cancel of ['escape', 'pointercancel', 'lostpointercapture', 'close', 'drop']) {
    const f = fixture(), handle = f.rows.get('moisture-comparison').controls.handle;
    const pointer = { button: 0, pointerId: 1, clientY: 20, preventDefault() {}, stopPropagation() {} };
    handle.emit('pointerdown', pointer); handle.emit('pointermove', { ...pointer, clientY: 390 });
    assert.deepEqual(f.preferences.pageOrder, normalizePageOrder()); assert.equal(f.saves, 0);
    [...f.frames.values()][0](0); [...f.frames.values()].at(-1)(199); assert.equal(f.scroller.scrollTop, 0); [...f.frames.values()].at(-1)(216); assert.ok(f.scroller.scrollTop > 0); assert.equal(f.dialog.scrollTop, 0);
    assert.equal(f.rows.get('moisture-comparison').classList.contains('is-drag-source'), true);
    assert.equal(f.dialog.children.length, 1);
    if (cancel === 'escape') f.document.emit('keydown', { key: 'Escape', preventDefault() {}, stopImmediatePropagation() {} });
    else if (cancel === 'close') f.dialog.emit('close');
    else handle.emit(cancel === 'drop' ? 'pointerup' : cancel, pointer);
    assert.deepEqual(f.preferences.pageOrder, cancel === 'drop'
      ? ['recommendation', 'indoor-summary', 'supporting-details', 'moisture-comparison'] : normalizePageOrder());
    assert.equal(f.saves, cancel === 'drop' ? 1 : 0); assert.equal(handle.hasPointerCapture(1), false);
    assert.ok([...f.rows.values()].every(row => !row.classList.contains('is-drag-source'))); assert.equal(f.dialog.children.length, 0);
  }
});

test('new defaults hide the first Indoor box, show comparison, and retain saved layouts', () => {
  assert.deepEqual(pageLayoutDefaults(), { pageOrder: ['recommendation', 'indoor-summary', 'moisture-comparison', 'supporting-details'],
    showIndoorSummary: false, showRecommendation: true, showMoistureComparison: true, showSupportingDetails: true });
  const localStorage = memoryStorage(), saved = { pageOrder: ['supporting-details', 'moisture-comparison', 'recommendation', 'indoor-summary'],
    showIndoorSummary: true, showRecommendation: false, showMoistureComparison: false, showSupportingDetails: true };
  localStorage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify(saved));
  const preferences = {};
  createStorage({ uiPreferences: preferences, applyUiPreferences() {} }, environment({ localStorage })).loadUiPreferences();
  assert.deepEqual(preferences, { ...saved, showRecommendation: true, pageOrder: ['recommendation', 'supporting-details', 'moisture-comparison', 'indoor-summary'] });
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
  const f = fixture(), handle = f.rows.get('moisture-comparison').controls.handle;
  handle.emit('click'); assert.equal(f.focused, f.up);
  for (const [key, expected] of [['ArrowDown', f.down], ['ArrowDown', f.up], ['End', f.down], ['Home', f.up]]) {
    f.menu.emit('keydown', { key, preventDefault() {} }); assert.equal(f.focused, expected);
  }
  let stopped = false;
  f.document.emit('keydown', { key: 'Escape', preventDefault() {}, stopImmediatePropagation() { stopped = true; } });
  assert.equal(stopped, true); assert.equal(f.menu.hidden, true); assert.equal(f.focused, handle); assert.equal(f.saves, 0);
  handle.emit('click'); f.menu.emit('keydown', { key: 'Tab', preventDefault() {} });
  assert.equal(f.focused, f.rows.get('moisture-comparison').controls.input); assert.equal(f.menu.hidden, true);
  handle.emit('click'); f.menu.emit('keydown', { key: 'Tab', shiftKey: true, preventDefault() {} }); assert.equal(f.focused, handle);
});

test('menu dismissal respects outside focus and restores hidden focus on scrolling', () => {
  for (const reason of ['outside', 'focus', 'scroll', 'resize', 'close', 'reset', 'background']) {
    const f = fixture(), handle = f.rows.get('supporting-details').controls.handle;
    handle.emit('click'); assert.equal(f.down.disabled, true); assert.equal(f.focused, f.up);
    if (reason === 'outside') f.document.emit('pointerdown', { target: f.reset });
    if (reason === 'focus') { f.reset.focus(); f.document.emit('focusin', { target: f.reset }); }
    if (reason === 'scroll') f.scroller.emit('scroll');
    if (reason === 'resize') f.window.emit('resize');
    if (reason === 'close') f.dialog.emit('close');
    if (reason === 'reset') f.reset.emit('click');
    if (reason === 'background') { f.document.visibilityState = 'hidden'; f.document.emit('visibilitychange'); }
    assert.equal(f.menu.hidden, true); assert.equal(handle.getAttribute('aria-expanded'), 'false');
    if (['scroll', 'resize'].includes(reason)) assert.equal(f.focused, handle);
    assert.equal(f.saves, reason === 'reset' ? 1 : 0);
  }
});

test('pinned Recommendation cannot be hidden or dragged across by other rows', () => {
  const f = fixture();
  f.preferences.showRecommendation = false;
  const h = f.rows.get('supporting-details').controls.handle;
  h.emit('pointerdown', {button:0,pointerId:1,clientY:350,stopPropagation(){}});
  h.emit('pointermove', {pointerId:1,clientY:-50,preventDefault(){}});
  h.emit('pointerup', {pointerId:1});
  assert.deepEqual(f.preferences.pageOrder, ['recommendation','supporting-details','indoor-summary','moisture-comparison']);
  assert.equal(f.preferences.showRecommendation,true);
  assert.equal(f.boxes.get('recommendation').hidden,false);
  assert.equal(f.rows.get('recommendation').dataset.insert,undefined);
});
