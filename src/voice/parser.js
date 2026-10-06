import { INDOOR_LIMITS } from '../config.js';


export const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

export function parseSpokenNumberCore(value) {
  const normalized = value.toLowerCase().replace(/-/g, " ");
  const includesHalf = /\b(?:and\s+)?(?:a\s+)?half\b/.test(normalized);
  const withoutHalf = normalized.replace(/\b(?:and\s+)?(?:a\s+)?half\b/, " ");
  const numeric = withoutHalf.match(/\d+(?:[.,]\d+)?/);
  if (numeric) return Number(numeric[0].replace(",", ".")) + (includesHalf ? 0.5 : 0);
  const words = withoutHalf.split(/\s+/);
  let total = 0;
  let found = false;
  let decimal = "";
  let afterPoint = false;
  for (const word of words) {
    if (word === "point") {
      if (!found) continue;
      afterPoint = true;
      continue;
    }
    if (word === "and" || word === "a") continue;
    const number = NUMBER_WORDS[word];
    if (number === undefined) {
      if (found) break;
      continue;
    }
    found = true;
    if (afterPoint) decimal += String(number);
    else total += number;
  }
  if (!found) return null;
  return Number(`${total}${decimal ? `.${decimal}` : ""}`) + (includesHalf ? 0.5 : 0);
}

export function parseSpokenNumber(value) {
  const parts = value.split(/\b(?:actually|sorry|i\s+mean|make\s+that|no)\b/i);
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const parsed = parseSpokenNumberCore(parts[index]);
    if (parsed !== null) return parsed;
  }
  return null;
}

export const VOICE_FIELD_BOUNDARY = /\b(?:(?:indoor|room)\s+(?:temperature|temp)|(?:indoor\s+)?(?:relative\s+)?humidity|(?:indoor\s+)?rh|room\s+(?:is|at)|(?:temperature|temp))\b/;

export const NEGATED_FIELD = /\b(?:do\s+not|don't|dont)\s+(?:change|update|set)(?:\s+(?:the|my|indoor|room|target|minimum|relative)){0,4}\s*$/;

export function lastValueAfterLabel(text, pattern, excludedPattern = null) {
  const matches = text.matchAll(new RegExp(pattern.source, `${pattern.flags}g`));
  let value = null;
  for (const match of matches) {
    const before = text.slice(0, match.index);
    if (NEGATED_FIELD.test(before) || excludedPattern?.test(before)) continue;
    const valueStart = match.index + match[0].length;
    const nextField = text.slice(valueStart).match(VOICE_FIELD_BOUNDARY);
    const valueEnd = nextField ? valueStart + nextField.index : text.length;
    value = parseSpokenNumber(text.slice(valueStart, valueEnd));
  }
  return value;
}

export function lastValueBeforeUnit(text, unitType) {
  const units = [...text.matchAll(/\b(?:degrees?|celsius|c|percent|per\s+cent)\b/g)];
  let previousEnd = 0;
  let value = null;
  for (const unit of units) {
    const isPercent = /^(?:percent|per\s+cent)$/.test(unit[0]);
    if ((unitType === "percent") === isPercent) {
      const segment = text.slice(previousEnd, unit.index);
      const isPlanValue = unitType === "percent"
        ? /\btarget(?:\s+indoor)?(?:\s+relative)?\s+(?:humidity|rh)\b/.test(segment)
        : /\b(?:minimum|min)\s+(?:indoor\s+)?(?:temperature|temp)\b/.test(segment);
      if (!isPlanValue) value = parseSpokenNumber(segment);
    }
    previousEnd = unit.index + unit[0].length;
  }
  return value;
}

export function inferUnlabelledIndoorValues(text) {
  const correctedPhrase = text.split(/\b(?:actually|sorry|i\s+mean|make\s+that|no)\b/i).at(-1);
  const numberTokens = [...correctedPhrase.matchAll(/\d+(?:\.\d+)?/g)].map((match) => ({
    value: Number(match[0]),
    hasDecimal: match[0].includes("."),
  }));
  if (numberTokens.length === 0 || numberTokens.length > 2) return {};

  const isTemperature = (number) => number >= INDOOR_LIMITS.temperature.min && number <= INDOOR_LIMITS.temperature.max;
  const isHumidity = (number) => Number.isInteger(number) && number >= INDOOR_LIMITS.humidity.min && number <= INDOOR_LIMITS.humidity.max;
  if (numberTokens.length === 1) {
    const [{ value, hasDecimal }] = numberTokens;
    if (hasDecimal && isTemperature(value)) return { indoorTemp: value };
    if (isTemperature(value) && !isHumidity(value)) return { indoorTemp: value };
    if (isHumidity(value) && !isTemperature(value)) return { indoorRh: value };
    return {};
  }

  const [first, second] = numberTokens;
  const temperatureFirst = isTemperature(first.value) && isHumidity(second.value);
  const temperatureSecond = isTemperature(second.value) && isHumidity(first.value);
  if (temperatureFirst && !temperatureSecond) return { indoorTemp: first.value, indoorRh: second.value };
  if (temperatureSecond && !temperatureFirst) return { indoorTemp: second.value, indoorRh: first.value };
  if (temperatureFirst && temperatureSecond) return { indoorTemp: first.value, indoorRh: second.value };
  return {};
}

export function parseVoiceCommand(transcript) {
  const text = transcript.toLowerCase()
    .replace(/°\s*c?/g, " degrees ")
    .replace(/%/g, " percent ")
    .replace(/,/g, " ");
  const values = {};
  const errors = [];
  let indoorTemp = lastValueAfterLabel(
    text,
    /\b(?:(?:indoor|room)\s+(?:temperature|temp)|(?:temperature|temp)|room\s+(?:is|at))\b/,
    /\b(?:minimum|min)(?:\s+indoor)?\s*$/,
  );
  let indoorRh = lastValueAfterLabel(
    text,
    /\b(?:(?:indoor\s+)?(?:relative\s+)?humidity|(?:indoor\s+)?rh)\b/,
    /\btarget(?:\s+indoor)?(?:\s+relative)?\s*$/,
  );
  if (indoorTemp === null) indoorTemp = lastValueBeforeUnit(text, "temperature");
  if (indoorRh === null) indoorRh = lastValueBeforeUnit(text, "percent");
  const hasLabelsOrUnits = VOICE_FIELD_BOUNDARY.test(text)
    || /\b(?:degrees?|celsius|c|percent|per\s+cent)\b/.test(text);
  if (indoorTemp === null && indoorRh === null && !hasLabelsOrUnits) {
    const inferred = inferUnlabelledIndoorValues(text);
    indoorTemp = inferred.indoorTemp ?? null;
    indoorRh = inferred.indoorRh ?? null;
  }
  if (indoorTemp !== null) {
    if (indoorTemp < INDOOR_LIMITS.temperature.min || indoorTemp > INDOOR_LIMITS.temperature.max) errors.push("Indoor temperature must be between 10 and 45.");
    else values.indoorTemp = Number(indoorTemp.toFixed(1));
  }
  if (indoorRh !== null) {
    if (indoorRh < INDOOR_LIMITS.humidity.min || indoorRh > INDOOR_LIMITS.humidity.max) errors.push("Indoor humidity must be between 10 and 90.");
    else values.indoorRh = Math.round(indoorRh);
  }
  return { values, errors };
}
