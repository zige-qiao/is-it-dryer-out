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
  const { localStorage, Date } = environment;

  function saveIndoorReadings(source = null) {
    state.indoorReadingSource = source;
    state.indoorLastSet = Date.now();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ indoorTemp: state.indoorTemp, indoorRh: state.indoorRh, indoorLastSet: state.indoorLastSet }),
    );
  }

  function savePlanSettings() {
    localStorage.setItem(
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
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      state.indoorTemp = numberInRange(parsed.indoorTemp, INDOOR_LIMITS.temperature.min, INDOOR_LIMITS.temperature.max, state.indoorTemp);
      state.indoorRh = numberInRange(parsed.indoorRh, INDOOR_LIMITS.humidity.min, INDOOR_LIMITS.humidity.max, state.indoorRh);
      state.indoorLastSet = Number.isFinite(parsed.indoorLastSet) && parsed.indoorLastSet > 0 && parsed.indoorLastSet <= Date.now() ? parsed.indoorLastSet : null;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function loadPlanSettings() {
    const saved = localStorage.getItem(PLAN_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      state.targetRh = numberInRange(parsed.targetRh, 40, 65, state.targetRh);
      state.minTemp = Math.round(numberInRange(parsed.minTemp, 16, 26, state.minTemp));
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
      localStorage.removeItem(PLAN_STORAGE_KEY);
    }
  }

  function loadUiPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem(UI_PREFERENCES_STORAGE_KEY));
      if (typeof saved?.showIndoorSummary === 'boolean') uiPreferences.showIndoorSummary = saved.showIndoorSummary;
      if (typeof saved?.autoFlash === 'boolean') uiPreferences.autoFlash = saved.autoFlash;
      if (typeof saved?.openIndoorOnLaunch === 'boolean') uiPreferences.openIndoorOnLaunch = saved.openIndoorOnLaunch;
    } catch { /* Keep the defaults if browser storage is unavailable or invalid. */ }
    applyUiPreferences();
  }

  function saveUiPreferences() {
    try { localStorage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify(uiPreferences)); }
    catch { /* The switches still work for this page session. */ }
  }

  function saveLocation() {
    try {
      localStorage.setItem(
        LOCATION_STORAGE_KEY,
        JSON.stringify({ location: state.location, mode: state.locationMode }),
      );
    } catch {
      // Location selection still works when browser storage is unavailable.
    }
  }

  function loadLocation() {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCATION_STORAGE_KEY));
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
      localStorage.removeItem(LOCATION_STORAGE_KEY);
    }
    return false;
  }

  function hasRequestedLocation() {
    try {
      return localStorage.getItem(LOCATION_REQUESTED_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  }

  function markLocationRequested() {
    try {
      localStorage.setItem(LOCATION_REQUESTED_STORAGE_KEY, "true");
    } catch {
      // The browser may request location again when storage is unavailable.
    }
  }

  function saveLocationHistory(locations) {
    try { localStorage.setItem(LOCATION_HISTORY_STORAGE_KEY, JSON.stringify(locations)); } catch {}
  }

  function loadLocationHistory(hasSavedLocation) {
    let stored;
    try { stored = localStorage.getItem(LOCATION_HISTORY_STORAGE_KEY); } catch {}
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
