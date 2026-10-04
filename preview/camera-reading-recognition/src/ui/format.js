import { DEFAULT_TIMEZONE } from '../config.js';

export function createFormatters({
  state,
} = {}, environment = globalThis) {
  const { Date } = environment;

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

  function formatWeatherTimestamp(date) {
    const options = { dateStyle: "medium", timeStyle: "short" };
    try {
      return new Intl.DateTimeFormat("en-GB", {
        ...options,
        timeZone: state.timezone,
      }).format(date);
    } catch {
      return new Intl.DateTimeFormat("en-GB", options).format(date);
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

  return { formatTemp, formatRh, formatMoisture, formatShortTime, formatWeatherTimestamp, formatDuration, minutesSince };
}
