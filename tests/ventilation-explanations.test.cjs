const { test } = require('node:test');
const assert = require('node:assert/strict');
const { element, environment } = require('./helpers/browser.cjs');
const { createFormatters } = require('../src/ui/format.js');
const { createRecommendationView } = require('../src/ui/recommendation.js');
const { createDashboard } = require('../src/ui/dashboard.js');
const { compareMoisture, dewPoint } = require('../src/domain/humidity.js');
const { estimateOpeningWindowPlan } = require('../src/domain/ventilation.js');

const text = node => node.children.length ? node.children.map(child => typeof child === 'string' ? child : text(child)).join('') : node.textContent;
function fixture(overrides = {}, timerSupported = false) {
  const state = { indoorTemp: 24, indoorRh: 58, targetRh: 55, minTemp: 18, outdoorTemp: 24, outdoorRh: 90, outdoorPressure: 1013.25, outdoorWind: 10, roomPreset: 'medium', openingSetup: 'single', roomLength: 4, roomWidth: 5, roomHeight: 2.5, customAirflow: 80, timezone: 'Europe/London', location: { name: 'Sale' }, forecast: [], ...overrides };
  const elements = new Proxy({}, { get: (target, key) => target[key] ||= element() });
  const document = { activeElement: null, createElement: () => element(), querySelector: () => element() };
  const formatters = createFormatters({ state });
  const view = createRecommendationView({ state, elements, timerSupported, ...formatters }, environment({ document }));
  const dashboard = createDashboard({ state, elements, ...formatters, ...view, weatherUrlForLocation: () => '#', renderAhChart() {}, renderReadingRulers() {} }, environment({ document }));
  return { state, elements, view, dashboard };
}
const forecastRow = (time, temp, rh) => ({ time, temp, rh, dewPoint: dewPoint(temp, rh), pressure: 1013.25, wind: 10 });

test('future time formatting uses local calendar dates across midnight and daylight saving', () => {
  const format = createFormatters({ state: { timezone: 'Europe/London' } }).formatForecastOpeningTime;
  assert.equal(format(new Date('2026-10-07T17:00Z'), new Date('2026-10-07T12:00Z')), '18:00');
  assert.equal(format(new Date('2026-10-07T23:15Z'), new Date('2026-10-07T22:00Z')), '00:15 tomorrow');
  assert.equal(format(new Date('2026-10-09T17:00Z'), new Date('2026-10-07T12:00Z')), '18:00 on Friday');
  assert.equal(format(new Date('2026-10-25T23:30Z'), new Date('2026-10-24T23:15Z')), '23:30', '25 elapsed hours may still fall on the same local calendar day');
  assert.equal(format(new Date('2026-03-29T23:15Z'), new Date('2026-03-28T23:30Z')), '00:15 on Monday', 'under 24 elapsed hours can cross two local calendar dates');
  const abroad = createFormatters({ state: { timezone: 'America/Los_Angeles' } }).formatForecastOpeningTime;
  assert.equal(abroad(new Date('2026-10-08T00:00Z'), new Date('2026-10-07T18:00Z')), '17:00');
  const fallback = createFormatters({ state: { timezone: 'invalid' } }).formatForecastOpeningTime;
  assert.equal(fallback(new Date('2026-10-07T17:00Z'), new Date('2026-10-07T12:00Z')), '18:00');
});

test('cooling-hidden useful drying explains moisture removal and the unchanged stopping time', () => {
  const f = fixture({ outdoorTemp: 12.6, outdoorRh: 94 });
  const start = forecastRow(new Date('2026-10-07T12:00Z'), 12.6, 94);
  const plan = estimateOpeningWindowPlan(f.state, start, [start, { ...start, time: new Date('2026-10-07T15:00Z') }]);
  f.view.renderRecommendation(plan);
  assert.equal(text(f.elements.decisionPrimary), 'Up to 45 min of useful drying.');
  assert.equal(text(f.elements.decisionSecondary), 'Estimated then: 59% RH at 20.8°C.');
  f.dashboard.renderRecommendationExplanation(plan, compareMoisture(24, 58, 12.6, 94));
  const explanation = f.elements.explanationText.textContent;
  assert.match(explanation, /Ventilation is expected to remove moisture, but cooling/);
  assert.match(explanation, /reading may fall as the room warms again/);
  assert.match(explanation, /too similar.*45 min/);
  assert.doesNotMatch(explanation, /airing|±|margin of error/);
});

