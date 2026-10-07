const { test } = require('node:test');
const assert = require('node:assert/strict');
const { element, environment } = require('./helpers/browser.cjs');
const { createRecommendationView } = require('../src/ui/recommendation.js');
const { createFormatters } = require('../src/ui/format.js');
function render(status, overrides = {}, stateOverrides = {}) {
  const state = { indoorTemp: 23.2, indoorRh: 63, outdoorTemp: 15.3, outdoorRh: 87, targetRh: 50, minTemp: 16, ...stateOverrides };
  const elements = Object.fromEntries(['recommendation','decisionLabel','decisionPrimary','decisionSecondary'].map(key => [key, element()]));
  const view = createRecommendationView({ state, elements, ...createFormatters({state}) }, environment({document:{createElement: () => element()}}));
  view.renderRecommendation({status, projectedTemp: state.indoorTemp, projectedRh: state.indoorRh, ...overrides});
  return elements;
}
test('agreed conditional second lines cover all seven combinations', () => {
  for (const [status, plan, expected] of [
    ['minimal-impact', {projectedTemp:20, projectedRh:63}, 'Drier out, but limited benefit as the room cools.'],
    ['minimal-impact', {}, 'Drier out, but little drying benefit expected.'],
    ['uncertain', {}, 'Open for fresh air; drying benefit is uncertain.'],
    ['target-met', {}, 'Drier out, but your humidity target is already met.'],
    ['below-minimum', {}, 'Drier out, but opening would cool it further.'],
    ['too-cold', {}, 'Opening would cool the room too much.'],
    ['condensation', {}, 'Opening may increase condensation risk.'],
  ]) assert.equal(render(status, plan).decisionSecondary.textContent, expected);
});
test('cooling alone does not establish cooling-limited benefit', () => {
  assert.equal(render('minimal-impact', {projectedTemp:23.19, projectedRh:63}).decisionSecondary.textContent, 'Drier out, but little drying benefit expected.');
  assert.equal(render('minimal-impact', {projectedTemp:20, projectedRh:60}).decisionSecondary.textContent, 'Drier out, but little drying benefit expected.');
  for (const status of ['forecast-limit','settling']) assert.equal(render(status, {limitMinutes:0}).decisionSecondary.textContent, 'Drier out, but little drying benefit expected.');
});
test('non-drier combinations retain copy and immediate limits are independent', () => {
  for (const outdoorRh of [63,90]) {
    const state = {outdoorTemp:23.2, outdoorRh};
    assert.equal(render('target-met', {}, state).decisionSecondary.textContent, 'No ventilation needed now.');
    assert.equal(render('below-minimum', {}, state).decisionSecondary.textContent, 'Ventilation would cool it further.');
    assert.equal(render('minimal-impact', {}, state).decisionSecondary.textContent, 'Open for fresh air, humidity may not fall.');
    assert.equal(render('too-cold', {}, state).decisionSecondary.textContent, 'Opening would cool the room too much.');
    assert.equal(render('condensation', {}, state).decisionSecondary.textContent, 'Opening may increase condensation risk.');
  }
  assert.equal(render('wetter').decisionSecondary.textContent, 'Opening would likely raise indoor humidity.');
});
