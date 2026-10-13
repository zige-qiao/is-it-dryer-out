const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLocationController } = require('../src/ui/location.js');
const { createWeatherController } = require('../src/services/weather.js');
const { createStorage } = require('../src/services/storage.js');
const { createGeocoding } = require('../src/services/geocoding.js');
const { LOCATION_STORAGE_KEY, LOCATION_HISTORY_STORAGE_KEY, REVERSE_GEOCODING_TIMEOUT_MS } = require('../src/config.js');
const { environment, memoryStorage, element } = require('./helpers/browser.cjs');

const tick = () => new Promise(setImmediate);
const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
const coords = (latitude = 53.5, longitude = -2.5) => ({ coords: { latitude, longitude } });
const place = (name = 'Chosen', latitude = 54, longitude = -3) => ({ name, latitude, longitude });
function fixture() {
  const localStorage = memoryStorage(), timers = new Map(), requests = [], positions = [], names = [], closeEvents = [];
  const elements = new Proxy({}, { get: (target, key) => target[key] ||= element() });
  let nextTimer = 0, now = Date.UTC(2026, 9, 13, 12), renders = 0;
  const state = { location: place('Sale', 53.42, -2.32), locationMode: 'current', outdoorTemp: null, outdoorRh: null,
    forecast: [], lastCheckedAt: null, lastSuccessfulUpdateAt: null, weatherRequestPending: false, weatherLoadFailed: false };
  class TestDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const env = environment({ Date: TestDate, localStorage, document: { createElement: element },
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id),
    fetch(url, options) { const request = { ...deferred(), url, signal: options.signal }; requests.push(request); return request.promise; },
  });
  const storage = createStorage({ state }, env);
  const weather = createWeatherController({ state, elements, saveLocation: storage.saveLocation,
    updateLocationUi: () => location.updateLocationUi(), formatShortTime: () => '13:00', render: () => { renders++; } }, env);
  const location = createLocationController({ state, elements,
    dialogScrollLock: { open: dialog => { dialog.open = true; } },
    closeSheet: dialog => { dialog.open = false; closeEvents.push(location.handleLocationDialogClosed); },
    hasRequestedLocation: storage.hasRequestedLocation, markLocationRequested: storage.markLocationRequested,
    readLocationHistory: storage.loadLocationHistory, writeLocationHistory: storage.saveLocationHistory,
    getBrowserLocation: () => { const position = deferred(); positions.push(position); return position.promise; },
    reverseGeocodeLocation: (latitude, longitude, { signal }) => { const name = { ...deferred(), latitude, longitude, signal }; names.push(name); return name.promise; },
    ...weather,
  }, env);
  elements.locationDialog.open = true;
  location.loadLocationHistory(false);
  return { state, elements, localStorage, weather, location, env, requests, positions, names, timers,
    get renders() { return renders; },
    closeEvents() { for (const close of closeEvents.splice(0)) close(); },
    advance(ms) { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); } },
    respond(index = requests.length - 1) {
      requests[index].resolve({ ok: true, json: async () => ({ current: { temperature_2m: 12, relative_humidity_2m: 75,
        surface_pressure: 1012, wind_speed_10m: 5, time: now / 1000 } }) });
    },
  };
}

test('GPS starts weather as Nearby location and startup completes without waiting for its name', async () => {
  const f = fixture();
  const startup = f.location.initializeLocation(false);
  f.positions[0].resolve(coords()); await tick();
  assert.equal(f.requests.length, 1);
  assert.equal(f.state.location.name, 'Nearby location');
  assert.equal(f.state.weatherRequestPending, true);
  assert.equal(f.elements.locationUpdateButton.disabled, false);
  assert.equal(f.elements.locationDialog.open, false);
  f.closeEvents();
  assert.equal(f.names[0].signal.aborted, false, 'own queued close preserves the optional name');
  assert.equal(f.requests.length, 1, 'own close must not start fallback weather');
  f.respond(); await startup;
  assert.equal(f.state.outdoorTemp, 12);
  assert.equal(f.state.location.name, 'Nearby location');
  f.location.cancelLocationWork(); assert.equal(f.names[0].signal.aborted, true);
});

