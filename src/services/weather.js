import { dewPoint } from '../domain/humidity.js';
import { buildForecast } from '../domain/forecast.js';
import { WEATHER_ENDPOINT, DEFAULT_PRESSURE_HPA, WEATHER_REQUEST_TIMEOUT_MS } from '../config.js';

export function createWeatherController({
  state,
  elements,
  saveLocation,
  updateLocationUi,
  formatShortTime,
  render,
} = {}, environment = globalThis) {
  const { fetch, Date, setTimeout, clearTimeout, AbortController } = environment;

  let activeWeatherRequestId = 0;
  let activeWeatherAbort = null;

  function abortActiveRequest() {
    activeWeatherAbort?.abort();
    activeWeatherAbort = null;
  }

  let checkedLabelTimer = null;

  function updateWeatherCheckedLabel() {
    if (checkedLabelTimer !== null) clearTimeout(checkedLabelTimer);
    checkedLabelTimer = null;
    if (state.weatherRequestPending || state.weatherLoadFailed || !state.lastSuccessfulUpdateAt) return;
    const elapsed = Math.max(0, Date.now() - state.lastSuccessfulUpdateAt.getTime());
    if (elapsed < 60_000) {
      elements.weatherStatus.textContent = "Checked just now";
      checkedLabelTimer = setTimeout(updateWeatherCheckedLabel, 60_000 - elapsed);
    } else {
      elements.weatherStatus.textContent = `Checked ${formatShortTime(state.lastSuccessfulUpdateAt)}`;
    }
  }

  function weatherUrlForLocation(location = state.location) {
    const params = new URLSearchParams({
      latitude: location.latitude.toFixed(4),
      longitude: location.longitude.toFixed(4),
      current: "temperature_2m,relative_humidity_2m,dew_point_2m,surface_pressure,wind_speed_10m,wind_direction_10m",
      hourly: "temperature_2m,relative_humidity_2m,dew_point_2m,surface_pressure,wind_speed_10m,wind_direction_10m,rain,showers,precipitation_probability",
      forecast_hours: "50",
      timeformat: "unixtime",
      timezone: "auto",
    });
    return `${WEATHER_ENDPOINT}?${params}`;
  }

  async function fetchWeather() {
    const requestId = ++activeWeatherRequestId;
    const requestLocation = { ...state.location };
    abortActiveRequest();
    const abort = new AbortController();
    activeWeatherAbort = abort;
    const timeout = setTimeout(() => abort.abort(), WEATHER_REQUEST_TIMEOUT_MS);
    if (checkedLabelTimer !== null) clearTimeout(checkedLabelTimer);
    checkedLabelTimer = null;
    state.weatherRequestPending = true;
    state.weatherLoadFailed = false;
    elements.weatherStatus.textContent = "Updating…";
    elements.recommendation.setAttribute("aria-busy", "true");
    elements.dashboardPanel.setAttribute("aria-busy", "true");
    elements.refreshWeather.disabled = true;
    render();

    try {
      const response = await fetch(weatherUrlForLocation(requestLocation), { signal: abort.signal });
      if (!response.ok) throw new Error("Weather request failed");
      const data = await response.json();
      if (requestId !== activeWeatherRequestId) return;
      const current = data.current ?? {};
      if (!Number.isFinite(current.temperature_2m) || !Number.isFinite(current.relative_humidity_2m)) {
        throw new Error("Incomplete weather data");
      }

      state.outdoorTemp = current.temperature_2m;
      state.outdoorRh = current.relative_humidity_2m;
      state.outdoorDewPoint = Number.isFinite(current.dew_point_2m)
        ? current.dew_point_2m
        : dewPoint(state.outdoorTemp, state.outdoorRh);
      state.outdoorPressure = Number.isFinite(current.surface_pressure)
        ? current.surface_pressure
        : DEFAULT_PRESSURE_HPA;
      state.outdoorWind = Number.isFinite(current.wind_speed_10m) ? current.wind_speed_10m : 0;
      state.outdoorWindDirection = Number.isFinite(current.wind_direction_10m) && current.wind_direction_10m >= 0 && current.wind_direction_10m <= 360 ? current.wind_direction_10m % 360 : null;
      state.forecast = buildForecast(data);
      state.updatedAt = current.time;
      state.lastCheckedAt = new Date();
      state.lastSuccessfulUpdateAt = state.lastCheckedAt;
      state.weatherLoadFailed = false;
      if (typeof data.timezone === "string" && data.timezone) state.timezone = data.timezone;

    } catch {
      if (requestId !== activeWeatherRequestId) return;
      state.lastCheckedAt = new Date();
      state.weatherLoadFailed = true;
      elements.weatherStatus.textContent = "Update failed";
    } finally {
      clearTimeout(timeout);
      if (requestId !== activeWeatherRequestId) return;
      activeWeatherAbort = null;
      state.weatherRequestPending = false;
      updateWeatherCheckedLabel();
      elements.recommendation.removeAttribute("aria-busy");
      elements.dashboardPanel.removeAttribute("aria-busy");
      elements.refreshWeather.disabled = false;
      render();
    }
  }

  function setLocation(location, mode) {
    activeWeatherRequestId += 1;
    abortActiveRequest();
    if (checkedLabelTimer !== null) clearTimeout(checkedLabelTimer);
    checkedLabelTimer = null;
    state.location = location;
    state.locationMode = mode;
    state.outdoorTemp = null;
    state.outdoorRh = null;
    state.outdoorDewPoint = null;
    state.forecast = [];
    state.updatedAt = null;
    state.lastCheckedAt = null;
    state.lastSuccessfulUpdateAt = null;
    state.weatherRequestPending = false;
    state.weatherLoadFailed = false;
    saveLocation();
    updateLocationUi();
    render();
  }

  return { updateWeatherCheckedLabel, weatherUrlForLocation, fetchWeather, setLocation };
}
