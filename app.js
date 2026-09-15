const WEATHER_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";
const UK_POSTCODE_ENDPOINT = "https://api.postcodes.io/postcodes";
const UK_OUTCODE_ENDPOINT = "https://api.postcodes.io/outcodes";
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
const LOCATION_REQUESTED_STORAGE_KEY = "is-it-dryer-out-location-requested";
const DEFAULT_TIMEZONE = "Europe/London";
const DEFAULT_PRESSURE_HPA = 1013.25;
const MINIMUM_MOISTURE_MARGIN = 0.4;
const WEATHER_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const MAX_OPEN_MINUTES = 180;
const TARGET_MARGIN_RH = 0.5;
const MINIMUM_NOTICEABLE_RH_CHANGE = 1;
const THERMAL_RESPONSE_FACTOR = 0.22;
const ROOM_PRESETS = { small: 30, medium: 50, large: 80 };
const OPENING_SETUPS = {
  slightly: { label: "Window slightly open", airflow: 25 },
  single: { label: "One window fully open", airflow: 80 },
  cross: { label: "Cross-ventilation", airflow: 180 },
};
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
// Keep the build identity in the script so stale code identifies itself correctly.
const APP_BUILD_VERSION = "0.5.4+diagnostics.1";
const VOICE_DEBUG_ENABLED = new URLSearchParams(window.location.search).get("voice-debug") === "1";
const IS_IOS = /iP(?:hone|ad|od)/.test(navigator.userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const VOICE_SILENCE_DURATION_MS = 1000;
const VOICE_CLEANUP_TIMEOUT_MS = 2500;
const VOICE_START_TIMEOUT_MS = 6000;
const VOICE_MAX_DURATION_MS = 15000;
const VOICE_METER_CALIBRATION_MS = 600;
const VOICE_MIN_ACTIVITY_THRESHOLD = 0.018;
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
  minTemp: 18,
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
  lastSuccessfulUpdateAt: null,
  weatherRequestPending: false,
  weatherLoadFailed: false,
  timezone: DEFAULT_TIMEZONE,
  location: { ...DEFAULT_LOCATION },
  locationMode: "current",
};

const elements = {
  recommendation: document.querySelector(".recommendation"),
  dashboardPanel: document.querySelector(".dashboard-panel"),
  decisionLabel: document.querySelector("#decisionLabel"),
  decisionPrimary: document.querySelector("#decisionPrimary"),
  decisionSecondary: document.querySelector("#decisionSecondary"),
  retryWeather: document.querySelector("#retryWeather"),
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
  weatherDataStatus: document.querySelector("#weatherDataStatus"),
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
  planSummaryButton: document.querySelector("#planSummaryButton"),
  planSummaryText: document.querySelector("#planSummaryText"),
  planSummaryVentilationText: document.querySelector("#planSummaryVentilationText"),
  planDialog: document.querySelector("#planDialog"),
  planDialogCloseButton: document.querySelector("#planDialogCloseButton"),
  forecastStrip: document.querySelector("#forecastStrip"),
  locationName: document.querySelector("#locationName"),
  sourceLocationName: document.querySelector("#sourceLocationName"),
  liveWeatherRequest: document.querySelector("#liveWeatherRequest"),
  locationButton: document.querySelector("#locationButton"),
  locationDialog: document.querySelector("#locationDialog"),
  locationDialogClose: document.querySelector("#locationDialogClose"),
  locationDialogStatus: document.querySelector("#locationDialogStatus"),
  locationUpdateButton: document.querySelector("#locationUpdateButton"),
  locationSearchForm: document.querySelector("#locationSearchForm"),
  locationSearchInput: document.querySelector("#locationSearchInput"),
  locationSearchButton: document.querySelector("#locationSearchButton"),
  locationSearchResults: document.querySelector("#locationSearchResults"),
  voiceInputButton: document.querySelector("#voiceInputButton"),
  voiceDialog: document.querySelector("#voiceDialog"),
  voiceStatus: document.querySelector("#voiceStatus"),
  voiceTranscriptPanel: document.querySelector("#voiceTranscriptPanel"),
  voiceTranscript: document.querySelector("#voiceTranscript"),
  voiceChanges: document.querySelector("#voiceChanges"),
  voiceUpdateNote: document.querySelector("#voiceUpdateNote"),
  voiceDialogCloseButton: document.querySelector("#voiceDialogCloseButton"),
  voiceListenButton: document.querySelector("#voiceListenButton"),
  voiceApplyButton: document.querySelector("#voiceApplyButton"),
};

let activeWeatherRequestId = 0;
let activeVoiceSession = null;
let voiceDebugSession = 0;
let voiceDebugStartedAt = performance.now();
const voiceDebugEntries = [];

function voiceDebugLog(event, details = {}, sessionId = activeVoiceSession?.id || voiceDebugSession) {
  if (!VOICE_DEBUG_ENABLED) return;
  const elapsed = ((performance.now() - voiceDebugStartedAt) / 1000).toFixed(3);
  const detailText = Object.entries(details)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
  voiceDebugEntries.push(`${elapsed}s [session ${sessionId || "-"}] ${event}${detailText ? ` ${detailText}` : ""}`);
  const output = document.querySelector("#voiceDebugOutput");
  if (output) {
    output.textContent = voiceDebugEntries.join("\n");
    output.scrollTop = output.scrollHeight;
  }
}

function logVoiceDebugEnvironment(event) {
  voiceDebugLog(event, {
    build: APP_BUILD_VERSION,
    assetRevision: new URL(import.meta.url).searchParams.get("v") || "unversioned",
    recognition: Boolean(SpeechRecognition),
    mediaDevices: Boolean(navigator.mediaDevices?.getUserMedia),
    audioContext: Boolean(window.AudioContext || window.webkitAudioContext),
  });
}

function initializeVoiceDebugPanel() {
  if (!VOICE_DEBUG_ENABLED) return;
  const panel = document.createElement("details");
  panel.className = "voice-debug-panel";
  panel.open = true;
  panel.innerHTML = `
    <summary>Voice diagnostics</summary>
    <div class="voice-debug-actions">
      <button type="button" id="voiceDebugCopy">Copy</button>
      <button type="button" id="voiceDebugClear">Clear</button>
    </div>
    <pre id="voiceDebugOutput" aria-live="polite"></pre>
  `;
  document.body.append(panel);
  panel.querySelector("#voiceDebugCopy").addEventListener("click", async () => {
    const text = voiceDebugEntries.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      voiceDebugLog("diagnostics copied", { lines: voiceDebugEntries.length });
    } catch {
      voiceDebugLog("diagnostics copy failed");
    }
  });
  panel.querySelector("#voiceDebugClear").addEventListener("click", () => {
    voiceDebugEntries.length = 0;
    voiceDebugStartedAt = performance.now();
    panel.querySelector("#voiceDebugOutput").textContent = "";
    logVoiceDebugEnvironment("diagnostics cleared");
  });
  logVoiceDebugEnvironment("debug mode ready");
}
let pendingVoiceChanges = null;

const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

function parseSpokenNumberCore(value) {
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

function parseSpokenNumber(value) {
  const parts = value.split(/\b(?:actually|sorry|i\s+mean|make\s+that|no)\b/i);
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const parsed = parseSpokenNumberCore(parts[index]);
    if (parsed !== null) return parsed;
  }
  return null;
}

