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

  function formatForecastOpeningTime(date, referenceDate = new Date()) {
    let timeZone = state.timezone;
    try { new Intl.DateTimeFormat('en-GB', { timeZone }); }
    catch { timeZone = DEFAULT_TIMEZONE; }
    const calendar = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' });
    const localDay = value => {
      const parts = Object.fromEntries(calendar.formatToParts(value).map(part => [part.type, part.value]));
      return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
    };
    const clock = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
    const days = (localDay(date) - localDay(referenceDate)) / 86400000;
    if (days === 0) return clock;
    if (days === 1) return `${clock} tomorrow`;
    const weekday = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'long' }).format(date);
    return `${clock} on ${weekday}`;
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

  return { formatTemp, formatRh, formatMoisture, formatShortTime, formatWeatherTimestamp, formatForecastOpeningTime, formatDuration, minutesSince };
}
