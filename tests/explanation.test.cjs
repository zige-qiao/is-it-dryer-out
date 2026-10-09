const { test } = require('node:test');
const assert = require('node:assert/strict');
const { explanationFacts, explanationRows, createExplanationView } = require('../src/ui/explanation.js');
const { compareMoisture } = require('../src/domain/humidity.js');
const { createFormatters } = require('../src/ui/format.js');
const { createRecommendationView } = require('../src/ui/recommendation.js');
const { element, environment } = require('./helpers/browser.cjs');
const { createWeatherController } = require('../src/services/weather.js');

const now = Date.UTC(2026, 9, 8, 12, 30);
const text = node => typeof node === 'string' ? node : node.children?.length ? node.children.map(text).join('') : node.textContent;
const rowText = item => item.parts.map(part => typeof part === 'string' ? part : part.strong).join('');
const variants = [
  ['target-met', {}, /little to gain/], ['below-minimum', {}, /Heat escapes.*Keep windows closed/],
  ['wetter', {}, /bring extra moisture/], ['uncertain', {}, /too close to tell/],
  ['good', { minutes: 8, dryAirHorizon: { minutes: 58, capped: false } }, /remove moisture|Recheck the readings/],
  ['forecast-limit', { limitMinutes: 20 }, /expected to become less useful.*Close at the limit/],
  ['forecast-limit', { limitMinutes: 0 }, /not expected to stay drier/],
  ['settling', { minutes: 20, limitMinutes: 20 }, /benefit gradually reduces.*Continuing/],
  ['settling', { minutes: null, limitMinutes: 0 }, /too similar/],
  ['too-cold', { limitMinutes: 20 }, /cool the room too much.*Stop at the limit/],
  ['too-cold', { limitMinutes: 0 }, /Keep windows closed/],
  ['condensation', { limitMinutes: 20 }, /saturated.*Stop at the limit/],
  ['condensation', { limitMinutes: 0 }, /saturated almost immediately.*Keep windows closed/],
  ['slow', { limitMinutes: 180 }, /removal is gradual.*Fresh indoor readings/],
  ['minimal-impact', {}, /Little noticeable improvement/],
];
function fixture(overrides = {}) {
  const state = { indoorTemp: 24, indoorRh: 58, targetRh: 55, minTemp: 18, outdoorTemp: 12, outdoorRh: 75,
    outdoorWind: 12, outdoorWindAvailable: true, outdoorWindDirection: 225, outdoorPressure: 1013.25,
    roomPreset: 'medium', openingSetup: 'single', timezone: 'Europe/London', location: { name: 'Sale' },
    weatherRequestPending: false, weatherLoadFailed: false,
    forecast: [1, 2, 3, 4].map(i => ({ time: new Date(now + i * 3600000), rainfall: 1, precipitationProbability: 60 })), ...overrides };
  const elements = new Proxy({}, { get: (obj, key) => obj[key] ||= element() });
  const document = { activeElement: null, createElement: () => element(), createElementNS: () => element() };
  class TestDate extends Date { static now() { return now; } }
  const env = environment({ document, Date: TestDate });
  const formats = createFormatters({ state });
  const recommendation = createRecommendationView({ state, elements, ...formats }, env);
  const view = createExplanationView({ state, elements, ...formats,
    formatVentilationSummary: () => '50 m³ · One window open', ...recommendation }, env);
  const plan = changes => ({ status: 'good', minutes: null, limitMinutes: 0, projectedTemp: 23.2, projectedRh: 55, ...changes });
  const comparison = () => compareMoisture(state.indoorTemp, state.indoorRh, state.outdoorTemp, state.outdoorRh);
  const rows = candidate => {
    const comp = comparison();
    const facts = explanationFacts(state, candidate, comp, now);
    return explanationRows(state, candidate, comp, facts, formats.formatForecastOpeningTime);
  };
  return { state, elements, document, view, plan, comparison, rows, formats };
}