const VOICE_FIELD_BOUNDARY = /\b(?:(?:indoor|room)\s+(?:temperature|temp)|(?:indoor\s+)?(?:relative\s+)?humidity|(?:indoor\s+)?rh|room\s+(?:is|at)|(?:temperature|temp))\b/;
const NEGATED_FIELD = /\b(?:do\s+not|don't|dont)\s+(?:change|update|set)(?:\s+(?:the|my|indoor|room|target|minimum|relative)){0,4}\s*$/;

function lastValueAfterLabel(text, pattern, excludedPattern = null) {
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

function lastValueBeforeUnit(text, unitType) {
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

function inferUnlabelledIndoorValues(text) {
  const correctedPhrase = text.split(/\b(?:actually|sorry|i\s+mean|make\s+that|no)\b/i).at(-1);
  const numberTokens = [...correctedPhrase.matchAll(/\d+(?:\.\d+)?/g)].map((match) => ({
    value: Number(match[0]),
    hasDecimal: match[0].includes("."),
  }));
  if (numberTokens.length === 0 || numberTokens.length > 2) return {};

  const isTemperature = (number) => number >= 10 && number <= 32;
  const isHumidity = (number) => Number.isInteger(number) && number >= 20 && number <= 90;
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

function parseVoiceCommand(transcript) {
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
    if (indoorTemp < 10 || indoorTemp > 32) errors.push("Indoor temperature must be between 10 and 32.");
    else values.indoorTemp = Number(indoorTemp.toFixed(1));
  }
  if (indoorRh !== null) {
    if (indoorRh < 20 || indoorRh > 90) errors.push("Indoor humidity must be between 20 and 90.");
    else values.indoorRh = Math.round(indoorRh);
  }
  return { values, errors };
}

function voiceChangeRows(values) {
  const rows = [];
  if (values.indoorTemp !== undefined) rows.push(["Indoor temperature", formatTemp(values.indoorTemp)]);
  if (values.indoorRh !== undefined) rows.push(["Indoor humidity", formatRh(values.indoorRh)]);
  return rows;
}

function showVoiceResult(transcript, allowApply = true, session = activeVoiceSession) {
  if (session) session.hadResult = true;
  const parsed = parseVoiceCommand(transcript);
  const rows = voiceChangeRows(parsed.values);
  pendingVoiceChanges = rows.length ? parsed.values : null;
  elements.voiceTranscript.textContent = `Heard: “${transcript}”`;
  elements.voiceTranscriptPanel.hidden = false;
  elements.voiceChanges.classList.toggle("has-single-change", rows.length === 1);
  elements.voiceChanges.replaceChildren(...rows.map(([label, value]) => {
    const row = document.createElement("div");
    row.className = "voice-change";
    const term = document.createElement("dt");
    const detail = document.createElement("dd");
    term.textContent = label;
    detail.textContent = value;
    row.append(term, detail);
    return row;
  }));
  elements.voiceUpdateNote.hidden = rows.length === 0;
  elements.voiceStatus.textContent = allowApply
    ? parsed.errors.length
      ? parsed.errors.join(" ")
      : rows.length ? "Review the changes before applying." : "Couldn't find a temperature or humidity reading."
    : "Listening...";
  elements.voiceApplyButton.disabled = !pendingVoiceChanges || parsed.errors.length > 0;
  elements.voiceApplyButton.hidden = elements.voiceApplyButton.disabled;
  if (allowApply) {
    elements.voiceListenButton.setAttribute("aria-label", "Record again");
    elements.voiceListenButton.title = "Record again";
  }
}

function resetVoiceMeter() {
  document.querySelectorAll(".voice-input-button").forEach((button) => button.style.setProperty("--voice-level", "0"));
  document.querySelectorAll(".voice-waveform span").forEach((bar) => {
    bar.style.height = "2px";
    bar.style.opacity = "0.72";
  });
}

function stopVoiceMeter(session) {
  if (!session) return;
  voiceDebugLog("meter stopping", {
    track: session.stream?.getAudioTracks()[0]?.readyState || "none",
    context: session.context?.state || "none",
  }, session.id);
  if (session.meterFrame !== null) cancelAnimationFrame(session.meterFrame);
  session.meterFrame = null;
  if (session.source) {
    try {
      session.source.disconnect();
    } catch {
      // The browser may already have disconnected this source.
    }
  }
  session.source = null;
  session.stream?.getTracks().forEach((track) => track.stop());
  session.stream = null;
  if (session.context && session.context.state !== "closed") session.context.close().catch(() => {});
  session.context = null;
  if (activeVoiceSession === session) resetVoiceMeter();
}

function markVoiceActivity(session, source) {
  if (activeVoiceSession !== session) return;
  if (!session.soundDetected) voiceDebugLog("voice activity detected", { source }, session.id);
  session.soundDetected = true;
  session.silentSince = null;
}

async function prepareVoiceAudioContext(session) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!session.context || session.context.state === "closed") {
    session.context = new AudioContext();
    const context = session.context;
    context.addEventListener("statechange", () => {
      voiceDebugLog("audio context statechange", { state: context.state }, session.id);
    });
    voiceDebugLog("audio context created", { state: context.state }, session.id);
  }
  if (session.context.state === "suspended") {
    try {
      await session.context.resume();
      voiceDebugLog("audio context resumed", { state: session.context.state }, session.id);
    } catch (error) {
      voiceDebugLog("audio context resume failed", { name: error?.name || "unknown" }, session.id);
      return null;
    }
  }
  return session.context;
}

async function startVoiceMeter(session) {
  try {
    voiceDebugLog("getUserMedia requested", {}, session.id);
    session.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    voiceDebugLog("meter unavailable", { name: error?.name || "unknown" }, session.id);
    return;
  }
  if (activeVoiceSession !== session || session.finished) {
    session.stream.getTracks().forEach((track) => track.stop());
    session.stream = null;
    return;
  }
  const track = session.stream.getAudioTracks()[0];
  voiceDebugLog("getUserMedia resolved", {
    track: track?.readyState || "none",
    enabled: track?.enabled ?? "unknown",
    muted: track?.muted ?? "unknown",
  }, session.id);
  ["mute", "unmute", "ended"].forEach((name) => {
    track?.addEventListener(name, () => {
      voiceDebugLog(`track ${name}`, { state: track.readyState, muted: track.muted }, session.id);
    });
  });
  const context = await prepareVoiceAudioContext(session);
  if (activeVoiceSession !== session || !context || context.state !== "running") {
    voiceDebugLog("meter unavailable", { context: context?.state || "none" }, session.id);
    stopVoiceMeter(session);
    return;
  }
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  session.source = context.createMediaStreamSource(session.stream);
  session.source.connect(analyser);
  voiceDebugLog("meter started", { context: context.state }, session.id);
  const samples = new Float32Array(analyser.fftSize);
  const waveforms = [...document.querySelectorAll(".voice-waveform")];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const maximumHeights = [8, 12, 16, 12, 8];
  const calibrationLevels = [];
  const meterStartedAt = performance.now();
  let noiseFloor = 0.006;
  let activityThreshold = VOICE_MIN_ACTIVITY_THRESHOLD;
  let calibrationLogged = false;
  let displayedLevel = 0;
  const draw = () => {
    if (activeVoiceSession !== session || session.finished) return;
    analyser.getFloatTimeDomainData(samples);
    let mean = 0;
    for (const sample of samples) mean += sample;
    mean /= samples.length;
    let total = 0;
    for (const sample of samples) total += (sample - mean) ** 2;
    const measuredLevel = Math.sqrt(total / samples.length);
    const elapsed = performance.now() - meterStartedAt;
    if (elapsed <= VOICE_METER_CALIBRATION_MS) {
      calibrationLevels.push(measuredLevel);
    } else if (!calibrationLogged) {
      const sorted = calibrationLevels.sort((a, b) => a - b);
      noiseFloor = sorted[Math.floor(sorted.length * 0.2)] || noiseFloor;
      activityThreshold = Math.max(VOICE_MIN_ACTIVITY_THRESHOLD, noiseFloor * 2.8);
      calibrationLogged = true;
      voiceDebugLog("meter calibrated", {
        noiseFloor: noiseFloor.toFixed(4),
        threshold: activityThreshold.toFixed(4),
      }, session.id);
    } else if (!session.soundDetected && measuredLevel < activityThreshold) {
      noiseFloor = noiseFloor * 0.98 + measuredLevel * 0.02;
      activityThreshold = Math.max(VOICE_MIN_ACTIVITY_THRESHOLD, noiseFloor * 2.8);
    }
    const targetLevel = reduceMotion || measuredLevel < activityThreshold
      ? 0
      : Math.min(1, (measuredLevel - activityThreshold) / Math.max(0.08, 0.18 - activityThreshold));
    displayedLevel += (targetLevel - displayedLevel) * (targetLevel > displayedLevel ? 0.55 : 0.12);
    if (session.isListening && calibrationLogged) {
      if (measuredLevel >= activityThreshold) {
        markVoiceActivity(session, "meter");
      } else if (session.soundDetected) {
        if (session.silentSince === null) session.silentSince = performance.now();
        if (performance.now() - session.silentSince >= VOICE_SILENCE_DURATION_MS) {
          voiceDebugLog("silence threshold reached", { durationMs: VOICE_SILENCE_DURATION_MS }, session.id);
          session.silentSince = null;
          stopVoiceInput(false, session);
          return;
        }
      }
    }
    document.querySelectorAll(".voice-input-button").forEach((button) => {
      button.style.setProperty("--voice-level", displayedLevel.toFixed(3));
    });
    waveforms.forEach((waveform) => {
      [...waveform.children].forEach((bar, index) => {
        bar.style.height = `${Math.round(2 + displayedLevel * (maximumHeights[index] - 2))}px`;
        bar.style.opacity = `${0.72 + displayedLevel * 0.28}`;
      });
    });
    session.meterFrame = requestAnimationFrame(draw);
  };
  draw();
}

function voiceErrorMessage(error) {
  const messages = {
    "no-speech": "No speech detected.",
    "audio-capture": "No microphone is available.",
    "not-allowed": "Microphone access was not allowed.",
    "service-not-allowed": "Speech recognition is blocked in this browser.",
    network: "Voice recognition is unavailable right now.",
    "language-not-supported": "Speech recognition does not support this language.",
  };
  return messages[error] || "Voice input could not be completed.";
}

function showVoiceError(message) {
  pendingVoiceChanges = null;
  elements.voiceStatus.textContent = "";
  elements.voiceStatus.hidden = true;
  elements.voiceTranscript.textContent = message;
  elements.voiceTranscriptPanel.hidden = false;
  elements.voiceChanges.replaceChildren();
  elements.voiceChanges.classList.remove("has-single-change");
  elements.voiceUpdateNote.hidden = true;
  elements.voiceApplyButton.disabled = true;
  elements.voiceApplyButton.hidden = true;
}

function clearVoiceSessionTimers(session) {
  ["silenceTimer", "cleanupTimer", "startupTimer", "maxTimer", "finalTimer"].forEach((name) => {
    if (session[name] !== null) clearTimeout(session[name]);
    session[name] = null;
  });
}

function finishVoiceListening(session) {
  if (!session || session.finished) return;
  session.finished = true;
  clearVoiceSessionTimers(session);
  session.isListening = false;
  session.isStopping = false;
  stopVoiceMeter(session);
  if (activeVoiceSession === session) activeVoiceSession = null;
  elements.voiceStatus.classList.remove("is-listening");
  elements.voiceInputButton.classList.remove("is-listening");
  elements.voiceInputButton.classList.remove("is-meterless");
  elements.voiceListenButton.classList.remove("is-listening");
  elements.voiceListenButton.classList.remove("is-meterless");
  elements.voiceInputButton.disabled = false;
  elements.voiceInputButton.setAttribute("aria-label", "Update indoor readings by voice");
  elements.voiceInputButton.title = "Update indoor readings by voice";
  elements.voiceListenButton.disabled = false;
  elements.voiceListenButton.setAttribute("aria-label", "Record again");
  elements.voiceListenButton.title = "Record again";
}

function completeVoiceSession(session) {
  if (activeVoiceSession !== session || session.finished) return;
  if (session.latestTranscript) showVoiceResult(session.latestTranscript, true, session);
  else if (!session.hadError) showVoiceError("No speech detected. Try again.");
  finishVoiceListening(session);
  if (!session.dialogCancelled) showVoiceDialog();
}

function showVoiceDialog() {
  if (!elements.voiceDialog.open) elements.voiceDialog.showModal();
}

function resetVoiceResult() {
  pendingVoiceChanges = null;
  elements.voiceChanges.replaceChildren();
  elements.voiceChanges.classList.remove("has-single-change");
  elements.voiceTranscriptPanel.hidden = true;
  elements.voiceUpdateNote.hidden = true;
  elements.voiceApplyButton.disabled = true;
  elements.voiceApplyButton.hidden = true;
  elements.voiceListenButton.setAttribute("aria-label", "Record indoor readings");
  elements.voiceListenButton.title = "Record indoor readings";
  elements.voiceStatus.hidden = false;
  elements.voiceStatus.textContent = "Ready to listen.";
  elements.voiceStatus.classList.remove("is-listening");
  resetVoiceMeter();
}

function startVoiceInput() {
  if (activeVoiceSession) return;
  voiceDebugSession += 1;
  const recognition = new SpeechRecognition();
  const session = {
    id: voiceDebugSession,
    recognition,
    stream: null,
    context: null,
    source: null,
    meterFrame: null,
    silenceTimer: null,
    cleanupTimer: null,
    startupTimer: null,
    maxTimer: null,
    finalTimer: null,
    isListening: false,
    isStopping: false,
    hadResult: false,
    hadError: false,
    latestTranscript: "",
    soundDetected: false,
    silentSince: null,
    dialogCancelled: false,
    started: false,
    audioStarted: false,
    finished: false,
  };
  activeVoiceSession = session;
  voiceDebugLog("session requested", {
    context: "none",
    visibility: document.visibilityState,
  }, session.id);
  resetVoiceResult();
  elements.voiceStatus.textContent = "Starting microphone...";
  elements.voiceInputButton.disabled = true;
  elements.voiceListenButton.disabled = true;
  recognition.lang = document.documentElement.lang || navigator.language || "en-GB";
  recognition.continuous = !IS_IOS;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  voiceDebugLog("recognition configured", { continuous: recognition.continuous, ios: IS_IOS }, session.id);
  ["start", "audiostart", "soundstart", "speechstart", "speechend", "soundend", "audioend", "end", "nomatch"].forEach((name) => {
    recognition.addEventListener(name, () => {
      voiceDebugLog(`recognition ${name}`, { current: activeVoiceSession === session }, session.id);
    });
  });
  recognition.addEventListener("result", (event) => {
    const latest = event.results[event.results.length - 1];
    voiceDebugLog("recognition result", {
      current: activeVoiceSession === session,
      results: event.results.length,
      final: latest?.isFinal ?? false,
    }, session.id);
  });
  recognition.addEventListener("error", (event) => {
    voiceDebugLog("recognition error", {
      current: activeVoiceSession === session,
      error: event.error || "unknown",
      message: event.message || "none",
    }, session.id);
  });
  recognition.addEventListener("start", () => {
    if (activeVoiceSession !== session) return;
    session.started = true;
    session.isListening = true;
    session.maxTimer = setTimeout(() => {
      voiceDebugLog("maximum duration reached", { durationMs: VOICE_MAX_DURATION_MS }, session.id);
      stopVoiceInput(false, session);
    }, VOICE_MAX_DURATION_MS);
    elements.voiceInputButton.disabled = false;
    elements.voiceStatus.textContent = "Listening...";
    elements.voiceStatus.classList.add("is-listening");
    elements.voiceListenButton.disabled = false;
    elements.voiceInputButton.classList.add("is-listening");
    elements.voiceListenButton.classList.add("is-listening");
    elements.voiceInputButton.classList.toggle("is-meterless", IS_IOS);
    elements.voiceListenButton.classList.toggle("is-meterless", IS_IOS);
    elements.voiceInputButton.setAttribute("aria-label", "Stop and review voice input");
    elements.voiceInputButton.title = "Stop and review";
    elements.voiceListenButton.setAttribute("aria-label", "Stop recording");
    elements.voiceListenButton.title = "Stop recording";
  });
  recognition.addEventListener("audiostart", () => {
    if (activeVoiceSession !== session) return;
    session.audioStarted = true;
    if (session.startupTimer !== null) clearTimeout(session.startupTimer);
    session.startupTimer = null;
  });
  recognition.addEventListener("result", (event) => {
    if (activeVoiceSession !== session) return;
    markVoiceActivity(session, "recognition result");
    if (session.finalTimer !== null) clearTimeout(session.finalTimer);
    session.finalTimer = null;
    const transcript = [...event.results].map((result) => result[0].transcript).join(" ").trim();
    session.latestTranscript = transcript;
    elements.voiceTranscript.textContent = `Hearing: “${transcript}”`;
    elements.voiceTranscriptPanel.hidden = false;
    const latestResult = event.results[event.results.length - 1];
    if (latestResult.isFinal) {
      showVoiceResult(transcript, false, session);
      session.finalTimer = setTimeout(() => {
        voiceDebugLog("final result silence fallback", { durationMs: VOICE_SILENCE_DURATION_MS }, session.id);
        stopVoiceInput(false, session);
      }, VOICE_SILENCE_DURATION_MS);
    }
  });
  recognition.addEventListener("speechstart", () => {
    if (activeVoiceSession !== session) return;
    markVoiceActivity(session, "recognition speechstart");
    if (session.silenceTimer !== null) clearTimeout(session.silenceTimer);
    session.silenceTimer = null;
  });
  recognition.addEventListener("speechend", () => {
    if (activeVoiceSession !== session) return;
    if (session.silenceTimer !== null) clearTimeout(session.silenceTimer);
    session.silenceTimer = setTimeout(() => stopVoiceInput(false, session), VOICE_SILENCE_DURATION_MS);
  });
  recognition.addEventListener("error", (event) => {
    if (activeVoiceSession !== session) return;
    if (session.isStopping && event.error === "aborted") {
      voiceDebugLog("intentional stop reported as aborted", {}, session.id);
      return;
    }
    if (session.latestTranscript) {
      voiceDebugLog("recognition error ignored after result", { error: event.error || "unknown" }, session.id);
      return;
    }
    session.hadError = true;
    showVoiceError(voiceErrorMessage(event.error));
  });
  recognition.addEventListener("end", () => {
    if (activeVoiceSession !== session) return;
    completeVoiceSession(session);
  });
  try {
    voiceDebugLog("recognition start requested", {}, session.id);
    recognition.start();
    session.startupTimer = setTimeout(() => {
      if (activeVoiceSession !== session || session.audioStarted) return;
      voiceDebugLog("recognition startup timeout", { durationMs: VOICE_START_TIMEOUT_MS }, session.id);
      session.hadError = true;
      showVoiceError("Speech recognition could not be started.");
      try {
        recognition.abort();
      } catch {
        // Continue with local cleanup if recognition never entered a running state.
      }
      finishVoiceListening(session);
      showVoiceDialog();
    }, VOICE_START_TIMEOUT_MS);
    if (IS_IOS) {
      voiceDebugLog("meter skipped", { platform: "ios" }, session.id);
    } else if (navigator.mediaDevices?.getUserMedia) {
      startVoiceMeter(session).catch((error) => {
        voiceDebugLog("meter failed", { name: error?.name || "unknown" }, session.id);
        stopVoiceMeter(session);
      });
    } else {
      voiceDebugLog("meter unavailable", { reason: "mediaDevices" }, session.id);
    }
  } catch (error) {
    voiceDebugLog("recognition start threw", { name: error?.name || "unknown" }, session.id);
    if (activeVoiceSession !== session) return;
    session.hadError = true;
    showVoiceError("Speech recognition could not be started.");
    finishVoiceListening(session);
    elements.voiceListenButton.disabled = false;
    showVoiceDialog();
  }
}

function stopVoiceInput(showDialogImmediately, session = activeVoiceSession) {
  if (!session || activeVoiceSession !== session || session.isStopping || session.finished) return;
  voiceDebugLog("stop requested", { immediateDialog: showDialogImmediately }, session.id);
  ["silenceTimer", "startupTimer", "maxTimer", "finalTimer"].forEach((name) => {
    if (session[name] !== null) clearTimeout(session[name]);
    session[name] = null;
  });
  session.isListening = false;
  session.isStopping = true;
  elements.voiceStatus.textContent = "Finishing...";
  elements.voiceStatus.classList.remove("is-listening");
  elements.voiceInputButton.classList.remove("is-listening");
  elements.voiceInputButton.classList.remove("is-meterless");
  elements.voiceListenButton.classList.remove("is-listening");
  elements.voiceListenButton.classList.remove("is-meterless");
  elements.voiceInputButton.disabled = true;
  elements.voiceListenButton.disabled = true;
  elements.voiceListenButton.setAttribute("aria-label", "Finishing recording");
  elements.voiceListenButton.title = "Finishing recording";
  if (showDialogImmediately) showVoiceDialog();
  try {
    session.recognition.stop();
    session.cleanupTimer = setTimeout(() => {
      if (activeVoiceSession !== session) return;
      voiceDebugLog("recognition cleanup timeout", {}, session.id);
      try {
        session.recognition.abort();
      } catch {
        // Continue with local cleanup if Safari has already released recognition.
      }
      completeVoiceSession(session);
    }, VOICE_CLEANUP_TIMEOUT_MS);
  } catch {
    session.hadError = true;
    showVoiceError("Voice input could not be completed.");
    finishVoiceListening(session);
    showVoiceDialog();
  }
}

function toggleVoiceListening() {
  if (activeVoiceSession?.isListening) {
    stopVoiceInput(!elements.voiceDialog.open, activeVoiceSession);
    return;
  }
  if (!activeVoiceSession) startVoiceInput();
}

function closeVoiceDialog() {
  const session = activeVoiceSession;
  voiceDebugLog("dialog closed", {}, session?.id);
  if (session) {
    session.dialogCancelled = true;
    try {
      session.recognition.abort();
    } catch {
      // Continue closing if recognition has already ended.
    }
    finishVoiceListening(session);
  }
  pendingVoiceChanges = null;
  elements.voiceDialog.close();
}

function applyVoiceChanges() {
  if (!pendingVoiceChanges) return;
  Object.assign(state, pendingVoiceChanges);
  saveIndoorReadings();
  closeVoiceDialog();
  render();
}

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

function hasMeaningfulRhImprovement(projectedRh) {
  return state.indoorRh - projectedRh >= MINIMUM_NOTICEABLE_RH_CHANGE;
}

function projectedDryAirHorizon(startWeather, timeline) {
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

    const exchange = effectiveAirExchange(weather, projectedTemp);
    const airExchangeFraction = 1 - Math.exp(-exchange.airChangesPerHour / 60);
    const heatChangesPerHour = exchange.airChangesPerHour * THERMAL_RESPONSE_FACTOR;
    const heatExchangeFraction = 1 - Math.exp(-heatChangesPerHour / 60);
    const outdoorRatio = humidityRatio(weather.temp, weather.rh, pressure);
    projectedRatio += (outdoorRatio - projectedRatio) * airExchangeFraction;
    projectedTemp += (weather.temp - projectedTemp) * heatExchangeFraction;
  }

  return { minutes: MAX_OPEN_MINUTES, capped: true };
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
  let lastComfortableTemp = state.indoorTemp;
  let lastComfortableRh = state.indoorRh;

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
      if (!hasMeaningfulRhImprovement(projectedRhBeforeMixing)) {
        return planResult("minimal-impact", {
          limitMinutes: minute - 1,
          projectedTemp,
          projectedRh: projectedRhBeforeMixing,
        });
      }
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
      if (lastComfortableMinute && !hasMeaningfulRhImprovement(lastComfortableRh)) {
        return planResult("minimal-impact", {
          limitMinutes: lastComfortableMinute,
          projectedTemp: lastComfortableTemp,
          projectedRh: lastComfortableRh,
        });
      }
      return planResult("condensation", {
        limitMinutes: minute - 1,
        projectedTemp: lastComfortableTemp,
        projectedRh: lastComfortableRh,
      });
    }

    projectedRh = relativeHumidityAtTemperature(projectedVapor, projectedTemp);
    if (projectedTemp < state.minTemp) {
      if (lastComfortableMinute && !hasMeaningfulRhImprovement(lastComfortableRh)) {
        return planResult("minimal-impact", {
          limitMinutes: lastComfortableMinute,
          projectedTemp: lastComfortableTemp,
          projectedRh: lastComfortableRh,
        });
      }
      return planResult("too-cold", {
        limitMinutes: lastComfortableMinute,
        projectedTemp: lastComfortableTemp,
        projectedRh: lastComfortableRh,
      });
    }

    lastComfortableMinute = minute;
    lastComfortableTemp = projectedTemp;
    lastComfortableRh = projectedRh;
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
    hasMeaningfulRhImprovement(projectedRh) &&
      initialAbsolute - finalAbsolute > initialComparison.margin
      ? "slow"
      : "minimal-impact",
    {
      limitMinutes: lastComfortableMinute,
      projectedTemp,
      projectedRh,
    },
  );
}