test('every outcome has plain supporting copy, including immediate limits and cold-room reversal', () => {
  const f = fixture();
  for (const relation of ['drier', 'wetter', 'uncertain']) {
    for (const status of ['target-met', 'below-minimum', 'wetter', 'uncertain', 'good', 'forecast-limit', 'settling', 'too-cold', 'condensation', 'slow', 'minimal-impact', 'unknown']) {
      for (const limitMinutes of [0, 20]) {
        const plan = { status, minutes: status === 'good' ? 25 : null, limitMinutes, projectedTemp: 20, projectedRh: 60 };
        f.dashboard.renderRecommendationExplanation(plan, { status: relation });
        const explanation = f.elements.explanationText.textContent;
        assert.ok(explanation.length > 30);
        assert.doesNotMatch(explanation, /undefined|NaN|±|g\/m³|airing/);
        if (relation === 'uncertain') assert.match(explanation, /too small to be sure/);
        if (status === 'condensation') assert.match(explanation, /100% humidity.*does not assess condensation/);
        if (status === 'minimal-impact') assert.match(explanation, /small or uncertain moisture reduction/);
      }
    }
  }
});

test('cold-room reversal reuses useful-drying wording and a stopping-reason timer', () => {
  const f = fixture({ indoorTemp: 16, indoorRh: 80, targetRh: 30, roomPreset: 'small', openingSetup: 'cross' }, true);
  const start = forecastRow(new Date('2026-10-07T12:00Z'), 22, 5);
  const end = forecastRow(new Date('2026-10-07T12:05Z'), 0, 30);
  const plan = estimateOpeningWindowPlan(f.state, start, [start, end]);
  f.view.renderRecommendation(plan);
  assert.equal(f.elements.decisionLabel.textContent, 'OPEN WINDOWS');
  assert.equal(text(f.elements.decisionPrimary), 'Up to 1 min of useful drying.');
  assert.match(text(f.elements.decisionSecondary), /Estimated then: .*16\.0°C/);
  const timer = f.elements.decisionPrimary.children[1];
  assert.equal(timer.dataset.timerMinutes, 1);
  assert.match(timer.dataset.timerContext, /starts cooling again below its minimum/);
  assert.match(f.view.planLimitingExplanation(plan), /already below.*start cooling it again after about 1 min/);
});

test('future guidance adds the agreed assumption without changing either KEEP CLOSED line', () => {
  const f = fixture();
  const now = Date.now();
  f.state.forecast = [forecastRow(new Date(now + 60 * 60000), 12, 70), forecastRow(new Date(now + 240 * 60000), 12, 70)];
  f.dashboard.render();
  assert.equal(f.elements.decisionLabel.textContent, 'KEEP CLOSED');
  assert.equal(text(f.elements.decisionPrimary), 'Outdoor air contains more moisture.');
  assert.equal(text(f.elements.decisionSecondary), 'Opening would likely raise indoor humidity.');
  assert.match(f.elements.explanationText.textContent, /Assuming your indoor readings stay the same, the next suitable time to open windows for drying is forecast around \d\d:\d\d(?: tomorrow| on \w+)?\./);
  f.state.chartHours = 24;
  f.dashboard.render();
  assert.match(f.elements.explanationText.textContent, /next suitable time/);
  f.state.minTemp = 24;
  f.dashboard.render();
  assert.doesNotMatch(f.elements.explanationText.textContent, /next suitable time/, 'changed settings invalidate the future opportunity');
  f.state.minTemp = 18;
  f.state.indoorRh = 40;
  f.dashboard.render();
  assert.equal(f.elements.decisionLabel.textContent, 'TARGET MET');
  assert.doesNotMatch(f.elements.explanationText.textContent, /next suitable time/);
});

test('loading, failure, missing data and absent forecasts never retain future guidance', () => {
  const f = fixture();
  const now = Date.now();
  f.state.forecast = [forecastRow(new Date(now + 60 * 60000), 12, 70), forecastRow(new Date(now + 240 * 60000), 12, 70)];
  f.dashboard.render();
  assert.match(f.elements.explanationText.textContent, /next suitable time/);
  for (const key of ['weatherRequestPending', 'weatherLoadFailed']) {
    f.state[key] = true;
    f.dashboard.render();
    assert.doesNotMatch(f.elements.explanationText.textContent, /next suitable time/);
    f.state[key] = false;
  }
  f.state.outdoorTemp = null;
  f.dashboard.render();
  assert.doesNotMatch(f.elements.explanationText.textContent, /next suitable time/);
  f.state.outdoorTemp = 24;
  f.state.forecast = [];
  f.dashboard.render();
  assert.doesNotMatch(f.elements.explanationText.textContent, /next suitable time/);
});
