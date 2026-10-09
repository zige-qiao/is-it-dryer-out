import { clamp, saturationVaporPressure, dewPoint, relativeHumidityAtTemperature } from './humidity.js';
import { DEFAULT_PRESSURE_HPA } from '../config.js';

export function dateFromApiTime(value) {
  return new Date(typeof value === "number" ? value * 1000 : value);
}

export function normalizeWindDirection(value) {
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

// Rain is an accumulation over the preceding hour, never an instantaneous
// measurement to interpolate with the humidity/temperature timeline.
export function buildRainOutlook(forecast = [], start, end) {
  const hour = 3600000;
  const intervals = forecast.map(item => ({
    start: item.time.getTime() - hour, end: item.time.getTime(),
    amount: Number.isFinite(item.rainfall) && item.rainfall >= 0 ? item.rainfall : null,
    probability: Number.isFinite(item.precipitationProbability) ? item.precipitationProbability : null,
  })).sort((a, b) => a.start - b.start);
  const fullEnd = start + 48 * hour;
  const scale = Math.max(1, Math.ceil(Math.max(0, ...intervals.filter(item => item.end > start && item.start < fullEnd).map(item => item.amount ?? 0))));
  const spells = [];
  let spell = null;
  intervals.forEach((item, index) => {
    if (item.amount === null || item.amount < 0.1) { spell = null; return; }
    if (!spell || spell.end !== item.start) {
      const previous = intervals[index - 1];
      spell = { start: item.start, end: item.end, amount: 0, partial: !previous || previous.end !== item.start || previous.amount === null };
      spells.push(spell);
    }
    spell.end = item.end;
    spell.amount += item.amount;
    const next = intervals[index + 1];
    spell.partialEnd = !next || next.start !== item.end || next.amount === null;
  });
  return { intervals: intervals.filter(item => item.end > start && item.start < end), scale,
    spells: spells.filter(item => item.end > start && item.start < end).map(item => ({ ...item,
      visibleStart: Math.max(start, item.start), visibleEnd: Math.min(end, item.end),
      // Only sum complete visible hours when clipped, giving an honest lower
      // bound instead of inventing a proportional amount for part of an hour.
      amount: item.start < start || item.end > end
        ? intervals.filter(hour => hour.start >= Math.max(start, item.start) && hour.end <= Math.min(end, item.end)).reduce((sum, hour) => sum + (hour.amount ?? 0), 0)
        : item.amount,
      partial: item.partial || item.partialEnd || item.start < start || item.end > end,
    })) };
}

export function rainAtTime(outlook, time) {
  const interval = outlook.intervals.find(item => time >= item.start && time < item.end)
    ?? outlook.intervals.find(item => time === item.end && item.end === outlook.intervals.at(-1)?.end);
  const spell = outlook.spells.find(item => interval && interval.start >= item.start && interval.end <= item.end);
  return { interval, spell };
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
    windDirection: normalizeWindDirection(state.outdoorWindDirection),
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
      const from = normalizeWindDirection(previous.windDirection);
      const to = normalizeWindDirection(next.windDirection);
      const windDirection = progress === 0 ? from : progress === 1 ? to
        : from === null || to === null ? null
        : (from + (((to - from + 540) % 360) - 180) * progress + 360) % 360;
      const wind = previous.wind + (next.wind - previous.wind) * progress;
      return {
        time: targetTime,
        temp,
        dewPoint: dew,
        pressure,
        wind,
        windDirection,
        rh: clamp(relativeHumidityAtTemperature(saturationVaporPressure(dew), temp), 0, 100),
      };
    }
    previous = next;
  }

  return { ...timeline.at(-1), time: targetTime };
}