for (const phase of ['fetch', 'decode']) test(`a stalled optional ${phase} times out while weather remains usable`, async () => {
  const f = fixture();
  const nameFetch = deferred(); let nameSignal;
  const geocoding = createGeocoding({}, environment({ ...f.env,
    fetch: (url, { signal }) => { nameSignal = signal; return phase === 'fetch' ? nameFetch.promise : Promise.resolve({ ok: true, json: () => nameFetch.promise }); },
  }));
  // A separate controller uses the real bounded locality service with the same clock.
  const location = createLocationController({ state: f.state, elements: f.elements,
    closeSheet: dialog => { dialog.open = false; },
    getBrowserLocation: async () => coords(), reverseGeocodeLocation: geocoding.reverseGeocodeLocation,
    readLocationHistory: () => [], writeLocationHistory() {}, ...f.weather,
  }, f.env);
  const started = location.useCurrentLocation(); await tick();
  assert.equal(f.requests.length, 1); assert.equal(f.state.weatherRequestPending, true);
  f.respond(); await started;
  const checked = f.state.lastSuccessfulUpdateAt;
  f.advance(REVERSE_GEOCODING_TIMEOUT_MS); await tick();
  assert.equal(nameSignal.aborted, true);
  assert.equal(f.state.location.name, 'Nearby location');
  assert.equal(f.state.lastSuccessfulUpdateAt, checked);
  assert.equal(f.state.outdoorTemp, 12);
  assert.equal(f.requests.length, 1);
  assert.ok([...f.timers.values()].every(timer => timer.at > +checked + REVERSE_GEOCODING_TIMEOUT_MS));
});

test('a successful name persists location and history without clearing weather or making another request', async () => {
  const f = fixture(); const started = f.location.useCurrentLocation();
  f.positions[0].resolve(coords()); await tick(); f.closeEvents();
  f.respond(); await started;
  const weather = { outdoorTemp: f.state.outdoorTemp, outdoorRh: f.state.outdoorRh, forecast: f.state.forecast,
    lastCheckedAt: f.state.lastCheckedAt, lastSuccessfulUpdateAt: f.state.lastSuccessfulUpdateAt, updatedAt: f.state.updatedAt };
  const timers = [...f.timers.keys()];
  f.names[0].resolve('Manchester'); await tick();
  assert.equal(f.state.location.name, 'Manchester'); assert.equal(f.requests.length, 1);
  for (const [key, value] of Object.entries(weather)) assert.equal(f.state[key], value, key);
  assert.deepEqual([...f.timers.keys()], timers, 'name update preserves the checked-label timer');
  assert.equal(JSON.parse(f.localStorage.getItem(LOCATION_STORAGE_KEY)).location.name, 'Manchester');
  assert.deepEqual(JSON.parse(f.localStorage.getItem(LOCATION_HISTORY_STORAGE_KEY)), [{ name: 'Manchester', latitude: 53.5, longitude: -2.5 }]);
  assert.equal(f.elements.locationCurrentName.textContent, 'Manchester');
});

test('a name arriving during weather loading preserves the active weather request', async () => {
  const f = fixture(); const started = f.location.useCurrentLocation();
  f.positions[0].resolve(coords()); await tick(); f.closeEvents();
  f.names[0].resolve('Manchester'); await tick();
  assert.equal(f.state.location.name, 'Manchester'); assert.equal(f.state.weatherRequestPending, true);
  assert.equal(f.requests[0].signal.aborted, false); assert.equal(f.requests.length, 1);
  f.respond(); await started;
  assert.equal(f.state.outdoorTemp, 12); assert.equal(f.state.weatherLoadFailed, false);
});

for (const checked of [false, true, 'pending']) test(`fresh-start cancellation fetches fallback once only when needed (${checked})`, async () => {
  const f = fixture();
  if (checked === true) f.state.lastCheckedAt = new Date();
  if (checked === 'pending') f.state.weatherRequestPending = true;
  const startup = f.location.initializeLocation(false);
  f.location.closeLocationDialog(); f.closeEvents(); f.location.cancelLocationWork();
  assert.equal(f.requests.length, checked ? 0 : 1);
  f.positions[0].resolve(coords()); await startup; await tick();
  assert.equal(f.state.location.name, 'Sale'); assert.equal(f.names.length, 0);
  assert.equal(f.requests.length, checked ? 0 : 1);
  if (!checked) { f.respond(); await tick(); }
});

