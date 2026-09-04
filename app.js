const SALE_WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=53.4252&longitude=-2.3244&current=temperature_2m,relative_humidity_2m&timezone=Europe%2FLondon";

const STORAGE_KEY = "dew-indoor-readings";
const MOISTURE_MARGIN = 0.4;
const WEATHER_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

const state = {
  indoorTemp: 24,
  indoorRh: 58,
  outdoorTemp: null,
  outdoorRh: null,
  updatedAt: null,
  lastCheckedAt: null,
};

const elements = {
  recommendation: document.querySelector(".recommendation"),
  decisionLabel: document.querySelector("#decisionLabel"),
  decisionSummary: document.querySelector("#decisionSummary"),
  weatherStatus: document.querySelector("#weatherStatus"),
  indoorTemp: document.querySelector("#indoorTemp"),
  indoorRh: document.querySelector("#indoorRh"),
  indoorTempOutput: document.querySelector("#indoorTempOutput"),
  indoorRhOutput: document.querySelector("#indoorRhOutput"),
  indoorTempValue: document.querySelector("#indoorTempValue"),
  indoorRhValue: document.querySelector("#indoorRhValue"),
  outdoorTempValue: document.querySelector("#outdoorTempValue"),
  outdoorRhValue: document.querySelector("#outdoorRhValue"),
  indoorDewPoint: document.querySelector("#indoorDewPoint"),
  outdoorDewPoint: document.querySelector("#outdoorDewPoint"),
  indoorAbsoluteHumidity: document.querySelector("#indoorAbsoluteHumidity"),
  outdoorAbsoluteHumidity: document.querySelector("#outdoorAbsoluteHumidity"),
  warmingTemp: document.querySelector("#warmingTemp"),
  warmedOutdoorRh: document.querySelector("#warmedOutdoorRh"),
  explanationText: document.querySelector("#explanationText"),
  refreshWeather: document.querySelector("#refreshWeather"),
  sourceButton: document.querySelector("#sourceButton"),
  sourcePopover: document.querySelector("#sourcePopover"),
};

function saturationVaporPressure(tempC) {
  return 6.112 * Math.exp((17.67 * tempC) / (tempC + 243.5));
}

function vaporPressure(tempC, relativeHumidity) {
  return saturationVaporPressure(tempC) * (relativeHumidity / 100);
}

function dewPoint(tempC, relativeHumidity) {
  const gamma = Math.log(relativeHumidity / 100) + (17.67 * tempC) / (243.5 + tempC);
  return (243.5 * gamma) / (17.67 - gamma);
}

function absoluteHumidity(tempC, relativeHumidity) {
  const pressure = vaporPressure(tempC, relativeHumidity);
  return (216.7 * pressure) / (tempC + 273.15);
}

function relativeHumidityAtTemperature(actualVaporPressure, newTempC) {
  return (actualVaporPressure / saturationVaporPressure(newTempC)) * 100;
}

function formatTemp(value) {
  return `${value.toFixed(1)}\u00b0C`;
}

function formatRh(value) {
  return `${Math.round(value)}%`;
}

function formatMoisture(value) {
  return `${value.toFixed(1)} g/m3`;
}

function formatShortTime(date) {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function minutesSince(date) {
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
}

function saveIndoorReadings() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ indoorTemp: state.indoorTemp, indoorRh: state.indoorRh }),
  );
}

