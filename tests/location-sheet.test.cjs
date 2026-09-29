const { test } = require('node:test');
const assert = require('node:assert/strict');
const { environment, callbacks } = require('./helpers/browser.cjs');
const { createLocationController } = require('../src/ui/location.js');
const { createDialogs } = require('../src/ui/dialogs.js');
const { createStorage } = require('../src/services/storage.js');
const { LOCATION_HISTORY_STORAGE_KEY } = require('../src/config.js');
function fixture() {
  let focus, weatherCalls = 0, nextTimer = 0;
  const timers = new Map(), storage = new Map();
  function element() {
    return { children: [], events: {}, hidden: false, value: '', textContent: '', open: true,
      append(...items) { this.children.push(...items); }, replaceChildren() { this.children = []; },
      setAttribute(name, value) { this[name] = value; }, addEventListener(name, fn) { this.events[name] = fn; },
      focus() { focus = this; }, close() { this.open = false; },
      querySelectorAll() { return this.children.flatMap(row => row.children.filter(child => child.className === 'location-remove-button')); }
    };
  }
  const elements = Object.fromEntries(['locationSearchInput','locationSearchResults','locationIdle','locationClearButton','locationCurrentName','locationUpdateButton','locationRecents','locationRecentList','locationDialogStatus','locationDialog'].map(key => [key, element()]));
  const state = { location: { name: 'Sale', latitude: 53.42, longitude: -2.32 }, lastCheckedAt: true };
  const context = environment({ elements, state, document: { createElement: element },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    setTimeout: (fn, delay) => { assert.equal(delay, 300); timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout: id => timers.delete(id),
    setLocation: location => { state.location = location; }, fetchWeather: async () => { weatherCalls++; },
    formatSearchLocation: result => result.name, isUkPostcodeQuery: query => /^M\d/.test(query),
    searchLocations: async () => [], reverseGeocodeLocation: async () => 'Device place'
  });
  const persistence = createStorage(context, context);
  Object.assign(context, createLocationController({ ...context, readLocationHistory:persistence.loadLocationHistory, writeLocationHistory:persistence.saveLocationHistory, ...callbacks(context, ['setLocation','fetchWeather','formatSearchLocation','isUkPostcodeQuery','searchLocations','reverseGeocodeLocation','getBrowserLocation']) }, context));
  return { context, elements, state, storage, timers, get focus() { return focus; }, get weatherCalls() { return weatherCalls; }, history: () => {
    context.renderRecentLocations();
    return elements.locationRecentList.children.map(row => ({name:row.children[0].children[0].textContent}));
  } };
}
const place = (name, latitude) => ({ name, latitude, longitude: 1 });
test('history seeds once, deduplicates, limits to three, and respects an emptied history', () => {
  const f = fixture(); f.context.loadLocationHistory(true);
  assert.equal(f.history()[0].name, 'Sale');
  for (const p of [place('A',1),place('B',2),place('C',3),place('B renamed',2)]) f.context.rememberLocation(p);
  assert.deepEqual(f.history().map(p => p.name), ['B renamed','C','A']);
  f.storage.set(LOCATION_HISTORY_STORAGE_KEY, '[]'); f.context.loadLocationHistory(true); assert.deepEqual(f.history(), []);
  f.storage.set(LOCATION_HISTORY_STORAGE_KEY, 'bad json'); f.context.loadLocationHistory(true); assert.deepEqual(f.history(), []);
  f.context.localStorage.getItem = () => { throw Error('blocked'); };
  f.context.localStorage.setItem = () => { throw Error('blocked'); };
  assert.doesNotThrow(() => { f.context.loadLocationHistory(true); f.context.rememberLocation(place('A',1)); });
});
test('remove never selects or closes; moves focus and persists empty history', () => {
  const f = fixture(); f.context.loadLocationHistory(true); f.context.rememberLocation(place('Other',1)); f.context.renderRecentLocations();
  f.elements.locationRecentList.children[0].children[1].events.click();
  assert.equal(f.state.location.name, 'Sale'); assert.equal(f.elements.locationDialog.open, true); assert.equal(f.weatherCalls, 0);
  assert.equal(f.focus, f.elements.locationRecentList.children[0].children[1]);
  f.focus.events.click(); assert.equal(f.focus, f.elements.locationUpdateButton);
  assert.equal(f.elements.locationRecents.hidden, true); assert.equal(f.storage.get(LOCATION_HISTORY_STORAGE_KEY), '[]');
});
test('typing debounces; clear and dismissal discard late results', async () => {
  const f = fixture(); const pending = [];
  f.context.searchLocations = query => new Promise(resolve => pending.push({query,resolve}));
  f.elements.locationSearchInput.value = 'Sa'; f.context.handleLocationInput();
  f.elements.locationSearchInput.value = 'Sale'; f.context.handleLocationInput();
  assert.equal(f.timers.size, 1); const run = [...f.timers.values()][0]();
  assert.equal(pending[0].query, 'Sale');
  f.elements.locationSearchInput.value = ''; f.context.handleLocationInput();
  pending[0].resolve([place('Stale',1)]); await run;
  assert.equal(f.elements.locationSearchResults.children.length, 0); assert.equal(f.elements.locationIdle.hidden, false);
  f.elements.locationSearchInput.value = 'New'; const next = f.context.runLocationSearch('New'); f.context.closeLocationDialog();
  pending[1].resolve([place('New',2)]); await next; assert.equal(f.elements.locationSearchResults.children.length, 0);
});
test('newest search wins; submit searches without selecting; errors can retry', async () => {
  const f = fixture(), pending = [];
  f.context.searchLocations = () => new Promise(resolve => pending.push(resolve));
  const old = f.context.runLocationSearch('Old');
  f.elements.locationSearchInput.value = 'New'; const current = f.context.handleLocationSearch({preventDefault(){}});
  pending[1]([place('New, Region',2)]); await current;
  pending[0]([place('Old',1)]); await old;
  assert.equal(f.elements.locationSearchResults.children[0].children[0].textContent, 'New');
  assert.equal(f.state.location.name, 'Sale');
  f.context.searchLocations = async () => { throw Error('offline'); };
  await f.context.runLocationSearch('New'); assert.match(f.elements.locationDialogStatus.textContent, /unavailable/);
  f.context.searchLocations = async () => [];
  await f.elements.locationSearchResults.children[0].events.click(); assert.match(f.elements.locationDialogStatus.textContent, /No UK/);
});
test('selection and dismissal invalidate pending device location and reverse lookup', async () => {
  for (const phase of ['coordinates','name']) {
    const f = fixture(); let finish;
    f.context.getBrowserLocation = phase === 'coordinates' ? () => new Promise(resolve => { finish = resolve; }) : async () => ({coords:{latitude:1,longitude:1}});
    if (phase === 'name') f.context.reverseGeocodeLocation = () => new Promise(resolve => { finish = resolve; });
    const pending = f.context.useCurrentLocation(); await new Promise(setImmediate);
    await f.context.selectLocation(place('Chosen',2));
    finish(phase === 'coordinates' ? {coords:{latitude:1,longitude:1}} : 'Device place'); await pending;
    assert.equal(f.state.location.name, 'Chosen'); assert.equal(f.weatherCalls, 1);
  }
  const f = fixture(); let finish;
  f.context.getBrowserLocation = () => new Promise(resolve => { finish = resolve; });
  const pending = f.context.useCurrentLocation(); f.context.closeLocationDialog();
  finish({coords:{latitude:1,longitude:1}}); await pending; assert.equal(f.state.location.name, 'Sale');
});
test('geolocation failure restores retry while preserving search and recents', async () => {
  for (const [code, message] of [[1,/permission is blocked/],[2,/Couldn't find/],[3,/too long/]]) {
    const f = fixture(); f.context.loadLocationHistory(true);
    f.context.getBrowserLocation = async () => { throw {code}; };
    await f.context.useCurrentLocation(); assert.match(f.elements.locationDialogStatus.textContent, message);
    assert.equal(f.elements.locationUpdateButton.disabled, false); assert.equal(f.elements.locationUpdateButton.textContent, 'Try again');
    assert.equal(f.elements.locationRecents.hidden, false);
  }
});
test('sheet release needs 120px even for a fast flick and cancelled drags reset', () => {
  const events = {}, styles = new Map(); let closed = 0;
  const surface = {classList:{add(){}},addEventListener:(name,fn)=>events[name]=fn,setPointerCapture(){},hasPointerCapture:()=>true,releasePointerCapture(){}};
  const dialog = {querySelector:selector=>selector === '.sheet-handle' ? null : surface,classList:{add(){},remove(){}},style:{removeProperty:name=>styles.delete(name)},close:()=>closed++,addEventListener(){}};
  const context = environment({window:{matchMedia:()=>({matches:true})}}); Object.assign(context,createDialogs({},context)); context.enableSheetDrag(dialog);
  const event = y => ({isPrimary:true,button:0,pointerId:1,clientY:y,target:{closest:()=>null}});
  for (const distance of [30,80,119]) { events.pointerdown(event(10)); events.pointermove(event(10+distance)); events.pointerup(event(10+distance)); }
  assert.equal(closed,0);
  events.pointerdown(event(10)); events.pointerup(event(130)); assert.equal(closed,1);
  events.pointerdown(event(10)); events.pointermove(event(160)); events.pointercancel(); events.pointerup(event(160)); assert.equal(closed,1);
  events.pointerdown({...event(10),target:{closest:()=>({})}}); events.pointerup(event(160)); assert.equal(closed,1);
});
