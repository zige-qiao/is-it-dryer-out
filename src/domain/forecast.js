import { clamp, saturationVaporPressure, dewPoint, relativeHumidityAtTemperature } from './humidity.js';
import { DEFAULT_PRESSURE_HPA } from '../config.js';

export function dateFromApiTime(value) {
  return new Date(typeof value === "number" ? value * 1000 : value);
}

function normalizeWindDirection(value) {
  return Number.isFinite(value) && value >= 0 && value <= 360 ? value % 360 : null;
}

export function buildForecast(data) {
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
      windDirection: normalizeWindDirection(data.hourly?.wind_direction_10m?.[index]),
      rain: data.hourly?.rain?.[index],
      showers: data.hourly?.showers?.[index],
      precipitationProbability: data.hourly?.precipitation_probability?.[index],
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
      rainfall: Number.isFinite(item.rain) && item.rain >= 0 && Number.isFinite(item.showers) && item.showers >= 0
        ? item.rain + item.showers : null,
      precipitationProbability: Number.isFinite(item.precipitationProbability) && item.precipitationProbability >= 0 && item.precipitationProbability <= 100
        ? item.precipitationProbability : null,
    }));
}

export function currentWeather(state) {
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

export function buildWeatherTimeline(state) {
  if (state.outdoorTemp === null || state.outdoorRh === null) return [];
  const current = currentWeather(state);
  return [current, ...state.forecast.filter((item) => item.time > current.time)];
}

export function weatherAtTime(timeline, targetTime) {
  if (timeline.length === 1 || targetTime <= timeline[0].time) return timeline[0];

  let previous = timeline[0];
  for (let index = 1; index < timeline.length; index += 1) {
    const next = timeline[index];
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
