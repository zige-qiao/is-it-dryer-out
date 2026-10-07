import { clamp, saturationVaporPressure, relativeHumidityAtTemperature, vaporPressureFromHumidityRatio, humidityRatio, compareMoisture, forecastHasBecomeLessDry } from './humidity.js';
import { weatherAtTime } from './forecast.js';
import { MAX_OPEN_MINUTES, TARGET_MARGIN_RH, MINIMUM_NOTICEABLE_RH_CHANGE, THERMAL_RESPONSE_FACTOR, ROOM_PRESETS, OPENING_SETUPS } from '../config.js';

export function roomVolume(state) {
  if (state.roomPreset !== "custom") return ROOM_PRESETS[state.roomPreset] ?? ROOM_PRESETS.medium;
  return state.roomLength * state.roomWidth * state.roomHeight;
}

export function baseAirflow(state) {
  if (state.openingSetup === "custom") return state.customAirflow;
  return OPENING_SETUPS[state.openingSetup]?.airflow ?? OPENING_SETUPS.single.airflow;
}

export function effectiveAirExchange(state, weather, indoorTemp) {
  const windKmh = Number.isFinite(weather.wind) ? weather.wind : 0;
  const temperatureDifference = Math.abs(indoorTemp - weather.temp);
  const conditionMultiplier = clamp(0.65 + windKmh / 40 + temperatureDifference / 30, 0.65, 2);
  const airflow = baseAirflow(state) * conditionMultiplier;
  return {
    airflow,
    airChangesPerHour: clamp(airflow / roomVolume(state), 0.1, 12),
  };
}

export function planResult(state, status, overrides = {}) {
  return {
    status,
    minutes: null,
    limitMinutes: 0,
    projectedTemp: state.indoorTemp,
    projectedRh: state.indoorRh,
    ...overrides,
  };
}

export function hasMeaningfulRhImprovement(state, projectedRh) {
  return state.indoorRh - projectedRh >= MINIMUM_NOTICEABLE_RH_CHANGE;
}

function stepVentilation(state, weather, pressure, ratio, temp) {
  const exchange = effectiveAirExchange(state, weather, temp);
  const airExchangeFraction = 1 - Math.exp(-exchange.airChangesPerHour / 60);
  const heatExchangeFraction = 1 - Math.exp(-exchange.airChangesPerHour * THERMAL_RESPONSE_FACTOR / 60);
  const outdoorRatio = humidityRatio(weather.temp, weather.rh, pressure);
  const nextRatio = ratio + (outdoorRatio - ratio) * airExchangeFraction;
  const nextTemp = temp + (weather.temp - temp) * heatExchangeFraction;
  const vapor = vaporPressureFromHumidityRatio(nextRatio, pressure);
  return {
    ratio: nextRatio,
    temp: nextTemp,
    vapor,
    rh: relativeHumidityAtTemperature(vapor, nextTemp),
  };
}

export function projectedDryAirHorizon(state, startWeather, timeline) {
  const startTime = startWeather.time instanceof Date ? startWeather.time : new Date();
  let projectedRatio = humidityRatio(
    state.indoorTemp,
    state.indoorRh,
    startWeather.pressure ?? state.outdoorPressure,
  );
  let projectedTemp = state.indoorTemp;

  for (let minute = 1; minute <= MAX_OPEN_MINUTES; minute += 1) {
    const weather = weatherAtTime(
      timeline,
      new Date(startTime.getTime() + minute * 60 * 1000),
    );
    const pressure = Number.isFinite(weather.pressure)
      ? weather.pressure
      : state.outdoorPressure;
    const projectedVapor = vaporPressureFromHumidityRatio(projectedRatio, pressure);
    const projectedRh = clamp(
      relativeHumidityAtTemperature(projectedVapor, projectedTemp),
      0,
      100,
    );
    const comparison = compareMoisture(
      projectedTemp,
      projectedRh,
      weather.temp,
      weather.rh,
    );
    if (comparison.status !== "drier") {
      return { minutes: minute - 1, capped: false };
    }

    const next = stepVentilation(state, weather, pressure, projectedRatio, projectedTemp);
    projectedRatio = next.ratio;
    projectedTemp = next.temp;
  }

  return { minutes: MAX_OPEN_MINUTES, capped: true };
}

