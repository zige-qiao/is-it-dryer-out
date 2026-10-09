const { test } = require('node:test');
const assert = require('node:assert/strict');
const { environment, callbacks } = require('./helpers/browser.cjs');
const { createDashboard } = require('../src/ui/dashboard.js');
const { createChart } = require('../src/ui/chart.js');
const { createWeatherController } = require('../src/services/weather.js');
const { absoluteHumidity, dewPoint } = require('../src/domain/humidity.js');
function fixture(width = 320) {
  const node = () => {
    const attrs = new Map(), classes = new Set();
    return {
      append() {}, prepend() {}, remove() {}, dataset: {}, style: { setProperty() {} }, textContent: '', innerHTML: '', disabled: false,
      classList: { add: (...names) => names.forEach(n => classes.add(n)), remove: (...names) => names.forEach(n => classes.delete(n)), toggle: (n, on) => on ? classes.add(n) : classes.delete(n), contains: n => classes.has(n) },
      setAttribute: (n, v) => attrs.set(n, String(v)), getAttribute: n => attrs.get(n), removeAttribute: n => attrs.delete(n),
      getBoundingClientRect: () => ({ width, left: 0 }), querySelector: () => node(), querySelectorAll: () => [], getBBox: () => ({x:12,y:40,width:90,height:20}),
    };
  };
  const elements = new Proxy({}, { get: (target, name) => target[name] ||= node() });
  const chart = node(), reading = node(), outdoor = node();
  const rainFields = Object.fromEntries(["chartKey"].map(id=>[id,node()]));
  const canvasContext = {
    scale() {}, translate() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    createLinearGradient: () => ({ addColorStop() {} }),
  };
  const canvas = { width: 0, height: 0, getContext: () => canvasContext, toDataURL: () => 'data:image/png;base64,AA==' };
  const buttons = [24, 48].map(hours => Object.assign(node(), { dataset: { chartHours: String(hours) } }));
  const state = { indoorTemp: 20.1, indoorRh: 59, outdoorTemp: null, outdoorRh: null, chartHours: 24, chartSelection: 0, weatherRequestPending: true, weatherLoadFailed: false, location: { name: 'Sale', latitude:53.4, longitude:-2.3 }, timezone: 'UTC' };
  const start = Date.now(), end = start + 86400000;
  Object.assign(state, {minTemp:18,targetRh:55,roomPreset:'medium',openingSetup:'single',roomLength:4,roomWidth:5,roomHeight:2.5,customAirflow:80,outdoorPressure:1013.25,outdoorWind:0,forecast:[{time:new Date(end),temp:15,rh:70,dewPoint:dewPoint(15,70),pressure:1013.25,wind:0}]});
  const requests = [];
  let now = Date.UTC(2026, 8, 29, 12);
  let nextTimer = 0;
  const timers = new Map();
  class TestDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const context = environment({
    state, elements,
    Date: TestDate,
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id),
    document: { activeElement: null, createElement: () => canvas, createElementNS: () => node(), querySelector: s => s === '#ahChart' ? chart : s === '#ahChartReading' ? reading : rainFields[s.slice(1)] ?? outdoor, querySelectorAll: () => buttons },
    window: { devicePixelRatio: 2 },
    getComputedStyle: () => ({ getPropertyValue: name => name === '--chart-wet' ? '#ffb3a8' : '#ffd27a' }),
    formatTemp: v => `${v}°C`, formatRh: v => `${v}%`,
    formatShortTime: () => '12:00', formatWeatherTimestamp: () => 'earlier',
    formatDuration: minutes => `${minutes} min`,
    renderReadingRulers() {},
    planLimitingExplanation: () => 'Check conditions again later.',
    setDecisionSummary: (a, b) => { elements.decisionPrimary.textContent = a; elements.decisionSecondary.textContent = b; },
    renderRecommendation: () => { elements.decisionLabel.textContent = 'OPEN WINDOWS'; },
    saveLocation() {}, updateLocationUi() {}, weatherUrlForLocation: location => location.name,
    fetch: (url, options) => new Promise((resolve, reject) => {
      requests.push({ url, options, resolve, reject });
      options?.signal?.addEventListener('abort', () => reject(options.signal.reason));
    }),
  });
  Object.assign(context, createChart(context, context));
  Object.assign(context, createDashboard({ ...context, ...callbacks(context, ['renderAhChart']) }, context));
  Object.assign(context, createWeatherController({ ...context, ...callbacks(context, ['render']) }, context));
  return {
    context, state, elements, chart, canvas, reading, rainFields, buttons, requests,
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
  assert.equal(f.elements.indoorAbsoluteHumidity.textContent, absoluteHumidity(20.1,59).toFixed(1));
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
  assert.match(f.chart.innerHTML, new RegExp('Indoor '+absoluteHumidity(20.1,59).toFixed(1)));
  f.state.indoorRh = 65;
  f.context.render();
  assert.match(f.chart.innerHTML, new RegExp('Indoor '+absoluteHumidity(20.1,65).toFixed(1)));
  assert.equal(f.elements.indoorAbsoluteHumidity.textContent, absoluteHumidity(20.1,65).toFixed(1));
});

