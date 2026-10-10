const { test } = require('node:test');
const assert = require('node:assert/strict');
const { element } = require('./helpers/browser.cjs');
const { createSheetChrome } = require('../src/ui/sheet-chrome.js');

function fixture({ supported = true, open = true, forced = false } = {}) {
  const dialog = element(), header = element(), body = element(), footer = element(), child = element();
  const document = element(), window = element(), media = element();
  const headerBox = { top: 100, bottom: 180, height: 80 };
  const bodyBox = { top: 100, bottom: 540, height: 440 };
  const shellBox = { top: 100, bottom: 600, left: 0, right: 500 };
  dialog.open = open; dialog.clientTop = dialog.clientLeft = 0;
  dialog.setAttribute('aria-labelledby', 'sheetTitle');
  const properties = new Map(); dialog.style.setProperty = (key, value) => properties.set(key, value);
  dialog.querySelector = selector => ({ '.sheet-header': header, '.sheet-body': body, '.sheet-footer': footer })[selector];
  dialog.getBoundingClientRect = () => shellBox; header.getBoundingClientRect = () => headerBox;
  body.getBoundingClientRect = () => bodyBox;
  body.scrollHeight = 840; body.clientHeight = 440; body.scrollTop = 0; body.children = [child];
  body.contains = node => body.children.includes(node); body.focus = () => document.activeElement = body;
  const captures = new Set(); body.setPointerCapture = id => captures.add(id);
  body.hasPointerCapture = id => captures.has(id); body.releasePointerCapture = id => captures.delete(id);
  document.visibilityState = 'visible'; document.createElement = element;
  media.matches = forced; window.matchMedia = () => media;
  let next = 0; const frames = new Map(), callbacks = [], observers = [], mutations = [];
  const env = { document, window, CSS: { supports: () => supported },
    requestAnimationFrame(fn) { frames.set(++next, fn); callbacks.push(fn); return next; }, cancelAnimationFrame(id) { frames.delete(id); },
    ResizeObserver: class { constructor(fn) { this.fn = fn; this.observed = new Set(); observers.push(this); } observe(n) { this.observed.add(n); } unobserve(n) { this.observed.delete(n); } },
    MutationObserver: class { constructor(fn) { mutations.push(fn); } observe() {} } };
  const controller = createSheetChrome({ dialog }, env); controller.bind();
  const rail = dialog.children[0], thumb = rail?.children[0];
  const pointer = (name, x, y, options = {}) => {
    let prevented = false;
    body.emit(name, { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0,
      target: { closest: () => null }, preventDefault() { prevented = true; }, ...options });
    return prevented;
  };
  return { dialog, body, headerBox, bodyBox, rail, thumb, document, window, media, properties, captures, mutations, observers, pointer, callbacks,
    get pending() { return frames.size; },
    paint() { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); } };
}

test('enhancement is gated; native scrollbars remain until an open sheet has valid geometry', () => {
  const unsupported = fixture({ supported: false }); assert.equal(unsupported.rail, undefined);
  const closed = fixture({ open: false }); assert.equal(closed.rail.hidden, true);
  assert.equal(closed.dialog.classList.contains('has-frosted-header'), false);
  closed.dialog.open = true; closed.mutations[1](); closed.paint();
  assert.equal(closed.dialog.classList.contains('has-frosted-header'), true);
  assert.equal(closed.body.getAttribute('role'), 'region');
  assert.equal(closed.body.getAttribute('aria-labelledby'), 'sheetTitle');
  assert.equal(closed.body.getAttribute('tabindex'), '0');
  assert.equal(closed.rail.getAttribute('aria-hidden'), 'true');
});

test('rail clears the header and footer; thumb reflects the unobscured viewport at both ends', () => {
  const f = fixture(); assert.equal(f.properties.get('--sheet-header-height'), '80px');
  assert.equal(f.rail.style.top, '84px'); assert.equal(f.rail.style.height, '352px');
  const height = 352 * 360 / 760;
  assert.equal(parseFloat(f.thumb.style.height), height);
  assert.equal(f.thumb.style.transform, 'translateY(0px)');
  for (const [scroll, fraction] of [[200, .5], [400, 1], [450, 1], [-10, 0]]) {
    f.body.scrollTop = scroll; f.body.emit('scroll'); f.paint();
    assert.equal(f.thumb.style.transform, `translateY(${(352 - height) * fraction}px)`);
  }
});

