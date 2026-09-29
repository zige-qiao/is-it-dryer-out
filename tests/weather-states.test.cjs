const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require.resolve('../app.js'), 'utf8');

function fixture(width = 320) {
  const node = () => {
    const attrs = new Map(), classes = new Set();
    return {
      dataset: {}, style: { setProperty() {} }, textContent: '', innerHTML: '', disabled: false,
      classList: { add: (...names) => names.forEach(n => classes.add(n)), remove: (...names) => names.forEach(n => classes.delete(n)), toggle: (n, on) => on ? classes.add(n) : classes.delete(n), contains: n => classes.has(n) },
      setAttribute: (n, v) => attrs.set(n, String(v)), getAttribute: n => attrs.get(n), removeAttribute: n => attrs.delete(n),
      getBoundingClientRect: () => ({ width, left: 0 }), querySelector: () => node(),
    };
  };
  const elements = new Proxy({}, { get: (target, name) => target[name] ||= node() });
  const chart = node(), reading = node(), outdoor = node();
  const buttons = [24, 48].map(hours => Object.assign(node(), { dataset: { chartHours: String(hours) } }));
  const state = { indoorTemp: 20.1, indoorRh: 59, outdoorTemp: null, outdoorRh: null, chartHours: 24, chartSelection: 0, weatherRequestPending: true, weatherLoadFailed: false, location: { name: 'Sale' }, timezone: 'UTC' };
  const start = Date.UTC(2026, 8, 27), end = start + 86400000;
  const requests = [];
  let now = Date.UTC(2026, 8, 29, 12);
  let nextTimer = 0;
  const timers = new Map();
  class TestDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const context = vm.createContext({
    state, elements, activeWeatherRequestId: 0, checkedLabelTimer: null, DEFAULT_PRESSURE_HPA: 1013,
    Date: TestDate,
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id),
    document: { activeElement: null, querySelector: s => s === '#ahChart' ? chart : s === '#ahChartReading' ? reading : outdoor, querySelectorAll: () => buttons },
    buildWeatherTimeline: () => state.outdoorTemp === null ? [] : [{ time: new Date(start) }, { time: new Date(end) }],
    buildAhOutlook: () => ({ start, end, points: [{ time: start, value: 8 }, { time: end, value: 8 }], indoor: 10.3, low: 7, high: 12, achHigh: 3 }),
    absoluteHumidity: (_temp, rh) => rh === 59 ? 10.3 : 11.2,
    dewPoint: () => 11.8, formatTemp: v => `${v}°C`, formatRh: v => `${v}%`,
    formatShortTime: () => '12:00', formatWeatherTimestamp: () => 'earlier',
    renderReadingRulers() {}, renderPlanControls() {},
    estimateOpeningWindowPlan: () => ({ status: 'minimal-impact' }),
    effectiveAirExchange: () => ({ airChangesPerHour: 2 }),
    compareMoisture: () => ({ outdoor: 8, indoor: 10.3, difference: 2.3, margin: 1, status: 'drier' }),
    planLimitingExplanation: () => 'Check conditions again later.',
    saturationVaporPressure: () => 1, relativeHumidityAtTemperature: () => 40,
    moistureMargin: () => 1, positionAhIndoorLabel() {},
    weatherAtTime: () => ({ temp: 15, rh: 50 }),
    clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
    setDecisionSummary: (a, b) => { elements.decisionPrimary.textContent = a; elements.decisionSecondary.textContent = b; },
    renderRecommendation: () => { elements.decisionLabel.textContent = 'OPEN WINDOWS'; },
    saveLocation() {}, updateLocationUi() {}, weatherUrlForLocation: location => location.name,
    buildForecast: () => [],
    fetch: url => new Promise((resolve, reject) => requests.push({ url, resolve, reject })),
  });
  for (const name of ['renderPlan', 'renderRecommendationExplanation', 'renderWeatherDataDetails', 'render', 'updateWeatherCheckedLabel', 'fetchWeather', 'setLocation', 'renderAhChart']) {
    const begin = source.indexOf(`${name === 'fetchWeather' ? 'async ' : ''}function ${name}(`);
    const rest = source.slice(begin);
    const next = rest.slice(1).search(/\n(?:async )?function /);
    vm.runInContext(next < 0 ? rest : rest.slice(0, next + 1), context);
  }
  return {
    context, state, elements, chart, reading, buttons, requests,
    advance: (ms, runTimers = true) => {
      now += ms;
      if (runTimers) {
        for (const [id, timer] of [...timers]) {
          if (timer.at <= now) { timers.delete(id); timer.callback(); }
        }
      }
    },
  };
}

test('initial checking and failure retain indoor data, clear outdoor data and expose one recovery action', () => {
  const f = fixture();
  f.context.render();
  assert.equal(f.elements.decisionLabel.textContent, 'Checking');
  assert.equal(f.elements.outdoorAbsoluteHumidity.textContent, '--');
  assert.equal(f.elements.indoorAbsoluteHumidity.textContent, '10.3');
  assert.match(f.chart.innerHTML, /ah-skeleton-shimmer/);
  assert.equal(f.chart.getAttribute('tabindex'), '-1');
  assert.equal(f.chart.getAttribute('role'), 'img');
  assert.ok(f.buttons.every(b => b.disabled));
  f.state.weatherRequestPending = false;
  f.state.weatherLoadFailed = true;
  f.context.render();
  assert.equal(f.elements.decisionLabel.textContent, 'NO DATA');
  assert.equal(f.elements.refreshWeather.getAttribute('aria-label'), 'Retry outdoor weather');
  assert.doesNotMatch(f.chart.innerHTML, /ah-skeleton-shimmer/);
  assert.match(f.chart.innerHTML, /Indoor 10.3/);
  f.state.indoorRh = 65;
  f.context.render();
  assert.match(f.chart.innerHTML, /Indoor 11.2/);
  assert.equal(f.elements.indoorAbsoluteHumidity.textContent, '11.2');
});

