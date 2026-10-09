import { INDOOR_LIMITS } from '../config.js';
import { numberInRange } from '../domain/humidity.js';
import { STORAGE_KEY, PLAN_STORAGE_KEY, UI_PREFERENCES_STORAGE_KEY, LOCATION_STORAGE_KEY, LOCATION_HISTORY_STORAGE_KEY, LOCATION_REQUESTED_STORAGE_KEY, ROOM_PRESETS, OPENING_SETUPS } from '../config.js';

export function validHistoryLocation(location) {
  return location && typeof location.name === "string" && location.name.trim() &&
    Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90 &&
    Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180;
}

export function sameLocation(a, b) {
  return a.latitude === b.latitude && a.longitude === b.longitude;
}

export function createStorage({
  state,
  uiPreferences,
  applyUiPreferences,
} = {}, environment = globalThis) {
  const { Date } = environment;
  // Blocked site data makes even reading `localStorage` throw, and a full store
  // rejects writes. Every access degrades to page-session state instead.
  const read = key => { try { return environment.localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { environment.localStorage.setItem(key, value); } catch {} };
  const remove = key => { try { environment.localStorage.removeItem(key); } catch {} };

  function saveIndoorReadings(source = null) {
    state.indoorReadingSource = source;
    state.indoorLastSet = Date.now();
    write(
      STORAGE_KEY,
      JSON.stringify({ indoorTemp: state.indoorTemp, indoorRh: state.indoorRh, indoorLastSet: state.indoorLastSet }),
    );
  }

  function savePlanSettings() {
    write(
      PLAN_STORAGE_KEY,
      JSON.stringify({
        targetRh: state.targetRh,
        minTemp: state.minTemp,
        roomPreset: state.roomPreset,
        roomLength: state.roomLength,
        roomWidth: state.roomWidth,
        roomHeight: state.roomHeight,
        openingSetup: state.openingSetup,
        customAirflow: state.customAirflow,
      }),
    );
  }

  function loadIndoorReadings() {
    const saved = read(STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      state.indoorTemp = numberInRange(parsed.indoorTemp, INDOOR_LIMITS.temperature.min, INDOOR_LIMITS.temperature.max, state.indoorTemp);
      state.indoorRh = numberInRange(parsed.indoorRh, INDOOR_LIMITS.humidity.min, INDOOR_LIMITS.humidity.max, state.indoorRh);
      state.indoorLastSet = Number.isFinite(parsed.indoorLastSet) && parsed.indoorLastSet > 0 && parsed.indoorLastSet <= Date.now() ? parsed.indoorLastSet : null;
    } catch {
      remove(STORAGE_KEY);
    }
  }

  function loadPlanSettings() {
    const saved = read(PLAN_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      state.targetRh = numberInRange(parsed.targetRh, 35, 65, state.targetRh);
      state.minTemp = Math.round(numberInRange(parsed.minTemp, 8, 28, state.minTemp));
      if (ROOM_PRESETS[parsed.roomPreset] || parsed.roomPreset === "custom") {
        state.roomPreset = parsed.roomPreset;
      }
      state.roomLength = numberInRange(parsed.roomLength, 1, 20, state.roomLength);
      state.roomWidth = numberInRange(parsed.roomWidth, 1, 20, state.roomWidth);
      state.roomHeight = numberInRange(parsed.roomHeight, 1.8, 5, state.roomHeight);
      const migratedOpening = { slow: "slightly", normal: "single", fast: "cross" }[
        parsed.ventilationSpeed
      ];
      const opening = parsed.openingSetup ?? migratedOpening;
      if (OPENING_SETUPS[opening] || opening === "custom") state.openingSetup = opening;
      state.customAirflow = numberInRange(parsed.customAirflow, 10, 500, state.customAirflow);
    } catch {
      remove(PLAN_STORAGE_KEY);
    }
  }

  function loadUiPreferences() {
    try {
      const saved = JSON.parse(read(UI_PREFERENCES_STORAGE_KEY));
      if (typeof saved?.showIndoorSummary === 'boolean') uiPreferences.showIndoorSummary = saved.showIndoorSummary;
      if (typeof saved?.autoFlash === 'boolean') uiPreferences.autoFlash = saved.autoFlash;
      for (const key of ['useStillPhotos', 'showCameraButton', 'showVoiceButton', 'showChartKey']) {
        if (typeof saved?.[key] === 'boolean') uiPreferences[key] = saved[key];
      }
      if (typeof saved?.openIndoorOnLaunch === 'boolean') uiPreferences.openIndoorOnLaunch = saved.openIndoorOnLaunch;
    } catch { /* Keep the defaults if browser storage is unavailable or invalid. */ }
    applyUiPreferences();
  }

  function saveUiPreferences() {
    write(UI_PREFERENCES_STORAGE_KEY, JSON.stringify(uiPreferences));
  }

  function saveLocation() {
    write(LOCATION_STORAGE_KEY, JSON.stringify({ location: state.location, mode: state.locationMode }));
  }

  function loadLocation() {
    try {
      const saved = JSON.parse(read(LOCATION_STORAGE_KEY));
      const location = saved?.location;
      if (
        location &&
        typeof location.name === "string" &&
        Number.isFinite(location.latitude) &&
        Number.isFinite(location.longitude)
      ) {
        state.location = location;
        state.locationMode = "current";
        return true;
      }
    } catch {
      remove(LOCATION_STORAGE_KEY);
    }
    return false;
  }

  function hasRequestedLocation() {
    return read(LOCATION_REQUESTED_STORAGE_KEY) === "true";
  }

  function markLocationRequested() {
    write(LOCATION_REQUESTED_STORAGE_KEY, "true");
  }

  function saveLocationHistory(locations) {
    write(LOCATION_HISTORY_STORAGE_KEY, JSON.stringify(locations));
  }

  function loadLocationHistory(hasSavedLocation) {
    const stored = read(LOCATION_HISTORY_STORAGE_KEY);
    if (stored == null) {
      const locations = hasSavedLocation ? [{ ...state.location }] : [];
      saveLocationHistory(locations);
      return locations;
    }
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.filter(validHistoryLocation)
        .filter((location, index, all) => all.findIndex(other => sameLocation(location, other)) === index).slice(0, 3) : [];
    } catch { return []; }
  }

  return { saveIndoorReadings, savePlanSettings, loadIndoorReadings, loadPlanSettings, loadUiPreferences, saveUiPreferences, saveLocation, loadLocation, hasRequestedLocation, markLocationRequested, saveLocationHistory, loadLocationHistory };
}