test('content and viewport resizing update minimum thumb size and hide non-overflowing rails', () => {
  const f = fixture(); f.body.scrollHeight = 100000; f.observers[0].fn(); f.paint();
  assert.equal(f.thumb.style.height, '24px');
  f.body.scrollHeight = f.body.clientHeight; f.body.emit('scroll'); f.paint(); assert.equal(f.rail.hidden, true);
  f.headerBox.height = 120; f.headerBox.bottom = 220; f.body.scrollHeight = 840;
  f.observers[0].fn(); f.paint(); assert.equal(f.rail.style.top, '124px'); assert.equal(f.rail.hidden, false);
  f.bodyBox.bottom = 224; f.observers[0].fn(); f.paint(); assert.equal(f.rail.hidden, true);
});

test('scroll and mutation events share one pending frame and follow replaced content', () => {
  const f = fixture(); const old = f.body.children[0], next = element(); f.body.children = [next];
  f.mutations[0](); f.observers[0].fn(); f.body.emit('scroll'); assert.equal(f.pending, 1);
  assert.equal(f.observers[0].observed.has(old), false); assert.equal(f.observers[0].observed.has(next), true);
  f.body.scrollTop = 400; f.paint(); assert.equal(f.pending, 0);
});

test('mouse thumb dragging maps to the full scroll range and releases capture', () => {
  const f = fixture(), travel = 352 - parseFloat(f.thumb.style.height);
  assert.equal(f.pointer('pointerdown', 492, 194), true); assert.equal(f.captures.has(1), true);
  f.pointer('pointermove', 492, 194 + travel / 2); assert.ok(Math.abs(f.body.scrollTop - 200) < .001);
  f.pointer('pointermove', 492, 194 + travel + 20); assert.equal(f.body.scrollTop, 400);
  f.pointer('pointerup', 492, 194); assert.equal(f.captures.size, 0);
  f.pointer('pointermove', 492, 194); assert.equal(f.body.scrollTop, 400);
});

test('track clicks page through unobscured content and clamp at boundaries', () => {
  const f = fixture(); f.pointer('pointerdown', 492, 520); assert.equal(f.body.scrollTop, 360);
  f.paint(); f.pointer('pointerdown', 492, 190); assert.equal(f.body.scrollTop, 0);
  f.paint(); f.pointer('pointerdown', 492, 520); f.paint(); f.pointer('pointerdown', 492, 520);
  assert.equal(f.body.scrollTop, 400);
});

test('touches, controls, header space and unrelated pointers are never intercepted', () => {
  const f = fixture();
  for (const [x, y, options] of [[492, 190, { pointerType: 'touch' }], [492, 170, {}], [450, 190, {}],
    [492, 190, { button: 2 }], [492, 190, { target: { closest: () => element() } }]]) {
    assert.equal(f.pointer('pointerdown', x, y, options), false); assert.equal(f.captures.size, 0);
  }
  f.pointer('pointerdown', 492, 194); f.pointer('pointermove', 492, 500, { pointerId: 2 });
  assert.equal(f.body.scrollTop, 0);
});

test('close, backgrounding and pagehide cancel stale frames and pointer capture', () => {
  for (const kind of ['close', 'hidden', 'pagehide']) {
    const f = fixture(); f.pointer('pointerdown', 492, 194); f.body.emit('scroll'); const stale = f.callbacks.at(-1);
    if (kind === 'close') f.dialog.close();
    if (kind === 'hidden') { f.document.visibilityState = 'hidden'; f.document.emit('visibilitychange'); }
    if (kind === 'pagehide') f.window.emit('pagehide');
    assert.equal(f.pending, 0); assert.equal(f.captures.size, 0); stale(); assert.equal(f.pending, 0);
  }
});

test('forced colours restore native chrome and resize cancels active dragging', () => {
  const f = fixture(); f.pointer('pointerdown', 492, 194); f.window.emit('resize'); assert.equal(f.captures.size, 0);
  f.media.matches = true; f.media.emit('change'); f.paint();
  assert.equal(f.dialog.classList.contains('has-frosted-header'), false); assert.equal(f.rail.hidden, true);
  f.media.matches = false; f.media.emit('change'); f.paint();
  assert.equal(f.dialog.classList.contains('has-frosted-header'), true); assert.equal(f.rail.hidden, false);
});
