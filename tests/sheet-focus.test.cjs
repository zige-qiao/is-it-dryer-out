const { test } = require('node:test');
const assert = require('node:assert/strict');
const { element, environment } = require('./helpers/browser.cjs');
const { createDialogs } = require('../src/ui/dialogs.js');

function fixture() {
  const document = element();
  document.activeElement = null;
  const dialogs = createDialogs({}, environment({ document }));
  dialogs.bindSheetFocus();
  const target = () => {
    const node = element();
    node.isConnected = true;
    node.visibleFocus = false;
    node.contains = other => node === other;
    node.matches = selector => selector === ':focus-visible' && node.visibleFocus;
    node.focus = () => {
      if (document.activeElement !== node) document.activeElement?.emit('blur');
      document.activeElement = node;
    };
    return node;
  };
  return { document, dialogs, target };
}

test('an entry button hidden in Settings restores focus to the visible sheet heading', () => {
  const f=fixture(), dialog=element(), opener=f.target(), fallback=f.target();
  f.dialogs.rememberSheetFocus(dialog,opener,fallback); opener.hidden=true;
  f.dialogs.restoreSheetFocus(dialog); assert.equal(f.document.activeElement,fallback);
});

test('touch-opened sheets return focus quietly even after keyboard entry inside', () => {
  const f = fixture(), dialog = element(), opener = f.target(), input = f.target();
  f.document.emit('pointerdown', { target: opener });
  f.dialogs.rememberSheetFocus(dialog, opener, opener);
  input.focus();
  f.document.emit('keydown', { key: '4' });
  opener.visibleFocus = true; // Browser heuristic inherited from the text field.
  f.dialogs.restoreSheetFocus(dialog);
  assert.equal(f.document.activeElement, opener);
  assert.ok(opener.classList.contains('is-restored-pointer-focus'));
  f.document.emit('keydown', { key: 'Tab' });
  f.dialogs.restoreSheetFocus(dialog); // A queued close event must not undo the new modality.
  assert.equal(opener.classList.contains('is-restored-pointer-focus'), false);
  assert.equal(opener.classList.contains('is-restored-keyboard-focus'), false);
  f.document.emit('keydown', { key: 'Tab' });
  assert.equal(opener.classList.contains('is-restored-pointer-focus'), false);
});

test('keyboard-visible openers retain their indicator, including a subsequent pointer activation', () => {
  for (const pointer of [false, true]) {
    const f = fixture(), dialog = element(), opener = f.target(), heading = f.target();
    opener.focus(); opener.visibleFocus = true;
    if (pointer) {
      f.document.emit('pointerdown', { target: opener });
      opener.visibleFocus = false;
    }
    f.dialogs.rememberSheetFocus(dialog, opener, opener);
    heading.focus();
    f.dialogs.restoreSheetFocus(dialog);
    assert.ok(opener.classList.contains('is-restored-keyboard-focus'));
    assert.equal(opener.classList.contains('is-restored-pointer-focus'), false);
    heading.focus();
    assert.equal(opener.classList.contains('is-restored-keyboard-focus'), false);
  }
});

test('quiet restoration is not mistaken for keyboard focus when reopening; pointer and blur clear it', () => {
  const f = fixture(), dialog = element(), opener = f.target();
  f.dialogs.rememberSheetFocus(dialog, opener, opener);
  f.dialogs.restoreSheetFocus(dialog);
  opener.visibleFocus = true;
  f.document.emit('pointerdown', { target: opener });
  assert.equal(opener.classList.contains('is-restored-pointer-focus'), false);
  f.dialogs.rememberSheetFocus(dialog, opener, opener);
  f.dialogs.restoreSheetFocus(dialog);
  assert.ok(opener.classList.contains('is-restored-pointer-focus'));
  opener.emit('blur');
  assert.equal(opener.classList.contains('is-restored-pointer-focus'), false);
});

test('replaced and automatic openers use quiet fallbacks; restoration is idempotent', () => {
  for (const automatic of [false, true]) {
    const f = fixture(), dialog = element(), opener = f.target(), fallback = f.target();
    opener.focus(); opener.visibleFocus = true;
    f.dialogs.rememberSheetFocus(dialog, automatic ? null : opener, fallback);
    opener.isConnected = false;
    f.dialogs.restoreSheetFocus(dialog);
    assert.equal(f.document.activeElement, fallback);
    assert.ok(fallback.classList.contains('is-restored-pointer-focus'));
    opener.focus();
    f.dialogs.restoreSheetFocus(dialog);
    assert.equal(f.document.activeElement, opener);
  }
});

test('quiet return styling is prepared before native close can restore focus', () => {
  const f = fixture(), dialog = element(), opener = f.target();
  f.dialogs.rememberSheetFocus(dialog, opener, opener);
  dialog.open = true;
  dialog.close = () => {
    assert.ok(opener.classList.contains('is-restored-pointer-focus'));
    opener.focus();
    dialog.open = false;
  };
  f.dialogs.closeSheet(dialog);
  f.dialogs.restoreSheetFocus(dialog);
  assert.equal(f.document.activeElement, opener);
  assert.ok(opener.classList.contains('is-restored-pointer-focus'));
});