function loadIndoorReadings() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;

  try {
    const parsed = JSON.parse(saved);
    if (Number.isFinite(parsed.indoorTemp)) state.indoorTemp = parsed.indoorTemp;
    if (Number.isFinite(parsed.indoorRh)) state.indoorRh = parsed.indoorRh;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function render() {
  elements.indoorTemp.value = state.indoorTemp;
  elements.indoorRh.value = state.indoorRh;
  elements.indoorTempOutput.value = state.indoorTemp.toFixed(1);
  elements.indoorRhOutput.value = Math.round(state.indoorRh);
  elements.indoorTempValue.textContent = formatTemp(state.indoorTemp);
  elements.indoorRhValue.textContent = formatRh(state.indoorRh);
  elements.warmingTemp.textContent = formatTemp(state.indoorTemp);

  const indoorDew = dewPoint(state.indoorTemp, state.indoorRh);
  const indoorAbsolute = absoluteHumidity(state.indoorTemp, state.indoorRh);
  elements.indoorDewPoint.textContent = formatTemp(indoorDew);
  elements.indoorAbsoluteHumidity.textContent = formatMoisture(indoorAbsolute);
  elements.outdoorAbsoluteHumidity.classList.remove("lower", "higher", "near");

  if (state.outdoorTemp === null || state.outdoorRh === null) {
    elements.decisionLabel.textContent = "Checking weather";
    elements.decisionSummary.textContent = "Fetching current outdoor conditions.";
    elements.outdoorTempValue.textContent = "--";
    elements.outdoorRhValue.textContent = "--";
    elements.outdoorDewPoint.textContent = "--";
    elements.outdoorAbsoluteHumidity.textContent = "--";
    elements.warmedOutdoorRh.textContent = "--";
    return;
  }

  const outdoorDew = dewPoint(state.outdoorTemp, state.outdoorRh);
  const outdoorAbsolute = absoluteHumidity(state.outdoorTemp, state.outdoorRh);
  const outdoorPressure = vaporPressure(state.outdoorTemp, state.outdoorRh);
  const warmedRh = relativeHumidityAtTemperature(outdoorPressure, state.indoorTemp);
  const difference = indoorAbsolute - outdoorAbsolute;
  const percentDifference = (Math.abs(difference) / indoorAbsolute) * 100;

  elements.outdoorTempValue.textContent = formatTemp(state.outdoorTemp);
  elements.outdoorRhValue.textContent = formatRh(state.outdoorRh);
  elements.outdoorDewPoint.textContent = formatTemp(outdoorDew);
  elements.outdoorAbsoluteHumidity.textContent = formatMoisture(outdoorAbsolute);
  elements.warmedOutdoorRh.textContent = formatRh(warmedRh);
  elements.outdoorAbsoluteHumidity.classList.toggle("lower", difference > MOISTURE_MARGIN);
  elements.outdoorAbsoluteHumidity.classList.toggle("higher", difference < -MOISTURE_MARGIN);
  elements.outdoorAbsoluteHumidity.classList.toggle("near", Math.abs(difference) <= MOISTURE_MARGIN);

  elements.recommendation.classList.remove("open", "closed", "caution");

  if (difference > MOISTURE_MARGIN) {
    elements.recommendation.classList.add("open");
    elements.decisionLabel.textContent = "OPEN WINDOWS";
    elements.decisionSummary.textContent = "Good time to ventilate.";
    elements.explanationText.textContent = `Outdoor air currently contains ${percentDifference.toFixed(
      0,
    )}% less moisture than indoor air, so ventilation should reduce indoor humidity. Once warmed indoors it would be about ${formatRh(
      warmedRh,
    )} RH.`;
  } else if (difference < -MOISTURE_MARGIN) {
    elements.recommendation.classList.add("closed");
    elements.decisionLabel.textContent = "KEEP CLOSED";
    elements.decisionSummary.textContent = "Outdoor air is wetter than your indoor air.";
    elements.explanationText.textContent = `Outdoor air currently contains ${percentDifference.toFixed(
      0,
    )}% more moisture than indoor air, so ventilation would probably raise indoor humidity. Once warmed indoors it would be about ${formatRh(
      warmedRh,
    )} RH.`;
  } else {
    elements.recommendation.classList.add("caution");
    elements.decisionLabel.textContent = "KEEP CLOSED";
    elements.decisionSummary.textContent = "The moisture difference is small right now.";
    elements.explanationText.textContent = `Indoor and outdoor air contain almost the same amount of moisture. Ventilating now is unlikely to make much difference; warmed outdoor air would be about ${formatRh(
      warmedRh,
    )} RH.`;
  }
}

async function fetchWeather() {
  elements.weatherStatus.textContent = "Updating weather...";
  elements.refreshWeather.disabled = true;

  try {
    const response = await fetch(SALE_WEATHER_URL);
    if (!response.ok) throw new Error("Weather request failed");

    const data = await response.json();
    state.outdoorTemp = data.current.temperature_2m;
    state.outdoorRh = data.current.relative_humidity_2m;
    state.updatedAt = data.current.time;
    state.lastCheckedAt = new Date();
    const dataTime = new Date(state.updatedAt);
    const dataAge = minutesSince(dataTime);
    const checkedTime = formatShortTime(state.lastCheckedAt);
    elements.weatherStatus.textContent = `Weather ${formatShortTime(dataTime)} · checked ${checkedTime}`;
    if (dataAge >= 60) {
      elements.weatherStatus.textContent = `Weather ${formatShortTime(dataTime)} · ${dataAge} min old`;
    }
  } catch {
    elements.weatherStatus.textContent = "Weather unavailable";
    elements.decisionLabel.textContent = "ENTER READINGS";
    elements.decisionSummary.textContent =
      "Outdoor weather could not be loaded. Check your connection and try refresh.";
  } finally {
    elements.refreshWeather.disabled = false;
    render();
  }
}

function bindEvents() {
  elements.indoorTemp.addEventListener("input", (event) => {
    state.indoorTemp = Number(event.target.value);
    saveIndoorReadings();
    render();
  });

  elements.indoorRh.addEventListener("input", (event) => {
    state.indoorRh = Number(event.target.value);
    saveIndoorReadings();
    render();
  });

  elements.refreshWeather.addEventListener("click", fetchWeather);

  elements.sourceButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = elements.sourceButton.getAttribute("aria-expanded") === "true";
    setSourcePopoverOpen(!isOpen);
  });

  elements.sourcePopover.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("click", () => setSourcePopoverOpen(false));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setSourcePopoverOpen(false);
  });
}

function setSourcePopoverOpen(isOpen) {
  elements.sourceButton.setAttribute("aria-expanded", String(isOpen));
  elements.sourcePopover.hidden = !isOpen;
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}

loadIndoorReadings();
bindEvents();
render();
fetchWeather();
setInterval(fetchWeather, WEATHER_REFRESH_INTERVAL_MS);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (!state.lastCheckedAt || minutesSince(state.lastCheckedAt) >= 15) fetchWeather();
});