test('manual startup selection starts exactly one request and late GPS cannot replace it', async () => {
  const f = fixture(); const startup = f.location.initializeLocation(false);
  const selected = f.location.selectLocation(place());
  f.closeEvents(); assert.equal(f.requests.length, 1);
  f.positions[0].resolve(coords()); await startup;
  assert.equal(f.state.location.name, 'Chosen'); assert.equal(f.names.length, 0);
  f.respond(); await selected;
  assert.equal(f.requests.length, 1);
});

test('native sheet dismissal starts initial fallback and ignores a late GPS failure', async () => {
  const f = fixture(); const startup = f.location.initializeLocation(false);
  f.elements.locationDialog.open = false;
  f.location.handleLocationDialogClosed(); f.location.handleLocationDialogClosed();
  assert.equal(f.requests.length, 1);
  f.positions[0].reject({ code: 1 }); await startup;
  assert.equal(f.requests.length, 1); assert.equal(f.state.location.name, 'Sale');
  f.respond(); await tick();
});

test('new GPS generations and manual replacements at identical coordinates discard old names', async () => {
  for (const replacement of ['gps', 'manual']) {
    const f = fixture(); const first = f.location.useCurrentLocation();
    f.positions[0].resolve(coords()); await tick(); f.closeEvents(); f.respond(); await first;
    let second;
    if (replacement === 'gps') {
      second = f.location.useCurrentLocation(); f.positions[1].resolve(coords()); await tick();
    } else second = f.location.selectLocation(place('Chosen', 53.5, -2.5));
    assert.equal(f.names[0].signal.aborted, true);
    f.names[0].resolve('Stale name'); await tick();
    assert.equal(f.state.location.name, replacement === 'gps' ? 'Nearby location' : 'Chosen');
    f.respond(); await second;
    if (replacement === 'gps') { f.names[1].resolve('Newest name'); await tick(); assert.equal(f.state.location.name, 'Newest name'); }
    assert.equal(JSON.parse(f.localStorage.getItem(LOCATION_HISTORY_STORAGE_KEY)).length, 1);
  }
});

test('starting a new GPS attempt invalidates the old name before replacement coordinates arrive', async () => {
  const f = fixture(); const first = f.location.useCurrentLocation();
  f.positions[0].resolve(coords()); await tick(); f.closeEvents(); f.respond(); await first;
  const second = f.location.useCurrentLocation();
  f.names[0].resolve('Obsolete name'); await tick();
  assert.equal(f.names[0].signal.aborted, true); assert.equal(f.state.location.name, 'Nearby location');
  f.positions[1].resolve(coords()); await tick(); f.respond(); await second;
  f.location.cancelLocationWork();
});

test('a late name does not restore a recent location the user removed', async () => {
  const f = fixture(); const started = f.location.useCurrentLocation();
  f.positions[0].resolve(coords()); await tick(); f.closeEvents(); f.respond(); await started;
  f.location.renderRecentLocations();
  f.elements.locationRecentList.children[0].children[1].emit('click');
  f.names[0].resolve('Manchester'); await tick();
  assert.equal(f.state.location.name, 'Manchester');
  assert.deepEqual(JSON.parse(f.localStorage.getItem(LOCATION_HISTORY_STORAGE_KEY)), []);
});

test('dismissal of a reopened sheet cancels its pending name without disturbing weather', async () => {
  const f = fixture(); const started = f.location.useCurrentLocation();
  f.positions[0].resolve(coords()); await tick(); f.closeEvents(); f.respond(); await started;
  const checked = f.state.lastCheckedAt;
  f.elements.locationDialog.open = true;
  f.location.closeLocationDialog(); f.closeEvents();
  assert.equal(f.names[0].signal.aborted, true);
  f.names[0].resolve('Cancelled name'); await tick();
  assert.equal(f.state.location.name, 'Nearby location'); assert.equal(f.state.lastCheckedAt, checked); assert.equal(f.requests.length, 1);
});

test('a service-level identical-coordinate replacement also invalidates a pending rename', () => {
  const f = fixture();
  f.weather.setLocation(place('Nearby location'), 'current'); const expected = f.state.location;
  f.weather.setLocation(expected, 'search');
  assert.equal(f.weather.renameLocation(expected, 'Obsolete name'), false);
  assert.equal(f.state.location.name, 'Nearby location');
});
