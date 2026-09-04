const SALE_WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=53.4252&longitude=-2.3244&current=temperature_2m,relative_humidity_2m&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m&forecast_hours=12&timezone=Europe%2FLondon";

const STORAGE_KEY = "dew-indoor-readings";
const PLAN_STORAGE_KEY = "is-it-dryer-out-plan";
const MOISTURE_MARGIN = 0.4;
const WEATHER_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const MAX_OPEN_MINUTES = 180;
const TARGET_MARGIN_RH = 0.5;
const VENTILATION_SPEEDS = {
  slow: { label: "Slow", airRate: 0.8, heatRate: 0.22 },
  normal: { label: "Normal", airRate: 1.8, heatRate: 0.42 },
  fast: { label: "Fast", airRate: 3.4, heatRate: 0.75 },
};

const state = {
  indoorTemp: 24,
  indoorRh: 58,
  targetRh: 55,
  minTemp: 21,
  ventilationSpeed: "normal",
  outdoorTemp: null,
  outdoorRh: null,
  forecast: [],
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
  lastCheckedStatus: document.querySelector("#lastCheckedStatus"),
  targetRh: document.querySelector("#targetRh"),
  minTemp: document.querySelector("#minTemp"),
  ventilationSpeed: document.querySelector("#ventilationSpeed"),
  targetRhOutput: document.querySelector("#targetRhOutput"),
  minTempOutput: document.querySelector("#minTempOutput"),
  planConfidence: document.querySelector("#planConfidence"),
  planLabel: document.querySelector("#planLabel"),
  planDuration: document.querySelector("#planDuration"),
  planDetails: document.querySelector("#planDetails"),
  forecastStrip: document.querySelector("#forecastStrip"),
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

function vaporPressureFromAbsoluteHumidity(humidity, tempC) {
  return (humidity * (tempC + 273.15)) / 216.7;
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

function formatDuration(minutes) {
  if (!Number.isFinite(minutes)) return "--";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
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

function savePlanSettings() {
  localStorage.setItem(
    PLAN_STORAGE_KEY,
    JSON.stringify({
      targetRh: state.targetRh,
      minTemp: state.minTemp,
      ventilationSpeed: state.ventilationSpeed,
    }),
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

function loadPlanSettings() {
  const saved = localStorage.getItem(PLAN_STORAGE_KEY);
  if (!saved) return;

  try {
    const parsed = JSON.parse(saved);
    if (Number.isFinite(parsed.targetRh)) state.targetRh = parsed.targetRh;
    if (Number.isFinite(parsed.minTemp)) state.minTemp = parsed.minTemp;
    if (VENTILATION_SPEEDS[parsed.ventilationSpeed]) state.ventilationSpeed = parsed.ventilationSpeed;
  } catch {
    localStorage.removeItem(PLAN_STORAGE_KEY);
  }
}

function buildForecast(data) {
  const times = data.hourly?.time ?? [];
  const temperatures = data.hourly?.temperature_2m ?? [];
  const humidities = data.hourly?.relative_humidity_2m ?? [];
  const winds = data.hourly?.wind_speed_10m ?? [];

  return times
    .map((time, index) => ({
      time: new Date(time),
      temp: temperatures[index],
      rh: humidities[index],
      wind: winds[index],
    }))
    .filter((item) => Number.isFinite(item.temp) && Number.isFinite(item.rh));
}

function estimateOpeningWindowPlan(weather) {
  const speed = VENTILATION_SPEEDS[state.ventilationSpeed] ?? VENTILATION_SPEEDS.normal;
  const indoorAbsolute = absoluteHumidity(state.indoorTemp, state.indoorRh);
  const outdoorAbsolute = absoluteHumidity(weather.temp, weather.rh);
  const startsTooWet = outdoorAbsolute >= indoorAbsolute - MOISTURE_MARGIN;
  let lastComfortableMinute = 0;
  let finalTemp = state.indoorTemp;
  let finalRh = state.indoorRh;

  for (let minute = 1; minute <= MAX_OPEN_MINUTES; minute += 1) {
    const hours = minute / 60;
    const projectedAbsolute =
      outdoorAbsolute + (indoorAbsolute - outdoorAbsolute) * Math.exp(-speed.airRate * hours);
    const projectedTemp =
      weather.temp + (state.indoorTemp - weather.temp) * Math.exp(-speed.heatRate * hours);
    const projectedPressure = vaporPressureFromAbsoluteHumidity(projectedAbsolute, projectedTemp);
    const projectedRh = relativeHumidityAtTemperature(projectedPressure, projectedTemp);
    finalTemp = projectedTemp;
    finalRh = projectedRh;

    if (projectedTemp < state.minTemp) {
      return {
        status: startsTooWet ? "wetter" : "too-cold",
        minutes: null,
        limitMinutes: lastComfortableMinute,
        projectedTemp,
        projectedRh,
      };
    }

    lastComfortableMinute = minute;

    if (!startsTooWet && projectedRh <= state.targetRh + TARGET_MARGIN_RH) {
      return {
        status: "good",
        minutes: minute,
        limitMinutes: minute,
        projectedTemp,
        projectedRh,
      };
    }
  }

  return {
    status: startsTooWet ? "wetter" : "slow",
    minutes: null,
    limitMinutes: lastComfortableMinute,
    projectedTemp: finalTemp,
    projectedRh: finalRh,
  };
}

function renderPlan() {
  elements.targetRh.value = state.targetRh;
  elements.minTemp.value = state.minTemp;
  elements.ventilationSpeed.value = state.ventilationSpeed;
  elements.targetRhOutput.value = Math.round(state.targetRh);
  elements.minTempOutput.value = state.minTemp.toFixed(1).replace(".0", "");
  elements.forecastStrip.innerHTML = "";

  if (state.outdoorTemp === null || state.outdoorRh === null) {
    elements.planConfidence.textContent = "Estimate";
    elements.planLabel.textContent = "Waiting for forecast";
    elements.planDuration.textContent = "--";
    elements.planDetails.textContent = "Set your comfort limits, then check outdoor conditions.";
    return;
  }

  const currentPlan = estimateOpeningWindowPlan({ temp: state.outdoorTemp, rh: state.outdoorRh });
  const speed = VENTILATION_SPEEDS[state.ventilationSpeed] ?? VENTILATION_SPEEDS.normal;
  elements.planConfidence.textContent = `${speed.label} ventilation`;

  if (currentPlan.status === "good") {
    elements.planLabel.textContent = "Open now";
    elements.planDuration.textContent = formatDuration(currentPlan.minutes);
    elements.planDetails.textContent = `Expected indoor conditions: about ${formatRh(
      currentPlan.projectedRh,
    )} RH and ${formatTemp(currentPlan.projectedTemp)} indoors.`;
  } else if (currentPlan.status === "too-cold") {
    elements.planLabel.textContent = "Too cold for target";
    elements.planDuration.textContent = currentPlan.limitMinutes
      ? formatDuration(currentPlan.limitMinutes)
      : "Avoid";
    elements.planDetails.textContent = `Humidity may improve, but the room is estimated to reach ${formatTemp(
      state.minTemp,
    )} before ${formatRh(state.targetRh)} RH.`;
  } else if (currentPlan.status === "slow") {
    elements.planLabel.textContent = "Humidity improves slowly";
    elements.planDuration.textContent = currentPlan.limitMinutes
      ? `${formatDuration(currentPlan.limitMinutes)}+`
      : "Avoid";
    elements.planDetails.textContent = `Outdoor air is drier, but it may not reach ${formatRh(
      state.targetRh,
    )} RH within three hours.`;
  } else {
    elements.planLabel.textContent = "Not useful now";
    elements.planDuration.textContent = "Avoid";
    elements.planDetails.textContent = "Outdoor air is not dry enough to move the room toward your target.";
  }

  state.forecast.slice(0, 8).forEach((item, index) => {
    const plan = estimateOpeningWindowPlan(item);
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = `forecast-pill ${plan.status}`;
    pill.setAttribute(
      "aria-label",
      `${index === 0 ? "Now" : formatShortTime(item.time)}: ${
        plan.minutes ? formatDuration(plan.minutes) : plan.status === "too-cold" ? "too cold for your target" : "avoid opening"
      }`,
    );

    const time = document.createElement("span");
    time.textContent = index === 0 ? "Now" : formatShortTime(item.time);
    const value = document.createElement("strong");
    value.textContent = plan.minutes
      ? formatDuration(plan.minutes)
      : plan.status === "too-cold"
        ? "Colder"
        : "Avoid";
    const temp = document.createElement("small");
    temp.textContent = formatTemp(item.temp);

    pill.append(time, value, temp);
    elements.forecastStrip.append(pill);
  });
}

function render() {
  elements.indoorTemp.value = state.indoorTemp;
  elements.indoorRh.value = state.indoorRh;
  renderPlan();
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
    state.forecast = buildForecast(data);
    state.updatedAt = data.current.time;
    state.lastCheckedAt = new Date();
    const dataTime = new Date(state.updatedAt);
    const dataAge = minutesSince(dataTime);
    const checkedTime = formatShortTime(state.lastCheckedAt);
    elements.weatherStatus.textContent = `Live updated ${formatShortTime(dataTime)}`;
    elements.lastCheckedStatus.textContent = `Last checked ${checkedTime}`;
    if (dataAge >= 60) {
      elements.weatherStatus.textContent = `Live updated ${formatShortTime(dataTime)}`;
    }
  } catch {
    elements.weatherStatus.textContent = "Outdoor unavailable";
    elements.lastCheckedStatus.textContent = "Last check failed";
    elements.decisionLabel.textContent = "ENTER READINGS";
    elements.decisionSummary.textContent =
      "Outdoor conditions could not be loaded. Check your connection and try again.";
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

  elements.targetRh.addEventListener("input", (event) => {
    state.targetRh = Number(event.target.value);
    savePlanSettings();
    render();
  });

  elements.minTemp.addEventListener("input", (event) => {
    state.minTemp = Number(event.target.value);
    savePlanSettings();
    render();
  });

  elements.ventilationSpeed.addEventListener("change", (event) => {
    state.ventilationSpeed = event.target.value;
    savePlanSettings();
    render();
  });

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
loadPlanSettings();
bindEvents();
render();
fetchWeather();
setInterval(fetchWeather, WEATHER_REFRESH_INTERVAL_MS);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (!state.lastCheckedAt || minutesSince(state.lastCheckedAt) >= 15) fetchWeather();
});