test('weather metadata separates successful timestamps from loading and failure messages', () => {
  const f = fixture();
  for (const success of [null, new Date()]) {
    for (const status of ['loading', 'failed', 'ready']) {
      Object.assign(f.state, { lastSuccessfulUpdateAt: success, lastCheckedAt: new Date(),
        weatherRequestPending: status === 'loading', weatherLoadFailed: status === 'failed' });
      f.context.render();
      assert.equal(f.elements.weatherDataUpdated.textContent, success ? 'earlier' : 'Not available yet');
      const message = f.elements.weatherDataStatus.textContent;
      if (status === 'failed') assert.match(message, /failed at earlier/);
      if (status === 'loading') assert.match(message, /in progress/);
      if (status === 'ready' && success) assert.equal(message, '');
      if (!success) assert.match(message, /No successful/);
      assert.equal(f.elements.weatherDataStatus.hidden, !message);
    }
  }
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
    assert.equal(f.elements.weatherDataUpdated.textContent, 'earlier');
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
    assert.equal(f.canvas.width, width * 4);
    assert.match(f.chart.innerHTML, /<image x="0" y="[\d.]+" width="480" height="150" href="data:image\/png/);
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
  f.context.setLocation({ name: 'London', latitude:51.5, longitude:0 }, 'search');
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

test('a stalled request times out into the retry state and superseded requests are aborted', async () => {
  const f = fixture();
  const stalled = f.context.fetchWeather();
  f.advance(14_999);
  assert.equal(f.elements.refreshWeather.disabled, true);
  f.advance(1);
  await stalled;
  assert.equal(f.requests[0].options.signal.aborted, true);
  assert.equal(f.elements.decisionLabel.textContent, 'NO DATA');
  assert.equal(f.elements.weatherStatus.textContent, 'Update failed');
  assert.equal(f.elements.refreshWeather.disabled, false);

  const superseded = f.context.fetchWeather();
  const latest = f.context.fetchWeather();
  assert.equal(f.requests[1].options.signal.aborted, true);
  f.requests[2].resolve({ ok: true, json: async () => ({ current: { temperature_2m: 15, relative_humidity_2m: 70 } }) });
  await Promise.all([superseded, latest]);
  assert.equal(f.state.outdoorTemp, 15);
  f.advance(20_000);
  assert.equal(f.state.weatherLoadFailed, false, 'a completed request must not leave its timeout armed');
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


test('rain graphics and accessible hourly reading disappear during refresh', () => {
  const f = fixture();
  Object.assign(f.state, { outdoorTemp:15, outdoorRh:70, weatherRequestPending:false });
  const now = Date.now();
  f.state.forecast = Array.from({length:5}, (_,i) => ({time:new Date(now+i*3600000),temp:15,rh:70,dewPoint:dewPoint(15,70),pressure:1013.25,wind:0,rainfall:i===0||i===4?0:1,precipitationProbability:80}));
  f.context.renderAhChart();
  f.rainFields.chartKey.open = true;
  assert.match(f.chart.innerHTML, /class="rain-bar"/);
  assert.match(f.chart.innerHTML, /class="rain-band"/);
  assert.match(f.chart.getAttribute('aria-valuetext'), /Rain 1.0 mm/);
  assert.match(f.chart.getAttribute('aria-valuetext'), /Precip. chance 80%/);
  f.state.weatherRequestPending = true;
  f.context.renderAhChart();
  assert.doesNotMatch(f.chart.innerHTML, /class="rain-bar"|class="rain-band"/);
  assert.equal(f.chart.getAttribute('aria-valuetext'), undefined);
  assert.equal(f.rainFields.chartKey.open,true);
});

test('24-hour airflow bars fit numbers and wind arrows; 48-hour view stays compact', () => {
  const f=fixture();
  Object.assign(f.state,{outdoorTemp:15,outdoorRh:70,outdoorDewPoint:dewPoint(15,70),outdoorWind:8,outdoorWindDirection:90,weatherRequestPending:false});
  f.state.forecast[0].wind=8; f.state.forecast[0].windDirection=90;
  f.context.renderAhChart();
  assert.equal((f.chart.innerHTML.match(/class="airflow-wind"/g)||[]).length,12);
  assert.equal((f.chart.innerHTML.match(/class="airflow-label"/g)||[]).length,12);
  assert.match(f.chart.innerHTML,/rotate\(270\)/);
  assert.match(f.chart.getAttribute('aria-valuetext'),/Wind from 90 degrees/);
  f.state.chartHours=48; f.context.renderAhChart();
  assert.doesNotMatch(f.chart.innerHTML,/airflow-wind|airflow-label/);
  f.state.chartHours=24; f.state.outdoorWindDirection=null; f.state.forecast[0].windDirection=null;
  f.context.renderAhChart(); assert.doesNotMatch(f.chart.innerHTML,/airflow-wind/);
});

test('24-hour ACH heights stay proportional at low values and annotations sit below the plot', () => {
 for (const width of [240,480]) {
  const f=fixture(width);
  Object.assign(f.state,{outdoorTemp:20,outdoorRh:70,outdoorDewPoint:dewPoint(20,70),outdoorWind:0,weatherRequestPending:false,openingSetup:'custom',customAirflow:10});
  f.state.forecast[0]={...f.state.forecast[0],temp:20,dewPoint:dewPoint(20,70)};
  f.context.renderAhChart();
  const height = () => Number(f.chart.innerHTML.match(/class="airflow-bar"[^>]* height="([^"]+)"/)[1]);
  const low=height();
  f.state.customAirflow=20; f.context.renderAhChart();
  assert.ok(Math.abs(height()-low*2)<1e-9);
  assert.ok(low<34*480/width);
  assert.equal(Number(f.chart.innerHTML.match(/class="airflow-label"[^>]* y="([^"]+)"/)[1]),158+13*480/width);
  f.state.customAirflow=0; f.context.renderAhChart();
  assert.ok(Math.abs(height()-50/30)<1e-9); // The airflow model retains its 0.1 ACH floor.
  f.state.customAirflow=1000; f.context.renderAhChart();
  assert.ok(height()>low && height()<=50);
  const liveViewBox=f.chart.getAttribute('viewBox');
  f.state.weatherRequestPending=true;f.context.renderAhChart();assert.equal(f.chart.getAttribute('viewBox'),liveViewBox);
  f.state.weatherRequestPending=false;f.state.chartHours=24;f.context.renderAhChart();
  const height24=height();
  f.state.chartHours=48;f.context.renderAhChart();
  assert.equal(height(),height24);
  assert.equal(Number(liveViewBox.split(' ')[3])-Number(f.chart.getAttribute('viewBox').split(' ')[3]),34*480/width);
 }
});
