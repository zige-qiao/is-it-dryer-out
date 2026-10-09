import { vaporPressure, relativeHumidityAtTemperature } from '../domain/humidity.js';
import { currentWeather } from '../domain/forecast.js';
import { effectiveAirExchange } from '../domain/ventilation.js';
import { MINIMUM_NOTICEABLE_RH_CHANGE } from '../config.js';

// Explanations need hourly observations, independently of the chart overlay.
function normalizeWindDirection(value) {
  return Number.isFinite(value) && value >= 0 && value <= 360 ? value % 360 : null;
}
function rainIntervals(forecast, start, end) {
  return (forecast ?? []).map(item => ({
    start: item.time.getTime() - 3600000, end: item.time.getTime(),
    amount: Number.isFinite(item.rainfall) && item.rainfall >= 0 ? item.rainfall : null,
    probability: Number.isFinite(item.precipitationProbability) ? item.precipitationProbability : null,
  })).sort((a, b) => a.start - b.start).filter(item => item.end > start && item.start < end);
}

const statuses = new Set(['target-met', 'below-minimum', 'wetter', 'uncertain', 'good',
  'forecast-limit', 'settling', 'too-cold', 'condensation', 'slow', 'minimal-impact']);
const compass = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const bold = text => ({ strong: text });
const row = (key, label, ...parts) => ({ key, label, parts });

// One set of facts supplies both the short overview and the expanded detail.
// Weather advice is separate from, and never changes, the ventilation model.
export function explanationFacts(state, plan, comparison, now = Date.now()) {
  const unavailable = state.weatherRequestPending || state.weatherLoadFailed ||
    !Number.isFinite(state.outdoorTemp) || !Number.isFinite(state.outdoorRh);
  const consistent = plan?.status === 'target-met' || plan?.status === 'below-minimum' ||
    (plan?.status === 'wetter' ? comparison?.status === 'wetter'
      : plan?.status === 'uncertain' ? comparison?.status === 'uncertain' : comparison?.status === 'drier');
  const known = consistent && [state.indoorTemp, state.indoorRh, state.targetRh, state.minTemp].every(Number.isFinite) &&
    statuses.has(plan?.status) && ['drier', 'wetter', 'uncertain'].includes(comparison?.status) &&
    Number.isFinite(plan.projectedTemp) && Number.isFinite(plan.projectedRh) &&
    (plan.status !== 'good' || (Number.isFinite(plan.minutes) && plan.minutes > 0 &&
      Number.isFinite(plan.dryAirHorizon?.minutes) && plan.dryAirHorizon.minutes >= 0)) &&
    (!['forecast-limit', 'too-cold', 'condensation', 'slow'].includes(plan.status) ||
      (Number.isFinite(plan.limitMinutes) && plan.limitMinutes >= 0)) &&
    (plan.status !== 'slow' || plan.limitMinutes > 0) &&
    (plan.status !== 'settling' || plan.minutes === null || (Number.isFinite(plan.minutes) && plan.minutes >= 0));
  const minutes = plan?.status === 'settling' ? plan.minutes :
    ['forecast-limit', 'too-cold', 'condensation'].includes(plan?.status) ? plan.limitMinutes :
      plan?.minutes ?? plan?.limitMinutes;
  const useful = known && ['good', 'slow', 'settling', 'forecast-limit', 'too-cold', 'condensation'].includes(plan.status) &&
    Number.isFinite(minutes) && minutes > 0;
  const optional = known && (['uncertain', 'minimal-impact'].includes(plan.status) ||
    (['forecast-limit', 'settling'].includes(plan.status) && !useful));
  const opening = (useful || optional) && comparison.status !== 'wetter';
  const percent = comparison?.status !== 'uncertain' && comparison?.indoor > 0 && Number.isFinite(comparison.difference)
    ? Math.round(Math.abs(comparison.difference) / comparison.indoor * 100) : null;
  const end = now + (useful ? minutes : 60) * 60000;
  const rain = rainIntervals(state.forecast, now, end);
  let coveredUntil = now;
  for (const hour of rain) {
    if (hour.start > coveredUntil || hour.amount === null) break;
    coveredUntil = Math.max(coveredUntil, hour.end);
  }
  const amounts = rain.map(hour => hour.amount).filter(Number.isFinite);
  const chances = rain.map(hour => hour.probability).filter(Number.isFinite);
  const peak = amounts.length ? Math.max(...amounts) : null;
  // ECCC hourly-average categories; overlapping hourly totals are not prorated.
  const rainKind = peak === null ? 'unknown' : peak === 0 ? 'none' : peak <= 2.5 ? 'light' : peak <= 7.5 ? 'moderate' : 'heavy';
  const direction = normalizeWindDirection(state.outdoorWindDirection);
  const sector = direction === null ? null : Math.round(direction / 45) % 8;
  const windAvailable = state.outdoorWindAvailable === true && Number.isFinite(state.outdoorWind) && state.outdoorWind >= 0;
  const delta = known ? Number((plan.projectedTemp - state.indoorTemp).toFixed(1)) : 0;
  const coolingHidden = known && delta < 0 && Number.isFinite(state.indoorTemp) &&
    state.indoorRh - relativeHumidityAtTemperature(vaporPressure(plan.projectedTemp, plan.projectedRh), state.indoorTemp) >= MINIMUM_NOTICEABLE_RH_CHANGE &&
    state.indoorRh - plan.projectedRh < MINIMUM_NOTICEABLE_RH_CHANGE;
  const forecast = (state.forecast ?? []).filter(hour => Number.isFinite(hour.time?.getTime()) && hour.time.getTime() > now);
  const forecastEnd = Math.max(end, now + (known && plan.status === 'good' ? plan.dryAirHorizon.minutes : 0) * 60000);
  const forecastLimited = !forecast.length || Math.max(...forecast.map(hour => hour.time.getTime())) < forecastEnd;
  return { unavailable, known, useful, optional, opening, percent, minutes, peak, rainKind,
    rainComplete: coveredUntil >= end, chance: chances.length ? Math.max(...chances) : null,
    chanceComplete: rain.length > 0 && chances.length === rain.length,
    from: sector === null ? null : compass[sector], to: sector === null ? null : compass[(sector + 4) % 8],
    windAvailable, calm: windAvailable && state.outdoorWind < 1, delta, coolingHidden, forecastLimited, forecastAvailable: forecast.length > 0 };
}

