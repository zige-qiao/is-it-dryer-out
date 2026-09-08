const WEATHER_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const REVERSE_GEOCODING_ENDPOINT = "https://api.bigdatacloud.net/data/reverse-geocode-client";
const DEFAULT_LOCATION = {
  name: "Sale, Greater Manchester",
  latitude: 53.4252,
  longitude: -2.3244,
};
const LOCATION_LABEL_OVERRIDES = new Map([
  ["Stretford, Greater Manchester", "Sale, Greater Manchester"],
]);
const STORAGE_KEY = "dew-indoor-readings";
const PLAN_STORAGE_KEY = "is-it-dryer-out-plan";
const LOCATION_STORAGE_KEY = "is-it-dryer-out-location";
const DEFAULT_TIMEZONE = "Europe/London";
const DEFAULT_PRESSURE_HPA = 1013.25;
const MINIMUM_MOISTURE_MARGIN = 0.4;
const WEATHER_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const MAX_OPEN_MINUTES = 180;
const TARGET_MARGIN_RH = 0.5;
const THERMAL_RESPONSE_FACTOR = 0.22;
const ROOM_PRESETS = { small: 30, medium: 50, large: 80 };
const OPENING_SETUPS = {
  slightly: { label: "Window slightly open", airflow: 25 },
  single: { label: "One window fully open", airflow: 80 },
  cross: { label: "Cross-ventilation", airflow: 180 },
};
const INPUT_UNCERTAINTY = {
  indoorTemp: 0.3,
  indoorRh: 2,
  outdoorTemp: 0.5,
  outdoorRh: 3,
};

const state = {
  indoorTemp: 24,
  indoorRh: 58,
  targetRh: 55,
  minTemp: 21,
  roomPreset: "medium",
  roomLength: 4,
  roomWidth: 5,
  roomHeight: 2.5,
  openingSetup: "single",
  customAirflow: 80,
  outdoorTemp: null,
  outdoorRh: null,
  outdoorDewPoint: null,
  outdoorPressure: DEFAULT_PRESSURE_HPA,
  outdoorWind: 0,
  forecast: [],
  updatedAt: null,
  lastCheckedAt: null,
  weatherLoadFailed: false,
  timezone: DEFAULT_TIMEZONE,
  location: { ...DEFAULT_LOCATION },
  locationMode: "current",
};

const elements = {
  recommendation: document.querySelector(".recommendation"),
  decisionLabel: document.querySelector("#decisionLabel"),
  decisionPrimary: document.querySelector("#decisionPrimary"),
  decisionSecondary: document.querySelector("#decisionSecondary"),
  weatherStatus: document.querySelector("#weatherStatus"),
  indoorTemp: document.querySelector("#indoorTemp"),
  indoorRh: document.querySelector("#indoorRh"),
  indoorTempInput: document.querySelector("#indoorTempInput"),
  indoorRhInput: document.querySelector("#indoorRhInput"),
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
  adjustedAirNote: document.querySelector("#adjustedAirNote"),
  explanationText: document.querySelector("#explanationText"),
  refreshWeather: document.querySelector("#refreshWeather"),
  targetRh: document.querySelector("#targetRh"),
  minTemp: document.querySelector("#minTemp"),
  targetRhInput: document.querySelector("#targetRhInput"),
  minTempInput: document.querySelector("#minTempInput"),
  roomPreset: document.querySelector("#roomPreset"),
  customRoomFields: document.querySelector("#customRoomFields"),
  roomLength: document.querySelector("#roomLength"),
  roomWidth: document.querySelector("#roomWidth"),
  roomHeight: document.querySelector("#roomHeight"),
  roomVolume: document.querySelector("#roomVolume"),
  openingSetup: document.querySelector("#openingSetup"),
  customFlowField: document.querySelector("#customFlowField"),
  customAirflow: document.querySelector("#customAirflow"),
  planConfidence: document.querySelector("#planConfidence"),
  planLabel: document.querySelector("#planLabel"),
  planDuration: document.querySelector("#planDuration"),
  planDetails: document.querySelector("#planDetails"),
  forecastStrip: document.querySelector("#forecastStrip"),
  sourceButton: document.querySelector("#sourceButton"),
  sourcePopover: document.querySelector("#sourcePopover"),
  locationName: document.querySelector("#locationName"),
  sourceLocationName: document.querySelector("#sourceLocationName"),
  liveWeatherRequest: document.querySelector("#liveWeatherRequest"),
  locationButton: document.querySelector("#locationButton"),
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function numberInRange(value, min, max, fallback) {
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

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
  return (216.7 * vaporPressure(tempC, relativeHumidity)) / (tempC + 273.15);
}

function relativeHumidityAtTemperature(actualVaporPressure, newTempC) {
  return (actualVaporPressure / saturationVaporPressure(newTempC)) * 100;
}

function humidityRatioFromVaporPressure(actualVaporPressure, pressureHpa) {
  return (0.62198 * actualVaporPressure) / (pressureHpa - actualVaporPressure);
}

function vaporPressureFromHumidityRatio(ratio, pressureHpa) {
  return (ratio * pressureHpa) / (0.62198 + ratio);
}

function humidityRatio(tempC, relativeHumidity, pressureHpa = DEFAULT_PRESSURE_HPA) {
  return humidityRatioFromVaporPressure(vaporPressure(tempC, relativeHumidity), pressureHpa);
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
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: state.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    state.timezone = DEFAULT_TIMEZONE;
    return formatShortTime(date);
  }
}

