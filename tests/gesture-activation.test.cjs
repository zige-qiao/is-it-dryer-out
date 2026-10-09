const { test } = require('node:test');
const assert = require('node:assert/strict');
const { element, environment } = require('./helpers/browser.cjs');
const { createDialogs } = require('../src/ui/dialogs.js');

function fixture() {
  const document = element(); let time = 0;
  document.activeElement = null;
  const dialogs = createDialogs({}, environment({ document, performance: { now: () => time } })); dialogs.bindSheetFocus();
  const point = (x = 100, y = 100, type = 'touch') => ({ target: element(), pointerId: 1, pointerType: type,
    isPrimary: true, button: 0, clientX: x, clientY: y });
  const click = (detail = 1) => {
    let prevented = false, stopped = false;
    document.emit('click', { detail, preventDefault: () => { prevented = true; }, stopImmediatePropagation: () => { stopped = true; } });
    assert.equal(prevented, stopped); return prevented;
  };
  return { document, point, click, dialogs, advance: ms => { time += ms; } };
}

test('private drag eligibility rejects a touch stopping scroll momentum, but permits settled touches and mouse', () => {
  const f = fixture(); f.document.emit('pointerdown', f.point()); f.document.emit('pointercancel', f.point());
  f.document.emit('scroll'); f.advance(50); f.document.emit('pointerdown', f.point());
  assert.equal(f.dialogs.canStartPointerGesture(f.point()), false);
  assert.equal(f.dialogs.canStartPointerGesture(f.point(100, 100, 'mouse')), true);
  f.document.emit('pointerup', f.point()); f.advance(200); f.document.emit('pointerdown', f.point());
  assert.equal(f.dialogs.canStartPointerGesture(f.point()), true);
  f.document.emit('pointermove', f.point(100, 120));
  assert.equal(f.dialogs.canStartPointerGesture(f.point()), true, 'active dragging does not become ineligible after movement');
});

for (const type of ['touch', 'mouse', 'pen']) {
  for (const [x, y] of [[100, 80], [100, 120], [80, 100], [120, 100], [106, 106]]) {
    test(`${type} movement to ${x}/${y} suppresses activation, including after returning to origin`, () => {
      const f = fixture(); f.document.emit('pointerdown', f.point(100, 100, type));
      f.document.emit('pointermove', f.point(x, y, type));
      f.document.emit('pointerup', f.point(100, 100, type));
      assert.equal(f.click(), true);
      f.document.emit('pointerdown', f.point(100, 100, type)); f.document.emit('pointerup', f.point(100, 100, type));
      assert.equal(f.click(), false);
    });
  }
}
test('small movement permits a tap; final release movement is checked too', () => {
  const f = fixture(); f.document.emit('pointerdown', f.point()); f.document.emit('pointerup', f.point(104, 104));
  assert.equal(f.click(), false);
  f.document.emit('pointerdown', f.point()); f.document.emit('pointerup', f.point(100, 112)); assert.equal(f.click(), true);
});
test('native scroll cancellation, nested scroll and a tap stopping momentum do not activate; settled taps do', () => {
  const f = fixture(); f.document.emit('pointerdown', f.point()); f.document.emit('pointercancel', f.point());
  assert.equal(f.click(), true); f.document.emit('scroll'); f.advance(50); f.document.emit('scroll');
  f.document.emit('pointerdown', f.point()); f.document.emit('pointerup', f.point()); assert.equal(f.click(), true);
  f.advance(200); f.document.emit('pointerdown', f.point()); f.document.emit('pointerup', f.point()); assert.equal(f.click(), false);
  f.document.emit('pointerdown', f.point()); f.document.emit('scroll'); f.document.emit('pointerup', f.point()); assert.equal(f.click(), true);
});
test('keyboard, assistive/programmatic activation, mouse clicks and page return are never left locked', () => {
  const f = fixture(); f.document.emit('pointerdown', f.point()); f.document.emit('pointercancel', f.point());
  assert.equal(f.click(0), false); f.document.emit('keydown', { key: 'Enter' }); assert.equal(f.click(), false);
  f.document.emit('pointerdown', f.point()); f.document.emit('pointercancel', f.point());
  f.document.emit('pointerdown', f.point(100, 100, 'mouse')); f.document.emit('pointerup', f.point(100, 100, 'mouse')); assert.equal(f.click(), false);
  f.document.emit('pointerdown', f.point()); f.document.emit('pointercancel', f.point());
  f.document.emit('visibilitychange'); assert.equal(f.click(), false);
});
test('cancelled pulls without actual scrolling allow the next ordinary touch tap immediately', () => {
  const f = fixture(); f.document.emit('pointerdown', f.point()); f.document.emit('pointercancel', f.point());
  assert.equal(f.click(), true);
  f.document.emit('pointerdown', f.point()); f.document.emit('pointerup', f.point()); assert.equal(f.click(), false);
});
test('multitouch invalidates activation; unrelated pointer moves and cancels do not disrupt a tap', () => {
  const f = fixture(); f.document.emit('pointerdown', f.point());
  f.document.emit('pointermove', { ...f.point(100, 130), pointerId: 2 });
  f.document.emit('pointercancel', { ...f.point(), pointerId: 2 });
  f.document.emit('pointerup', f.point()); assert.equal(f.click(), false);
  f.document.emit('pointerdown', f.point()); f.document.emit('pointerdown', { ...f.point(), pointerId: 2, isPrimary: false });
  f.document.emit('pointerup', f.point()); assert.equal(f.click(), true);
});