export function estimateOpeningWindowPlan(state, startWeather, timeline) {
  if (state.indoorRh <= state.targetRh + TARGET_MARGIN_RH) return planResult(state, "target-met");
  if (state.indoorTemp < state.minTemp && startWeather.temp <= state.indoorTemp) {
    return planResult(state, "below-minimum");
  }

  const initialComparison = compareMoisture(
    state.indoorTemp,
    state.indoorRh,
    startWeather.temp,
    startWeather.rh,
  );
  if (initialComparison.status === "wetter") return planResult(state, "wetter");
  if (initialComparison.status === "uncertain") return planResult(state, "uncertain");

  const startTime = startWeather.time instanceof Date ? startWeather.time : new Date();
  const initialPressureHpa = startWeather.pressure ?? state.outdoorPressure;
  let projectedRatio = humidityRatio(
    state.indoorTemp,
    state.indoorRh,
    initialPressureHpa,
  );
  const initialAbsolute = initialComparison.indoor;
  const equivalentAtInitialTemp = ratio =>
    (216.7 * vaporPressureFromHumidityRatio(ratio, initialPressureHpa)) / (state.indoorTemp + 273.15);
  let projectedTemp = state.indoorTemp;
  let projectedRh = state.indoorRh;
  let lastComfortableMinute = 0;
  let lastComfortableTemp = state.indoorTemp;
  let lastComfortableRh = state.indoorRh;

  for (let minute = 1; minute <= MAX_OPEN_MINUTES; minute += 1) {
    const targetTime = new Date(startTime.getTime() + minute * 60 * 1000);
    const weather = weatherAtTime(timeline, targetTime);
    const projectedPressureHpa = Number.isFinite(weather.pressure)
      ? weather.pressure
      : state.outdoorPressure;
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
      if (!hasMeaningfulRhImprovement(state, projectedRhBeforeMixing)) {
        return planResult(state, "minimal-impact", {
          limitMinutes: minute - 1,
          projectedTemp,
          projectedRh: projectedRhBeforeMixing,
        });
      }
      return planResult(state, status, {
        minutes: minute > 1 ? minute - 1 : null,
        limitMinutes: minute - 1,
        projectedTemp,
        projectedRh: projectedRhBeforeMixing,
      });
    }

    const previousTemp = projectedTemp;
    const next = stepVentilation(state, weather, projectedPressureHpa, projectedRatio, projectedTemp);
    projectedRatio = next.ratio;
    projectedTemp = next.temp;
    const projectedVapor = next.vapor;
    const saturation = saturationVaporPressure(projectedTemp);
    if (projectedVapor >= saturation) {
      if (lastComfortableMinute && !hasMeaningfulRhImprovement(state, lastComfortableRh)) {
        return planResult(state, "minimal-impact", {
          limitMinutes: lastComfortableMinute,
          projectedTemp: lastComfortableTemp,
          projectedRh: lastComfortableRh,
        });
      }
      return planResult(state, "condensation", {
        limitMinutes: minute - 1,
        projectedTemp: lastComfortableTemp,
        projectedRh: lastComfortableRh,
      });
    }

    projectedRh = next.rh;
    if (projectedTemp < state.minTemp &&
      (state.indoorTemp >= state.minTemp || projectedTemp <= previousTemp)) {
      if (lastComfortableMinute && !hasMeaningfulRhImprovement(state, lastComfortableRh)) {
        return planResult(state, "minimal-impact", {
          limitMinutes: lastComfortableMinute,
          projectedTemp: lastComfortableTemp,
          projectedRh: lastComfortableRh,
        });
      }
      return planResult(state, "too-cold", {
        limitMinutes: lastComfortableMinute,
        projectedTemp: lastComfortableTemp,
        projectedRh: lastComfortableRh,
      });
    }

    lastComfortableMinute = minute;
    lastComfortableTemp = projectedTemp;
    lastComfortableRh = projectedRh;
    const netImprovement = initialAbsolute - equivalentAtInitialTemp(projectedRatio);
    if (
      projectedRh <= state.targetRh + TARGET_MARGIN_RH &&
      netImprovement > initialComparison.margin
    ) {
      return planResult(state, "good", {
        minutes: minute,
        limitMinutes: minute,
        projectedTemp,
        projectedRh,
      });
    }
  }

  return planResult(state,
    hasMeaningfulRhImprovement(state, projectedRh) &&
      initialAbsolute - equivalentAtInitialTemp(projectedRatio) > initialComparison.margin
      ? "slow"
      : "minimal-impact",
    {
      limitMinutes: lastComfortableMinute,
      projectedTemp,
      projectedRh,
    },
  );
}