for (const [status, changes, expected] of variants) {
  for (const relation of ['drier', 'wetter', 'uncertain']) {
    test(`${status} ${JSON.stringify(changes)} with ${relation} comparison`, () => {
      const f = fixture(relation === 'drier' ? {} : { outdoorTemp: 24, outdoorRh: relation === 'wetter' ? 90 : 58 });
      const candidate = f.plan({ status, ...changes });
      const rows = f.rows(candidate);
      const consistent = ['target-met', 'below-minimum'].includes(status) ||
        (status === 'wetter' ? relation === 'wetter' : status === 'uncertain' ? relation === 'uncertain' : relation === 'drier');
      assert.match(rowText(rows[0]), consistent ? expected : /do not give a clear recommendation/);
      assert.ok(rows.length <= 5);
      assert.doesNotMatch(rows.map(rowText).join(' '), /undefined|NaN|g\/m³|ACH|\b58 min\b|\b8 min\b|55% RH/);
      if (relation === 'uncertain') assert.doesNotMatch(rows.map(rowText).join(' '), /\d+% (less|more) moisture/);
      const weather = rows.filter(item => ['rain', 'wind'].includes(item.key)).map(rowText).join(' ');
      const immediate = ['too-cold', 'condensation'].includes(status) && changes.limitMinutes === 0;
      if (['target-met', 'below-minimum', 'wetter'].includes(status) || immediate || relation === 'wetter') {
        assert.doesNotMatch(weather, /Use only|Avoid exposed|before opening|Check for wind-driven/);
      }
      f.elements.explanationDetails.open = true;
      f.view.render(candidate, f.comparison(), 37, false);
      assert.equal(f.elements.explanationDetails.hidden, !consistent);
      assert.equal(f.elements.explanationDetails.open, true);
      assert.match(text(f.elements.explanationOverview), consistent ? expected : /do not give a clear recommendation/);
      for (const paragraph of f.elements.explanationOverview.children) {
        const [icon, content] = paragraph.children;
        assert.equal(icon.getAttribute('aria-hidden'), 'true');
        assert.equal(icon.getAttribute('focusable'), 'false');
        assert.equal(icon.getAttribute('viewBox'), '0 0 20 20');
        assert.ok(icon.children[0].getAttribute('d'));
        assert.ok(text(content.children[0]));
        assert.ok(text(content.children[1]));
      }
      assert.doesNotMatch(f.elements.explanationText.textContent, /undefined|NaN/);
    });
  }
}

test('cold-room reversal and cooling-hidden removal have distinct explanations', () => {
  const f = fixture({ indoorTemp: 16, outdoorTemp: 22, outdoorRh: 5 });
  let candidate = f.plan({ status: 'too-cold', limitMinutes: 1, projectedTemp: 16.01 });
  assert.match(rowText(f.rows(candidate)[0]), /initially helps.*stop before.*cooling again.*already below/);
  assert.doesNotMatch(rowText(f.rows(candidate)[0]), /reach.*minimum/);
  f.state.indoorTemp = 24;
  candidate = f.plan({ status: 'minimal-impact', projectedTemp: 20.8, projectedRh: 59 });
  assert.match(rowText(f.rows(candidate)[0]), /lose moisture while cooling keeps.*reading high/);
  assert.doesNotMatch(rowText(f.rows(candidate)[0]), /will fall/);
});

test('temperature change handles cooling, warming, rounding and verdict duplication', () => {
  const f = fixture();
  const good = f.plan({ status: 'good', minutes: 8, dryAirHorizon: { minutes: 58, capped: false } });
  assert.match(rowText(f.rows(good).find(item => item.key === 'temperature')), /cool by about 0\.8°C/);
  good.projectedTemp = 24.8;
  assert.match(rowText(f.rows(good).find(item => item.key === 'temperature')), /warm by about 0\.8°C/);
  for (const temp of [24, 24.01, 23.99]) {
    good.projectedTemp = temp;
    assert.equal(f.rows(good).some(item => item.key === 'temperature'), false);
  }
  for (const status of ['forecast-limit', 'settling', 'too-cold', 'condensation']) {
    assert.equal(f.rows(f.plan({ status, minutes: 20, limitMinutes: 20 })).some(item => item.key === 'temperature'), false);
  }
});