export function explanationRows(state, plan, comparison, facts, formatForecastOpeningTime) {
  const rows = [];
  const moisture = comparison?.status === 'drier'
    ? facts.percent === null ? ['Outdoor air holds less moisture. '] : ['Outdoor air has about ', bold(`${facts.percent}% less moisture`), '. ']
    : comparison?.status === 'wetter'
      ? facts.percent === null ? ['Outdoor air holds more moisture. '] : ['Outdoor air has about ', bold(`${facts.percent}% more moisture`), '. ']
      : ['The readings are too close to tell whether opening would help. '];
  if (!facts.known) rows.push(row('reason', 'Recommendation', 'These readings do not give a clear recommendation. Check them and try again.'));
  else {
    switch (plan.status) {
      case 'target-met':
        rows.push(row('reason', 'Drying', 'There’s little to gain from drying the room further. ', ...moisture)); break;
      case 'below-minimum':
        rows.push(row('reason', 'Temperature', 'Heat escapes when colder outdoor air replaces warmer room air. Keep windows closed to avoid cooling the room further.')); break;
      case 'wetter':
        rows.push(row('reason', 'Moisture', ...(comparison.status === 'wetter' ? moisture : []), 'Replacing room air would bring extra moisture indoors.')); break;
      case 'uncertain':
        rows.push(row('reason', 'Drying', 'The readings are too close to tell whether opening would help. A brief opening for fresh air may not lower humidity.')); break;
      case 'good':
        rows.push(row('reason', 'Drying', ...moisture, comparison.status === 'drier'
          ? 'Replacing indoor air helps remove moisture.' : 'Recheck the readings before relying on the drying estimate.'));
        rows.push(row('window', 'Longer time', plan.dryAirHorizon.capped
          ? 'The longer time reaches the model’s limit; drying may continue beyond it. '
          : 'As moisture leaves the room, the drying benefit gradually reduces. ',
        'Close when your target is reached; the longer time above is not how long you need to leave windows open.')); break;
      case 'forecast-limit':
        rows.push(row('reason', 'Changing weather', facts.useful
          ? 'Outdoor air is expected to become less useful for drying. Close at the limit shown above.'
          : 'Outdoor air is not expected to stay drier long enough to noticeably help.')); break;
      case 'settling':
        rows.push(row('reason', 'Drying benefit', facts.useful
          ? 'As moisture leaves the room, the drying benefit gradually reduces. Continuing after the limit above is unlikely to help much.'
          : 'Indoor and outdoor air are too similar for much drying to be expected.')); break;
      case 'too-cold': {
        const reversal = state.indoorTemp < state.minTemp && plan.projectedTemp < state.minTemp;
        rows.push(row('reason', 'Temperature', facts.useful
          ? reversal ? 'Opening initially helps, but stop before the room starts cooling again. It is already below your minimum temperature.'
            : 'Further opening would cool the room too much. Stop at the limit shown above.'
          : 'Opening would cool the room further than your settings allow. Keep windows closed.')); break;
      }
      case 'condensation':
        rows.push(row('reason', 'Condensation', facts.useful
          ? 'The model expects room air to become saturated, when moisture can turn into water. Stop at the limit shown above.'
          : 'The model expects room air to become saturated almost immediately, when moisture can turn into water. Keep windows closed.',
        ' Condensation on cold windows or walls is not assessed.')); break;
      case 'slow':
        rows.push(row('reason', 'Gradual drying', ...(comparison.status === 'drier' ? moisture : []), 'Moisture removal is gradual. Fresh indoor readings will show whether ventilation is helping.')); break;
      case 'minimal-impact':
        rows.push(row('reason', 'Small benefit', 'Little noticeable improvement is expected. ', facts.coolingHidden
          ? 'The room may lose moisture while cooling keeps the humidity reading high.'
          : 'A brief opening for fresh air may not lower humidity.')); break;
    }
    if (facts.coolingHidden && facts.useful) {
      rows[0].parts.push(' Cooling may keep the humidity reading high even while moisture leaves.');
    }
    if (facts.forecastLimited) {
      const message = facts.forecastAvailable
        ? ' Forecast coverage is limited; recheck as conditions change.'
        : ' Only current weather is available; the estimate assumes it stays the same. Recheck as conditions change.';
      (rows.find(item => item.key === 'window') ?? rows[0]).parts.push(message);
    }
    const closed = ['below-minimum', 'wetter'].includes(plan.status) ||
      (['too-cold', 'condensation'].includes(plan.status) && !facts.useful);
    if (closed && Number.isFinite(plan.nextUsefulOpeningTime?.getTime())) {
      rows.push(row('next', 'Later opportunity', `Assuming your indoor readings stay the same, the next suitable time to open windows for drying is forecast around ${formatForecastOpeningTime(plan.nextUsefulOpeningTime)}.`));
    }
  }
  const rainText = { unknown: 'Rain amounts are unavailable.', none: 'No rain is forecast in the available hourly data. Check outside before opening.',
    light: 'Light rain is forecast.', moderate: 'Moderate rain is forecast.', heavy: 'Heavy rain is forecast.' }[facts.rainKind];
  const rainParts = [rainText];
  if (!facts.rainComplete && facts.peak !== null) rainParts.push(' Rain coverage is incomplete.');
  if (facts.opening && facts.rainKind === 'heavy') rainParts.push(' Wait if rain is heavy at your window.');
  else if (facts.opening && (facts.rainKind !== 'none' || !facts.rainComplete || facts.chance > 0)) rainParts.push(facts.optional
    ? ' If opening for fresh air, use only a sheltered window where water cannot enter; close it if water blows in.'
    : ' Use only a sheltered window where water cannot enter; close it if water blows in.');
  // Closed and target-met outcomes report weather without suggesting opening.
  if (!facts.opening && facts.rainKind === 'none') rainParts[0] = 'No rain is forecast in the available hourly data.';
  rows.push(row('rain', 'Rain', ...rainParts));
  rows.push(row('wind', 'Wind', ...(facts.calm ? ['Little or no wind is reported; direction gives little guidance.']
    : facts.from ? ['Coming from the ', bold(facts.from), '.', !facts.windAvailable ? ' Wind speed is unavailable.' : '',
      facts.opening ? ` Avoid exposed ${facts.from}-facing windows if rain blows towards them.` : '']
      : ['Direction is unavailable.', !facts.windAvailable ? ' Wind speed is also unavailable.' : '',
        facts.opening ? ' Check for wind-driven rain at the window.' : ''])));
  if (facts.useful && ['good', 'slow'].includes(plan.status) && facts.delta !== 0 && rows.length < 5) {
    rows.push(row('temperature', facts.delta < 0 ? 'Cooling' : 'Warming', 'The room may ',
      facts.delta < 0 ? 'cool' : 'warm', ' by about ', bold(`${Math.abs(facts.delta).toFixed(1)}°C`),
      ' during the estimated opening period.'));
  }
  return rows;
}