function formatDuration(minutes) {
  if (!Number.isFinite(minutes)) return "--";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours} hr ${remaining} min` : `${hours} hr`;
}

function minutesSince(date) {
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
}

function dateFromApiTime(value) {
  return new Date(typeof value === "number" ? value * 1000 : value);
}

function roomVolume() {
  if (state.roomPreset !== "custom") return ROOM_PRESETS[state.roomPreset] ?? ROOM_PRESETS.medium;
  return state.roomLength * state.roomWidth * state.roomHeight;
}

function baseAirflow() {
  if (state.openingSetup === "custom") return state.customAirflow;
  return OPENING_SETUPS[state.openingSetup]?.airflow ?? OPENING_SETUPS.single.airflow;
}

function effectiveAirExchange(weather, indoorTemp) {
  const windKmh = Number.isFinite(weather.wind) ? weather.wind : 0;
  const temperatureDifference = Math.abs(indoorTemp - weather.temp);
  const conditionMultiplier = clamp(0.65 + windKmh / 40 + temperatureDifference / 30, 0.65, 2);
  const airflow = baseAirflow() * conditionMultiplier;
  return {
    airflow,
    airChangesPerHour: clamp(airflow / roomVolume(), 0.1, 12),
  };
}

function absoluteHumidityUncertainty(tempC, rh, tempError, rhError) {
  const temperatureContribution =
    (absoluteHumidity(tempC + tempError, rh) - absoluteHumidity(tempC - tempError, rh)) / 2;
  const humidityContribution =
    (absoluteHumidity(tempC, clamp(rh + rhError, 1, 100)) -
      absoluteHumidity(tempC, clamp(rh - rhError, 1, 100))) /
    2;
  return Math.hypot(temperatureContribution, humidityContribution);
}

function moistureMargin(indoorTemp, indoorRh, outdoorTemp, outdoorRh) {
  const indoorError = absoluteHumidityUncertainty(
    indoorTemp,
    indoorRh,
    INPUT_UNCERTAINTY.indoorTemp,
    INPUT_UNCERTAINTY.indoorRh,
  );
  const outdoorError = absoluteHumidityUncertainty(
    outdoorTemp,
    outdoorRh,
    INPUT_UNCERTAINTY.outdoorTemp,
    INPUT_UNCERTAINTY.outdoorRh,
  );
  return Math.max(MINIMUM_MOISTURE_MARGIN, Math.hypot(indoorError, outdoorError));
}

function compareMoisture(indoorTemp, indoorRh, outdoorTemp, outdoorRh) {
  const indoor = absoluteHumidity(indoorTemp, indoorRh);
  const outdoor = absoluteHumidity(outdoorTemp, outdoorRh);
  const margin = moistureMargin(indoorTemp, indoorRh, outdoorTemp, outdoorRh);
  const difference = indoor - outdoor;
  return {
    indoor,
    outdoor,
    difference,
    margin,
    status: difference > margin ? "drier" : difference < -margin ? "wetter" : "uncertain",
  };
}
function forecastHasBecomeLessDry(startWeather, weather) {
  const startAbsolute = absoluteHumidity(startWeather.temp, startWeather.rh);
  const weatherAbsolute = absoluteHumidity(weather.temp, weather.rh);
  const startUncertainty = absoluteHumidityUncertainty(
    startWeather.temp,
    startWeather.rh,
    INPUT_UNCERTAINTY.outdoorTemp,
    INPUT_UNCERTAINTY.outdoorRh,
  );
  const weatherUncertainty = absoluteHumidityUncertainty(
    weather.temp,
    weather.rh,
    INPUT_UNCERTAINTY.outdoorTemp,
    INPUT_UNCERTAINTY.outdoorRh,
  );
  const changeMargin = Math.max(
    MINIMUM_MOISTURE_MARGIN,
    Math.hypot(startUncertainty, weatherUncertainty),
  );
  return weatherAbsolute > startAbsolute + changeMargin;
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
    state.indoorTemp = numberInRange(parsed.indoorTemp, 10, 32, state.indoorTemp);
    state.indoorRh = numberInRange(parsed.indoorRh, 20, 90, state.indoorRh);
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
    state.minTemp = numberInRange(parsed.minTemp, 16, 26, state.minTemp);
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


function buildForecast(data) {
  const times = data.hourly?.time ?? [];
  const temperatures = data.hourly?.temperature_2m ?? [];
  const humidities = data.hourly?.relative_humidity_2m ?? [];
  const dewPoints = data.hourly?.dew_point_2m ?? [];
  const pressures = data.hourly?.surface_pressure ?? [];
  const winds = data.hourly?.wind_speed_10m ?? [];

  return times
    .map((time, index) => ({
      time: dateFromApiTime(time),
      temp: temperatures[index],
      rh: humidities[index],
      dewPoint: dewPoints[index],
      pressure: pressures[index],
      wind: winds[index],
    }))
    .filter(
      (item) =>
        Number.isFinite(item.time.getTime()) &&
        Number.isFinite(item.temp) &&
        Number.isFinite(item.rh) &&
        Number.isFinite(item.dewPoint),
    )
    .map((item) => ({
      ...item,
      pressure: Number.isFinite(item.pressure) ? item.pressure : DEFAULT_PRESSURE_HPA,
      wind: Number.isFinite(item.wind) ? item.wind : 0,
    }));
}

function currentWeather() {
  return {
    time: new Date(),
    observationTime: dateFromApiTime(state.updatedAt),
    temp: state.outdoorTemp,
    rh: state.outdoorRh,
    dewPoint: Number.isFinite(state.outdoorDewPoint)
      ? state.outdoorDewPoint
      : dewPoint(state.outdoorTemp, state.outdoorRh),
    pressure: state.outdoorPressure,
    wind: state.outdoorWind,
  };
}

function buildWeatherTimeline() {
  if (state.outdoorTemp === null || state.outdoorRh === null) return [];
  const current = currentWeather();
  return [current, ...state.forecast.filter((item) => item.time > current.time)];
}

function weatherAtTime(timeline, targetTime) {
  if (timeline.length === 1 || targetTime <= timeline[0].time) return timeline[0];

  let previous = timeline[0];
  for (const next of timeline.slice(1)) {
    if (targetTime <= next.time) {
      const interval = next.time.getTime() - previous.time.getTime();
      const progress = interval > 0 ? (targetTime.getTime() - previous.time.getTime()) / interval : 0;
      const temp = previous.temp + (next.temp - previous.temp) * progress;
      const dew = previous.dewPoint + (next.dewPoint - previous.dewPoint) * progress;
      const pressure = previous.pressure + (next.pressure - previous.pressure) * progress;
      const wind = previous.wind + (next.wind - previous.wind) * progress;
      return {
        time: targetTime,
        temp,
        dewPoint: dew,
        pressure,
        wind,
        rh: clamp(relativeHumidityAtTemperature(saturationVaporPressure(dew), temp), 0, 100),
      };
    }
    previous = next;
  }

  return { ...timeline.at(-1), time: targetTime };
}

function planResult(status, overrides = {}) {
  return {
    status,
    minutes: null,
    limitMinutes: 0,
    projectedTemp: state.indoorTemp,
    projectedRh: state.indoorRh,
    ...overrides,
  };
}

function reliableDryAirHorizon(startWeather, timeline) {
  const startTime = startWeather.time instanceof Date ? startWeather.time : new Date();
  for (let minute = 1; minute <= MAX_OPEN_MINUTES; minute += 1) {
    const weather = weatherAtTime(
      timeline,
      new Date(startTime.getTime() + minute * 60 * 1000),
    );
    const comparison = compareMoisture(
      state.indoorTemp,
      state.indoorRh,
      weather.temp,
      weather.rh,
    );
    if (comparison.status !== "drier") return minute - 1;
  }
  return MAX_OPEN_MINUTES;
}

function estimateOpeningWindowPlan(startWeather, timeline) {
  if (state.indoorRh <= state.targetRh + TARGET_MARGIN_RH) return planResult("target-met");
  if (state.indoorTemp < state.minTemp) return planResult("below-minimum");

  const initialComparison = compareMoisture(
    state.indoorTemp,
    state.indoorRh,
    startWeather.temp,
    startWeather.rh,
  );
  if (initialComparison.status === "wetter") return planResult("wetter");
  if (initialComparison.status === "uncertain") return planResult("uncertain");

  const startTime = startWeather.time instanceof Date ? startWeather.time : new Date();
  let projectedRatio = humidityRatio(
    state.indoorTemp,
    state.indoorRh,
    startWeather.pressure ?? state.outdoorPressure,
  );
  const initialAbsolute = initialComparison.indoor;
  let projectedTemp = state.indoorTemp;
  let projectedRh = state.indoorRh;
  let finalPressureHpa = startWeather.pressure ?? state.outdoorPressure;
  let lastComfortableMinute = 0;

  for (let minute = 1; minute <= MAX_OPEN_MINUTES; minute += 1) {
    const targetTime = new Date(startTime.getTime() + minute * 60 * 1000);
    const weather = weatherAtTime(timeline, targetTime);
    const projectedPressureHpa = Number.isFinite(weather.pressure)
      ? weather.pressure
      : state.outdoorPressure;
    finalPressureHpa = projectedPressureHpa;
    const outdoorRatio = humidityRatio(weather.temp, weather.rh, projectedPressureHpa);
    const projectedVaporBeforeMixing = vaporPressureFromHumidityRatio(
      projectedRatio,
      projectedPressureHpa,
    );
    const projectedRhBeforeMixing = clamp(
      relativeHumidityAtTemperature(projectedVaporBeforeMixing, projectedTemp),
      0,
      100,
    );
    const usefulness = compareMoisture(
      projectedTemp,
      projectedRhBeforeMixing,
      weather.temp,
      weather.rh,
    );

    if (usefulness.status !== "drier") {
      const status = forecastHasBecomeLessDry(startWeather, weather)
        ? "forecast-limit"
        : "settling";
      return planResult(status, {
        minutes: minute > 1 ? minute - 1 : null,
        limitMinutes: minute - 1,
        projectedTemp,
        projectedRh: projectedRhBeforeMixing,
      });
    }

    const exchange = effectiveAirExchange(weather, projectedTemp);
    const airExchangeFraction = 1 - Math.exp(-exchange.airChangesPerHour / 60);
    const heatChangesPerHour = exchange.airChangesPerHour * THERMAL_RESPONSE_FACTOR;
    const heatExchangeFraction = 1 - Math.exp(-heatChangesPerHour / 60);
    projectedRatio += (outdoorRatio - projectedRatio) * airExchangeFraction;
    projectedTemp += (weather.temp - projectedTemp) * heatExchangeFraction;

    const projectedVapor = vaporPressureFromHumidityRatio(projectedRatio, projectedPressureHpa);
    const saturation = saturationVaporPressure(projectedTemp);
    if (projectedVapor >= saturation) {
      return planResult("condensation", {
        limitMinutes: minute - 1,
        projectedTemp,
        projectedRh: 100,
      });
    }

    projectedRh = relativeHumidityAtTemperature(projectedVapor, projectedTemp);
    if (projectedTemp < state.minTemp) {
      return planResult("too-cold", {
        limitMinutes: lastComfortableMinute,
        projectedTemp,
        projectedRh,
      });
    }

    lastComfortableMinute = minute;
    const projectedAbsolute = (216.7 * projectedVapor) / (projectedTemp + 273.15);
    const netImprovement = initialAbsolute - projectedAbsolute;
    if (
      projectedRh <= state.targetRh + TARGET_MARGIN_RH &&
      netImprovement > initialComparison.margin
    ) {
      return planResult("good", {
        minutes: minute,
        limitMinutes: minute,
        projectedTemp,
        projectedRh,
      });
    }
  }

  const finalVapor = vaporPressureFromHumidityRatio(projectedRatio, finalPressureHpa);
  const finalAbsolute = (216.7 * finalVapor) / (projectedTemp + 273.15);
  return planResult(
    initialAbsolute - finalAbsolute > initialComparison.margin ? "slow" : "uncertain",
    {
      limitMinutes: lastComfortableMinute,
      projectedTemp,
      projectedRh,
    },
  );
}

function setPlanCopy(plan) {
  const copy = {
    "target-met": {
      label: "Humidity target met",
      duration: "No need",
      details: `Indoor humidity is already at or below ${formatRh(state.targetRh)}.`,
    },
    "below-minimum": {
      label: "Below temperature limit",
      duration: "Avoid",
      details: `The room is already below your ${formatTemp(state.minTemp)} minimum.`,
    },
    wetter: {
      label: "Outdoor air is wetter",
      duration: "Avoid",
      details: "Opening now is expected to add moisture to the room.",
    },
    uncertain: {
      label: "Difference is uncertain",
      duration: "Wait",
      details: "The moisture difference is too small compared with normal sensor uncertainty.",
    },
    good: {
      label: "Open now",
      duration: formatDuration(plan.minutes),
      details: `Expected indoor conditions: about ${formatRh(plan.projectedRh)} RH and ${formatTemp(
        plan.projectedTemp,
      )}.`,
    },
    "too-cold": {
      label: "Temperature limit first",
      duration: plan.limitMinutes ? formatDuration(plan.limitMinutes) : "Avoid",
      details: `The room is estimated to reach ${formatTemp(
        state.minTemp,
      )} before the humidity target.`,
    },
    condensation: {
      label: "Condensation risk",
      duration: plan.limitMinutes ? formatDuration(plan.limitMinutes) : "Avoid",
      details: "The model reaches saturation before the humidity target, so moisture may condense.",
    },
"forecast-limit": {
      label: "Conditions change",
      duration: plan.limitMinutes ? formatDuration(plan.limitMinutes) : "Wait",
      details: "Forecast air becomes less drying after this time.",
    },
    settling: {
      label: "Settling",
      duration: plan.minutes ? formatDuration(plan.minutes) : "No further benefit",
      details: "Indoor humidity is expected to settle near " + formatRh(plan.projectedRh) + " RH.",
    },
    slow: {
      label: "Humidity improves slowly",
      duration: plan.limitMinutes ? `${formatDuration(plan.limitMinutes)}+` : "Wait",
      details: `The room may not reach ${formatRh(state.targetRh)} within three hours.`,
    },
  }[plan.status];

  elements.planLabel.textContent = copy.label;
  elements.planDuration.textContent = copy.duration;
  elements.planDetails.textContent = copy.details;
}


function renderPlanControls() {
  elements.targetRh.value = state.targetRh;
  elements.minTemp.value = state.minTemp;
  elements.targetRhInput.value = Math.round(state.targetRh);
  elements.minTempInput.value = state.minTemp.toFixed(1).replace(".0", "");
  elements.roomPreset.value = state.roomPreset;
  elements.roomLength.value = state.roomLength;
  elements.roomWidth.value = state.roomWidth;
  elements.roomHeight.value = state.roomHeight;
  elements.roomVolume.textContent = `${roomVolume().toFixed(1).replace(".0", "")} m3`;
  elements.customRoomFields.hidden = state.roomPreset !== "custom";
  elements.openingSetup.value = state.openingSetup;
  elements.customAirflow.value = state.customAirflow;
  elements.customFlowField.hidden = state.openingSetup !== "custom";
}

function renderPlan() {
  renderPlanControls();
  elements.forecastStrip.innerHTML = "";

  const timeline = buildWeatherTimeline();
  if (!timeline.length) {
    elements.planConfidence.textContent = "Rough estimate";
    elements.planLabel.textContent = "Waiting for forecast";
    elements.planDuration.textContent = "--";
    elements.planDetails.textContent = "Set your limits, then check outdoor conditions.";
    return null;
  }

  const current = timeline[0];
  const currentPlan = estimateOpeningWindowPlan(current, timeline);
  if (["good", "settling", "too-cold", "condensation"].includes(currentPlan.status)) {
    currentPlan.reliableDryMinutes = reliableDryAirHorizon(current, timeline);
  }
  const exchange = effectiveAirExchange(current, state.indoorTemp);
  elements.planConfidence.textContent = `About ${exchange.airChangesPerHour.toFixed(1)} air changes/hr`;
  setPlanCopy(currentPlan);

  const forecastStarts = [
    current,
    ...state.forecast.filter((item) => item.time > current.time),
  ].slice(0, 8);
  const labels = {
    "target-met": "No need",
    "below-minimum": "Below min",
    wetter: "Avoid",
    uncertain: "Uncertain",
    "too-cold": "Temp limit",
    condensation: "Condense",
    "forecast-limit": "Until change",
    settling: "Settling",
    slow: "Slow",
  };

  forecastStarts.forEach((item, index) => {
    const plan = estimateOpeningWindowPlan(item, timeline);
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = `forecast-pill ${plan.status}`;
    const valueLabel = plan.minutes ? formatDuration(plan.minutes) : labels[plan.status];
    const timeLabel = index === 0 ? "Now" : formatShortTime(item.time);
    pill.setAttribute("aria-label", `${timeLabel}: ${valueLabel}`);

    const time = document.createElement("span");
    time.textContent = timeLabel;
    const value = document.createElement("strong");
    value.textContent = valueLabel;
    const temp = document.createElement("small");
    temp.textContent = formatTemp(item.temp);
    pill.append(time, value, temp);
    elements.forecastStrip.append(pill);
  });

  return currentPlan;
}

function setDecisionLine(element, text, emphasizedDuration, emphasizeWhole) {
  element.replaceChildren();
  if (emphasizedDuration && text.includes(emphasizedDuration)) {
    const [prefix, suffix] = text.split(emphasizedDuration);
    const duration = document.createElement("strong");
    duration.textContent = emphasizedDuration;
    element.append(prefix, duration, suffix);
    return;
  }

  if (emphasizeWhole) {
    const emphasis = document.createElement("strong");
    emphasis.textContent = text;
    element.append(emphasis);
    return;
  }

  element.textContent = text;
}

function setDecisionSummary(primary, secondary, primaryDuration, secondaryDuration) {
  setDecisionLine(elements.decisionPrimary, primary, primaryDuration, true);
  setDecisionLine(elements.decisionSecondary, secondary, secondaryDuration, false);
}
function renderRecommendation(plan) {
  elements.recommendation.classList.remove("open", "closed", "caution");
  const limited = ["too-cold", "condensation"].includes(plan.status);

  if (plan.status === "target-met") {
    elements.recommendation.classList.add("open");
    elements.decisionLabel.textContent = "TARGET MET";
    setDecisionSummary("Humidity target reached", "No ventilation needed right now.");
  } else if (plan.status === "below-minimum") {
    elements.recommendation.classList.add("caution");
    elements.decisionLabel.textContent = "BELOW MINIMUM";
    setDecisionSummary("Room is below your limit", "Avoid further cooling through ventilation.");
  } else if (plan.status === "wetter") {
    elements.recommendation.classList.add("closed");
    elements.decisionLabel.textContent = "KEEP CLOSED";
    setDecisionSummary("Outdoor air is wetter", "Opening would add moisture.");
  } else if (plan.status === "uncertain") {
    elements.recommendation.classList.add("caution");
    elements.decisionLabel.textContent = "UNCERTAIN";
    setDecisionSummary("Moisture difference unclear", "Readings are within sensor uncertainty.");
  } else if (plan.status === "good") {
    elements.recommendation.classList.add("open");
    elements.decisionLabel.textContent = "OPEN WINDOWS";
    const targetDuration = formatDuration(plan.minutes);
    setDecisionSummary(
      `About ${targetDuration} to reach your humidity target.`,
      `Up to ${formatDuration(plan.reliableDryMinutes)} while outdoor air remains reliably drier.`,
      targetDuration,
      formatDuration(plan.reliableDryMinutes),
    );
  } else if (plan.status === "forecast-limit") {
    elements.recommendation.classList.add(plan.limitMinutes ? "caution" : "closed");
    elements.decisionLabel.textContent = plan.limitMinutes ? "OPEN WHILE USEFUL" : "KEEP CLOSED";
    setDecisionSummary(
      plan.limitMinutes ? "Up to " + formatDuration(plan.limitMinutes) : "Do not open now",
      plan.limitMinutes
        ? "Conditions become less drying after this."
        : "Forecast air is no longer reliably drying.",
    );
  } else if (plan.status === "settling") {
    elements.recommendation.classList.add("caution");
    elements.decisionLabel.textContent = "SETTLING";
    const settlingDuration = formatDuration(plan.minutes);
    const dryDuration = formatDuration(plan.reliableDryMinutes);
    setDecisionSummary(
      plan.minutes
        ? `About ${settlingDuration} to settle near ${formatRh(plan.projectedRh)} RH.`
        : "No further benefit",
      plan.minutes
        ? `Up to ${dryDuration} while outdoor air remains reliably drier.`
        : "Outdoor air is no longer reliably drier.",
      plan.minutes ? settlingDuration : null,
      plan.minutes ? dryDuration : null,
    );
  } else if (limited) {
    elements.recommendation.classList.add(plan.limitMinutes ? "caution" : "closed");
    elements.decisionLabel.textContent = plan.limitMinutes ? "OPEN BRIEFLY" : "KEEP CLOSED";
    const reason = {
      "too-cold": "Before reaching your temperature limit.",
      condensation: "Before condensation risk increases.",
    }[plan.status];
    const limitDuration = formatDuration(plan.limitMinutes);
    const dryDuration = formatDuration(plan.reliableDryMinutes);
    setDecisionSummary(
      plan.limitMinutes ? `Up to ${limitDuration} ${reason.toLowerCase()}` : "Do not open now",
      plan.limitMinutes
        ? `Up to ${dryDuration} while outdoor air remains reliably drier.`
        : reason,
      plan.limitMinutes ? limitDuration : null,
      plan.limitMinutes ? dryDuration : null,
    );
  } else {
    elements.recommendation.classList.add("open");
    elements.decisionLabel.textContent = "OPEN WINDOWS";
    setDecisionSummary("More than 3 hr", "Humidity should improve slowly.");
  }
}

function render() {
  elements.indoorTemp.value = state.indoorTemp;
  elements.indoorRh.value = state.indoorRh;
  elements.indoorTempInput.value = state.indoorTemp.toFixed(1);
  elements.indoorRhInput.value = Math.round(state.indoorRh);
  elements.indoorTempValue.textContent = formatTemp(state.indoorTemp);
  elements.indoorRhValue.textContent = formatRh(state.indoorRh);
  elements.warmingTemp.textContent = formatTemp(state.indoorTemp);

  const plan = renderPlan();
  const indoorDew = dewPoint(state.indoorTemp, state.indoorRh);
  const indoorAbsolute = absoluteHumidity(state.indoorTemp, state.indoorRh);
  elements.indoorDewPoint.textContent = formatTemp(indoorDew);
  elements.indoorAbsoluteHumidity.textContent = formatMoisture(indoorAbsolute);
  elements.outdoorAbsoluteHumidity.classList.remove("lower", "higher", "near");

  if (state.outdoorTemp === null || state.outdoorRh === null) {
    elements.recommendation.classList.remove("open", "closed", "caution");
    elements.recommendation.classList.add("caution");
    elements.decisionLabel.textContent = state.weatherLoadFailed
      ? "WEATHER UNAVAILABLE"
      : "CHECKING WEATHER";
    setDecisionSummary(
      state.weatherLoadFailed ? "Outdoor weather unavailable" : "Checking outdoor weather",
      state.weatherLoadFailed ? "Check your connection and try again." : "This normally takes a moment.",
    );
    elements.outdoorTempValue.textContent = "--";
    elements.outdoorRhValue.textContent = "--";
    elements.outdoorDewPoint.textContent = "--";
    elements.outdoorAbsoluteHumidity.textContent = "--";
    elements.warmedOutdoorRh.textContent = "--";
    elements.adjustedAirNote.textContent = "";
    return;
  }

  const outdoorDew = Number.isFinite(state.outdoorDewPoint)
    ? state.outdoorDewPoint
    : dewPoint(state.outdoorTemp, state.outdoorRh);
  const comparison = compareMoisture(
    state.indoorTemp,
    state.indoorRh,
    state.outdoorTemp,
    state.outdoorRh,
  );
  const outdoorVaporPressure = saturationVaporPressure(outdoorDew);
  const adjustedRh = relativeHumidityAtTemperature(outdoorVaporPressure, state.indoorTemp);
  const condensationRisk = adjustedRh >= 100;
  const displayedAdjustedRh = Math.min(adjustedRh, 100);
  const percentDifference = (Math.abs(comparison.difference) / comparison.indoor) * 100;
  const adjustedAirExplanation = condensationRisk
    ? "At the current indoor temperature, this air would be saturated, so condensation may form."
    : `At the current indoor temperature, outdoor air would be about ${formatRh(
        displayedAdjustedRh,
      )} RH.`;

  elements.outdoorTempValue.textContent = formatTemp(state.outdoorTemp);
  elements.outdoorRhValue.textContent = formatRh(state.outdoorRh);
  elements.outdoorDewPoint.textContent = formatTemp(outdoorDew);
  elements.outdoorAbsoluteHumidity.textContent = formatMoisture(comparison.outdoor);
  elements.warmedOutdoorRh.textContent = formatRh(displayedAdjustedRh);
  elements.adjustedAirNote.textContent = condensationRisk ? "Condensation risk" : "";
  elements.outdoorAbsoluteHumidity.classList.toggle("lower", comparison.status === "drier");
  elements.outdoorAbsoluteHumidity.classList.toggle("higher", comparison.status === "wetter");
  elements.outdoorAbsoluteHumidity.classList.toggle("near", comparison.status === "uncertain");

  renderRecommendation(plan);

  if (comparison.status === "drier") {
    elements.explanationText.textContent = `Outdoor air currently contains about ${percentDifference.toFixed(
      0,
    )}% less moisture than indoor air, beyond the estimated sensor uncertainty. ${adjustedAirExplanation}`;
  } else if (comparison.status === "wetter") {
    elements.explanationText.textContent = `Outdoor air currently contains about ${percentDifference.toFixed(
      0,
    )}% more moisture than indoor air, so ventilation would probably raise indoor humidity. ${adjustedAirExplanation}`;
  } else {
    elements.explanationText.textContent = `The indoor-outdoor moisture difference is smaller than the estimated \u00b1${comparison.margin.toFixed(
      1,
    )} g/m3 uncertainty, so the direction is unclear. ${adjustedAirExplanation}`;
  }
}

function weatherUrlForLocation(location = state.location) {
  const params = new URLSearchParams({
    latitude: location.latitude.toFixed(4),
    longitude: location.longitude.toFixed(4),
    current: "temperature_2m,relative_humidity_2m,dew_point_2m,surface_pressure,wind_speed_10m",
    hourly: "temperature_2m,relative_humidity_2m,dew_point_2m,surface_pressure,wind_speed_10m",
    forecast_hours: "12",
    timeformat: "unixtime",
    timezone: "auto",
  });
  return `${WEATHER_ENDPOINT}?${params}`;
}

function updateLocationUi() {
  const locationName = state.location.name || "Selected location";
  elements.locationName.textContent = locationName;
  elements.sourceLocationName.textContent = locationName;
  elements.liveWeatherRequest.href = weatherUrlForLocation();
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
    }
  } catch {
    localStorage.removeItem(LOCATION_STORAGE_KEY);
  }
}

function setLocation(location, mode) {
  state.location = location;
  state.locationMode = mode;
  state.outdoorTemp = null;
  state.outdoorRh = null;
  state.outdoorDewPoint = null;
  state.forecast = [];
  state.updatedAt = null;
  saveLocation();
  updateLocationUi();
}


function formatBrowserLocation(data) {
  const locality = data.locality || data.city || "Nearby location";
  const county = data.localityInfo?.administrative?.find((item) =>
    /county/i.test(item.description || ""),
  )?.name;
  const area = county || (data.city !== locality ? data.city : data.principalSubdivision);
  const label = area && area !== locality ? `${locality}, ${area}` : locality;
  return LOCATION_LABEL_OVERRIDES.get(label) || label;
}

async function reverseGeocodeLocation(latitude, longitude) {
  const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), localityLanguage: "en" });
  const response = await fetch(`${REVERSE_GEOCODING_ENDPOINT}?${params}`);
  if (!response.ok) throw new Error("Reverse geocoding failed");
  return formatBrowserLocation(await response.json());
}

function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not supported by this browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 0,
    });
  });
}

async function useCurrentLocation() {
  elements.locationButton.disabled = true;
  elements.locationButton.textContent = "Locating...";

  try {
    const position = await getBrowserLocation();
    let locationName = "Nearby location";
    try {
      locationName = await reverseGeocodeLocation(position.coords.latitude, position.coords.longitude);
    } catch {
      // Weather can still be fetched when the locality lookup is unavailable.
    }
    setLocation(
      {
        name: locationName,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
      "current",
    );
    await fetchWeather();
  } catch {
    if (!state.lastCheckedAt) await fetchWeather();
  } finally {
    elements.locationButton.disabled = false;
    elements.locationButton.textContent = "Update";
  }
}

async function initializeLocation() {
  state.locationMode = "current";
  saveLocation();
  updateLocationUi();
  await useCurrentLocation();
}
async function fetchWeather() {
  const checkedAt = new Date();
  elements.weatherStatus.textContent = "Updating outdoor weather...";
  elements.refreshWeather.disabled = true;

  try {
    const response = await fetch(weatherUrlForLocation());
    if (!response.ok) throw new Error("Weather request failed");
    const data = await response.json();
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
    state.forecast = buildForecast(data);
    state.updatedAt = current.time;
    state.lastCheckedAt = checkedAt;
    state.weatherLoadFailed = false;
    if (typeof data.timezone === "string" && data.timezone) state.timezone = data.timezone;

    const dataTime = dateFromApiTime(state.updatedAt);
    const dataAge = minutesSince(dataTime);
    elements.weatherStatus.textContent = `Last checked ${formatShortTime(checkedAt)}, weather updated ${formatShortTime(dataTime)}${
      dataAge >= 60 ? " (may be stale)" : ""
    }`;
  } catch {
    state.lastCheckedAt = checkedAt;
    state.weatherLoadFailed = true;
    const previousDataTime = dateFromApiTime(state.updatedAt);
    const hasPreviousWeather = state.outdoorTemp !== null && state.outdoorRh !== null;
    elements.weatherStatus.textContent =
      hasPreviousWeather && Number.isFinite(previousDataTime.getTime())
        ? `Last check failed ${formatShortTime(checkedAt)}, weather updated ${formatShortTime(previousDataTime)}`
        : `Last check failed ${formatShortTime(checkedAt)}`;
  } finally {
    elements.refreshWeather.disabled = false;
    render();
  }
}


function bindTypedValue(input, stateKey, min, max, save) {
  const applyValue = () => {
    const value = input.valueAsNumber;
    if (!Number.isFinite(value) || value < min || value > max) return false;
    state[stateKey] = value;
    save();
    render();
    return true;
  };
  input.addEventListener("change", () => {
    if (!applyValue()) render();
  });
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
  bindTypedValue(elements.indoorTempInput, "indoorTemp", 10, 32, saveIndoorReadings);
  bindTypedValue(elements.indoorRhInput, "indoorRh", 20, 90, saveIndoorReadings);
  bindTypedValue(elements.targetRhInput, "targetRh", 40, 65, savePlanSettings);
  bindTypedValue(elements.minTempInput, "minTemp", 16, 26, savePlanSettings);

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

  elements.roomPreset.addEventListener("change", (event) => {
    state.roomPreset = event.target.value;
    savePlanSettings();
    render();
  });
  bindTypedValue(elements.roomLength, "roomLength", 1, 20, savePlanSettings);
  bindTypedValue(elements.roomWidth, "roomWidth", 1, 20, savePlanSettings);
  bindTypedValue(elements.roomHeight, "roomHeight", 1.8, 5, savePlanSettings);

  elements.openingSetup.addEventListener("change", (event) => {
    state.openingSetup = event.target.value;
    savePlanSettings();
    render();
  });
  bindTypedValue(elements.customAirflow, "customAirflow", 10, 500, savePlanSettings);

  elements.refreshWeather.addEventListener("click", fetchWeather);
  elements.locationButton.addEventListener("click", useCurrentLocation);
  elements.sourceButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = elements.sourceButton.getAttribute("aria-expanded") === "true";
    setSourcePopoverOpen(!isOpen);
  });
  elements.sourcePopover.addEventListener("click", (event) => event.stopPropagation());
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