test('capped horizons and missing forecast coverage do not imply drying stops at a cap', () => {
  const f = fixture({ forecast: [] });
  const plan = f.plan({ status: 'good', minutes: 8, dryAirHorizon: { minutes: 180, capped: true } });
  const window = rowText(f.rows(plan).find(item => item.key === 'window'));
  assert.match(window, /model’s limit; drying may continue.*Only current weather.*assumes it stays the same/);
  f.view.render(plan, f.comparison());
  assert.doesNotMatch(f.elements.explanationHorizon.textContent, /After that/);
  assert.match(f.elements.explanationModel.textContent, /holds the last available conditions unchanged/);
  f.state.forecast = [{ time: new Date(now + 15 * 60000), rainfall: 0, precipitationProbability: 0 }];
  plan.dryAirHorizon = { minutes: 58, capped: false };
  const facts = explanationFacts(f.state, plan, f.comparison(), now);
  assert.equal(facts.rainComplete, true, 'rain covers the short suggested opening');
  assert.equal(facts.forecastLimited, true, 'forecast does not cover the longer drying horizon');
});

test('rain boundaries, missing amounts, probability and incomplete hours remain honest', () => {
  const f = fixture();
  const plan = f.plan({ status: 'good', minutes: 8, dryAirHorizon: { minutes: 58, capped: false } });
  for (const [amount, pattern] of [[0, /No rain.*Check outside/], [.01, /Light/], [2.5, /Light/], [2.51, /Moderate/], [7.5, /Moderate/], [7.51, /Heavy.*Wait if/]]) {
    f.state.forecast.forEach(hour => { hour.rainfall = amount; });
    const rain = rowText(f.rows(plan).find(item => item.key === 'rain'));
    assert.match(rain, pattern);
    assert.doesNotMatch(rain, /\d.*mm|60%|guarantee/);
  }
  f.state.forecast[0].rainfall = null;
  assert.match(rowText(f.rows(plan).find(item => item.key === 'rain')), /unavailable/);
  f.state.forecast[0].rainfall = .5;
  plan.minutes = 20;
  f.state.forecast[0].time = new Date(now + 70 * 60000);
  assert.match(rowText(f.rows(plan).find(item => item.key === 'rain')), /coverage is incomplete/);
  f.state.forecast = [1, 2].map(i => ({ time: new Date(now + i * 3600000), rainfall: .5, precipitationProbability: null }));
  f.view.render(plan, f.comparison());
  assert.match(f.elements.explanationRain.textContent, /chance is unavailable.*can hide heavier showers.*can include snow/);
  assert.doesNotMatch(f.elements.explanationRain.textContent, /0%/);
  plan.minutes = 90;
  f.state.forecast[1].precipitationProbability = 80;
  f.view.render(plan, f.comparison());
  assert.match(f.elements.explanationRain.textContent, /80%.*Chance data is incomplete/);
});

test('wind compass, calm and unknown speed are independent facts', () => {
  const f = fixture();
  const plan = f.plan({ status: 'good', minutes: 8, dryAirHorizon: { minutes: 58, capped: false } });
  const names = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  for (let i = 0; i < 8; i++) {
    f.state.outdoorWindDirection = i * 45;
    assert.match(rowText(f.rows(plan).find(item => item.key === 'wind')), new RegExp(`from the ${names[i]}.*${names[i]}-facing`));
  }
  f.state.outdoorWindDirection = 360;
  assert.match(rowText(f.rows(plan).find(item => item.key === 'wind')), /from the north/);
  f.state.outdoorWindDirection = null;
  assert.doesNotMatch(rowText(f.rows(plan).find(item => item.key === 'wind')), /facing/);
  f.state.outdoorWind = 0;
  f.state.outdoorWindAvailable = false;
  assert.match(rowText(f.rows(plan).find(item => item.key === 'wind')), /speed is also unavailable/);
  assert.doesNotMatch(rowText(f.rows(plan).find(item => item.key === 'wind')), /Little or no wind/);
  f.state.outdoorWindAvailable = true;
  assert.match(rowText(f.rows(plan).find(item => item.key === 'wind')), /Little or no wind/);
});