// Decorative category cues; the row text remains the complete explanation.
const explanationIconPaths = {
  moisture: 'M7 2C7 2 3 6.5 3 9a4 4 0 0 0 8 0c0-2.5-4-7-4-7ZM14 9s-2.5 3-2.5 4.5a2.5 2.5 0 0 0 5 0C16.5 12 14 9 14 9Z',
  temperature: 'M8 11V4a2 2 0 0 1 4 0v7a3 3 0 1 1-4 0ZM10 7v7',
  cloud: 'M5 15a3 3 0 0 1 0-6h.5C6 5 11 3.5 13 7h1a4 4 0 0 1 0 8H5Z',
  rain: 'M5 12a3 3 0 0 1-.5-6A4 4 0 0 1 12 5a3.5 3.5 0 0 1 3 7H5ZM6 15l-1 3m5-3-1 3m5-3-1 3',
  wind: 'M2 7h11a2.5 2.5 0 1 0-2.5-2.5M2 11h14a2 2 0 1 1-2 2M2 14h5a2 2 0 1 1-2 2',
  time: 'M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM10 5v5l3 2',
  neutral: 'M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM7.5 7a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1-1.5 2M10 14h.01',
};
function explanationIcon(document, item) {
  const category = item.key === 'reason'
    ? ({ Temperature: 'temperature', 'Changing weather': 'cloud', Recommendation: 'neutral' }[item.label] || 'moisture')
    : ({ window: 'time', next: 'time', rain: 'rain', wind: 'wind', temperature: 'temperature' }[item.key] || 'neutral');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [name, value] of Object.entries({ class: 'explanation-icon', viewBox: '0 0 20 20',
    width: '20', height: '20', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.2',
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' })) {
    svg.setAttribute(name, value);
  }
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', explanationIconPaths[category]);
  svg.append(path);
  return svg;
}

export function createExplanationView({ state, elements, formatTemp, formatRh, formatDuration,
  formatForecastOpeningTime, formatVentilationSummary, planLimitingExplanation } = {}, environment = globalThis) {
  const { document, Date } = environment;
  function hideDetail() {
    const detail = elements.explanationDetails;
    if (detail?.contains?.(document.activeElement) || document.activeElement === elements.explanationDetailsSummary) {
      elements.explanationToggle?.focus({ preventScroll: true });
    }
    if (detail) detail.hidden = true;
  }
  function render(plan, comparison, adjustedRh, condensationRisk) {
    const facts = explanationFacts(state, plan, comparison, Date.now());
    for (const key of ['explanationText', 'explanationHorizon', 'explanationRain', 'explanationWind', 'explanationModel']) {
      if (!elements[key]) continue;
      elements[key].textContent = '';
      elements[key].hidden = true;
      const section = elements[key].closest?.(".explanation-detail");
      if (section) section.hidden = true;
    }
    const put = (key, value) => {
      if (!elements[key]) return;
      elements[key].textContent = value;
      elements[key].hidden = !value;
      const section = elements[key].closest?.(".explanation-detail");
      if (section) section.hidden = !value;
    };
    if (facts.unavailable) {
      hideDetail();
      if (elements.explanationOverview) {
        elements.explanationOverview.hidden = true;
        elements.explanationOverview.replaceChildren?.();
      }
      const location = state.location.name || 'the selected location';
      const message = state.weatherLoadFailed || !state.weatherRequestPending
        ? `Outdoor weather is unavailable for ${location}. Current weather is needed before advice can be given.`
        : `Checking outdoor weather for ${location}. The recommendation will appear when current data arrives.`;
      put('explanationStatus', message);
      // Retain the detailed text hook for consumers that inspect weather states.
      if (elements.explanationText) elements.explanationText.textContent = message;
      return;
    }
    put('explanationStatus', '');
    const rows = explanationRows(state, plan, comparison, facts, formatForecastOpeningTime);
    if (elements.explanationOverview?.replaceChildren) {
      const nodes = rows.map(item => {
        const paragraph = document.createElement('p');
        paragraph.dataset.explanationRow = item.key;
        const label = document.createElement('strong');
        label.textContent = item.label;
        label.className = "explanation-row-label";
        const content = document.createElement('span');
        content.className = "explanation-copy";
        const body = document.createElement("span");
        body.className = "explanation-row-text";
        body.append(...item.parts.map(part => {
          if (typeof part === 'string') return part;
          const emphasis = document.createElement('strong');
          emphasis.textContent = part.strong;
          return emphasis;
        }));
        content.append(label, body);
        paragraph.append(explanationIcon(document, item), content);
        return paragraph;
      });
      elements.explanationOverview.replaceChildren(...nodes);
      elements.explanationOverview.hidden = false;
    }
    if (!facts.known) { hideDetail(); return; }
    if (elements.explanationDetails) elements.explanationDetails.hidden = false;
    let relationship = comparison.status === 'drier' ? 'Outdoor air is drier than the air indoors.'
      : comparison.status === 'wetter' ? 'Outdoor air contains more moisture than the air indoors.'
        : 'The moisture difference between indoor and outdoor air is too small to be sure.';
    if ([comparison.indoor, comparison.outdoorEquivalent, comparison.difference].every(Number.isFinite)) {
      relationship += ` At the same ${formatTemp(state.indoorTemp)} temperature, outdoor air contains ${comparison.outdoorEquivalent.toFixed(1)} g/m³ versus ${comparison.indoor.toFixed(1)} g/m³ indoors — ${Math.abs(comparison.difference).toFixed(1)} g/m³ ${comparison.difference >= 0 ? 'less' : 'more'} moisture.`;
      if (Number.isFinite(adjustedRh) && !condensationRisk) relationship += ` Outdoor air brought to this temperature would be about ${formatRh(adjustedRh)} RH.`;
    }
    const closed = ['below-minimum', 'wetter'].includes(plan.status) ||
      (['too-cold', 'condensation'].includes(plan.status) && !facts.useful);
    const next = closed && Number.isFinite(plan.nextUsefulOpeningTime?.getTime())
      ? ` Assuming your indoor readings stay the same, the next suitable time to open windows for drying is forecast around ${formatForecastOpeningTime(plan.nextUsefulOpeningTime)}.` : '';
    put('explanationText', `${relationship} ${planLimitingExplanation(plan, comparison)}${next}`);
    if (plan.status === 'good') {
      const horizon = plan.dryAirHorizon;
      put('explanationHorizon', `The ${formatDuration(horizon.minutes)} drier-air window compares outdoor air with the changing room as it dries and cools, allowing for reading uncertainty. ${horizon.capped
        ? 'It reaches the model’s three-hour limit; drying may continue beyond it.'
        : 'After that, the moisture difference becomes too small for confident further drying.'} Close when your target is reached. This is not a rain or comfort limit.`);
    }
    const period = facts.useful ? `during the suggested ${formatDuration(facts.minutes)} opening` : 'over the next hour';
    const amount = facts.peak === null ? 'Forecast rain amounts are unavailable.'
      : `The highest hourly rain-and-shower amount ${period} is ${facts.peak < .1 && facts.peak > 0 ? facts.peak.toFixed(2) : facts.peak.toFixed(1)} mm in an overlapping forecast hour.`;
    put('explanationRain', `${amount}${facts.rainComplete ? '' : ' Rain coverage is incomplete for this period.'}${facts.chance === null ? ' Precipitation chance is unavailable.' : ` Highest available hourly precipitation chance: ${Math.round(facts.chance)}%.${facts.chanceComplete ? '' : ' Chance data is incomplete.'}`} Hourly averages can hide heavier showers. Precipitation chance can include snow; rain amounts exclude snow. Hourly totals are not prorated into an opening-period total. The drying verdict does not assess rain entering the room.`);
    put('explanationWind', `${facts.calm ? 'Little or no wind is reported.' : facts.from ? `Wind comes from the ${facts.from} and blows towards the ${facts.to}.` : 'Wind direction is unavailable.'} ${facts.windAvailable ? `Reported 10m wind speed: ${Math.round(state.outdoorWind)} km/h.` : 'Wind speed is unavailable.'} Actual exposure depends on your building; window positions and gusts are not modelled.`);
    const airflow = effectiveAirExchange(state, currentWeather(state), state.indoorTemp).airChangesPerHour;
    put('explanationModel', `The estimate assumes ${formatVentilationSummary().toLowerCase()}, about ${airflow.toFixed(1)} air changes per hour.${facts.useful ? ` Estimated room temperature then: ${formatTemp(plan.projectedTemp)}; your minimum is ${formatTemp(state.minTemp)}.` : ''}${facts.forecastLimited ? ' Forecast coverage is limited; beyond it, the estimate holds the last available conditions unchanged.' : ''} Actual airflow and drying time vary; recheck your indoor reading after ventilation.`);
  }
  return { render };
}
