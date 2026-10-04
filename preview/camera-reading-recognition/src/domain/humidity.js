import { DEFAULT_PRESSURE_HPA, MINIMUM_MOISTURE_MARGIN, INPUT_UNCERTAINTY } from '../config.js';

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function numberInRange(value, min, max, fallback) {
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

export function saturationVaporPressure(tempC) {
  return 6.112 * Math.exp((17.67 * tempC) / (tempC + 243.5));
}

export function vaporPressure(tempC, relativeHumidity) {
  return saturationVaporPressure(tempC) * (relativeHumidity / 100);
}

export function dewPoint(tempC, relativeHumidity) {
  const gamma = Math.log(relativeHumidity / 100) + (17.67 * tempC) / (243.5 + tempC);
  return (243.5 * gamma) / (17.67 - gamma);
}

export function absoluteHumidity(tempC, relativeHumidity) {
  return (216.7 * vaporPressure(tempC, relativeHumidity)) / (tempC + 273.15);
}

export function relativeHumidityAtTemperature(actualVaporPressure, newTempC) {
  return (actualVaporPressure / saturationVaporPressure(newTempC)) * 100;
}

export function humidityRatioFromVaporPressure(actualVaporPressure, pressureHpa) {
  return (0.62198 * actualVaporPressure) / (pressureHpa - actualVaporPressure);
}

export function vaporPressureFromHumidityRatio(ratio, pressureHpa) {
  return (ratio * pressureHpa) / (0.62198 + ratio);
}

export function humidityRatio(tempC, relativeHumidity, pressureHpa = DEFAULT_PRESSURE_HPA) {
  return humidityRatioFromVaporPressure(vaporPressure(tempC, relativeHumidity), pressureHpa);
}

export function absoluteHumidityUncertainty(tempC, rh, tempError, rhError) {
  const temperatureContribution =
    (absoluteHumidity(tempC + tempError, rh) - absoluteHumidity(tempC - tempError, rh)) / 2;
  const humidityContribution =
    (absoluteHumidity(tempC, clamp(rh + rhError, 1, 100)) -
      absoluteHumidity(tempC, clamp(rh - rhError, 1, 100))) /
    2;
  return Math.hypot(temperatureContribution, humidityContribution);
}

// Express both readings as vapour density at the same temperature. At a shared
// air pressure this has the same ordering as humidity ratio, which is what the
// ventilation model mixes. The displayed AH readings remain at their actual
// temperatures.
export function equivalentAbsoluteHumidity(tempC, rh, referenceTempC) {
  return (216.7 * vaporPressure(tempC, rh)) / (referenceTempC + 273.15);
}

export function equivalentAbsoluteHumidityUncertainty(tempC, rh, referenceTempC, tempError, rhError) {
  const temperatureContribution =
    (equivalentAbsoluteHumidity(tempC + tempError, rh, referenceTempC) -
      equivalentAbsoluteHumidity(tempC - tempError, rh, referenceTempC)) / 2;
  const humidityContribution =
    (equivalentAbsoluteHumidity(tempC, clamp(rh + rhError, 1, 100), referenceTempC) -
      equivalentAbsoluteHumidity(tempC, clamp(rh - rhError, 1, 100), referenceTempC)) / 2;
  return Math.hypot(temperatureContribution, humidityContribution);
}

function equivalentMoistureDifference(indoorTemp, indoorRh, outdoorTemp, outdoorRh) {
  return equivalentAbsoluteHumidity(indoorTemp, indoorRh, indoorTemp) -
    equivalentAbsoluteHumidity(outdoorTemp, outdoorRh, indoorTemp);
}

export function moistureMargin(indoorTemp, indoorRh, outdoorTemp, outdoorRh) {
  const difference = equivalentMoistureDifference;
  const indoorTempError = (difference(indoorTemp + INPUT_UNCERTAINTY.indoorTemp, indoorRh, outdoorTemp, outdoorRh) -
    difference(indoorTemp - INPUT_UNCERTAINTY.indoorTemp, indoorRh, outdoorTemp, outdoorRh)) / 2;
  const indoorRhError = (difference(indoorTemp, clamp(indoorRh + INPUT_UNCERTAINTY.indoorRh, 1, 100), outdoorTemp, outdoorRh) -
    difference(indoorTemp, clamp(indoorRh - INPUT_UNCERTAINTY.indoorRh, 1, 100), outdoorTemp, outdoorRh)) / 2;
  const outdoorTempError = (difference(indoorTemp, indoorRh, outdoorTemp + INPUT_UNCERTAINTY.outdoorTemp, outdoorRh) -
    difference(indoorTemp, indoorRh, outdoorTemp - INPUT_UNCERTAINTY.outdoorTemp, outdoorRh)) / 2;
  const outdoorRhError = (difference(indoorTemp, indoorRh, outdoorTemp, clamp(outdoorRh + INPUT_UNCERTAINTY.outdoorRh, 1, 100)) -
    difference(indoorTemp, indoorRh, outdoorTemp, clamp(outdoorRh - INPUT_UNCERTAINTY.outdoorRh, 1, 100))) / 2;
  return Math.max(MINIMUM_MOISTURE_MARGIN, Math.hypot(indoorTempError, indoorRhError, outdoorTempError, outdoorRhError));
}

export function compareMoisture(indoorTemp, indoorRh, outdoorTemp, outdoorRh) {
  const indoor = absoluteHumidity(indoorTemp, indoorRh);
  const outdoor = absoluteHumidity(outdoorTemp, outdoorRh);
  const outdoorEquivalent = equivalentAbsoluteHumidity(outdoorTemp, outdoorRh, indoorTemp);
  const margin = moistureMargin(indoorTemp, indoorRh, outdoorTemp, outdoorRh);
  const difference = equivalentMoistureDifference(indoorTemp, indoorRh, outdoorTemp, outdoorRh);
  return {
    indoor,
    outdoor,
    outdoorEquivalent,
    difference,
    margin,
    status: difference > margin ? "drier" : difference < -margin ? "wetter" : "uncertain",
  };
}

export function forecastHasBecomeLessDry(startWeather, weather) {
  const startAbsolute = equivalentAbsoluteHumidity(startWeather.temp, startWeather.rh, startWeather.temp);
  const weatherAbsolute = equivalentAbsoluteHumidity(weather.temp, weather.rh, startWeather.temp);
  const startUncertainty = equivalentAbsoluteHumidityUncertainty(
    startWeather.temp,
    startWeather.rh,
    startWeather.temp,
    INPUT_UNCERTAINTY.outdoorTemp,
    INPUT_UNCERTAINTY.outdoorRh,
  );
  const weatherUncertainty = equivalentAbsoluteHumidityUncertainty(
    weather.temp,
    weather.rh,
    startWeather.temp,
    INPUT_UNCERTAINTY.outdoorTemp,
    INPUT_UNCERTAINTY.outdoorRh,
  );
  const changeMargin = Math.max(
    MINIMUM_MOISTURE_MARGIN,
    Math.hypot(startUncertainty, weatherUncertainty),
  );
  return weatherAbsolute > startAbsolute + changeMargin;
}