test('weather controller keeps unavailable wind separate from its calculation fallback', async () => {
  const f = fixture();
  f.state.location = { name: 'Sale', latitude: 53.4, longitude: -2.3 };
  let speed;
  const controller = createWeatherController({ state: f.state, elements: f.elements,
    render() {}, saveLocation() {}, updateLocationUi() {}, formatShortTime: () => '12:30' },
  environment({ setTimeout: () => 1, clearTimeout() {}, fetch: async () => ({ ok: true,
    json: async () => ({ current: { temperature_2m: 12, relative_humidity_2m: 75, time: now / 1000,
      ...(speed === undefined ? {} : { wind_speed_10m: speed }) } }) }) }));
  await controller.fetchWeather();
  assert.equal(f.state.outdoorWind, 0);
  assert.equal(f.state.outdoorWindAvailable, false);
  speed = 0;
  await controller.fetchWeather();
  assert.equal(f.state.outdoorWind, 0);
  assert.equal(f.state.outdoorWindAvailable, true);
  controller.setLocation(f.state.location, 'manual');
  assert.equal(f.state.outdoorWindAvailable, false);
});

test('future opportunities keep their assumption and only appear for closed outcomes', () => {
  const f = fixture({ outdoorTemp: 24, outdoorRh: 90 });
  const candidate = f.plan({ status: 'wetter', nextUsefulOpeningTime: new Date(now + 3600000) });
  assert.match(rowText(f.rows(candidate).find(item => item.key === 'next')), /Assuming your indoor readings stay the same.*forecast around/);
  candidate.status = 'target-met';
  assert.equal(f.rows(candidate).some(item => item.key === 'next'), false);
  candidate.status = 'wetter';
  candidate.nextUsefulOpeningTime = new Date(NaN);
  assert.equal(f.rows(candidate).some(item => item.key === 'next'), false);
});

test('unavailable and fallback states clear stale guidance, preserve disclosure and return hidden focus', () => {
  const f = fixture();
  const good = f.plan({ status: 'good', minutes: 8, dryAirHorizon: { minutes: 58, capped: false } });
  f.elements.explanationDetails.open = true;
  f.view.render(good, f.comparison());
  let returned = 0;
  f.elements.explanationToggle.focus = () => { returned++; f.document.activeElement = f.elements.explanationToggle; };
  for (const change of [{ weatherRequestPending: true }, { weatherLoadFailed: true }, { outdoorTemp: null }, { outdoorRh: NaN }]) {
    const original = { ...f.state };
    Object.assign(f.state, change);
    f.document.activeElement = f.elements.explanationDetailsSummary;
    f.view.render(null, null);
    assert.equal(f.elements.explanationOverview.hidden, true);
    assert.equal(f.elements.explanationDetails.hidden, true);
    assert.equal(f.elements.explanationDetails.open, true);
    assert.match(f.elements.explanationStatus.textContent, /Checking|Current weather is needed/);
    assert.equal(f.elements.explanationRain.textContent, '');
    Object.assign(f.state, original);
    f.view.render(good, f.comparison());
    assert.equal(f.elements.explanationDetails.hidden, false);
    assert.equal(f.elements.explanationDetails.open, true);
  }
  assert.equal(returned, 4);
  for (const candidate of [null, { status: 'unknown' }, { ...good, projectedTemp: NaN }, { ...good, dryAirHorizon: null }]) {
    f.view.render(candidate, f.comparison());
    assert.equal(f.elements.explanationDetails.hidden, true);
    assert.match(text(f.elements.explanationOverview), /do not give a clear recommendation/);
    assert.doesNotMatch(text(f.elements.explanationOverview), /undefined|NaN|Use only|Avoid exposed|% less/);
    assert.equal(f.elements.explanationHorizon.textContent, '');
  }
});