function formatPlanSummary() {
  const minimum = state.minTemp.toFixed(1).replace(/\.0$/, "");
  return `Min ${minimum}°C · Target ${formatRh(state.targetRh)} RH`;
}

function formatVentilationSummary() {
  const volume = roomVolume().toFixed(1).replace(/\.0$/, "");
  const opening = state.openingSetup === "custom"
    ? `Custom airflow · ${state.customAirflow.toFixed(1).replace(/\.0$/, "")} m³/h`
    : state.openingSetup === "single"
      ? "One window open"
      : OPENING_SETUPS[state.openingSetup]?.label ?? OPENING_SETUPS.single.label;
  return `${volume} m³ · ${opening}`;
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
  elements.planSummaryText.textContent = formatPlanSummary();
  elements.planSummaryVentilationText.textContent = formatVentilationSummary();
}

function renderPlan() {
  renderPlanControls();
  elements.forecastStrip.innerHTML = "";

  const timeline = buildWeatherTimeline();
  if (!timeline.length) {
    for (let index = 0; index < 3; index += 1) {
      const placeholder = document.createElement("div");
      placeholder.className = `forecast-pill forecast-placeholder${state.weatherLoadFailed ? " is-static" : ""}`;
      placeholder.setAttribute("aria-hidden", "true");
      placeholder.innerHTML = "<span></span><strong></strong><small></small><small></small>";
      elements.forecastStrip.append(placeholder);
    }
    elements.planConfidence.textContent = state.weatherLoadFailed
      ? "Outdoor data unavailable"
      : "Waiting for outdoor data...";
    return null;
  }

  const current = timeline[0];
  const currentPlan = estimateOpeningWindowPlan(current, timeline);
  if (currentPlan.status === "good") {
    currentPlan.dryAirHorizon = projectedDryAirHorizon(current, timeline);
  }
  const exchange = effectiveAirExchange(current, state.indoorTemp);
  elements.planConfidence.textContent = `About ${exchange.airChangesPerHour.toFixed(1)} air changes/hr`;

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
    condensation: "Condensation",
    "forecast-limit": "Forecast change",
    settling: "Benefit fades",
    slow: "3 hr+",
    "minimal-impact": "Little benefit",
  };

  forecastStarts.forEach((item, index) => {
    const plan = estimateOpeningWindowPlan(item, timeline);
    const exchange = effectiveAirExchange(item, state.indoorTemp);
    const pill = document.createElement("div");
    pill.setAttribute("role", "listitem");
    pill.className = `forecast-pill ${plan.status} tone-${planTone(plan)}`;
    const valueLabel = (() => {
      if (plan.status === "good") return formatDuration(plan.minutes);
      if (["forecast-limit", "settling", "too-cold", "condensation"].includes(plan.status)) {
        const limit = plan.minutes ?? plan.limitMinutes;
        return limit ? `≤ ${formatDuration(limit)}` : labels[plan.status];
      }
      return labels[plan.status];
    })();
    const timeLabel = index === 0 ? "Now" : formatShortTime(item.time);
    pill.setAttribute(
      "aria-label",
      `${timeLabel}: ${valueLabel}, outdoor temperature ${formatTemp(item.temp)}, relative humidity ${formatRh(item.rh)}, estimated ${exchange.airChangesPerHour.toFixed(1)} air changes per hour`,
    );

    const time = document.createElement("span");
    time.textContent = timeLabel;
    const value = document.createElement("strong");
    value.textContent = valueLabel;
    const temp = document.createElement("small");
    temp.textContent = `${formatTemp(item.temp)} · ${formatRh(item.rh)} RH`;
    const airflow = document.createElement("small");
    airflow.className = "forecast-ach";
    airflow.textContent = `~${exchange.airChangesPerHour.toFixed(1)} ACH`;
    pill.append(time, value, temp, airflow);
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
function planTone(plan) {
  if (plan.status === "target-met") return "open";
  if (["good", "slow"].includes(plan.status)) return "windows";
  if (
    ["forecast-limit", "settling", "too-cold", "condensation"].includes(plan.status) &&
    (plan.minutes ?? plan.limitMinutes)
  ) {
    return "windows";
  }
  if (["below-minimum", "wetter"].includes(plan.status)) return "closed";
  if (["too-cold", "condensation"].includes(plan.status)) return "closed";
  return "caution";
}

function setToneClass(element, tone) {
  element.classList.remove("tone-open", "tone-windows", "tone-caution", "tone-closed");
  element.classList.add(`tone-${tone}`);
}
function renderRecommendation(plan) {
  elements.recommendation.classList.remove("open", "windows", "closed", "caution");
  elements.recommendation.classList.add(planTone(plan));
  const limited = ["too-cold", "condensation"].includes(plan.status);

  if (plan.status === "target-met") {
    elements.decisionLabel.textContent = "TARGET MET";
    setDecisionSummary(
      `At or near your ${formatRh(state.targetRh)} target.`,
      "No ventilation needed now.",
    );
  } else if (plan.status === "below-minimum") {
    elements.decisionLabel.textContent = "KEEP CLOSED";
    setDecisionSummary(
      `Room is below your ${formatTemp(state.minTemp)} minimum.`,
      "Ventilation would cool it further.",
    );
  } else if (plan.status === "wetter") {
    elements.decisionLabel.textContent = "KEEP CLOSED";
    setDecisionSummary(
      "Outdoor air contains more moisture.",
      "Opening would likely raise indoor humidity.",
    );
  } else if (plan.status === "uncertain") {
    elements.decisionLabel.textContent = "OPEN IF NEEDED";
    setDecisionSummary(
      "No clear drying benefit.",
      "Open briefly for fresh air; humidity may not fall.",
    );
  } else if (plan.status === "good") {
    elements.decisionLabel.textContent = "OPEN WINDOWS";
    const targetDuration = formatDuration(plan.minutes);
    const dryDuration = formatDuration(plan.dryAirHorizon.minutes);
    setDecisionSummary(
      `About ${targetDuration} to reach ${formatRh(state.targetRh)} RH.`,
      plan.dryAirHorizon.capped
        ? `At least ${dryDuration} while outdoor air remains reliably drier.`
        : `Up to ${dryDuration} while outdoor air remains reliably drier.`,
      targetDuration,
      dryDuration,
    );
  } else if (plan.status === "forecast-limit") {
    elements.decisionLabel.textContent = plan.limitMinutes ? "OPEN WINDOWS" : "OPEN IF NEEDED";
    const limitDuration = formatDuration(plan.limitMinutes);
    setDecisionSummary(
      plan.limitMinutes
        ? `Up to ${limitDuration} while forecast air remains reliably drier.`
        : "No clear drying benefit.",
      plan.limitMinutes
        ? `Estimated then: ${formatRh(plan.projectedRh)} RH at ${formatTemp(plan.projectedTemp)}.`
        : "Open briefly for fresh air; humidity may not fall.",
      plan.limitMinutes ? limitDuration : null,
    );
  } else if (plan.status === "settling") {
    elements.decisionLabel.textContent = plan.minutes ? "OPEN WINDOWS" : "OPEN IF NEEDED";
    const settlingDuration = formatDuration(plan.minutes);
    setDecisionSummary(
      plan.minutes
        ? `Up to ${settlingDuration} of useful drying.`
        : "No clear drying benefit.",
      plan.minutes
        ? `Estimated then: ${formatRh(plan.projectedRh)} RH at ${formatTemp(plan.projectedTemp)}.`
        : "Open briefly for fresh air; humidity may not fall.",
      plan.minutes ? settlingDuration : null,
    );
  } else if (limited) {
    elements.decisionLabel.textContent = plan.limitMinutes ? "OPEN WINDOWS" : "KEEP CLOSED";
    const limitDuration = formatDuration(plan.limitMinutes);
    const primary =
      plan.status === "too-cold"
        ? plan.limitMinutes
          ? `Up to ${limitDuration} before the room reaches ${formatTemp(state.minTemp)}.`
          : `The room would fall below ${formatTemp(state.minTemp)} immediately.`
        : plan.limitMinutes
          ? `Up to ${limitDuration} before condensation risk increases.`
          : "Cooling may cause condensation immediately.";
    const secondary =
      plan.status === "condensation" && plan.limitMinutes
        ? "Stop then to limit condensation risk."
        : plan.limitMinutes
          ? `Estimated then: ${formatRh(plan.projectedRh)} RH at ${formatTemp(plan.projectedTemp)}.`
          : "No useful opening time is available.";
    setDecisionSummary(
      primary,
      secondary,
      plan.limitMinutes ? limitDuration : null,
    );
  } else if (plan.status === "slow") {
    elements.decisionLabel.textContent = "OPEN WINDOWS";
    const modelDuration = formatDuration(MAX_OPEN_MINUTES);
    setDecisionSummary(
      `More than ${modelDuration} to reach ${formatRh(state.targetRh)} RH.`,
      `Humidity should still fall slowly. Recheck indoor readings within ${modelDuration}.`,
      modelDuration,
      modelDuration,
    );
  } else if (plan.status === "minimal-impact") {
    elements.decisionLabel.textContent = "OPEN IF NEEDED";
    setDecisionSummary(
      "No clear drying benefit.",
      "Open briefly for fresh air; humidity may not fall.",
    );
  } else {
    elements.decisionLabel.textContent = "WAIT";
    setDecisionSummary("No clear drying benefit.", "Check conditions again later.");
  }
}

function planLimitingExplanation(plan, comparison) {
  const limitedAfter = Number.isFinite(plan.limitMinutes) && plan.limitMinutes > 0
    ? `after about ${formatDuration(plan.limitMinutes)}`
    : "almost immediately";

  switch (plan.status) {
    case "target-met":
      return `indoor humidity is already at or near your ${formatRh(state.targetRh)} target, so ventilation is not needed now.`;
    case "below-minimum":
      return `the room is already below your ${formatTemp(state.minTemp)} minimum, so opening would cool it further.`;
    case "wetter":
      return "opening would bring in air with more moisture and could raise indoor humidity.";
    case "uncertain":
      return "the model therefore recommends opening only if needed for fresh air.";
    case "good":
      return `the model estimates about ${formatDuration(plan.minutes)} to reach your ${formatRh(state.targetRh)} target.`;
    case "forecast-limit":
      return plan.limitMinutes
        ? `forecast air is expected to stop being reliably drier ${limitedAfter}.`
        : "the forecast does not stay reliably drier long enough for useful airing.";
    case "settling":
      return `the simulated indoor-outdoor moisture difference no longer clears the uncertainty allowance ${limitedAfter}.`;
    case "too-cold":
      return plan.limitMinutes
        ? `the room is estimated to reach your ${formatTemp(state.minTemp)} minimum ${limitedAfter}.`
        : `the room would fall below your ${formatTemp(state.minTemp)} minimum almost immediately.`;
    case "condensation":
      return plan.limitMinutes
        ? `the model predicts condensation risk ${limitedAfter}.`
        : "the model predicts condensation risk almost immediately.";
    case "slow":
      return `the model projects some drying, but does not reach your target within its ${MAX_OPEN_MINUTES / 60}-hour simulation.`;
    case "minimal-impact": {
      const projectedRhDrop = state.indoorRh - plan.projectedRh;
      if (projectedRhDrop < MINIMUM_NOTICEABLE_RH_CHANGE) {
        return "With this plan, opening a window isn't expected to lower the indoor humidity reading by even one percentage point.";
      }
      const projectedMoisture = absoluteHumidity(plan.projectedTemp, plan.projectedRh);
      if (comparison.indoor - projectedMoisture <= comparison.margin) {
        return "With this plan, the expected moisture reduction is within the margin of error, so the change is unclear.";
      }
      return "With this plan, the model does not predict a clear reduction in indoor moisture.";
    }
    default:
      return "the model does not find a clear drying benefit under the current settings.";
  }
}

function renderRecommendationExplanation(plan, comparison, adjustedRh, condensationRisk) {
  if (state.outdoorTemp === null || state.outdoorRh === null) {
    const locationName = state.location.name || "the selected location";
    elements.explanationText.textContent = state.weatherLoadFailed
      ? `Outdoor weather is unavailable for ${locationName}. No successful weather data is available, so a recommendation cannot be made.`
      : `Checking outdoor weather for ${locationName}. The recommendation will appear when current data arrives.`;
    return;
  }

  const freshness = state.weatherRequestPending && state.lastSuccessfulUpdateAt
    ? `A refresh is in progress; this recommendation uses the last successful update from ${formatWeatherTimestamp(
        state.lastSuccessfulUpdateAt,
      )}.`
    : state.weatherLoadFailed && state.lastSuccessfulUpdateAt
      ? `The latest refresh failed at ${formatWeatherTimestamp(
          state.lastCheckedAt,
        )}; this recommendation uses the last successful update from ${formatWeatherTimestamp(
          state.lastSuccessfulUpdateAt,
        )}.`
      : "";

  const percentDifference = (Math.abs(comparison.difference) / comparison.indoor) * 100;
  const relationship = comparison.status === "drier"
    ? `Outdoor air contains about ${percentDifference.toFixed(
        0,
      )}% less water vapour than indoors, more than the margin of error in the readings (about ±${comparison.margin.toFixed(
        1,
      )} g/m³).`
    : comparison.status === "wetter"
      ? `Outdoor air contains about ${percentDifference.toFixed(
        0,
      )}% more water vapour than indoors, more than the margin of error in the readings (about ±${comparison.margin.toFixed(
        1,
      )} g/m³).`
      : `Indoor and outdoor air contain similar amounts of water vapour, within the margin of error in the readings (about ±${comparison.margin.toFixed(
        1,
      )} g/m³).`;
  const adjustedHumidity = condensationRisk
    ? "If warmed to your room's current temperature, outdoor air would be at 100% RH"
    : `If warmed to your room's current temperature, it would be about ${formatRh(adjustedRh)} RH`;
  const sentences = [freshness, relationship].filter(Boolean);
  const limitingExplanation = planLimitingExplanation(plan, comparison);
  sentences.push(plan.status === "minimal-impact"
    ? `${adjustedHumidity}. ${limitingExplanation}`
    : `${adjustedHumidity}; ${limitingExplanation}`);
  elements.explanationText.textContent = sentences.join(" ");
}

function renderWeatherDataDetails() {
  elements.sourceLocationName.textContent = state.location.name || "Selected location";
  elements.liveWeatherRequest.href = weatherUrlForLocation(state.location);

  const lastSuccess = state.lastSuccessfulUpdateAt;
  if (state.weatherRequestPending) {
    elements.weatherDataStatus.textContent = lastSuccess
      ? `Weather refresh in progress. Showing the last successful update from ${formatWeatherTimestamp(lastSuccess)}.`
      : "Weather update in progress. No successful update is available yet.";
  } else if (state.weatherLoadFailed) {
    const failedAt = state.lastCheckedAt
      ? `Latest refresh failed at ${formatWeatherTimestamp(state.lastCheckedAt)}.`
      : "The latest weather refresh failed.";
    elements.weatherDataStatus.textContent = lastSuccess
      ? `${failedAt} Showing the last successful update from ${formatWeatherTimestamp(lastSuccess)}.`
      : `${failedAt} No successful weather data is available.`;
  } else {
    elements.weatherDataStatus.textContent = lastSuccess
      ? `Last successful update: ${formatWeatherTimestamp(lastSuccess)}.`
      : "No successful weather update is available yet.";
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
  renderWeatherDataDetails();
  const indoorDew = dewPoint(state.indoorTemp, state.indoorRh);
  const indoorAbsolute = absoluteHumidity(state.indoorTemp, state.indoorRh);
  elements.indoorDewPoint.textContent = formatTemp(indoorDew);
  elements.indoorAbsoluteHumidity.textContent = formatMoisture(indoorAbsolute);
  elements.outdoorAbsoluteHumidity.classList.remove("lower", "higher", "near");

  if (state.outdoorTemp === null || state.outdoorRh === null) {
    elements.retryWeather.hidden = !state.weatherLoadFailed;
    elements.recommendation.classList.remove("open", "windows", "closed", "caution");
    elements.decisionLabel.textContent = state.weatherLoadFailed
      ? "NO DATA"
      : "CHECKING";
    setDecisionSummary(
      state.weatherLoadFailed ? "Outdoor weather is currently unavailable." : "Getting local conditions...",
      state.weatherLoadFailed ? "Check your connection and try again." : "",
    );
    renderRecommendationExplanation(null, null, null, false);
    elements.outdoorTempValue.textContent = "--";
    elements.outdoorRhValue.textContent = "--";
    elements.outdoorDewPoint.textContent = "--";
    elements.outdoorAbsoluteHumidity.textContent = "--";
    elements.warmedOutdoorRh.textContent = "--";
    elements.adjustedAirNote.textContent = "";
    return;
  }

  elements.retryWeather.hidden = true;

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
  renderRecommendationExplanation(plan, comparison, displayedAdjustedRh, condensationRisk);
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
      return true;
    }
  } catch {
    localStorage.removeItem(LOCATION_STORAGE_KEY);
  }
  return false;
}

function hasRequestedLocation() {
  try {
    return localStorage.getItem(LOCATION_REQUESTED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function markLocationRequested() {
  try {
    localStorage.setItem(LOCATION_REQUESTED_STORAGE_KEY, "true");
  } catch {
    // The browser may request location again when storage is unavailable.
  }
}

function setLocation(location, mode) {
  activeWeatherRequestId += 1;
  state.location = location;
  state.locationMode = mode;
  state.outdoorTemp = null;
  state.outdoorRh = null;
  state.outdoorDewPoint = null;
  state.forecast = [];
  state.updatedAt = null;
  state.lastCheckedAt = null;
  state.lastSuccessfulUpdateAt = null;
  state.weatherRequestPending = false;
  state.weatherLoadFailed = false;
  saveLocation();
  updateLocationUi();
  render();
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

function formatSearchLocation(result) {
  if (result.source === "postcode") {
    return [result.postcode, result.admin_district || result.region].filter(Boolean).join(", ");
  }
  if (result.source === "outcode") {
    const districts = Array.isArray(result.admin_district)
      ? result.admin_district.filter(Boolean).join(" / ")
      : result.admin_district;
    return [result.outcode, districts].filter(Boolean).join(", ");
  }
  const parts = [result.name, result.admin2 || result.admin1, result.country].filter(Boolean);
  return [...new Set(parts)].join(", ");
}

function normalizeUkPostcode(query) {
  const compact = query.toUpperCase().replace(/\s+/g, "");
  if (!/^(GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2})$/.test(compact)) return null;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

function normalizeUkOutcode(query) {
  const compact = query.toUpperCase().replace(/\s+/g, "");
  return /^[A-Z]{1,2}\d[A-Z\d]?$/.test(compact) ? compact : null;
}

async function searchUkPostcode(postcode) {
  const response = await fetch(`${UK_POSTCODE_ENDPOINT}/${encodeURIComponent(postcode)}`);
  if (response.status === 404) return [];
  if (!response.ok) throw new Error("Postcode search failed");
  const data = await response.json();
  if (!data.result) return [];
  return [{ ...data.result, source: "postcode" }];
}

async function searchUkOutcode(outcode) {
  const response = await fetch(`${UK_OUTCODE_ENDPOINT}/${encodeURIComponent(outcode)}`);
  if (response.status === 404) return [];
  if (!response.ok) throw new Error("Outward-code search failed");
  const data = await response.json();
  if (!data.result) return [];
  return [{ ...data.result, source: "outcode" }];
}

function locationMatchesQualifier(result, qualifier) {
  if (!qualifier) return true;
  const fields = [result.admin1, result.admin2, result.admin3, result.admin4, result.country];
  return fields.some((field) => field?.toLowerCase().includes(qualifier.toLowerCase()));
}

async function searchTownLocations(query, worldwide = false) {
  const [town, qualifier = ""] = query.split(",", 2).map((part) => part.trim());
  const params = new URLSearchParams({
    name: worldwide ? query : town,
    count: worldwide ? "5" : "20",
    language: "en",
    format: "json",
  });
  if (!worldwide) params.set("countryCode", "GB");
  const response = await fetch(`${GEOCODING_ENDPOINT}?${params}`);
  if (!response.ok) throw new Error("Location search failed");
  const data = await response.json();
  const results = Array.isArray(data.results) ? data.results : [];
  if (worldwide) return results.slice(0, 5);
  if (!qualifier) return results.slice(0, 4);

  const matching = results.filter((result) => locationMatchesQualifier(result, qualifier));
  return (matching.length ? matching : results).slice(0, 4);
}

async function searchLocations(query, worldwide = false) {
  const postcode = normalizeUkPostcode(query);
  if (postcode && !worldwide) return searchUkPostcode(postcode);
  const outcode = normalizeUkOutcode(query);
  if (outcode && !worldwide) return searchUkOutcode(outcode);
  return searchTownLocations(query, worldwide);
}

function isUkPostcodeQuery(query) {
  return Boolean(normalizeUkPostcode(query) || normalizeUkOutcode(query));
}

function addWorldwideSearchButton(query) {
  const button = document.createElement("button");
  button.className = "location-worldwide-button";
  button.type = "button";
  button.textContent = "Search worldwide";
  button.addEventListener("click", async () => {
    button.disabled = true;
    elements.locationDialogStatus.textContent = "Searching worldwide...";
    try {
      const results = await searchLocations(query, true);
      elements.locationDialogStatus.textContent = "";
      renderLocationResults(results, query, true);
    } catch {
      elements.locationDialogStatus.textContent = "Worldwide search is unavailable. Try again.";
    }
  });
  elements.locationSearchResults.append(button);
}

function renderLocationResults(results, query, worldwide = false) {
  elements.locationSearchResults.replaceChildren();

  if (!results.length) {
    const isPostcode = isUkPostcodeQuery(query);
    elements.locationDialogStatus.textContent = isPostcode
      ? "Postcode not found. Check it and try again."
      : worldwide
        ? "No matching locations found."
        : "No UK locations found.";
    if (!isPostcode && !worldwide) addWorldwideSearchButton(query);
    return;
  }

  elements.retryWeather.hidden = true;

  results.forEach((result) => {
    const button = document.createElement("button");
    button.className = "location-result-button";
    button.type = "button";
    button.textContent = formatSearchLocation(result);
    button.addEventListener("click", async () => {
      setLocation(
        {
          name: formatSearchLocation(result),
          latitude: result.latitude,
          longitude: result.longitude,
        },
        "search",
      );
      closeLocationDialog();
      await fetchWeather();
    });
    elements.locationSearchResults.append(button);
  });

  if (!worldwide && !isUkPostcodeQuery(query)) addWorldwideSearchButton(query);
}

async function handleLocationSearch(event) {
  event.preventDefault();
  const query = elements.locationSearchInput.value.trim();
  if (query.length < 2) {
    elements.locationDialogStatus.textContent = "Enter at least two characters.";
    return;
  }

  elements.locationSearchButton.disabled = true;
  elements.locationSearchResults.replaceChildren();
  elements.locationDialogStatus.textContent = "Searching...";

  try {
    const results = await searchLocations(query);
    elements.locationDialogStatus.textContent = "";
    renderLocationResults(results, query);
  } catch {
    elements.locationDialogStatus.textContent = "Location search is unavailable. Try again.";
  } finally {
    elements.locationSearchButton.disabled = false;
  }
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
  elements.locationUpdateButton.disabled = true;
  elements.locationUpdateButton.textContent = "Locating...";
  elements.locationDialogStatus.textContent = "Requesting your current location...";

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
    closeLocationDialog();
    await fetchWeather();
  } catch {
    elements.locationDialogStatus.textContent = "Location access was unavailable. Check permission and try again.";
    if (!state.lastCheckedAt) await fetchWeather();
  } finally {
    elements.locationUpdateButton.disabled = false;
    elements.locationUpdateButton.textContent = "Use current location";
  }
}

function openLocationDialog() {
  elements.locationDialogStatus.textContent = "";
  elements.locationSearchInput.value = "";
  elements.locationSearchResults.replaceChildren();
  elements.locationDialog.showModal();
}

function openPlanDialog() {
  if (elements.planDialog.open) return;
  elements.planDialog.showModal();
  elements.planDialogCloseButton.focus();
}

function closePlanDialog() {
  if (elements.planDialog.open) elements.planDialog.close();
}

function closeLocationDialog() {
  if (elements.locationDialog.open) elements.locationDialog.close();
}

async function initializeLocation(hasSavedLocation) {
  if (hasSavedLocation || hasRequestedLocation()) {
    await fetchWeather();
    return;
  }

  markLocationRequested();
  await useCurrentLocation();
}
async function fetchWeather() {
  const requestId = ++activeWeatherRequestId;
  const requestLocation = { ...state.location };
  state.weatherRequestPending = true;
  state.weatherLoadFailed = false;
  elements.weatherStatus.textContent = "Updating outdoor...";
  elements.recommendation.setAttribute("aria-busy", "true");
  elements.dashboardPanel.setAttribute("aria-busy", "true");
  elements.refreshWeather.disabled = true;
  elements.retryWeather.disabled = true;
  render();

  try {
    const response = await fetch(weatherUrlForLocation(requestLocation));
    if (!response.ok) throw new Error("Weather request failed");
    const data = await response.json();
    if (requestId !== activeWeatherRequestId) return;
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
    state.lastCheckedAt = new Date();
    state.lastSuccessfulUpdateAt = state.lastCheckedAt;
    state.weatherLoadFailed = false;
    if (typeof data.timezone === "string" && data.timezone) state.timezone = data.timezone;

    elements.weatherStatus.textContent = `Last checked ${formatShortTime(state.lastCheckedAt)}`;
  } catch {
    if (requestId !== activeWeatherRequestId) return;
    state.lastCheckedAt = new Date();
    state.weatherLoadFailed = true;
    elements.weatherStatus.textContent = "Update failed";
  } finally {
    if (requestId !== activeWeatherRequestId) return;
    state.weatherRequestPending = false;
    elements.recommendation.removeAttribute("aria-busy");
    elements.dashboardPanel.removeAttribute("aria-busy");
    elements.refreshWeather.disabled = false;
    elements.retryWeather.disabled = false;
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

function bindSteppers() {
  const settings = {
    indoorTemp: { min: 10, max: 32, step: 0.1, save: saveIndoorReadings },
    indoorRh: { min: 20, max: 90, step: 1, save: saveIndoorReadings },
    targetRh: { min: 40, max: 65, step: 1, save: savePlanSettings },
    minTemp: { min: 16, max: 26, step: 0.5, save: savePlanSettings },
  };

  document.querySelectorAll(".step-button").forEach((button) => {
    const stateKey = button.dataset.stepTarget;
    const setting = settings[stateKey];
    const direction = Number(button.dataset.stepDirection);
    if (!setting || !Number.isFinite(direction)) return;

    let repeatDelay;
    let repeatTimer;
    let repeated = false;

    const applyStep = () => {
      const precision = setting.step < 1 ? 1 : 0;
      state[stateKey] = Number(
        clamp(state[stateKey] + setting.step * direction, setting.min, setting.max).toFixed(precision),
      );
      setting.save();
      render();
    };

    const stopRepeating = () => {
      clearTimeout(repeatDelay);
      clearInterval(repeatTimer);
    };

    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      repeated = false;
      repeatDelay = setTimeout(() => {
        repeated = true;
        applyStep();
        repeatTimer = setInterval(applyStep, 110);
      }, 450);
    });
    button.addEventListener("pointerup", stopRepeating);
    button.addEventListener("pointercancel", stopRepeating);
    button.addEventListener("pointerleave", stopRepeating);
    button.addEventListener("click", () => {
      if (!repeated) applyStep();
    });
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
  bindSteppers();
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
  elements.retryWeather.addEventListener("click", fetchWeather);
  elements.locationButton.addEventListener("click", openLocationDialog);
  elements.locationDialogClose.addEventListener("click", closeLocationDialog);
  elements.locationUpdateButton.addEventListener("click", useCurrentLocation);
  elements.locationSearchForm.addEventListener("submit", handleLocationSearch);
  elements.planSummaryButton.addEventListener("click", openPlanDialog);
  elements.planDialogCloseButton.addEventListener("click", closePlanDialog);
  elements.planDialog.addEventListener("close", () => {
    elements.planSummaryButton.focus({ preventScroll: true });
  });
  if (SpeechRecognition) {
    elements.voiceInputButton.hidden = false;
    elements.voiceInputButton.addEventListener("click", toggleVoiceListening);
    elements.voiceListenButton.addEventListener("click", toggleVoiceListening);
    elements.voiceDialogCloseButton.addEventListener("click", closeVoiceDialog);
    elements.voiceApplyButton.addEventListener("click", applyVoiceChanges);
    elements.voiceDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeVoiceDialog();
    });
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}

loadIndoorReadings();
loadPlanSettings();
initializeVoiceDebugPanel();
const hasSavedLocation = loadLocation();
updateLocationUi();
bindEvents();
render();
initializeLocation(hasSavedLocation);
setInterval(fetchWeather, WEATHER_REFRESH_INTERVAL_MS);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") {
    const session = activeVoiceSession;
    if (session) {
      voiceDebugLog("page hidden during session", {}, session.id);
      session.dialogCancelled = true;
      try {
        session.recognition.abort();
      } catch {
        // Continue cleanup if recognition was interrupted by the browser first.
      }
      finishVoiceListening(session);
    }
    return;
  }
  if (!state.lastCheckedAt || minutesSince(state.lastCheckedAt) >= 15) fetchWeather();
});