test('pending or failed refresh hides previous recommendations and preserves historical timestamp', () => {
  const f = fixture();
  Object.assign(f.state, { outdoorTemp: 15, outdoorRh: 70, lastSuccessfulUpdateAt: new Date() });
  for (const failed of [false, true]) {
    Object.assign(f.state, { weatherRequestPending: !failed, weatherLoadFailed: failed });
    f.context.render();
    assert.equal(f.elements.decisionLabel.textContent, failed ? 'NO DATA' : 'Checking');
    assert.equal(f.elements.outdoorTempValue.textContent, '--');
    assert.equal(f.elements.warmedOutdoorRh.textContent, '--');
    assert.match(f.elements.weatherDataStatus.textContent, /Last successful update: earlier/);
    assert.doesNotMatch(f.elements.weatherDataStatus.textContent, /Showing/);
    assert.doesNotMatch(f.elements.explanationText.textContent, /No successful weather data/);
    assert.equal(f.context.renderPlan(), null);
  }
});

test('recovery restores chart inspection with identical geometry at mobile and desktop widths', () => {
  for (const width of [280, 440, 640]) {
    const f = fixture(width);
    f.context.render();
    const viewBox = f.chart.getAttribute('viewBox');
    Object.assign(f.state, { weatherRequestPending: false, outdoorTemp: 15, outdoorRh: 70 });
    f.context.render();
    assert.equal(f.chart.getAttribute('viewBox'), viewBox);
    assert.equal(f.chart.getAttribute('tabindex'), '0');
    assert.equal(f.chart.getAttribute('role'), 'slider');
    assert.equal(typeof f.chart.onkeydown, 'function');
    assert.ok(f.buttons.every(b => !b.disabled));
    assert.doesNotMatch(f.chart.innerHTML, /ah-skeleton/);
    assert.equal(f.elements.refreshWeather.getAttribute('aria-label'), 'Refresh outdoor weather');
    assert.equal(f.elements.decisionLabel.textContent, 'OPEN WINDOWS');
  }
});

test('failed fetch can retry successfully and only the newest location request can update UI', async () => {
  const f = fixture();
  const first = f.context.fetchWeather();
  assert.equal(f.elements.refreshWeather.disabled, true);
  assert.equal(f.elements.weatherStatus.textContent, 'Updating…');
  f.requests[0].reject(new Error('offline'));
  await first;
  assert.equal(f.elements.decisionLabel.textContent, 'NO DATA');
  assert.equal(f.elements.refreshWeather.disabled, false);
  const retry = f.context.fetchWeather();
  f.context.setLocation({ name: 'London' }, 'search');
  const latest = f.context.fetchWeather();
  const response = temp => ({ ok: true, json: async () => ({ current: { temperature_2m: temp, relative_humidity_2m: 70 } }) });
  f.requests[1].resolve(response(99));
  await retry;
  assert.equal(f.state.outdoorTemp, null);
  assert.equal(f.elements.refreshWeather.disabled, true);
  f.requests[2].resolve(response(15));
  await latest;
  assert.equal(f.state.outdoorTemp, 15);
  assert.equal(f.elements.decisionLabel.textContent, 'OPEN WINDOWS');
  assert.equal(f.elements.refreshWeather.disabled, false);
});

test('checked label changes at one minute, catches up on return, and does not replace failure', async () => {
  const f = fixture();
  const response = { ok: true, json: async () => ({ current: { temperature_2m: 15, relative_humidity_2m: 70 } }) };
  const first = f.context.fetchWeather();
  f.requests[0].resolve(response);
  await first;
  assert.equal(f.elements.weatherStatus.textContent, 'Checked just now');
  f.advance(59_999);
  assert.equal(f.elements.weatherStatus.textContent, 'Checked just now');
  f.advance(1);
  assert.equal(f.elements.weatherStatus.textContent, 'Checked 12:00');

  const second = f.context.fetchWeather();
  f.requests[1].resolve(response);
  await second;
  assert.equal(f.elements.weatherStatus.textContent, 'Checked just now');
  f.advance(61_000, false);
  f.context.updateWeatherCheckedLabel();
  assert.equal(f.elements.weatherStatus.textContent, 'Checked 12:00');

  const failed = f.context.fetchWeather();
  f.requests[2].reject(new Error('offline'));
  await failed;
  assert.equal(f.elements.weatherStatus.textContent, 'Update failed');
  f.advance(61_000);
  f.context.updateWeatherCheckedLabel();
  assert.equal(f.elements.weatherStatus.textContent, 'Update failed');
});

test('a new successful check restarts the just-now minute', async () => {
  const f = fixture();
  const response = { ok: true, json: async () => ({ current: { temperature_2m: 15, relative_humidity_2m: 70 } }) };
  const first = f.context.fetchWeather();
  f.requests[0].resolve(response);
  await first;
  f.advance(30_000);
  const second = f.context.fetchWeather();
  f.requests[1].resolve(response);
  await second;
  f.advance(30_000);
  assert.equal(f.elements.weatherStatus.textContent, 'Checked just now');
  f.advance(30_000);
  assert.equal(f.elements.weatherStatus.textContent, 'Checked 12:00');
});
