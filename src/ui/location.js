import { sameLocation } from '../services/storage.js';

export function createLocationController({
  state,
  elements,
  dialogScrollLock,
  hasRequestedLocation,
  markLocationRequested,
  reverseGeocodeLocation,
  formatSearchLocation,
  searchLocations,
  isUkPostcodeQuery,
  getBrowserLocation,
  weatherUrlForLocation,
  fetchWeather,
  setLocation,
  readLocationHistory,
  writeLocationHistory,
} = {}, environment = globalThis) {
  const { document, setTimeout, clearTimeout } = environment;

  let recentLocations = [];

  let locationSearchTimer;

  let locationSearchRequestId = 0;

  let locationAttemptId = 0;

  let locationFinding = false;

  let locationStatus = "";

  let locationRetry = false;

  function updateLocationUi() {
    const locationName = state.location.name || "Selected location";
    elements.locationName.textContent = locationName;
    elements.sourceLocationName.textContent = locationName;
    elements.liveWeatherRequest.href = weatherUrlForLocation();
  }

  function saveLocationHistory() {
    writeLocationHistory(recentLocations);
  }

  function loadLocationHistory(hasSavedLocation) {
    recentLocations = readLocationHistory(hasSavedLocation);
  }

  function rememberLocation(location) {
    recentLocations = [{ ...location }, ...recentLocations.filter(other => !sameLocation(location, other))].slice(0, 3);
    saveLocationHistory();
  }

  async function selectLocation(location) {
    locationAttemptId += 1;
    locationFinding = false;
    locationStatus = "";
    locationRetry = false;
    rememberLocation(location);
    setLocation(location, "search");
    closeLocationDialog();
    await fetchWeather();
  }

  function renderRecentLocations() {
    elements.locationRecentList.replaceChildren();
    elements.locationRecents.hidden = recentLocations.length === 0;
    recentLocations.forEach((location, index) => {
      const row = document.createElement("div");
      row.className = "location-recent-row";
      const select = document.createElement("button");
      select.type = "button";
      select.className = "location-recent-select";
      const name = document.createElement("span");
      name.textContent = location.name;
      select.append(name);
      if (sameLocation(location, state.location)) {
        select.setAttribute("aria-current", "location");
      }
      select.addEventListener("click", () => selectLocation(location));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "location-remove-button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove ${location.name} from recent places`);
      remove.title = "Remove from recent places";
      remove.addEventListener("click", () => {
        recentLocations.splice(index, 1);
        saveLocationHistory();
        renderRecentLocations();
        const buttons = elements.locationRecentList.querySelectorAll(".location-remove-button");
        const next = buttons[Math.min(index, buttons.length - 1)];
        // The location action is disabled while locating, so search is the fallback then.
        (next || (locationFinding ? elements.locationSearchInput : elements.locationUpdateButton)).focus();
      });
      row.append(select, remove);
      elements.locationRecentList.append(row);
    });
  }

  function renderLocationIdle() {
    const typing = elements.locationSearchInput.value.trim().length > 0;
    elements.locationIdle.hidden = typing;
    elements.locationSearchResults.hidden = !typing;
    elements.locationClearButton.hidden = elements.locationSearchInput.value.length === 0;
    elements.locationCurrentName.textContent = state.location.name;
    elements.locationUpdateButton.disabled = locationFinding;
    elements.locationUpdateButton.textContent = locationFinding ? "Finding your location…" : locationRetry ? "Try again" : "Use current location";
    if (!typing) {
      elements.locationDialogStatus.textContent = locationStatus;
      renderRecentLocations();
    }
  }

  function cancelLocationSearch() {
    clearTimeout(locationSearchTimer);
    locationSearchRequestId += 1;
  }

  function handleLocationInput() {
    cancelLocationSearch();
    elements.locationSearchResults.replaceChildren();
    renderLocationIdle();
    const query = elements.locationSearchInput.value.trim();
    if (!query) return;
    elements.locationDialogStatus.textContent = query.length < 2 ? "Enter at least two characters." : "Searching…";
    if (query.length >= 2) locationSearchTimer = setTimeout(() => runLocationSearch(query), 300);
  }

  function addWorldwideSearchButton(query) {
    const button = document.createElement("button");
    button.className = "location-worldwide-button";
    button.type = "button";
    button.textContent = "Search worldwide";
    button.addEventListener("click", () => runLocationSearch(query, true));
    elements.locationSearchResults.append(button);
  }

  function renderLocationResults(results, query, worldwide = false) {
    elements.locationSearchResults.replaceChildren();

    if (!results.length) {
      const isPostcode = isUkPostcodeQuery(query);
      elements.locationDialogStatus.textContent = isPostcode
        ? "Postcode not found. Check it and try again."
        : worldwide
          ? "No matching locations found."
          : "No UK locations found.";
      if (!isPostcode && !worldwide) addWorldwideSearchButton(query);
      return;
    }

    results.forEach((result) => {
      const button = document.createElement("button");
      button.className = "location-result-button";
      button.type = "button";
      const label = formatSearchLocation(result);
      const [primary, ...secondary] = label.split(", ");
      const name = document.createElement("strong");
      name.textContent = primary;
      button.append(name);
      if (secondary.length) {
        const region = document.createElement("span");
        region.textContent = secondary.join(", ");
        button.append(region);
      }
      button.addEventListener("click", () => selectLocation({
        name: label, latitude: result.latitude, longitude: result.longitude,
      }));
      elements.locationSearchResults.append(button);
    });

    if (!worldwide && !isUkPostcodeQuery(query)) addWorldwideSearchButton(query);
  }

  async function handleLocationSearch(event) {
    event.preventDefault();
    clearTimeout(locationSearchTimer);
    const query = elements.locationSearchInput.value.trim();
    if (query.length < 2) {
      handleLocationInput();
      return;
    }
    await runLocationSearch(query);
  }

  async function runLocationSearch(query, worldwide = false) {
    const requestId = ++locationSearchRequestId;
    elements.locationSearchResults.replaceChildren();
    elements.locationDialogStatus.textContent = worldwide ? "Searching worldwide…" : "Searching…";
    try {
      const results = await searchLocations(query, worldwide);
      if (requestId !== locationSearchRequestId || !elements.locationDialog.open) return;
      elements.locationDialogStatus.textContent = results.length ? `${results.length} ${results.length === 1 ? "place" : "places"} found.` : "";
      renderLocationResults(results, query, worldwide);
    } catch {
      if (requestId !== locationSearchRequestId || !elements.locationDialog.open) return;
      elements.locationDialogStatus.textContent = "Location search is unavailable. Try again.";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "location-result-button";
      retry.textContent = "Try again";
      retry.addEventListener("click", () => runLocationSearch(query, worldwide));
      elements.locationSearchResults.append(retry);
    }
  }

  async function useCurrentLocation() {
    const attemptId = ++locationAttemptId;
    locationFinding = true;
    locationRetry = false;
    locationStatus = "";
    renderLocationIdle();

    try {
      const position = await getBrowserLocation();
      if (attemptId !== locationAttemptId) return;
      let locationName = "Nearby location";
      try {
        locationName = await reverseGeocodeLocation(position.coords.latitude, position.coords.longitude);
      } catch {
        // Weather can still be fetched when the locality lookup is unavailable.
      }
      if (attemptId !== locationAttemptId) return;
      setLocation(
        {
          name: locationName,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
        "current",
      );
      rememberLocation(state.location);
      closeLocationDialog();
      await fetchWeather();
    } catch (error) {
      if (attemptId !== locationAttemptId) return;
      locationStatus = error.code === 1
        ? "Location permission is blocked. Allow location in your browser or device settings, or search by town or postcode."
        : error.code === 3
          ? "Finding your location took too long. Try again or search by town or postcode."
          : "Couldn't find your location. Try again or search by town or postcode.";
      locationRetry = true;
      locationFinding = false;
      renderLocationIdle();
      if (!state.lastCheckedAt) await fetchWeather();
    } finally {
      if (attemptId === locationAttemptId) {
        locationFinding = false;
        renderLocationIdle();
      }
    }
  }

  function openLocationDialog() {
    cancelLocationSearch();
    locationStatus = "";
    locationRetry = false;
    elements.locationSearchInput.value = "";
    elements.locationSearchResults.replaceChildren();
    renderLocationIdle();
    dialogScrollLock.open(elements.locationDialog);
    document.querySelector("#locationDialogTitle").focus({ preventScroll: true });
  }

  function closeLocationDialog() {
    cancelLocationWork();
    if (elements.locationDialog.open) elements.locationDialog.close();
  }

  function cancelLocationWork() {
    cancelLocationSearch();
    locationAttemptId += 1;
    locationFinding = false;
  }

  async function initializeLocation(hasSavedLocation) {
    if (hasSavedLocation || hasRequestedLocation()) {
      await fetchWeather();
      return;
    }

    markLocationRequested();
    await useCurrentLocation();
  }

  return { updateLocationUi, loadLocationHistory, rememberLocation, selectLocation, renderRecentLocations, renderLocationIdle, cancelLocationSearch, handleLocationInput, handleLocationSearch, runLocationSearch, useCurrentLocation, openLocationDialog, closeLocationDialog, cancelLocationWork, initializeLocation };
}
