const { test } = require('node:test');
const assert = require('node:assert/strict');
const { element, environment } = require('./helpers/browser.cjs');
const { TIMER_SHORTCUT_INSTALL_URL, isAppleMobile, validTimerMinutes, timerShortcutUrl, createTimerController } = require('../src/ui/timer.js');
const { createRecommendationView } = require('../src/ui/recommendation.js');
const { createFormatters } = require('../src/ui/format.js');

test('timer accepts only supported whole minutes and encodes the reusable Shortcut name', () => {
  for (const value of [1, 20, 80, 180]) {
    assert.ok(validTimerMinutes(value));
    const url = new URL(timerShortcutUrl(value));
    assert.equal(url.searchParams.get('name'), 'Ventilation Timer');
    assert.equal(url.searchParams.get('text'), String(value));
  }
  for (const value of [0, 181, 1.5, NaN, Infinity, '20']) {
    assert.equal(validTimerMinutes(value), false);
    assert.throws(() => timerShortcutUrl(value), RangeError);
  }
  assert.ok(isAppleMobile({ userAgent: 'iPhone' }));
  assert.ok(isAppleMobile({ userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 5 }));
  assert.equal(isAppleMobile({ userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 0 }), false);
  assert.equal(isAppleMobile({ userAgent: 'Android' }), false);
});

function view(timerSupported = true) {
  const state = { targetRh: 55, minTemp: 18 };
  const elements = { recommendation: element(), decisionLabel: element(), decisionPrimary: element(), decisionSecondary: element() };
  const controller = createRecommendationView({ state, elements, timerSupported, ...createFormatters({ state }) }, environment({ document: { createElement(tag) { const node = element(); node.tag = tag; return node; } } }));
  return { ...controller, elements };
}

test('each verdict line binds its own numeric duration and keeps combined durations together', () => {
  const v = view();
  v.renderRecommendation({ status: 'good', minutes: 80, dryAirHorizon: { minutes: 120, capped: false } });
  const a = v.elements.decisionPrimary.children[1], b = v.elements.decisionSecondary.children[1];
  assert.equal(a.tag, 'button'); assert.equal(a.textContent, '1 hr 20 min'); assert.equal(a.dataset.timerMinutes, 80);
  assert.equal(b.tag, 'button'); assert.equal(b.dataset.timerMinutes, 120);
  assert.match(b.dataset.timerContext, /may not need to keep the windows open/);
  assert.equal(v.elements.decisionPrimary.children[0], 'About ');
  assert.equal(v.elements.decisionSecondary.children[0], 'Up to ');
  v.renderRecommendation({ status: 'good', minutes: 120, dryAirHorizon: { minutes: 120, capped: true } });
  assert.equal(v.elements.decisionSecondary.children[0], 'At least ');
  assert.equal(v.elements.decisionPrimary.children[1].dataset.timerMinutes, 120);
  assert.equal(v.elements.decisionSecondary.children[1].dataset.timerMinutes, 120);
});

test('limits and capped times carry appropriate context; unavailable and desktop text have no buttons', () => {
  const v = view();
  for (const [status, minutes, context] of [['forecast-limit', 90, /forecast/], ['settling', 30, /useful/], ['too-cold', 15, /temperature/], ['condensation', 10, /condensation/]]) {
    v.renderRecommendation({ status, minutes, limitMinutes: minutes, projectedRh: 50, projectedTemp: 20 });
    assert.equal(v.elements.decisionPrimary.children[1].dataset.timerMinutes, minutes);
    assert.match(v.elements.decisionPrimary.children[1].dataset.timerContext, context);
  }
  v.renderRecommendation({ status: 'slow' });
  for (const line of [v.elements.decisionPrimary, v.elements.decisionSecondary]) {
    assert.equal(line.children[1].dataset.timerMinutes, 180);
    assert.match(line.children[1].dataset.timerContext, /Recheck/);
  }
  v.setDecisionSummary('Updating', 'Getting local conditions');
  assert.equal(v.elements.decisionPrimary.children.some(node => node.tag === 'button'), false);
  const desktop = view(false);
  desktop.renderRecommendation({ status: 'good', minutes: 20, dryAirHorizon: { minutes: 60 } });
  assert.equal(desktop.elements.decisionPrimary.children[1].tag, 'strong');
  v.renderRecommendation({ status: 'target-met' });
  assert.equal(v.elements.decisionPrimary.children.some(node => node.tag === 'button'), false);
});

test('timer sheet preserves temporary edits and hands off only validated minutes without claiming success', () => {
  const state = { indoorTemp: 24, timerMinutes: 1 };
  const names = ['recommendation', 'timerDialog', 'timerDialogTitle', 'timerMinutes', 'timerMinutesInput', 'timerStartButton', 'timerInstallLink', 'decisionLabel'];
  const elements = Object.fromEntries(names.map(name => [name, element()]));
  Object.defineProperty(elements.timerMinutesInput, 'valueAsNumber', { get() { return this.value === '' ? NaN : Number(this.value); } });
  const button = element(); button.dataset = { timerMinutes: '80', timerContext: 'Target duration' }; button.isConnected = true;
  let focus = '', rendered = 0;
  button.focus = () => { focus = 'button'; };
  elements.decisionLabel.focus = () => { focus = 'heading'; };
  elements.recommendation.contains = node => node === button;
  const appUrl = 'http://192.168.1.165:8768/';
  const window = { location: { href: appUrl } };
  const controller = createTimerController({ state, elements, dialogScrollLock: { open: dialog => dialog.showModal() }, renderRulers: () => rendered++ }, environment({ window }));
  controller.initialize();
  assert.equal(elements.timerInstallLink.href, TIMER_SHORTCUT_INSTALL_URL);
  assert.equal(new URL(elements.timerInstallLink.href).hostname, 'www.icloud.com');
  elements.recommendation.emit('click', { target: { closest: () => button } });
  assert.ok(elements.timerDialog.open); assert.equal(state.timerMinutes, 80);
  assert.equal(elements.timerMinutesInput.value, 80);
  for (const invalid of ['', '0', '181', '1.5']) {
    elements.timerMinutesInput.value = invalid; elements.timerMinutesInput.emit('input');
    assert.ok(elements.timerStartButton.disabled);
    elements.timerStartButton.emit('click'); assert.equal(window.location.href, appUrl);
  }
  elements.timerMinutesInput.value = '42'; elements.timerMinutesInput.emit('input');
  assert.equal(state.timerMinutes, 42); assert.equal(state.indoorTemp, 24);
  elements.timerStartButton.emit('click'); assert.equal(window.location.href, timerShortcutUrl(42));
  assert.ok(elements.timerDialog.open);
  assert.ok(rendered > 0);
  elements.timerDialog.close(); assert.equal(focus, 'button');
  elements.recommendation.emit('click', { target: { closest: () => button } });
  button.isConnected = false; elements.timerDialog.close(); assert.equal(focus, 'heading');
});
